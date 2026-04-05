import { describe, expect, it } from "vitest";
import { getSupabaseConfig } from "@/integrations/supabase/client";

describe("getSupabaseConfig", () => {
  it("returns a clear error when required env vars are missing", () => {
    const config = getSupabaseConfig({});

    expect(config.error).toContain("VITE_SUPABASE_URL");
    expect(config.error).toContain("VITE_SUPABASE_ANON_KEY");
    expect(config.url).toBeNull();
    expect(config.anonKey).toBeNull();
  });

  it("returns url and anon key when both env vars are provided", () => {
    const config = getSupabaseConfig({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(config.error).toBeNull();
    expect(config.url).toBe("https://example.supabase.co");
    expect(config.anonKey).toBe("anon-key");
  });
});
