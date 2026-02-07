import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { DEFAULT_CARD_IDS } from "@/constants/dashboardCards";

export function useDashboardPreferences() {
  const { user, profile, refreshProfile } = useAuth();
  const [cards, setCards] = useState<string[]>(DEFAULT_CARD_IDS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const saved = profile?.dashboard_preferences?.cards;
    if (saved && Array.isArray(saved) && saved.length > 0) {
      setCards(saved);
    } else {
      setCards(DEFAULT_CARD_IDS);
    }
  }, [profile?.dashboard_preferences]);

  const saveCards = useCallback(
    async (newCards: string[]) => {
      if (!user) return false;
      setIsSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({ dashboard_preferences: { cards: newCards } })
        .eq("user_id", user.id);

      setIsSaving(false);

      if (error) {
        console.error("Failed to save dashboard preferences", error);
        return false;
      }

      setCards(newCards);
      await refreshProfile();
      return true;
    },
    [user, refreshProfile]
  );

  return { cards, saveCards, isSaving };
}
