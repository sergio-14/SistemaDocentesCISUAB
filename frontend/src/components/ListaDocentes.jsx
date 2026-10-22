import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaChevronRight, FaEdit, FaEye, FaTrash } from 'react-icons/fa';
import { getCarreras, getDocentes, obtenerTodos } from '../apis/api';
import api from '../apis/api';
import toast from 'react-hot-toast';
import {
  getBackendErrorMessage,
  sanitizeApiErrors,
  ERROR_SHAKE_DURATION_MS,
} from '../utils/formErrors';
import { DEDICACIONES_HORARIO, ETIQUETAS_DEDICACION, describirDedicacion, horasSemanalesDedicacion } from '../utils/dedicaciones';
import { hoyBolivia } from '../utils/fechas';
import { CalendarioFlotante } from './common/CalendarioFecha';
import NumeroAnimado from './common/NumeroAnimado';
import FiltroDesplegable from './common/FiltroDesplegable';
import CampoBusqueda from './common/CampoBusqueda';
import Paginacion from './common/Paginacion';
import SelectorVista from './common/SelectorVista';
import { paginar } from '../utils/paginacion';
import ModalFichaDocente from './docentes/ModalFichaDocente';
import { useActiveRole } from '../contexts/activeRole';
import { BLOQUE, BOTON } from './fondos/estilosFondo';
import { Avatar, Etiqueta } from './fondos/ElementosFondo';
import {
  TOPE_HORAS_SEMANALES_FONDO, calcularAntiguedad, calcularHorasFondo, diasVacacionPorAntiguedad, inicioDeGestion,
} from '../utils/horasFondo';

// Normaliza mensajes de error confusos del backend (ej: """" no es una elección válida.")
// a un texto claro y humano para selects como Dedicación/Categoría.
// Ahora usa las reglas globales de formErrors.js (sanitizeApiErrors).
const normalizeErrors = (errs) => sanitizeApiErrors(errs);

// ============================================================================
// COMPONENTE INTERNO: FechaIngresoPicker (Calendario personalizado)
// ============================================================================
function parseIsoDate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}
function toIsoDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatDisplayDate(iso) {
  const dateObj = parseIsoDate(iso);
  if (!dateObj) return '';
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function parseDisplayDate(display) {
  if (!display || typeof display !== 'string') return null;
  const match = display.match(/^\d{2}\/\d{2}\/\d{4}$/);
  if (!match) return null;
  const [dd, mm, yyyy] = display.split('/').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

// Fecha de ingreso obligatoria (la real de planilla de RR.HH.), no futura según la
// hora de Bolivia y no anterior a la fundación de la UABJB. Las fechas 'YYYY-MM-DD'
// se comparan como texto.
const FECHA_FUNDACION_UABJB = '1967-11-18';
function validarFechaIngreso(fecha) {
  if (!fecha) return 'La fecha de ingreso es obligatoria: use la fecha de la planilla de RR.HH.';
  if (fecha > hoyBolivia()) return 'La fecha de ingreso no puede ser una fecha futura.';
  if (fecha < FECHA_FUNDACION_UABJB) {
    return 'La fecha de ingreso no puede ser anterior a la fundación de la UABJB (18 de noviembre de 1967).';
  }
  return null;
}

// Campos de los formularios de docentes con el estilo de la carga del fondo: píldora
// azulada, etiqueta chica y sin sombras ni animaciones al pasar el cursor.
const LABEL_CAMPO = 'block text-xs font-semibold text-slate-700 mb-1.5 pl-1';
const CAMPO = 'w-full h-11 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-inset';
const CAMPO_NORMAL = 'ring-1 ring-azulado-300 focus:ring-2 focus:ring-blue-900/40';
const CAMPO_ERROR = 'ring-2 ring-red-500';
const CAMPO_BLOQUEADO = '!bg-slate-100 text-slate-500 cursor-not-allowed';

const LockIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 10V7a4 4 0 00-8 0v3m-2 0h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z" />
  </svg>
);

function FechaIngresoPicker({ value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(formatDisplayDate(value));
  const [isPulsing, setIsPulsing] = useState(false);
  const campoRef = React.useRef(null);

  React.useEffect(() => {
    setInputValue(formatDisplayDate(value));
  }, [value]);

  React.useEffect(() => {
    if (error) {
      setIsPulsing(true);
      const t = setTimeout(() => setIsPulsing(false), ERROR_SHAKE_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleManualInputChange = (e) => {
    const rawValue = e.target.value;
    const onlyDigits = rawValue.replace(/\D/g, '').slice(0, 8);
    let formatted = onlyDigits;
    if (onlyDigits.length > 2) {
      formatted = `${onlyDigits.slice(0, 2)}/${onlyDigits.slice(2)}`;
    }
    if (onlyDigits.length > 4) {
      formatted = `${onlyDigits.slice(0, 2)}/${onlyDigits.slice(2, 4)}/${onlyDigits.slice(4)}`;
    }
    setInputValue(formatted);
    if (formatted.length === 10) {
      const parsed = parseDisplayDate(formatted);
      if (parsed) onChange(toIsoDate(parsed));
    }
    if (!formatted) {
      onChange('');
    }
  };

  const handleManualInputBlur = () => {
    if (!inputValue) {
      onChange('');
      return;
    }
    const parsed = parseDisplayDate(inputValue);
    if (parsed) {
      const iso = toIsoDate(parsed);
      onChange(iso);
      setInputValue(formatDisplayDate(iso));
      return;
    }
    onChange('');
    setInputValue('');
  };

  return (
    <div className="relative">
      <label className={LABEL_CAMPO}>Fecha de Ingreso</label>
      <div ref={campoRef} className={`relative w-full rounded-full !bg-azulado-100 ring-inset ${error ? CAMPO_ERROR : 'ring-1 ring-azulado-300 focus-within:ring-2 focus-within:ring-blue-900/40'} ${isPulsing ? 'animate-field-error-shake' : ''}`}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={inputValue}
          onChange={handleManualInputChange}
          onBlur={handleManualInputBlur}
          className="w-full h-11 !bg-transparent text-sm text-slate-800 placeholder:text-slate-500 px-4 pr-12 rounded-full outline-none"
          aria-label="Fecha de Ingreso"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-2.5 top-1/2 flex h-6 w-6 items-center justify-center rounded-md bg-[#2C4AAE] text-white hover:bg-[#233C8F] transition-colors"
          style={{ transform: 'translateY(-50%)' }}
          aria-label="Abrir calendario de Fecha de Ingreso"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-13 9h16a1 1 0 001-1V7a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1z" />
          </svg>
        </button>
      </div>
      {/* Desde la fundación de la UABJB hasta hoy */}
      <CalendarioFlotante
        abierto={open}
        anclaRef={campoRef}
        onCerrar={() => setOpen(false)}
        value={value}
        min={FECHA_FUNDACION_UABJB}
        max={hoyBolivia()}
        onElegir={(iso) => {
          onChange(iso);
          setOpen(false);
        }}
        onBorrar={() => {
          onChange('');
          setOpen(false);
        }}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Componente Select con diseño personalizado (mismo estilo que FechaIngresoPicker)
const SelectConDropdown = ({
  label,
  value,
  onChange,
  options,
  error,
  name,
  disabled = false,
  menuClassName = '',
  containerClassName = '',
  showLock = false,
  lockTooltip = '',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);
  const [isPulsing, setIsPulsing] = useState(false);

  React.useEffect(() => {
    if (error) {
      setIsPulsing(true);
      const t = setTimeout(() => setIsPulsing(false), ERROR_SHAKE_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [error]);

  React.useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target) && (!menuRef.current || !menuRef.current.contains(event.target))) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open || !containerRef.current) {
      setMenuStyle(null);
      return;
    }

    const anchorRect = containerRef.current.getBoundingClientRect();
    const estimatedHeight = Math.min(options.length * 40 + 16, window.innerHeight - 16);
    const spaceBelow = window.innerHeight - anchorRect.bottom - 12;
    const spaceAbove = anchorRect.top - 12;
    const placeAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    setMenuStyle({
      position: 'fixed',
      left: `${anchorRect.left}px`,
      width: `${anchorRect.width}px`,
      top: placeAbove
        ? `${Math.max(12, anchorRect.top - estimatedHeight - 8)}px`
        : `${anchorRect.bottom + 8}px`,
      zIndex: 99999,
    });
  }, [open, options.length]);

  const selectedLabel = value && options.find(opt => String(opt.value) === String(value))?.label;
  const displayLabel = selectedLabel || 'Seleccione...';

  const handleSelect = (optionValue) => {
    if (disabled) return;
    onChange({ target: { name, value: optionValue } });
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className={LABEL_CAMPO}>
        <span className="inline-flex items-center gap-1.5">
          <span>{label}</span>
          {showLock && (
            <span title={lockTooltip || 'No editable'} className="text-slate-400"><LockIcon /></span>
          )}
        </span>
      </label>
      
      {/* Botón principal */}
      <div className={`relative w-full rounded-full ring-inset ${/!bg-/.test(containerClassName) ? '' : '!bg-azulado-100'} ${disabled ? 'opacity-70' : ''} ${error ? CAMPO_ERROR : open ? 'ring-2 ring-blue-900/40' : 'ring-1 ring-azulado-300'} ${containerClassName} ${isPulsing ? 'animate-field-error-shake' : ''}`}>
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
          disabled={disabled}
          className={`w-full h-11 text-left pl-4 pr-2.5 rounded-full bg-transparent text-sm text-slate-800 flex items-center justify-between gap-2 ${disabled ? 'cursor-not-allowed' : ''}`}
          title={disabled ? (lockTooltip || 'No editable') : undefined}
        >
          <span className={`truncate ${!value ? 'text-slate-500' : ''}`}>{displayLabel}</span>
          {!disabled ? (
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-[#2C4AAE] ring-1 ring-[#2C4AAE]">
              <svg className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          ) : (
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-slate-500 ring-1 ring-slate-500">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 10V7a4 4 0 00-8 0v3m-2 0h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z" />
              </svg>
            </span>
          )}
        </button>
      </div>

      {/* Menú desplegable */}
      {open && menuStyle && createPortal(
        <div ref={menuRef} className="rounded-xl border-2 border-[#3A56AF] bg-white shadow-xl" style={menuStyle}>
          <div className={`p-2 ${menuClassName}`}>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) return;
                  handleSelect(option.value);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg ${
                  option.value === value
                    ? 'bg-sky-600 text-white font-semibold'
                    : option.disabled
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-[#2C4AAE] hover:text-white'
                }`}
              >
                <span className="block truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

const InfoIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InputField = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  required,
  error,
  disabled = false,
  readOnly = false,
  inputClassName = '',
  showLock = false,
  lockTooltip = '',
  ...rest
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  useEffect(() => {
    if (error) {
      setIsPulsing(true);
      const t = setTimeout(() => setIsPulsing(false), ERROR_SHAKE_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [error]);

  return (
  <div>
    <label className={LABEL_CAMPO}>
      <span className="inline-flex items-center gap-1.5">
        <span>{label}</span>
        {showLock && (
          <span title={lockTooltip || 'No editable'} className="text-slate-400"><LockIcon /></span>
        )}
      </span>
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      title={(disabled || readOnly) ? (lockTooltip || 'No editable') : undefined}
      {...rest}
      className={`${CAMPO} ${error ? CAMPO_ERROR : CAMPO_NORMAL} ${disabled ? CAMPO_BLOQUEADO : /!bg-/.test(inputClassName) ? '' : '!bg-azulado-100'} ${inputClassName} ${isPulsing ? 'animate-field-error-shake' : ''}`}
    />
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
  );
};

const UsersIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
);

const PlusIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const ETIQUETAS_CATEGORIA = { catedratico: 'Catedrático', adjunto: 'Adjunto', asistente: 'Asistente' };
const VISTA_DOCENTES_KEY = 'docentes_vista';

const PildoraInactivo = () => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 ring-1 ring-inset ring-red-200">
    <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
    Inactivo
  </span>
);

const OPCIONES_CONDICION = [
  { value: 'titular', label: 'Titular' },
  { value: 'invitado', label: 'Invitado' },
];

// Cargos de gestión: con docencia solo admiten dedicación a Tiempo Horario.
const ROLES_CARGO = ['director', 'jefe_estudios', 'iiisyp'];
const DEDICACIONES_FICHA = ['tiempo_completo', 'medio_tiempo', ...DEDICACIONES_HORARIO];

const dedicacionStyles = {
  tiempo_completo: {
    bg: 'bg-blue-50',
    accent: 'ring-1 ring-inset ring-blue-200',
    icon: 'text-blue-700',
    title: 'text-blue-900',
    text: 'text-blue-800',
  },
  medio_tiempo: {
    bg: 'bg-green-50',
    accent: 'ring-1 ring-inset ring-green-200',
    icon: 'text-green-700',
    title: 'text-green-900',
    text: 'text-green-800',
  },
  horario_16: {
    bg: 'bg-cyan-50',
    accent: 'ring-1 ring-inset ring-cyan-200',
    icon: 'text-cyan-700',
    title: 'text-cyan-900',
    text: 'text-cyan-800',
  },
  horario_24: {
    bg: 'bg-emerald-50',
    accent: 'ring-1 ring-inset ring-emerald-200',
    icon: 'text-emerald-700',
    title: 'text-emerald-900',
    text: 'text-emerald-800',
  },
  horario_40: {
    bg: 'bg-amber-50',
    accent: 'ring-1 ring-inset ring-amber-200',
    icon: 'text-amber-700',
    title: 'text-amber-900',
    text: 'text-amber-800',
  },
  horario_48: {
    bg: 'bg-rose-50',
    accent: 'ring-1 ring-inset ring-rose-200',
    icon: 'text-rose-700',
    title: 'text-rose-900',
    text: 'text-rose-800',
  },
  dedicacion_exclusiva: {
    bg: 'bg-violet-50',
    accent: 'ring-1 ring-inset ring-violet-200',
    icon: 'text-violet-700',
    title: 'text-violet-900',
    text: 'text-violet-800',
  },
};

function ListaDocentes() {
  const splitNombreCompleto = (nombreCompleto) => {
    const partes = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);

    if (partes.length === 0) {
      return { nombres: '', apellido_paterno: '', apellido_materno: '' };
    }
    if (partes.length === 1) {
      return { nombres: partes[0], apellido_paterno: '', apellido_materno: '' };
    }
    if (partes.length === 2) {
      return { nombres: partes[0], apellido_paterno: partes[1], apellido_materno: '' };
    }

    return {
      nombres: partes.slice(0, -2).join(' '),
      apellido_paterno: partes[partes.length - 2],
      apellido_materno: partes[partes.length - 1],
    };
  };

  const buildNombreCompleto = (nombres, apellidoPaterno, apellidoMaterno) =>
    [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ').trim();

  /**
   * Horas efectivas anuales según dedicación y fecha de ingreso, con el mismo
   * cálculo que el backend (calcular_horas_fondo): utils/horasFondo.js.
   * Con un cargo de gestión la jornada contractual es la del cargo (40 h/sem).
   */
  const calcularHorasEfectivas = (dedicacion, fechaIngreso, { tieneRolGestion = false, diasFeriados = 0, fechaReferencia = null } = {}) => {
    const horasDedicacion = horasSemanalesDedicacion(dedicacion);
    if (!horasDedicacion) return null;
    const antiguedad = calcularAntiguedad(fechaIngreso, fechaReferencia);
    if (antiguedad === null) return null;

    const horasSemana = Math.min(
      tieneRolGestion ? Math.max(horasDedicacion, TOPE_HORAS_SEMANALES_FONDO) : horasDedicacion,
      TOPE_HORAS_SEMANALES_FONDO,
    );
    return calcularHorasFondo(horasSemana, diasVacacionPorAntiguedad(antiguedad), diasFeriados).horas_efectivas;
  };

  // Obtener roles combinados del docente (solo roles extra, sin docente)
  const obtenerRolesDocente = (docente) => {
    if (!docente) return null;
    
    const rolesExtra = Array.isArray(docente.asignaciones)
      ? docente.asignaciones
          .filter((item) => item?.rol && item?.rol !== 'docente' && item?.activo !== false)
          .map((item) => String(item.rol).trim())
      : [];

    // Solo incluir el rol principal si no es 'docente'
    const rolPrincipal = String(docente.usuario_rol || '').trim();
    if (rolPrincipal && rolPrincipal !== 'docente' && !rolesExtra.includes(rolPrincipal)) {
      rolesExtra.unshift(rolPrincipal);
    }

    const rolesUnicos = [...new Set(rolesExtra.filter(Boolean))];

    if (rolesUnicos.length === 0) return null;

    return formatearRolesCargoProfesional(rolesUnicos);
  };

  const navigate = useNavigate();
  const restoringCreateFormRef = React.useRef(false);
  const [docentes, setDocentes] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Usuario con su rol activo (contexto de rol).
  const { effectiveUser: user, activeRole } = useActiveRole();

  // Modal de crear/editar
  const [showModal, setShowModal] = useState(false);
  // El Director ve la ficha de los docentes de su carrera sin poder editarla.
  // Ficha del docente (diseño de Mi cuenta) que abre el Director con "Ver ficha".
  const [fichaDocenteId, setFichaDocenteId] = useState(null);
  const [docenteSeleccionado, setDocenteSeleccionado] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    user: '',
    username: '',
    password: '',
    password_confirm: '',
    nombre_completo: '',
    nombres: '',
    apellido_paterno: '',
    apellido_materno: '',
    cargo_profesional: '',
    carrera: '',
    ci: '',
    categoria: 'catedratico',
    condicion: '',
    dedicacion: 'tiempo_completo',
    fecha_ingreso: '',
    email: '',
    telefono: '',
    horas_contrato_semanales: null,
    activo: true,
  });

  // La antigüedad del fondo se mide al inicio de la gestión: el calendario más temprano
  // de la carrera en la gestión del calendario activo (inicioDeGestion, igual que el
  // backend). Los días de feriado son los de esa gestión (iguales en sus calendarios).
  const [fechaInicioGestion, setFechaInicioGestion] = useState(null);
  const [diasFeriadosGestion, setDiasFeriadosGestion] = useState(0);
  const [sinCalendarioActivo, setSinCalendarioActivo] = useState(false);
  useEffect(() => {
    setFechaInicioGestion(null);
    setDiasFeriadosGestion(0);
    setSinCalendarioActivo(false);
    if (!formData.carrera) return undefined;
    let vigente = true;
    obtenerTodos('/calendarios/', { carrera: formData.carrera })
      .then((calendarios) => {
        if (!vigente) return;
        const gestion = calendarios.find((calendario) => calendario.activo)?.gestion;
        if (!gestion) {
          // Sin calendario activo: se usa el 1 de enero, igual que un fondo sin calendarios.
          setSinCalendarioActivo(true);
          return;
        }
        const deLaGestion = calendarios.filter((calendario) => calendario.gestion === gestion);
        setFechaInicioGestion(inicioDeGestion(deLaGestion.map((calendario) => calendario.fecha_inicio), gestion));
        setDiasFeriadosGestion(Number(deLaGestion[0]?.dias_feriados_gestion) || 0);
      })
      .catch(() => {
        if (vigente) setSinCalendarioActivo(true);
      });
    return () => { vigente = false; };
  }, [formData.carrera]);
  const avisoFeriados = sinCalendarioActivo
    ? 'No hay calendario activo en la carrera: las horas efectivas no descuentan feriados.'
    : '';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docenteToDelete, setDocenteToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);
  const [buscarUsuario, setBuscarUsuario] = useState('');
  const [abrirDesdeUsuarios, setAbrirDesdeUsuarios] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Tarjetas o lista, como en el dashboard de fondos; se recuerda en este navegador.
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem(VISTA_DOCENTES_KEY) === 'lista' ? 'lista' : 'tarjetas';
    } catch {
      return 'tarjetas';
    }
  });
  const [pagina, setPagina] = useState(1);
  const listaRef = React.useRef(null);
  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    setPagina(1);
    try {
      localStorage.setItem(VISTA_DOCENTES_KEY, nuevaVista);
    } catch {
      // Sin almacenamiento disponible la vista simplemente no se recuerda.
    }
  };
  const [selectedCarrera, setSelectedCarrera] = useState('');
  useEffect(() => {
    setPagina(1);
  }, [searchTerm, selectedCarrera]);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [userInfoKey, setUserInfoKey] = useState(null);
  const gestionWarningTimeoutRef = React.useRef(null);
  const dedicacionInfoTimeoutRef = React.useRef(null);
  const [showGestionWarningVisible, setShowGestionWarningVisible] = useState(false);
  const [gestionWarningInfoKey, setGestionWarningInfoKey] = useState(null);
  const [searchMode, setSearchMode] = useState(false);
  const [showDedicacionInfo, setShowDedicacionInfo] = useState(false);
  const [dedicacionInfoKey, setDedicacionInfoKey] = useState(null);

  React.useEffect(() => {
    return () => {
      if (gestionWarningTimeoutRef.current) clearTimeout(gestionWarningTimeoutRef.current);
      if (dedicacionInfoTimeoutRef.current) clearTimeout(dedicacionInfoTimeoutRef.current);
    };
  }, []);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const userSearchContainerRef = React.useRef(null);
  const [isUserSearchPulsing, setIsUserSearchPulsing] = useState(false);
  const [userInfoShownBefore, setUserInfoShownBefore] = useState(false);
  const [confirmacionCambioPendiente, setConfirmacionCambioPendiente] = useState(null);
  const [infoEdicionIndex, setInfoEdicionIndex] = useState(0);
  const [infoEdicionDirection, setInfoEdicionDirection] = useState('right');
  const [confirmacionDesactivarDocente, setConfirmacionDesactivarDocente] = useState(null);

  // Sacudida (shake) del campo "Buscar nombre o usuario" al detectar error (regla global)
  useEffect(() => {
    if (errors.user) {
      setIsUserSearchPulsing(true);
      const t = setTimeout(() => setIsUserSearchPulsing(false), ERROR_SHAKE_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [errors.user]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (userSearchContainerRef.current && !userSearchContainerRef.current.contains(event.target)) {
        setShowAutocomplete(false);
      }
    };

    if (showAutocomplete) {
      document.addEventListener('mousedown', handleOutside);
    }

    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showAutocomplete]);

  // Efecto: cuando showUserInfo pasa a true POR PRIMERA VEZ, establecer userInfoKey para trigger animación
  useEffect(() => {
    if (showUserInfo && !userInfoShownBefore) {
      setUserInfoKey(Date.now());
      setUserInfoShownBefore(true);
    }
  }, [showUserInfo, userInfoShownBefore]);

  useEffect(() => {
    if (dedicacionInfoTimeoutRef.current) {
      clearTimeout(dedicacionInfoTimeoutRef.current);
      dedicacionInfoTimeoutRef.current = null;
    }

    if (!formData.dedicacion) {
      setShowDedicacionInfo(false);
      setDedicacionInfoKey(null);
      return;
    }

    setShowDedicacionInfo(false);
    dedicacionInfoTimeoutRef.current = setTimeout(() => {
      setDedicacionInfoKey(Date.now());
      setShowDedicacionInfo(true);
    }, 1000);

    return () => {
      if (dedicacionInfoTimeoutRef.current) {
        clearTimeout(dedicacionInfoTimeoutRef.current);
        dedicacionInfoTimeoutRef.current = null;
      }
    };
  }, [formData.dedicacion]);

  useEffect(() => {
    cargarDocentes();
    
    // Detectar si venimos desde "Crear Usuario" para abrir modal
    const abrirModal = sessionStorage.getItem('abrirModalDesdeUsuarios');
    if (abrirModal === 'true') {
      const datosDocenteGuardados = sessionStorage.getItem('datosCrearDocente');
      if (datosDocenteGuardados) {
        try {
          const datosDocente = JSON.parse(datosDocenteGuardados);
          restoringCreateFormRef.current = true;
          setFormData((prev) => ({
            ...prev,
            ...datosDocente,
            nombre_completo: buildNombreCompleto(
              datosDocente.nombres,
              datosDocente.apellido_paterno,
              datosDocente.apellido_materno
            ),
          }));
        } catch (e) {
          console.error('Error al recuperar datos de docente:', e);
        }
      }
      setAbrirDesdeUsuarios(true);
      setIsCreating(true);
      sessionStorage.removeItem('abrirModalDesdeUsuarios');
    }

    // Detectar si venimos desde "Gestión de Usuarios" (botón "Guardar y volver"
    // o "Cancelar y volver" con from === 'docente'). Abrir el modal de Nuevo
    // Docente automáticamente y, si hay un usuario recién creado, seleccionarlo.
    const abrirModalNuevoDocente = sessionStorage.getItem('abrirModalNuevoDocente');
    if (abrirModalNuevoDocente === 'true') {
      const datosDocenteGuardados = sessionStorage.getItem('datosCrearDocente');
      if (datosDocenteGuardados) {
        try {
          const datosDocente = JSON.parse(datosDocenteGuardados);
          restoringCreateFormRef.current = true;
          setFormData((prev) => ({
            ...prev,
            ...datosDocente,
            nombre_completo: datosDocente.nombre_completo || buildNombreCompleto(
              datosDocente.nombres,
              datosDocente.apellido_paterno,
              datosDocente.apellido_materno
            ),
          }));
        } catch (e) {
          console.error('Error al recuperar datos de docente desde usuarios:', e);
        }
      }
      setIsCreating(true);
      const usuarioCreadoRaw = sessionStorage.getItem('autoSeleccionarUsuarioDesdeGestion');
      if (usuarioCreadoRaw) {
        try {
          const usuarioCreado = JSON.parse(usuarioCreadoRaw);
          const datosUsuarioRaw = sessionStorage.getItem('datosCrearUsuario');
          const datosUsuario = datosUsuarioRaw ? JSON.parse(datosUsuarioRaw) : null;
          // Esperar a que los usuarios estén cargados para seleccionar
          setTimeout(() => {
            const usuarioEncontrado = usuarios.find(
              (u) => String(u.id) === String(usuarioCreado.id)
            ) || usuarioCreado;
            if (usuarioEncontrado && typeof handleSeleccionUsuario === 'function') {
              const ciGuardado = usuarioCreado?._ciRetornoDocente || datosUsuario?.ci || '';
              const usuarioParaSeleccion = {
                ...usuarioCreado,
                ...usuarioEncontrado,
                ci: usuarioEncontrado?.ci || usuarioCreado?.ci || ciGuardado,
              };
              const carreraGuardada = usuarioCreado?._carreraRetornoDocente || datosUsuario?.carrera || '';
              const carreraSeleccionada = carreraGuardada || getCarreraDocenteUsuario(usuarioParaSeleccion) || '';
              const ciSeleccionado = getCiUsuario(usuarioParaSeleccion, ciGuardado);
              setBuscarUsuario(`${usuarioParaSeleccion.first_name || ''} ${usuarioParaSeleccion.last_name || ''}`.trim());
              setFormData((prev) => ({
                ...prev,
                user: usuarioParaSeleccion.id,
                nombre_completo: buildNombreCompleto(usuarioParaSeleccion.first_name, usuarioParaSeleccion.last_name),
                ci: ciSeleccionado,
                cargo_profesional: formatearRolesCargoProfesional(getRolesActivosUsuario(usuarioParaSeleccion)) || usuarioParaSeleccion.perfil?.rol_display || usuarioParaSeleccion.perfil?.rol || '',
                email: usuarioParaSeleccion.email || '',
                username: usuarioParaSeleccion.username || '',
                password: '',
                password_confirm: '',
                carrera: carreraSeleccionada || prev.carrera || '',
                dedicacion: getDedicacionPermitidaParaUsuario(usuarioParaSeleccion, prev.dedicacion),
              }));
              setShowAutocomplete(false);
              setSearchMode(false);
              setShowUserInfo(true);
              setUserInfoKey(Date.now());
            }
            sessionStorage.removeItem('autoSeleccionarUsuarioDesdeGestion');
          }, 800);
        } catch (e) {
          console.error('Error al auto-seleccionar usuario desde gestión:', e);
          sessionStorage.removeItem('autoSeleccionarUsuarioDesdeGestion');
        }
      }
      sessionStorage.removeItem('abrirModalNuevoDocente');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  const cargarDocentes = async () => {
    setLoading(true);
    try {
      // Usuarios: solo las páginas necesarias para sugerir; el buscador consulta el resto en el servidor.
      const [docentesData, carrerasData, usuariosResponse] = await Promise.all([
        getDocentes(),
        getCarreras(),
        api.get('/usuarios/'),
      ]);
      const docentesLista = Array.isArray(docentesData) ? docentesData : [];
      const usuariosIniciales = usuariosResponse.data.results || usuariosResponse.data;
      const usuariosAcumulados = Array.isArray(usuariosIniciales) ? [...usuariosIniciales] : [];
      let siguientePagina = usuariosResponse.data.next ? 2 : null;

      while (
        siguientePagina
        && usuariosAcumulados.filter((usuarioItem) => usuarioEsElegibleParaNuevoDocente(usuarioItem, docentesLista)).length < 5
      ) {
        const response = await api.get('/usuarios/', { params: { page: siguientePagina } });
        const paginaUsuarios = response.data.results || response.data;
        if (!Array.isArray(paginaUsuarios) || paginaUsuarios.length === 0) break;
        usuariosAcumulados.push(...paginaUsuarios);
        siguientePagina = response.data.next ? siguientePagina + 1 : null;
      }

      setDocentes(Array.isArray(docentesData) ? docentesData : []);
      setCarreras(Array.isArray(carrerasData) ? carrerasData : []);
      setUsuarios(usuariosAcumulados);
      setLoading(false);
    } catch (err) {
      setError('Error al cargar docentes');
      setLoading(false);
      console.error(err);
    }
  };

  useEffect(() => {
    if (!searchMode) return;

    const query = buscarUsuario.trim();
    if (query.length < 2) return;

    const timeoutId = setTimeout(async () => {
      try {
        const response = await api.get('/usuarios/', { params: { search: query } });
        const usuariosData = response.data.results || response.data;
        if (!Array.isArray(usuariosData)) return;

        setUsuarios((prev) => {
          const map = new Map(prev.map((usuarioItem) => [String(usuarioItem.id), usuarioItem]));
          usuariosData.forEach((usuarioItem) => {
            map.set(String(usuarioItem.id), usuarioItem);
          });
          return Array.from(map.values());
        });
      } catch (err) {
        console.error('Error al buscar usuarios:', err);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [buscarUsuario, searchMode]);

  useEffect(() => {
    const initialData = {
      user: '',
      username: '',
      password: '',
      password_confirm: '',
      nombre_completo: '',
      nombres: '',
      apellido_paterno: '',
      apellido_materno: '',
      cargo_profesional: '',
      carrera: '',
      ci: '',
      categoria: '',
      condicion: '',
      dedicacion: '',
      fecha_ingreso: '',
      email: '',
      telefono: '',
      horas_contrato_semanales: null,
      activo: true,
    };
    if (isCreating) {
      // SIEMPRE resetear estados de animación, incluso en restoration
      setShowUserInfo(false);
      setShowDedicacionInfo(false);
      setDedicacionInfoKey(null);
      setSearchMode(false);
      setShowAutocomplete(false);
      setUserInfoShownBefore(false);
      setBuscarUsuario('');
      setErrors({});
      
      if (restoringCreateFormRef.current) {
        restoringCreateFormRef.current = false;
        return;
      }
      setFormData(initialData);
    }
  }, [isCreating]);

  const handleToggleCreateForm = () => {
    setIsCreating(!isCreating);
    if (isCreating) {
      setAbrirDesdeUsuarios(false);
    }
  };

  const handleCrearUsuarioDesdeNuevoDocente = () => {
    const nombresSplit = splitNombreCompleto(formData.nombre_completo);
    sessionStorage.setItem('datosCrearDocente', JSON.stringify({
      ...formData,
      nombres: formData.nombres || nombresSplit.nombres,
      apellido_paterno: formData.apellido_paterno || nombresSplit.apellido_paterno,
      apellido_materno: formData.apellido_materno || nombresSplit.apellido_materno,
      nombre_completo: formData.nombre_completo,
    }));
    sessionStorage.setItem('datosCrearUsuario', JSON.stringify({
      username: '',
      email: formData.email || '',
      nombre_completo: formData.nombre_completo || '',
      first_name: formData.nombres || nombresSplit.nombres || '',
      last_name: [
        formData.apellido_paterno || nombresSplit.apellido_paterno || '',
        formData.apellido_materno || nombresSplit.apellido_materno || '',
      ].filter(Boolean).join(' '),
      ci: formData.ci || '',
      rol: 'docente',
      carrera: formData.carrera || '',
      docente: '',
      password: '',
      password_confirm: '',
    }));
    navigate('/usuarios', { state: { from: 'docente' } });
  };

  const obtenerConfigConfirmacionCampo = (name, value) => {
    if (name === 'dedicacion') {
      const etiqueta = opcionesDedicacion.find((op) => String(op.value) === String(value))?.label || String(value || 'sin valor');
      return {
        titulo: 'Confirmar cambio de dedicación',
        mensaje: `Este cambio puede recalcular el cumplimiento de horas del docente.\n\nNueva dedicación: ${etiqueta}\n\n¿Desea continuar?`,
      };
    }

    if (name === 'categoria') {
      const mapaCategorias = {
        catedratico: 'Catedrático',
        adjunto: 'Adjunto',
        asistente: 'Asistente',
      };
      const etiqueta = mapaCategorias[String(value || '')] || String(value || 'sin valor');
      return {
        titulo: 'Confirmar cambio de categoría',
        mensaje: `Este cambio puede impactar el cálculo de vacaciones del docente.\n\nNueva categoría: ${etiqueta}\n\n¿Desea continuar?`,
      };
    }

    return null;
  };

  const aplicarCambioFormulario = (name, value, type = 'text', checked = false) => {
    // Limpiar el error del campo que se está editando (regla global de formularios)
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setFormData(prev => {
      let nextValue = type === 'checkbox' ? checked : value;
      if (name === 'telefono') {
        nextValue = String(nextValue || '').replace(/\D/g, '').slice(0, 10);
      }
      if (name === 'ci') {
        nextValue = String(nextValue || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
      }
      const newState = {
        ...prev,
        [name]: nextValue,
      };

      if (name === 'nombre_completo') {
        const nombresSplit = splitNombreCompleto(String(nextValue));
        newState.nombres = nombresSplit.nombres;
        newState.apellido_paterno = nombresSplit.apellido_paterno;
        newState.apellido_materno = nombresSplit.apellido_materno;
      }

      if (name === 'dedicacion') {
        if (
          usuarioFormularioTieneRolGestion
          && usuarioFormularioTieneRolDocente
          && ['tiempo_completo', 'medio_tiempo'].includes(String(nextValue || ''))
        ) {
          return prev;
        }
        newState.horas_contrato_semanales = null;
      }

      if (isCreating && abrirDesdeUsuarios) {
        sessionStorage.setItem('datosCrearDocente', JSON.stringify({
          nombre_completo: newState.nombre_completo,
          nombres: newState.nombres,
          apellido_paterno: newState.apellido_paterno,
          apellido_materno: newState.apellido_materno,
          ci: newState.ci,
          telefono: newState.telefono,
          carrera: newState.carrera,
        }));
      }

      return newState;
    });
  };

  const abrirModalEditar = (docente) => {
    setDocenteSeleccionado(docente);
    setFormData({
      user: docente.user_id || docente.usuario_id || '',
      username: '',
      password: '',
      password_confirm: '',
      nombre_completo: docente.usuario_nombre || buildNombreCompleto(
        docente.nombres,
        docente.apellido_paterno,
        docente.apellido_materno
      ),
      nombres: docente.nombres,
      apellido_paterno: docente.apellido_paterno,
      apellido_materno: docente.apellido_materno || '',
      cargo_profesional: obtenerRolesDocente(docente),
      carrera: docente.vinculos?.[0]?.carrera || '',
      ci: docente.ci,
      categoria: docente.vinculos?.[0]?.categoria || '',
      condicion: docente.vinculos?.[0]?.condicion || '',
      dedicacion: docente.vinculos?.[0]?.dedicacion || '',
      fecha_ingreso: docente.fecha_ingreso || '',
      email: docente.email || '',
      telefono: docente.telefono || '',
      horas_contrato_semanales: null,
      activo: docente.activo,
    });
    setShowModal(true);
    setIsCreating(false);
    setShowUserInfo(true);
    setInfoEdicionIndex(0);
    setInfoEdicionDirection('right');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const esEdicion = showModal && Boolean(docenteSeleccionado);
    const esCampoConConfirmacion = esEdicion && ['dedicacion', 'categoria'].includes(name);
    const valorActual = formData[name];

    if (esEdicion && name === 'activo' && type === 'checkbox' && valorActual === true && checked === false) {
      const horasDeclaradas = Number(docenteSeleccionado?.horas_declaradas || 0);
      const fondosValidados = Number(docenteSeleccionado?.fondos_validados || 0);
      setConfirmacionDesactivarDocente({
        tieneHistorial: horasDeclaradas > 0 || fondosValidados > 0,
      });
      return;
    }

    if (esCampoConConfirmacion && String(valorActual ?? '') !== String(value ?? '')) {
      const config = obtenerConfigConfirmacionCampo(name, value);
      if (config) {
        setConfirmacionCambioPendiente({
          name,
          value,
          type,
          checked,
          ...config,
        });
        return;
      }
    }

    aplicarCambioFormulario(name, value, type, checked);
  };

  const getRolesActivosUsuario = (usuarioItem) => {
    const roles = [];
    const rolPrincipal = String(usuarioItem?.perfil?.rol || '').trim().toLowerCase();
    if (rolPrincipal) roles.push(rolPrincipal);

    const asignaciones = Array.isArray(usuarioItem?.asignaciones) ? usuarioItem.asignaciones : [];
    asignaciones.forEach((asignacion) => {
      if (asignacion?.activo === false) return;
      const rolAsignacion = String(asignacion?.rol || '').trim().toLowerCase();
      if (rolAsignacion) roles.push(rolAsignacion);
    });

    return Array.from(new Set(roles));
  };

  const formatearRolCargoProfesional = (rol) => {
    const labels = {
      iiisyp: 'Instituto I.I.S. y P.',
      director: 'Director de Carrera',
      jefe_estudios: 'Jefe de Estudios',
      docente: 'Docente',
    };
    const rolNormalizado = String(rol || '').trim().toLowerCase();
    return labels[rolNormalizado] || String(rol || '').replace(/_/g, ' ');
  };

  const formatearRolesCargoProfesional = (roles) => {
    const rolesLista = Array.isArray(roles) ? roles : [];
    return rolesLista
      .filter(Boolean)
      .map(formatearRolCargoProfesional)
      .join('\n');
  };

  const usuarioTieneRol = (usuarioItem, rolBuscado) =>
    getRolesActivosUsuario(usuarioItem).includes(String(rolBuscado || '').trim().toLowerCase());

  // Solo docente: Tiempo Completo, Medio Tiempo u Horario. Con un cargo: solo Horario.
  // La dedicación exclusiva no va en la ficha (es del Director sin docencia, que no la tiene).
  const getDedicacionesPermitidas = (usuarioItem) => {
    if (!usuarioItem) return [];
    const tieneCargo = ROLES_CARGO.some((rol) => usuarioTieneRol(usuarioItem, rol));
    return tieneCargo ? DEDICACIONES_HORARIO : DEDICACIONES_FICHA;
  };

  const getDedicacionPermitidaParaUsuario = (usuarioItem, dedicacionActual = '') => (
    getDedicacionesPermitidas(usuarioItem).includes(String(dedicacionActual || '')) ? dedicacionActual : ''
  );

  const usuarioTienePerfilDocente = (usuarioItem) => Boolean(
    usuarioItem?.perfil?.docente_id || usuarioItem?.perfil?.docente
  );

  const usuarioEsElegibleParaNuevoDocente = (usuarioItem, docentesBase = docentes) => {
    const tieneRolDocente = usuarioTieneRol(usuarioItem, 'docente');
    const tienePerfilDocente = usuarioTienePerfilDocente(usuarioItem);
    const yaTieneDocente = docentesBase.some((docente) => String(docente.user_id || docente.usuario_id || '') === String(usuarioItem.id || ''));
    return tieneRolDocente && !tienePerfilDocente && !yaTieneDocente;
  };

  const getNombreCarreraUsuario = (carreraValue) => {
    if (!carreraValue) return '';
    if (typeof carreraValue === 'object') {
      return String(carreraValue.nombre || carreraValue.codigo || carreraValue.name || '').trim();
    }
    return carreras.find((carrera) => String(carrera.id) === String(carreraValue))?.nombre || String(carreraValue).trim();
  };

  const getCarreraIdValue = (carreraValue) => {
    if (!carreraValue) return '';
    if (typeof carreraValue === 'object') {
      return carreraValue.id || carreraValue.pk || carreraValue.value || '';
    }
    const carreraPorCodigoONombre = carreras.find((carrera) => (
      String(carrera.codigo || '').trim() === String(carreraValue).trim()
      || String(carrera.nombre || '').trim() === String(carreraValue).trim()
    ));
    return carreraPorCodigoONombre?.id || carreraValue;
  };

  const getCarreraDocenteUsuario = (usuarioItem) => {
    if (!usuarioItem) return '';

    const asignaciones = Array.isArray(usuarioItem?.asignaciones) ? usuarioItem.asignaciones : [];
    const asignacionDocente = asignaciones.find((asignacion) => (
      asignacion?.activo !== false
      && String(asignacion?.rol || '').trim().toLowerCase() === 'docente'
      && (asignacion?.carrera || asignacion?.carrera_id)
    ));

    return getCarreraIdValue(
      asignacionDocente?.carrera
      || asignacionDocente?.carrera_id
      || usuarioItem?.perfil?.carrera
      || ''
    );
  };

  const getCarrerasUsuario = (usuarioItem) => {
    if (!usuarioItem) return [];

    const nombresCarrera = [];
    const carreraPrincipal = getNombreCarreraUsuario(usuarioItem?.perfil?.carrera);
    if (carreraPrincipal) nombresCarrera.push(carreraPrincipal);

    const asignaciones = Array.isArray(usuarioItem?.asignaciones) ? usuarioItem.asignaciones : [];
    asignaciones.forEach((asignacion) => {
      if (asignacion?.activo === false) return;
      const carreraAsignacion = getNombreCarreraUsuario(
        asignacion?.carrera || asignacion?.carrera_id || asignacion?.carrera_nombre || asignacion?.carrera_codigo
      );
      if (carreraAsignacion) nombresCarrera.push(carreraAsignacion);
    });

    return Array.from(new Set(nombresCarrera));
  };

  const getCiUsuario = (usuarioItem, fallback = '') => (
    usuarioItem?.ci
    || usuarioItem?.perfil?.ci
    || usuarioItem?.perfil?.docente_ci
    || fallback
    || ''
  );

  const handleSeleccionUsuario = (usuarioItem) => {
    const usuarioTieneRolGestion = ['director', 'jefe_estudios', 'iiisyp'].some((rol) => usuarioTieneRol(usuarioItem, rol));
    // Limpiar el error de selección de usuario al elegir uno (regla global)
    setErrors((prev) => {
      if (!prev.user) return prev;
      const next = { ...prev };
      delete next.user;
      return next;
    });
    setBuscarUsuario(`${usuarioItem.first_name || ''} ${usuarioItem.last_name || ''}`.trim());
    setFormData((prev) => ({
      ...prev,
      user: usuarioItem.id,
      nombre_completo: buildNombreCompleto(usuarioItem.first_name, usuarioItem.last_name),
      ci: getCiUsuario(usuarioItem, prev.ci),
      cargo_profesional: formatearRolesCargoProfesional(getRolesActivosUsuario(usuarioItem)) || usuarioItem.perfil?.rol_display || usuarioItem.perfil?.rol || '',
      email: usuarioItem.email || '',
      username: usuarioItem.username || '',
      password: '',
      password_confirm: '',
      carrera: getCarreraDocenteUsuario(usuarioItem) || prev.carrera || '',
      dedicacion: getDedicacionPermitidaParaUsuario(usuarioItem, prev.dedicacion),
    }));
    setShowAutocomplete(false);
    setShowUserInfo(true);

    // limpiar timeout previo
    if (gestionWarningTimeoutRef.current) {
      clearTimeout(gestionWarningTimeoutRef.current);
      gestionWarningTimeoutRef.current = null;
    }
    setShowGestionWarningVisible(false);
    setGestionWarningInfoKey(null);

    // si el usuario tiene rol de gestión, mostrar la advertencia tras 1s con la misma animación visual
    if (usuarioTieneRolGestion) {
      gestionWarningTimeoutRef.current = setTimeout(() => {
        setGestionWarningInfoKey(Date.now());
        setShowGestionWarningVisible(true);
      }, 1000);
    }
  };

  const validarCiUnicoLocal = (ciValor, docenteIdExcluir = null) => {
    const ciNormalizado = (ciValor || '').trim().toLowerCase();
    if (!ciNormalizado) return false;
    return docentes.some((docente) => {
      if (docenteIdExcluir && docente.id === docenteIdExcluir) return false;
      return String(docente.ci || '').trim().toLowerCase() === ciNormalizado;
    });
  };

  const getFechaCreacionUsuario = (usuarioItem) => {
    const rawDate = usuarioItem?.created_at || usuarioItem?.date_joined || usuarioItem?.fecha_creacion || usuarioItem?.created;
    const timestamp = rawDate ? new Date(rawDate).getTime() : NaN;
    return Number.isNaN(timestamp) ? Number(usuarioItem?.id || 0) : timestamp;
  };

  const usuariosFiltradosAutocomplete = usuarios.filter((usuarioItem) => {
    if (!usuarioEsElegibleParaNuevoDocente(usuarioItem)) return false;

    const query = buscarUsuario.trim().toLowerCase();
    if (!query) return true;
    const nombre = `${usuarioItem.first_name || ''} ${usuarioItem.last_name || ''}`.trim().toLowerCase();
    const correo = String(usuarioItem.email || '').toLowerCase();
    const username = String(usuarioItem.username || '').toLowerCase();
    return nombre.includes(query) || correo.includes(query) || username.includes(query);
  }).sort((a, b) => getFechaCreacionUsuario(b) - getFechaCreacionUsuario(a));
  const usuariosAutocomplete = buscarUsuario.trim()
    ? usuariosFiltradosAutocomplete
    : usuariosFiltradosAutocomplete.slice(0, 5);

  const usuarioSeleccionado = usuarios.find((usuarioItem) => String(usuarioItem.id) === String(formData.user || ''));
  const usuarioFormularioTieneRolGestion = ROLES_CARGO.some((rol) =>
    usuarioTieneRol(usuarioSeleccionado, rol)
  );
  const usuarioFormularioTieneRolDirector = usuarioTieneRol(usuarioSeleccionado, 'director');
  const usuarioFormularioTieneRolJefeEstudios = usuarioTieneRol(usuarioSeleccionado, 'jefe_estudios');
  const usuarioFormularioTieneRolIisyp = usuarioTieneRol(usuarioSeleccionado, 'iiisyp');
  const usuarioFormularioTieneRolDocente = usuarioTieneRol(usuarioSeleccionado, 'docente');
  const usuarioFormularioSoloDirector = usuarioFormularioTieneRolDirector
    && !usuarioFormularioTieneRolDocente
    && !usuarioFormularioTieneRolJefeEstudios
    && !usuarioFormularioTieneRolIisyp;
  const dedicacionEsTiempoHorario = DEDICACIONES_HORARIO.includes(String(formData.dedicacion || ''));
  const esDedicacionExclusiva = formData.dedicacion === 'dedicacion_exclusiva';
  const mostrarAdvertenciaGestion = usuarioFormularioTieneRolGestion && showGestionWarningVisible && !dedicacionEsTiempoHorario && !esDedicacionExclusiva;
  // Nuevo docente sin usuario seleccionado: sin opciones (el campo queda deshabilitado).
  // Al editar una ficha sin usuario cargado se ofrecen todas las de la ficha.
  const opcionesDedicacion = (usuarioSeleccionado || isCreating
    ? getDedicacionesPermitidas(usuarioSeleccionado)
    : DEDICACIONES_FICHA
  ).map((value) => ({ value, label: ETIQUETAS_DEDICACION[value] }));
  const carrerasUsuarioSeleccionado = getCarrerasUsuario(usuarioSeleccionado);
  const carreraSeleccionadaNombre = carrerasUsuarioSeleccionado.length > 0
    ? carrerasUsuarioSeleccionado.join('\n')
    : carreras.find((carrera) => String(carrera.id) === String(formData.carrera || ''))?.nombre || '';
  const mensajeIncompatibilidadGestion = 'Los cargos de gestión solo son compatibles con docencia a Tiempo Horario';
  const mensajesInfoEdicion = [
    {
      titulo: 'Datos de identidad',
      subtitulo: 'Nombre, CI, Email',
      contenido: 'Se gestionan exclusivamente desde "Usuarios" para mantener consistencia entre todos los roles del usuario.',
    },
    {
      titulo: 'Datos contractuales',
      subtitulo: 'Carrera, Fecha de Ingreso',
      contenido: 'Editables solo si el docente no tiene horas declaradas. Si existe historial de fondo de tiempo, estos campos se bloquean para preservar la trazabilidad de los cálculos ya validados (Art. 11-12, Reglamento de Control y Distribución del Tiempo).',
    },
  ];
  const infoEdicionActual = mensajesInfoEdicion[infoEdicionIndex];
  const moverInfoEdicion = (direction) => {
    setInfoEdicionDirection(direction);
    setInfoEdicionIndex((prev) => {
      if (direction === 'left') {
        return prev === 0 ? mensajesInfoEdicion.length - 1 : prev - 1;
      }
      return (prev + 1) % mensajesInfoEdicion.length;
    });
  };
  const horasSemanalesDerivadas = horasSemanalesDedicacion(formData.dedicacion) || '';

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Iniciando submit...', formData);
    setIsSubmitting(true);
    setErrors({});

    if (!formData.user) {
      setErrors((prev) => ({ ...prev, user: ['Debe seleccionar un usuario existente.'] }));
      toast.error('Debe seleccionar un usuario para vincular el docente.');
      setIsSubmitting(false);
      return;
    }

    if (!formData.carrera) {
      setErrors((prev) => ({ ...prev, carrera: ['Debe seleccionar una carrera.'] }));
      toast.error('Debe seleccionar una carrera para el docente.');
      setIsSubmitting(false);
      return;
    }

    if (!formData.condicion) {
      setErrors((prev) => ({ ...prev, condicion: ['Debe seleccionar una condicion.'] }));
      toast.error('Debe seleccionar una condicion para el docente.');
      setIsSubmitting(false);
      return;
    }

    const ciNormalizado = (formData.ci || '').trim();
    if (ciNormalizado && validarCiUnicoLocal(ciNormalizado)) {
      setErrors((prev) => ({ ...prev, ci: ['Ya existe un docente con este C.I.'] }));
      toast.error('Ya existe un docente con este C.I.');
      setIsSubmitting(false);
      return;
    }

    if (usuarioFormularioTieneRolDocente && formData.dedicacion === 'dedicacion_exclusiva') {
      setErrors((prev) => ({ ...prev, dedicacion: ['Los usuarios con rol docente deben registrar dedicacion a Tiempo Horario.'] }));
      toast.error('Los usuarios con rol docente deben registrar dedicacion a Tiempo Horario.');
      setIsSubmitting(false);
      return;
    }

    if (usuarioFormularioTieneRolGestion && usuarioFormularioTieneRolDocente && ['tiempo_completo', 'medio_tiempo'].includes(String(formData.dedicacion || ''))) {
      setErrors((prev) => ({ ...prev, dedicacion: [mensajeIncompatibilidadGestion] }));
      toast.error(mensajeIncompatibilidadGestion);
      setIsSubmitting(false);
      return;
    }

    const errorFechaIngreso = validarFechaIngreso(formData.fecha_ingreso);
    if (errorFechaIngreso) {
      setErrors((prev) => ({ ...prev, fecha_ingreso: [errorFechaIngreso] }));
      toast.error(errorFechaIngreso);
      setIsSubmitting(false);
      return;
    }

    try {
      const nombresSplit = splitNombreCompleto(formData.nombre_completo);
      const payload = { ...formData };
      payload.nombres = nombresSplit.nombres;
      payload.apellido_paterno = nombresSplit.apellido_paterno;
      payload.apellido_materno = nombresSplit.apellido_materno;
      payload.ci = ciNormalizado;
      delete payload.nombre_completo;
      if (payload.email === '') payload.email = null;
      if (payload.telefono === '') payload.telefono = null;
      payload.user = Number(formData.user);

      console.log('Enviando payload:', payload);
      const response = await api.post('/docentes/', payload);
      console.log('Docente creado exitosamente');
      if (abrirDesdeUsuarios) {
        const docenteCreado = response?.data;
        if (docenteCreado?.id) {
          const nombreCreado = [
            docenteCreado?.nombres || payload.nombres || '',
            docenteCreado?.apellido_paterno || payload.apellido_paterno || '',
            docenteCreado?.apellido_materno || payload.apellido_materno || '',
          ].filter(Boolean).join(' ').trim();
          sessionStorage.setItem('docenteRetornadoDesdeUsuarios', JSON.stringify({
            id: docenteCreado.id,
            nombre_completo: nombreCreado,
            ci: docenteCreado.ci || payload.ci || '',
            carrera: formData.carrera || '',
          }));
          sessionStorage.removeItem('vincularDocentePendiente');
        }
      }

      if (abrirDesdeUsuarios) {
        toast.success('Docente creado. Volviendo a Crear Usuario...');
        setTimeout(() => {
          sessionStorage.removeItem('abrirModalDesdeUsuarios');
          sessionStorage.removeItem('datosCrearDocente');
          navigate('/usuarios');
        }, 800);
      } else {
        toast.success('Docente creado correctamente');
        setDocentes((prev) => [response.data, ...prev]);
        setUsuarios((prev) => prev.filter((usuarioItem) => String(usuarioItem.id) !== String(payload.user)));
        setIsCreating(false);
      }
    } catch (err) {
      console.error('Error al crear docente:', err);
      console.error('Response data:', err.response?.data);
      console.error('Response status:', err.response?.status);
      const apiErrors = err.response?.data;
      if (apiErrors) {
        setErrors(normalizeErrors(apiErrors));
        toast.error(getBackendErrorMessage(apiErrors, 'Error al crear docente'));
      } else {
        toast.error('Error al crear docente: ' + (err.message || 'Error desconocido'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    if (!formData.carrera) {
      setErrors((prev) => ({ ...prev, carrera: ['Debe seleccionar una carrera.'] }));
      toast.error('Debe seleccionar una carrera para el docente.');
      setIsSubmitting(false);
      return;
    }

    if (usuarioFormularioTieneRolDocente && formData.dedicacion === 'dedicacion_exclusiva') {
      setErrors((prev) => ({ ...prev, dedicacion: ['Los usuarios con rol docente deben registrar dedicacion a Tiempo Horario.'] }));
      toast.error('Los usuarios con rol docente deben registrar dedicacion a Tiempo Horario.');
      setIsSubmitting(false);
      return;
    }

    if (usuarioFormularioTieneRolGestion && usuarioFormularioTieneRolDocente && ['tiempo_completo', 'medio_tiempo'].includes(String(formData.dedicacion || ''))) {
      setErrors((prev) => ({ ...prev, dedicacion: [mensajeIncompatibilidadGestion] }));
      toast.error(mensajeIncompatibilidadGestion);
      setIsSubmitting(false);
      return;
    }

    if (!formData.condicion) {
      setErrors((prev) => ({ ...prev, condicion: ['Seleccione la condición (titular o invitado).'] }));
      toast.error('Seleccione la condición (titular o invitado).');
      setIsSubmitting(false);
      return;
    }

    const errorFechaIngreso = validarFechaIngreso(formData.fecha_ingreso);
    if (errorFechaIngreso) {
      setErrors((prev) => ({ ...prev, fecha_ingreso: [errorFechaIngreso] }));
      toast.error(errorFechaIngreso);
      setIsSubmitting(false);
      return;
    }

    try {
      const nombresSplit = splitNombreCompleto(
        formData.nombre_completo || buildNombreCompleto(
          formData.nombres,
          formData.apellido_paterno,
          formData.apellido_materno
        )
      );
      const payload = { ...formData };
      payload.nombres = nombresSplit.nombres;
      payload.apellido_paterno = nombresSplit.apellido_paterno;
      payload.apellido_materno = nombresSplit.apellido_materno;
      delete payload.cargo_profesional;
      delete payload.nombre_completo;
      if (usuarioFormularioSoloDirector) {
        payload.dedicacion = 'dedicacion_exclusiva';
      }
      if (payload.email === '') payload.email = null;
      if (payload.telefono === '') payload.telefono = null;

      const response = await api.put(`/docentes/${docenteSeleccionado.id}/`, payload);
      const actualizado = response.data;
      // Actualizar estado local inmediatamente
      setDocentes((prev) => prev.map((d) => (d.id === actualizado.id ? actualizado : d)));
      toast.success('Docente actualizado correctamente');
      setShowModal(false);
      setDocenteSeleccionado(actualizado);
      // Sincronizar con backend por si hay otros cambios
      cargarDocentes();
    } catch (err) {
      console.error(err);
      const apiErrors = err.response?.data;
      if (apiErrors) {
        setErrors(normalizeErrors(apiErrors));
        toast.error(getBackendErrorMessage(apiErrors, 'Error al actualizar docente'));
      } else {
        toast.error('Error al actualizar: ' + (err.message || 'Error desconocido'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const eliminarDocente = (docente) => {
    setDocenteToDelete(docente);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDocenteToDelete(null);
    setDeleteConfirmText('');
  };

  const confirmarEliminar = async () => {
    if (!docenteToDelete) return;
    if (deleteConfirmText !== docenteToDelete.nombre_completo) {
      toast.error('Debes escribir exactamente el nombre del docente para confirmar');
      return;
    }
    try {
      await api.delete(`/docentes/${docenteToDelete.id}/`);
      toast.success('Docente eliminado correctamente');
      cargarDocentes();
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar docente:', err);
      
      // Capturar mensaje de error específico del backend
      let errorMessage = 'Error al eliminar el docente';
      
      if (err.response && err.response.data && err.response.data.error) {
        // Backend devolvió un error específico
        errorMessage = err.response.data.error;
      } else if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast.error(getBackendErrorMessage(err.response?.data, errorMessage));
    }
  };

  // iiisyp es solo lectura: solo superuser y director pueden crear/editar/eliminar
  const esAdmin = () => user?.is_superuser || activeRole === 'director';
  // Editar y eliminar fichas: solo el superusuario (igual que el backend).
  const esSuperusuario = Boolean(user?.is_superuser);
  const docenteVinculadoAUsuario = Boolean(docenteSeleccionado?.usuario_id);
  // Misma regla que el backend: con historial (fondo presentado o informes) la
  // ficha queda fija; con fondos, cargas o saldos la carrera no cambia.
  const docenteTieneHistorial = Boolean(docenteSeleccionado?.tiene_historial);
  const docenteTieneRegistros = Boolean(docenteSeleccionado?.tiene_registros);
  const tooltipBloqueoHistorial = 'No editable: el docente tiene un Fondo de Tiempo presentado o informes';
  const tooltipBloqueoCarrera = 'No editable: el docente tiene fondos, cargas o saldos en su carrera';
  const tooltipDatosUsuarios = 'Estos datos se gestionan desde Usuarios';
  const estiloBloqueado = CAMPO_BLOQUEADO;
  const estiloAdvertenciaEditable = '!ring-amber-300';

  const handleEditarEnUsuarios = () => {
    const userId = docenteSeleccionado?.usuario_id || docenteSeleccionado?.user_id;
    if (!userId) {
      toast.error('Este docente no tiene un usuario vinculado.');
      return;
    }

    sessionStorage.setItem('datosEditarUsuario', JSON.stringify({ userId }));
    setShowModal(false);
    navigate('/usuarios');
  };

  const docentesFiltrados = (() => {
    let result = docentes;

    if (selectedCarrera) {
      result = result.filter((docente) => String(docente?.carrera_id || '') === String(selectedCarrera));
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim();
      result = result.filter((docente) => {
        const nombre = `${docente.nombres || ''} ${docente.apellido_paterno || ''} ${docente.apellido_materno || ''}`
          .toLowerCase()
          .trim();
        const ci = String(docente.ci || '').toLowerCase();
        return nombre.includes(searchLower) || ci.includes(searchLower);
      });
    }

    return result;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">
            Cargando docentes...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className={`${BLOQUE} p-6 max-w-md w-full text-center`}>
          <p className="text-red-600 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  // El total sigue a la carrera elegida (al inicio, todas las carreras).
  const docentesDeCarrera = selectedCarrera
    ? docentes.filter((docente) => String(docente?.carrera_id || '') === String(selectedCarrera))
    : docentes;
  const totalActivos = docentesDeCarrera.filter((docente) => docente.activo).length;
  const nombreCarreraElegida = carreras.find((carrera) => String(carrera.id) === String(selectedCarrera))?.nombre;
  // La carrera solo la ve el superusuario (con "Todas las carreras"); los demás roles solo
  // ven los docentes de su carrera, así que repetirla es información de más.
  const tituloCarreraTotal = esSuperusuario ? (nombreCarreraElegida || 'Todas las carreras') : null;

  const { paginaActual, totalPaginas, itemsPagina: docentesPagina } = paginar(docentesFiltrados, pagina, vista);
  const irAPagina = (nuevaPagina) => {
    setPagina(nuevaPagina);
    // Salto inmediato (no suave) al inicio de la lista: la página nueva entra ya a la vista
    // con su animación; con el desplazamiento suave la animación terminaba antes de llegar.
    listaRef.current?.scrollIntoView({ block: 'start' });
  };

  // Columnas de la vista de lista (con o sin la de acciones).
  const columnasLista = esAdmin()
    ? 'xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1.6fr)_6.5rem_8.5rem_minmax(0,1.1fr)_13rem]'
    : 'xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1.6fr)_6.5rem_8.5rem_minmax(0,1.1fr)]';

  // Datos que muestran las dos vistas de cada docente.
  const infoDocente = (docente) => {
    const vinculo = docente.vinculos?.[0];
    return {
      nombre: docente.usuario_nombre || docente.nombre_completo,
      datos: [
        { label: 'Categoría', valor: ETIQUETAS_CATEGORIA[vinculo?.categoria] || '—' },
        { label: 'Dedicación', valor: vinculo ? (ETIQUETAS_DEDICACION[vinculo.dedicacion] || vinculo.dedicacion) : '—' },
        // Sin cargo de gestión (Director, Jefe de Estudios, Instituto) el docente solo tiene el de docente.
        { label: 'Cargo', valor: obtenerRolesDocente(docente) || 'Docente' },
      ],
      bloqueoEditar: Boolean(docente?.tiene_historial),
      bloqueoEliminar: Boolean(docente?.tiene_registros),
    };
  };

  // Acciones de cada docente: el Director ve la ficha; el superusuario edita (sin
  // historial) y elimina (sin fondos, cargas ni saldos).
  const accionesDocente = (docente, info) => {
    if (!esAdmin()) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {!esSuperusuario && (
          <button
            type="button"
            onClick={() => setFichaDocenteId(docente.id)}
            className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white`}
          >
            <FaEye size={14} />
            <span>Ver ficha</span>
          </button>
        )}
        {esSuperusuario && (
          <>
            <button
              type="button"
              onClick={() => !info.bloqueoEditar && abrirModalEditar(docente)}
              disabled={info.bloqueoEditar}
              className={`${BOTON} bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500`}
              title={info.bloqueoEditar ? 'Ficha fija: el docente tiene un Fondo de Tiempo presentado o informes' : 'Editar'}
            >
              <FaEdit size={14} />
              <span>Editar</span>
            </button>
            <button
              type="button"
              onClick={() => !info.bloqueoEliminar && eliminarDocente(docente)}
              disabled={info.bloqueoEliminar}
              className={`${BOTON} bg-red-400 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-400`}
              title={info.bloqueoEliminar ? 'No se puede eliminar: el docente tiene fondos, cargas o saldos' : 'Eliminar'}
            >
              <FaTrash size={13} />
              <span>Eliminar</span>
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-full px-3 sm:px-4 md:px-8 py-4 md:py-6 text-slate-800">
      <div className="space-y-4">
        {/* Bloque 1: encabezado con la acción y, al lado, el total (como el dashboard de fondos) */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className={`${BLOQUE} p-5 sm:p-6 flex flex-col`}>
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
                  <UsersIcon className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Gestión del personal docente
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">
                    Docentes
                  </h2>
                </div>
              </div>
              {esAdmin() && (
                <button
                  onClick={handleToggleCreateForm}
                  className={`${BOTON} w-full sm:w-auto sm:self-end mt-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Nuevo Docente</span>
                </button>
              )}
            </div>
          </div>

          {/* Total de la carrera elegida: rótulo y carrera arriba, el número a la derecha y
              activos / inactivos abajo. Al cambiar de carrera la carrera entra con un fundido
              y los números cuentan hasta el nuevo valor. */}
          <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Total docentes</p>
                {tituloCarreraTotal && (
                  <p
                    key={selectedCarrera || 'todas'}
                    className="animate-campo-entrada mt-1.5 text-sm font-semibold text-white leading-snug line-clamp-2"
                    title={tituloCarreraTotal}
                  >
                    {tituloCarreraTotal}
                  </p>
                )}
              </div>
              <span className="text-5xl font-bold tabular-nums leading-none">
                <NumeroAnimado valor={docentesDeCarrera.length} />
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <NumeroAnimado valor={totalActivos} singular="activo" plural="activos" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                <NumeroAnimado valor={docentesDeCarrera.length - totalActivos} singular="inactivo" plural="inactivos" />
              </span>
            </div>
          </div>
        </div>

        {/* Bloque 2: búsqueda y carrera */}
        <div className={`${BLOQUE} p-3 flex flex-wrap items-center gap-2 sm:gap-3`}>
          <CampoBusqueda value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nombre o C.I." />
          {/* Filtro de carrera: solo el superusuario ve todas las carreras */}
          {esSuperusuario && (
            <div className="min-w-0 flex-1 sm:flex-none sm:w-64">
              <FiltroDesplegable
                value={selectedCarrera}
                onChange={setSelectedCarrera}
                options={carreras.map((c) => ({ value: c.id, label: c.nombre }))}
                placeholder="Todas las carreras"
                ariaLabel="Filtrar por carrera"
                emptyText="No hay carreras que coincidan"
              />
            </div>
          )}
          <SelectorVista vista={vista} onCambiar={cambiarVista} className="ml-auto" />
        </div>

        {/* MODAL DE CREACION DE DOCENTE */}
        {isCreating && createPortal((
          <div
            className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center bg-blue-950/30 backdrop-blur-sm p-4"
            style={{ left: 'var(--fondo-sidebar-width, 0px)' }}
          >
            <div className="bg-azulado-50 rounded-3xl ring-1 ring-azulado-300 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                    Nuevo Docente
                  </h2>
                  {abrirDesdeUsuarios && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-azulado-100 text-blue-900 ring-1 ring-inset ring-azulado-300 flex items-center gap-2">
                      Volviendo a Crear Usuario
                    </span>
                  )}
                </div>
              </div>
              {/* Body */}
              <form id="crear-docente-form" onSubmit={handleCreateSubmit} noValidate className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 transition-all duration-300 ease-out">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className={LABEL_CAMPO}>
                      Buscar nombre o usuario
                    </label>
                    <div ref={userSearchContainerRef} className="relative overflow-visible">
                      <input
                        type="text"
                        value={buscarUsuario}
                        onFocus={() => {
                          // Limpiar el error del campo de inmediato al recibir foco (regla global)
                          if (errors.user) {
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.user;
                              return next;
                            });
                            setIsUserSearchPulsing(false);
                          }
                        }}
                        onMouseDown={(e) => {
                          // Comportamiento por pasos: si ya hay un usuario seleccionado,
                          // el primer click activa el modo de búsqueda sin borrar el texto;
                          // un segundo click borra el texto visible para comenzar a escribir.
                          if (formData.user) {
                            if (!searchMode) {
                              setSearchMode(true);
                              e.preventDefault();
                              // Guardar el input antes: dentro del setTimeout, e.currentTarget ya es null.
                              const el = e.currentTarget;
                              setTimeout(() => {
                                el.focus();
                                el.setSelectionRange(el.value.length, el.value.length);
                              }, 0);
                              return;
                            }
                            // si ya estamos en searchMode, el segundo click limpia el texto y abre autocompletado
                            setBuscarUsuario('');
                            setShowAutocomplete(true);
                            return;
                          }
                          // si no hay usuario seleccionado, entrar directamente en modo búsqueda
                          setSearchMode(true);
                          setShowAutocomplete(true);
                        }}
                        onChange={(e) => {
                          setBuscarUsuario(e.target.value);
                          setShowAutocomplete(true);
                        }}
                        placeholder="Buscar por nombre, correo o usuario..."
                        className={`${CAMPO} !bg-azulado-100 ${errors.user ? CAMPO_ERROR : CAMPO_NORMAL} ${isUserSearchPulsing ? 'animate-field-error-shake' : ''}`}
                      />
                      {showAutocomplete && buscarUsuario !== null && (
                        <>
                          <style>{`@keyframes slideDown{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}} .slide-down{animation:slideDown 220ms ease-out forwards}`}</style>
                          <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-xl border-2 border-[#3A56AF] bg-white max-h-64 overflow-auto shadow-xl p-2 slide-down">
                            {usuariosAutocomplete.map((usuarioItem) => (
                              <button
                                key={usuarioItem.id}
                                type="button"
                                onClick={() => handleSeleccionUsuario(usuarioItem)}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-[#2C4AAE] hover:text-white"
                              >
                                <div className="font-medium">
                                  {`${usuarioItem.first_name || ''} ${usuarioItem.last_name || ''}`.trim() || usuarioItem.username}
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-slate-600">
                        ¿No encuentras al usuario?{' '}
                        <button
                          type="button"
                          onClick={handleCrearUsuarioDesdeNuevoDocente}
                          className="text-blue-900 font-semibold hover:underline"
                        >
                          Crea uno nuevo
                        </button>
                      </p>
                      {errors.user && (
                        <p className="text-xs text-red-600">{Array.isArray(errors.user) ? errors.user[0] : errors.user}</p>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div
                      className={`overflow-hidden transition-all duration-500 ease-out ${
                        formData.user || showUserInfo
                          ? 'max-h-[260px] opacity-100 translate-y-0'
                          : 'max-h-0 opacity-0 -translate-y-1 pointer-events-none'
                      }`}
                    >
                      <div key={userInfoKey} className="slide-down rounded-2xl bg-white/70 ring-1 ring-inset ring-azulado-300 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          <div>
                            <label className={LABEL_CAMPO}>
                              Cargo profesional
                            </label>
                            <div className="w-full min-h-[2.75rem] whitespace-pre-line px-4 py-2.5 rounded-3xl text-sm text-slate-500 !bg-slate-100 ring-1 ring-inset ring-azulado-300 cursor-not-allowed">
                              {formData.cargo_profesional || ''}
                            </div>
                          </div>
                          <div>
                            <label className={LABEL_CAMPO}>
                              Carrera
                            </label>
                            <div className="w-full min-h-[2.75rem] whitespace-pre-line px-4 py-2.5 rounded-3xl text-sm text-slate-500 !bg-slate-100 ring-1 ring-inset ring-azulado-300 cursor-not-allowed">
                              {carreraSeleccionadaNombre}
                            </div>
                          </div>
                          <InputField
                            label="C.I."
                            name="ci_info"
                            value={formData.ci || ''}
                            onChange={() => {}}
                            disabled
                            inputClassName="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <FechaIngresoPicker
                    value={formData.fecha_ingreso}
                    onChange={(val) => setFormData(prev => ({ ...prev, fecha_ingreso: val }))}
                    error={errors.fecha_ingreso}
                  />
                  <InputField
                    label="Telefono"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    error={errors.telefono}
                    maxLength={10}
                    inputMode="numeric"
                  />
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
                    {!usuarioFormularioSoloDirector && (
                      <SelectConDropdown
                        label="Dedicacion"
                        name="dedicacion"
                        value={formData.dedicacion}
                        onChange={handleChange}
                        options={opcionesDedicacion}
                        disabled={!usuarioSeleccionado}
                        lockTooltip="Seleccione primero un usuario"
                        menuClassName="overflow-visible"
                        error={errors.dedicacion}
                      />
                    )}
                    <SelectConDropdown
                      label="Categoria"
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleChange}
                      options={[
                        { value: 'catedratico', label: 'Catedratico' },
                        { value: 'adjunto', label: 'Adjunto' },
                        { value: 'asistente', label: 'Asistente' },
                      ]}
                      error={errors.categoria}
                    />
                    <SelectConDropdown
                      label="Condicion"
                      name="condicion"
                      value={formData.condicion}
                      onChange={handleChange}
                      options={[
                        { value: 'titular', label: 'Titular' },
                        { value: 'invitado', label: 'Invitado' },
                      ]}
                      error={errors.condicion}
                    />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-[minmax(0,267px)_1fr] gap-4 items-start">
                    <div>
                      {!esDedicacionExclusiva && !usuarioFormularioSoloDirector && (
                        <>
                          <InputField
                            label="Horas Semanales"
                            name="horas_contrato_semanales"
                            value={horasSemanalesDerivadas}
                            onChange={() => {}}
                            disabled
                            inputClassName="max-w-[267px]"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            {describirDedicacion(formData.dedicacion)}
                            {(formData.dedicacion === 'tiempo_completo' || formData.dedicacion === 'medio_tiempo')
                              && 'Horas semanales fijas por reglamento.'}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="space-y-3">
                    <div
                      className={`overflow-hidden transition-all duration-500 ease-out ${
                        mostrarAdvertenciaGestion
                          ? 'max-h-[180px] opacity-100 translate-y-0'
                          : 'max-h-0 opacity-0 -translate-y-1 pointer-events-none'
                      }`}
                    >
                      {mostrarAdvertenciaGestion && (
                        <div
                          key={gestionWarningInfoKey}
                          className="slide-down rounded-2xl p-3.5 bg-blue-50 ring-1 ring-inset ring-blue-200"
                        >
                          <div className="flex items-start gap-3">
                            <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-800" />
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-blue-900">
                                Cargos de gestión solo compatibles con docencia a Tiempo Horario.
                              </p>
                              <p className="text-xs leading-5 text-blue-800">
                                Usuarios con rol de Director, Jefe de Estudios o Instituto solo pueden usar Tiempo Horario: 16, 24, 40 o 48 hrs/mes. TC y MT no aplican.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className={`overflow-hidden transition-all duration-500 ease-out ${
                        showDedicacionInfo && formData.dedicacion
                          ? 'max-h-[280px] opacity-100 translate-y-0'
                          : 'max-h-0 opacity-0 -translate-y-1 pointer-events-none'
                      }`}
                    >
                      {showDedicacionInfo && formData.dedicacion && (
                        <div
                          key={dedicacionInfoKey}
                          className={`slide-down rounded-2xl p-3.5 ${dedicacionStyles[formData.dedicacion]?.bg} ${dedicacionStyles[formData.dedicacion]?.accent}`}
                        >
                          <div className="flex items-start gap-3">
                          <InfoIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${dedicacionStyles[formData.dedicacion]?.icon}`} />
                          <div>
                            <h5 className={`text-sm font-semibold ${dedicacionStyles[formData.dedicacion]?.title}`}>Informacion sobre Dedicacion</h5>
                            <p className={`text-xs leading-5 mt-1 ${dedicacionStyles[formData.dedicacion]?.text}`}>
                              {(() => {
                                const horas = calcularHorasEfectivas(formData.dedicacion, formData.fecha_ingreso, {
                                  tieneRolGestion: usuarioFormularioTieneRolGestion,
                                  diasFeriados: diasFeriadosGestion,
                                  fechaReferencia: fechaInicioGestion,
                                });
                                const antiguedad = calcularAntiguedad(formData.fecha_ingreso, fechaInicioGestion) ?? 0;
                                const label = ETIQUETAS_DEDICACION[formData.dedicacion] || formData.dedicacion;
                                if (formData.dedicacion === 'dedicacion_exclusiva') {
                                  return 'Docente con dedicacion exclusiva - exento de distribucion de tiempo';
                                }
                                if (horas !== null) {
                                  return `${label}: ${horas.toFixed(0)} horas efectivas anuales (${antiguedad} año${antiguedad !== 1 ? 's' : ''} de antigüedad, vacaciones calculadas según antigüedad).`;
                                }
                                return `${label}: complete la fecha de ingreso para calcular las horas efectivas.`;
                              })()}
                            </p>
                            {avisoFeriados && formData.dedicacion !== 'dedicacion_exclusiva' && (
                              <p className="text-xs leading-5 mt-1.5 font-semibold text-amber-700">
                                {avisoFeriados}
                              </p>
                            )}
                          </div>
                        </div>
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                </div>
              </form>
              {/* Footer */}
              <div className="px-6 py-4 [border-top:1px_solid_#B8C9E1] flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (abrirDesdeUsuarios) {
                      // Volver a usuarios si venimos desde alli
                      // Los datos se recuperaran automaticamente en GestionUsuarios
                      navigate('/usuarios');
                    } else {
                      setIsCreating(false);
                    }
                  }}
                  className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
                >
                  {abrirDesdeUsuarios ? 'Cancelar y volver' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  form="crear-docente-form"
                  disabled={isSubmitting}
                  className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-50`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {abrirDesdeUsuarios ? 'Guardando y volviendo...' : 'Guardando...'}
                    </>
                  ) : (
                    <>
                      {abrirDesdeUsuarios ? 'Guardar y volver a Usuario' : 'Guardar'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ), document.body)}

        {/* Bloque 3: docentes en tarjetas o en lista (15 por página en lista y 9 en tarjetas);
            al cambiar de vista, de carrera o de página entran escalonados */}
        <div ref={listaRef} className="scroll-mt-4" />
        {docentesFiltrados.length > 0 ? (
          vista === 'lista' ? (
            // Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas.
            <div key={`lista-${selectedCarrera}-${paginaActual}`} className={`${BLOQUE} p-2 sm:p-3`}>
              <div className={`hidden xl:grid ${columnasLista} gap-4 px-3 pt-3 pb-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 [border-bottom:1px_solid_#B8C9E1]`}>
                <span>Docente</span>
                <span>Contacto</span>
                <span>Categoría</span>
                <span>Dedicación</span>
                <span>Cargo</span>
                {esAdmin() && <span>Acciones</span>}
              </div>
              <div className="divide-y divide-azulado-300">
                {docentesPagina.map((docente, indice) => {
                  const info = infoDocente(docente);
                  return (
                    <div
                      key={docente.id}
                      style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                      className={`animate-fondo-entrada grid grid-cols-1 ${columnasLista} items-center gap-x-4 gap-y-3 px-3 py-4 rounded-2xl transition-colors ${
                        docente.activo ? 'hover:bg-azulado-100/70' : 'bg-red-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar nombre={info.nombre} size={`w-10 h-10 text-sm ${docente.activo ? '' : '!bg-red-700'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-blue-900 truncate" title={info.nombre}>{info.nombre}</div>
                          {(esSuperusuario || !docente.activo) && (
                            <div className="text-sm text-slate-600 truncate">
                              {!docente.activo && <span className="font-semibold text-red-700">Inactivo{esSuperusuario ? ' · ' : ''}</span>}
                              {esSuperusuario && (docente.carrera_nombre || 'Sin carrera')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 text-tabla text-slate-700">
                        <div className="tabular-nums">CI: {docente.ci}</div>
                        {docente.usuario_email && <div className="truncate text-slate-600" title={docente.usuario_email}>{docente.usuario_email}</div>}
                      </div>
                      {info.datos.map((dato) => (
                        <div key={dato.label} className="min-w-0 flex items-baseline justify-between gap-3 xl:block">
                          <span className="xl:hidden text-xs font-semibold text-blue-800">{dato.label}</span>
                          <span className="block text-tabla font-semibold text-slate-800 truncate" title={dato.valor}>{dato.valor}</span>
                        </div>
                      ))}
                      {accionesDocente(docente, info)}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div key={`tarjetas-${selectedCarrera}-${paginaActual}`} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {docentesPagina.map((docente, indice) => {
                const info = infoDocente(docente);
                return (
                  <div
                    key={docente.id}
                    style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                    className={`${BLOQUE} animate-fondo-entrada p-5 flex flex-col gap-4 ${docente.activo ? '' : '!bg-red-50/70 !ring-red-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar nombre={info.nombre} size={`w-12 h-12 ${docente.activo ? '' : '!bg-red-700'}`} />
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-blue-900 truncate" title={info.nombre}>{info.nombre}</h3>
                          {esSuperusuario && <p className="text-sm text-slate-600 truncate">{docente.carrera_nombre || 'Sin carrera'}</p>}
                        </div>
                      </div>
                      {!docente.activo && <PildoraInactivo />}
                    </div>

                    <div className="flex flex-wrap gap-2 min-w-0">
                      <Etiqueta>CI: {docente.ci}</Etiqueta>
                      {docente.usuario_email && (
                        <span className="min-w-0 max-w-full truncate"><Etiqueta>{docente.usuario_email}</Etiqueta></span>
                      )}
                    </div>

                    {/* En el celular cada dato va en su fila; desde sm, en tres columnas. */}
                    <dl className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-azulado-300 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 py-1 sm:py-2.5">
                      {info.datos.map((dato) => (
                        <div key={dato.label} className="min-w-0 px-3 py-1.5 sm:py-0 flex items-baseline justify-between gap-3 sm:block">
                          <dt className="text-xs font-semibold text-blue-800">{dato.label}</dt>
                          <dd className="sm:mt-0.5 text-[13px] font-semibold text-slate-800 truncate" title={dato.valor}>{dato.valor}</dd>
                        </div>
                      ))}
                    </dl>

                    {esAdmin() && (
                      <div className="mt-auto pt-3 [border-top:1px_solid_#B8C9E1]">
                        {accionesDocente(docente, info)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {docentes.length > 0 ? 'No hay docentes que coincidan' : 'No hay docentes registrados'}
            </h3>
            <p className="text-slate-600">
              {docentes.length > 0 ? 'Prueba otro nombre, C.I. o carrera' : 'Comienza agregando tu primer docente'}
            </p>
            {esAdmin() && docentes.length === 0 && (
              <button
                onClick={handleToggleCreateForm}
                className={`${BOTON} mt-6 px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
              >
                <PlusIcon className="w-5 h-5" />
                <span>Crear primer docente</span>
              </button>
            )}
          </div>
        )}

        <Paginacion
          paginaActual={paginaActual}
          totalPaginas={totalPaginas}
          onCambiar={irAPagina}
        />
      </div>

      {/* Ficha del docente (diseño de Mi cuenta): el Director completa teléfono y correo */}
      {fichaDocenteId && (
        <ModalFichaDocente
          docenteId={fichaDocenteId}
          puedeEditarContacto
          onClose={() => setFichaDocenteId(null)}
          onActualizado={(actualizado) => setDocentes((prev) => prev.map((item) => (
            item.id === actualizado.id ? { ...item, telefono: actualizado.telefono, email: actualizado.email } : item
          )))}
        />
      )}

      {/* Modal Crear/Editar */}
      {showModal && docenteSeleccionado && createPortal((
        <div
          className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center bg-blue-950/30 backdrop-blur-sm p-4 animate-fade-in"
          style={{ left: 'var(--fondo-sidebar-width, 0px)' }}
        >
          <div className="bg-azulado-50 rounded-3xl ring-1 ring-azulado-300 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                  Editar Docente
                </h2>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.activo}
                  aria-label={formData.activo ? 'Marcar docente como inactivo' : 'Marcar docente como activo'}
                  title={formData.activo ? 'Docente activo' : 'Docente inactivo'}
                  onClick={() => handleChange({
                    target: {
                      name: 'activo',
                      type: 'checkbox',
                      checked: !formData.activo,
                    },
                  })}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-all ${
                    formData.activo
                      ? 'border-blue-900 bg-blue-900'
                      : 'border-azulado-300 bg-azulado-200'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full shadow-md transition-transform ${
                      formData.activo
                        ? 'translate-x-7 bg-white'
                        : 'translate-x-1 bg-white'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Body */}
            <form id="editar-docente-form" onSubmit={handleUpdateSubmit} noValidate className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 transition-all duration-300 ease-out">
              <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InputField
                  label="Nombre completo"
                  name="nombre_completo"
                  value={formData.nombre_completo}
                  onChange={handleChange}
                  error={errors.nombre_completo || errors.nombres || errors.apellido_paterno || errors.apellido_materno}
                  readOnly
                  showLock
                  lockTooltip={tooltipDatosUsuarios}
                  inputClassName={estiloBloqueado}
                />
                {/* El C.I. se puede corregir mientras el docente no tenga historial (fondo presentado o informes). */}
                <InputField
                  label="Cedula de Identidad (CI)"
                  name="ci"
                  value={formData.ci}
                  onChange={handleChange}
                  error={errors.ci}
                  maxLength={20}
                  readOnly={docenteTieneHistorial}
                  showLock={docenteTieneHistorial}
                  lockTooltip={tooltipBloqueoHistorial}
                  inputClassName={docenteTieneHistorial ? estiloBloqueado : ''}
                />
                <InputField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  error={errors.email}
                  readOnly
                  showLock
                  lockTooltip={tooltipDatosUsuarios}
                  inputClassName={estiloBloqueado}
                />
                <SelectConDropdown
                  label="Carrera"
                  name="carrera"
                  value={formData.carrera}
                  onChange={handleChange}
                  options={carreras.map((c) => ({ value: c.id, label: c.nombre }))}
                  error={errors.carrera}
                  disabled={docenteTieneRegistros}
                  showLock={docenteTieneRegistros}
                  lockTooltip={tooltipBloqueoCarrera}
                  containerClassName={docenteTieneRegistros ? estiloBloqueado : ''}
                />
                {docenteTieneHistorial ? (
                  <div>
                    <label className={LABEL_CAMPO}>
                      <span className="inline-flex items-center gap-1.5">
                        <span>Fecha de Ingreso</span>
                        <span title={tooltipBloqueoHistorial} className="text-slate-400"><LockIcon /></span>
                      </span>
                    </label>
                    <div className="relative w-full rounded-full !bg-slate-100 ring-1 ring-inset ring-azulado-300">
                      <div className="w-full h-11 text-left pl-4 pr-2.5 rounded-full text-sm text-slate-500 flex items-center justify-between gap-2 cursor-not-allowed" title={tooltipBloqueoHistorial}>
                        <span className="truncate">{formatDisplayDate(formData.fecha_ingreso) || formData.fecha_ingreso}</span>
                        <span className="flex items-center justify-center h-6 w-6 rounded-md bg-slate-500 ring-1 ring-slate-500">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 10V7a4 4 0 00-8 0v3m-2 0h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z" />
                          </svg>
                        </span>
                      </div>
                    </div>
                    {errors.fecha_ingreso && <p className="text-xs text-red-600 mt-1">{errors.fecha_ingreso}</p>}
                  </div>
                ) : (
                  <FechaIngresoPicker
                    value={formData.fecha_ingreso}
                    onChange={(isoDate) => handleChange({
                      target: {
                        name: 'fecha_ingreso',
                        value: isoDate,
                        type: 'text',
                      },
                    })}
                    error={errors.fecha_ingreso}
                  />
                )}
                <InputField
                  label="Telefono"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  error={errors.telefono}
                  maxLength={10}
                  inputMode="numeric"
                />

                <SelectConDropdown
                  label="Categoria"
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleChange}
                  options={[
                    { value: 'catedratico', label: 'Catedratico' },
                    { value: 'adjunto', label: 'Adjunto' },
                    { value: 'asistente', label: 'Asistente' },
                  ]}
                  error={errors.categoria}
                  containerClassName={estiloAdvertenciaEditable}
                />
                {!usuarioFormularioSoloDirector && (
                  <SelectConDropdown
                    label="Dedicacion"
                    name="dedicacion"
                    value={formData.dedicacion}
                    onChange={handleChange}
                    options={opcionesDedicacion}
                    error={errors.dedicacion}
                    containerClassName={estiloAdvertenciaEditable}
                  />
                )}
                <SelectConDropdown
                  label="Condicion"
                  name="condicion"
                  value={formData.condicion}
                  onChange={handleChange}
                  options={OPCIONES_CONDICION}
                  error={errors.condicion}
                  containerClassName={estiloAdvertenciaEditable}
                />
                <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-center">
                  <div className="min-w-0">
                    {!usuarioFormularioSoloDirector && (
                      <InputField
                        label="Horas Semanales"
                        name="horas_contrato_semanales"
                        value={horasSemanalesDerivadas}
                        onChange={() => {}}
                        disabled
                      />
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {describirDedicacion(formData.dedicacion)}
                      {(formData.dedicacion === 'tiempo_completo' || formData.dedicacion === 'medio_tiempo')
                        && 'Horas semanales fijas por reglamento.'}
                    </p>
                  </div>
                </div>
                <div className="md:col-span-2 slide-down min-h-[180px] rounded-2xl bg-blue-50 p-4 ring-1 ring-inset ring-blue-200">
                  <div className="flex items-start gap-3">
                    <InfoIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-800" />
                    <div className="min-w-0 flex-1 space-y-3 text-sm leading-6 text-blue-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h5 className="font-bold uppercase tracking-wide text-blue-950">
                            Información de edición
                          </h5>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => moverInfoEdicion('left')}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue-900 ring-1 ring-inset ring-azulado-300 transition-colors hover:bg-azulado-200"
                            title="Mensaje anterior"
                            aria-label="Mensaje anterior"
                          >
                            <FaChevronLeft size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moverInfoEdicion('right')}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue-900 ring-1 ring-inset ring-azulado-300 transition-colors hover:bg-azulado-200"
                            title="Mensaje siguiente"
                            aria-label="Mensaje siguiente"
                          >
                            <FaChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                      <div
                        key={infoEdicionActual.titulo}
                        className={`min-h-[76px] ${infoEdicionDirection === 'left' ? 'slide-info-from-left' : 'slide-info-from-right'}`}
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                          {infoEdicionActual.subtitulo}
                        </p>
                        <p>
                          <span className="font-bold">{infoEdicionActual.titulo}:</span> {infoEdicionActual.contenido}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 [border-top:1px_solid_#B8C9E1] flex flex-col-reverse sm:flex-row justify-end gap-2">
                {docenteVinculadoAUsuario && infoEdicionIndex === 0 && (
                  <button
                    type="button"
                    onClick={handleEditarEnUsuarios}
                    className={`${BOTON} px-5 py-2.5 bg-white/70 text-blue-900 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100`}
                  >
                    Editar en Usuarios
                  </button>
                )}
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="editar-docente-form"
                disabled={isSubmitting}
                className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-50`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Actualizando...
                  </>
                ) : (
                  <>
                    Actualizar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {confirmacionDesactivarDocente && createPortal((
        <div
          className="fixed top-0 right-0 bottom-0 z-[75] flex items-center justify-center p-4"
          style={{ left: 'var(--fondo-sidebar-width, 0px)' }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setConfirmacionDesactivarDocente(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-amber-500/80 bg-white shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-amber-400/70 bg-gradient-to-r from-amber-300 via-amber-100 to-amber-50">
              <h4 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <span>{confirmacionDesactivarDocente.tieneHistorial ? '⚠️' : 'ℹ️'}</span>
                Confirmar desactivación
              </h4>
            </div>
            <div className="px-5 py-4 text-slate-700">
              {confirmacionDesactivarDocente.tieneHistorial ? (
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  Este docente tiene horas declaradas o fondos validados.{'\n'}
                  Al desactivarlo: se bloquean nuevas declaraciones,{'\n'}
                  pero su historial se conserva para auditoría.{'\n'}
                  ¿Confirmar desactivación?
                </p>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  Al desactivar este docente no podrá declarar horas{'\n'}
                  ni aparecer en listados activos hasta que sea reactivado.{'\n'}
                  ¿Confirmar?
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setConfirmacionDesactivarDocente(null)}
                className="px-4 py-2 rounded-lg font-semibold text-slate-700 border border-slate-300 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmacionDesactivarDocente(null);
                  aplicarCambioFormulario('activo', '', 'checkbox', false);
                }}
                className="px-4 py-2 rounded-lg font-bold text-white bg-amber-600 hover:bg-amber-700"
              >
                Desactivar
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {confirmacionCambioPendiente && createPortal((
        <div
          className="fixed top-0 right-0 bottom-0 z-[75] flex items-center justify-center p-4"
          style={{ left: 'var(--fondo-sidebar-width, 0px)' }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setConfirmacionCambioPendiente(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-amber-500/80 bg-white shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-amber-400/70 bg-gradient-to-r from-amber-300 via-amber-100 to-amber-50">
              <h4 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <span>⚠️</span>
                {confirmacionCambioPendiente.titulo}
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-700">
              <p className="text-sm leading-relaxed whitespace-pre-line">{confirmacionCambioPendiente.mensaje}</p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setConfirmacionCambioPendiente(null)}
                className="px-4 py-2 rounded-lg font-semibold text-slate-700 border border-slate-300 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const cambio = confirmacionCambioPendiente;
                  setConfirmacionCambioPendiente(null);
                  aplicarCambioFormulario(cambio.name, cambio.value, cambio.type, cambio.checked);
                }}
                className="px-4 py-2 rounded-lg font-bold text-white bg-amber-600 hover:bg-amber-700"
              >
                Confirmar cambio
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Modal de Confirmacion de Eliminacion */}
      {showDeleteModal && createPortal((
        <div
          className="fixed top-0 right-0 bottom-0 z-[70] flex items-center justify-center p-4"
          style={{ left: 'var(--fondo-sidebar-width, 0px)' }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeDeleteModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-red-600/80 bg-white shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-red-400 bg-gradient-to-r from-red-400 via-red-200 to-red-50">
              <h4 className="text-lg font-bold text-red-900 flex items-center gap-2">
                <span>!</span>
                Confirmar Eliminacion
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-700">
              <p className="text-sm leading-relaxed">
                Se eliminara el docente <strong className="text-slate-900">{docenteToDelete?.nombre_completo}</strong> del sistema de forma permanente.
              </p>
              <div className="rounded-lg border border-red-700/70 bg-red-200/70 px-3 py-2 text-sm text-red-900">
                Accion irreversible: <strong className="text-red-900">El docente perdera su acceso definitivamente.</strong>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Escribe el nombre exacto del docente para habilitar la eliminacion:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Escribe el nombre del docente para confirmar"
                  className="w-full px-3 py-2 rounded-lg border border-red-400/40 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                />
              </div>
              <p className="text-xs text-slate-500">
                Esta operacion no se puede deshacer.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="px-4 py-2 rounded-lg font-semibold text-slate-700 border border-slate-300 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={deleteConfirmText !== (docenteToDelete?.nombre_completo || '')}
                className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-900/40 disabled:text-slate-300 disabled:cursor-not-allowed"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

export default ListaDocentes;
