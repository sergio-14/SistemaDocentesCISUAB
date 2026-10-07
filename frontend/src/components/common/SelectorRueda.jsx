import { useState } from 'react';
import ModalCentrado from './ModalCentrado';
import RuedaOpciones from './RuedaOpciones';

// Campo que se elige con la ruleta (semestre de la carga del fondo y de las materias): se
// ve como los demás selectores y al pulsarlo abre la rueda. Se confirma con un clic en la
// opción del centro, Enter o "Listo"; "Cancelar" (o un clic fuera) cierra sin cambiar nada.
function SelectorRueda({ value, options, onChange, placeholder, titulo, disabled = false, invalido = false, claseTexto = 'text-[13px]' }) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(value);
  const [token, setToken] = useState(0);
  const selected = options.find((opt) => String(opt.value) === String(value));
  const deshabilitado = disabled || options.length === 0;

  const abrir = () => {
    if (deshabilitado) return;
    setBorrador(selected ? selected.value : options[0].value);
    setToken((prev) => prev + 1);
    setAbierto(true);
  };

  const confirmar = (valor = borrador) => {
    if (valor !== undefined && valor !== '' && String(valor) !== String(value)) onChange(String(valor));
    setAbierto(false);
  };

  const cancelar = () => setAbierto(false);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={deshabilitado}
        aria-invalid={invalido || undefined}
        className={`relative w-full h-11 text-left pl-4 pr-11 rounded-full ${claseTexto} ring-inset transition-colors ${
          deshabilitado
            ? 'bg-slate-100 ring-1 ring-azulado-300 text-slate-400 cursor-not-allowed'
            : invalido
              ? 'bg-azulado-100 ring-2 ring-red-500 text-slate-800'
              : abierto
                ? 'bg-azulado-100 ring-2 ring-blue-900/40 text-slate-900'
                : 'bg-azulado-100 ring-1 ring-azulado-300 text-slate-800'
        }`}
      >
        <span className={`block truncate ${selected ? 'font-semibold' : 'text-slate-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md ${
          deshabilitado ? 'bg-slate-400' : 'bg-[#2C4AAE]'
        }`}>
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
          </svg>
        </span>
      </button>

      {abierto && (
        <ModalCentrado onClose={cancelar}>
          <div className="animate-campo-entrada w-full max-w-xs rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl p-4">
            <h3 className="px-1 pb-3 text-base text-blue-900">{titulo}</h3>
            <RuedaOpciones
              key={`rueda-${token}`}
              opciones={options}
              value={borrador}
              valorInicial={borrador}
              onChange={setBorrador}
              onConfirm={confirmar}
              resetToken={token}
              visibleCount={5}
              itemHeight={40}
              clicEnLaterales
              compacta
            />
            <p className="mt-3 px-1 text-xs text-slate-600">
              Desliza con el dedo, usa la rueda del mouse o toca una opción; confirma con un clic en la del centro.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelar}
                className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm text-slate-700 hover:bg-azulado-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmar()}
                className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm bg-blue-900 hover:bg-blue-950 text-white transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        </ModalCentrado>
      )}
    </>
  );
}

export default SelectorRueda;
