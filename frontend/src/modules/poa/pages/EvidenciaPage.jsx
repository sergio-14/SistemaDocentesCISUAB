import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { getEvidenciasPorActividad, crearEvidencia, updateEvidencia, deleteEvidencia, getActividadPorId } from '../../../apis/poa.api';
import toast from 'react-hot-toast';
import { FaEdit, FaTrash, FaChevronLeft, FaChevronRight, FaLink, FaFileDownload } from 'react-icons/fa';
import Dialog from '../components/base/Dialog';
import { buildPoaNavigationState, getPoaNavigationContext, normalizePoaGestion, savePoaNavigationContext } from '../utils/navigationContext';

const EvidenciaPage = () => {
  const { actividadId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navContext = React.useMemo(() => getPoaNavigationContext(location?.state), [location?.key, location?.state]);
  const outletContext = useOutletContext() || {};
  const poaPermissions = outletContext.poaPermissions || {};
  const canEdit = !!poaPermissions.canEdit;
  const [evidencia, setEvidencia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actividad, setActividad] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState([]);
  const [linkItems, setLinkItems] = useState([{ id: 'link-0', url: '' }]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [formData, setFormData] = useState({ resultados_logrados: '', programado: 1, ejecutado: 1, grado_cumplimiento: '' });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fileInputRef = useRef(null);
  const documentoEstado = String(location?.state?.documentoEstado || navContext?.documentoEstado || actividad?.documento_estado || '').toLowerCase();
  const documentoId = location?.state?.documentoId || navContext?.documentoId || actividad?.documento_id || null;
  const objetivoId = location?.state?.objetivoId || navContext?.objetivoId || actividad?.objetivo || actividad?.objetivo_id || null;
  const gestionNavegacion = normalizePoaGestion(location?.state?.gestion || navContext?.gestion || actividad?.documento_gestion);
  const canEditEvidence = canEdit && documentoEstado === 'ejecucion';

  const createLinkItem = (url = '') => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, url });
  const normalizeCumplimientoInput = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    return String(Math.trunc(numeric));
  };
  const poaFieldClass = 'w-full px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm';
  const poaCompactFieldClass = 'w-full px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm';
  const poaTextAreaClass = `${poaFieldClass} resize-none`;
  const poaCancelButtonClass = 'min-w-[88px] rounded-xl px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm font-bold transition-colors border border-slate-300 bg-slate-100 text-slate-700 shadow-sm hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600';
  const poaSaveButtonClass = 'min-w-[88px] rounded-xl px-3 py-2 text-xs sm:px-4 sm:py-2.5 sm:text-sm font-bold transition-colors border border-emerald-500/60 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md hover:brightness-105';
  const pageCardClass = 'border border-slate-200 bg-white/80 shadow-xl dark:border-slate-700 dark:bg-slate-900/55';
  const infoCardClass = 'rounded-2xl border border-slate-200 bg-white/80 p-4 sm:p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/55';
  const mediaCardClass = 'overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-lg dark:border-slate-700 dark:bg-slate-900/55';
  const chipCardClass = 'rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300';
  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const addLinkItem = () => setLinkItems((c) => [...c, createLinkItem('')]);
  const updateLinkItem = (id, url) => setLinkItems((c) => c.map((it) => (it.id === id ? { ...it, url } : it)));
  const removeLinkItem = (id) => setLinkItems((current) => {
    const next = current.filter((item) => item.id !== id);
    return next.length > 0 ? next : [createLinkItem('')];
  });

  const revokePreviewUrls = (items) => {
    (items || []).forEach((item) => {
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  };

  const clearPendingFiles = () => {
    setFiles((current) => {
      revokePreviewUrls(current);
      return [];
    });
  };

  useEffect(() => {
    return () => revokePreviewUrls(files);
  }, [files]);

  // Cargar evidencia y actividad al montar / cuando cambia actividadId
  useEffect(() => {
    if (!actividadId) {
      setLoading(false);
      return;
    }

    loadEvidencia();

    getActividadPorId(actividadId)
      .then(res => {
        setActividad(res.data);
      })
      .catch(err => {
        console.error('[EvidenciaPage] error loading actividad', err);
        setActividad(null);
      });
  }, [actividadId]);

  useEffect(() => {
    savePoaNavigationContext({
      gestion: gestionNavegacion,
      documentoId,
      documentoEstado,
      objetivoId,
      actividadId,
      actividad: actividad || navContext?.actividad,
    });
  }, [actividad, actividadId, documentoEstado, documentoId, gestionNavegacion, objetivoId]);

  const returnToActivities = () => {
    if (objetivoId) {
      navigate(`/poa/actividades/${objetivoId}`, {
        replace: true,
        state: buildPoaNavigationState(location?.state, {
          gestion: gestionNavegacion,
          documentoId,
          documentoEstado,
          objetivoId,
          actividadId,
          actividad: actividad || navContext?.actividad,
        }),
      });
      return;
    }
    navigate(-1);
  };

  const loadEvidencia = () => {
    setLoading(true);
    getEvidenciasPorActividad(actividadId)
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        if (list.length > 0) {
          const ev = list[0];
          const links = (ev.archivos || [])
            .filter((archivo) => archivo.tipo === 'link' && archivo.url)
            .map((archivo, index) => ({
              id: archivo.id ? `link-${archivo.id}` : `link-${index}`,
              url: archivo.url,
            }));
          setEvidencia(ev);
          setCarouselIndex(0);
          setFormData({
            resultados_logrados: ev.resultados_logrados || '',
            programado: ev.programado || 1,
            ejecutado: ev.ejecutado || 1,
            grado_cumplimiento: normalizeCumplimientoInput(ev.grado_cumplimiento),
          });
          setLinkItems(links.length > 0 ? links : [createLinkItem('')]);
          setEditMode(false);
        } else {
          setEvidencia(null);
          setLinkItems([createLinkItem('')]);
        }
      })
      .catch(err => {
        console.error('[EvidenciaPage] error loading evidencias', err);
        toast.error('Error cargando evidencias');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const addFiles = (incomingFiles) => {
    const list = Array.from(incomingFiles || []).filter(file => file && file.type?.startsWith('image/'));
    if (list.length === 0) return;

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`));
      const nextItems = list
        .filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`))
        .map((file) => ({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }));

      return [...prev, ...nextItems];
    });
  };

  const onFileChange = (event) => {
    addFiles(event.target.files);
    event.target.value = '';
  };

  const removePendingFile = (id) => {
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const markImageForRemoval = (archivoId) => {
    setRemovedImageIds((current) => (current.includes(archivoId) ? current : [...current, archivoId]));
  };

  const unmarkImageRemoval = (archivoId) => {
    setRemovedImageIds((current) => current.filter((id) => id !== archivoId));
  };

  const onPaste = (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const pastedFiles = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(file => file && file.type?.startsWith('image/'));

    if (pastedFiles.length > 0) {
      event.preventDefault();
      addFiles(pastedFiles);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    addFiles(event.dataTransfer?.files);
  };

  const handleEditCancel = () => {
    if (evidencia) {
      const links = (evidencia.archivos || [])
        .filter((archivo) => archivo.tipo === 'link' && archivo.url)
        .map((archivo, index) => ({
          id: archivo.id ? `link-${archivo.id}` : `link-${index}`,
          url: archivo.url,
        }));
      setFormData({
        resultados_logrados: evidencia.resultados_logrados || '',
        programado: evidencia.programado || 1,
        ejecutado: evidencia.ejecutado || 1,
        grado_cumplimiento: normalizeCumplimientoInput(evidencia.grado_cumplimiento),
      });
      setLinkItems(links.length > 0 ? links : [createLinkItem('')]);
      setRemovedImageIds([]);
      clearPendingFiles();
      setEditMode(false);
      return;
    }

    returnToActivities();
  };

  const handleStartEdit = () => {
    if (!canEditEvidence) {
      toast.error('Las evidencias solo pueden cargarse cuando el documento esta en ejecucion.');
      return;
    }
    setEditMode(true);
  };

  const handleOpenDeleteDialog = () => {
    if (!canEditEvidence) {
      toast.error('Las evidencias solo pueden modificarse cuando el documento esta en ejecucion.');
      return;
    }
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!evidencia) return;

    try {
      await deleteEvidencia(evidencia.id);
      toast.success('Evidencia eliminada');
      setEvidencia(null);
      clearPendingFiles();
      setEditMode(false);
      setCarouselIndex(0);
      setFormData({
        resultados_logrados: '',
        programado: 1,
        ejecutado: 1,
        grado_cumplimiento: '',
      });
      setLinkItems([createLinkItem('')]);
      setRemovedImageIds([]);
    } catch (error) {
      toast.error('No se pudo eliminar la evidencia');
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!actividadId) return;
    if (!canEditEvidence) {
      toast.error('Las evidencias solo pueden guardarse cuando el documento esta en ejecucion.');
      return;
    }
    const isEditingExisting = Boolean(editMode && evidencia?.id);

    if (!formData.resultados_logrados.trim()) {
      toast.error('Debes escribir los resultados logrados');
      return;
    }

    const gradoCumplimientoTexto = String(formData.grado_cumplimiento).trim();
    if (!gradoCumplimientoTexto) {
      toast.error('Debes ingresar el grado de cumplimiento');
      return;
    }

    const gradoCumplimientoNumero = Number(gradoCumplimientoTexto);
    if (!Number.isInteger(gradoCumplimientoNumero) || gradoCumplimientoNumero < 0 || gradoCumplimientoNumero > 100) {
      toast.error('El grado de cumplimiento debe ser un número entero entre 0 y 100');
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('actividad_id', String(actividadId));
      payload.append('resultados_logrados', formData.resultados_logrados);
      payload.append('programado', String(formData.programado));
      payload.append('ejecutado', String(formData.ejecutado));
      payload.append('grado_cumplimiento', String(gradoCumplimientoNumero));

      const links = linkItems
        .map((item) => item.url.trim())
        .filter(Boolean);
      const removedImages = Array.from(new Set(removedImageIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));

      links.forEach(link => payload.append('links', link));
      files.forEach((item) => payload.append('archivos', item.file));
      if (removedImages.length > 0) {
        payload.append('removed_archivos', JSON.stringify(removedImages));
      }

      if (isEditingExisting) {
        await updateEvidencia(evidencia.id, payload);
      } else {
        await crearEvidencia(payload);
      }
      toast.success(isEditingExisting ? 'Evidencia actualizada' : 'Evidencia registrada');
      clearPendingFiles();
      setLinkItems(links.length > 0 ? links.map((link) => createLinkItem(link)) : [createLinkItem('')]);
      setRemovedImageIds([]);
      setEditMode(false);
      loadEvidencia();
    } catch (error) {
      toast.error('No se pudo guardar la evidencia');
    } finally {
      setSubmitting(false);
    }
  };

  const nextImage = () => {
    const imagenes = evidencia?.archivos?.filter(a => a.tipo === 'imagen' && a.archivo_url) || [];
    if (imagenes.length > 1) {
      setCarouselIndex(prev => (prev + 1) % imagenes.length);
    }
  };

  const prevImage = () => {
    const imagenes = evidencia?.archivos?.filter(a => a.tipo === 'imagen' && a.archivo_url) || [];
    if (imagenes.length > 1) {
      setCarouselIndex(prev => (prev - 1 + imagenes.length) % imagenes.length);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  const showForm = !evidencia || editMode;
  const isEditingExisting = Boolean(editMode && evidencia?.id);
  const pendingPreviewItems = files;
  const existingImageItems = (evidencia?.archivos || []).filter((archivo) => archivo.tipo === 'imagen' && archivo.archivo_url && !removedImageIds.includes(archivo.id));
  const removedImageItems = (evidencia?.archivos || []).filter((archivo) => archivo.tipo === 'imagen' && archivo.archivo_url && removedImageIds.includes(archivo.id));
  const imagenes = (evidencia?.archivos || []).filter((archivo) => archivo.tipo === 'imagen' && archivo.archivo_url);
  const links = (evidencia?.archivos || []).filter((archivo) => archivo.tipo === 'link' && archivo.url);

  return (
    <section className="flex flex-col gap-4 w-full pb-8">
      <Dialog
        open={showDeleteDialog}
        type="danger"
        title="Eliminar evidencia"
        message="¿Eliminar esta evidencia? Esta acción actualizará el estado de la actividad."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />

      {/* Actividad Context Card */}
      {actividad && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 p-3 rounded-r-lg dark:from-slate-900/35 dark:to-slate-900/55">
          <div className="text-xs text-gray-600 dark:text-gray-400">Actividad:</div>
          <div className="text-base font-semibold text-blue-900 dark:text-blue-200">{actividad.codigo} - {actividad.nombre}</div>
        </div>
      )}

      {actividad && canEdit && !canEditEvidence && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          La carga de evidencias se habilita cuando el documento esta en ejecucion.
        </div>
      )}

      {/* Form Section (centred small card) */}
      {!evidencia && !editMode ? (
        <div className="flex justify-center">
          <div className="w-full max-w-xl">
            <div className="rounded-2xl p-6 text-center bg-white/80 border border-slate-200 shadow-lg dark:bg-slate-900/55 dark:border-slate-700">
              <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Sin evidencia registrada</h2>
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Aún no tiene cargada la evidencia.</p>
              <div className="mb-4 text-sm text-slate-700 dark:text-slate-300">
                Al cargar evidencia, la actividad se marcará como <span className="font-semibold">completada</span> para incluirla en el reporte final de evidencias.
              </div>
              {canEditEvidence && (
                <div className="flex justify-center">
                  <button type="button" onClick={handleStartEdit} className="px-4 py-2 rounded-md bg-gradient-to-r from-green-500 to-emerald-600 text-white">Cargar evidencia</button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : showForm && (
        <div className="flex justify-center">
          <div className="w-full max-w-5xl">
            <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-4 sm:p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900/55" onPaste={onPaste}>
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-white">{isEditingExisting ? 'Editar Evidencia' : 'Registrar Evidencia'}</h2>

              <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)] items-start">
                <div className="space-y-4 min-w-0">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Resultados logrados</label>
                    <textarea
                      placeholder="los resultados logrados en esta actividad son..."
                      className={poaTextAreaClass}
                      value={formData.resultados_logrados}
                      onChange={(e) => handleFormChange('resultados_logrados', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[110px_110px_160px] gap-3 items-end">
                    <div className="min-w-0">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">Programado</label>
                      <select className={poaCompactFieldClass} value={formData.programado} onChange={(e) => handleFormChange('programado', Number(e.target.value))}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">Ejecutado</label>
                      <select className={poaCompactFieldClass} value={formData.ejecutado} onChange={(e) => handleFormChange('ejecutado', Number(e.target.value))}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 block">Grado de cumplimiento (%)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        className={`${poaCompactFieldClass} w-full`}
                        placeholder="numero"
                        value={formData.grado_cumplimiento}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '');
                          handleFormChange('grado_cumplimiento', digitsOnly);
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 block">Medios (links)</label>
                      <button
                        type="button"
                        onClick={addLinkItem}
                        className="text-xs font-semibold text-green-600 hover:text-green-700"
                      >
                        Agregar enlace
                      </button>
                    </div>
                    <div className="space-y-2">
                      {linkItems.map((item, index) => (
                        <div key={item.id} className="flex gap-2">
                          <input
                            type="url"
                            className={poaFieldClass}
                            placeholder={`https://ejemplo.com/enlace-${index + 1}`}
                            value={item.url}
                            onChange={(e) => updateLinkItem(item.id, e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeLinkItem(item.id)}
                            className="px-3 py-2 text-xs rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Puedes editar los enlaces existentes o eliminarlos antes de guardar.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 min-w-0 xl:sticky xl:top-4 xl:self-start">
                  <div className="rounded-xl border border-dashed border-green-400/70 bg-green-50/30 dark:bg-green-900/10 p-3 sm:p-4">
                    <div
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      onPaste={onPaste}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={onDrop}
                      tabIndex={0}
                      className="mb-4 flex min-h-40 items-center justify-center flex-col gap-3 rounded-lg border-2 border-dashed border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/10 cursor-pointer px-3 py-4 sm:px-4 sm:py-5 text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <div className="text-4xl">🖼️</div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 max-w-sm">Pega aquí tus imágenes (Ctrl+V), arrástralas o haz click para seleccionar</div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          fileInputRef.current && fileInputRef.current.click();
                        }}
                        className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition"
                      >
                        Seleccionar imágenes
                      </button>
                      <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={onFileChange} className="hidden" />
                    </div>

                    {pendingPreviewItems.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            Imágenes listas para guardar ({pendingPreviewItems.length})
                          </h3>
                          <button
                            type="button"
                            onClick={clearPendingFiles}
                            className="text-xs font-semibold text-red-600 hover:text-red-700"
                          >
                            Limpiar todo
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                          {pendingPreviewItems.map((item) => (
                            <div key={item.id} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                              <img src={item.previewUrl} alt={item.file.name} className="h-20 sm:h-24 w-full object-cover" />
                              <div className="p-2">
                                <div className="truncate text-[11px] text-gray-600 dark:text-gray-400">{item.file.name}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removePendingFile(item.id)}
                                className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white opacity-90 group-hover:opacity-100"
                              >
                                X
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {editMode && evidencia?.archivos?.some((archivo) => archivo.tipo === 'imagen' && archivo.archivo_url) && (
                      <div className="mb-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            Imágenes guardadas ({existingImageItems.length} activas{removedImageItems.length > 0 ? `, ${removedImageItems.length} marcadas para eliminar` : ''})
                          </h3>
                        </div>
                        {existingImageItems.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                            {existingImageItems.map((archivo) => (
                              <div key={archivo.id} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                                <img src={archivo.archivo_url} alt={`Imagen guardada ${archivo.id}`} className="h-20 sm:h-24 w-full object-cover" />
                                <div className="p-2 flex items-center justify-between gap-2">
                                  <div className="truncate text-[11px] text-gray-600 dark:text-gray-400">Guardada</div>
                                  <button
                                    type="button"
                                    onClick={() => markImageForRemoval(archivo.id)}
                                    className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
                                  >
                                    X
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 sm:p-4 text-sm text-gray-500 dark:text-gray-400">
                            No quedan imágenes activas. Si cambias de idea, puedes volver a cargar nuevas antes de guardar.
                          </div>
                        )}

                        {removedImageItems.length > 0 && (
                          <div className="mt-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-2">Marcadas para eliminar</div>
                            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                              {removedImageItems.map((archivo) => (
                                <div key={archivo.id} className="group relative overflow-hidden rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20 opacity-75">
                                  <img src={archivo.archivo_url} alt={`Imagen marcada ${archivo.id}`} className="h-20 sm:h-24 w-full object-cover grayscale" />
                                  <div className="p-2 flex items-center justify-between gap-2">
                                    <div className="truncate text-[11px] text-red-700 dark:text-red-300">Se eliminará al guardar</div>
                                    <button
                                      type="button"
                                      onClick={() => unmarkImageRemoval(archivo.id)}
                                      className="rounded-md border border-green-300 px-2 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300"
                                    >
                                      Deshacer
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={handleEditCancel}
                  className={poaCancelButtonClass}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className={poaSaveButtonClass}>
                  {submitting ? 'Guardando...' : (isEditingExisting ? 'Actualizar' : 'Guardar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidencia Display (si existe y no en editMode) */}
      {evidencia && !editMode && (
        <div className={`overflow-hidden rounded-3xl ${pageCardClass}`}>
          <div className="border-b border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 px-5 py-4 dark:border-emerald-500/20 dark:from-emerald-500/20 dark:via-teal-500/10 dark:to-cyan-500/10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-2xl dark:bg-emerald-500/20">
                  ✅
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Evidencia registrada</h3>
                  <p className="mt-1 text-sm truncate text-slate-600 dark:text-slate-300">
                    {actividad?.codigo} - {actividad?.nombre}
                  </p>
                </div>
                {canEditEvidence && (
                  <div className="flex sm:hidden items-center gap-2 ml-3">
                    <button onClick={handleStartEdit} className="p-2 rounded-md bg-blue-500 text-white">
                      <FaEdit size={14} />
                    </button>
                    <button onClick={handleOpenDeleteDialog} className="p-2 rounded-md bg-red-500 text-white">
                      <FaTrash size={14} />
                    </button>
                  </div>
                )}
              </div>
              {canEditEvidence && (
                <div className="hidden sm:flex flex-wrap gap-2">
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-600"
                  >
                    <FaEdit size={15} />
                    Editar
                  </button>
                  <button
                    onClick={handleOpenDeleteDialog}
                    className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                  >
                    <FaTrash size={15} />
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 lg:p-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
              <div className="space-y-6">
                <div className="poa-mobile-kpi-strip poa-mobile-kpi-strip-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="poa-mobile-kpi-card rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4 dark:border-blue-500/20 dark:from-blue-500/10 dark:to-blue-950/40">
                    <div className="poa-kpi-label text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Programado</div>
                    <div className="poa-kpi-value mt-2 text-3xl sm:text-4xl font-bold leading-none text-blue-900 dark:text-blue-100">{evidencia.programado}</div>
                    <div className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">planificada</div>
                  </div>

                  <div className="poa-mobile-kpi-card rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-emerald-950/40">
                    <div className="poa-kpi-label text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Ejecutado</div>
                    <div className="poa-kpi-value mt-2 text-3xl sm:text-4xl font-bold leading-none text-emerald-900 dark:text-emerald-100">{evidencia.ejecutado}</div>
                    <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-200/80">completada</div>
                  </div>

                  <div className="poa-mobile-kpi-card rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 p-4 dark:border-purple-500/20 dark:from-purple-500/10 dark:to-purple-950/40">
                    <div className="poa-kpi-label text-[11px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">Cumplimiento</div>
                    <div className="poa-kpi-value mt-2 text-3xl sm:text-4xl font-bold leading-none text-purple-900 dark:text-purple-100">{evidencia.grado_cumplimiento}%</div>
                    <div className="mt-3 h-1.5 sm:h-2 overflow-hidden rounded-full bg-purple-200 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-500"
                        style={{ width: `${Math.min(evidencia.grado_cumplimiento, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className={infoCardClass}>
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <span className="text-lg">📝</span>
                    Resultados logrados
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm sm:text-base leading-6 sm:leading-7 text-slate-700 dark:text-slate-200">
                    {evidencia.resultados_logrados}
                  </p>
                </div>


                {/* Medios de verificación para pantallas pequeñas: aparece debajo de resultados */}
                {links.length > 0 && (
                  <div className="mt-4 block">
                    <div className={mediaCardClass}>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <FaLink size={16} className="text-sky-300" />
                        Medios de verificación ({links.length})
                      </h4>
                      <div className="space-y-2">
                        {links.map((link, idx) => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-sky-500/40 dark:hover:bg-slate-950/70"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">
                              🔗
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Enlace {idx + 1}</div>
                              <div className="truncate text-sm text-sky-700 dark:text-sky-300">{new URL(link.url).hostname || link.url}</div>
                            </div>
                            <FaFileDownload size={13} className="shrink-0 text-sky-300/80" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className={chipCardClass + ' flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'}>
                  <div>
                    📅 Registrada: <span className="font-semibold text-slate-900 dark:text-slate-100">{new Date(evidencia.creado_en).toLocaleString()}</span>
                  </div>
                  <div className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Estado: Completada
                  </div>
                </div>
              </div>

              <div className="space-y-6 xl:sticky xl:top-4 xl:self-start">
                {imagenes.length > 0 ? (
                  <div className={mediaCardClass}>
                    <div className="flex items-center justify-between border-b border-cyan-200 px-4 py-3 dark:border-cyan-500/10">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <span className="text-lg">🖼️</span>
                        Evidencia visual
                      </h4>
                      {imagenes.length > 1 && (
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {carouselIndex + 1} / {imagenes.length}
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <div className="group relative flex h-[clamp(12rem,26vw,20rem)] sm:h-[clamp(14rem,28vw,22rem)] items-center justify-center overflow-hidden rounded-xl bg-slate-50 p-2 dark:bg-slate-950/40">
                        <img
                          src={imagenes[carouselIndex].archivo_url}
                          alt={`Evidencia ${carouselIndex + 1}`}
                          className="block h-full w-full object-contain"
                        />

                        {imagenes.length > 1 && (
                          <>
                            <button
                              onClick={prevImage}
                              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white opacity-0 transition hover:bg-black/80 group-hover:opacity-100"
                            >
                              <FaChevronLeft size={16} />
                            </button>
                            <button
                              onClick={nextImage}
                              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white opacity-0 transition hover:bg-black/80 group-hover:opacity-100"
                            >
                              <FaChevronRight size={16} />
                            </button>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                              {carouselIndex + 1} / {imagenes.length}
                            </div>
                          </>
                        )}
                      </div>

                      {imagenes.length > 1 && (
                              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                                {imagenes.map((img, idx) => (
                                  <button
                                    key={img.id}
                                    onClick={() => setCarouselIndex(idx)}
                                    className={`flex-shrink-0 overflow-hidden rounded-lg transition-all ${
                                      idx === carouselIndex ? 'ring-2 ring-cyan-400 scale-105' : 'opacity-65 hover:opacity-100'
                                    }`}
                                  >
                                    <img
                                      src={img.archivo_url}
                                      alt={`Thumbnail ${idx + 1}`}
                                      className="h-12 w-12 object-cover sm:h-14 sm:w-14"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                    No hay imágenes cargadas para esta evidencia.
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default EvidenciaPage;
