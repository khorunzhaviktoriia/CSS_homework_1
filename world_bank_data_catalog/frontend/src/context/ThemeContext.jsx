import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

function getInitialDark() {
  const saved = localStorage.getItem("gda:appearance");
  if (saved === "dark") return true;
  if (saved === "light") return false;
  // "system" or unset: follow the OS preference
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function setAppearance(mode) {
    // mode: "light" | "dark" | "system"
    localStorage.setItem("gda:appearance", mode);
    if (mode === "system") {
      setDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
    } else {
      setDark(mode === "dark");
    }
  }

  function toggleDark() {
    setAppearance(dark ? "light" : "dark");
  }

  // Chart color tokens shared across all recharts usages so pages don't
  // each hardcode their own light-only hex values.
  const chart = dark
    ? { grid: "#27324A", axis: "#8593AD", tooltipBg: "#131C31", tooltipBorder: "#2B3854", text: "#E2E8F0" }
    : { grid: "#EEF2F7", axis: "#94A3B8", tooltipBg: "#FFFFFF", tooltipBorder: "#EEF2F7", text: "#0F172A" };

  return (
    <ThemeContext.Provider value={{ dark, toggleDark, setAppearance, chart }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
