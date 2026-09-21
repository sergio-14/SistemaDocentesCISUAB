import { useState, useEffect } from 'react';

/**
 * ============================================================================
 *  REGLAS GLOBALES DE ERRORES DE FORMULARIO — SISTEMA DOCENTES UABJB
 * ============================================================================
 *  Aplican a: Usuarios, Carreras y Fondo de Tiempo (Docentes).
 *  No alterar APIs ni flujos de datos; solo diseño/ comportamiento de errores.
 * ============================================================================
 */

/** Clase CSS que dispara la animación de sacudida (shake) horizontal. */
export const ERROR_MOTION_CLASS = 'animate-field-error-shake';

/** Duración fija de la sacudida en milisegundos. De coincidir con index.css. */
export const ERROR_SHAKE_DURATION_MS = 460;

/** Mensaje limpio y estandarizado para errores de selección. */
export const CHOICE_ERROR_MESSAGE = 'Por favor, seleccione una opción.';

/**
 * Convierte un mensaje feo/confuso del backend (ej. '"" no es una elección
 * válida.') en un mensaje amigable y uniforme para el usuario.
 */
export const sanitizeChoiceError = (msg) => {
  if (!msg) return '';
  if (typeof msg !== 'string') {
    if (Array.isArray(msg)) return msg.map(sanitizeChoiceError);
    return msg;
  }
  if (/no es una elecci[oó]n v[áa]lida|is not a valid choice/i.test(msg)) {
    return CHOICE_ERROR_MESSAGE;
  }
  return msg;
};

/**
 * Obtiene el primer mensaje legible de un objeto de errores del backend.
 * Soporta strings, arrays y estructuras anidadas.
 */
export const getBackendErrorMessage = (apiErrors, fallback = 'Ocurrió un error inesperado.') => {
  if (!apiErrors) return fallback;
  if (typeof apiErrors === 'string') {
    return apiErrors.includes('<!DOCTYPE') ? fallback : sanitizeChoiceError(apiErrors);
  }

  // detail / error a nivel raíz
  if (typeof apiErrors.detail === 'string' && apiErrors.detail.trim()) {
    return apiErrors.detail.includes('<!DOCTYPE') ? fallback : sanitizeChoiceError(apiErrors.detail);
  }
  if (typeof apiErrors.error === 'string' && apiErrors.error.trim()) {
    return apiErrors.error.includes('<!DOCTYPE') ? fallback : sanitizeChoiceError(apiErrors.error);
  }

  // non_field_errors (array)
  const nfe = apiErrors.non_field_errors;
  if (Array.isArray(nfe) && nfe.length > 0) return sanitizeChoiceError(nfe[0]);
  if (typeof nfe === 'string') return sanitizeChoiceError(nfe);

  // Buscar recursivamente el primer mensaje en valores anidados
  const nested = Object.values(apiErrors).find(
    (v) => typeof v === 'string' || (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string')
  );
  if (typeof nested === 'string') return sanitizeChoiceError(nested);
  if (Array.isArray(nested) && nested.length > 0) return sanitizeChoiceError(nested[0]);

  return fallback;
};

export const getApiErrorMessage = (error, fallback = 'Ocurrio un error inesperado.') => {
  if (!error) return fallback;

  if (error.response?.data) {
    return getBackendErrorMessage(error.response.data, fallback);
  }

  if (error.request) {
    return 'No se pudo conectar con el servidor. Verifica que el backend este encendido y la URL de la API sea correcta.';
  }

  if (error.message) {
    return getBackendErrorMessage(error.message, fallback);
  }

  return getBackendErrorMessage(error, fallback);
};

/**
 * Recorre un objeto de errores del backend y sanitiza cada mensaje,
 * reemplazando los textos confusos de "opción no válida" por el mensaje
 * estandarizado. Conserva la estructura original (campo → mensaje/array).
 */
export const sanitizeApiErrors = (apiErrors) => {
  if (!apiErrors) return {};
  if (typeof apiErrors === 'string') return sanitizeChoiceError(apiErrors);

  const cleaned = {};
  Object.entries(apiErrors).forEach(([field, value]) => {
    if (['error', 'detail', 'details', 'non_field_errors'].includes(field)) return;
    if (Array.isArray(value)) {
      cleaned[field] = value.map(sanitizeChoiceError).filter(Boolean);
      if (cleaned[field].length === 0) delete cleaned[field];
    } else if (typeof value === 'string') {
      const sanitized = sanitizeChoiceError(value);
      if (sanitized) cleaned[field] = sanitized;
    } else if (value && typeof value === 'object') {
      // Estructura anidada: { mensaje: "..." }
      const msg = value.mensaje || value.message || value.detail;
      if (msg) cleaned[field] = sanitizeChoiceError(msg);
    }
  });
  return cleaned;
};

/**
 * Extrae un string simple desde un valor de error que puede ser
 * string, array o null/undefined.
 */
export const getErrorMessage = (error) => {
  if (!error) return '';
  if (Array.isArray(error)) return error[0] || '';
  if (typeof error === 'string') return error;
  return '';
};

/**
 * Hook reutilizable para la animación de sacudida (shake) de campos con error.
 * Dispara la clase ERROR_MOTION_CLASS durante ERROR_SHAKE_DURATION_MS cada vez
 * que `error` deja de estar vacío o cambia el contador `pulse`.
 *
 * @param {string|string[]|undefined} error  Mensaje de error del campo
 * @param {number} pulse                     Contador que fuerza re-disparo
 * @returns {{ isPulsing: boolean, motionClass: string }}
 */
export const useErrorPulse = (error, pulse = 0) => {
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (!error || (Array.isArray(error) && error.length === 0)) {
      setIsPulsing(false);
      return;
    }
    setIsPulsing(false);
    const frameId = requestAnimationFrame(() => setIsPulsing(true));
    const timeoutId = setTimeout(() => setIsPulsing(false), ERROR_SHAKE_DURATION_MS);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [error, pulse]);

  const motionClass = error && isPulsing ? ERROR_MOTION_CLASS : '';
  return { isPulsing, motionClass };
};

/**
 * Clases Tailwind de borde + anillo rojo para el estado de error,
 * visibles tanto en modo claro como oscuro.
 */
export const ERROR_FIELD_BORDER_CLASS =
  'border-2 !border-red-600 dark:!border-red-500 ring-1 ring-inset ring-red-500/50';
