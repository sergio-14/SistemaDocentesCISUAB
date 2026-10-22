import React, { useCallback, useEffect, useState } from 'react';
import {
  FaCalendarAlt,
  FaEdit,
  FaEnvelope,
  FaPlus,
  FaSearch,
  FaToggleOff,
  FaToggleOn,
  FaTrash,
  FaUniversity,
  FaUserCheck,
  FaUserShield,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useOutletContext } from 'react-router-dom';
import { deleteUsuarioPOA, getUsuariosPOA, ROL_POA_CHOICES, updateUsuarioPOA } from '../../../apis/poa.api';
import AsignarAccesoPOAModal from '../components/AsignarAccesoPOAModal';

const ROL_COLOR = {
  elaborador: 'bg-blue-100 text-blue-800 border-blue-200',
};

const ROL_DARK = {
  elaborador: 'dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700',
};

const getRolLabel = (rol) => ROL_POA_CHOICES.find((r) => r.value === rol)?.label || rol;

const getAccessName = (access) => (
  access?.nombre_display ||
  access?.user_detalle?.nombre_completo ||
  access?.docente_detalle?.nombre_completo ||
  'Sin nombre'
);

const getAccessUsername = (access) => access?.user_detalle?.username || access?.docente_detalle?.ci || '';

const getAccessEmail = (access) => access?.user_detalle?.email || access?.docente_detalle?.email || '';

const getAccessCareer = (access) => (
  access?.carrera_detalle?.nombre ||
  access?.carrera_detalle?.codigo ||
  access?.nombre_entidad ||
  'Carrera no especificada'
);

const getAccessInitial = (access) => getAccessName(access)?.[0]?.toUpperCase() || '?';

const formatDate = (value) => {
  if (!value) return 'Sin fecha registrada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha registrada';

  return date.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function AccesosPOAPage() {
  const outletContext = useOutletContext() || {};
  const poaPermissions = outletContext.poaPermissions || {};
  const canManageAccess = !!poaPermissions.canManageAccess;
  const [accesos, setAccesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchAccesos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsuariosPOA();
      const data = res?.data;
      setAccesos(Array.isArray(data) ? data : (data?.results ?? []));
    } catch {
      toast.error('Error al cargar los accesos POA');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccesos(); }, [fetchAccesos]);

  useEffect(() => {
    const handler = (e) => {
      if (canManageAccess && e?.detail?.page === 'accesos') {
        setEditTarget(null);
        setShowModal(true);
      }
    };

    window.addEventListener('open-new', handler);
    return () => window.removeEventListener('open-new', handler);
  }, [canManageAccess]);

  const handleToggleActivo = async (acceso) => {
    if (!canManageAccess) {
      toast.error('No tiene permisos para gestionar accesos POA.');
      return;
    }

    try {
      const res = await updateUsuarioPOA(acceso.id, { activo: !acceso.activo });
      toast.success(res.data.activo ? 'Acceso activado' : 'Acceso desactivado');
      await fetchAccesos();
    } catch (err) {
      const data = err?.response?.data;
      if (err?.response?.status === 400 && data?.detail) {
        toast.error(data.detail);
      } else {
        toast.error('Error al actualizar el estado');
      }
    }
  };

  const handleDelete = async (id) => {
    if (!canManageAccess) {
      toast.error('No tiene permisos para gestionar accesos POA.');
      return;
    }

    try {
      await deleteUsuarioPOA(id);
      setAccesos((prev) => prev.filter((a) => a.id !== id));
      toast.success('Acceso eliminado');
      setConfirmDelete(null);
    } catch {
      toast.error('Error al eliminar el acceso');
    }
  };

  const activeElaborador = accesos.find((a) => a.rol === 'elaborador' && a.activo);
  const inactiveAccesos = accesos.filter((a) => !a.activo);
  const filteredAndSorted = inactiveAccesos
    .filter((a) => {
      const value = search.trim().toLowerCase();
      if (!value) return true;

      const nombre = getAccessName(a).toLowerCase();
      const username = getAccessUsername(a).toLowerCase();
      const entidad = (a.nombre_entidad || getAccessCareer(a)).toLowerCase();
      return nombre.includes(value) || username.includes(value) || entidad.includes(value);
    })
    .sort((a, b) => getAccessName(a).localeCompare(getAccessName(b)));

  if (!canManageAccess) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          No tiene permisos para administrar accesos del modulo POA.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="poa-mobile-page-card accesos-panel rounded-3xl border border-slate-200/90 bg-white/80 p-5 shadow-xl backdrop-blur-sm dark:border-sky-900/40 dark:bg-slate-900/65">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
              <FaUserShield className="text-blue-500" />
              Accesos al Modulo POA
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-300">
              Administra al usuario responsable de elaborar documentos POA.
            </p>
          </div>
          <button
            onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
          >
            <FaPlus />
            {activeElaborador ? 'Cambiar elaborador' : 'Asignar elaborador'}
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/90 px-4 py-3 text-sm font-medium text-blue-800 dark:border-blue-700/70 dark:bg-blue-950/45 dark:text-blue-100">
          Solo puede existir un elaborador activo. Al asignar uno nuevo, el anterior queda inactivo para conservar el historial.
        </div>

        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Elaborador activo
            </h2>
          </div>

          {activeElaborador ? (
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white via-blue-50/80 to-sky-100/70 p-4 shadow-sm dark:border-blue-700/60 dark:from-slate-900 dark:via-blue-950/45 dark:to-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-black text-white shadow-md">
                    {getAccessInitial(activeElaborador)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black leading-tight text-slate-900 dark:text-white">
                        {getAccessName(activeElaborador)}
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        <FaUserCheck />
                        Activo
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                      Responsable actual para elaborar y gestionar documentos POA.
                    </p>
                    <span className={`mt-3 inline-block rounded-full border px-2.5 py-1 text-xs font-bold ${ROL_COLOR[activeElaborador.rol] || 'bg-gray-100 text-gray-700 border-gray-200'} ${ROL_DARK[activeElaborador.rol] || 'dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'}`}>
                      {activeElaborador.rol_display || getRolLabel(activeElaborador.rol)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 sm:justify-end">
                  <button
                    onClick={() => { setEditTarget(activeElaborador); setShowModal(true); }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white/80 px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50 dark:border-blue-700 dark:bg-slate-900/80 dark:text-blue-200 dark:hover:bg-blue-950/50"
                  >
                    <FaEdit size={13} />
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActivo(activeElaborador)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FaToggleOn className="text-emerald-500" />
                    Desactivar
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoItem label="Usuario" value={getAccessUsername(activeElaborador) ? `@${getAccessUsername(activeElaborador)}` : 'Sin usuario'} icon={<FaUserShield />} />
                <InfoItem label="Correo" value={getAccessEmail(activeElaborador) || 'Sin correo'} icon={<FaEnvelope />} />
                <InfoItem label="Carrera" value={getAccessCareer(activeElaborador)} icon={<FaUniversity />} />
                <InfoItem label="Asignado" value={formatDate(activeElaborador.fecha_asignacion || activeElaborador.created_at)} icon={<FaCalendarAlt />} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/70 px-4 py-6 text-center dark:border-blue-700 dark:bg-blue-950/30">
              <FaUserShield className="mx-auto mb-3 text-3xl text-blue-400" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">Sin elaborador activo</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-300">
                Asigna un elaborador para que el modulo POA tenga un responsable activo.
              </p>
              <button
                onClick={() => { setEditTarget(null); setShowModal(true); }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700"
              >
                <FaPlus />
                Asignar elaborador
              </button>
            </div>
          )}
        </section>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Historial de accesos</h2>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {inactiveAccesos.length} usuario{inactiveAccesos.length === 1 ? '' : 's'} inactivo{inactiveAccesos.length === 1 ? '' : 's'} registrado{inactiveAccesos.length === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, usuario o carrera..."
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-blue-500 dark:text-sky-300">
            <div className="mr-3 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
            Cargando...
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-gray-400 dark:border-slate-700 dark:text-slate-400">
            <FaUserShield className="mx-auto mb-3 text-4xl opacity-30" />
            <p className="text-sm">
              {inactiveAccesos.length === 0 ? 'No hay accesos inactivos registrados todavia.' : 'Sin resultados para la busqueda.'}
            </p>
          </div>
        ) : (
          <div className="accesos-table-shell overflow-hidden rounded-2xl border border-gray-100 bg-white shadow dark:border-slate-700 dark:bg-slate-900/70">
            <table className="poa-mobile-card-table accesos-table w-full text-sm">
              <thead>
                <tr className="accesos-table-head text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Rol POA</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((a, idx) => (
                  <tr key={a.id} className={`border-t border-gray-100 transition hover:bg-blue-50/30 dark:border-slate-700/70 dark:hover:bg-sky-900/20 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900/55' : 'bg-gray-50/50 dark:bg-slate-800/35'}`}>
                    <td data-label="Usuario" className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-100">
                      <div>{getAccessName(a)}</div>
                      {getAccessUsername(a) && (
                        <div className="text-xs font-normal text-gray-400 dark:text-slate-400">@{getAccessUsername(a)}</div>
                      )}
                    </td>
                    <td data-label="Rol POA" className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${ROL_COLOR[a.rol] || 'bg-gray-100 text-gray-700 border-gray-200'} ${ROL_DARK[a.rol] || 'dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'}`}>
                        {a.rol_display || getRolLabel(a.rol)}
                      </span>
                    </td>
                    <td data-label="Estado" className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleActivo(a)} title={a.activo ? 'Desactivar' : 'Activar'}>
                        {a.activo
                          ? <FaToggleOn className="mx-auto text-xl text-green-500" />
                          : <FaToggleOff className="mx-auto text-xl text-gray-400 dark:text-slate-500" />}
                      </button>
                    </td>
                    <td data-label="Acciones" className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setEditTarget(a); setShowModal(true); }}
                          className="rounded-lg p-1.5 text-blue-500 transition hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-sky-900/25"
                          title="Editar"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(a)}
                          className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          title="Eliminar"
                        >
                          <FaTrash size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <AsignarAccesoPOAModal
            accesoToEdit={editTarget}
            onClose={() => { setShowModal(false); setEditTarget(null); }}
            onCreated={() => {
              fetchAccesos();
              setShowModal(false);
              setEditTarget(null);
            }}
            onUpdated={() => {
              fetchAccesos();
              setShowModal(false);
              setEditTarget(null);
            }}
          />
        )}

        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
            <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900">
              <h3 className="mb-2 text-lg font-bold text-gray-800 dark:text-slate-100">Eliminar acceso?</h3>
              <p className="mb-5 text-sm text-gray-600 dark:text-slate-300">
                Se eliminara el acceso de <strong>{getAccessName(confirmDelete)}</strong> como{' '}
                <strong>{confirmDelete.rol_display || getRolLabel(confirmDelete.rol)}</strong>. Esta accion no se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium transition hover:bg-gray-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete.id)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Si, eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
      <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-500 dark:text-blue-300">
        {icon}
        {label}
      </div>
      <div className="min-w-0 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}
