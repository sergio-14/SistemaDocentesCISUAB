import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar, Download, FileText, Sparkles, TrendingUp, Layers3 } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { API_BASE, descargarSeguimientoGeneralExcelPOA, getDocumentosPOAPorGestion } from '../../../apis/poa.api';
import GestionSelectorModal from '../components/GestionSelectorModal';
import FullscreenPDFViewer from '../../../components/FullscreenPDFViewer';

const getProgramaLabel = (doc) => {
  const programa = doc?.programa;
  if (programa && typeof programa === 'object') {
    return programa.nombre || programa.codigo || `Programa #${programa.id}`;
  }
  return String(programa || '').trim();
};

const getCareerIdFromUser = (user) => {
  const value = user?.perfil?.carrera;
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : String(value);
};

const matchesCareer = (doc, careerId) => {
  if (careerId === null || careerId === undefined || careerId === '') return true;
  const docCareer = doc?.unidad_solicitante_detalle?.id ?? doc?.unidad_solicitante?.id ?? doc?.unidad_solicitante;
  if (docCareer === undefined || docCareer === null || docCareer === '') return false;
  return String(docCareer) === String(careerId);
};

const Reportes = () => {
  const outletContext = useOutletContext() || {};
  const currentUser = outletContext.user || null;
  const poaRoles = Array.isArray(outletContext.poaRoles) ? outletContext.poaRoles : [];
  const canCreateDocument = Boolean(outletContext.poaPermissions?.canEdit);
  const currentYear = new Date().getFullYear();
  const careerId = getCareerIdFromUser(currentUser);

  const [gestion, setGestion] = useState(String(currentYear));
  const [showGestionModal, setShowGestionModal] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedDocumentoId, setSelectedDocumentoId] = useState('');
  const [selectedSeguimientoId, setSelectedSeguimientoId] = useState('');
  const [error, setError] = useState(null);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('Vista Previa PDF');
  const [pdfDownloadFileName, setPdfDownloadFileName] = useState('reporte.pdf');
  const [activeSection, setActiveSection] = useState('general');
  const skipNextDocumentsFetchRef = useRef(null);

  const gestionValida = /^[0-9]{4}$/.test(String(gestion).trim());

  

  useEffect(() => {
    const year = String(gestion).trim();
    if (!gestionValida) {
      setDocuments([]);
      return;
    }
    if (skipNextDocumentsFetchRef.current === year) {
      skipNextDocumentsFetchRef.current = null;
      return;
    }

    let active = true;
    setDocumentsLoading(true);
    setError(null);

    getDocumentosPOAPorGestion(Number(year))
      .then((res) => {
        if (!active) return;
        const raw = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.documentos || []);
        const list = raw.filter((item) => item && item.id && matchesCareer(item, careerId));
        setDocuments(list);
      })
      .catch((err) => {
        if (!active) return;
        setDocuments([]);
        setError(err?.response?.data?.detail || err?.message || 'No se pudieron cargar los documentos de la gestión.');
      })
      .finally(() => {
        if (active) setDocumentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [gestion, gestionValida, careerId]);

  useEffect(() => {
    return () => {
      setShowPdfPreviewModal(false);
      setPdfPreviewUrl('');
    };
  }, []);

  const resumen = useMemo(() => {
    const list = Array.isArray(documents) ? documents : [];
    const programas = new Set(list.map((doc) => String(getProgramaLabel(doc)).trim()).filter(Boolean)).size;
    return {
      total: list.length,
      programas,
      gestion,
    };
  }, [documents, gestion]);

  const handleGestionSuccess = ({ gestion: gestionSeleccionada, documentos: documentosSeleccionados }) => {
    const nextGestion = String(gestionSeleccionada || new Date().getFullYear());
    const rawDocs = Array.isArray(documentosSeleccionados) ? documentosSeleccionados : [];
    const filteredDocs = rawDocs.filter((doc) => doc && doc.id && matchesCareer(doc, careerId));
    skipNextDocumentsFetchRef.current = nextGestion;
    setGestion(nextGestion);
    setDocuments(filteredDocs);
    setSelectedDocumentoId(filteredDocs[0]?.id ? String(filteredDocs[0].id) : '');
    setSelectedSeguimientoId(filteredDocs[0]?.id ? String(filteredDocs[0].id) : '');
    setError(null);
    setShowGestionModal(false);
    setActiveSection('general');
  };

  const handleCambiarGestion = () => {
    setShowGestionModal(true);
  };

  const openPdfViewer = ({ url, title, fileName, section }) => {
    setActiveSection(section);
    setPdfPreviewUrl(url);
    setPdfPreviewTitle(title);
    setPdfDownloadFileName(fileName);
    setShowPdfPreviewModal(true);
  };

  const openGeneralPreview = () => {
    if (!gestionValida) {
      toast.error('Ingrese una gestión válida de 4 dígitos.');
      return;
    }

    openPdfViewer({
      section: 'general',
      title: `Reporte general POA - Gestión ${gestion}`,
      fileName: `reporte_documentos_${gestion}.pdf`,
      url: `${API_BASE}/api/reportes/generar-reporte-general/?gestion=${gestion}`,
    });
  };

  const openDocumentoPreview = (doc) => {
    if (!doc?.id || !gestionValida) return;
    const programa = getProgramaLabel(doc) || `Documento POA #${doc.id}`;
    setSelectedDocumentoId(String(doc.id));
    openPdfViewer({
      section: 'documentos',
      title: programa,
      fileName: `documento_poa_${doc.id}_${gestion}.pdf`,
      url: `${API_BASE}/api/poa/documentos_poa/${doc.id}/pdf-oficial/?gestion=${gestion}`,
    });
  };

  const openSeguimientoPreview = (doc) => {
    if (!doc?.id || !gestionValida) return;
    const programa = getProgramaLabel(doc) || `Documento POA #${doc.id}`;
    setSelectedSeguimientoId(String(doc.id));
    openPdfViewer({
      section: 'seguimiento',
      title: `Informe de seguimiento - ${programa} · Gestión ${gestion}`,
      fileName: `seguimiento_poa_${doc.id}_${gestion}.pdf`,
      url: `${API_BASE}/api/poa/reportes/seguimiento-institucional/?gestion=${gestion}&documento=${doc.id}&formato=pdf`,
    });
    toast('Se abrió el documento asociado al seguimiento del programa seleccionado.', { icon: 'ℹ️' });
  };

  const descargarSeguimientoGeneralExcel = async () => {
    if (!gestionValida) return toast.error('Ingrese una gestión válida.');
    try {
      const res = await descargarSeguimientoGeneralExcelPOA(gestion);
      const url = URL.createObjectURL(res.data); const link = document.createElement('a'); link.href = url;
      link.download = `informe_general_seguimiento_poa_${gestion}.xlsx`; link.click(); URL.revokeObjectURL(url);
      toast.success('Excel general de seguimiento generado con todos los programas de la gestión.');
    } catch (err) { toast.error(err?.response?.data?.detail || 'No se pudo generar el informe de seguimiento.'); }
  };

  const openSeguimientoInstitucionalPreview = () => {
    if (!gestionValida) return toast.error('Ingrese una gestión válida.');
    openPdfViewer({
      section: 'seguimiento',
      title: `Informe institucional de seguimiento - Gestión ${gestion}`,
      fileName: `informe_seguimiento_poa_${gestion}.pdf`,
      url: `${API_BASE}/api/poa/reportes/seguimiento-institucional/?gestion=${gestion}&formato=pdf`,
    });
  };

  return (
    <section className="flex flex-col items-start justify-start flex-1 pb-6 px-3 md:px-6 py-4 w-full">
      {showGestionModal && (
        <GestionSelectorModal
          currentUser={currentUser}
          poaRoles={poaRoles}
          canCreateDocument={canCreateDocument}
          onClose={() => setShowGestionModal(false)}
          onSuccess={handleGestionSuccess}
        />
      )}

      <div className="w-full max-w-[1500px] mx-auto">
        <div className="poa-mobile-page-card rounded-2xl border border-blue-200/80 bg-white/75 backdrop-blur-sm p-4 md:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/55">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] font-bold text-blue-700 dark:text-sky-300">
                <Sparkles size={14} /> Reportes POA
              </p>
              <h2 className="text-2xl md:text-4xl font-extrabold text-blue-900 dark:text-slate-100 leading-tight">
                Visualiza y exporta los reportes de tu carrera
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
                Esta vista organiza tres secciones claras para la gestión seleccionada: reporte general, documentos y seguimiento.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
              <div className="poa-mobile-kpi-card rounded-2xl border border-white/15 bg-gradient-to-br from-blue-600 to-sky-700 text-white px-4 py-3 min-w-[190px] shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.18em] text-sky-100/80 font-bold">Gestión activa</p>
                <p className="text-xl font-black mt-1">{gestion}</p>
              </div>
              <button
                type="button"
                onClick={handleCambiarGestion}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow hover:bg-slate-800 transition"
              >
                <Calendar size={16} /> Cambiar gestión
              </button>
            </div>
          </div>

        </div>

        {documentsLoading && <div className="mt-4 text-blue-800 dark:text-slate-200">Cargando documentos...</div>}
        {error && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {String(error)}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 items-stretch">
          <div className="poa-mobile-report-card rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50 p-4 shadow-sm h-full dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-sky-300">Sección general</p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">PDF general</h3>
              </div>
              <div className="poa-mobile-report-icon rounded-xl bg-blue-600 text-white p-3">
                <Download size={18} />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Visualiza en un solo PDF todos los documentos de la gestión seleccionada correspondientes a la carrera del usuario.
            </p>
            <button
              type="button"
              onClick={openGeneralPreview}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow hover:bg-blue-600 transition"
            >
              <Download size={16} /> Ver reporte general
            </button>
          </div>

          <div className="poa-mobile-report-card rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 p-4 shadow-sm h-full dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-sky-300">Sección documentos</p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">Documentos de la gestión</h3>
              </div>
              <div className="poa-mobile-report-icon rounded-xl bg-cyan-600 text-white p-3">
                <FileText size={18} />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Aquí se muestran todos los documentos de la gestión seleccionada. Cada tarjeta permite revisar su PDF oficial antes de imprimirlo o descargarlo.
            </p>

            <div className="mt-4 space-y-3">
              <select
                value={selectedDocumentoId}
                onChange={(e) => setSelectedDocumentoId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="">Seleccionar documento</option>
                {documents.map((doc) => {
                  const programa = getProgramaLabel(doc) || 'Sin programa';
                  return (
                    <option key={doc.id} value={String(doc.id)}>
                      {programa}
                    </option>
                  );
                })}
              </select>

              <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600 leading-relaxed dark:border-slate-700 dark:bg-slate-950/35 dark:text-slate-300">
                Selecciona un programa para abrir su PDF oficial. El nombre que aparece corresponde al documento de la gestión activa.
              </div>

              <button
                type="button"
                onClick={() => {
                  const doc = documents.find((item) => String(item.id) === String(selectedDocumentoId));
                  if (!doc) {
                    toast.error('Seleccione un documento de la lista.');
                    return;
                  }
                  openDocumentoPreview(doc);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white shadow hover:bg-cyan-600 transition"
              >
                <Download size={16} /> Ver PDF del programa
              </button>
            </div>
          </div>

          <div className="poa-mobile-report-card rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-4 shadow-sm h-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-300">Sección seguimiento</p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">Seguimiento por programa</h3>
              </div>
              <div className="poa-mobile-report-icon rounded-xl bg-amber-600 text-white p-3">
                <TrendingUp size={18} />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Genera el seguimiento real del programa seleccionado: avance físico, resultados, presupuesto y evidencias de la gestión activa.
            </p>

            <div className="mt-4 space-y-3">
              <select
                value={selectedSeguimientoId}
                onChange={(e) => setSelectedSeguimientoId(e.target.value)}
                className="w-full rounded-xl border border-amber-200 dark:border-slate-700 bg-white/90 dark:bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15"
              >
                <option value="">Seleccionar documento</option>
                {documents.map((doc) => {
                  const programa = getProgramaLabel(doc) || 'Sin programa';
                  return (
                    <option key={doc.id} value={String(doc.id)}>
                      {programa}
                    </option>
                  );
                })}
              </select>

              <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600 leading-relaxed dark:border-slate-700 dark:bg-slate-950/35 dark:text-slate-300">
                El seguimiento se organiza por programa y gestión. Seleccione el programa para incluir únicamente sus actividades y evidencias.
              </div>

              <button
                type="button"
                onClick={() => {
                  const doc = documents.find((item) => String(item.id) === String(selectedSeguimientoId));
                  if (!doc) {
                    toast.error('Seleccione un documento para seguimiento.');
                    return;
                  }
                  openSeguimientoPreview(doc);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-amber-500 transition"
              >
                <TrendingUp size={16} /> Ver seguimiento
              </button>
              <div className="border-t border-amber-200 pt-3 dark:border-slate-700">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">El Excel general reúne todos los programas de la gestión y organiza cada programa en una pestaña independiente.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={descargarSeguimientoGeneralExcel} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600">Excel general de seguimiento</button>
                  <button type="button" onClick={openSeguimientoInstitucionalPreview} className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-600">Ver PDF ejecutivo</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <FullscreenPDFViewer
          isOpen={showPdfPreviewModal}
          onClose={() => {
            setShowPdfPreviewModal(false);
            setPdfPreviewUrl('');
          }}
          pdfUrl={pdfPreviewUrl}
          downloadFileName={pdfDownloadFileName}
          showPrint={true}
          title={pdfPreviewTitle}
        />
      </div>
    </section>
  );
};

export default Reportes;
