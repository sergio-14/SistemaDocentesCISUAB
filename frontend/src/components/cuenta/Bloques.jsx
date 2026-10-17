import { BLOQUE } from '../fondos/estilosFondo';

// Piezas de Mi cuenta con el diseño del detalle del fondo: tarjeta BLOQUE p-6 con título
// text-base font-bold text-blue-900; datos en cuadrícula (etiqueta gris pequeña arriba,
// valor en negrita debajo) y listas separadas por líneas como "Balance de horas".

export function Tarjeta({ titulo, icono: Icono, accion, ancha = false, children }) {
  return (
    <section className={`${BLOQUE} p-6 flex flex-col min-w-0 ${ancha ? 'md:col-span-2' : ''}`}>
      <div className="mb-4 min-h-7 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-blue-900">
          {Icono && <Icono className="w-[18px] h-[18px] text-blue-700 flex-shrink-0" strokeWidth={1.75} />}
          <span>{titulo}</span>
        </h3>
        {accion}
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </section>
  );
}

// datos: [{ label, valor, ancho }]; ancho ocupa las dos columnas.
export function Datos({ datos }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
      {datos.map((dato) => (
        <div key={dato.label} className={`min-w-0 ${dato.ancho ? 'col-span-2' : ''}`}>
          <dt className="text-xs font-medium text-slate-600">{dato.label}</dt>
          <dd className="mt-0.5 text-sm font-bold text-slate-900 break-words">{dato.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Lista({ children }) {
  return <div className="divide-y divide-azulado-300 text-sm">{children}</div>;
}

export function FilaLista({ children }) {
  return <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">{children}</div>;
}

// Bloque sin datos: un texto corto en lugar de ocultarlo, para que la cuadrícula siga pareja.
export function SinDatos({ children }) {
  return (
    <p className="flex-1 flex items-center justify-center rounded-2xl bg-azulado-100/60 px-4 py-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

export function Cargando() {
  return (
    <div className="flex-1 flex items-center justify-center py-6">
      <div className="animate-spin rounded-full h-7 w-7 border-b-4 border-blue-900" />
    </div>
  );
}
