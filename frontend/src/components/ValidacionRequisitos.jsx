import React from 'react';

const CheckCircleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-500" {...props}>
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
  </svg>
);

const XCircleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-500" {...props}>
    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
  </svg>
);

/**
 * ValidacionRequisitos
 * 
 * Componente inteligente que muestra:
 * - Para DOCENTE en estado 'borrador'/'observado': Lista de checks con requisitos
 * - Para JEFATURA en estado 'presentado_director' o superior: Check visual "Validado"
 * - Para cualquier estado avanzado: Desaparece
 */
function ValidacionRequisitos({ requisitos, fondo, esJefatura = false }) {
  if (!fondo) return null;

  // Estados avanzados donde los requisitos ya fueron validados
  const ESTADOS_BLOQUEADOS = ['en_ejecucion', 'finalizado', 'informe_presentado', 'archivado'];
  
  // Si estÃ¡ en estado bloqueado, no mostrar requisitos (ya validados)
  if (ESTADOS_BLOQUEADOS.includes(fondo.estado)) {
    return null;
  }

  // JEFATURA: En estados presentados/aprobados, mostrar indicador "validado"
  if (esJefatura && ['presentado_director', 'aprobado_director'].includes(fondo.estado)) {
    return (
      <div className="h-full flex flex-col pb-2 justify-end">
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-green-800 dark:text-green-300">Requisitos Completados</p>
            <p className="text-[10px] text-green-700 dark:text-green-400 mt-1">Este fondo cumple todos los requisitos regulatorios.</p>
          </div>
        </div>
      </div>
    );
  }

  // DOCENTE o JEFATURA en estado 'borrador'/'observado': mostrar lista completa de checks
  if (['borrador', 'observado'].includes(fondo.estado)) {
    return (
      <div className="h-full flex flex-col pb-2">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Requisitos para Presentar
        </h3>

        <div className="flex-1 flex flex-col justify-around">
          {/* Horas Completas */}
          <div className="flex items-center justify-between gap-4 py-1 border-b border-slate-100 dark:border-slate-700/60">
            <span className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
              DistribuciÃ³n de horas completa
            </span>
            <span className="flex-shrink-0">{requisitos.horas ? <CheckCircleIcon /> : <XCircleIcon />}</span>
          </div>

          {/* Función Académica */}
          <div className="flex items-center justify-between gap-4 py-1 border-b border-slate-100 dark:border-slate-700/60">
            <span className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
              Carga en Función Académica
            </span>
            <span className="flex-shrink-0">{requisitos.docencia ? <CheckCircleIcon /> : <XCircleIcon />}</span>
          </div>

          {/* Programa AnalÃ­tico */}
          <div className="flex items-center justify-between gap-4 py-1 border-b border-slate-100 dark:border-slate-700/60">
            <span className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
              Programa AnalÃ­tico adjunto
            </span>
            <span className="flex-shrink-0">{requisitos.docs ? <CheckCircleIcon /> : <XCircleIcon />}</span>
          </div>
        </div>

        {!requisitos.total && (
          <div className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg border border-red-100 dark:border-red-800 flex items-center justify-center gap-2 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            <span className="text-center">Debes cumplir todos los requisitos para poder presentar el fondo al Director.</span>
          </div>
        )}
      </div>
    );
  }

  // Para otros estados: no mostrar
  return null;
}

export default ValidacionRequisitos;
