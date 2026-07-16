"use client";

import { useEffect, useState } from "react";

type Scheme = "dark" | "light";

export function ThemeToggle() {
  const [scheme, setScheme] = useState<Scheme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("mme-docs-scheme");
    const initial = stored === "dark" || stored === "light" ? stored : "light";
    applyScheme(initial);
    setScheme(initial);
  }, []);

  function toggleScheme() {
    const next = scheme === "light" ? "dark" : "light";
    applyScheme(next);
    window.localStorage.setItem("mme-docs-scheme", next);
    setScheme(next);
  }

  return (
    <button
      aria-label={`Switch to ${scheme === "light" ? "dark" : "light"} theme`}
      className="docs-theme-toggle"
      data-testid="theme-toggle"
      type="button"
      onClick={toggleScheme}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        {scheme === "light" ? (
          <path d="M21 14.5A7.5 7.5 0 0 1 9.5 3a9 9 0 1 0 11.5 11.5Z" />
        ) : (
          <path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.35 6.35 7.9 7.9M16.1 16.1l1.55 1.55M17.65 6.35 16.1 7.9M7.9 16.1l-1.55 1.55M15.4 12a3.4 3.4 0 1 1-6.8 0 3.4 3.4 0 0 1 6.8 0Z" />
        )}
      </svg>
    </button>
  );
}

function applyScheme(scheme: Scheme): void {
  document.documentElement.dataset.mmeScheme = scheme;
}
