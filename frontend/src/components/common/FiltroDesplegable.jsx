import { useEffect, useRef, useState } from 'react';

// Desplegable escribible con el estilo del dashboard (filtros de carrera y semestre, y la
// carrera de los formularios): el propio campo es el buscador; al pulsarlo se despliega la
// lista y lo que se escribe la filtra, sin importar mayúsculas ni tildes. Con permitirQuitar,
// volver a elegir la opción seleccionada la quita (valor '').

const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function FiltroDesplegable({
  value,
  onChange,
  options,
  placeholder = 'Seleccione...',
  ariaLabel,
  emptyText = 'No hay coincidencias',
  permitirQuitar = true,
  invalido = false,
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const cerrar = () => {
    setOpen(false);
    setSearch('');
  };

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const selectedLabel = options.find((opt) => String(opt.value) === String(value))?.label;
  const filteredOptions = search.trim()
    ? options.filter((option) => normalizar(option.label).includes(normalizar(search.trim())))
    : options;

  const elegir = (option) => {
    const mismo = String(value) === String(option.value);
    if (!mismo) onChange(option.value);
    else if (permitirQuitar) onChange('');
    cerrar();
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        disabled={disabled}
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalido || undefined}
        value={open ? search : (selectedLabel || '')}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onClick={() => !disabled && setOpen(true)}
        onKeyDown={(e) => {
          // Enter elige la primera coincidencia y no envía el formulario.
          if (e.key === 'Enter') {
            e.preventDefault();
            if (open && filteredOptions.length > 0) elegir(filteredOptions[0]);
          }
          if (e.key === 'Tab') cerrar();
        }}
        placeholder={open ? (selectedLabel || 'Escribe para buscar...') : placeholder}
        className={`w-full h-11 pl-4 pr-11 rounded-full ring-inset text-sm text-slate-800 placeholder:text-slate-500 outline-none !bg-azulado-100 disabled:!bg-slate-100 disabled:cursor-not-allowed ${
          invalido ? 'ring-2 ring-red-500' : 'ring-1 ring-azulado-300 focus:ring-2 focus:ring-blue-900/40'
        } ${!open && selectedLabel ? 'font-semibold' : ''}`}
        style={{ border: 'none' }}
      />
      <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center h-6 w-6 rounded-md ${disabled ? 'bg-slate-400' : 'bg-[#2C4AAE]'}`}>
        <svg
          className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
      {open && !disabled && (
        <div role="listbox" className="absolute z-40 mt-2 w-full rounded-xl border-2 border-[#3A56AF] bg-white shadow-xl max-h-72 overflow-auto p-2">
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={String(value) === String(option.value)}
              onClick={() => elegir(option)}
              className={`w-full text-left px-3 py-1.5 text-xs rounded-lg ${
                String(value) === String(option.value)
                  ? 'bg-sky-600 text-white font-semibold hover:bg-blue-900'
                  : 'bg-transparent text-slate-700 hover:bg-[#2C4AAE] hover:text-white'
              }`}
            >
              <span className="block truncate">{option.label}</span>
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default FiltroDesplegable;
