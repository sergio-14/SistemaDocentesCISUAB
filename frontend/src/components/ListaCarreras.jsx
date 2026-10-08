import { useState, useEffect, useRef } from 'react';
import { FaTrash } from 'react-icons/fa';
import { getCarreras, getFacultadesCarrera, addFacultadCarrera, deleteFacultadCarrera, renameFacultadCarrera } from '../apis/api';
import api from '../apis/api';
import { EVENTO_CARRERAS_ACTUALIZADAS } from './common/AvisoCarreraInactiva';
import toast from 'react-hot-toast';
import { hoyBolivia } from '../utils/fechas';
import { CalendarioFlotante } from './common/CalendarioFecha';
import CampoBusqueda from './common/CampoBusqueda';
import FiltroDesplegable from './common/FiltroDesplegable';
import Interruptor from './common/Interruptor';
import ModalCentrado from './common/ModalCentrado';
import NumeroAnimado from './common/NumeroAnimado';
import Paginacion from './common/Paginacion';
import SelectorVista from './common/SelectorVista';
import { paginar } from '../utils/paginacion';
import { BLOQUE, BOTON, BOTON_CHICO } from './fondos/estilosFondo';
import { useActiveRole } from '../contexts/activeRole';
import {
  ERROR_MOTION_CLASS,
  ERROR_SHAKE_DURATION_MS,
  sanitizeApiErrors,
  getDownloadErrorMessage,
} from '../utils/formErrors';

// Campos de los formularios con el estilo del Fondo de Tiempo: píldora azulada y etiqueta chica.
const LABEL_CAMPO = 'block text-xs font-semibold text-slate-700 mb-1.5 pl-1';
const CAMPO = 'w-full h-11 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-inset !bg-azulado-100 disabled:!bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';
const CAMPO_NORMAL = 'ring-1 ring-azulado-300 focus:ring-2 focus:ring-blue-900/40';
const CAMPO_ERROR = 'ring-2 ring-red-500';
// Botón cuadrado chico dentro de un campo (calendario, expandir), como la flecha de los desplegables.
const BOTON_EN_CAMPO = 'flex h-6 w-6 items-center justify-center rounded-md bg-[#2C4AAE] text-white hover:bg-[#233C8F] transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed';

const VISTA_CARRERAS_KEY = 'carreras_vista';
const MENSAJE_FECHA_FUTURA = 'La fecha de resolución de creación (HCU) no puede ser futura.';

const CAMPOS_TEXTO_LARGO = {
  mision: { label: 'Misión', placeholder: 'Misión institucional de la carrera', vacio: 'Sin misión registrada.' },
  vision: { label: 'Visión', placeholder: 'Visión institucional de la carrera', vacio: 'Sin visión registrada.' },
  perfil_profesional: { label: 'Perfil Profesional', placeholder: 'Descripción del perfil profesional del egresado', vacio: 'Sin perfil profesional registrado.' },
  objetivo_carrera: { label: 'Objetivo de Carrera', placeholder: 'Objetivo general de la carrera', vacio: 'Sin objetivo de carrera registrado.' },
};

const FORMULARIO_VACIO = {
  nombre: '',
  codigo: '',
  facultad: '',
  resolucion_ministerial: '',
  fecha_resolucion: '',
  mision: '',
  vision: '',
  perfil_profesional: '',
  objetivo_carrera: '',
  responsable: '',
  activo: true,
  fecha_actualizacion: null,
};

const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const mensajeDeError = (error) => (Array.isArray(error) ? (error[0] || '') : (error ? String(error) : ''));

const CarrerasIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
  </svg>
);

const MasIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const ImagenIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
);

const DescargaIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

// Sacude el campo cada vez que llega un error nuevo (o se repite con `pulse`).
const useSacudidaError = (error, pulse = 0) => {
  const [sacudiendo, setSacudiendo] = useState(false);
  useEffect(() => {
    if (!error) {
      setSacudiendo(false);
      return undefined;
    }
    setSacudiendo(false);
    const frame = requestAnimationFrame(() => setSacudiendo(true));
    const timeout = setTimeout(() => setSacudiendo(false), ERROR_SHAKE_DURATION_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [error, pulse]);
  return sacudiendo;
};

const MensajeError = ({ error }) => {
  const mensaje = mensajeDeError(error);
  return mensaje ? <p className="mt-1 pl-1 text-xs text-red-600">{mensaje}</p> : null;
};

const CampoTexto = ({ label, name, value, onChange, onFocus, error, pulse = 0, disabled = false, readOnly = false, placeholder, ayuda }) => {
  const sacudiendo = useSacudidaError(error, pulse);
  return (
    <div className={error && sacudiendo ? ERROR_MOTION_CLASS : ''}>
      <label htmlFor={`carrera-${name}`} className={LABEL_CAMPO}>{label}</label>
      <input
        id={`carrera-${name}`}
        type="text"
        name={name}
        value={value || ''}
        onChange={onChange}
        onFocus={onFocus}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`${CAMPO} ${error ? CAMPO_ERROR : CAMPO_NORMAL} ${readOnly ? '!bg-slate-100 cursor-not-allowed' : ''}`}
        style={{ border: 'none' }}
      />
      <MensajeError error={error} />
      {ayuda && <p className="mt-1 pl-1 text-xs text-slate-500">{ayuda}</p>}
    </div>
  );
};

const CampoTextoLargo = ({ name, value, onChange, onExpandir, disabled = false }) => (
  <div>
    <label htmlFor={`carrera-${name}`} className={LABEL_CAMPO}>{CAMPOS_TEXTO_LARGO[name].label}</label>
    <div className="relative">
      <textarea
        id={`carrera-${name}`}
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        rows={3}
        placeholder={CAMPOS_TEXTO_LARGO[name].placeholder}
        className="block w-full px-4 py-3 pr-11 rounded-2xl text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-inset ring-1 ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100 resize-none disabled:!bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
        style={{ border: 'none' }}
      />
      <button
        type="button"
        onClick={onExpandir}
        disabled={disabled}
        title="Expandir"
        aria-label={`Expandir ${CAMPOS_TEXTO_LARGO[name].label}`}
        className={`${BOTON_EN_CAMPO} absolute right-2.5 top-2.5`}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v3m16-5h-3a2 2 0 012 2v3M3 16v3a2 2 0 002 2h3m11-5v3a2 2 0 01-2 2h-3" />
        </svg>
      </button>
    </div>
  </div>
);

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
  return `${dd}/${mm}/${dateObj.getFullYear()}`;
}

function parseDisplayDate(display) {
  if (!display || typeof display !== 'string') return null;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(display)) return null;
  const [dd, mm, yyyy] = display.split('/').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

// Fecha escribible (dd/mm/aaaa) o elegida en el calendario; nunca posterior a `maxIsoDate`.
const CampoFecha = ({ label, name, value, onDateChange, error, maxIsoDate, pulse = 0, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(formatDisplayDate(value));
  const campoRef = useRef(null);
  const sacudiendo = useSacudidaError(error, pulse);

  useEffect(() => {
    setInputValue(formatDisplayDate(value));
  }, [value]);

  const esFutura = (dateObj) => {
    const maxDateObj = parseIsoDate(maxIsoDate);
    return Boolean(maxDateObj && dateObj > maxDateObj);
  };

  const handleManualInputChange = (e) => {
    const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = onlyDigits;
    if (onlyDigits.length > 2) formatted = `${onlyDigits.slice(0, 2)}/${onlyDigits.slice(2)}`;
    if (onlyDigits.length > 4) formatted = `${onlyDigits.slice(0, 2)}/${onlyDigits.slice(2, 4)}/${onlyDigits.slice(4)}`;
    setInputValue(formatted);
    if (formatted.length === 10) {
      const parsed = parseDisplayDate(formatted);
      if (parsed) {
        if (esFutura(parsed)) {
          toast.error(MENSAJE_FECHA_FUTURA);
          return;
        }
        onDateChange(name, toIsoDate(parsed));
      }
    }
    if (!formatted) onDateChange(name, '');
  };

  const handleManualInputBlur = () => {
    if (!inputValue) {
      onDateChange(name, '');
      return;
    }
    const parsed = parseDisplayDate(inputValue);
    if (parsed) {
      if (esFutura(parsed)) {
        toast.error(MENSAJE_FECHA_FUTURA);
        setInputValue(formatDisplayDate(value));
        return;
      }
      const iso = toIsoDate(parsed);
      onDateChange(name, iso);
      setInputValue(formatDisplayDate(iso));
      return;
    }
    onDateChange(name, '');
    setInputValue('');
  };

  return (
    <div className={`relative ${error && sacudiendo ? ERROR_MOTION_CLASS : ''}`}>
      <label className={LABEL_CAMPO}>{label}</label>
      <div
        ref={campoRef}
        className={`relative w-full rounded-full ring-inset ${disabled ? '!bg-slate-100' : '!bg-azulado-100'} ${
          error ? CAMPO_ERROR : 'ring-1 ring-azulado-300 focus-within:ring-2 focus-within:ring-blue-900/40'
        }`}
      >
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={inputValue}
          onChange={handleManualInputChange}
          onBlur={handleManualInputBlur}
          disabled={disabled}
          aria-label={label}
          className="w-full h-11 !bg-transparent text-sm text-slate-800 placeholder:text-slate-500 px-4 pr-12 rounded-full outline-none disabled:text-slate-500 disabled:cursor-not-allowed"
          style={{ border: 'none' }}
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          disabled={disabled}
          aria-label={`Abrir calendario de ${label}`}
          className={`${BOTON_EN_CAMPO} absolute right-2.5 top-1/2 -translate-y-1/2`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-13 9h16a1 1 0 001-1V7a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1z" />
          </svg>
        </button>
      </div>

      <CalendarioFlotante
        abierto={open && !disabled}
        anclaRef={campoRef}
        onCerrar={() => setOpen(false)}
        value={value}
        max={maxIsoDate || undefined}
        onElegir={(iso) => {
          onDateChange(name, iso);
          setInputValue(formatDisplayDate(iso));
          setOpen(false);
        }}
        onNoPermitido={() => toast.error(MENSAJE_FECHA_FUTURA)}
        onBorrar={() => {
          onDateChange(name, '');
          setOpen(false);
        }}
      />

      <MensajeError error={error} />
    </div>
  );
};

// Facultad: el desplegable escribible de siempre y, para el superusuario, un panel para
// agregar, renombrar y eliminar facultades del catálogo.
const CampoFacultad = ({
  value,
  onElegir,
  options,
  error,
  pulse = 0,
  disabled = false,
  puedeGestionar = false,
  onAgregar,
  setFacultadOptions,
  setFormData,
  onFacultadesCambiadas,
}) => {
  const [gestionando, setGestionando] = useState(false);
  const [nuevaFacultad, setNuevaFacultad] = useState('');
  const [editando, setEditando] = useState(null);
  const [nombreEditado, setNombreEditado] = useState('');
  const [seleccionadas, setSeleccionadas] = useState([]);
  const sacudiendo = useSacudidaError(error, pulse);

  const agregar = () => {
    const nombre = nuevaFacultad.trim();
    if (!nombre) return;
    onAgregar(nombre);
    setNuevaFacultad('');
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setNombreEditado('');
  };

  const guardarEdicion = async () => {
    const nombreNuevo = nombreEditado.trim();
    if (!editando || !nombreNuevo || editando === nombreNuevo) {
      cancelarEdicion();
      return;
    }
    try {
      // Renombra el MISMO registro: las carreras siguen vinculadas a esa facultad.
      const response = await renameFacultadCarrera(editando, nombreNuevo);
      setFacultadOptions(Array.isArray(response.data) ? response.data : []);
      if (value === editando) {
        setFormData((prev) => ({ ...prev, facultad: nombreNuevo }));
      }
      // Las carreras muestran el nombre de su facultad: se recargan.
      onFacultadesCambiadas?.();
      toast.success('Facultad actualizada correctamente.');
    } catch (err) {
      toast.error(`No se pudo actualizar: ${err.response?.data?.detail || err.message}`);
    } finally {
      cancelarEdicion();
    }
  };

  const alternarSeleccion = (nombre) => {
    setSeleccionadas((prev) => (prev.includes(nombre) ? prev.filter((item) => item !== nombre) : [...prev, nombre]));
  };

  const eliminarSeleccionadas = async () => {
    const aEliminar = seleccionadas.filter((nombre) => options.some((opt) => opt.value === nombre && opt.value !== ''));
    if (aEliminar.length === 0) {
      toast.error('No hay facultades válidas para eliminar.');
      return;
    }

    // Se intenta cada una: una facultad con carreras no impide borrar las demás,
    // y cada rechazo se informa con el motivo que da el backend.
    let eliminadas = 0;
    const rechazos = [];
    for (const nombre of aEliminar) {
      try {
        await deleteFacultadCarrera(nombre);
        eliminadas += 1;
        if (value === nombre) setFormData((prev) => ({ ...prev, facultad: '' }));
      } catch (err) {
        rechazos.push(err.response?.data?.detail || `No se pudo eliminar "${nombre}": ${err.message}`);
      }
    }

    // La lista sale del servidor: refleja lo que realmente se eliminó.
    try {
      const response = await getFacultadesCarrera();
      setFacultadOptions(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('No se pudo recargar las facultades:', err);
    }
    setSeleccionadas([]);
    if (eliminadas > 0) toast.success(`${eliminadas} facultad(es) eliminada(s) correctamente.`);
    rechazos.forEach((mensaje) => toast.error(mensaje, { duration: 6000 }));
  };

  const cerrarGestion = () => {
    setGestionando(false);
    setNuevaFacultad('');
    setSeleccionadas([]);
    cancelarEdicion();
  };

  return (
    <div className={error && sacudiendo ? ERROR_MOTION_CLASS : ''}>
      <label htmlFor="carrera-facultad" className={LABEL_CAMPO}>Facultad</label>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <FiltroDesplegable
            id="carrera-facultad"
            value={value}
            onChange={onElegir}
            options={options}
            placeholder="Seleccione una facultad..."
            ariaLabel="Facultad"
            emptyText="No hay facultades que coincidan"
            permitirQuitar={false}
            invalido={Boolean(error)}
            disabled={disabled}
          />
        </div>
        {puedeGestionar && !disabled && (
          <button
            type="button"
            onClick={() => (gestionando ? cerrarGestion() : setGestionando(true))}
            title={gestionando ? 'Cerrar gestión de facultades' : 'Gestionar facultades'}
            aria-label={gestionando ? 'Cerrar gestión de facultades' : 'Gestionar facultades'}
            className={`h-11 w-11 flex-shrink-0 inline-flex items-center justify-center rounded-full transition-colors ${
              gestionando ? 'bg-azulado-200 text-blue-900 hover:bg-azulado-300' : 'bg-blue-900 text-white hover:bg-blue-950'
            }`}
          >
            {gestionando ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <MasIcon className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
      <MensajeError error={error} />

      {gestionando && (
        <div className="animate-campo-entrada mt-2 rounded-2xl bg-white ring-1 ring-inset ring-azulado-300 p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-800 pl-1">Agregar, editar o eliminar facultades</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={nuevaFacultad}
              onChange={(e) => setNuevaFacultad(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  agregar();
                }
              }}
              placeholder="Nueva facultad"
              className={`${CAMPO} ${CAMPO_NORMAL} h-10`}
              style={{ border: 'none' }}
            />
            <button
              type="button"
              onClick={agregar}
              disabled={!nuevaFacultad.trim()}
              className={`${BOTON_CHICO} h-10 px-4 bg-blue-900 hover:bg-blue-950 text-white disabled:opacity-50`}
            >
              Agregar
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-azulado-200">
            {options.length === 0 && <p className="px-2 py-3 text-xs text-slate-500">No hay facultades registradas.</p>}
            {options.filter((opt) => opt.value !== '').map((option) => (
              <div key={option.value} className="flex items-center gap-2.5 px-2 py-2">
                <input
                  type="checkbox"
                  checked={seleccionadas.includes(option.value)}
                  onChange={() => alternarSeleccion(option.value)}
                  aria-label={`Seleccionar ${option.label}`}
                  className="w-4 h-4 flex-shrink-0 accent-blue-900"
                />
                {editando === option.value ? (
                  <>
                    <input
                      type="text"
                      value={nombreEditado}
                      onChange={(e) => setNombreEditado(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          guardarEdicion();
                        }
                        if (e.key === 'Escape') cancelarEdicion();
                      }}
                      autoFocus
                      className={`${CAMPO} ${CAMPO_NORMAL} h-8 px-3`}
                      style={{ border: 'none' }}
                    />
                    <button type="button" onClick={guardarEdicion} title="Guardar" className="flex-shrink-0 text-emerald-600 hover:text-emerald-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                    <button type="button" onClick={cancelarEdicion} title="Cancelar" className="flex-shrink-0 text-red-600 hover:text-red-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{option.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(option.value);
                        setNombreEditado(option.label);
                      }}
                      title="Editar facultad"
                      className="flex-shrink-0 text-blue-900 hover:text-sky-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {seleccionadas.length > 0 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={eliminarSeleccionadas}
                className={`${BOTON_CHICO} bg-red-500 hover:bg-red-600 text-white`}
              >
                <FaTrash size={11} />
                Eliminar seleccionadas ({seleccionadas.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Logo de la carrera en círculo: al pasar el cursor se puede subir, cambiar o borrar.
const LogoEditable = ({ inputId, logoPreview, onElegirArchivo, onBorrar, error, pulse = 0, inactiva = false, disabled = false }) => {
  const sacudiendo = useSacudidaError(error, pulse);
  return (
    <div className={error && sacudiendo ? ERROR_MOTION_CLASS : ''}>
      <input id={inputId} type="file" accept="image/*" onChange={onElegirArchivo} className="hidden" disabled={disabled} />
      <div
        className={`group relative mx-auto w-40 h-40 rounded-full overflow-hidden ring-inset ${
          error ? 'ring-2 ring-red-500' : inactiva ? 'ring-2 ring-red-300' : 'ring-1 ring-azulado-300'
        } ${inactiva ? 'bg-red-50' : 'bg-white'}`}
      >
        {logoPreview ? (
          <img src={logoPreview} alt="Logo de carrera" className="w-full h-full object-contain p-2" />
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center gap-1.5 ${inactiva ? 'text-red-400' : 'text-azulado-300 bg-azulado-100'}`}>
            <ImagenIcon className="w-10 h-10" />
            <span className="text-xs font-medium text-slate-500">Sin logo</span>
          </div>
        )}

        {!disabled && (
          <div className="absolute inset-0 flex opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
            {logoPreview ? (
              <>
                <label htmlFor={inputId} className="w-1/2 h-full bg-blue-950/60 hover:bg-blue-950/75 flex items-center justify-center cursor-pointer text-white text-xs font-semibold">
                  Cambiar
                </label>
                <button type="button" onClick={onBorrar} className="w-1/2 h-full bg-red-600/70 hover:bg-red-600/85 flex items-center justify-center text-white text-xs font-semibold">
                  Borrar
                </button>
              </>
            ) : (
              <label htmlFor={inputId} className="w-full h-full bg-blue-950/55 hover:bg-blue-950/70 flex items-center justify-center cursor-pointer text-white text-xs font-semibold">
                Subir logo
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const LogoCarrera = ({ carrera, className }) => (
  carrera.logo_carrera ? (
    <img src={carrera.logo_carrera} alt={`Logo de ${carrera.nombre}`} className={`${className} object-contain bg-white`} />
  ) : (
    <span className={`${className} flex items-center justify-center bg-gradient-to-br from-sky-50 to-azulado-200 text-blue-900 text-sm font-bold`}>
      {carrera.codigo}
    </span>
  )
);

const ChipEstadoCarrera = ({ activa }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
    activa ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-red-50 text-red-800 ring-red-200'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${activa ? 'bg-emerald-600' : 'bg-red-600'}`} />
    {activa ? 'Activa' : 'Inactiva'}
  </span>
);

function ListaCarreras() {
  const [carreras, setCarreras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Usuario con su rol activo (contexto de rol).
  const { effectiveUser: user, activeRole } = useActiveRole();
  const [facultadOptions, setFacultadOptions] = useState([]);

  // Detalle de la carrera y, desde ahí, su edición
  const [showModal, setShowModal] = useState(false);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  // Informe de gestión de la carrera (Arts. 19 y 28): gestión a descargar.
  const [gestionInforme, setGestionInforme] = useState(String(new Date().getFullYear()));

  // Formulario
  const [formData, setFormData] = useState(FORMULARIO_VACIO);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [removeLogoCarrera, setRemoveLogoCarrera] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [carreraToDelete, setCarreraToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteImpact, setDeleteImpact] = useState({ detalle: [], detail: '' });
  const [showDependencyWarningModal, setShowDependencyWarningModal] = useState(false);
  // Si la carrera ya tiene datos académicos (materias, fondos, informes, docentes o
  // calendarios), su identidad (nombre, código, facultad, resolución y fecha) no se
  // puede cambiar. null = sin datos académicos.
  const [identidadBloqueada, setIdentidadBloqueada] = useState(null);
  const suppressUpdateToastRef = useRef(false);

  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Campo de texto largo abierto en grande
  const [expandedField, setExpandedField] = useState(null);

  // Tarjetas o lista; se recuerda en este navegador.
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem(VISTA_CARRERAS_KEY) === 'lista' ? 'lista' : 'tarjetas';
    } catch {
      return 'tarjetas';
    }
  });
  const [pagina, setPagina] = useState(1);
  const listaRef = useRef(null);
  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    setPagina(1);
    try {
      localStorage.setItem(VISTA_CARRERAS_KEY, nuevaVista);
    } catch {
      // Sin almacenamiento disponible la vista simplemente no se recuerda.
    }
  };
  useEffect(() => {
    setPagina(1);
  }, [searchTerm]);

  // Pulso para repetir la sacudida de un campo con error
  const [errorPulse, setErrorPulse] = useState({});
  const pulseFieldErrors = (fields = []) => {
    setErrorPulse((prev) => {
      const next = { ...prev };
      fields.forEach((f) => { next[f] = (next[f] || 0) + 1; });
      return next;
    });
  };

  const cargarFacultades = async () => {
    try {
      const response = await getFacultadesCarrera();
      const data = response.data || [];
      setFacultadOptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando facultades:', err);
      setFacultadOptions([]);
    }
  };

  const cargarCarreras = async () => {
    try {
      setError(null);
      const data = await getCarreras();
      setCarreras(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Error al cargar carreras');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCarreras();
    cargarFacultades();
  }, []);

  const handleAgregarFacultad = async (nombreFacultad) => {
    const nombre = String(nombreFacultad || '').trim();
    if (!nombre) {
      toast.error('Escribe una facultad antes de agregar.');
      return;
    }

    try {
      const response = await addFacultadCarrera(nombre);
      const data = response.data || [];
      setFacultadOptions(Array.isArray(data) ? data : []);
      setFormData((prev) => ({ ...prev, facultad: nombre }));
      limpiarError('facultad');
      toast.success('Facultad agregada correctamente.');
    } catch (err) {
      toast.error(`No se pudo agregar: ${err.response?.data?.detail || err.message}`);
    }
  };

  const reiniciarLogo = (preview = '') => {
    setLogoFile(null);
    setLogoPreview(preview);
    setRemoveLogoCarrera(false);
  };

  const abrirNuevaCarrera = () => {
    setFormData(FORMULARIO_VACIO);
    setErrors({});
    reiniciarLogo();
    setIsCreating(true);
  };

  const cargarBloqueoIdentidad = async (carrera) => {
    setIdentidadBloqueada(null);
    try {
      const response = await api.get(`/carreras/${carrera.id}/dependencias/`);
      const deps = response.data || {};
      setIdentidadBloqueada(
        deps.tiene_datos_academicos ? (deps.detalle || []).filter((item) => item.academico) : null
      );
    } catch (err) {
      // El backend valida igual al guardar; aquí solo es una ayuda visual.
      console.error('No se pudo verificar los datos asociados de la carrera:', err);
    }
  };

  const abrirModalVer = (carrera) => {
    setCarreraSeleccionada(carrera);
    cargarBloqueoIdentidad(carrera);
    setIsViewMode(true);
    suppressUpdateToastRef.current = false;
    setFormData({
      nombre: carrera.nombre,
      codigo: carrera.codigo,
      facultad: carrera.facultad,
      resolucion_ministerial: carrera.resolucion_ministerial || '',
      fecha_resolucion: carrera.fecha_resolucion || '',
      mision: carrera.mision || '',
      vision: carrera.vision || '',
      perfil_profesional: carrera.perfil_profesional || '',
      objetivo_carrera: carrera.objetivo_carrera || '',
      responsable: carrera.responsable || '',
      activo: carrera.activo,
      fecha_actualizacion: carrera.fecha_actualizacion,
    });
    setErrors({});
    reiniciarLogo(carrera.logo_carrera || '');
    setShowModal(true);
    setIsCreating(false);
  };

  const cerrarModalCarrera = () => {
    suppressUpdateToastRef.current = false;
    setShowModal(false);
    setIsViewMode(false);
  };

  const limpiarError = (name) => {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    // Limpiar el input permite volver a elegir el mismo archivo después de borrarlo.
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen válida');
      return;
    }

    setLogoFile(file);
    setRemoveLogoCarrera(false);
    setLogoPreview(URL.createObjectURL(file));
    limpiarError('logo_carrera_file');
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setRemoveLogoCarrera(true);
  };

  const buildCarreraPayload = () => {
    const payload = new FormData();
    payload.append('nombre', formData.nombre);
    payload.append('codigo', String(formData.codigo || '').trim().toUpperCase());
    payload.append('facultad', formData.facultad);
    payload.append('resolucion_ministerial', formData.resolucion_ministerial || '');
    payload.append('fecha_resolucion', formData.fecha_resolucion || '');
    payload.append('mision', formData.mision || '');
    payload.append('vision', formData.vision || '');
    payload.append('perfil_profesional', formData.perfil_profesional || '');
    payload.append('objetivo_carrera', formData.objetivo_carrera || '');
    payload.append('activo', String(Boolean(formData.activo)));

    if (logoFile) payload.append('logo_carrera_file', logoFile);
    if (removeLogoCarrera) payload.append('remove_logo_carrera', 'true');

    return payload;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === 'codigo' ? value.toUpperCase() : value }));
    limpiarError(name);
  };

  const handleDateChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    limpiarError(name);
  };

  const handleActivoSwitchChange = () => {
    const nextActivo = !formData.activo;
    suppressUpdateToastRef.current = true;
    setFormData((prev) => ({ ...prev, activo: nextActivo }));

    if (nextActivo) {
      toast.success('Carrera activa: para confirmar, actualice la carrera');
    } else {
      toast.error('Carrera inactiva: para confirmar, actualice la carrera');
    }
  };

  const validateCarreraForm = ({ requireLogo = false } = {}) => {
    const newErrors = {};

    if (!String(formData.nombre || '').trim()) {
      newErrors.nombre = ['Este campo es obligatorio: nombre de la carrera.'];
    }
    if (!String(formData.facultad || '').trim()) {
      newErrors.facultad = ['Este campo es obligatorio: facultad.'];
    }
    if (!String(formData.codigo || '').trim()) {
      newErrors.codigo = ['Este campo es obligatorio: código de la carrera.'];
    }
    if (!String(formData.resolucion_ministerial || '').trim()) {
      newErrors.resolucion_ministerial = ['Este campo es obligatorio: resolución de creación (HCU).'];
    }
    if (!String(formData.fecha_resolucion || '').trim()) {
      newErrors.fecha_resolucion = ['Este campo es obligatorio: fecha de resolución de creación (HCU).'];
    } else if (formData.fecha_resolucion > hoyBolivia()) {
      newErrors.fecha_resolucion = [MENSAJE_FECHA_FUTURA];
    }
    if (requireLogo && !logoFile) {
      newErrors.logo_carrera_file = ['El logo de carrera es obligatorio para crear una nueva carrera.'];
    }

    setErrors(newErrors);
    return newErrors;
  };

  // "Completa..." solo si falta un campo; si están llenos pero alguno es inválido
  // (p. ej. fecha de resolución futura): "Revisa...".
  const mensajeErroresCarrera = (errores) => (
    Object.values(errores).flat().some((mensaje) => /obligatori/i.test(String(mensaje)))
      ? 'Completa los campos obligatorios marcados en rojo.'
      : 'Revisa los campos marcados en rojo.'
  );

  const mostrarErroresApi = (apiErrors) => {
    const sanitized = sanitizeApiErrors(apiErrors);
    setErrors(sanitized);
    pulseFieldErrors(Object.keys(sanitized));
    toast.error(`Error: ${Object.values(sanitized).flat().join(' ')}`);
  };

  const handleCreateSubmit = async (e) => {
    e?.preventDefault?.();
    setErrors({});
    const newErrors = validateCarreraForm({ requireLogo: true });
    if (Object.keys(newErrors).length > 0) {
      toast.error(mensajeErroresCarrera(newErrors));
      pulseFieldErrors(Object.keys(newErrors));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/carreras/', buildCarreraPayload(), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Carrera creada correctamente');
      if (response.data?.id) {
        setCarreras((prev) => [response.data, ...prev]);
      }
      setIsCreating(false);
    } catch (err) {
      console.error(err);
      if (err.response?.data) {
        mostrarErroresApi(err.response.data);
      } else {
        toast.error('Ocurrió un error inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Carrera inactiva en edición: solo se puede reactivar (el backend rechaza cambiar otros campos).
  const reactivandoCarrera = carreraSeleccionada?.activo === false;

  // La reactivación va sola: el backend rechaza que cambie algo más que `activo`.
  const reactivarCarrera = async () => {
    if (!formData.activo) {
      toast.error('La carrera está desactivada. Actívala con el interruptor para reactivarla.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.patch(`/carreras/${carreraSeleccionada.id}/`, { activo: true });
      suppressUpdateToastRef.current = false;
      toast.success('Carrera reactivada. Ahora puedes editarla.');
      window.dispatchEvent(new Event(EVENTO_CARRERAS_ACTUALIZADAS));
      if (response.data?.id) {
        setCarreras((prev) => prev.map((carrera) => (carrera.id === response.data.id ? response.data : carrera)));
        setCarreraSeleccionada(response.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al reactivar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e?.preventDefault?.();
    setErrors({});
    if (reactivandoCarrera) {
      await reactivarCarrera();
      return;
    }
    const newErrors = validateCarreraForm({ requireLogo: false });
    if (Object.keys(newErrors).length > 0) {
      toast.error(mensajeErroresCarrera(newErrors));
      pulseFieldErrors(Object.keys(newErrors));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.put(`/carreras/${carreraSeleccionada.id}/`, buildCarreraPayload(), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!suppressUpdateToastRef.current) {
        toast.success('Carrera actualizada correctamente');
      }
      suppressUpdateToastRef.current = false;
      // El aviso de solo lectura del superusuario vuelve a contar las carreras inactivas.
      window.dispatchEvent(new Event(EVENTO_CARRERAS_ACTUALIZADAS));
      setShowModal(false);
      reiniciarLogo();
      if (response.data?.id) {
        setCarreras((prev) => prev.map((carrera) => (carrera.id === response.data.id ? response.data : carrera)));
      }
    } catch (err) {
      console.error(err);
      const apiData = err.response?.data;
      if (apiData && typeof apiData === 'object' && !apiData.detail) {
        mostrarErroresApi(apiData);
      } else {
        toast.error('Error al actualizar: ' + (apiData?.detail || err.message));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoOnlySubmit = async () => {
    if (!logoFile && !removeLogoCarrera) {
      toast.error('No hay cambios de logo para guardar.');
      return;
    }

    const payload = new FormData();
    if (logoFile) payload.append('logo_carrera_file', logoFile);
    if (removeLogoCarrera) payload.append('remove_logo_carrera', 'true');

    setIsSubmitting(true);
    try {
      const response = await api.patch(`/carreras/${carreraSeleccionada.id}/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Logo de carrera actualizado correctamente');
      setShowModal(false);
      reiniciarLogo();
      if (response.data?.id) {
        setCarreras((prev) => prev.map((carrera) => (carrera.id === response.data.id ? response.data : carrera)));
      }
    } catch (err) {
      console.error(err);
      const apiErrors = err.response?.data;
      if (apiErrors && typeof apiErrors === 'object') {
        toast.error(`Error: ${Object.values(apiErrors).flat().join(' ')}`);
      } else {
        toast.error('Error al actualizar logo: ' + (err.response?.data?.detail || err.message));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDependencyWarning = (carrera, impactData, customDetail) => {
    setCarreraToDelete(carrera);
    setDeleteImpact({
      detalle: Array.isArray(impactData?.detalle) ? impactData.detalle : [],
      detail: customDetail || '',
    });
    setShowDependencyWarningModal(true);
  };

  const eliminarCarrera = async (carrera) => {
    if (!carrera?.id) return;
    setShowModal(false);
    setIsViewMode(false);
    setDeleteConfirmText('');
    try {
      const response = await api.get(`/carreras/${carrera.id}/dependencias/`);
      const deps = response.data || {};
      if (deps.can_delete) {
        setCarreraToDelete(carrera);
        setDeleteImpact({ detalle: [], detail: '' });
        setShowDeleteModal(true);
        return;
      }
      openDependencyWarning(carrera, deps);
    } catch (err) {
      console.error('Error verificando dependencias de carrera:', err);
      toast.error('No se pudo verificar dependencias de la carrera. Intenta nuevamente.');
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setCarreraToDelete(null);
    setDeleteConfirmText('');
    setDeleteImpact({ detalle: [], detail: '' });
  };

  const confirmarEliminar = async () => {
    if (!carreraToDelete) return;
    if (deleteConfirmText !== carreraToDelete.nombre) {
      toast.error('Debes escribir exactamente el nombre de la carrera para confirmar');
      return;
    }
    try {
      await api.delete(`/carreras/${carreraToDelete.id}/`);
      toast.success('Carrera eliminada correctamente');
      setCarreras((prev) => prev.filter((carrera) => carrera.id !== carreraToDelete.id));
      closeDeleteModal();
    } catch (err) {
      console.error(err);
      const apiData = err.response?.data;
      if (apiData?.code === 'protected_error' || apiData?.code === 'dependency_exists') {
        const carrera = carreraToDelete;
        closeDeleteModal();
        openDependencyWarning(carrera, apiData?.dependencias || {}, apiData?.detail);
        return;
      }
      toast.error('Error al eliminar: ' + (apiData?.detail || err.message));
    }
  };

  const esSuperusuario = user?.is_superuser === true;
  const esDirectorCarrera = activeRole === 'director';
  const puedeEditarInformacionCarrera = esSuperusuario || esDirectorCarrera;
  const puedeEditarEstructura = esSuperusuario;
  const soloEditarLogo = !esSuperusuario && activeRole === 'jefe_estudios';
  // Arts. 19 y 28: informe de gestión de la carrera (PDF) para la Decanatura.
  const puedeDescargarInformeGestion = esSuperusuario || esDirectorCarrera;

  const descargarPdf = (data, nombreArchivo) => {
    const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDescargarFichaPdf = async () => {
    if (!carreraSeleccionada?.id) return;
    try {
      const response = await api.get(`/carreras/${carreraSeleccionada.id}/pdf-oficial/`, { responseType: 'blob' });
      const nombreBase = `${formData.nombre || carreraSeleccionada.nombre || 'carrera'}_${formData.codigo || carreraSeleccionada.codigo || ''}`
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      descargarPdf(response.data, `Carrera_${nombreBase || carreraSeleccionada.id}.pdf`);
      toast.success('Carrera descargada en PDF');
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      toast.error(await getDownloadErrorMessage(err, 'No se pudo descargar el PDF de la carrera'));
    }
  };

  const handleDescargarInformeGestion = async () => {
    if (!carreraSeleccionada?.id) return;
    const gestion = Number(gestionInforme);
    if (!Number.isInteger(gestion) || gestion < 2020 || gestion > 2100) {
      toast.error('Indique una gestión válida (año).');
      return;
    }
    try {
      const response = await api.get(`/carreras/${carreraSeleccionada.id}/informe-gestion/`, {
        params: { gestion },
        responseType: 'blob',
      });
      descargarPdf(response.data, `Informe_gestion_${carreraSeleccionada.codigo || carreraSeleccionada.id}_${gestion}.pdf`);
      toast.success(`Informe de gestión ${gestion} descargado`);
    } catch (err) {
      console.error('Error al descargar el informe de gestión:', err);
      toast.error(await getDownloadErrorMessage(err, 'No se pudo descargar el informe de gestión'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-azulado-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando carreras...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 bg-azulado-100">
        <div role="alert" className={`${BLOQUE} p-8 max-w-md w-full text-center`}>
          <p className="text-lg font-bold text-red-700">{error}</p>
          <p className="mt-2 text-sm text-slate-600">
            No se pudo obtener la lista de carreras. Revise su conexión e intente de nuevo.
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              cargarCarreras();
            }}
            className={`${BOTON} mt-5 px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white`}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const carrerasFiltradas = searchTerm.trim()
    ? carreras.filter((carrera) => (
      normalizar(carrera.nombre).includes(normalizar(searchTerm.trim()))
      || normalizar(carrera.codigo).includes(normalizar(searchTerm.trim()))
    ))
    : carreras;
  const totalActivas = carreras.filter((carrera) => carrera.activo !== false).length;
  const { paginaActual, totalPaginas, itemsPagina: carrerasPagina } = paginar(carrerasFiltradas, pagina, vista);
  const irAPagina = (nuevaPagina) => {
    setPagina(nuevaPagina);
    listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const claveVista = `${searchTerm}-${paginaActual}`;

  const abrirConTeclado = (carrera) => (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      abrirModalVer(carrera);
    }
  };

  // Formulario de nueva carrera y de edición: mismos campos; en edición pueden quedar
  // bloqueados la identidad (datos académicos) o todo menos el interruptor (inactiva).
  const formularioCarrera = (editar) => {
    const identidadFija = editar && Boolean(identidadBloqueada);
    const estructuraFija = editar && (!puedeEditarEstructura || identidadFija);
    const inactiva = editar && !formData.activo;
    return (
      <div className="w-full max-w-5xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '180ms' }}>
        <div className="px-5 sm:px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
          <h2 className="text-xl font-bold text-blue-900">{editar ? 'Editar Carrera' : 'Nueva Carrera'}</h2>
          <p className="mt-0.5 text-sm text-slate-600">Identidad, logo y orientación institucional de la carrera.</p>
        </div>

        <form onSubmit={editar ? handleUpdateSubmit : handleCreateSubmit} noValidate>
          <div className="p-4 sm:p-6 space-y-5">
            {editar && reactivandoCarrera && (
              <div className="rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-3 text-sm text-red-800">
                Esta carrera está desactivada y es de solo lectura, también para el superusuario.
                Primero reactívala con el interruptor del logo y pulsa Actualizar; después podrás editar el resto.
              </div>
            )}
            {identidadFija && (
              <div className="rounded-2xl bg-amber-50 ring-1 ring-inset ring-amber-200 px-4 py-3 text-sm text-amber-900">
                Esta carrera ya tiene datos académicos ({identidadBloqueada.map((item) => `${item.etiqueta}: ${item.cantidad}`).join(', ')}).
                El nombre, el código, la facultad, la Resolución de Creación (HCU) y su fecha no se pueden cambiar.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem] gap-5 items-start">
              <fieldset disabled={editar && reactivandoCarrera} className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                <CampoTexto
                  label="Nombre de la Carrera"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  onFocus={() => limpiarError('nombre')}
                  error={errors.nombre}
                  pulse={errorPulse.nombre || 0}
                  disabled={estructuraFija}
                  placeholder="Ej: Ingeniería de Sistemas"
                />
                <CampoFacultad
                  value={formData.facultad}
                  onElegir={(valor) => handleChange({ target: { name: 'facultad', value: valor } })}
                  options={facultadOptions}
                  error={errors.facultad}
                  pulse={errorPulse.facultad || 0}
                  disabled={estructuraFija || (editar && reactivandoCarrera)}
                  puedeGestionar={esSuperusuario}
                  onAgregar={handleAgregarFacultad}
                  setFacultadOptions={setFacultadOptions}
                  setFormData={setFormData}
                  onFacultadesCambiadas={cargarCarreras}
                />
                <CampoTexto
                  label="Código"
                  name="codigo"
                  value={formData.codigo}
                  onChange={handleChange}
                  onFocus={() => limpiarError('codigo')}
                  error={errors.codigo}
                  pulse={errorPulse.codigo || 0}
                  disabled={estructuraFija}
                  placeholder="Ej: IS"
                  ayuda={editar && !puedeEditarEstructura ? 'Solo el Superusuario puede cambiar el código de carrera.' : ''}
                />
                <CampoTexto
                  label="Resolución de Creación (HCU)"
                  name="resolucion_ministerial"
                  value={formData.resolucion_ministerial}
                  onChange={handleChange}
                  onFocus={() => limpiarError('resolucion_ministerial')}
                  error={errors.resolucion_ministerial}
                  pulse={errorPulse.resolucion_ministerial || 0}
                  disabled={identidadFija}
                  placeholder="Ej: Res. HCU 123/2020"
                />
                <CampoFecha
                  label="Fecha de Resolución de Creación (HCU)"
                  name="fecha_resolucion"
                  value={formData.fecha_resolucion}
                  onDateChange={handleDateChange}
                  error={errors.fecha_resolucion}
                  pulse={errorPulse.fecha_resolucion || 0}
                  maxIsoDate={hoyBolivia()}
                  disabled={identidadFija || (editar && reactivandoCarrera)}
                />
                {/* Responsable: solo se muestra si ya tiene valor */}
                {formData.responsable && (
                  <CampoTexto label="Responsable" name="responsable" value={formData.responsable} readOnly />
                )}
              </fieldset>

              <div className={`rounded-2xl ring-1 ring-inset p-4 flex flex-col gap-3 ${inactiva ? 'bg-red-50 ring-red-200' : 'bg-white ring-azulado-300'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">Logo de Carrera</span>
                  {editar && puedeEditarEstructura && (
                    <Interruptor
                      chico
                      isActive={Boolean(formData.activo)}
                      onChange={handleActivoSwitchChange}
                      etiqueta={formData.activo ? 'Desactivar carrera' : 'Activar carrera'}
                    />
                  )}
                </div>
                <LogoEditable
                  inputId={editar ? 'logo-carrera-editar' : 'logo-carrera-nueva'}
                  logoPreview={logoPreview}
                  onElegirArchivo={handleLogoChange}
                  onBorrar={handleRemoveLogo}
                  error={errors.logo_carrera_file}
                  pulse={errorPulse.logo_carrera_file || 0}
                  inactiva={inactiva}
                  disabled={editar && reactivandoCarrera}
                />
                <p className={`text-xs text-center ${inactiva ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
                  {inactiva ? 'Carrera inactiva' : 'Pasa el cursor sobre el logo para subirlo, cambiarlo o borrarlo.'}
                </p>
                {errors.logo_carrera_file && (
                  <p className="text-xs text-center text-red-600">{mensajeDeError(errors.logo_carrera_file)}</p>
                )}
              </div>
            </div>

            <fieldset disabled={editar && reactivandoCarrera} className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
              {Object.keys(CAMPOS_TEXTO_LARGO).map((campo) => (
                <CampoTextoLargo
                  key={campo}
                  name={campo}
                  value={formData[campo]}
                  onChange={handleChange}
                  onExpandir={() => setExpandedField(campo)}
                  disabled={editar && reactivandoCarrera}
                />
              ))}
            </fieldset>
          </div>

          <div className="px-5 sm:px-6 py-4 flex flex-col-reverse sm:flex-row justify-end gap-2 [border-top:1px_solid_#B8C9E1]">
            <button
              type="button"
              onClick={editar ? cerrarModalCarrera : () => setIsCreating(false)}
              className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-50`}
            >
              {isSubmitting ? 'Guardando...' : (editar ? 'Actualizar' : 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-azulado-100 text-slate-800">
      <div className="w-full max-w-[92rem] mx-auto px-3 sm:px-4 md:px-8 pt-16 md:pt-20 pb-6 space-y-4">
        {/* Bloque 1: encabezado con la acción y, al lado, el total (como el dashboard de fondos) */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className={`${BLOQUE} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0">
                <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
                  <CarrerasIcon className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Gestión de carreras universitarias
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">Carreras</h2>
                </div>
              </div>
              {puedeEditarEstructura && (
                <button data-escritura
                  type="button"
                  onClick={abrirNuevaCarrera}
                  className={`${BOTON} w-full sm:w-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
                >
                  <MasIcon className="w-5 h-5" />
                  <span>Nueva Carrera</span>
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Carreras</p>
              <span className="text-5xl font-bold tabular-nums leading-none">
                <NumeroAnimado valor={carreras.length} />
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <NumeroAnimado valor={totalActivas} singular="activa" plural="activas" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                <NumeroAnimado valor={carreras.length - totalActivas} singular="inactiva" plural="inactivas" />
              </span>
            </div>
          </div>
        </div>

        {/* Bloque 2: búsqueda y vista */}
        <div className={`${BLOQUE} p-3 flex flex-wrap items-center gap-2 sm:gap-3`}>
          <CampoBusqueda value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nombre o código" />
          <SelectorVista vista={vista} onCambiar={cambiarVista} className="ml-auto" />
        </div>

        {/* Bloque 3: carreras en tarjetas o en lista */}
        <div ref={listaRef} className="scroll-mt-4" />
        {carrerasFiltradas.length > 0 ? (
          vista === 'lista' ? (
            // Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas.
            <div key={`lista-${claveVista}`} className={`${BLOQUE} overflow-hidden`}>
              <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.6fr)_7rem_minmax(0,1.4fr)_8rem_8rem] items-center gap-6 px-5 py-3 bg-azulado-100 text-xs font-medium text-slate-500 [border-bottom:1px_solid_#B8C9E1]">
                <span>Carrera</span>
                <span>Código</span>
                <span>Facultad</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>
              <div className="divide-y divide-azulado-300">
                {carrerasPagina.map((carrera, indice) => (
                  <div
                    key={carrera.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => abrirModalVer(carrera)}
                    onKeyDown={abrirConTeclado(carrera)}
                    style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                    className={`animate-fondo-entrada grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_7rem_minmax(0,1.4fr)_8rem_8rem] items-center gap-x-6 gap-y-2 px-5 py-3 cursor-pointer transition-colors ${
                      carrera.activo ? 'hover:bg-azulado-100/70' : 'bg-red-50/60 hover:bg-red-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <LogoCarrera carrera={carrera} className="w-10 h-10 rounded-xl ring-1 ring-inset ring-azulado-300 flex-shrink-0" />
                      <span className="text-sm font-semibold text-slate-900 truncate">{carrera.nombre}</span>
                    </div>
                    <div className="text-sm font-semibold text-blue-900">
                      <span className="lg:hidden text-xs font-semibold text-slate-700">Código: </span>{carrera.codigo}
                    </div>
                    <div className="text-sm text-slate-600 truncate">{carrera.facultad || '—'}</div>
                    <div><ChipEstadoCarrera activa={carrera.activo !== false} /></div>
                    <div>
                      <span className={`${BOTON_CHICO} bg-blue-900 text-white`}>Ver detalle</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div key={`tarjetas-${claveVista}`} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {carrerasPagina.map((carrera, indice) => (
                <div
                  key={carrera.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => abrirModalVer(carrera)}
                  onKeyDown={abrirConTeclado(carrera)}
                  style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                  className={`${BLOQUE} animate-fondo-entrada p-5 flex flex-col gap-4 cursor-pointer hover:ring-blue-900/30 transition-colors ${carrera.activo ? '' : '!bg-red-50/70 !ring-red-200'}`}
                >
                  <div className="flex items-start gap-4">
                    <LogoCarrera carrera={carrera} className="w-16 h-16 rounded-2xl ring-1 ring-inset ring-azulado-300 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-blue-900 leading-tight line-clamp-2">{carrera.nombre}</h3>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{carrera.facultad || 'Sin facultad'}</p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 divide-x divide-azulado-300 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 py-2.5">
                    <div className="min-w-0 px-4">
                      <dt className="text-xs font-semibold text-blue-800">Código</dt>
                      <dd className="mt-0.5 text-[13px] font-semibold text-slate-800">{carrera.codigo}</dd>
                    </div>
                    <div className="min-w-0 px-4">
                      <dt className="text-xs font-semibold text-blue-800">Resolución (HCU)</dt>
                      <dd className="mt-0.5 text-[13px] font-semibold text-slate-800 truncate">{carrera.resolucion_ministerial || '—'}</dd>
                    </div>
                  </dl>

                  <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-2 [border-top:1px_solid_#B8C9E1]">
                    <ChipEstadoCarrera activa={carrera.activo !== false} />
                    <span className={`${BOTON_CHICO} bg-blue-900 text-white`}>Ver detalle</span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {carreras.length > 0 ? 'No hay carreras que coincidan' : 'No hay carreras registradas'}
            </h3>
            <p className="text-slate-600">
              {carreras.length > 0 ? 'Prueba con otro nombre o código.' : 'Comienza agregando la primera carrera.'}
            </p>
            {carreras.length === 0 && puedeEditarEstructura && (
              <button
                type="button"
                onClick={abrirNuevaCarrera}
                className={`${BOTON} mt-5 px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
              >
                <MasIcon className="w-5 h-5" />
                Crear primera carrera
              </button>
            )}
          </div>
        )}

        <Paginacion paginaActual={paginaActual} totalPaginas={totalPaginas} onCambiar={irAPagina} />
      </div>

      {/* Nueva carrera */}
      {isCreating && <ModalCentrado>{formularioCarrera(false)}</ModalCentrado>}

      {/* Detalle de la carrera */}
      {showModal && carreraSeleccionada && isViewMode && (
        <ModalCentrado onClose={cerrarModalCarrera}>
          <div className="w-full max-w-4xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '180ms' }}>
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5 [border-bottom:1px_solid_#B8C9E1]">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo de la carrera" className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-contain bg-white ring-1 ring-inset ring-azulado-300 p-2 flex-shrink-0" />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 text-azulado-300 flex flex-col items-center justify-center gap-1 flex-shrink-0">
                  <ImagenIcon className="w-9 h-9" />
                  <span className="text-xs font-medium text-slate-500">Sin logo</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-200">
                    {formData.codigo}
                  </span>
                  <ChipEstadoCarrera activa={carreraSeleccionada.activo !== false} />
                </div>
                <h3 className="mt-2 text-2xl font-bold text-blue-900 leading-tight break-words">{formData.nombre}</h3>
                <p className="mt-1 text-sm text-slate-600">{formData.facultad || 'Sin facultad'}</p>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {(formData.responsable || formData.fecha_actualizacion) && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 px-4 py-3">
                  {formData.responsable && (
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold text-blue-800">Responsable</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-slate-800 break-words">{formData.responsable}</dd>
                    </div>
                  )}
                  {formData.fecha_actualizacion && (
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold text-blue-800">Actualizado</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                        {new Date(formData.fecha_actualizacion).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(CAMPOS_TEXTO_LARGO).map(([campo, info]) => (
                  <div key={campo} className="rounded-2xl bg-white ring-1 ring-inset ring-azulado-300 p-4">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-blue-700">{info.label}</h5>
                    <p className={`mt-2 text-sm leading-relaxed whitespace-pre-line ${formData[campo] ? 'text-slate-700' : 'italic text-slate-500'}`}>
                      {formData[campo] || info.vacio}
                    </p>
                  </div>
                ))}
              </div>

              {soloEditarLogo && (
                <div className="rounded-2xl bg-white ring-1 ring-inset ring-azulado-300 p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-3">Actualizar logo institucional</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <LogoEditable
                      inputId="logo-carrera-jefe"
                      logoPreview={logoPreview}
                      onElegirArchivo={handleLogoChange}
                      onBorrar={handleRemoveLogo}
                    />
                    <div className="flex-1 space-y-3">
                      <p className="text-xs text-slate-500">Pasa el cursor sobre el logo para subirlo, cambiarlo o borrarlo.</p>
                      <button
                        type="button"
                        onClick={handleLogoOnlySubmit}
                        disabled={isSubmitting}
                        className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white disabled:opacity-50`}
                      >
                        {isSubmitting ? 'Guardando...' : 'Guardar logo'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-3 [border-top:1px_solid_#B8C9E1]">
              {puedeDescargarInformeGestion && (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="gestion-informe" className="text-xs font-semibold text-slate-700">Gestión</label>
                  <input
                    id="gestion-informe"
                    type="number"
                    min="2020"
                    max="2100"
                    value={gestionInforme}
                    onChange={(e) => setGestionInforme(e.target.value)}
                    className={`${CAMPO} ${CAMPO_NORMAL} !w-24 h-10`}
                    style={{ border: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={handleDescargarInformeGestion}
                    className={`${BOTON} bg-sky-600 hover:bg-sky-700 text-white`}
                  >
                    <DescargaIcon className="w-4 h-4" />
                    Informe de gestión
                  </button>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 lg:ml-auto">
                <button
                  type="button"
                  onClick={handleDescargarFichaPdf}
                  className={`${BOTON} bg-azulado-100 text-blue-900 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-200`}
                >
                  <DescargaIcon className="w-4 h-4" />
                  Descargar PDF
                </button>
                <button
                  type="button"
                  onClick={cerrarModalCarrera}
                  className={`${BOTON} text-slate-700 hover:bg-azulado-200`}
                >
                  Cerrar
                </button>
                {puedeEditarEstructura && carreraSeleccionada.activo !== false && (
                  <button
                    type="button"
                    onClick={() => eliminarCarrera(carreraSeleccionada)}
                    className={`${BOTON} bg-red-500 hover:bg-red-600 text-white`}
                  >
                    <FaTrash size={12} />
                    Eliminar
                  </button>
                )}
                {puedeEditarInformacionCarrera && (
                  <button data-escritura
                    type="button"
                    onClick={() => setIsViewMode(false)}
                    className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
                  >
                    Editar carrera
                  </button>
                )}
              </div>
            </div>
          </div>
        </ModalCentrado>
      )}

      {/* Edición de la carrera */}
      {showModal && carreraSeleccionada && !isViewMode && <ModalCentrado>{formularioCarrera(true)}</ModalCentrado>}

      {/* Confirmación de eliminación */}
      {showDeleteModal && (
        <ModalCentrado onClose={closeDeleteModal}>
          <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-6 pt-6">
              <h4 className="text-xl font-bold text-red-700">Confirmar eliminación</h4>
              <p className="mt-1 text-sm text-slate-600">
                Se eliminará la carrera <strong className="text-slate-900">{carreraToDelete?.nombre}</strong>. No tiene datos asociados.
              </p>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-3 text-red-800">
                Acción irreversible: <strong>la carrera se eliminará definitivamente.</strong>
              </div>
              <div>
                <label htmlFor="confirmar-eliminar-carrera" className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">
                  Escribe el nombre exacto de la carrera para habilitar la eliminación:
                </label>
                <input
                  id="confirmar-eliminar-carrera"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={carreraToDelete?.nombre || ''}
                  className="w-full h-11 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-red-400/50 !bg-azulado-100"
                  style={{ border: 'none' }}
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={closeDeleteModal}
                autoFocus
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={deleteConfirmText !== (carreraToDelete?.nombre || '')}
                className={`${BOTON} px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500`}
              >
                Eliminar
              </button>
            </div>
          </div>
        </ModalCentrado>
      )}

      {/* No se puede eliminar: tiene datos asociados */}
      {showDependencyWarningModal && carreraToDelete && (
        <ModalCentrado onClose={() => setShowDependencyWarningModal(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-6 pt-6">
              <h4 className="text-xl font-bold text-red-700">No se puede eliminar</h4>
              <p className="mt-1 text-sm text-slate-600">
                La carrera <strong className="text-slate-900">{carreraToDelete.nombre}</strong> tiene datos asociados.
              </p>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              {deleteImpact.detalle.length > 0 ? (
                <ul className="rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-3 text-red-800 list-disc list-inside space-y-0.5">
                  {deleteImpact.detalle.map((item) => (
                    <li key={item.clave}>{item.etiqueta}: <strong>{item.cantidad}</strong></li>
                  ))}
                </ul>
              ) : (
                deleteImpact.detail && (
                  <div className="rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-3 text-red-800">
                    {deleteImpact.detail}
                  </div>
                )
              )}
              <div className="rounded-2xl bg-amber-50 ring-1 ring-inset ring-amber-200 px-4 py-3 text-amber-900">
                Si la carrera ya no se usa, desactívala: sus datos quedan como histórico de solo lectura.
              </div>
            </div>
            <div className="flex justify-end px-6 pb-6">
              <button
                type="button"
                onClick={() => setShowDependencyWarningModal(false)}
                className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white`}
              >
                Entendido
              </button>
            </div>
          </div>
        </ModalCentrado>
      )}

      {/* Campo de texto largo en grande */}
      {expandedField && (
        <ModalCentrado onClose={() => setExpandedField(null)}>
          <div className="w-full max-w-4xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '180ms' }}>
            <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
              <h3 className="text-xl font-bold text-blue-900">{CAMPOS_TEXTO_LARGO[expandedField].label}</h3>
              <button
                type="button"
                onClick={() => setExpandedField(null)}
                title="Volver al tamaño normal"
                className={`${BOTON} text-slate-700 hover:bg-azulado-200`}
              >
                Listo
              </button>
            </div>
            <div className="p-5 sm:p-6">
              <textarea
                name={expandedField}
                value={formData[expandedField] || ''}
                onChange={handleChange}
                autoFocus
                placeholder={CAMPOS_TEXTO_LARGO[expandedField].placeholder}
                className="block w-full h-[300px] px-4 py-3 rounded-2xl text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-inset ring-1 ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100 resize-none"
                style={{ border: 'none' }}
              />
            </div>
          </div>
        </ModalCentrado>
      )}
    </div>
  );
}

export default ListaCarreras;
