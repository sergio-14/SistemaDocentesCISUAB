// Fechas "de calendario" del sistema: se toman en la hora de Bolivia, sin depender
// de la zona horaria del navegador. No usar new Date().toISOString() para esto:
// da la fecha UTC, que desde las 20:00 de Bolivia ya es el día siguiente.
export const ZONA_HORARIA_BOLIVIA = 'America/La_Paz';

const formatoIsoBolivia = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA_BOLIVIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Fecha de hoy en Bolivia como 'YYYY-MM-DD'.
export const hoyBolivia = () => formatoIsoBolivia.format(new Date());

// 'YYYY-MM-DD' -> Date local (sin hora ni zona horaria), o null si no es una fecha real.
export const fechaIsoADate = (iso) => {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [anio, mes, dia] = match.slice(1).map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null;
  return fecha;
};

// True solo si las dos fechas ('YYYY-MM-DD') están llenas y la de fin es anterior a la
// de inicio. Con cualquiera vacía no hay comparación (eso lo cubre el "obligatorio").
export const finAnteriorAInicio = (inicioIso, finIso) => {
  const inicio = fechaIsoADate(inicioIso);
  const fin = fechaIsoADate(finIso);
  return Boolean(inicio && fin && fin.getTime() < inicio.getTime());
};

// 'YYYY-MM-DD' -> 'DD/MM/AAAA' ('—' si no hay fecha).
export const fechaCorta = (iso) => {
  const [anio, mes, dia] = String(iso || '').slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '—';
};

// Fecha de Bolivia ('YYYY-MM-DD') de un momento con hora (p. ej. '2026-10-16T01:30:00Z').
export const fechaBoliviaDe = (momentoIso) => (momentoIso ? formatoIsoBolivia.format(new Date(momentoIso)) : '');

// Días desde hoy (Bolivia) hasta la fecha 'YYYY-MM-DD': negativo si ya pasó, null si no hay fecha.
export const diasDesdeHoy = (iso) => {
  const fecha = fechaIsoADate(iso);
  const hoy = fechaIsoADate(hoyBolivia());
  return fecha && hoy ? Math.round((fecha - hoy) / (24 * 60 * 60 * 1000)) : null;
};
