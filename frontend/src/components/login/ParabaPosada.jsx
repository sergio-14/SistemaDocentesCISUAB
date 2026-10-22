import { useEffect, useRef } from 'react';

// Paraba barba azul (Ara glaucogularis, del Beni) posada en una rama, en el estilo plano del modelo,
// que reacciona al formulario del login (como los avatares que miran el campo):
//   reposo         nada escrito ni enfocado: ojos cerrados; mira a los lados, se pica el pecho,
//                  estira el ala, se esponja y se acomoda en la rama, en un ciclo.
//   mirando        escribiendo en un campo: se inclina un poco hacia él y las pupilas siguen el texto.
//   ojos-cerrados  la contraseña está a la vista: cierra los ojos y aparta la cabeza.
//   atento         campos llenos sin foco: quieta, parpadeando.
// Cada parte va con un resorte hacia su pose (60 cuadros por segundo, sin saltos entre estados) más
// un movimiento continuo (respira, se balancea y la cola sigue con retraso). La cabeza gira con
// profundidad: la cara, el ojo y el pico se corren dentro de ella y el pico se acorta, sin espejarse.
// Con prefers-reduced-motion toma la pose de cada estado sin animar.

// Puntos de giro, en las coordenadas del dibujo. El viewBox deja margen alrededor del ave para que
// ningún movimiento se salga del cuadro, y a la derecha lugar para el ala estirada y la rama.
const PATAS = [190, 505];
const CUELLO = [150, 178];
const CENTRO_CABEZA = [132, 100];
const PICO = [100, 130];
const HOMBRO = [212, 176];
const BASE_COLA = [240, 505];
const OJO = [134, 72];

const POSE_BASE = {
  cuerpoGiro: 0, cuerpoX: 1, cuerpoY: 1,
  cabezaGiro: 0, cabezaX: 0, cabezaY: 0, rasgosX: 0, picoEscala: 1,
  alaGiro: 0, alaEscala: 1, colaGiro: 0, plumon: 0, pata: 0, ojo: 1, pupila: 0,
};

const POSES = {
  atento: {},
  mirando: { cuerpoGiro: -4, cabezaGiro: 6, cabezaX: -6, cabezaY: 4, rasgosX: -5, picoEscala: 1.04 },
  'ojos-cerrados': { cuerpoGiro: 2, cabezaGiro: -16, cabezaX: 6, cabezaY: -6, rasgosX: 9, picoEscala: 0.82, ojo: 0 },
  reposo: { ojo: 0 },
};

// Ciclo de reposo (segundos): cada acción entra y sale con una rampa suave.
const CICLO = 17;
const ACCIONES = [
  // Mira a un lado y al otro.
  { desde: 1.4, hasta: 2.9, pose: { ojo: 1, cabezaGiro: 12, rasgosX: -7, picoEscala: 1.05 } },
  { desde: 2.9, hasta: 4.3, pose: { ojo: 1, cabezaGiro: -10, rasgosX: 8, picoEscala: 0.88 } },
  // Se pica las plumas del pecho.
  { desde: 5.0, hasta: 8.0, pose: { cabezaGiro: 34, cabezaX: -4, cabezaY: 30, rasgosX: 4, picoEscala: 0.95, cuerpoGiro: 2 } },
  // Estira el ala y la mira.
  { desde: 8.7, hasta: 10.7, pose: { ojo: 1, alaGiro: -27, alaEscala: 1.05, cuerpoGiro: -3, cabezaGiro: -6, rasgosX: 7, picoEscala: 0.9, colaGiro: 4 } },
  // Se esponja.
  { desde: 11.4, hasta: 13.0, pose: { cuerpoX: 1.08, cuerpoY: 1.05, plumon: 1, cabezaY: -12 } },
  // Levanta una pata y se acomoda en la rama.
  { desde: 13.7, hasta: 14.5, pose: { ojo: 1, pata: -18, cuerpoGiro: -4 } },
  { desde: 14.5, hasta: 15.4, pose: { ojo: 1, cuerpoGiro: 3 } },
];

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
        const base = POSES.reposo[clave] ?? POSE_BASE[clave];
        pose[clave] += (valor - base) * peso;
      }
    }
  }
  return pose;
}

// Movimiento que no pasa por el resorte: respiración, balanceo, picoteo y parpadeo.
function movimientoDirecto(estado, t) {
  const m = {
    cuerpoGiro: 1.1 * Math.sin((2 * Math.PI * t) / 5.6),
    cuerpoY: 0.012 * Math.sin((2 * Math.PI * t) / 3.4),
    colaGiro: 2.4 * Math.sin((2 * Math.PI * t) / 5.6 - 0.9),
    cabezaY: 1.6 * Math.sin((2 * Math.PI * t) / 3.4 + 0.6),
    cabezaGiro: 0,
    ojo: 1,
  };
  if (estado === 'reposo') {
    const c = t % CICLO;
    m.cabezaGiro += 6 * ventana(c, 5.6, 7.6, 0.3) * Math.sin(2 * Math.PI * 3 * c);
  }
  // Parpadeo cada 3,8 s, de 160 ms.
  const p = t % 3.8;
  if (p < 0.16) m.ojo = 1 - Math.sin((Math.PI * p) / 0.16);
  return m;
}

const alrededor = ([x, y], interior) => `translate(${x} ${y}) ${interior} translate(${-x} ${-y})`;

function ParabaPosada({ estado = 'reposo', seguimiento = 0, className = '' }) {
  const refs = {
    ave: useRef(null), cuerpo: useRef(null), cabeza: useRef(null), rasgos: useRef(null), pico: useRef(null),
    brillo: useRef(null), ala: useRef(null), cola: useRef(null), plumon: useRef(null), pata: useRef(null),
    ojoAbierto: useRef(null), ojoCerrado: useRef(null), pupila: useRef(null),
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
          // Resorte: rígido 80, amortiguado 14 (llega suave y con un leve rebote).
          velocidad[k] += ((objetivo[k] - actual[k]) * 80 - velocidad[k] * 14) * dt;
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
        `translate(${actual.cabezaX} ${actual.cabezaY + d.cabezaY}) rotate(${actual.cabezaGiro + d.cabezaGiro} ${CUELLO[0]} ${CUELLO[1]})`,
      );
      // Giro con profundidad: los rasgos se corren, la cabeza se angosta apenas y el brillo va al revés.
      const giro = actual.rasgosX;
      refs.rasgos.current?.setAttribute('transform', alrededor(CENTRO_CABEZA, `translate(${giro} 0) scale(${1 - Math.abs(giro) * 0.008} 1)`));
      refs.pico.current?.setAttribute('transform', alrededor(PICO, `scale(${actual.picoEscala} 1)`));
      refs.brillo.current?.setAttribute('transform', `translate(${-giro * 0.6} 0)`);
      refs.plumon.current?.setAttribute('opacity', Math.max(0, actual.plumon).toFixed(3));
      refs.pata.current?.setAttribute('transform', `translate(0 ${actual.pata})`);
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
    <svg className={className} viewBox="-20 -24 540 760" overflow="visible" aria-hidden="true" focusable="false">
      <defs>
        {/* Cuerpo: azul en el lomo y el cuello, amarillo dorado en el pecho y el vientre. */}
        <linearGradient id="pb-cuerpo" x1="0" y1="150" x2="0" y2="520" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2a9fd6" />
          <stop offset="0.15" stopColor="#2a9fd6" />
          <stop offset="0.25" stopColor="#f7c84a" />
          <stop offset="0.7" stopColor="#efa524" />
          <stop offset="1" stopColor="#d98912" />
        </linearGradient>
        <radialGradient id="pb-volumen" cx="0.32" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1f3a" stopOpacity="0.28" />
        </radialGradient>
        <radialGradient id="pb-cabeza" cx="0.35" cy="0.25" r="0.85">
          <stop offset="0" stopColor="#5cd0e4" />
          <stop offset="0.5" stopColor="#2a9fd6" />
          <stop offset="1" stopColor="#17649f" />
        </radialGradient>
        <linearGradient id="pb-ala-alta" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#36a6dc" />
          <stop offset="1" stopColor="#1d6db4" />
        </linearGradient>
        <linearGradient id="pb-banda" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fd3d9" />
          <stop offset="1" stopColor="#21a3bd" />
        </linearGradient>
        <linearGradient id="pb-ala-baja" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#1f5fae" />
          <stop offset="1" stopColor="#123271" />
        </linearGradient>
        <linearGradient id="pb-cola" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#2178c0" />
          <stop offset="1" stopColor="#153f88" />
        </linearGradient>
        <linearGradient id="pb-pico" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4a4f" />
          <stop offset="1" stopColor="#141416" />
        </linearGradient>
        <linearGradient id="pb-rama" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3f2b" />
          <stop offset="1" stopColor="#24180f" />
        </linearGradient>
        <filter id="pb-sombra" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      <ellipse cx="290" cy="562" rx="200" ry="16" fill="#1e293b" opacity="0.12" filter="url(#pb-sombra)" />

      <g ref={refs.ave}>
        <g ref={refs.cola}>
          <path d="M210,500 C238,560 286,624 322,688 C330,702 350,708 366,696 C372,690 368,676 360,662 C328,600 292,548 268,500 Z" fill="url(#pb-cola)" />
          <path d="M240,520 C268,570 300,620 330,672" fill="none" stroke="#0f2f66" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
        </g>

        <g ref={refs.cuerpo}>
          <path d="M70,240 C56,300 60,384 88,452 C98,472 118,476 124,458 C112,400 108,320 112,252 Z" fill="url(#pb-ala-baja)" />
          <path d="M62,150 C40,230 58,350 96,440 C116,488 168,512 222,512 C262,512 300,496 304,470 C300,380 262,250 220,170 C190,120 110,110 62,150 Z" fill="url(#pb-cuerpo)" />
          <path d="M62,150 C40,230 58,350 96,440 C116,488 168,512 222,512 C262,512 300,496 304,470 C300,380 262,250 220,170 C190,120 110,110 62,150 Z" fill="url(#pb-volumen)" />
          <g ref={refs.plumon} opacity="0">
            <path d="M52,268 q-16,6 -8,20 q8,-2 12,-4 Z" fill="#f5c040" />
            <path d="M60,334 q-16,8 -6,20 q8,-4 11,-6 Z" fill="#f0ae2c" />
            <path d="M80,404 q-15,10 -4,20 q7,-5 10,-8 Z" fill="#e89d1e" />
            <path d="M118,470 q-10,14 4,20 q4,-7 6,-11 Z" fill="#dc9016" />
          </g>
          <g ref={refs.ala}>
            <path d="M200,165 C238,170 280,200 294,240 L300,300 C270,290 236,282 214,290 C200,250 194,200 200,165 Z" fill="url(#pb-ala-alta)" />
            <path d="M286,486 C292,520 300,548 306,566 C312,546 316,516 314,490 Z" fill="#0f2a5e" />
            <path d="M262,470 C264,500 270,530 278,550 C286,528 290,500 288,476 Z" fill="#12306a" />
            <path d="M214,280 C250,272 290,280 300,300 C316,360 330,430 322,480 C318,500 300,506 290,492 C262,440 232,360 214,280 Z" fill="url(#pb-ala-baja)" />
            <path d="M206,236 C240,232 282,238 300,260 L305,300 C297,314 286,300 276,313 C266,326 254,310 244,322 C232,333 222,317 211,324 C205,296 203,266 206,236 Z" fill="url(#pb-banda)" />
            <path d="M196,160 C188,210 196,260 214,300 C240,360 270,430 300,500" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
          </g>
        </g>

        <g ref={refs.cabeza}>
          <path d="M30,92 C30,32 90,2 150,12 C210,22 242,72 234,132 C228,176 192,202 150,202 C100,202 50,172 30,122 Z" fill="url(#pb-cabeza)" />
          <path ref={refs.brillo} d="M80,30 C110,14 160,14 196,34" fill="none" stroke="#8fe3ee" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
          <g ref={refs.rasgos}>
            <path d="M100,60 C110,36 150,30 172,50 C186,64 182,100 168,126 C156,148 130,156 112,146 C96,136 90,90 100,60 Z" fill="#f7f3ea" />
            <path d="M112,96 l14,2 M114,108 l14,2 M120,120 l12,1 M126,131 l10,0" stroke="#1d3f74" strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
            <g ref={refs.ojoAbierto} opacity="0">
              <circle cx={OJO[0]} cy={OJO[1]} r="9" fill="#f3d36c" />
              <g ref={refs.pupila}>
                <circle cx={OJO[0]} cy={OJO[1]} r="5" fill="#111111" />
                <circle cx={OJO[0] - 1.8} cy={OJO[1] - 2} r="1.6" fill="#ffffff" />
              </g>
            </g>
            <path ref={refs.ojoCerrado} d="M118,70 Q133,82 150,68" fill="none" stroke="#1f1f1f" strokeWidth="4.5" strokeLinecap="round" />
            {/* Garganta azul (la "barba" que le da el nombre). */}
            <path d="M96,168 C110,186 140,192 162,180 C150,200 116,204 96,188 Z" fill="#1c4d93" />
            <g ref={refs.pico}>
              <path d="M60,82 C30,82 14,110 18,140 C22,166 40,184 58,188 C52,170 54,150 66,140 C80,128 98,118 104,100 C98,86 80,80 60,82 Z" fill="url(#pb-pico)" />
              <path d="M40,100 C34,112 32,128 36,142" fill="none" stroke="#8a8a92" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
              <path d="M62,142 C66,160 82,176 104,176 C118,176 126,166 124,154 C112,142 90,132 70,132 Z" fill="#0d0d0e" />
            </g>
          </g>
        </g>
      </g>

      <path d="M70,486 C150,474 300,482 520,508 L520,540 C300,516 150,512 78,520 C58,522 54,490 70,486 Z" fill="url(#pb-rama)" />
      <path d="M90,492 C160,484 300,490 510,514" fill="none" stroke="#7a5a40" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      <path d="M410,512 C424,494 440,486 462,480" fill="none" stroke="#3a2a1d" strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="466" cy="476" rx="16" ry="7" transform="rotate(-24 466 476)" fill="#4f7a3a" />
      <path d="M128,470 C124,490 126,515 140,530 C152,534 164,526 164,512 C164,494 160,476 152,466 Z" fill="#52525b" />
      <g ref={refs.pata}>
        <path d="M210,478 C206,498 210,525 226,540 C238,544 252,536 252,520 C252,500 246,484 236,474 Z" fill="#52525b" />
      </g>
    </svg>
  );
}

export default ParabaPosada;
