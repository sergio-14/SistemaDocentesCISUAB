import React from 'react';

const Proximamente = ({ isDark }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 p-10 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 dark:from-blue-900/50 dark:to-indigo-900/50 flex items-center justify-center">
          <span className="text-5xl">🛠️</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
          Módulo en Desarrollo
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Esta sección estará disponible próximamente. Estamos trabajando para traerte nuevas funcionalidades. ¡Gracias por tu paciencia!
        </p>
      </div>
    </div>
  );
};

export default Proximamente;