import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import api from '../apis/api';
import ModalUsuario from './ModalUsuario';
import toast from 'react-hot-toast';
import {
  ERROR_MOTION_CLASS,
  ERROR_FIELD_BORDER_CLASS,
  ERROR_SHAKE_DURATION_MS,
  sanitizeChoiceError,
  sanitizeApiErrors,
  getBackendErrorMessage,
} from '../utils/formErrors';

// Animación para el search input
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      width: 0;
      opacity: 0;
      transform: translateX(10px);
    }
    to {
      width: 100%;
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes toastPop {
    0% {
      transform: translateY(0) scale(1);
    }
    35% {
      transform: translateY(-4px) scale(1.02);
    }
    70% {
      transform: translateY(1px) scale(0.99);
    }
    100% {
      transform: translateY(0) scale(1);
    }
  }

  .toast-brinco {
    animation: toastPop 240ms ease-out;
  }
  
  @keyframes fieldErrorPop {
    0% { transform: translateY(0) scale(1); }
    35% { transform: translateY(-3px) scale(1.008); }
    70% { transform: translateY(0.5px) scale(0.996); }
    100% { transform: translateY(0) scale(1); }
  }
  
  .animate-field-error-pop {
    animation: fieldErrorPop 300ms ease-out;
    transform-origin: center;
  }

  @keyframes panelAsignacionSlideDown {
    from {
      opacity: 0;
      transform: translateY(-14px);
      max-height: 0;
    }
    to {
      opacity: 1;
      transform: translateY(0);
      max-height: 240px;
    }
  }

  .animate-panel-asignacion {
    animation: panelAsignacionSlideDown 260ms ease-out;
    transform-origin: top;
  }
`;
document.head.appendChild(style);

const InfoIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PencilIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const PauseIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
    </svg>
);

const PlayIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
);

const TrashIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

// Mensajes descriptivos para validación en caliente (Normativa UABJB)
const MENSAJE_DUPLICADO = 'Esta combinación de Rol y Carrera ya se encuentra asignada.';
const MENSAJE_LIMITE_ASIGNACIONES = 'Un usuario no puede tener más de 2 asignaciones en el sistema (Normativa de Fondo de Tiempo).';
const MENSAJE_AUTORIDAD_MULTIPLE = 'No se puede asignar un cargo de autoridad (Director/Jefe) en múltiples carreras.';
const MENSAJE_CONFLICTO_AUTORIDAD = 'Conflicto de Autoridad: Un usuario no puede ser Director y Jefe de Estudios de la misma carrera.';
const MENSAJE_AUTORIDAD_UNICA = 'Un usuario no puede tener más de un cargo de autoridad (Director o Jefe de Estudios) en el sistema (Normativa UABJB).';
const MENSAJE_DOCENTE_OTRA_CARRERA = 'La carga docente de un cargo de autoridad debe pertenecer a su misma carrera (dedicación exclusiva UABJB).';
const MENSAJE_CARRERA_PENDIENTE = 'Debe seleccionar una carrera para la asignación actual antes de agregar otra.';
const ROLES_MANDO_UABJB = ['director', 'jefe_estudios'];

const ROL_LABELS = {
  iiisyp: '🔬 Instituto de investigación',
  director: '🏛️ Director de Carrera',
  jefe_estudios: '📚 Jefe de Estudios',
  docente: '👨‍🏫 Docente',
};

const ROL_STYLES = {
  iiisyp: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-500 dark:border-sky-700',
  director: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-500 dark:border-blue-700',
  jefe_estudios: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-500 dark:border-cyan-700',
  docente: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-500 dark:border-green-700',
};

const obtenerTextoRolUsuario = (usuario) => {
  if (!usuario?.perfil) return 'Sin rol';

  const rolPrincipal = String(usuario.perfil.rol || '').trim();
  const rolesExtra = Array.isArray(usuario.asignaciones)
    ? usuario.asignaciones
        .filter((item) => item?.rol)
        .map((item) => String(item.rol).trim())
    : [];

  const rolesUnicos = [...new Set([rolPrincipal, ...rolesExtra].filter(Boolean))];

  if (rolesUnicos.length === 0) return 'Sin rol';

  return rolesUnicos.map((rol) => ROL_LABELS[rol] || rol).join(' / ');
};

const obtenerRolesUsuario = (usuario) => {
  if (!usuario?.perfil) return [];

  const rolPrincipal = String(usuario.perfil.rol || '').trim();
  const rolesExtra = Array.isArray(usuario.asignaciones)
    ? usuario.asignaciones
        .filter((item) => item?.rol && item?.activo !== false)
        .map((item) => String(item.rol).trim())
    : [];

  return [...new Set([rolPrincipal, ...rolesExtra].filter(Boolean))];
};

const obtenerCarrerasUsuario = (usuario) => {
  if (!usuario) return [];

  const carreraPrincipal = String(usuario?.perfil?.carrera?.codigo || usuario?.carrera_codigo || '').trim();
  const carrerasExtra = Array.isArray(usuario.asignaciones)
    ? usuario.asignaciones
        .filter((item) => item?.carrera_codigo)
        .map((item) => String(item.carrera_codigo).trim())
    : [];

  return [...new Set([carreraPrincipal, ...carrerasExtra].filter(Boolean))];
};

const obtenerCarreraIdsUsuario = (usuario) => {
  if (!usuario) return [];

  const carreraPrincipal = usuario?.perfil?.carrera;
  const carrerasExtra = Array.isArray(usuario.asignaciones)
    ? usuario.asignaciones
        .filter((item) => item?.activo !== false && item?.carrera)
        .map((item) => String(item.carrera))
    : [];

  return [...new Set([carreraPrincipal, ...carrerasExtra].filter(Boolean).map((id) => String(id)))];
};

const obtenerTextoCarrerasUsuario = (usuario) => {
  const carreras = obtenerCarrerasUsuario(usuario);
  if (carreras.length === 0) return 'Sin carrera';
  return carreras.join(' / ');
};

const ROLES_AUTORIDAD = ['director', 'jefe_estudios', 'iiisyp'];

const usuarioTieneRolDocente = (usuario) => obtenerRolesUsuario(usuario).includes('docente');
const usuarioTieneVinculoDocente = (usuario) => Boolean(usuario?.perfil?.docente_id || usuario?.perfil?.docente);

const usuarioTienePerfilDocentePendiente = (usuario) => {
  const roles = obtenerRolesUsuario(usuario);
  return (
    roles.length > 1
    && roles.includes('docente')
    && roles.some((rol) => ROLES_AUTORIDAD.includes(rol))
    && !usuarioTieneVinculoDocente(usuario)
  );
};

const AnimatedInlineMessage = ({ show, message, wrapperClassName = '', messageClassName = '' }) => {
  const [shouldRender, setShouldRender] = useState(show);
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      const frameId = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frameId);
    }

    setIsVisible(false);
    const timeoutId = setTimeout(() => setShouldRender(false), 260);

    return () => clearTimeout(timeoutId);
  }, [show]);

  if (!shouldRender) return null;

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-out ${isVisible ? 'max-h-20 opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2'} ${wrapperClassName}`}
    >
      <p className={`transition-all duration-300 ease-out ${isVisible ? 'translate-y-0' : '-translate-y-1'} ${messageClassName}`}>
        {message}
      </p>
    </div>
  );
};

const InputField = ({ label, name, type = 'text', value, onChange, onFocus, required, disabled, error, pulse = 0, clearError, ...rest }) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const errorMessage = Array.isArray(error) ? (error[0] || '') : (typeof error === 'string' ? error : '');

  useEffect(() => {
    if (!error) {
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

  // REGLA GLOBAL: limpiar el error de inmediato al hacer focus/clic en el campo.
  const handleFocusClear = (e) => {
    if (typeof clearError === 'function') {
      clearError(name);
    }
    if (typeof onFocus === 'function') onFocus(e);
  };

  return (
  <div className={error && isPulsing ? ERROR_MOTION_CLASS : ''}>
    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
      {label}
      {error && <span className="ml-1 text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      onFocus={handleFocusClear}
      onClick={handleFocusClear}
      disabled={disabled}
      placeholder={required ? '' : ' '}
      {...rest}
      className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all shadow-sm ${error ? `${ERROR_FIELD_BORDER_CLASS} focus:ring-red-500/60` : 'border-slate-400 dark:border-slate-600 focus:ring-blue-500'}`}
    />
    <AnimatedInlineMessage
      show={Boolean(errorMessage)}
      message={errorMessage}
      wrapperClassName="mt-1"
      messageClassName="text-xs text-red-600 dark:text-red-400"
    />
  </div>
  );
};

// Componente Select con Dropdown animado (igual que en ListaDocentes)
const SELECT_INPUT_BASE_CLASS = 'border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700';

const STATIC_CONTROL_STYLE = { transition: 'none', transform: 'none', animation: 'none' };

const SelectConDropdown = ({ label, name, value, onChange, options, error, disabled = false, required = false, placeholder = 'Seleccione...', hoverEffect = true, stable = false, standardStyle = false, onInteract = null, selectedIndex = null, selectedIndexesByValue = null, forwardedRef = null, pulse = 0 }) => {
  const [open, setOpen] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const containerRef = useRef(null);
  const errorMessage = Array.isArray(error) ? (error[0] || '') : (typeof error === 'string' ? error : '');

  useEffect(() => {
    if (forwardedRef) {
      forwardedRef.current = { open: () => setOpen(true), close: () => setOpen(false) };
    }
  }, [forwardedRef]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (!error) {
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

  // REGLA GLOBAL: limpiar el error de inmediato al abrir el dropdown (clic/focus).
  const handleButtonFocus = () => {
    if (!disabled && typeof onInteract === 'function') {
      onInteract();
    }
  };

  const selectedLabel = options.find(opt => opt.value === value)?.label;

  return (
    <div ref={containerRef} className={`relative ${error && isPulsing ? ERROR_MOTION_CLASS : ''}`}>
      {label && (
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
          {label}
          {error && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => {
          handleButtonFocus();
          setOpen(!open);
        }}
        onFocus={handleButtonFocus}
        disabled={disabled}
        style={STATIC_CONTROL_STYLE}
        className={standardStyle
          ? `w-full h-[52px] px-4 py-3 rounded-2xl text-left flex items-center justify-between shadow-sm transition-none transform-none hover:shadow-none ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            } ${
              error
                ? `${ERROR_FIELD_BORDER_CLASS} bg-slate-50 dark:bg-slate-700 focus:ring-red-500/60 ${error && isPulsing ? ERROR_MOTION_CLASS : ''}`
                : SELECT_INPUT_BASE_CLASS
            }`
          : `w-full h-[52px] px-4 py-3 rounded-xl text-left flex items-center justify-between shadow-sm transition-none transform-none hover:shadow-none ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            } ${
              error 
                ? `${ERROR_FIELD_BORDER_CLASS} bg-slate-50 dark:bg-slate-700 focus:ring-red-500/60 ${error && isPulsing ? ERROR_MOTION_CLASS : ''}` 
                : SELECT_INPUT_BASE_CLASS
            }`
        }
      >
        <span className={standardStyle
          ? `${selectedLabel ? 'text-slate-800 dark:text-white font-semibold text-sm leading-tight' : 'text-slate-400 dark:text-slate-500'}`
          : `${selectedLabel ? 'text-slate-800 dark:text-white font-semibold text-sm leading-tight' : 'text-slate-400 dark:text-slate-500'}`
        }>
          {selectedLabel || placeholder}
        </span>
        <div style={STATIC_CONTROL_STYLE} className={standardStyle ? 'w-8 h-8 bg-[#2C4AAE] rounded-lg flex items-center justify-center transition-none transform-none' : 'w-8 h-8 bg-[#2C4AAE] rounded-lg flex items-center justify-center transition-none transform-none'}>
          <svg
            style={STATIC_CONTROL_STYLE}
            className="w-4 h-4 text-white transition-none transform-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <AnimatedInlineMessage
        show={Boolean(errorMessage)}
        message={errorMessage}
        wrapperClassName="mt-1"
        messageClassName="text-xs text-red-600 dark:text-red-400"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-48 overflow-auto">
          {options.map((option) => {
            const isSelected = value === option.value;
            const markers = selectedIndexesByValue?.[String(option.value)] || (isSelected && selectedIndex !== null ? [selectedIndex] : []);
            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) return;
                  onChange({ target: { name, value: option.value } });
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#2C4AAE] text-white font-semibold'
                    : option.disabled
                    ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white'
                }`}
              >
                <span>{option.label}</span>
                {markers.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    {markers.map((marker) => (
                      <span key={marker} className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-white text-[#2C4AAE] text-[11px] font-bold leading-none">
                        {marker}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const obtenerNombreCompletoDocente = (docente) => {
  if (!docente) return '';
  // Si ya tiene nombre_completo, usarlo
  if (docente.nombre_completo) return docente.nombre_completo;
  // Si no, construir desde campos separados
  return `${docente.nombres || ''} ${docente.apellido_paterno || ''} ${docente.apellido_materno || ''}`.trim();
};

const FilterDocentes = ({
  label,
  name,
  value,
  onChange,
  docentes,
  error,
  disabled = false,
  required = false,
  placeholder = 'Buscar docente...'
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPulsing, setIsPulsing] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedDocente = docentes.find((d) => String(d.id) === String(value));

  // Efecto rebote (shake) al detectar error
  useEffect(() => {
    if (!error) {
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
  }, [error]);

  useEffect(() => {
    if (selectedDocente) {
      setSearchTerm(obtenerNombreCompletoDocente(selectedDocente));
    } else if (!value) {
      setSearchTerm('');
    }
  }, [value, selectedDocente]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const filteredDocentes = docentes.filter((docente) => {
    const term = searchTerm.toLowerCase();
    const nombre = obtenerNombreCompletoDocente(docente).toLowerCase();
    const ci = String(docente.ci || '').toLowerCase();
    return nombre.includes(term) || ci.includes(term);
  });

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setSearchTerm(nextValue);
    setOpen(true);
  };

  const handleButtonClick = () => {
    if (disabled) return;
    if (value) {
      setSearchTerm('');
      onChange({ target: { name, value: '' } });
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    setOpen(!open);
    if (!open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSelectDocente = (docente) => {
    onChange({ target: { name, value: docente.id } });
    setSearchTerm(obtenerNombreCompletoDocente(docente));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${error && isPulsing ? ERROR_MOTION_CLASS : ''}`}>
      {label && (
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
          {label}
        </label>
      )}

      <div
        style={STATIC_CONTROL_STYLE}
        className={`flex items-center px-4 py-3 rounded-xl shadow-sm ${
          disabled
            ? `cursor-not-allowed opacity-60 ${SELECT_INPUT_BASE_CLASS}`
            : error
              ? `${ERROR_FIELD_BORDER_CLASS} bg-slate-50 dark:bg-slate-700`
              : SELECT_INPUT_BASE_CLASS
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-slate-800 dark:text-white focus:outline-none text-sm placeholder-slate-400 dark:placeholder-slate-500"
        />

        <button
          type="button"
          onClick={handleButtonClick}
          disabled={disabled}
          style={STATIC_CONTROL_STYLE}
          className="w-8 h-8 bg-[#2C4AAE] rounded-lg flex items-center justify-center flex-shrink-0 ml-2 disabled:opacity-70"
        >
          <svg
            style={STATIC_CONTROL_STYLE}
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-64 overflow-auto">
          {docentes.length === 0 ? (
            <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 text-center font-bold">
              ⚠️ No hay docentes cargados
            </div>
          ) : filteredDocentes.length > 0 ? (
            filteredDocentes.map((docente) => (
              <button
                key={docente.id}
                type="button"
                onClick={() => handleSelectDocente(docente)}
                className="w-full text-left px-4 py-3 text-sm transition-colors text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white border-b border-slate-200 dark:border-slate-700 last:border-b-0"
              >
                <div className="font-semibold">{obtenerNombreCompletoDocente(docente)}</div>
              </button>
            ))
          ) : searchTerm ? (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              No hay docentes que coincidan
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              Escribe para buscar docentes ({docentes.length} disponibles)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FilterCarreras = ({
  label,
  name,
  value,
  onChange,
  carreras,
  error,
  disabled = false,
  required = false,
  placeholder = 'Buscar carrera...'
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const clearingSelectionRef = useRef(false);

  const selectedCarrera = carreras.find((c) => String(c.id) === String(value));

  useEffect(() => {
    if (clearingSelectionRef.current) {
      if (!value) {
        clearingSelectionRef.current = false;
      }
      return;
    }
    if (selectedCarrera?.nombre) {
      setSearchTerm(selectedCarrera.nombre);
    } else if (!value) {
      setSearchTerm('');
    }
  }, [value, selectedCarrera]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const filteredCarreras = carreras.filter((carrera) => {
    const term = searchTerm.toLowerCase();
    const nombre = String(carrera.nombre || '').toLowerCase();
    const codigo = String(carrera.codigo || '').toLowerCase();
    const facultad = String(carrera.facultad_nombre || '').toLowerCase();
    return nombre.includes(term) || codigo.includes(term) || facultad.includes(term);
  });

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setSearchTerm(nextValue);
    setOpen(true);

    if (value) {
      onChange({ target: { name, value: '' } });
    }
  };

  const handleButtonClick = () => {
    if (disabled) return;
    if (value) {
      clearingSelectionRef.current = true;
      setSearchTerm('');
      onChange({ target: { name, value: '' } });
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    setOpen(!open);
    if (!open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSelectCarrera = (carrera) => {
    onChange({ target: { name, value: carrera.id } });
    setSearchTerm(carrera.nombre || '');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
          {label}
        </label>
      )}

      <div
        style={STATIC_CONTROL_STYLE}
        className={`flex items-center px-4 py-3 rounded-xl shadow-sm ${
          disabled
            ? `cursor-not-allowed opacity-60 ${SELECT_INPUT_BASE_CLASS}`
            : error
              ? `${ERROR_FIELD_BORDER_CLASS} bg-slate-50 dark:bg-slate-700`
              : SELECT_INPUT_BASE_CLASS
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-slate-800 dark:text-white focus:outline-none text-sm placeholder-slate-400 dark:placeholder-slate-500"
        />

        <button
          type="button"
          onClick={handleButtonClick}
          disabled={disabled}
          style={STATIC_CONTROL_STYLE}
          className="w-8 h-8 bg-[#2C4AAE] rounded-lg flex items-center justify-center flex-shrink-0 ml-2 disabled:opacity-70"
        >
          <svg
            style={STATIC_CONTROL_STYLE}
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-64 overflow-auto">
          {filteredCarreras.length > 0 ? (
            filteredCarreras.map((carrera) => (
              <button
                key={carrera.id}
                type="button"
                onClick={() => handleSelectCarrera(carrera)}
                className="w-full text-left px-4 py-3 text-sm transition-colors text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white border-b border-slate-200 dark:border-slate-700 last:border-b-0"
              >
                <div className="font-semibold">{carrera.nombre}</div>
              </button>
            ))
          ) : searchTerm ? (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              No hay carreras que coincidan
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              Escribe para buscar carreras
            </div>
          )}
        </div>
      )}

      <AnimatedInlineMessage
        show={Boolean(error)}
        message={error || ''}
        wrapperClassName="mt-1"
        messageClassName="text-xs text-red-600 dark:text-red-400"
      />
    </div>
  );
};

const ToggleSwitch = ({ isActive, onChange, disabled = false }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange()}
    disabled={disabled}
    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      isActive
        ? 'bg-emerald-500 dark:bg-emerald-600 focus:ring-emerald-400 dark:focus:ring-emerald-500'
        : 'bg-slate-500 dark:bg-slate-600 focus:ring-slate-400 dark:focus:ring-slate-500'
    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
        isActive ? 'translate-x-6' : 'translate-x-0.5'
      }`}
    />
  </button>
);

// Componente compacto para seleccionar carrera (mismo estilo que SelectConDropdown de ListaDocentes)
const CarreraSelectorCompacto = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const selectedCarrera = options.find((c) => String(c.id) === String(value));
  const displayLabel = selectedCarrera?.nombre || 'Seleccione...';

  return (
    <div ref={containerRef} className="relative">
      <div className={`relative w-full rounded-xl border-2 shadow-sm ${value ? 'border-[#2C4AAE] bg-[#2C4AAE]/10' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700'}`}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`w-full text-left px-3 py-2 rounded-xl bg-transparent flex items-center justify-between gap-2 ${value ? 'text-[#2C4AAE] dark:text-blue-300' : 'text-slate-700 dark:text-white'}`}
        >
          <span className={`truncate text-xs font-semibold ${!value ? 'text-slate-400 dark:text-slate-500' : ''}`}>{displayLabel}</span>
          <span className="flex items-center justify-center h-5 w-5 rounded-md bg-[#2C4AAE] ring-1 ring-[#2C4AAE]">
            <svg className={`w-3 h-3 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-48 overflow-y-auto">
          <div className="p-1.5">
            {options.map((carrera) => (
              <button
                key={carrera.id}
                type="button"
                onClick={() => {
                  onChange(String(carrera.id));
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  String(value) === String(carrera.id)
                    ? 'bg-cyan-50 dark:bg-cyan-900/30 shadow-[inset_2px_0_0_0_#06b6d4] text-cyan-800 dark:text-cyan-200 font-semibold'
                    : 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white'
                }`}
              >
                <span className="block truncate">{carrera.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Dropdown simple estilo "Seleccione..."
const SimpleDropdown = ({ label, value, onChange, options, placeholder = 'Carreras', clearOnToggle = false }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const selectedLabel = options.find(opt => opt.value === value)?.label;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
        {label}
      </label>
      <button
        type="button"
        onClick={() => {
          if (clearOnToggle) {
            onChange('');
          }
          setOpen(!open);
          if (open) {
            setSearch('');
          }
        }}
        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 border-2 border-slate-400 dark:border-slate-600 focus:border-blue-500 rounded-xl text-left flex items-center justify-between transition-all shadow-sm"
      >
        <span className={`${selectedLabel ? 'text-slate-800 dark:text-white font-semibold text-sm leading-tight' : 'text-slate-400 dark:text-slate-500'}`}>
          {selectedLabel || placeholder}
        </span>
        <div className="w-8 h-8 bg-[#2C4AAE] rounded-lg flex items-center justify-center">
          <svg
            className={`w-4 h-4 text-white ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-48 overflow-auto">
          <div className="p-2 border-b border-slate-200 dark:border-slate-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar carrera..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                setSearch('');
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === option.value
                  ? 'bg-[#2C4AAE] text-white font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
              No hay carreras que coincidan
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente de Búsqueda Animado
const SearchInput = ({ value, onChange, placeholder = 'Buscar por nombre o C.I....' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleBlur = () => {
    if (!value) {
      setIsExpanded(false);
    }
  };

  return (
    <div className="gestion-usuarios-search flex items-center gap-2 flex-row-reverse">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`p-2.5 bg-[#2C4AAE] hover:bg-[#1a3a8a] text-white rounded-xl transition-all duration-300 hover:scale-110 ${isExpanded ? 'rotate-0' : 'rotate-0'}`}
        title="Buscar usuario"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
      <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'w-64 opacity-100' : 'w-0 opacity-0'}`}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-[#2C4AAE] rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all"
        />
      </div>
    </div>
  );
};

function GestionUsuarios({ isDark, sidebarCollapsed = false, user, hasSidebar = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const restoringFormRef = useRef(false);
  const restoringEditModalRef = useRef(false);
  const restoringLinkRef = useRef(false);
  const [usuarios, setUsuarios] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [docenteReciente, setDocenteReciente] = useState(null);
  const [carreras, setCarreras] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for editing modal
  const [showModal, setShowModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({});
  const [crearNuevoDocente, setCrearNuevoDocente] = useState(false);
  const [bloquearCrearNuevoDocente, setBloquearCrearNuevoDocente] = useState(false);
  const [asignacionesExtra, setAsignacionesExtra] = useState([]);
  const [indiceAsignacionActiva, setIndiceAsignacionActiva] = useState(0);
  const [selectedRoleLeft, setSelectedRoleLeft] = useState(null);
  const [selectedRoleRight, setSelectedRoleRight] = useState(null);
  const [expandedCarreraRoles, setExpandedCarreraRoles] = useState({});
  const rolDropdownRef = useRef(null);
  const carreraDropdownRef = useRef(null);
  const lastToastRef = useRef({});
  const TOAST_DEBOUNCE_MS = 1500;
  const showToastOnce = (msg) => {
    try {
      const last = lastToastRef.current[msg];
      const now = Date.now();
      if (last && (now - last) < TOAST_DEBOUNCE_MS) return;
      lastToastRef.current[msg] = now;
      toast.error(msg, { className: 'toast-brinco' });
    } catch (e) {
      // en caso de fallo, fallar silenciosamente mostrando el toast normal
      toast.error(msg, { className: 'toast-brinco' });
    }
  };

  const pulseFieldErrors = (fields = []) => {
    if (!fields.length) return;

    setErrorPulse((prev) => {
      const next = { ...prev };
      fields.forEach((field) => {
        next[field] = (next[field] || 0) + 1;
      });
      return next;
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorPulse, setErrorPulse] = useState({});

  // Pulse visual para el panel izquierdo (Roles disponibles)
  // Debe declararse DESPUÉS de `errors` y `errorPulse` (temporal dead zone)
  const [leftPanelPulsing, setLeftPanelPulsing] = useState(false);
  useEffect(() => {
    if (!errors?.rol) {
      setLeftPanelPulsing(false);
      return;
    }
    setLeftPanelPulsing(false);
    const frameId = requestAnimationFrame(() => setLeftPanelPulsing(true));
    const timeoutId = setTimeout(() => setLeftPanelPulsing(false), ERROR_SHAKE_DURATION_MS);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [errors?.rol, errorPulse.rol]);

  // Pulse visual para el panel derecho (Roles asignados) ante conflictos de combinación.
  // Debe reaccionar a errores del panel derecho (no del izquierdo) y resaltar la fila conflictiva.
  const [rightPanelPulse, setRightPanelPulse] = useState(0);
  const [rightPanelPulsing, setRightPanelPulsing] = useState(false);
  const [filaConflictoIndex, setFilaConflictoIndex] = useState(null);
  useEffect(() => {
    if (!errors?.asignaciones) {
      setRightPanelPulsing(false);
      return;
    }
    setRightPanelPulsing(false);
    const frameId = requestAnimationFrame(() => setRightPanelPulsing(true));
    const timeoutId = setTimeout(() => setRightPanelPulsing(false), ERROR_SHAKE_DURATION_MS);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [errors?.asignaciones, rightPanelPulse]);

  const [addRoleButtonPulse, setAddRoleButtonPulse] = useState(0);
  const [isAddRoleButtonPulsing, setIsAddRoleButtonPulsing] = useState(false);
  const [showAddRoleTooltip, setShowAddRoleTooltip] = useState(false);
  const [abrirModalAlVolver, setAbrirModalAlVolver] = useState(false);
  const [vinculacionRapidaDocente, setVinculacionRapidaDocente] = useState(false);
  const [volverANuevoDocente, setVolverANuevoDocente] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [showToggleModal, setShowToggleModal] = useState(false);
  const [usuarioToToggle, setUsuarioToToggle] = useState(null);
  const [usuarioDetalle, setUsuarioDetalle] = useState(null);
  const [showOnlyOrphans, setShowOnlyOrphans] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCarrera, setSelectedCarrera] = useState('');

  const esSuperuserActual = user?.is_superuser === true;
  const esDirectorCarreraActual = user?.perfil?.rol === 'director';
  const carreraIdsGestionablesUsuario = (() => {
    if (!esDirectorCarreraActual) return new Set();

    const ids = [];
    if (user?.perfil?.carrera) {
      ids.push(String(user.perfil.carrera));
    }
    if (Array.isArray(user?.asignaciones)) {
      user.asignaciones
        .filter((item) => item?.activo !== false && item?.rol === 'director' && item?.carrera)
        .forEach((item) => ids.push(String(item.carrera)));
    }
    return new Set(ids);
  })();
  const carrerasGestionables = esSuperuserActual
    ? carreras
    : (esDirectorCarreraActual && carreraIdsGestionablesUsuario.size > 0
      ? carreras.filter((carrera) => carreraIdsGestionablesUsuario.has(String(carrera.id)))
      : carreras);
  const usuarioPerteneceACarrerasGestionables = (usuario) => {
    if (esSuperuserActual) return true;
    if (!esDirectorCarreraActual) return false;
    if (carreraIdsGestionablesUsuario.size === 0) return true;
    const idsUsuario = obtenerCarreraIdsUsuario(usuario);
    return idsUsuario.some((id) => carreraIdsGestionablesUsuario.has(String(id)));
  };
  const filtrarRolesPorPermiso = (rolesBase) => (rolesBase || []).filter((rol) => {
    if (esSuperuserActual) return true;
    if (esDirectorCarreraActual) return !['iiisyp', 'director'].includes(rol.value);
    return rol.value !== 'iiisyp';
  });
  
  // Usuarios huerfanos: sin perfil o con cualquier rol docente sin docente vinculado
  const esUsuarioHuerfano = (u) => !u?.perfil || (usuarioTieneRolDocente(u) && !usuarioTieneVinculoDocente(u));
  const hayOrfanos = usuarios.length > 0 && usuarios.some(esUsuarioHuerfano);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (location?.state?.from !== 'docente') return;
    setVolverANuevoDocente(true);
    setIsCreating(true);
    setUsuarioEditando(null);
  }, [location?.state?.from]);

  useEffect(() => {
    if (restoringEditModalRef.current || usuarios.length === 0) return;

    const datosEditarGuardados = sessionStorage.getItem('datosEditarUsuario');
    if (!datosEditarGuardados) return;

    try {
      const { userId } = JSON.parse(datosEditarGuardados);
      const usuario = usuarios.find((item) => item.id === userId);

      if (usuario) {
        restoringEditModalRef.current = true;
        setUsuarioEditando(usuario);
        setShowModal(true);
        setIsCreating(false);
      }
    } catch (e) {
      console.error('Error al recuperar edición de usuario:', e);
      sessionStorage.removeItem('datosEditarUsuario');
    }
  }, [usuarios]);

  useEffect(() => {
    if (restoringLinkRef.current) return;

    const vincularDocentePendiente = sessionStorage.getItem('vincularDocentePendiente');
    if (!vincularDocentePendiente) return;

    try {
      const datos = JSON.parse(vincularDocentePendiente);
      const docente = docentes.find((item) => String(item.id) === String(datos.docenteId));
      const docenteId = datos.docenteId;

      if (docente || docenteId) {
        restoringLinkRef.current = true;
        restoringFormRef.current = true;
        const datosCrearUsuarioRaw = sessionStorage.getItem('datosCrearUsuario');
        const datosCrearUsuario = datosCrearUsuarioRaw ? JSON.parse(datosCrearUsuarioRaw) : null;
        const nombreCompleto = datosCrearUsuario?.nombre_completo || `${datos.first_name || ''} ${datos.last_name || ''}`.trim();
        const firstName = datosCrearUsuario?.first_name || datos.first_name || '';
        const lastName = datosCrearUsuario?.last_name || datos.last_name || '';
        const carreraSeleccionada = datosCrearUsuario?.carrera || datos.carrera || docente?.carrera_id || docente?.carrera || '';

        setVinculacionRapidaDocente(true);
        setDocenteReciente({
          id: docenteId,
          nombre_completo: docente?.nombre_completo || nombreCompleto,
          ci: docente?.ci || '',
          carrera_id: carreraSeleccionada,
        });
        setFormData({
          username: datosCrearUsuario?.username || '',
          email: datosCrearUsuario?.email || datos.email || '',
          nombre_completo: nombreCompleto,
          first_name: firstName,
          last_name: lastName,
          rol: 'docente',
          carrera: carreraSeleccionada,
          docente: docenteId,
          docente_data: null,
          password: datosCrearUsuario?.password || '',
          password_confirm: datosCrearUsuario?.password_confirm || '',
        });
        setAsignacionesExtra([]);
        setIndiceAsignacionActiva(0);
        setCrearNuevoDocente(false);
        setBloquearCrearNuevoDocente(false);
        setErrors({});
        setUsuarioEditando(null);
        setIsCreating(true);
        sessionStorage.removeItem('vincularDocentePendiente');
      }
    } catch (e) {
      console.error('Error al preparar vínculo rápido de docente:', e);
      sessionStorage.removeItem('vincularDocentePendiente');
    }
  }, [docentes]);

  // 🔗 Recuperar datos del formulario al volver desde docentes
  useEffect(() => {
    const vincularDocentePendiente = sessionStorage.getItem('vincularDocentePendiente');
    if (vincularDocentePendiente) return;
    const datosGuardados = sessionStorage.getItem('datosCrearUsuario');
    if (datosGuardados) {
      try {
        const datos = JSON.parse(datosGuardados);
        const docenteRetornadoRaw = sessionStorage.getItem('docenteRetornadoDesdeUsuarios');
        const docenteRetornado = docenteRetornadoRaw ? JSON.parse(docenteRetornadoRaw) : null;
        const firstName = datos.first_name || '';
        const lastName = datos.last_name || '';
        const nombreCompleto = datos.nombre_completo || `${firstName} ${lastName}`.trim();

        setDocenteReciente(docenteRetornado ? {
          id: docenteRetornado.id,
          nombre_completo: docenteRetornado.nombre_completo || nombreCompleto,
          ci: docenteRetornado.ci || '',
          carrera_id: docenteRetornado.carrera || '',
        } : null);

        restoringFormRef.current = true;
        setFormData({
          ...datos,
          nombre_completo: nombreCompleto,
          first_name: firstName,
          last_name: lastName,
          carrera: docenteRetornado?.carrera || datos.carrera || '',
          docente: docenteRetornado?.id || (datos.docente || ''),
          docente_data: null,
        });
        setCrearNuevoDocente(false);
        setBloquearCrearNuevoDocente(Boolean(docenteRetornado?.id));
        setAsignacionesExtra([]);
        setIndiceAsignacionActiva(0);
        sessionStorage.removeItem('datosCrearUsuario');
        sessionStorage.removeItem('docenteRetornadoDesdeUsuarios');
        sessionStorage.removeItem('flujoDocenteDesdeUsuarios');
        // Abrir el modal automáticamente con los datos recuperados
        setIsCreating(true);
        setAbrirModalAlVolver(false);
      } catch (e) {
        console.error('Error al recuperar datos:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (!isCreating) return;
    // REFACTOR: Auto-vincular docenteReciente cuando el rol 'docente' esté presente
    // en CUALQUIER asignación (principal o secundaria), no solo cuando es rol principal.
    const docenteEnPrincipal = String(formData.rol || '').trim() === 'docente';
    const docenteEnSecundaria = asignacionesExtra.some(
      (item) => String(item.rol || '').trim() === 'docente'
    );
    if (!docenteEnPrincipal && !docenteEnSecundaria) return;
    if (!docenteReciente?.id) return;
    if (formData.docente) return;

    setFormData((prev) => ({
      ...prev,
      docente: docenteReciente.id,
      docente_data: null,
      carrera: prev.carrera || docenteReciente.carrera_id || '',
    }));
  }, [isCreating, formData.rol, formData.docente, docenteReciente, asignacionesExtra]);

  const cargarDatos = async () => {
    try {
      const [usuariosRes, docentesRes, carrerasRes, rolesRes] = await Promise.all([
        api.get('/usuarios/'),
        api.get('/docentes/'),
        api.get('/carreras/'),
        api.get('/usuarios/roles/')
      ]);

      setUsuarios(usuariosRes.data.results || usuariosRes.data);
      setDocentes(docentesRes.data.results || docentesRes.data);
      setCarreras(carrerasRes.data.results || carrerasRes.data);

      const todosRoles = rolesRes.data || [];
      setRoles(filtrarRolesPorPermiso(todosRoles));
      
      setLoading(false);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('Error al cargar los datos');
      setLoading(false);
    }
  };

  const docentesDisponibles = docenteReciente && !docentes.some((item) => String(item.id) === String(docenteReciente.id))
    ? [...docentes, docenteReciente]
    : docentes;

  const docentesActivosDisponibles = docentesDisponibles.filter((docente) => docente?.activo !== false);
  const docentesPorId = new Map(docentes.map((docente) => [String(docente.id), docente]));
  const usuarioEsDocenteSinVinculo = (usuario) => Boolean(usuarioTieneRolDocente(usuario) && !usuarioTieneVinculoDocente(usuario));

  const usuarioTieneDocenteInactivo = (usuario) => {
    if (!usuarioTieneRolDocente(usuario)) return false;
    const docenteId = usuario?.perfil?.docente_id || usuario?.perfil?.docente;
    if (!docenteId) return false;
    const docente = docentesPorId.get(String(docenteId));
    return Boolean(docente && docente.activo === false);
  };

  const usuariosFiltrados = (() => {
    let result = showOnlyOrphans ? usuarios.filter(esUsuarioHuerfano) : usuarios;

    if (selectedCarrera) {
      result = result.filter((usuario) => obtenerCarreraIdsUsuario(usuario).includes(String(selectedCarrera)));
    }

    // Filtrar por término de búsqueda (nombre o C.I.)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((usuario) => {
        const nombre = `${usuario.first_name || ''} ${usuario.last_name || ''}`.toLowerCase();
        const ci = usuario.ci || '';
        return nombre.includes(searchLower) || ci.includes(searchLower);
      });
    }

    // Orden jerárquico: Admin → Director → Jefe Estudios → Docente
    const ordenJerarquico = {
      'iiisyp': 0,
      'director': 1,
      'jefe_estudios': 2,
      'docente': 3
    };

    result = [...result].sort((a, b) => {
      const rolA = a.perfil?.rol || 'docente';
      const rolB = b.perfil?.rol || 'docente';
      const ordenA = ordenJerarquico[rolA] ?? 99;
      const ordenB = ordenJerarquico[rolB] ?? 99;

      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }

      // Si mismo rol, ordenar por apellido
      const apellidoA = (a.last_name || '').toLowerCase();
      const apellidoB = (b.last_name || '').toLowerCase();
      return apellidoA.localeCompare(apellidoB, 'es', { sensitivity: 'base' });
    });

    return result;
  })();

  // Initialize form when creation starts
  useEffect(() => {
    if (isCreating) {
      if (restoringFormRef.current) {
        restoringFormRef.current = false;
        setCrearNuevoDocente(false);
        setErrors({});
        return;
      }
      
      const carreraDefault = esDirectorCarreraActual && carrerasGestionables.length === 1
        ? String(carrerasGestionables[0].id)
        : '';
      
const initialData = {
  username: '',
  email: '',
  nombre_completo: '',
  first_name: '',
  last_name: '',
  ci: '',
  rol: '',
  carrera: carreraDefault,
  docente: '',
  docente_data: null,
  password: '',
  password_confirm: '',
};
      setFormData(initialData);
      setAsignacionesExtra([]);
      setIndiceAsignacionActiva(0);
      setVinculacionRapidaDocente(false);
      setCrearNuevoDocente(false);
      setBloquearCrearNuevoDocente(false);
      setDocenteReciente(null);
      setErrors({});
    }
  }, [isCreating, user]);

  const handleToggleCreateForm = () => {
    sessionStorage.removeItem('datosEditarUsuario');
    if (isCreating) {
      setVinculacionRapidaDocente(false);
      setAsignacionesExtra([]);
      setIndiceAsignacionActiva(0);
      setBloquearCrearNuevoDocente(false);
    }
    setIsCreating(!isCreating);
    setUsuarioEditando(null); // Ensure we are not in edit mode
  };

  const triggerAddRoleButtonError = () => {
    setAddRoleButtonPulse((prev) => prev + 1);
  };

  useEffect(() => {
    if (!addRoleButtonPulse) {
      setIsAddRoleButtonPulsing(false);
      return;
    }

    setIsAddRoleButtonPulsing(false);
    const frameId = requestAnimationFrame(() => setIsAddRoleButtonPulsing(true));
    const timeoutId = setTimeout(() => setIsAddRoleButtonPulsing(false), ERROR_SHAKE_DURATION_MS);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [addRoleButtonPulse]);

  const abrirModalEditar = (usuario) => {
    sessionStorage.removeItem('datosEditarUsuario');
    restoringEditModalRef.current = false;
    setUsuarioEditando(usuario);
    setShowModal(true);
    setIsCreating(false); // Hide create form if it was open
  };

  const abrirDetalleUsuario = (usuario) => {
    setUsuarioDetalle(usuario);
  };

  const cerrarDetalleUsuario = () => setUsuarioDetalle(null);

  const editarDesdeDetalle = () => {
    if (!usuarioDetalle || !puedeEditarUsuario(usuarioDetalle)) return;
    const usuario = usuarioDetalle;
    cerrarDetalleUsuario();
    abrirModalEditar(usuario);
  };

  const eliminarDesdeDetalle = () => {
    if (!usuarioDetalle || !puedeEliminarUsuarios() || usuarioDetalle.is_superuser) return;
    const usuario = usuarioDetalle;
    cerrarDetalleUsuario();
    handleEliminar(usuario);
  };

  const handleToggleActivo = (usuario) => {
    if (usuario?.is_superuser) {
      toast.error('El Super Admin no puede desactivarse');
      return;
    }
    setUsuarioToToggle(usuario);
    setShowToggleModal(true);
  };

  const handleEliminar = (usuario) => {
    setUsuarioToDelete(usuario);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setUsuarioToDelete(null);
    setDeleteConfirmText('');
  };

  const confirmarEliminar = async () => {
    if (!usuarioToDelete) return;
    if (deleteConfirmText !== usuarioToDelete.username) {
      toast.error('Debes escribir exactamente el nombre de usuario para confirmar');
      return;
    }
    try {
      await api.delete(`/usuarios/${usuarioToDelete.id}/`);
      toast.success('Usuario eliminado con éxito');
      setUsuarios((prev) => prev.filter((usuario) => usuario.id !== usuarioToDelete.id));
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      console.log('Error response:', err.response);
      console.log('Error data:', err.response?.data);

      // Capturar mensaje de error específico del backend
      let errorMessage = 'Error al eliminar el usuario';

      if (err.response && err.response.data) {
        // Backend devolvió un error específico
        if (typeof err.response.data === 'object') {
          // Puede ser { error: 'mensaje' } o { detail: 'mensaje' }
          errorMessage = err.response.data.error || err.response.data.detail || JSON.stringify(err.response.data);
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      console.error('Error message:', errorMessage);
      toast.error(errorMessage);
    }
  };
  // --- FORM LOGIC FOR INLINE CREATION ---
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const normalizedValue = name === 'ci'
        ? String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)
        : value;
      const updated = { ...prev, [name]: normalizedValue };

      if (name === 'nombre_completo') {
        const partes = normalizedValue.trim().split(/\s+/).filter(Boolean);
        updated.first_name = partes[0] || '';
        updated.last_name = partes.slice(1).join(' ');
      }

      // Auto-generar contraseña por defecto al escribir el username
      if (name === 'username') {
        updated.password = normalizedValue + 'UABJB';
        updated.password_confirm = normalizedValue + 'UABJB';
      }

      if (name === 'docente' && value) {
        updated.docente_data = null;
      }

      if (name === 'carrera' && updated.docente_data) {
        updated.docente_data = {
          ...updated.docente_data,
          carrera: value,
        };
      }

      return updated;
    });

    if (name === 'docente' && value) {
      setCrearNuevoDocente(false);
    }

    // Limpia el error del campo al escribir para feedback inmediato
    setErrors((prev) => {
      const next = { ...prev };
      if (name === 'nombre_completo') {
        delete next.nombre_completo;
        delete next.first_name;
        delete next.last_name;
      } else {
        if (!prev?.[name]) return prev;
        delete next[name];
      }
      // Limpiar error de asignaciones al cambiar carrera
      if (name === 'carrera') {
        delete next.asignaciones;
      }
      return next;
    });
  };

  const handleRolChange = (e) => {
    if (vinculacionRapidaDocente) return;

    const newRol = e.target.value;

    setErrors((prev) => {
      const next = { ...prev };
      next.rol = null;
      next.carrera = null;
      next.docente = null;
      // Limpiar errores de asignaciones al cambiar rol
      delete next.asignaciones;
      return next;
    });

    // REFATOR: Preservar datos del docente si el rol 'docente' sigue activo
    // en alguna asignación secundaria (asignacionesExtra). Esto permite al
    // operador cambiar el orden de los roles (ej. pasar Docente de principal
    // a secundario) sin perder la información del docente ya ingresada.
    const docenteActivoEnSecundaria = asignacionesExtra.some(
      (item) => String(item.rol || '').trim() === 'docente'
    );
    const newRolEsDocente = newRol === 'docente';
    const conservarDatosDocente = newRolEsDocente || docenteActivoEnSecundaria;

    setFormData(prev => ({
      ...prev,
      rol: newRol,
      carrera: prev.carrera,
      docente: conservarDatosDocente ? prev.docente : '',
      docente_data: conservarDatosDocente ? prev.docente_data : null,
    }));

    // Solo desactivar la creación/vinculación de docente si el rol docente
    // ya no está presente en NINGUNA asignación (ni principal ni secundaria).
    if (!conservarDatosDocente) {
      setCrearNuevoDocente(false);
      setVinculacionRapidaDocente(false);
    }
  };

  const handleCrearNuevoDocente = () => {
    // 🔗 Al marcar checkbox, ir a /fondo-tiempo/docentes y abrir modal
    // Guardar datos del formulario en sessionStorage para recuperarlos al volver
    sessionStorage.removeItem('vincularDocentePendiente');
    sessionStorage.setItem('datosCrearUsuario', JSON.stringify(formData));
    const apellidos = (formData.last_name || '').trim().split(/\s+/).filter(Boolean);
    sessionStorage.setItem('datosCrearDocente', JSON.stringify({
      nombres: formData.first_name || '',
      apellido_paterno: apellidos[0] || '',
      apellido_materno: apellidos.slice(1).join(' '),
      carrera: formData.carrera || '',
      nombre_completo: formData.nombre_completo || `${formData.first_name || ''} ${formData.last_name || ''}`.trim(),
      ci: '',
      telefono: '',
    }));
    sessionStorage.setItem('flujoDocenteDesdeUsuarios', 'crear_usuario');
    sessionStorage.setItem('abrirModalDesdeUsuarios', 'true');
    // Marcar para abrir modal al volver
    setAbrirModalAlVolver(true);
    navigate('/fondo-tiempo/docentes');
  };

  const handleAsignacionChange = (index, field, value) => {
    // Solo actualizamos el valor sin validación en tiempo real
    // La validación ocurre solo en handleSubmit
    setAsignacionesExtra((prev) => {
      if (index !== 0) return prev;
      return prev.map((item, itemIndex) => (itemIndex !== index ? item : { ...item, [field]: value }));
    });

    // Limpiar error de asignaciones cuando se edita la segunda asignación
    setErrors((prev) => {
      if (prev?.asignaciones) {
        const next = { ...prev };
        delete next.asignaciones;
        return next;
      }
      return prev;
    });
  };

  const handleRolSeleccionActual = (e) => {
    if (indiceAsignacionActiva === 0) {
      handleRolChange(e);
      return;
    }

    const newRol = e.target.value;
    handleAsignacionChange(0, 'rol', newRol);
    setErrors((prev) => ({
      ...prev,
      rol: null,
      carrera: null,
      asignaciones: null,
      docente: null,
    }));
  };

  const handleCarreraSeleccionActual = (e) => {
    if (indiceAsignacionActiva === 0) {
      handleChange(e);
      return;
    }

    const newCarrera = e.target.value;
    handleAsignacionChange(0, 'carrera', newCarrera);
    setErrors((prev) => ({
      ...prev,
      rol: null,
      carrera: null,
      asignaciones: null,
    }));
  };

  const MAX_ASIGNACIONES_TOTAL = 2;
  const totalAsignaciones = 1 + asignacionesExtra.length;
  const primeraAsignacionCompleta = Boolean(
    String(formData.rol || '').trim() && String(formData.carrera || '').trim()
  );
  const puedeAgregarAsignacion = primeraAsignacionCompleta && totalAsignaciones < MAX_ASIGNACIONES_TOTAL;

  const agregarAsignacion = () => {
    if (!puedeAgregarAsignacion) return;
    setAsignacionesExtra((prev) => {
      if (prev.length >= 1) return prev;
      return [...prev, { rol: '', carrera: '' }];
    });
    setIndiceAsignacionActiva(1);
    setTimeout(() => {
      rolDropdownRef.current?.open?.();
      carreraDropdownRef.current?.open?.();
    }, 0);
  };

  const eliminarAsignacion = (index) => {
    setAsignacionesExtra((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setIndiceAsignacionActiva(0);
    // Limpiar errores de asignaciones cuando se elimina la segunda asignación
    setErrors((prev) => {
      const next = { ...prev };
      delete next.asignaciones;
      return next;
    });
  };

  // --- Transfer List de Roles y Carreras ---
  const rolesAsignadosLista = [
    { rol: formData.rol || '', carrera: formData.carrera || '' },
    ...asignacionesExtra,
  ].filter((item) => String(item.rol || '').trim());

  // Flujo secuencial: si hay una asignación pendiente (sin carrera), bloquear nuevas.
  // Evita acumular filas vacías que deforman el modal verticalmente.
  const hayAsignacionPendiente = rolesAsignadosLista.some((item) => !String(item.carrera || '').trim());

  const rolesAsignadosSet = new Set(rolesAsignadosLista.map((item) => item.rol));
  // Catálogo maestro permanente: la tabla izquierda SIEMPRE muestra todos los roles.
  // Esto permite reutilizar un mismo rol en distintas carreras (ej. Docente en Carrera A y B),
  // indispensable para el doble rol y la asignación múltiple de un docente.
  // Los roles ya asignados se marcan con un badge visual pero siguen siendo seleccionables.
  const rolesDisponiblesLista = roles;

  // ============================================================
  // VALIDACIÓN EN CALIENTE — Reglas UABJB de Fondo de Tiempo
  // ============================================================
  // Centraliza las 4 reglas de negocio para que se evalúen EN EL MOMENTO
  // en que se asigna una combinación (rol + carrera), no al final.
  // Retorna { valida: true } o { valida: false, mensaje: '...' }
  const validarAsignacionEnCaliente = (nuevoRol, nuevaCarrera, excluirIndex = -1) => {
    const rolTrim = String(nuevoRol || '').trim();
    const carreraTrim = String(nuevaCarrera || '').trim();

    // No validar si la carrera aún no se ha seleccionado (la regla se aplica al asignar carrera)
    if (!rolTrim || !carreraTrim) return { valida: true };

    // Construir snapshot de todas las asignaciones actuales (excluyendo el index que se edita)
    const todasAsignaciones = [];
    if (excluirIndex !== 0 && String(formData.rol || '').trim()) {
      todasAsignaciones.push({ rol: String(formData.rol).trim(), carrera: String(formData.carrera || '').trim() });
    }
    asignacionesExtra.forEach((item, i) => {
      const idx = i + 1;
      if (idx !== excluirIndex && String(item.rol || '').trim()) {
        todasAsignaciones.push({ rol: String(item.rol).trim(), carrera: String(item.carrera || '').trim() });
      }
    });

    // --- Regla 1: CONTROL DE DUPLICADOS IDÉNTICOS ---
    const existeDuplicado = todasAsignaciones.some(
      (item) => item.rol === rolTrim && item.carrera === carreraTrim
    );
    if (existeDuplicado) {
      return { valida: false, mensaje: MENSAJE_DUPLICADO };
    }

    const esRolMando = ROLES_MANDO_UABJB.includes(rolTrim);

    // --- Regla 3: EXCLUSIVIDAD DE AUTORIDAD ---
    // No se puede tener un cargo de autoridad (Director/Jefe) en carreras DIFERENTES.
    if (esRolMando) {
      const autoridadEnOtraCarrera = todasAsignaciones.some(
        (item) =>
          ROLES_MANDO_UABJB.includes(item.rol) &&
          item.carrera !== carreraTrim
      );
      if (autoridadEnOtraCarrera) {
        return { valida: false, mensaje: MENSAJE_AUTORIDAD_MULTIPLE };
      }
    }

    // --- Regla 4: CONFLICTO DE ROLES EN LA MISMA CARRERA ---
    // No se puede ser Director Y Jefe de Estudios de la misma carrera simultáneamente.
    if (esRolMando) {
      const conflictoMismaCarrera = todasAsignaciones.some(
        (item) =>
          ROLES_MANDO_UABJB.includes(item.rol) &&
          item.rol !== rolTrim &&
          item.carrera === carreraTrim
      );
      if (conflictoMismaCarrera) {
        return { valida: false, mensaje: MENSAJE_CONFLICTO_AUTORIDAD };
      }
    }

    // --- Regla 5: DEDICACIÓN EXCLUSIVA (mando + docente en misma carrera) ---
    // La carga docente de un rol de mando debe pertenecer obligatoriamente a su
    // misma carrera asignada. No puede haber Docente en Carrera B si hay Director en Carrera A.
    if (rolTrim === 'docente') {
      const mandoEnOtraCarrera = todasAsignaciones.some(
        (item) => ROLES_MANDO_UABJB.includes(item.rol) && item.carrera !== carreraTrim
      );
      if (mandoEnOtraCarrera) {
        return { valida: false, mensaje: MENSAJE_DOCENTE_OTRA_CARRERA };
      }
    }
    if (esRolMando) {
      const docenteEnOtraCarrera = todasAsignaciones.some(
        (item) => item.rol === 'docente' && item.carrera !== carreraTrim
      );
      if (docenteEnOtraCarrera) {
        return { valida: false, mensaje: MENSAJE_DOCENTE_OTRA_CARRERA };
      }
    }

    return { valida: true };
  };

  const moverRolDerecha = (rolValue) => {
    if (vinculacionRapidaDocente || !rolValue) return;
    setErrors((prev) => ({ ...prev, rol: null, carrera: null, asignaciones: null }));

    // --- Flujo secuencial obligatorio ---
    // No se permite pasar un nuevo rol si existe una asignación pendiente (sin carrera).
    // Esto mantiene el modal compacto y obliga al operador a completar la carrera actual.
    if (hayAsignacionPendiente) {
      toast.error(MENSAJE_CARRERA_PENDIENTE, { className: 'toast-brinco' });
      setErrors((prev) => ({ ...prev, rol: [MENSAJE_CARRERA_PENDIENTE] }));
      pulseFieldErrors(['rol']);
      setSelectedRoleLeft(null);
      return;
    }

    // --- Candado estricto: UN SOLO cargo de autoridad por usuario ---
    // La normativa UABJB prohíbe tener Director Y Jefe simultáneamente, incluso
    // con carrera vacía. Se evalúa en el clic de la flecha →, frenando ANTES de
    // insertar la fila. Esto evita acumular basura visual en la tabla derecha.
    if (ROLES_MANDO_UABJB.includes(rolValue)) {
      const yaTieneMando = rolesAsignadosLista.some((item) => ROLES_MANDO_UABJB.includes(item.rol));
      if (yaTieneMando) {
        toast.error(MENSAJE_AUTORIDAD_UNICA, { className: 'toast-brinco' });
        setErrors((prev) => ({ ...prev, rol: [MENSAJE_AUTORIDAD_UNICA] }));
        pulseFieldErrors(['rol']);
        setSelectedRoleLeft(null);
        return;
      }
    }

    // --- Regla 2: LÍMITE DE ASIGNACIONES (Máximo 2) ---
    const totalActual = (formData.rol ? 1 : 0) + asignacionesExtra.length;
    if (totalActual >= MAX_ASIGNACIONES_TOTAL) {
      toast.error(MENSAJE_LIMITE_ASIGNACIONES, { className: 'toast-brinco' });
      setErrors((prev) => ({ ...prev, rol: [MENSAJE_LIMITE_ASIGNACIONES] }));
      pulseFieldErrors(['rol']);
      setSelectedRoleLeft(null);
      return;
    }

    if (!formData.rol) {
      setFormData((prev) => ({ ...prev, rol: rolValue, carrera: '' }));
      setExpandedCarreraRoles((prev) => ({ ...prev, 0: true }));
    } else if (asignacionesExtra.length === 0) {
      setAsignacionesExtra([{ rol: rolValue, carrera: '' }]);
      setExpandedCarreraRoles((prev) => ({ ...prev, 1: true }));
    } else {
      toast.error(MENSAJE_LIMITE_ASIGNACIONES, { className: 'toast-brinco' });
      setErrors((prev) => ({ ...prev, rol: [MENSAJE_LIMITE_ASIGNACIONES] }));
      pulseFieldErrors(['rol']);
    }
    setSelectedRoleLeft(null);
  };

  const moverRolIzquierda = (index) => {
    if (vinculacionRapidaDocente) return;
    setErrors((prev) => ({ ...prev, rol: null, carrera: null, asignaciones: null }));
    if (index === 0) {
      if (asignacionesExtra.length > 0) {
        const extra = asignacionesExtra[0];
        setFormData((prev) => ({ ...prev, rol: extra.rol, carrera: extra.carrera }));
        setAsignacionesExtra([]);
        setExpandedCarreraRoles((prev) => {
          const next = {};
          if (prev[1]) next[0] = true;
          return next;
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          rol: '',
          carrera: '',
          docente: '',
          docente_data: null,
        }));
        setExpandedCarreraRoles((prev) => {
          const next = { ...prev };
          delete next[0];
          return next;
        });
      }
    } else {
      setAsignacionesExtra((prev) => prev.filter((_, i) => i !== index - 1));
      setExpandedCarreraRoles((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
    setSelectedRoleRight(null);
  };

  const toggleExpandCarrera = (index) => {
    setExpandedCarreraRoles((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const asignarCarreraARol = (index, carreraValue) => {
    // Determinar el rol correspondiente a este índice
    const rolObjetivo = index === 0
      ? formData.rol
      : (asignacionesExtra[index - 1]?.rol || '');

    // --- Validación en caliente: reglas 1, 3 y 4 (UABJB) ---
    // Se evalúa la combinación COMPLETA (rol + carrera) en el momento de asignar la carrera.
    if (rolObjetivo && carreraValue) {
      const resultado = validarAsignacionEnCaliente(rolObjetivo, carreraValue, index);
      if (!resultado.valida) {
        toast.error(resultado.mensaje, { className: 'toast-brinco' });
        // Activar feedback visual en el panel derecho (Roles asignados):
        // borde rojo + efecto rebote + resaltado de la fila conflictiva.
        setFilaConflictoIndex(index);
        setErrors((prev) => ({ ...prev, asignaciones: [resultado.mensaje] }));
        setRightPanelPulse((p) => p + 1);
        // Limpiar el marcador de fila conflictiva tras la animación
        setTimeout(() => setFilaConflictoIndex(null), 300);
        return;
      }
    }

    setErrors((prev) => {
      const next = { ...prev };
      delete next.carrera;
      delete next.asignaciones;
      delete next.rol;
      return next;
    });
    if (index === 0) {
      setFormData((prev) => ({ ...prev, carrera: carreraValue }));
    } else {
      setAsignacionesExtra((prev) =>
        prev.map((item, i) => (i === index - 1 ? { ...item, carrera: carreraValue } : item))
      );
    }

    // Cerrar el dropdown de carrera inmediatamente tras la selección
    setExpandedCarreraRoles((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // REGLA GLOBAL: limpia el error de un campo al recibir focus/clic.
  const clearFieldError = (fieldName) => {
    setErrors((prev) => {
      if (!prev?.[fieldName]) return prev;
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  };

  const handleSubmit = async (e) => {
    // REGLA GLOBAL: detener el comportamiento por defecto para evitar parpadeo/re-render.
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }

    const validationErrors = {};
    const camposFaltantes = [];
    const usernameNormalizado = String(formData.username || '').trim();
    const nombreCompletoNormalizado = String(formData.nombre_completo || `${formData.first_name || ''} ${formData.last_name || ''}`).trim();
    const emailNormalizado = String(formData.email || '').trim();
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado);
    const rolNormalizado = String(formData.rol || '').trim();
    const carreraNormalizada = String(formData.carrera || '').trim();

    if (!usernameNormalizado) {
      validationErrors.username = 'Debe ingresar un usuario.';
      camposFaltantes.push('Usuario');
    }

    if (mostrarNombreCompletoCreacion && !nombreCompletoNormalizado) {
      validationErrors.nombre_completo = 'Debe ingresar nombre y apellido.';
      camposFaltantes.push('Nombre completo');
    }

    if (!emailNormalizado) {
      validationErrors.email = 'No debe estar vacío.';
      camposFaltantes.push('Correo institucional');
    } else if (!emailValido) {
      validationErrors.email = 'Ingresa un correo electrónico válido.';
      camposFaltantes.push('Correo institucional');
    }

    if (!rolNormalizado) {
      validationErrors.rol = 'Debe seleccionar un rol.';
      camposFaltantes.push('Rol');
    }

    if (!carreraNormalizada) {
      validationErrors.carrera = 'Debe seleccionar una carrera.';
      camposFaltantes.push('Carrera');
    }

    const ciNormalizado = (formData.ci || '').trim();
    if (mostrarCiCreacion && !ciNormalizado) {
      validationErrors.ci = ['El C.I. es obligatorio.'];
      camposFaltantes.push('C.I.');
    }

    if (Object.keys(validationErrors).length > 0) {
      pulseFieldErrors(Object.keys(validationErrors));
      setErrors(validationErrors);
      const faltanSoloRolYCarrera = !rolNormalizado && !carreraNormalizada && Object.keys(validationErrors).length === 2;
      showToastOnce(
        faltanSoloRolYCarrera
          ? 'Debes seleccionar un rol y una carrera para poder continuar.'
          : 'Completa los campos obligatorios marcados en rojo.'
      );
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const asignacionesSeleccionadas = [
      { rol: formData.rol, carrera: formData.carrera },
      ...asignacionesExtra,
    ];

    const combinacionKey = (asignacion) => `${String(asignacion.rol || '').trim()}::${String(asignacion.carrera || '').trim()}`;

    if (!formData.rol || !carreraNormalizada) {
      pulseFieldErrors(['rol', 'carrera']);
      setErrors((prev) => ({
        ...prev,
        rol: !formData.rol ? ['Debe seleccionar un rol.'] : prev.rol,
        carrera: !carreraNormalizada ? ['Debe seleccionar una carrera.'] : prev.carrera,
      }));
      toast.error('La primera selección de rol y carrera es obligatoria.');
      setIsSubmitting(false);
      return;
    }

    if (asignacionesExtra.length > 0) {
      const segunda = asignacionesExtra[0];
      const segundaRol = String(segunda?.rol || '').trim();
      const segundaCarrera = String(segunda?.carrera || '').trim();

      if (!segundaRol || !segundaCarrera) {
        pulseFieldErrors(['rol', 'carrera', 'asignaciones']);
        setErrors((prev) => ({
          ...prev,
          asignaciones: ['La segunda selección de rol y carrera es obligatoria cuando está habilitada.'],
        }));
        toast.error('Completa la segunda selección de rol y carrera.');
        setIsSubmitting(false);
        return;
      }
    }

    const primeraAsignacion = {
      rol: String(formData.rol || '').trim(),
      carrera: String(formData.carrera || '').trim(),
    };
    const segundaAsignacion = asignacionesExtra[0]
      ? {
          rol: String(asignacionesExtra[0].rol || '').trim(),
          carrera: String(asignacionesExtra[0].carrera || '').trim(),
        }
      : null;
    const esRolMando = (rol) => ['director', 'jefe_estudios'].includes(String(rol || '').trim());

    if (segundaAsignacion) {
      const mismaCombinacion = primeraAsignacion.rol === segundaAsignacion.rol && primeraAsignacion.carrera === segundaAsignacion.carrera;
      if (mismaCombinacion) {
        // Safety net: la validación en caliente debería haber prevenido esto
        toast.error(MENSAJE_DUPLICADO, { className: 'toast-brinco' });
        setIsSubmitting(false);
        return;
      }

      const mismaCarrera = primeraAsignacion.carrera === segundaAsignacion.carrera;
      const primeraMando = esRolMando(primeraAsignacion.rol);
      const segundaMando = esRolMando(segundaAsignacion.rol);

      // Safety net: DOS roles de mando (Director + Jefe) — prohibido por normativa UABJB
      if (primeraMando && segundaMando) {
        toast.error(MENSAJE_AUTORIDAD_UNICA, { className: 'toast-brinco' });
        setIsSubmitting(false);
        return;
      }

      // Safety net: Dedicación exclusiva (docente + mando en carreras distintas)
      const hayDocente = primeraAsignacion.rol === 'docente' || segundaAsignacion.rol === 'docente';
      const hayMando = primeraMando || segundaMando;
      if (hayDocente && hayMando && !mismaCarrera) {
        toast.error(MENSAJE_DOCENTE_OTRA_CARRERA, { className: 'toast-brinco' });
        setIsSubmitting(false);
        return;
      }
    }

    const combinaciones = asignacionesSeleccionadas.map(combinacionKey);
    // Solo validar duplicados si hay más de una asignación
    if (asignacionesSeleccionadas.length > 1 && new Set(combinaciones).size !== combinaciones.length) {
      toast.error(MENSAJE_DUPLICADO, { className: 'toast-brinco' });
      setIsSubmitting(false);
      return;
    }

    const rolPrincipal = String(formData.rol || '').trim();
    const docenteSeleccionado = formData.docente || '';
    const docenteDataCreacion = formData.docente_data || null;

    let payload = {
      username: formData.username,
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      rol: rolPrincipal,
      password: formData.password,
      password_confirm: formData.password_confirm,
    };

    // Si el rol PRINCIPAL es docente, enviamos el docente/docente_data al nivel superior del payload
    if (rolPrincipal === 'docente') {
      if (docenteDataCreacion) {
        payload.docente_data = docenteDataCreacion;
      } else if (docenteSeleccionado) {
        payload.docente = docenteSeleccionado;
      }
    }

    // Mapear asignaciones extra INCLUYENDO docente/docente_data cuando la asignación secundaria sea de tipo docente.
    // FIX: Antes se descartaban estos campos, lo que provocaba que el backend no resolviera el docente
    // cuando venía como asignación secundaria (doble rol con rol principal no-docente).
    payload.asignaciones = asignacionesExtra.map((item) => {
      const asignacion = {
        rol: String(item.rol || '').trim(),
        carrera: String(item.carrera || '').trim(),
      };
      if (asignacion.rol === 'docente') {
        if (docenteDataCreacion) {
          asignacion.docente_data = docenteDataCreacion;
        } else if (docenteSeleccionado) {
          asignacion.docente = docenteSeleccionado;
        }
      }
      return asignacion;
    });

    payload.carrera = carreraNormalizada;

    // Enviar CI siempre
    payload.ci = ciNormalizado;

    try {
      const response = await api.post('/usuarios/', payload);
      toast.success('Usuario creado correctamente');
      setUsuarios((prev) => [response.data, ...prev]);
      setIsCreating(false);
      setAsignacionesExtra([]);
      setIndiceAsignacionActiva(0);
      sessionStorage.removeItem('docenteTemporalDesdeUsuarios');
      sessionStorage.removeItem('flujoDocenteDesdeUsuarios');
      if (volverANuevoDocente) {
        sessionStorage.setItem('datosCrearUsuario', JSON.stringify({
          ...formData,
          ci: ciNormalizado,
          carrera: carreraNormalizada,
        }));
        sessionStorage.setItem('abrirModalNuevoDocente', 'true');
        if (response?.data?.id) {
          sessionStorage.setItem('autoSeleccionarUsuarioDesdeGestion', JSON.stringify({
            ...response.data,
            _ciRetornoDocente: ciNormalizado,
            _carreraRetornoDocente: carreraNormalizada,
          }));
        }
        navigate('/fondo-tiempo/docentes');
        return;
      }
    } catch (err) {
      console.error('Error al crear usuario:', err.response);
      const apiErrors = err.response?.data;
      if (apiErrors) {
        if (typeof apiErrors === 'object') {
          const backendMessage = getBackendErrorMessage(apiErrors, '');
          const esErrorDeCargoPorCarrera =
            backendMessage.includes('ya tiene un Administrador asignado')
            || backendMessage.includes('ya tiene un Director asignado')
            || backendMessage.includes('ya tiene un Jefe de Estudios asignado');

          const fieldsToPulse = esErrorDeCargoPorCarrera
            ? [...new Set([...Object.keys(apiErrors), 'rol'])]
            : Object.keys(apiErrors);
          pulseFieldErrors(fieldsToPulse);
          setErrors(
            esErrorDeCargoPorCarrera
              ? { ...sanitizeApiErrors(apiErrors), rol: [backendMessage] }
              : sanitizeApiErrors(apiErrors)
          );
        }
        const ciMsg = Array.isArray(apiErrors?.ci)
          ? apiErrors.ci[0]
          : (typeof apiErrors?.ci === 'string' ? apiErrors.ci : null);
        const docenteMsg = Array.isArray(apiErrors?.docente)
          ? apiErrors.docente[0]
          : (typeof apiErrors?.docente === 'string' ? apiErrors.docente : null);
        if (ciMsg) {
          toast.error(`C.I.: ${ciMsg}`);
        } else if (docenteMsg) {
          toast.error(docenteMsg);
        } else if (typeof apiErrors === 'string' && apiErrors.includes('<!DOCTYPE')) {
          // El backend devolvió HTML (error 500 de Django), no un ValidationError JSON.
          // Ya no enmascaramos el error con un mensaje falso de "docente": informamos al
          // operador que ocurrió un fallo del servidor y lo registramos en consola.
          console.error('Error 500 del servidor (HTML en lugar de JSON):', err.response?.status, err.response?.statusText);
          toast.error('Error interno del servidor. Revise la consola o contacte al administrador.');
        } else {
          toast.error(getBackendErrorMessage(apiErrors, 'Ocurrió un error inesperado al crear el usuario.'));
        }
      } else {
        toast.error('Ocurrió un error inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const ciError = Array.isArray(errors?.ci)
    ? errors.ci[0]
    : (typeof errors?.ci === 'string' ? errors.ci : null);

  const docenteError = Array.isArray(errors?.docente)
    ? errors.docente[0]
    : (typeof errors?.docente === 'string' ? errors.docente : null);

  const nombreCompletoError = Array.isArray(errors?.nombre_completo)
    ? errors.nombre_completo[0]
    : (typeof errors?.nombre_completo === 'string'
      ? errors.nombre_completo
      : (Array.isArray(errors?.first_name)
        ? errors.first_name[0]
        : (Array.isArray(errors?.last_name)
          ? errors.last_name[0]
          : (typeof errors?.first_name === 'string'
            ? errors.first_name
            : (typeof errors?.last_name === 'string' ? errors.last_name : null)))));

  const obtenerRolLabel = (rolValue) => roles.find((item) => item.value === rolValue)?.label || rolValue || 'Sin rol';
  const obtenerCarreraLabel = (carreraValue) => carreras.find((item) => String(item.id) === String(carreraValue))?.nombre || 'Sin carrera';

  const asignacionesActivas = [
    { rol: formData.rol || '', carrera: formData.carrera || '' },
    ...asignacionesExtra,
  ];
  const crearMarcadoresSeleccion = (campo) => asignacionesActivas.reduce((acc, item, index) => {
    const key = String(item?.[campo] || '').trim();
    if (!key) return acc;
    acc[key] = [...(acc[key] || []), index + 1];
    return acc;
  }, {});
  const rolSelectionMarkers = crearMarcadoresSeleccion('rol');
  const carreraSelectionMarkers = crearMarcadoresSeleccion('carrera');
  const rolSeleccionCreacion = indiceAsignacionActiva === 0
    ? String(formData.rol || '').trim()
    : String(asignacionesExtra[0]?.rol || '').trim();
  const mostrarCarreraCreacion = Boolean(rolSeleccionCreacion) || indiceAsignacionActiva === 1;
  const mostrarNombreCompletoCreacion = true;
  const mostrarCiCreacion = true;

  // REFACTOR: Detectar si el rol 'docente' está presente en CUALQUIER asignación
  // (principal o secundaria). Esto unifica la captura de datos del docente para que
  // se muestre y asocie correctamente sin importar si el docente es rol principal
  // (formData) o secundario (asignacionesExtra). Permite reordenar roles sin perder
  // la información del docente ya ingresada.
  const hayRolDocenteEnAsignaciones = String(formData.rol || '').trim() === 'docente'
    || asignacionesExtra.some((item) => String(item.rol || '').trim() === 'docente');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  const puedeGestionarUsuarios = () => esSuperuserActual || esDirectorCarreraActual;
  const puedeEliminarUsuarios = () => esSuperuserActual;
  const puedeEditarUsuario = (usuario) => {
    if (!puedeGestionarUsuarios() || usuario?.is_superuser) return false;
    if (esSuperuserActual) return true;
    if (!usuarioPerteneceACarrerasGestionables(usuario)) return false;
    return !obtenerRolesUsuario(usuario).includes('director');
  };
  const puedeCambiarEstadoUsuario = (usuario) => puedeEditarUsuario(usuario);
  const obtenerNombreUsuario = (usuario) => ((usuario?.first_name || usuario?.last_name)
    ? `${(usuario.first_name || '').trim()} ${(usuario.last_name || '').trim()}`.trim()
    : (usuario?.nombre_completo || '-'));
  const obtenerEstadoUsuario = (usuario) => {
    if (!usuario) return '-';
    const docenteSinVinculo = usuarioEsDocenteSinVinculo(usuario);
    if (usuario.is_superuser) return 'Protegido';
    if (docenteSinVinculo) return 'Sin vinculo docente';
    return usuario.is_active ? 'Activo' : 'Inactivo';
  };
  const obtenerTextoCarrerasDetalleUsuario = (usuario) => {
    if (!usuario) return 'Sin carrera';

    const nombres = [];
    const agregarCarrera = (nombre, id, codigo) => {
      const carreraCatalogo = id
        ? carreras.find((carrera) => String(carrera.id) === String(id))
        : carreras.find((carrera) => String(carrera.codigo) === String(codigo));
      const texto = String(nombre || carreraCatalogo?.nombre || codigo || '').trim();
      if (texto) nombres.push(texto);
    };

    agregarCarrera(
      usuario?.perfil?.carrera_nombre || usuario?.perfil?.carrera?.nombre,
      usuario?.perfil?.carrera,
      usuario?.perfil?.carrera?.codigo || usuario?.carrera_codigo
    );

    if (Array.isArray(usuario.asignaciones)) {
      usuario.asignaciones
        .filter((item) => item?.activo !== false)
        .forEach((item) => {
          agregarCarrera(item?.carrera_nombre, item?.carrera, item?.carrera_codigo);
        });
    }

    const carrerasUnicas = [...new Set(nombres)];
    return carrerasUnicas.length > 0 ? carrerasUnicas.join(' / ') : 'Sin carrera';
  };

  return (
    <div className="gestion-usuarios-page min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="gestion-usuarios-shell max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="gestion-usuarios-header bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="gestion-usuarios-header-row flex items-center justify-between">
            <div className="gestion-usuarios-title-block">
              <h1 className="gestion-usuarios-title text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Gestión de Usuarios
              </h1>
              <p className="gestion-usuarios-subtitle text-slate-700 dark:text-slate-300 mt-1 italic">
                Administración de cuentas y permisos
              </p>
            </div>
            <div className="gestion-usuarios-controls flex items-center gap-4">
              <SearchInput value={searchTerm} onChange={setSearchTerm} />
              <div className="gestion-usuarios-filter w-48">
                <SimpleDropdown
                  label=""
                  value={selectedCarrera}
                  onChange={setSelectedCarrera}
                  options={carrerasGestionables.map(c => ({ value: c.id, label: c.nombre }))}
                  placeholder="Carreras"
                  clearOnToggle
                />
              </div>
              {puedeGestionarUsuarios() && (
                <button
                  onClick={handleToggleCreateForm}
                  className="gestion-usuarios-create-btn px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center gap-2"
                >
                  <span>{isCreating ? '➖' : '➕'}</span>
                  {isCreating ? 'Cancelar Creación' : 'Crear Usuario'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MODAL DE CREACIÓN DE USUARIO */}
        {isCreating && createPortal((
          <div
            className={`fixed top-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${crearNuevoDocente && hayRolDocenteEnAsignaciones ? '!justify-center' : ''}`}
            style={{ left: hasSidebar ? (sidebarCollapsed ? '5rem' : '18rem') : '0' }}
          >
            <div className={`flex items-center justify-center w-full h-full ${crearNuevoDocente && hayRolDocenteEnAsignaciones ? 'gap-6' : ''}`}>
              {/* Modal Usuario - mantiene su tamaño original */}
              <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl animate-fade-in transition-all duration-300 max-h-[90vh] flex flex-col ${crearNuevoDocente && hayRolDocenteEnAsignaciones ? 'max-w-5xl w-full' : 'max-w-5xl w-full mx-4'}`}>
                {/* Header azul */}
                <div className="bg-[#2C4AAE] dark:bg-[#1a3a8a] px-6 py-4 rounded-t-2xl">
                  <h2 className="text-xl font-bold text-white">
                    Crear Nuevo Usuario
                  </h2>
                </div>

              <form onSubmit={handleSubmit} noValidate>
                  <div className="p-6 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Fila 1: Usuario - Nombre completo */}
                    <InputField label="Usuario" name="username" value={formData.username || ''} onChange={handleChange} clearError={clearFieldError} error={errors.username} required pulse={errorPulse.username || 0} />
                    {mostrarNombreCompletoCreacion ? (
                      <InputField
                        label="Nombre completo"
                        name="nombre_completo"
                        value={formData.nombre_completo || ''}
                        onChange={handleChange}
                        clearError={clearFieldError}
                        error={nombreCompletoError}
                        required
                        pulse={errorPulse.nombre_completo || errorPulse.first_name || errorPulse.last_name || 0}
                      />
                    ) : (
                      <div />
                    )}

                    <div className="md:col-span-2 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-semibold">
                          Contrasena por defecto
                        </span>
                        <span className="font-mono font-black tracking-wide" aria-live="polite">
                          {formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                        El usuario debera cambiarla al iniciar sesion.
                      </p>
                    </div>

                    {/* Transfer List de Roles y Carreras */}
                    <div className="md:col-span-2">
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                        {/* Panel izquierdo: Roles disponibles */}
                        <div className={`rounded-2xl border-2 bg-white dark:bg-slate-800 flex flex-col transition-colors ${errors?.rol ? `${ERROR_FIELD_BORDER_CLASS}` : 'border-slate-300 dark:border-slate-600'} ${leftPanelPulsing ? ERROR_MOTION_CLASS : ''}`}>
                          <div className="px-3 py-2 border-b border-slate-300 dark:border-slate-600 rounded-t-2xl">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center uppercase tracking-wide">Roles disponibles</p>
                          </div>
                          <div className="flex-1 overflow-y-auto max-h-72 min-h-[180px]">
                            {rolesDisponiblesLista.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6 italic">No hay roles disponibles</p>
                            ) : (
                              rolesDisponiblesLista.map((rol) => {
                                const yaAsignado = rolesAsignadosSet.has(rol.value);
                                return (
                                  <button
                                    key={rol.value}
                                    type="button"
                                    onClick={() => {
                                      setSelectedRoleLeft(rol.value);
                                      setErrors((prev) => prev?.rol ? { ...prev, rol: null } : prev);
                                    }}
                                    onDoubleClick={() => moverRolDerecha(rol.value)}
                                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-b border-slate-300 dark:border-slate-700 last:border-b-0 flex items-center justify-between gap-2 ${
                                      selectedRoleLeft === rol.value
                                        ? 'bg-[#2C4AAE] text-white font-semibold'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white'
                                    }`}
                                  >
                                    <span>{rol.label}</span>
                                    {yaAsignado && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        selectedRoleLeft === rol.value
                                          ? 'bg-white/25 text-white'
                                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                      }`}>
                                        ✓ Asignado
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Flechas centrales */}
                        <div className="flex flex-col items-center justify-center gap-2 px-1">
                          <button
                            type="button"
                            onClick={() => selectedRoleLeft && moverRolDerecha(selectedRoleLeft)}
                            disabled={!selectedRoleLeft || vinculacionRapidaDocente || hayAsignacionPendiente || (rolesAsignadosLista.length >= 2)}
                            className="w-10 h-10 rounded-full bg-[#2C4AAE] text-white font-bold text-lg shadow-md hover:bg-[#1a3a8a] disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-110 flex items-center justify-center"
                            title={hayAsignacionPendiente ? 'Complete la carrera pendiente primero' : 'Asignar rol'}
                          >
                            →
                          </button>
                          <button
                            type="button"
                            onClick={() => selectedRoleRight !== null && moverRolIzquierda(selectedRoleRight)}
                            disabled={selectedRoleRight === null || vinculacionRapidaDocente}
                            className="w-10 h-10 rounded-full bg-[#2C4AAE] text-white font-bold text-lg shadow-md hover:bg-[#1a3a8a] disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-110 flex items-center justify-center"
                            title="Quitar rol"
                          >
                            ←
                          </button>
                        </div>

                        {/* Panel derecho: Roles asignados con menú extensible de Carrera */}
                        <div className={`rounded-2xl border-2 bg-white dark:bg-slate-800 flex flex-col transition-colors ${(errors?.asignaciones || errors?.rol) ? `${ERROR_FIELD_BORDER_CLASS}` : 'border-slate-300 dark:border-slate-600'} ${rightPanelPulsing ? ERROR_MOTION_CLASS : ''}`}>
                          <div className="px-3 py-2 border-b border-slate-300 dark:border-slate-600 rounded-t-2xl">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center uppercase tracking-wide">Roles asignados</p>
                          </div>
                          <div className="flex-1 overflow-y-auto max-h-80 min-h-[180px]">
                            {rolesAsignadosLista.length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6 italic">Use las flechas para asignar roles</p>
                            ) : (
                              rolesAsignadosLista.map((item, index) => (
                                <div
                                  key={`${item.rol}-${index}`}
                                  className={`border-b border-slate-300 dark:border-slate-700 last:border-b-0 ${
                                    filaConflictoIndex === index ? '!border-red-500' : ''
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setSelectedRoleRight(index)}
                                    onDoubleClick={() => moverRolIzquierda(index)}
                                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between ${
                                      filaConflictoIndex === index
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold'
                                        : selectedRoleRight === index
                                          ? 'bg-[#2C4AAE] text-white font-semibold'
                                          : 'text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white'
                                    }`}
                                  >
                                    <span>{obtenerRolLabel(item.rol)}</span>
                                    <span
                                      onClick={(e) => { e.stopPropagation(); toggleExpandCarrera(index); }}
                                      className={`cursor-pointer font-bold text-xs px-2.5 py-1 rounded-lg truncate max-w-[45%] border-2 ${
                                        item.carrera
                                          ? 'bg-[#2C4AAE] text-white border-[#2C4AAE]'
                                          : 'bg-red-50 text-red-600 border-red-500 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
                                      }`}
                                    >
                                      {item.carrera
                                        ? `${expandedCarreraRoles[index] ? '▼' : '▶'} ${obtenerCarreraLabel(item.carrera)}`
                                        : (expandedCarreraRoles[index] ? '▼ Carrera' : '▶ Carrera')}
                                    </span>
                                  </button>
                                  {expandedCarreraRoles[index] && (
                                    <div className="px-3 py-2 animate-panel-asignacion">
                                      <div className="flex justify-end">
                                        <div className="w-[70%] max-w-[260px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm max-h-40 overflow-y-auto">
                                          {carrerasGestionables.map((carrera) => (
                                            <button
                                              key={carrera.id}
                                              type="button"
                                              onClick={() => asignarCarreraARol(index, String(carrera.id))}
                                              className="w-full text-left px-3 py-1.5 text-xs border-b border-slate-300 dark:border-slate-700 last:border-b-0 text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white transition-colors"
                                            >
                                              {carrera.nombre}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Catálogo permanente: puede reusar un rol en otra carrera (ej. Docente en 2 carreras distintas). Máximo 2 asignaciones. Expanda <span className="text-[#2C4AAE] dark:text-blue-400 font-bold">Carrera</span> para asignar.
                      </p>
                    </div>

                    {/* Fila 3: Correo institucional - Cargo profesional / CI */}
                    <InputField
                      label="Correo institucional"
                      name="email"
                      type="text"
                      value={formData.email || ''}
                      onChange={handleChange}
                      clearError={clearFieldError}
                      error={errors.email}
                      required
                      pulse={errorPulse.email || 0}
                      autoComplete="email"
                      inputMode="email"
                    />

                    {mostrarCiCreacion ? (
                      <InputField
                        label="C.I."
                        name="ci"
                        type="text"
                        value={formData.ci || ''}
                        onChange={handleChange}
                        clearError={clearFieldError}
                        error={errors.ci}
                        pulse={errorPulse.ci || 0}
                        maxLength={15}
                      />
                    ) : (
                      <div />
                    )}

                    {/* Los errores de asignaciones ahora se muestran exclusivamente
                        como Toasts descriptivos en caliente (normativa UABJB),
                        eliminando el mensaje estático del pie del formulario. */}

                  </div>
                </div>

                {/* Footer con botones */}
                <div className="px-6 py-4 bg-slate-100 dark:bg-slate-700 border-t border-slate-300 dark:border-slate-600 flex justify-end gap-3 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setVinculacionRapidaDocente(false);
                      if (volverANuevoDocente) {
                        sessionStorage.setItem('abrirModalNuevoDocente', 'true');
                        navigate('/fondo-tiempo/docentes');
                      }
                    }}
                    className="px-6 py-2.5 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 transition-all"
                  >
                    {volverANuevoDocente ? 'Cancelar y volver' : 'Cancelar'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#2C4AAE] hover:bg-[#1a3a8a] transition-all disabled:opacity-50"
                  >
                    {isSubmitting
                      ? (volverANuevoDocente ? 'Guardando y volviendo...' : 'Creando...')
                      : (volverANuevoDocente ? 'Guardar y volver' : 'Crear Usuario')}
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        ), document.body)}
 
        {/* Modal for editing */}
        <ModalUsuario
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSaveSuccess={(usuarioActualizado) => {
            setShowModal(false);
            if (usuarioActualizado?.id) {
              setUsuarios((prev) => prev.map((usuario) => (
                usuario.id === usuarioActualizado.id ? usuarioActualizado : usuario
              )));
              setUsuarioEditando(usuarioActualizado);
            }
          }}
          userToEdit={usuarioEditando}
          docentes={docentes}
          carreras={carrerasGestionables}
          roles={roles}
          sidebarCollapsed={sidebarCollapsed}
          hasSidebar={hasSidebar}
          currentUser={user}
        />

        <div className="flex justify-end">
          {hayOrfanos && (
            <button
              type="button"
              onClick={() => setShowOnlyOrphans((prev) => !prev)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all shadow-md ${
                showOnlyOrphans
                  ? 'bg-red-700 text-white border-red-800 hover:bg-red-800 dark:bg-red-700 dark:border-red-900 animate-pulse-slow'
                  : 'bg-red-600 text-white border-red-700 hover:bg-red-700 dark:bg-red-600 dark:border-red-800 animate-pulse-slow'
              }`}
            >
              {showOnlyOrphans ? '⚠️ Mostrar Todos' : '⚠️ Urgente: Ver Huérfanos'}
            </button>
          )}
        </div>
        
        {/* Tabla de usuarios */}
        <div id="fondo-usuarios-tabla" className="gestion-usuarios-table bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y-2 divide-slate-300 dark:divide-slate-700">
              <thead className="bg-blue-800 dark:bg-blue-900">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Nombre completo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    C.I.
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Carrera
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {usuariosFiltrados.map(usuario => (
                  (() => {
                    const docenteSinVinculo = usuarioEsDocenteSinVinculo(usuario);
                    const perfilDocentePendiente = usuarioTienePerfilDocentePendiente(usuario);
                    const filaInactiva = (usuario.is_active === false || (docenteSinVinculo && !perfilDocentePendiente)) && !usuario.is_superuser;
                    const textoFila = filaInactiva ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300';
                    const textoPrincipal = filaInactiva ? 'font-bold text-red-700 dark:text-red-300' : 'font-bold text-slate-800 dark:text-white';
                    return (
                  <tr
                    key={usuario.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => abrirDetalleUsuario(usuario)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        abrirDetalleUsuario(usuario);
                      }
                    }}
                    className={`transition-colors ${
                      !filaInactiva
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                        : 'bg-red-200/90 dark:bg-red-950/35 hover:bg-red-300/80 dark:hover:bg-red-900/45'
                    }`}
                  >
                    <td data-label="Usuario" className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className="space-y-1">
                        <div className={`flex items-center gap-2 ${textoPrincipal}`}>
                          <span>{usuario.username}</span>
                          {filaInactiva && (
                            <span className="inline-flex items-center rounded-md border border-red-700 bg-red-200 px-2 py-0.5 text-[11px] font-bold text-red-900 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
                              (inactivo)
                            </span>
                          )}
                        </div>
                        {/* Aviso si el usuario no tiene perfil */}
                        {!usuario.perfil && (
                          <div className={`text-xs font-semibold ${filaInactiva ? 'text-red-700 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            ⚠️ Sin Perfil
                          </div>
                        )}
                        {perfilDocentePendiente && (
                          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                            ⚠️ Perfil Docente Pendiente
                          </div>
                        )}
                        {docenteSinVinculo && !perfilDocentePendiente && (
                          <div className="text-xs font-semibold text-red-700 dark:text-red-400">
                            Estado: ⚠️ Sin perfil docente vinculado
                          </div>
                        )}
                      </div>
                    </td>
                    <td data-label="Nombre" className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className={`text-sm ${textoFila}`}>
                        {obtenerNombreUsuario(usuario)}
                      </div>
                    </td>
                    <td data-label="C.I." className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className={`text-sm font-mono ${textoFila}`}>
                        {usuario.ci || '-'}
                      </div>
                    </td>
                    <td data-label="Carrera" className={`px-6 py-4 whitespace-nowrap text-center ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className={`text-sm font-bold ${textoFila}`}>
                        {obtenerTextoCarrerasUsuario(usuario) || '-'}
                      </div>
                    </td>
                    <td data-label="Rol" className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      {(() => {
                        const docenteInactivo = usuarioTieneDocenteInactivo(usuario);
                        const rolesUsuario = obtenerRolesUsuario(usuario);
                        const tieneVariosRoles = rolesUsuario.length > 1;
                        const claseBase = 'inline-flex items-center rounded-lg border-2 px-3 py-1.5 text-xs font-bold shadow-none';
                        if (usuario.is_superuser) {
                          return <span className={`${claseBase} bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-500 dark:border-amber-600`}>👑 Super Admin</span>;
                        }

                        if (tieneVariosRoles) {
                          return (
                            <>
                              {rolesUsuario.map((rol, index) => (
                                <span key={rol} className="inline-flex items-center">
                                  {index > 0 && <span className="px-1 text-slate-500 dark:text-slate-400 font-bold">/</span>}
                                  <span
                                    className={`${claseBase} ${ROL_STYLES[rol] || 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-500 dark:border-green-700'}`}
                                  >
                                    {ROL_LABELS[rol] || rol}
                                    {docenteInactivo && rol === 'docente' ? ' (inactivo)' : ''}
                                  </span>
                                </span>
                              ))}
                            </>
                          );
                        }

                        const rolUnico = rolesUsuario[0];
                        const textoRol = obtenerTextoRolUsuario(usuario);
                        return (
                          <span className={`${claseBase} ${ROL_STYLES[rolUnico] || 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-500 dark:border-green-700'}`}>
                            {textoRol}
                            {docenteInactivo ? ' (inactivo)' : ''}
                          </span>
                        );
                      })()}
                    </td>
                    <td data-label="Estado" className={`px-6 py-4 whitespace-nowrap ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      <div className="flex items-center justify-center gap-3">
                        {!usuario.is_superuser && (
                          <ToggleSwitch
                            isActive={!docenteSinVinculo && usuario.is_active}
                            disabled={!puedeCambiarEstadoUsuario(usuario) || (docenteSinVinculo && !perfilDocentePendiente)}
                            onChange={() => puedeCambiarEstadoUsuario(usuario) && handleToggleActivo(usuario)}
                          />
                        )}
                        <span className="text-sm font-semibold">
                          {usuario.is_superuser
                            ? <span className="text-amber-600 dark:text-amber-400 italic">protegido</span>
                            : docenteSinVinculo
                            ? <span className="text-red-800 dark:text-red-400 font-black italic tracking-wide">sin vínculo docente</span>
                            : usuario.is_active
                            ? <span className="text-emerald-600 dark:text-emerald-400 italic">Activo</span>
                            : <span className="text-red-800 dark:text-red-400 font-black italic tracking-wide">inactivo</span>
                          }
                        </span>
                      </div>
                    </td>
                    <td data-label="Acciones" className={`px-6 py-4 whitespace-nowrap text-center ${filaInactiva ? 'bg-red-200/90 dark:bg-red-950/35' : ''}`}>
                      {puedeGestionarUsuarios() && (() => {
                        const blockedBtn = !puedeEditarUsuario(usuario);
                        const canDelete = puedeEliminarUsuarios() && !usuario.is_superuser;
                        const titleMsg = blockedBtn ? 'Acción deshabilitada: usuario protegido' : '';
                        return (
                          <div className="flex justify-center gap-3">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!blockedBtn) abrirModalEditar(usuario);
                              }}
                              disabled={blockedBtn}
                              className={`text-blue-500 ${blockedBtn ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300'} transition-all duration-200 ${blockedBtn ? '' : 'hover:scale-110'}`}
                              title={titleMsg || 'Editar'}
                            >
                              <FaEdit size={18} />
                            </button>
                            {puedeEliminarUsuarios() && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (canDelete) handleEliminar(usuario);
                                }}
                                disabled={!canDelete}
                                className={`text-red-500 ${!canDelete ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-400 dark:text-red-400 dark:hover:text-red-300'} transition-all duration-200 ${!canDelete ? '' : 'hover:scale-110'}`}
                                title={titleMsg || 'Eliminar'}
                              >
                                <FaTrash size={18} />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>

            {usuarios.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">No hay usuarios registrados</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de detalle de usuario */}
        {usuarioDetalle && createPortal((() => {
          const rolesDetalle = obtenerRolesUsuario(usuarioDetalle);
          const puedeEditarDetalle = puedeEditarUsuario(usuarioDetalle);
          const puedeEliminarDetalle = puedeEliminarUsuarios() && !usuarioDetalle.is_superuser;
          const docenteSinVinculoDetalle = usuarioEsDocenteSinVinculo(usuarioDetalle);
          const perfilDocentePendienteDetalle = usuarioTienePerfilDocentePendiente(usuarioDetalle);
          const docenteInactivoDetalle = usuarioTieneDocenteInactivo(usuarioDetalle);
          const correoDetalle = usuarioDetalle.email || usuarioDetalle.correo || '-';
          const fotoPerfilDetalle = usuarioDetalle?.perfil?.foto_perfil;
          const inicialDetalle = (obtenerNombreUsuario(usuarioDetalle) || usuarioDetalle.username || 'U').trim().charAt(0).toUpperCase();
          const filasDetalle = [
            ['Usuario', usuarioDetalle.username || '-'],
            ['Nombre completo', obtenerNombreUsuario(usuarioDetalle)],
            ['C.I.', usuarioDetalle.ci || '-'],
            ['Correo', correoDetalle],
            ['Carrera', obtenerTextoCarrerasDetalleUsuario(usuarioDetalle)],
            ['Estado', obtenerEstadoUsuario(usuarioDetalle)],
          ];

          return (
            <div
              className="fixed top-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-3 md:p-4 animate-fade-in"
              style={{ left: hasSidebar ? (sidebarCollapsed ? '5rem' : '18rem') : '0', animationDuration: '160ms' }}
              onClick={cerrarDetalleUsuario}
            >
              <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[88vh] md:max-h-[92vh] overflow-hidden animate-slide-up flex flex-col"
                style={{ animationDuration: '180ms' }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800 flex items-center justify-between">
                  <h3 className="text-base md:text-xl font-bold text-white">Ver Usuario</h3>
                  <button
                    type="button"
                    onClick={cerrarDetalleUsuario}
                    className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 text-base md:text-lg font-black text-white transition hover:bg-white/20"
                    aria-label="Cerrar detalle"
                  >
                    X
                  </button>
                </div>

                <div className="flex-1 p-3 md:p-6 overflow-y-auto bg-slate-950/5 dark:bg-slate-950">
                  <div className="mx-auto max-w-3xl bg-blue-50 text-slate-800 rounded-lg border border-blue-100 shadow-xl p-4 md:p-8 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 md:flex-col md:gap-0 md:justify-center pb-4 md:pb-6 border-b border-slate-300">
                      <div className="h-20 w-20 md:h-40 md:w-40 shrink-0 overflow-hidden rounded-2xl md:rounded-full border-[3px] md:border-4 border-white bg-blue-100 shadow-md dark:border-slate-600 dark:bg-slate-700">
                        {fotoPerfilDetalle ? (
                          <img src={fotoPerfilDetalle} alt="Foto de perfil" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-blue-700 text-3xl md:text-5xl font-black text-white dark:bg-blue-600">
                            {inicialDetalle}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 md:text-center">
                        <h4 className="text-lg md:mt-4 md:text-2xl font-bold text-blue-800 leading-tight break-words dark:text-blue-200">
                          {obtenerNombreUsuario(usuarioDetalle)}
                        </h4>
                        <span className="mt-1 md:mt-2 inline-flex items-center justify-center text-center px-2 md:px-4 py-1 text-sm md:text-base text-blue-700 font-extrabold tracking-wide leading-none min-w-0 md:min-w-[64px] dark:text-blue-300">
                          {usuarioDetalle.username || 'Usuario'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 md:mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 pb-4 border-b border-slate-200">
                      {filasDetalle.slice(2, 6).map(([label, value]) => (
                        <div key={label} className={label === 'Correo' ? 'col-span-2 md:col-span-1' : ''}>
                          <h5 className="text-[0.64rem] md:text-xs font-bold tracking-widest text-slate-600 uppercase dark:text-slate-300">{label}</h5>
                          <p className="mt-1 text-xs md:text-sm font-semibold text-slate-800 break-words leading-snug dark:text-white">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 md:mt-6">
                      <h5 className="text-xs md:text-sm font-bold tracking-wider text-blue-700 uppercase dark:text-blue-300">Roles</h5>
                      <div className="mt-2 rounded-md border border-blue-200 bg-white/70 p-3 md:p-4 min-h-[58px] md:min-h-[86px] dark:border-slate-600 dark:bg-slate-900/45">
                        <div className="flex flex-wrap gap-2">
                          {usuarioDetalle.is_superuser ? (
                            <span className="inline-flex items-center rounded-lg border-2 border-amber-500 bg-amber-100 px-2.5 py-1 text-[0.68rem] md:px-3 md:py-1.5 md:text-xs font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Super Admin</span>
                          ) : rolesDetalle.length > 0 ? (
                            rolesDetalle.map((rol) => (
                              <span key={rol} className={`inline-flex items-center rounded-lg border-2 px-2.5 py-1 text-[0.68rem] md:px-3 md:py-1.5 md:text-xs font-bold ${ROL_STYLES[rol] || 'bg-green-100 text-green-700 border-green-500'}`}>
                                {ROL_LABELS[rol] || rol}
                                {docenteInactivoDetalle && rol === 'docente' ? ' (inactivo)' : ''}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm font-semibold text-slate-500">Sin rol</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {(!usuarioDetalle.perfil || perfilDocentePendienteDetalle || docenteSinVinculoDetalle) && (
                      <div className="mt-4 md:mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 md:p-4 text-xs md:text-sm font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-100">
                        {!usuarioDetalle.perfil && <p>Sin perfil asignado.</p>}
                        {perfilDocentePendienteDetalle && <p>Perfil docente pendiente de vincular.</p>}
                        {docenteSinVinculoDetalle && !perfilDocentePendienteDetalle && <p>Sin perfil docente vinculado.</p>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-3 py-3 md:px-6 md:py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 grid grid-cols-3 gap-2 md:flex md:flex-wrap md:justify-end md:gap-3">
                  <button
                    type="button"
                    onClick={cerrarDetalleUsuario}
                    className="px-2 md:px-6 py-2 md:py-2.5 min-w-0 md:min-w-[120px] rounded-lg md:rounded-xl text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                  >
                    Cerrar
                  </button>
                  {puedeGestionarUsuarios() && (
                    <button
                      type="button"
                      onClick={editarDesdeDetalle}
                      disabled={!puedeEditarDetalle}
                      className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-6 py-2 md:py-2.5 min-w-0 md:min-w-[120px] rounded-lg md:rounded-xl bg-blue-600 text-xs md:text-sm text-white font-bold transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      <FaEdit size={14} />
                      Editar
                    </button>
                  )}
                  {puedeEliminarUsuarios() && (
                    <button
                      type="button"
                      onClick={eliminarDesdeDetalle}
                      disabled={!puedeEliminarDetalle}
                      className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-6 py-2 md:py-2.5 min-w-0 md:min-w-[120px] rounded-lg md:rounded-xl bg-red-600 text-xs md:text-sm text-white font-bold transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      <FaTrash size={14} />
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })(), document.body)}

        {/* Modal de Confirmación de Toggle Estado */}
        {showToggleModal && usuarioToToggle && createPortal((
          <div
            className="fixed top-0 right-0 bottom-0 z-[70] flex items-center justify-center p-4"
            style={{ left: hasSidebar ? (sidebarCollapsed ? '5rem' : '18rem') : '0' }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setShowToggleModal(false)} />
            <div
              className={`relative w-full max-w-lg rounded-2xl border bg-slate-900 shadow-2xl overflow-hidden animate-slide-up ${
                usuarioToToggle.is_active
                  ? 'border-uab-gold-300/40 dark:border-uab-gold-700/50'
                  : 'border-uab-green-300/40 dark:border-uab-green-700/50'
              }`}
              style={{ animationDuration: '160ms' }}
            >
              <div className={`px-5 py-4 border-b border-slate-700/70 bg-gradient-to-r ${usuarioToToggle.is_active ? 'from-uab-gold-900/30 to-slate-900' : 'from-uab-green-900/30 to-slate-900'}`}>
                <h4 className={`text-lg font-bold flex items-center gap-2 ${usuarioToToggle.is_active ? 'text-uab-gold-300' : 'text-uab-green-300'}`}>
                  <span>{usuarioToToggle.is_active ? '⏸️' : '▶️'}</span>
                  {usuarioToToggle.is_active ? 'Confirmar Pausa de Acceso' : 'Confirmar Reactivación'}
                </h4>
              </div>
              <div className="px-5 py-4 space-y-3 text-slate-200">
                <p className="text-sm leading-relaxed">
                  {usuarioToToggle.is_active
                    ? `Se pausará el acceso de ${usuarioToToggle.username} al sistema.`
                    : `Se reactivará el acceso de ${usuarioToToggle.username} al sistema.`}
                </p>
                <div className={`rounded-lg border px-3 py-2 text-sm ${usuarioToToggle.is_active ? 'border-uab-gold-500/40 bg-uab-gold-500/10' : 'border-uab-green-500/40 bg-uab-green-500/10'}`}>
                  Usuario: <strong className={usuarioToToggle.is_active ? 'text-uab-gold-300' : 'text-uab-green-300'}>{usuarioToToggle.username}</strong>
                </div>
                <p className="text-xs text-slate-400">
                  Esta acción se puede revertir desde el interruptor de estado.
                </p>
              </div>
              <div className="px-5 py-4 border-t border-slate-700/70 flex justify-end gap-3 bg-slate-950/70">
                <button
                  type="button"
                  onClick={() => setShowToggleModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-300 border border-slate-600 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const response = await api.post(`/usuarios/${usuarioToToggle.id}/toggle_activo/`);
                      toast.success(`Usuario ${usuarioToToggle.is_active ? 'desactivado' : 'reactivado'} con éxito`);
                      setShowToggleModal(false);
                      setUsuarios((prev) => prev.map((usuario) => (
                        usuario.id === usuarioToToggle.id
                          ? (response.data?.id ? response.data : { ...usuario, is_active: !usuario.is_active })
                          : usuario
                      )));
                    } catch (err) {
                      console.error('Error:', err);
                      toast.error('Error al cambiar el estado del usuario');
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-bold text-white ${usuarioToToggle.is_active ? 'bg-uab-gold-600 hover:bg-uab-gold-700' : 'bg-uab-green-600 hover:bg-uab-green-700'}`}
                >
                  {usuarioToToggle.is_active ? '⏸️ Confirmar Pausa' : '▶️ Confirmar Reactivación'}
                </button>
              </div>
            </div>
          </div>
        ), document.body)}

        {/* Modal de Confirmación de Eliminación */}
        {showDeleteModal && createPortal((
          <div
            className="fixed top-0 right-0 bottom-0 z-[70] flex items-center justify-center p-4"
            style={{ left: hasSidebar ? (sidebarCollapsed ? '5rem' : '18rem') : '0' }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeDeleteModal} />
            <div className="relative w-full max-w-lg rounded-2xl border border-red-600/80 dark:border-red-700/50 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
              <div className="px-5 py-4 border-b border-red-400 dark:border-slate-700/70 bg-gradient-to-r from-red-400 via-red-200 to-red-50 dark:from-red-900/30 dark:via-slate-900 dark:to-slate-900">
                <h4 className="text-lg font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                  <span>🗑️</span>
                  Confirmar Eliminación
                </h4>
              </div>
              <div className="px-5 py-4 space-y-3 text-slate-700 dark:text-slate-200">
                <p className="text-sm leading-relaxed">
                  Se eliminará el usuario <strong className="text-slate-900 dark:text-white">{usuarioToDelete?.username}</strong> del sistema de forma permanente.
                </p>
                <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
                  Acción irreversible: <strong className="text-red-900 dark:text-red-300">El usuario perderá su acceso definitivamente.</strong>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Escribe el nombre exacto de usuario para habilitar la eliminación:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Escribe el nombre de usuario para confirmar"
                    className="w-full px-3 py-2 rounded-lg border border-red-400/40 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta operación no se puede deshacer.
                </p>
              </div>
              <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/70 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/70">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarEliminar}
                  disabled={deleteConfirmText !== (usuarioToDelete?.username || '')}
                  className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:bg-red-900/40 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          </div>
        ), document.body)}
      </div>
    </div>
  );
}

export default GestionUsuarios;
