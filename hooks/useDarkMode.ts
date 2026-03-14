import { useState, useEffect } from 'react';

// Use a specific key to avoid conflicts with other scripts or browser extensions.
const THEME_KEY = 'orgchart-theme';

export const useDarkMode = (): [string, () => void] => {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
        const savedTheme = window.localStorage.getItem(THEME_KEY);
        // Only accept 'light' or 'dark' from storage to prevent invalid state.
        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme;
        }
        // If no valid theme is saved, default to system preference.
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    // Default for non-browser environments.
    return 'light';
  });

  const toggleTheme = () => {
    // Use a functional update to ensure we're toggling the latest state.
    setTheme(currentTheme => (currentTheme === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Clean up both classes before adding the new one for cleaner state transitions.
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    // Save the user's preference to localStorage.
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
        console.error("Could not save theme to localStorage:", error);
    }
  }, [theme]);

  return [theme, toggleTheme];
};
