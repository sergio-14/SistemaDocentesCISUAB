import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FaSave, FaTimes } from 'react-icons/fa';
import { createProgramaPOA } from '../../../apis/poa.api';
import IconButton from './IconButton';
import { Input, Modal } from './base';
import { formatApiErrors, mapApiErrorsToFieldErrors, ModalErrorAlert } from './formErrorUtils';

const NuevoProgramaPOAModal = ({ onClose, onCreated }) => {
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessages, setErrorMessages] = useState([]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const valor = nombre.trim();
    setFieldErrors({});
    setErrorMessages([]);
    if (!valor) {
      setFieldErrors({ nombre: 'El nombre del programa es obligatorio.' });
      return;
    }

    setSaving(true);
    try {
      const response = await createProgramaPOA({ nombre: valor });
      toast.success('Programa creado');
      onCreated?.(response.data || response);
      onClose?.();
    } catch (error) {
      const data = error?.response?.data || error?.message || String(error);
      setFieldErrors(typeof data === 'object' ? mapApiErrorsToFieldErrors(data) : {});
      setErrorMessages(formatApiErrors(data));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel rounded-xl w-full max-w-md">
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h3 className="font-semibold">Nuevo programa</h3>
          <IconButton icon={<FaTimes />} onClick={onClose} className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center" title="Cerrar" ariaLabel="Cerrar" />
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 modal-body">
          <ModalErrorAlert title="No se pudo guardar el programa:" messages={errorMessages} />
          <Input
            label="Nombre del programa"
            name="nombre"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            error={fieldErrors.nombre}
            autoFocus
          />
          <div className="flex justify-end gap-2 modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel px-3 py-1 rounded border">Cancelar</button>
            <IconButton icon={<FaSave />} type="submit" disabled={saving} className="btn-success px-3 py-1 rounded" title="Guardar programa">
              {saving ? 'Guardando...' : 'Guardar'}
            </IconButton>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default NuevoProgramaPOAModal;
