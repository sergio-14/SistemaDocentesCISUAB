import { ESTADOS_FONDO, iniciales } from './estilosFondo';

// Piezas visuales comunes del dashboard y del detalle del fondo.

export function EstadoPill({ estado }) {
  const info = ESTADOS_FONDO[estado] || ESTADOS_FONDO.borrador;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${info.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

export function Avatar({ nombre, size = 'w-12 h-12' }) {
  return (
    <div className={`${size} rounded-full bg-blue-900 text-white font-bold flex items-center justify-center flex-shrink-0`}>
      {iniciales(nombre)}
    </div>
  );
}

export function BarraProgreso({ valor, color = 'bg-blue-900' }) {
  return (
    <div className="h-2 w-full rounded-full bg-azulado-200 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${valor}%` }} />
    </div>
  );
}

export function Etiqueta({ children }) {
  return (
    <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-azulado-100 text-slate-700 ring-1 ring-inset ring-azulado-300">
      {children}
    </span>
  );
}
