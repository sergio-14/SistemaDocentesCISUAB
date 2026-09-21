import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Componente que muestra un modal persistente cuando el usuario no tiene docente vinculado
 */
function ErrorVinculoDocente({ onLogout }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Mostrar toast de error inmediatamente
    const timer = setTimeout(() => {
      alert('⚠️ ERROR DE CONFIGURACIÓN:\n\nTu usuario no tiene un registro de docente asociado.\n\nPor favor, contacta al administrador del sistema para que vincule tu cuenta con un docente.');
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    onLogout?.();
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-fade-in border-2 border-amber-500">
        {/* Header de advertencia */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold text-white">
              ⚠️ Error de Configuración
            </h2>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
            <p className="text-amber-800 dark:text-amber-200 font-semibold text-center">
              Tu usuario no tiene un registro de docente asociado
            </p>
          </div>

          <div className="space-y-3 text-slate-700 dark:text-slate-300">
            <p className="text-sm">
              Esto puede deberse a:
            </p>
            <ul className="text-sm space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <span>El administrador eliminó tu registro de docente</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <span>Hubo un error al crear tu cuenta de usuario</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <span>La relación entre tu usuario y docente se perdió</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
              📋 Solución:
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Contacta al <strong className="text-blue-600 dark:text-blue-400">administrador del sistema</strong> para que:
            </p>
            <ol className="text-sm text-slate-600 dark:text-slate-400 ml-4 mt-2 space-y-1 list-decimal">
              <li>Verifique tu cuenta de usuario</li>
              <li>Vincule tu usuario con un registro de docente</li>
              <li>Restaure tu acceso al sistema</li>
            </ol>
          </div>
        </div>

        {/* Footer con botón de cerrar sesión */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700 border-t border-slate-200 dark:border-slate-600">
          <button
            onClick={handleLogout}
            className="w-full px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl"
          >
            Cerrar Sesión
          </button>
          <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-3">
            No podrás acceder al sistema hasta que se resuelva este problema
          </p>
        </div>
      </div>
    </div>
  );
}

export default ErrorVinculoDocente;
