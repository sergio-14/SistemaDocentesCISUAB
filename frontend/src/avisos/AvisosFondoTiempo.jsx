import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../apis/api';
import { useActiveRole } from '../contexts/activeRole';
import useConsultaConRespaldo, { useMensajes } from '../tiempoReal/useTiempoReal';
import mostrarAviso from './mostrarAviso';

const CONSULTA_MS = 20000;
// Si llegan muchos a la vez (p. ej. al volver tras un rato), se muestran los últimos
// y un resumen del resto.
const MAXIMO_A_LA_VEZ = 3;

const leerCursor = (clave) => {
  try {
    const valor = Number(localStorage.getItem(clave));
    return Number.isFinite(valor) && valor > 0 ? valor : null;
  } catch {
    return null;
  }
};

const guardarCursor = (clave, valor) => {
  try {
    localStorage.setItem(clave, String(valor));
  } catch {
    // Sin almacenamiento, el cursor vive solo mientras la página esté abierta.
  }
};

/**
 * Único lugar del frontend que muestra los avisos del Fondo de Tiempo. Quién recibe
 * qué y con qué texto lo decide el backend (fondos/avisos.py, GET /fondos-tiempo/novedades/).
 *
 * Llegan por el socket de tiempo real (mismo aviso que /novedades/). La consulta queda
 * para ponerse al día al entrar, al reconectar y como respaldo lento si el socket se
 * corta (useConsultaConRespaldo); con VITE_TIEMPO_REAL=false, cada 20 s como antes.
 *
 * El cursor (último evento visto) se guarda por usuario y rol activo: el mismo aviso
 * nunca sale dos veces en este navegador. No consulta dentro del POA.
 */
export default function AvisosFondoTiempo() {
  const { effectiveUser, activeAssignment, roleSelectionRequired } = useActiveRole();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const usuarioId = effectiveUser?.id;
  const clave = `avisos_fondo_cursor_${usuarioId}_${activeAssignment?.id ?? 'base'}`;
  const activo = Boolean(usuarioId) && !roleSelectionRequired && !pathname.startsWith('/poa');

  const cursorRef = useRef(null);
  const vistosRef = useRef(new Set());
  const consultandoRef = useRef(false);

  useEffect(() => {
    cursorRef.current = leerCursor(clave);
  }, [clave]);

  const mostrarNuevos = useCallback((avisos) => {
    const nuevos = avisos.filter((aviso) => !vistosRef.current.has(aviso.id));
    nuevos.forEach((aviso) => vistosRef.current.add(aviso.id));
    const visibles = nuevos.slice(-MAXIMO_A_LA_VEZ);
    const resto = nuevos.length - visibles.length;
    if (resto > 0) {
      mostrarAviso({ texto: `Tienes ${resto} novedades más en tus fondos de tiempo.`, id: `avisos-resto-${nuevos[0].id}` });
    }
    visibles.forEach((aviso) => mostrarAviso({
      id: `aviso-${aviso.id}`,
      texto: aviso.texto,
      tono: aviso.tono,
      alVer: () => navigate(`/fondo-tiempo/fondo/${aviso.fondo_id}`),
    }));
  }, [navigate]);

  const consultar = useCallback(async () => {
    if (!activo || consultandoRef.current) return;
    consultandoRef.current = true;
    try {
      const desde = cursorRef.current;
      const { data } = await api.get('/fondos-tiempo/novedades/', { params: desde ? { desde } : {} });
      mostrarNuevos(data.avisos || []);
      if (data.ultimo_id) {
        cursorRef.current = data.ultimo_id;
        guardarCursor(clave, data.ultimo_id);
      }
    } catch {
      // Sin red o sesión vencida: se reintenta en la próxima consulta.
    } finally {
      consultandoRef.current = false;
    }
  }, [activo, clave, mostrarNuevos]);

  // Al entrar y al cambiar de usuario o de rol activo, enseguida.
  useEffect(() => {
    consultar();
  }, [consultar]);

  useConsultaConRespaldo(consultar, CONSULTA_MS, activo);

  // Por el socket. Fuera de su alcance (p. ej. dentro del POA) se ignoran sin mover el
  // cursor: al volver, la consulta de entrada los recupera.
  useMensajes('aviso', ({ aviso }) => {
    if (!activo || !aviso) return;
    mostrarNuevos([aviso]);
    if (aviso.id > (cursorRef.current || 0)) {
      cursorRef.current = aviso.id;
      guardarCursor(clave, aviso.id);
    }
  });

  return null;
}
