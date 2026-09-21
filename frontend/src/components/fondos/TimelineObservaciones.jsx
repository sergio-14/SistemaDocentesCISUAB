import { useEffect, useMemo, useState } from 'react';
import { getObservacionesPorFondo } from '../../apis/api';
import toast from 'react-hot-toast';

function TimelineObservaciones({ fondoId }) {
  const [observaciones, setObservaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarObservaciones();
  }, [fondoId]);

  const cargarObservaciones = async () => {
    if (!fondoId) return;

    try {
      setLoading(true);
      const response = await getObservacionesPorFondo(fondoId);
      setObservaciones(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error al cargar observaciones:', err);
      toast.error('Error al cargar observaciones');
    } finally {
      setLoading(false);
    }
  };

  const observacionesOrdenadas = useMemo(() => {
    return [...observaciones].sort(
      (a, b) => new Date(a.fecha_creacion) - new Date(b.fecha_creacion)
    );
  }, [observaciones]);

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Sin fecha';

    return new Date(fecha).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const obtenerMensajeInicial = (observacion) => {
    return observacion.mensajes?.[0] || observacion.ultimo_mensaje || null;
  };

  const obtenerAutorInicial = (observacion) => {
    const inicial = obtenerMensajeInicial(observacion);
    return inicial?.autor_nombre || inicial?.autor_username || 'Sin autor';
  };

  const obtenerMensajesOrdenados = (observacion) => {
    return [...(observacion.mensajes || [])].sort(
      (a, b) => new Date(a.fecha) - new Date(b.fecha)
    );
  };

  if (loading) {
    return (
      <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-orange-500 mx-auto"></div>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm">Cargando observaciones...</p>
        </div>
      </section>
    );
  }

  if (observacionesOrdenadas.length === 0) {
    return (
      <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="text-center py-4">
          <span className="text-3xl mb-3 block">!</span>
          <p className="text-slate-600 dark:text-slate-400">No hay observaciones registradas</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-red-600 px-5 py-3">
        <h2 className="text-lg font-bold text-white">Timeline de Observaciones</h2>
        <p className="text-xs text-orange-100 mt-1">
          Registro formal de observaciones y mensajes vinculados al fondo
        </p>
      </div>

      <div className="p-5">
        <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-6">
          {observacionesOrdenadas.map((observacion, index) => {
            const mensajes = obtenerMensajesOrdenados(observacion);
            const pendiente = !observacion.resuelta;

            return (
              <article key={observacion.id} className="relative pl-8">
                <span
                  className={`absolute -left-[0.72rem] top-1 w-5 h-5 rounded-full border-4 ${
                    pendiente
                      ? 'bg-orange-500 border-orange-100 dark:border-orange-900'
                      : 'bg-green-500 border-green-100 dark:border-green-900'
                  }`}
                />

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-800 dark:text-white">
                          Observacion #{index + 1}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            pendiente
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          }`}
                        >
                          {pendiente ? 'Pendiente' : 'Resuelta'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Creada por {obtenerAutorInicial(observacion)} el {formatearFecha(observacion.fecha_creacion)}
                      </p>
                    </div>

                    {observacion.resuelta && (
                      <div className="text-xs text-green-700 dark:text-green-300 sm:text-right">
                        <p className="font-semibold">Resuelta</p>
                        <p>{formatearFecha(observacion.fecha_resolucion)}</p>
                        {observacion.resuelta_por_nombre && <p>Por {observacion.resuelta_por_nombre}</p>}
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    {mensajes.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Este hilo no tiene mensajes registrados.
                      </p>
                    ) : (
                      mensajes.map((mensaje, mensajeIndex) => {
                        const esInicial = mensajeIndex === 0;

                        return (
                          <div
                            key={mensaje.id}
                            className={`rounded-lg border p-3 ${
                              esInicial
                                ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
                                : mensaje.es_admin
                                ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                                : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                                  {mensaje.autor_nombre || mensaje.autor_username || 'Usuario'}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {mensaje.es_admin ? 'Autoridad' : 'Docente'}
                                </span>
                                {esInicial && (
                                  <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                                    Observacion inicial
                                  </span>
                                )}
                              </div>
                              <time className="text-xs text-slate-500 dark:text-slate-400">
                                {formatearFecha(mensaje.fecha)}
                              </time>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                              {mensaje.texto}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default TimelineObservaciones;
