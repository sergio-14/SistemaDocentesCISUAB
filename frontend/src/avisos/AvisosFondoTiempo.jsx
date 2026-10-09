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

/**
 * Único lugar del frontend que muestra los avisos del Fondo de Tiempo. Quién recibe
 * qué y con qué texto lo decide el backend (fondos/avisos.py).
 *
 * Llegan por el socket de tiempo real; GET /fondos-tiempo/novedades/ trae los que no
 * se vieron (al entrar, al reconectar y como respaldo si el socket se corta; con
 * VITE_TIEMPO_REAL=false, cada 20 s como antes).
 *
 * Cada aviso sale una sola vez por usuario y rol, en cualquier pantalla o pestaña:
 * antes de mostrarlo se reclama en el servidor (POST novedades/vistos/) y solo se
 * muestran los que el servidor devuelve como recién vistos. No muestra nada dentro del POA.
 */
export default function AvisosFondoTiempo() {
  const { effectiveUser, activeAssignment, roleSelectionRequired } = useActiveRole();
  const rolActivo = `${effectiveUser?.id}_${activeAssignment?.id ?? 'base'}`;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activo = Boolean(effectiveUser?.id) && !roleSelectionRequired && !pathname.startsWith('/poa');

  // Pedidos ya enviados en esta pestaña (para no reclamar dos veces el mismo).
  const pedidosRef = useRef(new Set());
  const consultandoRef = useRef(false);
  // navigate cambia en cada ruta: el botón del aviso usa siempre el actual.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  const mostrar = useCallback((avisos) => {
    const visibles = avisos.slice(-MAXIMO_A_LA_VEZ);
    const resto = avisos.length - visibles.length;
    if (resto > 0) {
      mostrarAviso({ texto: `Tienes ${resto} novedades más en tus fondos de tiempo.`, id: `avisos-resto-${avisos[0].id}` });
    }
    visibles.forEach((aviso) => mostrarAviso({
      id: `aviso-${aviso.id}`,
      texto: aviso.texto,
      tono: aviso.tono,
      alVer: () => navigateRef.current(`/fondo-tiempo/fondo/${aviso.fondo_id}`),
    }));
  }, []);

  // Reclama los avisos y muestra solo los que el servidor marca como recién vistos.
  const reclamarYMostrar = useCallback(async (avisos) => {
    const candidatos = avisos.filter((aviso) => !pedidosRef.current.has(aviso.id));
    if (candidatos.length === 0) return;
    candidatos.forEach((aviso) => pedidosRef.current.add(aviso.id));
    try {
      const { data } = await api.post('/fondos-tiempo/novedades/vistos/', { ids: candidatos.map((aviso) => aviso.id) });
      const nuevos = new Set(data.nuevos || []);
      mostrar(candidatos.filter((aviso) => nuevos.has(aviso.id)));
    } catch {
      // Sin red o sesión vencida: se podrán pedir de nuevo en la próxima consulta.
      candidatos.forEach((aviso) => pedidosRef.current.delete(aviso.id));
    }
  }, [mostrar]);

  const consultar = useCallback(async () => {
    if (!activo || consultandoRef.current) return;
    consultandoRef.current = true;
    try {
      const { data } = await api.get('/fondos-tiempo/novedades/');
      await reclamarYMostrar(data.avisos || []);
    } catch {
      // Sin red o sesión vencida: se reintenta en la próxima consulta.
    } finally {
      consultandoRef.current = false;
    }
  }, [activo, reclamarYMostrar]);

  // Al entrar, al salir del POA y al cambiar de usuario o de rol activo (lo pedido en
  // otro rol no cuenta: allí puede ser otro aviso).
  useEffect(() => {
    pedidosRef.current = new Set();
  }, [rolActivo]);
  useEffect(() => {
    consultar();
  }, [consultar, rolActivo]);

  useConsultaConRespaldo(consultar, CONSULTA_MS, activo);

  // Por el socket. Dentro del POA se ignoran: siguen sin ver y la consulta de
  // entrada los trae al volver.
  useMensajes('aviso', ({ aviso }) => {
    if (activo && aviso) reclamarYMostrar([aviso]);
  });

  return null;
}
