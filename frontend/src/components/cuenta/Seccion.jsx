// Piezas de Mi cuenta: una sección es un título corto en mayúsculas (con una nota a la
// derecha, como "Solo lectura") y debajo una tarjeta; las filas van separadas por una línea,
// como una lista de ajustes.
export function Seccion({ titulo, extra, children }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</h3>
        {extra && <span className="text-xs font-semibold text-blue-700 truncate">{extra}</span>}
      </div>
      <div className="rounded-2xl bg-azulado-50 ring-1 ring-azulado-300 shadow-[0_2px_6px_rgba(30,58,138,0.06)]">
        {children}
      </div>
    </section>
  );
}

export function Filas({ children }) {
  return <div className="divide-y divide-azulado-300">{children}</div>;
}

export function Fila({ etiqueta, children, ayuda }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm text-slate-600">{etiqueta}</p>
        {ayuda && <p className="text-xs text-slate-500">{ayuda}</p>}
      </div>
      <div className="min-w-0 text-sm font-medium text-slate-900 sm:text-right break-words">{children}</div>
    </div>
  );
}
