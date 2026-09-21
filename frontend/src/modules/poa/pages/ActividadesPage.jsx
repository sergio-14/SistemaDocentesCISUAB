import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import NuevaActividadModal from '../components/NuevaActividadModal';
import IconButton from '../components/IconButton';
import Dialog from '../components/base/Dialog';
import { FaPlus } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { getActividadesPorObjetivo, getObjetivoPorId, deleteActividad, crearSolicitudCambioPOA } from '../../../apis/poa.api';
import { getPoaNavigationContext, normalizePoaGestion, savePoaNavigationContext } from '../utils/navigationContext';

const ActividadesPage = () => {
  const { objetivoEspecificoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navContext = React.useMemo(() => getPoaNavigationContext(location?.state), [location?.key, location?.state]);
  const outletContext = useOutletContext() || {};
  const poaPermissions = outletContext.poaPermissions || {};
  const canEdit = !!poaPermissions.canEdit;
  const [actividades, setActividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNueva, setShowNueva] = useState(false);
  const [selectedActividad, setSelectedActividad] = useState(null);
  const [actividadEdit, setActividadEdit] = useState(null);
  const [deleteDialogActividad, setDeleteDialogActividad] = useState(null);
  const [objetivo, setObjetivo] = useState(null);
  const [objetivoLoading, setObjetivoLoading] = useState(true);
  const [objetivoError, setObjetivoError] = useState(null);
  const documentoEstado = String(location?.state?.documentoEstado || navContext?.documentoEstado || objetivo?.documento_estado || '').toLowerCase();
  const documentoId = location?.state?.documentoId || navContext?.documentoId || objetivo?.documento || actividades?.[0]?.documento_id || null;
  const gestionNavegacion = normalizePoaGestion(location?.state?.gestion || navContext?.gestion || objetivo?.documento_gestion || actividades?.[0]?.documento_gestion);
  const canRequestChange = canEdit && ['aprobado', 'ejecucion'].includes(documentoEstado);

  const withNavigationData = (actividad) => ({
    ...(actividad || {}),
    objetivo: actividad?.objetivo || actividad?.objetivo_id || Number(objetivoEspecificoId),
    objetivoId: actividad?.objetivo || actividad?.objetivo_id || Number(objetivoEspecificoId),
    documento_id: actividad?.documento_id || documentoId,
    documento_estado: actividad?.documento_estado || documentoEstado,
    documento_gestion: actividad?.documento_gestion || gestionNavegacion,
    gestion: actividad?.gestion || gestionNavegacion,
  });

  useEffect(() => {
    setLoading(true); setError(null);
    getActividadesPorObjetivo(objetivoEspecificoId)
      .then(res => { const list = Array.isArray(res.data) ? res.data : (res.data.results || []); setActividades(list); })
      .catch(err => setError(err?.response?.data || err?.message || 'Error cargando actividades'))
      .finally(() => setLoading(false));
  }, [objetivoEspecificoId]);

  // Cargar datos del objetivo específico (codigo, descripcion)
  useEffect(() => {
    if (!objetivoEspecificoId) return;
    setObjetivoLoading(true); setObjetivoError(null);
    getObjetivoPorId(objetivoEspecificoId)
      .then(res => setObjetivo(res.data))
      .catch(err => setObjetivoError(err?.response?.data || err?.message || 'Error cargando objetivo'))
      .finally(() => setObjetivoLoading(false));
  }, [objetivoEspecificoId]);

  useEffect(() => {
    savePoaNavigationContext({
      gestion: gestionNavegacion,
      documentoId,
      documentoEstado,
      objetivoId: Number(objetivoEspecificoId),
    });
  }, [documentoEstado, documentoId, gestionNavegacion, objetivoEspecificoId]);

  const openNueva = () => {
    if (documentoEstado === 'revision') {
      toast.error('El documento esta en revision. Espere la observacion o aprobacion del Director.');
      return;
    }
    setShowNueva(true);
  };
  const closeNueva = () => setShowNueva(false);
  

  // Mostrar header al montar el componente
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent('show-global-header')); } catch (e) { }
    return () => {
      // Limpiar la selección al desmontar
      try { window.dispatchEvent(new CustomEvent('header-actions', { detail: { selectedActividad: null } })); } catch (e) { }
    };
  }, []);

  // Listen for header 'Nuevo' events
  useEffect(() => {
    const handler = (e) => {
      if (canEdit && e?.detail?.page === 'actividades') openNueva();
    };
    window.addEventListener('open-new', handler);
    return () => window.removeEventListener('open-new', handler);
  }, [canEdit, documentoEstado]);

  const formatMoney = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Cuando cambia la selección, notificar al header global
  useEffect(() => {
    if (selectedActividad) {
      const selectedActividadConContexto = withNavigationData(selectedActividad);
      // No hacer scroll, solo mostrar el header con los botones
      try { window.dispatchEvent(new CustomEvent('show-global-header', { detail: { selectedActividad: selectedActividadConContexto } })); } catch (e) { /* silencioso */ }
      try { window.dispatchEvent(new CustomEvent('header-actions', { detail: { selectedActividad: selectedActividadConContexto } })); } catch (e) { /* silencioso */ }
    }
    else {
      // notify header to clear actions but keep header visible
      try { window.dispatchEvent(new CustomEvent('header-actions', { detail: { selectedActividad: null } })); } catch (e) { /* silencioso */ }
    }
  }, [selectedActividad, documentoEstado, documentoId, gestionNavegacion, objetivoEspecificoId]);

  // Escuchar acciones iniciadas desde el header (edit/delete)
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
        setActividadEdit(actividad);
        setShowNueva(true);
      } else if (action === 'delete') {
        setDeleteDialogActividad(actividad);
      }
    };
    window.addEventListener('header-action', handler);
    return () => window.removeEventListener('header-action', handler);
  }, [canEdit, documentoEstado]);

  const confirmarEliminarActividad = async () => {
    const actividad = deleteDialogActividad;
    if (!actividad) return;
    try {
      if (canRequestChange) {
        await crearSolicitudCambioPOA({
          documento: Number(documentoId),
          tipo_objeto: 'actividad',
          objeto_id: actividad.id,
          accion: 'eliminar',
          payload: {
            codigo: actividad.codigo || '',
            nombre: actividad.nombre || '',
            objetivo_id: Number(objetivoEspecificoId),
          },
          descripcion: 'Eliminar actividad.',
          resumen: {
            titulo: 'Eliminar actividad',
            codigo: actividad.codigo || '',
            nombre: actividad.nombre || '',
          },
        });
        setDeleteDialogActividad(null);
        toast.success('Solicitud de eliminacion enviada al Director de Carrera');
        return;
      }
      await deleteActividad(actividad.id);
      setActividades(prev => (prev || []).filter(a => a.id !== actividad.id));
      setSelectedActividad(null);
      toast.success('Actividad eliminada');
    } catch (err) {
      const msg = err?.response?.data || err?.message || String(err);
      toast.error('Error eliminando actividad: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    } finally {
      setDeleteDialogActividad(null);
    }
  };

  // Helper para obtener valores del indicador intentando varias claves/nombres que el backend
  // podría usar. Devuelve '—' si no encuentra nada.
  const getIndicadorField = (act, candidates) => {
    for (const key of candidates) {
      // Soportar paths con punto para anidar (ej. 'indicador.descripcion')
      const parts = String(key).split('.').filter(Boolean);
      let cur = act;
      for (const p of parts) {
        if (cur === undefined || cur === null) { cur = undefined; break; }
        cur = cur[p];
      }
      if (cur !== undefined && cur !== null && String(cur).trim() !== '') return cur;
    }
    return '—';
  };

  // Calcular totales para los indicadores
  const { totalActividades, montoTotalFuncion, montoTotalInversion, montoTotal } = React.useMemo(() => {
    if (!actividades || actividades.length === 0) return { totalActividades: 0, montoTotalFuncion: 0, montoTotalInversion: 0, montoTotal: 0 };
    
    let funcion = 0;
    let inversion = 0;

    for (const act of actividades) {
      funcion += Number(act.monto_funcion || act.monto_funcion_valor || act.monto_funcion_bs || 0);
      inversion += Number(act.monto_inversion || act.monto_inversion_valor || act.monto_inversion_bs || 0);
    }

    return { 
      totalActividades: actividades.length, 
      montoTotalFuncion: funcion, 
      montoTotalInversion: inversion,
      montoTotal: funcion + inversion
    };
  }, [actividades]);

  const { actividadesCompletadas, actividadesProgramadas } = React.useMemo(() => {
    if (!actividades || actividades.length === 0) return { actividadesCompletadas: 0, actividadesProgramadas: 0 };

    let completadas = 0;
    let programadas = 0;

    for (const act of actividades) {
      const estado = String(act.estado || '').toLowerCase();
      if (estado === 'completado') {
        completadas += 1;
      } else if (estado === 'programado') {
        programadas += 1;
      }
    }

    return { actividadesCompletadas: completadas, actividadesProgramadas: programadas };
  }, [actividades]);

  return (
  <section className="flex flex-col items-start justify-start flex-1 pt-0 pb-12 w-full px-0">
      <Dialog
        open={Boolean(deleteDialogActividad)}
        type="danger"
        title="Eliminar actividad"
        message={deleteDialogActividad ? `Eliminar actividad ${deleteDialogActividad.codigo} - ${deleteDialogActividad.nombre}?` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmarEliminarActividad}
        onCancel={() => setDeleteDialogActividad(null)}
      />
      {/* Tarjeta del objetivo con diseño mejorado */}
      <div className="w-full mb-4 mt-0">
        {objetivoLoading ? (
          <div className="text-blue-800">Cargando objetivo...</div>
        ) : objetivoError ? (
          <div className="text-red-600">{String(objetivoError)}</div>
        ) : objetivo ? (
          <div className="poa-mobile-page-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 border border-blue-300 dark:border-blue-700 shadow-2xl dark:shadow-blue-900/50">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200 dark:bg-blue-700/50 rounded-full blur-3xl opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-300 dark:bg-blue-700/50 rounded-full blur-3xl opacity-50"></div>
            
            {/* Content */}
            <div className="relative p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-blue-900 dark:text-white drop-shadow-sm">{objetivo.descripcion}</h3>
                </div>
                <div className="inline-flex items-center px-6 py-3 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-shadow whitespace-nowrap">
                  <span className="font-mono text-2xl font-bold">{objetivo.codigo}</span>
                </div>
              </div>
              
              <div className="poa-mobile-kpi-strip poa-mobile-kpi-strip-3 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="poa-mobile-kpi-card flex flex-col bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 backdrop-blur-sm rounded-lg p-4 shadow-xl dark:shadow-2xl dark:shadow-blue-900/50 hover:shadow-2xl transition-shadow transform hover:scale-105">
                  <span className="poa-kpi-label text-xs font-bold uppercase tracking-widest text-blue-100 mb-1">Total Actividades</span>
                  <span className="poa-kpi-value text-5xl font-bold text-white">{totalActividades}</span>
                </div>
                <div className="poa-mobile-kpi-card flex flex-col bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 backdrop-blur-sm rounded-lg p-4 shadow-xl dark:shadow-2xl dark:shadow-blue-900/50 hover:shadow-2xl transition-shadow transform hover:scale-105">
                  <span className="poa-kpi-label text-xs font-bold uppercase tracking-widest text-emerald-100 mb-1">Actividades Completadas</span>
                  <span className="poa-kpi-value text-5xl font-bold text-white">{actividadesCompletadas}</span>
                </div>
                <div className="poa-mobile-kpi-card flex flex-col bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 backdrop-blur-sm rounded-lg p-4 shadow-xl dark:shadow-2xl dark:shadow-blue-900/50 hover:shadow-2xl transition-shadow transform hover:scale-105">
                  <span className="poa-kpi-label text-xs font-bold uppercase tracking-widest text-amber-100 mb-1">Actividades Programadas</span>
                  <span className="poa-kpi-value text-5xl font-bold text-white">{actividadesProgramadas}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Objetivo no encontrado.</div>
        )}
      </div>

      {/* Indicadores de montos */}
      {!loading && !error && actividades && actividades.length > 0 && (
        <div className="w-full mb-4">
          <div className="poa-mobile-kpi-strip poa-mobile-kpi-strip-3 flex flex-col gap-3 sm:flex-row">
            <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-4 text-white">
              <p className="poa-kpi-label text-sm font-bold uppercase tracking-widest opacity-90">Monto Total</p>
              <p className="poa-kpi-value text-3xl font-bold">Bs. {formatMoney(montoTotal)}</p>
            </div>
            <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-4 text-white">
              <p className="poa-kpi-label text-sm font-bold uppercase tracking-widest opacity-90">Monto Función</p>
              <p className="poa-kpi-value text-3xl font-bold">Bs. {formatMoney(montoTotalFuncion)}</p>
            </div>
            <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
              <p className="poa-kpi-label text-sm font-bold uppercase tracking-widest opacity-90">Monto Inversión</p>
              <p className="poa-kpi-value text-3xl font-bold">Bs. {formatMoney(montoTotalInversion)}</p>
            </div>
          </div>
        </div>
      )}

      {showNueva && (
        <NuevaActividadModal
          objetivoId={objetivoEspecificoId}
          documentoId={documentoId}
          documentoEstado={documentoEstado}
          actividad={actividadEdit}
          onClose={() => { setActividadEdit(null); closeNueva(); }}
          onCreated={(a) => { setActividades(prev => [a, ...(prev || [])]); closeNueva(); }}
          onUpdated={(u) => {
            // Reemplazar la actividad en la lista
            setActividades(prev => (prev || []).map(it => (it.id === u.id ? u : it)));
            setSelectedActividad(u);
            setActividadEdit(null);
            closeNueva();
          }}
        />
      )}

      {/* Nota: los botones de acción se muestran como un contenedor fijo en el header (top-right) cuando hay selección. */}

      {loading && <div className="text-blue-800">Cargando actividades...</div>}
      {error && <div className="text-red-600">{String(error)}</div>}

      <div className="poa-table-wrapper w-full overflow-auto border rounded shadow-lg">
        <table className="poa-mobile-card-table w-full font-sans text-base leading-snug table-fixed border-collapse text-blue-900 dark:text-white">
          <thead>
            <tr className="poa-thead poa-table-head-formal text-center font-sans text-base leading-snug font-bold">
              <th className="px-2 py-2 font-medium">Actividad o Programa</th>
              <th className="px-2 py-2 font-medium">Responsable</th>
              <th className="px-2 py-2 font-medium">Productos Esperados</th>
              <th className="px-2 py-2 font-medium">Mes inicio</th>
              <th className="px-2 py-2 font-medium">Mes fin</th>
              <th className="px-2 py-2 font-medium">Descripcion del Indicador</th>
              <th className="px-2 py-2 font-medium">Unidad</th>
              <th className="px-2 py-2 font-medium">Linea Base</th>
              <th className="px-2 py-2 font-medium">Meta</th>
              <th className="px-2 py-2 font-medium">Función (Bs.)</th>
              <th className="px-2 py-2 font-medium">Inversión (Bs.)</th>
            </tr>
          </thead>
          <tbody className="font-sans text-base leading-snug">
            {actividades && actividades.length > 0 ? actividades.map(act => {
              const indicador = act.indicador && typeof act.indicador === 'object' ? act.indicador : null;
              // Determinar el rango de meses para la línea de tiempo
              const mesInicio = act.mes_inicio || act.mes || act.fecha_inicio || '';
              const mesFin = act.mes_fin || act.mes_finicio || '';
              const tieneRango = mesInicio && mesFin && mesInicio !== '—' && mesFin !== '—';
              const cumplimiento = Math.max(0, Math.min(100, Number(act.evidencia_cumplimiento || 0)));
              const estadoActividad = String(act.estado || '').toLowerCase();
              const isRealizada = estadoActividad === 'completado';
              
              return (
                <tr
                  key={act.id || `${act.codigo}-${act.nombre}-${Math.random()}`}
                  onClick={() => setSelectedActividad(prev => (prev && prev.id === act.id ? null : act))}
                  aria-selected={selectedActividad && selectedActividad.id === act.id ? 'true' : 'false'}
                  data-selected={selectedActividad && selectedActividad.id === act.id ? 'true' : 'false'}
                  className={`align-top transition transform duration-150 cursor-pointer hover:shadow-sm hover:-translate-y-0.5 ${selectedActividad && selectedActividad.id === act.id ? 'is-selected font-semibold shadow-md bg-blue-100 dark:bg-blue-900' : 'odd:bg-white even:bg-blue-50 dark:odd:bg-gray-800 dark:even:bg-gray-700'} text-blue-900 dark:text-white`}>
                  <td data-label="Actividad" className="px-2 py-2 border border-blue-300 dark:border-gray-600 align-top font-sans">
                    <div className={`${selectedActividad && selectedActividad.id === act.id ? 'table-cell-expand' : 'table-cell-clamp'}`}>
                      <span className="inline-block px-2 py-0.5 text-xs font-bold bg-blue-500 text-white rounded mr-2">{act.codigo}</span>
                      <span className="font-medium">{act.nombre}</span>
                      {isRealizada && (
                        <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full align-middle">Realizada</span>
                      )}
                    </div>
                    {(tieneRango || isRealizada) && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Estado:</span>
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${isRealizada ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
                            style={{ width: isRealizada ? '100%' : '20%' }}
                          ></div>
                        </div>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{isRealizada ? '100%' : 'Programada'}</span>
                      </div>
                    )}
                  </td>
                  <td data-label="Responsable" className="px-2 py-2 border border-blue-300 dark:border-gray-600 align-top font-sans">
                    <div className={`${selectedActividad && selectedActividad.id === act.id ? 'table-cell-expand' : 'table-cell-clamp'}`}>
                      {act.responsable || '—'}
                    </div>
                  </td>
                  <td data-label="Productos" className="px-2 py-2 border border-blue-300 dark:border-gray-600 align-top font-sans"><div className={`${selectedActividad && selectedActividad.id === act.id ? 'table-cell-expand' : 'table-cell-clamp'}`}>{act.productos_esperados ? (typeof act.productos_esperados === 'object' ? JSON.stringify(act.productos_esperados) : act.productos_esperados) : '—'}</div></td>
                  <td data-label="Mes inicio" className="px-2 py-2 border border-blue-300 dark:border-gray-600 align-top font-sans text-center">
                    <div className={`${selectedActividad && selectedActividad.id === act.id ? 'table-cell-expand' : 'table-cell-clamp'}`}>
                      {mesInicio && mesInicio !== '—' ? (
                        <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                          {mesInicio}
                        </span>
                      ) : '—'}
                    </div>
                  </td>
                  <td data-label="Mes fin" className="px-2 py-2 border border-blue-300 dark:border-gray-600 align-top font-sans text-center">
                    <div className={`${selectedActividad && selectedActividad.id === act.id ? 'table-cell-expand' : 'table-cell-clamp'}`}>
                      {mesFin && mesFin !== '—' ? (
                        <span className="inline-block px-2 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
                          {mesFin}
                        </span>
                      ) : '—'}
                    </div>
                  </td>
                  <td data-label="Indicador" className="px-2 py-1 border border-blue-300 dark:border-gray-600 align-top">{
                    // intentar varias claves posibles para la descripción
                    <div className={`${selectedActividad && selectedActividad.id === act.id ? 'table-cell-expand' : 'table-cell-clamp'}`}>{getIndicadorField(act, [
                      'indicador.descripcion',
                      'indicador_descripcion',
                      'indicador_descripcion_detail',
                      'indicador',
                      'indicador_nombre',
                      'indicador_descripcion_text'
                    ])}</div>
                  }</td>
                  <td data-label="Unidad" className="px-2 py-1 border border-blue-300 dark:border-gray-600 align-top">{
                    <div className={`${selectedActividad && selectedActividad.id === act.id ? 'table-cell-expand' : 'table-cell-clamp'}`}>{getIndicadorField(act, [
                      'indicador.unidad',
                      'indicador.indicador_unidad',
                      'indicador_unidad',
                      'unidad',
                      'unidad_medida'
                    ])}</div>
                  }</td>
                  <td data-label="Linea base" className="px-2 py-2 border border-blue-300 dark:border-gray-600 align-top text-center">
                    <div className={`${selectedActividad && selectedActividad.id === act.id ? 'table-cell-expand' : 'table-cell-clamp'}`}>
                      {getIndicadorField(act, [
                        'indicador.linea_base',
                        'indicador.indicador_linea_base',
                        'indicador.lineaBase',
                        'indicador_linea_base',
                        'linea_base'
                      ])}
                    </div>
                  </td>
                  <td data-label="Meta" className="px-2 py-2 border border-blue-300 dark:border-gray-600 align-top text-center">
                    <div className={`${selectedActividad && selectedActividad.id === act.id ? 'table-cell-expand' : 'table-cell-clamp'}`}>
                      {getIndicadorField(act, [
                        'indicador.meta',
                        'indicador.indicador_meta',
                        'indicador_meta',
                        'meta'
                      ])}
                    </div>
                  </td>
                  <td data-label="Funcion Bs." className="px-2 py-2 border border-blue-300 dark:border-gray-600 align-top text-right">
                    {formatMoney(act.monto_funcion || act.monto_funcion_valor || act.monto_funcion_bs)}
                  </td>
                  <td data-label="Inversion Bs." className="px-2 py-2 border border-blue-300 dark:border-gray-600 align-top text-right">
                    {formatMoney(act.monto_inversion || act.monto_inversion_valor || act.monto_inversion_bs)}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={11} className="px-2 py-4 text-center text-gray-500">No hay actividades para mostrar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ActividadesPage;
