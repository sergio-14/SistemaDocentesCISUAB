import { useState, useEffect } from 'react';

export function useTheme() {
  // Obtener tema guardado o usar 'system' por defecto
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'system';
  });

  // Estado calculado del tema real (light o dark)
  const [effectiveTheme, setEffectiveTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (!saved || saved === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return saved;
  });

  const applyToDOM = (effective) => {
    if (effective === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Sincronizar data-theme para que el CSS del módulo POA también responda
    document.documentElement.setAttribute('data-theme', effective);
  };

  useEffect(() => {
    const getSystemTheme = () =>
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    const calculateEffectiveTheme = () =>
      theme === 'system' ? getSystemTheme() : theme;

    const applyTheme = () => {
      const effective = calculateEffectiveTheme();
      setEffectiveTheme(effective);
      applyToDOM(effective);
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => { if (theme === 'system') applyTheme(); };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    // Aplicar inmediatamente al DOM sin esperar el efecto (evita parpadeo en Chrome)
    const effective = newTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : newTheme;
    applyToDOM(effective);
    setEffectiveTheme(effective);
  };

  return {
    theme,
    effectiveTheme,
    setTheme: changeTheme,
    isLight: effectiveTheme === 'light',
    isDark: effectiveTheme === 'dark',
  };
}