import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { obtenerTodos } from '../apis/api';
import toast from 'react-hot-toast';
import { puedeCrearFondoTiempo } from '../utils/fondoTiempoPermissions';
import { ETIQUETAS_DEDICACION } from '../utils/dedicaciones';
import { useActiveRole } from '../contexts/activeRole';
import { BLOQUE, BOTON, estadoVisibleFondo } from './fondos/estilosFondo';
import { Avatar, BarraProgreso, EstadoPill, Etiqueta } from './fondos/ElementosFondo';

const ETIQUETAS_CATEGORIA = { catedratico: 'Catedrático', adjunto: 'Adjunto', asistente: 'Asistente' };

// --- ICONOS ---
const PlusIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const ArrowLeftIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
);

const FondoTiempoDocente = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [docente, setDocente] = useState(null);
    const [fondos, setFondos] = useState([]);
    const [loading, setLoading] = useState(true);
    // Usuario con su rol activo (contexto de rol).
    const { effectiveUser: user } = useActiveRole();
    const [calendarioActivo, setCalendarioActivo] = useState(null);

    useEffect(() => {
        let cancelado = false;

        const fetchData = async () => {
            try {
                setLoading(true);
                setDocente(null);
                setFondos([]);
                setCalendarioActivo(null);

                const docenteRes = await api.get(`/docentes/${id}/`);

                if (cancelado) return;

                const docenteData = docenteRes.data;
                const carreraId = docenteData?.vinculos?.find((vinculo) => vinculo?.activo)?.carrera
                    || docenteData?.vinculos?.[0]?.carrera;

                let calendarioData = null;
                if (carreraId) {
                    try {
                        const calendarioRes = await api.get('/calendarios/activo/', {
                            params: { carrera: carreraId },
                        });
                        calendarioData = calendarioRes.data || null;
                    } catch (calendarioError) {
                        if (calendarioError.response?.status !== 404) {
                            throw calendarioError;
                        }
                    }
                }

                if (cancelado) return;

                const fondosParams = calendarioData?.gestion
                    ? { docente: id, gestion: calendarioData.gestion }
                    : { docente: id };
                const fondosLista = await obtenerTodos('/fondos-tiempo/', fondosParams);

                if (cancelado) return;

                setDocente(docenteData);
                setCalendarioActivo(calendarioData);
                setFondos(fondosLista);
            } catch (error) {
                if (cancelado) return;
                console.error("Error al cargar datos:", error);
                toast.error("Error al cargar la información del docente.");
            } finally {
                if (!cancelado) setLoading(false);
            }
        };

        if (id) {
            fetchData();
        }

        return () => {
            cancelado = true;
        };
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[50vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
                    <p className="mt-4 text-slate-600">Cargando información...</p>
                </div>
            </div>
        );
    }

    if (!docente) {
        return (
            <div className="flex items-center justify-center h-full min-h-[50vh] p-6">
                <div className={`${BLOQUE} p-8 max-w-md w-full text-center`}>
                    <h2 className="text-xl font-bold text-blue-900">Docente no encontrado</h2>
                    <button onClick={() => navigate(-1)} className={`${BOTON} mt-4 px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white`}>
                        Volver
                    </button>
                </div>
            </div>
        );
    }

    const nombreCompleto = `${docente?.nombres || ''} ${docente?.apellido_paterno || ''} ${docente?.apellido_materno || ''}`.trim();
    // categoría y dedicación vienen del primer vínculo
    const primerVinculo = docente?.vinculos?.[0] || null;
    const categoria = ETIQUETAS_CATEGORIA[primerVinculo?.categoria] || primerVinculo?.categoria || '—';
    const dedicacion = primerVinculo?.dedicacion;
    const dedicacionLabel = ETIQUETAS_DEDICACION[dedicacion] || dedicacion || '—';
    const puedeCrear = puedeCrearFondoTiempo(user);
    const tieneFondoGestionActiva = Boolean(calendarioActivo?.id && fondos.length > 0);
    const puedeCrearNuevoFondo = puedeCrear && !tieneFondoGestionActiva;
    const nuevoFondo = () => navigate('/fondo-tiempo/nuevo-fondo', { state: { docenteId: docente?.id, docenteNombre: nombreCompleto || 'Sin nombre' } });

    return (
        <div className="min-h-full w-full max-w-[92rem] mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-6 space-y-4 text-slate-800">
            {/* Encabezado: volver, docente con sus datos y la acción */}
            <div className={`${BLOQUE} p-5 sm:p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-azulado-100 text-blue-900 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-200 transition-colors"
                            title="Volver"
                            aria-label="Volver"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>
                        <span className="hidden sm:block"><Avatar nombre={nombreCompleto} size="w-14 h-14 text-lg" /></span>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Fondos de Tiempo del docente</p>
                            <h2 className="text-xl sm:text-2xl font-bold text-blue-900 leading-tight">{nombreCompleto || 'Sin nombre'}</h2>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                                <Etiqueta>CI: {docente?.ci || '—'}</Etiqueta>
                                <Etiqueta>{categoria}</Etiqueta>
                                <Etiqueta>{dedicacionLabel}</Etiqueta>
                            </div>
                        </div>
                    </div>
                    {puedeCrearNuevoFondo && (
                        <button data-escritura
                            type="button"
                            onClick={nuevoFondo}
                            className={`${BOTON} w-full sm:w-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
                        >
                            <PlusIcon className="w-5 h-5" />
                            <span>Nuevo Fondo</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Fondos del docente */}
            {fondos.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {fondos.map((fondo, indice) => {
                        const avance = Math.min(100, Math.max(0, Math.round(fondo.porcentaje_completado || 0)));
                        return (
                            <Link
                                key={fondo.id}
                                to={`/fondo-tiempo/fondo/${fondo.id}`}
                                style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                                className={`${BLOQUE} animate-fondo-entrada p-5 flex flex-col gap-4 hover:ring-blue-900/30 transition-colors`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <Etiqueta>Gestión {fondo.gestion}</Etiqueta>
                                    <EstadoPill estado={estadoVisibleFondo(fondo)} />
                                </div>
                                <h3 className="text-lg font-bold text-blue-900 leading-tight line-clamp-2">{fondo.descripcion || 'Fondo de Tiempo'}</h3>
                                <div className="flex items-baseline justify-between px-4 py-2 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300">
                                    <span className="text-xs font-medium text-slate-600">Horas asignadas</span>
                                    <span className="tabular-nums whitespace-nowrap">
                                        <span className="font-bold text-slate-800">{Math.round(fondo.total_asignado || 0)}</span>
                                        <span className="text-sm text-slate-500"> / {Math.round(fondo.horas_efectivas || 0)} hrs</span>
                                    </span>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-medium text-slate-600">Progreso</span>
                                        <span className="text-sm font-bold text-blue-900 tabular-nums">{avance}%</span>
                                    </div>
                                    <BarraProgreso valor={avance} />
                                </div>
                                {fondo.fecha_modificacion && (
                                    <p className="mt-auto pt-3 text-xs text-slate-500 [border-top:1px_solid_#B8C9E1]">
                                        Actualizado el {new Date(fondo.fecha_modificacion).toLocaleDateString('es-BO')}
                                    </p>
                                )}
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No hay fondos registrados</h3>
                    <p className="text-slate-600">Este docente todavía no tiene un Fondo de Tiempo.</p>
                    {puedeCrearNuevoFondo && (
                        <button
                            type="button"
                            onClick={nuevoFondo}
                            className={`${BOTON} mt-6 px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
                        >
                            <PlusIcon className="w-5 h-5" />
                            <span>Crear el primero</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default FondoTiempoDocente;
