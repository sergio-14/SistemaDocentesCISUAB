import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { X } from 'lucide-react';
import api from '../../apis/api';
import { Link, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';

// Componente Select con diseÃ±o personalizado (mismo estilo que ListaDocentes)
const SelectConDropdown = ({ label, value, onChange, options, name, placeholder = 'Buscar...', emptyText = 'Sin resultados' }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const optionRefs = React.useRef({});
  const emptyValue = name === 'semestre' ? 'todos' : 'todas';
  const hasSelection = Boolean(value && value !== emptyValue);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearchTerm('');
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setSearchTerm('');
    inputRef.current?.focus();
    window.requestAnimationFrame(() => {
      optionRefs.current[String(value)]?.scrollIntoView({ block: 'center' });
    });
  }, [open, value]);

  const selectedLabel = value && options.find(opt => opt.value === value)?.label;
  const query = searchTerm.trim().toLowerCase();
  const visibleOptions = query
    ? options.filter((option) => option.label.toLowerCase().includes(query))
    : options;

  const handleSelect = (optionValue) => {
    onChange({ target: { name, value: optionValue } });
    setSearchTerm('');
    setOpen(false);
  };

  const clearSelection = (event) => {
    event.stopPropagation();
    onChange({ target: { name, value: emptyValue } });
    setSearchTerm('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label}</label>}
      
      {/* BotÃ³n principal */}
      <div className={`relative w-full min-w-[200px] rounded-xl border-2 bg-slate-50 dark:bg-slate-700 shadow-sm border-slate-300 dark:border-slate-600`}>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <input
            ref={inputRef}
            type="text"
            value={open ? searchTerm : (selectedLabel || '')}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setSearchTerm('');
              setOpen(true);
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-slate-800 dark:text-white placeholder-slate-400/70 dark:placeholder-slate-400/60 focus:outline-none"
          />
          {hasSelection && (
            <button
              type="button"
              onClick={clearSelection}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-white"
              title="Limpiar filtro"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="flex items-center justify-center h-6 w-6 rounded-md bg-[#2C4AAE] ring-1 ring-[#2C4AAE]">
            <svg className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>
      </div>

      {/* MenÃº desplegable */}
      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border-2 border-[#3A56AF] bg-white dark:bg-slate-900 shadow-xl">
          <div className="max-h-40 overflow-auto p-2">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <button
                  key={option.value}
                  ref={(element) => {
                    optionRefs.current[String(option.value)] = element;
                  }}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    option.value === value
                      ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 font-semibold'
                      : 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white dark:hover:bg-[#2C4AAE]'
                  }`}
                >
                  <span className="block truncate">{option.label}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{emptyText}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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

const getSemestreLabel = (semestre) => {
    const labels = {
        1: '1er Semestre',
        2: '2do Semestre',
        3: '3er Semestre',
        4: '4to Semestre',
        5: '5to Semestre',
        6: '6to Semestre',
        7: '7mo Semestre',
        8: '8vo Semestre',
        9: '9no Semestre',
        10: '10mo Semestre',
    };
    return labels[Number(semestre)] || `${semestre} Semestre`;
};

const MateriaList = ({ isDark, sidebarCollapsed = false }) => {
    const [materias, setMaterias] = useState([]);
    const [carreras, setCarreras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [semestreSeleccionado, setSemestreSeleccionado] = useState('todos');
    const [carreraSeleccionada, setCarreraSeleccionada] = useState('todas');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [materiaToDelete, setMateriaToDelete] = useState(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [perfil, setPerfil] = useState(null);

    const obtenerId = (valor) => {
        if (valor === null || valor === undefined || valor === '') return '';
        if (typeof valor === 'object') return valor.id?.toString?.() || valor.pk?.toString?.() || '';
        return valor.toString();
    };

    const obtenerCarreraPerfil = (perfilData, userData) => (
        obtenerId(perfilData?.carrera)
        || obtenerId(userData?.perfil?.carrera)
        || obtenerId(userData?.carrera)
        || obtenerId(localStorage.getItem('carrera_activa_id'))
    );

    const normalizarLista = (data) => data?.results || data || [];

    useEffect(() => {
        const fetchDatos = async () => {
            try {
                const localUser = JSON.parse(localStorage.getItem('user') || 'null');
                const [usuarioRes, perfilRes, resCarreras] = await Promise.all([
                    api.get('/usuario/').catch(() => ({ data: localUser })),
                    api.get('/perfil/').catch(() => null),
                    api.get('/carreras/'),
                ]);

                const userData = usuarioRes?.data || localUser;
                const perfilData = perfilRes?.data || userData?.perfil || null;
                const isSuperAdmin = userData?.is_superuser === true;
                const carreraPerfilId = obtenerCarreraPerfil(perfilData, userData);

                setUser(userData);
                setPerfil(perfilData);

                const carrerasData = normalizarLista(resCarreras.data);
                setCarreras(carrerasData);

                if (!isSuperAdmin && carreraPerfilId) {
                    setCarreraSeleccionada(carreraPerfilId);
                }

                // Cargar materias
                let allMaterias = [];
                const params = !isSuperAdmin && carreraPerfilId ? { carrera: carreraPerfilId } : {};
                let nextUrl = '/materias/';
                let firstRequest = true;

                while (nextUrl) {
                    const res = firstRequest ? await api.get(nextUrl, { params }) : await api.get(nextUrl);
                    firstRequest = false;
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
                console.error("Error cargando datos:", error);
                toast.error("Error al cargar datos");
            } finally {
                setLoading(false);
            }
        };
        fetchDatos();
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

    const isSuperAdmin = user?.is_superuser === true;
    const rolActual = perfil?.rol || user?.perfil?.rol || user?.rol;
    // iiisyp es solo lectura: solo superuser, director y jefe de estudios gestionan materias.
    const canEdit = isSuperAdmin || ['director', 'jefe_estudios'].includes(rolActual);
    const carreraPerfilId = obtenerCarreraPerfil(perfil, user);
    const debeOcultarFiltroCarrera = !isSuperAdmin && (['director', 'jefe_estudios'].includes(rolActual) || Boolean(carreraPerfilId));

    const carreraOptions = [...carreras]
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
        .map(c => ({ value: c.id?.toString() || c.codigo, label: c.nombre || c.nombre_corto || c.codigo }));

    const semestreOptions = [
        { value: 'todos', label: 'Todos los semestres' },
        ...Array.from({ length: 10 }, (_, index) => {
            const semestre = index + 1;
            return { value: semestre.toString(), label: getSemestreLabel(semestre) };
        }),
    ];

    // Filtrar materias por semestre y carrera seleccionada
    const materiasFiltradas = materias.filter(m => {
        const coincideSemestre = semestreSeleccionado === 'todos' || m.semestre.toString() === semestreSeleccionado;
        const carreraFiltro = debeOcultarFiltroCarrera ? carreraPerfilId : carreraSeleccionada;
        const coincideCarrera = carreraFiltro === 'todas' ||
                                !carreraFiltro ||
                                obtenerId(m.carrera) === carreraFiltro ||
                                m.carrera_id?.toString() === carreraFiltro;
        return coincideSemestre && coincideCarrera;
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
                                GestiÃ³n del catÃ¡logo de materias por carrera
                            </p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3 items-center">
                            {/* Filtro por Carrera */}
                            {isSuperAdmin && (
                                <div className="w-full sm:flex-1">
                                    <SelectConDropdown
                                      name="carrera"
                                      value={carreraSeleccionada}
                                      onChange={(e) => setCarreraSeleccionada(e.target.value)}
                                      options={[{ value: 'todas', label: 'Todas las carreras' }, ...carreraOptions]}
                                      placeholder="Buscar carrera..."
                                      emptyText="No hay carreras"
                                    />
                                </div>
                            )}

                            {/* Filtro por Semestre */}
                            <div className="w-full sm:w-auto">
                                <SelectConDropdown
                                  name="semestre"
                                  value={semestreSeleccionado}
                                  onChange={(e) => setSemestreSeleccionado(e.target.value)}
                                  options={semestreOptions}
                                  placeholder="Buscar semestre..."
                                  emptyText="No hay semestres"
                                />
                            </div>

                            {canEdit && (
                                <Link
                                    to="/fondo-tiempo/materias/nueva"
                                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    Nueva Materia
                                </Link>
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
                                            {getSemestreLabel(materia.semestre)}
                                        </span>
                                    </div>
                                    
                                    {/* TÃ­tulo */}
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
                                            <span className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-100 dark:border-indigo-800" title="Horas TeÃ³ricas">
                                                T: {materia.horas_teoricas}
                                            </span>
                                            <span className="px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-100 dark:border-emerald-800" title="Horas PrÃ¡cticas">
                                                P: {materia.horas_practicas}
                                            </span>
                                        </div>
                                        {canEdit && (
                                            <div className="flex gap-3 ml-4">
                                                <Link
                                                    to={`/fondo-tiempo/materias/editar/${materia.id}`}
                                                    className="text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-200 hover:scale-110"
                                                    title="Editar"
                                                >
                                                    <FaEdit size={18} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(materia)}
                                                    className="text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 transition-all duration-200 hover:scale-110"
                                                    title="Eliminar"
                                                >
                                                    <FaTrash size={18} />
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
                            {materias.length > 0 ? 'No hay materias en este semestre' : 'No hay materias registradas'}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            {materias.length > 0 ? 'Intenta seleccionar otro semestre o "Todos".' : 'Comienza agregando tu primera materia al sistema.'}
                        </p>
                        {canEdit && (
                            <Link 
                                to="/fondo-tiempo/materias/nueva" 
                                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
                            >
                                <PlusIcon className="w-5 h-5" />
                                Crear Primera Materia
                            </Link>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de ConfirmaciÃ³n de EliminaciÃ³n */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeDeleteModal} />
                    <div className="relative w-full max-w-lg rounded-2xl border border-red-300/40 dark:border-red-700/50 bg-slate-900 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '160ms' }}>
                        <div className="px-5 py-4 border-b border-slate-700/70 bg-gradient-to-r from-red-900/30 to-slate-900">
                            <h4 className="text-lg font-bold text-red-300 flex items-center gap-2">
                                <span>ðŸ—‘ï¸</span>
                                Confirmar EliminaciÃ³n
                            </h4>
                        </div>
                        <div className="px-5 py-4 space-y-3 text-slate-200">
                            <p className="text-sm leading-relaxed">
                                Se eliminarÃ¡ la materia <strong className="text-white">{materiaToDelete?.nombre}</strong> del sistema de forma permanente.
                            </p>
                            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
                                AcciÃ³n irreversible: <strong className="text-red-300">la materia quedarÃ¡ eliminada definitivamente.</strong>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Escribe el nombre exacto de la materia para habilitar la eliminaciÃ³n:
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
                                Esta operaciÃ³n no se puede deshacer.
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
                                ðŸ—‘ï¸ Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <Outlet />
        </div>
    );
};

export default MateriaList;
