import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Selector "Tarjetas | Lista" de los listados (Fondo de Tiempo, Usuarios y Carreras): el
// fondo azul de la opción elegida se desliza al cambiar; el contenido no se anima aquí.

const GridIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
  </svg>
);

const ListIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
);

const OPCIONES = [
  { id: 'tarjetas', label: 'Tarjetas', icon: GridIcon },
  { id: 'lista', label: 'Lista', icon: ListIcon },
];

function SelectorVista({ vista, onCambiar, className = '' }) {
  const botones = useRef({});
  // Posición y ancho del fondo azul de la opción elegida: se desliza de una a otra.
  const [indicador, setIndicador] = useState(null);
  const [animar, setAnimar] = useState(false);

  useLayoutEffect(() => {
    const medir = () => {
      const boton = botones.current[vista];
      setIndicador((previo) => {
        if (boton) return { left: boton.offsetLeft, width: boton.offsetWidth, visible: true };
        // Vista que no es de este selector (p. ej. "Materias asignadas"): se desvanece en su lugar.
        return previo ? { ...previo, visible: false } : null;
      });
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    // El ancho cambia con la pantalla (en el celular solo va el ícono).
    const observador = new ResizeObserver(medir);
    Object.values(botones.current).forEach((boton) => boton && observador.observe(boton));
    return () => observador.disconnect();
  }, [vista]);

  // La primera posición se pone sin animación; desde ahí, cada cambio se desliza.
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => setAnimar(true));
    return () => cancelAnimationFrame(cuadro);
  }, []);

  return (
    <div className={`relative flex items-center gap-1 p-1 rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300 ${className}`}>
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1 bottom-1 rounded-full bg-blue-900 shadow-sm ${
          animar ? 'transition-[transform,width,opacity] duration-300 ease-out motion-reduce:transition-none' : ''
        } ${indicador?.visible ? 'opacity-100' : 'opacity-0'}`}
        style={{ width: indicador?.width ?? 0, transform: `translateX(${indicador?.left ?? 0}px)` }}
      />
      {OPCIONES.map((opcion) => (
        <button
          key={opcion.id}
          ref={(elemento) => { botones.current[opcion.id] = elemento; }}
          type="button"
          title={opcion.label}
          aria-pressed={vista === opcion.id}
          onClick={() => onCambiar(opcion.id)}
          className={`relative z-10 inline-flex items-center gap-2 px-3 sm:px-4 h-9 rounded-full text-sm font-medium transition-colors duration-300 ${
            vista === opcion.id ? 'text-white' : 'text-slate-600 hover:text-blue-900'
          }`}
        >
          <opcion.icon className="w-4 h-4" />
          <span className="hidden sm:inline">{opcion.label}</span>
        </button>
      ))}
    </div>
  );
}

export default SelectorVista;
