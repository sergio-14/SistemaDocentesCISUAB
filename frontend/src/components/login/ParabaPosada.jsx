// Paraba barba azul posada en una rama del paisaje del login, que reacciona al formulario
// (idea de los avatares de login que miran el campo y se tapan los ojos con la contraseña):
//   reposo         nada escrito ni enfocado: se acicala las plumas, se esponja y se sacude.
//   mirando        en el usuario: gira la cabeza hacia el campo y las pupilas siguen el texto.
//   ojos-cerrados  en la contraseña: cierra los ojos y voltea la cabeza hacia el otro lado.
//   atento         campos llenos sin foco: quieta, parpadeando.
// Solo SVG y CSS. Con prefers-reduced-motion cambia de pose sin animar.

function ParabaPosada({ estado = 'reposo', seguimiento = 0, className = '' }) {
  // Pupilas: desde el inicio del campo (izquierda) hasta el final del texto (más cerca del ave).
  const mirada = (-2.4 + 3.2 * Math.min(Math.max(seguimiento, 0), 1)).toFixed(2);
  return (
    <svg
      className={`ave ave--${estado} ${className}`}
      style={{ '--ave-mirada': `${mirada}px` }}
      viewBox="0 0 200 300"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="av-cabeza" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#45c6d4" />
          <stop offset="1" stopColor="#1e86b6" />
        </linearGradient>
        <linearGradient id="av-pecho" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8cc4c" />
          <stop offset="1" stopColor="#e8961f" />
        </linearGradient>
        <linearGradient id="av-ala" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#2397c2" />
          <stop offset="0.55" stopColor="#1d6fae" />
          <stop offset="1" stopColor="#1a4d93" />
        </linearGradient>
        <linearGradient id="av-cola" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f74b0" />
          <stop offset="1" stopColor="#1a4a8c" />
        </linearGradient>
        <linearGradient id="av-rama" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a5636" />
          <stop offset="1" stopColor="#4a321f" />
        </linearGradient>
      </defs>

      <g className="ave-sacudida">
        <path d="M104,200 C110,236 124,268 142,298 C150,292 148,262 138,232 C132,214 126,202 120,194 Z" fill="url(#av-cola)" />
        <path d="M120,104 C146,116 156,160 150,206 C146,224 138,230 132,220 C122,196 114,148 120,104 Z" fill="#18528f" />

        <g className="ave-cuerpo">
          <path d="M66,86 C90,70 122,86 128,126 C134,170 126,206 110,218 C94,228 78,218 72,194 C64,162 56,116 66,86 Z" fill="url(#av-pecho)" />
          <path d="M66,86 C84,74 112,80 122,104 C106,108 86,104 70,114 Z" fill="#2aa7c4" />
          <g className="ave-plumon">
            <ellipse cx="63" cy="128" rx="6" ry="4" fill="#f6c443" />
            <ellipse cx="64" cy="152" rx="6.5" ry="4" fill="#f2b33a" />
            <ellipse cx="69" cy="177" rx="6" ry="4" fill="#eca42e" />
            <ellipse cx="146" cy="150" rx="5" ry="4" fill="#1d6fae" />
            <ellipse cx="146" cy="178" rx="5" ry="4" fill="#1a5a9e" />
          </g>
          <path d="M106,96 C132,104 146,144 142,192 C140,214 130,226 118,220 C102,192 96,142 106,96 Z" fill="url(#av-ala)" />
          <path d="M108,104 C126,110 138,128 140,148 C130,152 118,144 110,152 C104,134 102,116 108,104 Z" fill="#39bfcf" />
          <path d="M106,96 C96,142 102,192 118,220" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
        </g>

        <g className="ave-cabeza">
          <path d="M48,42 C52,16 88,8 106,26 C120,40 118,70 104,86 C92,98 68,98 58,86 C48,74 44,58 48,42 Z" fill="url(#av-cabeza)" />
          <path d="M70,18 C84,12 100,18 106,28" fill="none" stroke="#6fd6e0" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
          <ellipse cx="72" cy="52" rx="15" ry="17" fill="#f5efe2" />
          <path d="M62,59 l8,1 M63,64 l8,1 M66,69 l7,0" stroke="#2b3a55" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
          <g className="ave-ojo-abierto">
            <circle cx="74" cy="47" r="5.4" fill="#f2e39a" />
            <g className="ave-pupila">
              <circle cx="74" cy="47" r="2.7" fill="#111111" />
              <circle cx="73" cy="45.8" r="0.9" fill="#ffffff" />
            </g>
          </g>
          <path className="ave-ojo-cerrado" d="M68,47 Q74,53 80,47" fill="none" stroke="#1b2a3a" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M54,54 C42,50 30,58 29,72 C28,86 36,96 44,100 C42,90 44,80 52,75 C57,72 61,68 60,61 Z" fill="#1f1f1f" />
          <path d="M45,86 C49,96 60,100 66,93 C62,87 56,83 50,81 Z" fill="#0d0d0d" />
          <path d="M58,84 C64,96 78,100 88,94 C82,104 66,107 57,98 Z" fill="#1d4f91" />
        </g>
      </g>

      <path d="M30,218 C70,210 140,210 200,220 L200,236 C140,228 72,226 34,226 C26,226 24,220 30,218 Z" fill="url(#av-rama)" />
      <path d="M150,222 C160,212 168,206 180,204" fill="none" stroke="#5a3e28" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="184" cy="202" rx="9" ry="4" transform="rotate(-20 184 202)" fill="#4f6b3a" />
      <rect x="84" y="208" width="14" height="16" rx="6" fill="#3f3f46" />
      <rect x="112" y="210" width="14" height="16" rx="6" fill="#3f3f46" />

      <style>{`
        .ave-cabeza {
          transform-origin: 86px 90px;
          transform: rotate(0deg) translate(0px, 0px) scaleX(1);
          transition: transform 380ms cubic-bezier(0.3, 1.4, 0.5, 1);
        }
        .ave-cuerpo { transform-origin: 100px 214px; }
        .ave-sacudida { transform-origin: 100px 216px; }
        .ave-plumon { opacity: 0; }
        .ave-ojo-abierto {
          transform-origin: 74px 47px;
          animation: av-parpadeo 4.6s ease-in-out infinite;
          transition: opacity 140ms ease;
        }
        .ave-ojo-cerrado { opacity: 0; transition: opacity 140ms ease; }
        .ave-pupila { transition: transform 160ms ease-out; }

        .ave--atento .ave-cuerpo, .ave--mirando .ave-cuerpo { animation: av-respirar 3.2s ease-in-out infinite; }

        .ave--mirando .ave-cabeza { transform: rotate(7deg) translate(-3px, 2px) scaleX(1); }
        .ave--mirando .ave-pupila { transform: translate(var(--ave-mirada), 1px); }

        .ave--ojos-cerrados .ave-cabeza { transform: rotate(-12deg) translate(4px, -2px) scaleX(-1); }
        .ave--ojos-cerrados .ave-ojo-abierto { opacity: 0; animation: none; }
        .ave--ojos-cerrados .ave-ojo-cerrado { opacity: 1; }

        .ave--reposo .ave-cabeza { animation: av-acicalar 11s ease-in-out infinite; }
        .ave--reposo .ave-cuerpo { animation: av-esponjar 11s ease-in-out infinite; }
        .ave--reposo .ave-plumon { animation: av-plumon 11s ease-in-out infinite; }
        .ave--reposo .ave-sacudida { animation: av-sacudir 11s linear infinite; }

        @keyframes av-parpadeo {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes av-respirar {
          0%, 100% { transform: scale(1, 1); }
          50% { transform: scale(1.012, 1.02); }
        }
        /* Gira la cabeza hacia el ala, se pica las plumas tres veces y vuelve. */
        @keyframes av-acicalar {
          0%, 20% { transform: rotate(0deg) translate(0px, 0px) scaleX(1); }
          25% { transform: rotate(-6deg) translate(0px, -2px) scaleX(-1); }
          29% { transform: rotate(38deg) translate(10px, 6px) scaleX(-1); }
          32% { transform: rotate(45deg) translate(12px, 8px) scaleX(-1); }
          35% { transform: rotate(37deg) translate(10px, 6px) scaleX(-1); }
          38% { transform: rotate(45deg) translate(12px, 8px) scaleX(-1); }
          41% { transform: rotate(37deg) translate(10px, 6px) scaleX(-1); }
          44% { transform: rotate(45deg) translate(12px, 8px) scaleX(-1); }
          49% { transform: rotate(0deg) translate(0px, 0px) scaleX(1); }
          54%, 62% { transform: rotate(-4deg) translate(0px, -6px) scaleX(1); }
          66%, 100% { transform: rotate(0deg) translate(0px, 0px) scaleX(1); }
        }
        /* Se esponja: el cuerpo se infla y asoman las plumas sueltas. */
        @keyframes av-esponjar {
          0%, 50% { transform: scale(1, 1); }
          54%, 62% { transform: scale(1.09, 1.05); }
          66%, 100% { transform: scale(1, 1); }
        }
        @keyframes av-plumon {
          0%, 50% { opacity: 0; }
          54%, 62% { opacity: 1; }
          66%, 100% { opacity: 0; }
        }
        /* Se sacude desde las patas. */
        @keyframes av-sacudir {
          0%, 67% { transform: rotate(0deg); }
          68.5% { transform: rotate(-5deg); }
          70% { transform: rotate(5deg); }
          71.5% { transform: rotate(-4deg); }
          73% { transform: rotate(4deg); }
          74.5% { transform: rotate(-2deg); }
          76%, 100% { transform: rotate(0deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ave, .ave * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </svg>
  );
}

export default ParabaPosada;
