
import React, { useState, useEffect } from 'react';

const PDFPreviewModal = ({ isOpen, onClose, pdfUrl }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const loadPdf = async () => {
      if (!isOpen || !pdfUrl) return;

      setLoading(true);
      setError(null);
      
      try {
        // Obtener token para la petición autenticada
        const token = localStorage.getItem('access_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        // Añadir parámetro view=true
        const urlWithParam = `${pdfUrl}${pdfUrl.includes('?') ? '&' : '?'}view=true`;

        const response = await fetch(urlWithParam, { headers });
        
        if (!response.ok) {
            if (response.status === 401) throw new Error('No autorizado. Su sesión puede haber expirado.');
            throw new Error('Error al cargar el documento PDF.');
        }

        const blob = await response.blob();
        if (active) {
            const objectUrl = URL.createObjectURL(blob);
            setBlobUrl(objectUrl);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      active = false;
      if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          setBlobUrl(null);
      }
    };
  }, [isOpen, pdfUrl]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay fijo que cubre toda la pantalla */}
      <div 
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Contenedor de centrado */}
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[75vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-100 dark:bg-slate-900">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Vista Previa del Fondo de Tiempo
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Revise la información antes de descargar.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 bg-slate-100 relative flex items-center justify-center">
            {loading && (
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">Generando vista previa...</p>
                </div>
            )}
            
            {error && <div className="text-red-500 font-bold">{error}</div>}

            {!loading && !error && blobUrl && (
                <iframe src={blobUrl} className="w-full h-full" title="Vista Previa PDF" style={{ border: 'none' }} />
            )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold border border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 transition-all">Cancelar</button>
          {blobUrl && (
              <a href={blobUrl} download="Fondo_Tiempo.pdf" className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold shadow-lg hover:shadow-xl flex items-center gap-2 transition-all transform hover:scale-105">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" /></svg>
                Descargar PDF
              </a>
          )}
        </div>
      </div>
        </div>
    </>
  );
};

export default PDFPreviewModal;