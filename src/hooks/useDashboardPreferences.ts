import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { DEFAULT_CARD_IDS, DEFAULT_SECTION_IDS } from "@/constants/dashboardCards";

interface DashboardPrefs {
  cards?: string[];
  sections?: string[];
}

export function useDashboardPreferences() {
  const { user, profile, refreshProfile } = useAuth();
  const [cards, setCards] = useState<string[]>(DEFAULT_CARD_IDS);
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTION_IDS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const prefs = profile?.dashboard_preferences as DashboardPrefs | null | undefined;
    const savedCards = prefs?.cards;
    const savedSections = prefs?.sections;

    if (savedCards && Array.isArray(savedCards) && savedCards.length > 0) {
      setCards(savedCards);
    } else {
      setCards(DEFAULT_CARD_IDS);
    }

    if (savedSections && Array.isArray(savedSections)) {
      setSections(savedSections);
    } else {
      setSections(DEFAULT_SECTION_IDS);
    }
  }, [profile?.dashboard_preferences]);

  const save = useCallback(
    async (newCards: string[], newSections: string[]) => {
      if (!user) return false;
      setIsSaving(true);

      const { error } = await supabase
        .from("profiles")
        .update({ dashboard_preferences: { cards: newCards, sections: newSections } })
        .eq("user_id", user.id);

      setIsSaving(false);

      if (error) {
        console.error("Failed to save dashboard preferences", error);
        return false;
      }

      setCards(newCards);
      setSections(newSections);
      await refreshProfile();
      return true;
    },
    [user, refreshProfile]
  );

  const saveCards = useCallback(
    async (newCards: string[]) => save(newCards, sections),
    [save, sections]
  );

  const saveSections = useCallback(
    async (newSections: string[]) => save(cards, newSections),
    [save, cards]
  );

  return { cards, sections, saveCards, saveSections, save, isSaving };
}
