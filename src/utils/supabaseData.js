import { supabase } from "../lib/supabase";

function mapCheckin(row) {
  return {
    date: row.date,
    sleep: Number(row.sleep),
    water: Number(row.water),
    steps: Number(row.steps),
    screenTime: Number(row.screen_time),
    mood: row.mood,
    energy: Number(row.energy),
    stress: Number(row.stress),
  };
}

export async function getCloudCheckins() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData?.user) {
    throw new Error("No authenticated user found.");
  }

  const {
    data,
    error,
  } = await supabase
    .from("checkins")
    .select(
      `
        id,
        user_id,
        date,
        sleep,
        water,
        steps,
        screen_time,
        mood,
        energy,
        stress,
        created_at
      `
    )
    .eq("user_id", userData.user.id)
    .order("date", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data || []).map(mapCheckin);
}

export async function getLatestCloudCheckin() {
  const checkins = await getCloudCheckins();

  if (checkins.length === 0) {
    return null;
  }

  return checkins[checkins.length - 1];
}

export async function getCloudGoals() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data,
    error,
  } = await supabase
    .from("goals")
    .select(
      "id, user_id, sleep, water, steps, screen_time, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    sleep: Number(data.sleep),
    water: Number(data.water),
    steps: Number(data.steps),
    screenTime: Number(data.screen_time),
  };
}

export async function saveCloudGoals(goals) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData?.user) {
    throw new Error("No authenticated user found.");
  }

  const {
    error,
  } = await supabase
    .from("goals")
    .upsert(
      {
        user_id: userData.user.id,
        sleep: Number(goals.sleep),
        water: Number(goals.water),
        steps: Number(goals.steps),
        screen_time: Number(goals.screenTime),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) {
    throw error;
  }
}