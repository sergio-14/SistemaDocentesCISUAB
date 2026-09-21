import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { getDocumentosPOAPorGestion } from '../../../apis/poa.api';
import NuevoDocumentoModal from './NuevoDocumentoModal';
import IconButton from './IconButton';
import { FaTimes } from 'react-icons/fa';
import { Modal } from './base';
import { ModalErrorAlert, formatApiErrors } from './formErrorUtils';

const MIN_GESTION_YEAR = 2022;
const getMaxGestionYear = () => new Date().getFullYear() + 5;

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

const userHasElaboradorPOARole = (user, poaRoles = []) => {
  const directRoles = [
    ...(Array.isArray(poaRoles) ? poaRoles : []),
    ...(Array.isArray(user?.poaRoles) ? user.poaRoles : []),
    ...(Array.isArray(user?.poa_roles) ? user.poa_roles : []),
    ...(Array.isArray(user?.roles_poa) ? user.roles_poa : []),
    user?.rol_poa,
    user?.poa_rol,
  ].filter(Boolean);

  const accessLists = [
    user?.accesos_poa,
    user?.usuarios_poa,
    user?.poa_accesos,
  ].filter(Array.isArray);

  return (
    directRoles.includes('elaborador') ||
    accessLists.some((items) => items.some((item) => item?.rol === 'elaborador' && item?.activo !== false))
  );
};

const YearWheelPicker = ({ value, onChange, disabled = false, compact = false }) => {
  const wheelRef = useRef(null);
  const viewportRef = useRef(null);
  const wheelDeltaAccumRef = useRef(0);
  const wheelLastStepAtRef = useRef(0);
  const wheelIdleResetTimerRef = useRef(null);
  const touchLastYRef = useRef(null);
  const touchAccumRef = useRef(0);
  const isExpanded = !compact;
  const visibleCount = compact ? 1 : 5;
  const itemHeight = 44;
  const minYear = MIN_GESTION_YEAR;
  const maxYear = getMaxGestionYear();
  const centerOffset = Math.floor(visibleCount / 2);
  const wheelHeight = visibleCount * itemHeight;

  const years = useMemo(() => {
    const list = [];
    for (let y = maxYear; y >= minYear; y -= 1) list.push(y);
    return list;
  }, [maxYear, minYear]);

  const rawValue = String(value ?? '').trim();
  const numericValue = rawValue && /^[0-9]+$/.test(rawValue) ? Number(rawValue) : new Date().getFullYear();
  const selectedYear = Number.isFinite(numericValue)
    ? Math.max(minYear, Math.min(maxYear, numericValue))
    : new Date().getFullYear();
  const selectedIndex = Math.max(0, years.findIndex((year) => year === selectedYear));
  const padSlots = 3;
  const iosWheelTransition = {
    type: 'spring',
    stiffness: 240,
    damping: 30,
    mass: 0.9,
    restDelta: 0.2,
    restSpeed: 0.2,
  };
  const [targetIndex, setTargetIndex] = useState(selectedIndex);
  const [centeredIndex, setCenteredIndex] = useState(selectedIndex);
  const [centerFloatIndex, setCenterFloatIndex] = useState(selectedIndex);
  const centeredIndexRef = useRef(selectedIndex);
  const centerFloatRef = useRef(selectedIndex);
  const isIntroAnimatingRef = useRef(true);
  const lastInternalYearRef = useRef(null);

  const clampIndex = useCallback((idx) => Math.max(0, Math.min(years.length - 1, idx)), [years.length]);
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

  const stepSelection = useCallback((steps) => {
    if (disabled || steps === 0) return;
    setTargetIndex((prev) => clampIndex(prev + steps));
  }, [clampIndex, disabled]);

  useEffect(() => {
    if (!years.length) return;
    setTargetIndex(selectedIndex);
    setCenteredIndex(selectedIndex);
    setCenterFloatIndex(selectedIndex);
    centeredIndexRef.current = selectedIndex;
    centerFloatRef.current = selectedIndex;
    lastInternalYearRef.current = Number(years[selectedIndex]);
    isIntroAnimatingRef.current = false;
  }, [compact, selectedIndex, years]);

  useEffect(() => {
    if (centeredIndex !== targetIndex) return;

    const selected = years[centeredIndex];
    if (selected === undefined) return;
    if (Number(selected) === lastInternalYearRef.current) return;

    lastInternalYearRef.current = Number(selected);
    onChange(String(selected));
  }, [centeredIndex, onChange, targetIndex, years]);

  useEffect(() => {
    const node = wheelRef.current;
    if (!node || disabled) return undefined;

    wheelDeltaAccumRef.current = 0;
    wheelLastStepAtRef.current = 0;

    const handleWheelNative = (event) => {
      event.preventDefault();

      const normalizedDelta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * wheelHeight
            : event.deltaY;

      if (event.deltaMode === 0 && Math.abs(normalizedDelta) < 8) return;

      wheelDeltaAccumRef.current += normalizedDelta;
      if (Math.abs(wheelDeltaAccumRef.current) < 48) return;

      const now = Date.now();
      if (now - wheelLastStepAtRef.current < 95) return;

      stepSelection(wheelDeltaAccumRef.current > 0 ? 1 : -1);
      wheelLastStepAtRef.current = now;
      wheelDeltaAccumRef.current = 0;

      if (wheelIdleResetTimerRef.current) clearTimeout(wheelIdleResetTimerRef.current);
      wheelIdleResetTimerRef.current = setTimeout(() => {
        wheelDeltaAccumRef.current = 0;
      }, 140);
    };

    node.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => node.removeEventListener('wheel', handleWheelNative);
  }, [disabled, stepSelection, wheelHeight]);

  useEffect(() => {
    return () => {
      if (wheelIdleResetTimerRef.current) clearTimeout(wheelIdleResetTimerRef.current);
    };
  }, []);

  const handleTouchStart = (event) => {
    if (disabled || !event.touches?.length) return;
    touchLastYRef.current = event.touches[0].clientY;
    touchAccumRef.current = 0;
  };

  const handleTouchMove = (event) => {
    if (disabled || touchLastYRef.current === null || !event.touches?.length) return;
    const currentY = event.touches[0].clientY;
    const delta = touchLastYRef.current - currentY;
    touchLastYRef.current = currentY;
    touchAccumRef.current += delta;

    if (Math.abs(touchAccumRef.current) < 34) return;
    stepSelection(touchAccumRef.current > 0 ? 1 : -1);
    touchAccumRef.current = 0;
  };

  const handleTouchEnd = () => {
    touchLastYRef.current = null;
    touchAccumRef.current = 0;
  };

  return (
    <div
      ref={wheelRef}
      className={`year-wheel-picker relative w-56 rounded-xl border border-[#3D6DE0]/35 dark:border-[#4B67C0]/45 bg-white/70 dark:bg-slate-800/60 overflow-hidden transition-all duration-200 ease-out ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-ns-resize'}`}
      style={{
        height: `${wheelHeight}px`,
        perspective: '1000px',
        perspectiveOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
        touchAction: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
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

      {isExpanded && (
        <>
          <button
            type="button"
            className="absolute inset-x-0 top-0 z-20 cursor-pointer bg-transparent focus:outline-none focus:bg-[#3D6DE0]/10"
            style={{ height: `${centerOffset * itemHeight}px` }}
            onClick={() => stepSelection(-1)}
            disabled={disabled || targetIndex === 0}
            aria-label="Seleccionar gestión superior"
            title="Seleccionar gestión superior"
          />
          <button
            type="button"
            className="absolute inset-x-0 bottom-0 z-20 cursor-pointer bg-transparent focus:outline-none focus:bg-[#3D6DE0]/10"
            style={{ height: `${centerOffset * itemHeight}px` }}
            onClick={() => stepSelection(1)}
            disabled={disabled || targetIndex === years.length - 1}
            aria-label="Seleccionar gestión inferior"
            title="Seleccionar gestión inferior"
          />
        </>
      )}

      <div className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-white/70 via-white/30 to-transparent dark:from-slate-900/70 dark:via-slate-900/25 z-10 transition-all duration-200 ${isExpanded ? 'h-14 opacity-100' : 'h-0 opacity-0'}`} />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/70 via-white/30 to-transparent dark:from-slate-900/70 dark:via-slate-900/25 z-10 transition-all duration-200 ${isExpanded ? 'h-14 opacity-100' : 'h-0 opacity-0'}`} />

      <div
        ref={viewportRef}
        className="relative h-full select-none overflow-hidden cursor-default"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (event.repeat || disabled) return;
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            stepSelection(-1);
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            stepSelection(1);
          }
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
          {displayYears.map((year, idx) => (
            <YearWheelItem
              key={year === null ? `spacer-${idx}` : year}
              year={year}
              distance={idx - visualDisplayIndex}
              itemHeight={itemHeight}
              onCenterClick={(clickedYear) => {
                if (idx === centeredDisplayIndex) onChange(String(clickedYear));
              }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
};

const GestionSelectorModal = ({ onClose, onCancel, onSuccess, currentUser = null, poaRoles = [], canCreateDocument = null }) => {
  const [loading, setLoading] = useState(true);
  const [errorMessages, setErrorMessages] = useState([]);
  const [manualYear, setManualYear] = useState('');
  const [noDocsForYear, setNoDocsForYear] = useState(false);
  const maxGestionYear = getMaxGestionYear();
  const canCreatePOADocument = canCreateDocument === null
    ? userHasElaboradorPOARole(currentUser, poaRoles)
    : Boolean(canCreateDocument);
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (onClose) onClose();
  };

  useEffect(() => {
    const current = new Date().getFullYear();
    const initialYear = Math.max(MIN_GESTION_YEAR, Math.min(maxGestionYear, current));
    setManualYear(String(initialYear));
    setLoading(false);
  }, [maxGestionYear]);

  const handleIngresar = async () => {
    const yearToQuery = String(manualYear).trim();
    if (!yearToQuery) {
      setErrorMessages(['Gestión: seleccione o ingrese una gestión (año).']);
      return;
    }
    if (!/^[0-9]{4}$/.test(yearToQuery)) {
      setErrorMessages(['Gestión: ingrese un año válido (ej: 2025).']);
      return;
    }
    setErrorMessages([]);
    setLoading(true);
    setNoDocsForYear(false);
    try {
      const res = await getDocumentosPOAPorGestion(Number(yearToQuery));
      const docs = Array.isArray(res.data) ? res.data : (res.data.results || []);
      if (!docs || docs.length === 0) {
        setNoDocsForYear(yearToQuery);
        return;
      }
      if (onSuccess) onSuccess({ gestion: yearToQuery, documentos: docs });
    } catch (err) {
      setErrorMessages(formatApiErrors(err?.response?.data || err?.message || 'Error al consultar documentos'));
    } finally {
      setLoading(false);
    }
  };

  const handleAgregar = () => {
    if (!canCreatePOADocument) return;
    setShowNuevoModal(true);
  };

  const [showNuevoModal, setShowNuevoModal] = useState(false);

  const handleOtraGestion = () => {
    setNoDocsForYear(false);
    setErrorMessages([]);
  };

  return (
    <Modal onClose={handleCancel} className="gestion-selector-modal">
      <div className="modal-panel gestion-selector-panel rounded-xl w-[min(92vw,430px)]">
        <div className="modal-header gestion-selector-header px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-3">
              <h3 className="text-white text-lg font-semibold">Seleccionar gestión</h3>
              <p className="text-blue-100 text-sm mt-0.5">Seleccione la gestión (año) para filtrar documentos POA</p>
            </div>
            <IconButton icon={<FaTimes />} onClick={handleCancel} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
          </div>
        </div>

        <div className="p-5 modal-body gestion-selector-body">
            {loading && <div className="mb-3 text-sm text-gray-600 dark:text-slate-400">Cargando...</div>}
          <ModalErrorAlert title="No se pudo procesar la gestión:" messages={errorMessages} />

            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Año</label>

            <div className="flex items-center justify-center">
              <YearWheelPicker
                value={manualYear}
                onChange={setManualYear}
                disabled={!!noDocsForYear}
                compact={!!noDocsForYear}
              />
            </div>
            {!noDocsForYear && (
              <div className="mt-5 flex items-center justify-center gap-3 modal-actions gestion-selector-actions">
                <IconButton onClick={handleCancel} className="btn-cancel px-4 py-2 rounded-md" title="Cancelar">Cancelar</IconButton>
                <IconButton onClick={handleIngresar} disabled={loading} className="btn-primary px-4 py-2 rounded-md disabled:opacity-60" title={loading ? 'Buscando...' : 'Ingresar'}>{loading ? 'Buscando...' : 'Ingresar'}</IconButton>
              </div>
            )}

            {noDocsForYear && (
              <div className="no-docs-card mt-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">No se encontraron documentos para la gestión <strong>{noDocsForYear}</strong>.</p>

                {canCreatePOADocument ? (
                  <p className="text-sm text-gray-700 dark:text-slate-300 mt-2">¿Desea crear un nuevo documento para esta gestión?</p>
                ) : (
                  <p className="text-sm text-gray-700 dark:text-slate-300 mt-2">No tiene permisos para crear un nuevo documento en esta gestión.</p>
                )}

                <div className="mt-3 flex gap-2 justify-end modal-actions gestion-selector-actions">
                  <IconButton onClick={handleCancel} className="btn-cancel px-3 py-2 rounded-md" title="Cancelar">Cancelar</IconButton>
                  <IconButton onClick={handleOtraGestion} className="btn-secondary px-3 py-2 rounded-md border border-sky-400 dark:border-sky-500 shadow-sm" title="Otra gestión">Otra gestión</IconButton>
                  {canCreatePOADocument && (
                    <IconButton onClick={handleAgregar} className="btn-success px-3 py-2 rounded-md" title="Nuevo">Nuevo</IconButton>
                  )}
                </div>
              </div>
            )}
            {showNuevoModal && createPortal(
              (
                <div className="fixed inset-0 z-[70]">
                  <NuevoDocumentoModal
                    currentUser={currentUser}
                    initialGestion={noDocsForYear || manualYear}
                    onClose={() => setShowNuevoModal(false)}
                    onCreated={(created) => {
                      const year = noDocsForYear || manualYear;
                      if (onSuccess) onSuccess({ gestion: year });
                      if (onClose) onClose();
                    }}
                  />
                </div>
              ),
              document.body
            )}
        </div>
      </div>
    </Modal>
  );
};

export default GestionSelectorModal;
