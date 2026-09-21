import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { X } from 'lucide-react';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ERROR_FIELD_BORDER_CLASS,
  getErrorMessage,
  sanitizeApiErrors,
  useErrorPulse,
} from '../utils/formErrors';

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
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
          {label} {errorMessage && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className={`relative w-full min-w-[200px] rounded-xl border-2 bg-slate-50 dark:bg-slate-700 shadow-sm ${
        errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'border-slate-300 dark:border-slate-600'
      } ${disabled ? 'opacity-70' : ''}`}>
        <div className="flex items-center gap-2 px-4 py-2.5">
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
            className="w-full bg-transparent text-slate-800 dark:text-white placeholder-slate-400/70 dark:placeholder-slate-400/60 focus:outline-none disabled:cursor-not-allowed"
          />
          {selectedLabel && !disabled && (
            <button
              type="button"
              onClick={clearSelection}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-white"
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
        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-[#3A56AF] bg-white dark:bg-slate-900 shadow-xl">
          <div className="max-h-40 overflow-auto p-2">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    String(option.value) === String(value)
                      ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 font-semibold'
                      : 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'
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
        ? 'bg-emerald-500 dark:bg-emerald-600 focus:ring-emerald-400 dark:focus:ring-emerald-500'
        : 'bg-slate-300 dark:bg-slate-600 focus:ring-slate-400 dark:focus:ring-slate-500'
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
      className={`grid gap-1.5 rounded-2xl p-1.5 bg-slate-200 dark:bg-slate-800 shadow-sm ${
        errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'border border-slate-300 dark:border-slate-700'
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
            className="relative h-14 md:h-12 w-full rounded-xl overflow-hidden"
          >
            {isActive && (
              <motion.span
                layoutId="period-segment-pill"
                className="absolute inset-0 rounded-xl border border-[#4A55F0] bg-[#4654E8] shadow-[0_8px_20px_rgba(70,84,232,0.35)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
              />
            )}
            <span
              className={`relative z-10 px-2 text-sm md:text-base font-semibold leading-tight transition-colors duration-200 ${
                isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
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

const YearWheelItem = ({ year, distance, itemHeight, onCenterClick }) => {
  const isCenter = Math.abs(distance) < 0.35;
  const isSpacer = year === null;
  const clamped = Math.max(-4, Math.min(4, distance));
  const abs = Math.abs(clamped);
  const curvedDistance = Math.sign(clamped) * Math.pow(abs, 1.08);
  const rotationX = Math.max(-62, Math.min(62, curvedDistance * 16));
  const stepScale = abs < 0.35 ? 1 : 0.97;
  const opacity = abs < 0.35 ? 1 : Math.max(0.4, 1 - abs * 0.2);
  const translateZ = -Math.min(58, abs * 16);

  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        height: `${itemHeight}px`,
        width: '100%',
        transformStyle: 'preserve-3d',
        transform: `translateY(${Math.sign(clamped) * abs * 0.35}px) rotateX(${rotationX}deg) translateZ(${translateZ}px) scale(${stepScale})`,
        transformOrigin: 'center center',
        opacity,
      }}
    >
      {isSpacer ? null : isCenter ? (
        <button
          type="button"
          onClick={() => onCenterClick?.(year)}
          className="w-full h-full flex items-center justify-center tracking-wide font-extrabold text-transparent text-lg scale-125 cursor-pointer select-none"
          title="Confirmar año seleccionado"
          aria-label={`Seleccionar año ${year}`}
        >
          {year}
        </button>
      ) : (
        <span className="tracking-wide font-semibold text-slate-700 dark:text-slate-300 text-sm" style={{ opacity: 1 }}>
          {year}
        </span>
      )}
    </div>
  );
};

const VerticalYearWheelPicker = ({
  value,
  openInitialYear,
  onChange,
  onSettled,
  onConfirm,
  wheelResetToken = 0,
  minYear,
  maxYear,
  visibleCount = 5,
  itemHeight = 52,
}) => {
  const iosWheelTransition = {
    type: 'spring',
    stiffness: 240,
    damping: 30,
    mass: 0.9,
    restDelta: 0.2,
    restSpeed: 0.2,
  };

  const getIndexFromYear = (yearValue) => {
    const numeric = Number(yearValue);
    const fallbackYear = Math.round((minYear + maxYear) / 2);
    const safeYear = Number.isFinite(numeric) ? numeric : fallbackYear;
    const clampedYear = Math.max(minYear, Math.min(maxYear, safeYear));
    return clampedYear - minYear;
  };

  const initialIndex = getIndexFromYear(openInitialYear ?? value);

  const viewportRef = useRef(null);
  const padSlots = 3;
  const [targetIndex, setTargetIndex] = useState(initialIndex);
  const [centeredIndex, setCenteredIndex] = useState(initialIndex);
  const [centerFloatIndex, setCenterFloatIndex] = useState(initialIndex);
  const centeredIndexRef = useRef(initialIndex);
  const centerFloatRef = useRef(initialIndex);
  const isIntroAnimatingRef = useRef(true);
  const lastInternalYearRef = useRef(null);
  const wheelDeltaAccumRef = useRef(0);
  const wheelLastStepAtRef = useRef(0);
  const wheelIdleResetTimerRef = useRef(null);
  const wheelIgnoreUntilRef = useRef(0);

  const years = useMemo(() => {
    const list = [];
    for (let y = minYear; y <= maxYear; y += 1) list.push(y);
    return list;
  }, [minYear, maxYear]);

  const clampIndex = (idx) => Math.max(0, Math.min(years.length - 1, idx));
  const wheelHeight = visibleCount * itemHeight;
  const centerOffset = Math.floor(visibleCount / 2);

  const displayYears = useMemo(() => {
    const top = new Array(padSlots).fill(null);
    const bottom = new Array(padSlots).fill(null);
    return [...top, ...years, ...bottom];
  }, [years]);

  const centeredDisplayIndex = centeredIndex + padSlots;
  const targetDisplayIndex = targetIndex + padSlots;
  const targetY = (centerOffset - targetDisplayIndex) * itemHeight;
  const clampedFloatIndex = Math.max(0, Math.min(years.length - 1, centerFloatIndex));
  const visualDisplayIndex = clampedFloatIndex + padSlots;
  const lowerFloatIndex = Math.floor(clampedFloatIndex);
  const upperFloatIndex = Math.ceil(clampedFloatIndex);
  const centerProgress = clampedFloatIndex - lowerFloatIndex;

  const getOverlayStyle = (offsetY) => {
    const ratio = Math.max(0, 1 - Math.abs(offsetY) / itemHeight);
    const eased = ratio * ratio;
    const scale = 0.92 + 0.48 * eased;
    const opacity = 0.22 + 0.78 * ratio;
    const brightness = 0.85 + 0.25 * eased;
    return {
      transform: `translateY(${offsetY}px) scale(${scale})`,
      opacity,
      filter: `brightness(${brightness})`,
    };
  };

  const emitSelection = (idx) => {
    const finalIndex = clampIndex(idx);
    const finalYear = years[finalIndex];
    if (finalYear !== undefined) {
      lastInternalYearRef.current = Number(finalYear);
    }
    setTargetIndex(finalIndex);
    setCenteredIndex(finalIndex);
    setCenterFloatIndex(finalIndex);
    centeredIndexRef.current = finalIndex;
    centerFloatRef.current = finalIndex;
    isIntroAnimatingRef.current = true;
  };

  const stepSelection = (steps) => {
    if (!years.length || steps === 0) return;
    setTargetIndex((prev) => clampIndex(prev + steps));
  };

  useEffect(() => {
    if (!years.length) return;
    const sourceYear = Number.isFinite(Number(openInitialYear)) ? openInitialYear : value;
    const idx = years.findIndex((y) => Number(y) === Number(sourceYear));
    const syncIndex = idx >= 0 ? idx : Math.floor(years.length / 2);
    const syncYear = years[syncIndex];

    setTargetIndex(syncIndex);
    setCenteredIndex(syncIndex);
    setCenterFloatIndex(syncIndex);
    centeredIndexRef.current = syncIndex;
    centerFloatRef.current = syncIndex;
    if (syncYear !== undefined) {
      lastInternalYearRef.current = Number(syncYear);
    }
  }, [wheelResetToken, years.length, openInitialYear]);

  useEffect(() => {
    if (centeredIndex !== targetIndex) return;

    const selectedYear = years[centeredIndex];
    if (selectedYear === undefined) return;

    if (Number(selectedYear) === lastInternalYearRef.current) return;
    lastInternalYearRef.current = Number(selectedYear);
    onChange(selectedYear);
    onSettled?.(selectedYear);
  }, [centeredIndex, targetIndex, years]);

  useEffect(() => {
    if (!years.length) return;
    const idx = years.findIndex((y) => Number(y) === Number(value));
    const initialIndex = idx >= 0 ? idx : Math.floor(years.length / 2);
    emitSelection(initialIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years.length]);

  useEffect(() => {
    if (!years.length) return;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    if (numericValue === lastInternalYearRef.current) return;

    const idx = years.findIndex((y) => Number(y) === Number(value));
    if (idx >= 0 && idx !== targetIndex) {
      setTargetIndex(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    // Evita que la inercia residual al abrir dispare cambios en los primeros ms.
    wheelIgnoreUntilRef.current = Date.now() + 360;
    wheelDeltaAccumRef.current = 0;
    wheelLastStepAtRef.current = 0;

    const handleWheelNative = (event) => {
      event.preventDefault();

      const now = Date.now();
      if (now < wheelIgnoreUntilRef.current) return;

      // Normaliza delta según el modo del dispositivo para un comportamiento estable.
      const normalizedDelta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * wheelHeight
            : event.deltaY;

      // Filtra micro-jitter de touchpad para evitar temblor/saltos erraticos.
      if (event.deltaMode === 0 && Math.abs(normalizedDelta) < 8) return;

      wheelDeltaAccumRef.current += normalizedDelta;

      // Ajuste fino: menos sensible para evitar que salte muchos años.
      const threshold = 48;
      if (Math.abs(wheelDeltaAccumRef.current) < threshold) return;

      // Enfriamiento corto: evita múltiples pasos en un mismo "ataque" de eventos.
      const cooldownMs = 95;
      if (now - wheelLastStepAtRef.current < cooldownMs) return;

      const direction = wheelDeltaAccumRef.current > 0 ? 1 : -1;
      stepSelection(direction);
      wheelLastStepAtRef.current = now;

      // Reset estricto: cada tick efectivo mueve un solo año.
      wheelDeltaAccumRef.current = 0;

      if (wheelIdleResetTimerRef.current) clearTimeout(wheelIdleResetTimerRef.current);
      wheelIdleResetTimerRef.current = setTimeout(() => {
        wheelDeltaAccumRef.current = 0;
      }, 140);
    };

    node.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => node.removeEventListener('wheel', handleWheelNative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years.length, wheelResetToken]);

  useEffect(() => {
    return () => {
      wheelDeltaAccumRef.current = 0;
      wheelLastStepAtRef.current = 0;
      wheelIgnoreUntilRef.current = 0;
      if (wheelIdleResetTimerRef.current) clearTimeout(wheelIdleResetTimerRef.current);
    };
  }, []);

  return (
    <div
      className="relative rounded-xl border border-[#3D6DE0]/35 dark:border-[#4B67C0]/45 bg-white/70 dark:bg-slate-800/60 overflow-hidden transition-all duration-100"
      style={{
        height: `${wheelHeight}px`,
        perspective: '1000px',
        perspectiveOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 z-10 border-y-2 border-[#3D6DE0]/60 dark:border-[#6B86DE]/70 bg-gradient-to-r from-[#3D6DE0]/15 to-[#3D6DE0]/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),inset_0_-1px_0_0_rgba(255,255,255,0.25)]"
        style={{
          top: `${centerOffset * itemHeight}px`,
          height: `${itemHeight}px`,
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="relative h-full w-full flex items-center justify-center">
            {years[lowerFloatIndex] !== undefined && (
              <span
                className="absolute tracking-wide font-extrabold text-[#1F3274] dark:text-white text-lg drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] dark:drop-shadow-lg"
                style={getOverlayStyle(-centerProgress * itemHeight)}
              >
                {years[lowerFloatIndex]}
              </span>
            )}

            {upperFloatIndex !== lowerFloatIndex && years[upperFloatIndex] !== undefined && (
              <span
                className="absolute tracking-wide font-extrabold text-[#1F3274] dark:text-white text-lg drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] dark:drop-shadow-lg"
                style={getOverlayStyle((1 - centerProgress) * itemHeight)}
              >
                {years[upperFloatIndex]}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/70 via-white/30 to-transparent dark:from-slate-900/70 dark:via-slate-900/25 z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white/70 via-white/30 to-transparent dark:from-slate-900/70 dark:via-slate-900/25 z-10" />

      <div
        ref={viewportRef}
        className="relative select-none overflow-hidden cursor-default"
        style={{
          height: '100%',
          scrollSnapType: 'y mandatory',
          scrollSnapStop: 'always',
          touchAction: 'auto',
        }}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.repeat) return;
          const key = event.key.toLowerCase();
          if (key === 'w') {
            event.preventDefault();
            stepSelection(-1);
          } else if (key === 's') {
            event.preventDefault();
            stepSelection(1);
          } else if (key === 'enter') {
            event.preventDefault();
            const selectedYear = years[centeredIndex];
            if (selectedYear !== undefined) onConfirm?.(selectedYear);
          }
        }}
        onPointerDown={(event) => {
          event.currentTarget.focus();
        }}
      >
        <motion.div
          className="flex flex-col"
          initial={{ y: targetY + itemHeight * 2 }}
          animate={{ y: targetY }}
          transition={iosWheelTransition}
          style={{ willChange: 'transform' }}
          onUpdate={(latest) => {
            const y = typeof latest === 'number' ? latest : latest?.y;
            if (!Number.isFinite(y)) return;

            const floatDisplayIndex = centerOffset - y / itemHeight;
            const floatYearIndex = floatDisplayIndex - padSlots;
            const boundedFloat = Math.max(0, Math.min(years.length - 1, floatYearIndex));
            if (Math.abs(boundedFloat - centerFloatRef.current) > 0.005) {
              centerFloatRef.current = boundedFloat;
              setCenterFloatIndex(boundedFloat);
            }

            // Durante la intro solo animamos el overlay (entrada/salida), sin mover seleccion logica.
            if (isIntroAnimatingRef.current) return;

            const displayIndex = Math.round(centerOffset - y / itemHeight);
            const idx = clampIndex(displayIndex - padSlots);
            if (idx === centeredIndexRef.current) return;

            // Histeresis direccional: evita oscilacion de indice por rebote del spring.
            const current = centeredIndexRef.current;
            const directionToTarget = Math.sign(targetIndex - current);
            if (directionToTarget > 0 && idx <= current) return;
            if (directionToTarget < 0 && idx >= current) return;
            if (directionToTarget === 0) return;

            centeredIndexRef.current = idx;
            setCenteredIndex(idx);
          }}
          onAnimationComplete={() => {
            if (!isIntroAnimatingRef.current) return;
            isIntroAnimatingRef.current = false;
            setCenterFloatIndex(centeredIndexRef.current);
          }}
        >
          {displayYears.map((year, idx) => (
            <YearWheelItem
              key={year === null ? `spacer-${idx}` : year}
              year={year}
              distance={idx - visualDisplayIndex}
              itemHeight={itemHeight}
              onCenterClick={(clickedYear) => {
                if (idx === centeredDisplayIndex) onConfirm?.(clickedYear);
              }}
            />
          ))}
        </motion.div>
      </div>
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

  const clampYear = (year) => Math.max(minYear, Math.min(maxYear, year));
  const isValidYearInRange = (year) => Number.isFinite(year) && year >= minYear && year <= maxYear;
  const actualCurrentYear = clampYear(new Date().getFullYear());

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
          className={`w-full px-4 py-3 rounded-xl bg-white/80 dark:bg-slate-800/75 text-slate-800 dark:text-slate-100 text-left flex items-center justify-between hover:border-[#3D6DE0]/70 transition-all ${
            errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'border border-[#3D6DE0]/35 dark:border-[#4B67C0]/45'
          }`}
          title="Click para abrir ruleta. Doble click o click prolongado para escribir."
        >
          <span className="font-semibold">{draftYear}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Abrir selector</span>
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
          className={`w-full px-4 py-3 rounded-xl bg-white/85 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-center font-semibold focus:outline-none focus:ring-2 focus:ring-[#3D6DE0]/35 ${
            errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'border border-[#3D6DE0]/45 dark:border-[#4B67C0]/55'
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
            <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={commitDraftAndClose} />
            <motion.div
              className="relative w-full max-w-xs rounded-2xl border border-[#3D6DE0]/35 dark:border-[#5B75CD]/55 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden"
              initial={{ y: 14, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.99, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
            <div className="p-4">
              <VerticalYearWheelPicker
                key={`year-wheel-${pickerOpenToken}`}
                value={Number(draftYear || currentYear)}
                openInitialYear={pickerStartYear}
                onChange={(year) => setDraftYear(Number(year))}
                onSettled={(year) => onChange(Number(year))}
                onConfirm={commitDraftAndClose}
                wheelResetToken={pickerOpenToken}
                minYear={minYear}
                maxYear={maxYear}
                visibleCount={5}
                itemHeight={44}
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
                  className={`w-44 px-3 py-2 rounded-lg border bg-white/85 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-center text-sm font-semibold focus:outline-none focus:ring-2 transition-colors ${
                    popupHasError
                      ? 'border-red-500/90 dark:border-red-400/90 focus:ring-red-400/35'
                      : 'border-[#3D6DE0]/45 dark:border-[#4B67C0]/55 focus:ring-[#3D6DE0]/35'
                  } ${popupIsTyping ? 'animate-pulse' : ''}`}
                  placeholder="Escribir año"
                />
              </div>

              <p
                className={`mt-3 text-[11px] ${
                  popupHasError ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
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

const ChevronDown = ({ open = false }) => (
  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#263F8A]/10 dark:bg-[#263F8A]/25 ring-1 ring-[#263F8A]/35 dark:ring-[#263F8A]/45">
      <svg
        className={`w-3 h-3 text-[#263F8A] dark:text-[#8EA0D9] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  </div>
);

const CustomSelect = ({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  emptyText = 'Sin opciones disponibles',
  menuMaxHeight = 'max-h-56',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = options.find((opt) => opt.value?.toString() === value?.toString());

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handlePick = (newValue) => {
    onChange(newValue);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        className={`w-full text-left pl-3.5 pr-10 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-sm shadow-sm transition-all ${
          disabled
            ? 'border-slate-300/80 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
            : open
              ? 'border-[#263F8A] dark:border-[#3A56AF] ring-2 ring-[#263F8A]/35 dark:ring-[#3A56AF]/35 text-slate-900 dark:text-slate-100'
              : 'border-[#263F8A]/45 dark:border-[#3A56AF]/60 hover:border-[#263F8A]/75 dark:hover:border-[#4B67C0] text-slate-800 dark:text-slate-100'
        }`}
      >
        <span className="block truncate font-semibold">{selected ? selected.label : placeholder}</span>
        <ChevronDown open={open} />
      </button>

      {open && !disabled && (
        <div className={`absolute z-30 mt-1.5 w-full overflow-auto rounded-xl border border-[#263F8A]/40 dark:border-[#3A56AF]/60 bg-white dark:bg-slate-900 shadow-xl shadow-[#263F8A]/20 dark:shadow-black/35 ${menuMaxHeight}`}>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{emptyText}</div>
          ) : (
            options.map((opt) => {
              const active = opt.value?.toString() === value?.toString();
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePick(opt.value)}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors border-l-2 ${
                    active
                      ? 'bg-[#263F8A]/10 dark:bg-[#263F8A]/30 border-[#263F8A] dark:border-[#5C77CC] text-[#263F8A] dark:text-[#B6C3EC] font-semibold'
                      : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'
                  }`}
                  title={opt.label}
                >
                  <span className="block truncate">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
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
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {errorMessage && <span className="text-red-500">*</span>}</label>
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
        className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md ${
          errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'border-2 border-slate-300 dark:border-slate-600'
        }`}
        {...props}
      />
      {errorMessage && <p className={`text-xs text-red-600 dark:text-red-400 mt-1 ${motionClass}`}>{errorMessage}</p>}
    </div>
  );
};

const DatePickerField = ({ label, name, value, onDateChange, required, error, errorPulse = 0, minDate, invalidSelectionMessage, onInvalidSelection, showErrorText = true, onFieldInteraction, onClearError }) => {
  const [open, setOpen] = useState(false);
  const [openQuickPicker, setOpenQuickPicker] = useState(null);
  const [draftDay, setDraftDay] = useState(null);
  const [draftMonth, setDraftMonth] = useState(null);
  const [draftYear, setDraftYear] = useState(null);
  const [hasSelectedMonth, setHasSelectedMonth] = useState(false);
  const [hasSelectedYear, setHasSelectedYear] = useState(false);
  const containerRef = useRef(null);
  const yearMenuRef = useRef(null);
  const currentYearOptionRef = useRef(null);
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
  }, [value]);

  const selectedDate = parseIsoDate(value);
  const minAllowedDate = parseIsoDate(minDate);
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1)
  );

  useEffect(() => {
    if (open) {
      const base = selectedDate || today;
      setVisibleMonth(new Date(base.getFullYear(), base.getMonth(), 1));
      setDraftDay(null);
      setDraftMonth(base.getMonth());
      setDraftYear(base.getFullYear());
      setHasSelectedMonth(false);
      setHasSelectedYear(false);
    } else {
      setOpenQuickPicker(null);
      setDraftDay(null);
      setDraftMonth(null);
      setDraftYear(null);
      setHasSelectedMonth(false);
      setHasSelectedYear(false);
    }
  }, [open]);

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

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const currentYearRef = today.getFullYear();
  const startYear = currentYearRef - 25;
  const endYear = currentYearRef + 25;
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
    a
    && b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );

  const handlePickDate = (dateObj) => {
    if (minAllowedDate && dateObj < minAllowedDate) {
      if (invalidSelectionMessage) toast.error(invalidSelectionMessage);
      if (onInvalidSelection) onInvalidSelection();
      return;
    }

    const nextDay = dateObj.getDate();
    setDraftDay(nextDay);

    const monthCandidate = draftMonth ?? month;
    const yearCandidate = draftYear ?? year;
    const canCommit = Boolean(nextDay && hasSelectedMonth && hasSelectedYear && monthCandidate !== null && yearCandidate !== null);
    if (!canCommit) return;

    const maxDayForMonth = new Date(yearCandidate, monthCandidate + 1, 0).getDate();
    if (nextDay > maxDayForMonth) return;

    const finalDate = new Date(yearCandidate, monthCandidate, nextDay);
    const iso = toIsoDate(finalDate);
    onDateChange(name, iso, { skipRangeToast: true });
    setInputValue(formatDisplayDate(iso));
    setOpen(false);
  };

  const handleQuickPickMonth = (nextMonth) => {
    const yearCandidate = draftYear ?? year;
    setDraftMonth(nextMonth);
    setHasSelectedMonth(true);
    setVisibleMonth(new Date(yearCandidate, nextMonth, 1));
    setOpenQuickPicker(null);

    const dayCandidate = draftDay;
    if (!dayCandidate || !hasSelectedYear || yearCandidate === null) return;

    const maxDayForMonth = new Date(yearCandidate, nextMonth + 1, 0).getDate();
    if (dayCandidate > maxDayForMonth) {
      setDraftDay(null);
      return;
    }

    const finalDate = new Date(yearCandidate, nextMonth, dayCandidate);
    if (minAllowedDate && finalDate < minAllowedDate) {
      if (invalidSelectionMessage) toast.error(invalidSelectionMessage);
      if (onInvalidSelection) onInvalidSelection();
      return;
    }
    const iso = toIsoDate(finalDate);
    onDateChange(name, iso, { skipRangeToast: true });
    setInputValue(formatDisplayDate(iso));
    setOpen(false);
  };

  const handleQuickPickYear = (nextYear) => {
    const monthCandidate = draftMonth ?? month;
    setDraftYear(nextYear);
    setHasSelectedYear(true);
    setVisibleMonth(new Date(nextYear, monthCandidate, 1));
    setOpenQuickPicker(null);

    const dayCandidate = draftDay;
    if (!dayCandidate || !hasSelectedMonth || monthCandidate === null) return;

    const maxDayForMonth = new Date(nextYear, monthCandidate + 1, 0).getDate();
    if (dayCandidate > maxDayForMonth) {
      setDraftDay(null);
      return;
    }

    const finalDate = new Date(nextYear, monthCandidate, dayCandidate);
    if (minAllowedDate && finalDate < minAllowedDate) {
      if (invalidSelectionMessage) toast.error(invalidSelectionMessage);
      if (onInvalidSelection) onInvalidSelection();
      return;
    }
    const iso = toIsoDate(finalDate);
    onDateChange(name, iso, { skipRangeToast: true });
    setInputValue(formatDisplayDate(iso));
    setOpen(false);
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
      if (minAllowedDate && parsed < minAllowedDate) {
        if (invalidSelectionMessage) toast.error(invalidSelectionMessage);
        if (onInvalidSelection) onInvalidSelection();
        const previousDisplay = formatDisplayDate(value);
        setInputValue(previousDisplay);
        return;
      }

      const iso = toIsoDate(parsed);
      onDateChange(name, iso, { skipRangeToast: true });
      setInputValue(formatDisplayDate(iso));
      setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      return;
    }

    onDateChange(name, '');
    setInputValue('');
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {errorMessage && <span className="text-red-500">*</span>}</label>
      <div className={`relative w-full rounded-xl bg-slate-50 dark:bg-slate-700 shadow-sm ${
        errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'border-2 border-slate-300 dark:border-slate-600'
      } focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent`}>
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
          className="w-full bg-transparent text-slate-800 dark:text-white px-4 py-2.5 pr-12 rounded-xl focus:outline-none"
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
          className="absolute right-1.5 top-1/2 h-8 w-8 rounded-lg border border-[#3A56AF]/40 bg-[#2C4AAE] text-slate-100 hover:bg-[#233C8F] transition-colors"
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
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}
              className="h-7 w-7 rounded-lg text-slate-100 hover:bg-white/15"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <p className="text-xs font-semibold text-slate-100">
              {monthNames[month]} {year}
            </p>
            <button
              type="button"
              onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
              className="h-7 w-7 rounded-lg text-slate-100 hover:bg-white/15"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenQuickPicker((prev) => (prev === 'month' ? null : 'month'));
                }}
                className={`w-full h-8 text-left pl-2.5 pr-8 rounded-xl border bg-white dark:bg-slate-800 text-xs shadow-sm ${
                  openQuickPicker === 'month'
                    ? 'border-cyan-500/80 dark:border-cyan-500 ring-2 ring-cyan-400/40 dark:ring-cyan-500/35 text-slate-900 dark:text-slate-100'
                    : 'border-cyan-300/70 dark:border-cyan-700/80 hover:border-cyan-500/70 dark:hover:border-cyan-500/80 text-slate-800 dark:text-slate-100'
                }`}
                aria-label="Seleccionar mes"
              >
                <span className="block truncate font-semibold">{hasSelectedMonth && draftMonth !== null ? monthNames[draftMonth] : 'Seleccione'}</span>
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-cyan-50 dark:bg-cyan-900/30 ring-1 ring-cyan-200/70 dark:ring-cyan-700/70">
                    <svg
                      className={`w-2.5 h-2.5 text-cyan-700 dark:text-cyan-300 transition-transform duration-200 ${openQuickPicker === 'month' ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </span>
              </button>

              {openQuickPicker === 'month' && (
                <div
                  className="absolute z-40 mt-1.5 w-full max-h-40 overflow-auto rounded-xl border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 shadow-xl shadow-cyan-900/15 dark:shadow-black/35"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {monthOptions.map((opt) => {
                    const active = hasSelectedMonth && draftMonth !== null && opt.value === draftMonth;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickPickMonth(opt.value);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs border-l-2 ${
                          active
                            ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500 text-cyan-800 dark:text-cyan-200 font-semibold'
                            : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'
                        }`}
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
                className={`w-full h-8 text-left pl-2.5 pr-8 rounded-xl border bg-white dark:bg-slate-800 text-xs shadow-sm ${
                  openQuickPicker === 'year'
                    ? 'border-cyan-500/80 dark:border-cyan-500 ring-2 ring-cyan-400/40 dark:ring-cyan-500/35 text-slate-900 dark:text-slate-100'
                    : 'border-cyan-300/70 dark:border-cyan-700/80 hover:border-cyan-500/70 dark:hover:border-cyan-500/80 text-slate-800 dark:text-slate-100'
                }`}
                aria-label="Seleccionar año"
              >
                <span className="block truncate font-semibold">{hasSelectedYear && draftYear !== null ? draftYear : 'Seleccione'}</span>
                <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-cyan-50 dark:bg-cyan-900/30 ring-1 ring-cyan-200/70 dark:ring-cyan-700/70">
                    <svg
                      className={`w-2.5 h-2.5 text-cyan-700 dark:text-cyan-300 transition-transform duration-200 ${openQuickPicker === 'year' ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </span>
              </button>

              {openQuickPicker === 'year' && (
                <div
                  ref={yearMenuRef}
                  className="absolute z-40 mt-1.5 w-full max-h-40 overflow-auto rounded-xl border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 shadow-xl shadow-cyan-900/15 dark:shadow-black/35"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
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
                          handleQuickPickYear(y);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs border-l-2 ${
                          active
                            ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500 text-cyan-800 dark:text-cyan-200 font-semibold'
                            : isCurrentSystemYear
                              ? 'bg-blue-50 dark:bg-blue-900/25 border-blue-400 text-blue-800 dark:text-blue-200 font-semibold hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'
                              : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="block truncate">{y}</span>
                          {isCurrentSystemYear && !active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200/80 dark:bg-blue-800/50 text-blue-900 dark:text-blue-100">
                              Actual
                            </span>
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
              <div key={wd} className="text-center text-[10px] font-semibold text-slate-200/85 py-0.5">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {calendarCells.map((cellDate, idx) => {
              if (!cellDate) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }

              const isToday = isSameDate(cellDate, today);
              const isSelected = draftDay !== null && cellDate.getDate() === draftDay;
              const isDisabledByMinDate = Boolean(minAllowedDate && cellDate < minAllowedDate);

              return (
                <button
                  key={toIsoDate(cellDate)}
                  type="button"
                  onClick={() => handlePickDate(cellDate)}
                  className={`h-8 rounded-lg text-xs ${
                    isSelected
                      ? 'bg-[#4654E8] text-white font-semibold'
                      : isDisabledByMinDate
                        ? 'text-slate-300/50 cursor-not-allowed'
                        : 'text-slate-100 hover:bg-white/15'
                  } ${isToday && !isSelected ? 'border border-white/55' : 'border border-transparent'}`}
                >
                  {cellDate.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {errorMessage && showErrorText && <p className={`text-xs text-red-600 dark:text-red-400 mt-1 ${motionClass}`}>{errorMessage}</p>}
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
    planificaciones: 0,
    informes: 0,
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
  const usuarioActual = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);
  const esSuperAdmin = usuarioActual?.is_superuser === true;
  const hayUnaSolaCarrera = carreras.length === 1;
  const carreraOptions = carreras.map((carrera) => ({
    value: String(carrera.id),
    label: carrera.nombre,
  }));
  const calendariosFiltrados = esSuperAdmin && carreraFiltro && carreraFiltro !== 'todas'
    ? calendarios.filter((cal) => String(cal.carrera) === String(carreraFiltro))
    : calendarios;

  const currentYear = new Date().getFullYear();

  const buildInitialFormData = () => ({
    carrera: hayUnaSolaCarrera ? carreras[0].id : '',
    gestion: new Date().getFullYear(),
    periodo: '1',
    fecha_inicio: '',
    fecha_fin: '',
    fecha_inicio_presentacion_proyectos: '',
    fecha_limite_presentacion_proyectos: '',
    fecha_limite_programas_analiticos: '',
    fecha_inicio_receso: '',
    fecha_fin_receso: '',
    semanas_efectivas: '',
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

  const sortCalendarios = (items) => (
    [...items].sort((a, b) => b.gestion - a.gestion || b.periodo.localeCompare(a.periodo))
  );

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

  const isDateRangeInvalid = Boolean(
    fechaInicioDate
    && fechaFinDate
    && fechaFinDate.getTime() < fechaInicioDate.getTime()
  );
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
  const semanasEfectivasCalculadas = semanasCalendario === null
    ? ''
    : String(semanasCalendario <= 18 ? 16 : semanasCalendario - 2);
  const semanasEfectivasValue = Number(formData.semanas_efectivas);
  const semanasEfectivasExcedenCalendario = Boolean(
    semanasCalendario !== null
    && Number.isFinite(semanasEfectivasValue)
    && semanasEfectivasValue > semanasCalendario
  );
  const semanasEfectivasErrorMessage = 'Las semanas efectivas no pueden exceder las semanas calendario del periodo.';
  const isFormReady = Boolean(
    formData.carrera
    && formData.gestion
    && formData.periodo
    && formData.fecha_inicio
    && formData.fecha_fin
    && formData.fecha_inicio_presentacion_proyectos
    && formData.fecha_limite_presentacion_proyectos
    && formData.semanas_efectivas !== ''
    && formData.semanas_efectivas !== null
    && formData.semanas_efectivas !== undefined
    && !isDateRangeInvalid
    && !semanasEfectivasExcedenCalendario
    && !isProjectRangeInvalid
    && !isProjectOrderInvalid
  );
  const isSaveBlocked = Boolean(isSubmitting);

  useEffect(() => {
    setFormData((prev) => {
      if (prev.semanas_efectivas === semanasEfectivasCalculadas) return prev;
      return { ...prev, semanas_efectivas: semanasEfectivasCalculadas };
    });
  }, [semanasEfectivasCalculadas]);

  useEffect(() => {
    cargarCalendarios();
  }, []);

  const cargarCalendarios = async () => {
    setLoading(true);
    try {
      const [calendariosRes, carrerasRes] = await Promise.all([
        api.get('/calendarios/'),
        api.get('/carreras/'),
      ]);
      const data = calendariosRes.data.results || calendariosRes.data;
      const carrerasData = carrerasRes.data.results || carrerasRes.data;
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
      semanas_efectivas: calendario.semanas_efectivas,
      activo: calendario.activo,
    } : buildInitialFormData());
    setErrors({});
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    clearFieldError(name);
    const nextValue = name === 'semanas_efectivas' && value !== ''
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
    if (name === 'fecha_inicio' || name === 'fecha_fin') {
      clearFieldError('semanas_efectivas');
    }
    const { skipRangeToast = false } = options;
    const normalized = isoDate
      ? (() => {
          const parsed = parseDateValue(isoDate);
          return parsed ? toIsoString(parsed) : '';
        })()
      : '';
    let accepted = true;

    setFormData((prev) => {
      if (
        name === 'fecha_fin'
        && normalized
        && prev.fecha_inicio
      ) {
        const nextEnd = parseDateValue(normalized);
        const currentStart = parseDateValue(prev.fecha_inicio);
        if (nextEnd && currentStart && nextEnd.getTime() < currentStart.getTime()) {
          accepted = false;
          return prev;
        }
      }

      return {
        ...prev,
        [name]: normalized,
      };
    });

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

  const notifyProjectRangeIfInvalid = (fieldName) => {
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

    const requiredErrors = {};
    if (!formData.carrera) requiredErrors.carrera = 'Este campo es obligatorio.';
    if (!formData.gestion) requiredErrors.gestion = 'Este campo es obligatorio.';
    if (!formData.periodo) requiredErrors.periodo = 'Este campo es obligatorio.';
    if (!formData.fecha_inicio) requiredErrors.fecha_inicio = 'Este campo es obligatorio.';
    if (!formData.fecha_fin) requiredErrors.fecha_fin = 'Este campo es obligatorio.';
    if (!formData.fecha_inicio_presentacion_proyectos) requiredErrors.fecha_inicio_presentacion_proyectos = 'Este campo es obligatorio.';
    if (!formData.fecha_limite_presentacion_proyectos) requiredErrors.fecha_limite_presentacion_proyectos = 'Este campo es obligatorio.';
    if (
      formData.semanas_efectivas === ''
      || formData.semanas_efectivas === null
      || formData.semanas_efectivas === undefined
    ) {
      requiredErrors.semanas_efectivas = 'Este campo es obligatorio.';
    }

    if (Object.keys(requiredErrors).length > 0) {
      applyErrors(requiredErrors);
      toast.error('Completa los campos obligatorios.');
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

    if (semanasEfectivasExcedenCalendario) {
      applyErrors({
        ...errors,
        semanas_efectivas: semanasEfectivasErrorMessage,
      });
      toast.error(semanasEfectivasErrorMessage);
      return;
    }

    if (isProjectRangeInvalid) {
      toast.error(projectRangeWarning);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    
    const payload = {
      ...formData,
      carrera: Number(formData.carrera),
      gestion: parseInt(formData.gestion),
      semanas_efectivas: parseInt(formData.semanas_efectivas),
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

    try {
      if (calendarioSeleccionado) {
        const response = await api.put(`/calendarios/${calendarioSeleccionado.id}/`, payload);
        if (response.data?.id) {
          setCalendarios((prev) => prev.map((calendario) => (
            calendario.id === response.data.id ? response.data : calendario
          )));
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
      planificaciones: impactData?.planificaciones || 0,
      informes: impactData?.informes || 0,
      cargas_horarias: impactData?.cargas_horarias || 0,
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
      planificaciones: 0,
      informes: 0,
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
          planificaciones: deps.planificaciones || 0,
          informes: deps.informes || 0,
          cargas_horarias: deps.cargas_horarias || 0,
          failed: false,
          detail: '',
        });
        setShowDeleteModal(true);
        return;
      }

      openDependencyWarning(
        calendario,
        deps,
        `ERROR DE INTEGRIDAD: No se puede eliminar el calendario ${calendario.gestion}-${calendario.periodo_display} porque aún tiene ${deps.planificaciones || 0} planificaciones y ${deps.informes || 0} informes vinculados.`
      );
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
    return <div className="p-6 text-center">Cargando calendarios...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                🗓️ Calendarios Académicos
              </h1>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                Gestión de periodos, gestiones y fechas importantes.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              {esSuperAdmin && (
                <div className="w-full sm:flex-1">
                  <SelectConDropdown
                    name="carrera"
                    value={carreraFiltro}
                    onChange={(event) => setCarreraFiltro(event.target.value)}
                    options={[{ value: 'todas', label: 'Todas las carreras' }, ...carreraOptions]}
                    placeholder="Buscar carrera..."
                    emptyText="No hay carreras"
                    hideSelectedOption
                  />
                </div>
              )}
            <button
              onClick={() => abrirModal()}
              className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2"
            >
              <span>➕</span>
              Nuevo Calendario
            </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {calendariosFiltrados.map((cal) => (
            <div key={cal.id} className={`rounded-2xl border backdrop-blur-sm shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${cal.activo ? 'bg-white/90 dark:bg-slate-800/85 border-green-400/70 dark:border-green-500/70 ring-2 ring-green-400/30' : 'bg-white/80 dark:bg-slate-800/75 border-slate-300/80 dark:border-slate-700/70 hover:border-[#3D6DE0]/45'}`}>
              <div className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold shadow-md text-xl flex-shrink-0 ${cal.activo ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                      {cal.gestion}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-blue-600 dark:text-white">
                          Gestión {cal.gestion} - {cal.periodo_display}
                        </h3>
                        {cal.activo && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-emerald-500 text-white shadow-md shadow-emerald-500/40">
                            Activo
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {cal.carrera_nombre || 'Sin carrera'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-600 dark:text-slate-400">
                        <span>🗓️ {new Date(cal.fecha_inicio).toLocaleDateString()} - {new Date(cal.fecha_fin).toLocaleDateString()}</span>
                        <span>|</span>
                        <span>📦 Límite Presentación: {new Date(cal.fecha_limite_presentacion_proyectos).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#263F8A]/10 dark:bg-[#263F8A]/25 border-2 border-[#263F8A]/40 dark:border-[#3A56AF]/55">
                      <ToggleSwitch
                        isActive={cal.activo}
                        onChange={() => handleToggleActivo(cal)}
                      />
                      <span className="text-sm font-semibold">
                        {cal.activo
                          ? <span className="text-emerald-600 dark:text-emerald-400">Activo</span>
                          : <span className="text-amber-600 dark:text-amber-400">Inactivo</span>
                        }
                      </span>
                    </div>
                    <button
                      onClick={() => abrirModal(cal)}
                      className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-200 hover:scale-110"
                      title="Editar"
                    >
                      <FaEdit size={18} />
                    </button>
                    <button
                      onClick={() => eliminarCalendario(cal)}
                      className="text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 transition-all duration-200 hover:scale-110"
                      title="Eliminar"
                    >
                      <FaTrash size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" style={{ animationDuration: '160ms' }}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-3xl w-full max-h-[98vh] md:max-h-[95vh] overflow-visible animate-slide-up" style={{ animationDuration: '180ms' }}>
            <div className="px-6 py-4 border-b border-[#7F97E8]/45 bg-[#2C4AAE] rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                {calendarioSeleccionado ? '✏️ Editar Calendario' : '➕ Nuevo Calendario'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} noValidate className="p-5 md:p-6">
              {isEditingActiveCalendar && (
                <div className="mb-4 rounded-xl border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-900 dark:text-red-200">
                  {activeCalendarEditWarning}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                <div className="md:col-span-2">
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
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Gestión (Año)</label>
                  <YearPickerField
                    value={Number(formData.gestion || currentYear)}
                    onChange={handleGestionChange}
                    currentYear={currentYear}
                    error={errors.gestion}
                    errorPulse={errorPulse}
                    onClearError={() => clearFieldError('gestion')}
                  />
                  {errors.gestion && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{getErrorMessage(errors.gestion)}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Periodo</label>
                  <SegmentedOptions
                    options={periodoOptions}
                    value={formData.periodo}
                    onChange={handlePeriodoChange}
                    className="grid-cols-3"
                    error={errors.periodo}
                    errorPulse={errorPulse}
                    onClearError={() => clearFieldError('periodo')}
                  />
                  {errors.periodo && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{getErrorMessage(errors.periodo)}</p>}
                </div>

                <div className="md:col-span-2 rounded-xl border border-[#3D6DE0]/30 dark:border-[#4B67C0]/40 bg-gradient-to-r from-white/60 via-[#3D6DE0]/5 to-cyan-400/10 dark:from-slate-800/55 dark:to-cyan-900/20 p-4 shadow-sm hover:shadow-md transition-all duration-200">
                  <h4 className="text-sm font-bold text-[#263F8A] dark:text-[#B6C3EC] mb-3">Rango del Periodo Académico</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {isDateRangeInvalid && (
                  <div className="md:col-span-2 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                    {endDateErrorMessage}
                  </div>
                )}

                {isCriticalProjectRangeConflict && (
                  <div className="md:col-span-2 rounded-lg border border-red-600/60 bg-red-100 dark:bg-red-900/25 px-3 py-2 text-sm font-semibold text-red-800 dark:text-red-300">
                    {criticalProjectRangeMessage}
                  </div>
                )}

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
                <DatePickerField
                  label="Fecha limite programas analiticos"
                  name="fecha_limite_programas_analiticos"
                  value={formData.fecha_limite_programas_analiticos}
                  onDateChange={handleDateFieldChange}
                  error={errors.fecha_limite_programas_analiticos}
                  errorPulse={errorPulse}
                  onClearError={() => clearFieldError('fecha_limite_programas_analiticos')}
                />
                <DatePickerField
                  label="Inicio receso academico"
                  name="fecha_inicio_receso"
                  value={formData.fecha_inicio_receso}
                  onDateChange={handleDateFieldChange}
                  error={errors.fecha_inicio_receso}
                  errorPulse={errorPulse}
                  onClearError={() => clearFieldError('fecha_inicio_receso')}
                />
                <DatePickerField
                  label="Fin receso academico"
                  name="fecha_fin_receso"
                  value={formData.fecha_fin_receso}
                  onDateChange={handleDateFieldChange}
                  error={errors.fecha_fin_receso}
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
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Total de semanas del periodo (calculado)
                  </p>
                </div>
                <div>
                  <InputField
                    label="Semanas Efectivas"
                    name="semanas_efectivas"
                    type="number"
                    step="1"
                    value={formData.semanas_efectivas}
                    onChange={handleChange}
                    required
                    error={errors.semanas_efectivas || (semanasEfectivasExcedenCalendario ? semanasEfectivasErrorMessage : '')}
                    errorPulse={errorPulse}
                    onClearError={() => clearFieldError('semanas_efectivas')}
                    readOnly
                  />
                  {!errors.semanas_efectivas && !semanasEfectivasExcedenCalendario && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      Semanas efectivas calculadas automaticamente desde el rango de fechas
                    </p>
                  )}
                </div>
                <div className="mt-1 bg-white/70 dark:bg-slate-800/60 rounded-xl p-3 border border-[#3D6DE0]/25 dark:border-[#4B67C0]/40 md:self-end">
                  <div className="flex items-center gap-3">
                    <ToggleSwitch
                      isActive={Boolean(formData.activo)}
                      onChange={handleActivoSwitchChange}
                    />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-300">
                      ✅ Calendario activo
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t-2 border-slate-300 dark:border-slate-700 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-all duration-200 border-2 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow-md hover:scale-105"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaveBlocked}
                  className={`px-5 py-2.5 text-white rounded-xl font-semibold transition-all duration-200 shadow-md disabled:opacity-100 disabled:hover:scale-100 ${isSaveBlocked ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-xl hover:-translate-y-0.5 animate-pulse'}`}
                >
                  {isSubmitting ? 'Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showToggleModal && calendarioToToggle && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => setShowToggleModal(false)} />
          <div
            className={`relative w-full max-w-lg rounded-2xl border bg-slate-900 shadow-2xl overflow-hidden animate-slide-up ${
              calendarioToToggle.activo
                ? 'border-uab-gold-300/40 dark:border-uab-gold-700/50'
                : 'border-uab-green-300/40 dark:border-uab-green-700/50'
            }`}
            style={{ animationDuration: '160ms' }}
          >
            <div className={`px-5 py-4 border-b border-slate-700/70 bg-gradient-to-r ${calendarioToToggle.activo ? 'from-uab-gold-900/30 to-slate-900' : 'from-uab-green-900/30 to-slate-900'}`}>
              <h4 className={`text-lg font-bold flex items-center gap-2 ${calendarioToToggle.activo ? 'text-uab-gold-300' : 'text-uab-green-300'}`}>
                {calendarioToToggle.activo ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                {calendarioToToggle.activo ? 'Confirmar Desactivación' : 'Confirmar Activación'}
              </h4>
            </div>
            <div className="px-5 py-4 space-y-3 text-slate-200">
              <p className="text-sm leading-relaxed">
                {calendarioToToggle.activo
                  ? `Se desactivará el calendario ${calendarioToToggle.gestion} - ${calendarioToToggle.periodo_display}.`
                  : `Se activará el calendario ${calendarioToToggle.gestion} - ${calendarioToToggle.periodo_display}.`}
              </p>
              <div className={`rounded-lg border px-3 py-2 text-sm ${calendarioToToggle.activo ? 'border-uab-gold-500/40 bg-uab-gold-500/10' : 'border-uab-green-500/40 bg-uab-green-500/10'}`}>
                Calendario: <strong className={calendarioToToggle.activo ? 'text-uab-gold-300' : 'text-uab-green-300'}>{calendarioToToggle.gestion} - {calendarioToToggle.periodo_display}</strong>
              </div>
              {calendarioToToggle.activo && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  Advertencia: si desactiva el calendario activo, algunos procesos pueden quedarse sin periodo vigente (registro, seguimiento y reportes hasta activar otro calendario).
                </div>
              )}
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
                onClick={confirmarToggleActivo}
                className={`px-4 py-2 rounded-lg font-bold text-white ${calendarioToToggle.activo ? 'bg-uab-gold-600 hover:bg-uab-gold-700' : 'bg-uab-green-600 hover:bg-uab-green-700'}`}
              >
                {calendarioToToggle.activo ? '⏸️ Confirmar Desactivación' : '▶️ Confirmar Activación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
                Se eliminará el calendario <strong className="text-slate-900 dark:text-white">{calendarioToDelete?.gestion} - {calendarioToDelete?.periodo_display}</strong> del sistema de forma permanente.
              </p>
              <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
                Acción irreversible: <strong className="text-red-900 dark:text-red-300">se perderá el periodo y sus fechas de referencia para este calendario.</strong>
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-amber-100 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                Dependencias actuales: {deleteImpact.planificaciones} planificaciones, {deleteImpact.informes} informes, {deleteImpact.cargas_horarias} cargas horarias.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Escribe el nombre exacto del calendario para habilitar la eliminación:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Escribe el nombre del calendario para confirmar"
                  className="w-full px-3 py-2 rounded-lg border border-red-400/40 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Esta operación no se puede deshacer.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700/70 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/70">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminar}
                disabled={deleteConfirmText !== `${calendarioToDelete?.gestion || ''} - ${calendarioToDelete?.periodo_display || ''}`}
                className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:bg-red-900/40 disabled:text-slate-300 disabled:cursor-not-allowed"
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDependencyWarningModal && calendarioToDelete && (
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
                {deleteImpact.detail || `ERROR DE INTEGRIDAD: No se puede eliminar el calendario ${calendarioToDelete.gestion}-${calendarioToDelete.periodo_display} porque aún tiene dependencias vinculadas.`}
              </p>
              <div className="rounded-lg border border-red-700/70 bg-red-200/70 dark:bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-100">
                Dependencias detectadas: {deleteImpact.planificaciones} planificaciones, {deleteImpact.informes} informes, {deleteImpact.cargas_horarias} cargas horarias.
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-amber-100 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                Para eliminar este calendario, primero debes mover o eliminar manualmente sus registros asociados.
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
    </div>
  );
}

export default ListaCalendarios;
