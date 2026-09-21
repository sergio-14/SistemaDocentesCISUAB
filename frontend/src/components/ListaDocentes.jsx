import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaChevronRight, FaEdit, FaTrash, FaExclamationTriangle } from 'react-icons/fa';
import { getDocentes } from '../apis/api';
import api from '../apis/api';
import toast from 'react-hot-toast';
import {
  getBackendErrorMessage,
  sanitizeApiErrors,
  ERROR_SHAKE_DURATION_MS,
} from '../utils/formErrors';

// Normaliza mensajes de error confusos del backend (ej: """" no es una elección válida.")
// a un texto claro y humano para selects como Dedicación/Categoría.
// Ahora usa las reglas globales de formErrors.js (sanitizeApiErrors).
const normalizeErrors = (errs) => sanitizeApiErrors(errs);

// ============================================================================
// COMPONENTE INTERNO: FechaIngresoPicker (Calendario personalizado)
// ============================================================================
const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

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

function FechaIngresoPicker({ value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const [openQuickPicker, setOpenQuickPicker] = useState(null);
  const [inputValue, setInputValue] = useState(formatDisplayDate(value));
  const [isPulsing, setIsPulsing] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selectedDate = parseIsoDate(value);
    const today = new Date();
    return selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [draftDay, setDraftDay] = useState(null);
  const [draftMonth, setDraftMonth] = useState(null);
  const [draftYear, setDraftYear] = useState(null);
  const [hasSelectedMonth, setHasSelectedMonth] = useState(false);
  const [hasSelectedYear, setHasSelectedYear] = useState(false);
  const containerRef = React.useRef(null);
  const yearMenuRef = React.useRef(null);
  const currentYearOptionRef = React.useRef(null);

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

  React.useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
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

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const today = new Date();
  const currentYearRef = today.getFullYear();
  const minYear = 1967; // Año de fundación de la UABJB
  const startYear = minYear;
  const endYear = currentYearRef; // No permitir años futuros
  const yearOptions = Array.from({ length: endYear - startYear + 1 }, (_, idx) => startYear + idx);
  const monthOptions = monthNames.map((label, valueIndex) => ({ value: valueIndex, label }));
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarCells = [];
  for (let i = 0; i < offset; i += 1) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    calendarCells.push(new Date(year, month, d));
  }
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const isSameDate = (a, b) => (
    a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );

  const handlePickDate = (dateObj) => {
    setDraftDay(dateObj.getDate());
    setHasSelectedMonth(true);
    setHasSelectedYear(true);
    const iso = toIsoDate(dateObj);
    onChange(iso);
    setInputValue(formatDisplayDate(iso));
    setOpen(false);
  };

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
      if (parsed) {
        onChange(toIsoDate(parsed));
        setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      }
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
      setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      return;
    }
    onChange('');
    setInputValue('');
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Fecha de Ingreso <span className="text-red-500">*</span></label>
      <div className={`relative w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-700 shadow-sm ${error ? '!border-red-600 dark:!border-red-500 ring-1 ring-inset ring-red-500/50' : 'border-slate-300 dark:border-slate-600'} focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${isPulsing ? 'animate-field-error-shake' : ''}`}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={inputValue}
          onChange={handleManualInputChange}
          onBlur={handleManualInputBlur}
          className="w-full bg-transparent text-slate-800 dark:text-white px-4 py-2.5 pr-12 rounded-xl focus:outline-none"
          aria-label="Fecha de Ingreso"
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-1.5 top-1/2 h-8 w-8 rounded-lg border border-[#3A56AF]/40 bg-[#2C4AAE] text-white hover:bg-[#233C8F] transition-colors"
          style={{ transform: 'translateY(-50%)' }}
          aria-label="Abrir calendario de Fecha de Ingreso"
        >
          <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-13 9h16a1 1 0 001-1V7a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1z" />
          </svg>
        </button>
      </div>
      {open && (
        <div
          className="absolute z-50 mt-2 w-[268px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#7F97E8]/45 bg-[#2C4AAE] backdrop-blur-xl shadow-2xl p-2.5"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenQuickPicker((prev) => (prev === 'month' ? null : 'month'));
                }}
                className={`w-full h-8 text-left pl-2.5 pr-8 rounded-xl border bg-white dark:bg-slate-800 text-xs shadow-sm ${openQuickPicker === 'month' ? 'border-cyan-500/80 dark:border-cyan-500 ring-2 ring-cyan-400/40 dark:ring-cyan-500/35 text-slate-900 dark:text-slate-100' : 'border-cyan-300/70 dark:border-cyan-700/80 hover:border-cyan-500/70 dark:hover:border-cyan-500/80 text-slate-800 dark:text-slate-100'}`}
                aria-label="Seleccionar mes"
              >
                <span className="block truncate font-semibold">{hasSelectedMonth && draftMonth !== null ? monthNames[draftMonth] : monthNames[month]}</span>
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-cyan-50 dark:bg-cyan-900/30 ring-1 ring-cyan-200/70 dark:ring-cyan-700/70">
                    <svg className={`w-2.5 h-2.5 text-cyan-700 dark:text-cyan-300 transition-transform duration-200 ${openQuickPicker === 'month' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </span>
              </button>
              {openQuickPicker === 'month' && (
                <div className="absolute z-40 mt-1.5 w-full max-h-40 overflow-auto rounded-xl border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 shadow-xl shadow-cyan-900/15 dark:shadow-black/35" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                  {monthOptions.map((opt) => {
                    const active = hasSelectedMonth && draftMonth !== null && opt.value === draftMonth;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftMonth(opt.value);
                          setHasSelectedMonth(true);
                          setVisibleMonth(new Date(year, opt.value, 1));
                          setOpenQuickPicker(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs border-l-2 ${active ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500 text-cyan-800 dark:text-cyan-200 font-semibold' : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'}`}
                      >
                        <span className="block truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenQuickPicker((prev) => (prev === 'year' ? null : 'year'));
                }}
                className={`w-full h-8 text-left pl-2.5 pr-8 rounded-xl border bg-white dark:bg-slate-800 text-xs shadow-sm ${openQuickPicker === 'year' ? 'border-cyan-500/80 dark:border-cyan-500 ring-2 ring-cyan-400/40 dark:ring-cyan-500/35 text-slate-900 dark:text-slate-100' : 'border-cyan-300/70 dark:border-cyan-700/80 hover:border-cyan-500/70 dark:hover:border-cyan-500/80 text-slate-800 dark:text-slate-100'}`}
                aria-label="Seleccionar a+�o"
              >
                <span className="block truncate font-semibold">{hasSelectedYear && draftYear !== null ? draftYear : year}</span>
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-cyan-50 dark:bg-cyan-900/30 ring-1 ring-cyan-200/70 dark:ring-cyan-700/70">
                    <svg className={`w-2.5 h-2.5 text-cyan-700 dark:text-cyan-300 transition-transform duration-200 ${openQuickPicker === 'year' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </span>
              </button>
              {openQuickPicker === 'year' && (
                <div ref={yearMenuRef} className="absolute z-40 mt-1.5 w-full max-h-40 overflow-auto rounded-xl border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 shadow-xl shadow-cyan-900/15 dark:shadow-black/35" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                  {yearOptions.map((y) => {
                    const active = hasSelectedYear && draftYear !== null && y === draftYear;
                    const isCurrentSystemYear = y === currentYearRef;
                    return (
                      <button
                        key={y}
                        ref={isCurrentSystemYear ? currentYearOptionRef : null}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftYear(y);
                          setHasSelectedYear(true);
                          setVisibleMonth(new Date(y, draftMonth ?? month, 1));
                          setOpenQuickPicker(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs border-l-2 ${active ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500 text-cyan-800 dark:text-cyan-200 font-semibold' : isCurrentSystemYear ? 'bg-blue-50 dark:bg-blue-900/25 border-blue-400 text-blue-800 dark:text-blue-200 font-semibold hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]' : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="block truncate">{y}</span>
                          {isCurrentSystemYear && !active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200/80 dark:bg-blue-800/50 text-blue-900 dark:text-blue-100">Actual</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {weekDays.map((wd) => (
              <div key={wd} className="text-center text-[10px] font-semibold text-slate-200/85 py-0.5">{wd}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calendarCells.map((cellDate, idx) => {
              if (!cellDate) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              const isToday = isSameDate(cellDate, today);
              const isSelected = draftDay !== null && cellDate.getDate() === draftDay;
              const isFuture = cellDate > today;
              const isBeforeFundacion = cellDate < new Date(1967, 10, 18); // 18 de noviembre de 1967
              const isDisabled = isFuture || isBeforeFundacion;
              return (
                <button
                  key={toIsoDate(cellDate)}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && handlePickDate(cellDate)}
                  className={`h-8 rounded-lg text-xs ${
                    isDisabled ? 'opacity-30 cursor-not-allowed text-slate-500'
                    : isSelected ? 'bg-[#4654E8] text-white font-semibold'
                    : 'text-slate-100 hover:bg-white/15'
                  } ${isToday && !isSelected && !isDisabled ? 'border border-white/55' : 'border border-transparent'}`}
                >
                  {cellDate.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// Componente Select con dise+�o personalizado (mismo estilo que FechaIngresoPicker)
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
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <span>{label}</span>
          {showLock && (
            <span title={lockTooltip || 'No editable'} className="text-slate-500 dark:text-slate-400">🔒</span>
          )}
        </span>
      </label>
      
      {/* Bot+�n principal */}
      <div className={`relative w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-700 shadow-sm ${disabled ? 'opacity-70' : ''} ${error ? '!border-red-600 dark:!border-red-500 ring-1 ring-inset ring-red-500/50' : open ? 'border-[#3A56AF] dark:border-[#3A56AF]' : 'border-slate-300 dark:border-slate-600'} ${containerClassName} ${isPulsing ? 'animate-field-error-shake' : ''}`}>
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
          disabled={disabled}
          className={`w-full text-left px-4 py-2.5 rounded-xl bg-transparent text-slate-800 dark:text-white flex items-center justify-between gap-2 ${disabled ? 'cursor-not-allowed' : ''}`}
          title={disabled ? (lockTooltip || 'No editable') : undefined}
        >
          <span className={`truncate ${!value ? 'text-slate-400 dark:text-slate-500' : ''}`}>{displayLabel}</span>
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

      {/* Men+� desplegable */}
      {open && menuStyle && createPortal(
        <div ref={menuRef} className="rounded-xl border-2 border-[#3A56AF] bg-white dark:bg-slate-900 shadow-xl" style={menuStyle}>
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
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  option.value === value
                    ? 'bg-cyan-50 dark:bg-cyan-900/30 shadow-[inset_2px_0_0_0_#06b6d4] text-cyan-800 dark:text-cyan-200 font-semibold'
                    : option.disabled
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white hover:shadow-[inset_2px_0_0_0_#2C4AAE] dark:hover:bg-[#2C4AAE]'
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
    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
      <span className="inline-flex items-center gap-1.5">
        <span>{label} {required && <span className="text-red-500">*</span>}</span>
        {showLock && (
          <span title={lockTooltip || 'No editable'} className="text-slate-500 dark:text-slate-400">🔒</span>
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
      className={`w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white italic focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md ${inputClassName} ${disabled ? 'cursor-not-allowed opacity-80' : ''} ${error ? '!border-red-600 dark:!border-red-500 ring-1 ring-inset ring-red-500/50' : 'border-slate-300 dark:border-slate-600'} ${isPulsing ? 'animate-field-error-shake' : ''}`}
    />
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
  );
};

const SimpleDropdown = ({ value, onChange, options, placeholder = 'Carreras', clearOnToggle = false }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);
  const inputRef = React.useRef(null);

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

  const selectedLabel = options.find((opt) => String(opt.value) === String(value))?.label;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
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
        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl text-left flex items-center justify-between transition-all"
      >
        <span className={`${selectedLabel ? 'text-slate-800 dark:text-white font-semibold text-sm leading-tight italic' : 'text-slate-400 dark:text-slate-500 italic'}`}>
          {selectedLabel || placeholder}
        </span>
        <div className="w-8 h-8 bg-[#2C4AAE] hover:bg-[#1a3a8a] rounded-lg flex items-center justify-center transition-colors">
          <svg
            className={`w-4 h-4 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-white italic placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className={`w-full text-left px-4 py-2.5 text-sm italic transition-colors ${
                String(value) === String(option.value)
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

const SearchInput = ({ value, onChange, placeholder = 'Buscar por nombre o C.I....' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = React.useRef(null);

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
    <div className="flex items-center gap-2 flex-row-reverse">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-2.5 bg-[#2C4AAE] hover:bg-[#1a3a8a] text-white rounded-xl transition-all duration-300 hover:scale-110"
        title="Buscar docente"
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
          className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-[#2C4AAE] rounded-xl text-slate-800 dark:text-white italic placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all"
        />
      </div>
    </div>
  );
};

const dedicacionStyles = {
  tiempo_completo: {
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    accent: 'ring-1 ring-inset ring-blue-600/50 dark:ring-blue-400/50 border-l-[12px] !border-l-blue-800 dark:!border-l-blue-400',
    leftBorder: '#1d4ed8',
    icon: 'text-blue-700',
    title: 'text-blue-900 dark:text-blue-300',
    text: 'text-blue-800 dark:text-blue-400',
  },
  medio_tiempo: {
    bg: 'bg-green-50 dark:bg-green-900/10',
    accent: 'ring-1 ring-inset ring-green-600/50 dark:ring-green-400/50 border-l-[12px] !border-l-green-800 dark:!border-l-green-400',
    leftBorder: '#15803d',
    icon: 'text-green-700',
    title: 'text-green-900 dark:text-green-300',
    text: 'text-green-800 dark:text-green-400',
  },
  horario_16: {
    bg: 'bg-cyan-50 dark:bg-cyan-900/10',
    accent: 'ring-1 ring-inset ring-cyan-600/50 dark:ring-cyan-400/50 border-l-[12px] !border-l-cyan-800 dark:!border-l-cyan-400',
    leftBorder: '#0e7490',
    icon: 'text-cyan-700',
    title: 'text-cyan-900 dark:text-cyan-300',
    text: 'text-cyan-800 dark:text-cyan-400',
  },
  horario_24: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/10',
    accent: 'ring-1 ring-inset ring-emerald-600/50 dark:ring-emerald-400/50 border-l-[12px] !border-l-emerald-800 dark:!border-l-emerald-400',
    leftBorder: '#047857',
    icon: 'text-emerald-700',
    title: 'text-emerald-900 dark:text-emerald-300',
    text: 'text-emerald-800 dark:text-emerald-400',
  },
  horario_40: {
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    accent: 'ring-1 ring-inset ring-amber-600/50 dark:ring-amber-400/50 border-l-[12px] !border-l-amber-800 dark:!border-l-amber-400',
    leftBorder: '#b45309',
    icon: 'text-amber-700',
    title: 'text-amber-900 dark:text-amber-300',
    text: 'text-amber-800 dark:text-amber-400',
  },
  horario_48: {
    bg: 'bg-rose-50 dark:bg-rose-900/10',
    accent: 'ring-1 ring-inset ring-rose-600/50 dark:ring-rose-400/50 border-l-[12px] !border-l-rose-800 dark:!border-l-rose-400',
    leftBorder: '#be123c',
    icon: 'text-rose-700',
    title: 'text-rose-900 dark:text-rose-300',
    text: 'text-rose-800 dark:text-rose-400',
  },
  dedicacion_exclusiva: {
    bg: 'bg-violet-50 dark:bg-violet-900/10',
    accent: 'ring-1 ring-inset ring-violet-600/50 dark:ring-violet-400/50 border-l-[12px] !border-l-violet-800 dark:!border-l-violet-400',
    leftBorder: '#6d28d9',
    icon: 'text-violet-700',
    title: 'text-violet-900 dark:text-violet-300',
    text: 'text-violet-800 dark:text-violet-400',
  },
};

function ListaDocentes({ sidebarCollapsed = false }) {
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
   * Calcula horas efectivas anuales reales según dedicación y fecha de ingreso.
   * Replica la lógica del backend (FondoTiempo._recalcular_horas_automaticas).
   */
  const calcularHorasEfectivas = (dedicacion, fechaIngreso, gestion = null) => {
    const mapaHorasSemanales = {
      tiempo_completo: 40,
      medio_tiempo: 20,
      horario_16: 16,
      horario_24: 24,
      horario_40: 40,
      horario_48: 48,
    };
    const horasSemanales = mapaHorasSemanales[dedicacion];
    if (!horasSemanales) return null;

    // Calcular antigüedad
    const fechaIng = fechaIngreso ? new Date(fechaIngreso + 'T00:00:00') : null;
    if (!fechaIng || isNaN(fechaIng)) return null;

    const gestionActual = gestion || new Date().getFullYear();
    const antiguedad = Math.max(0, gestionActual - fechaIng.getFullYear());

    // Días de vacaciones según antigüedad
    let diasVacacion;
    if (antiguedad >= 10) diasVacacion = 30;
    else if (antiguedad >= 5) diasVacacion = 20;
    else diasVacacion = 15;

    // Cálculo de horas
    const contratoHoras = horasSemanales * 52;
    const horasDiarias = horasSemanales / 5;
    const horasVacacion = diasVacacion * horasDiarias;
    const horasFeriados = 16 * horasDiarias; // 16 días feriados estándar
    const horasEfectivas = contratoHoras - horasVacacion - horasFeriados;

    return Math.max(Math.floor(horasEfectivas), 0);
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
  const [user, setUser] = useState(null);

  // Modal de crear/editar
  const [showModal, setShowModal] = useState(false);
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
    fecha_ingreso: new Date().toISOString().split('T')[0],
    email: '',
    telefono: '',
    horas_contrato_semanales: null,
    activo: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docenteToDelete, setDocenteToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);
  const [buscarUsuario, setBuscarUsuario] = useState('');
  const [abrirDesdeUsuarios, setAbrirDesdeUsuarios] = useState(false);
  const [flujoDesdeUsuarios, setFlujoDesdeUsuarios] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCarrera, setSelectedCarrera] = useState('');
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
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(userData);
    
    // ���� Detectar si venimos desde "Crear Usuario" para abrir modal
    const abrirModal = sessionStorage.getItem('abrirModalDesdeUsuarios');
    if (abrirModal === 'true') {
      const flujo = sessionStorage.getItem('flujoDocenteDesdeUsuarios') || null;
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
      setFlujoDesdeUsuarios(flujo);
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
      const [docentesResponse, carrerasResponse, usuariosResponse] = await Promise.all([
        getDocentes(),
        api.get('/carreras/'),
        api.get('/usuarios/'),
      ]);
      const docentesData = docentesResponse.data.results || docentesResponse.data;
      const carrerasData = carrerasResponse.data.results || carrerasResponse.data;
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
      fecha_ingreso: new Date().toISOString().split('T')[0],
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
      setFlujoDesdeUsuarios(null);
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
      docente_data: null,
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
      condicion: '',
      dedicacion: docente.vinculos?.[0]?.dedicacion || '',
      fecha_ingreso: docente.fecha_ingreso || new Date().toISOString().split('T')[0],
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

  const getDedicacionPermitidaParaUsuario = (usuarioItem, dedicacionActual = '') => {
    const tieneRolDirector = usuarioTieneRol(usuarioItem, 'director');
    const tieneRolJefeEstudios = usuarioTieneRol(usuarioItem, 'jefe_estudios');
    const tieneRolIisyp = usuarioTieneRol(usuarioItem, 'iiisyp');
    const tieneRolDocente = usuarioTieneRol(usuarioItem, 'docente');
    const dedicacion = String(dedicacionActual || '');

    if (tieneRolDirector && !tieneRolDocente && !tieneRolJefeEstudios && !tieneRolIisyp) {
      return 'dedicacion_exclusiva';
    }

    if ((tieneRolJefeEstudios || tieneRolIisyp) && !tieneRolDocente && !tieneRolDirector) {
      return 'tiempo_completo';
    }

    if (tieneRolDocente && !['horario_16', 'horario_24', 'horario_40', 'horario_48'].includes(dedicacion)) {
      return 'horario_40';
    }

    return dedicacionActual;
  };

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
  const usuarioFormularioTieneRolGestion = ['director', 'jefe_estudios', 'iiisyp'].some((rol) =>
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
  const dedicacionEsTiempoHorario = ['horario_16', 'horario_24', 'horario_40', 'horario_48'].includes(String(formData.dedicacion || ''));
  const esDedicacionExclusiva = formData.dedicacion === 'dedicacion_exclusiva';
  const mostrarAdvertenciaGestion = usuarioFormularioTieneRolGestion && showGestionWarningVisible && !dedicacionEsTiempoHorario && !esDedicacionExclusiva;
  const opcionesDedicacion = [
    { value: 'tiempo_completo', label: 'Tiempo Completo' },
    { value: 'medio_tiempo', label: 'Medio Tiempo' },
    { value: 'horario_16', label: 'Horario 16hrs/sem' },
    { value: 'horario_24', label: 'Horario 24hrs/sem' },
    { value: 'horario_40', label: 'Horario 40hrs/sem' },
    { value: 'horario_48', label: 'Horario 48hrs/sem' },
    { value: 'dedicacion_exclusiva', label: 'Dedicacion Exclusiva' },
  ].filter((opcion) => (
    usuarioFormularioTieneRolDocente
      ? ['horario_16', 'horario_24', 'horario_40', 'horario_48'].includes(opcion.value)
      : (!usuarioFormularioTieneRolGestion || opcion.value !== 'dedicacion_exclusiva')
  ));
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
  const horasSemanalesDerivadas = formData.dedicacion === 'tiempo_completo' ? 40
    : formData.dedicacion === 'medio_tiempo' ? 20
    : formData.dedicacion === 'horario_16' ? 16
    : formData.dedicacion === 'horario_24' ? 24
    : formData.dedicacion === 'horario_40' ? 40
    : formData.dedicacion === 'horario_48' ? 48
    : '';

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

    // Validación de fecha_ingreso
    if (formData.fecha_ingreso) {
      const fechaIngreso = new Date(formData.fecha_ingreso + 'T00:00:00');
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fundacionUABJB = new Date(1967, 10, 18); // 18 de noviembre de 1967
      if (fechaIngreso > hoy) {
        setErrors((prev) => ({ ...prev, fecha_ingreso: ['La fecha de ingreso no puede ser una fecha futura.'] }));
        toast.error('La fecha de ingreso no puede ser una fecha futura.');
        setIsSubmitting(false);
        return;
      }
      if (fechaIngreso < fundacionUABJB) {
        setErrors((prev) => ({ ...prev, fecha_ingreso: ['La fecha de ingreso no puede ser anterior a la fundación de la UABJB (18 de noviembre de 1967).'] }));
        toast.error('La fecha de ingreso no puede ser anterior a la fundación de la UABJB (18 de noviembre de 1967).');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const nombresSplit = splitNombreCompleto(formData.nombre_completo);
      const payload = { ...formData };
      payload.nombres = nombresSplit.nombres;
      payload.apellido_paterno = nombresSplit.apellido_paterno;
      payload.apellido_materno = nombresSplit.apellido_materno;
      payload.ci = ciNormalizado;
      delete payload.condicion;
      delete payload.nombre_completo;
      if (usuarioFormularioSoloDirector) {
        payload.dedicacion = 'dedicacion_exclusiva';
      }
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

    if (formData.fecha_ingreso) {
      const fechaIngreso = new Date(formData.fecha_ingreso + 'T00:00:00');
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fundacionUABJB = new Date(1967, 10, 18);
      if (fechaIngreso > hoy) {
        setErrors((prev) => ({ ...prev, fecha_ingreso: ['La fecha de ingreso no puede ser una fecha futura.'] }));
        toast.error('La fecha de ingreso no puede ser una fecha futura.');
        setIsSubmitting(false);
        return;
      }
      if (fechaIngreso < fundacionUABJB) {
        setErrors((prev) => ({ ...prev, fecha_ingreso: ['La fecha de ingreso no puede ser anterior a la fundación de la UABJB (18 de noviembre de 1967).'] }));
        toast.error('La fecha de ingreso no puede ser anterior a la fundación de la UABJB (18 de noviembre de 1967).');
        setIsSubmitting(false);
        return;
      }
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
      delete payload.condicion;
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
      
      // Capturar mensaje de error espec+�fico del backend
      let errorMessage = 'Error al eliminar el docente';
      
      if (err.response && err.response.data && err.response.data.error) {
        // Backend devolvi+� un error espec+�fico
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
  const esAdmin = () => user?.is_superuser || (user?.perfil?.rol === 'director');
  const docenteVinculadoAUsuario = Boolean(docenteSeleccionado?.usuario_id);
  const horasDeclaradasDocente = Number(docenteSeleccionado?.horas_declaradas || 0);
  const fondosValidadosDocente = Number(docenteSeleccionado?.fondos_validados || 0);
  const docenteTieneHistorial = horasDeclaradasDocente > 0 || fondosValidadosDocente > 0;
  const tooltipBloqueoHistorial = 'No editable: existe historial de horas declaradas';
  const tooltipDatosUsuarios = 'Estos datos se gestionan desde Usuarios';
  const estiloBloqueado = 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-100 border-slate-500 dark:border-slate-600';
  const estiloAdvertenciaEditable = 'border-amber-300 dark:border-amber-700';

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
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Cargando docentes...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl shadow-md">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Docentes
              </h1>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1 italic">
                Gestion del personal docente
              </p>
            </div>
            <div className="flex items-center gap-4">
              <SearchInput value={searchTerm} onChange={setSearchTerm} />
              <div className="w-48">
                <SimpleDropdown
                  value={selectedCarrera}
                  onChange={setSelectedCarrera}
                  options={carreras.map((c) => ({ value: c.id, label: c.nombre }))}
                  placeholder="Carreras"
                  clearOnToggle
                />
              </div>
              {esAdmin() && (
                <button
                  onClick={handleToggleCreateForm}
                  className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center gap-2"
                >
                  <span>{isCreating ? '-' : '+'}</span>
                  {isCreating ? 'Cancelar' : 'Nuevo Docente'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MODAL DE CREACION DE DOCENTE */}
        {isCreating && createPortal((
          <div
            className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-[#2C4AAE] px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Nuevo Docente
                  </h2>
                  {abrirDesdeUsuarios && (
                    <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-semibold text-white flex items-center gap-2">
                      Volviendo a Crear Usuario
                    </span>
                  )}
                </div>
              </div>
              {/* Body */}
              <form id="crear-docente-form" onSubmit={handleCreateSubmit} noValidate className="flex-1 overflow-hidden p-6 space-y-6 bg-slate-50 dark:bg-slate-900 transition-all duration-300 ease-out">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
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
                              setTimeout(() => {
                                const el = e.currentTarget;
                                try { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } catch (_) {}
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
                        className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white ${
                          errors.user ? '!border-red-600 dark:!border-red-500 ring-1 ring-inset ring-red-500/50' : 'border-slate-300 dark:border-slate-600'
                        } ${isUserSearchPulsing ? 'animate-field-error-shake' : ''}`}
                      />
                      {showAutocomplete && buscarUsuario !== null && (
                        <>
                          <style>{`@keyframes slideDown{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}} .slide-down{animation:slideDown 220ms ease-out forwards}`}</style>
                          <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 max-h-64 overflow-auto shadow-2xl slide-down">
                            {usuariosAutocomplete.map((usuarioItem) => (
                              <button
                                key={usuarioItem.id}
                                type="button"
                                onClick={() => handleSeleccionUsuario(usuarioItem)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-b-0 border-slate-100 dark:border-slate-700"
                              >
                                <div className="font-semibold text-slate-800 dark:text-white">
                                  {`${usuarioItem.first_name || ''} ${usuarioItem.last_name || ''}`.trim() || usuarioItem.username}
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        ¿No encuentras al usuario?{' '}
                        <button
                          type="button"
                          onClick={handleCrearUsuarioDesdeNuevoDocente}
                          className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
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
                      <div key={userInfoKey} className="slide-down rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                              Cargo profesional
                            </label>
                            <div className="w-full min-h-[46px] whitespace-pre-line px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm italic text-slate-800 dark:text-white shadow-sm cursor-not-allowed opacity-80">
                              {formData.cargo_profesional || ''}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                              Carrera
                            </label>
                            <div className="w-full min-h-[46px] whitespace-pre-line px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm italic text-slate-800 dark:text-white shadow-sm cursor-not-allowed opacity-80">
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
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                            {formData.dedicacion === 'horario_16' && 'Este docente trabaja 16 horas por semana.'}
                            {formData.dedicacion === 'horario_24' && 'Este docente trabaja 24 horas por semana.'}
                            {formData.dedicacion === 'horario_40' && 'Este docente trabaja 40 horas por semana.'}
                            {formData.dedicacion === 'horario_48' && 'Este docente trabaja 48 horas por semana.'}
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
                          className="gestion-warning-accent slide-down rounded-xl p-3.5 shadow-sm bg-gradient-to-r from-blue-600/10 to-indigo-600/10 dark:from-blue-600/20 dark:to-indigo-600/20 ring-1 ring-inset ring-blue-600/50 dark:ring-blue-400/50 border-l-[12px] !border-l-blue-800 dark:!border-l-blue-400"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl">
                              📋
                            </span>
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-blue-900 dark:text-blue-300">
                                Cargos de gestión solo compatibles con docencia a Tiempo Horario.
                              </p>
                              <p className="text-xs leading-5 text-blue-800 dark:text-blue-400">
                                Usuarios con rol de Director, Jefe de Estudios o Instituto solo pueden usar: 16, 24, 40 o 48 hrs/sem. TC y MT no aplican.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className={`overflow-hidden transition-all duration-500 ease-out ${
                        showDedicacionInfo && formData.dedicacion
                          ? 'max-h-[220px] opacity-100 translate-y-0'
                          : 'max-h-0 opacity-0 -translate-y-1 pointer-events-none'
                      }`}
                    >
                      {showDedicacionInfo && formData.dedicacion && (
                        <div
                          key={dedicacionInfoKey}
                          className={`dedicacion-accent slide-down rounded-xl p-3.5 shadow-sm ${dedicacionStyles[formData.dedicacion]?.bg} ${dedicacionStyles[formData.dedicacion]?.accent}`}
                          style={{ '--dedicacion-accent-color': dedicacionStyles[formData.dedicacion]?.leftBorder }}
                        >
                          <div className="flex items-start gap-3">
                          <InfoIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${dedicacionStyles[formData.dedicacion]?.icon}`} />
                          <div>
                            <h5 className={`text-sm font-semibold ${dedicacionStyles[formData.dedicacion]?.title}`}>Informacion sobre Dedicacion</h5>
                            <p className={`text-xs leading-5 mt-1 ${dedicacionStyles[formData.dedicacion]?.text}`}>
                              {(() => {
                                const horas = calcularHorasEfectivas(formData.dedicacion, formData.fecha_ingreso);
                                const antiguedad = formData.fecha_ingreso
                                  ? Math.max(0, new Date().getFullYear() - new Date(formData.fecha_ingreso + 'T00:00:00').getFullYear())
                                  : 0;
                                const dedicacionLabels = {
                                  tiempo_completo: 'Tiempo Completo',
                                  medio_tiempo: 'Medio Tiempo',
                                  horario_16: 'Horario 16hrs/sem',
                                  horario_24: 'Horario 24hrs/sem',
                                  horario_40: 'Horario 40hrs/sem',
                                  horario_48: 'Horario 48hrs/sem',
                                  dedicacion_exclusiva: 'Dedicacion Exclusiva',
                                };
                                const label = dedicacionLabels[formData.dedicacion] || formData.dedicacion;
                                if (formData.dedicacion === 'dedicacion_exclusiva') {
                                  return 'Docente con dedicacion exclusiva - exento de distribucion de tiempo';
                                }
                                if (horas !== null) {
                                  return `${label}: ${horas.toFixed(0)} horas efectivas anuales (${antiguedad} año${antiguedad !== 1 ? 's' : ''} de antigüedad, vacaciones calculadas según antigüedad).`;
                                }
                                return `${label}: complete la fecha de ingreso para calcular las horas efectivas.`;
                              })()}
                            </p>
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
              <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (abrirDesdeUsuarios) {
                      // Volver a usuarios si venimos desde alli
                      // Los datos se recuperaran automaticamente en GestionUsuarios
                      navigate('/usuarios');
                    } else {
                      setIsCreating(false);
                      setFlujoDesdeUsuarios(null);
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                >
                  {abrirDesdeUsuarios ? 'Cancelar y volver' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  form="crear-docente-form"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50"
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

        {/* Lista de docentes */}
        {docentesFiltrados.length > 0 ? (
          <div className="space-y-4">
            {docentesFiltrados.map((docente) => (
              <div
                key={docente.id}
                className={`rounded-2xl border-2 shadow-md hover:shadow-xl transition-all duration-200 hover:scale-[1.01] ${
                  docente.activo
                    ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
                    : 'docente-inactivo-card bg-red-50 dark:bg-red-900/15 border-red-400 dark:border-red-700'
                }`}
              >
                <div className="p-5">
                  <div className="flex flex-col gap-3">
                    {/* Primera línea: Avatar + Nombre + Botones */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold shadow-md text-xl flex-shrink-0 ${
                          docente.activo
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                            : 'bg-gradient-to-br from-red-500 to-rose-700'
                        }`}>
                          {docente.nombres[0]}{docente.apellido_paterno[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-lg font-bold truncate ${docente.activo ? 'text-blue-600 dark:text-white' : 'text-red-700 dark:text-red-300'}`}>
                            {docente.usuario_nombre || docente.nombre_completo}
                          </h3>
                          {!docente.usuario_id && (
                            <button
                              type="button"
                              onClick={() => handleCrearCuentaParaDocente(docente)}
                              className="mt-1 text-sm font-semibold text-red-600 transition-colors hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300"
                            >
                              <span className="inline-flex items-center gap-1">
                                <FaExclamationTriangle className="text-amber-500" size={12} />
                                Sin Cuenta
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Botones de acción - Solo admin */}
                      {esAdmin() && (() => {
                        const blockedBtn = (docente?.horas_declaradas || 0) > 0 || (docente?.fondos_validados || 0) > 0;
                        const titleMsg = blockedBtn ? 'Acción deshabilitada: existe historial operativo' : '';
                        return (
                          <div className="flex gap-3 flex-shrink-0">
                            <button
                              onClick={() => !blockedBtn && abrirModalEditar(docente)}
                              disabled={blockedBtn}
                              className={`text-blue-500 ${blockedBtn ? 'opacity-50 cursor-not-allowed' : 'hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300'} transition-all duration-200 ${blockedBtn ? '' : 'hover:scale-110'}`}
                              title={titleMsg || 'Editar'}
                            >
                              <FaEdit size={18} />
                            </button>
                            <button
                              onClick={() => !blockedBtn && eliminarDocente(docente)}
                              disabled={blockedBtn}
                              className={`text-red-500 ${blockedBtn ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-400 dark:text-red-400 dark:hover:text-red-300'} transition-all duration-200 ${blockedBtn ? '' : 'hover:scale-110'}`}
                              title={titleMsg || 'Eliminar'}
                            >
                              <FaTrash size={18} />
                            </button>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Segunda línea: CI, Email, Carrera */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-2 border-slate-300 dark:border-slate-600 shadow-sm">
                        CI: {docente.ci}
                      </span>
                      {docente.usuario_email && (
                        <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-2 border-cyan-300 dark:border-cyan-700 shadow-sm">
                          {docente.usuario_email}
                        </span>
                      )}
                      {docente.carrera_nombre && (
                        <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-2 border-violet-300 dark:border-violet-700 shadow-sm">
                          Carrera: {docente.carrera_nombre}
                        </span>
                      )}
                    </div>

                    {/* Tercera línea: Categoría, Dedicación, Rol adicional */}
                    <div className="flex flex-wrap items-center gap-2">
                      {docente.activo ? (
                        <>
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700 shadow-sm">
                            {docente.vinculos?.[0]?.categoria === 'catedratico' ? 'Catedrático' :
                              docente.vinculos?.[0]?.categoria === 'adjunto' ? 'Adjunto' : 'Asistente'}
                          </span>
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-300 dark:border-green-700 shadow-sm">
                            {docente.vinculos?.[0]?.dedicacion === 'tiempo_completo' ? 'Tiempo Completo'
                              : docente.vinculos?.[0]?.dedicacion === 'medio_tiempo' ? 'Medio Tiempo'
                              : docente.vinculos?.[0]?.dedicacion === 'horario_16' ? 'Horario 16hrs/sem'
                              : docente.vinculos?.[0]?.dedicacion === 'horario_24' ? 'Horario 24hrs/sem'
                              : docente.vinculos?.[0]?.dedicacion === 'horario_40' ? 'Horario 40hrs/sem'
                              : docente.vinculos?.[0]?.dedicacion === 'horario_48' ? 'Horario 48hrs/sem'
                              : docente.vinculos?.[0]?.dedicacion}
                          </span>
                          {obtenerRolesDocente(docente) && (
                            <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-2 border-orange-300 dark:border-orange-700 shadow-sm">
                              {obtenerRolesDocente(docente)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="docente-inactivo-badge px-3 py-1 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-2 border-red-300 dark:border-red-700 shadow-sm">
                          Docente inactivo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 p-12 text-center shadow-md">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-slate-500 dark:text-slate-300">DOC</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              {docentes.length > 0 ? 'No hay docentes que coincidan' : 'No hay docentes registrados'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {docentes.length > 0 ? 'Prueba otro nombre, C.I. o carrera' : 'Comienza agregando tu primer docente'}
            </p>
            {esAdmin() && (
              <button
                onClick={handleToggleCreateForm}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
              >
                <span>+</span>
                Crear Primer Docente
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && docenteSeleccionado && createPortal((
        <div
          className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-[#2C4AAE] px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
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
                      ? 'border-white bg-white/95'
                      : 'border-white/70 bg-slate-900/25'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full shadow-md transition-transform ${
                      formData.activo
                        ? 'translate-x-7 bg-[#2C4AAE]'
                        : 'translate-x-1 bg-white'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Body */}
            <form id="editar-docente-form" onSubmit={handleUpdateSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900 transition-all duration-300 ease-out">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                <InputField
                  label="Cedula de Identidad (CI)"
                  name="ci"
                  value={formData.ci}
                  onChange={handleChange}
                  error={errors.ci}
                  maxLength={15}
                  readOnly
                  showLock
                  lockTooltip={tooltipDatosUsuarios}
                  inputClassName={estiloBloqueado}
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
                  disabled={docenteTieneHistorial}
                  showLock={docenteTieneHistorial}
                  lockTooltip={tooltipBloqueoHistorial}
                  containerClassName={docenteTieneHistorial ? estiloBloqueado : ''}
                />
                {docenteTieneHistorial ? (
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        <span>Fecha de Ingreso</span>
                        <span title={tooltipBloqueoHistorial} className="text-slate-500 dark:text-slate-400">🔒</span>
                      </span>
                    </label>
                    <div className="relative w-full rounded-xl border-2 shadow-sm border-slate-500 dark:border-slate-600 bg-slate-300 dark:bg-slate-800">
                      <div className="w-full text-left px-4 py-2.5 rounded-xl bg-transparent text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2 cursor-not-allowed" title={tooltipBloqueoHistorial}>
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
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                      {formData.dedicacion === 'horario_16' && 'Este docente trabaja 16 horas por semana.'}
                      {formData.dedicacion === 'horario_24' && 'Este docente trabaja 24 horas por semana.'}
                      {formData.dedicacion === 'horario_40' && 'Este docente trabaja 40 horas por semana.'}
                      {formData.dedicacion === 'horario_48' && 'Este docente trabaja 48 horas por semana.'}
                      {(formData.dedicacion === 'tiempo_completo' || formData.dedicacion === 'medio_tiempo')
                        && 'Horas semanales fijas por reglamento.'}
                    </p>
                  </div>
                </div>
                <div className="gestion-warning-accent md:col-span-2 slide-down min-h-[180px] rounded-xl border border-blue-200 border-l-[12px] border-l-[#1E3A8A] bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm ring-1 ring-inset ring-blue-600/30 transition-all duration-300 dark:border-blue-900/40 dark:border-l-blue-400 dark:from-blue-600/20 dark:to-indigo-600/20 dark:ring-blue-400/50">
                  <div className="flex items-start gap-3">
                    <InfoIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-800 dark:text-blue-300" />
                    <div className="min-w-0 flex-1 space-y-3 text-sm leading-6 text-blue-900 dark:text-blue-200">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h5 className="font-bold uppercase tracking-wide text-blue-950 dark:text-blue-100">
                            Información de edición
                          </h5>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => moverInfoEdicion('left')}
                            className="info-nav-button flex h-8 w-8 items-center justify-center rounded-lg border text-blue-800 transition-colors hover:bg-blue-200 dark:border-blue-700 dark:bg-slate-900/40 dark:text-blue-200 dark:hover:bg-blue-900/40"
                            title="Mensaje anterior"
                            aria-label="Mensaje anterior"
                          >
                            <FaChevronLeft size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moverInfoEdicion('right')}
                            className="info-nav-button flex h-8 w-8 items-center justify-center rounded-lg border text-blue-800 transition-colors hover:bg-blue-200 dark:border-blue-700 dark:bg-slate-900/40 dark:text-blue-200 dark:hover:bg-blue-900/40"
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
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          {infoEdicionActual.subtitulo}
                        </p>
                        <p>
                          <span className="font-bold">{infoEdicionActual.titulo}:</span> {infoEdicionActual.contenido}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                {docenteVinculadoAUsuario && infoEdicionIndex === 0 && (
                  <button
                    type="button"
                    onClick={handleEditarEnUsuarios}
                    className="px-6 py-2.5 rounded-xl font-semibold border-2 border-blue-600 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                  >
                    Editar en Usuarios
                  </button>
                )}
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="editar-docente-form"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50"
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
          style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setConfirmacionDesactivarDocente(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-amber-500/80 dark:border-amber-700/60 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-amber-400/70 dark:border-slate-700/70 bg-gradient-to-r from-amber-300 via-amber-100 to-amber-50 dark:from-amber-900/30 dark:via-slate-900 dark:to-slate-900">
              <h4 className="text-lg font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                <span>{confirmacionDesactivarDocente.tieneHistorial ? '⚠️' : 'ℹ️'}</span>
                Confirmar desactivación
              </h4>
            </div>
            <div className="px-5 py-4 text-slate-700 dark:text-slate-200">
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
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/70 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/70">
              <button
                type="button"
                onClick={() => setConfirmacionDesactivarDocente(null)}
                className="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmacionDesactivarDocente(null);
                  aplicarCambioFormulario('activo', '', 'checkbox', false);
                }}
                className="px-4 py-2 rounded-lg font-bold text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
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
          style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setConfirmacionCambioPendiente(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-amber-500/80 dark:border-amber-700/60 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-amber-400/70 dark:border-slate-700/70 bg-gradient-to-r from-amber-300 via-amber-100 to-amber-50 dark:from-amber-900/30 dark:via-slate-900 dark:to-slate-900">
              <h4 className="text-lg font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                <span>⚠️</span>
                {confirmacionCambioPendiente.titulo}
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-700 dark:text-slate-200">
              <p className="text-sm leading-relaxed whitespace-pre-line">{confirmacionCambioPendiente.mensaje}</p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/70 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/70">
              <button
                type="button"
                onClick={() => setConfirmacionCambioPendiente(null)}
                className="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
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
                className="px-4 py-2 rounded-lg font-bold text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
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
          style={{ left: sidebarCollapsed ? '5rem' : '18rem' }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeDeleteModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-red-600/80 dark:border-red-700/50 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-red-400 dark:border-slate-700/70 bg-gradient-to-r from-red-400 via-red-200 to-red-50 dark:from-red-900/30 dark:via-slate-900 dark:to-slate-900">
              <h4 className="text-lg font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                <span>!</span>
                Confirmar Eliminacion
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-700 dark:text-slate-200">
              <p className="text-sm leading-relaxed">
                Se eliminara el docente <strong className="text-slate-900 dark:text-white">{docenteToDelete?.nombre_completo}</strong> del sistema de forma permanente.
              </p>
              <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
                Accion irreversible: <strong className="text-red-900 dark:text-red-300">El docente perdera su acceso definitivamente.</strong>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Escribe el nombre exacto del docente para habilitar la eliminacion:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Escribe el nombre del docente para confirmar"
                  className="w-full px-3 py-2 rounded-lg border border-red-400/40 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Esta operacion no se puede deshacer.
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
                disabled={deleteConfirmText !== (docenteToDelete?.nombre_completo || '')}
                className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:bg-red-900/40 disabled:text-slate-300 disabled:cursor-not-allowed"
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
