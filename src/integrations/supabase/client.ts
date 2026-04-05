import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

type SupabaseConfig = {
  url: string | null;
  anonKey: string | null;
  error: string | null;
};

export function getSupabaseConfig(env: SupabaseEnv): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim() ?? "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
  const missingVars: string[] = [];

  if (!url) {
    missingVars.push("VITE_SUPABASE_URL");
  }

  if (!anonKey) {
    missingVars.push("VITE_SUPABASE_ANON_KEY");
  }

  if (missingVars.length > 0) {
    return {
      url: null,
      anonKey: null,
      error: `Missing required env var${missingVars.length > 1 ? "s" : ""}: ${missingVars.join(", ")}`,
    };
  }

  return {
    url,
    anonKey,
    error: null,
  };
}

const supabaseConfig = getSupabaseConfig(import.meta.env);

export const supabaseConfigError = supabaseConfig.error;

const createMissingConfigClient = (message: string) =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(
          `${message}. Create a local .env file and define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`
        );
      },
    }
  ) as SupabaseClient;

export const supabase: SupabaseClient = supabaseConfigError
  ? createMissingConfigClient(supabaseConfigError)
  : createClient(supabaseConfig.url!, supabaseConfig.anonKey!, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
