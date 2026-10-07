import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

// Ruleta vertical (estilo iOS) para elegir una opción: la del año del calendario académico
// y la del semestre en la carga del fondo. Se mueve con la rueda del mouse, las flechas
// (o W/S) y, si se pide, con un clic en las opciones de los lados; el clic en la del
// centro (o Enter) confirma.

const mismoValor = (a, b) => String(a) === String(b);

const ItemRueda = ({ opcion, distance, itemHeight, onCenterClick, onSideClick }) => {
  const isCenter = Math.abs(distance) < 0.35;
  const isSpacer = opcion === null;
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
          onClick={() => onCenterClick?.(opcion.value)}
          className="w-full h-full flex items-center justify-center tracking-wide font-extrabold text-transparent text-lg scale-125 cursor-pointer select-none"
          title="Confirmar selección"
          aria-label={`Seleccionar ${opcion.label}`}
        >
          {opcion.label}
        </button>
      ) : onSideClick ? (
        <button
          type="button"
          onClick={onSideClick}
          className="w-full h-full tracking-wide font-semibold text-slate-700 dark:text-slate-300 text-sm select-none"
          aria-label={`Ir a ${opcion.label}`}
        >
          {opcion.label}
        </button>
      ) : (
        <span className="tracking-wide font-semibold text-slate-700 dark:text-slate-300 text-sm" style={{ opacity: 1 }}>
          {opcion.label}
        </span>
      )}
    </div>
  );
};

const RuedaOpciones = ({
  opciones,
  value,
  valorInicial,
  onChange,
  onSettled,
  onConfirm,
  resetToken = 0,
  visibleCount = 5,
  itemHeight = 52,
  clicEnLaterales = false,
}) => {
  const iosWheelTransition = {
    type: 'spring',
    stiffness: 240,
    damping: 30,
    mass: 0.9,
    restDelta: 0.2,
    restSpeed: 0.2,
  };

  const valores = useMemo(() => opciones.map((opcion) => opcion.value), [opciones]);
  const indiceDe = (valor) => valores.findIndex((v) => mismoValor(v, valor));
  const indiceInicial = (() => {
    const idx = indiceDe(valorInicial ?? value);
    return idx >= 0 ? idx : Math.floor(valores.length / 2);
  })();

  const viewportRef = useRef(null);
  const padSlots = 3;
  const [targetIndex, setTargetIndex] = useState(indiceInicial);
  const [centeredIndex, setCenteredIndex] = useState(indiceInicial);
  const [centerFloatIndex, setCenterFloatIndex] = useState(indiceInicial);
  const centeredIndexRef = useRef(indiceInicial);
  const centerFloatRef = useRef(indiceInicial);
  const isIntroAnimatingRef = useRef(true);
  const lastInternalValueRef = useRef(null);
  const wheelDeltaAccumRef = useRef(0);
  const wheelLastStepAtRef = useRef(0);
  const wheelIdleResetTimerRef = useRef(null);
  const wheelIgnoreUntilRef = useRef(0);

  const clampIndex = (idx) => Math.max(0, Math.min(valores.length - 1, idx));
  const wheelHeight = visibleCount * itemHeight;
  const centerOffset = Math.floor(visibleCount / 2);

  const displayOpciones = useMemo(() => {
    const relleno = new Array(padSlots).fill(null);
    return [...relleno, ...opciones, ...relleno];
  }, [opciones]);

  const centeredDisplayIndex = centeredIndex + padSlots;
  const targetDisplayIndex = targetIndex + padSlots;
  const targetY = (centerOffset - targetDisplayIndex) * itemHeight;
  const clampedFloatIndex = Math.max(0, Math.min(valores.length - 1, centerFloatIndex));
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
    const finalValue = valores[finalIndex];
    if (finalValue !== undefined) {
      lastInternalValueRef.current = String(finalValue);
    }
    setTargetIndex(finalIndex);
    setCenteredIndex(finalIndex);
    setCenterFloatIndex(finalIndex);
    centeredIndexRef.current = finalIndex;
    centerFloatRef.current = finalIndex;
    isIntroAnimatingRef.current = true;
  };

  const stepSelection = (steps) => {
    if (!valores.length || steps === 0) return;
    setTargetIndex((prev) => clampIndex(prev + steps));
  };

  useEffect(() => {
    if (!valores.length) return;
    const idx = indiceDe(valorInicial ?? value);
    const syncIndex = idx >= 0 ? idx : Math.floor(valores.length / 2);
    const syncValue = valores[syncIndex];

    setTargetIndex(syncIndex);
    setCenteredIndex(syncIndex);
    setCenterFloatIndex(syncIndex);
    centeredIndexRef.current = syncIndex;
    centerFloatRef.current = syncIndex;
    if (syncValue !== undefined) {
      lastInternalValueRef.current = String(syncValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo se resincroniza al reiniciar o abrir la rueda, no con cada valor.
  }, [resetToken, valores.length, valorInicial]);

  useEffect(() => {
    if (centeredIndex !== targetIndex) return;

    const selectedValue = valores[centeredIndex];
    if (selectedValue === undefined) return;

    if (String(selectedValue) === lastInternalValueRef.current) return;
    lastInternalValueRef.current = String(selectedValue);
    onChange(selectedValue);
    onSettled?.(selectedValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avisa solo cuando la rueda se detiene en una opción.
  }, [centeredIndex, targetIndex, valores]);

  useEffect(() => {
    if (!valores.length) return;
    const idx = indiceDe(value);
    emitSelection(idx >= 0 ? idx : Math.floor(valores.length / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores.length]);

  useEffect(() => {
    if (!valores.length) return;
    if (value === null || value === undefined || value === '') return;
    if (String(value) === lastInternalValueRef.current) return;

    const idx = indiceDe(value);
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

      // Ajuste fino: menos sensible para evitar que salte muchas opciones.
      const threshold = 48;
      if (Math.abs(wheelDeltaAccumRef.current) < threshold) return;

      // Enfriamiento corto: evita múltiples pasos en un mismo "ataque" de eventos.
      const cooldownMs = 95;
      if (now - wheelLastStepAtRef.current < cooldownMs) return;

      const direction = wheelDeltaAccumRef.current > 0 ? 1 : -1;
      stepSelection(direction);
      wheelLastStepAtRef.current = now;

      // Reset estricto: cada tick efectivo mueve una sola opción.
      wheelDeltaAccumRef.current = 0;

      if (wheelIdleResetTimerRef.current) clearTimeout(wheelIdleResetTimerRef.current);
      wheelIdleResetTimerRef.current = setTimeout(() => {
        wheelDeltaAccumRef.current = 0;
      }, 140);
    };

    node.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => node.removeEventListener('wheel', handleWheelNative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores.length, resetToken]);

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
            {opciones[lowerFloatIndex] !== undefined && (
              <span
                className="absolute tracking-wide font-extrabold text-[#1F3274] dark:text-white text-lg drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] dark:drop-shadow-lg"
                style={getOverlayStyle(-centerProgress * itemHeight)}
              >
                {opciones[lowerFloatIndex].label}
              </span>
            )}

            {upperFloatIndex !== lowerFloatIndex && opciones[upperFloatIndex] !== undefined && (
              <span
                className="absolute tracking-wide font-extrabold text-[#1F3274] dark:text-white text-lg drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] dark:drop-shadow-lg"
                style={getOverlayStyle((1 - centerProgress) * itemHeight)}
              >
                {opciones[upperFloatIndex].label}
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
          if (key === 'w' || key === 'arrowup') {
            event.preventDefault();
            stepSelection(-1);
          } else if (key === 's' || key === 'arrowdown') {
            event.preventDefault();
            stepSelection(1);
          } else if (key === 'enter') {
            event.preventDefault();
            const selectedValue = valores[centeredIndex];
            if (selectedValue !== undefined) onConfirm?.(selectedValue);
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
            const boundedFloat = Math.max(0, Math.min(valores.length - 1, floatIndex));
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
          {displayOpciones.map((opcion, idx) => (
            <ItemRueda
              key={opcion === null ? `spacer-${idx}` : String(opcion.value)}
              opcion={opcion}
              distance={idx - visualDisplayIndex}
              itemHeight={itemHeight}
              onCenterClick={(valor) => {
                if (idx === centeredDisplayIndex) onConfirm?.(valor);
              }}
              onSideClick={clicEnLaterales && opcion !== null
                ? () => setTargetIndex(clampIndex(idx - padSlots))
                : undefined}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default RuedaOpciones;
