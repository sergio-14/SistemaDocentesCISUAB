import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Selector de gestión: mismo borde que el buscador, el cuadrito azul con la flecha que
// gira (como en Docentes) y menú flotante con hover azul. Sin gestión elegida muestra
// "Todas las gestiones"; volver a pulsar la gestión elegida la quita.
export default function SelectorGestion({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const cerrarSiEsFuera = (event) => {
      if (containerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    // El menú es fijo en pantalla: si se desplaza la página o cambia el tamaño, se cierra.
    const cerrar = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', cerrarSiEsFuera);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', cerrarSiEsFuera);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !containerRef.current) {
      setMenuStyle(null);
      return;
    }
    const anchorRect = containerRef.current.getBoundingClientRect();
    const estimatedHeight = Math.min(options.length * 40 + 16, window.innerHeight - 16);
    const spaceBelow = window.innerHeight - anchorRect.bottom - 12;
    const spaceAbove = anchorRect.top - 12;
    const placeAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    setMenuStyle({
      position: 'fixed',
      left: `${anchorRect.left}px`,
      width: `${anchorRect.width}px`,
      top: placeAbove
        ? `${Math.max(12, anchorRect.top - estimatedHeight - 8)}px`
        : `${anchorRect.bottom + 8}px`,
      zIndex: 99999,
    });
  }, [open, options.length]);

  const seleccionada = options.find((opt) => String(opt.value) === String(value));

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 sm:flex-none sm:w-56">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filtrar por gestión"
        className="w-full h-11 text-left pl-4 pr-2.5 rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300 text-sm text-slate-800 flex items-center justify-between gap-2"
      >
        <span className={`truncate ${seleccionada ? '' : 'text-slate-500'}`}>{seleccionada?.label || placeholder}</span>
        <span className="flex items-center justify-center h-6 w-6 rounded-md bg-[#2C4AAE] ring-1 ring-[#2C4AAE] flex-shrink-0">
          <svg className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && menuStyle && createPortal(
        <div ref={menuRef} role="listbox" className="rounded-xl border-2 border-[#3A56AF] bg-white shadow-xl max-h-72 overflow-y-auto" style={menuStyle}>
          <div className="p-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={String(option.value) === String(value)}
                onClick={() => {
                  onChange(String(option.value) === String(value) ? null : option.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs rounded-lg ${
                  String(option.value) === String(value)
                    ? 'bg-sky-600 text-white font-semibold hover:bg-sky-700'
                    : 'bg-transparent text-slate-700 hover:bg-[#2C4AAE] hover:text-white'
                }`}
              >
                <span className="block truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
