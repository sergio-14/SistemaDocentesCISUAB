import React, { useState, useEffect, useRef } from 'react';
import { createObjetivoEspecifico, updateObjetivo, crearSolicitudCambioPOA } from '../../../apis/poa.api';
import IconButton from './IconButton';
import { FaTimes, FaFileImport, FaSave } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { Input, Textarea, Modal } from './base';
import { buildClientErrorMessages, formatApiErrors, mapApiErrorsToFieldErrors, ModalErrorAlert } from './formErrorUtils';

const NuevoObjetivoModal = ({ onClose, onCreated, documentoId, objetivo, existingObjetivos = [], onUpdated, onImport, documentoEstado = '' }) => {
  const isEdit = Boolean(objetivo && objetivo.id !== undefined);
  const defaultCodigo = isEdit ? (objetivo?.codigo || '') : 'OE-';
  const [codigo, setCodigo] = useState(defaultCodigo);
  const [descripcion, setDescripcion] = useState(objetivo?.descripcion || '');
  const codigoRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const requestChangeMode = ['aprobado', 'ejecucion'].includes(String(documentoEstado || '').toLowerCase());

  const focusFirstError = (errors) => {
    const firstKey = Object.keys(errors || {})[0];
    if (!firstKey) return;
    requestAnimationFrame(() => {
      const field = document.querySelector(`[name="${firstKey}"]`);
      if (field) {
        field.focus();
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  useEffect(() => {
    if (objetivo) {
      setCodigo(objetivo?.codigo || '');
      setDescripcion(objetivo?.descripcion || '');
    } else {
      setDescripcion('');
    }
    setErrorMessages([]);
    setFieldErrors({});
  }, [objetivo]);

  useEffect(() => {
    if (!isEdit && codigoRef.current) {
      const el = codigoRef.current;
      try {
        el.focus();
        const length = el.value ? el.value.length : 0;
        if (el.setSelectionRange) {
          el.setSelectionRange(length, length);
        } else if (el.createTextRange) {
          const range = el.createTextRange();
          range.collapse(true);
          range.moveEnd('character', length);
          range.moveStart('character', length);
          range.select();
        }
      } catch (e) {
        // fallthrough silencioso
      }
    }
  }, [isEdit]);

  const handleCreate = async (e) => {
    e && e.preventDefault && e.preventDefault();
    setErrorMessages([]);
    setFieldErrors({});
    if (!descripcion) {
      const nextErrors = { descripcion: 'La descripción es obligatoria.' };
      setFieldErrors(nextErrors);
      setErrorMessages(buildClientErrorMessages(nextErrors));
      focusFirstError(nextErrors);
      return;
    }

    const nameLower = (descripcion || '').trim().toLowerCase();
    const codeLower = (codigo || '').trim().toLowerCase();
    const duplicateName = existingObjetivos.find(o => String(o.descripcion || o.nombre || '').trim().toLowerCase() === nameLower && (!isEdit || Number(o.id) !== Number(objetivo.id)));
    if (duplicateName) {
      setFieldErrors({ descripcion: 'Ya existe un objetivo con la misma descripción en este documento.' });
      setErrorMessages(['Descripción: ya existe un objetivo con la misma descripción en este documento.']);
      focusFirstError({ descripcion: true });
      return;
    }
    const duplicateCode = existingObjetivos.find(o => String(o.codigo || '').trim().toLowerCase() === codeLower && codeLower !== '' && (!isEdit || Number(o.id) !== Number(objetivo.id)));
    if (duplicateCode) {
      const nextErrors = { codigo: 'Ya existe un objetivo con el mismo código en este documento.' };
      setFieldErrors(nextErrors);
      setErrorMessages(['Código: ya existe un objetivo con el mismo código en este documento.']);
      focusFirstError(nextErrors);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        documento_id: Number(documentoId),
        codigo: (codigo === 'OE-') ? '' : (codigo || ''),
        descripcion,
      };
      if (requestChangeMode) {
        await crearSolicitudCambioPOA({
          documento: Number(documentoId),
          tipo_objeto: 'objetivo',
          objeto_id: isEdit ? objetivo.id : null,
          accion: isEdit ? 'editar' : 'crear',
          payload,
          descripcion: isEdit ? 'Modificar objetivo especifico.' : 'Crear objetivo especifico.',
          resumen: {
            titulo: isEdit ? 'Editar objetivo especifico' : 'Nuevo objetivo especifico',
            codigo: payload.codigo,
            descripcion: payload.descripcion,
          },
        });
        toast.success('Solicitud de cambios enviada al Director de Carrera');
        if (onClose) onClose();
        return;
      }
      if (isEdit) {
        const res = await updateObjetivo(objetivo.id, payload);
        if (onUpdated) onUpdated(res.data);
        toast.success(res.data?.message || 'Objetivo actualizado correctamente.');
      } else {
        const res = await createObjetivoEspecifico(payload);
        if (onCreated) onCreated(res.data);
        toast.success(res.data?.message || 'Objetivo creado correctamente.');
      }
      if (onClose) onClose();
    } catch (err) {
      const nextFieldErrors = mapApiErrorsToFieldErrors(err?.response?.data || {});
      setFieldErrors(nextFieldErrors);
      const messages = formatApiErrors(err?.response?.data || err.message || 'Error al guardar objetivo');
      setErrorMessages(messages);
      focusFirstError(nextFieldErrors);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (onImport) return onImport();
    const el = document.querySelector('input[name="codigo-input"]');
    if (el) el.focus();
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel rounded-xl w-11/12 max-w-lg">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <div className="font-semibold text-lg">{isEdit ? 'Editar Objetivo Específico' : 'Nuevo Objetivo Específico'}</div>
          <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <div className="p-6 modal-body">

          <ModalErrorAlert title="No se pudo guardar el objetivo:" messages={errorMessages} />

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Código</label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  ref={codigoRef}
                  name="codigo"
                  value={codigo}
                  onChange={e => {
                    setCodigo(e.target.value);
                    if (fieldErrors.codigo) setFieldErrors(prev => ({ ...prev, codigo: '' }));
                  }}
                  className="flex-1"
                  error={fieldErrors.codigo}
                />
                <IconButton icon={<FaFileImport />} onClick={handleImport} className="btn-cancel border px-3 py-2 rounded text-sm" title="Importar">Importar</IconButton>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Descripción</label>
              <Textarea
                name="descripcion"
                value={descripcion}
                onChange={e => {
                  setDescripcion(e.target.value);
                  if (fieldErrors.descripcion) setFieldErrors(prev => ({ ...prev, descripcion: '' }));
                }}
                rows={4}
                error={fieldErrors.descripcion}
              />
            </div>

            <div className="flex justify-end gap-3 modal-actions">
              <IconButton icon={<FaTimes />} onClick={() => onClose && onClose()} className="btn-cancel border px-3 py-2 rounded" title="Cancelar">Cancelar</IconButton>
              <IconButton icon={<FaSave />} type="submit" disabled={loading} className="btn-primary px-3 py-2 rounded" title={loading ? 'Guardando...' : (requestChangeMode ? 'Enviar solicitud de cambios' : (isEdit ? 'Guardar' : 'Crear'))}>
                {loading ? 'Guardando...' : (requestChangeMode ? 'Enviar solicitud de cambios' : (isEdit ? 'Guardar' : 'Crear'))}
              </IconButton>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default NuevoObjetivoModal;
