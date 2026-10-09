import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { getFondosTiempo } from '../apis/api';
import { useActiveRole } from '../contexts/activeRole';
import useConsultaPeriodica from './useConsultaPeriodica';

const CONSULTA_MS = 30000;

const nombres = (fondos) => fondos.map((fondo) => fondo.docente_nombre).join(', ');

/*
 * Por rol, los estados a los que llega un fondo que conviene avisar.
 * - pendiente: el fondo espera una acción de este rol; se avisa aunque no se
 *   conociera su estado anterior (p. ej. al entrar por primera vez).
 * - excluirPropio: no se avisa del fondo propio (el del Director lo revisa el superusuario).
 * - salvoDesde: estados anteriores desde los que no se avisa.
 * - uno(fondo, estadoAnterior) / varios(fondos): texto del toast.
 */
const AVISOS_POR_ROL = {
  director: [
    {
      estado: 'presentado_director',
      pendiente: true,
      excluirPropio: true,
      uno: (fondo) => `${fondo.docente_nombre} presentó su fondo de tiempo ${fondo.gestion}. Revísalo para aprobarlo u observarlo.`,
      varios: (fondos) => `Tienes ${fondos.length} fondos de tiempo nuevos por revisar: ${nombres(fondos)}.`,
    },
  ],
  jefe_estudios: [
    {
      estado: 'observado',
      pendiente: true,
      uno: (fondo) => `El fondo de tiempo ${fondo.gestion} de ${fondo.docente_nombre} recibió observaciones. Revísalas para corregirlo.`,
      varios: (fondos) => `${fondos.length} fondos de tiempo recibieron observaciones: ${nombres(fondos)}. Revísalas para corregirlos.`,
    },
    {
      estado: 'aprobado_director',
      uno: (fondo) => `El fondo de tiempo ${fondo.gestion} de ${fondo.docente_nombre} fue aprobado.`,
      varios: (fondos) => `Se aprobaron ${fondos.length} fondos de tiempo: ${nombres(fondos)}.`,
    },
    {
      estado: 'en_ejecucion',
      // Al observarse un informe el fondo vuelve a ejecución: eso no es un inicio.
      salvoDesde: ['informe_presentado'],
      uno: (fondo, estadoAnterior) => (estadoAnterior === 'aprobado_director'
        ? `El fondo de tiempo ${fondo.gestion} de ${fondo.docente_nombre} se puso en ejecución.`
        : `El fondo de tiempo ${fondo.gestion} de ${fondo.docente_nombre} fue aprobado y puesto en ejecución.`),
      varios: (fondos) => `${fondos.length} fondos de tiempo se pusieron en ejecución: ${nombres(fondos)}.`,
    },
  ],
};

const leerEstados = (clave) => {
  try {
    const guardado = JSON.parse(localStorage.getItem(clave) || 'null');
    return guardado && typeof guardado === 'object' && !Array.isArray(guardado) ? guardado : {};
  } catch {
    return {};
  }
};

const guardarEstados = (clave, estados) => {
  try {
    localStorage.setItem(clave, JSON.stringify(estados));
  } catch {
    // Sin almacenamiento, se recuerda solo mientras la página esté abierta.
  }
};

/**
 * Avisa con un toast cuando un fondo de la carrera llega a un estado que le
 * importa al rol activo: al Director, un fondo presentado para revisar; al Jefe
 * de Estudios, un fondo observado, aprobado o puesto en ejecución.
 * Consulta cada 30 s (pausado con la pestaña oculta) y recuerda el último estado
 * visto de cada fondo por usuario, rol y carrera: se avisa cada vez que un fondo
 * cambia a uno de esos estados, nunca dos veces por el mismo cambio.
 */
export default function useAvisoFondosPorAtender() {
  const { activeRole, activeCareerId, effectiveUser } = useActiveRole();
  const avisos = AVISOS_POR_ROL[activeRole];
  const docentePropio = effectiveUser?.perfil?.docente;
  const clave = `fondos_estados_vistos_${activeRole}_${effectiveUser?.id}_${activeCareerId}`;
  const estadosRef = useRef(null);
  const consultandoRef = useRef(false);

  useEffect(() => {
    estadosRef.current = leerEstados(clave);
  }, [clave]);

  const revisar = async () => {
    if (!avisos || consultandoRef.current) return;
    consultandoRef.current = true;
    try {
      const data = await getFondosTiempo();
      const fondos = (Array.isArray(data) ? data : [])
        .filter((fondo) => String(fondo.carrera) === String(activeCareerId));
      const vistos = estadosRef.current || leerEstados(clave);

      avisos.forEach((aviso) => {
        const nuevos = fondos.filter((fondo) => {
          const anterior = vistos[fondo.id];
          if (fondo.estado !== aviso.estado || anterior === fondo.estado) return false;
          if (anterior === undefined && !aviso.pendiente) return false;
          if (aviso.salvoDesde?.includes(anterior)) return false;
          return !(aviso.excluirPropio && String(fondo.docente) === String(docentePropio));
        });
        if (nuevos.length === 1) toast(aviso.uno(nuevos[0], vistos[nuevos[0].id]));
        else if (nuevos.length > 1) toast(aviso.varios(nuevos));
      });

      const estados = Object.fromEntries(fondos.map((fondo) => [fondo.id, fondo.estado]));
      estadosRef.current = estados;
      guardarEstados(clave, estados);
    } catch (err) {
      console.warn('No se pudo revisar si hay fondos nuevos por atender:', err);
    } finally {
      consultandoRef.current = false;
    }
  };

  useEffect(() => {
    revisar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se revisa al entrar y al cambiar de rol o carrera.
  }, [clave]);

  useConsultaPeriodica(revisar, CONSULTA_MS, Boolean(avisos));
}
