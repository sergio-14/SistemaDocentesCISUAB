import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { History, X, FileEdit, CheckCircle2, AlertCircle, SendHorizontal, PlusCircle, ShieldCheck, PlayCircle, XCircle, ImageUp } from 'lucide-react';
import { getHistorialDocumentoPOA } from '../../../apis/poa.api';

const EVENTO_ICON = {
  creacion: <PlusCircle size={14} className="text-emerald-400" />,
  edicion: <FileEdit size={14} className="text-sky-400" />,
  envio_revision: <SendHorizontal size={14} className="text-amber-400" />,
  aprobacion_revision: <CheckCircle2 size={14} className="text-emerald-400" />,
  observacion_revision: <AlertCircle size={14} className="text-orange-400" />,
  aprobacion_final: <ShieldCheck size={14} className="text-violet-400" />,
  inicio_ejecucion: <PlayCircle size={14} className="text-violet-400" />,
  solicitud_cambio: <SendHorizontal size={14} className="text-sky-400" />,
  aprobacion_cambio: <CheckCircle2 size={14} className="text-emerald-400" />,
  rechazo_cambio: <XCircle size={14} className="text-rose-400" />,
  evidencia: <ImageUp size={14} className="text-cyan-400" />,
};

const EVENTO_COLOR = {
  creacion: 'border-emerald-500/30 bg-emerald-500/5',
  edicion: 'border-sky-500/30 bg-sky-500/5',
  envio_revision: 'border-amber-500/30 bg-amber-500/5',
  aprobacion_revision: 'border-emerald-500/30 bg-emerald-500/5',
  observacion_revision: 'border-orange-500/30 bg-orange-500/5',
  aprobacion_final: 'border-violet-500/30 bg-violet-500/5',
  inicio_ejecucion: 'border-violet-500/30 bg-violet-500/5',
  solicitud_cambio: 'border-sky-500/30 bg-sky-500/5',
  aprobacion_cambio: 'border-emerald-500/30 bg-emerald-500/5',
  rechazo_cambio: 'border-rose-500/30 bg-rose-500/5',
  evidencia: 'border-cyan-500/30 bg-cyan-500/5',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('es-BO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

const BitacoraModal = ({ doc, gestion, onClose }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroEvento, setFiltroEvento] = useState('todos');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (!doc?.id) return;
    setLoading(true);
    setError(null);
    getHistorialDocumentoPOA(doc.id, gestion)
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err?.response?.data?.detail || err?.message || 'Error al cargar bitacora'))
      .finally(() => setLoading(false));
  }, [doc?.id, gestion]);

  const resumen = useMemo(() => {
    return (items || []).reduce((acc, item) => {
      const tipo = item?.tipo_evento || 'otro';
      acc.total += 1;
      acc.porTipo[tipo] = (acc.porTipo[tipo] || 0) + 1;
      if (item?.justificacion) acc.conJustificacion += 1;
      return acc;
    }, { total: 0, conJustificacion: 0, porTipo: {} });
  }, [items]);

  const eventosDisponibles = useMemo(() => {
    const map = new Map();
    for (const item of items || []) {
      const key = item?.tipo_evento;
      if (!key || map.has(key)) continue;
      map.set(key, item?.tipo_evento_display || key);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [items]);

  const itemsFiltrados = useMemo(() => {
    if (filtroEvento === 'todos') return items || [];
    return (items || []).filter((item) => item?.tipo_evento === filtroEvento);
  }, [items, filtroEvento]);

  const modalContent = (
    <div className="poa-bitacora-modal fixed inset-0 z-[200]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className="poa-bitacora-panel w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-start gap-2.5 min-w-0">
              <History size={16} className="text-sky-400 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-sky-400">Bitacora de auditoria</p>
                <h4 className="text-sm font-bold text-slate-100 truncate" title={doc?.programa || ''}>
                  {doc?.programa || `Documento #${doc?.id}`}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Documento #{doc?.id} | Gestion {gestion || 'N/A'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {loading && <div className="text-center text-sm text-slate-400 py-8">Cargando bitacora...</div>}
            {error && <div className="text-center text-sm text-red-400 py-8">{String(error)}</div>}
            {!loading && !error && items.length === 0 && <div className="text-center text-sm text-slate-500 py-8">No hay registros en la bitacora.</div>}

            {!loading && !error && items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total eventos</p>
                  <p className="text-xl font-bold text-slate-100 mt-0.5">{resumen.total}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Con justificacion</p>
                  <p className="text-xl font-bold text-amber-300 mt-0.5">{resumen.conJustificacion}</p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Ultimo registro</p>
                  <p className="text-xs font-mono text-slate-200 mt-1">{formatDateTime(items[0]?.fecha)}</p>
                </div>
              </div>
            )}

            {!loading && !error && items.length > 0 && (
              <div className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Filtrar por evento</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltroEvento('todos')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${filtroEvento === 'todos' ? 'border-sky-400 bg-sky-500/20 text-sky-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}
                  >
                    Todos ({items.length})
                  </button>
                  {eventosDisponibles.map((ev) => (
                    <button
                      key={ev.value}
                      type="button"
                      onClick={() => setFiltroEvento(ev.value)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition ${filtroEvento === ev.value ? 'border-sky-400 bg-sky-500/20 text-sky-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}
                    >
                      {ev.label} ({resumen.porTipo[ev.value] || 0})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && itemsFiltrados.length === 0 && items.length > 0 && (
              <div className="text-center text-sm text-slate-500 py-6">No hay registros para el filtro seleccionado.</div>
            )}

            {!loading && !error && itemsFiltrados.map((item) => (
              <div key={item.id} className={`rounded-xl border px-4 py-3 ${EVENTO_COLOR[item.tipo_evento] || 'border-slate-700 bg-slate-800/40'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    {EVENTO_ICON[item.tipo_evento] || <History size={14} className="text-slate-400" />}
                    <span className="text-xs font-bold text-slate-100">{item.tipo_evento_display}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">{formatDateTime(item.fecha)}</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{item.descripcion}</p>

                {Array.isArray(item?.datos_evento?.cambios) && item.datos_evento.cambios.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-sky-300">Cambios registrados</p>
                    {item.datos_evento.cambios.map((cambio, idx) => (
                      <div key={`${item.id}-cambio-${idx}`} className="rounded-md border border-slate-700 bg-slate-950/50 px-2.5 py-2">
                        <p className="text-[11px] font-semibold text-slate-200">{cambio.etiqueta || cambio.campo}</p>
                        <p className="text-[11px] text-slate-400">Antes: <span className="text-slate-300">{cambio.antes}</span></p>
                        <p className="text-[11px] text-slate-400">Despues: <span className="text-slate-200">{cambio.despues}</span></p>
                      </div>
                    ))}
                  </div>
                )}

                {item.justificacion && (
                  <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-amber-400 mb-0.5">Justificacion de modificacion</p>
                    <p className="text-xs text-amber-100 leading-relaxed whitespace-pre-line">{item.justificacion}</p>
                  </div>
                )}

                {item.estado_anterior && item.estado_nuevo && item.estado_anterior !== item.estado_nuevo && (
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Estado: <span className="text-slate-400">{item.estado_anterior}</span> - <span className="text-slate-300">{item.estado_nuevo}</span>
                  </p>
                )}

                <p className="text-[10px] text-slate-500 mt-1">{item.usuario_nombre}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default BitacoraModal;
