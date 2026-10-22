import { useEffect, useRef, useState } from 'react';
import video1 from '../../assets/videos/video1.mp4';
import video2 from '../../assets/videos/video2.mp4';
import video3 from '../../assets/videos/video3.mp4';
import video4 from '../../assets/videos/video4.mp4';
import video5 from '../../assets/videos/video5.mp4';

// Videos de parabas del panel del login, uno tras otro en bucle. Dos reproductores se turnan: el
// siguiente arranca antes de que termine el actual y se funden durante FUNDIDO segundos, así el
// cambio de video no tiene corte. Sin sonido.

const VIDEOS = [video2, video3, video4, video5, video1];
const FUNDIDO = 1.4; // segundos

function VideosParabas({ className = '' }) {
  const jugadorA = useRef(null);
  const jugadorB = useRef(null);
  const estado = useRef({ actual: 0, indice: [0, 1], cambiando: false });
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const jugadores = [jugadorA.current, jugadorB.current];
    const e = estado.current;
    let espera = 0;
    jugadores.forEach((v, n) => {
      v.muted = true;
      v.src = VIDEOS[e.indice[n]];
      v.load();
    });

    const cambiar = (n) => {
      if (n !== e.actual || e.cambiando) return;
      e.cambiando = true;
      const otro = 1 - n;
      const siguiente = jugadores[otro];
      siguiente.currentTime = 0;
      siguiente.play().catch(() => {});
      e.actual = otro;
      setVisible(otro);
      // Terminado el fundido, el que se ocultó carga el video que sigue.
      espera = window.setTimeout(() => {
        const v = jugadores[n];
        v.pause();
        e.indice[n] = (e.indice[otro] + 1) % VIDEOS.length;
        v.src = VIDEOS[e.indice[n]];
        v.load();
        e.cambiando = false;
      }, FUNDIDO * 1000 + 150);
    };
    const quitar = jugadores.map((v, n) => {
      const alAvanzar = () => {
        if (v.duration && v.currentTime >= v.duration - FUNDIDO) cambiar(n);
      };
      const alTerminar = () => cambiar(n);
      v.addEventListener('timeupdate', alAvanzar);
      v.addEventListener('ended', alTerminar);
      return () => {
        v.removeEventListener('timeupdate', alAvanzar);
        v.removeEventListener('ended', alTerminar);
      };
    });
    return () => {
      window.clearTimeout(espera);
      quitar.forEach((fn) => fn());
    };
  }, []);

  // Arranca el primero en cuanto el componente aparece.
  useEffect(() => {
    jugadorA.current.play().catch(() => {});
  }, []);

  const clase = 'absolute inset-0 h-full w-full object-cover object-[center_45%] transition-opacity ease-in-out';
  return (
    <div className={className} aria-hidden="true">
      {[jugadorA, jugadorB].map((ref, n) => (
        <video
          key={n}
          ref={ref}
          muted
          playsInline
          preload="auto"
          className={clase}
          // El nuevo aparece encima mientras el anterior sigue entero debajo; recién al terminar el
          // fundido el anterior se oculta, así nunca se ve el fondo a medio cambio.
          style={visible === n
            ? { opacity: 1, zIndex: 2, transitionDuration: `${FUNDIDO}s`, transitionDelay: '0s' }
            : { opacity: 0, zIndex: 1, transitionDuration: '0s', transitionDelay: `${FUNDIDO}s` }}
        />
      ))}
    </div>
  );
}

export default VideosParabas;
