import { useEffect, useState } from 'react';
import { X, Upload, Trash2, FileText, Image as ImageIcon, Paperclip, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getEvidenciasCargaHoraria,
  subirEvidenciaCargaHoraria,
  eliminarEvidenciaCargaHoraria,
} from '../apis/api';

const EXTENSIONES_ACEPTADAS = '.pdf,.jpg,.jpeg,.png,.docx';
const TAMANO_MAXIMO_MB = 10;

const iconoPorArchivo = (nombreArchivo = '') => {
  const ext = nombreArchivo.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png'].includes(ext)) return ImageIcon;
  return FileText;
};

const formatFecha = (isoString) => {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoString;
  }
};

export default function EvidenciaActividadModal({ open, onClose, cargaHorariaId, tituloActividad, puedeSubir = true }) {
  const [evidencias, setEvidencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);

  const cargarEvidencias = async () => {
    if (!cargaHorariaId) return;
    setLoading(true);
    try {
      const { data } = await getEvidenciasCargaHoraria(cargaHorariaId);
      setEvidencias(data.results || data || []);
    } catch (err) {
      toast.error('No se pudieron cargar las evidencias de esta actividad.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && cargaHorariaId) {
      cargarEvidencias();
      setArchivo(null);
      setDescripcion('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cargaHorariaId]);

  if (!open) return null;

  const handleSeleccionArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      toast.error(`El archivo supera el tamaño máximo de ${TAMANO_MAXIMO_MB}MB.`);
      e.target.value = '';
      return;
    }
    setArchivo(file);
  };

  const handleSubir = async () => {
    if (!archivo) {
      toast.error('Selecciona un archivo primero.');
      return;
    }
    setSubiendo(true);
    try {
      await subirEvidenciaCargaHoraria(cargaHorariaId, archivo, descripcion.trim());
      toast.success('Evidencia subida correctamente.');
      setArchivo(null);
      setDescripcion('');
      const fileInput = document.getElementById('evidencia-actividad-file-input');
      if (fileInput) fileInput.value = '';
      await cargarEvidencias();
    } catch (err) {
      const detalle = err.response?.data;
      const mensaje = typeof detalle === 'object'
        ? Object.values(detalle).flat().join(' ')
        : (detalle || 'No se pudo subir la evidencia.');
      toast.error(mensaje);
    } finally {
      setSubiendo(false);
    }
  };

  const handleEliminar = async (evidenciaId) => {
    setEliminandoId(evidenciaId);
    try {
      await eliminarEvidenciaCargaHoraria(evidenciaId);
      setEvidencias((actuales) => actuales.filter((ev) => ev.id !== evidenciaId));
      toast.success('Evidencia eliminada.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo eliminar la evidencia.');
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> Evidencias de la actividad
            </h3>
            {tituloActividad && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tituloActividad}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {puedeSubir && (
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
            <div>
              <label htmlFor="evidencia-actividad-file-input" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Archivo (PDF, JPG, PNG o DOCX, máx. {TAMANO_MAXIMO_MB}MB)
              </label>
              <input
                id="evidencia-actividad-file-input"
                type="file"
                accept={EXTENSIONES_ACEPTADAS}
                onChange={handleSeleccionArchivo}
                className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
              />
            </div>
            <div>
              <label htmlFor="evidencia-actividad-descripcion" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Descripción (opcional)
              </label>
              <input
                id="evidencia-actividad-descripcion"
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Lista de asistencia semana 3"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={255}
              />
            </div>
            <button
              type="button"
              onClick={handleSubir}
              disabled={!archivo || subiendo}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-600 transition-colors"
            >
              {subiendo ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Subir evidencia
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">Cargando evidencias...</p>
          ) : evidencias.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
              Todavía no hay evidencias adjuntas para esta actividad.
            </p>
          ) : (
            <ul className="space-y-2">
              {evidencias.map((ev) => {
                const Icono = iconoPorArchivo(ev.nombre_archivo);
                return (
                  <li
                    key={ev.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40"
                  >
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 shrink-0">
                      <Icono className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {ev.nombre_archivo || 'Archivo'}
                      </p>
                      {ev.descripcion && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{ev.descripcion}</p>
                      )}
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {ev.subido_por_nombre ? `${ev.subido_por_nombre} · ` : ''}{formatFecha(ev.fecha_subida)}
                      </p>
                    </div>
                    <a
                      href={ev.archivo}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30 rounded-lg transition-colors shrink-0"
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {puedeSubir && (
                      <button
                        type="button"
                        onClick={() => handleEliminar(ev.id)}
                        disabled={eliminandoId === ev.id}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
