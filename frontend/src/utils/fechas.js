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
