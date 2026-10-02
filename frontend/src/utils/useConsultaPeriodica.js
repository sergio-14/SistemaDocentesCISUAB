import { useEffect, useRef } from 'react';

/**
 * Ejecuta `consultar` cada `intervaloMs` mientras la pestaña está visible.
 * Con la pestaña oculta el temporizador se detiene (no hay consultas al
 * servidor); al volver, consulta en el acto y retoma el intervalo. Se detiene
 * también al salir de la pantalla (desmontar) o si `activo` es false.
 */
export default function useConsultaPeriodica(consultar, intervaloMs, activo = true) {
  const consultarRef = useRef(consultar);

  useEffect(() => {
    consultarRef.current = consultar;
  });

  useEffect(() => {
    if (!activo) return undefined;
    let intervalo = null;

    const iniciar = () => {
      if (intervalo === null) intervalo = window.setInterval(() => consultarRef.current(), intervaloMs);
    };
    const detener = () => {
      window.clearInterval(intervalo);
      intervalo = null;
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        consultarRef.current();
        iniciar();
      } else {
        detener();
      }
    };

    if (document.visibilityState === 'visible') iniciar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      detener();
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [intervaloMs, activo]);
}
