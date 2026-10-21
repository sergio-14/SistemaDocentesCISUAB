import React, { useEffect, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import {
  getDetallePresupuestoPorActividad,
  getActividadPorId,
  deleteDetalle,
  updateActividad,
  crearSolicitudCambioPOA,
  getUnidadesDestinoPresupuesto,
  createUnidadDestinoPresupuesto,
  getPartidasPresupuestoPorActividad,
  deletePartidaPresupuesto,
} from '../../../apis/poa.api';
import NuevoPresupuestoModal from '../components/NuevoPresupuestoModal';
import NuevaPartidaPresupuestoModal from '../components/NuevaPartidaPresupuestoModal';
import Dialog from '../components/base/Dialog';
import toast from 'react-hot-toast';
import { getPoaNavigationContext, normalizePoaGestion, savePoaNavigationContext } from '../utils/navigationContext';

const PresupuestosPage = () => {
  const location = useLocation();
  const navContext = React.useMemo(() => getPoaNavigationContext(location?.state), [location?.key, location?.state]);
  const outletContext = useOutletContext() || {};
  const poaPermissions = outletContext.poaPermissions || {};
  const canEdit = !!poaPermissions.canEdit;
  // La actividad puede llegar por navigation state desde Activities
  const actividad = location?.state?.actividad || navContext?.actividad || null;
  const actividadId = actividad?.id || null;

  const [detalle, setDetalle] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNuevo, setShowNuevo] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedDetalle, setSelectedDetalle] = useState(null);
  const [detalleEdit, setDetalleEdit] = useState(null);
  const [deleteDialogDetalle, setDeleteDialogDetalle] = useState(null);
  const [partidasPresupuesto, setPartidasPresupuesto] = useState([]);
  const [selectedPartidaId, setSelectedPartidaId] = useState('');
  const [showPartidaModal, setShowPartidaModal] = useState(false);
  const [partidaEdit, setPartidaEdit] = useState(null);
  const [deleteDialogPartida, setDeleteDialogPartida] = useState(null);
  const [unidadesDestino, setUnidadesDestino] = useState([]);
  const [unidadDestinoId, setUnidadDestinoId] = useState('');
  const [agregandoUnidad, setAgregandoUnidad] = useState(false);
  const [nuevaUnidad, setNuevaUnidad] = useState('');
  const [guardandoUnidad, setGuardandoUnidad] = useState(false);
  const [cargandoUnidades, setCargandoUnidades] = useState(false);
  const [cargandoActividadUnidad, setCargandoActividadUnidad] = useState(false);
  const documentoEstado = String(location?.state?.documentoEstado || navContext?.documentoEstado || actividad?.documento_estado || detalle?.[0]?.documento_estado || '').toLowerCase();
  const documentoId = location?.state?.documentoId || navContext?.documentoId || actividad?.documento_id || detalle?.[0]?.documento_id || null;
  const gestionNavegacion = normalizePoaGestion(location?.state?.gestion || navContext?.gestion || actividad?.documento_gestion || detalle?.[0]?.documento_gestion);
  const objetivoId = location?.state?.objetivoId || navContext?.objetivoId || actividad?.objetivo || actividad?.objetivo_id || null;
  const canRequestChange = canEdit && ['aprobado', 'ejecucion'].includes(documentoEstado);
  const canEditDirectly = canEdit && (!documentoEstado || ['elaboracion', 'observado'].includes(documentoEstado));

  useEffect(() => {
    savePoaNavigationContext({
      gestion: gestionNavegacion,
      documentoId,
      documentoEstado,
      objetivoId,
      actividadId,
      actividad,
    });
  }, [actividad, actividadId, documentoEstado, documentoId, gestionNavegacion, objetivoId]);

  const openNuevoPresupuesto = () => {
    if (documentoEstado === 'revision') {
      toast.error('El documento esta en revision. Espere la observacion o aprobacion del Director.');
      return;
    }
    const partidaSeleccionada = partidasPresupuesto.find((partida) => String(partida.id) === String(selectedPartidaId));
    if (!partidaSeleccionada) {
      if (canEditDirectly) setShowPartidaModal(true);
      else toast.error('Esta actividad todavía no tiene partidas presupuestarias. Deben crearse durante la planificación.');
      return;
    }
    if (!partidaSeleccionada.codigo) {
      toast.error('Edita la partida y asígnale un código antes de agregar ítems.');
      return;
    }
    setSelectedDetalle(null);
    setShowNuevo(true);
  };

  // Mostrar header al montar el componente
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent('show-global-header')); } catch (e) { }
    return () => {
      // Limpiar la selección al desmontar
      try { window.dispatchEvent(new CustomEvent('hide-global-header')); } catch (e) { }
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (canEdit && e?.detail?.page === 'presupuestos') {
        openNuevoPresupuesto();
      }
    };
    window.addEventListener('open-new', handler);
    return () => window.removeEventListener('open-new', handler);
  }, [canEdit, canEditDirectly, documentoEstado, partidasPresupuesto, selectedPartidaId]);

  // Cargar detalle cuando tengamos actividad
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!actividadId) return;
      setLoading(true);
      try {
        const res = await getDetallePresupuestoPorActividad(Number(actividadId), documentoId);
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        if (!mounted) return;
        setDetalle(list || []);
      } catch (err) {
        if (!mounted) return;
        // silence for now; could set an error state
        console.error('Error cargando detalle presupuesto', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [actividadId, documentoId]);
  useEffect(() => {
    let mounted = true;
    if (!actividadId) {
      setPartidasPresupuesto([]);
      setSelectedPartidaId('');
      return () => { mounted = false; };
    }
    getPartidasPresupuestoPorActividad(Number(actividadId))
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setPartidasPresupuesto(list);
        setSelectedPartidaId((prev) => list.some((partida) => String(partida.id) === String(prev))
          ? prev
          : (list[0] ? String(list[0].id) : ''));
      })
      .catch((err) => { if (mounted) console.error('Error cargando partidas del presupuesto', err); });
    return () => { mounted = false; };
  }, [actividadId]);

  useEffect(() => {
    let mounted = true;
    setCargandoUnidades(true);
    getUnidadesDestinoPresupuesto()
      .then((res) => {
        if (!mounted) return;
        const opciones = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setUnidadesDestino(opciones);
      })
      .catch((err) => console.error('Error cargando unidades destino del presupuesto', err))
      .finally(() => { if (mounted) setCargandoUnidades(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const unidad = actividad?.unidad_destino_presupuesto;
    const id = unidad && typeof unidad === 'object' ? unidad.id : unidad;
    setUnidadDestinoId(id ? String(id) : '');
  }, [actividadId, actividad?.unidad_destino_presupuesto]);

  useEffect(() => {
    let mounted = true;
    if (!actividadId) {
      setCargandoActividadUnidad(false);
      return () => { mounted = false; };
    }
    setCargandoActividadUnidad(true);
    getActividadPorId(actividadId)
      .then((res) => {
        if (!mounted) return;
        const actualizada = res.data || {};
        const unidad = actualizada.unidad_destino_presupuesto;
        const id = unidad && typeof unidad === 'object' ? unidad.id : unidad;
        setUnidadDestinoId(id ? String(id) : '');
        savePoaNavigationContext({
          gestion: gestionNavegacion,
          documentoId,
          documentoEstado,
          objetivoId,
          actividadId,
          actividad: { ...actividad, ...actualizada },
        });
      })
      .catch((err) => console.error('Error cargando la unidad de la actividad', err))
      .finally(() => { if (mounted) setCargandoActividadUnidad(false); });
    return () => { mounted = false; };
  }, [actividad, actividadId, documentoEstado, documentoId, gestionNavegacion, objetivoId]);

  const guardarUnidadDestino = async (id, nombreUnidad = null) => {
    if (!actividadId || !canEditDirectly) return;
    const anterior = unidadDestinoId;
    const siguiente = id ? String(id) : '';
    setUnidadDestinoId(siguiente);
    setGuardandoUnidad(true);
    try {
      await updateActividad(actividadId, {
        unidad_destino_presupuesto: siguiente ? Number(siguiente) : null,
      });
      const unidadNombre = nombreUnidad || unidadesDestino.find((unidad) => String(unidad.id) === siguiente)?.nombre || null;
      savePoaNavigationContext({
        gestion: gestionNavegacion,
        documentoId,
        documentoEstado,
        objetivoId,
        actividadId,
        actividad: {
          ...actividad,
          unidad_destino_presupuesto: siguiente ? Number(siguiente) : null,
          unidad_destino_presupuesto_nombre: unidadNombre,
        },
      });
      toast.success('Unidad destino del presupuesto actualizada');
    } catch (err) {
      setUnidadDestinoId(anterior);
      const msg = err?.response?.data?.unidad_destino_presupuesto || err?.response?.data?.detail || 'No se pudo actualizar la unidad.';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setGuardandoUnidad(false);
    }
  };

  const agregarUnidadDestino = async () => {
    const nombre = nuevaUnidad.trim();
    if (!nombre || !canEditDirectly || guardandoUnidad) return;
    const existente = unidadesDestino.find((unidad) => unidad.nombre?.trim().toLocaleLowerCase() === nombre.toLocaleLowerCase());
    setGuardandoUnidad(true);
    try {
      let unidad = existente;
      if (!unidad) {
        const res = await createUnidadDestinoPresupuesto(nombre);
        unidad = res.data;
        setUnidadesDestino((prev) => [...prev, unidad].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      }
      setAgregandoUnidad(false);
      setNuevaUnidad('');
      await guardarUnidadDestino(unidad.id, unidad.nombre);
    } catch (err) {
      const msg = err?.response?.data?.nombre || err?.response?.data?.detail || 'No se pudo agregar la unidad.';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setGuardandoUnidad(false);
    }
  };

  // Cuando cambia la selección, notificar al header global
  useEffect(() => {
    if (selectedDetalle) {
      try { window.dispatchEvent(new CustomEvent('show-global-header', { detail: { selectedActividad: selectedDetalle } })); } catch (e) { }
      try { window.dispatchEvent(new CustomEvent('header-actions', { detail: { selectedActividad: selectedDetalle } })); } catch (e) { }
    } else {
      try { window.dispatchEvent(new CustomEvent('hide-global-header')); } catch (e) { }
    }
  }, [selectedDetalle]);

  // Escuchar acciones del header para editar/eliminar presupuesto
  useEffect(() => {
    const handler = async (e) => {
      const d = e?.detail || {};
      const action = d.action;
      const actividad = d.actividad || d.selectedActividad || null;
      if (!action || !actividad) return;
      if (!canEdit) return;
      if (documentoEstado === 'revision') {
        toast.error('El documento esta en revision. Espere la observacion o aprobacion del Director.');
        return;
      }
      if (action === 'edit') {
        // abrir modal en modo edición
        setDetalleEdit(actividad);
        setSelectedPartidaId(String(actividad.grupo_partida_id || actividad.grupo_partida?.id || ''));
        setShowNuevo(true);
      } else if (action === 'delete') {
        setDeleteDialogDetalle(actividad);
      }
    };
    window.addEventListener('header-action', handler);
    return () => window.removeEventListener('header-action', handler);
  }, [canEdit, documentoEstado]);

  const guardarPartidaEnLista = (partida) => {
    setPartidasPresupuesto((prev) => {
      const existe = prev.some((actual) => actual.id === partida.id);
      const siguiente = existe
        ? prev.map((actual) => actual.id === partida.id ? partida : actual)
        : [...prev, partida];
      return siguiente.sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''), 'es', { numeric: true }));
    });
    setSelectedPartidaId(String(partida.id));
    if (!partidaEdit) {
      setSelectedDetalle(null);
      if (partida.codigo) setShowNuevo(true);
    }
    setPartidaEdit(null);
  };

  const confirmDeletePartida = async () => {
    const target = deleteDialogPartida;
    if (!target?.id) return;
    setDeletingId(`partida-${target.id}`);
    try {
      await deletePartidaPresupuesto(target.id);
      const siguientes = partidasPresupuesto.filter((partida) => partida.id !== target.id);
      setPartidasPresupuesto(siguientes);
      setDetalle((prev) => (prev || []).filter((item) => String(item.grupo_partida_id || item.grupo_partida?.id) !== String(target.id)));
      setSelectedDetalle((prev) => String(prev?.grupo_partida_id || prev?.grupo_partida?.id) === String(target.id) ? null : prev);
      setSelectedPartidaId((prev) => String(prev) === String(target.id) ? String(siguientes[0]?.id || '') : prev);
      setDeleteDialogPartida(null);
      toast.success('Partida e ítems asociados eliminados');
    } catch (err) {
      const data = err?.response?.data;
      toast.error(data?.detail || 'No se pudo eliminar la partida.');
    } finally {
      setDeletingId(null);
    }
  };
  const confirmDeleteDetalle = async () => {
    const target = deleteDialogDetalle;
    if (!target?.id) return;

    setDeletingId(target.id);
    try {
      if (canRequestChange) {
        await crearSolicitudCambioPOA({
          documento: Number(documentoId),
          tipo_objeto: 'presupuesto',
          objeto_id: target.id,
          accion: 'eliminar',
          payload: {
            actividad_id: Number(actividad.id),
            partida: target.partida || '',
            item: target.item || '',
            cantidad: target.cantidad || 0,
            costo_unitario: target.costo_unitario || 0,
          },
          descripcion: 'Eliminar item de presupuesto.',
          resumen: {
            titulo: 'Eliminar presupuesto',
            item: target.item || '',
            partida: target.partida || '',
          },
        });
        setSelectedDetalle(null);
        setDeleteDialogDetalle(null);
        toast.success('Solicitud de eliminacion enviada al Director de Carrera');
        return;
      }
      await deleteDetalle(target.id);
      setDetalle(prev => (prev || []).filter(it => it.id !== target.id));
      setSelectedDetalle(null);
      setDeleteDialogDetalle(null);
      toast.success('Ítem eliminado');
    } catch (err) {
      const msg = err?.response?.data || err?.message || String(err);
      toast.error('Error eliminando: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    } finally {
      setDeletingId(null);
    }
  };


  const formatMoney = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Se muestran las partidas configuradas para la actividad, aunque todavía no tengan ítems.
  const grouped = React.useMemo(() => partidasPresupuesto.map((partida) => ({
    ...partida,
    items: (detalle || []).filter((item) => String(item.grupo_partida_id || item.grupo_partida?.id) === String(partida.id)),
  })), [detalle, partidasPresupuesto]);
  // Calcular montos por tipo (Inversión vs Funcionamiento)
  const { montoTotal, montoInversion, montoFuncionamiento } = React.useMemo(() => {
    if (!detalle || detalle.length === 0) return { montoTotal: 0, montoInversion: 0, montoFuncionamiento: 0 };
    
    let total = 0;
    let inversion = 0;
    let funcionamiento = 0;

    for (const it of detalle) {
      const monto = (Number(it.cantidad) || 0) * (Number(it.costo_unitario) || 0);
      total += monto;

      // Detectar si es inversión o funcionamiento por tipo, categoría o partida
      const tipo = (it.tipo || it.categoria || '').toLowerCase();
      const partida = (it.partida || '').toLowerCase();
      
      if (tipo.includes('inversion') || partida.includes('inversion') || partida.includes('601')) {
        inversion += monto;
      } else if (tipo.includes('funcionamiento') || partida.includes('funcionamiento') || partida.includes('602')) {
        funcionamiento += monto;
      } else {
        // Por defecto, asignar a funcionamiento si no se puede determinar
        funcionamiento += monto;
      }
    }

    return { montoTotal: total, montoInversion: inversion, montoFuncionamiento: funcionamiento };
  }, [detalle]);

  // Actualizar los montos en la actividad del backend cuando cambie el detalle
  useEffect(() => {
    if (!actividad || !actividad.id || !canEditDirectly) return;
    
    const actualizarMontos = async () => {
      try {
        await updateActividad(actividad.id, {
          monto_funcion: montoFuncionamiento,
          monto_inversion: montoInversion
        });
      } catch (err) {
        if (err?.response?.status === 403) {
          return;
        }
        console.error('Error actualizando montos de actividad:', err);
      }
    };

    actualizarMontos();
  }, [montoFuncionamiento, montoInversion, actividad, canEditDirectly]);

  // Si no viene actividad, mostrar explicación
  return (
  <section className="flex flex-col items-start flex-1 pt-0 pb-8 px-0 w-full text-sm">
      <Dialog
        open={Boolean(deleteDialogDetalle)}
        type="danger"
        title="Eliminar presupuesto"
        message={deleteDialogDetalle ? `¿Confirma eliminar este item de presupuesto?\n${deleteDialogDetalle.item || deleteDialogDetalle.detalle || deleteDialogDetalle.id || ''}` : ''}
        confirmText={deletingId === deleteDialogDetalle?.id ? 'Eliminando...' : 'Eliminar'}
        cancelText="Cancelar"
        confirmDisabled={deletingId === deleteDialogDetalle?.id}
        onCancel={() => setDeleteDialogDetalle(null)}
        onClose={() => setDeleteDialogDetalle(null)}
        onConfirm={confirmDeleteDetalle}
      />
      <Dialog
        open={Boolean(deleteDialogPartida)}
        type="danger"
        title="Eliminar partida presupuestaria"
        message={deleteDialogPartida ? `¿Eliminar “${deleteDialogPartida.nombre}” y sus ${detalle.filter((item) => String(item.grupo_partida_id || item.grupo_partida?.id) === String(deleteDialogPartida.id)).length} ítems asociados?` : ''}
        confirmText={deletingId === `partida-${deleteDialogPartida?.id}` ? 'Eliminando...' : 'Eliminar partida'}
        cancelText="Cancelar"
        confirmDisabled={deletingId === `partida-${deleteDialogPartida?.id}`}
        onCancel={() => setDeleteDialogPartida(null)}
        onClose={() => setDeleteDialogPartida(null)}
        onConfirm={confirmDeletePartida}
      />
        <div className="w-full mb-4 flex items-start justify-between">


        </div>

      {!actividad ? (
        <div className="w-full bg-white border rounded p-6 text-gray-700">Seleccione una actividad en la lista de actividades para ver o agregar su presupuesto detallado.</div>
      ) : (
        <>
          <div className="w-full mb-4 mt-0">
            <div className="poa-mobile-page-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 border border-blue-300 dark:border-blue-700 shadow-2xl dark:shadow-blue-900/50">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200 dark:bg-blue-700/50 rounded-full blur-3xl opacity-50"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-300 dark:bg-blue-700/50 rounded-full blur-3xl opacity-50"></div>
              
              {/* Content */}
              <div className="relative p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-blue-900 dark:text-white drop-shadow-sm">{actividad.nombre}</h3>
                  </div>
                  <div className="inline-flex items-center px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-shadow whitespace-nowrap">
                    <span className="font-mono text-sm sm:text-base font-bold">{actividad.codigo}</span>
                  </div>
                </div>
                
                <div className="poa-mobile-kpi-strip poa-mobile-kpi-strip-2 grid grid-cols-2 gap-3 pt-1">
                  <div className="poa-mobile-kpi-card flex flex-col bg-white dark:bg-slate-900 rounded-lg p-3 shadow-xl">
                    <label htmlFor="unidad-destino-presupuesto" className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300 mb-1">
                      Unidad a la que se solicitará el presupuesto
                    </label>
                    <select
                      id="unidad-destino-presupuesto"
                      value={unidadDestinoId}
                      disabled={!canEditDirectly || guardandoUnidad || cargandoUnidades || cargandoActividadUnidad}
                      onChange={(e) => {
                        if (e.target.value === '__agregar__') {
                          setAgregandoUnidad(true);
                          return;
                        }
                        guardarUnidadDestino(e.target.value);
                      }}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">{cargandoUnidades ? 'Cargando unidades...' : 'Seleccione una unidad'}</option>
                      {unidadesDestino.map((unidad) => (
                        <option key={unidad.id} value={String(unidad.id)}>{unidad.nombre}</option>
                      ))}
                      {canEditDirectly && <option value="__agregar__">+ Agregar nueva unidad...</option>}
                    </select>
                    {agregandoUnidad && canEditDirectly && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          autoFocus
                          value={nuevaUnidad}
                          onChange={(e) => setNuevaUnidad(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') agregarUnidadDestino(); }}
                          placeholder="Nombre de la unidad"
                          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                        />
                        <button type="button" onClick={agregarUnidadDestino} disabled={!nuevaUnidad.trim() || guardandoUnidad} className="rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Guardar</button>
                        <button type="button" onClick={() => { setAgregandoUnidad(false); setNuevaUnidad(''); }} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Cancelar</button>
                      </div>
                    )}
                    <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {canEditDirectly ? 'Este dato aparecerá en el encabezado del Formulario Nro. 3.' : 'La unidad no se puede cambiar mientras el documento está bloqueado para edición.'}
                    </span>
                  </div>
                  <div className="poa-mobile-kpi-card flex flex-col bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 backdrop-blur-sm rounded-lg p-3 shadow-xl dark:shadow-2xl dark:shadow-blue-900/50 hover:shadow-2xl transition-shadow transform hover:scale-105">
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-100 mb-1">Total Ítems</span>
                    <span className="text-2xl sm:text-3xl font-bold text-white">{Array.isArray(detalle) ? detalle.length : 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bloque de montos rediseñado */}
          <div className="w-full mb-4">
            <div className="poa-mobile-kpi-strip poa-mobile-kpi-strip-3 flex flex-col gap-3 sm:flex-row">
              <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-3 text-white">
                <p className="text-xs sm:text-sm font-bold uppercase tracking-widest opacity-90">Monto total</p>
                <p className="text-lg sm:text-xl font-bold">Bs. {formatMoney(montoTotal)}</p>
              </div>
              <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-3 text-white">
                <p className="text-xs sm:text-sm font-bold uppercase tracking-widest opacity-90">Monto inversión</p>
                <p className="text-lg sm:text-xl font-bold">Bs. {formatMoney(montoInversion)}</p>
              </div>
              <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-3 text-white">
                <p className="text-xs sm:text-sm font-bold uppercase tracking-widest opacity-90">Monto funcionamiento</p>
                <p className="text-lg sm:text-xl font-bold">Bs. {formatMoney(montoFuncionamiento)}</p>
              </div>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Partidas presupuestarias</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Crea cada partida y agrega sus ítems dentro del grupo correspondiente.</p>
            </div>
            {canEditDirectly && (
              <button
                type="button"
                onClick={() => { setPartidaEdit(null); setShowPartidaModal(true); }}
                className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
              >
                + Nueva partida
              </button>
            )}
          </div>

          <div className="w-full overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-sm poa-table-wrapper dark:border-slate-700 dark:bg-slate-900">

     

          <table className="poa-mobile-card-table poa-presupuesto-detail-table w-full min-w-0 table-fixed border-collapse poa-table poa-border-black poa-border-cyan poa-borders-ultra font-sans text-xs leading-tight text-blue-900 dark:text-white">
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr className="poa-thead poa-table-head-formal text-center font-sans text-xs leading-tight font-bold">
                <th className="poa-cell font-medium" rowSpan={2}>Detalle</th>
                <th className="poa-cell font-medium" rowSpan={2}>Unidad de<br />medida</th>
                <th className="poa-cell font-medium" rowSpan={2}>Características</th>
                <th className="poa-cell font-medium" rowSpan={2}>Partida<br />Presup</th>
                <th className="poa-cell font-medium" rowSpan={2}>Cantidad<br />Requerida</th>
                <th className="poa-cell font-medium" colSpan={2}>Costo Bs.</th>
                <th className="poa-cell font-medium" rowSpan={2}>Mes<br />Requerimiento</th>
              </tr>
              <tr className="poa-thead poa-table-head-formal text-center font-sans text-xs leading-tight font-bold">
                <th className="poa-cell font-medium">Unitario</th>
                <th className="poa-cell font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="font-sans text-xs leading-tight">
              {loading ? (
                <tr><td colSpan={8} className="px-2 py-4 text-sm text-gray-500">Cargando...</td></tr>
              ) : grouped.length === 0 ? (
                <tr><td colSpan={8} className="px-2 py-4 text-sm text-gray-500 text-center">Esta actividad no detalla presupuestos.</td></tr>
              ) : (
                grouped.map((g) => (
                  <React.Fragment key={g.id}>
                    <tr className="poa-presupuesto-group-row bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white">
                      <td colSpan={8} className="poa-cell p-0">
                        <div className="flex flex-wrap items-center gap-2 border-l-4 border-blue-700 bg-slate-100 px-3 py-2 shadow-sm dark:border-blue-400 dark:bg-slate-800">
                          <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">{g.codigo || '—'}</span>
                          <span>{g.nombre} <span className="ml-1 text-xs font-normal text-slate-500">({g.items.length} ítems)</span></span>
                          <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                            {(canEditDirectly || canRequestChange) && (
                              <button
                                type="button"
                                onClick={() => { setSelectedPartidaId(String(g.id)); setDetalleEdit(null); setSelectedDetalle(null); setShowNuevo(true); }}
                                disabled={!g.codigo}
                                className="rounded border border-blue-300 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300"
                                title={!g.codigo ? 'Asigna un código a la partida antes de agregar ítems.' : undefined}
                              >
                                {g.codigo ? '+ Agregar ítem' : 'Código requerido'}
                              </button>
                            )}
                            {canEditDirectly && (
                              <>
                                <button type="button" onClick={() => { setPartidaEdit(g); setShowPartidaModal(true); }} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200">Editar</button>
                                <button type="button" onClick={() => setDeleteDialogPartida(g)} className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300">Eliminar</button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {g.items.map((it) => (
                      <tr
                        key={it.id}
                        onClick={() => {
                          setSelectedPartidaId(String(g.id));
                          setSelectedDetalle((prev) => (prev && prev.id === it.id ? null : it));
                        }}
                        aria-selected={selectedDetalle && selectedDetalle.id === it.id ? 'true' : 'false'}
                        data-selected={selectedDetalle && selectedDetalle.id === it.id ? 'true' : 'false'}
                        className={`poa-presupuesto-item-row align-top cursor-pointer transition ${selectedDetalle && selectedDetalle.id === it.id ? 'is-selected font-semibold' : 'odd:bg-white even:bg-slate-50'} text-blue-900 dark:text-white`}
                      >
                        <td data-label="Nombre" className="poa-cell align-top whitespace-normal break-words">{it.item}</td>
                        <td data-label="Unidad" className="poa-cell poa-presupuesto-mobile-hidden align-top text-center">{it.unidad_medida || '—'}</td>
                        <td data-label="Características" className="poa-cell poa-presupuesto-mobile-hidden align-top"><div className="table-cell-clamp">{it.caracteristicas || '—'}</div></td>
                        <td data-label="Código" className="poa-cell align-top text-center">{g.codigo}</td>
                        <td data-label="Cantidad" className="poa-cell align-top text-center">{it.cantidad}</td>
                        <td data-label="Costo unitario" className="poa-cell poa-presupuesto-mobile-hidden align-top text-right">{formatMoney(it.costo_unitario)}</td>
                        <td data-label="Precio total" className="poa-cell align-top text-right">{formatMoney((Number(it.cantidad) || 0) * (Number(it.costo_unitario) || 0))}</td>
                        <td data-label="Mes" className="poa-cell poa-presupuesto-mobile-hidden align-top text-center">{it.mes_requerimiento || '—'}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>

          {/* Modal para nuevo ítem */}
          {showNuevo && (
            <NuevoPresupuestoModal
              actividadId={actividad.id}
              actividad={actividad}
              grupoPartida={partidasPresupuesto.find((partida) => String(partida.id) === String(detalleEdit?.grupo_partida_id || detalleEdit?.grupo_partida?.id || selectedPartidaId)) || null}
              documentoId={documentoId}
              documentoEstado={documentoEstado}
              detalle={detalleEdit}
              onClose={() => { setShowNuevo(false); setDetalleEdit(null); }}
              onCreated={(created) => {
                // append creado
                setDetalle(prev => [created, ...(prev || [])]);
                setShowNuevo(false);
              }}
              onUpdated={(u) => {
                setDetalle(prev => (prev || []).map(it => (it.id === u.id ? u : it)));
                setSelectedDetalle(u);
                setDetalleEdit(null);
                setShowNuevo(false);
              }}
            />
          )}
          {showPartidaModal && (
            <NuevaPartidaPresupuestoModal
              actividadId={actividad.id}
              partida={partidaEdit}
              onClose={() => { setShowPartidaModal(false); setPartidaEdit(null); }}
              onSaved={guardarPartidaEnLista}
            />
          )}
          </div>
        </>
      )}
    </section>
  );
};

export default PresupuestosPage;
