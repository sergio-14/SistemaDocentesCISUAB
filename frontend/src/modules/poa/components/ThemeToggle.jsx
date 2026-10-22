function ThemeToggle({ theme, setTheme, className = '' }) {
  const toggleTheme = () => {
    const isDark = theme ? theme === 'dark' : document.documentElement.classList.contains('dark');
    const nextTheme = isDark ? 'light' : 'dark';

    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    localStorage.setItem('theme', nextTheme);
    if (setTheme) setTheme(nextTheme);
    window.dispatchEvent(new Event('storage'));
  };

  const isDarkMode = theme ? theme === 'dark' : document.documentElement.classList.contains('dark');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`poa-header-theme-toggle relative h-11 w-11 md:h-12 md:w-12 rounded-xl md:rounded-2xl transition-all duration-500 ease-out hover:scale-105 flex flex-shrink-0 items-center justify-center overflow-hidden border-0 bg-transparent text-white shadow-none hover:bg-transparent hover:shadow-none ${className}`}
      title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      <div className="relative flex h-full w-full items-center justify-center">
        <svg
          className={`absolute h-5 w-5 transition-all duration-700 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] md:h-6 md:w-6 ${isDarkMode ? 'scale-0 rotate-[180deg] opacity-0' : 'scale-100 rotate-0 opacity-100'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>

        <svg
          className={`absolute h-5 w-5 transition-all duration-700 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] md:h-6 md:w-6 ${isDarkMode ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-[180deg] opacity-0'}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
        </svg>
      </div>
    </button>
  );
}

export default ThemeToggle;
