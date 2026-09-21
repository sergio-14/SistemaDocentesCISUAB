import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

const FullscreenPDFViewer = ({ isOpen, onClose, pdfUrl, downloadFileName = 'documento.pdf', showPrint = true, title = 'Vista Previa PDF' }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !pdfUrl) return undefined;
    let active = true;
    let objectUrl = null;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('access_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const urlWithParam = `${pdfUrl}${pdfUrl.includes('?') ? '&' : '?'}view=true`;
        const res = await fetch(urlWithParam, { headers });
        if (!res.ok) {
          if (res.status === 401) throw new Error('No autorizado. Su sesión puede haber expirado.');
          throw new Error('Error al cargar el PDF.');
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) setBlobUrl(objectUrl);
      } catch (err) {
        if (active) setError(err?.message || 'Error al cargar el PDF');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBlobUrl(null);
    };
  }, [isOpen, pdfUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const frame = iframeRef.current;
    const win = frame?.contentWindow;
    if (!win) {
      toast.error('Primero genere la vista previa para poder imprimir.');
      return;
    }
    win.focus();
    win.print();
  };

  const content = (
    <div className="fixed inset-0 z-[240] flex items-center justify-center p-2">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full h-full max-w-none bg-transparent flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 z-10 bg-slate-950/55 backdrop-blur-sm border-b border-white/10">
          <div className="text-white">
            <h4 className="text-lg font-bold">{title}</h4>
          </div>
          <div className="flex items-center gap-2">
            {showPrint && (
              <button onClick={handlePrint} className="px-3 py-2 rounded-md bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 hover:shadow-emerald-500/40 transition-colors">
                Imprimir
              </button>
            )}
            {blobUrl && (
              <a href={blobUrl} download={downloadFileName} className="px-3 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-500/25 hover:bg-amber-400 hover:shadow-amber-500/40 transition-colors">
                Descargar
              </a>
            )}
            <button onClick={onClose} className="px-3 py-2 rounded-md bg-rose-500 text-white font-semibold shadow-lg shadow-rose-500/25 hover:bg-rose-400 hover:shadow-rose-500/40 transition-colors">Cerrar</button>
          </div>
        </div>

        <div className="flex-1 relative z-0">
          {loading && (
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-white/80 mr-4" />
              <span>Generando vista previa...</span>
            </div>
          )}

          {error && (
            <div className="w-full h-full flex items-center justify-center text-red-300">{error}</div>
          )}

          {!loading && !error && blobUrl && (
            <iframe
              ref={iframeRef}
              src={`${blobUrl}#view=FitH&zoom=page-width`}
              title={title}
              className="w-full h-full"
              style={{ border: 'none', background: 'white' }}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default FullscreenPDFViewer;
