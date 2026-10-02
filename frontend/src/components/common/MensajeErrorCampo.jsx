import { getErrorMessage, useErrorPulse } from '../../utils/formErrors';

/**
 * Mensaje de validación propia bajo un campo (en rojo, con la sacudida común).
 * Los formularios usan noValidate: este mensaje reemplaza al globo nativo del navegador.
 * `tono` cambia el color en pantallas de fondo oscuro (login, cambio de contraseña).
 */
export default function MensajeErrorCampo({ error, pulse = 0, tono = 'text-red-600 dark:text-red-400' }) {
  const mensaje = getErrorMessage(error);
  const { motionClass } = useErrorPulse(mensaje, pulse);
  if (!mensaje) return null;
  return <p className={`text-xs mt-1 ${tono} ${motionClass}`}>{mensaje}</p>;
}
