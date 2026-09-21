import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { puedeCrearFondoTiempo } from '../utils/fondoTiempoPermissions';

// debug: ayuda a asegurar que esta versión se está usando
console.log('FondoTiempoDocente component loaded (redesign v2).');
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

const FondoTiempoDocente = ({ isDark }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [docente, setDocente] = useState(null);
    const [fondos, setFondos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
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

                const fondosParams = calendarioData?.id
                    ? { docente: id, calendario: calendarioData.id }
                    : { docente: id };
                const fondosRes = await api.get('/fondos-tiempo/', { params: fondosParams });

                if (cancelado) return;

                setDocente(docenteData);
                setCalendarioActivo(calendarioData);
                setFondos(fondosRes.data.results || fondosRes.data);
            } catch (error) {
                if (cancelado) return;
                console.error("Error al cargar datos:", error);
                toast.error("Error al cargar la información del docente.");
            } finally {
                if (cancelado) return;
                setLoading(false);
            }
        };

        const userData = JSON.parse(localStorage.getItem('user') || 'null');
        setUser(userData);

        if (id) {
            fetchData();
        }

        return () => {
            cancelado = true;
        };
    }, [id]);

    const getInitials = (name) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-700 dark:text-slate-300">Cargando información...</p>
                </div>
            </div>
        );
    }

    if (!docente) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Docente no encontrado</h2>
                <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Volver
                </button>
            </div>
        );
    }

    // 🔒 PROTECCIÓN: Datos seguros con optional chaining
    const nombreCompleto = `${docente?.nombres || ''} ${docente?.apellido_paterno || ''} ${docente?.apellido_materno || ''}`.trim();
    const iniciales = getInitials(nombreCompleto);
    const ci = docente?.ci || 'N/A';
    // categoria y dedicacion ahora vienen del primer vínculo
    const primerVinculo = docente?.vinculos?.[0] || null;
    const categoria = primerVinculo?.categoria || 'N/A';
    const dedicacionLabels = {
        tiempo_completo: 'Tiempo Completo',
        medio_tiempo: 'Medio Tiempo',
        horario_16: 'Horario 16hrs/sem',
        horario_24: 'Horario 24hrs/sem',
        horario_40: 'Horario 40hrs/sem',
        horario_48: 'Horario 48hrs/sem',
    };
    const dedicacion = primerVinculo?.dedicacion || 'N/A';
    const dedicacionLabel = dedicacionLabels[dedicacion] || dedicacion;
    const puedeCrear = puedeCrearFondoTiempo(user);
    const tieneFondoPeriodoActivo = Boolean(calendarioActivo?.id && fondos.length > 0);
    const puedeCrearNuevoFondo = puedeCrear && !tieneFondoPeriodoActivo;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Header Compacto y Moderno */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row items-center justify-between py-4 gap-4">
                        {/* Info Docente + Botón Volver */}
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                title="Volver"
                            >
                                <ArrowLeftIcon className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                    {iniciales}
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">
                                        {nombreCompleto || 'Sin nombre'}
                                    </h1>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="font-medium">{ci}</span>
                                        <span>•</span>
                                        <span className="capitalize">{categoria}</span>
                                        <span>•</span>
                                        <span className="text-sm font-medium">{dedicacionLabel}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Botón Acción */}
                        {puedeCrearNuevoFondo && (
                            <button
                                onClick={() => navigate('/fondo-tiempo/nuevo-fondo', { state: { docenteId: docente?.id, docenteNombre: nombreCompleto || 'Sin nombre' } })}
                                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                                <PlusIcon className="w-5 h-5" />
                                <span>Nuevo Fondo</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Contenido Principal */}
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Sección de Fondos (estilo timeline) */}
                <div className="relative">
                    {fondos.length > 0 ? (
                        <div className="space-y-8 relative">
                            {/* Línea vertical central */}
                            <div className="absolute left-4 sm:left-1/2 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 transform sm:-translate-x-1/2"></div>

                            {fondos.map((fondo, index) => (
                                <div key={fondo.id} className={`relative flex flex-col sm:flex-row items-center ${index % 2 === 0 ? 'sm:flex-row-reverse' : ''}`}>
                                    
                                    {/* Punto en la línea */}
                                    <div className="absolute left-4 sm:left-1/2 w-4 h-4 bg-white dark:bg-slate-800 border-4 border-blue-500 rounded-full transform -translate-x-1/2 z-10"></div>

                                    {/* Espacio vacío para alternancia */}
                                    <div className="hidden sm:block w-1/2"></div>

                                    {/* Tarjeta */}
                                    <div className={`w-full sm:w-1/2 pl-12 sm:pl-0 ${index % 2 === 0 ? 'sm:pr-8' : 'sm:pl-8'}`}>
                                        <Link
                                            to={`/fondo-tiempo/fondo/${fondo.id}`}
                                            className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 p-5 group hover:border-blue-300 dark:hover:border-blue-700"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                                    {fondo.gestion} - {fondo.periodo}
                                                </span>
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                                    fondo.estado === 'validado' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                                                    fondo.estado === 'aprobado' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' :
                                                    'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600'
                                                }`}>
                                                    {fondo.estado}
                                                </span>
                                            </div>

                                            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                                                {fondo.asignatura || 'Sin asignatura definida'}
                                            </h3>

                                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                                <div className="flex items-center gap-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span>{fondo.horas_efectivas} hrs</span>
                                                </div>
                                                {fondo.fecha_modificacion && (
                                                    <div className="flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        <span>Actualizado: {new Date(fondo.fecha_modificacion).toLocaleDateString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">No hay fondos registrados para este docente.</p>
                            {puedeCrearNuevoFondo && (
                                <button
                                    onClick={() => navigate('/fondo-tiempo/nuevo-fondo', { state: { docenteId: docente.id, docenteNombre: docente.nombre_completo || docente.nombres } })}
                                    className="mt-4 px-5 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                    Crear el primero
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FondoTiempoDocente;
