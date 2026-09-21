import React, { useMemo, useState } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { Modal } from './base';
import { registrarEntregaMaterialPOA } from '../../../apis/poa.api';

const RegistrarEntregaModal = ({ detalleRecepcion, detalleOrden, onClose, onSaved }) => {
  const actividades = useMemo(() => (detalleOrden?.actividades_origen || []).filter((actividad) => Number(actividad.cantidad_requerida) > Number(actividad.cantidad_entregada || 0)), [detalleOrden]);
  const [form, setForm] = useState({ actividad: actividades[0]?.id || '', cantidad: '', fecha: new Date().toISOString().slice(0, 10), nombre_receptor: '', ci_receptor: '', cargo_receptor: '', telefono_receptor: '', observacion: '', acta: null });
  const [saving, setSaving] = useState(false);
  const actividad = actividades.find((item) => Number(item.id) === Number(form.actividad));
  const maximo = Math.min(Number(detalleRecepcion?.saldo_entrega || 0), Math.max(0, Number(actividad?.cantidad_requerida || 0) - Number(actividad?.cantidad_entregada || 0)));

  const guardar = async (event) => {
    event.preventDefault();
    if (!form.actividad || !form.nombre_receptor.trim() || Number(form.cantidad) <= 0) return toast.error('Complete actividad, cantidad y datos del receptor.');
    if (Number(form.cantidad) > maximo) return toast.error('La cantidad supera el saldo disponible para esta entrega.');
    const payload = new FormData();
    [['detalle_recepcion', detalleRecepcion.id], ['actividad', form.actividad], ['cantidad_entregada', form.cantidad], ['fecha', form.fecha], ['nombre_receptor', form.nombre_receptor], ['ci_receptor', form.ci_receptor], ['cargo_receptor', form.cargo_receptor], ['telefono_receptor', form.telefono_receptor], ['observacion', form.observacion]].forEach(([key, value]) => payload.append(key, value));
    if (form.acta) payload.append('acta_archivo', form.acta);
    setSaving(true);
    try { await registrarEntregaMaterialPOA(payload); toast.success('Entrega registrada a la actividad.'); onSaved?.(); onClose?.(); }
    catch (error) { toast.error(error?.response?.data?.detail || 'No se pudo registrar la entrega.'); }
    finally { setSaving(false); }
  };

  return <Modal onClose={onClose}><div className="modal-panel w-11/12 max-w-3xl rounded-xl"><div className="modal-header flex items-center justify-between p-4"><div><b>Registrar entrega a actividad</b><p className="text-xs text-slate-500">{detalleOrden.item} · saldo recibido: {detalleRecepcion.saldo_entrega}</p></div><button type="button" onClick={onClose}><FaTimes /></button></div><form onSubmit={guardar} className="space-y-4 p-5"><div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-slate-800 dark:text-amber-100">El receptor se registra como dato del acta; no requiere una cuenta ni rol dentro del POA.</div><div className="grid gap-3 md:grid-cols-2"><label className="text-sm font-semibold">Actividad<select required className="poa-input mt-1 w-full" value={form.actividad} onChange={(e) => setForm({ ...form, actividad: e.target.value, cantidad: '' })}>{actividades.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.nombre} (saldo: {item.cantidad_requerida - item.cantidad_entregada})</option>)}</select></label><label className="text-sm font-semibold">Cantidad a entregar<input required min="1" max={maximo} type="number" className="poa-input mt-1 w-full" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} /><small className="text-slate-500">Máximo disponible: {maximo}</small></label><label className="text-sm font-semibold">Fecha<input required type="date" className="poa-input mt-1 w-full" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label><label className="text-sm font-semibold">Nombre del receptor<input required className="poa-input mt-1 w-full" value={form.nombre_receptor} onChange={(e) => setForm({ ...form, nombre_receptor: e.target.value })} /></label><label className="text-sm font-semibold">C.I. / documento<input className="poa-input mt-1 w-full" value={form.ci_receptor} onChange={(e) => setForm({ ...form, ci_receptor: e.target.value })} /></label><label className="text-sm font-semibold">Cargo<input className="poa-input mt-1 w-full" value={form.cargo_receptor} onChange={(e) => setForm({ ...form, cargo_receptor: e.target.value })} /></label><label className="text-sm font-semibold">Teléfono<input className="poa-input mt-1 w-full" value={form.telefono_receptor} onChange={(e) => setForm({ ...form, telefono_receptor: e.target.value })} /></label><label className="text-sm font-semibold">Acta firmada<input type="file" className="mt-1 block w-full text-sm" onChange={(e) => setForm({ ...form, acta: e.target.files?.[0] || null })} /></label></div><label className="block text-sm font-semibold">Observación<textarea className="poa-input mt-1 w-full" rows="2" value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })} /></label><div className="flex justify-end gap-2"><button type="button" className="btn-cancel rounded px-3 py-2" onClick={onClose}>Cancelar</button><button disabled={saving || !actividades.length} className="btn-success rounded px-3 py-2"><FaSave className="mr-2 inline" />{saving ? 'Guardando…' : 'Registrar entrega'}</button></div></form></div></Modal>;
};

export default RegistrarEntregaModal;
