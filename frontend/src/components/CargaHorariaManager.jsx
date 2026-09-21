import React, { useState, useEffect, useRef } from 'react';
import api from '../apis/api';
import toast from 'react-hot-toast';

const PencilIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const PlusIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const XMarkIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const SEMANAS_GESTION = 45.8;
const SEMANAS_CLASES_AULA = 40;

const SUBACTIVIDADES_POR_CATEGORIA = {
    academica: {
        tipoLabel: 'Sub-actividad academica',
        evidencias: false,
        opciones: [
            { value: 'cursos_verano', label: 'Cursos de verano' },
            { value: 'preparacion_temas', label: 'Preparación de temas' },
            { value: 'elaboracion_trabajos_practicos', label: 'Elaboración de Trabajos Prácticos' },
            { value: 'revision_calificacion_trabajos_practicos', label: 'Revisión y Calificación de Trabajos Prácticos' },
            { value: 'elaboracion_examenes', label: 'Elaboración de Exámenes' },
            { value: 'revision_calificacion_examenes', label: 'Revisión y Calificación de Exámenes' },
            { value: 'practica_laboratorios_centro_computo', label: 'Práctica de Laboratorios (Centro de Cómputo)' },
            { value: 'practicas_campo', label: 'Prácticas de Campo' },
            { value: 'produccion_docente_textos_guias', label: 'Producción docente (textos guías)' },
            { value: 'consultas_reclamos_calificaciones', label: 'Consultas y Reclamos de Calificaciones' },
            { value: 'clases_aula', label: 'Clases en aula' },
            { value: 'elaboracion_planillas_introduccion_notas_moxos', label: 'Elaboración de planillas e Introducción de notas al sistema moxos' },
            { value: 'planificacion_gestion_practica_extra_aula', label: 'Planificación y gestión de práctica extra aula' },
            { value: 'ejecucion_practica_extra_aula', label: 'Ejecución de práctica extra aula' },
            { value: 'informe_descargo_viaje_practicas_extra_aula', label: 'Informe de descargo de viaje en las prácticas extra aula' },
        ],
    },
    investigacion: {
        nombreLabel: 'Nombre del proyecto de investigacion',
        tipoLabel: 'Tipo',
        evidencias: true,
        opciones: [
            { value: 'participacion_iic_cis', label: 'Participacion IIC-CIS' },
            { value: 'organizacion_eventos_cientificos', label: 'Organizacion eventos cientificos' },
            { value: 'elaboracion_trabajos_investigacion', label: 'Elaboracion trabajos investigacion' },
        ],
    },
    extension_universitaria: {
        nombreLabel: 'Nombre de la actividad',
        tipoLabel: 'Tipo',
        evidencias: true,
        opciones: [
            { value: 'proyectos_extension', label: 'Proyectos de extensión' },
            { value: 'tareas_proyectos_extension_interaccion', label: 'Tareas en proyectos de extensión e interacción' },
            { value: 'cursos', label: 'Cursos' },
            { value: 'seminarios', label: 'Seminarios' },
            { value: 'talleres', label: 'Talleres' },
            { value: 'conferencias', label: 'Conferencias' },
            { value: 'jornadas', label: 'Jornadas' },
            { value: 'videoconferencias', label: 'Videoconferencias' },
            { value: 'asistencia_tecnica', label: 'Asistencia técnica' },
            { value: 'voluntariado', label: 'Voluntariado' },
        ],
    },
    interaccion_social: {
        nombreLabel: 'Nombre del proyecto/actividad',
        tipoLabel: 'Tipo',
        evidencias: true,
        opciones: [
            { value: 'proyectos_interaccion', label: 'Proyectos de interacción' },
            { value: 'tareas_proyectos_extension_interaccion', label: 'Tareas en proyectos de extensión e interacción' },
            { value: 'participacion_ferias_campanas_jornadas', label: 'Participación en ferias, campañas, jornadas' },
            { value: 'proyectos_sociales', label: 'Proyectos sociales' },
            { value: 'ferias', label: 'Ferias' },
            { value: 'campanas', label: 'Campañas' },
            { value: 'jornadas', label: 'Jornadas' },
            { value: 'tribunal_externo', label: 'Tribunal externo' },
            { value: 'capacitacion_externa', label: 'Capacitación externa' },
        ],
    },
    gestion: {
        nombreLabel: 'Actividad de gestion',
        tipoLabel: 'Tipo',
        evidencias: false,
        opciones: [
            { value: 'modalidad_graduacion', label: 'Modalidad de Graduación' },
            { value: 'reuniones', label: 'Reuniones' },
            { value: 'coordinacion', label: 'Coordinación' },
            { value: 'convenios', label: 'Convenios' },
            { value: 'politicas_academicas', label: 'Políticas académicas' },
        ],
    },
    academica_administrativa: {
        nombreLabel: 'Actividad',
        tipoLabel: 'Tipo',
        evidencias: false,
        opciones: [
            { value: 'auxiliares_docencia', label: 'Auxiliares de docencia' },
            { value: 'examenes_mesa', label: 'Exámenes de mesa' },
            { value: 'otras_comisiones_academicas', label: 'Otras comisiones académicas' },
            { value: 'logistica_carrera', label: 'Logística carrera' },
            { value: 'difusion_perfil_profesional', label: 'Difusión perfil profesional' },
            { value: 'caac', label: 'CAAC' },
            { value: 'comision_innovacion_curricular', label: 'Comisión Innovación Curricular' },
            { value: 'poa', label: 'POA' },
            { value: 'programas_analiticos', label: 'Programas analíticos' },
        ],
    },
    social_cultural_deportiva: {
        nombreLabel: 'Actividad',
        tipoLabel: 'Tipo',
        evidencias: false,
        opciones: [
            { value: 'acto_academico_facultativo', label: 'Acto académico facultativo' },
            { value: 'acto_academico_universitario', label: 'Acto académico universitario' },
            { value: 'participacion_actividades_culturales_sociales_deportivas', label: 'Participación de actividades culturales, sociales y deportivas' },
            { value: 'aniversarios', label: 'Aniversarios' },
            { value: 'entrada_folclorica', label: 'Entrada folclórica' },
            { value: 'campeonatos_deportivos', label: 'Campeonatos deportivos' },
            { value: 'concursos', label: 'Concursos' },
            { value: 'eventos_culturales', label: 'Eventos culturales' },
            { value: 'desfile_6_agosto', label: 'Desfile 6 agosto' },
            { value: 'desfile_18_noviembre', label: 'Desfile 18 noviembre' },
            { value: 'claustros_universitarios', label: 'Claustros universitarios' },
            { value: 'asociacion_docente', label: 'Asociación Docente' },
            { value: 'capacitacion_complementaria', label: 'Capacitación complementaria' },
            { value: 'orientacion_vocacional', label: 'Orientación Vocacional' },
        ],
    },
};

const HORAS_ANUALES_OFICIALES = {
    investigacion: {
        participacion_iic_cis: 32,
        organizacion_eventos_cientificos: 12,
        elaboracion_trabajos_investigacion: 16,
    },
    extension_universitaria: {
        proyectos_extension: 24,
        tareas_proyectos_extension_interaccion: 36,
    },
    interaccion_social: {
        proyectos_interaccion: 36,
        proyectos_sociales: 36,
        tareas_proyectos_extension_interaccion: 36,
        participacion_ferias_campanas_jornadas: 48,
        ferias: 48,
        campanas: 48,
        jornadas: 48,
    },
    gestion: {
        modalidad_graduacion: 450,
    },
    academica_administrativa: {
        auxiliares_docencia: 16,
        examenes_mesa: 40,
        otras_comisiones_academicas: 125,
    },
    social_cultural_deportiva: {
        desfile_6_agosto: 16,
        acto_academico_facultativo: 16,
        entrada_folclorica: 16,
        acto_academico_universitario: 16,
        desfile_18_noviembre: 16,
        claustros_universitarios: 16,
        participacion_actividades_culturales_sociales_deportivas: 16,
        eventos_culturales: 16,
        campeonatos_deportivos: 16,
        asociacion_docente: 16,
        capacitacion_complementaria: 16,
    },
};

const HORAS_ANUALES_TIEMPO_COMPLETO = 1712;

const ChevronDown = ({ open = false }) => (
    <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-cyan-50 dark:bg-cyan-900/30 ring-1 ring-cyan-200/70 dark:ring-cyan-700/70">
            <svg
                className={`w-3 h-3 text-cyan-700 dark:text-cyan-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
        </span>
    </div>
);

const CustomSelect = ({
    value,
    options,
    onChange,
    placeholder,
    disabled = false,
    emptyText = 'Sin opciones disponibles',
    menuMaxHeight = 'max-h-56'
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const selected = options.find(opt => opt.value?.toString() === value?.toString());

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const handlePick = (newValue) => {
        onChange(newValue);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => !disabled && setOpen(prev => !prev)}
                disabled={disabled}
                className={`w-full text-left pl-3.5 pr-10 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-sm shadow-sm transition-all ${
                    disabled
                        ? 'border-slate-300/80 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
                        : open
                            ? 'border-cyan-500/80 dark:border-cyan-500 ring-2 ring-cyan-400/40 dark:ring-cyan-500/35 text-slate-900 dark:text-slate-100'
                            : 'border-cyan-300/70 dark:border-cyan-700/80 hover:border-cyan-500/70 dark:hover:border-cyan-500/80 text-slate-800 dark:text-slate-100'
                }`}
            >
                <span className="block truncate font-semibold">{selected ? selected.label : placeholder}</span>
                <ChevronDown open={open} />
            </button>

            {open && !disabled && (
                <div className={`absolute z-30 mt-1.5 w-full overflow-auto rounded-xl border border-cyan-300 dark:border-cyan-700 bg-white dark:bg-slate-900 shadow-xl shadow-cyan-900/15 dark:shadow-black/35 ${menuMaxHeight}`}>
                    {options.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{emptyText}</div>
                    ) : (
                        options.map((opt) => {
                            const active = opt.value?.toString() === value?.toString();
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handlePick(opt.value)}
                                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors border-l-2 ${
                                        active
                                            ? 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-500 text-cyan-800 dark:text-cyan-200 font-semibold'
                                            : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'
                                    }`}
                                    title={opt.label}
                                >
                                    <span className="block truncate">{opt.label}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

const CargaHorariaManager = ({ docenteId, calendarioId, onCargaUpdate, cargaEdicion, onCancelarEdicion, readOnly = true }) => {
    const [cargas, setCargas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [semestre, setSemestre] = useState('');
    const [materias, setMaterias] = useState([]);
    const [loadingMaterias, setLoadingMaterias] = useState(false);
    const FIELD_LABELS = {
        materia: 'Materia',
        docente: 'Docente',
        calendario: 'Calendario academico',
        categoria: 'Categoria',
        horas: 'Horas anuales',
        tipo_actividad: 'Tipo de actividad',
        titulo_actividad: 'Actividad',
        evidencias: 'Evidencias',
        documento_respaldo: 'Respaldo',
        hora_inicio: 'Hora de inicio',
        hora_fin: 'Hora de fin',
        aula: 'Aula',
        paralelo: 'Paralelo',
        dia_semana: 'Dia de la semana'
    };
    const formatFieldError = (field, value) => {
        const label = FIELD_LABELS[field] || field;
        if (Array.isArray(value) && value.length > 0) return `${label}: ${value[0]}`;
        if (typeof value === 'string') return `${label}: ${value}`;
        if (typeof value === 'object' && value !== null) {
            const nestedKey = Object.keys(value)[0];
            if (nestedKey) return `${label}: ${formatFieldError(nestedKey, value[nestedKey])}`;
        }
        return `${label}: Datos invalidos.`;
    };
    const extractValidationMessage = (data) => {
        if (!data) return 'Datos inválidos.';
        if (typeof data === 'string') return data;
        if (typeof data?.error === 'string') return data.error;
        if (typeof data?.detail === 'string') return data.detail;
        if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length > 0) {
            return String(data.non_field_errors[0]);
        }

        if (typeof data === 'object') {
            const firstKey = Object.keys(data)[0];
            const firstValue = data[firstKey];
            if (firstKey) return formatFieldError(firstKey, firstValue);
        }

        return 'Datos inválidos.';
    };
    const [allMaterias, setAllMaterias] = useState([]);
    const [semestresDisponibles, setSemestresDisponibles] = useState([]);
    const [fondoDetalle, setFondoDetalle] = useState(null);
    const [formData, setFormData] = useState({
        categoria: 'academica',
        materia: '',
        titulo_actividad: '',
        tipo_actividad: '',
        horas: '',
        evidencias: '',
        documento_respaldo: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isReadOnly = Boolean(readOnly);

    const CATEGORIA_OPCIONES = [
        { value: 'academica', label: 'Académica' },
        { value: 'investigacion', label: 'Investigación' },
        { value: 'extension_universitaria', label: 'Extensión universitaria' },
        { value: 'interaccion_social', label: 'Interacción social' },
        { value: 'gestion', label: 'Gestión' },
        { value: 'academica_administrativa', label: 'Académica-administrativa' },
        { value: 'social_cultural_deportiva', label: 'Social, cultural, deportiva y Otros' },
    ];

    useEffect(() => {
        if (docenteId && calendarioId) {
            cargarCargas();
            cargarFondoDetalle();
        }
    }, [docenteId, calendarioId]);

    useEffect(() => {
        if (cargaEdicion) {
            setFormData({
                categoria: cargaEdicion.categoria || 'academica',
                materia: cargaEdicion.materia || cargaEdicion.materia_id || '',
                titulo_actividad: cargaEdicion.titulo_actividad || '',
                tipo_actividad: cargaEdicion.tipo_actividad || '',
                horas: cargaEdicion.horas,
                evidencias: cargaEdicion.evidencias || '',
                documento_respaldo: cargaEdicion.respaldo || ''
            });
        } else {
            setFormData({ categoria: 'academica', materia: '', titulo_actividad: '', tipo_actividad: '', horas: '', evidencias: '', documento_respaldo: '' });
        }
    }, [cargaEdicion]);

    useEffect(() => {
        const fetchAllMaterias = async () => {
            setLoadingMaterias(true);
            try {
                let todas = [];
                let nextUrl = '/materias/';
                while (nextUrl) {
                    const response = await api.get(nextUrl);
                    const data = response.data;
                    if (data.results) {
                        todas = [...todas, ...data.results];
                        nextUrl = data.next;
                    } else {
                        todas = Array.isArray(data) ? data : [];
                        nextUrl = null;
                    }
                }
                setAllMaterias(todas);
                const uniqueSemestres = [...new Set(todas.map(m => m.semestre))].sort((a, b) => a - b);
                setSemestresDisponibles(uniqueSemestres);
            } catch (error) {
                console.error("Error cargando materias:", error);
                toast.error("Error al cargar materias");
            } finally {
                setLoadingMaterias(false);
            }
        };
        fetchAllMaterias();
    }, []);

    useEffect(() => {
        if (semestre) {
            setMaterias(allMaterias.filter(m => m.semestre.toString() === semestre.toString()));
        } else {
            setMaterias([]);
        }
    }, [semestre, allMaterias]);

    const cargarCargas = async () => {
        try {
            setLoading(true);
            const response = await api.get('/cargas-horarias/', {
                params: { docente: docenteId, calendario: calendarioId }
            });
            setCargas(response.data.results || response.data);
        } catch (error) {
            console.error("Error al cargar cargas horarias:", error);
            toast.error("Error al cargar asignaciones");
        } finally {
            setLoading(false);
        }
    };

    const cargarFondoDetalle = async () => {
        try {
            const response = await api.get('/fondos-tiempo/', {
                params: { docente: docenteId, calendario: calendarioId }
            });
            const fondos = response.data.results || response.data;
            const fondo = Array.isArray(fondos) ? fondos[0] : null;
            if (!fondo?.id) {
                setFondoDetalle(null);
                return;
            }
            const detalle = await api.get(`/fondos-tiempo/${fondo.id}/`);
            setFondoDetalle(detalle.data);
        } catch (error) {
            console.error("Error al cargar presupuesto macro:", error);
            setFondoDetalle(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isReadOnly) return;
        const esAcademica = formData.categoria === 'academica';
        if (duplicadoTipoSeleccionado) {
            toast.error("No puede repetir el mismo tipo de actividad dentro de la misma categoría");
            return;
        }
        if (excedeObjetivoAnual) {
            toast.error(`No se puede guardar: el Micro excede ${objetivoAnual} horas anuales`);
            return;
        }
        if (esAcademica && !formData.materia) {
            toast.error("Seleccione una materia del plan de estudios");
            return;
        }
        if (esAcademica && !formData.tipo_actividad) {
            toast.error("Seleccione la sub-actividad académica");
            return;
        }
        if (!esAcademica && !formData.titulo_actividad?.trim()) {
            toast.error("Ingrese una descripción de la actividad");
            return;
        }
        if (!esAcademica && !formData.tipo_actividad) {
            toast.error("Seleccione el tipo de actividad");
            return;
        }
        if (!formData.horas || Number(formData.horas) <= 0) {
            toast.error("Verifique las horas anuales");
            return;
        }
        setIsSubmitting(true);
        const payload = {
            ...formData,
            materia: esAcademica ? formData.materia : null,
            titulo_actividad: formData.titulo_actividad.trim(),
            tipo_actividad: formData.tipo_actividad,
            evidencias: formData.evidencias?.trim(),
            docente: docenteId,
            calendario: calendarioId
        };
        try {
            if (cargaEdicion) {
                const response = await api.put(`/cargas-horarias/${cargaEdicion.id}/`, payload);
                toast.success("Asignación actualizada");
                if (response.data?.id) {
                    setCargas((prev) => prev.map((carga) => (
                        carga.id === response.data.id ? response.data : carga
                    )));
                }
                if (onCancelarEdicion) onCancelarEdicion();
            } else {
                const response = await api.post('/cargas-horarias/', payload);
                toast.success("Asignación agregada");
                if (response.data?.id) {
                    setCargas((prev) => [response.data, ...prev]);
                }
            }
            setFormData({ categoria: 'academica', materia: '', titulo_actividad: '', tipo_actividad: '', horas: '', evidencias: '', documento_respaldo: '' });
            setSemestre('');
            cargarFondoDetalle();
            if (onCargaUpdate) onCargaUpdate();
        } catch (error) {
            console.error(error);
            const statusCode = error.response?.status;
            const data = error.response?.data;
            if (statusCode === 400) {
                const validationMessage = extractValidationMessage(data);
                toast.error(`ERROR DE VALIDACIÓN: ${validationMessage}`);
            } else {
                toast.error("Error al guardar");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("¿Eliminar esta asignación?")) return;
        try {
            await api.delete(`/cargas-horarias/${id}/`);
            toast.success("Eliminado");
            setCargas((prev) => prev.filter((carga) => carga.id !== id));
            cargarFondoDetalle();
            if (onCargaUpdate) onCargaUpdate();
        } catch (error) {
            console.error(error);
            const statusCode = error.response?.status;
            const data = error.response?.data;
            if (statusCode === 400) {
                const validationMessage = extractValidationMessage(data);
                toast.error(`ERROR DE VALIDACIÓN: ${validationMessage}`);
            } else {
                toast.error("Error al eliminar");
            }
        }
    };

    const handleMateriaChange = (materiaId) => {
        const materia = materias.find(m => m.id.toString() === materiaId);
        if (materia) {
            if (formData.categoria === 'academica' && formData.tipo_actividad && formData.tipo_actividad !== 'clases_aula') {
                setFormData({ ...formData, materia: materiaId });
                return;
            }
            // 40 semanas de clases según Fondo de Tiempo oficial
            const horasAnuales = Number(materia.horas_totales || 0) * SEMANAS_CLASES_AULA;
            setFormData({ ...formData, materia: materiaId, tipo_actividad: 'clases_aula', titulo_actividad: materia.nombre, horas: horasAnuales });
        }
    };

    const handleCategoriaChange = (categoria) => {
        setSemestre('');
        setFormData({
            categoria,
            materia: '',
            titulo_actividad: '',
            tipo_actividad: '',
            horas: '',
            evidencias: '',
            documento_respaldo: formData.documento_respaldo || ''
        });
    };

    const handleTipoActividadChange = (tipoActividad) => {
        const horasSugeridas = HORAS_ANUALES_OFICIALES[formData.categoria]?.[tipoActividad];
        const opcion = SUBACTIVIDADES_POR_CATEGORIA[formData.categoria]?.opciones?.find(opt => opt.value === tipoActividad);
        setFormData((prev) => ({
            ...prev,
            tipo_actividad: tipoActividad,
            titulo_actividad: prev.categoria === 'academica' && tipoActividad !== 'clases_aula' ? (opcion?.label || '') : prev.titulo_actividad,
            horas: prev.categoria === 'academica' || horasSugeridas === undefined
                ? prev.horas
                : horasSugeridas
        }));
    };

    const categoriaOptions = CATEGORIA_OPCIONES.map(opt => ({ value: opt.value, label: opt.label }));
    const semestreOptions = semestresDisponibles.map(s => ({ value: s.toString(), label: `${s}° Semestre` }));
    const materiaOptions = materias.map(m => ({
        value: m.id.toString(),
        label: `${m.nombre} (${m.horas_teoricas} HT / ${m.horas_practicas} HP - Total: ${m.horas_totales} hrs/sem)`
    }));
    const selectedMateriaId = formData.materia?.toString() || '';
    const esAcademica = formData.categoria === 'academica';
    const requiereMateriaAcademica = esAcademica;
    const esSubactividadAcademica = esAcademica && formData.tipo_actividad && formData.tipo_actividad !== 'clases_aula';
    const configCategoria = SUBACTIVIDADES_POR_CATEGORIA[formData.categoria] || null;
    const tipoActividadOptions = configCategoria?.opciones || [];
    const semanasPresupuesto = Number(fondoDetalle?.semanas_año || SEMANAS_GESTION);
    const categoriaPresupuesto = fondoDetalle?.categorias?.find(cat => cat.tipo === formData.categoria);
    const presupuestoSemana = Number(categoriaPresupuesto?.total_horas || 0);
    const semanasCategoria = esAcademica ? SEMANAS_CLASES_AULA : semanasPresupuesto;
    const asignadoSemana = cargas
        .filter(carga => carga.categoria === formData.categoria && carga.id !== cargaEdicion?.id)
        .reduce((total, carga) => total + (Number(carga.horas || 0) / semanasCategoria), 0);
    const disponibleSemana = presupuestoSemana - asignadoSemana;
    const objetivoAnual = Math.round(Number(fondoDetalle?.horas_efectivas || HORAS_ANUALES_TIEMPO_COMPLETO));
    const horasFormulario = Number(formData.horas || 0);
    const totalAnualBase = cargas
        .filter((carga) => carga.id !== cargaEdicion?.id)
        .reduce((total, carga) => total + Number(carga.horas || 0), 0);
    const totalAnualProyectado = totalAnualBase + horasFormulario;
    const excedeObjetivoAnual = objetivoAnual > 0 && totalAnualProyectado > objetivoAnual;
    const duplicadoTipoSeleccionado = Boolean(formData.tipo_actividad) && cargas.some((carga) => (
        carga.id !== cargaEdicion?.id
        && carga.categoria === formData.categoria
        && carga.tipo_actividad === formData.tipo_actividad
        && (!esAcademica || String(carga.materia || carga.materia_id || '') === String(formData.materia || ''))
    ));
    const respaldoRequerido = false;
    const respaldoInvalido = respaldoRequerido && !formData.documento_respaldo?.trim();
    const submitDisabled = isSubmitting
        || (requiereMateriaAcademica && !formData.materia)
        || (esSubactividadAcademica && !formData.titulo_actividad?.trim())
        || (!esAcademica && !formData.titulo_actividad?.trim())
        || (esAcademica && !formData.tipo_actividad)
        || (!esAcademica && !formData.tipo_actividad)
        || !formData.horas
        || Number(formData.horas) <= 0
        || duplicadoTipoSeleccionado
        || excedeObjetivoAnual
        || respaldoInvalido;

    const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 focus:border-transparent transition-all";
    const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5";

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
            <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-100">
                    Asignacion de Carga Horaria
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Jefatura
                    </span>
                    {cargaEdicion && !isReadOnly && (
                        <button
                            type="button"
                            onClick={onCancelarEdicion}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-lg transition-colors"
                        >
                            <XMarkIcon className="w-3 h-3" /> Cancelar
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-y-auto">
                {duplicadoTipoSeleccionado && (
                    <div className="mb-4 shrink-0 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                        Ya existe una asignación con este mismo tipo dentro de la categoría seleccionada.
                    </div>
                )}

                {/* Banner edición */}
                {cargaEdicion && (
                    <div className="mb-3 shrink-0 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <PencilIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 truncate">
                            Editando: <span className="font-bold">{cargaEdicion.titulo_actividad}</span>
                        </p>
                    </div>
                )}

                {/* Formulario - flex-1 + flex-col + justify-between */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between gap-0">

                    {/* Campos superiores */}
                    <div className="space-y-4">

                        {/* Fila 1: Categoría + Semestre */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Categoría</label>
                                <CustomSelect
                                    value={formData.categoria}
                                    options={categoriaOptions}
                                    onChange={handleCategoriaChange}
                                    placeholder="Seleccionar categoría"
                                    disabled={isReadOnly}
                                />
                            </div>
                            {esAcademica && (
                                <div>
                                    <label className={labelCls}>Semestre / Nivel</label>
                                    <CustomSelect
                                        value={semestre}
                                        options={semestreOptions}
                                        onChange={(newValue) => {
                                            setSemestre(newValue);
                                            setFormData(prev => ({ ...prev, materia: '', titulo_actividad: '', horas: '' }));
                                        }}
                                        placeholder={loadingMaterias ? 'Cargando...' : '-- Nivel --'}
                                        disabled={loadingMaterias || isReadOnly}
                                        emptyText={loadingMaterias ? 'Cargando niveles...' : 'No hay niveles disponibles'}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="rounded-lg border border-cyan-200 bg-cyan-50/70 px-3 py-2 text-[11px] font-semibold text-cyan-800 dark:border-cyan-800/70 dark:bg-cyan-950/25 dark:text-cyan-200">
                            Presupuesto: {presupuestoSemana.toFixed(2)} hrs/sem | Asignado: {asignadoSemana.toFixed(2)} hrs/sem | Disponible: {disponibleSemana.toFixed(2)} hrs/sem
                        </div>

                        {/* Fila 2: Materia o actividad */}
                        {esAcademica ? (
                            <div>
                                <div>
                                    <label className={labelCls}>Sub-actividad academica</label>
                                    <CustomSelect
                                        value={formData.tipo_actividad}
                                        options={tipoActividadOptions}
                                        onChange={handleTipoActividadChange}
                                        placeholder="Seleccionar sub-actividad"
                                        disabled={isReadOnly}
                                        emptyText="No hay sub-actividades configuradas"
                                        menuMaxHeight="max-h-64"
                                    />
                                </div>
                                {formData.tipo_actividad && (
                                    <div className="mt-3">
                                        <label className={labelCls}>Materia (Malla curricular)</label>
                                        <CustomSelect
                                            value={selectedMateriaId}
                                            options={materiaOptions}
                                            onChange={handleMateriaChange}
                                            placeholder={!semestre ? 'Seleccione un nivel primero' : '-- Seleccionar Materia --'}
                                            disabled={!semestre || isReadOnly}
                                            emptyText={!semestre ? 'Selecciona primero un nivel' : 'No hay materias en este nivel'}
                                            menuMaxHeight="max-h-64"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <label className={labelCls}>Descripción de actividad</label>
                                <input
                                    type="text"
                                    className={inputCls}
                                    placeholder="Ej: Proyecto de investigación, extensión o gestión"
                                    value={formData.titulo_actividad}
                                    onChange={e => setFormData({ ...formData, titulo_actividad: e.target.value })}
                                    disabled={isReadOnly}
                                />
                                <div className="mt-3">
                                    <label className={labelCls}>{configCategoria?.tipoLabel || 'Tipo'}</label>
                                    <CustomSelect
                                        value={formData.tipo_actividad}
                                        options={tipoActividadOptions}
                                        onChange={handleTipoActividadChange}
                                        placeholder="Seleccionar tipo"
                                        disabled={isReadOnly}
                                        emptyText="No hay tipos configurados"
                                        menuMaxHeight="max-h-64"
                                    />
                                </div>
                                {configCategoria?.evidencias && (
                                    <div className="mt-3">
                                        <label className={labelCls}>Evidencias</label>
                                        <textarea
                                            className={`${inputCls} min-h-[5.5rem] resize-y`}
                                            placeholder="Detalle evidencias, productos esperados o respaldo documental"
                                            value={formData.evidencias}
                                            onChange={e => setFormData({ ...formData, evidencias: e.target.value })}
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Fila 3: Horas calculadas - tarjeta destacada */}
                        <div className={`rounded-xl border-2 transition-all p-4 ${formData.horas
                            ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30'}`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold uppercase tracking-wider ${formData.horas ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    Horas Anuales <span className="font-normal normal-case opacity-70">({esAcademica && !esSubactividadAcademica ? 'auto' : 'manual'})</span>
                                </span>
                                {formData.horas && (
                                    <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                        CALCULADO
                                    </span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-2">
                                {esAcademica && !esSubactividadAcademica ? (
                                    <span className={`text-3xl font-black leading-none ${formData.horas ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                        {formData.horas || '0'}
                                    </span>
                                ) : (
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="w-32 rounded-lg border border-blue-200 bg-white px-3 py-2 text-2xl font-black leading-none text-blue-600 outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-700 dark:bg-slate-800 dark:text-blue-400"
                                        value={formData.horas}
                                        onChange={e => setFormData({ ...formData, horas: e.target.value })}
                                        disabled={isReadOnly}
                                    />
                                )}
                                <span className={`text-sm font-bold ${formData.horas ? 'text-blue-400 dark:text-blue-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                    hrs/año
                                </span>
                            </div>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5 leading-tight">
                                {esAcademica && !esSubactividadAcademica
                                    ? `Total horas anuales = (HT + HP) x ${SEMANAS_CLASES_AULA} semanas`
                                    : `Equivalencia semanal aproximada = horas anuales / ${semanasPresupuesto}`}
                            </p>
                        </div>

                        {/* Fila 4: Respaldo */}
                        <div>
                            <label className={labelCls}>
                                Respaldo <span className={`font-normal normal-case ${respaldoInvalido ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    (opcional)
                                </span>
                            </label>
                            <input type="text" className={`${inputCls} ${respaldoInvalido ? 'border-red-500 dark:border-red-400 focus:ring-red-400 dark:focus:ring-red-500' : ''}`} placeholder="Ej: Memo #123"
                                value={formData.documento_respaldo}
                                onChange={e => setFormData({ ...formData, documento_respaldo: e.target.value })}
                                disabled={isReadOnly} />
                        </div>
                    </div>

                    {/* Botón - pegado al fondo con mt-auto */}
                    <div className="mt-5">
                        {!isReadOnly && (
                        <button type="submit"
                            disabled={submitDisabled}
                            className={`w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all ${
                                submitDisabled
                                    ? 'bg-slate-400 dark:bg-slate-600 opacity-60 cursor-not-allowed shadow-none'
                                    : `shadow-md hover:shadow-lg hover:scale-[1.01] ${cargaEdicion
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/20'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                                    }`
                            }`}>
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Guardando...
                                </>
                            ) : cargaEdicion ? (
                                <><PencilIcon className="w-4 h-4" /> Actualizar Asignación</>
                            ) : (
                                <><PlusIcon className="w-4 h-4" /> Agregar Asignación</>
                            )}
                        </button>
                        )}
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CargaHorariaManager;

