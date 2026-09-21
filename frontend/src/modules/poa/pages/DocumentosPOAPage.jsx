import React, { useEffect, useMemo, useState } from 'react';

import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { DEFAULT_ENTIDAD } from '../config/defaults';
import GestionSelectorModal from '../components/GestionSelectorModal';
import NuevoDocumentoModal from '../components/NuevoDocumentoModal';
import BitacoraModal from '../components/BitacoraModal';
import Dialog from '../components/base/Dialog';
import FullscreenPDFViewer from '../../../components/FullscreenPDFViewer';
import { useTheme } from '../../../useTheme';
import {
  AlertCircle,
  Building,
  Calendar,
  CheckCircle2,
  Clock3,
  Edit,
  FileText,
  History,
  ListChecks,
  PlayCircle,
  SendHorizontal,
  ShieldCheck,
  Target,
  Trash2,
  User,
  Briefcase,
  XCircle,
} from 'lucide-react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  deleteDocumentoPOA,
  getDocumentosPOAPorGestion,
  enviarRevisionDocumentoPOA,
  aprobarDocumentoPOA,
  observarDocumentoPOA,
  iniciarEjecucionDocumentoPOA,
  aprobarSolicitudCambioPOA,
  rechazarSolicitudCambioPOA,
  updateObservacionDocumentoPOA,
  API_BASE,
} from '../../../apis/poa.api';
import { buildPoaNavigationState, getPoaNavigationContext, replacePoaNavigationContext, savePoaNavigationContext } from '../utils/navigationContext';

const ESTADO_CONFIG = {
  elaboracion: { label: 'En elaboración', dot: 'bg-amber-400', badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  revision: { label: 'En revisión', dot: 'bg-sky-400', badge: 'bg-sky-500/10 text-sky-400 border border-sky-500/20' },
  observado: { label: 'Observado', dot: 'bg-orange-400', badge: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
  aprobado: { label: 'Aprobado', dot: 'bg-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  ejecucion: { label: 'En ejecución', dot: 'bg-violet-400', badge: 'bg-violet-500/10 text-violet-400 border border-violet-500/20' },
};

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeApiError = (err, fallbackMessage) => {
  const detail = err?.response?.data?.detail ?? err?.response?.data;
  if (typeof detail === 'string') {
    const normalized = detail.trim();
    if (normalized.startsWith('<!DOCTYPE html') || normalized.startsWith('<html') || normalized.includes('OperationalError')) {
      return fallbackMessage;
    }
    return normalized;
  }
  if (detail && typeof detail === 'object') {
    try {
      return JSON.stringify(detail);
    } catch {
      return fallbackMessage;
    }
  }
  return err?.message || fallbackMessage;
};

const getUnidadSolicitanteLabel = (doc) => {
  const carrera = doc?.unidad_solicitante_detalle;
  if (carrera && typeof carrera === 'object') {
    return carrera.nombre || carrera.codigo || `Carrera #${carrera.id}`;
  }
  if (typeof doc?.unidad_solicitante === 'object') {
    return doc.unidad_solicitante.nombre || doc.unidad_solicitante.codigo || '';
  }
  return String(doc?.unidad_solicitante || '').trim();
};

const getPersonaLabel = (value, fallback = '') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.nombre_display || value.nombre || value.user_detalle?.nombre_completo || value.docente?.nombre_completo || fallback;
};

const parseChecklistItems = (observaciones) => {
  if (!observaciones) return [];
  return String(observaciones)
    .split(/\n|;|\u2022|\-/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\d+[\.)]\s*/, ''));
};

const getPendingSolicitudes = (doc) => {
  const solicitudes = Array.isArray(doc?.solicitudes_cambio_pendientes)
    ? doc.solicitudes_cambio_pendientes
    : [];
  return solicitudes.filter((solicitud) => !solicitud?.estado || solicitud.estado === 'pendiente');
};

const getChecklistEntries = (doc, observaciones) => {
  const checklist = Array.isArray(doc?.observaciones_checklist) ? doc.observaciones_checklist : [];
  if (checklist.length > 0) return checklist;
  return parseChecklistItems(observaciones).map((texto, index) => ({
    id: null,
    texto,
    resuelta: false,
    fallbackKey: `${doc?.id || 'doc'}-obs-fallback-${index}`,
  }));
};

const getSolicitudTitle = (solicitud) => {
  const accion = solicitud?.accion_display || solicitud?.accion || 'Cambio';
  const objeto = solicitud?.tipo_objeto_display || solicitud?.tipo_objeto || 'POA';
  return `${accion} ${objeto}`;
};

const DocumentosPOAPage = ({ viewMode = 'all' }) => {
  const [showModal, setShowModal] = useState(false);
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [showGeneralReportViewer, setShowGeneralReportViewer] = useState(false);
  const [revisionDoc, setRevisionDoc] = useState(null);
  const [pdfPreviewDoc, setPdfPreviewDoc] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [showBitacoraModal, setShowBitacoraModal] = useState(false);
  const [bitacoraDoc, setBitacoraDoc] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { effectiveTheme } = useTheme();
  const outletContext = useOutletContext() || {};
  const poaPermissions = outletContext.poaPermissions || {};
  const poaRoles = Array.isArray(outletContext.poaRoles) ? outletContext.poaRoles : [];
  const canEdit = !!poaPermissions.canEdit;
  const canReview = !!poaPermissions.canReview;
  const isRevisionBoard = viewMode === 'revision-observado';
  const documentosPath = isRevisionBoard ? '/poa/documentos-revision' : '/poa/documentos';
  const isDark = effectiveTheme === 'dark';
  const navContext = useMemo(() => getPoaNavigationContext(location?.state), [location?.key, location?.state]);

  const [docs, setDocs] = useState(location?.state?.documentos || []);
  const [gestionState, setGestionState] = useState(navContext?.gestion || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingEstadoId, setUpdatingEstadoId] = useState(null);
  const [reviewNotesByDoc, setReviewNotesByDoc] = useState({});
  const [deleteDialogDoc, setDeleteDialogDoc] = useState(null);

  useEffect(() => {
    if (!showRevisionModal || !revisionDoc) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showRevisionModal, revisionDoc]);

  const resolveGestionCandidate = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object') {
      return value.id ?? value.pk ?? value.gestion ?? value.nombre ?? value;
    }
    return value;
  };

  const getGestionNumberForDoc = (doc) => {
    const candidates = [
      resolveGestionCandidate(doc?.gestion),
      resolveGestionCandidate(gestionState),
      resolveGestionCandidate(location?.state?.gestion),
      resolveGestionCandidate(navContext?.gestion),
    ];
    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined) continue;
      const numeric = Number(candidate);
      if (!Number.isNaN(numeric) && Number.isFinite(numeric)) return numeric;
    }
    return null;
  };

  const hasGestionSelected = Boolean(gestionState || navContext?.gestion);

  // Forzar selección de gestión al entrar a DocumentosPOA: abrir modal SOLO si la gestión no viene en el estado.
  // Si el usuario selecciona una vez, el modal debe cerrarse y NO volver a abrirse por efectos.
  // Si no hay gestión seleccionada, el modal se fuerza a abrir al render.
  // (No re-abrimos el modal por efectos para evitar que “se quede abierto” al seleccionar.)
  useEffect(() => {
    // Abrir modal al entrar si no hay gestión.
    // Para evitar que se “reabra” tras seleccionar, verificamos también que showModal no esté abierto.
    // Además, si ya existe un valor en location.state, no forzamos.
    const gestionEnEstado = Boolean(location?.state?.gestion || navContext?.gestion);
    if (!gestionEnEstado && !hasGestionSelected && !loading && !showModal) {
      setShowModal(true);
    }
  }, [hasGestionSelected, loading, showModal, location?.state?.gestion, navContext?.gestion]);








  const openNuevo = () => {
    setEditingDoc(null);
    setShowNuevoModal(true);
  };

  const closeNuevo = () => {
    setEditingDoc(null);
    setShowNuevoModal(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (canEdit && e?.detail?.page === 'documentos') openNuevo();
    };
    window.addEventListener('open-new', handler);
    return () => window.removeEventListener('open-new', handler);
  }, [canEdit]);

  const handleUpdated = (updated) => {
    setDocs((prev) => (prev || []).map((doc) => (Number(doc.id) === Number(updated.id) ? updated : doc)));
    closeNuevo();
  };

  const handleSuccess = ({ gestion, documentos }) => {
    setGestionState(gestion);
    setDocs(Array.isArray(documentos) ? documentos : []);
    setShowModal(false);
    const nextState = {
      ...replacePoaNavigationContext({ gestion, documentosPath }),
      documentos: Array.isArray(documentos) ? documentos : [],
    };
    navigate(documentosPath, { replace: true, state: nextState });
  };

  const refreshDocsForGestion = async (gestionOverride = null) => {
    const gestion = gestionOverride || gestionState || navContext?.gestion;
    if (!gestion) return [];
    const res = await getDocumentosPOAPorGestion(Number(gestion));
    const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
    setDocs(list || []);
    setGestionState(gestion);
    savePoaNavigationContext({ gestion, documentosPath });
    return list || [];
  };

  const handleGestionCancel = () => {
    setShowModal(false);
    navigate('/poa', { replace: true });
  };

  useEffect(() => {
    let mounted = true;
    const initialGestion = gestionState || navContext?.gestion;
    const shouldFetch = (!docs || docs.length === 0) && initialGestion;
    if (!shouldFetch) return undefined;

    setLoading(true);
    setError(null);
    getDocumentosPOAPorGestion(Number(initialGestion))
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        setDocs(list || []);
        setGestionState(initialGestion);
        savePoaNavigationContext({ gestion: initialGestion, documentosPath });
      })
      .catch((err) => {
        if (!mounted) return;
        setError(normalizeApiError(err, 'Error al cargar documentos POA.'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [documentosPath, location?.state?.gestion, gestionState, navContext?.gestion]);

  useEffect(() => {
    const handler = async () => {
      const gestion = gestionState || navContext?.gestion;
      if (!gestion) {
        toast.error('Seleccione una gestión antes de generar el reporte.');
        return;
      }
      setShowGeneralReportViewer(true);
    };
    window.addEventListener('generate-general-report-poa', handler);
    return () => window.removeEventListener('generate-general-report-poa', handler);
  }, [gestionState, navContext?.gestion]);

  const handleVerActividades = (docId, doc) => {
    const id = docId ?? doc?.id;
    if (!id) return;
    const gestionValue = getGestionNumberForDoc(doc);
    navigate(`/poa/objetivos-especificos/${id}`, {
      state: buildPoaNavigationState(location?.state, {
        gestion: gestionValue,
        documentosPath,
        documentoId: Number(id),
        documentoEstado: String(doc?.estado || '').toLowerCase(),
        documentoNombre: typeof doc?.programa === 'object' ? doc?.programa?.nombre : doc?.programa,
      }),
    });
  };

  const handleDelete = (doc) => {
    if (!canEdit) {
      toast.error('No tiene permisos para eliminar documentos POA.');
      return;
    }

    const gestion = gestionState || navContext?.gestion || doc?.gestion || '';
    if (!gestion) {
      toast.error('No se pudo eliminar: falta la gestión del documento.');
      return;
    }

    setDeleteDialogDoc({ doc, gestion });
  };

  const confirmarEliminarDocumento = async () => {
    const target = deleteDialogDoc;
    if (!target?.doc) return;

    try {
      setDeletingId(target.doc.id);
      await deleteDocumentoPOA(target.doc.id, Number(target.gestion));
      setDocs((prev) => (prev || []).filter((item) => Number(item.id) !== Number(target.doc.id)));
      toast.success('Documento eliminado');
    } catch (err) {
      const message = err?.response?.data?.detail || JSON.stringify(err?.response?.data) || err?.message || 'Error al eliminar documento';
      toast.error(String(message));
    } finally {
      setDeletingId(null);
      setDeleteDialogDoc(null);
    }
  };

  const handleGenerarPdfDocumento = async (doc) => {
    const gestion = getGestionNumberForDoc(doc);
    if (!gestion) {
      toast.error('No se pudo generar PDF: falta la gestión del documento.');
      return;
    }

    setPdfPreviewDoc(doc);
    setShowPdfPreviewModal(true);
  };

  const handleNoteChange = (docId, value) => {
    setReviewNotesByDoc((prev) => ({ ...prev, [docId]: value }));
  };

  const handleToggleObservacion = async (doc, observacion, resuelta) => {
    if (!observacion?.id) return;
    try {
      const res = await updateObservacionDocumentoPOA(observacion.id, { resuelta });
      const updated = res?.data || { ...observacion, resuelta };
      setDocs((prev) => (prev || []).map((item) => {
        if (Number(item.id) !== Number(doc.id)) return item;
        const checklist = Array.isArray(item.observaciones_checklist) ? item.observaciones_checklist : [];
        return {
          ...item,
          observaciones_checklist: checklist.map((obs) => (Number(obs.id) === Number(updated.id) ? updated : obs)),
        };
      }));
      toast.success(resuelta ? 'Observacion marcada como corregida.' : 'Observacion marcada como pendiente.');
    } catch (err) {
      toast.error(normalizeApiError(err, 'No se pudo actualizar la observacion.'));
    }
  };

  const handleSolicitudCambio = async (doc, solicitud, accion) => {
    if (!canReview) {
      toast.error('No tiene permisos para revisar solicitudes.');
      return;
    }
    const gestion = getGestionNumberForDoc(doc);
    setUpdatingEstadoId(`solicitud-${solicitud.id}-${accion}`);
    try {
      if (accion === 'aprobar') {
        await aprobarSolicitudCambioPOA(solicitud.id);
        toast.success('Solicitud aprobada y aplicada.');
      } else {
        await rechazarSolicitudCambioPOA(solicitud.id);
        toast.success('Solicitud rechazada.');
      }
      await refreshDocsForGestion(gestion);
    } catch (err) {
      toast.error(normalizeApiError(err, 'No se pudo resolver la solicitud.'));
    } finally {
      setUpdatingEstadoId(null);
    }
  };

  const handleCambioEstado = async (doc, nuevoEstado) => {
    const gestion = getGestionNumberForDoc(doc);
    if (!gestion) {
      toast.error('No se pudo actualizar el documento: falta la gestión.');
      return;
    }

    const reviewNote = String(reviewNotesByDoc[doc.id] || '').trim();
    setUpdatingEstadoId(doc.id);
    try {
      let res;
      if (nuevoEstado === 'revision') {
        if (!canEdit) throw new Error('No tiene permisos para enviar a revisión.');
        res = await enviarRevisionDocumentoPOA(doc.id, Number(gestion));
      } else if (nuevoEstado === 'ejecucion') {
        if (!canReview) throw new Error('No tiene permisos para iniciar ejecucion.');
        res = await iniciarEjecucionDocumentoPOA(doc.id, Number(gestion));
      } else if (nuevoEstado === 'aprobado') {
        if (!canReview) throw new Error('No tiene permisos para aprobar documentos.');
        res = await aprobarDocumentoPOA(doc.id, Number(gestion), reviewNote);
      } else if (nuevoEstado === 'observado') {
        if (!canReview) throw new Error('No tiene permisos para observar documentos.');
        if (!reviewNote) throw new Error('Debe registrar observaciones antes de marcar el documento como observado.');
        res = await observarDocumentoPOA(doc.id, Number(gestion), reviewNote);
      } else {
        throw new Error('Transición de estado no soportada.');
      }

      const updatedDoc = res?.data || {};
      setDocs((prev) => (prev || []).map((item) => (Number(item.id) === Number(doc.id) ? { ...item, ...updatedDoc } : item)));
      setReviewNotesByDoc((prev) => ({ ...prev, [doc.id]: '' }));

      if (nuevoEstado === 'revision') toast.success('Documento enviado a revisión.');
      if (nuevoEstado === 'ejecucion') toast.success('Documento iniciado en ejecucion.');
      if (nuevoEstado === 'aprobado') toast.success('Documento aprobado correctamente.');
      if (nuevoEstado === 'observado') toast.success('Observación registrada correctamente.');
    } catch (err) {
      const responseData = err?.response?.data;
      const detail = responseData?.detail || responseData?.jefe_unidad?.[0] || responseData?.observaciones?.[0] || err?.message || 'Error al actualizar el documento';
      toast.error(String(detail));
    } finally {
      setUpdatingEstadoId(null);
    }
  };

  const filteredDocs = useMemo(() => {
    const list = Array.isArray(docs) ? docs : [];
    if (!isRevisionBoard) return list;
    return list.filter((doc) => doc?.estado === 'revision' || getPendingSolicitudes(doc).length > 0);
  }, [docs, isRevisionBoard]);

  const filteredResumen = useMemo(() => (
    filteredDocs.reduce((acc, doc) => {
      const estado = doc?.estado || 'elaboracion';
      if (estado === 'elaboracion') acc.elaboracion += 1;
      else if (estado === 'revision') acc.revision += 1;
      else if (estado === 'observado') acc.observado += 1;
      else if (estado === 'aprobado') acc.aprobado += 1;
      else if (estado === 'ejecucion') acc.ejecucion += 1;
      else acc.otro += 1;
      acc.total += 1;
      acc.solicitudes += getPendingSolicitudes(doc).length;
      return acc;
    }, { total: 0, elaboracion: 0, revision: 0, observado: 0, aprobado: 0, ejecucion: 0, solicitudes: 0, otro: 0 })
  ), [filteredDocs]);

  const boardTitle = isRevisionBoard ? 'Revision de Documentos POA' : 'Documentos POA';
  const boardDescription = isRevisionBoard
    ? 'Aqui se concentran los documentos enviados a revision y las solicitudes de cambio pendientes.'
    : 'Seleccione una gestión para ver y administrar sus documentos.';

  const summaryCardBase = 'poa-summary-stat poa-mobile-kpi-card poa-kpi-formal rounded-lg p-3 border shadow-sm bg-white/85 dark:bg-slate-900/55';
  const statTone = isDark
    ? {
        total: 'poa-kpi-accent-blue border-blue-500/30 text-blue-100',
        revision: 'poa-kpi-accent-sky border-sky-500/30 text-sky-100',
        observado: 'poa-kpi-accent-orange border-orange-500/30 text-orange-100',
        elaboracion: 'poa-kpi-accent-amber border-amber-500/30 text-amber-100',
        aprobado: 'poa-kpi-accent-emerald border-emerald-500/30 text-emerald-100',
        ejecucion: 'poa-kpi-accent-violet border-violet-500/30 text-violet-100',
      }
    : {
        total: 'poa-kpi-accent-blue border-blue-200 text-blue-700',
        revision: 'poa-kpi-accent-sky border-sky-200 text-sky-700',
        observado: 'poa-kpi-accent-orange border-orange-200 text-orange-700',
        elaboracion: 'poa-kpi-accent-amber border-amber-200 text-amber-700',
        aprobado: 'poa-kpi-accent-emerald border-emerald-200 text-emerald-700',
        ejecucion: 'poa-kpi-accent-violet border-violet-200 text-violet-700',
      };

  const actionButtonBase = 'flex items-center justify-center gap-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 border';
  const actionButtonStyles = {
    send: isDark
      ? `${actionButtonBase} bg-slate-700 hover:bg-slate-600 text-slate-100 border-slate-600/60`
      : `${actionButtonBase} bg-sky-600 hover:bg-sky-500 text-white border-sky-500/30`,
    pdf: isDark
      ? `${actionButtonBase} bg-cyan-700 hover:bg-cyan-600 text-slate-100 border-cyan-600/60`
      : `${actionButtonBase} bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500/30`,
    edit: isDark
      ? `${actionButtonBase} bg-blue-700 hover:bg-blue-600 text-slate-100 border-blue-600/60`
      : `${actionButtonBase} bg-blue-600 hover:bg-blue-500 text-white border-blue-500/30`,
    delete: isDark
      ? `${actionButtonBase} bg-rose-700 hover:bg-rose-600 text-slate-100 border-rose-600/60`
      : `${actionButtonBase} bg-red-600 hover:bg-red-500 text-white border-red-500/30`,
    bitacora: isDark
      ? `${actionButtonBase} bg-slate-600 hover:bg-slate-500 text-slate-100 border-slate-500/60`
      : `${actionButtonBase} bg-slate-700 hover:bg-slate-600 text-white border-slate-600/30`,
  };

  const actionIconWrap = isDark
    ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-current ring-1 ring-inset ring-white/10'
    : 'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-current ring-1 ring-inset ring-white/15';
  const generalGestion = getGestionNumberForDoc({ gestion: gestionState || navContext?.gestion }) || Number(new Date().getFullYear());

  return (
    <section className="flex flex-col items-start justify-start flex-1 pb-4 px-1 w-full">
      <div className="w-full">
        {showModal && (
          <GestionSelectorModal
            currentUser={outletContext?.user || outletContext?.currentUser || null}
            poaRoles={poaRoles}
            canCreateDocument={canEdit}
            onClose={() => setShowModal(false)}
            onCancel={handleGestionCancel}
            onSuccess={handleSuccess}
          />
        )}
        {showNuevoModal && (
          <NuevoDocumentoModal
            currentUser={outletContext?.user || outletContext?.currentUser || null}
            onClose={closeNuevo}
            initialGestion={gestionState || navContext?.gestion || new Date().getFullYear()}
            document={editingDoc}
            onCreated={async (created) => {
              try {
                const gestion = created?.gestion || gestionState || navContext?.gestion || new Date().getFullYear();
                const res = await getDocumentosPOAPorGestion(Number(gestion));
                const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
                setDocs(list || [created]);
                setGestionState(gestion);
              } catch {
                setDocs((prev) => [created, ...(prev || [])]);
              } finally {
                closeNuevo();
              }
            }}
            onUpdated={handleUpdated}
          />
        )}
        {showBitacoraModal && bitacoraDoc && (
          <BitacoraModal
            doc={bitacoraDoc}
            gestion={getGestionNumberForDoc(bitacoraDoc)}
            onClose={() => {
              setShowBitacoraModal(false);
              setBitacoraDoc(null);
            }}
          />
        )}
        <Dialog
          open={Boolean(deleteDialogDoc)}
          type="danger"
          title="Eliminar documento POA"
          message={deleteDialogDoc?.doc ? `¿Confirma que desea eliminar este documento?\n${deleteDialogDoc.doc.programa || `Documento #${deleteDialogDoc.doc.id}`}` : ''}
          confirmText={deletingId === deleteDialogDoc?.doc?.id ? 'Eliminando...' : 'Eliminar'}
          cancelText="Cancelar"
          confirmDisabled={deletingId === deleteDialogDoc?.doc?.id}
          onConfirm={confirmarEliminarDocumento}
          onCancel={() => setDeleteDialogDoc(null)}
        />
        {showRevisionModal && revisionDoc && createPortal(
          (
            <div className="fixed inset-0 z-[220]">
              <div className="absolute inset-0 bg-transparent" onClick={() => setShowRevisionModal(false)} />

              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-2xl rounded-2xl border border-sky-300/40 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider font-bold text-sky-700 dark:text-sky-300">Enviar a revisión</p>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate" title={revisionDoc.programa || ''}>
                        {revisionDoc.programa || `Documento #${revisionDoc.id}`}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRevisionModal(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500 transition"
                      aria-label="Cerrar"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-5">
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-4 mb-4 dark:border-slate-700 dark:bg-slate-800/45">
                      <p className="text-sm uppercase tracking-wider font-bold text-indigo-700 dark:text-indigo-300">Este documento se enviará al Director de Carrera</p>
                      <p className="text-base text-slate-800 dark:text-slate-100 mt-2 leading-relaxed">{getPersonaLabel(revisionDoc?.jefe_unidad || revisionDoc?.jefe_unidad_nombre || revisionDoc?.jefe_unidad_detalle, 'Debe asignar Director de Carrera en el documento')}</p>
                    </div>

                    <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/25 px-4 py-4 mb-4">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 leading-relaxed">
                        Nota: Una vez enviado a revisión, el documento cambiará de estado a "En Revisión" y quedará bloqueado para edición hasta que el Director de Carrera emita su resolución (aprobación u observación).
                      </p>
                    </div>

                    {(() => {
                      const hasDirector = Boolean(getPersonaLabel(revisionDoc?.jefe_unidad || revisionDoc?.jefe_unidad_nombre || revisionDoc?.jefe_unidad_detalle));
                      const canSubmit = hasDirector;
                      return (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setShowRevisionModal(false);
                                setRevisionDoc(null);
                              }}
                              className="flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-base font-bold py-3 px-4 rounded-xl shadow transition-all w-full"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await handleCambioEstado(revisionDoc, 'revision');
                                setShowRevisionModal(false);
                                setRevisionDoc(null);
                              }}
                              disabled={updatingEstadoId === revisionDoc.id || !canSubmit}
                              className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-base font-bold py-3 px-4 rounded-xl shadow transition-all w-full disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <SendHorizontal size={14} /> {updatingEstadoId === revisionDoc.id ? 'Enviando...' : (revisionDoc.estado === 'observado' ? 'Reenviar a revisión' : 'Enviar a revisión')}
                            </button>
                          </div>
                          {!canSubmit && (
                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                              Para enviar, verifica que el documento tenga Director de Carrera asignado.
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ),
          document.body
        )}
        {showPdfPreviewModal && pdfPreviewDoc && (
          <FullscreenPDFViewer
            isOpen={showPdfPreviewModal}
            onClose={() => {
              setShowPdfPreviewModal(false);
              setPdfPreviewDoc(null);
            }}
            pdfUrl={`${API_BASE}/api/poa/documentos_poa/${pdfPreviewDoc.id}/pdf-oficial/?gestion=${getGestionNumberForDoc(pdfPreviewDoc)}`}
            downloadFileName={`documento_poa_${pdfPreviewDoc.id}_${getGestionNumberForDoc(pdfPreviewDoc)}.pdf`}
            showPrint={true}
            title={`Documento POA #${pdfPreviewDoc.id}`}
          />
        )}

        {showGeneralReportViewer && (
          <FullscreenPDFViewer
            isOpen={showGeneralReportViewer}
            onClose={() => setShowGeneralReportViewer(false)}
            pdfUrl={`${API_BASE}/api/reportes/generar-reporte-general/?gestion=${generalGestion}`}
            downloadFileName={`reporte_documentos_${generalGestion}.pdf`}
            showPrint={true}
            title="Reporte general POA"
          />
        )}

        {!hasGestionSelected && !loading && (
          <div className="poa-mobile-page-card rounded-xl border border-blue-200 bg-white/85 p-6 shadow-sm w-full dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{boardTitle}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{boardDescription}</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-500 transition"
              >
                <Calendar size={16} /> Seleccionar gestión
              </button>
            </div>
          </div>
        )}

        {loading && <div className="text-blue-800 dark:text-slate-200 mt-4">Cargando documentos...</div>}
        {error && <div className="text-red-600 dark:text-red-400 mt-4">{String(error)}</div>}

        {hasGestionSelected && (
          <div className="mt-6 w-full">
            <div className="poa-mobile-page-card flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 rounded-2xl border border-blue-200/70 bg-white/75 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/55">
              <div>
                <h3 className="text-2xl font-bold text-blue-900 dark:text-slate-100">{boardTitle}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Gestión: {gestionState || navContext?.gestion}</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-900 transition"
              >
                <Calendar size={16} /> Cambiar gestión
              </button>
            </div>

            <div className="w-full mb-4">
              <div className={`poa-mobile-kpi-strip ${isRevisionBoard ? 'poa-mobile-kpi-strip-3' : 'poa-mobile-kpi-strip-6'} grid gap-3 ${isRevisionBoard ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-6'}`}>
                <div className={`${summaryCardBase} ${statTone.total}`}>
                  <p className="poa-summary-stat-label text-[11px] uppercase tracking-widest font-bold">Total</p>
                  <p className="poa-summary-stat-value text-2xl font-bold">{filteredResumen.total}</p>
                </div>
                <div className={`${summaryCardBase} ${statTone.revision}`}>
                  <p className="poa-summary-stat-label text-[11px] uppercase tracking-widest font-bold">En revisión</p>
                  <p className="poa-summary-stat-value text-2xl font-bold">{filteredResumen.revision}</p>
                </div>
                <div className={`${summaryCardBase} ${statTone.observado}`}>
                  <p className="poa-summary-stat-label text-[11px] uppercase tracking-widest font-bold">{isRevisionBoard ? 'Solicitudes' : 'Observados'}</p>
                  <p className="poa-summary-stat-value text-2xl font-bold">{isRevisionBoard ? filteredResumen.solicitudes : filteredResumen.observado}</p>
                </div>
                {!isRevisionBoard && (
                  <>
                    <div className={`${summaryCardBase} ${statTone.elaboracion}`}>
                      <p className="poa-summary-stat-label text-[11px] uppercase tracking-widest font-bold">En elaboración</p>
                      <p className="poa-summary-stat-value text-2xl font-bold">{filteredResumen.elaboracion}</p>
                    </div>
                    <div className={`${summaryCardBase} ${statTone.aprobado}`}>
                      <p className="poa-summary-stat-label text-[11px] uppercase tracking-widest font-bold">Aprobados</p>
                      <p className="poa-summary-stat-value text-2xl font-bold">{filteredResumen.aprobado}</p>
                    </div>
                    <div className={`${summaryCardBase} ${statTone.ejecucion}`}>
                      <p className="poa-summary-stat-label text-[11px] uppercase tracking-widest font-bold">En ejecución</p>
                      <p className="poa-summary-stat-value text-2xl font-bold">{filteredResumen.ejecucion}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 w-full">
              {filteredDocs && filteredDocs.length > 0 ? (
                filteredDocs.map((doc, idx) => {
                  const estado = doc.estado || 'elaboracion';
                  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.elaboracion;
                  const gestion = typeof doc.gestion === 'object' ? (doc.gestion.nombre || '') : (doc.gestion || gestionState);
                  const programa = typeof doc.programa === 'object' ? (doc.programa.nombre || '') : (doc.programa || '');
                  const unidad = getUnidadSolicitanteLabel(doc) || 'No especificada';
                  const entidad = typeof doc.entidad === 'object' ? (doc.entidad.nombre || DEFAULT_ENTIDAD) : (doc.entidad || DEFAULT_ENTIDAD);
                  const objetivo = typeof doc.objetivo_gestion_institucional === 'object' ? (doc.objetivo_gestion_institucional.nombre || '') : (doc.objetivo_gestion_institucional || '');
                  const observaciones = (doc.observaciones || '').trim();
                  const observacionesChecklist = getChecklistEntries(doc, observaciones);
                  const solicitudesPendientes = getPendingSolicitudes(doc);
                  const elaboradoPor = getPersonaLabel(doc.elaborado_por, null);
                  const jefeUnidad = getPersonaLabel(doc.jefe_unidad, null);
                  const note = reviewNotesByDoc[doc.id] || '';
                  const canRespondThisDoc = canReview && estado === 'revision';
                  const canSendToRevision = canEdit && !isRevisionBoard && (estado === 'elaboracion' || estado === 'observado');
                  const canOpenDocument = !isRevisionBoard;
                  const canEditDocument = canEdit && !isRevisionBoard && estado !== 'revision';
                  const canDeleteDocument = canEdit && !isRevisionBoard && ['elaboracion', 'observado'].includes(estado);
                  const canStartExecution = canReview && estado === 'aprobado' && !isRevisionBoard;
                  return (
                    <div key={doc.id || idx} className="w-full">
                      <div
                        role={canOpenDocument ? 'button' : undefined}
                        tabIndex={canOpenDocument ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (!canOpenDocument) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleVerActividades(doc.id, doc);
                          }
                        }}
                        onClick={() => {
                          if (canOpenDocument) handleVerActividades(doc.id, doc);
                        }}
                        className={`relative bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 border-2 border-blue-400/70 dark:border-slate-800 rounded-xl overflow-hidden transition-all duration-300 w-full focus:outline-none ${canOpenDocument ? 'cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/20' : 'cursor-default'}`}
                      >
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600" />

                        <div className="grid grid-cols-12">
                          <div className="col-span-12 md:col-span-2 flex flex-col items-center justify-center gap-2 border-b md:border-b-0 md:border-r border-blue-300 dark:border-slate-800 bg-blue-100/50 dark:bg-transparent px-4 py-5">
                            <span className="text-5xl md:text-4xl font-bold text-slate-900 dark:text-white font-mono leading-none">{gestion}</span>
                            <span className="text-sm text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Gestión</span>
                            {doc.fecha_elaboracion && (
                              <div className="mt-2 pt-2 border-t border-blue-300 dark:border-slate-800 w-full flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-2">
                                  <Calendar size={14} className="text-slate-500 dark:text-slate-400" />
                                  <span className="text-slate-700 dark:text-slate-300 text-sm font-semibold font-mono">{doc.fecha_elaboracion}</span>
                                </div>
                                <span className="text-sm text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Elaboración</span>
                              </div>
                            )}
                          </div>

                          <div className="col-span-12 md:col-span-7 p-5 border-b md:border-b-0 md:border-r border-blue-300 dark:border-slate-800 bg-white/55 dark:bg-transparent">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                                <Building size={14} />Entidad: {entidad}
                              </span>
                              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-bold ${cfg.badge}`}>
                                <span className={`w-2 h-2 rounded-full animate-pulse ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                              {doc.ciclo_revision_actual > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-500/10 text-slate-500 border border-slate-400/20 font-bold">
                                  <History size={10} /> Ciclo {doc.ciclo_revision_actual}
                                </span>
                              )}
                            </div>

                            <div className="mb-3 space-y-2">
                              <div className="min-w-0">
                                <p className="text-sm text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Programa</p>
                                <h3 className="text-lg md:text-base font-bold text-slate-900 dark:text-white leading-tight truncate" title={programa}>{programa || 'Sin programa'}</h3>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Unidad solicitante</p>
                                <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-sm truncate" title={unidad || ''}>
                                  <Briefcase size={11} className="flex-shrink-0" />
                                  <span className="truncate">{unidad || 'No especificada'}</span>
                                </p>
                              </div>
                            </div>

                            <div className="border-y border-blue-300 dark:border-slate-800 py-3 grid grid-cols-2 gap-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-blue-100 rounded-lg border border-blue-200 flex items-center justify-center flex-shrink-0 dark:bg-slate-800 dark:border-slate-700">
                                  <User size={13} className="text-blue-600 dark:text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Elaborado por</p>
                                  <p className="text-slate-700 dark:text-slate-300 text-sm font-semibold truncate" title={elaboradoPor || ''}>{elaboradoPor || <span className="text-slate-500 dark:text-slate-600 italic font-normal">No asignado</span>}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-blue-100 rounded-lg border border-blue-200 flex items-center justify-center flex-shrink-0 dark:bg-slate-800 dark:border-slate-700">
                                  <ShieldCheck size={13} className="text-blue-600 dark:text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Director de carrera</p>
                                  <p className="text-slate-700 dark:text-slate-300 text-sm font-semibold truncate" title={jefeUnidad || ''}>{jefeUnidad || <span className="text-slate-500 dark:text-slate-600 italic font-normal">No asignado</span>}</p>
                                </div>
                              </div>
                            </div>

                            {objetivo && (
                              <div className="mt-3 bg-blue-100/70 border border-blue-300 rounded-lg p-3 flex gap-2 items-start dark:bg-slate-950/50 dark:border-slate-800">
                                <Target size={13} className="text-blue-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-[10px] text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider mb-0.5">Objetivo institucional</p>
                                  <p className="text-slate-700 dark:text-slate-400 text-xs leading-relaxed line-clamp-2">{objetivo}</p>
                                </div>
                              </div>
                            )}

                            {(observaciones || observacionesChecklist.length > 0) && (
                              <div className="mt-3 bg-orange-100/75 dark:bg-orange-950/35 border border-orange-300 dark:border-orange-800 rounded-lg p-3">
                                <p className="text-[10px] text-orange-700 dark:text-orange-300 font-bold uppercase tracking-wider mb-1">Observaciones vigentes</p>
                                <ul className="space-y-1.5">
                                  {observacionesChecklist.map((item, itemIndex) => (
                                    <li key={item.id || item.fallbackKey || `${doc.id}-obs-${itemIndex}`} className="flex items-start gap-2 text-orange-900 dark:text-orange-200 text-xs leading-relaxed">
                                      {canEdit && estado === 'observado' && item.id ? (
                                        <input
                                          type="checkbox"
                                          checked={!!item.resuelta}
                                          onChange={(e) => handleToggleObservacion(doc, item, e.target.checked)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-0.5 h-4 w-4 rounded border-orange-400 text-orange-600 focus:ring-orange-500"
                                          aria-label="Marcar observacion corregida"
                                        />
                                      ) : (
                                        <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.resuelta ? 'bg-emerald-500 dark:bg-emerald-300' : 'bg-orange-500 dark:bg-orange-300'}`} />
                                      )}
                                      <span className={item.resuelta ? 'line-through opacity-70' : ''}>{item.texto || item}</span>
                                    </li>
                                  ))}
                                </ul>
                                <p className="mt-2 text-[10px] text-orange-700/90 dark:text-orange-300/90">
                                  Use este checklist como guía de corrección para el elaborador.
                                </p>
                              </div>
                            )}

                            {solicitudesPendientes.length > 0 && (
                              <div className="mt-3 rounded-lg border border-sky-300 bg-sky-50/85 p-3 dark:border-sky-800 dark:bg-sky-950/30" onClick={(e) => e.stopPropagation()}>
                                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                                  <ListChecks size={12} /> Solicitudes de cambio pendientes
                                </p>
                                <div className="space-y-2">
                                  {solicitudesPendientes.map((solicitud) => {
                                    const resumen = solicitud?.resumen || {};
                                    const busyApprove = updatingEstadoId === `solicitud-${solicitud.id}-aprobar`;
                                    const busyReject = updatingEstadoId === `solicitud-${solicitud.id}-rechazar`;
                                    return (
                                      <div key={solicitud.id} className="rounded-lg border border-sky-200 bg-white/80 p-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/55 dark:text-slate-200">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="font-bold text-slate-900 dark:text-white">{resumen.titulo || getSolicitudTitle(solicitud)}</p>
                                            <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                                              {resumen.codigo || resumen.partida || resumen.item || solicitud.solicitado_por_nombre || 'Solicitud pendiente'}
                                            </p>
                                          </div>
                                          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                                            Pendiente
                                          </span>
                                        </div>
                                        {solicitud.descripcion && (
                                          <p className="mt-2 whitespace-pre-line text-slate-600 dark:text-slate-300">{solicitud.descripcion}</p>
                                        )}
                                        {canReview && (
                                          <div className="mt-2 grid grid-cols-2 gap-2">
                                            <button
                                              type="button"
                                              onClick={() => handleSolicitudCambio(doc, solicitud, 'aprobar')}
                                              disabled={busyApprove || busyReject}
                                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              <CheckCircle2 size={13} /> {busyApprove ? 'Aplicando...' : 'Aprobar'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleSolicitudCambio(doc, solicitud, 'rechazar')}
                                              disabled={busyApprove || busyReject}
                                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              <XCircle size={13} /> {busyReject ? 'Rechazando...' : 'Rechazar'}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                          </div>

                          <div className="col-span-12 md:col-span-3 flex flex-col gap-3 p-5 bg-blue-50/40 dark:bg-transparent">
                            {canSendToRevision && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRevisionDoc(doc);
                                  setShowRevisionModal(true);
                                }}
                                className={actionButtonStyles.send}
                              >
                                <span className={actionIconWrap}><SendHorizontal size={14} /></span>
                                <span>{estado === 'observado' ? 'Reenviar a revisión' : 'Enviar a revisión'}</span>
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerarPdfDocumento(doc);
                              }}
                              className={actionButtonStyles.pdf}
                            >
                              <span className={actionIconWrap}><FileText size={14} /></span>
                              <span>Generar PDF</span>
                            </button>

                            {canEditDocument && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingDoc(doc);
                                  setShowNuevoModal(true);
                                }}
                                className={actionButtonStyles.edit}
                              >
                                <span className={actionIconWrap}><Edit size={14} /></span>
                                <span>{['aprobado', 'ejecucion'].includes(estado) ? 'Solicitar cambios' : 'Editar'}</span>
                              </button>
                            )}

                            {canDeleteDocument && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(doc);
                                }}
                                disabled={deletingId === doc.id}
                                className={`${actionButtonStyles.delete} disabled:cursor-not-allowed disabled:opacity-50`}
                              >
                                <span className={actionIconWrap}><Trash2 size={14} /></span>
                                <span>{deletingId === doc.id ? 'Eliminando...' : 'Eliminar'}</span>
                              </button>
                            )}

                            {canStartExecution && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCambioEstado(doc, 'ejecucion');
                                }}
                                disabled={updatingEstadoId === doc.id}
                                className="flex items-center justify-center gap-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 border bg-violet-600 hover:bg-violet-500 text-white border-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <span className={actionIconWrap}><PlayCircle size={14} /></span>
                                <span>{updatingEstadoId === doc.id ? 'Iniciando...' : 'Iniciar ejecucion'}</span>
                              </button>
                            )}

                            {canRespondThisDoc && (
                              <div className="rounded-lg border border-emerald-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/35" onClick={(e) => e.stopPropagation()}>
                                <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300 mb-1">Revisión de Dirección</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Revise el PDF y registre observaciones como lista, una por linea.</p>
                                <textarea
                                  value={note}
                                  onChange={(e) => handleNoteChange(doc.id, e.target.value)}
                                  placeholder="Una observacion por linea..."
                                  className="mt-3 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-700 dark:text-slate-100 min-h-[92px] resize-y"
                                />
                                <div className="mt-3 grid grid-cols-1 gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCambioEstado(doc, 'aprobado');
                                    }}
                                    disabled={updatingEstadoId === doc.id}
                                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2 px-4 rounded-xl shadow transition-all w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <CheckCircle2 size={14} /> {updatingEstadoId === doc.id ? 'Guardando...' : 'Aprobar revisión'}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCambioEstado(doc, 'observado');
                                    }}
                                    disabled={updatingEstadoId === doc.id}
                                    className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold py-2 px-4 rounded-xl shadow transition-all w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <AlertCircle size={14} /> {updatingEstadoId === doc.id ? 'Guardando...' : 'Observar revisión'}
                                  </button>
                                </div>
                              </div>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setBitacoraDoc(doc);
                                setShowBitacoraModal(true);
                              }}
                              className={actionButtonStyles.bitacora}
                            >
                              <span className={actionIconWrap}><History size={14} /></span>
                              <span>Bitacora</span>
                            </button>

                            {!canEdit && !canRespondThisDoc && (
                              <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-3 text-xs text-slate-500 flex items-start gap-2 dark:border-slate-800 dark:bg-slate-950/35 dark:text-slate-400">
                                <Clock3 size={14} className="mt-0.5 flex-shrink-0" />
                                <span>Vista de solo lectura para este documento.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white/70 px-5 py-8 text-center text-gray-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">
                  {isRevisionBoard
                    ? 'No hay documentos en revision ni solicitudes pendientes para la gestion seleccionada.'
                    : 'No hay documentos para mostrar.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DocumentosPOAPage;
