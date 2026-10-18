// Etapas del flujo del fondo, en orden. "Con observaciones", "Informe observado" y
// "Rechazado" no son etapas propias: el fondo (o su informe) vuelve a corregirse antes
// de presentarse otra vez al Director.
const ETAPAS = [
  { key: 'borrador', label: 'Borrador' },
  { key: 'presentado_director', label: 'Presentado a Director' },
  { key: 'aprobado_director', label: 'Aprobado por Director' },
  { key: 'en_ejecucion', label: 'En ejecución' },
  { key: 'informe_presentado', label: 'Informe presentado' },
  { key: 'informe_evaluado', label: 'Informe evaluado' },
  { key: 'finalizado', label: 'Finalizado' },
];

const INDICE_POR_ESTADO = {
  borrador: 0,
  observado: 1,
  rechazado: 1,
  presentado_director: 1,
  aprobado_director: 2,
  en_ejecucion: 3,
  informe_presentado: 4,
  // En ejecución con el informe observado (estadoVisibleFondo).
  informe_observado: 4,
  informe_evaluado: 5,
  finalizado: 6,
};

// Observaciones: ya se presentó (el fondo o el informe) y el Director pidió
// correcciones. Se marca en una rama, con el color de observación, a la derecha de la
// etapa presentada, fuera de la línea del flujo.
const RAMAS = {
  observado: { indice: 1, label: 'Con observaciones' },
  informe_observado: { indice: 4, label: 'Informe observado' },
};

// `estado`: el visible del fondo (estadoVisibleFondo), para mostrar también el informe
// observado. Con className="flex-1" las etapas se reparten el alto disponible (hasta un
// tope por etapa, para que no queden demasiado separadas).
const EstadoTimeline = ({ estado, className = '' }) => {
  const indiceActual = INDICE_POR_ESTADO[estado] ?? 0;
  const rama = RAMAS[estado] || null;
  const conProblema = estado === 'rechazado';

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Etapas */}
      <ol className="flex-1 flex flex-col">
        {ETAPAS.map((etapa, idx) => {
          const conRama = Boolean(rama) && idx === rama.indice;
          const completa = idx < indiceActual || estado === 'finalizado' || conRama;
          const actual = idx === indiceActual && estado !== 'finalizado' && !rama;
          const ultima = idx === ETAPAS.length - 1;
          // Con observaciones el flujo no avanza: la línea hacia la etapa siguiente sigue pendiente.
          const lineaActiva = completa && !conRama;
          return (
            <li
              key={etapa.key}
              className={`relative flex items-start gap-3 ${
                ultima ? '' : `flex-1 pb-3 ${conRama ? 'min-h-[4.5rem]' : 'min-h-[2.25rem] max-h-[4.5rem]'}`
              }`}
            >
              {!ultima && (
                <span className={`absolute left-[9px] top-5 bottom-0 w-0.5 rounded-full ${lineaActiva ? 'bg-sky-500' : 'bg-azulado-300'}`} />
              )}
              <span className={`relative z-10 mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                completa
                  ? 'bg-sky-600 text-white'
                  : actual
                    ? `${conProblema ? 'bg-orange-500' : 'bg-blue-900'} ring-4 ${conProblema ? 'ring-orange-100' : 'ring-azulado-200'}`
                    : 'bg-azulado-200'
              }`}>
                {completa && (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {actual && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <div className="min-w-0">
                <span className={`block text-sm leading-6 ${
                  actual ? 'font-bold text-blue-900' : completa ? 'font-medium text-slate-800' : 'text-slate-500'
                }`}>
                  {etapa.label}
                </span>

                {conRama && (
                  <div className="relative mt-2 flex items-center gap-2 pl-3">
                    {/* Codo que sale de la línea del flujo hacia la rama */}
                    <span className="absolute -left-[23px] -top-2 h-[calc(50%+0.5rem)] w-[33px] rounded-bl-lg border-b-2 border-l-2 border-orange-300" />
                    <span className="relative z-10 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 ring-4 ring-orange-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    <span className="text-sm font-bold leading-6 text-orange-700">{rama.label}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default EstadoTimeline;
