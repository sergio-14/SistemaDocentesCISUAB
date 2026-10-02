import { formatearHora24 } from '../../utils/horas24';

/**
 * Campo de hora en formato 24 h (HH:MM). Reemplaza al <input type="time">, que
 * según el idioma del navegador pide a. m./p. m. Solo admite dígitos y pone los
 * dos puntos solo; la validación (formato y rango) la hace el formulario.
 */
export default function CampoHora24({ id, value, onChange, className = '', invalido = false, disabled = false }) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:MM"
      maxLength={5}
      value={value}
      onChange={(evento) => onChange(formatearHora24(evento.target.value))}
      disabled={disabled}
      aria-invalid={invalido || undefined}
      className={`${className} tabular-nums`}
    />
  );
}
