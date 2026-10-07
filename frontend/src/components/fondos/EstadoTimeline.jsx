import { ESTADOS_FONDO } from './estilosFondo';

// Etapas del flujo del fondo, en orden. "Con observaciones" y "Rechazado" no son etapas
// propias: el fondo vuelve a corregirse antes de presentarse otra vez al Director.
const ETAPAS = [
  { key: 'borrador', label: 'Borrador' },
  { key: 'presentado_director', label: 'Presentado a Director' },
  { key: 'aprobado_director', label: 'Aprobado por Director' },
  { key: 'en_ejecucion', label: 'En ejecución' },
  { key: 'informe_presentado', label: 'Informe presentado' },
  { key: 'finalizado', label: 'Finalizado' },
];

const INDICE_POR_ESTADO = {
  borrador: 0,
  observado: 0,
  rechazado: 1,
  presentado_director: 1,
  aprobado_director: 2,
  en_ejecucion: 3,
  informe_presentado: 4,
  finalizado: 5,
};

const MENSAJES = {
  observado: 'El Director pidió correcciones antes de aprobarlo.',
  rechazado: 'El fondo fue rechazado: vuelve a borrador para corregirlo.',
  en_ejecucion: 'El fondo se está ejecutando; se documenta mediante el informe.',
  finalizado: 'Fondo completado.',
};

const EstadoTimeline = ({ estado, tieneObservaciones = false, observacionesPendientes = 0 }) => {
  const info = ESTADOS_FONDO[estado] || ESTADOS_FONDO.borrador;
  const indiceActual = INDICE_POR_ESTADO[estado] ?? 0;
  const conProblema = ['observado', 'rechazado'].includes(estado);

  return (
    <div className="space-y-4">
      {/* Estado actual */}
      <div className={`rounded-2xl px-4 py-3 ring-1 ring-inset ${info.pill}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Estado actual</p>
        <p className="mt-0.5 flex items-center gap-2 text-base font-bold">
          <span className={`h-2 w-2 rounded-full ${info.dot}`} />
          {info.label}
        </p>
        {estado === 'observado' && tieneObservaciones && (
          <p className="mt-1 text-xs font-medium">
            {observacionesPendientes} hilo{observacionesPendientes === 1 ? '' : 's'} pendiente{observacionesPendientes === 1 ? '' : 's'}
          </p>
        )}
        {MENSAJES[estado] && <p className="mt-1 text-xs opacity-80">{MENSAJES[estado]}</p>}
      </div>

      {/* Etapas */}
      <ol className="space-y-0">
        {ETAPAS.map((etapa, idx) => {
          const completa = idx < indiceActual || estado === 'finalizado';
          const actual = idx === indiceActual && estado !== 'finalizado';
          const ultima = idx === ETAPAS.length - 1;
          return (
            <li key={etapa.key} className="relative flex items-start gap-3 pb-3 last:pb-0">
              {!ultima && (
                <span className={`absolute left-[9px] top-5 bottom-0 w-0.5 rounded-full ${completa ? 'bg-sky-500' : 'bg-azulado-300'}`} />
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
              <span className={`text-sm leading-6 ${
                actual ? 'font-bold text-blue-900' : completa ? 'font-medium text-slate-700' : 'text-slate-400'
              }`}>
                {etapa.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default EstadoTimeline;
