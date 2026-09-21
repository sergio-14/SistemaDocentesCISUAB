import React, { useEffect, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { getDetallePresupuestoPorActividad, deleteDetalle, updateActividad, crearSolicitudCambioPOA } from '../../../apis/poa.api';
import NuevoPresupuestoModal from '../components/NuevoPresupuestoModal';
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
  }, [canEdit, documentoEstado]);

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
        setShowNuevo(true);
      } else if (action === 'delete') {
        setDeleteDialogDetalle(actividad);
      }
    };
    window.addEventListener('header-action', handler);
    return () => window.removeEventListener('header-action', handler);
  }, [canEdit, documentoEstado]);

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

  // Agrupar por categoría si el backend provee un campo `categoria` o `group` o similar
  const grouped = React.useMemo(() => {
    if (!detalle || detalle.length === 0) return { groups: [] , totals: { total: 0 } };
    const map = new Map();
    let grandTotal = 0;
    for (const it of detalle) {
      const key = it.categoria || it.group || it.categoria_nombre || 'Sin categoría';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
      grandTotal += (Number(it.cantidad) || 0) * (Number(it.costo_unitario) || 0);
    }
    const groups = Array.from(map.entries()).map(([name, items]) => ({ name, items }));
    return { groups, totals: { total: grandTotal } };
  }, [detalle]);

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
  <section className="flex flex-col items-start flex-1 pt-0 pb-12 px-0 w-full">
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
              <div className="relative p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight text-blue-900 dark:text-white drop-shadow-sm">{actividad.nombre}</h3>
                  </div>
                  <div className="inline-flex items-center px-6 py-3 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-shadow whitespace-nowrap">
                    <span className="font-mono text-2xl font-bold">{actividad.codigo}</span>
                  </div>
                </div>
                
                <div className="poa-mobile-kpi-strip poa-mobile-kpi-strip-2 grid grid-cols-2 gap-4 pt-2">
                  <div className="poa-mobile-kpi-card flex flex-col bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 backdrop-blur-sm rounded-lg p-4 shadow-xl dark:shadow-2xl dark:shadow-blue-900/50 hover:shadow-2xl transition-shadow transform hover:scale-105">
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-100 mb-1">Unidad</span>
                    <span className="text-base font-bold text-white">{actividad.unidad || 'Dirección de Investigación y Extensión'}</span>
                  </div>
                  <div className="poa-mobile-kpi-card flex flex-col bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 backdrop-blur-sm rounded-lg p-4 shadow-xl dark:shadow-2xl dark:shadow-blue-900/50 hover:shadow-2xl transition-shadow transform hover:scale-105">
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-100 mb-1">Total Ítems</span>
                    <span className="text-5xl font-bold text-white">{Array.isArray(detalle) ? detalle.length : 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bloque de montos rediseñado */}
          <div className="w-full mb-4">
            <div className="poa-mobile-kpi-strip poa-mobile-kpi-strip-3 flex flex-col gap-3 sm:flex-row">
              <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-4 text-white">
                <p className="text-sm font-bold uppercase tracking-widest opacity-90">Monto total</p>
                <p className="text-3xl font-bold">Bs. {formatMoney(montoTotal)}</p>
              </div>
              <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
                <p className="text-sm font-bold uppercase tracking-widest opacity-90">Monto inversión</p>
                <p className="text-3xl font-bold">Bs. {formatMoney(montoInversion)}</p>
              </div>
              <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-4 text-white">
                <p className="text-sm font-bold uppercase tracking-widest opacity-90">Monto funcionamiento</p>
                <p className="text-3xl font-bold">Bs. {formatMoney(montoFuncionamiento)}</p>
              </div>
            </div>
          </div>

          <div className="w-full overflow-auto poa-table-wrapper">

     

          <table className="poa-mobile-card-table min-w-full table-auto border-collapse poa-table poa-border-black poa-border-cyan poa-borders-ultra font-sans text-base leading-snug text-blue-900 dark:text-white">
            <colgroup>
              <col style={{ width: '30%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr className="poa-thead poa-table-head-formal text-center font-sans text-base leading-snug font-bold">
                <th className="poa-cell font-medium" rowSpan={2}>Detalle</th>
                <th className="poa-cell font-medium" rowSpan={2}>Unidad de medida</th>
                <th className="poa-cell font-medium" rowSpan={2}>Características</th>
                <th className="poa-cell font-medium" rowSpan={2}>Partida Presupuestaria</th>
                <th className="poa-cell font-medium" rowSpan={2}>Cantidad Requerida</th>
                <th className="poa-cell font-medium" colSpan={2}>Costo Bs.</th>
                <th className="poa-cell font-medium" rowSpan={2}>Mes de Requerimiento</th>
              </tr>
              <tr className="poa-thead poa-table-head-formal text-center font-sans text-base leading-snug font-bold">
                <th className="poa-cell font-medium">Unitario</th>
                <th className="poa-cell font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="font-sans text-base leading-snug">
              {loading ? (
                <tr><td colSpan={8} className="px-2 py-4 text-sm text-gray-500">Cargando...</td></tr>
              ) : (!detalle || detalle.length === 0) ? (
                <tr><td colSpan={8} className="px-2 py-4 text-sm text-gray-500 text-center">Esta actividad no detalla presupuestos.</td></tr>
              ) : (
                // Si hay grupos (y no es solo la categoría por defecto), renderizamos agrupado
                (grouped.groups && (grouped.groups.length > 1 || (grouped.groups[0] && grouped.groups[0].name !== 'Sin categoría'))) ? (
                  grouped.groups.map((g) => {
                    const subtotal = g.items.reduce((s, it) => s + ((Number(it.cantidad)||0) * (Number(it.costo_unitario)||0)), 0);
                    return (
                      <React.Fragment key={g.name}>
                        <tr>
                          <td colSpan={8} className="bg-blue-100 dark:bg-transparent font-semibold px-2 py-2 text-blue-900 dark:text-white">{g.name}</td>
                        </tr>
                        {g.items.map((it) => (
                          <tr key={it.id} className="align-top poa-row-alt odd:bg-white even:bg-blue-50 text-blue-900 dark:text-white">
                            <td data-label="Detalle" className="poa-cell align-top border border-blue-300 dark:border-gray-600"><div className="table-cell-clamp">{it.item}</div></td>
                            <td data-label="Unidad" className="poa-cell align-top text-center border border-blue-300 dark:border-gray-600">{it.unidad_medida || '—'}</td>
                            <td data-label="Caracteristicas" className="poa-cell align-top border border-blue-300 dark:border-gray-600"><div className="table-cell-clamp">{it.caracteristicas || '—'}</div></td>
                            <td data-label="Partida" className="poa-cell align-top text-center border border-blue-300 dark:border-gray-600">{it.partida}</td>
                            <td data-label="Cantidad" className="poa-cell align-top text-center border border-blue-300 dark:border-gray-600">{it.cantidad}</td>
                            <td data-label="Costo unitario" className="poa-cell align-top text-right border border-blue-300 dark:border-gray-600">{formatMoney(it.costo_unitario)}</td>
                            <td data-label="Costo total" className="poa-cell align-top text-right border border-blue-300 dark:border-gray-600">{formatMoney((Number(it.cantidad)||0) * (Number(it.costo_unitario)||0))}</td>
                            <td data-label="Mes" className="poa-cell align-top text-center border border-blue-300 dark:border-gray-600">{it.mes_requerimiento || '—'}</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-100 dark:bg-transparent text-blue-900 dark:text-white">
                          <td colSpan={6} className="text-right font-semibold px-2 py-2">Subtotal {g.items.length > 0 ? `(${g.items.length})` : ''}</td>
                          <td className="text-right font-semibold px-2 py-2">{formatMoney(subtotal)}</td>
                          <td />
                        </tr>
                      </React.Fragment>
                    );
                  })
                  ) : (
                  // Sin agrupación: render normal
                  detalle.map((it) => (
                    <tr key={it.id}
                      onClick={() => setSelectedDetalle(prev => (prev && prev.id === it.id ? null : it))}
                      aria-selected={selectedDetalle && selectedDetalle.id === it.id ? 'true' : 'false'}
                      data-selected={selectedDetalle && selectedDetalle.id === it.id ? 'true' : 'false'}
                      className={`align-top transition transform duration-150 cursor-pointer hover:shadow-sm hover:-translate-y-0.5 ${selectedDetalle && selectedDetalle.id === it.id ? 'is-selected font-semibold shadow-md' : 'odd:bg-white even:bg-blue-50 poa-row-alt'} text-blue-900 dark:text-white`}>
                      <td data-label="Detalle" className="poa-cell align-top border border-blue-300 dark:border-gray-600"><div className="table-cell-clamp">{it.item}</div></td>
                      <td data-label="Unidad" className="poa-cell align-top text-center border border-blue-300 dark:border-gray-600">{it.unidad_medida || '—'}</td>
                      <td data-label="Caracteristicas" className="poa-cell align-top border border-blue-300 dark:border-gray-600"><div className="table-cell-clamp">{it.caracteristicas || '—'}</div></td>
                      <td data-label="Partida" className="poa-cell align-top text-center border border-blue-300 dark:border-gray-600">{it.partida}</td>
                      <td data-label="Cantidad" className="poa-cell align-top text-center border border-blue-300 dark:border-gray-600">{it.cantidad}</td>
                      <td data-label="Costo unitario" className="poa-cell align-top text-right border border-blue-300 dark:border-gray-600">{formatMoney(it.costo_unitario)}</td>
                      <td data-label="Costo total" className="poa-cell align-top text-right border border-blue-300 dark:border-gray-600">{formatMoney((Number(it.cantidad)||0) * (Number(it.costo_unitario)||0))}</td>
                      <td data-label="Mes" className="poa-cell align-top text-center border border-blue-300 dark:border-gray-600">{it.mes_requerimiento || '—'}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>

          {/* Modal para nuevo ítem */}
          {showNuevo && (
            <NuevoPresupuestoModal
              actividadId={actividad.id}
              actividad={actividad}
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
          </div>
        </>
      )}
    </section>
  );
};

export default PresupuestosPage;
