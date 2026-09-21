function ThemeToggle({ theme, setTheme }) {
  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    const nextTheme = isDark ? 'light' : 'dark';
    
    // Aplicar inmediatamente al DOM
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', nextTheme);
    
    // Notificar al padre
    if (setTheme) setTheme(nextTheme);
    
    // Forzar re-render de toda la página
    window.dispatchEvent(new Event('storage'));
  };

  // Leer estado actual del DOM
  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle-floating fixed bottom-[5.5rem] right-16 w-14 h-14 rounded-full shadow-2xl transition-all duration-500 ease-out hover:scale-110 flex items-center justify-center text-white z-[120] group overflow-hidden border-2
        ${isDarkMode
          ? 'bg-gradient-to-br from-slate-700 via-blue-800 to-indigo-900 border-blue-500/30 hover:shadow-indigo-500/40'
          : 'bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-500 border-white/30 hover:shadow-blue-500/40'
        }
      `}
      title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Sun Icon */}
        <svg
          className={`w-8 h-8 absolute transition-all duration-700 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] ${isDarkMode ? 'opacity-0 rotate-[180deg] scale-0' : 'opacity-100 rotate-0 scale-100'
            }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>

        {/* Moon Icon */}
        <svg
          className={`w-7 h-7 absolute transition-all duration-700 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] ${isDarkMode ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-[180deg] scale-0'
            }`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
        </svg>

        {/* Glow effect */}
        <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-300 ${isDarkMode ? 'bg-blue-400 blur-md' : 'bg-blue-300 blur-md'}`}></div>
      </div>
    </button>
  );
}

export default ThemeToggle;
