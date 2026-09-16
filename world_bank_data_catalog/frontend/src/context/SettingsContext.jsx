import { createContext, useContext, useState } from "react";

const SettingsContext = createContext(null);

const DEFAULTS = {
  defaultRegion: "",       // region_code, e.g. "ECA", or "" for all regions
  defaultCountry: "UKR",   // used to prefill Compare's "Country A"
};

function load() {
  try {
    const raw = localStorage.getItem("gda:settings");
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettingsState] = useState(load);

  function setSettings(patch) {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("gda:settings", JSON.stringify(next));
      return next;
    });
  }

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
