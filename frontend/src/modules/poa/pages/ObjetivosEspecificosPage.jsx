import React, { useEffect, useState } from 'react';
import { getObjetivosEspecificos, deleteObjetivo, getDocumentoPOAPorId, getDocumentosPOAEncabezados, getActividadesPorObjetivo, crearSolicitudCambioPOA } from '../../../apis/poa.api';
import NuevoObjetivoModal from '../components/NuevoObjetivoModal';
import IconButton from '../components/IconButton';
import Dialog from '../components/base/Dialog';
import { FaBullseye, FaCoins, FaEdit, FaTasks, FaTrash, FaUniversity } from 'react-icons/fa';
import { useNavigate, useParams, useLocation, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { buildPoaNavigationState, getPoaNavigationContext, normalizePoaGestion, savePoaNavigationContext } from '../utils/navigationContext';

// Página que muestra los objetivos específicos relacionados a un documento
const ObjetivosEspecificosPage = () => {
  const { documentId } = useParams();
  const [objetivos, setObjetivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [documentHeader, setDocumentHeader] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [deleteDialogObjetivo, setDeleteDialogObjetivo] = useState(null);
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const poaPermissions = outletContext.poaPermissions || {};
  const canEdit = !!poaPermissions.canEdit;
  const [editingObjetivo, setEditingObjetivo] = useState(null);
  const location = useLocation();
  const navContext = React.useMemo(() => getPoaNavigationContext(location?.state), [location?.key, location?.state]);
  const [recursosPorObjetivo, setRecursosPorObjetivo] = useState({});
  const [actividadesCountPorObjetivo, setActividadesCountPorObjetivo] = useState({});

  // Helper: parse codigo to number for sorting. Strategy:
  // - extract the LAST contiguous digit-sequence in the codigo string (e.g. 'OE-12-A' -> 12)
  // - if no numeric sequence is found, treat it as Infinity so it sorts to the end
  // - return a tuple-like comparison: numeric part first, then full codigo as tiebreaker
  const codigoToNumber = (c) => {
    if (c === undefined || c === null) return Infinity;
    const s = String(c).trim();
    // find all digit sequences and take the last one
    const matches = s.match(/\d+/g);
    if (!matches || matches.length === 0) return Infinity;
    const last = matches[matches.length - 1];
    const n = Number(last);
    return Number.isNaN(n) ? Infinity : n;
  };

  const normalizeMonto = (value) => {
    if (value === undefined || value === null || value === '') return 0;
    const cleaned = String(value).replace(/\s/g, '').replace(/,/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const formatMonto = (value) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) return '0,00';
    return new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const sortByCodigo = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr.slice().sort((a, b) => {
      const aNum = codigoToNumber(a?.codigo);
      const bNum = codigoToNumber(b?.codigo);
      if (aNum !== bNum) return aNum - bNum;
      // numeric parts equal (or both Infinity) -> fallback to stable text comparison
      const aCode = String(a?.codigo ?? '').trim();
      const bCode = String(b?.codigo ?? '').trim();
      return aCode.localeCompare(bCode, undefined, { sensitivity: 'base', numeric: true });
    });
  };

  // Detecta si un objetivo pertenece al documento (búsqueda recursiva sobre claves y valores)
  const objetivoPerteneceAlDocumento = (obj, docId) => {
    if (!obj) return false;
    const idStr = String(docId);
    const keyIndicators = ['document', 'documento', 'doc', 'encabezado', 'documento_id', 'document_id'];

    const search = (value, pathKey) => {
      if (value === undefined || value === null) return false;
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          for (const v of value) if (search(v, pathKey)) return true;
          return false;
        }
        // Si el objeto tiene id
        if (value.id !== undefined && String(value.id) === idStr) return true;
        for (const k of Object.keys(value)) {
          const v = value[k];
          const lowerK = String(k).toLowerCase();
          if (keyIndicators.some(ind => lowerK.includes(ind))) {
            if (v !== undefined && v !== null) {
              if (typeof v === 'object') {
                if (v.id !== undefined && String(v.id) === idStr) return true;
              } else {
                if (String(v) === idStr) return true;
              }
            }
          }
          if (search(v, k)) return true;
        }
        return false;
      } else {
        if (!pathKey) return false;
        const lowerKey = String(pathKey).toLowerCase();
        if (keyIndicators.some(ind => lowerKey.includes(ind)) && String(value) === idStr) return true;
        return false;
      }
    };

    return search(obj, null);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    getObjetivosEspecificos(documentId)
      .then(res => {
        const objs = Array.isArray(res.data) ? res.data : (res.data.results || []);
        const filtered = objs.filter(o => objetivoPerteneceAlDocumento(o, documentId));
  const finalList = filtered.length > 0 ? filtered : objs; // si backend ya filtró, usamos objs
  setObjetivos(sortByCodigo(finalList));

  // intentar obtener encabezado del documento desde los datos recibidos (si está embebido)
  try {
    if (finalList && finalList.length > 0) {
      // Buscar claves comunes que puedan contener información del documento
      const first = finalList[0];
      const tryDoc = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        const candidates = ['documento', 'document', 'encabezado', 'documento_id', 'header', 'doc'];
        for (const k of Object.keys(obj)) {
          if (candidates.includes(k)) {
            const v = obj[k];
            if (v && typeof v === 'object') return v;
          }
        }
        return null;
      };
      const embedded = tryDoc(first) || tryDoc(finalList.find(Boolean));
      if (embedded) {
        setDocumentHeader(embedded);
      } else {
        // intentar recuperar encabezado: primero si la ubicación tiene `gestion`, pedir el documento completo al backend
        const gestion = navContext?.gestion ?? null;
        if (gestion) {
          setDocLoading(true);
          getDocumentoPOAPorId(Number(documentId), Number(gestion))
            .then(r => setDocumentHeader(r.data))
            .catch(() => setDocumentHeader(null))
            .finally(() => setDocLoading(false));
        } else {
          // Si no hay gestion en el state, consultar encabezados (devuelve gestión actual si no se pasa param)
          setDocLoading(true);
          getDocumentosPOAEncabezados()
            .then(r => {
              const list = Array.isArray(r.data) ? r.data : (r.data.results || []);
              const found = list.find(d => String(d.id) === String(documentId) || String(d.pk) === String(documentId));
              if (found) setDocumentHeader(found);
              else setDocumentHeader(null);
            })
            .catch(() => setDocumentHeader(null))
            .finally(() => setDocLoading(false));
        }
      }
    }
  } catch (e) {
    // silencioso
  }
      })
      .catch(err => {
        setError(err?.response?.data?.detail || err?.message || 'Error al cargar objetivos');
      })
      .finally(() => setLoading(false));
  }, [documentId, navContext?.gestion]);

  useEffect(() => {
    if (!objetivos || objetivos.length === 0) {
      setRecursosPorObjetivo({});
      setActividadesCountPorObjetivo({});
      return;
    }

    const objetivosConResumen = objetivos.every(obj =>
      obj?.monto_total !== undefined &&
      obj?.actividades_count !== undefined
    );

    if (objetivosConResumen) {
      const totals = {};
      const counts = {};
      objetivos.forEach((obj) => {
        totals[obj.id] = normalizeMonto(obj.monto_total);
        counts[obj.id] = Number(obj.actividades_count) || 0;
      });
      setRecursosPorObjetivo(totals);
      setActividadesCountPorObjetivo(counts);
      return;
    }

    let mounted = true;

    const fetchTotals = async () => {
      const promises = objetivos.map(obj =>
        getActividadesPorObjetivo(obj.id, documentId)
          .then(res => ({
            objetivoId: obj.id,
            actividades: Array.isArray(res.data) ? res.data : (res.data?.results || [])
          }))
          .catch(() => ({ objetivoId: obj.id, actividades: [] }))
      );
      const results = await Promise.all(promises);
      if (!mounted) return;
      const totals = {};
      const counts = {};
      results.forEach(({ objetivoId, actividades }) => {
        const sum = actividades.reduce((acc, actividad) => {
          const funcion = normalizeMonto(actividad.monto_funcion ?? actividad.monto_funcion_valor ?? actividad.monto_funcion_bs);
          const inversion = normalizeMonto(actividad.monto_inversion ?? actividad.monto_inversion_valor ?? actividad.monto_inversion_bs);
          return acc + funcion + inversion;
        }, 0);
        totals[objetivoId] = sum;
        counts[objetivoId] = Array.isArray(actividades) ? actividades.length : 0;
      });
      setRecursosPorObjetivo(totals);
      setActividadesCountPorObjetivo(counts);
    };

    fetchTotals();

    return () => { mounted = false; };
  }, [objetivos, documentId]);

  const documentoEstado = String(documentHeader?.estado || objetivos?.[0]?.documento_estado || '').toLowerCase();
  const canRequestChange = canEdit && ['aprobado', 'ejecucion'].includes(documentoEstado);
  const gestion = documentHeader?.gestion || documentHeader?.gestion_nombre || navContext?.gestion || 'â€”';
  const gestionNavegacion = normalizePoaGestion(documentHeader?.gestion || navContext?.gestion);

  useEffect(() => {
    savePoaNavigationContext({
      gestion: gestionNavegacion,
      documentoId: Number(documentId),
      documentoEstado,
    });
  }, [documentId, documentoEstado, gestionNavegacion]);

  const openNuevo = () => {
    if (!canEdit) return;
    if (documentoEstado === 'revision') {
      toast.error('El documento esta en revision. Espere la observacion o aprobacion del Director.');
      return;
    }
    setEditingObjetivo(null);
    setShowNuevo(true);
  };
  const closeNuevo = () => { setEditingObjetivo(null); setShowNuevo(false); };

  const openEdit = (obj) => {
    if (!canEdit) return;
    if (documentoEstado === 'revision') {
      toast.error('El documento esta en revision. Espere la observacion o aprobacion del Director.');
      return;
    }
    setEditingObjetivo(obj);
    setShowNuevo(true);
  };

  const handleDeleted = async (id) => {
    if (!canEdit) {
      toast.error('No tiene permisos para eliminar objetivos.');
      return;
    }
    if (documentoEstado === 'revision') {
      toast.error('El documento esta en revision. Espere la observacion o aprobacion del Director.');
      return;
    }
    const target = (objetivos || []).find((obj) => Number(obj.id) === Number(id)) || { id };
    setDeleteDialogObjetivo(target);
  };

  const confirmarEliminarObjetivo = async () => {
    const target = deleteDialogObjetivo;
    if (!target?.id) return;
    try {
      if (canRequestChange) {
        await crearSolicitudCambioPOA({
          documento: Number(documentId),
          tipo_objeto: 'objetivo',
          objeto_id: target.id,
          accion: 'eliminar',
          payload: {
            codigo: target.codigo || '',
            descripcion: target.descripcion || target.nombre || '',
          },
          descripcion: 'Eliminar objetivo especifico.',
          resumen: {
            titulo: 'Eliminar objetivo especifico',
            codigo: target.codigo || '',
            descripcion: target.descripcion || target.nombre || '',
          },
        });
        toast.success('Solicitud de eliminacion enviada al Director de Carrera');
        return;
      }
      await deleteObjetivo(target.id);
      setObjetivos(prev => (prev || []).filter(o => Number(o.id) !== Number(target.id)));
      toast.success('Objetivo eliminado');
    } catch (err) {
      const msg = err?.response?.data || err?.message || '';
      toast.error('Error eliminando objetivo: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)));
    } finally {
      setDeleteDialogObjetivo(null);
    }
  };

  const handleUpdated = (updated) => {
    setObjetivos(prev => (prev || []).map(o => (Number(o.id) === Number(updated.id) ? updated : o)));
    closeNuevo();
  };

  // Listen for header 'Nuevo' button events
  useEffect(() => {
    const handler = (e) => {
      if (canEdit && e?.detail?.page === 'objetivos') openNuevo();
    };
    window.addEventListener('open-new', handler);
    return () => window.removeEventListener('open-new', handler);
  }, [canEdit, documentoEstado]);


  const handleVerActividades = (objetivoId) => {
    const objetivoSeleccionado = (objetivos || []).find((objetivo) => Number(objetivo.id) === Number(objetivoId));
    navigate(`/poa/actividades/${objetivoId}`, {
      state: buildPoaNavigationState(location?.state, {
        documentoId: Number(documentId),
        documentoEstado,
        documentoNombre: typeof documentHeader?.programa === 'object' ? documentHeader?.programa?.nombre : documentHeader?.programa,
        objetivoId: Number(objetivoId),
        objetivoNombre: objetivoSeleccionado?.codigo || objetivoSeleccionado?.descripcion,
        gestion: gestionNavegacion,
      }),
    });
  };

  const totalObjetivos = Array.isArray(objetivos) ? objetivos.length : 0;
  const presupuestoTotal = Object.values(recursosPorObjetivo || {}).reduce((acc, n) => acc + (Number(n) || 0), 0);
  const promedioPorObjetivo = totalObjetivos > 0 ? (presupuestoTotal / totalObjetivos) : 0;
  const programa = (typeof documentHeader?.programa === 'object' ? documentHeader?.programa?.nombre : documentHeader?.programa) || '—';
  const objetivoInstitucional = (typeof documentHeader?.objetivo_gestion_institucional === 'object'
    ? (documentHeader?.objetivo_gestion_institucional?.nombre || documentHeader?.objetivo_gestion_institucional?.descripcion)
    : documentHeader?.objetivo_gestion_institucional) || '—';

  return (
    <section className="flex flex-col items-start justify-start flex-1 pt-0 pb-12 w-full px-0">
      <Dialog
        open={Boolean(deleteDialogObjetivo)}
        type="danger"
        title="Eliminar objetivo"
        message={deleteDialogObjetivo ? `¿Confirma eliminar este objetivo?\n${deleteDialogObjetivo.codigo || deleteDialogObjetivo.id || ''}` : ''}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmarEliminarObjetivo}
        onCancel={() => setDeleteDialogObjetivo(null)}
      />
        {/* Header controls moved to global header; page-level controls removed */}
        {documentHeader && (
          <div className="w-full mb-3 mt-0">
            <div className="poa-mobile-page-card relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700 dark:from-slate-900 dark:via-blue-900 dark:to-cyan-900 border border-blue-400/60 dark:border-cyan-700/70 shadow-xl dark:shadow-cyan-950/40">
              <div className="absolute -top-10 -right-8 w-40 h-40 bg-cyan-300/30 dark:bg-cyan-400/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-8 w-40 h-40 bg-blue-300/25 dark:bg-blue-400/20 rounded-full blur-3xl" />
              <div className="relative p-3 md:p-4 space-y-3">
                <div className="flex items-center justify-end gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-md text-xs md:text-sm font-bold bg-white/20 border border-white/30 text-white shadow whitespace-nowrap backdrop-blur-sm">
                    Gestión: {gestion}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-white/30 bg-white/15 dark:bg-slate-900/35 p-2.5 backdrop-blur-sm lg:grid lg:h-full lg:min-h-[4.25rem] lg:grid-cols-[2.75rem_minmax(0,1fr)] lg:items-center lg:gap-3 lg:p-3">
                    <div className="hidden lg:flex h-11 w-11 items-center justify-center rounded-lg bg-white/20 text-white shadow-inner">
                      <FaUniversity className="text-xl" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-blue-100">Programa</p>
                      <p className="text-sm font-semibold text-white leading-snug break-words">{programa}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/30 bg-white/15 dark:bg-slate-900/35 p-2.5 backdrop-blur-sm lg:grid lg:h-full lg:min-h-[4.25rem] lg:grid-cols-[2.75rem_minmax(0,1fr)] lg:items-center lg:gap-3 lg:p-3">
                    <div className="hidden lg:flex h-11 w-11 items-center justify-center rounded-lg bg-white/20 text-white shadow-inner">
                      <FaBullseye className="text-xl" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1 lg:mb-0">
                        <FaBullseye className="text-cyan-100 text-xs lg:hidden" />
                        <p className="text-[10px] uppercase font-bold tracking-wider text-blue-100">Objetivo de gestión institucional</p>
                      </div>
                      <p className="text-sm text-white/95 leading-snug break-words">{objetivoInstitucional}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showNuevo && (
          <NuevoObjetivoModal
            documentoId={documentId}
            documentoEstado={documentoEstado}
            objetivo={editingObjetivo}
            existingObjetivos={objetivos}
            onClose={closeNuevo}
            onCreated={(obj) => { setObjetivos(prev => sortByCodigo([...(prev || []), obj])); closeNuevo(); }}
            onUpdated={handleUpdated}
          />
        )}
      {loading && <div className="text-blue-800">Cargando objetivos específicos...</div>}

      {error && (
        <div className="text-red-600">
          {error} <br />
          Por favor, verifica que el backend esté corriendo y que la configuración CORS permita esta petición.
        </div>
      )}

      {!loading && !error && totalObjetivos > 0 && (
        <div className="w-full mb-3">
          <div className="poa-mobile-kpi-strip poa-mobile-kpi-strip-3 flex flex-col gap-3 sm:flex-row">
            <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-3 text-white lg:grid lg:min-h-[4.6rem] lg:grid-cols-[3rem_minmax(0,1fr)] lg:items-center lg:gap-3">
              <div className="hidden lg:flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 shadow-inner">
                <FaCoins className="text-2xl" />
              </div>
              <div className="min-w-0">
                <p className="poa-kpi-label text-center text-xs font-bold uppercase tracking-widest opacity-90">Presupuesto Total</p>
                <p className="poa-kpi-value poa-money-value w-full text-right text-2xl font-bold">Bs. {formatMonto(presupuestoTotal)}</p>
              </div>
            </div>
            <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-3 text-white lg:grid lg:min-h-[4.6rem] lg:grid-cols-[3rem_minmax(0,1fr)] lg:items-center lg:gap-3">
              <div className="hidden lg:flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 shadow-inner">
                <FaCoins className="text-2xl" />
              </div>
              <div className="min-w-0">
                <p className="poa-kpi-label text-center text-xs font-bold uppercase tracking-widest opacity-90">Promedio por Objetivo</p>
                <p className="poa-kpi-value poa-money-value w-full text-right text-2xl font-bold">Bs. {formatMonto(promedioPorObjetivo)}</p>
              </div>
            </div>
            <div className="poa-mobile-kpi-card flex-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-3 text-white lg:grid lg:min-h-[4.6rem] lg:grid-cols-[3rem_minmax(0,1fr)] lg:items-center lg:gap-3">
              <div className="hidden lg:flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 shadow-inner">
                <FaBullseye className="text-2xl" />
              </div>
              <div className="min-w-0">
                <p className="poa-kpi-label text-center text-xs font-bold uppercase tracking-widest opacity-90">Resumen</p>
                <p className="poa-kpi-value text-center text-sm md:text-base font-bold truncate">{totalObjetivos} objetivos</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {objetivos && objetivos.length > 0 ? (
          objetivos.map((obj, idx) => {
            const total = recursosPorObjetivo[obj.id] ?? 0;
            const actCount = actividadesCountPorObjetivo[obj.id] ?? 0;
            return (
              <div key={obj.id || idx} className="w-full">
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVerActividades(obj.id); } }}
                  onClick={() => handleVerActividades(obj.id)}
                  className="rounded-xl border border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/60 shadow-lg p-3 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-md shadow">
                      <FaBullseye className="text-[10px]" /> {obj.codigo || '—'}
                    </span>
                    <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold ${actCount > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                      <FaTasks className="mr-1 text-[10px]" /> {actCount}
                    </span>
                  </div>

                  <div className="rounded-lg border border-blue-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-2 min-h-[5rem] lg:grid lg:grid-cols-[2.5rem_minmax(0,1fr)] lg:items-center lg:gap-3">
                    <div className="hidden lg:flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-700 dark:bg-cyan-400/10 dark:text-cyan-200">
                      <FaBullseye className="text-lg" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-blue-700 dark:text-cyan-200 mb-1">Objetivo específico</p>
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-snug line-clamp-3">
                        {obj.nombre || obj.descripcion || 'Sin descripción'}
                      </p>
                    </div>
                  </div>

                  <div className="poa-objective-card-metrics mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white p-2 shadow lg:grid lg:grid-cols-[2rem_minmax(0,1fr)] lg:items-center lg:gap-2">
                      <div className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md bg-white/20 shadow-inner">
                        <FaCoins className="text-base" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-center text-[10px] uppercase tracking-wider font-bold opacity-90">Presupuesto</p>
                        <p className="poa-money-value w-full text-sm font-bold truncate text-right">Bs. {formatMonto(total)}</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-2 shadow lg:grid lg:grid-cols-[2rem_minmax(0,1fr)] lg:items-center lg:gap-2">
                      <div className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md bg-white/20 shadow-inner">
                        <FaTasks className="text-base" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-center text-[10px] uppercase tracking-wider font-bold opacity-90">Actividades</p>
                        <p className="text-center text-sm font-bold">{actCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-blue-300 dark:border-slate-700 flex items-center justify-end gap-2">
                    {canEdit && (
                      <div className="flex items-center gap-1.5">
                        <IconButton
                          icon={<FaEdit />}
                          onClick={(e) => { e.stopPropagation(); openEdit(obj); }}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-2.5 text-xs rounded-lg transition shadow"
                          title="Editar"
                        >
                          Editar
                        </IconButton>
                        <IconButton
                          icon={<FaTrash />}
                          onClick={(e) => { e.stopPropagation(); handleDeleted(obj.id); }}
                          className="bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 text-slate-700 dark:text-slate-200 font-bold py-1 px-2.5 text-xs rounded-lg transition"
                          title="Eliminar"
                        >
                          Eliminar
                        </IconButton>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : !loading && !error ? (
          <div className="col-span-full px-2 py-4 text-center text-gray-500 dark:text-slate-400">No hay objetivos específicos para mostrar.</div>
        ) : null}
      </div>
    </section>
  );
};

export default ObjetivosEspecificosPage;
