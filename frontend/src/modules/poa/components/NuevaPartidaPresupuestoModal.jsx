import React, { useEffect, useState } from 'react';
import { createPartidaPresupuesto, getCatalogoPartidas, updatePartidaPresupuesto } from '../../../apis/poa.api';
import { Modal } from './base';
import toast from 'react-hot-toast';

const NOMBRES_PARTIDA = {
  '22110': 'Pasajes Al Interior Del País',
  '22210': 'Viáticos Por Viajes Al Interior Del País',
  '32100': 'Papel',
  '39100': 'Material De Limpieza E Higiene',
  '39500': 'Útiles De Escritorio Y Oficina',
};

const NuevaPartidaPresupuestoModal = ({ actividadId, partida, onClose, onSaved }) => {
  const editando = Boolean(partida?.id);
  const [form, setForm] = useState({ codigo: '', nombre: '' });
  const [codigosDisponibles, setCodigosDisponibles] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({ codigo: partida?.codigo || '', nombre: partida?.nombre || '' });
  }, [partida]);

  useEffect(() => {
    let mounted = true;
    getCatalogoPartidas()
      .then((res) => {
        if (!mounted) return;
        const opciones = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setCodigosDisponibles(opciones.map((opcion) => String(opcion.codigo || opcion.id || '').trim()).filter(Boolean));
      })
      .catch(() => { if (mounted) setCodigosDisponibles([]); });
    return () => { mounted = false; };
  }, []);

  const cambiarCodigo = (codigo) => {
    setForm((prev) => ({
      codigo,
      nombre: NOMBRES_PARTIDA[codigo] || prev.nombre,
    }));
    setError('');
  };

  const guardar = async (event) => {
    event.preventDefault();
    const codigo = form.codigo.trim();
    const nombre = form.nombre.trim();
    if (!codigo || !nombre) {
      setError('Ingresa el código y el nombre con los que se mostrará la partida.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const payload = { codigo, nombre };
      const res = editando
        ? await updatePartidaPresupuesto(partida.id, payload)
        : await createPartidaPresupuesto({ ...payload, actividad_id: Number(actividadId) });
      toast.success(editando ? 'Partida actualizada' : 'Partida creada');
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      const data = err?.response?.data;
      const message = data?.codigo || data?.nombre || data?.detail || 'No se pudo guardar la partida.';
      setError(Array.isArray(message) ? message.join(' ') : String(message));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel w-full max-w-lg rounded-xl">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <div>
            <h3 className="font-semibold text-slate-900">{editando ? 'Editar partida' : 'Nueva partida presupuestaria'}</h3>
            <p className="mt-1 text-xs text-slate-500">La partida agrupa los ítems que se agregarán debajo.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">×</button>
        </div>
        <form onSubmit={guardar} className="modal-body space-y-4 p-5">
          <div>
            <label htmlFor="codigo-partida-presupuesto" className="mb-1 block text-sm font-medium text-slate-700">Código de partida</label>
            <input
              id="codigo-partida-presupuesto"
              list="codigos-partida-presupuesto"
              value={form.codigo}
              onChange={(event) => cambiarCodigo(event.target.value)}
              autoComplete="off"
              required
              maxLength={50}
              placeholder="Ej.: 22110"
              className="poa-input w-full px-3 py-2"
            />
            <datalist id="codigos-partida-presupuesto">
              {[...new Set([...codigosDisponibles, form.codigo].filter(Boolean))].map((codigo) => <option key={codigo} value={codigo} />)}
            </datalist>
            <p className="mt-1 text-xs text-slate-500">Puedes seleccionar un código usado en el catálogo o escribir uno nuevo.</p>
          </div>
          <div>
            <label htmlFor="nombre-partida-presupuesto" className="mb-1 block text-sm font-medium text-slate-700">Nombre de la partida</label>
            <input
              id="nombre-partida-presupuesto"
              value={form.nombre}
              onChange={(event) => { setForm((prev) => ({ ...prev, nombre: event.target.value })); setError(''); }}
              required
              maxLength={200}
              placeholder="Ej.: Pasajes Al Interior Del País"
              className="poa-input w-full px-3 py-2"
            />
          </div>
          {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button>
            <button type="submit" disabled={guardando} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{guardando ? 'Guardando...' : (editando ? 'Guardar cambios' : 'Crear partida')}</button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default NuevaPartidaPresupuestoModal;
