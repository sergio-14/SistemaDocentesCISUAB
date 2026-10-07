import { useState, useEffect, useRef } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import api, { getCarreras } from '../../apis/api';
import { Link, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useActiveRole } from '../../contexts/activeRole';
import CampoBusqueda from '../common/CampoBusqueda';
import FiltroDesplegable from '../common/FiltroDesplegable';
import Interruptor from '../common/Interruptor';
import ModalCentrado from '../common/ModalCentrado';
import NumeroAnimado from '../common/NumeroAnimado';
import Paginacion from '../common/Paginacion';
import SelectorVista from '../common/SelectorVista';
import { BLOQUE, BOTON, BOTON_CHICO } from '../fondos/estilosFondo';
import { paginar } from '../../utils/paginacion';

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

const VISTA_MATERIAS_KEY = 'materias_vista';

const PildoraEstado = ({ activa }) => (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
        activa ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-300'
    }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${activa ? 'bg-emerald-600' : 'bg-slate-400'}`} />
        {activa ? 'Activa' : 'Inactiva'}
    </span>
);

const MateriaList = () => {
    const [materias, setMaterias] = useState([]);
    const [carreras, setCarreras] = useState([]);
    const [loading, setLoading] = useState(true);
    // '' = todos los semestres / todas las carreras.
    const [semestreSeleccionado, setSemestreSeleccionado] = useState('');
    const [carreraSeleccionada, setCarreraSeleccionada] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [materiaToDelete, setMateriaToDelete] = useState(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    // Tarjetas o lista, como en el dashboard (15 por página en lista y 9 en tarjetas).
    const [vista, setVista] = useState(() => {
        try {
            return localStorage.getItem(VISTA_MATERIAS_KEY) === 'lista' ? 'lista' : 'tarjetas';
        } catch {
            return 'tarjetas';
        }
    });
    const [pagina, setPagina] = useState(1);
    const listaRef = useRef(null);
    // Rol y carrera ACTIVOS (contexto de rol), no el perfil base ni localStorage('user').
    const { activeRole, activeCareerId, effectiveUser } = useActiveRole();

    const obtenerId = (valor) => {
        if (valor === null || valor === undefined || valor === '') return '';
        if (typeof valor === 'object') return valor.id?.toString?.() || valor.pk?.toString?.() || '';
        return valor.toString();
    };

    const isSuperAdmin = effectiveUser?.is_superuser === true;
    const carreraPerfilId = obtenerId(activeCareerId);

    const cambiarVista = (nuevaVista) => {
        setVista(nuevaVista);
        setPagina(1);
        try {
            localStorage.setItem(VISTA_MATERIAS_KEY, nuevaVista);
        } catch {
            // Sin almacenamiento disponible la vista simplemente no se recuerda.
        }
    };

    useEffect(() => {
        setPagina(1);
    }, [semestreSeleccionado, carreraSeleccionada, busqueda]);

    useEffect(() => {
        const fetchDatos = async () => {
            try {
                setCarreras(await getCarreras());

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
    }, [isSuperAdmin, carreraPerfilId]);

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
            // Con cargas horarias el backend responde 409 con el motivo (desactivarla).
            toast.error(error.response?.data?.detail || 'Error al eliminar materia');
        }
    };

    // Inactiva: no se asigna en cargas nuevas, pero se conserva en las que ya tiene.
    const cambiarActivo = async (materia) => {
        try {
            const { data } = await api.patch(`/materias/${materia.id}/`, { activo: !materia.activo });
            setMaterias((prev) => prev.map((m) => (m.id === data.id ? { ...m, ...data } : m)));
            toast.success(data.activo ? 'Materia activada' : 'Materia desactivada');
        } catch (error) {
            console.error('Error cambiando el estado de la materia:', error);
            toast.error(error.response?.data?.detail || 'No se pudo cambiar el estado de la materia');
        }
    };

    const rolActual = activeRole;
    // iiisyp es solo lectura: solo superuser, director y jefe de estudios gestionan materias.
    const canEdit = isSuperAdmin || ['director', 'jefe_estudios'].includes(rolActual);
    const debeOcultarFiltroCarrera = !isSuperAdmin && (['director', 'jefe_estudios'].includes(rolActual) || Boolean(carreraPerfilId));

    const carreraOptions = [...carreras]
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
        .map(c => ({ value: c.id?.toString() || c.codigo, label: c.nombre || c.nombre_corto || c.codigo }));

    const semestreOptions = Array.from({ length: 10 }, (_, index) => {
        const semestre = index + 1;
        return { value: semestre.toString(), label: getSemestreLabel(semestre) };
    });

    // Filtrar materias por búsqueda (nombre o sigla, sin importar mayúsculas ni tildes),
    // semestre y carrera seleccionada
    const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const textoBusqueda = normalizar(busqueda.trim());
    const carreraFiltro = debeOcultarFiltroCarrera ? carreraPerfilId : carreraSeleccionada;
    const materiasFiltradas = materias.filter(m => {
        if (textoBusqueda && !normalizar(`${m.nombre} ${m.sigla}`).includes(textoBusqueda)) return false;
        const coincideSemestre = !semestreSeleccionado || m.semestre.toString() === semestreSeleccionado;
        const coincideCarrera = !carreraFiltro ||
                                obtenerId(m.carrera) === carreraFiltro ||
                                m.carrera_id?.toString() === carreraFiltro;
        return coincideSemestre && coincideCarrera;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[50vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
                    <p className="mt-4 text-slate-600">Cargando materias...</p>
                </div>
            </div>
        );
    }

    const totalActivas = materiasFiltradas.filter((m) => m.activo !== false).length;
    const nombreCarrera = carreraOptions.find((opt) => String(opt.value) === String(carreraSeleccionada))?.label;
    const subtituloTotal = [
        isSuperAdmin ? (nombreCarrera || 'Todas las carreras') : 'Tu carrera',
        semestreSeleccionado ? getSemestreLabel(semestreSeleccionado) : null,
    ].filter(Boolean).join(' · ');

    const { paginaActual, totalPaginas, inicio, itemsPagina: materiasPagina } = paginar(materiasFiltradas, pagina, vista);
    const irAPagina = (nuevaPagina) => {
        setPagina(nuevaPagina);
        listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const claveVista = `${carreraSeleccionada}-${semestreSeleccionado}-${paginaActual}`;

    const horasTotales = (materia) => Number(materia.horas_teoricas || 0) + Number(materia.horas_practicas || 0);

    const interruptorEstado = (materia) => (
        <span data-escritura className="flex items-center gap-2.5">
            <Interruptor
                chico
                isActive={materia.activo !== false}
                onChange={() => cambiarActivo(materia)}
                etiqueta={materia.activo === false ? 'Activar materia' : 'Desactivar materia'}
            />
            <span className="text-xs text-slate-700">{materia.activo === false ? 'Inactiva' : 'Activa'}</span>
        </span>
    );

    const botonesMateria = (materia) => (
        <div className="flex flex-wrap gap-2">
            <Link data-escritura
                to={`/fondo-tiempo/materias/editar/${materia.id}`}
                className={`${BOTON_CHICO} bg-emerald-500 hover:bg-emerald-600 text-white`}
            >
                <FaEdit size={12} />
                <span>Editar</span>
            </Link>
            <button data-escritura
                type="button"
                onClick={() => handleDelete(materia)}
                className={`${BOTON_CHICO} bg-red-400 hover:bg-red-500 text-white`}
            >
                <FaTrash size={11} />
                <span>Eliminar</span>
            </button>
        </div>
    );

    const columnasLista = canEdit
        ? 'xl:grid-cols-[minmax(0,2.4fr)_8rem_5rem_5rem_5rem_7.5rem_11rem]'
        : 'xl:grid-cols-[minmax(0,2.4fr)_8rem_5rem_5rem_5rem_7.5rem]';

    return (
        <div className="min-h-full w-full max-w-[92rem] mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-6 text-slate-800">
            <div className="space-y-4">
                {/* Bloque 1: encabezado con la acción y, al lado, el total (como el dashboard de fondos) */}
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
                    <div className={`${BLOQUE} p-5 sm:p-6`}>
                        <div className="flex flex-wrap items-center justify-between gap-5">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
                                    <BookOpenIcon className="w-7 h-7" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                                        Catálogo de materias por carrera
                                    </p>
                                    <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">
                                        Materias
                                    </h2>
                                </div>
                            </div>
                            {canEdit && (
                                <Link data-escritura
                                    to="/fondo-tiempo/materias/nueva"
                                    className={`${BOTON} w-full sm:w-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    <span>Nueva Materia</span>
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Total según los filtros; al cambiarlos los números cuentan hasta el nuevo valor. */}
                    <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Materias</p>
                                <p
                                    key={subtituloTotal}
                                    className="animate-campo-entrada mt-1.5 text-sm font-semibold text-white leading-snug line-clamp-2"
                                    title={subtituloTotal}
                                >
                                    {subtituloTotal}
                                </p>
                            </div>
                            <span className="text-5xl font-bold tabular-nums leading-none">
                                <NumeroAnimado valor={materiasFiltradas.length} />
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                <NumeroAnimado valor={totalActivas} singular="activa" plural="activas" />
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                <NumeroAnimado valor={materiasFiltradas.length - totalActivas} singular="inactiva" plural="inactivas" />
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bloque 2: búsqueda, filtros (carrera solo para el superusuario) y vista */}
                <div className={`${BLOQUE} p-3 flex flex-wrap items-center gap-2 sm:gap-3`}>
                    <CampoBusqueda
                        value={busqueda}
                        onChange={setBusqueda}
                        placeholder="Buscar materia o sigla"
                        className="w-full lg:w-auto lg:flex-1 lg:max-w-sm"
                    />
                    {isSuperAdmin && (
                        <div className="min-w-0 w-full sm:w-72">
                            <FiltroDesplegable
                                value={carreraSeleccionada}
                                onChange={setCarreraSeleccionada}
                                options={carreraOptions}
                                placeholder="Todas las carreras"
                                ariaLabel="Filtrar por carrera"
                                emptyText="No hay carreras que coincidan"
                            />
                        </div>
                    )}
                    <div className="min-w-0 flex-1 sm:flex-none sm:w-56">
                        <FiltroDesplegable
                            value={semestreSeleccionado}
                            onChange={setSemestreSeleccionado}
                            options={semestreOptions}
                            placeholder="Todos los semestres"
                            ariaLabel="Filtrar por semestre"
                            emptyText="No hay semestres que coincidan"
                        />
                    </div>
                    <SelectorVista vista={vista} onCambiar={cambiarVista} className="ml-auto" />
                </div>

                {/* Bloque 3: materias en tarjetas o en lista; al cambiar de filtro, vista o página
                    entran escalonadas */}
                <div ref={listaRef} className="scroll-mt-4" />
                {materiasFiltradas.length > 0 ? (
                    vista === 'lista' ? (
                        // Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas.
                        <div key={`lista-${claveVista}`} className={`${BLOQUE} p-2 sm:p-3`}>
                            <div className={`hidden xl:grid ${columnasLista} gap-4 px-3 pt-3 pb-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 [border-bottom:1px_solid_#B8C9E1]`}>
                                <span>Materia</span>
                                <span>Semestre</span>
                                <span>H. teóricas</span>
                                <span>H. prácticas</span>
                                <span>Total</span>
                                <span>Estado</span>
                                {canEdit && <span>Acciones</span>}
                            </div>
                            <div className="divide-y divide-azulado-300">
                                {materiasPagina.map((materia, indice) => {
                                    const datos = [
                                        { label: 'Semestre', valor: getSemestreLabel(materia.semestre) },
                                        { label: 'H. teóricas', valor: materia.horas_teoricas },
                                        { label: 'H. prácticas', valor: materia.horas_practicas },
                                        { label: 'Total', valor: `${horasTotales(materia)} h/sem` },
                                    ];
                                    return (
                                        <div
                                            key={materia.id}
                                            style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                                            className={`animate-fondo-entrada grid grid-cols-1 ${columnasLista} items-center gap-x-4 gap-y-3 px-3 py-4 rounded-2xl hover:bg-azulado-100/70 transition-colors`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="flex h-8 flex-shrink-0 items-center justify-center rounded-lg bg-sky-600 px-2 text-white text-[11px] font-bold">
                                                    {materia.sigla}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-blue-900 truncate" title={materia.nombre}>{materia.nombre}</div>
                                                    <div className="text-sm text-slate-600 truncate">{materia.carrera_nombre || materia.carrera}</div>
                                                </div>
                                            </div>
                                            {datos.map((dato) => (
                                                <div key={dato.label} className="min-w-0 flex items-baseline justify-between gap-3 xl:block">
                                                    <span className="xl:hidden text-xs font-semibold text-blue-800">{dato.label}</span>
                                                    <span className="block text-tabla font-semibold text-slate-800 tabular-nums">{dato.valor}</span>
                                                </div>
                                            ))}
                                            <div>{canEdit ? interruptorEstado(materia) : <PildoraEstado activa={materia.activo !== false} />}</div>
                                            {canEdit && botonesMateria(materia)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div key={`tarjetas-${claveVista}`} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                            {materiasPagina.map((materia, indice) => (
                                <div
                                    key={materia.id}
                                    style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                                    className={`${BLOQUE} animate-fondo-entrada p-5 flex flex-col gap-4`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex h-9 flex-shrink-0 items-center justify-center rounded-xl bg-sky-600 px-2.5 text-white text-xs font-bold">
                                                {materia.sigla}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-bold text-blue-900 leading-tight line-clamp-2" title={materia.nombre}>{materia.nombre}</h3>
                                                <p className="text-sm text-slate-600 truncate">{materia.carrera_nombre || materia.carrera}</p>
                                            </div>
                                        </div>
                                        <PildoraEstado activa={materia.activo !== false} />
                                    </div>

                                    <dl className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-azulado-300 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 py-2.5">
                                        {[
                                            { label: 'Semestre', valor: `${materia.semestre}°` },
                                            { label: 'Teóricas', valor: `${materia.horas_teoricas} h` },
                                            { label: 'Prácticas', valor: `${materia.horas_practicas} h` },
                                            { label: 'Total', valor: `${horasTotales(materia)} h/sem` },
                                        ].map((dato) => (
                                            <div key={dato.label} className="min-w-0 px-3 py-1 sm:py-0 text-center">
                                                <dt className="text-xs font-semibold text-blue-800">{dato.label}</dt>
                                                <dd className="mt-0.5 text-[13px] font-semibold text-slate-800 tabular-nums">{dato.valor}</dd>
                                            </div>
                                        ))}
                                    </dl>

                                    {canEdit && (
                                        <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-2 [border-top:1px_solid_#B8C9E1]">
                                            {interruptorEstado(materia)}
                                            {botonesMateria(materia)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                            {materias.length > 0 ? 'No hay materias con estos filtros' : 'No hay materias registradas'}
                        </h3>
                        <p className="text-slate-600">
                            {materias.length > 0 ? 'Prueba con otra búsqueda, semestre o carrera.' : 'Comienza agregando la primera materia.'}
                        </p>
                        {canEdit && materias.length === 0 && (
                            <Link data-escritura
                                to="/fondo-tiempo/materias/nueva"
                                className={`${BOTON} mt-6 px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
                            >
                                <PlusIcon className="w-5 h-5" />
                                <span>Crear primera materia</span>
                            </Link>
                        )}
                    </div>
                )}

                <Paginacion
                    paginaActual={paginaActual}
                    totalPaginas={totalPaginas}
                    inicio={inicio}
                    cantidad={materiasPagina.length}
                    total={materiasFiltradas.length}
                    nombre="materias"
                    onCambiar={irAPagina}
                />
            </div>

            {/* Confirmación de eliminación */}
            {showDeleteModal && (
                <ModalCentrado onClose={closeDeleteModal}>
                    <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '160ms' }}>
                        <div className="px-6 pt-6">
                            <h4 className="text-xl font-bold text-red-700">Confirmar eliminación</h4>
                            <p className="mt-1 text-sm text-slate-600">
                                Se eliminará la materia <strong className="text-slate-900">{materiaToDelete?.nombre}</strong> de forma permanente.
                            </p>
                        </div>
                        <div className="px-6 py-4 space-y-3 text-sm">
                            <div className="rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-3 text-red-800">
                                Acción irreversible: <strong>la materia quedará eliminada definitivamente.</strong>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">
                                    Escribe el nombre exacto de la materia para habilitar la eliminación:
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder={materiaToDelete?.nombre || ''}
                                    className="w-full h-11 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-red-400/50 !bg-azulado-100"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmarEliminar}
                                disabled={deleteConfirmText !== (materiaToDelete?.nombre || '')}
                                className={`${BOTON} px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500`}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </ModalCentrado>
            )}
            <Outlet />
        </div>
    );
};

export default MateriaList;
