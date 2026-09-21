import React, { useState, useEffect, useRef } from 'react';
import api from '../apis/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// --- ICONOS ---
const BookOpenIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.967 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
);

const PlusIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const ClockIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const AcademicCapIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.24 28.45 28.45 0 01-2.658.813m-15.482 0A28.33 28.33 0 0112 13.489a28.331 28.331 0 01-5.482-3.342z" />
    </svg>
);

const PencilIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const TrashIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const FilterIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
);

const ChevronDown = ({ open = false }) => (
    <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#263F8A]/10 dark:bg-[#263F8A]/25 ring-1 ring-[#263F8A]/35 dark:ring-[#263F8A]/45">
            <svg
                className={`w-3 h-3 text-[#263F8A] dark:text-[#8EA0D9] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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
    menuMaxHeight = 'max-h-56',
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const selected = options.find((opt) => opt.value?.toString() === value?.toString());

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
        <div ref={containerRef} className="relative w-full sm:w-[220px]">
            <button
                type="button"
                onClick={() => !disabled && setOpen((prev) => !prev)}
                disabled={disabled}
                className={`w-full text-left pl-3.5 pr-10 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-sm shadow-sm transition-all ${
                    disabled
                        ? 'border-slate-300/80 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
                        : open
                            ? 'border-blue-600 dark:border-blue-600 ring-2 ring-blue-500/35 dark:ring-blue-500/35 text-slate-900 dark:text-slate-100'
                            : 'border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-600 text-slate-800 dark:text-slate-100'
                }`}
            >
                <span className="block truncate font-semibold">{selected ? selected.label : placeholder}</span>
                <ChevronDown open={open} />
            </button>

            {open && !disabled && (
                <div className={`absolute z-30 mt-1.5 w-full overflow-auto rounded-xl border border-blue-400 dark:border-blue-700 bg-white dark:bg-slate-900 shadow-xl shadow-blue-500/20 dark:shadow-black/35 ${menuMaxHeight}`}>
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
                                            ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-200 font-semibold'
                                            : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800/90'
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

const MateriaList = ({ isDark }) => {
    const [materias, setMaterias] = useState([]);
    const [carreras, setCarreras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [semestreSeleccionado, setSemestreSeleccionado] = useState('todos');
    const [carreraSeleccionada, setCarreraSeleccionada] = useState('todas');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [materiaToDelete, setMateriaToDelete] = useState(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const [showMateriaModal, setShowMateriaModal] = useState(false);
    const [isSubmittingMateria, setIsSubmittingMateria] = useState(false);
    const [materiaFormData, setMateriaFormData] = useState({
        nombre: '',
        sigla: '',
        carrera: '',
        semestre: '',
        horas_teoricas: 0,
        horas_practicas: 0,
    });
    const [materiaFormErrors, setMateriaFormErrors] = useState({});

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem('user') || 'null');
        setUser(userData);
        const fetchMaterias = async () => {
            try {
                let allMaterias = [];
                let nextUrl = '/materias/';

                while (nextUrl) {
                    const res = await api.get(nextUrl);
                    const data = res.data;
                    if (data.results) {
                        allMaterias = [...allMaterias, ...data.results];
                        nextUrl = data.next;
                    } else {
                        allMaterias = Array.isArray(data) ? data : [];
                        nextUrl = null;
                    }
                }
                setMaterias(allMaterias);
            } catch (error) {
                console.error("Error cargando materias:", error);
                toast.error("Error al cargar materias");
            }
        };

        const fetchCarreras = async () => {
            try {
                const res = await api.get('/carreras/');
                const carrerasData = res.data?.results || res.data || [];
                setCarreras(Array.isArray(carrerasData) ? carrerasData : []);
            } catch (error) {
                console.error("Error cargando carreras:", error);
                toast.error("Error al cargar carreras");
            }
        };

        Promise.all([fetchMaterias(), fetchCarreras()]).finally(() => {
            setLoading(false);
        });
    }, []);

    const handleDelete = (materia) => {
        setMateriaToDelete(materia);
        setDeleteConfirmText('');
        setShowDeleteModal(true);
    };

    const closeDeleteModal = () => {
        setShowDeleteModal(false);
        setMateriaToDelete(null);
        setDeleteConfirmText('');
    };

    const confirmarEliminar = async () => {
        if (!materiaToDelete) return;
        if (deleteConfirmText !== materiaToDelete.nombre) {
            toast.error('Debes escribir exactamente el nombre de la materia para confirmar');
            return;
        }
        try {
            await api.delete(`/materias/${materiaToDelete.id}/`);
            setMaterias(materias.filter(m => m.id !== materiaToDelete.id));
            toast.success('Materia eliminada correctamente');
            closeDeleteModal();
        } catch (error) {
            console.error("Error eliminando materia:", error);
            toast.error('Error al eliminar materia');
        }
    };

    // iiisyp es solo lectura: solo superuser y director pueden editar/eliminar materias
    const canEdit = user?.is_superuser || user?.perfil?.rol === 'director';

    const getMateriaCarreraId = (materia) => {
        if (!materia) return '';
        if (typeof materia.carrera === 'object' && materia.carrera !== null) {
            return String(materia.carrera.id || '');
        }
        return String(materia.carrera || '');
    };

    // Obtener lista de semestres únicos para el filtro
    const semestresDisponibles = [...new Set(materias.map(m => m.semestre))].sort((a, b) => a - b);
    const semestresOptions = [
        { value: 'todos', label: 'Todos los Semestres' },
        ...semestresDisponibles.map((s) => ({ value: String(s), label: `${s}º Semestre` })),
    ];

    // Obtener carreras disponibles priorizando el catálogo del backend
    const carrerasDisponibles = carreras.length > 0
        ? carreras
        : [...new Map(
            materias
                .filter(m => getMateriaCarreraId(m))
                .map(m => [getMateriaCarreraId(m), { id: getMateriaCarreraId(m), nombre: m.carrera_nombre || `Carrera ${getMateriaCarreraId(m)}` }])
        ).values()];
    const carrerasOptions = [
        { value: 'todas', label: 'Todas las Carreras' },
        ...carrerasDisponibles.map((c) => ({ value: String(c.id), label: c.nombre })),
    ];
    const carreraFormOptions = carrerasDisponibles.map((c) => ({ value: String(c.id), label: c.nombre }));
    const semestreFormOptions = Array.from({ length: 12 }, (_, index) => {
        const value = String(index + 1);
        return { value, label: `${value}º Semestre` };
    });

    const openMateriaModal = () => {
        const carreraInicial = carreraSeleccionada !== 'todas'
            ? carreraSeleccionada
            : (carrerasDisponibles[0] ? String(carrerasDisponibles[0].id) : '');

        setMateriaFormData({
            nombre: '',
            sigla: '',
            carrera: carreraInicial,
            semestre: '',
            horas_teoricas: 0,
            horas_practicas: 0,
        });
        setMateriaFormErrors({});
        setShowMateriaModal(true);
    };

    const closeMateriaModal = () => {
        setShowMateriaModal(false);
        setMateriaFormErrors({});
        setIsSubmittingMateria(false);
    };

    const handleMateriaFieldChange = (event) => {
        const { name, value } = event.target;
        setMateriaFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleMateriaSelectChange = (fieldName, value) => {
        setMateriaFormData((prev) => ({ ...prev, [fieldName]: value }));
    };

    const handleCreateMateria = async (event) => {
        event.preventDefault();
        setIsSubmittingMateria(true);
        setMateriaFormErrors({});

        const payload = {
            ...materiaFormData,
            carrera: materiaFormData.carrera ? Number(materiaFormData.carrera) : materiaFormData.carrera,
            semestre: materiaFormData.semestre ? Number(materiaFormData.semestre) : materiaFormData.semestre,
            horas_teoricas: Number(materiaFormData.horas_teoricas || 0),
            horas_practicas: Number(materiaFormData.horas_practicas || 0),
        };

        try {
            const response = await api.post('/materias/', payload);
            if (response.status !== 201) {
                throw new Error('Respuesta inesperada al crear materia');
            }
            setMaterias((prev) => [...prev, response.data]);
            toast.success('Materia creada correctamente');
            closeMateriaModal();
        } catch (err) {
            console.error(err);
            const apiErrors = err.response?.data;
            if (apiErrors) {
                setMateriaFormErrors(apiErrors);
                Object.keys(apiErrors).forEach((key) => {
                    const message = Array.isArray(apiErrors[key]) ? apiErrors[key].join(' ') : String(apiErrors[key]);
                    if (key === 'non_field_errors') {
                        toast.error(message);
                    } else {
                        toast.error(`Error en ${key}: ${message}`);
                    }
                });
            } else {
                toast.error('Ocurrió un error inesperado.');
            }
        } finally {
            setIsSubmittingMateria(false);
        }
    };

    // Filtrar materias
    const materiasFiltradas = materias.filter(m => {
        const cumpleSemestre = semestreSeleccionado === 'todos' || m.semestre.toString() === semestreSeleccionado;
        const cumpleCarrera = carreraSeleccionada === 'todas' || getMateriaCarreraId(m) === carreraSeleccionada;
        return cumpleSemestre && cumpleCarrera;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-700 dark:text-slate-300">Cargando materias...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent flex items-center gap-3">
                                <BookOpenIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                Materias y Asignaturas
                            </h1>
                            <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                                Gestión del catálogo de materias por carrera
                            </p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3 items-center">
                            {/* Filtro por Semestre */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <FilterIcon className="h-5 w-5 text-slate-500 dark:text-slate-300" />
                                <CustomSelect
                                    value={semestreSeleccionado}
                                    options={semestresOptions}
                                    onChange={setSemestreSeleccionado}
                                    placeholder="Selecciona semestre"
                                />
                            </div>

                            {/* Filtro por Carrera */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <AcademicCapIcon className="h-5 w-5 text-slate-500 dark:text-slate-300" />
                                <CustomSelect
                                    value={carreraSeleccionada}
                                    options={carrerasOptions}
                                    onChange={setCarreraSeleccionada}
                                    placeholder="Selecciona carrera"
                                />
                            </div>

                            {canEdit && (
                                <button
                                    type="button"
                                    onClick={openMateriaModal}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    Nueva Materia
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grid de Materias */}
                {materiasFiltradas.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {materiasFiltradas.map((materia) => (
                            <div 
                                key={materia.id} 
                                className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-700 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group"
                            >
                                <div className="p-5">
                                    {/* Badges Superiores */}
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                            {materia.sigla}
                                        </span>
                                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                            {materia.semestre}º Semestre
                                        </span>
                                    </div>
                                    
                                    {/* Título */}
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {materia.nombre}
                                    </h3>
                                    
                                    {/* Carrera */}
                                    <div className="flex items-center gap-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                                        <AcademicCapIcon className="w-4 h-4" />
                                        <span className="truncate">{materia.carrera_nombre || materia.carrera}</span>
                                    </div>

                                    {/* Footer con Horas */}
                                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                        <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                            <ClockIcon className="w-4 h-4" />
                                            <span>Carga Horaria:</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-100 dark:border-indigo-800" title="Horas Teóricas">
                                                T: {materia.horas_teoricas}
                                            </span>
                                            <span className="px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-100 dark:border-emerald-800" title="Horas Prácticas">
                                                P: {materia.horas_practicas}
                                            </span>
                                        </div>
                                        {canEdit && (
                                            <div className="flex gap-2 ml-4">
                                                <Link 
                                                    to={`/fondo-tiempo/materias/editar/${materia.id}`}
                                                    className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                                    title="Editar"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </Link>
                                                <button 
                                                    onClick={() => handleDelete(materia)}
                                                    className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 p-12 text-center shadow-md">
                        <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center mx-auto mb-4">
                            <BookOpenIcon className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                            {materias.length > 0 ? 'No hay materias con los filtros seleccionados' : 'No hay materias registradas'}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            {materias.length > 0 ? 'Prueba con otro semestre o cambia la carrera seleccionada.' : 'Comienza agregando tu primera materia al sistema.'}
                        </p>
                        {canEdit && (
                            <button
                                type="button"
                                onClick={openMateriaModal}
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                            >
                                <PlusIcon className="w-5 h-5" />
                                Crear Primera Materia
                            </button>
                        )}
                    </div>
                )}
            </div>

            {showMateriaModal && (
                <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md transition-all duration-300" onClick={closeMateriaModal} />
                    <div className="relative w-full max-w-3xl bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '180ms' }}>
                        <div className="relative px-6 py-5 border-b border-[#7F97E8]/45 bg-[#2C4AAE] shadow-lg">
                            <div className="absolute inset-0 bg-white/5 dark:bg-white/[0.02]"></div>
                            <h3 className="relative text-xl font-bold text-slate-100 flex items-center gap-3">
                                <span className="text-2xl">📚</span>
                                Nueva Materia
                            </h3>
                        </div>

                        <form onSubmit={handleCreateMateria} className="p-6 md:p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold mb-2.5 text-slate-700 dark:text-slate-200">Nombre de la Materia <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="nombre"
                                        value={materiaFormData.nombre}
                                        onChange={handleMateriaFieldChange}
                                        required
                                        className={`w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all shadow-sm dark:shadow-lg ${materiaFormErrors.nombre ? 'border-red-500 dark:border-red-600' : 'border-blue-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-slate-500'}`}
                                    />
                                    {materiaFormErrors.nombre && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{Array.isArray(materiaFormErrors.nombre) ? materiaFormErrors.nombre.join(' ') : materiaFormErrors.nombre}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2.5 text-slate-700 dark:text-slate-200">Sigla <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="sigla"
                                        value={materiaFormData.sigla}
                                        onChange={handleMateriaFieldChange}
                                        required
                                        className={`w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all shadow-sm dark:shadow-lg ${materiaFormErrors.sigla ? 'border-red-500 dark:border-red-600' : 'border-blue-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-slate-500'}`}
                                    />
                                    {materiaFormErrors.sigla && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{Array.isArray(materiaFormErrors.sigla) ? materiaFormErrors.sigla.join(' ') : materiaFormErrors.sigla}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2.5 text-slate-700 dark:text-slate-200">Seleccionar Carrera <span className="text-red-500">*</span></label>
                                    <CustomSelect
                                        value={String(materiaFormData.carrera || '')}
                                        options={carreraFormOptions}
                                        onChange={(value) => handleMateriaSelectChange('carrera', value)}
                                        placeholder="Seleccione una carrera"
                                    />
                                    {materiaFormErrors.carrera && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{Array.isArray(materiaFormErrors.carrera) ? materiaFormErrors.carrera.join(' ') : materiaFormErrors.carrera}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2.5 text-slate-700 dark:text-slate-200">Seleccionar Semestre <span className="text-red-500">*</span></label>
                                    <CustomSelect
                                        value={String(materiaFormData.semestre || '')}
                                        options={semestreFormOptions}
                                        onChange={(value) => handleMateriaSelectChange('semestre', value)}
                                        placeholder="Seleccione semestre"
                                    />
                                    {materiaFormErrors.semestre && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{Array.isArray(materiaFormErrors.semestre) ? materiaFormErrors.semestre.join(' ') : materiaFormErrors.semestre}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2.5 text-slate-700 dark:text-slate-200">Horas Prácticas <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        name="horas_practicas"
                                        value={materiaFormData.horas_practicas}
                                        onChange={handleMateriaFieldChange}
                                        required
                                        className={`w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all shadow-sm dark:shadow-lg ${materiaFormErrors.horas_practicas ? 'border-red-500 dark:border-red-600' : 'border-blue-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-slate-500'}`}
                                    />
                                    {materiaFormErrors.horas_practicas && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{Array.isArray(materiaFormErrors.horas_practicas) ? materiaFormErrors.horas_practicas.join(' ') : materiaFormErrors.horas_practicas}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-2.5 text-slate-700 dark:text-slate-200">Horas Teóricas <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        name="horas_teoricas"
                                        value={materiaFormData.horas_teoricas}
                                        onChange={handleMateriaFieldChange}
                                        required
                                        className={`w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all shadow-sm dark:shadow-lg ${materiaFormErrors.horas_teoricas ? 'border-red-500 dark:border-red-600' : 'border-blue-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-slate-500'}`}
                                    />
                                    {materiaFormErrors.horas_teoricas && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{Array.isArray(materiaFormErrors.horas_teoricas) ? materiaFormErrors.horas_teoricas.join(' ') : materiaFormErrors.horas_teoricas}</p>}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-blue-200/50 dark:border-blue-800/50 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeMateriaModal}
                                    className="px-6 py-3 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold border border-slate-300 dark:border-slate-600 transition-all duration-200 hover:shadow-md"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingMateria}
                                    className="px-6 py-3 bg-[#4654E8] hover:bg-[#3D47D1] text-white font-semibold rounded-xl shadow-[0_8px_20px_rgba(70,84,232,0.35)] hover:shadow-[0_8px_20px_rgba(70,84,232,0.5)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmittingMateria ? '⏳ Guardando...' : '💾 Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Eliminación */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeDeleteModal} />
                    <div className="relative w-full max-w-lg rounded-2xl border border-red-300/40 dark:border-red-700/50 bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
                        <div className="px-5 py-4 border-b border-slate-700/70 bg-gradient-to-r from-red-900/30 to-slate-900">
                            <h4 className="text-lg font-bold text-red-300 flex items-center gap-2">
                                <span>🗑️</span>
                                Confirmar Eliminación
                            </h4>
                        </div>
                        <div className="px-5 py-4 space-y-3 text-slate-200">
                            <p className="text-sm leading-relaxed">
                                Se eliminará la materia <strong className="text-white">{materiaToDelete?.nombre}</strong> del sistema de forma permanente.
                            </p>
                            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
                                Acción irreversible: <strong className="text-red-300">la materia quedará eliminada definitivamente.</strong>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Escribe el nombre exacto de la materia para habilitar la eliminación:
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="Escribe el nombre de la materia para confirmar"
                                    className="w-full px-3 py-2 rounded-lg border border-red-400/40 bg-slate-800 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/60"
                                />
                            </div>
                            <p className="text-xs text-slate-400">
                                Esta operación no se puede deshacer.
                            </p>
                        </div>
                        <div className="px-5 py-4 border-t border-slate-700/70 flex justify-end gap-3 bg-slate-950/70">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                className="px-4 py-2 rounded-lg font-semibold text-slate-300 border border-slate-600 hover:bg-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmarEliminar}
                                disabled={deleteConfirmText !== (materiaToDelete?.nombre || '')}
                                className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:bg-red-900/40 disabled:text-slate-300 disabled:cursor-not-allowed"
                            >
                                🗑️ Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MateriaList;