// Buscador de los listados con el estilo del dashboard: siempre visible, con la lupa
// dentro del campo.
function CampoBusqueda({ value, onChange, placeholder = 'Buscar...', ariaLabel, className = 'w-full sm:w-auto sm:flex-1 sm:max-w-md' }) {
  return (
    <label className={`flex items-center gap-2 h-11 px-4 rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300 focus-within:ring-blue-900/40 ${className}`}>
      <svg className="w-[18px] h-[18px] text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        className="w-full text-sm text-slate-800 placeholder:text-slate-500 outline-none"
        style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
      />
    </label>
  );
}

export default CampoBusqueda;
