// Ilustración del login: atardecer en la pampa del Beni (río, isla de monte y palmeras de
// motacú) en estilo pictórico, hecha solo con SVG y degradados, con parabas barba azul
// volando. Sin imágenes ni video. Con prefers-reduced-motion las parabas quedan quietas.

// Generador con semilla fija: las pinceladas del pasto salen iguales en cada carga.
function generador(semilla) {
  let s = semilla;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const azar = generador(20241);
const TONOS_PASTO = ['#b7a866', '#8f8c4c', '#6c7a3e', '#c9ab6e', '#55663a'];

// Pinceladas del pasto: cerca del horizonte (fuera del reflejo del sol) y a los lados del río.
const PINCELADAS = Array.from({ length: 150 }, (_, i) => {
  const cerca = i >= 70;
  const y = cerca ? 560 + azar() * 240 : 488 + azar() * 70;
  let x = azar() * 600;
  if (cerca && x > 185 && x < 470) x = x < 330 ? x - 150 : x + 140;
  if (!cerca && x > 300 && x < 385) x -= 90;
  const alto = (cerca ? 10 + azar() * 22 : 3 + azar() * 6) * (y / 640);
  const inclinacion = (azar() - 0.5) * alto * 0.8;
  return {
    d: `M${x.toFixed(1)},${y.toFixed(1)} q${(inclinacion / 2).toFixed(1)},${(-alto / 2).toFixed(1)} ${inclinacion.toFixed(1)},${(-alto).toFixed(1)}`,
    color: cerca && y > 720 ? '#3a4a2a' : TONOS_PASTO[Math.floor(azar() * TONOS_PASTO.length)],
    ancho: cerca ? 1.4 + azar() * 2.2 : 0.8 + azar() * 1.2,
    opacidad: 0.35 + azar() * 0.4,
  };
});

// Palmera de motacú: tronco curvo que se afina y una corona de hojas arqueadas.
function Palmera({ x, base, altura, curva, escala, tronco, hoja, luz }) {
  const tx = x + curva;
  const ty = base - altura;
  const w0 = 6 * escala;
  const w1 = 3.2 * escala;
  const largo = 95 * escala;
  const troncoD = `M${x - w0},${base} C${x - w0},${base - altura * 0.5} ${tx - w1},${base - altura * 0.7} ${tx - w1},${ty}`
    + ` L${tx + w1},${ty} C${tx + w1},${base - altura * 0.7} ${x + w0},${base - altura * 0.5} ${x + w0},${base} Z`;
  const hojas = [-30, -8, 14, 36, 58, 78, 98, 118, 140, 162, 184, 206].map((grados, i) => {
    const a = (grados * Math.PI) / 180;
    const l = largo * (0.8 + ((i * 37) % 10) / 33);
    const c1x = tx + Math.cos(a) * l * 0.55;
    const c1y = ty - Math.sin(a) * l * 0.55 - l * 0.25;
    const fx = tx + Math.cos(a) * l;
    const fy = ty - Math.sin(a) * l * 0.3 + l * 0.35;
    const grosor = l * 0.22;
    // Foliolos que cuelgan a lo largo de la hoja, como en el motacú (solo en las palmeras cercanas).
    const foliolos = escala < 0.5 ? '' : Array.from({ length: 11 }, (_, k) => {
      const t = 0.18 + k * 0.075;
      const px = (1 - t) * (1 - t) * tx + 2 * (1 - t) * t * c1x + t * t * fx;
      const py = (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * c1y + t * t * fy;
      const f = l * 0.2 * (1 - t * 0.55);
      return `M${px.toFixed(1)},${py.toFixed(1)} q${(Math.cos(a) * f * 0.35).toFixed(1)},${(f * 0.4).toFixed(1)} ${(Math.cos(a) * f * 0.5).toFixed(1)},${f.toFixed(1)}`;
    }).join(' ');
    return {
      cuerpo: `M${tx},${ty} Q${c1x},${c1y} ${fx},${fy} Q${c1x},${c1y + grosor} ${tx},${ty + 2 * escala} Z`,
      borde: `M${tx},${ty} Q${c1x},${c1y} ${fx},${fy}`,
      foliolos,
    };
  });
  return (
    <g>
      <path d={troncoD} fill={tronco} />
      {hojas.map((h, i) => <path key={`c${i}`} d={h.cuerpo} fill={hoja} />)}
      {hojas.map((h, i) => h.foliolos && (
        <path key={`f${i}`} d={h.foliolos} fill="none" stroke={hoja} strokeWidth={2.2 * escala} strokeLinecap="round" />
      ))}
      {luz && hojas.map((h, i) => (
        <path key={`b${i}`} d={h.borde} fill="none" stroke={luz} strokeWidth={1.2 * escala} strokeOpacity="0.22" strokeLinecap="round" />
      ))}
    </g>
  );
}

// Paraba barba azul de perfil, mirando a la derecha: lomo y alas turquesa, pecho amarillo,
// garganta azul y cola larga. Las alas aletean con CSS (clase "pb-ala").
function Paraba({ x0, y, escala, duracion, retraso, aleteo }) {
  return (
    <g
      className="pb-deriva"
      style={{
        '--pb-desde': `${-x0 - 140}px`,
        '--pb-hasta': `${740 - x0}px`,
        animationDuration: `${duracion}s`,
        animationDelay: `${retraso}s`,
      }}
    >
      <g transform={`translate(${x0} ${y}) scale(${escala})`}>
        <g className="pb-balanceo" style={{ animationDelay: `${retraso / 3}s` }}>
          <path d="M-14,4 L-84,22 L-80,15 L-12,0 Z" fill="url(#pb-cola)" />
          <path d="M-14,6 L-76,29 L-73,23 L-12,3 Z" fill="#1a4f8f" />
          <g className="pb-ala" style={{ animationDuration: `${aleteo}s`, animationDelay: `${-aleteo / 4}s` }}>
            <path d="M-4,-1 C-2,-20 10,-38 30,-52 C26,-40 24,-30 28,-24 C20,-22 18,-14 22,-6 C14,-3 6,-1 -4,-1 Z" fill="#175a92" />
          </g>
          <path d="M-16,2 C-8,-10 18,-10 30,-4 C34,2 30,10 20,12 C6,14 -10,10 -16,2 Z" fill="url(#pb-lomo)" />
          <path d="M2,6 C12,2 26,2 30,4 C30,10 24,13 16,13 C8,13 2,10 2,6 Z" fill="url(#pb-pecho)" />
          <circle cx="32" cy="-4" r="8.5" fill="#29a7c1" />
          <circle cx="30" cy="-8" r="4" fill="#4cc6d4" opacity="0.6" />
          <path d="M29,1 C33,4 38,4 40,1 C39,6 33,8 28,5 Z" fill="#1e4f8f" />
          <ellipse cx="35.5" cy="-4" rx="3.6" ry="3" fill="#f3ede2" />
          <circle cx="35.8" cy="-4.3" r="1.15" fill="#1b1b1b" />
          <path d="M39,-6 C45,-6 47,-1 44,4 C43,1 41,0 39,0 Z" fill="#2a2a2a" />
          <g className="pb-ala" style={{ animationDuration: `${aleteo}s` }}>
            <path d="M-10,-1 C-8,-20 4,-38 24,-52 C20,-40 18,-30 22,-24 C14,-22 12,-14 16,-6 C8,-3 0,-1 -10,-1 Z" fill="url(#pb-ala)" />
            <path d="M-6,-3 C-3,-14 4,-22 12,-28 C10,-20 10,-12 12,-5 Z" fill="#3fc4d0" opacity="0.7" />
          </g>
        </g>
      </g>
    </g>
  );
}

const RIO = 'M332,476 C340,475 352,475 358,477 C372,500 330,520 352,548 C380,585 470,600 452,660'
  + ' C440,705 380,740 420,800 L150,800 C200,740 250,700 236,650 C222,600 290,575 300,545 C312,515 318,495 332,476 Z';

function PaisajeBeni({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pb-cielo" x1="0" y1="0" x2="0" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5f7ba6" />
          <stop offset="0.35" stopColor="#9a9bbf" />
          <stop offset="0.62" stopColor="#d9a7a6" />
          <stop offset="0.83" stopColor="#f1bf8c" />
          <stop offset="1" stopColor="#f7d9a4" />
        </linearGradient>
        <radialGradient id="pb-resplandor">
          <stop offset="0" stopColor="#ffe2a8" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffd59a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pb-sol">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.55" stopColor="#ffe3a3" />
          <stop offset="1" stopColor="#ffcf86" stopOpacity="0.9" />
        </radialGradient>
        <linearGradient id="pb-pampa" x1="0" y1="470" x2="0" y2="800" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b9a066" />
          <stop offset="0.25" stopColor="#8f8a50" />
          <stop offset="0.6" stopColor="#5f6e3a" />
          <stop offset="1" stopColor="#36462a" />
        </linearGradient>
        <linearGradient id="pb-rio" x1="0" y1="470" x2="0" y2="800" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f6d29a" />
          <stop offset="0.3" stopColor="#d9aaa6" />
          <stop offset="0.7" stopColor="#8f95bb" />
          <stop offset="1" stopColor="#5c74a0" />
        </linearGradient>
        <radialGradient id="pb-vineta" cx="0.5" cy="0.55" r="0.75">
          <stop offset="0.6" stopColor="#1e2a3a" stopOpacity="0" />
          <stop offset="1" stopColor="#1e2a3a" stopOpacity="0.28" />
        </radialGradient>
        <linearGradient id="pb-lomo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2fb8c8" />
          <stop offset="1" stopColor="#1b7fb0" />
        </linearGradient>
        <linearGradient id="pb-ala" x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" stopColor="#2bb3c4" />
          <stop offset="0.6" stopColor="#1f86b8" />
          <stop offset="1" stopColor="#1a4f95" />
        </linearGradient>
        <linearGradient id="pb-pecho" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7c94a" />
          <stop offset="1" stopColor="#e79a22" />
        </linearGradient>
        <linearGradient id="pb-cola" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a8fc0" />
          <stop offset="1" stopColor="#1d5fa3" />
        </linearGradient>
        <clipPath id="pb-recorte-rio"><path d={RIO} /></clipPath>
        <filter id="pb-difuso" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        {/* Bordes irregulares, como de pincel, para todo el paisaje (no para las parabas). */}
        <filter id="pb-pincel" x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="ruido" />
          <feDisplacementMap in="SourceGraphic" in2="ruido" scale="5" />
        </filter>
      </defs>

      <g filter="url(#pb-pincel)">
        <rect x="-10" y="-10" width="620" height="500" fill="url(#pb-cielo)" />
        <circle cx="350" cy="455" r="240" fill="url(#pb-resplandor)" />
        <circle cx="350" cy="452" r="36" fill="url(#pb-sol)" />

        <g filter="url(#pb-difuso)">
          <ellipse cx="70" cy="90" rx="170" ry="30" fill="#7f8fb8" opacity="0.4" />
          <ellipse cx="120" cy="175" rx="135" ry="24" fill="#f0d0cc" opacity="0.55" />
          <ellipse cx="210" cy="152" rx="90" ry="18" fill="#fbe6da" opacity="0.5" />
          <ellipse cx="470" cy="232" rx="150" ry="22" fill="#e8b6b1" opacity="0.5" />
          <ellipse cx="525" cy="212" rx="80" ry="15" fill="#fde9d6" opacity="0.55" />
          <ellipse cx="300" cy="330" rx="210" ry="16" fill="#f6c9a2" opacity="0.45" />
          <ellipse cx="90" cy="392" rx="140" ry="13" fill="#f8cfa0" opacity="0.5" />
          <ellipse cx="520" cy="402" rx="110" ry="11" fill="#f9d6ac" opacity="0.45" />
        </g>

        <path d="M-10,478 L610,474 L610,810 L-10,810 Z" fill="url(#pb-pampa)" />
        <ellipse cx="320" cy="498" rx="320" ry="14" fill="#f2c88a" opacity="0.35" filter="url(#pb-difuso)" />

        {/* Isla de monte a lo lejos, con la bruma del atardecer, y la franja más cercana. */}
        <path d="M-10,472 C30,462 50,458 70,463 C90,455 115,452 135,461 C150,457 170,459 182,466 L240,470 C260,463 285,461 300,467 L330,476 L-10,482 Z" fill="#8a7591" opacity="0.75" />
        <path d="M372,476 L430,470 C445,460 470,456 490,462 C510,452 540,454 560,463 C575,458 590,459 610,462 L610,482 Z" fill="#8a7591" opacity="0.75" />
        <path d="M-10,488 C25,476 55,474 80,480 C100,472 125,471 140,481 L150,494 L-10,494 Z" fill="#55604c" opacity="0.9" />
        <path d="M470,486 C490,474 520,472 545,479 C565,470 590,472 610,476 L610,496 L460,496 Z" fill="#55604c" opacity="0.9" />

        <path d={RIO} fill="url(#pb-rio)" />
        <g clipPath="url(#pb-recorte-rio)">
          {[
            [345, 486, 14, 2.2, 0.75], [343, 498, 22, 2.4, 0.6], [347, 512, 18, 2, 0.55],
            [340, 528, 30, 2.6, 0.45], [348, 548, 26, 2.2, 0.4], [338, 572, 40, 2.8, 0.32],
            [352, 600, 34, 2.4, 0.26], [330, 634, 56, 3, 0.2], [360, 680, 48, 2.6, 0.15],
          ].map(([cx, cy, rx, ry, op]) => (
            <ellipse key={cy} cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff1c9" opacity={op} />
          ))}
          <path d="M220,700 C260,690 300,705 340,694" stroke="#c9cbe0" strokeWidth="1.5" fill="none" opacity="0.5" />
          <path d="M260,760 C300,748 350,764 400,750" stroke="#c9cbe0" strokeWidth="1.5" fill="none" opacity="0.4" />
        </g>
        <path d={RIO} fill="none" stroke="#3f4a35" strokeOpacity="0.35" strokeWidth="2" />

        {PINCELADAS.map((p, i) => (
          <path key={i} d={p.d} stroke={p.color} strokeWidth={p.ancho} strokeOpacity={p.opacidad} strokeLinecap="round" fill="none" />
        ))}

        <Palmera x={60} base={486} altura={62} curva={3} escala={0.3} tronco="#6f6378" hoja="#6f6a7c" />
        <Palmera x={472} base={490} altura={70} curva={4} escala={0.32} tronco="#6a6070" hoja="#6a6877" />
        <Palmera x={503} base={488} altura={58} curva={-3} escala={0.27} tronco="#6a6070" hoja="#6a6877" />
        <Palmera x={175} base={590} altura={170} curva={-8} escala={0.7} tronco="#3f3a2c" hoja="#3d4a33" luz="#d9a868" />
        <Palmera x={118} base={602} altura={212} curva={12} escala={0.85} tronco="#3a3428" hoja="#33422d" luz="#d9a868" />
        <Palmera x={530} base={830} altura={480} curva={-34} escala={1.6} tronco="#2e2a20" hoja="#263424" luz="#e0ad6b" />

        <rect x="-10" y="-10" width="620" height="820" fill="url(#pb-vineta)" />
      </g>

      <Paraba x0={230} y={300} escala={0.9} duracion={46} retraso={-12} aleteo={0.62} />
      <Paraba x0={385} y={362} escala={0.68} duracion={54} retraso={-31} aleteo={0.55} />
      <Paraba x0={470} y={248} escala={0.52} duracion={62} retraso={-6} aleteo={0.5} />

      <style>{`
        .pb-deriva { animation: pb-deriva linear infinite; }
        .pb-balanceo { animation: pb-balanceo 3.4s ease-in-out infinite; }
        .pb-ala {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: pb-aleteo ease-in-out infinite alternate;
        }
        @keyframes pb-deriva {
          from { transform: translateX(var(--pb-desde)); }
          to { transform: translateX(var(--pb-hasta)); }
        }
        @keyframes pb-balanceo {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes pb-aleteo {
          from { transform: scaleY(1); }
          to { transform: scaleY(-0.55); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pb-deriva, .pb-balanceo, .pb-ala { animation: none; }
        }
      `}</style>
    </svg>
  );
}

export default PaisajeBeni;
