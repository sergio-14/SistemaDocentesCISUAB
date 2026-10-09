import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { TIEMPO_REAL_HABILITADO, escuchar, escucharEstado, estaConectado } from './conexion';
import useConsultaPeriodica from '../utils/useConsultaPeriodica';

// Con el socket cortado, cada cuánto se consulta de respaldo y tras cuánto corte.
export const RESPALDO_MS = 60000;
const ESPERA_ANTES_DEL_RESPALDO_MS = 10000;

/** true mientras el socket está conectado y autenticado. */
export function useConectado() {
  return useSyncExternalStore(escucharEstado, estaConectado);
}

/** Escucha un tipo de mensaje del socket mientras el componente está montado. */
export function useMensajes(tipo, oyente) {
  const oyenteRef = useRef(oyente);
  useEffect(() => {
    oyenteRef.current = oyente;
  });
  useEffect(() => escuchar(tipo, (mensaje) => oyenteRef.current(mensaje)), [tipo]);
}

/**
 * Cuando el servidor avisa que un fondo cambió (estado, cargas, informe, observaciones;
 * también crearlo o archivarlo). Con `fondoId`, solo los de ese fondo. Junta los avisos
 * seguidos (p. ej. al generar fondos masivamente) en una sola llamada.
 */
export function useFondoActualizado(alCambiar, { fondoId = null, esperaMs = 600 } = {}) {
  const alCambiarRef = useRef(alCambiar);
  const temporizadorRef = useRef(null);
  useEffect(() => {
    alCambiarRef.current = alCambiar;
  });
  useEffect(() => () => window.clearTimeout(temporizadorRef.current), []);
  useMensajes('fondo_actualizado', ({ fondo }) => {
    if (fondoId != null && Number(fondo) !== Number(fondoId)) return;
    window.clearTimeout(temporizadorRef.current);
    temporizadorRef.current = window.setTimeout(() => alCambiarRef.current(), esperaMs);
  });
}

/**
 * Consulta periódica que solo corre si hace falta:
 * - Tiempo real apagado (VITE_TIEMPO_REAL=false): como antes, cada `intervaloMs`.
 * - Socket conectado: no consulta (llega todo por el socket).
 * - Socket cortado más de 10 s: respaldo lento, cada 60 s.
 * Al reconectarse consulta una vez, para recuperar lo que pasó mientras estaba cortado.
 */
export default function useConsultaConRespaldo(consultar, intervaloMs, activo = true) {
  const conectado = useConectado();
  const [cortadoHaceRato, setCortadoHaceRato] = useState(false);
  const consultarRef = useRef(consultar);
  useEffect(() => {
    consultarRef.current = consultar;
  });

  useEffect(() => {
    if (!TIEMPO_REAL_HABILITADO) return undefined;
    if (conectado) {
      setCortadoHaceRato(false);
      if (activo) consultarRef.current();
      return undefined;
    }
    const temporizador = window.setTimeout(() => setCortadoHaceRato(true), ESPERA_ANTES_DEL_RESPALDO_MS);
    return () => window.clearTimeout(temporizador);
  }, [conectado, activo]);

  const intervalo = TIEMPO_REAL_HABILITADO ? RESPALDO_MS : intervaloMs;
  const consultaActiva = activo && (!TIEMPO_REAL_HABILITADO || (!conectado && cortadoHaceRato));
  useConsultaPeriodica(() => consultarRef.current(), intervalo, consultaActiva);
}
