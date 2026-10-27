import React, { useMemo, useState } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';
import { Modal, Input } from './base';
import { crearOrdenCompraPOA } from '../../../apis/poa.api';
import toast from 'react-hot-toast';

const NuevaOrdenCompraModal = ({ gestion, items = [], onClose, onCreated }) => {
  const [form, setForm] = useState({ numero: '', proveedor: '', fecha: new Date().toISOString().slice(0, 10), observacion: '', respaldo: null });
  const [seleccion, setSeleccion] = useState({});
  const [loading, setLoading] = useState(false);

  const lineas = useMemo(() => items.flatMap((item, index) => {
    const seleccionItem = seleccion[index];
    if (!seleccionItem?.activo) return [];
    const cantidad = Number(seleccionItem.cantidad || 0);
    const disponible = Number(item.cantidad_pendiente_compra || 0);
    if (cantidad <= 0 || cantidad > disponible) return [];

    let restante = cantidad;
    const origenesCompra = [];
    for (const origen of item.origenes || []) {
      const saldo = Number(origen.cantidad_pendiente || 0);
      const asignada = Math.min(restante, saldo);
      if (asignada > 0) origenesCompra.push({ detalle_id: origen.detalle_id, cantidad: asignada });
      restante -= asignada;
      if (restante <= 0) break;
    }
    if (restante > 0) return [];
    return [{ ...item, cantidad_comprada: cantidad, costo_unitario_real: Number(seleccionItem.costo || 0), origenes_compra: origenesCompra }];
  }), [items, seleccion]);

  const seleccionadoTotal = useMemo(() => lineas.reduce((total, linea) => total + linea.cantidad_comprada, 0), [lineas]);
  const actualizarLinea = (index, cambios) => setSeleccion((actual) => ({
    ...actual,
    [index]: { ...(actual[index] || {}), ...cambios },
  }));

  const guardar = async (event) => {
    event.preventDefault();
    if (!form.numero.trim() || !form.proveedor.trim() || !lineas.length) {
      return toast.error('Complete proveedor, número de compra y seleccione materiales con cantidad disponible.');
    }
    if (items.some((item, index) => seleccion[index]?.activo && Number(seleccion[index]?.cantidad || 0) > Number(item.cantidad_pendiente_compra || 0))) {
      return toast.error('Una cantidad supera el saldo pendiente planificado.');
    }
    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('gestion', Number(gestion));
      payload.append('numero', form.numero);
      payload.append('proveedor', form.proveedor);
      payload.append('fecha', form.fecha);
      payload.append('observacion', form.observacion);
      payload.append('lineas', JSON.stringify(lineas.map((linea) => ({
        partida: linea.partida,
        item: linea.item,
        unidad_medida: linea.unidad_medida,
        caracteristicas: linea.caracteristicas,
        tipo: linea.tipo,
        cantidad_comprada: linea.cantidad_comprada,
        costo_unitario_real: linea.costo_unitario_real,
        origenes_compra: linea.origenes_compra,
      }))));
      if (form.respaldo) payload.append('respaldo', form.respaldo);
      const response = await crearOrdenCompraPOA(payload);
      if (response.data.alertas?.length) toast('Compra registrada. Revise: ' + response.data.alertas.join(' '), { icon: '⚠️' });
      else toast.success('Compra registrada. Registre la recepción cuando ingresen los materiales.');
      onCreated?.(response.data);
      onClose?.();
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.response?.data?.lineas?.[0] || 'No se pudo registrar la compra.');
    } finally {
      setLoading(false);
    }
  };

  return <Modal onClose={onClose}>
    <div className="modal-panel w-11/12 max-w-6xl rounded-xl">
      <div className="modal-header flex justify-between p-4"><div><b>Registrar compra por proveedor</b><p className="text-xs text-slate-500">Gestión {gestion} · se genera una orden independiente para cada proveedor.</p></div><button type="button" onClick={onClose} aria-label="Cerrar"><FaTimes /></button></div>
      <form onSubmit={guardar} className="space-y-4 p-5">
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Seleccione los materiales que comprará ahora, indique cantidades parciales y el costo unitario real. Los saldos quedarán disponibles para compras posteriores.</p>
        <div className="grid gap-3 md:grid-cols-4">
          <Input label="N.º de orden/factura" required value={form.numero} onChange={(event) => setForm({ ...form, numero: event.target.value })} />
          <Input label="Proveedor" required value={form.proveedor} onChange={(event) => setForm({ ...form, proveedor: event.target.value })} />
          <Input label="Fecha de compra" required type="date" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} />
          <label className="text-sm font-semibold">Respaldo de compra<input type="file" className="mt-1 block w-full text-sm" onChange={(event) => setForm({ ...form, respaldo: event.target.files?.[0] || null })} /></label>
        </div>
        <div className="max-h-[45vh] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left"><tr>
              <th className="p-3">Comprar</th><th>Partida / material</th><th>Unidad</th><th>Planificado</th><th>Ya comprado</th><th>Disponible</th><th className="p-3">Cantidad ahora</th><th className="p-3">Costo unitario</th>
            </tr></thead>
            <tbody>{items.map((item, index) => {
              const seleccionado = seleccion[index]?.activo || false;
              const disponible = Number(item.cantidad_pendiente_compra || 0);
              const montoPendiente = Number(item.monto_estimado_pendiente || 0);
              return <tr key={`${item.partida}-${item.item}-${index}`} className="border-t">
                <td className="p-3"><input type="checkbox" aria-label={`Comprar ${item.item}`} checked={seleccionado} disabled={!disponible} onChange={(event) => actualizarLinea(index, {
                  activo: event.target.checked,
                  cantidad: event.target.checked ? String(disponible) : '',
                  costo: event.target.checked && disponible ? (montoPendiente / disponible).toFixed(2) : '',
                })} /></td>
                <td className="py-2"><b>{item.item}</b><small className="block text-slate-500">{item.partida}{item.caracteristicas ? ` · ${item.caracteristicas}` : ''}</small></td>
                <td>{item.unidad_medida}</td><td>{item.cantidad_total}</td><td>{item.cantidad_comprada || 0}</td><td className="font-semibold">{disponible}</td>
                <td className="p-2"><input aria-label={`Cantidad de ${item.item}`} disabled={!seleccionado} min="1" max={disponible} type="number" className="poa-input w-28" value={seleccion[index]?.cantidad || ''} onChange={(event) => actualizarLinea(index, { cantidad: event.target.value })} /></td>
                <td className="p-2"><input aria-label={`Costo unitario de ${item.item}`} disabled={!seleccionado} min="0" step="0.01" type="number" className="poa-input w-32" value={seleccion[index]?.costo ?? ''} onChange={(event) => actualizarLinea(index, { costo: event.target.value })} /></td>
              </tr>;
            })}
            {!items.length && <tr><td colSpan="8" className="p-6 text-center text-slate-500">No hay materiales pendientes de compra para esta gestión.</td></tr>}
            </tbody>
          </table>
        </div>
        <label className="block text-sm font-semibold">Observación<textarea className="poa-input mt-1 w-full" placeholder="Observación opcional" value={form.observacion} onChange={(event) => setForm({ ...form, observacion: event.target.value })} /></label>
        <div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-600">{lineas.length} material(es) · {seleccionadoTotal} unidades en esta compra</span><div className="flex gap-2"><button type="button" className="btn-cancel rounded px-3 py-2" onClick={onClose}>Cancelar</button><button disabled={loading || !lineas.length} className="btn-success rounded px-3 py-2"><FaSave className="mr-2 inline" />{loading ? 'Guardando…' : 'Registrar compra'}</button></div></div>
      </form>
    </div>
  </Modal>;
};

export default NuevaOrdenCompraModal;