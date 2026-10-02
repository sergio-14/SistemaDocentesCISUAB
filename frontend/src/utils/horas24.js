/**
 * Horas en formato 24 h (HH:MM), sin a. m./p. m. ni depender del idioma del
 * navegador (el <input type="time"> nativo las muestra según la configuración
 * regional del sistema).
 */

const HORA_24 = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Texto escrito -> "HH" o "HH:MM": solo dígitos y los dos puntos se ponen solos. */
export const formatearHora24 = (texto) => {
  const digitos = String(texto || '').replace(/\D/g, '').slice(0, 4);
  return digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos;
};

export const esHora24 = (valor) => HORA_24.test(String(valor || ''));

/** Minutos desde las 00:00, o null si no es una hora válida. */
export const minutosDeHora24 = (valor) => {
  const coincidencia = HORA_24.exec(String(valor || ''));
  return coincidencia ? Number(coincidencia[1]) * 60 + Number(coincidencia[2]) : null;
};

/**
 * Errores de un rango horario (claves inicio/fin), con mensajes para el usuario.
 * Vacío si el rango es válido.
 */
export const validarRangoHora24 = (inicio, fin) => {
  const errores = {};
  if (!inicio) errores.inicio = 'Ingrese la hora de inicio.';
  else if (!esHora24(inicio)) errores.inicio = 'Use el formato 24 h HH:MM (00:00 a 23:59).';
  if (!fin) errores.fin = 'Ingrese la hora de fin.';
  else if (!esHora24(fin)) errores.fin = 'Use el formato 24 h HH:MM (00:00 a 23:59).';
  if (!errores.inicio && !errores.fin && minutosDeHora24(fin) <= minutosDeHora24(inicio)) {
    errores.fin = 'La hora de fin debe ser posterior a la hora de inicio.';
  }
  return errores;
};
