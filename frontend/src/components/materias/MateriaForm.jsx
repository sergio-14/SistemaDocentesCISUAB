import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../apis/api';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ERROR_FIELD_BORDER_CLASS,
  getBackendErrorMessage,
  getErrorMessage,
  sanitizeApiErrors,
  useErrorPulse,
} from '../../utils/formErrors';

// Componente selector de semestre (1-10) con ruleta vertical
const SemesterPicker = ({ value, onChange, error, onClearError, errorPulse = 0 }) => {
  const [open, setOpen] = useState(false);
  const [draftSemester, setDraftSemester] = useState(Number(value || 1));
  const [pickerOpenToken, setPickerOpenToken] = useState(0);
  const { motionClass } = useErrorPulse(error, errorPulse);
  const errorMessage = getErrorMessage(error);

  const minSemester = 1;
  const maxSemester = 10;

  const clampSemester = (sem) => Math.max(minSemester, Math.min(maxSemester, sem));

  useEffect(() => {
    if (!open) {
      setDraftSemester(Number(value || 1));
    }
  }, [value, open]);

  const commitDraftAndClose = () => {
    onChange({ target: { name: 'semestre', value: clampSemester(Number(draftSemester || 1)) } });
    setOpen(false);
  };

  const openSemesterSelector = () => {
    onClearError?.();
    setDraftSemester(Number(value || 1));
    setPickerOpenToken((prev) => prev + 1);
    setOpen(true);
  };

  return (
    <>
      <div>
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
          Semestre <span className="text-red-500">*</span>
        </label>
        
        <button
          type="button"
          onClick={openSemesterSelector}
          aria-invalid={Boolean(errorMessage)}
          className={`w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-left flex items-center justify-between transition-all ${
            errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'border-2 border-slate-300 dark:border-slate-600 hover:border-[#3D6DE0]/70'
          }`}
        >
          <span className="font-semibold">{draftSemester || 'Seleccione...'}</span>
        </button>
        {errorMessage && <p className={`text-xs text-red-600 dark:text-red-400 mt-1 ${motionClass}`}>{errorMessage}</p>}
      </div>

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
              className="relative w-full max-w-xs rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden border border-[#7F97E8]/45"
              initial={{ y: 14, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.99, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <div className="p-4">
                <VerticalSemesterWheelPicker
                  key={`semester-wheel-${pickerOpenToken}`}
                  value={Number(draftSemester || 1)}
                  onChange={(sem) => setDraftSemester(Number(sem))}
                  onSettled={(sem) => onChange({ target: { name: 'semestre', value: Number(sem) } })}
                  onConfirm={commitDraftAndClose}
                  wheelResetToken={pickerOpenToken}
                  minSemester={minSemester}
                  maxSemester={maxSemester}
                  visibleCount={5}
                  itemHeight={44}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Ruleta vertical para semestres (similar a VerticalYearWheelPicker del calendario)
const VerticalSemesterWheelPicker = ({ 
  value, 
  onChange, 
  onSettled, 
  onConfirm,
  wheelResetToken,
  minSemester = 1, 
  maxSemester = 10, 
  visibleCount = 5, 
  itemHeight = 52 // Igual que el selector de año
}) => {
  const iosWheelTransition = {
    type: 'spring',
    stiffness: 240,
    damping: 30,
    mass: 0.9,
    restDelta: 0.2,
    restSpeed: 0.2,
  };

  const getIndexFromSemester = (semValue) => {
    const numeric = Number(semValue);
    const fallbackSemester = Math.round((minSemester + maxSemester) / 2);
    const safeSemester = Number.isFinite(numeric) ? numeric : fallbackSemester;
    const clampedSemester = Math.max(minSemester, Math.min(maxSemester, safeSemester));
    return clampedSemester - minSemester;
  };

  const initialIndex = getIndexFromSemester(value ?? minSemester);

  const viewportRef = useRef(null);
  const padSlots = 3;
  const [targetIndex, setTargetIndex] = useState(initialIndex);
  const [centeredIndex, setCenteredIndex] = useState(initialIndex);
  const [centerFloatIndex, setCenterFloatIndex] = useState(initialIndex);
  const centeredIndexRef = useRef(initialIndex);
  const centerFloatRef = useRef(initialIndex);
  const isIntroAnimatingRef = useRef(true);
  const lastInternalSemesterRef = useRef(null);
  const wheelDeltaAccumRef = useRef(0);
  const wheelLastStepAtRef = useRef(0);
  const wheelIdleResetTimerRef = useRef(null);
  const wheelIgnoreUntilRef = useRef(0);

  const semesters = useMemo(() => {
    const list = [];
    for (let s = minSemester; s <= maxSemester; s += 1) list.push(s);
    return list;
  }, [minSemester, maxSemester]);

  const clampIndex = (idx) => Math.max(0, Math.min(semesters.length - 1, idx));
  const wheelHeight = visibleCount * itemHeight;
  const centerOffset = Math.floor(visibleCount / 2);

  const displaySemesters = useMemo(() => {
    const top = new Array(padSlots).fill(null);
    const bottom = new Array(padSlots).fill(null);
    return [...top, ...semesters, ...bottom];
  }, [semesters]);

  const targetDisplayIndex = targetIndex + padSlots;
  const targetY = (centerOffset - targetDisplayIndex) * itemHeight;
  const clampedFloatIndex = Math.max(0, Math.min(semesters.length - 1, centerFloatIndex));
  const visualDisplayIndex = clampedFloatIndex + padSlots;
  const centeredDisplayIndex = centeredIndex + padSlots;
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

  const stepSelection = (steps) => {
    if (!semesters.length || steps === 0) return;
    setTargetIndex((prev) => {
      const min = 0;
      const max = semesters.length - 1;
      let next = prev + steps;
      if (next < min) next = min;
      if (next > max) next = max;
      return next;
    });
  };

  useEffect(() => {
    if (!semesters.length) return;
    
    // Solo sincronizar al abrir el modal (wheelResetToken > 0)
    if (wheelResetToken === 0) return;
    
    const sourceSemester = Number.isFinite(Number(value)) ? value : minSemester;
    const idx = semesters.findIndex((s) => Number(s) === Number(sourceSemester));
    const syncIndex = idx >= 0 ? idx : Math.floor(semesters.length / 2);
    const syncSemester = semesters[syncIndex];

    // Evitar sincronización si ya estamos en el mismo semestre (previene rebote)
    setTargetIndex(syncIndex);
    setCenteredIndex(syncIndex);
    setCenterFloatIndex(syncIndex);
    centeredIndexRef.current = syncIndex;
    centerFloatRef.current = syncIndex;
    isIntroAnimatingRef.current = true;
    if (syncSemester !== undefined) {
      lastInternalSemesterRef.current = Number(syncSemester);
    }
  }, [wheelResetToken, semesters.length]);

  useEffect(() => {
    if (centeredIndex !== targetIndex) return;

    const selectedSemester = semesters[centeredIndex];
    if (selectedSemester === undefined) return;

    if (Number(selectedSemester) === lastInternalSemesterRef.current) return;
    lastInternalSemesterRef.current = Number(selectedSemester);
    onChange(selectedSemester);
    onSettled?.(selectedSemester);
  }, [centeredIndex, targetIndex, semesters]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    wheelIgnoreUntilRef.current = Date.now() + 360;
    wheelDeltaAccumRef.current = 0;
    wheelLastStepAtRef.current = 0;

    const handleWheelNative = (event) => {
      event.preventDefault();

      const now = Date.now();
      if (now < wheelIgnoreUntilRef.current) return;

      const normalizedDelta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * wheelHeight
            : event.deltaY;

      if (event.deltaMode === 0 && Math.abs(normalizedDelta) < 8) return;

      wheelDeltaAccumRef.current += normalizedDelta;

      const threshold = 48;
      if (Math.abs(wheelDeltaAccumRef.current) < threshold) return;

      const cooldownMs = 95;
      if (now - wheelLastStepAtRef.current < cooldownMs) return;

      const direction = wheelDeltaAccumRef.current > 0 ? 1 : -1;
      stepSelection(direction);
      wheelLastStepAtRef.current = now;
      wheelDeltaAccumRef.current = 0;

      if (wheelIdleResetTimerRef.current) clearTimeout(wheelIdleResetTimerRef.current);
      wheelIdleResetTimerRef.current = setTimeout(() => {
        wheelDeltaAccumRef.current = 0;
      }, 140);
    };

    node.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => node.removeEventListener('wheel', handleWheelNative);
  }, [semesters.length, wheelResetToken]);

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
      {/* Franja central de selección */}
      <div
        className="pointer-events-none absolute inset-x-0 z-10 border-y-2 border-[#3D6DE0]/60 dark:border-[#6B86DE]/70 bg-gradient-to-r from-[#3D6DE0]/15 to-[#3D6DE0]/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),inset_0_-1px_0_0_rgba(255,255,255,0.25)]"
        style={{
          top: `${centerOffset * itemHeight}px`,
          height: `${itemHeight}px`,
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="relative h-full w-full flex items-center justify-center">
            {semesters[lowerFloatIndex] !== undefined && (
              <span
                className="absolute tracking-wide font-extrabold text-[#1F3274] dark:text-white text-base drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] dark:drop-shadow-lg"
                style={getOverlayStyle(-centerProgress * itemHeight)}
              >
                {semesters[lowerFloatIndex]}° Semestre
              </span>
            )}

            {upperFloatIndex !== lowerFloatIndex && semesters[upperFloatIndex] !== undefined && (
              <span
                className="absolute tracking-wide font-extrabold text-[#1F3274] dark:text-white text-base drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] dark:drop-shadow-lg"
                style={getOverlayStyle((1 - centerProgress) * itemHeight)}
              >
                {semesters[upperFloatIndex]}° Semestre
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Gradientes superior e inferior */}
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
            const selectedSemester = semesters[centeredIndex];
            if (selectedSemester !== undefined) onConfirm?.(selectedSemester);
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
            const floatIndex = floatDisplayIndex - padSlots;
            const boundedFloat = Math.max(0, Math.min(semesters.length - 1, floatIndex));
            if (Math.abs(boundedFloat - centerFloatRef.current) > 0.005) {
              centerFloatRef.current = boundedFloat;
              setCenterFloatIndex(boundedFloat);
            }

            if (isIntroAnimatingRef.current) return;

            const displayIndex = Math.round(centerOffset - y / itemHeight);
            const idx = clampIndex(displayIndex - padSlots);
            if (idx === centeredIndexRef.current) return;

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
          {displaySemesters.map((sem, idx) => {
            const isTopBottomPlaceholder = sem === null;
            const distance = idx - visualDisplayIndex;
            const clamped = Math.max(-4, Math.min(4, distance));
            const abs = Math.abs(clamped);
            const curvedDistance = Math.sign(clamped) * Math.pow(abs, 1.08);
            const rotationX = Math.max(-62, Math.min(62, curvedDistance * 16));
            const stepScale = abs < 0.35 ? 1 : 0.97;
            const opacity = abs < 0.35 ? 1 : Math.max(0.4, 1 - abs * 0.2);
            const translateZ = -Math.min(58, abs * 16);

            return (
              <div
                key={`semester-${sem !== null ? sem : 'placeholder'}-${idx}`}
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  height: `${itemHeight}px`,
                  width: '100%',
                  transformStyle: 'preserve-3d',
                  transform: `translateY(${Math.sign(clamped) * abs * 0.35}px) rotateX(${rotationX}deg) translateZ(${translateZ}px) scale(${stepScale})`,
                  transformOrigin: 'center center',
                  opacity: isTopBottomPlaceholder ? 0 : opacity,
                }}
                onClick={() => {
                  if (Math.abs(distance) < 0.35) {
                    onConfirm?.(sem);
                  }
                }}
              >
                {isTopBottomPlaceholder ? null : (
                  abs < 0.35 ? (
                    <span className="tracking-wide font-extrabold text-transparent text-base scale-125 select-none">
                      {sem}º Semestre
                    </span>
                  ) : (
                    <span className="tracking-wide font-semibold text-slate-700 dark:text-slate-300 text-base" style={{ opacity: 1 }}>
                      {sem}º
                    </span>
                  )
                )}
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};

// Componente Input numérico con botones personalizados
const NumberInput = ({ label, name, value, onChange, required, error, onClearError, errorPulse = 0 }) => {
  const { motionClass } = useErrorPulse(error, errorPulse);
  const errorMessage = getErrorMessage(error);

  const handleIncrement = () => {
    onClearError?.();
    onChange({ target: { name, value: String(Number(value || 0) + 1) } });
  };

  const handleDecrement = () => {
    onClearError?.();
    const newValue = Math.max(0, Number(value || 0) - 1);
    onChange({ target: { name, value: String(newValue) } });
  };

  return (
    <div>
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex items-center gap-2">
        {/* Input numérico */}
        <input
          type="number"
          name={name}
          value={value}
          onChange={onChange}
          onFocus={onClearError}
          min="0"
          max="12"
          required={required}
          aria-invalid={Boolean(errorMessage)}
          className={`w-20 px-2 py-3 text-center rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
            errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'border-slate-300 dark:border-slate-600'
          } [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />

        {/* Botones verticales */}
        <div className="flex flex-col gap-1">
          {/* Botón más (arriba) */}
          <button
            type="button"
            onClick={handleIncrement}
            className="flex items-center justify-center w-8 h-6 rounded-lg bg-[#3D56B5] hover:bg-[#2C4AAE] text-white font-bold transition-all active:scale-95"
            title="Aumentar"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 14l5-5 5 5z"/>
            </svg>
          </button>

          {/* Botón menos (abajo) */}
          <button
            type="button"
            onClick={handleDecrement}
            className="flex items-center justify-center w-8 h-6 rounded-lg bg-[#3D56B5] hover:bg-[#2C4AAE] text-white font-bold transition-all active:scale-95"
            title="Disminuir"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
        </div>
      </div>
      {errorMessage && <p className={`text-xs text-red-600 dark:text-red-400 mt-1 ${motionClass}`}>{errorMessage}</p>}
    </div>
  );
};

const InputField = ({ label, name, type = 'text', value, onChange, required, error, onClearError, errorPulse = 0 }) => {
  const { motionClass } = useErrorPulse(error, errorPulse);
  const errorMessage = getErrorMessage(error);

  return (
    <div>
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {required && <span className="text-red-500">*</span>}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        onFocus={onClearError}
        required={required}
        aria-invalid={Boolean(errorMessage)}
        className={`w-full px-4 py-3 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md ${
          errorMessage ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass}` : 'border-slate-300 dark:border-slate-600'
        } [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      />
      {errorMessage && <p className={`text-xs text-red-600 dark:text-red-400 mt-1 ${motionClass}`}>{errorMessage}</p>}
    </div>
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
    error,
    onClearError,
    errorPulse = 0,
    disabled = false,
    emptyText = 'Sin opciones disponibles',
    menuMaxHeight = 'max-h-56',
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const selected = options.find((opt) => opt.value?.toString() === value?.toString());
    const { motionClass } = useErrorPulse(error, errorPulse);
    const errorMessage = getErrorMessage(error);

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
        onClearError?.();
        onChange(newValue);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => {
                    if (disabled) return;
                    onClearError?.();
                    setOpen((prev) => !prev);
                }}
                disabled={disabled}
                aria-invalid={Boolean(errorMessage)}
                className={`w-full text-left pl-3.5 pr-10 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-sm shadow-sm transition-all ${
                    disabled
                        ? 'border-slate-300/80 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
                        : open
                            ? 'border-[#263F8A] dark:border-[#3A56AF] ring-2 ring-[#263F8A]/35 dark:ring-[#3A56AF]/35 text-slate-900 dark:text-slate-100'
                            : errorMessage
                                ? `${ERROR_FIELD_BORDER_CLASS} ${motionClass} text-slate-800 dark:text-slate-100`
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

const MateriaForm = ({ sidebarCollapsed = false }) => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [carreras, setCarreras] = useState([]);
    const [formData, setFormData] = useState({
        nombre: '',
        sigla: '',
        semestre: 1,
        carrera: '',
        horas_teoricas: 0,
        horas_practicas: 0,
    });
    const [errors, setErrors] = useState({});
    const [errorPulse, setErrorPulse] = useState(0);

    const carreraOptions = (carreras || []).map((c) => ({
        value: String(c.id),
        label: c.nombre,
    }));

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const carreraFromFilter = searchParams.get('carrera');

        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        // iiisyp es solo lectura: no puede acceder al form de gestion de materias
        const esAdmin = userData?.is_superuser || ['director', 'jefe_estudios'].includes(userData?.perfil?.rol);

        if (!esAdmin) {
            toast.error("No tienes permisos para gestionar materias");
            navigate('/fondo-tiempo/materias');
            return;
        }

        const fetchCarreras = async () => {
            try {
                const res = await api.get('/carreras/');
                const carrerasData = res.data.results || res.data;
                setCarreras(carrerasData);

                if (!id && carreraFromFilter) {
                    const carreraExiste = (carrerasData || []).some((c) => String(c.id) === String(carreraFromFilter));
                    if (carreraExiste) {
                        setFormData(prev => ({
                            ...prev,
                            carrera: String(carreraFromFilter)
                        }));
                    }
                }
            } catch (error) {
                console.error("Error cargando carreras:", error);
                toast.error("Error al cargar carreras");
            }
        };
        fetchCarreras();

        if (id) {
            const fetchMateria = async () => {
                try {
                    const res = await api.get(`/materias/${id}/`);
                    const data = res.data;
                    // Asegurarse de que carrera sea el ID si viene como objeto
                    if (data.carrera && typeof data.carrera === 'object') {
                        data.carrera = data.carrera.id;
                    }
                    setFormData(data);
                } catch (error) {
                    console.error("Error cargando materia:", error);
                    toast.error("Error al cargar la materia");
                }
            };
            fetchMateria();
        }
    }, [id, location.search, navigate]);

    const clearFieldError = (fieldName) => {
        setErrors(prev => {
            if (!prev?.[fieldName]) return prev;
            const next = { ...prev };
            delete next[fieldName];
            return next;
        });
    };

    const applyErrors = (nextErrors) => {
        setErrors(nextErrors);
        setErrorPulse(prev => prev + 1);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        clearFieldError(name);
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSelectChange = (fieldName, value) => {
        clearFieldError(fieldName);
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrors({});

        const clientErrors = {};
        if (!String(formData.nombre || '').trim()) {
            clientErrors.nombre = 'El nombre de la materia es obligatorio.';
        }
        if (!String(formData.sigla || '').trim()) {
            clientErrors.sigla = 'La sigla de la materia es obligatoria.';
        }
        if (!String(formData.carrera || '').trim()) {
            clientErrors.carrera = 'Debe seleccionar una carrera.';
        }

        // Validaciones de horas
        const horasTeoricas = Number(formData.horas_teoricas) || 0;
        const horasPracticas = Number(formData.horas_practicas) || 0;
        const horasTotales = horasTeoricas + horasPracticas;
        const semestreValue = Number(formData.semestre);

        if (!formData.semestre || isNaN(semestreValue) || semestreValue < 1 || semestreValue > 10) {
            clientErrors.semestre = 'Introduzca un numero entero valido entre 1 y 10.';
        }
        if (horasTeoricas < 0) {
            clientErrors.horas_teoricas = 'Las horas no pueden ser negativas.';
        }
        if (horasPracticas < 0) {
            clientErrors.horas_practicas = 'Las horas no pueden ser negativas.';
        }

        if (!clientErrors.horas_teoricas && !clientErrors.horas_practicas && horasTotales < 2) {
            clientErrors.horas_teoricas = 'La suma de horas teoricas y practicas debe ser minimo 2 horas.';
            clientErrors.horas_practicas = 'La suma de horas teoricas y practicas debe ser minimo 2 horas.';
        }
        if (horasTotales > 12) {
            clientErrors.horas_teoricas = 'La suma de horas teoricas y practicas no puede exceder 12 horas.';
            clientErrors.horas_practicas = 'La suma de horas teoricas y practicas no puede exceder 12 horas.';
        }

        if (Object.keys(clientErrors).length > 0) {
            applyErrors(clientErrors);
            toast.error(getBackendErrorMessage(clientErrors, 'Revise los campos marcados en rojo.'));
            setLoading(false);
            return;
        }

        try {
            let response;
            if (id) {
                response = await api.put(`/materias/${id}/`, formData);
                if (response.status !== 200) {
                    throw new Error('Respuesta inesperada al actualizar materia');
                }
                toast.success('Materia actualizada correctamente');
            } else {
                response = await api.post('/materias/', formData);
                if (response.status !== 201) {
                    throw new Error('Respuesta inesperada al crear materia');
                }
                toast.success('Materia creada correctamente');
            }

            navigate('/fondo-tiempo/materias');
        } catch (err) {
            console.error(err);
            const statusCode = err.response?.status;
            const apiErrors = err.response?.data;
            if (apiErrors) {
                applyErrors(sanitizeApiErrors(apiErrors));
                toast.error(getBackendErrorMessage(apiErrors, 'No se pudo guardar la materia.'));
                if (statusCode === 400) {
                    return;
                }
            } else {
                toast.error('Ocurrió un error inesperado.');
            }
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div
            className="fixed top-0 right-0 bottom-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-fade-in"
            style={{ left: sidebarCollapsed ? '5rem' : '18rem', animationDuration: '160ms' }}
        >
            <div className="max-w-4xl w-full">
                <div className="bg-white/75 dark:bg-slate-900 backdrop-blur-xl dark:backdrop-blur-none rounded-2xl border border-white/50 dark:border-slate-600/50 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '180ms' }}>
                    <div className="px-6 py-4 border-b border-[#7F97E8]/45 bg-[#2C4AAE]">
                        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                            {id ? '✏️ Editar Materia' : '➕ Nueva Materia'}
                        </h1>
                    </div>

                    <form onSubmit={handleSubmit} noValidate className="p-5 md:p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2 rounded-xl border border-[#3D6DE0]/30 dark:border-[#4B67C0]/40 bg-gradient-to-r from-white/60 via-[#3D6DE0]/5 to-cyan-400/10 dark:from-slate-800/55 dark:to-cyan-900/20 p-4 shadow-sm">
                                <InputField label="Nombre de la Materia" name="nombre" value={formData.nombre} onChange={handleChange} onClearError={() => clearFieldError('nombre')} required error={errors.nombre} errorPulse={errorPulse} />
                            </div>

                            <div>
                                <InputField label="Sigla" name="sigla" value={formData.sigla} onChange={handleChange} onClearError={() => clearFieldError('sigla')} required error={errors.sigla} errorPulse={errorPulse} />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Carrera <span className="text-red-500">*</span></label>
                                <CustomSelect
                                    value={String(formData.carrera || '')}
                                    options={carreraOptions}
                                    onChange={(value) => handleSelectChange('carrera', value)}
                                    placeholder="Seleccione una carrera"
                                    error={errors.carrera}
                                    onClearError={() => clearFieldError('carrera')}
                                    errorPulse={errorPulse}
                                />
                                {errors.carrera && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{getErrorMessage(errors.carrera)}</p>}
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <SemesterPicker
                                value={formData.semestre}
                                onChange={handleChange}
                                error={errors.semestre}
                                onClearError={() => clearFieldError('semestre')}
                                errorPulse={errorPulse}
                              />
                              <NumberInput
                                label="Horas T."
                                name="horas_teoricas"
                                value={formData.horas_teoricas}
                                onChange={handleChange}
                                required
                                error={errors.horas_teoricas}
                                onClearError={() => clearFieldError('horas_teoricas')}
                                errorPulse={errorPulse}
                              />
                              <NumberInput
                                label="Horas P."
                                name="horas_practicas"
                                value={formData.horas_practicas}
                                onChange={handleChange}
                                required
                                error={errors.horas_practicas}
                                onClearError={() => clearFieldError('horas_practicas')}
                                errorPulse={errorPulse}
                              />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                              ℹ️ La suma de horas teóricas y prácticas debe estar entre 2 y 12 horas semanales
                            </p>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/fondo-tiempo/materias')}
                                className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-colors border border-slate-300 dark:border-slate-600"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                            >
                                {loading ? 'Guardando...' : '💾 Guardar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default MateriaForm;
