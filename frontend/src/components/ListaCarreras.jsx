import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { getCarreras, getFacultadesCarrera, addFacultadCarrera, deleteFacultadCarrera } from '../apis/api';
import api from '../apis/api';
import toast from 'react-hot-toast';
import {
  ERROR_FIELD_BORDER_CLASS,
  ERROR_MOTION_CLASS,
  ERROR_SHAKE_DURATION_MS,
  sanitizeChoiceError,
  sanitizeApiErrors,
} from '../utils/formErrors';

const FECHA_MAXIMA_HOY = new Date().toISOString().split('T')[0];

const InputField = ({ label, name, type = 'text', value, onChange, onFocus, required, error }) => (
  <div>
    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {error && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      required={required}
      className={`w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md ${error ? ERROR_FIELD_BORDER_CLASS : 'border-slate-300 dark:border-slate-600'}`}
    />
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

// InputField con sacudida (shake) de error global (460ms) y limpieza en focus.
const InputFieldPulse = ({ label, name, type = 'text', value, onChange, onFocus, required, error, pulse = 0, ...rest }) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const errorMessage = Array.isArray(error) ? (error[0] || '') : (typeof error === 'string' ? error : '');

  useEffect(() => {
    if (!error) { setIsPulsing(false); return; }
    setIsPulsing(false);
    const frame = requestAnimationFrame(() => setIsPulsing(true));
    const to = setTimeout(() => setIsPulsing(false), ERROR_SHAKE_DURATION_MS);
    return () => { cancelAnimationFrame(frame); clearTimeout(to); };
  }, [error, pulse]);

  const handleFocusClear = (e) => {
    if (onFocus) onFocus(e);
  };

  return (
    <div className={error && isPulsing ? ERROR_MOTION_CLASS : ''}>
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label}{error && <span className="ml-1 text-red-500">*</span>}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        onFocus={handleFocusClear}
        required={required}
        {...rest}
        className={`w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm ${error ? ERROR_FIELD_BORDER_CLASS : 'border-slate-300 dark:border-slate-600'}`}
      />
      {errorMessage && <p className="text-xs text-red-600 mt-1">{errorMessage}</p>}
    </div>
  );
};

const SelectConDropdown = ({
  label,
  name,
  value,
  onChange,
  options,
  error,
  disabled = false,
  required = false,
  placeholder = 'Seleccione...',
  searchable = false,
  showManageButton = false,
  onManageClick,
  onAddFacultad,
  setFacultadOptions,
  getFacultadesCarrera,
  formData,
  setFormData,
  pulse = 0,
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [manageMode, setManageMode] = useState(false);
  const [newFacultadName, setNewFacultadName] = useState('');
  const [editingFacultad, setEditingFacultad] = useState(null);
  const [editFacultadName, setEditFacultadName] = useState('');
  const [selectedFacultades, setSelectedFacultades] = useState([]);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setManageMode(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }

    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleManageToggle = () => {
    setManageMode((prev) => !prev);
    if (!open) setOpen(true);
  };

  const handleSelectMode = () => {
    setManageMode(false);
    setOpen((prev) => !prev);
  };

  const handleStartEditFacultad = (option) => {
    setEditingFacultad(option.value);
    setEditFacultadName(option.label);
  };

  const handleSaveEditFacultad = async () => {
    if (!editingFacultad || !editFacultadName.trim()) return;

    const oldNombre = options.find(opt => opt.value === editingFacultad)?.label;
    const newNombre = editFacultadName.trim();

    if (!oldNombre || oldNombre === newNombre) {
      setEditingFacultad(null);
      setEditFacultadName('');
      return;
    }

    try {
      // Agregar la nueva facultad
      await addFacultadCarrera(newNombre);
      // Eliminar la antigua
      await deleteFacultadCarrera(oldNombre);
      
      // Actualizar el estado local inmediatamente
      const updatedOptions = options.map(opt => {
        if (opt.value === editingFacultad) {
          return { ...opt, label: newNombre, value: newNombre };
        }
        return opt;
      });
      setFacultadOptions(updatedOptions);
      
      // Actualizar el valor seleccionado si era la facultad editada
      if (value === editingFacultad) {
        setFormData((prev) => ({ ...prev, facultad: newNombre }));
      }
      
      toast.success('Facultad actualizada correctamente.');
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      toast.error(`No se pudo actualizar: ${detail}`);
    } finally {
      setEditingFacultad(null);
      setEditFacultadName('');
    }
  };

  const handleCancelEditFacultad = () => {
    setEditingFacultad(null);
    setEditFacultadName('');
  };

  const toggleSelectFacultad = (facultadValue) => {
    setSelectedFacultades(prev => 
      prev.includes(facultadValue)
        ? prev.filter(v => v !== facultadValue)
        : [...prev, facultadValue]
    );
  };

  const handleDeleteSelectedFacultades = async () => {
    if (selectedFacultades.length === 0) return;

    // Filtrar solo las facultades que realmente se pueden eliminar (las que están en el catálogo)
    const facultadesAEliminar = selectedFacultades.filter(facValue => {
      const facOption = options.find(opt => opt.value === facValue);
      // No eliminar la opción vacía
      return facOption && facOption.value !== '';
    });

    if (facultadesAEliminar.length === 0) {
      toast.error('No hay facultades válidas para eliminar.');
      return;
    }

    try {
      for (const facValue of facultadesAEliminar) {
        const facOption = options.find(opt => opt.value === facValue);
        if (facOption && facOption.label) {
          await deleteFacultadCarrera(facOption.label);
        }
      }
      
      // Actualizar el estado local inmediatamente filtrando las eliminadas
      const facultadesRestantes = options.filter(opt => !facultadesAEliminar.includes(opt.value));
      setFacultadOptions(facultadesRestantes);
      setSelectedFacultades([]);
      toast.success(`${facultadesAEliminar.length} facultad(es) eliminada(s) correctamente.`);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      toast.error(`No se pudo eliminar: ${detail}`);
    }
  };

  const selectedLabel = options.find((opt) => opt.value === value)?.label;
  const errorMessage = Array.isArray(error) ? (error[0] || '') : error;
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setInputValue(selectedLabel || '');
      return;
    }

    if (searchable) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, searchable, selectedLabel]);

  // pulse handling for error rebote
  const [isPulsing, setIsPulsing] = useState(false);
  useEffect(() => {
    if (!error) { setIsPulsing(false); return; }
    setIsPulsing(false);
    const frame = requestAnimationFrame(() => setIsPulsing(true));
    const to = setTimeout(() => setIsPulsing(false), ERROR_SHAKE_DURATION_MS);
    return () => { cancelAnimationFrame(frame); clearTimeout(to); };
  }, [error, pulse]);

  const filteredOptions = searchable
    ? options.filter((opt) => String(opt.label || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  return (
    <div ref={containerRef} className={`relative ${error && isPulsing ? ERROR_MOTION_CLASS : ''}`}>
      {label && (
        <label className="block text-sm font-semibold text-slate-800 dark:text-slate-300 mb-2">
          {manageMode ? 'Agregar, Editar, Eliminar Facultades' : label} {error && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="flex gap-0.5">
        <div
          className={`flex-1 px-4 py-2.5 rounded-xl text-left flex transition-all min-w-0 ${
            !manageMode && !open && !selectedLabel ? 'h-[46px]' : 'min-h-[46px]'
          } ${
            disabled ? 'cursor-not-allowed opacity-60' : 'hover:shadow-md'
          } ${
            error
              ? ERROR_FIELD_BORDER_CLASS + ' bg-slate-50 dark:bg-slate-700'
              : open
                ? 'border-2 border-[#2C4AAE] bg-slate-50 dark:bg-slate-700'
                : 'border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-[#2C4AAE]'
          }`}
        >
        {manageMode ? (
          <input
            ref={inputRef}
            type="text"
            value={newFacultadName}
            onChange={(e) => setNewFacultadName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (newFacultadName.trim() && onAddFacultad) {
                  onAddFacultad(newFacultadName.trim());
                  setNewFacultadName('');
                }
              }
            }}
            placeholder="Agregar nueva facultad"
            className="flex-1 bg-transparent focus:outline-none text-sm min-w-0 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
          />
        ) : searchable ? (
          open ? (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                const term = e.target.value;
                setInputValue(term);
                setSearchTerm(term);
                if (!open) setOpen(true);
              }}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1 bg-transparent focus:outline-none text-sm min-w-0 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            />
          ) : (
            <div className="flex-1 min-w-0 max-w-full">
              <button
                type="button"
                onClick={() => {
                  if (disabled) return;
                  setOpen(true);
                  setInputValue('');
                  setSearchTerm('');
                }}
                disabled={disabled}
                className={`block w-full text-left bg-transparent pr-2 min-w-0 ${
                  selectedLabel ? 'py-0.5 self-center' : 'py-0 self-center'
                }`}
              >
                <span
                  className={`block leading-tight ${
                    selectedLabel
                      ? 'text-sm whitespace-normal break-words text-slate-800 dark:text-white font-semibold'
                      : 'text-xs italic whitespace-nowrap overflow-hidden text-ellipsis text-slate-500 dark:text-slate-400'
                  }`}
                  style={selectedLabel ? { overflowWrap: 'anywhere', wordBreak: 'break-word' } : undefined}
                >
                  {selectedLabel || placeholder}
                </span>
              </button>
            </div>
          )
        ) : (
          <div className="flex-1 min-w-0 max-w-full">
            <button
              type="button"
              onClick={handleSelectMode}
              disabled={disabled}
              className="inline-block text-left bg-transparent pr-2 py-1 max-w-full min-w-0 align-top"
            >
              <span className={`block break-words leading-tight ${selectedLabel ? 'text-slate-800 dark:text-white font-semibold text-sm' : 'text-slate-400 dark:text-slate-500'}`} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {selectedLabel || placeholder}
              </span>
            </button>
          </div>
        )}

        {manageMode ? (
          <div className="flex items-start gap-1 self-start mt-1">
            {selectedFacultades.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelectedFacultades}
                className="w-8 h-8 bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                title={`Eliminar ${selectedFacultades.length} facultad(es) seleccionada(s)`}
              >
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (newFacultadName.trim() && onAddFacultad) {
                  onAddFacultad(newFacultadName.trim());
                  setNewFacultadName('');
                } else {
                  setManageMode(false);
                  setOpen(false);
                  setNewFacultadName('');
                  setSelectedFacultades([]);
                }
              }}
              disabled={disabled}
              className="w-8 h-8 bg-[#2C4AAE] hover:bg-[#1a3a8a] rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
            >
              {newFacultadName.trim() ? (
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSelectMode}
            disabled={disabled}
            className="w-8 h-8 bg-[#2C4AAE] hover:bg-[#1a3a8a] rounded-lg flex items-center justify-center transition-colors flex-shrink-0 self-center"
          >
            <svg
              className={`w-4 h-4 text-white transition-transform duration-200 ${open && !manageMode ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
        </div>

        {showManageButton && !manageMode && (
          <button
            type="button"
            onClick={() => {
              setManageMode(true);
              setOpen(true);
            }}
            title="Gestionar facultades"
            className="h-[46px] w-[46px] bg-[#2C4AAE] hover:bg-[#1a3a8a] text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center flex-shrink-0"
          >
            <span className="text-lg">+</span>
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-48 overflow-auto">
          {filteredOptions.length > 0 ? (
            manageMode ? (
              <>
                {filteredOptions.filter(opt => opt.value !== '').map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-[#2C4AAE] transition-colors group/facultad"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFacultades.includes(option.value)}
                      onChange={() => toggleSelectFacultad(option.value)}
                      className="w-4 h-4 text-[#2C4AAE] border-slate-400 dark:border-slate-600 rounded focus:ring-[#2C4AAE] flex-shrink-0 accent-[#2C4AAE] group-hover/facultad:accent-white"
                    />
                    {editingFacultad === option.value ? (
                      <input
                        type="text"
                        value={editFacultadName}
                        onChange={(e) => setEditFacultadName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditFacultad();
                          if (e.key === 'Escape') handleCancelEditFacultad();
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-[#2C4AAE] rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2C4AAE]"
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1 text-slate-700 dark:text-slate-300 group-hover/facultad:text-white">{option.label}</span>
                    )}
                    {editingFacultad === option.value ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSaveEditFacultad}
                          className="w-4 h-4 flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:text-white dark:hover:text-white transition-colors"
                          title="Guardar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditFacultad}
                          className="w-4 h-4 flex items-center justify-center text-red-600 dark:text-red-400 hover:text-white dark:hover:text-white transition-colors"
                          title="Cancelar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEditFacultad(option)}
                        className="w-4 h-4 flex items-center justify-center text-[#2C4AAE] dark:text-blue-400 group-hover/facultad:text-white transition-colors flex-shrink-0"
                        title="Editar facultad"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange({ target: { name, value: option.value } });
                    setInputValue(option.label);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    value === option.value
                      ? 'bg-[#2C4AAE] text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))
            )
          ) : (
            <div className="px-4 py-3 text-sm text-center text-slate-500 dark:text-slate-400">
              No se encontraron opciones
            </div>
          )}
        </div>
      )}

      {errorMessage && <p className="text-xs text-red-600 mt-1">{errorMessage}</p>}
    </div>
  );
};

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

const DatePickerField = ({ label, name, value, onDateChange, error, required, maxIsoDate, pulse = 0 }) => {
  const [open, setOpen] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [openQuickPicker, setOpenQuickPicker] = useState(null);
  const [inputValue, setInputValue] = useState(formatDisplayDate(value));
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
  const containerRef = useRef(null);
  const yearMenuRef = useRef(null);
  const currentYearOptionRef = useRef(null);

  useEffect(() => {
    setInputValue(formatDisplayDate(value));
  }, [value]);

  useEffect(() => {
    if (!error) { setIsPulsing(false); return; }
    setIsPulsing(false);
    const frame = requestAnimationFrame(() => setIsPulsing(true));
    const to = setTimeout(() => setIsPulsing(false), ERROR_SHAKE_DURATION_MS);
    return () => { cancelAnimationFrame(frame); clearTimeout(to); };
  }, [error, pulse]);

  useEffect(() => {
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
  const startYear = currentYearRef - 25;
  const endYear = currentYearRef + 25;
  const yearOptions = Array.from({ length: endYear - startYear + 1 }, (_, idx) => startYear + idx);
  const monthOptions = monthNames.map((labelItem, valueIndex) => ({ value: valueIndex, label: labelItem }));
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

  useEffect(() => {
    if (openQuickPicker !== 'year') return;

    const rafId = requestAnimationFrame(() => {
      const menuEl = yearMenuRef.current;
      const currentYearEl = currentYearOptionRef.current;
      if (!menuEl || !currentYearEl) return;

      const targetTop = currentYearEl.offsetTop - (menuEl.clientHeight / 2) + (currentYearEl.clientHeight / 2);
      menuEl.scrollTop = Math.max(0, targetTop);
    });

    return () => cancelAnimationFrame(rafId);
  }, [openQuickPicker]);

  const isOverMaxDate = (dateObj) => {
    const maxDateObj = parseIsoDate(maxIsoDate);
    if (!maxDateObj) return false;
    return dateObj > maxDateObj;
  };

  const commitDate = (dateObj) => {
    if (isOverMaxDate(dateObj)) {
      toast.error('La fecha de resolución no puede ser futura.');
      return;
    }
    const iso = toIsoDate(dateObj);
    onDateChange(name, iso);
    setInputValue(formatDisplayDate(iso));
    setOpen(false);
  };

  const handlePickDate = (dateObj) => {
    setDraftDay(dateObj.getDate());
    setHasSelectedMonth(true);
    setHasSelectedYear(true);
    commitDate(dateObj);
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
        if (isOverMaxDate(parsed)) {
          toast.error('La fecha de resolución no puede ser futura.');
          return;
        }
        onDateChange(name, toIsoDate(parsed));
        setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
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
      if (isOverMaxDate(parsed)) {
        toast.error('La fecha de resolución no puede ser futura.');
        setInputValue(formatDisplayDate(value));
        return;
      }
      const iso = toIsoDate(parsed);
      onDateChange(name, iso);
      setInputValue(formatDisplayDate(iso));
      setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      return;
    }
    onDateChange(name, '');
    setInputValue('');
  };

  const errorMessage = Array.isArray(error) ? (error[0] || '') : error;

  return (
    <div ref={containerRef} className={`relative ${error && isPulsing ? ERROR_MOTION_CLASS : ''}`}>
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {error && <span className="text-red-500">*</span>}</label>
      <div className={`relative w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-700 shadow-sm ${error ? ERROR_FIELD_BORDER_CLASS : 'border-slate-300 dark:border-slate-600'} focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent`}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={inputValue}
          onChange={handleManualInputChange}
          onBlur={handleManualInputBlur}
          className="w-full bg-transparent text-slate-800 dark:text-white px-4 py-2.5 pr-12 rounded-xl focus:outline-none"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="absolute right-1.5 top-1/2 h-8 w-8 rounded-lg border border-[#3A56AF]/40 bg-[#2C4AAE] text-white hover:bg-[#233C8F] transition-colors"
          style={{ transform: 'translateY(-50%)' }}
          aria-label={`Abrir calendario de ${label}`}
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
              const isBlocked = isOverMaxDate(cellDate);
              return (
                <button
                  key={toIsoDate(cellDate)}
                  type="button"
                  onClick={() => !isBlocked && handlePickDate(cellDate)}
                  className={`h-8 rounded-lg text-xs ${isSelected ? 'bg-[#4654E8] text-white font-semibold' : isBlocked ? 'text-slate-300/60 cursor-not-allowed' : 'text-slate-100 hover:bg-white/15'} ${isToday && !isSelected ? 'border border-white/55' : 'border border-transparent'}`}
                >
                  {cellDate.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {errorMessage && <p className="text-xs text-red-600 mt-1">{errorMessage}</p>}
    </div>
  );
};

const ToggleSwitch = ({ isActive, onChange, size = 'md' }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      size === 'sm' ? 'h-5 w-9' : 'h-6 w-12'
    } ${
      isActive
        ? 'bg-emerald-500 dark:bg-emerald-600 focus:ring-emerald-400 dark:focus:ring-emerald-500'
        : 'bg-slate-300 dark:bg-slate-600 focus:ring-slate-400 dark:focus:ring-slate-500'
    }`}
  >
    <span
      className={`inline-block transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
        size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
      } ${
        isActive ? (size === 'sm' ? 'translate-x-[16px]' : 'translate-x-6') : 'translate-x-0.5'
      }`}
    />
  </button>
);

const ExpandableTextField = ({ label, name, value, onChange, onExpand, placeholder, rows = 3 }) => (
  <div>
    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label}</label>
    <div className="relative">
      <textarea
        name={name}
        value={value || ''}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 placeholder:text-xs placeholder:italic transition-all shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-md pr-12"
      />
      <button
        type="button"
        onClick={onExpand}
        title="Expandir"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#2C4AAE] text-white shadow-sm transition-all duration-200 hover:bg-[#1a3a8a] hover:scale-105"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v3m16-5h-3a2 2 0 012 2v3M3 16v3a2 2 0 002 2h3m11-5v3a2 2 0 01-2 2h-3" />
        </svg>
      </button>
    </div>
  </div>
);

const LegacyExpandableTextarea = null;

// Componente de Filtro de Carreras con Búsqueda
const FilterCarreras = ({ carreras, onSelect, placeholder = 'Buscar carrera...' }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

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

  const filteredCarreras = carreras.filter(carrera =>
    carrera.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    carrera.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (!value.trim()) {
      onSelect(null);
    }
    setOpen(true);
  };

  const handleButtonClick = () => {
    // Al usar el botón del desplegable, limpiar siempre el campo de búsqueda
    // para listar nuevamente todas las carreras.
    setSearchTerm('');
    onSelect(null);
    setOpen(!open);
    if (!open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSelectCarrera = (carrera) => {
    onSelect(carrera);
    setSearchTerm(carrera.nombre);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full md:w-64">
      <div className={`flex items-center px-3 py-2.5 md:px-4 md:py-3 rounded-lg md:rounded-2xl transition-all ${
        open 
          ? 'border-2 border-[#2C4AAE] bg-slate-50 dark:bg-slate-700' 
          : 'border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-[#2C4AAE]'
      }`}>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          className="flex-1 min-w-0 bg-transparent text-slate-800 dark:text-white focus:outline-none text-xs md:text-sm placeholder-slate-400 dark:placeholder-slate-500"
        />
        <button
          type="button"
          onClick={handleButtonClick}
          className="w-7 h-7 md:w-8 md:h-8 bg-[#2C4AAE] hover:bg-[#1a3a8a] rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ml-2"
        >
          <svg
            className={`w-3.5 h-3.5 md:w-4 md:h-4 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-56 md:max-h-64 overflow-auto">
          {filteredCarreras.length > 0 ? (
            filteredCarreras.map((carrera) => (
              <button
                key={carrera.id}
                type="button"
                onClick={() => handleSelectCarrera(carrera)}
                className="w-full text-left px-3 py-2.5 md:px-4 md:py-3 text-xs md:text-sm transition-colors text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white border-b border-slate-200 dark:border-slate-700 last:border-b-0"
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
    </div>
  );
};

function ListaCarreras({ isDark, sidebarCollapsed = false, hasSidebar = true }) {
  const [carreras, setCarreras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [facultadOptions, setFacultadOptions] = useState([]);
  const [showFacultadManager, setShowFacultadManager] = useState(false);
  const [nuevaFacultad, setNuevaFacultad] = useState('');
  const [facultadManageLoading, setFacultadManageLoading] = useState(false);

  // Modal de editar
  const [showModal, setShowModal] = useState(false);
  const [carreraSeleccionada, setCarreraSeleccionada] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
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
    fecha_actualizacion: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [removeLogoCarrera, setRemoveLogoCarrera] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [carreraToDelete, setCarreraToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteImpact, setDeleteImpact] = useState({
    loading: false,
    materias: 0,
    semestres: 0,
    informes: 0,
    failed: false,
  });
  const [showDependencyWarningModal, setShowDependencyWarningModal] = useState(false);
  const createLogoInputRef = useRef(null);
  const suppressUpdateToastRef = useRef(false);

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);
  const [carreraFiltroId, setCarreraFiltroId] = useState(null);

  // States para modal expandido de campos de texto
  const [expandedField, setExpandedField] = useState(null);

  // Pulse state para reproducir rebote por campo
  const [errorPulse, setErrorPulse] = useState({});
  const pulseFieldErrors = (fields = []) => {
    setErrorPulse((prev) => {
      const next = { ...prev };
      fields.forEach((f) => { next[f] = (next[f] || 0) + 1; });
      return next;
    });
  };

  // Handler para el filtro de carreras
  const handleSelectCarreraFromFilter = (carrera) => {
    if (!carrera) {
      setCarreraFiltroId(null);
      return;
    }
    setCarreraFiltroId((prev) => (prev === carrera.id ? null : carrera.id));
  };

  useEffect(() => {
    cargarCarreras();
    cargarFacultades();
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    setUser(userData);
  }, []);

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

  const abrirGestorFacultades = () => {
    setNuevaFacultad('');
    setShowFacultadManager(true);
  };

  const handleAgregarFacultad = async (nombreFacultad) => {
    const nombre = String(nombreFacultad || '').trim();
    if (!nombre) {
      toast.error('Escribe una facultad antes de agregar.');
      return;
    }

    setFacultadManageLoading(true);
    try {
      const response = await addFacultadCarrera(nombre);
      const data = response.data || [];
      setFacultadOptions(Array.isArray(data) ? data : []);
      setFormData((prev) => ({ ...prev, facultad: nombre }));
      setErrors((prev) => {
        if (!prev.facultad) return prev;
        const next = { ...prev };
        delete next.facultad;
        return next;
      });
      toast.success('Facultad agregada correctamente.');
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      toast.error(`No se pudo agregar: ${detail}`);
    } finally {
      setFacultadManageLoading(false);
    }
  };

  const handleEliminarFacultad = async (nombre) => {
    const facultad = String(nombre || '').trim();
    if (!facultad) return;

    setFacultadManageLoading(true);
    try {
      const response = await deleteFacultadCarrera(facultad);
      const data = response.data || [];
      setFacultadOptions(Array.isArray(data) ? data : []);
      if (String(formData.facultad || '').trim() === facultad) {
        setFormData((prev) => ({ ...prev, facultad: '' }));
      }
      toast.success('Facultad eliminada correctamente.');
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      toast.error(`No se pudo eliminar: ${detail}`);
    } finally {
      setFacultadManageLoading(false);
    }
  };

  const handleSeleccionarFacultad = (nombre) => {
    setFormData((prev) => ({ ...prev, facultad: nombre }));
    setErrors((prev) => {
      if (!prev.facultad) return prev;
      const next = { ...prev };
      delete next.facultad;
      return next;
    });
    setShowFacultadManager(false);
  };

  const cargarCarreras = async () => {
    try {
      const response = await getCarreras();
      const data = response.data.results || response.data;
      setCarreras(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      setError('Error al cargar carreras');
      setLoading(false);
      console.error(err);
    }
  };

  const carrerasMostradas = carreraFiltroId
    ? carreras.filter((c) => c.id === carreraFiltroId)
    : carreras;

  useEffect(() => {
    if (isCreating) {
      setFormData({
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
      });
      setErrors({});
      setLogoFile(null);
      setLogoPreview('');
      setRemoveLogoCarrera(false);
    }
  }, [isCreating]);

  const handleToggleCreateForm = () => {
    setIsCreating(!isCreating);
  };

  const abrirModalEditar = (carrera) => {
    setCarreraSeleccionada(carrera);
    setIsViewMode(false);
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
      fecha_actualizacion: carrera.fecha_actualizacion
    });
    setLogoFile(null);
    setLogoPreview(carrera.logo_carrera || '');
    setRemoveLogoCarrera(false);
    setShowModal(true);
    setIsCreating(false);
  };

  const abrirModalVer = (carrera) => {
    setCarreraSeleccionada(carrera);
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
      fecha_actualizacion: carrera.fecha_actualizacion
    });
    setLogoFile(null);
    setLogoPreview(carrera.logo_carrera || '');
    setRemoveLogoCarrera(false);
    setShowModal(true);
    setIsCreating(false);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen válida');
      return;
    }

    setLogoFile(file);
    setRemoveLogoCarrera(false);
    setLogoPreview(URL.createObjectURL(file));
    setErrors((prev) => {
      if (!prev.logo_carrera_file) return prev;
      const next = { ...prev };
      delete next.logo_carrera_file;
      return next;
    });
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    setRemoveLogoCarrera(true);
  };

  const buildCarreraPayload = () => {
    const codigoNormalizado = String(formData.codigo || '').trim().toUpperCase();

    const payload = new FormData();
    payload.append('nombre', formData.nombre);
    payload.append('codigo', codigoNormalizado);
    payload.append('facultad', formData.facultad);
    payload.append('resolucion_ministerial', formData.resolucion_ministerial || '');
    payload.append('fecha_resolucion', formData.fecha_resolucion || '');
    payload.append('mision', formData.mision || '');
    payload.append('vision', formData.vision || '');
    payload.append('perfil_profesional', formData.perfil_profesional || '');
    payload.append('objetivo_carrera', formData.objetivo_carrera || '');
    payload.append('responsable', formData.responsable || '');
    payload.append('activo', String(Boolean(formData.activo)));

    if (logoFile) {
      payload.append('logo_carrera_file', logoFile);
    }
    if (removeLogoCarrera) {
      payload.append('remove_logo_carrera', 'true');
    }

    return payload;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'codigo' ? value.toUpperCase() : value)
    }));

    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleDateChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleActivoSwitchChange = () => {
    const nextActivo = !formData.activo;
    suppressUpdateToastRef.current = true;
    setFormData((prev) => ({
      ...prev,
      activo: nextActivo,
    }));

    if (nextActivo) {
      toast.success('Carrera activa: para confirmar, actualice la carrera');
    } else {
      toast.error('Carrera inactiva: para confirmar, actualice la carrera');
    }
  };

  // Handlers para modal expandido de campos
  const openExpandedField = (fieldName) => {
    setExpandedField(fieldName);
  };

  const closeExpandedField = () => {
    setExpandedField(null);
  };

  const getErrorMessage = (fieldError) => {
    if (!fieldError) return '';
    if (Array.isArray(fieldError)) return fieldError[0] || '';
    return String(fieldError);
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
      newErrors.resolucion_ministerial = ['Este campo es obligatorio: resolución ministerial.'];
    }

    if (!String(formData.fecha_resolucion || '').trim()) {
      newErrors.fecha_resolucion = ['Este campo es obligatorio: fecha de resolución.'];
    } else if (formData.fecha_resolucion > FECHA_MAXIMA_HOY) {
      newErrors.fecha_resolucion = ['La fecha de resolución no puede ser futura.'];
    }

    if (requireLogo && !logoFile) {
      newErrors.logo_carrera_file = ['El logo de carrera es obligatorio para crear una nueva carrera.'];
    }

    setErrors(newErrors);
      return newErrors;
  };

  const handleCreateSubmit = async (e) => {
    // REGLA GLOBAL: detener el comportamiento por defecto para evitar parpadeo.
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    setErrors({});
    const newErrors = validateCarreraForm({ requireLogo: true });
    if (Object.keys(newErrors).length > 0) {
      toast.error('Completa los campos obligatorios marcados en rojo.');
      pulseFieldErrors(Object.keys(newErrors));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildCarreraPayload();
      const response = await api.post('/carreras/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Carrera creada correctamente');
      if (response.data?.id) {
        setCarreras((prev) => [response.data, ...prev]);
      }
      setIsCreating(false);
    } catch (err) {
      console.error(err);
      const apiErrors = err.response?.data;
      if (apiErrors) {
        const sanitized = sanitizeApiErrors(apiErrors);
        setErrors(sanitized);
        pulseFieldErrors(Object.keys(sanitized));
        const errorMsg = Object.values(sanitized).flat().join(' ');
        toast.error(`Error: ${errorMsg}`);
      } else {
        toast.error('Ocurrió un error inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    // REGLA GLOBAL: detener el comportamiento por defecto para evitar parpadeo.
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }

    setErrors({});
    const newErrors = validateCarreraForm({ requireLogo: false });
    if (Object.keys(newErrors).length > 0) {
      toast.error('Completa los campos obligatorios marcados en rojo.');
      pulseFieldErrors(Object.keys(newErrors));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildCarreraPayload();
      const response = await api.put(`/carreras/${carreraSeleccionada.id}/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!suppressUpdateToastRef.current) {
        toast.success('Carrera actualizada correctamente');
      }
      suppressUpdateToastRef.current = false;
      setShowModal(false);
      setLogoFile(null);
      setLogoPreview('');
      setRemoveLogoCarrera(false);
      if (response.data?.id) {
        setCarreras((prev) => prev.map((carrera) => (
          carrera.id === response.data.id ? response.data : carrera
        )));
      }
    } catch (err) {
      console.error(err);
      const apiData = err.response?.data;

      if (apiData && typeof apiData === 'object' && !apiData.detail) {
        const sanitized = sanitizeApiErrors(apiData);
        setErrors(sanitized);
        pulseFieldErrors(Object.keys(sanitized));
        const errorMsg = Object.values(sanitized).flat().join(' ');
        toast.error(`Error: ${errorMsg}`);
      } else {
        let errorMsg = apiData?.detail || err.message;
        toast.error('Error al actualizar: ' + errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildLogoOnlyPayload = () => {
    const payload = new FormData();
    if (logoFile) {
      payload.append('logo_carrera_file', logoFile);
    }
    if (removeLogoCarrera) {
      payload.append('remove_logo_carrera', 'true');
    }
    return payload;
  };

  const handleLogoOnlySubmit = async (e) => {
    e?.preventDefault?.();
    if (!logoFile && !removeLogoCarrera) {
      toast.error('No hay cambios de logo para guardar.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildLogoOnlyPayload();
      const response = await api.patch(`/carreras/${carreraSeleccionada.id}/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Logo de carrera actualizado correctamente');
      setShowModal(false);
      setLogoFile(null);
      setLogoPreview('');
      setRemoveLogoCarrera(false);
      if (response.data?.id) {
        setCarreras((prev) => prev.map((carrera) => (
          carrera.id === response.data.id ? response.data : carrera
        )));
      }
    } catch (err) {
      console.error(err);
      const apiErrors = err.response?.data;
      if (apiErrors && typeof apiErrors === 'object') {
        const errorMsg = Object.values(apiErrors).flat().join(' ');
        toast.error(`Error: ${errorMsg}`);
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
      loading: false,
      materias: impactData?.materias || 0,
      semestres: impactData?.semestres || 0,
      informes: impactData?.informes || 0,
      failed: false,
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
        setDeleteImpact({
          loading: false,
          materias: deps.materias || 0,
          semestres: deps.semestres || 0,
          informes: deps.informes || 0,
          failed: false,
        });
        setShowDeleteModal(true);
        return;
      }

      openDependencyWarning(
        carrera,
        deps,
        `ERROR DE INTEGRIDAD: No se puede eliminar la carrera ${carrera.nombre} porque aún tiene ${deps.materias || 0} materias e informes vinculados.`
      );
    } catch (err) {
      console.error('Error verificando dependencias de carrera:', err);
      toast.error('No se pudo verificar dependencias de la carrera. Intenta nuevamente.');
    }
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setCarreraToDelete(null);
    setDeleteConfirmText('');
    setDeleteImpact({
      loading: false,
      materias: 0,
      semestres: 0,
      informes: 0,
      failed: false,
    });
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
      if (apiData?.code === 'protected_error') {
        const deps = apiData?.dependencias || {};
        closeDeleteModal();
        openDependencyWarning(carreraToDelete, deps, apiData?.detail);
        return;
      }
      toast.error('Error al eliminar: ' + (apiData?.detail || err.message));
    }
  };

  const esSuperusuario = () => user?.is_superuser === true;
  const rolActual = user?.perfil?.rol;
  const esDirectorCarrera = () => rolActual === 'director';
  const puedeEditarInformacionCarrera = () => esSuperusuario() || esDirectorCarrera();
  const puedeEditarEstructura = () => esSuperusuario();
  const soloEditarLogo = () => !esSuperusuario() && rolActual === 'jefe_estudios';
  const puedeGestionarFacultades = () => esSuperusuario();

  const handleDescargarFichaPdf = async () => {
    if (!carreraSeleccionada?.id) return;

    try {
      const response = await api.get(`/carreras/${carreraSeleccionada.id}/pdf-oficial/`, {
        responseType: 'blob',
      });
      const nombreBase = `${formData.nombre || carreraSeleccionada.nombre || 'carrera'}_${formData.codigo || carreraSeleccionada.codigo || ''}`
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Carrera_${nombreBase || carreraSeleccionada.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Carrera descargada en PDF');
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      toast.error('No se pudo descargar el PDF de carrera.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Cargando carreras...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl shadow-md">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lista-carreras-page min-h-screen bg-slate-50 dark:bg-slate-900 px-3 pb-4 pt-20 md:p-6">
      {/* Header */}
      <div className="max-w-[340px] md:max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl border-2 border-slate-300 dark:border-slate-600 shadow-lg p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold leading-none bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Carreras
              </h2>
              <p className="text-xs md:text-sm text-slate-700 dark:text-slate-400 mt-1 italic">
                Gestión de carreras universitarias
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-2.5 md:gap-3 w-full md:w-auto">
              {/* Filtro de Carreras */}
              <FilterCarreras 
                carreras={carreras} 
                onSelect={handleSelectCarreraFromFilter}
                placeholder="Buscar carrera..."
              />
              
              {/* Botón Nueva Carrera */}
              {puedeEditarEstructura() && (
                <button
                  onClick={handleToggleCreateForm}
                  className="px-4 py-2.5 md:px-5 md:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm md:text-base font-semibold rounded-lg md:rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <span>{isCreating ? '➖' : '➕'}</span>
                  {isCreating ? 'Cancelar' : 'Nueva Carrera'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* MODAL DE CREACIÓN DE CARRERA */}
        {isCreating && createPortal((
          <div
            className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
            style={{ left: hasSidebar ? (sidebarCollapsed ? '5rem' : '18rem') : '0', animationDuration: '160ms' }}
          >
            <div className="bg-white dark:bg-slate-900/90 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-slide-up" style={{ animationDuration: '180ms' }}>
                <div className="px-6 py-4 border-b border-[#7F97E8]/45 bg-[#2C4AAE]">
                  <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    Nueva Carrera
                  </h2>
                </div>
                <form onSubmit={handleCreateSubmit} noValidate className="px-6 py-5 max-h-[calc(90vh-76px)] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-start">
                    <div className="md:col-span-3 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <InputFieldPulse
                            label={`Nombre de la Carrera`}
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleChange}
                            required
                            error={errors.nombre}
                            pulse={errorPulse.nombre || 0}
                            placeholder="Ej: Ingeniería de Sistemas"
                          />
                        </div>

                        <SelectConDropdown
                          label="Facultad"
                          name="facultad"
                          value={formData.facultad}
                          onChange={handleChange}
                          showManageButton={puedeGestionarFacultades()}
                          onManageClick={abrirGestorFacultades}
                          onAddFacultad={handleAgregarFacultad}
                          setFacultadOptions={setFacultadOptions}
                          getFacultadesCarrera={getFacultadesCarrera}
                          formData={formData}
                          setFormData={setFormData}
                          required
                          searchable
                          options={facultadOptions}
                          error={errors.facultad}
                          pulse={errorPulse.facultad || 0}
                          placeholder="Seleccione una facultad..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <InputFieldPulse
                            label="Código"
                            name="codigo"
                            value={formData.codigo}
                            onChange={handleChange}
                            required
                            error={errors.codigo}
                            pulse={errorPulse.codigo || 0}
                            placeholder="Ej: IS"
                          />
                        </div>

                        <div>
                          <InputFieldPulse
                            label="Resolución Ministerial"
                            name="resolucion_ministerial"
                            value={formData.resolucion_ministerial}
                            onChange={handleChange}
                            required
                            error={errors.resolucion_ministerial}
                            pulse={errorPulse.resolucion_ministerial || 0}
                            placeholder="Ej: RM 123/2020"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DatePickerField
                          label="Fecha de Resolución"
                          name="fecha_resolucion"
                          value={formData.fecha_resolucion}
                          onDateChange={handleDateChange}
                          required
                          error={errors.fecha_resolucion}
                          pulse={errorPulse.fecha_resolucion || 0}
                          maxIsoDate={FECHA_MAXIMA_HOY}
                        />

                        {/* Responsable: solo visible en edición si ya tiene valor */}
                        {formData.responsable && (
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Responsable</label>
                          <input
                            type="text"
                            name="responsable"
                            value={formData.responsable}
                            readOnly
                            className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white transition-all shadow-sm cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        )}
                      </div>

                    </div>

                    <div className="md:col-span-2 h-full">
                      <div className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-4 h-full flex flex-col">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <label className="block text-sm font-semibold text-slate-800 dark:text-slate-300">Logo de Carrera {errors.logo_carrera_file && <span className="text-red-500">*</span>}</label>
                        </div>

                        <input
                          ref={createLogoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                        />

                        <div className="flex-1 flex items-center justify-center">
                          <div className={errors.logo_carrera_file && (errorPulse.logo_carrera_file || 0) ? ERROR_MOTION_CLASS : ''}>
                            <div className="mx-auto w-40 h-40 rounded-full overflow-hidden border border-blue-300 dark:border-blue-700 shadow-md relative group bg-white dark:bg-slate-900">
                              {logoPreview ? (
                                <img src={logoPreview} alt="Logo de carrera" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-900 to-blue-950" />
                              )}

                              <div className="absolute inset-0 flex opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                {logoPreview ? (
                                  <>
                                    <div
                                      onClick={() => createLogoInputRef.current?.click()}
                                      className="w-1/2 h-full bg-black/45 hover:bg-black/65 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer text-white"
                                      title="Cambiar logo"
                                    >
                                      <span className="text-[10px] font-bold">CAMBIAR</span>
                                    </div>
                                    <div className="w-px h-full bg-white/20" />
                                    <div
                                      onClick={handleRemoveLogo}
                                      className="w-1/2 h-full bg-red-600/65 hover:bg-red-600/85 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer text-white"
                                      title="Eliminar logo"
                                    >
                                      <span className="text-[10px] font-bold">BORRAR</span>
                                    </div>
                                  </>
                                ) : (
                                  <div
                                    onClick={() => createLogoInputRef.current?.click()}
                                    className="w-full h-full bg-black/35 hover:bg-black/55 backdrop-blur-md flex items-center justify-center cursor-pointer text-white"
                                    title="Subir logo"
                                  >
                                    <span className="text-xs font-bold">SUBIR FOTO</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-center text-slate-500 dark:text-slate-400">
                          Pasa el cursor para subir, cambiar o eliminar el logo.
                        </p>
                        {errors.logo_carrera_file && <p className="text-xs text-red-600 mt-2 text-center">{getErrorMessage(errors.logo_carrera_file)}</p>}
                      </div>
                    </div>

                    <div className="md:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ExpandableTextField
                        label="Misión"
                        name="mision"
                        value={formData.mision}
                        onChange={handleChange}
                        onExpand={() => openExpandedField('mision')}
                        placeholder="Misión institucional de la carrera"
                        rows={3}
                      />

                      <ExpandableTextField
                        label="Visión"
                        name="vision"
                        value={formData.vision}
                        onChange={handleChange}
                        onExpand={() => openExpandedField('vision')}
                        placeholder="Visión institucional de la carrera"
                        rows={3}
                      />
                    </div>

                    <div className="md:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ExpandableTextField
                        label="Perfil Profesional"
                        name="perfil_profesional"
                        value={formData.perfil_profesional}
                        onChange={handleChange}
                        onExpand={() => openExpandedField('perfil_profesional')}
                        placeholder="Descripción del perfil profesional del egresado"
                        rows={3}
                      />

                      <ExpandableTextField
                        label="Objetivo de Carrera"
                        name="objetivo_carrera"
                        value={formData.objetivo_carrera}
                        onChange={handleChange}
                        onExpand={() => openExpandedField('objetivo_carrera')}
                        placeholder="Objetivo general de la carrera"
                        rows={3}
                      />
                    </div>

                  </div>

                  <div className="mt-6 pt-4 border-t-2 border-slate-300 dark:border-slate-700 flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                      }}
                      className="px-6 py-2.5 min-w-[160px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow-md"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 min-w-[200px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60"
                    >
                      {isSubmitting ? 'Guardando...' : '💾 Guardar'}
                    </button>
                  </div>
                </form>
            </div>
          </div>
        ), document.body)}

        {carrerasMostradas.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5 md:gap-3 md:grid-cols-2 lg:grid-cols-4">
            {carrerasMostradas.map((carrera) => (
              <button
                type="button"
                key={carrera.id} 
                onClick={() => abrirModalVer(carrera)}
                className={`group text-left rounded-lg md:rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col aspect-square md:aspect-auto md:h-[240px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 ${
                  carrera.activo
                    ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                    : 'bg-red-100 dark:bg-red-900/35 border-red-400 dark:border-red-700'
                }`}
              >
                <div className="p-1.5 md:p-6 flex flex-col flex-1">
                  {/* Contenido horizontal */}
                  <div className="flex flex-1 flex-col items-center justify-center gap-1 md:flex-row md:items-start md:justify-between md:gap-4 md:mb-4">
                    {/* Info izquierda */}
                    <div className="order-2 md:order-1 flex min-w-0 flex-col items-center md:items-start md:flex-1">
                      <div className="flex flex-col items-center gap-1 md:items-start">
                        <div className="flex flex-col items-center md:items-start gap-1 md:gap-2 md:flex-wrap">
                          <h3 className={`text-center md:text-left text-[10px] md:text-base font-bold leading-tight break-words line-clamp-2 md:line-clamp-none ${carrera.activo ? 'text-blue-700 dark:text-blue-300' : 'text-red-900 dark:text-red-100'}`}>
                            {carrera.nombre}
                          </h3>
                          <p className={`text-center md:text-left text-[8px] md:text-sm italic leading-tight break-words line-clamp-2 md:line-clamp-none ${carrera.activo ? 'text-slate-600 dark:text-slate-400' : 'text-red-800 dark:text-red-200'}`}>
                            {carrera.facultad}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Código */}
                    <div className="order-1 md:order-2 flex shrink-0 flex-col items-center gap-0.5 transition-transform duration-200 group-hover:scale-105">
                      <div className="flex h-[115px] w-[115px] md:h-20 md:w-20 items-center justify-center overflow-hidden">
                        {carrera.logo_carrera ? (
                          <img
                            src={carrera.logo_carrera}
                            alt={`Logo de ${carrera.nombre}`}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-xs md:text-base font-extrabold text-blue-700 dark:text-blue-300">
                            {carrera.codigo}
                          </span>
                        )}
                      </div>
                      <span className="hidden md:block text-center text-sm font-extrabold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                        {carrera.codigo}
                      </span>
                    </div>
                    <div className={`order-1 md:hidden h-px w-full ${
                      carrera.activo ? 'bg-slate-200 dark:bg-slate-700' : 'bg-red-300 dark:bg-red-700/80'
                    }`} />
                  </div>

                  {!carrera.activo && (
                    <p className="mt-1 mb-2 text-[9px] md:text-xs font-semibold text-red-800 dark:text-red-200">
                      ⚠ Carrera inactiva
                    </p>
                  )}

                  {/* Botones de acción - Una línea */}
                  <div className={`hidden md:block pt-2.5 md:pt-4 mt-auto border-t ${
                    carrera.activo ? 'border-slate-200 dark:border-slate-700' : 'border-red-300 dark:border-red-700/80'
                  }`}>
                    <span className="inline-flex items-center text-[9px] md:text-xs font-bold uppercase tracking-wide text-blue-600 transition-colors duration-200 group-hover:text-blue-700 dark:text-blue-300 dark:group-hover:text-blue-200">
                      Ver detalle
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-600 p-12 text-center shadow-md">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">🎓</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              No hay carreras registradas
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Comienza agregando tu primera carrera
            </p>
            {puedeEditarEstructura() && (
              <button
                onClick={handleToggleCreateForm}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
              >
                <span>➕</span>
                Crear Primera Carrera
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Ver / Editar */}
      {showModal && carreraSeleccionada && isViewMode && createPortal((
        <div className="fixed top-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4 animate-fade-in" style={{ left: hasSidebar ? (sidebarCollapsed ? '5rem' : '18rem') : '0', animationDuration: '160ms' }}>
          <div className="carrera-view-modal bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[88vh] md:max-h-[92vh] overflow-hidden animate-slide-up flex flex-col" style={{ animationDuration: '180ms' }}>
            {/* Header */}
            <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800 flex items-center justify-between">
              <h3 className="text-base md:text-xl font-bold text-white">Ver Carrera</h3>
            </div>

            {/* Content */}
            <div className="flex-1 p-3 md:p-6 overflow-y-auto bg-slate-950/5 dark:bg-slate-950">
              <div className="carrera-view-document mx-auto max-w-3xl bg-blue-50 text-slate-800 rounded-lg border border-blue-100 shadow-xl p-4 md:p-8 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 md:flex-col md:gap-0 md:justify-center pb-4 md:pb-6 border-b border-slate-300 dark:border-slate-600">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo carrera" className="h-20 w-20 md:h-52 md:w-52 shrink-0 object-contain rounded-2xl md:rounded-none border border-blue-100 bg-white shadow-sm md:border-0 md:bg-transparent md:shadow-none" />
                  ) : (
                    <div className="h-20 w-20 md:h-36 md:w-36 shrink-0 flex items-center justify-center rounded-2xl border border-blue-100 bg-white text-[10px] md:text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      Sin logo
                    </div>
                  )}

                  <div className="min-w-0 md:text-center">
                    <h4 className="text-lg md:mt-4 md:text-2xl font-bold text-blue-800 leading-tight break-words dark:text-blue-200">
                      {formData.nombre}
                    </h4>
                    <span className="mt-1 md:mt-2 inline-flex items-center justify-center text-center px-2 md:px-4 py-1 text-sm md:text-base text-blue-700 font-extrabold tracking-wide leading-none min-w-0 md:min-w-[64px] dark:text-blue-300">
                      {formData.codigo}
                    </span>
                  </div>
                </div>

                <div className="mt-4 md:mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <h5 className="text-[0.64rem] md:text-xs font-bold tracking-widest text-slate-600 uppercase dark:text-slate-300">Facultad</h5>
                    <p className="mt-1 text-xs md:text-sm font-semibold text-slate-800 break-words leading-snug dark:text-white">{formData.facultad || 'N/A'}</p>
                  </div>
                  {formData.responsable && (
                    <div>
                      <h5 className="text-[0.64rem] md:text-xs font-bold tracking-widest text-slate-600 uppercase dark:text-slate-300">Responsable</h5>
                      <p className="mt-1 text-xs md:text-sm font-semibold text-slate-800 break-words leading-snug dark:text-white">{formData.responsable}</p>
                    </div>
                  )}
                  {formData.fecha_actualizacion && (
                    <div>
                      <h5 className="text-[0.64rem] md:text-xs font-bold tracking-widest text-slate-600 uppercase dark:text-slate-300">Actualizado</h5>
                      <p className="mt-1 text-xs md:text-sm font-semibold text-slate-800 break-words leading-snug dark:text-white">
                        {new Date(formData.fecha_actualizacion).toLocaleDateString('es-ES', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  )}
                </div>

                <div className="carrera-view-text-grid mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-bold tracking-wider text-blue-700 uppercase">Misión</h5>
                    <div className="mt-2 rounded-md border border-slate-300 bg-slate-50 p-4 text-sm italic leading-relaxed min-h-[110px] whitespace-pre-line">
                      {formData.mision || 'Sin misión registrada.'}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold tracking-wider text-blue-700 uppercase">Visión</h5>
                    <div className="mt-2 rounded-md border border-slate-300 bg-slate-50 p-4 text-sm italic leading-relaxed min-h-[110px] whitespace-pre-line">
                      {formData.vision || 'Sin visión registrada.'}
                    </div>
                  </div>
                </div>

                <div className="carrera-view-text-grid mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-bold tracking-wider text-blue-700 uppercase">Perfil Profesional</h5>
                    <div className="mt-2 rounded-md border border-slate-300 bg-slate-50 p-4 text-sm italic leading-relaxed min-h-[110px] whitespace-pre-line">
                      {formData.perfil_profesional || 'Sin perfil profesional registrado.'}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold tracking-wider text-blue-700 uppercase">Objetivo de Carrera</h5>
                    <div className="mt-2 rounded-md border border-slate-300 bg-slate-50 p-4 text-sm italic leading-relaxed min-h-[110px] whitespace-pre-line">
                      {formData.objetivo_carrera || 'Sin objetivo de carrera registrado.'}
                    </div>
                  </div>
                </div>
              </div>

              {soloEditarLogo() && (
                <div className="mx-auto mt-6 max-w-3xl bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 p-4">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Actualizar logo institucional</p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-semibold hover:file:bg-blue-700"
                    />
                    {(logoPreview || logoFile) && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm font-semibold"
                      >
                        Eliminar Logo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleLogoOnlySubmit}
                      disabled={isSubmitting}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                    >
                      {isSubmitting ? 'Guardando...' : 'Guardar Logo'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="carrera-view-footer border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleDescargarFichaPdf}
                className="px-6 py-2.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-semibold transition-all"
              >
                ⬇️ Descargar
              </button>
              <button
                type="button"
                onClick={() => {
                  suppressUpdateToastRef.current = false;
                  setShowModal(false);
                  setIsViewMode(false);
                }}
                className="px-6 py-2.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-semibold transition-all"
              >
                Cerrar
              </button>
              {puedeEditarInformacionCarrera() && (
                <button
                  type="button"
                  onClick={() => setIsViewMode(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all shadow-md"
                >
                  Editar Carrera
                </button>
              )}
              {puedeEditarEstructura() && (
                <button
                  type="button"
                  onClick={() => eliminarCarrera(carreraSeleccionada)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all shadow-md"
                >
                  <FaTrash size={14} />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      ), document.body)}

      {showModal && carreraSeleccionada && !isViewMode && createPortal((
        <div className="fixed top-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" style={{ left: hasSidebar ? (sidebarCollapsed ? '5rem' : '18rem') : '0', animationDuration: '160ms' }}>
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-slide-up" style={{ animationDuration: '180ms' }}>
            <div className="px-6 py-4 border-b border-[#7F97E8]/45 bg-[#2C4AAE]">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">Editar Carrera</h3>
            </div>

            <form onSubmit={handleUpdateSubmit} noValidate className="px-6 py-5 max-h-[calc(90vh-76px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5 items-start">
                <div className="md:col-span-3 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Nombre de la Carrera {errors.nombre && <span className="text-red-500">*</span>}</label>
                      <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} onFocus={() => setErrors(prev => prev.nombre ? ({ ...prev, nombre: undefined }) : prev)} required placeholder="Ej: Ingeniería de Sistemas" className={`w-full px-4 py-2.5 rounded-xl border-2 ${errors.nombre ? ERROR_FIELD_BORDER_CLASS : 'border-slate-300 dark:border-slate-600'} bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 placeholder:text-xs placeholder:italic transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-md`} />
                      {errors.nombre && <p className="text-xs text-red-600 mt-1">{getErrorMessage(errors.nombre)}</p>}
                    </div>

                    <SelectConDropdown
                      label="Facultad"
                      name="facultad"
                      value={formData.facultad}
                      onChange={handleChange}
                      showManageButton={puedeGestionarFacultades()}
                      onManageClick={abrirGestorFacultades}
                      onAddFacultad={handleAgregarFacultad}
                      setFacultadOptions={setFacultadOptions}
                      getFacultadesCarrera={getFacultadesCarrera}
                      formData={formData}
                      setFormData={setFormData}
                      required
                      searchable
                      options={facultadOptions}
                      error={errors.facultad}
                      disabled={!puedeEditarEstructura()}
                      placeholder="Seleccione una facultad..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Código {errors.codigo && <span className="text-red-500">*</span>}</label>
                      <input type="text" name="codigo" value={formData.codigo} onChange={handleChange} onFocus={() => setErrors(prev => prev.codigo ? ({ ...prev, codigo: undefined }) : prev)} required disabled={!puedeEditarEstructura()} placeholder="Ej: IS" className={`w-full px-4 py-2.5 rounded-xl border-2 ${errors.codigo ? ERROR_FIELD_BORDER_CLASS : 'border-slate-300 dark:border-slate-600'} bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 placeholder:text-xs placeholder:italic transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400`} />
                      {errors.codigo && <p className="text-xs text-red-600 mt-1">{getErrorMessage(errors.codigo)}</p>}
                      {!puedeEditarEstructura() && (
                        <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Solo el Superusuario puede cambiar el código de carrera.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Resolución Ministerial {errors.resolucion_ministerial && <span className="text-red-500">*</span>}</label>
                      <input type="text" name="resolucion_ministerial" value={formData.resolucion_ministerial} onChange={handleChange} onFocus={() => setErrors(prev => prev.resolucion_ministerial ? ({ ...prev, resolucion_ministerial: undefined }) : prev)} required placeholder="Ej: RM 123/2020" className={`w-full px-4 py-2.5 rounded-xl border-2 ${errors.resolucion_ministerial ? ERROR_FIELD_BORDER_CLASS : 'border-slate-300 dark:border-slate-600'} bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 placeholder:text-xs placeholder:italic transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-md`} />
                      {errors.resolucion_ministerial && <p className="text-xs text-red-600 mt-1">{getErrorMessage(errors.resolucion_ministerial)}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DatePickerField
                      label="Fecha de Resolución"
                      name="fecha_resolucion"
                      value={formData.fecha_resolucion}
                      onDateChange={handleDateChange}
                      required
                      error={errors.fecha_resolucion}
                      maxIsoDate={FECHA_MAXIMA_HOY}
                    />

                    {/* Responsable: solo visible si ya tiene valor */}
                    {formData.responsable && (
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Responsable</label>
                      <input type="text" name="responsable" value={formData.responsable} readOnly className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white transition-all shadow-sm cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    )}
                  </div>

                </div>

                <div className="md:col-span-2 h-full">
                  <div className={`rounded-xl border p-4 h-full flex flex-col ${
                    formData.activo
                      ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60'
                      : 'border-red-500 dark:border-red-500 bg-red-100 dark:bg-red-900/35 shadow-[0_0_0_1px_rgba(239,68,68,0.16)]'
                  }`}>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <label className="block text-sm font-semibold text-slate-800 dark:text-slate-300">Logo de Carrera</label>
                      {puedeEditarEstructura() && (
                        <ToggleSwitch size="sm" isActive={Boolean(formData.activo)} onChange={handleActivoSwitchChange} />
                      )}
                    </div>

                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="editar-logo-carrera-file" />

                    <div className="flex-1 flex items-center justify-center">
                      <div className={`mx-auto w-40 h-40 rounded-full overflow-hidden border shadow-md relative group ${
                        formData.activo
                          ? 'border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900'
                          : 'border-red-500 dark:border-red-700 bg-red-200 dark:bg-red-950/55'
                      }`}>
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo carrera" className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full ${formData.activo ? 'bg-gradient-to-br from-blue-900 to-blue-950' : 'bg-gradient-to-br from-red-700 to-red-950'}`} />
                        )}

                        <div className="absolute inset-0 flex opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          {logoPreview ? (
                            <>
                              <label htmlFor="editar-logo-carrera-file" className="w-1/2 h-full bg-black/45 hover:bg-black/65 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer text-white">
                                <span className="text-[10px] font-bold">CAMBIAR</span>
                              </label>
                              <div className="w-px h-full bg-white/20" />
                              <button type="button" onClick={handleRemoveLogo} className="w-1/2 h-full bg-red-600/65 hover:bg-red-600/85 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer text-white">
                                <span className="text-[10px] font-bold">BORRAR</span>
                              </button>
                            </>
                          ) : (
                            <label htmlFor="editar-logo-carrera-file" className="w-full h-full bg-black/35 hover:bg-black/55 backdrop-blur-md flex items-center justify-center cursor-pointer text-white">
                              <span className="text-xs font-bold">SUBIR FOTO</span>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className={`mt-3 text-xs text-center ${formData.activo ? 'text-slate-500 dark:text-slate-400' : 'font-semibold text-red-800 dark:text-red-200'}`}>
                      {formData.activo
                        ? 'Pasa el cursor para subir, cambiar o eliminar el logo.'
                        : '⚠ Carrera inactiva'}
                    </p>
                  </div>

                </div>

                <div className="md:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ExpandableTextField
                    label="Misión"
                    name="mision"
                    value={formData.mision}
                    onChange={handleChange}
                    onExpand={() => openExpandedField('mision')}
                    placeholder="Misión institucional de la carrera"
                    rows={3}
                  />

                  <ExpandableTextField
                    label="Visión"
                    name="vision"
                    value={formData.vision}
                    onChange={handleChange}
                    onExpand={() => openExpandedField('vision')}
                    placeholder="Visión institucional de la carrera"
                    rows={3}
                  />
                </div>

                <div className="md:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ExpandableTextField
                    label="Perfil Profesional"
                    name="perfil_profesional"
                    value={formData.perfil_profesional}
                    onChange={handleChange}
                    onExpand={() => openExpandedField('perfil_profesional')}
                    placeholder="Descripción del perfil profesional del egresado"
                    rows={3}
                  />

                  <ExpandableTextField
                    label="Objetivo de Carrera"
                    name="objetivo_carrera"
                    value={formData.objetivo_carrera}
                    onChange={handleChange}
                    onExpand={() => openExpandedField('objetivo_carrera')}
                    placeholder="Objetivo general de la carrera"
                    rows={3}
                  />
                </div>

              </div>

              <div className="mt-6 pt-4 border-t-2 border-slate-300 dark:border-slate-700 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    suppressUpdateToastRef.current = false;
                    setShowModal(false);
                    setIsViewMode(false);
                  }}
                  className="px-6 py-2.5 min-w-[160px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow-md"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-6 py-2.5 min-w-[200px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg">
                  💾 Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeDeleteModal} />
          <div className="relative w-full max-w-lg rounded-2xl border border-red-600/80 dark:border-red-700/50 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-red-400 dark:border-slate-700/70 bg-gradient-to-r from-red-400 via-red-200 to-red-50 dark:from-red-900/30 dark:via-slate-900 dark:to-slate-900">
              <h4 className="text-lg font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                <span>🗑️</span>
                Confirmación Crítica
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-700 dark:text-slate-200">
              <p className="text-sm leading-relaxed">
                ¿Estás seguro de eliminar esta carrera? Esta acción es irreversible y eliminará TODOS los semestres, materias e informes de docentes vinculados.
              </p>
              <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
                Carrera objetivo: <strong className="text-red-900 dark:text-red-300">{carreraToDelete?.nombre}</strong>
              </div>
              <div className="rounded-lg border-2 border-red-700 bg-red-100 px-3 py-2 text-sm font-bold text-red-950 dark:border-red-600 dark:bg-red-950/35 dark:text-red-100">
                Advertencia: se borraran semestres, materias, informes de docentes y todos los registros asociados a esta carrera.
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
                {deleteImpact.loading && 'Calculando impacto de eliminación...'}
                {!deleteImpact.loading && !deleteImpact.failed && `Se eliminarán ${deleteImpact.materias} materias, ${deleteImpact.semestres} semestres y ${deleteImpact.informes} informes.`}
                {!deleteImpact.loading && deleteImpact.failed && 'No se pudo calcular el conteo de daños en este momento.'}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Escribe el nombre exacto de la carrera para habilitar la eliminación:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={carreraToDelete?.nombre || 'Nombre de la carrera'}
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
                autoFocus
                className="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={deleteConfirmText !== (carreraToDelete?.nombre || '')}
                className="px-4 py-2 rounded-lg font-bold text-white bg-red-700 hover:bg-red-800 disabled:bg-red-900/40 disabled:text-slate-300 disabled:cursor-not-allowed"
              >
                🗑️ Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {showDependencyWarningModal && carreraToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setShowDependencyWarningModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-red-600/80 dark:border-red-700/50 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-5 py-4 border-b border-red-400 dark:border-slate-700/70 bg-gradient-to-r from-red-400 via-red-200 to-red-50 dark:from-red-900/30 dark:via-slate-900 dark:to-slate-900">
              <h4 className="text-lg font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                <span>⛔</span>
                Error de Integridad
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-700 dark:text-slate-200">
              <p className="text-sm leading-relaxed">
                {deleteImpact.detail || `ERROR DE INTEGRIDAD: No se puede eliminar la carrera ${carreraToDelete.nombre} porque aún tiene ${deleteImpact.materias} materias e informes vinculados.`}
              </p>
              <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-100">
                Dependencias detectadas: {deleteImpact.materias} materias, {deleteImpact.semestres} semestres, {deleteImpact.informes} informes.
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
                Para poder eliminar esta carrera, primero debes mover o eliminar manualmente todos sus registros asociados para evitar la pérdida accidental de datos.
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/70 flex justify-end bg-slate-50 dark:bg-slate-950/70">
              <button
                type="button"
                onClick={() => setShowDependencyWarningModal(false)}
                className="px-4 py-2 rounded-lg font-semibold text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700/60 bg-red-100 dark:bg-red-900/25 hover:bg-red-200 dark:hover:bg-red-900/35"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Expandido para Campos de Texto */}
      {expandedField && createPortal((
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-fade-in" style={{ animationDuration: '160ms' }}>
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[#7F97E8]/45 bg-white shadow-2xl animate-slide-up dark:bg-slate-900/95" style={{ animationDuration: '180ms' }}>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[#7F97E8]/45 bg-[#2C4AAE] px-5 py-4">
              <h3 className="text-base font-bold text-slate-100">
                {expandedField === 'mision' && 'Misión'}
                {expandedField === 'vision' && 'Visión'}
                {expandedField === 'perfil_profesional' && 'Perfil Profesional'}
                {expandedField === 'objetivo_carrera' && 'Objetivo de Carrera'}
              </h3>
              <button
                type="button"
                onClick={closeExpandedField}
                title="Volver al tamaño normal"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white transition-all duration-200 hover:bg-white/25 hover:scale-105"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H5v4m0 6v4h4m6 0h4v-4m0-6V5h-4" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-100px)]">
              <textarea
                name={expandedField}
                value={formData[expandedField] || ''}
                onChange={handleChange}
                className="w-full h-[250px] rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm transition-all placeholder:text-xs placeholder:italic placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400"
                placeholder="Ingresa el contenido aquí..."
              />
            </div>

          </div>
        </div>
      ), document.body)}
    </div>
  );
}

export default ListaCarreras;
