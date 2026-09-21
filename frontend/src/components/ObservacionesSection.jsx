import { useState, useEffect } from 'react';
import { getObservacionesPorFondo, agregarMensajeObservacion } from '../api';
import toast from 'react-hot-toast';

function ObservacionesSection({ fondoId, estadoFondo, usuarioActual }) {
  const [observaciones, setObservaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [respondiendo, setRespondiendo] = useState(null);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    cargarObservaciones();
  }, [fondoId]);

  const cargarObservaciones = async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) {
        setLoading(true);
      }
      const response = await getObservacionesPorFondo(fondoId);
      setObservaciones(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error al cargar observaciones:', err);
    } finally {
      if (!silencioso) {
        setLoading(false);
      }
    }
  };

  const handleAgregarMensaje = async (observacionId) => {
    if (!mensajeTexto.trim()) {
      toast.error('El mensaje no puede estar vacío');
      return;
    }

    try {
      setEnviando(true);
      await agregarMensajeObservacion(observacionId, mensajeTexto);
      toast.success('Mensaje enviado');
      setRespondiendo(null);
      setMensajeTexto('');
      await cargarObservaciones({ silencioso: true });
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      toast.error(err.response?.data?.error || 'Error al enviar mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearFechaCorta = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return null;
  }

  const pendientes = observaciones.filter(obs => !obs.resuelta);
  const resueltas = observaciones.filter(obs => obs.resuelta);
  const esAdmin = usuarioActual?.is_staff;
  const puedeResponder = estadoFondo === 'observado' || esAdmin;

  // Si no hay observaciones, no mostrar nada
  if (observaciones.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      
      {/* Banner urgente - Solo si hay pendientes */}
      {pendientes.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-400 dark:border-blue-600 rounded-xl p-5 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-2xl text-white">💬</span>
            </div>
            
            <div className="flex-1">
              <h3 className="text-xl font-bold text-blue-900 dark:text-blue-200 mb-2">
                {pendientes.length} Conversación{pendientes.length > 1 ? 'es' : ''} Activa{pendientes.length > 1 ? 's' : ''}
              </h3>
              
              {/* Lista de observaciones pendientes */}
              <div className="space-y-4">
                {pendientes.map((obs) => (
                  <div key={obs.id} className="bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-700 p-4 shadow-sm">
                    
                    {/* Chat de mensajes */}
                    <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                      {obs.mensajes && obs.mensajes.length > 0 ? (
                        obs.mensajes.map((mensaje) => (
                          <div
                            key={mensaje.id}
                            className={`flex ${mensaje.es_admin ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`max-w-[75%] ${mensaje.es_admin ? '' : 'flex flex-col items-end'}`}>
                              {/* Nombre y fecha */}
                              <div className="flex items-center gap-2 mb-1 px-1">
                                <span className={`text-xs font-semibold ${
                                  mensaje.es_admin 
                                    ? 'text-blue-700 dark:text-blue-400' 
                                    : 'text-green-700 dark:text-green-400'
                                }`}>
                                  {mensaje.autor_nombre}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {formatearFechaCorta(mensaje.fecha)}
                                </span>
                              </div>

                              {/* Burbuja del mensaje */}
                              <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                                mensaje.es_admin
                                  ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-tl-none'
                                  : 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-tr-none'
                              }`}>
                                <p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap break-words">
                                  {mensaje.texto}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-slate-500 dark:text-slate-400 text-sm py-4">
                          Sin mensajes aún
                        </div>
                      )}
                    </div>

                    {/* Formulario de respuesta */}
                    {puedeResponder && (
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        {respondiendo === obs.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={mensajeTexto}
                              onChange={(e) => setMensajeTexto(e.target.value)}
                              placeholder="Escribe tu mensaje..."
                              rows={3}
                              className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                              disabled={enviando}
                            />
                            <div className="flex gap-2 justify-between">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAgregarMensaje(obs.id)}
                                  disabled={enviando}
                                  className="px-4 py-2 rounded-lg font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-all text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {enviando ? '⏳ Enviando...' : '📤 Enviar'}
                                </button>
                                <button
                                  onClick={() => {
                                    setRespondiendo(null);
                                    setMensajeTexto('');
                                  }}
                                  disabled={enviando}
                                  className="px-4 py-2 rounded-lg font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all text-sm disabled:opacity-50"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-between">
                            <button
                              onClick={() => setRespondiendo(obs.id)}
                              className="px-4 py-2 rounded-lg font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-all text-sm flex items-center gap-2 shadow-sm"
                            >
                              <span>💬</span> Responder
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accordion - Historial de observaciones resueltas */}
      {resueltas.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <button
            onClick={() => setMostrarHistorial(!mostrarHistorial)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{mostrarHistorial ? '▼' : '▶'}</span>
              <span className="font-bold text-slate-800 dark:text-white">
                📜 Historial de Conversaciones
              </span>
              <span className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold">
                {resueltas.length} resuelta{resueltas.length > 1 ? 's' : ''}
              </span>
            </div>
          </button>

          {/* Contenido colapsable */}
          {mostrarHistorial && (
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
              {resueltas.map((obs, index) => (
                <div key={obs.id} className="relative">
                  {/* Línea vertical */}
                  {index < resueltas.length - 1 && (
                    <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
                  )}

                  {/* Conversación */}
                  <div className="relative">
                    <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center border-2 border-green-500">
                      <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                    </div>

                    <div className="ml-12">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-bold text-slate-800 dark:text-white text-sm">
                          Resuelta por {obs.resuelta_por_nombre}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatearFecha(obs.fecha_resolucion)}
                        </span>
                      </div>

                      {/* Chat de mensajes */}
                      <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg p-3 space-y-2">
                        {obs.mensajes && obs.mensajes.map((mensaje) => (
                          <div key={mensaje.id} className={`flex ${mensaje.es_admin ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[75%] ${mensaje.es_admin ? '' : 'flex flex-col items-end'}`}>
                              <div className="flex items-center gap-2 mb-1 px-1">
                                <span className={`text-xs font-semibold ${
                                  mensaje.es_admin 
                                    ? 'text-blue-700 dark:text-blue-400' 
                                    : 'text-green-700 dark:text-green-400'
                                }`}>
                                  {mensaje.autor_nombre}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {formatearFechaCorta(mensaje.fecha)}
                                </span>
                              </div>
                              <div className={`rounded-2xl px-3 py-2 text-xs ${
                                mensaje.es_admin
                                  ? 'bg-blue-100 dark:bg-blue-900/40 rounded-tl-none'
                                  : 'bg-green-100 dark:bg-green-900/40 rounded-tr-none'
                              }`}>
                                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                                  {mensaje.texto}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ObservacionesSection;
