import { useEffect, useRef, useState } from 'react';
import video1Mp4 from '../../assets/videos/video1.mp4';
import video1Webm from '../../assets/videos/video1.webm';
import video1Poster from '../../assets/videos/video1-poster.webp';
import video2Mp4 from '../../assets/videos/video2.mp4';
import video2Webm from '../../assets/videos/video2.webm';
import video2Poster from '../../assets/videos/video2-poster.webp';
import video3Mp4 from '../../assets/videos/video3.mp4';
import video3Webm from '../../assets/videos/video3.webm';
import video3Poster from '../../assets/videos/video3-poster.webp';
import video4Mp4 from '../../assets/videos/video4.mp4';
import video4Webm from '../../assets/videos/video4.webm';
import video4Poster from '../../assets/videos/video4-poster.webp';
import video5Mp4 from '../../assets/videos/video5.mp4';
import video5Webm from '../../assets/videos/video5.webm';
import video5Poster from '../../assets/videos/video5-poster.webp';

// Videos de parabas del panel del login, uno tras otro en bucle. Dos reproductores se turnan: el
// siguiente arranca antes de que termine el actual y se funden durante FUNDIDO segundos, así el
// cambio de video no tiene corte. Sin sonido (los archivos no traen audio). Cada video está en WebM
// (VP9) y MP4 (H.264): se usa WebM si el navegador lo reproduce. Mientras carga se ve el poster (su
// primer cuadro); con prefers-reduced-motion solo se muestra el poster del primero.

// `foco`: object-position de cada video, en el punto donde están las cabezas (mirado cuadro a cuadro),
// para que en la franja baja del celular se vean los loros y no las ramas.
const VIDEOS = [
  { mp4: video2Mp4, webm: video2Webm, poster: video2Poster, foco: '50% 42%' },
  { mp4: video3Mp4, webm: video3Webm, poster: video3Poster, foco: '50% 30%' },
  { mp4: video4Mp4, webm: video4Webm, poster: video4Poster, foco: '50% 22%' },
  { mp4: video5Mp4, webm: video5Webm, poster: video5Poster, foco: '40% 35%' },
  { mp4: video1Mp4, webm: video1Webm, poster: video1Poster, foco: '55% 40%' },
];
const FUNDIDO = 1.4; // segundos

function usaWebm() {
  if (typeof document === 'undefined') return false;
  return document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== '';
}

function prefiereSinMovimiento() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function VideosParabas({ className = '' }) {
  const [quieto, setQuieto] = useState(prefiereSinMovimiento);

  useEffect(() => {
    const consulta = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!consulta) return undefined;
    const alCambiar = () => setQuieto(consulta.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  if (quieto) {
    return (
      <div className={className} aria-hidden="true">
        <img
          src={VIDEOS[0].poster}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: VIDEOS[0].foco }}
        />
      </div>
    );
  }
  return <Reproductores className={className} />;
}

function Reproductores({ className }) {
  const jugadorA = useRef(null);
  const jugadorB = useRef(null);
  const estado = useRef({ actual: 0, indice: [0, 1], cambiando: false });
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const jugadores = [jugadorA.current, jugadorB.current];
    const e = estado.current;
    const formato = usaWebm() ? 'webm' : 'mp4';
    let espera = 0;
    const cargar = (v, i) => {
      v.poster = VIDEOS[i].poster;
      v.src = VIDEOS[i][formato];
      v.style.objectPosition = VIDEOS[i].foco;
      v.load();
    };
    jugadores.forEach((v, n) => {
      v.muted = true;
      cargar(v, e.indice[n]);
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
        cargar(v, e.indice[n]);
        e.cambiando = false;
      }, FUNDIDO * 1000 + 150);
    };
    // El cambio se dispara antes del final: `loop` solo cubre que un video siga si el otro no carga.
    const quitar = jugadores.map((v, n) => {
      const alAvanzar = () => {
        if (v.duration && v.currentTime >= v.duration - FUNDIDO) cambiar(n);
      };
      v.addEventListener('timeupdate', alAvanzar);
      return () => v.removeEventListener('timeupdate', alAvanzar);
    });
    jugadorA.current.play().catch(() => {});
    return () => {
      window.clearTimeout(espera);
      quitar.forEach((fn) => fn());
    };
  }, []);

  const clase = 'absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out';
  return (
    <div className={className} aria-hidden="true">
      {[jugadorA, jugadorB].map((ref, n) => (
        <video
          key={n}
          ref={ref}
          muted
          autoPlay={n === 0}
          loop
          playsInline
          preload="auto"
          poster={VIDEOS[n].poster}
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
