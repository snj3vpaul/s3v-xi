"use client";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const stored = document.documentElement.dataset.leagueTheme as Theme | undefined;
    setTheme(stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);
  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.leagueTheme = next;
    try { localStorage.setItem("league-theme", next); } catch { /* ignore */ }
    setTheme(next);
  }
  return (
    <button type="button" className="lg-iconbtn" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title="Toggle dark mode">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

/** Inline, render-blocking script so the saved theme applies before first paint. */
export const themeScript = `try{var t=localStorage.getItem('league-theme');if(t==='dark'||t==='light')document.documentElement.dataset.leagueTheme=t}catch(e){}`;
