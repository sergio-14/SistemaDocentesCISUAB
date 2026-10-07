import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { X } from 'lucide-react';
import api, { getCalendarios, getCarreras } from '../apis/api';
import { finAnteriorAInicio, hoyBolivia } from '../utils/fechas';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveRole } from '../contexts/activeRole';
import RuedaOpciones from './common/RuedaOpciones';
import { CalendarioFlotante } from './common/CalendarioFecha';
import ModalCentrado from './common/ModalCentrado';
import NumeroAnimado from './common/NumeroAnimado';
import { BLOQUE, BOTON } from './fondos/estilosFondo';
import { Etiqueta } from './fondos/ElementosFondo';
import {
  ERROR_FIELD_BORDER_CLASS,
  getErrorMessage,
  sanitizeApiErrors,
  useErrorPulse,
} from '../utils/formErrors';

// Campos con el estilo del módulo (píldora azulada, etiqueta chica arriba).
const LABEL_CAMPO = 'block text-xs font-semibold text-slate-700 mb-1.5 pl-1';
const CAMPO = 'w-full h-11 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-inset';
const CAMPO_NORMAL = 'ring-1 ring-azulado-300 focus:ring-2 focus:ring-blue-900/40';

// Fechas ISO (aaaa-mm-dd) a dd/mm/aaaa sin pasar por Date: así no se corren un día por la zona horaria.
const formatoFecha = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '';
};
const rangoFechas = (desde, hasta) => (desde || hasta ? `${formatoFecha(desde) || '—'} – ${formatoFecha(hasta) || '—'}` : '—');

const IconoCalendario = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </svg>
);

const IconoMas = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const SelectConDropdown = ({
  label,
  value,
  onChange,
  options,
  name,
  placeholder = 'Buscar...',
  emptyText = 'Sin resultados',
  hideSelectedOption = false,
  disabled = false,
  error,
  errorPulse = 0,
  onClearError,
  clearValue = 'todas',
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const errorMessage = getErrorMessage(error);
  const { motionClass } = useErrorPulse(errorMessage, errorPulse);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearchTerm('');
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  const selectedLabel = value && options.find((opt) => String(opt.value) === String(value))?.label;
  const query = searchTerm.trim().toLowerCase();
  const menuOptions = hideSelectedOption
    ? options.filter((option) => String(option.value) !== String(value))
    : options;
  const visibleOptions = query
    ? menuOptions.filter((option) => option.label.toLowerCase().includes(query))
    : menuOptions;

  const handleSelect = (optionValue) => {
    if (disabled) return;
    onClearError?.();
    onChange({ target: { name, value: optionValue } });
    setSearchTerm('');
    setOpen(false);
  };

  const clearSelection = (event) => {
    event.stopPropagation();
    if (disabled) return;
    onClearError?.();
    onChange({ target: { name, value: clearValue } });
    setSearchTerm('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className={LABEL_CAMPO}>
          {label}
        </label>
      )}

      <div className={`relative w-full min-w-[200px] rounded-full !bg-azulado-100 ring-inset ${
        errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : open ? 'ring-2 ring-blue-900/40' : 'ring-1 ring-azulado-300'
      } ${disabled ? 'opacity-70' : ''}`}>
        <div className="flex items-center gap-2 h-11 pl-4 pr-2.5">
          <input
            type="text"
            value={open ? searchTerm : (selectedLabel || '')}
            onChange={(event) => {
              if (disabled) return;
              onClearError?.();
              setSearchTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (disabled) return;
              onClearError?.();
              setSearchTerm('');
              setOpen(true);
            }}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full !bg-transparent text-sm text-slate-800 placeholder:text-slate-500 outline-none disabled:cursor-not-allowed"
            style={{ border: 'none', boxShadow: 'none', padding: 0 }}
          />
          {selectedLabel && !disabled && (
            <button
              type="button"
              onClick={clearSelection}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-azulado-200 hover:text-blue-900"
              title="Limpiar filtro"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={(event) => {
              event.preventDefault();
              if (disabled) return;
              onClearError?.();
              setSearchTerm('');
              setOpen((prev) => !prev);
            }}
            className="flex items-center justify-center h-6 w-6 rounded-md bg-[#2C4AAE] ring-1 ring-[#2C4AAE] disabled:bg-slate-500 disabled:ring-slate-500"
          >
            <svg className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-[#3A56AF] bg-white shadow-xl">
          <div className="max-h-56 overflow-auto p-2">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    String(option.value) === String(value)
                      ? 'bg-sky-600 text-white font-semibold hover:bg-blue-900'
                      : 'text-slate-700 hover:bg-[#2C4AAE] hover:text-white'
                  }`}
                >
                  <span className="block truncate">{option.label}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{emptyText}</div>
            )}
          </div>
        </div>
      )}
      {errorMessage && <p className={`text-xs text-red-600 dark:text-red-400 mt-1 ${motionClass}`}>{errorMessage}</p>}
    </div>
  );
};

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

const ToggleSwitch = ({ isActive, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      isActive
        ? 'bg-sky-600 focus:ring-sky-400'
        : 'bg-slate-300 focus:ring-slate-400'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
        isActive ? 'translate-x-6' : 'translate-x-0.5'
      }`}
    />
  </button>
);

const SegmentedOptions = ({ options, value, onChange, className = '', error, errorPulse = 0, onClearError }) => {
  const errorMessage = getErrorMessage(error);
  const { motionClass } = useErrorPulse(errorMessage, errorPulse);

  return (
    <div
      className={`grid gap-1 rounded-3xl p-1 bg-azulado-100 ring-inset ${
        errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'ring-1 ring-azulado-300'
      } ${className}`}
    >
      {options.map((opt) => {
        const isActive = String(opt.value) === String(value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onClearError?.();
              onChange(opt.value);
            }}
            className="relative min-h-[2.5rem] w-full rounded-2xl overflow-hidden"
          >
            {isActive && (
              <motion.span
                layoutId="period-segment-pill"
                className="absolute inset-0 rounded-2xl bg-blue-900 shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
              />
            )}
            <span
              className={`relative z-10 block px-1.5 py-1.5 text-xs sm:text-sm leading-tight transition-colors duration-200 ${
                isActive ? 'text-white' : 'text-slate-600 hover:text-blue-900'
              }`}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const YearPickerField = ({ value, onChange, currentYear, error, errorPulse = 0, onClearError }) => {
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualYear, setManualYear] = useState(String(value || currentYear));
  const [draftYear, setDraftYear] = useState(Number(value || currentYear));
  const [pickerOpenToken, setPickerOpenToken] = useState(0);
  const [pickerStartYear, setPickerStartYear] = useState(Number(currentYear));
  const [popupManualYear, setPopupManualYear] = useState(String(value || currentYear));
  const [popupHasError, setPopupHasError] = useState(false);
  const [popupIsTyping, setPopupIsTyping] = useState(false);
  const longPressTimerRef = useRef(null);
  const popupValidationTimerRef = useRef(null);
  const popupTypingTimerRef = useRef(null);
  const errorMessage = getErrorMessage(error);
  const { motionClass } = useErrorPulse(errorMessage, errorPulse);

  useEffect(() => {
    if (!open) {
      setManualYear(String(value || currentYear));
      setDraftYear(Number(value || currentYear));
      setPopupManualYear(String(value || currentYear));
      setPopupHasError(false);
    }
  }, [value, currentYear, open]);

  useEffect(() => {
    return () => {
      if (popupValidationTimerRef.current) clearTimeout(popupValidationTimerRef.current);
      if (popupTypingTimerRef.current) clearTimeout(popupTypingTimerRef.current);
    };
  }, []);

  const minYear = 2010;
  const maxYear = 2040;
  const opcionesAnios = useMemo(() => {
    const lista = [];
    for (let anio = minYear; anio <= maxYear; anio += 1) lista.push({ value: anio, label: String(anio) });
    return lista;
  }, []);

  const clampYear = (year) => Math.max(minYear, Math.min(maxYear, year));
  const isValidYearInRange = (year) => Number.isFinite(year) && year >= minYear && year <= maxYear;
  // Año actual en Bolivia, no en la zona horaria del navegador.
  const actualCurrentYear = clampYear(Number(hoyBolivia().slice(0, 4)));

  const commitManualYear = () => {
    const parsed = Number.parseInt(manualYear, 10);
    if (Number.isFinite(parsed)) {
      const finalYear = clampYear(parsed);
      setDraftYear(finalYear);
      onChange(finalYear);
    }
    setManualMode(false);
  };

  const commitDraftAndClose = () => {
    onChange(clampYear(Number(draftYear || currentYear)));
    setOpen(false);
  };

  const applyPopupManualYear = (rawValue) => {
    const parsed = Number.parseInt(rawValue, 10);
    if (!isValidYearInRange(parsed)) return false;
    setDraftYear(parsed);
    onChange(parsed);
    return true;
  };

  const startLongPress = () => {
    longPressTimerRef.current = setTimeout(() => {
      setManualMode(true);
      setOpen(false);
    }, 520);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openYearSelector = () => {
    onClearError?.();
    if (popupValidationTimerRef.current) clearTimeout(popupValidationTimerRef.current);
    if (popupTypingTimerRef.current) clearTimeout(popupTypingTimerRef.current);
    setDraftYear(actualCurrentYear);
    setPickerStartYear(actualCurrentYear);
    setPopupManualYear('');
    setPopupHasError(false);
    setPopupIsTyping(false);
    setPickerOpenToken((prev) => prev + 1);
    setOpen(true);
  };

  return (
    <>
      {!manualMode ? (
        <button
          type="button"
          onClick={openYearSelector}
          onDoubleClick={() => {
            setManualMode(true);
            setOpen(false);
          }}
          onMouseDown={startLongPress}
          onMouseUp={clearLongPress}
          onMouseLeave={clearLongPress}
          className={`w-full h-11 pl-4 pr-2.5 rounded-full !bg-azulado-100 text-sm text-slate-800 text-left flex items-center justify-between ring-inset ${
            errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'ring-1 ring-azulado-300 hover:ring-blue-900/30'
          }`}
          title="Click para abrir ruleta. Doble click o click prolongado para escribir."
        >
          <span className="font-semibold tabular-nums">{draftYear}</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#2C4AAE] text-white">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
            </svg>
          </span>
        </button>
      ) : (
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={manualYear}
          onChange={(e) => {
            onClearError?.();
            setManualYear(e.target.value);
          }}
          onFocus={onClearError}
          onBlur={commitManualYear}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitManualYear();
            if (e.key === 'Escape') setManualMode(false);
          }}
          className={`${CAMPO} !bg-azulado-100 text-center font-semibold ${
            errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : CAMPO_NORMAL
          }`}
        />
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            <div className="absolute inset-0 bg-blue-950/30 backdrop-blur-sm" onClick={commitDraftAndClose} />
            <motion.div
              className="relative w-full max-w-xs rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl overflow-hidden"
              initial={{ y: 14, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.99, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
            <div className="p-4">
              <RuedaOpciones
                key={`year-wheel-${pickerOpenToken}`}
                opciones={opcionesAnios}
                value={Number(draftYear || currentYear)}
                valorInicial={pickerStartYear}
                onChange={(year) => setDraftYear(Number(year))}
                onSettled={(year) => onChange(Number(year))}
                onConfirm={commitDraftAndClose}
                resetToken={pickerOpenToken}
                visibleCount={5}
                itemHeight={40}
                compacta
              />

              <div className="mt-3 flex justify-center">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={popupManualYear}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPopupManualYear(next);
                    setPopupHasError(false);
                    setPopupIsTyping(true);

                    if (popupTypingTimerRef.current) clearTimeout(popupTypingTimerRef.current);
                    popupTypingTimerRef.current = setTimeout(() => setPopupIsTyping(false), 420);

                    applyPopupManualYear(next);

                    if (popupValidationTimerRef.current) clearTimeout(popupValidationTimerRef.current);
                    popupValidationTimerRef.current = setTimeout(() => {
                      const parsed = Number.parseInt(next, 10);
                      const isEmpty = next.trim() === '';
                      setPopupHasError(!isEmpty && !isValidYearInRange(parsed));
                    }, 5000);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitDraftAndClose();
                    }
                  }}
                  className={`w-44 h-10 px-3 rounded-full !bg-azulado-100 text-slate-900 text-center text-sm font-semibold outline-none ring-inset transition-colors ${
                    popupHasError
                      ? 'ring-2 ring-red-500'
                      : 'ring-1 ring-azulado-300 focus:ring-2 focus:ring-blue-900/40'
                  } ${popupIsTyping ? 'animate-pulse' : ''}`}
                  placeholder="Escribir año"
                />
              </div>

              <p
                className={`mt-3 text-xs ${
                  popupHasError ? 'text-red-600 font-semibold' : 'text-slate-600'
                }`}
              >
                {popupHasError
                  ? 'No se encontraron resultados para ese año. Intenta con un valor entre 2010 y 2040.'
                  : 'Usa la rueda del mouse o escribe el año manualmente en el campo superior.'}
              </p>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const InputField = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  required,
  error,
  errorPulse = 0,
  onClearError,
  ...props
}) => {
  const errorMessage = getErrorMessage(error);
  const { motionClass } = useErrorPulse(errorMessage, errorPulse);

  return (
    <div>
      <label className={LABEL_CAMPO}>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(event) => {
          onClearError?.();
          onChange?.(event);
        }}
        onFocus={onClearError}
        onClick={onClearError}
        required={required}
        aria-invalid={Boolean(errorMessage)}
        className={`${CAMPO} ${props.readOnly ? '!bg-slate-100 text-slate-500 cursor-not-allowed' : '!bg-azulado-100'} ${
          errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : CAMPO_NORMAL
        }`}
        {...props}
      />
      {errorMessage && <p className={`text-xs text-red-600 dark:text-red-400 mt-1 ${motionClass}`}>{errorMessage}</p>}
    </div>
  );
};

const DatePickerField = ({ label, name, value, onDateChange, error, errorPulse = 0, minDate, invalidSelectionMessage, onInvalidSelection, showErrorText = true, onFieldInteraction, onClearError }) => {
  const [open, setOpen] = useState(false);
  const campoRef = useRef(null);
  const errorMessage = getErrorMessage(error);
  const { motionClass } = useErrorPulse(errorMessage, errorPulse);

  const parseIsoDate = (iso) => {
    if (!iso || typeof iso !== 'string') return null;
    const parts = iso.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [year, month, day] = parts;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  };

  const toIsoDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDisplayDate = (iso) => {
    const dateObj = parseIsoDate(iso);
    if (!dateObj) return '';
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const parseDisplayDate = (display) => {
    if (!display || typeof display !== 'string') return null;
    const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    const day = Number(dd);
    const month = Number(mm);
    const year = Number(yyyy);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  };

  const [inputValue, setInputValue] = useState(formatDisplayDate(value));

  useEffect(() => {
    setInputValue(formatDisplayDate(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formatDisplayDate es pura; solo depende de value.
  }, [value]);

  const minAllowedDate = parseIsoDate(minDate);

  const avisarFechaNoPermitida = () => {
    if (invalidSelectionMessage) toast.error(invalidSelectionMessage);
    if (onInvalidSelection) onInvalidSelection();
  };

  const handleManualInputChange = (e) => {
    onClearError?.();
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
      if (parsed) {
        if (minAllowedDate && parsed < minAllowedDate) {
          if (onInvalidSelection) onInvalidSelection();
          return;
        }

        onDateChange(name, toIsoDate(parsed), { skipRangeToast: true });
      }
    }

    if (!formatted) {
      onDateChange(name, '');
    }
  };

  const handleManualInputBlur = () => {
    if (!inputValue) {
      onDateChange(name, '');
      return;
    }

    const parsed = parseDisplayDate(inputValue);
    if (parsed) {
      if (minAllowedDate && parsed < minAllowedDate) {
        avisarFechaNoPermitida();
        const previousDisplay = formatDisplayDate(value);
        setInputValue(previousDisplay);
        return;
      }

      const iso = toIsoDate(parsed);
      onDateChange(name, iso, { skipRangeToast: true });
      setInputValue(formatDisplayDate(iso));
      return;
    }

    onDateChange(name, '');
    setInputValue('');
  };

  return (
    <div className="relative">
      <label className={LABEL_CAMPO}>{label}</label>
      <div ref={campoRef} className={`relative w-full rounded-full !bg-azulado-100 ring-inset ${
        errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'ring-1 ring-azulado-300 focus-within:ring-2 focus-within:ring-blue-900/40'
      }`}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={inputValue}
          onChange={handleManualInputChange}
          onBlur={handleManualInputBlur}
          onFocus={onClearError}
          onClick={() => {
            onClearError?.();
            onFieldInteraction?.();
          }}
          className="w-full h-11 !bg-transparent text-sm text-slate-800 placeholder:text-slate-500 px-4 pr-12 rounded-full outline-none"
          aria-label={label}
          aria-invalid={Boolean(errorMessage)}
        />
        <button
          type="button"
          onClick={() => {
            onClearError?.();
            onFieldInteraction?.();
            setOpen((prev) => !prev);
          }}
          className="absolute right-2.5 top-1/2 flex h-6 w-6 items-center justify-center rounded-md bg-[#2C4AAE] text-white hover:bg-[#233C8F] transition-colors"
          style={{ transform: 'translateY(-50%)' }}
          aria-label={`Abrir calendario de ${label}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-13 9h16a1 1 0 001-1V7a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1z" />
          </svg>
        </button>
      </div>

      {/* Sin fecha elegida se abre en el mes de la fecha mínima (p. ej. el inicio del periodo). */}
      <CalendarioFlotante
        abierto={open}
        anclaRef={campoRef}
        onCerrar={() => setOpen(false)}
        value={value}
        min={minDate || undefined}
        onElegir={(iso) => {
          onDateChange(name, iso, { skipRangeToast: true });
          setInputValue(formatDisplayDate(iso));
          setOpen(false);
        }}
        onNoPermitido={avisarFechaNoPermitida}
        onBorrar={() => {
          onDateChange(name, '');
          setOpen(false);
        }}
      />

      {errorMessage && showErrorText && <p className={`text-xs text-red-600 mt-1 ${motionClass}`}>{errorMessage}</p>}
    </div>
  );
};

function ListaCalendarios() {
  const PROJECT_RANGE_TOAST_ID = 'project-range-validation';
  const PROJECT_ORDER_TOAST_ID = 'project-order-validation';
  const lastProjectRangeInvalidRef = useRef(false);
  const lastProjectOrderInvalidRef = useRef(false);
  const [calendarios, setCalendarios] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [carreraFiltro, setCarreraFiltro] = useState('todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [calendarioSeleccionado, setCalendarioSeleccionado] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [calendarioToDelete, setCalendarioToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteImpact, setDeleteImpact] = useState({
    loading: false,
    cargas_horarias: 0,
    failed: false,
    detail: '',
  });
  const [showDependencyWarningModal, setShowDependencyWarningModal] = useState(false);

  const [showToggleModal, setShowToggleModal] = useState(false);
  const [calendarioToToggle, setCalendarioToToggle] = useState(null);

  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorPulse, setErrorPulse] = useState(0);

  const periodoOptions = [
    { value: '1', label: 'Primer Semestre' },
    { value: '2', label: 'Segundo Semestre' },
    { value: 'anual', label: 'Anual' },
  ];
  const { effectiveUser, activeRole } = useActiveRole();
  const esSuperAdmin = effectiveUser?.is_superuser === true;
  // Crean, editan, activan y eliminan: superusuario, Director y Jefe de Estudios (rol
  // activo, en su carrera; el backend lo exige). El resto solo consulta.
  const puedeGestionar = esSuperAdmin || ['director', 'jefe_estudios'].includes(activeRole);
  const hayUnaSolaCarrera = carreras.length === 1;
  const carreraOptions = carreras.map((carrera) => ({
    value: String(carrera.id),
    label: carrera.nombre,
  }));
  const calendariosFiltrados = esSuperAdmin && carreraFiltro && carreraFiltro !== 'todas'
    ? calendarios.filter((cal) => String(cal.carrera) === String(carreraFiltro))
    : calendarios;

  // Gestión por defecto: el año actual en Bolivia.
  const currentYear = Number(hoyBolivia().slice(0, 4));

  const buildInitialFormData = () => ({
    // Director y Jefe: su carrera (el backend solo les devuelve esa); el superusuario elige.
    carrera: (!esSuperAdmin || hayUnaSolaCarrera) && carreras.length ? carreras[0].id : '',
    gestion: currentYear,
    periodo: '1',
    fecha_inicio: '',
    fecha_fin: '',
    fecha_inicio_presentacion_proyectos: '',
    fecha_limite_presentacion_proyectos: '',
    fecha_limite_programas_analiticos: '',
    fecha_inicio_receso: '',
    fecha_fin_receso: '',
    dias_feriados_gestion: '',
    activo: false,
  });

  const applyErrors = (nextErrors) => {
    setErrors(nextErrors);
    setErrorPulse((prev) => prev + 1);
  };

  const clearFieldError = (fieldName) => {
    setErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  };

  const parseDateValue = (rawValue) => {
    if (!rawValue || typeof rawValue !== 'string') return null;

    const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (
        date.getFullYear() === Number(yyyy)
        && date.getMonth() === Number(mm) - 1
        && date.getDate() === Number(dd)
      ) {
        return date;
      }
      return null;
    }

    const displayMatch = rawValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (displayMatch) {
      const [, dd, mm, yyyy] = displayMatch;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (
        date.getFullYear() === Number(yyyy)
        && date.getMonth() === Number(mm) - 1
        && date.getDate() === Number(dd)
      ) {
        return date;
      }
      return null;
    }

    return null;
  };

  const toIsoString = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const extractValidationMessage = (data) => {
    if (!data) return 'Datos inválidos.';
    if (typeof data === 'string') return data;
    if (typeof data?.error === 'string') return data.error;
    if (typeof data?.detail === 'string') return data.detail;
    if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length > 0) {
      return String(data.non_field_errors[0]);
    }

    if (typeof data === 'object') {
      const firstKey = Object.keys(data)[0];
      const firstValue = data[firstKey];
      if (Array.isArray(firstValue) && firstValue.length > 0) return String(firstValue[0]);
      if (typeof firstValue === 'string') return firstValue;
      if (typeof firstValue === 'object' && firstValue !== null) {
        const nested = Object.values(firstValue)[0];
        if (Array.isArray(nested) && nested.length > 0) return String(nested[0]);
        if (typeof nested === 'string') return nested;
      }
    }

    return 'Datos inválidos.';
  };

  const fechaInicioDate = parseDateValue(formData.fecha_inicio);
  const fechaFinDate = parseDateValue(formData.fecha_fin);
  const proyectoInicioDate = parseDateValue(formData.fecha_inicio_presentacion_proyectos);
  const proyectoFinDate = parseDateValue(formData.fecha_limite_presentacion_proyectos);

  const endDateErrorMessage = 'La fecha de finalización no puede ser anterior a la de inicio';
  const activeCalendarEditWarning = 'ATENCIÓN: Estás editando un calendario en uso. Cambiar las fechas límite puede afectar la visibilidad de los formularios para los docentes.';
  const criticalProjectRangeMessage = 'Error Crítico: el rango del semestre deja fechas de proyectos fuera del periodo académico. Corrige las fechas antes de guardar.';

  const isDateRangeInvalid = finAnteriorAInicio(formData.fecha_inicio, formData.fecha_fin);
  const recesoOrderErrorMessage = 'La fecha de fin del receso no puede ser anterior a la de inicio';
  const isRecesoOrderInvalid = finAnteriorAInicio(formData.fecha_inicio_receso, formData.fecha_fin_receso);
  const projectRangeWarning = 'La presentación de proyectos debe ocurrir dentro del periodo académico seleccionado';
  const projectOrderErrorMessage = 'La fecha límite de proyectos debe ser posterior a la fecha de inicio';
  const isProjectOrderInvalid = Boolean(
    proyectoInicioDate
    && proyectoFinDate
    && proyectoFinDate.getTime() <= proyectoInicioDate.getTime()
  );
  const projectStartOutOfRange = Boolean(
    fechaInicioDate
    && fechaFinDate
    && proyectoInicioDate
    && (
      proyectoInicioDate.getTime() < fechaInicioDate.getTime()
      || proyectoInicioDate.getTime() > fechaFinDate.getTime()
    )
  );
  const projectEndOutOfRange = Boolean(
    fechaInicioDate
    && fechaFinDate
    && proyectoFinDate
    && (
      proyectoFinDate.getTime() < fechaInicioDate.getTime()
      || proyectoFinDate.getTime() > fechaFinDate.getTime()
    )
  );
  const isProjectRangeInvalid = Boolean(projectStartOutOfRange || projectEndOutOfRange);
  const isEditingActiveCalendar = Boolean(calendarioSeleccionado?.activo);
  const isCriticalProjectRangeConflict = Boolean(isEditingActiveCalendar && isProjectRangeInvalid);
  const semanasCalendario = (
    fechaInicioDate
    && fechaFinDate
    && fechaFinDate.getTime() >= fechaInicioDate.getTime()
  )
    ? Math.round((fechaFinDate.getTime() - fechaInicioDate.getTime()) / (1000 * 60 * 60 * 24 * 7))
    : null;
  const semanasCalendarioDisplay = semanasCalendario === null
    ? ''
    : String(semanasCalendario);
  const isSaveBlocked = Boolean(isSubmitting);

  // Los días de feriado son de la gestión: iguales en todos sus calendarios de la carrera.
  const calendarioDeLaMismaGestion = calendarios.find((calendario) => (
    String(calendario.carrera) === String(formData.carrera)
    && String(calendario.gestion) === String(formData.gestion)
    && calendario.id !== calendarioSeleccionado?.id
  ));
  const diasFeriadosDeLaGestion = calendarioDeLaMismaGestion?.dias_feriados_gestion;
  useEffect(() => {
    // Calendario nuevo: toma los días de feriado del otro calendario de su gestión.
    if (calendarioSeleccionado || diasFeriadosDeLaGestion === undefined) return;
    setFormData((prev) => ({ ...prev, dias_feriados_gestion: diasFeriadosDeLaGestion }));
  }, [calendarioSeleccionado, diasFeriadosDeLaGestion]);

  useEffect(() => {
    cargarCalendarios();
  }, []);

  const cargarCalendarios = async () => {
    setLoading(true);
    try {
      const [data, carrerasData] = await Promise.all([getCalendarios(), getCarreras()]);
      const carrerasLista = Array.isArray(carrerasData) ? carrerasData : [];
      setCarreras(carrerasLista);
      if (carrerasLista.length === 1) {
        setCarreraFiltro(String(carrerasLista[0].id));
      } else {
        setCarreraFiltro('todas');
      }
      setCalendarios(Array.isArray(data) ? data.sort((a, b) => b.gestion - a.gestion || b.periodo.localeCompare(a.periodo)) : []);
    } catch (err) {
      setError('Error al cargar los calendarios académicos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = (calendario = null) => {
    setCalendarioSeleccionado(calendario);
    setFormData(calendario ? {
      carrera: calendario.carrera || '',
      gestion: calendario.gestion,
      periodo: calendario.periodo,
      fecha_inicio: calendario.fecha_inicio,
      fecha_fin: calendario.fecha_fin,
      fecha_inicio_presentacion_proyectos: calendario.fecha_inicio_presentacion_proyectos,
      fecha_limite_presentacion_proyectos: calendario.fecha_limite_presentacion_proyectos,
      fecha_limite_programas_analiticos: calendario.fecha_limite_programas_analiticos || '',
      fecha_inicio_receso: calendario.fecha_inicio_receso || '',
      fecha_fin_receso: calendario.fecha_fin_receso || '',
      dias_feriados_gestion: calendario.dias_feriados_gestion ?? '',
      activo: calendario.activo,
    } : buildInitialFormData());
    setErrors({});
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    clearFieldError(name);
    const nextValue = name === 'dias_feriados_gestion' && value !== ''
      ? Math.round(Number(value))
      : value;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : nextValue
    }));
  };

  const handleCarreraChange = (e) => {
    clearFieldError('carrera');
    setFormData((prev) => ({ ...prev, carrera: e.target.value }));
  };

  const handlePeriodoChange = (periodo) => {
    clearFieldError('periodo');
    setFormData((prev) => ({ ...prev, periodo }));
  };

  const handleGestionChange = (gestion) => {
    clearFieldError('gestion');
    setFormData((prev) => ({ ...prev, gestion }));
  };

  const handleDateFieldChange = (name, isoDate, options = {}) => {
    clearFieldError(name);
    const { skipRangeToast = false } = options;
    const normalized = isoDate
      ? (() => {
          const parsed = parseDateValue(isoDate);
          return parsed ? toIsoString(parsed) : '';
        })()
      : '';
    // Solo con las dos fechas llenas: una fecha de fin anterior al inicio no se acepta.
    const accepted = !(name === 'fecha_fin' && finAnteriorAInicio(formData.fecha_inicio, normalized));
    if (accepted) {
      setFormData((prev) => ({ ...prev, [name]: normalized }));
    }

    if (!accepted) {
      if (!skipRangeToast) {
        toast.error(endDateErrorMessage);
      }
      setErrors((prev) => ({
        ...prev,
        fecha_fin: endDateErrorMessage,
        fecha_inicio: endDateErrorMessage,
      }));
      return false;
    }

    setErrors((prev) => {
      if (!prev.fecha_fin && !prev.fecha_inicio) return prev;
      const next = { ...prev };
      delete next.fecha_fin;
      delete next.fecha_inicio;
      return next;
    });

    if (
      name === 'fecha_inicio_presentacion_proyectos'
      || name === 'fecha_limite_presentacion_proyectos'
    ) {
      const nextProjectDate = parseDateValue(normalized);
      const currentStart = parseDateValue(formData.fecha_inicio);
      const currentEnd = parseDateValue(formData.fecha_fin);
      if (
        nextProjectDate
        && currentStart
        && currentEnd
        && (
          nextProjectDate.getTime() < currentStart.getTime()
          || nextProjectDate.getTime() > currentEnd.getTime()
        )
      ) {
        toast.error(projectRangeWarning, { id: PROJECT_RANGE_TOAST_ID });
      } else {
        toast.dismiss(PROJECT_RANGE_TOAST_ID);
      }
    }

    return true;
  };

  const notifyProjectRangeIfInvalid = () => {
    // Limpia cualquier notificación anterior mientras el usuario vuelve a elegir fecha.
    toast.dismiss(PROJECT_RANGE_TOAST_ID);
  };

  useEffect(() => {
    if (isProjectRangeInvalid && !lastProjectRangeInvalidRef.current) {
      toast.error(projectRangeWarning, { id: PROJECT_RANGE_TOAST_ID });
    }
    if (!isProjectRangeInvalid) {
      toast.dismiss(PROJECT_RANGE_TOAST_ID);
    }

    if (isProjectOrderInvalid && !lastProjectOrderInvalidRef.current) {
      toast.error('Error: El cierre de proyectos no puede ser antes de la apertura', { id: PROJECT_ORDER_TOAST_ID });
    }
    if (!isProjectOrderInvalid) {
      toast.dismiss(PROJECT_ORDER_TOAST_ID);
    }

    if (!isProjectRangeInvalid && !isProjectOrderInvalid) {
      setErrors((prev) => {
        if (!prev.fecha_inicio_presentacion_proyectos && !prev.fecha_limite_presentacion_proyectos) {
          return prev;
        }
        const next = { ...prev };
        delete next.fecha_inicio_presentacion_proyectos;
        delete next.fecha_limite_presentacion_proyectos;
        return next;
      });
    }

    lastProjectRangeInvalidRef.current = isProjectRangeInvalid;
    lastProjectOrderInvalidRef.current = isProjectOrderInvalid;
  }, [isProjectRangeInvalid, isProjectOrderInvalid]);

  const handleActivoSwitchChange = () => {
    setFormData((prev) => ({ ...prev, activo: !prev.activo }));
  };

  const resetAndCloseModal = () => {
    setFormData(buildInitialFormData());
    setErrors({});
    setCalendarioSeleccionado(null);
    setShowModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!esSuperAdmin && !formData.carrera) {
      toast.error('No tienes una carrera asignada.');
      return;
    }

    const requiredErrors = {};
    if (!formData.carrera) requiredErrors.carrera = 'Este campo es obligatorio.';
    if (!formData.gestion) requiredErrors.gestion = 'Este campo es obligatorio.';
    if (!formData.periodo) requiredErrors.periodo = 'Este campo es obligatorio.';
    if (!formData.fecha_inicio) requiredErrors.fecha_inicio = 'La fecha de inicio es obligatoria.';
    if (!formData.fecha_fin) requiredErrors.fecha_fin = 'La fecha de fin es obligatoria.';
    if (!formData.fecha_inicio_presentacion_proyectos) requiredErrors.fecha_inicio_presentacion_proyectos = 'Este campo es obligatorio.';
    if (!formData.fecha_limite_presentacion_proyectos) requiredErrors.fecha_limite_presentacion_proyectos = 'Este campo es obligatorio.';
    const diasFeriadosVacio = formData.dias_feriados_gestion === ''
      || formData.dias_feriados_gestion === null
      || formData.dias_feriados_gestion === undefined;
    if (diasFeriadosVacio) {
      requiredErrors.dias_feriados_gestion = 'Este campo es obligatorio.';
    }
    // "Completa..." solo si de verdad falta un campo; lleno pero inválido: "Revisa...".
    const faltaCampo = Object.keys(requiredErrors).length > 0;
    if (!diasFeriadosVacio && (Number(formData.dias_feriados_gestion) < 0 || Number(formData.dias_feriados_gestion) > 30)) {
      requiredErrors.dias_feriados_gestion = 'Debe estar entre 0 y 30 días.';
    }

    if (Object.keys(requiredErrors).length > 0) {
      applyErrors(requiredErrors);
      toast.error(faltaCampo ? 'Completa los campos obligatorios.' : 'Revisa los campos marcados en rojo.');
      return;
    }

    if (isProjectOrderInvalid) {
      toast.error('Error: El cierre de proyectos no puede ser antes de la apertura');
      applyErrors({
        ...errors,
        fecha_inicio_presentacion_proyectos: projectOrderErrorMessage,
        fecha_limite_presentacion_proyectos: projectOrderErrorMessage,
      });
      return;
    }

    if (isCriticalProjectRangeConflict) {
      toast.error(criticalProjectRangeMessage);
      applyErrors({
        ...errors,
        fecha_inicio_presentacion_proyectos: criticalProjectRangeMessage,
        fecha_limite_presentacion_proyectos: criticalProjectRangeMessage,
      });
      return;
    }

    if (isDateRangeInvalid) {
      applyErrors({
        ...errors,
        fecha_inicio: endDateErrorMessage,
        fecha_fin: endDateErrorMessage,
      });
      return;
    }

    if (isProjectRangeInvalid) {
      toast.error(projectRangeWarning);
      return;
    }

    if (isRecesoOrderInvalid) {
      applyErrors({ ...errors, fecha_fin_receso: recesoOrderErrorMessage });
      toast.error(recesoOrderErrorMessage);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    
    const payload = {
      ...formData,
      carrera: Number(formData.carrera),
      gestion: parseInt(formData.gestion),
      dias_feriados_gestion: parseInt(formData.dias_feriados_gestion),
      fecha_limite_programas_analiticos: formData.fecha_limite_programas_analiticos || null,
      fecha_inicio_receso: formData.fecha_inicio_receso || null,
      fecha_fin_receso: formData.fecha_fin_receso || null,
    };

    const duplicateExists = calendarios.some((cal) => (
      Number(cal.carrera) === Number(payload.carrera)
      && Number(cal.gestion) === Number(payload.gestion)
      && String(cal.periodo) === String(payload.periodo)
      && Number(cal.id) !== Number(calendarioSeleccionado?.id || 0)
    ));

    if (duplicateExists) {
      const duplicateMsg = 'Ya existe un calendario para esta carrera, gestion y periodo';
      applyErrors({ ...errors, carrera: duplicateMsg, gestion: duplicateMsg, periodo: duplicateMsg });
      toast.error(duplicateMsg);
      setIsSubmitting(false);
      return;
    }

    // Art. 9: en una gestión, la carrera tiene solo calendarios anuales o solo semestrales (como el backend).
    const regimenMezclado = calendarios.some((cal) => (
      Number(cal.carrera) === Number(payload.carrera)
      && Number(cal.gestion) === Number(payload.gestion)
      && Number(cal.id) !== Number(calendarioSeleccionado?.id || 0)
      && (String(cal.periodo) === 'anual') !== (String(payload.periodo) === 'anual')
    ));

    if (regimenMezclado) {
      const regimenMsg = `La carrera ya tiene un calendario ${payload.periodo === 'anual' ? 'semestral' : 'anual'} en la gestión ${payload.gestion}: en una gestión, todos sus calendarios son anuales o todos semestrales (Art. 9).`;
      applyErrors({ ...errors, periodo: regimenMsg });
      toast.error(regimenMsg);
      setIsSubmitting(false);
      return;
    }

    try {
      if (calendarioSeleccionado) {
        const response = await api.put(`/calendarios/${calendarioSeleccionado.id}/`, payload);
        if (response.data?.id) {
          // El backend copia los días de feriado a los demás calendarios de la gestión.
          setCalendarios((prev) => prev.map((calendario) => {
            if (calendario.id === response.data.id) return response.data;
            const mismaGestion = String(calendario.carrera) === String(response.data.carrera)
              && String(calendario.gestion) === String(response.data.gestion);
            return mismaGestion ? { ...calendario, dias_feriados_gestion: response.data.dias_feriados_gestion } : calendario;
          }));
        }
        toast.success('Calendario actualizado correctamente');
        resetAndCloseModal();
      } else {
        const response = await api.post('/calendarios/', payload);
        if (response.data?.id) {
          setCalendarios((prev) => [response.data, ...prev].sort((a, b) => b.gestion - a.gestion || b.periodo.localeCompare(a.periodo)));
        }
        toast.success(`Calendario Académico ${payload.gestion}-${payload.periodo} creado exitosamente. Ahora puedes asignar Fondos de Tiempo.`);
        resetAndCloseModal();
      }
    } catch (err) {
      console.error(err);
      const statusCode = err.response?.status;
      const apiErrors = err.response?.data;
      if (apiErrors) {
        if (statusCode === 400) {
          const validationMessage = extractValidationMessage(apiErrors);
          const duplicateText = validationMessage.toLowerCase();
          if (duplicateText.includes('unique') || duplicateText.includes('already exists') || duplicateText.includes('ya existe')) {
            const duplicateMsg = 'Ya existe un calendario para esta carrera, gestion y periodo';
            applyErrors({ ...errors, carrera: duplicateMsg, gestion: duplicateMsg, periodo: duplicateMsg });
            toast.error(`ERROR DE VALIDACIÓN: ${duplicateMsg}`);
            return;
          }

          if (apiErrors?.details && typeof apiErrors.details === 'object') {
            applyErrors(sanitizeApiErrors(apiErrors.details));
          } else if (typeof apiErrors === 'object') {
            applyErrors(sanitizeApiErrors(apiErrors));
          }

          toast.error(`ERROR DE VALIDACIÓN: ${validationMessage}`);
          return;
        }

        const fallbackError = extractValidationMessage(apiErrors);
        toast.error(`Error: ${fallbackError}`);
      } else {
        toast.error('Ocurrió un error inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActivo = (calendario) => {
    setCalendarioToToggle(calendario);
    setShowToggleModal(true);
  };

  const openDependencyWarning = (calendario, impactData, customDetail) => {
    setCalendarioToDelete(calendario);
    setDeleteImpact({
      loading: false,
      cargas_horarias: impactData?.cargas_horarias || 0,
      fondos_gestion: impactData?.fondos_gestion || 0,
      failed: false,
      detail: customDetail || '',
    });
    setShowDependencyWarningModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setCalendarioToDelete(null);
    setDeleteConfirmText('');
    setDeleteImpact({
      loading: false,
      cargas_horarias: 0,
      failed: false,
      detail: '',
    });
  };

  const confirmarToggleActivo = async () => {
    if (!calendarioToToggle) return;
    toast.loading(calendarioToToggle.activo ? 'Desactivando calendario...' : 'Activando calendario...');
    try {
      const response = await api.patch(`/calendarios/${calendarioToToggle.id}/`, { activo: !calendarioToToggle.activo });
      toast.dismiss();
      toast.success(`Calendario ${calendarioToToggle.activo ? 'desactivado' : 'activado'} correctamente.`);
      setShowToggleModal(false);
      setCalendarioToToggle(null);
      setCalendarios((prev) => prev.map((calendario) => (
        calendario.id === calendarioToToggle.id
          ? (response.data?.id ? response.data : { ...calendario, activo: !calendario.activo })
          : calendario
      )));
    } catch (err) {
      toast.dismiss();
      toast.error('Error al cambiar el estado del calendario.');
      console.error(err);
    }
  };

  const eliminarCalendario = async (calendario) => {
    if (!calendario?.id) return;

    try {
      const response = await api.get(`/calendarios/${calendario.id}/dependencias/`);
      const deps = response.data || {};

      if (deps.can_delete) {
        setCalendarioToDelete(calendario);
        setDeleteConfirmText('');
        setDeleteImpact({
          loading: false,
          cargas_horarias: deps.cargas_horarias || 0,
          failed: false,
          detail: '',
        });
        setShowDeleteModal(true);
        return;
      }

      openDependencyWarning(calendario, deps, deps.detalle);
    } catch (err) {
      console.error('Error verificando dependencias del calendario:', err);
      toast.error('No se pudo verificar dependencias del calendario. Intenta nuevamente.');
    }
  };

  const confirmarEliminar = async () => {
    if (!calendarioToDelete) return;

    const calendarioLabel = `${calendarioToDelete?.gestion || ''} - ${calendarioToDelete?.periodo_display || ''}`;
    if (deleteConfirmText !== calendarioLabel) {
      toast.error('Debes escribir exactamente el nombre del calendario para confirmar');
      return;
    }

    const existeEnEstado = calendarios.some((cal) => cal.id === calendarioToDelete.id);
    if (!existeEnEstado) {
      toast.error('El calendario ya no existe en la lista actual.');
      closeDeleteModal();
      return;
    }

    try {
      await api.delete(`/calendarios/${calendarioToDelete.id}/`);

      // Sincronización inmediata de UI para evitar doble borrado sobre un elemento ya eliminado.
      setCalendarios((prev) => prev.filter((cal) => cal.id !== calendarioToDelete.id));
      toast.success('Calendario eliminado correctamente');
      closeDeleteModal();
    } catch (err) {
      console.error(err);
      const apiData = err.response?.data;
      if (apiData?.code === 'protected_error') {
        const deps = apiData?.dependencias || {};
        closeDeleteModal();
        openDependencyWarning(calendarioToDelete, deps, apiData?.detail);
        return;
      }
      toast.error('Error al eliminar: ' + (apiData?.detail || err.message));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando calendarios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh] p-6">
        <div className={`${BLOQUE} p-6 max-w-md w-full text-center`}>
          <p className="text-red-600 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  const totalActivos = calendariosFiltrados.filter((cal) => cal.activo).length;
  const nombreCarreraFiltro = carreraOptions.find((opt) => String(opt.value) === String(carreraFiltro))?.label;
  const hayFiltroCarrera = esSuperAdmin && carreraFiltro && carreraFiltro !== 'todas';

  return (
    <div className="min-h-full px-3 sm:px-4 md:px-8 py-4 md:py-6 text-slate-800">
      <div className="space-y-4">
        {/* Bloque 1: encabezado con la acción y, al lado, el total (como el dashboard de fondos) */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className={`${BLOQUE} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0">
                <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
                  <IconoCalendario className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Periodos, gestiones y fechas importantes
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">
                    Calendario Académico
                  </h2>
                </div>
              </div>
              {puedeGestionar && (
                <button data-escritura
                  onClick={() => abrirModal()}
                  className={`${BOTON} w-full sm:w-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
                >
                  <IconoMas className="w-5 h-5" />
                  <span>Nuevo Calendario</span>
                </button>
              )}
            </div>
          </div>

          {/* Total de la carrera filtrada; al cambiar de carrera los números cuentan hasta el nuevo valor. */}
          <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Calendarios</p>
                <p
                  key={carreraFiltro || 'todas'}
                  className="animate-campo-entrada mt-1.5 text-sm font-semibold text-white leading-snug line-clamp-2"
                  title={hayFiltroCarrera ? nombreCarreraFiltro : 'Todas las carreras'}
                >
                  {hayFiltroCarrera ? nombreCarreraFiltro : (esSuperAdmin ? 'Todas las carreras' : 'Tu carrera')}
                </p>
              </div>
              <span className="text-5xl font-bold tabular-nums leading-none">
                <NumeroAnimado valor={calendariosFiltrados.length} />
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <NumeroAnimado valor={totalActivos} singular="activo" plural="activos" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                <NumeroAnimado valor={calendariosFiltrados.length - totalActivos} singular="inactivo" plural="inactivos" />
              </span>
            </div>
          </div>
        </div>

        {/* Bloque 2: filtro de carrera (solo el superusuario ve todas las carreras) */}
        {esSuperAdmin && (
          <div className={`${BLOQUE} p-3`}>
            <div className="w-full sm:w-80">
              <SelectConDropdown
                name="carrera"
                value={carreraFiltro}
                onChange={(event) => setCarreraFiltro(event.target.value)}
                options={[{ value: 'todas', label: 'Todas las carreras' }, ...carreraOptions]}
                placeholder="Todas las carreras"
                emptyText="No hay carreras"
                hideSelectedOption
              />
            </div>
          </div>
        )}

        {/* Bloque 3: calendarios en tarjetas de la misma altura */}
        {calendariosFiltrados.length > 0 ? (
          <div key={`calendarios-${carreraFiltro}`} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {calendariosFiltrados.map((cal, indice) => {
              const datos = [
                { label: 'Periodo', valor: rangoFechas(cal.fecha_inicio, cal.fecha_fin) },
                { label: 'Presentación de proyectos', valor: rangoFechas(cal.fecha_inicio_presentacion_proyectos, cal.fecha_limite_presentacion_proyectos) },
                { label: 'Programas analíticos', valor: cal.fecha_limite_programas_analiticos ? `Hasta ${formatoFecha(cal.fecha_limite_programas_analiticos)}` : '—' },
                { label: 'Receso', valor: rangoFechas(cal.fecha_inicio_receso, cal.fecha_fin_receso) },
              ];
              return (
                <div
                  key={cal.id}
                  style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                  className={`${BLOQUE} animate-fondo-entrada p-5 flex flex-col gap-4`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-blue-900 text-white leading-none">
                        <span className="text-sm font-bold tabular-nums">{cal.gestion}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-blue-900 truncate">{cal.periodo_display}</h3>
                        <p className="text-sm text-slate-600 truncate">{cal.carrera_nombre || 'Sin carrera'}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
                      cal.activo ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-300'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cal.activo ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                      {cal.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 px-4 py-3">
                    {datos.map((dato) => (
                      <div key={dato.label} className="min-w-0">
                        <dt className="text-xs font-semibold text-blue-800">{dato.label}</dt>
                        <dd className="mt-0.5 text-[13px] font-semibold text-slate-800 tabular-nums">{dato.valor}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    {cal.semanas_calendario ? <Etiqueta>{cal.semanas_calendario} semanas</Etiqueta> : null}
                    <Etiqueta>{Number(cal.dias_feriados_gestion || 0)} {Number(cal.dias_feriados_gestion) === 1 ? 'día' : 'días'} de feriado</Etiqueta>
                  </div>

                  {puedeGestionar && (
                    <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-2 [border-top:1px_solid_#B8C9E1]">
                      <span data-escritura className="flex items-center gap-2.5">
                        <ToggleSwitch
                          isActive={cal.activo}
                          onChange={() => handleToggleActivo(cal)}
                        />
                        <span className="text-sm text-slate-700">{cal.activo ? 'Activo' : 'Inactivo'}</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button data-escritura
                          type="button"
                          onClick={() => abrirModal(cal)}
                          className={`${BOTON} bg-emerald-500 hover:bg-emerald-600 text-white`}
                        >
                          <FaEdit size={14} />
                          <span>Editar</span>
                        </button>
                        <button data-escritura
                          type="button"
                          onClick={() => eliminarCalendario(cal)}
                          className={`${BOTON} bg-red-400 hover:bg-red-500 text-white`}
                        >
                          <FaTrash size={13} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {calendarios.length > 0 ? 'No hay calendarios para esta carrera' : 'No hay calendarios registrados'}
            </h3>
            <p className="text-slate-600">
              {calendarios.length > 0 ? 'Elige otra carrera o crea un calendario nuevo.' : 'Crea el primer calendario académico.'}
            </p>
          </div>
        )}
      </div>

      {showModal && createPortal(
        <div
          className="fixed top-0 right-0 bottom-0 z-50 overflow-y-auto bg-blue-950/30 backdrop-blur-sm animate-fade-in"
          style={{ left: 'var(--fondo-sidebar-width, 0px)', animationDuration: '160ms' }}
        >
          {/* Si el formulario no entra en la pantalla se desplaza el fondo: nada queda cortado. */}
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
          <div className="bg-azulado-50 rounded-3xl ring-1 ring-azulado-300 shadow-2xl max-w-6xl w-full overflow-visible animate-slide-up" style={{ animationDuration: '180ms' }}>
            <div className="px-5 sm:px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
              <h3 className="text-xl font-bold text-blue-900">
                {calendarioSeleccionado ? 'Editar Calendario' : 'Nuevo Calendario'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-6">
              {isEditingActiveCalendar && (
                <div className="mb-4 rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-3 text-sm font-semibold text-red-800">
                  {activeCalendarEditWarning}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
                {esSuperAdmin && (
                <div className="md:col-span-2 xl:col-span-1">
                  <SelectConDropdown
                    label="Carrera"
                    name="carrera"
                    value={formData.carrera || ''}
                    onChange={handleCarreraChange}
                    disabled={hayUnaSolaCarrera || Boolean(calendarioSeleccionado)}
                    options={carreraOptions}
                    placeholder="Seleccione una carrera"
                    emptyText="No hay carreras"
                    error={errors.carrera}
                    errorPulse={errorPulse}
                    onClearError={() => clearFieldError('carrera')}
                    clearValue=""
                  />
                </div>
                )}
                <div className={esSuperAdmin ? 'md:col-span-2 xl:col-span-1' : 'md:col-span-2'}>
                  <label className={LABEL_CAMPO}>Gestión (Año)</label>
                  <YearPickerField
                    value={Number(formData.gestion || currentYear)}
                    onChange={handleGestionChange}
                    currentYear={currentYear}
                    error={errors.gestion}
                    errorPulse={errorPulse}
                    onClearError={() => clearFieldError('gestion')}
                  />
                  {errors.gestion && <p className="text-xs text-red-600 mt-1">{getErrorMessage(errors.gestion)}</p>}
                </div>
                <div className="md:col-span-2 xl:col-span-2">
                  <label className={LABEL_CAMPO}>Periodo</label>
                  <SegmentedOptions
                    options={periodoOptions}
                    value={formData.periodo}
                    onChange={handlePeriodoChange}
                    className="grid-cols-3"
                    error={errors.periodo}
                    errorPulse={errorPulse}
                    onClearError={() => clearFieldError('periodo')}
                  />
                  {errors.periodo && <p className="text-xs text-red-600 mt-1">{getErrorMessage(errors.periodo)}</p>}
                </div>

                <div className="md:col-span-2 rounded-2xl bg-white/70 ring-1 ring-inset ring-azulado-300 p-4">
                  <h4 className="text-sm font-bold text-blue-900 mb-3">Rango del Periodo Académico</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DatePickerField
                      label="Fecha de Inicio"
                      name="fecha_inicio"
                      value={formData.fecha_inicio}
                      onDateChange={handleDateFieldChange}
                      required
                      error={errors.fecha_inicio || (isDateRangeInvalid ? endDateErrorMessage : '')}
                      errorPulse={errorPulse}
                      onClearError={() => clearFieldError('fecha_inicio')}
                    />
                    <DatePickerField
                      label="Fecha de Fin"
                      name="fecha_fin"
                      value={formData.fecha_fin}
                      onDateChange={handleDateFieldChange}
                      minDate={formData.fecha_inicio}
                      invalidSelectionMessage={endDateErrorMessage}
                      onInvalidSelection={() => {
                        setErrors((prev) => ({
                          ...prev,
                          fecha_inicio: endDateErrorMessage,
                          fecha_fin: endDateErrorMessage,
                        }));
                      }}
                      required
                      error={errors.fecha_fin || (isDateRangeInvalid ? endDateErrorMessage : '')}
                      errorPulse={errorPulse}
                      onClearError={() => clearFieldError('fecha_fin')}
                    />
                  </div>
                </div>

                <div className="md:col-span-2 rounded-2xl bg-white/70 ring-1 ring-inset ring-azulado-300 p-4">
                  <h4 className="text-sm font-bold text-blue-900 mb-3">Presentación de Proyectos</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DatePickerField
                      label="Inicio Presentación Proyectos"
                      name="fecha_inicio_presentacion_proyectos"
                      value={formData.fecha_inicio_presentacion_proyectos}
                      onDateChange={handleDateFieldChange}
                      required
                      error={errors.fecha_inicio_presentacion_proyectos || (isProjectOrderInvalid ? projectOrderErrorMessage : '') || (projectStartOutOfRange ? projectRangeWarning : '')}
                      errorPulse={errorPulse}
                      onFieldInteraction={() => notifyProjectRangeIfInvalid('fecha_inicio_presentacion_proyectos')}
                      onClearError={() => clearFieldError('fecha_inicio_presentacion_proyectos')}
                    />
                    <DatePickerField
                      label="Límite Presentación Proyectos"
                      name="fecha_limite_presentacion_proyectos"
                      value={formData.fecha_limite_presentacion_proyectos}
                      onDateChange={handleDateFieldChange}
                      required
                      error={errors.fecha_limite_presentacion_proyectos || (isProjectOrderInvalid ? projectOrderErrorMessage : '') || (projectEndOutOfRange ? projectRangeWarning : '')}
                      errorPulse={errorPulse}
                      onFieldInteraction={() => notifyProjectRangeIfInvalid('fecha_limite_presentacion_proyectos')}
                      onClearError={() => clearFieldError('fecha_limite_presentacion_proyectos')}
                    />
                  </div>
                </div>

                {isDateRangeInvalid && (
                  <div className="md:col-span-2 xl:col-span-4 rounded-2xl bg-amber-50 ring-1 ring-inset ring-amber-200 px-4 py-2.5 text-sm text-amber-800">
                    {endDateErrorMessage}
                  </div>
                )}

                {isCriticalProjectRangeConflict && (
                  <div className="md:col-span-2 xl:col-span-4 rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-2.5 text-sm font-semibold text-red-800">
                    {criticalProjectRangeMessage}
                  </div>
                )}

                <DatePickerField
                  label="Fecha límite programas analíticos"
                  name="fecha_limite_programas_analiticos"
                  value={formData.fecha_limite_programas_analiticos}
                  onDateChange={handleDateFieldChange}
                  error={errors.fecha_limite_programas_analiticos}
                  errorPulse={errorPulse}
                  onClearError={() => clearFieldError('fecha_limite_programas_analiticos')}
                />
                <DatePickerField
                  label="Inicio receso académico"
                  name="fecha_inicio_receso"
                  value={formData.fecha_inicio_receso}
                  onDateChange={handleDateFieldChange}
                  error={errors.fecha_inicio_receso}
                  errorPulse={errorPulse}
                  onClearError={() => clearFieldError('fecha_inicio_receso')}
                />
                <DatePickerField
                  label="Fin receso académico"
                  name="fecha_fin_receso"
                  value={formData.fecha_fin_receso}
                  onDateChange={handleDateFieldChange}
                  minDate={formData.fecha_inicio_receso}
                  invalidSelectionMessage={recesoOrderErrorMessage}
                  error={errors.fecha_fin_receso || (isRecesoOrderInvalid ? recesoOrderErrorMessage : '')}
                  errorPulse={errorPulse}
                  onClearError={() => clearFieldError('fecha_fin_receso')}
                />
                <div>
                  <InputField
                    label="Semanas Calendario"
                    name="semanas_calendario"
                    type="number"
                    value={semanasCalendarioDisplay}
                    onChange={() => {}}
                    readOnly
                  />
                  <p className="mt-1 pl-1 text-xs text-slate-600">
                    Total de semanas del periodo (calculado)
                  </p>
                </div>
                <div>
                  <InputField
                    label="Días de feriado de la gestión"
                    name="dias_feriados_gestion"
                    type="number"
                    min="0"
                    max="30"
                    step="1"
                    value={formData.dias_feriados_gestion}
                    onChange={handleChange}
                    required
                    error={errors.dias_feriados_gestion}
                    errorPulse={errorPulse}
                    onClearError={() => clearFieldError('dias_feriados_gestion')}
                  />
                  {!errors.dias_feriados_gestion && (
                    <p className="mt-1 pl-1 text-xs text-slate-600">
                      Solo los que caen de lunes a viernes. El fondo descuenta días × jornada diaria del docente.
                      {calendarioDeLaMismaGestion && (calendarioSeleccionado
                        ? ` Al guardar se aplica también al calendario ${calendarioDeLaMismaGestion.periodo_display} de la gestión.`
                        : ` Igual que el calendario ${calendarioDeLaMismaGestion.periodo_display} de la gestión.`)}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl bg-white/70 ring-1 ring-inset ring-azulado-300 px-4 py-3 md:self-end xl:col-span-2">
                  <div className="flex items-center gap-3">
                    <ToggleSwitch
                      isActive={Boolean(formData.activo)}
                      onChange={handleActivoSwitchChange}
                    />
                    <span className="text-sm text-slate-800">Calendario activo</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 flex flex-col-reverse sm:flex-row justify-end gap-2 [border-top:1px_solid_#B8C9E1]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaveBlocked}
                  className={`${BOTON} px-5 py-2.5 ${isSaveBlocked ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-950 text-white shadow-sm'}`}
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>,
        document.body
      )}

      {showToggleModal && calendarioToToggle && (
        <ModalCentrado onClose={() => setShowToggleModal(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-6 pt-6">
              <h4 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                {calendarioToToggle.activo ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                {calendarioToToggle.activo ? 'Confirmar desactivación' : 'Confirmar activación'}
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                {calendarioToToggle.activo
                  ? `Se desactivará el calendario ${calendarioToToggle.gestion} - ${calendarioToToggle.periodo_display}.`
                  : `Se activará el calendario ${calendarioToToggle.gestion} - ${calendarioToToggle.periodo_display}.`}
              </p>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              {calendarioToToggle.activo && (
                <div className="rounded-2xl bg-amber-50 ring-1 ring-inset ring-amber-200 px-4 py-3 text-amber-900">
                  Si desactiva el calendario activo, algunos procesos pueden quedarse sin periodo vigente (registro, seguimiento y reportes) hasta activar otro calendario.
                </div>
              )}
              <p className="text-xs text-slate-500">
                Esta acción se puede revertir desde el interruptor de estado.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={() => setShowToggleModal(false)}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarToggleActivo}
                className={`${BOTON} px-5 py-2.5 text-white ${calendarioToToggle.activo ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
              >
                {calendarioToToggle.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        </ModalCentrado>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && (
        <ModalCentrado onClose={closeDeleteModal}>
          <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-6 pt-6">
              <h4 className="text-xl font-bold text-red-700">Confirmar eliminación</h4>
              <p className="mt-1 text-sm text-slate-600">
                Se eliminará el calendario <strong className="text-slate-900">{calendarioToDelete?.gestion} - {calendarioToDelete?.periodo_display}</strong> de forma permanente.
              </p>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-3 text-red-800">
                Acción irreversible: <strong>se perderá el periodo y sus fechas de referencia para este calendario.</strong>
              </div>
              <div className="rounded-2xl bg-amber-50 ring-1 ring-inset ring-amber-200 px-4 py-3 text-amber-900">
                Dependencias actuales: {deleteImpact.cargas_horarias} cargas horarias.
              </div>
              <div>
                <label className={LABEL_CAMPO}>
                  Escribe el nombre exacto del calendario para habilitar la eliminación:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={`${calendarioToDelete?.gestion || ''} - ${calendarioToDelete?.periodo_display || ''}`}
                  className={`${CAMPO} ring-1 ring-azulado-300 focus:ring-2 focus:ring-red-400/50 !bg-azulado-100`}
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={closeDeleteModal}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={deleteConfirmText !== `${calendarioToDelete?.gestion || ''} - ${calendarioToDelete?.periodo_display || ''}`}
                className={`${BOTON} px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500`}
              >
                Eliminar
              </button>
            </div>
          </div>
        </ModalCentrado>
      )}

      {showDependencyWarningModal && calendarioToDelete && (
        <ModalCentrado onClose={() => setShowDependencyWarningModal(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-6 pt-6">
              <h4 className="text-xl font-bold text-red-700">No se puede eliminar</h4>
              <p className="mt-1 text-sm text-slate-600">
                {deleteImpact.detail || `No se puede eliminar el calendario ${calendarioToDelete.gestion}-${calendarioToDelete.periodo_display} porque aún tiene dependencias vinculadas.`}
              </p>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-3 text-red-800">
                Dependencias detectadas: {deleteImpact.cargas_horarias} cargas horarias, {deleteImpact.fondos_gestion || 0} fondos de la gestión sin otro calendario.
              </div>
              <div className="rounded-2xl bg-amber-50 ring-1 ring-inset ring-amber-200 px-4 py-3 text-amber-900">
                Para eliminar este calendario, primero debes mover o eliminar manualmente sus registros asociados.
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
    </div>
  );
}

export default ListaCalendarios;
