import React, { useState, useEffect } from 'react';
import api from './apis/api';

const CalendarDaysIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M12 12.75h.008v.008H12v-.008z" />
    </svg>
);

const ClockIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const CheckCircleIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const WarningIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
    </svg>
);

function VistaCalendarioActivo() {
    const [calendario, setCalendario] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [progreso, setProgreso] = useState({ porcentaje: 0, diasTranscurridos: 0, diasTotales: 0 });
    const [plazo, setPlazo] = useState({ diasRestantes: 0, vencido: false });

    useEffect(() => {
        const cargarCalendarioActivo = async () => {
            try {
                setLoading(true);
                const response = await api.get('/calendarios/activo/');
                const cal = response.data;
                setCalendario(cal);

                if (cal) {
                    // Calcular progreso semestral
                    const inicio = new Date(cal.fecha_inicio + 'T00:00:00');
                    const fin = new Date(cal.fecha_fin + 'T00:00:00');
                    const hoy = new Date();
                    
                    const diasTotales = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
                    let diasTranscurridos = (hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);

                    if (diasTranscurridos < 0) diasTranscurridos = 0;
                    if (diasTranscurridos > diasTotales) diasTranscurridos = diasTotales;
                    
                    const porcentaje = diasTotales > 0 ? (diasTranscurridos / diasTotales) * 100 : 0;
                    
                    setProgreso({
                        porcentaje: Math.round(porcentaje),
                        diasTranscurridos: Math.round(diasTranscurridos),
                        diasTotales: Math.round(diasTotales)
                    });

                    // Calcular plazo para presentar fondos
                    const limite = new Date(cal.fecha_limite_presentacion_proyectos + 'T00:00:00');
                    const diffDias = (limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
                    
                    setPlazo({
                        diasRestantes: Math.ceil(diffDias),
                        vencido: diffDias < 0
                    });
                }

            } catch (err) {
                console.error("Error al cargar calendario activo:", err);
                if (err.response && err.response.status === 404) {
                    setError("No hay un calendario académico activo configurado en el sistema.");
                } else {
                    setError("No se pudo cargar la información del calendario.");
                }
            } finally {
                setLoading(false);
            }
        };

        cargarCalendarioActivo();
    }, []);

    const formatearFecha = (fecha) => {
        if (!fecha) return 'N/A';
        return new Date(fecha + 'T00:00:00').toLocaleDateString('es-BO', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full p-6 bg-slate-100 dark:bg-slate-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-700 dark:text-slate-300">Cargando calendario...</p>
                </div>
            </div>
        );
    }

    if (error || !calendario) {
        return (
            <div className="flex items-center justify-center h-full p-6 bg-slate-100 dark:bg-slate-900">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-6 rounded-xl shadow-md max-w-md text-center">
                    <WarningIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-300">Atención</h2>
                    <p className="text-yellow-700 dark:text-yellow-400 mt-2">{error || "No se encontró un calendario activo."}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full p-6 flex items-center justify-center bg-slate-100 dark:bg-slate-900">
            <div className="w-full max-w-4xl space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Calendario Académico Activo</h1>
                    <p className="text-slate-500 dark:text-slate-400">Información clave para el periodo actual</p>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                                <CalendarDaysIcon className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">
                                    GESTIÓN {calendario.gestion} - {calendario.periodo_display}
                                </h1>
                                <span className="px-3 py-1 mt-2 inline-block text-xs font-bold bg-green-500 text-white rounded-full shadow-md">ACTIVO</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <InfoCard label="Gestión" value={calendario.gestion} />
                            <InfoCard label="Periodo" value={calendario.periodo_display} />
                            <InfoCard label="Semanas Efectivas" value={`${calendario.semanas_efectivas} semanas`} />
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Progreso del Semestre</h3>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 shadow-inner">
                                <div className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-500" style={{ width: `${progreso.porcentaje}%` }}></div>
                            </div>
                            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 mt-1">
                                <span>{formatearFecha(calendario.fecha_inicio)}</span>
                                <span className="font-semibold">{progreso.porcentaje}% completado</span>
                                <span>{formatearFecha(calendario.fecha_fin)}</span>
                            </div>
                        </div>

                        <div className={`p-5 rounded-xl border-2 shadow-lg flex items-center gap-5 ${plazo.vencido ? 'bg-red-50 dark:bg-red-900/20 border-red-500' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'}`}>
                            <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center ${plazo.vencido ? 'bg-red-100 dark:bg-red-900/50' : 'bg-yellow-100 dark:bg-yellow-900/50'}`}>
                                {plazo.vencido ? <CheckCircleIcon className="w-8 h-8 text-red-500" /> : <ClockIcon className="w-8 h-8 text-yellow-500" />}
                            </div>
                            <div>
                                <h3 className={`text-lg font-bold ${plazo.vencido ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                                    {plazo.vencido ? 'Plazo para Presentar Fondos Vencido' : 'Plazo para Presentar Fondos'}
                                </h3>
                                <p className={`text-sm ${plazo.vencido ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                    La fecha límite fue el <strong>{formatearFecha(calendario.fecha_limite_presentacion_proyectos)}</strong>.
                                </p>
                            </div>
                            {!plazo.vencido && (
                                <div className="ml-auto text-center">
                                    <div className={`text-4xl font-black ${plazo.diasRestantes < 7 ? 'text-red-500' : 'text-yellow-600'}`}>{plazo.diasRestantes}</div>
                                    <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">días restantes</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const InfoCard = ({ label, value }) => (
    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
);

export default VistaCalendarioActivo;