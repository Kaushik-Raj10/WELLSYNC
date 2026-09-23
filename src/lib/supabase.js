import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL;

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigReady =
  Boolean(
    supabaseUrl &&
    supabasePublishableKey
  );

export const supabase =
  supabaseConfigReady
    ? createClient(
        supabaseUrl,
        supabasePublishableKey
      )
    : null;