import React, { useMemo, useState } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { Modal } from './base';
import { registrarEntregaMaterialPOA } from '../../../apis/poa.api';

const RegistrarEntregaModal = ({ detalleRecepcion, detalleOrden, onClose, onSaved }) => {
  const actividades = useMemo(() => (detalleOrden?.actividades_origen || [])
    .map((actividad) => ({
      ...actividad,
      saldo: Math.max(0, Number(actividad.cantidad_requerida) - Number(actividad.cantidad_entregada || 0)),
    }))
    .filter((actividad) => actividad.saldo > 0), [detalleOrden]);
  const [form, setForm] = useState({
    cantidades: {},
    fecha: new Date().toISOString().slice(0, 10),
    nombre_receptor: '',
    ci_receptor: '',
    cargo_receptor: '',
    telefono_receptor: '',
    observacion: '',
    acta: null,
  });
  const [saving, setSaving] = useState(false);
  const total = Object.values(form.cantidades).reduce((suma, cantidad) => suma + Number(cantidad || 0), 0);
  const saldoDisponible = Number(detalleRecepcion?.saldo_entrega || 0);

  const guardar = async (event) => {
    event.preventDefault();
    const lineas = actividades
      .map((actividad) => ({ actividad: actividad.id, cantidad_entregada: Number(form.cantidades[actividad.id] || 0) }))
      .filter((linea) => linea.cantidad_entregada > 0);
    if (!lineas.length || !form.nombre_receptor.trim()) {
      return toast.error('Seleccione las actividades, cantidades y datos del receptor.');
    }
    if (lineas.some((linea) => linea.cantidad_entregada > actividades.find((actividad) => actividad.id === linea.actividad).saldo)) {
      return toast.error('Una cantidad supera lo planificado para su actividad.');
    }
    if (total > saldoDisponible) return toast.error('La entrega supera el stock disponible.');

    const payload = new FormData();
    payload.append('detalle_recepcion', detalleRecepcion.id);
    payload.append('lineas', JSON.stringify(lineas));
    [['fecha', form.fecha], ['nombre_receptor', form.nombre_receptor], ['ci_receptor', form.ci_receptor],
      ['cargo_receptor', form.cargo_receptor], ['telefono_receptor', form.telefono_receptor],
      ['observacion', form.observacion]].forEach(([key, value]) => payload.append(key, value));
    if (form.acta) payload.append('acta_archivo', form.acta);

    setSaving(true);
    try {
      await registrarEntregaMaterialPOA(payload);
      toast.success(`Entrega registrada para ${lineas.length} actividad(es).`);
      onSaved?.();
      onClose?.();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'No se pudo registrar la entrega.');
    } finally {
      setSaving(false);
    }
  };

  return <Modal onClose={onClose}>
    <div className="modal-panel w-11/12 max-w-4xl rounded-xl">
      <div className="modal-header flex items-center justify-between p-4">
        <div>
          <b>Entrega de materiales a actividades</b>
          <p className="text-xs text-slate-500">{detalleOrden.item} · disponible: {saldoDisponible} {detalleOrden.unidad_medida}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar"><FaTimes /></button>
      </div>
      <form onSubmit={guardar} className="space-y-4 p-5">
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          Marque la cantidad que entrega a cada actividad. El total no puede superar el saldo recibido ni el requerimiento pendiente.
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left"><tr>
              <th className="p-3">Actividad solicitante</th><th>Planificado</th><th>Ya entregado</th><th>Pendiente</th><th className="p-3">Entregar ahora</th>
            </tr></thead>
            <tbody>{actividades.map((actividad) => <tr key={actividad.id} className="border-t">
              <td className="p-3"><b>{actividad.codigo} · {actividad.nombre}</b></td>
              <td>{actividad.cantidad_requerida} {detalleOrden.unidad_medida}</td>
              <td>{actividad.cantidad_entregada || 0}</td>
              <td className="font-semibold">{actividad.saldo}</td>
              <td className="p-2"><input aria-label={`Cantidad para ${actividad.codigo}`} min="0" max={Math.min(actividad.saldo, saldoDisponible)} type="number" className="poa-input w-28" value={form.cantidades[actividad.id] || ''} onChange={(event) => setForm((actual) => ({ ...actual, cantidades: { ...actual.cantidades, [actividad.id]: event.target.value } }))} /></td>
            </tr>)}
            {!actividades.length && <tr><td colSpan="5" className="p-5 text-center text-slate-500">No quedan cantidades planificadas para entregar.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className={`text-right text-sm font-bold ${total > saldoDisponible ? 'text-red-600' : 'text-slate-700'}`}>
          Total seleccionado: {total} / {saldoDisponible} {detalleOrden.unidad_medida}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold">Fecha<input required type="date" className="poa-input mt-1 w-full" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} /></label>
          <label className="text-sm font-semibold">Nombre del receptor<input required className="poa-input mt-1 w-full" value={form.nombre_receptor} onChange={(event) => setForm({ ...form, nombre_receptor: event.target.value })} /></label>
          <label className="text-sm font-semibold">C.I. / documento<input className="poa-input mt-1 w-full" value={form.ci_receptor} onChange={(event) => setForm({ ...form, ci_receptor: event.target.value })} /></label>
          <label className="text-sm font-semibold">Cargo<input className="poa-input mt-1 w-full" value={form.cargo_receptor} onChange={(event) => setForm({ ...form, cargo_receptor: event.target.value })} /></label>
          <label className="text-sm font-semibold">Teléfono<input className="poa-input mt-1 w-full" value={form.telefono_receptor} onChange={(event) => setForm({ ...form, telefono_receptor: event.target.value })} /></label>
          <label className="text-sm font-semibold">Acta firmada<input type="file" className="mt-1 block w-full text-sm" onChange={(event) => setForm({ ...form, acta: event.target.files?.[0] || null })} /></label>
        </div>
        <label className="block text-sm font-semibold">Observación<textarea className="poa-input mt-1 w-full" rows="2" value={form.observacion} onChange={(event) => setForm({ ...form, observacion: event.target.value })} /></label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-cancel rounded px-3 py-2" onClick={onClose}>Cancelar</button>
          <button disabled={saving || !actividades.length || total > saldoDisponible} className="btn-success rounded px-3 py-2"><FaSave className="mr-2 inline" />{saving ? 'Guardando…' : 'Registrar entrega'}</button>
        </div>
      </form>
    </div>
  </Modal>;
};

export default RegistrarEntregaModal;