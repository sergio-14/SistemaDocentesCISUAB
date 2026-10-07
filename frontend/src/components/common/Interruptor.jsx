// Interruptor de activo / inactivo: encendido en el color secundario (celeste).
function Interruptor({ isActive, onChange, etiqueta }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(isActive)}
      aria-label={etiqueta}
      onClick={onChange}
      className={`relative inline-flex h-6 w-12 flex-shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isActive ? 'bg-sky-600 focus:ring-sky-400' : 'bg-slate-300 focus:ring-slate-400'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
          isActive ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default Interruptor;
