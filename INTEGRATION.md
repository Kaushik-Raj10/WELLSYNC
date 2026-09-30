# WELLsync Age System — Safe Replacement Package

This package is intentionally additive. Do not replace the whole project.

## Replace

- `src/components/Auth.jsx`
- `src/components/AICompanion.jsx`
- `backend/main.py`

## Add

- `src/utils/ageUtils.js`

## Do NOT replace

- `src/App.jsx`
- `src/components/Dashboard.jsx`
- `src/components/Profile.jsx`
- `src/components/AICompanion.css`
- `src/components/Dashboard.css`

Your latest Dashboard/background/music changes are deliberately left alone.

## What it does

1. Sign-up requires age (13–120).
2. Sign-in requires age.
3. For an existing account that has no age yet, the entered age is saved on the first successful sign-in.
4. For an account that already has an age, the entered age must match the stored age.
5. The age is stored in Supabase Auth user metadata as `user_metadata.age`.
6. The AI Companion reads the authenticated user's age and sends it as `profile`.
7. The backend normalizes the age and adds age-aware instructions to Gemini.
8. Under-18 users receive more protective, age-appropriate wellness guidance.

## Dashboard AI brief

Your Dashboard is not replaced by this package. Its existing AI brief can remain unchanged for now. The AI Companion is age-aware immediately. If you later want the Dashboard's mini AI brief to use age too, add the same `getCurrentUserAgeProfile()` call to its existing `/ai/chat` request; do not rewrite the Dashboard.
