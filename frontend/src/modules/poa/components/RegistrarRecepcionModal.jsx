import React, { useMemo, useState } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { Modal } from './base';
import { registrarRecepcionMaterialPOA } from '../../../apis/poa.api';

const today = () => new Date().toISOString().slice(0, 10);

const RegistrarRecepcionModal = ({ orden, onClose, onSaved }) => {
  const pendientes = useMemo(() => (orden?.detalles || []).map((detalle) => ({
    ...detalle, saldo: Math.max(0, Number(detalle.cantidad_comprada) - Number(detalle.cantidad_recibida || 0)),
  })).filter((detalle) => detalle.saldo > 0), [orden]);
  const [form, setForm] = useState({ fecha: today(), numero_respaldo: '', recibido_por: '', observacion: '', respaldo: null });
  const [cantidades, setCantidades] = useState(() => Object.fromEntries(pendientes.map((detalle) => [detalle.id, ''])));
  const [saving, setSaving] = useState(false);

  const guardar = async (event) => {
    event.preventDefault();
    const lineas = pendientes.map((detalle) => ({ detalle_orden: detalle.id, cantidad_recibida: Number(cantidades[detalle.id] || 0) })).filter((linea) => linea.cantidad_recibida > 0);
    if (!form.recibido_por.trim() || !lineas.length) return toast.error('Indique quién recibió el material y al menos una cantidad.');
    if (lineas.some((linea) => linea.cantidad_recibida > pendientes.find((detalle) => detalle.id === linea.detalle_orden).saldo)) return toast.error('Una cantidad supera el saldo comprado.');
    const payload = new FormData();
    payload.append('orden', orden.id); payload.append('fecha', form.fecha); payload.append('numero_respaldo', form.numero_respaldo);
    payload.append('recibido_por', form.recibido_por); payload.append('observacion', form.observacion); payload.append('lineas', JSON.stringify(lineas));
    if (form.respaldo) payload.append('respaldo', form.respaldo);
    setSaving(true);
    try { await registrarRecepcionMaterialPOA(payload); toast.success('Recepción registrada. Los saldos fueron actualizados.'); onSaved?.(); onClose?.(); }
    catch (error) { toast.error(error?.response?.data?.detail || 'No se pudo registrar la recepción.'); }
    finally { setSaving(false); }
  };

  return <Modal onClose={onClose}><div className="modal-panel w-11/12 max-w-4xl rounded-xl"><div className="modal-header flex items-center justify-between p-4"><div><b>Registrar recepción</b><p className="text-xs text-slate-500">Orden {orden.numero} · {orden.proveedor}</p></div><button type="button" onClick={onClose}><FaTimes /></button></div><form onSubmit={guardar} className="space-y-4 p-5"><p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-slate-800 dark:text-blue-100">Registre solo lo que ingresó físicamente. Puede realizar varias recepciones hasta completar la orden.</p><div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-semibold">Fecha<input required type="date" className="poa-input mt-1 w-full" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label><label className="text-sm font-semibold">N.º de acta/factura<input className="poa-input mt-1 w-full" value={form.numero_respaldo} onChange={(e) => setForm({ ...form, numero_respaldo: e.target.value })} /></label><label className="text-sm font-semibold">Recibido por<input required className="poa-input mt-1 w-full" value={form.recibido_por} onChange={(e) => setForm({ ...form, recibido_por: e.target.value })} /></label></div><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-slate-50 text-left dark:bg-slate-800"><tr><th className="p-3">Ítem</th><th>Comprado</th><th>Ya recibido</th><th>Saldo</th><th className="p-3">Recibir ahora</th></tr></thead><tbody>{pendientes.map((detalle) => <tr key={detalle.id} className="border-t dark:border-slate-700"><td className="p-3"><b>{detalle.item}</b><small className="block text-slate-500">{detalle.partida} · {detalle.unidad_medida}</small></td><td>{detalle.cantidad_comprada}</td><td>{detalle.cantidad_recibida}</td><td className="font-semibold">{detalle.saldo}</td><td className="p-2"><input min="0" max={detalle.saldo} type="number" className="poa-input w-28" value={cantidades[detalle.id] || ''} onChange={(e) => setCantidades({ ...cantidades, [detalle.id]: e.target.value })} /></td></tr>)}</tbody></table></div><div className="grid gap-3 md:grid-cols-2"><label className="text-sm font-semibold">Archivo de respaldo<input type="file" className="mt-1 block w-full text-sm" onChange={(e) => setForm({ ...form, respaldo: e.target.files?.[0] || null })} /></label><label className="text-sm font-semibold">Observación<textarea className="poa-input mt-1 w-full" rows="2" value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} /></label></div><div className="flex justify-end gap-2"><button type="button" className="btn-cancel rounded px-3 py-2" onClick={onClose}>Cancelar</button><button disabled={saving} className="btn-success rounded px-3 py-2"><FaSave className="mr-2 inline" />{saving ? 'Guardando…' : 'Registrar recepción'}</button></div></form></div></Modal>;
};

export default RegistrarRecepcionModal;
