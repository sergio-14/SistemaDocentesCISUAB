import { useEffect, useRef } from 'react';

// Guacamayo rojo posado en una rama, en el estilo plano del modelo, que reacciona al formulario
// del login (como los avatares que miran el campo y se tapan los ojos con la contraseña):
//   reposo         nada escrito ni enfocado: ojos cerrados; se acicala, estira el ala, se esponja
//                  y se sacude, en un ciclo.
//   mirando        en el usuario: gira la cabeza hacia el campo y las pupilas siguen el texto.
//   ojos-cerrados  en la contraseña: cierra los ojos y voltea la cabeza hacia el otro lado.
//   atento         campos llenos sin foco: quieto, parpadeando.
// Cada parte se mueve con un resorte hacia su pose (60 cuadros por segundo, sin saltos entre
// estados) más un movimiento continuo (respira, se balancea y la cola sigue con retraso).
// Con prefers-reduced-motion toma la pose de cada estado sin animar.

// Puntos de giro, en las coordenadas del dibujo (viewBox 500 × 760: a la derecha queda lugar para
// que el ala se estire y la rama llegue al borde del panel).
const PATAS = [190, 505];
const CUELLO = [150, 178];
const HOMBRO = [212, 176];
const BASE_COLA = [240, 505];
const OJO = [134, 72];

const POSE_BASE = {
  cuerpoGiro: 0, cuerpoX: 1, cuerpoY: 1,
  cabezaGiro: 0, cabezaX: 0, cabezaY: 0, cabezaVuelta: 1,
  alaGiro: 0, alaEscala: 1, colaGiro: 0, plumon: 0, ojo: 1, pupila: 0,
};

const POSES = {
  atento: {},
  mirando: { cabezaGiro: 7, cabezaX: -8, cabezaY: 6, cuerpoGiro: -2 },
  'ojos-cerrados': { cabezaGiro: -13, cabezaX: 10, cabezaY: -6, cabezaVuelta: -1, cuerpoGiro: 2, ojo: 0 },
  reposo: { ojo: 0 },
};

// Ciclo de reposo (segundos): cada acción entra y sale con una rampa suave.
const CICLO = 14;
const ACCIONES = [
  { desde: 1.8, hasta: 5.0, pose: { cabezaVuelta: -1, cabezaGiro: 40, cabezaX: 16, cabezaY: 22, cuerpoGiro: 2 } },
  { desde: 5.8, hasta: 7.9, pose: { alaGiro: -27, alaEscala: 1.05, cuerpoGiro: -3, cabezaGiro: -8, colaGiro: 4 } },
  { desde: 8.6, hasta: 10.2, pose: { cuerpoX: 1.08, cuerpoY: 1.05, plumon: 1, cabezaY: -12 } },
];
const SACUDIDA = { desde: 10.5, hasta: 11.5 };

const suave = (x) => x * x * (3 - 2 * x);
function ventana(t, desde, hasta, rampa = 0.45) {
  if (t <= desde || t >= hasta) return 0;
  return suave(Math.min(1, (t - desde) / rampa, (hasta - t) / rampa));
}

function poseObjetivo(estado, t, seguimiento) {
  const pose = { ...POSE_BASE, ...POSES[estado] };
  if (estado === 'mirando') pose.pupila = -4 + 7 * seguimiento;
  if (estado === 'reposo') {
    const c = t % CICLO;
    for (const accion of ACCIONES) {
      const peso = ventana(c, accion.desde, accion.hasta);
      if (!peso) continue;
      for (const [clave, valor] of Object.entries(accion.pose)) {
        pose[clave] += (valor - POSE_BASE[clave]) * peso;
      }
    }
  }
  return pose;
}

// Movimiento que no pasa por el resorte: respiración, balanceo, picoteo, sacudida y parpadeo.
function movimientoDirecto(estado, t) {
  const m = { cuerpoGiro: 1.1 * Math.sin((2 * Math.PI * t) / 5.6), cuerpoY: 0.012 * Math.sin((2 * Math.PI * t) / 3.4) };
  m.colaGiro = 2.2 * Math.sin((2 * Math.PI * t) / 5.6 - 0.9);
  m.cabezaY = 1.6 * Math.sin((2 * Math.PI * t) / 3.4 + 0.6);
  m.cabezaGiro = 0;
  m.ojo = 1;
  if (estado === 'reposo') {
    const c = t % CICLO;
    const picoteo = ventana(c, 2.6, 4.7, 0.3);
    m.cabezaGiro += 7 * picoteo * Math.sin(2 * Math.PI * 3.1 * c);
    const sacudida = ventana(c, SACUDIDA.desde, SACUDIDA.hasta, 0.2);
    m.cuerpoGiro += 6 * sacudida * Math.sin(2 * Math.PI * 6.5 * c);
    m.cabezaGiro += 9 * sacudida * Math.sin(2 * Math.PI * 6.5 * c - 0.7);
    m.colaGiro += 7 * sacudida * Math.sin(2 * Math.PI * 6.5 * c - 1.4);
  } else {
    // Parpadeo cada 3,8 s, de 160 ms.
    const p = t % 3.8;
    if (p < 0.16) m.ojo = 1 - Math.sin((Math.PI * p) / 0.16);
  }
  return m;
}

const alrededor = ([x, y], interior) => `translate(${x} ${y}) ${interior} translate(${-x} ${-y})`;

function ParabaPosada({ estado = 'reposo', seguimiento = 0, className = '' }) {
  const refs = {
    ave: useRef(null), cuerpo: useRef(null), cabeza: useRef(null), ala: useRef(null),
    cola: useRef(null), plumon: useRef(null), ojoAbierto: useRef(null), ojoCerrado: useRef(null), pupila: useRef(null),
  };
  const entrada = useRef({ estado, seguimiento });
  entrada.current = { estado, seguimiento: Math.min(Math.max(seguimiento, 0), 1) };

  useEffect(() => {
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const actual = { ...POSE_BASE };
    const velocidad = Object.fromEntries(Object.keys(POSE_BASE).map((k) => [k, 0]));
    let anterior = performance.now();
    let cuadro = 0;

    const dibujar = (ahora) => {
      const dt = Math.min((ahora - anterior) / 1000, 1 / 30);
      anterior = ahora;
      const t = ahora / 1000;
      const quieto = reducido?.matches;
      const { estado: e, seguimiento: s } = entrada.current;
      const objetivo = poseObjetivo(e, t, s);
      for (const k of Object.keys(actual)) {
        if (quieto) {
          actual[k] = objetivo[k];
          velocidad[k] = 0;
        } else {
          // Resorte: rígido 95, amortiguado 15 (llega rápido y con un leve rebote).
          velocidad[k] += ((objetivo[k] - actual[k]) * 95 - velocidad[k] * 15) * dt;
          actual[k] += velocidad[k] * dt;
        }
      }
      const d = quieto ? { cuerpoGiro: 0, cuerpoY: 0, colaGiro: 0, cabezaY: 0, cabezaGiro: 0, ojo: 1 } : movimientoDirecto(e, t);
      const ojo = Math.max(0, Math.min(1, actual.ojo * d.ojo));

      refs.ave.current?.setAttribute('transform', `rotate(${actual.cuerpoGiro + d.cuerpoGiro} ${PATAS[0]} ${PATAS[1]})`);
      refs.cuerpo.current?.setAttribute('transform', alrededor(PATAS, `scale(${actual.cuerpoX} ${actual.cuerpoY + d.cuerpoY})`));
      refs.cola.current?.setAttribute('transform', `rotate(${actual.colaGiro + d.colaGiro} ${BASE_COLA[0]} ${BASE_COLA[1]})`);
      refs.ala.current?.setAttribute('transform', alrededor(HOMBRO, `rotate(${actual.alaGiro}) scale(${actual.alaEscala})`));
      refs.cabeza.current?.setAttribute(
        'transform',
        `translate(${actual.cabezaX} ${actual.cabezaY + d.cabezaY}) ${alrededor(CUELLO, `rotate(${actual.cabezaGiro + d.cabezaGiro}) scale(${actual.cabezaVuelta} 1)`)}`,
      );
      refs.plumon.current?.setAttribute('opacity', Math.max(0, actual.plumon).toFixed(3));
      refs.ojoAbierto.current?.setAttribute('transform', alrededor(OJO, `scale(1 ${Math.max(ojo, 0.04)})`));
      refs.ojoAbierto.current?.setAttribute('opacity', ojo < 0.06 ? '0' : '1');
      refs.ojoCerrado.current?.setAttribute('opacity', (1 - ojo).toFixed(3));
      refs.pupila.current?.setAttribute('transform', `translate(${actual.pupila} 0)`);
      cuadro = requestAnimationFrame(dibujar);
    };
    cuadro = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(cuadro);
  // Las refs de los grupos no cambian: el efecto corre una sola vez.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg className={className} viewBox="0 0 500 760" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="gr-rojo" cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#e03a46" />
          <stop offset="0.55" stopColor="#bf1e2e" />
          <stop offset="1" stopColor="#8e1421" />
        </radialGradient>
        <radialGradient id="gr-cabeza" cx="0.35" cy="0.25" r="0.85">
          <stop offset="0" stopColor="#e5404b" />
          <stop offset="1" stopColor="#a8192a" />
        </radialGradient>
        <linearGradient id="gr-naranja" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdb043" />
          <stop offset="1" stopColor="#ee7a15" />
        </linearGradient>
        <linearGradient id="gr-azul" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#2b4f8f" />
          <stop offset="1" stopColor="#172c5c" />
        </linearGradient>
        <linearGradient id="gr-cola" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#b71c2c" />
          <stop offset="1" stopColor="#8a1320" />
        </linearGradient>
        <linearGradient id="gr-rama" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a3424" />
          <stop offset="1" stopColor="#1f150e" />
        </linearGradient>
        <filter id="gr-sombra" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      <ellipse cx="270" cy="560" rx="190" ry="16" fill="#1e293b" opacity="0.12" filter="url(#gr-sombra)" />

      <g ref={refs.ave}>
        <g ref={refs.cola}>
          <path d="M210,500 C238,560 286,624 322,688 C330,702 350,708 366,696 C372,690 368,676 360,662 C328,600 292,548 268,500 Z" fill="url(#gr-cola)" />
          <path d="M240,520 C268,570 300,620 330,672" fill="none" stroke="#7a101c" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
        </g>

        <g ref={refs.cuerpo}>
          <path d="M70,240 C56,300 60,384 88,452 C98,472 118,476 124,458 C112,400 108,320 112,252 Z" fill="url(#gr-azul)" />
          <path d="M62,150 C40,230 58,350 96,440 C116,488 168,512 222,512 C262,512 300,496 304,470 C300,380 262,250 220,170 C190,120 110,110 62,150 Z" fill="url(#gr-rojo)" />
          <g ref={refs.plumon} opacity="0">
            <path d="M52,262 q-16,6 -8,20 q8,-2 12,-4 Z" fill="#c42232" />
            <path d="M60,330 q-16,8 -6,20 q8,-4 11,-6 Z" fill="#c42232" />
            <path d="M80,402 q-15,10 -4,20 q7,-5 10,-8 Z" fill="#b51d2d" />
            <path d="M118,470 q-10,14 4,20 q4,-7 6,-11 Z" fill="#a91a29" />
          </g>
          <g ref={refs.ala}>
            <path d="M200,165 C238,170 280,200 294,240 L300,300 C270,290 236,282 214,290 C200,250 194,200 200,165 Z" fill="url(#gr-rojo)" />
            <path d="M286,486 C292,520 300,548 306,566 C312,546 316,516 314,490 Z" fill="#14254d" />
            <path d="M262,470 C264,500 270,530 278,550 C286,528 290,500 288,476 Z" fill="#172c5c" />
            <path d="M214,280 C250,272 290,280 300,300 C316,360 330,430 322,480 C318,500 300,506 290,492 C262,440 232,360 214,280 Z" fill="url(#gr-azul)" />
            <path d="M206,236 C240,232 282,238 300,260 L305,300 C297,314 286,300 276,313 C266,326 254,310 244,322 C232,333 222,317 211,324 C205,296 203,266 206,236 Z" fill="url(#gr-naranja)" />
            <path d="M196,160 C188,210 196,260 214,300 C240,360 270,430 300,500" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
          </g>
        </g>

        <g ref={refs.cabeza}>
          <path d="M30,92 C30,32 90,2 150,12 C210,22 242,72 234,132 C228,176 192,202 150,202 C100,202 50,172 30,122 Z" fill="url(#gr-cabeza)" />
          <path d="M80,30 C110,14 160,14 196,34" fill="none" stroke="#f0606a" strokeWidth="6" strokeLinecap="round" opacity="0.45" />
          <path d="M100,60 C110,36 150,30 172,50 C186,64 182,100 168,126 C156,148 130,156 112,146 C96,136 90,90 100,60 Z" fill="#ffffff" />
          <g ref={refs.ojoAbierto} opacity="0">
            <circle cx={OJO[0]} cy={OJO[1]} r="9" fill="#f3d36c" />
            <g ref={refs.pupila}>
              <circle cx={OJO[0]} cy={OJO[1]} r="5" fill="#111111" />
              <circle cx={OJO[0] - 1.8} cy={OJO[1] - 2} r="1.6" fill="#ffffff" />
            </g>
          </g>
          <path ref={refs.ojoCerrado} d="M118,70 Q133,82 150,68" fill="none" stroke="#1f1f1f" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M60,82 C30,82 14,110 18,140 C22,166 40,184 58,188 C52,170 54,150 66,140 C80,128 98,118 104,100 C98,86 80,80 60,82 Z" fill="url(#gr-naranja)" />
          <path d="M40,100 C34,112 32,128 36,142" fill="none" stroke="#ffd08a" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
          <path d="M62,142 C66,160 82,176 104,176 C118,176 126,166 124,154 C112,142 90,132 70,132 Z" fill="#141414" />
        </g>
      </g>

      <path d="M70,486 C150,474 300,482 500,506 L500,538 C300,516 150,512 78,520 C58,522 54,490 70,486 Z" fill="url(#gr-rama)" />
      <path d="M90,492 C160,484 300,490 490,512" fill="none" stroke="#6b4c34" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <path d="M410,512 C424,494 440,486 462,480" fill="none" stroke="#2f2117" strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="466" cy="476" rx="16" ry="7" transform="rotate(-24 466 476)" fill="#4f7a3a" />
      <path d="M128,470 C124,490 126,515 140,530 C152,534 164,526 164,512 C164,494 160,476 152,466 Z" fill="url(#gr-naranja)" />
      <path d="M210,478 C206,498 210,525 226,540 C238,544 252,536 252,520 C252,500 246,484 236,474 Z" fill="url(#gr-naranja)" />
    </svg>
  );
}

export default ParabaPosada;
