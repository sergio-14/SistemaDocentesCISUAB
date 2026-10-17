import { useState, useEffect } from 'react';
import { ERROR_MOTION_CLASS, ERROR_SHAKE_DURATION_MS } from '../../utils/formErrors';
import { CandadoCampo, NotaUsuario } from './PiezasFormularioUsuario';

const textoError = (error) => (Array.isArray(error) ? (error[0] || '') : (typeof error === 'string' ? error : ''));

// Campo de texto de los formularios de usuario (crear y editar): borde azulado, rojo
// con un brinco si hay error (el aviso va debajo, como en el resto del formulario) y
// el error se limpia al enfocar el campo. `ayuda` es un texto pequeño debajo (sin error);
// con `ocultarError` el campo se marca en rojo pero el mensaje va solo en el toast.
const CampoUsuario = ({ idPrefijo = 'usuario', label, name, type = 'text', value, onChange, onFocus, required, disabled, error, pulse = 0, clearError, ayuda, ocultarError = false, ...rest }) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const errorMessage = textoError(error);

  useEffect(() => {
    if (!error) {
      setIsPulsing(false);
      return undefined;
    }

    setIsPulsing(false);
    const frameId = requestAnimationFrame(() => setIsPulsing(true));
    const timeoutId = setTimeout(() => setIsPulsing(false), ERROR_SHAKE_DURATION_MS);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [error, pulse]);

  // REGLA GLOBAL: limpiar el error de inmediato al hacer focus/clic en el campo.
  const handleFocusClear = (e) => {
    if (typeof clearError === 'function') {
      clearError(name);
    }
    if (typeof onFocus === 'function') onFocus(e);
  };

  return (
    <div className={error && isPulsing ? ERROR_MOTION_CLASS : ''}>
      <label htmlFor={`${idPrefijo}-${name}`} className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">{label}</label>
      <div className="relative">
        <input
          id={`${idPrefijo}-${name}`}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={handleFocusClear}
          onClick={handleFocusClear}
          disabled={disabled}
          placeholder={required ? '' : ' '}
          {...rest}
          className={`w-full h-11 px-4 rounded-full text-sm placeholder:text-slate-500 outline-none ring-inset ${
            disabled ? '!bg-slate-100 text-slate-500 cursor-not-allowed pr-11' : '!bg-azulado-100 text-slate-800'
          } ${error ? 'ring-2 ring-red-400/80' : 'ring-1 ring-azulado-300 focus:ring-2 focus:ring-blue-900/40'}`}
        />
        {disabled && <CandadoCampo className="absolute right-2 top-1/2 -translate-y-1/2" />}
      </div>
      {errorMessage && !ocultarError
        ? <NotaUsuario tipo="error">{errorMessage}</NotaUsuario>
        : ayuda && <NotaUsuario>{ayuda}</NotaUsuario>}
    </div>
  );
};

export default CampoUsuario;
