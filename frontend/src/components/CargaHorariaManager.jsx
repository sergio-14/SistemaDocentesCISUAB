import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api, { obtenerTodos } from '../apis/api';
import toast from 'react-hot-toast';
import { ERROR_FIELD_BORDER_CLASS, ERROR_MOTION_CLASS, ERROR_SHAKE_DURATION_MS, getApiErrorMessage } from '../utils/formErrors';
import MensajeErrorCampo from './common/MensajeErrorCampo';
import SelectorRueda from './common/SelectorRueda';

const PARALELOS = ['A', 'B', 'C', 'D', 'E', 'F'];

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
            { value: 'asesorias_tutorias', label: 'Asesorías y tutorías' },
            { value: 'gabinetes', label: 'Gabinetes' },
            { value: 'modulos_productivos', label: 'Módulos productivos' },
            { value: 'aulas_tic', label: 'Aulas TIC' },
            { value: 'practicas_preprofesionales', label: 'Prácticas preprofesionales y/o laborales' },
            { value: 'otros', label: 'Otros' },
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
            { value: 'complementaciones_curriculares', label: 'Complementaciones curriculares' },
            { value: 'nuevas_tecnologias', label: 'Interrelación con nuevas tecnologías' },
            { value: 'nuevas_metodologias', label: 'Nuevas metodologías de trabajo' },
            { value: 'relacion_teoria_practica', label: 'Perfeccionamiento de la relación teoría y práctica' },
            { value: 'reingenieria', label: 'Reingeniería' },
            { value: 'otros', label: 'Otros' },
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
            { value: 'otros', label: 'Otros' },
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
            { value: 'otros', label: 'Otros' },
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
            { value: 'otros', label: 'Otros' },
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
            { value: 'ejercicio_cargo_direccion', label: 'Ejercicio del cargo: Dirección de Carrera' },
            { value: 'ejercicio_cargo_jefatura', label: 'Ejercicio del cargo: Jefatura de Estudios' },
            { value: 'ejercicio_cargo_instituto', label: 'Ejercicio del cargo: Instituto de Investigación' },
            { value: 'difusion_perfil_profesional', label: 'Difusión perfil profesional' },
            { value: 'caac', label: 'CAAC' },
            { value: 'comision_innovacion_curricular', label: 'Comisión Innovación Curricular' },
            { value: 'poa', label: 'POA' },
            { value: 'programas_analiticos', label: 'Programas analíticos' },
            { value: 'otros', label: 'Otros' },
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
            { value: 'otros', label: 'Otros' },
        ],
    },
};

// Ejercicio del cargo (Art. 13): solo la variante del cargo que el docente
// tiene activo en la carrera del fondo (tipos_ejercicio_cargo del detalle) y
// una sola vez por fondo. El backend aplica las mismas reglas.
const TIPOS_EJERCICIO_CARGO = ['ejercicio_cargo_direccion', 'ejercicio_cargo_jefatura', 'ejercicio_cargo_instituto'];

// "Otros" (en cada unidad): la descripción es obligatoria y no puede ser solo "Otros"; igual que el backend.
const TIPO_OTROS = 'otros';
const descripcionOtrosValida = (titulo) => {
    const texto = String(titulo || '').trim();
    return Boolean(texto) && texto.toLowerCase() !== 'otros';
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

// Compara sin mayúsculas ni tildes: "calculo" encuentra "Cálculo".
const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Selector con el diseño del dashboard: campo azulado, cuadrito azul con la flecha que
// gira y menú flotante (en <body>, para que no lo recorte el panel). En las listas largas
// (más de 8 opciones) o con "escribible", el propio campo es el buscador: al pulsarlo se
// despliega la lista y lo que se escribe la filtra (sin una casilla de búsqueda aparte).
const CustomSelect = ({
    value,
    options,
    onChange,
    placeholder,
    disabled = false,
    emptyText = 'Sin opciones disponibles',
    escribible = false,
}) => {
    const [open, setOpen] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [menuStyle, setMenuStyle] = useState(null);
    const containerRef = useRef(null);
    const menuRef = useRef(null);
    const selected = options.find(opt => opt.value?.toString() === value?.toString());
    const modoEscribible = escribible || options.length > 8;

    const cerrar = () => {
        setOpen(false);
        setBusqueda('');
    };

    useEffect(() => {
        if (!open) return undefined;
        const cerrar = () => {
            setOpen(false);
            setBusqueda('');
        };
        const handleClickOutside = (event) => {
            if (containerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
            cerrar();
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') cerrar();
        };
        // El menú está fijo en pantalla: si se desplaza la página o cambia el tamaño, se cierra.
        const handleScroll = (event) => {
            if (menuRef.current?.contains(event.target)) return;
            cerrar();
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', cerrar);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', cerrar);
        };
    }, [open]);

    useLayoutEffect(() => {
        if (!open || !containerRef.current) {
            setMenuStyle(null);
            return;
        }
        const rect = containerRef.current.getBoundingClientRect();
        // Al menos 18rem de ancho para que se lean las materias, sin salirse de la pantalla.
        const ancho = Math.min(Math.max(rect.width, 288), window.innerWidth - 16);
        const izquierda = Math.max(8, Math.min(rect.left, window.innerWidth - ancho - 8));
        const alturaMax = 320;
        const espacioAbajo = window.innerHeight - rect.bottom - 12;
        const abrirArriba = espacioAbajo < alturaMax && rect.top > espacioAbajo;
        setMenuStyle({
            position: 'fixed',
            left: `${izquierda}px`,
            width: `${ancho}px`,
            ...(abrirArriba
                ? { bottom: `${window.innerHeight - rect.top + 8}px` }
                : { top: `${rect.bottom + 8}px` }),
            zIndex: 99999,
        });
    }, [open]);

    const handlePick = (newValue) => {
        onChange(newValue);
        cerrar();
    };

    const filtradas = busqueda.trim()
        ? options.filter((opt) => normalizar(opt.label).includes(normalizar(busqueda.trim())))
        : options;

    const claseCampo = `relative w-full h-11 text-left pl-4 pr-11 rounded-full text-[13px] ring-inset transition-colors ${
        disabled
            ? 'bg-slate-100 ring-1 ring-azulado-300 text-slate-400 cursor-not-allowed'
            : open
                ? 'bg-azulado-100 ring-2 ring-blue-900/40 text-slate-900'
                : 'bg-azulado-100 ring-1 ring-azulado-300 text-slate-800'
    }`;
    const flecha = (
        <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md ${
            disabled ? 'bg-slate-400' : 'bg-[#2C4AAE]'
        }`}>
            <svg
                className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
        </span>
    );

    return (
        <div ref={containerRef} className="relative">
            {modoEscribible ? (
                <>
                    {/* Cerrado muestra la opción elegida; abierto, lo que se escribe para buscar. */}
                    <input
                        type="text"
                        role="combobox"
                        aria-expanded={open}
                        value={open ? busqueda : (selected?.label || '')}
                        onChange={(e) => {
                            setBusqueda(e.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => !disabled && setOpen(true)}
                        onClick={() => !disabled && setOpen(true)}
                        onKeyDown={(e) => {
                            // Enter elige la primera coincidencia y no envía el formulario.
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (open && filtradas.length > 0) handlePick(filtradas[0].value);
                            }
                            if (e.key === 'Tab') cerrar();
                        }}
                        disabled={disabled}
                        placeholder={open ? (selected?.label || 'Escribe para buscar...') : placeholder}
                        className={`${claseCampo} outline-none !bg-azulado-100 disabled:!bg-slate-100 placeholder:text-slate-500 ${
                            !open && selected ? 'font-semibold' : ''
                        }`}
                    />
                    {flecha}
                </>
            ) : (
                <button
                    type="button"
                    onClick={() => !disabled && (open ? cerrar() : setOpen(true))}
                    disabled={disabled}
                    className={claseCampo}
                >
                    <span className={`block truncate ${selected ? 'font-semibold' : 'text-slate-500'}`}>
                        {selected ? selected.label : placeholder}
                    </span>
                    {flecha}
                </button>
            )}

            {open && !disabled && menuStyle && createPortal(
                <div ref={menuRef} style={menuStyle} className="rounded-xl border-2 border-[#3A56AF] bg-white shadow-xl overflow-hidden">
                    <div className="max-h-64 overflow-auto p-2">
                        {filtradas.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-500">
                                {options.length === 0 ? emptyText : 'Sin resultados'}
                            </div>
                        ) : (
                            filtradas.map((opt) => {
                                const active = opt.value?.toString() === value?.toString();
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handlePick(opt.value)}
                                        className={`w-full text-left px-3 py-2 text-[13px] rounded-lg ${
                                            active
                                                ? 'bg-sky-600 text-white font-semibold hover:bg-sky-700'
                                                : 'bg-transparent text-slate-700 hover:bg-[#2C4AAE] hover:text-white'
                                        }`}
                                        title={opt.label}
                                    >
                                        <span className="block truncate">{opt.label}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// Error que aparece en el formulario mientras se llena (no al guardar): cada vez que
// aparece sale también en el toast de error y el mensaje rebota como los demás errores.
// Devuelve si el mensaje está rebotando ahora.
const useErrorEnVivo = (mensaje, idToast) => {
    const [brinco, setBrinco] = useState(false);
    useEffect(() => {
        if (!mensaje) {
            toast.dismiss(idToast);
            return undefined;
        }
        toast.error(mensaje, { id: idToast });
        setBrinco(false);
        const cuadro = requestAnimationFrame(() => setBrinco(true));
        const fin = setTimeout(() => setBrinco(false), ERROR_SHAKE_DURATION_MS);
        return () => {
            cancelAnimationFrame(cuadro);
            clearTimeout(fin);
        };
    }, [mensaje, idToast]);
    return brinco;
};

const CargaHorariaManager = ({ fondoId, docenteId, gestion, calendarios = [], onCargaUpdate, readOnly = true, versionCargas = 0 }) => {
    const [cargas, setCargas] = useState([]);
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
    // Las materias van en un calendario de la gestión; con uno solo, se elige solo.
    const calendarioPorDefecto = calendarios.length === 1 ? String(calendarios[0].id) : '';
    const [formData, setFormData] = useState({
        categoria: 'academica',
        calendario: calendarioPorDefecto,
        materia: '',
        paralelo: 'A',
        titulo_actividad: '',
        tipo_actividad: '',
        horas: '',
        evidencias: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Error del backend al guardar: además del toast, sobre el botón (rebota y se pliega
    // a los 4 s o con un clic en cualquier lado). { mensaje, vez }
    const [errorGuardar, setErrorGuardar] = useState(null);
    const [brincoGuardar, setBrincoGuardar] = useState(false);
    useEffect(() => {
        if (!errorGuardar) return undefined;
        setBrincoGuardar(false);
        const cuadro = requestAnimationFrame(() => setBrincoGuardar(true));
        const fin = setTimeout(() => setBrincoGuardar(false), ERROR_SHAKE_DURATION_MS);
        const quitar = () => setErrorGuardar(null);
        const vence = setTimeout(quitar, 4000);
        const escuchar = setTimeout(() => document.addEventListener('pointerdown', quitar), 0);
        return () => {
            cancelAnimationFrame(cuadro);
            clearTimeout(fin);
            clearTimeout(vence);
            clearTimeout(escuchar);
            document.removeEventListener('pointerdown', quitar);
        };
    }, [errorGuardar]);
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

    // Las funciones de carga cambian en cada render: se usan desde una ref para recargar
    // cuando cambia el fondo o cuando el detalle cambia sus cargas (versionCargas).
    const cargasRef = useRef(null);
    useEffect(() => {
        cargasRef.current = { cargarCargas, cargarFondoDetalle };
    });
    useEffect(() => {
        if (fondoId) {
            cargasRef.current.cargarCargas();
            cargasRef.current.cargarFondoDetalle();
        }
    }, [fondoId, versionCargas]);

    useEffect(() => {
        setFormData((prev) => (prev.calendario ? prev : { ...prev, calendario: calendarioPorDefecto }));
    }, [calendarioPorDefecto]);

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

    // Todas las páginas: los totales y la validación de duplicados necesitan todas las cargas.
    const cargarCargas = async () => {
        try {
            setCargas(await obtenerTodos('/cargas-horarias/', { fondo: fondoId }));
        } catch (error) {
            console.error("Error al cargar cargas horarias:", error);
            toast.error("Error al cargar asignaciones");
        }
    };

    const cargarFondoDetalle = async () => {
        try {
            const detalle = await api.get(`/fondos-tiempo/${fondoId}/`);
            setFondoDetalle(detalle.data);
        } catch (error) {
            console.error("Error al cargar el detalle del fondo:", error);
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
            toast.error(`No se puede guardar: la suma de las unidades superaría las ${objetivoAnual} horas efectivas`);
            return;
        }
        if (esAcademica && !formData.calendario) {
            toast.error("Seleccione el calendario académico de la materia");
            return;
        }
        if (esAcademica && !formData.materia) {
            toast.error("Seleccione una materia del plan de estudios");
            return;
        }
        if (esAcademica && formData.tipo_actividad === 'clases_aula' && !formData.paralelo) {
            toast.error("Seleccione el paralelo");
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
        if (formData.tipo_actividad === TIPO_OTROS && !descripcionOtrosValida(formData.titulo_actividad)) {
            toast.error('Describa la actividad: en "Otros" la descripción es obligatoria');
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
            // Las materias van en su calendario; lo demás son horas por año de la gestión del fondo.
            calendario: esAcademica ? formData.calendario : null,
            gestion,
        };
        try {
            await api.post('/cargas-horarias/', payload);
            toast.success("Asignación agregada");
            setFormData({ categoria: 'academica', calendario: calendarioPorDefecto, materia: '', paralelo: 'A', titulo_actividad: '', tipo_actividad: '', horas: '', evidencias: '' });
            setSemestre('');
            cargarCargas();
            cargarFondoDetalle();
            if (onCargaUpdate) onCargaUpdate();
        } catch (error) {
            console.error(error);
            const statusCode = error.response?.status;
            const data = error.response?.data;
            // 400 de validación; 403 (fondo no editable, otra carrera) y demás: el mensaje del backend.
            const mensaje = statusCode === 400
                ? `No se pudo guardar: ${extractValidationMessage(data)}`
                : getApiErrorMessage(error, 'No se pudo guardar la asignación');
            toast.error(mensaje);
            setErrorGuardar({ mensaje, vez: Date.now() });
        } finally {
            setIsSubmitting(false);
        }
    };


    // Semanas de clases del calendario (20 en un semestre, 40 en uno anual), dato del backend.
    const semanasDeClase = (calendarioId) => (
        calendarios.find(cal => String(cal.id) === String(calendarioId))?.semanas_de_clase || 0
    );

    const handleMateriaChange = (materiaId) => {
        const materia = materias.find(m => m.id.toString() === materiaId);
        if (materia) {
            if (formData.categoria === 'academica' && formData.tipo_actividad && formData.tipo_actividad !== 'clases_aula') {
                setFormData({ ...formData, materia: materiaId });
                return;
            }
            const horasAnuales = Number(materia.horas_totales || 0) * semanasDeClase(formData.calendario);
            setFormData({ ...formData, materia: materiaId, tipo_actividad: 'clases_aula', titulo_actividad: materia.nombre, horas: horasAnuales });
        }
    };

    const handleCalendarioChange = (calendarioId) => {
        setFormData((prev) => {
            const materia = materias.find(m => String(m.id) === String(prev.materia));
            // Clases en aula: las horas dependen de las semanas del calendario.
            const horas = prev.tipo_actividad === 'clases_aula' && materia
                ? Number(materia.horas_totales || 0) * semanasDeClase(calendarioId)
                : prev.horas;
            return { ...prev, calendario: calendarioId, horas };
        });
    };

    const handleCategoriaChange = (categoria) => {
        setSemestre('');
        setFormData({
            categoria,
            calendario: formData.calendario || calendarioPorDefecto,
            materia: '',
            paralelo: 'A',
            titulo_actividad: '',
            tipo_actividad: '',
            horas: '',
            evidencias: '',
        });
    };

    const handleTipoActividadChange = (tipoActividad) => {
        const horasSugeridas = HORAS_ANUALES_OFICIALES[formData.categoria]?.[tipoActividad];
        const opcion = SUBACTIVIDADES_POR_CATEGORIA[formData.categoria]?.opciones?.find(opt => opt.value === tipoActividad);
        setFormData((prev) => ({
            ...prev,
            tipo_actividad: tipoActividad,
            titulo_actividad: tipoActividad === TIPO_OTROS && prev.categoria === 'academica'
                ? ''
                : (prev.categoria === 'academica' && tipoActividad !== 'clases_aula')
                || (TIPOS_EJERCICIO_CARGO.includes(tipoActividad) && !prev.titulo_actividad?.trim())
                    ? (opcion?.label || '')
                    : prev.titulo_actividad,
            horas: prev.categoria === 'academica' || horasSugeridas === undefined
                ? prev.horas
                : horasSugeridas
        }));
    };

    const categoriaOptions = CATEGORIA_OPCIONES.map(opt => ({ value: opt.value, label: opt.label }));
    const paraleloOptions = PARALELOS.map(p => ({ value: p, label: `Paralelo ${p}` }));
    const calendarioOptions = calendarios.map(cal => ({ value: String(cal.id), label: `${cal.periodo_display} ${cal.gestion}` }));
    const semestreOptions = semestresDisponibles.map(s => ({ value: s.toString(), label: `${s}° Semestre` }));
    const selectedMateriaId = formData.materia?.toString() || '';
    // Una materia inactiva no se asigna en cargas nuevas (solo se conserva la ya asignada).
    const materiaOptions = materias
        .filter(m => m.activo !== false || m.id.toString() === selectedMateriaId)
        .map(m => ({
            value: m.id.toString(),
            label: `${m.nombre} (${m.horas_teoricas} HT / ${m.horas_practicas} HP - Total: ${m.horas_totales} hrs/sem)`
        }));
    const esAcademica = formData.categoria === 'academica';
    const requiereMateriaAcademica = esAcademica;
    const esSubactividadAcademica = esAcademica && formData.tipo_actividad && formData.tipo_actividad !== 'clases_aula';
    const configCategoria = SUBACTIVIDADES_POR_CATEGORIA[formData.categoria] || null;
    const tiposCargoDelDocente = fondoDetalle?.tipos_ejercicio_cargo || [];
    const tipoActividadOptions = (configCategoria?.opciones || []).filter((opt) => (
        !TIPOS_EJERCICIO_CARGO.includes(opt.value)
        || tiposCargoDelDocente.includes(opt.value)
    ));
    // La unidad suma sus ítems; el fondo, todas sus unidades (horas por año) hasta las horas efectivas.
    const totalUnidad = cargas
        .filter(carga => carga.categoria === formData.categoria)
        .reduce((total, carga) => total + Number(carga.horas || 0), 0);
    const objetivoAnual = Math.round(Number(fondoDetalle?.horas_efectivas || 0));
    const horasFormulario = Number(formData.horas || 0);
    const totalAnualBase = cargas
        .reduce((total, carga) => total + Number(carga.horas || 0), 0);
    const totalAnualProyectado = totalAnualBase + horasFormulario;
    const excedeObjetivoAnual = objetivoAnual > 0 && totalAnualProyectado > objetivoAnual;
    // Misma regla que el backend: clases en aula, una por calendario + materia + paralelo;
    // el resto (sub-actividades académicas y demás ítems), una por fondo.
    const esClaseAula = esAcademica && formData.tipo_actividad === 'clases_aula';
    const esEjercicioCargo = TIPOS_EJERCICIO_CARGO.includes(formData.tipo_actividad);
    const duplicadoTipoSeleccionado = Boolean(formData.tipo_actividad) && cargas.some((carga) => {
        if (esEjercicioCargo) return TIPOS_EJERCICIO_CARGO.includes(carga.tipo_actividad);
        if (carga.categoria !== formData.categoria
            || carga.tipo_actividad !== formData.tipo_actividad) return false;
        if (!esClaseAula) return true;
        return String(carga.calendario || '') === String(formData.calendario || '')
            && String(carga.materia || carga.materia_id || '') === String(formData.materia || '')
            && carga.paralelo === formData.paralelo;
    });
    const mensajeDuplicado = esClaseAula
        ? 'Esa materia ya está asignada en ese calendario y paralelo.'
        : 'Esa actividad ya está registrada en el Fondo de Tiempo.';

    // Duplicado: el mensaje aparece (el bloque crece con animación y el mensaje rebota) y
    // sale el toast de error. A los 4 s, o con un clic en cualquier lado, se cierra el
    // toast y se vacía todo el formulario (como después de agregar una asignación), así
    // el mensaje se pliega solo.
    const [brincoDuplicado, setBrincoDuplicado] = useState(false);
    const limpiarDuplicadoRef = useRef(null);
    limpiarDuplicadoRef.current = () => {
        toast.dismiss('carga-duplicada');
        setFormData({ categoria: 'academica', calendario: calendarioPorDefecto, materia: '', paralelo: 'A', titulo_actividad: '', tipo_actividad: '', horas: '', evidencias: '' });
        setSemestre('');
    };
    useEffect(() => {
        if (!duplicadoTipoSeleccionado) return undefined;
        toast.error(mensajeDuplicado, { id: 'carga-duplicada' });
        setBrincoDuplicado(false);
        const cuadro = requestAnimationFrame(() => setBrincoDuplicado(true));
        const finBrinco = setTimeout(() => setBrincoDuplicado(false), ERROR_SHAKE_DURATION_MS);
        const limpiar = () => limpiarDuplicadoRef.current?.();
        const vence = setTimeout(limpiar, 4000);
        // Después del clic que eligió la opción: ese clic no debe limpiar.
        const escuchar = setTimeout(() => document.addEventListener('pointerdown', limpiar), 0);
        return () => {
            cancelAnimationFrame(cuadro);
            clearTimeout(finBrinco);
            clearTimeout(vence);
            clearTimeout(escuchar);
            document.removeEventListener('pointerdown', limpiar);
        };
    }, [duplicadoTipoSeleccionado, mensajeDuplicado]);

    // Sin la validación nativa (noValidate): entero mayor a 0, con mensaje bajo el campo.
    const horasInvalidas = String(formData.horas ?? '') !== ''
        && (!Number.isInteger(Number(formData.horas)) || Number(formData.horas) < 1);
    const mensajeHorasInvalidas = horasInvalidas ? 'Ingrese un número entero de horas mayor a 0.' : '';
    const mensajeExcede = excedeObjetivoAnual ? `Con estas horas el fondo superaría las ${objetivoAnual} horas efectivas.` : '';
    useErrorEnVivo(mensajeHorasInvalidas, 'carga-horas-invalidas');
    const brincoExcede = useErrorEnVivo(mensajeExcede, 'carga-excede');
    const submitDisabled = isSubmitting
        || (requiereMateriaAcademica && !formData.calendario)
        || (requiereMateriaAcademica && !formData.materia)
        || (esClaseAula && !formData.paralelo)
        || (esSubactividadAcademica && !formData.titulo_actividad?.trim())
        || (!esAcademica && !formData.titulo_actividad?.trim())
        || (esAcademica && !formData.tipo_actividad)
        || (!esAcademica && !formData.tipo_actividad)
        || (formData.tipo_actividad === TIPO_OTROS && !descripcionOtrosValida(formData.titulo_actividad))
        || !formData.horas
        || Number(formData.horas) <= 0
        || horasInvalidas
        || duplicadoTipoSeleccionado
        || excedeObjetivoAnual;

    // Campos con el estilo del dashboard. El fondo va con "!" porque index.css pinta todos
    // los inputs y textarea en modo claro.
    const inputCls = "w-full h-11 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100 disabled:!bg-slate-100 disabled:text-slate-400";
    const textareaCls = "w-full min-h-[5rem] px-4 py-3 rounded-2xl text-sm text-slate-800 placeholder:text-slate-500 outline-none resize-y ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100 disabled:!bg-slate-100 disabled:text-slate-400";
    const labelCls = "block text-xs font-semibold text-slate-600 mb-1.5 pl-1";
    const horasAutomaticas = esAcademica && !esSubactividadAcademica;

    return (
        <div className="space-y-4">
            {/* Siempre montado para que el bloque crezca y se pliegue con animación; el
                -mb-4 compensa el espacio entre bloques cuando está plegado. */}
            <div className={`form-reveal-wrap -mb-4 ${duplicadoTipoSeleccionado ? 'is-open' : ''}`} aria-hidden={!duplicadoTipoSeleccionado}>
                <div>
                    <div className="pb-4">
                        <div className={`rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 ${brincoDuplicado ? ERROR_MOTION_CLASS : ''}`}>
                            {mensajeDuplicado}
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                    <label className={`${labelCls} flex items-center justify-between gap-2`}>
                        <span>Unidad</span>
                        <span className="font-medium text-slate-500 tabular-nums">Esta unidad: {totalUnidad} h/año</span>
                    </label>
                    <CustomSelect
                        value={formData.categoria}
                        options={categoriaOptions}
                        onChange={handleCategoriaChange}
                        placeholder="Seleccionar unidad"
                        disabled={isReadOnly}
                    />
                </div>

                {esAcademica ? (
                    <div key="academica" className="animate-campo-entrada space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Calendario</label>
                                <CustomSelect
                                    value={formData.calendario}
                                    options={calendarioOptions}
                                    onChange={handleCalendarioChange}
                                    placeholder="Calendario"
                                    disabled={isReadOnly}
                                    emptyText="La gestión no tiene calendarios académicos"
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Semestre / Nivel</label>
                                <SelectorRueda
                                    value={semestre}
                                    options={semestreOptions}
                                    onChange={(newValue) => {
                                        setSemestre(newValue);
                                        setFormData(prev => ({ ...prev, materia: '', titulo_actividad: '', horas: '' }));
                                    }}
                                    titulo="Semestre / Nivel"
                                    placeholder={loadingMaterias ? 'Cargando...' : (semestreOptions.length ? 'Nivel' : 'Sin niveles')}
                                    disabled={loadingMaterias || isReadOnly}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Sub-actividad académica</label>
                            <CustomSelect
                                value={formData.tipo_actividad}
                                options={tipoActividadOptions}
                                onChange={handleTipoActividadChange}
                                placeholder="Seleccionar sub-actividad"
                                disabled={isReadOnly}
                                escribible
                                emptyText="No hay sub-actividades configuradas"
                            />
                        </div>

                        {formData.tipo_actividad && (
                            <div className="animate-campo-entrada">
                                <label className={labelCls}>Materia (malla curricular)</label>
                                <CustomSelect
                                    value={selectedMateriaId}
                                    options={materiaOptions}
                                    onChange={handleMateriaChange}
                                    placeholder={!semestre ? 'Seleccione un nivel primero' : 'Seleccionar materia'}
                                    disabled={!semestre || isReadOnly}
                                    emptyText={!semestre ? 'Selecciona primero un nivel' : 'No hay materias en este nivel'}
                                />
                            </div>
                        )}

                        {formData.tipo_actividad === TIPO_OTROS && (
                            <div className="animate-campo-entrada">
                                <label className={labelCls}>Descripción de la actividad</label>
                                <input
                                    type="text"
                                    className={inputCls}
                                    placeholder="Describa la actividad académica"
                                    value={formData.titulo_actividad}
                                    onChange={e => setFormData({ ...formData, titulo_actividad: e.target.value })}
                                    disabled={isReadOnly}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div key={formData.categoria} className="animate-campo-entrada space-y-4">
                        <div>
                            <label className={labelCls}>Descripción de la actividad</label>
                            <input
                                type="text"
                                className={inputCls}
                                placeholder="Ej: Proyecto de investigación, extensión o gestión"
                                value={formData.titulo_actividad}
                                onChange={e => setFormData({ ...formData, titulo_actividad: e.target.value })}
                                disabled={isReadOnly}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>{configCategoria?.tipoLabel || 'Tipo'}</label>
                            <CustomSelect
                                value={formData.tipo_actividad}
                                options={tipoActividadOptions}
                                onChange={handleTipoActividadChange}
                                placeholder="Seleccionar tipo"
                                disabled={isReadOnly}
                                emptyText="No hay tipos configurados"
                            />
                        </div>
                        {configCategoria?.evidencias && (
                            <div className="animate-campo-entrada">
                                <label className={labelCls}>Evidencias</label>
                                <textarea
                                    className={textareaCls}
                                    placeholder="Detalle evidencias, productos esperados o respaldo documental"
                                    value={formData.evidencias}
                                    onChange={e => setFormData({ ...formData, evidencias: e.target.value })}
                                    disabled={isReadOnly}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Paralelo (solo clases en aula) y horas en una fila */}
                <div className="grid grid-cols-2 gap-4">
                    {esClaseAula && (
                        <div className="animate-campo-entrada">
                            <label className={labelCls}>Paralelo</label>
                            <CustomSelect
                                value={formData.paralelo}
                                options={paraleloOptions}
                                onChange={(paralelo) => setFormData(prev => ({ ...prev, paralelo }))}
                                placeholder="Paralelo"
                                disabled={isReadOnly}
                            />
                        </div>
                    )}
                    <div>
                        <label className={labelCls}>
                            Horas/año <span className="font-normal text-slate-500">({horasAutomaticas ? 'auto' : 'manual'})</span>
                        </label>
                        {horasAutomaticas ? (
                            <div key="auto" className="animate-campo-entrada flex h-11 items-center rounded-full bg-azulado-200 px-4 text-sm font-bold text-blue-900 tabular-nums">
                                {formData.horas || 0} h
                            </div>
                        ) : (
                            <input
                                key="manual"
                                type="number"
                                min="1"
                                step="1"
                                className={`animate-campo-entrada ${inputCls} font-bold text-blue-900 tabular-nums ${horasInvalidas ? ERROR_FIELD_BORDER_CLASS : ''}`}
                                aria-invalid={horasInvalidas || undefined}
                                placeholder="0"
                                value={formData.horas}
                                onChange={e => setFormData({ ...formData, horas: e.target.value })}
                                disabled={isReadOnly}
                            />
                        )}
                    </div>
                </div>
                <MensajeErrorCampo error={mensajeHorasInvalidas} />
                <p className="pl-1 text-xs leading-tight text-slate-500">
                    {horasAutomaticas
                        ? `Horas anuales = (HT + HP) x ${semanasDeClase(formData.calendario) || '20 (semestre) o 40 (anual)'} semanas`
                        : 'Horas por año del ítem: se suman al total de su unidad'}
                </p>
                {/* Siempre montado: crece y se pliega con animación (el -mb-4 compensa el
                    espacio entre bloques cuando está plegado). */}
                <div className={`form-reveal-wrap -mb-4 ${mensajeExcede ? 'is-open' : ''}`} aria-hidden={!mensajeExcede}>
                    <div>
                        <div className="pb-4">
                            <p className={`rounded-2xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 ${brincoExcede ? ERROR_MOTION_CLASS : ''}`}>
                                {mensajeExcede || `Con estas horas el fondo superaría las ${objetivoAnual} horas efectivas.`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className={`form-reveal-wrap -mb-4 ${errorGuardar ? 'is-open' : ''}`} aria-hidden={!errorGuardar}>
                    <div>
                        <div className="pb-4">
                            <p role="alert" className={`rounded-2xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 ${brincoGuardar ? ERROR_MOTION_CLASS : ''}`}>
                                {errorGuardar?.mensaje}
                            </p>
                        </div>
                    </div>
                </div>

                {!isReadOnly && (
                    <div className="flex justify-end pt-1">
                        <button data-escritura type="submit"
                            disabled={submitDisabled}
                            className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
                                submitDisabled
                                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                    : 'bg-blue-900 hover:bg-blue-950 text-white shadow-sm'
                            }`}>
                            {isSubmitting ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    Agregar asignación
                                </>
                            )}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default CargaHorariaManager;

