import { supabase } from "../lib/supabase";

export function normalizeAge(value) {
  const age = Number(value);
  if (!Number.isInteger(age)) return null;
  if (age < 13 || age > 120) return null;
  return age;
}

export function isValidAge(value) {
  return normalizeAge(value) !== null;
}

export function getAgeGroup(age) {
  const normalizedAge = normalizeAge(age);
  if (normalizedAge === null) return "unknown";
  if (normalizedAge < 18) return "teen";
  if (normalizedAge < 26) return "young_adult";
  if (normalizedAge < 40) return "adult";
  if (normalizedAge < 60) return "midlife_adult";
  return "older_adult";
}

export function getAgeProfile(age) {
  const normalizedAge = normalizeAge(age);
  if (normalizedAge === null) return {};

  return {
    age: normalizedAge,
    age_group: getAgeGroup(normalizedAge),
  };
}

export async function getCurrentUserAgeProfile() {
  if (!supabase) return {};

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return {};

    return getAgeProfile(user.user_metadata?.age);
  } catch (error) {
    console.info(
      "Could not load WELLsync age profile:",
      error?.message || error
    );
    return {};
  }
}
