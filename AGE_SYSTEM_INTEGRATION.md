# WELLsync Age System Integration

The files in this folder add the age system without adding a new database table.
Age is stored in Supabase Auth `user_metadata.age`.

## 1. Copy new files

Copy these into your project:

- `src/utils/ageUtils.js`
- `src/components/AgeSetup.jsx`
- `src/components/AgeSetup.css`
- `src/components/Auth.jsx` (replacement for the current Auth.jsx)

## 2. App.jsx

Add:

```jsx
import AgeSetup from "./components/AgeSetup";
import { isValidAge } from "./utils/ageUtils";
```

Add this helper above `App()`:

```jsx
function hasValidUserAge(user) {
  return isValidAge(user?.user_metadata?.age);
}
```

Inside `App()` add state:

```jsx
const [ageRequired, setAgeRequired] = useState(false);
```

In `loadSession()`, immediately after `setSession(session);`, add:

```jsx
setAgeRequired(Boolean(session?.user) && !hasValidUserAge(session.user));
```

In the `onAuthStateChange` callback, immediately after `setSession(nextSession);`, add:

```jsx
setAgeRequired(Boolean(nextSession?.user) && !hasValidUserAge(nextSession.user));
```

In `handleSignOut()`, after `setSession(null);`, add:

```jsx
setAgeRequired(false);
```

Finally, after this existing block:

```jsx
if (!session) {
  return <Auth />;
}
```

add:

```jsx
if (ageRequired) {
  return (
    <AgeSetup
      user={session.user}
      onComplete={(updatedUser) => {
        if (!updatedUser) return;

        setSession((current) =>
          current
            ? { ...current, user: updatedUser }
            : current
        );

        setAgeRequired(false);
      }}
    />
  );
}
```

## 3. Profile.jsx

Add the import:

```jsx
import { isValidAge } from "../utils/ageUtils";
```

Add state:

```jsx
const [age, setAge] = useState("");
```

Inside `loadProfile()`, after the existing name setter:

```jsx
setAge(metadata.age ? String(metadata.age) : "");
```

At the start of `handleSaveProfile()`, before `setSavingProfile(true);`, add:

```jsx
if (!isValidAge(age)) {
  setError("Enter a valid age between 13 and 120.");
  return;
}
```

Change the existing `updateUser()` data object from:

```jsx
data: {
  full_name: name.trim(),
},
```

to:

```jsx
data: {
  ...(user?.user_metadata || {}),
  full_name: name.trim(),
  age: Number(age),
},
```

After the Email field block, add:

```jsx
<div className="profile-field">
  <label htmlFor="profile-age">Age</label>
  <input
    id="profile-age"
    type="number"
    min="13"
    max="120"
    step="1"
    inputMode="numeric"
    value={age}
    onChange={(event) => {
      setAge(event.target.value);
      setMessage("");
      setError("");
    }}
  />
</div>
```

## 4. AICompanion.jsx

Add imports:

```jsx
import { supabase } from "../lib/supabase";
import { getAgeProfile } from "../utils/ageUtils";
```

Inside `sendMessage()`, immediately before `const requestBody = {`, add:

```jsx
let profile = {};

if (supabase) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    profile = getAgeProfile(user?.user_metadata?.age);
  } catch (error) {
    console.info(
      "Could not load age context for AI:",
      error?.message || error
    );
  }
}
```

Then change:

```jsx
profile: {},
```

to:

```jsx
profile,
```

This means every chat message gets the latest age context.

## 5. Dashboard.jsx

Add:

```jsx
import { getCurrentUserAgeProfile } from "../utils/ageUtils";
```

Change:

```jsx
async function fetchAiBrief(data, goals, history) {
```

to:

```jsx
async function fetchAiBrief(data, goals, history) {
  const profile = await getCurrentUserAgeProfile();
```

Then change:

```jsx
profile: {},
```

to:

```jsx
profile,
```

No other Dashboard behavior changes.

## 6. backend/main.py

Keep the existing `AIChatRequest.profile` field. Add these helpers after `safe_int()`:

```python
def normalize_age(value: Any) -> int | None:
    try:
        age = int(value)
    except (TypeError, ValueError):
        return None

    if age < 13 or age > 120:
        return None

    return age


def get_age_group(age: int | None) -> str:
    if age is None:
        return "unknown"
    if age < 18:
        return "teen"
    if age < 26:
        return "young_adult"
    if age < 40:
        return "adult"
    if age < 60:
        return "midlife_adult"
    return "older_adult"


def normalize_profile(profile: dict[str, Any] | None) -> dict[str, Any]:
    profile = profile or {}
    age = normalize_age(profile.get("age"))

    if age is None:
        return {}

    return {
        "age": age,
        "age_group": get_age_group(age),
    }


def build_age_guidance(profile: dict[str, Any] | None) -> str:
    normalized = normalize_profile(profile)
    age = normalized.get("age")
    group = normalized.get("age_group")

    if age is None:
        return (
            "Age context is unavailable. Do not assume a life stage; give general "
            "wellness guidance and avoid age-specific claims."
        )

    if group == "teen":
        return (
            f"The user is {age} years old and is under 18. Use age-appropriate, "
            "supportive wellness guidance. Do not provide restrictive dieting, "
            "calorie-cutting targets, weight-loss plans, appearance-focused advice, "
            "extreme exercise targets, or dangerous challenges. Avoid treating adult "
            "fitness or nutrition targets as appropriate for this user. Encourage "
            "balanced routines, adequate rest, regular meals, hydration, enjoyable "
            "movement, and support from a trusted adult or qualified professional "
            "when a health concern needs individualized care."
        )

    return (
        f"The user is {age} years old ({group}). Use the user's life stage when it "
        "is relevant, but do not assume medical conditions or needs solely from age. "
        "Keep recommendations practical, sustainable, and appropriate to the stated context."
    )
```

Inside `build_system_instruction()`, before the final `return f\"\"\"`, add:

```python
age_guidance = build_age_guidance(request.profile)
```

Then insert this section into the system prompt, after `HEALTH INFORMATION:`:

```text
AGE-AWARE PERSONALIZATION:
{age_guidance}
```

In `run_gemini()`, change:

```python
"profile": request.profile or {},
```

to:

```python
"profile": normalize_profile(request.profile),
```

## Result

New users:

Sign up -> name + age -> Supabase metadata -> app

Existing users without an age:

Login -> age setup -> app

AI:

Current user -> age profile -> backend -> age-aware Gemini instructions

The core wellness score, check-in fields, navigation, and existing goals remain unchanged by this age-system implementation.
