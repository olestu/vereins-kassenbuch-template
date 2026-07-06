"use client";

import { createContext, useContext } from "react";
import { getTerms, type Terms } from "@/lib/profile";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";

interface SettingsContextValue {
  settings: AppSettings;
  terms: Terms;
  isBusiness: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  terms: getTerms(DEFAULT_SETTINGS.profile),
  isBusiness: DEFAULT_SETTINGS.profile === "business",
});

export function SettingsProvider({
  settings,
  children,
}: {
  settings: AppSettings;
  children: React.ReactNode;
}) {
  return (
    <SettingsContext.Provider
      value={{
        settings,
        terms: getTerms(settings.profile),
        isBusiness: settings.profile === "business",
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

/** Laufzeit-Einstellungen in Client-Komponenten (innerhalb des App-Layouts). */
export function useSettings() {
  return useContext(SettingsContext);
}
