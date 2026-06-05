import { useEffect, useState } from "react";

const STORAGE_KEY = "nutree.theme";

function getInitialDark(): boolean {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "dark";
}

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "dark";
  });

  useEffect(() => {
    applyTheme(dark);
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }, [dark]);

  // Apply on mount before first render to avoid flash
  useEffect(() => {
    applyTheme(getInitialDark());
  }, []);

  function toggle() {
    setDark((d) => !d);
  }

  return { dark, toggle };
}
