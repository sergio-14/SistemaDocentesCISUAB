import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaSave, FaSearch, FaUserCheck, FaUser } from 'react-icons/fa';
import toast from 'react-hot-toast';
import IconButton from './IconButton';
import { buscarUsuariosSistema, createUsuarioPOA, updateUsuarioPOA, ROL_POA_CHOICES } from '../../../apis/poa.api';
import { Modal } from './base';
import { buildClientErrorMessages, formatApiErrors, mapApiErrorsToFieldErrors, ModalErrorAlert } from './formErrorUtils';

const AsignarAccesoPOAModal = ({ onClose, accesoToEdit, onCreated, onUpdated }) => {
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [rol, setRol] = useState('elaborador');
  const [loading, setLoading] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const searchTimeout = useRef(null);

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
    if (!accesoToEdit) return;
    setRol('elaborador');
    if (accesoToEdit.user_detalle) {
      setSelectedUser({
        id: accesoToEdit.user_detalle.id,
        nombre_completo: accesoToEdit.user_detalle.nombre_completo,
        username: accesoToEdit.user_detalle.username,
        email: accesoToEdit.user_detalle.email || '',
      });
      setSearchQ(accesoToEdit.user_detalle.nombre_completo || accesoToEdit.user_detalle.username);
    } else if (accesoToEdit.docente_detalle) {
      // Compatibilidad con registros anteriores que solo tienen docente
      setSelectedUser({
        id: null,
        nombre_completo: accesoToEdit.docente_detalle.nombre_completo,
        username: accesoToEdit.docente_detalle.email || '',
        email: accesoToEdit.docente_detalle.email || '',
      });
      setSearchQ(accesoToEdit.docente_detalle.nombre_completo || '');
    }
  }, [accesoToEdit]);

  const handleSearch = (val) => {
    setSearchQ(val);
    setSelectedUser(null);
    clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await buscarUsuariosSistema(val.trim());
        const lista = Array.isArray(res?.data) ? res.data
          : Array.isArray(res?.data?.results) ? res.data.results : [];
        setSearchResults(lista);
      } catch (err) {
        console.error('[AsignarAccesoPOA] Error buscando usuarios:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setSearchQ(user.nombre_completo || user.username);
    setSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const nextFieldErrors = {};
    setErrorMessages([]);
    setFieldErrors({});
    if (!selectedUser) nextFieldErrors.user = 'Seleccione un usuario del sistema.';
    if (!rol) nextFieldErrors.rol = 'Seleccione un rol POA.';
    if (Object.keys(nextFieldErrors).length > 0) {
      const messages = buildClientErrorMessages(nextFieldErrors);
      setFieldErrors(nextFieldErrors);
      setErrorMessages(messages);
      focusFirstError(nextFieldErrors);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        user: selectedUser.id,
        rol: 'elaborador',
        nombre_entidad: '',
        activo: true,
      };
      if (accesoToEdit?.id) {
        const res = await updateUsuarioPOA(accesoToEdit.id, payload);
        toast.success('Acceso actualizado');
        if (onUpdated) onUpdated(res?.data || res);
      } else {
        const res = await createUsuarioPOA(payload);
        if (res.status === 200) {
          toast.success('Elaborador reactivado correctamente');
        } else {
          toast.success('Acceso asignado correctamente');
        }
        if (onCreated) onCreated(res?.data || res);
      }
      onClose?.();
    } catch (err) {
      const data = err?.response?.data;
      const messages = formatApiErrors(data || err?.message || 'Error al guardar');
      const nextFieldErrors = mapApiErrorsToFieldErrors(data);

      if (err?.response?.status === 400 && data?.detail) {
        setErrorMessages([data.detail]);
      } else {
        setFieldErrors(nextFieldErrors);
        setErrorMessages(messages);
        focusFirstError(nextFieldErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  const isEditor = accesoToEdit != null;

  return (
    <Modal onClose={onClose}>
      <div className="modal-panel rounded-xl w-full max-w-lg">

        <div className="modal-header flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <FaUserCheck className="text-xl opacity-90" />
            <span className="font-bold text-base">
              {isEditor ? 'Editar Acceso POA' : 'Asignar Acceso POA'}
            </span>
          </div>
          <IconButton icon={<FaTimes />} onClick={onClose}
            className="btn-header-icon rounded-full w-8 h-8 flex items-center justify-center"
            title="Cerrar" ariaLabel="Cerrar" />
        </div>

        <div className="px-6 py-5 modal-body space-y-5">
          <ModalErrorAlert title="No se pudo guardar el acceso:" messages={errorMessages} />
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-gray-700 dark:text-slate-300">
              Usuario del sistema <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500">
                <FaSearch size={13} />
              </span>
              <input
                name="user"
                value={searchQ}
                onChange={e => handleSearch(e.target.value)}
                disabled={isEditor}
                placeholder="Buscar por nombre, usuario o correo..."
                className={`poa-input block w-full rounded-lg pl-9 pr-4 py-2.5 text-sm ${fieldErrors.user ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' : ''}`}
                autocomplete="off"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-500 dark:text-sky-400">Buscando…</span>
              )}
            </div>
            {fieldErrors.user && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.user}</div>}
            {searchResults.length > 0 && !selectedUser && (
              <ul className="mt-1 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto bg-white dark:bg-slate-800 z-10">
                {searchResults.map(u => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => selectUser(u)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm flex items-center gap-3"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {(u.nombre_completo || u.username)?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 dark:text-slate-200 truncate">{u.nombre_completo || u.username}</p>
                        <p className="text-gray-500 dark:text-slate-400 text-xs truncate">
                          @{u.username}
                          {u.email ? ` · ${u.email}` : ''}
                          {u.perfil?.rol ? ` · ${u.perfil.rol}` : ''}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedUser && (
              <div className="mt-2 flex items-center gap-3 bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600 rounded-lg px-4 py-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {(selectedUser.nombre_completo || selectedUser.username)?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-blue-900 dark:text-slate-200 text-sm truncate">
                    {selectedUser.nombre_completo || selectedUser.username}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-slate-400 truncate">
                    @{selectedUser.username}{selectedUser.email ? ` · ${selectedUser.email}` : ''}
                  </p>
                </div>
                {!isEditor && (
                  <button type="button" onClick={() => { setSelectedUser(null); setSearchQ(''); }}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0 transition">
                    <FaTimes size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-slate-300">
              Rol / Permiso <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {ROL_POA_CHOICES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRol('elaborador')}
                  className="text-left px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all duration-150 border-blue-500 bg-blue-600 text-white shadow-md"
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-2 bg-white" />
                  {r.label}
                </button>
              ))}
            </div>
            {fieldErrors.rol && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.rol}</div>}
          </div>

        </div>

        <div className="px-6 py-4 modal-actions flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="border border-gray-300 dark:border-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition font-medium text-gray-700 dark:text-slate-300">
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || !selectedUser}
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition">
            <FaSave size={13} />
            {loading ? 'Guardando…' : (isEditor ? 'Guardar cambios' : 'Asignar acceso')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AsignarAccesoPOAModal;
