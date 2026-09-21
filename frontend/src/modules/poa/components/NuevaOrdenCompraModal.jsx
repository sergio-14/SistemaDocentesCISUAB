import React, { useMemo, useState } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';
import { Modal, Input } from './base';
import { crearOrdenCompraPOA } from '../../../apis/poa.api';
import toast from 'react-hot-toast';

const NuevaOrdenCompraModal = ({ gestion, items = [], onClose, onCreated }) => {
  const [form, setForm] = useState({ numero: '', proveedor: '', fecha: new Date().toISOString().slice(0, 10), observacion: '' });
  const [seleccion, setSeleccion] = useState(() => new Set(items.map((_, i) => i)));
  const [loading, setLoading] = useState(false);
  const lineas = useMemo(() => items.filter((_, i) => seleccion.has(i)).map(i => ({ ...i, cantidad_comprada: i.cantidad_total, costo_unitario_real: i.cantidad_total ? Number(i.monto_estimado_total) / i.cantidad_total : 0 })), [items, seleccion]);
  const guardar = async (e) => {
    e.preventDefault();
    if (!form.numero.trim() || !form.proveedor.trim() || !lineas.length) return toast.error('Registre número, proveedor y al menos un ítem.');
    setLoading(true);
    try {
      const payload = { ...form, gestion: Number(gestion), lineas: lineas.map(l => ({ partida: l.partida, item: l.item, unidad_medida: l.unidad_medida, caracteristicas: l.caracteristicas, tipo: l.tipo, cantidad_comprada: l.cantidad_comprada, costo_unitario_real: l.costo_unitario_real, origen_detalles: l.origenes.map(o => o.detalle_id) })) };
      const res = await crearOrdenCompraPOA(payload);
      if (res.data.alertas?.length) toast('Orden creada. Revise: ' + res.data.alertas.join(' '), { icon: '⚠️' }); else toast.success('Orden de compra registrada.');
      onCreated?.(res.data); onClose?.();
    } catch (err) { toast.error(err?.response?.data?.detail || 'No se pudo registrar la orden.'); } finally { setLoading(false); }
  };
  return <Modal onClose={onClose}><div className="modal-panel w-11/12 max-w-4xl rounded-xl"><div className="modal-header flex justify-between p-4"><b>Nueva orden de compra</b><button onClick={onClose}><FaTimes /></button></div><form onSubmit={guardar} className="p-5 space-y-4"><p className="text-sm text-slate-600">Los precios iniciales son referenciales del POA. Se advertirá si el costo real supera el estimado.</p><div className="grid md:grid-cols-3 gap-3"><Input label="Nº de orden/factura" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} /><Input label="Proveedor" value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} /><Input label="Fecha" type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></div><div className="max-h-72 overflow-auto border rounded"><table className="w-full text-sm"><thead><tr><th></th><th>Partida</th><th>Ítem</th><th>Cantidad</th><th>Estimado</th></tr></thead><tbody>{items.map((i, n) => <tr key={n} className="border-t"><td className="p-2"><input type="checkbox" checked={seleccion.has(n)} onChange={() => setSeleccion(prev => { const next = new Set(prev); next.has(n) ? next.delete(n) : next.add(n); return next; })} /></td><td>{i.partida}</td><td>{i.item}</td><td>{i.cantidad_total}</td><td>{Number(i.monto_estimado_total).toFixed(2)}</td></tr>)}</tbody></table></div><textarea className="poa-input w-full" placeholder="Observación opcional" value={form.observacion} onChange={e => setForm({ ...form, observacion: e.target.value })} /><div className="flex justify-end gap-2"><button type="button" className="btn-cancel px-3 py-2 rounded" onClick={onClose}>Cancelar</button><button disabled={loading} className="btn-success px-3 py-2 rounded"><FaSave className="inline mr-2" />{loading ? 'Guardando…' : 'Registrar orden'}</button></div></form></div></Modal>;
};
export default NuevaOrdenCompraModal;
