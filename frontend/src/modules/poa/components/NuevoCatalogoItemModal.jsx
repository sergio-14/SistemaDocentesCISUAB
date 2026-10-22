import React, { useState, useEffect } from 'react';
import IconButton from './IconButton';
import { FaTimes } from 'react-icons/fa';
import { createCatalogoItem, updateCatalogoItem } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import { Input, Modal } from './base';
import Dialog from './base/Dialog';
import { buildClientErrorMessages, formatApiErrors, mapApiErrorsToFieldErrors, ModalErrorAlert } from './formErrorUtils';

const NuevoCatalogoItemModal = ({ partida, item, onClose, onCreated, onUpdated, stacked = false }) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [replaceDialog, setReplaceDialog] = useState(null);
  const [form, setForm] = useState({
    partida: '',
    detalle: '',
    unidad_medida: '',
  });

  useEffect(() => {
    if (item && typeof item === 'object') {
      setForm({
        partida: item.partida ?? partida?.codigo ?? '',
        detalle: item.detalle ?? item.descripcion ?? item.nombre ?? item.titulo ?? '',
        unidad_medida: item.unidad_medida ?? item.unidad ?? item.uom ?? '',
      });
    } else if (partida) {
      setForm(prev => ({
        ...prev,
        partida: partida.codigo ?? prev.partida,
        unidad_medida: partida.unidad_medida || partida.unidad || prev.unidad_medida,
      }));
    }
  }, [item, partida]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessages([]);
    setFieldErrors({});
    if (!String(form.partida || '').trim() || !String(form.detalle || '').trim()) {
      const nextFieldErrors = {};
      if (!String(form.partida || '').trim()) nextFieldErrors.partida = 'Requerido.';
      if (!String(form.detalle || '').trim()) nextFieldErrors.detalle = 'Requerido.';
      setFieldErrors(nextFieldErrors);
      setErrorMessages(buildClientErrorMessages(nextFieldErrors));
      return;
    }

    const payload = {
      partida: form.partida.trim(),
      detalle: form.detalle.trim(),
      unidad_medida: form.unidad_medida || null,
    };

    setSubmitting(true);
    try {
      if (item && item.id) {
        const res = await updateCatalogoItem(item.id, payload);
        toast.success('Item actualizado');
        if (onUpdated) onUpdated(res.data || res);
        if (onClose) onClose();
      } else {
        let res;
        try {
          res = await createCatalogoItem(payload);
        } catch (createErr) {
          const conflict = createErr?.response?.status === 409 && createErr?.response?.data?.requires_confirmation;
          if (!conflict) throw createErr;

          const duplicateId = createErr?.response?.data?.duplicate_item_id;
          if (!duplicateId) throw createErr;

          setReplaceDialog({ duplicateId, payload });
          return;
        }

        toast.success('Item creado');
        if (onCreated) onCreated(res.data || res);
        if (onClose) onClose();
      }
    } catch (err) {
      const resp = err?.response?.data;
      if (resp && typeof resp === 'object') {
        const newFieldErrors = mapApiErrorsToFieldErrors(resp);
        setFieldErrors(newFieldErrors);
        const messages = formatApiErrors(resp);
        setErrorMessages(messages);
      } else {
        const messages = formatApiErrors(err?.message || String(err));
        setErrorMessages(messages);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} className={stacked ? 'poa-stacked-modal' : ''}>
      <Dialog
        open={Boolean(replaceDialog)}
        type="warning"
        title="Reemplazar item existente"
        message="Ya existe un item con ese DETALLE. ¿Deseas reemplazar el existente?"
        confirmText="Reemplazar"
        cancelText="Cancelar"
        onCancel={() => setReplaceDialog(null)}
        onConfirm={async () => {
          const target = replaceDialog;
          if (!target?.duplicateId) return;
          try {
            const res = await updateCatalogoItem(target.duplicateId, target.payload);
            toast.success('Item existente reemplazado');
            if (onUpdated) onUpdated(res.data || res);
            if (onClose) onClose();
          } catch (err) {
            const messages = formatApiErrors(err?.response?.data || err?.message || String(err));
            setErrorMessages(messages);
          } finally {
            setReplaceDialog(null);
          }
        }}
      />
      <div className="modal-panel rounded-xl w-full max-w-md">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h3 className="font-semibold">{item?.id ? 'Editar ítem de catálogo' : 'Nuevo ítem de catálogo'}</h3>
          <IconButton onClick={onClose} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" ariaLabel="Cerrar">
            <FaTimes />
          </IconButton>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 modal-body">
          <ModalErrorAlert title="No se pudo guardar el ítem de catálogo:" messages={errorMessages} />
          <div>
            <Input
              label="partida"
              name="partida"
              value={form.partida}
              onChange={handleChange}
              error={fieldErrors.partida}
            />
            {fieldErrors.partida && <div className="text-sm text-red-600 dark:text-red-400 mt-1">{fieldErrors.partida}</div>}
          </div>

          <div>
            <Input
              label="DETALLE"
              name="detalle"
              value={form.detalle}
              onChange={handleChange}
              error={fieldErrors.detalle}
            />
            {fieldErrors.detalle && <div className="text-sm text-red-600 dark:text-red-400 mt-1">{fieldErrors.detalle}</div>}
          </div>

          <div>
            <Input
              label="Unidad de medida"
              name="unidad_medida"
              value={form.unidad_medida}
              onChange={handleChange}
            />
          </div>
          <div className="flex justify-end gap-2 modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel px-3 py-1 rounded border">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="btn-success px-4 py-1 rounded">
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default NuevoCatalogoItemModal;
