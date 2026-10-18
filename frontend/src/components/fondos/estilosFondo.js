// Estilos y datos comunes del módulo de Fondo de Tiempo (dashboard y detalle del fondo).

// Cada sección es un bloque blanco azulado sobre el fondo azulado del panel.
export const BLOQUE = 'bg-azulado-50 rounded-3xl ring-1 ring-azulado-300 shadow-[0_2px_6px_rgba(30,58,138,0.08)]';
export const BOTON = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-colors';
// Ver o descargar el PDF/Word: sólido con el color secundario del Dashboard (sky-600, el de
// "Generar Fondos Masivamente"), con buen contraste en modo claro y oscuro.
export const BOTON_DOCUMENTO = 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950';
// Versión compacta para las acciones de cada tarjeta o fila de un listado.
export const BOTON_CHICO = 'inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors';

// Etiqueta, color de la píldora y del punto de cada estado del fondo.
export const ESTADOS_FONDO = {
  borrador: { label: 'Borrador', pill: 'bg-slate-100 text-slate-700 ring-slate-300', dot: 'bg-slate-400' },
  observado: { label: 'Con observaciones', pill: 'bg-orange-50 text-orange-800 ring-orange-200', dot: 'bg-orange-500' },
  presentado_director: { label: 'Presentado a Director', pill: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  aprobado_director: { label: 'Aprobado por Director', pill: 'bg-blue-50 text-blue-900 ring-blue-200', dot: 'bg-blue-700' },
  en_ejecucion: { label: 'En ejecución', pill: 'bg-cyan-50 text-cyan-800 ring-cyan-200', dot: 'bg-cyan-600' },
  informe_presentado: { label: 'Informe presentado', pill: 'bg-indigo-50 text-indigo-800 ring-indigo-200', dot: 'bg-indigo-500' },
  informe_evaluado: { label: 'Informe evaluado', pill: 'bg-sky-50 text-sky-800 ring-sky-200', dot: 'bg-sky-600' },
  // No es un estado del fondo: en ejecución con el informe observado (ver estadoVisibleFondo).
  informe_observado: { label: 'Informe observado', pill: 'bg-orange-50 text-orange-800 ring-orange-200', dot: 'bg-orange-500' },
  finalizado: { label: 'Finalizado', pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-600' },
  rechazado: { label: 'Rechazado', pill: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-600' },
  archivado: { label: 'Archivado', pill: 'bg-slate-100 text-slate-500 ring-slate-300', dot: 'bg-slate-300' },
};

// Estado que se muestra del fondo: en ejecución, el del informe si el Director lo
// observó. La lista trae `estado_informe`; el detalle, `informe_actual`.
export const estadoVisibleFondo = (fondo) => {
  const estadoInforme = fondo?.estado_informe ?? fondo?.informe_actual?.estado;
  if (fondo?.estado === 'en_ejecucion' && estadoInforme === 'observado') return 'informe_observado';
  return fondo?.estado;
};

// Las siete unidades del Art. 12 en su orden, cada una siempre con el mismo color
// (gráficos y listas del detalle del fondo y del comparador).
export const ORDEN_UNIDADES = ['academica', 'investigacion', 'extension_universitaria', 'interaccion_social', 'gestion', 'academica_administrativa', 'social_cultural_deportiva'];
const COLOR_UNIDAD = {
  academica: '#1E3A8A',
  investigacion: '#0284C7',
  extension_universitaria: '#059669',
  interaccion_social: '#F59E0B',
  gestion: '#6366F1',
  academica_administrativa: '#14B8A6',
  social_cultural_deportiva: '#FB7185',
};
export const colorUnidad = (tipo) => COLOR_UNIDAD[tipo] || '#64748B';

export const iniciales =(nombre) => (nombre || 'NN').split(' ').filter(Boolean).map((n) => n[0]).join('').substring(0, 2).toUpperCase();
