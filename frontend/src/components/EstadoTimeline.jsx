import React from 'react';

const EstadoTimeline = ({ estado, tieneObservaciones = false }) => {
  // Mapeo de estados a etapas del proceso
  const ETAPAS = [
    { key: 'borrador', label: 'Borrador', colorActivo: 'bg-slate-500', colorCompleto: 'bg-slate-400' },
    { key: 'presentado_jefe', label: 'En Revisión', colorActivo: 'bg-blue-500', colorCompleto: 'bg-blue-400' },
    { key: 'observado', label: 'Con Obs.', colorActivo: 'bg-orange-500', colorCompleto: 'bg-orange-400' },
    { key: 'presentado_director', label: 'A Director', colorActivo: 'bg-indigo-500', colorCompleto: 'bg-indigo-400' },
    { key: 'aprobado_director', label: 'Aprobado', colorActivo: 'bg-green-500', colorCompleto: 'bg-green-400' },
    { key: 'en_ejecucion', label: 'En Ejecución', colorActivo: 'bg-purple-500', colorCompleto: 'bg-purple-400' },
    { key: 'finalizado', label: 'Finalizado', colorActivo: 'bg-teal-500', colorCompleto: 'bg-teal-400' },
  ];

  // Encontrar índice del estado actual
  const indiceActual = ETAPAS.findIndex(e => e.key === estado);

  const getEstadoBadgeColor = (estado) => {
    const colores = {
      'borrador': 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600',
      'presentado_jefe': 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
      'observado': 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700',
      'presentado_director': 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700',
      'aprobado_director': 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
      'en_ejecucion': 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
      'informe_presentado': 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700',
      'finalizado': 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700',
      'rechazado': 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
    };
    return colores[estado] || colores['borrador'];
  };

  const getEstadoLabel = (estado) => {
    const labels = {
      'borrador': 'Borrador',
      'presentado_jefe': 'Presentado a Jefe',
      'observado': 'Con Observaciones',
      'presentado_director': 'Presentado a Director',
      'aprobado_director': 'Aprobado por Director',
      'en_ejecucion': 'En Ejecución',
      'informe_presentado': 'Informe Presentado',
      'finalizado': 'Finalizado',
      'rechazado': 'Rechazado',
    };
    return labels[estado] || estado;
  };

  return (
    <div className="h-full flex flex-col pb-2 justify-between">
      {/* Título */}
      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
        🎯 Estado del Proceso
      </h3>

      {/* Badge de estado actual - GRANDE Y PROMINENTE */}
      <div className={`flex-1 flex flex-col items-center justify-center gap-4 px-4 py-6 rounded-2xl border-2 ${getEstadoBadgeColor(estado)} mb-4`}>
        {/* Icono según estado */}
        <div className="text-4xl">
          {estado === 'borrador' && '📝'}
          {estado === 'presentado_jefe' && '👀'}
          {estado === 'observado' && '⚠️'}
          {estado === 'presentado_director' && '📬'}
          {estado === 'aprobado_director' && '✅'}
          {estado === 'en_ejecucion' && '⚡'}
          {estado === 'informe_presentado' && '📊'}
          {estado === 'finalizado' && '🏁'}
          {estado === 'rechazado' && '❌'}
        </div>

        {/* Etiqueta de estado */}
        <div className="text-center">
          <p className="text-sm font-black mb-1">{getEstadoLabel(estado)}</p>
          {estado === 'observado' && tieneObservaciones && (
            <p className="text-xs opacity-75 mt-2">
              💬 Hay observaciones pendientes
            </p>
          )}
        </div>
      </div>

      {/* Mini-Timeline compacto */}
      <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Progreso
        </p>

        {/* Línea de progreso visual */}
        <div className="space-y-2">
          {ETAPAS.slice(0, 5).map((etapa, idx) => {
            const isCompleta = idx < indiceActual;
            const isActual = idx === indiceActual;

            return (
              <div key={etapa.key} className="flex items-center gap-2 text-[10px]">
                {/* Indicador */}
                <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-slate-600 ${
                  isCompleta || isActual
                    ? `${etapa.colorActivo}`
                    : 'bg-slate-200 dark:bg-slate-700'
                }`} />

                {/* Etiqueta */}
                <span className={`flex-1 truncate ${
                  isActual
                    ? 'font-bold text-slate-700 dark:text-slate-200'
                    : isCompleta
                    ? 'text-slate-600 dark:text-slate-400'
                    : 'text-slate-500 dark:text-slate-500'
                }`}>
                  {etapa.label}
                </span>

                {/* Checkmark para completadas */}
                {isCompleta && (
                  <span className="flex-shrink-0 text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mensaje motivacional */}
      {estado === 'finalizado' && (
        <div className="mt-3 p-2.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2 shadow-sm">
          <span className="text-lg flex-shrink-0">🎉</span>
          <p className="text-[11px] text-green-700 dark:text-green-400 font-semibold">¡Fondo completado exitosamente!</p>
        </div>
      )}

      {false && estado === 'observado' && tieneObservaciones && (
        <div className="mt-3 p-2.5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-2 shadow-sm">
          <span className="text-lg flex-shrink-0">📌</span>
          <p className="text-[11px] text-orange-700 dark:text-orange-400 font-semibold">Revisa las observaciones abajo y reenvía con los cambios.</p>
        </div>
      )}

      {estado === 'en_ejecucion' && (
        <div className="mt-3 p-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-lg flex items-start gap-2 shadow-sm">
          <span className="text-lg flex-shrink-0">⚡</span>
          <p className="text-[11px] text-purple-700 dark:text-purple-400 font-semibold">Tu fondo está siendo ejecutado. Documentarás mediante informes.</p>
        </div>
      )}
    </div>
  );
};

export default EstadoTimeline;
