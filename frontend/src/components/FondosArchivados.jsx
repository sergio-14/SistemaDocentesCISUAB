import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFondosArchivados, restaurarFondo as restaurarFondoAPI } from '../apis/api';

function FondosArchivados({ isDark }) {
  const [archivados, setArchivados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    cargarArchivados();
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(userData);
  }, []);

  const cargarArchivados = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getFondosArchivados();
      setArchivados(response.data);
    } catch (error) {
      console.error('Error al cargar archivados:', error);
      setError('Error al cargar fondos archivados. Verifica tus permisos de administrador.');
    } finally {
      setLoading(false);
    }
  };

  const restaurarFondo = async (id, nombreDocente) => {
    if (!confirm(`¿Desea restaurar el fondo de ${nombreDocente}?`)) return;
    
    try {
      await restaurarFondoAPI(id);
      alert('✅ Fondo restaurado exitosamente');
      cargarArchivados();
    } catch (error) {
      console.error('Error al restaurar:', error);
      alert('❌ Error al restaurar el fondo');
    }
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'borrador': {
        bg: 'bg-slate-100 dark:bg-slate-700',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-300 dark:border-slate-600'
      },
      'revision': {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-300',
        border: 'border-yellow-300 dark:border-yellow-700'
      },
      'aprobado': {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        border: 'border-blue-300 dark:border-blue-700'
      },
      'validado': {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-300 dark:border-green-700'
      }
    };
    
    const labels = {
      'borrador': 'Borrador',
      'revision': 'En Revisión',
      'aprobado': 'Aprobado',
      'validado': 'Validado'
    };

    const badge = badges[estado] || badges.borrador;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border-2 shadow-sm ${badge.bg} ${badge.text} ${badge.border}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
        {labels[estado] || estado}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Cargando fondos archivados...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-red-700 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-md">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  🗄️ Fondos Archivados
                </h1>
                <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                  Fondos que han sido archivados. Puedes restaurarlos cuando lo necesites.
                </p>
              </div>
            </div>

            {/* Contador */}
            <div className="bg-slate-50 dark:bg-slate-700 px-6 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 shadow-md">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 text-center">
                {archivados.length}
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-400 font-medium">
                {archivados.length === 1 ? 'Archivado' : 'Archivados'}
              </div>
            </div>
          </div>
        </div>

        {/* Lista de archivados */}
        {archivados.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 p-12 text-center shadow-md">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              No hay fondos archivados
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Los fondos archivados aparecerán aquí
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {archivados.map((fondo) => (
              <div
                key={fondo.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-md hover:shadow-xl transition-all duration-200 hover:scale-[1.01]"
              >
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Info del fondo */}
                    <div className="flex-1 space-y-3">
                      {/* Header con nombre y gestión */}
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white font-bold shadow-md flex-shrink-0">
                          {fondo.docente_nombre.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-blue-600 dark:text-white">
                            {fondo.docente_nombre}
                          </h3>
                          <p className="text-sm text-slate-700 dark:text-slate-400 mt-0.5">
                            📅 Gestión {fondo.gestion}
                          </p>
                        </div>
                        {getEstadoBadge(fondo.estado)}
                      </div>

                      {/* Detalles */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 border border-slate-300 dark:border-slate-600">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{fondo.asignatura}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 border border-slate-300 dark:border-slate-600">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="text-slate-700 dark:text-slate-300">{fondo.carrera_nombre}</span>
                        </div>
                      </div>

                      {/* Progreso */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 dark:text-slate-400 font-medium">
                            Progreso
                          </span>
                          <span className="font-bold text-slate-800 dark:text-white">
                            {fondo.porcentaje_completado?.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                            style={{ width: `${Math.min(fondo.porcentaje_completado || 0, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex lg:flex-col gap-2">
                      {user?.is_staff && (
                        <button
                          onClick={() => restaurarFondo(fondo.id, fondo.docente_nombre)}
                          className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Restaurar</span>
                        </button>
                      )}
                      
                      <button
                        onClick={() => navigate(`/fondo-tiempo/fondo/${fondo.id}`)}
                        className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow-md hover:scale-105"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Ver</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info adicional */}
        {archivados.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-2xl p-6 shadow-md">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-bold mb-2">💡 Información sobre fondos archivados:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Los fondos archivados no se eliminan permanentemente</li>
                  <li>Puedes restaurarlos en cualquier momento</li>
                  <li>Al restaurar, vuelven al estado en que fueron archivados</li>
                  <li>Solo los administradores pueden archivar y restaurar fondos</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FondosArchivados;
