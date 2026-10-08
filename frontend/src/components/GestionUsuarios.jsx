import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash } from 'react-icons/fa';
import api, { getCarreras, getDocentes, obtenerTodos } from '../apis/api';
import ModalUsuario from './ModalUsuario';
import { EVENTO_FOTO_PERFIL_ACTUALIZADA } from './ProfilePicture';
import {
  MENSAJE_AUTORIDAD_UNICA, MENSAJE_DUPLICADO, MENSAJE_RESOLUCION_JEFE,
  ROLES_MANDO_UABJB, cargosDelUsuario, cuerpoConArchivo, esArchivoPdf, motivoNoAsignarRol, textoErroresUsuario,
} from '../utils/asignacionesUsuario';
import CampoUsuario from './usuarios/CampoUsuario';
import { SeccionUsuario } from './usuarios/PiezasFormularioUsuario';
import ListaTransferenciaRoles from './usuarios/ListaTransferenciaRoles';
import { useActiveRole } from '../contexts/activeRole';
import CampoResolucionJefe from './common/CampoResolucionJefe';
import CampoBusqueda from './common/CampoBusqueda';
import FiltroDesplegable from './common/FiltroDesplegable';
import Interruptor from './common/Interruptor';
import ModalCentrado from './common/ModalCentrado';
import ModalConfirmar from './common/ModalConfirmar';
import NumeroAnimado from './common/NumeroAnimado';
import Paginacion from './common/Paginacion';
import SelectorVista from './common/SelectorVista';
import { paginar } from '../utils/paginacion';
import { BLOQUE, BOTON, BOTON_CHICO } from './fondos/estilosFondo';
import toast from 'react-hot-toast';
import {
  ERROR_SHAKE_DURATION_MS,
  sanitizeApiErrors,
  getBackendErrorMessage,
  getApiErrorMessage,
} from '../utils/formErrors';

const UsuariosIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
);

const MasIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

// Usuario sin foto propia: círculo gris claro con la silueta, como una cuenta sin foto.
const SiluetaUsuario = ({ className = '' }) => (
  <svg viewBox="0 0 40 40" aria-hidden="true" className={`rounded-full ${className}`}>
    <circle cx="20" cy="20" r="19.5" fill="#E2E8F0" stroke="#CBD5E1" />
    <circle cx="20" cy="15.5" r="6" fill="#94A3B8" />
    <path d="M9.5 31.5v-1.5a10.5 9.5 0 0 1 21 0v1.5z" fill="#94A3B8" />
  </svg>
);

const VISTA_USUARIOS_KEY = 'usuarios_vista';

const ROL_LABELS = {
  iiisyp: 'Instituto de investigación',
  director: 'Director de Carrera',
  jefe_estudios: 'Jefe de Estudios',
  docente: 'Docente',
};

const CHIP_ESTADO = 'inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset';
const CHIP_ROL = 'inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset';
const ROL_STYLES = {
  iiisyp: 'bg-sky-50 text-sky-800 ring-sky-200',
  director: 'bg-blue-50 text-blue-900 ring-blue-200',
  jefe_estudios: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  docente: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

const obtenerRolesUsuario = (usuario) => {
  if (!usuario?.perfil) return [];

  const rolPrincipal = String(usuario.perfil.rol || '').trim();
  const rolesExtra = Array.isArray(usuario.asignaciones)
    ? usuario.asignaciones
        .filter((item) => item?.rol && item?.activo !== false)
        .map((item) => String(item.rol).trim())
    : [];

  return [...new Set([rolPrincipal, ...rolesExtra].filter(Boolean))];
};

const obtenerCarrerasUsuario = (usuario) => {
  if (!usuario) return [];

  const carreraPrincipal = String(usuario?.perfil?.carrera?.codigo || usuario?.carrera_codigo || '').trim();
  // Solo las asignaciones activas: las inactivas son historial (p. ej. una carrera anterior).
  const carrerasExtra = Array.isArray(usuario.asignaciones)
    ? usuario.asignaciones
        .filter((item) => item?.activo !== false && item?.carrera_codigo)
        .map((item) => String(item.carrera_codigo).trim())
    : [];

  return [...new Set([carreraPrincipal, ...carrerasExtra].filter(Boolean))];
};

const obtenerCarreraIdsUsuario = (usuario) => {
  if (!usuario) return [];

  const carreraPrincipal = usuario?.perfil?.carrera;
  const carrerasExtra = Array.isArray(usuario.asignaciones)
    ? usuario.asignaciones
        .filter((item) => item?.activo !== false && item?.carrera)
        .map((item) => String(item.carrera))
    : [];

  return [...new Set([carreraPrincipal, ...carrerasExtra].filter(Boolean).map((id) => String(id)))];
};

const obtenerTextoCarrerasUsuario = (usuario) => {
  const carreras = obtenerCarrerasUsuario(usuario);
  if (carreras.length === 0) return 'Sin carrera';
  return carreras.join(' / ');
};

const usuarioTieneRolDocente = (usuario) => obtenerRolesUsuario(usuario).includes('docente');

// Rol docente sin ficha de docente (lo calcula el backend). No desactiva al usuario:
// sus cargos funcionan y solo su parte docente queda pendiente de ficha.
const usuarioTienePerfilDocentePendiente = (usuario) => Boolean(usuario?.ficha_docente_pendiente);

function GestionUsuarios({ user: usuarioSesion }) {
  // Usuario con su rol ACTIVO (contexto de rol), no el guardado al iniciar sesión.
  const { effectiveUser } = useActiveRole();
  const user = effectiveUser || usuarioSesion;
  const navigate = useNavigate();
  const location = useLocation();
  const restoringFormRef = useRef(false);
  const restoringEditModalRef = useRef(false);
  const restoringLinkRef = useRef(false);
  const [usuarios, setUsuarios] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [docenteReciente, setDocenteReciente] = useState(null);
  const [carreras, setCarreras] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for editing modal
  const [showModal, setShowModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);

  // State for inline creation form
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({});
  const [resolucionJefe, setResolucionJefe] = useState(null);
  const [asignacionesExtra, setAsignacionesExtra] = useState([]);
  const [selectedRoleLeft, setSelectedRoleLeft] = useState(null);
  const [selectedRoleRight, setSelectedRoleRight] = useState(null);
  const lastToastRef = useRef({});
  const TOAST_DEBOUNCE_MS = 1500;
  const showToastOnce = (msg) => {
    try {
      const last = lastToastRef.current[msg];
      const now = Date.now();
      if (last && (now - last) < TOAST_DEBOUNCE_MS) return;
      lastToastRef.current[msg] = now;
      toast.error(msg);
    } catch {
      // en caso de fallo, fallar silenciosamente mostrando el toast normal
      toast.error(msg);
    }
  };

  const pulseFieldErrors = (fields = []) => {
    if (!fields.length) return;

    setErrorPulse((prev) => {
      const next = { ...prev };
      fields.forEach((field) => {
        next[field] = (next[field] || 0) + 1;
      });
      return next;
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorPulse, setErrorPulse] = useState({});

  // Brinco de los roles ante un error de rol
  // Debe declararse DESPUÉS de `errors` y `errorPulse` (temporal dead zone)
  const [leftPanelPulsing, setLeftPanelPulsing] = useState(false);
  useEffect(() => {
    if (!errors?.rol) {
      setLeftPanelPulsing(false);
      return;
    }
    setLeftPanelPulsing(false);
    const frameId = requestAnimationFrame(() => setLeftPanelPulsing(true));
    const timeoutId = setTimeout(() => setLeftPanelPulsing(false), ERROR_SHAKE_DURATION_MS);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [errors?.rol, errorPulse.rol]);

  // Brinco de los roles ante un error de las asignaciones.
  const [rightPanelPulsing, setRightPanelPulsing] = useState(false);
  useEffect(() => {
    if (!errors?.asignaciones) {
      setRightPanelPulsing(false);
      return;
    }
    setRightPanelPulsing(false);
    const frameId = requestAnimationFrame(() => setRightPanelPulsing(true));
    const timeoutId = setTimeout(() => setRightPanelPulsing(false), ERROR_SHAKE_DURATION_MS);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [errors?.asignaciones, errorPulse.asignaciones]);

  const [vinculacionRapidaDocente, setVinculacionRapidaDocente] = useState(false);
  const [volverANuevoDocente, setVolverANuevoDocente] = useState(false);

  // Eliminar: { usuario, datos } con lo que responde /dependencias/ (si tiene datos
  // se muestra "No se puede eliminar" en lugar de la confirmación).
  const [eliminacion, setEliminacion] = useState(null);
  const [verificandoEliminarId, setVerificandoEliminarId] = useState(null);

  const [showToggleModal, setShowToggleModal] = useState(false);
  const [usuarioToToggle, setUsuarioToToggle] = useState(null);
  const [showOnlyOrphans, setShowOnlyOrphans] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCarrera, setSelectedCarrera] = useState('');
  // Tarjetas o lista; se recuerda en este navegador.
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem(VISTA_USUARIOS_KEY) === 'lista' ? 'lista' : 'tarjetas';
    } catch {
      return 'tarjetas';
    }
  });
  const [pagina, setPagina] = useState(1);
  const listaRef = useRef(null);
  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    setPagina(1);
    try {
      localStorage.setItem(VISTA_USUARIOS_KEY, nuevaVista);
    } catch {
      // Sin almacenamiento disponible la vista simplemente no se recuerda.
    }
  };
  useEffect(() => {
    setPagina(1);
  }, [searchTerm, selectedCarrera, showOnlyOrphans]);

  const esSuperuserActual = user?.is_superuser === true;
  const esDirectorCarreraActual = user?.perfil?.rol === 'director';
  const carreraIdsGestionablesUsuario = (() => {
    if (!esDirectorCarreraActual) return new Set();

    const ids = [];
    if (user?.perfil?.carrera) {
      ids.push(String(user.perfil.carrera));
    }
    if (Array.isArray(user?.asignaciones)) {
      user.asignaciones
        .filter((item) => item?.activo !== false && item?.rol === 'director' && item?.carrera)
        .forEach((item) => ids.push(String(item.carrera)));
    }
    return new Set(ids);
  })();
  const carrerasGestionables = esSuperuserActual
    ? carreras
    : (esDirectorCarreraActual && carreraIdsGestionablesUsuario.size > 0
      ? carreras.filter((carrera) => carreraIdsGestionablesUsuario.has(String(carrera.id)))
      : carreras);
  const usuarioPerteneceACarrerasGestionables = (usuario) => {
    if (esSuperuserActual) return true;
    if (!esDirectorCarreraActual) return false;
    if (carreraIdsGestionablesUsuario.size === 0) return true;
    const idsUsuario = obtenerCarreraIdsUsuario(usuario);
    return idsUsuario.some((id) => carreraIdsGestionablesUsuario.has(String(id)));
  };
  const filtrarRolesPorPermiso = (rolesBase) => (rolesBase || []).filter((rol) => {
    if (esSuperuserActual) return true;
    // El Director asigna Instituto y Jefe de Estudios en su carrera; Director de Carrera, no.
    if (esDirectorCarreraActual) return rol.value !== 'director';
    return rol.value !== 'iiisyp';
  });
  
  // Usuarios huerfanos: sin perfil o con cualquier rol docente sin docente vinculado
  const esUsuarioHuerfano = (u) => !u?.perfil || usuarioTienePerfilDocentePendiente(u);
  const hayOrfanos = usuarios.length > 0 && usuarios.some(esUsuarioHuerfano);


  useEffect(() => {
    if (location?.state?.from !== 'docente') return;
    setVolverANuevoDocente(true);
    setIsCreating(true);
    setUsuarioEditando(null);
  }, [location?.state?.from]);

  useEffect(() => {
    if (restoringEditModalRef.current || usuarios.length === 0) return;

    const datosEditarGuardados = sessionStorage.getItem('datosEditarUsuario');
    if (!datosEditarGuardados) return;

    try {
      const { userId } = JSON.parse(datosEditarGuardados);
      const usuario = usuarios.find((item) => item.id === userId);

      if (usuario) {
        restoringEditModalRef.current = true;
        setUsuarioEditando(usuario);
        setShowModal(true);
        setIsCreating(false);
      }
    } catch (e) {
      console.error('Error al recuperar edición de usuario:', e);
      sessionStorage.removeItem('datosEditarUsuario');
    }
  }, [usuarios]);

  useEffect(() => {
    if (restoringLinkRef.current) return;

    const vincularDocentePendiente = sessionStorage.getItem('vincularDocentePendiente');
    if (!vincularDocentePendiente) return;

    try {
      const datos = JSON.parse(vincularDocentePendiente);
      const docente = docentes.find((item) => String(item.id) === String(datos.docenteId));
      const docenteId = datos.docenteId;

      if (docente || docenteId) {
        restoringLinkRef.current = true;
        restoringFormRef.current = true;
        const datosCrearUsuarioRaw = sessionStorage.getItem('datosCrearUsuario');
        const datosCrearUsuario = datosCrearUsuarioRaw ? JSON.parse(datosCrearUsuarioRaw) : null;
        const nombreCompleto = datosCrearUsuario?.nombre_completo || `${datos.first_name || ''} ${datos.last_name || ''}`.trim();
        const firstName = datosCrearUsuario?.first_name || datos.first_name || '';
        const lastName = datosCrearUsuario?.last_name || datos.last_name || '';
        const carreraSeleccionada = datosCrearUsuario?.carrera || datos.carrera || docente?.carrera_id || docente?.carrera || '';

        setVinculacionRapidaDocente(true);
        setDocenteReciente({
          id: docenteId,
          nombre_completo: docente?.nombre_completo || nombreCompleto,
          ci: docente?.ci || '',
          carrera_id: carreraSeleccionada,
        });
        setFormData({
          username: datosCrearUsuario?.username || '',
          email: datosCrearUsuario?.email || datos.email || '',
          nombre_completo: nombreCompleto,
          first_name: firstName,
          last_name: lastName,
          rol: 'docente',
          carrera: carreraSeleccionada,
          docente: docenteId,
          password: datosCrearUsuario?.password || '',
          password_confirm: datosCrearUsuario?.password_confirm || '',
        });
        setAsignacionesExtra([]);
        setErrors({});
        setUsuarioEditando(null);
        setIsCreating(true);
        sessionStorage.removeItem('vincularDocentePendiente');
      }
    } catch (e) {
      console.error('Error al preparar vínculo rápido de docente:', e);
      sessionStorage.removeItem('vincularDocentePendiente');
    }
  }, [docentes]);

  // 🔗 Recuperar datos del formulario al volver desde docentes
  useEffect(() => {
    const vincularDocentePendiente = sessionStorage.getItem('vincularDocentePendiente');
    if (vincularDocentePendiente) return;
    const datosGuardados = sessionStorage.getItem('datosCrearUsuario');
    if (datosGuardados) {
      try {
        const datos = JSON.parse(datosGuardados);
        const docenteRetornadoRaw = sessionStorage.getItem('docenteRetornadoDesdeUsuarios');
        const docenteRetornado = docenteRetornadoRaw ? JSON.parse(docenteRetornadoRaw) : null;
        const firstName = datos.first_name || '';
        const lastName = datos.last_name || '';
        const nombreCompleto = datos.nombre_completo || `${firstName} ${lastName}`.trim();

        setDocenteReciente(docenteRetornado ? {
          id: docenteRetornado.id,
          nombre_completo: docenteRetornado.nombre_completo || nombreCompleto,
          ci: docenteRetornado.ci || '',
          carrera_id: docenteRetornado.carrera || '',
        } : null);

        restoringFormRef.current = true;
        setFormData({
          ...datos,
          nombre_completo: nombreCompleto,
          first_name: firstName,
          last_name: lastName,
          carrera: docenteRetornado?.carrera || datos.carrera || '',
          docente: docenteRetornado?.id || (datos.docente || ''),
        });
        setAsignacionesExtra([]);
        sessionStorage.removeItem('datosCrearUsuario');
        sessionStorage.removeItem('docenteRetornadoDesdeUsuarios');
        // Abrir el modal automáticamente con los datos recuperados
        setIsCreating(true);
      } catch (e) {
        console.error('Error al recuperar datos:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (!isCreating) return;
    // REFACTOR: Auto-vincular docenteReciente cuando el rol 'docente' esté presente
    // en CUALQUIER asignación (principal o secundaria), no solo cuando es rol principal.
    const docenteEnPrincipal = String(formData.rol || '').trim() === 'docente';
    const docenteEnSecundaria = asignacionesExtra.some(
      (item) => String(item.rol || '').trim() === 'docente'
    );
    if (!docenteEnPrincipal && !docenteEnSecundaria) return;
    if (!docenteReciente?.id) return;
    if (formData.docente) return;

    setFormData((prev) => ({
      ...prev,
      docente: docenteReciente.id,
      carrera: prev.carrera || docenteReciente.carrera_id || '',
    }));
  }, [isCreating, formData.rol, formData.docente, docenteReciente, asignacionesExtra]);

  const cargarDatos = async () => {
    setError(null);
    setLoading(true);
    try {
      const [usuariosLista, docentesLista, carrerasLista, rolesRes] = await Promise.all([
        obtenerTodos('/usuarios/'),
        getDocentes(),
        getCarreras(),
        api.get('/usuarios/roles/')
      ]);

      setUsuarios(usuariosLista);
      setDocentes(docentesLista);
      setCarreras(carrerasLista);

      const todosRoles = rolesRes.data || [];
      setRoles(filtrarRolesPorPermiso(todosRoles));
      
      setLoading(false);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('Error al cargar los datos');
      setLoading(false);
    }
  };

  // Carga inicial y recarga si cambia el usuario o su rol/carrera activos. Hoy el rol
  // se cambia en el selector de módulos (fuera de esta página), pero el `user` también
  // puede actualizarse con la página abierta.
  const cargarDatosRef = useRef(cargarDatos);
  useEffect(() => {
    cargarDatosRef.current = cargarDatos;
  });
  useEffect(() => {
    cargarDatosRef.current();
  }, [user?.id, user?.perfil?.rol, user?.perfil?.carrera]);

  // Si alguien cambia o quita su foto con la página abierta, la lista se actualiza.
  useEffect(() => {
    const recargarUsuarios = () => {
      obtenerTodos('/usuarios/')
        .then(setUsuarios)
        .catch((err) => console.error('Error al recargar usuarios:', err));
    };
    window.addEventListener(EVENTO_FOTO_PERFIL_ACTUALIZADA, recargarUsuarios);
    return () => window.removeEventListener(EVENTO_FOTO_PERFIL_ACTUALIZADA, recargarUsuarios);
  }, []);

  const docentesPorId = new Map(docentes.map((docente) => [String(docente.id), docente]));
  const usuarioTieneDocenteInactivo = (usuario) => {
    if (!usuarioTieneRolDocente(usuario)) return false;
    const docenteId = usuario?.perfil?.docente_id || usuario?.perfil?.docente;
    if (!docenteId) return false;
    const docente = docentesPorId.get(String(docenteId));
    return Boolean(docente && docente.activo === false);
  };

  const usuariosFiltrados = (() => {
    let result = showOnlyOrphans ? usuarios.filter(esUsuarioHuerfano) : usuarios;

    if (selectedCarrera) {
      result = result.filter((usuario) => obtenerCarreraIdsUsuario(usuario).includes(String(selectedCarrera)));
    }

    // Filtrar por término de búsqueda (nombre o C.I.)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter((usuario) => {
        const nombre = `${usuario.first_name || ''} ${usuario.last_name || ''}`.toLowerCase();
        const ci = usuario.ci || '';
        return nombre.includes(searchLower) || ci.includes(searchLower)
          || String(usuario.username || '').toLowerCase().includes(searchLower);
      });
    }

    // Orden jerárquico: Admin → Director → Jefe Estudios → Docente
    const ordenJerarquico = {
      'iiisyp': 0,
      'director': 1,
      'jefe_estudios': 2,
      'docente': 3
    };

    result = [...result].sort((a, b) => {
      const rolA = a.perfil?.rol || 'docente';
      const rolB = b.perfil?.rol || 'docente';
      const ordenA = a.is_superuser ? -1 : (ordenJerarquico[rolA] ?? 99);
      const ordenB = b.is_superuser ? -1 : (ordenJerarquico[rolB] ?? 99);

      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }

      // Si mismo rol, ordenar por apellido
      const apellidoA = (a.last_name || '').toLowerCase();
      const apellidoB = (b.last_name || '').toLowerCase();
      return apellidoA.localeCompare(apellidoB, 'es', { sensitivity: 'base' });
    });

    return result;
  })();

  // Initialize form when creation starts
  useEffect(() => {
    if (isCreating) {
      if (restoringFormRef.current) {
        restoringFormRef.current = false;
        setErrors({});
        return;
      }
      
const initialData = {
  username: '',
  email: '',
  nombre_completo: '',
  first_name: '',
  last_name: '',
  ci: '',
  rol: '',
  carrera: '',
  docente: '',
  password: '',
  password_confirm: '',
};
      setFormData(initialData);
      setAsignacionesExtra([]);
      setVinculacionRapidaDocente(false);
      setDocenteReciente(null);
      setResolucionJefe(null);
      setErrors({});
    }
  }, [isCreating, user]);

  // Carrera por defecto del Director que gestiona una sola carrera. Va aparte del
  // reinicio del formulario para recalcularse cuando terminan de cargar las carreras.
  // Solo el superusuario elige la carrera; para cualquier otro es automáticamente la suya.
  const carreraPropiaEditor = !esSuperuserActual && carrerasGestionables.length === 1
    ? String(carrerasGestionables[0].id)
    : '';
  const carreraDefaultDirector = esDirectorCarreraActual && carrerasGestionables.length === 1
    ? String(carrerasGestionables[0].id)
    : '';
  useEffect(() => {
    if (!isCreating || !carreraDefaultDirector) return;
    setFormData((prev) => (prev.carrera ? prev : { ...prev, carrera: carreraDefaultDirector }));
  }, [isCreating, carreraDefaultDirector]);

  const handleToggleCreateForm = () => {
    sessionStorage.removeItem('datosEditarUsuario');
    if (isCreating) {
      setVinculacionRapidaDocente(false);
      setAsignacionesExtra([]);
    }
    setIsCreating(!isCreating);
    setUsuarioEditando(null); // Ensure we are not in edit mode
  };


  const abrirModalEditar = (usuario) => {
    sessionStorage.removeItem('datosEditarUsuario');
    restoringEditModalRef.current = false;
    setUsuarioEditando(usuario);
    setShowModal(true);
    setIsCreating(false); // Hide create form if it was open
  };

  const handleToggleActivo = (usuario) => {
    if (usuario?.is_superuser) {
      toast.error('El Super Admin no puede desactivarse');
      return;
    }
    setUsuarioToToggle(usuario);
    setShowToggleModal(true);
  };

  // Antes de confirmar se pregunta al backend si el usuario tiene datos registrados.
  const handleEliminar = async (usuario) => {
    if (verificandoEliminarId) return;
    setVerificandoEliminarId(usuario.id);
    try {
      const { data } = await api.get(`/usuarios/${usuario.id}/dependencias/`);
      setEliminacion({ usuario, datos: data || {} });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo verificar si el usuario tiene datos registrados.'));
    } finally {
      setVerificandoEliminarId(null);
    }
  };

  const confirmarEliminar = async () => {
    const { usuario } = eliminacion;
    try {
      await api.delete(`/usuarios/${usuario.id}/`);
    } catch (err) {
      // Datos registrados que aparecieron mientras tanto: se muestra el aviso.
      if (err.response?.status === 409 && err.response.data?.dependencias) {
        setEliminacion({ usuario, datos: err.response.data.dependencias });
        return;
      }
      throw new Error(getApiErrorMessage(err, 'No se pudo eliminar el usuario.'));
    }
    toast.success('Usuario eliminado');
    setUsuarios((prev) => prev.filter((item) => item.id !== usuario.id));
    setEliminacion(null);
  };

  // --- FORM LOGIC FOR INLINE CREATION ---
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const normalizedValue = name === 'ci'
        ? String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)
        : value;
      const updated = { ...prev, [name]: normalizedValue };

      if (name === 'nombre_completo') {
        const partes = normalizedValue.trim().split(/\s+/).filter(Boolean);
        updated.first_name = partes[0] || '';
        updated.last_name = partes.slice(1).join(' ');
      }

      // Auto-generar contraseña por defecto al escribir el username
      if (name === 'username') {
        updated.password = normalizedValue + 'UABJB';
        updated.password_confirm = normalizedValue + 'UABJB';
      }

      return updated;
    });

    // Limpia el error del campo al escribir para feedback inmediato
    setErrors((prev) => {
      const next = { ...prev };
      if (name === 'nombre_completo') {
        delete next.nombre_completo;
        delete next.first_name;
        delete next.last_name;
      } else {
        if (!prev?.[name]) return prev;
        delete next[name];
      }
      // Limpiar error de asignaciones al cambiar carrera
      if (name === 'carrera') {
        delete next.asignaciones;
      }
      return next;
    });
  };

  // --- Transfer List de Roles y Carreras ---
  const rolesAsignadosLista = [
    { rol: formData.rol || '', carrera: formData.carrera || '' },
    ...asignacionesExtra,
  ].filter((item) => String(item.rol || '').trim());

  const rolesDisponiblesLista = roles;

  // Todos los roles del usuario van en su única carrera (la de su contrato).
  const moverRolDerecha = (rolValue) => {
    if (vinculacionRapidaDocente || !rolValue) return;
    setErrors((prev) => ({ ...prev, rol: null, asignaciones: null }));

    const motivo = motivoNoAsignarRol(rolValue, rolesAsignadosLista);
    // Las reglas de los roles se avisan bajo los botones, sin toast.
    if (motivo) {
      setErrors((prev) => ({ ...prev, rol: [motivo] }));
      pulseFieldErrors(['rol']);
      setSelectedRoleLeft(null);
      return;
    }

    if (!formData.rol) {
      setFormData((prev) => ({ ...prev, rol: rolValue, carrera: prev.carrera || carreraPropiaEditor }));
    } else {
      setAsignacionesExtra([{ rol: rolValue, carrera: formData.carrera || carreraPropiaEditor }]);
    }
    setSelectedRoleLeft(null);
  };

  const moverRolIzquierda = (index) => {
    if (vinculacionRapidaDocente) return;
    setErrors((prev) => ({ ...prev, rol: null, asignaciones: null }));
    if (index === 0 && asignacionesExtra.length > 0) {
      // El segundo rol pasa a ser el principal; la carrera no cambia.
      setFormData((prev) => ({ ...prev, rol: asignacionesExtra[0].rol }));
      setAsignacionesExtra([]);
    } else if (index === 0) {
      setFormData((prev) => ({ ...prev, rol: '', docente: '' }));
    } else {
      setAsignacionesExtra([]);
    }
    setSelectedRoleRight(null);
  };

  // La carrera es del usuario: se aplica a todos sus roles.
  const cambiarCarreraUsuario = (carreraValue) => {
    const carrera = String(carreraValue || '');
    setFormData((prev) => ({ ...prev, carrera }));
    setAsignacionesExtra((prev) => prev.map((item) => ({ ...item, carrera })));
    setErrors((prev) => ({ ...prev, carrera: null, asignaciones: null }));
  };

  // REGLA GLOBAL: limpia el error de un campo al recibir focus/clic.
  const clearFieldError = (fieldName) => {
    setErrors((prev) => {
      if (!prev?.[fieldName]) return prev;
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  };

  const handleSubmit = async (e) => {
    // REGLA GLOBAL: detener el comportamiento por defecto para evitar parpadeo/re-render.
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }

    const validationErrors = {};
    const camposFaltantes = [];
    const usernameNormalizado = String(formData.username || '').trim();
    const nombreCompletoNormalizado = String(formData.nombre_completo || `${formData.first_name || ''} ${formData.last_name || ''}`).trim();
    const emailNormalizado = String(formData.email || '').trim();
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado);
    const rolNormalizado = String(formData.rol || '').trim();
    const carreraNormalizada = String(formData.carrera || '').trim();

    if (!usernameNormalizado) {
      validationErrors.username = 'Debe ingresar un usuario.';
      camposFaltantes.push('Usuario');
    }

    if (mostrarNombreCompletoCreacion && !nombreCompletoNormalizado) {
      validationErrors.nombre_completo = 'Debe ingresar nombre y apellido.';
      camposFaltantes.push('Nombre completo');
    }

    if (!emailNormalizado) {
      validationErrors.email = 'No debe estar vacío.';
      camposFaltantes.push('Correo institucional');
    } else if (!emailValido) {
      // Lleno pero inválido: no es un campo faltante.
      validationErrors.email = 'Ingresa un correo electrónico válido.';
    }

    if (!rolNormalizado) {
      validationErrors.rol = 'Debe seleccionar un rol.';
      camposFaltantes.push('Rol');
    }

    if (!carreraNormalizada) {
      validationErrors.carrera = 'Debe seleccionar una carrera.';
      camposFaltantes.push('Carrera');
    }

    const ciNormalizado = (formData.ci || '').trim();
    if (mostrarCiCreacion && !ciNormalizado) {
      validationErrors.ci = ['El C.I. es obligatorio.'];
      camposFaltantes.push('C.I.');
    }

    if (Object.keys(validationErrors).length > 0) {
      pulseFieldErrors(Object.keys(validationErrors));
      setErrors(validationErrors);
      const faltanSoloRolYCarrera = !rolNormalizado && !carreraNormalizada && Object.keys(validationErrors).length === 2;
      showToastOnce(
        faltanSoloRolYCarrera
          ? 'Debes seleccionar un rol y una carrera para poder continuar.'
          : camposFaltantes.length > 0
            ? 'Completa los campos obligatorios marcados en rojo.'
            : 'Revisa los campos marcados en rojo.'
      );
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const asignacionesSeleccionadas = [
      { rol: formData.rol, carrera: formData.carrera },
      ...asignacionesExtra,
    ];

    const combinacionKey = (asignacion) => `${String(asignacion.rol || '').trim()}::${String(asignacion.carrera || '').trim()}`;

    if (!formData.rol || !carreraNormalizada) {
      pulseFieldErrors(['rol', 'carrera']);
      setErrors((prev) => ({
        ...prev,
        rol: !formData.rol ? ['Debe seleccionar un rol.'] : prev.rol,
        carrera: !carreraNormalizada ? ['Debe seleccionar una carrera.'] : prev.carrera,
      }));
      toast.error('La primera selección de rol y carrera es obligatoria.');
      setIsSubmitting(false);
      return;
    }

    if (asignacionesExtra.length > 0) {
      const segunda = asignacionesExtra[0];
      const segundaRol = String(segunda?.rol || '').trim();
      const segundaCarrera = String(segunda?.carrera || '').trim();

      if (!segundaRol || !segundaCarrera) {
        pulseFieldErrors(['rol', 'carrera', 'asignaciones']);
        setErrors((prev) => ({
          ...prev,
          asignaciones: ['La segunda selección de rol y carrera es obligatoria cuando está habilitada.'],
        }));
        toast.error('Completa la segunda selección de rol y carrera.');
        setIsSubmitting(false);
        return;
      }
    }

    const primeraAsignacion = {
      rol: String(formData.rol || '').trim(),
      carrera: String(formData.carrera || '').trim(),
    };
    const segundaAsignacion = asignacionesExtra[0]
      ? {
          rol: String(asignacionesExtra[0].rol || '').trim(),
          carrera: String(asignacionesExtra[0].carrera || '').trim(),
        }
      : null;
    const esRolMando = (rol) => ROLES_MANDO_UABJB.includes(String(rol || '').trim());

    if (segundaAsignacion) {
      const mismaCombinacion = primeraAsignacion.rol === segundaAsignacion.rol && primeraAsignacion.carrera === segundaAsignacion.carrera;
      if (mismaCombinacion) {
        // Safety net: la validación en caliente debería haber prevenido esto
        toast.error(MENSAJE_DUPLICADO);
        setIsSubmitting(false);
        return;
      }

      const primeraMando = esRolMando(primeraAsignacion.rol);
      const segundaMando = esRolMando(segundaAsignacion.rol);

      // Safety net: DOS roles de mando (Director, Jefe o Instituto) — prohibido por normativa UABJB
      if (primeraMando && segundaMando) {
        toast.error(MENSAJE_AUTORIDAD_UNICA);
        setIsSubmitting(false);
        return;
      }
    }

    const combinaciones = asignacionesSeleccionadas.map(combinacionKey);
    // Solo validar duplicados si hay más de una asignación
    if (asignacionesSeleccionadas.length > 1 && new Set(combinaciones).size !== combinaciones.length) {
      toast.error(MENSAJE_DUPLICADO);
      setIsSubmitting(false);
      return;
    }

    const rolPrincipal = String(formData.rol || '').trim();
    const docenteSeleccionado = formData.docente || '';

    let payload = {
      username: formData.username,
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      rol: rolPrincipal,
      password: formData.password,
      password_confirm: formData.password_confirm,
    };

    // Si el rol PRINCIPAL es docente, se vincula la ficha existente elegida (la ficha
    // nueva se crea en Docentes > Nuevo docente).
    if (rolPrincipal === 'docente' && docenteSeleccionado) {
      payload.docente = docenteSeleccionado;
    }

    // Mapear asignaciones extra INCLUYENDO la ficha existente cuando la asignación secundaria sea de tipo docente.
    payload.asignaciones = asignacionesExtra.map((item) => {
      const asignacion = {
        rol: String(item.rol || '').trim(),
        carrera: carreraNormalizada,
      };
      if (asignacion.rol === 'docente' && docenteSeleccionado) {
        asignacion.docente = docenteSeleccionado;
      }
      return asignacion;
    });

    payload.carrera = carreraNormalizada;

    // Enviar CI siempre
    payload.ci = ciNormalizado;

    // Jefe de Estudios: resolución del Consejo de Carrera en PDF, obligatoria.
    const designaJefe = [rolPrincipal, ...asignacionesExtra.map((item) => item.rol)].includes('jefe_estudios');
    if (designaJefe && !esArchivoPdf(resolucionJefe)) {
      const mensaje = resolucionJefe ? 'La resolución del Consejo de Carrera debe ser un PDF.' : MENSAJE_RESOLUCION_JEFE;
      setErrors((prev) => ({ ...prev, resolucion_jefe: [mensaje] }));
      toast.error(mensaje);
      setIsSubmitting(false);
      return;
    }
    const { cuerpo, config } = cuerpoConArchivo(payload, 'resolucion_jefe', designaJefe ? resolucionJefe : null);

    try {
      const response = await api.post('/usuarios/', cuerpo, config);
      toast.success('Usuario creado correctamente');
      setUsuarios((prev) => [response.data, ...prev]);
      setIsCreating(false);
      setAsignacionesExtra([]);
      sessionStorage.removeItem('docenteTemporalDesdeUsuarios');
      if (volverANuevoDocente) {
        sessionStorage.setItem('datosCrearUsuario', JSON.stringify({
          ...formData,
          ci: ciNormalizado,
          carrera: carreraNormalizada,
        }));
        sessionStorage.setItem('abrirModalNuevoDocente', 'true');
        if (response?.data?.id) {
          sessionStorage.setItem('autoSeleccionarUsuarioDesdeGestion', JSON.stringify({
            ...response.data,
            _ciRetornoDocente: ciNormalizado,
            _carreraRetornoDocente: carreraNormalizada,
          }));
        }
        navigate('/fondo-tiempo/docentes');
        return;
      }
    } catch (err) {
      console.error('Error al crear usuario:', err.response);
      const apiErrors = err.response?.data;
      if (apiErrors) {
        if (typeof apiErrors === 'object') {
          const backendMessage = getBackendErrorMessage(apiErrors, '');
          const esErrorDeCargoPorCarrera =
            backendMessage.includes('ya tiene un Administrador asignado')
            || backendMessage.includes('ya tiene un Director asignado')
            || backendMessage.includes('ya tiene un Jefe de Estudios asignado');

          const fieldsToPulse = esErrorDeCargoPorCarrera
            ? [...new Set([...Object.keys(apiErrors), 'rol'])]
            : Object.keys(apiErrors);
          pulseFieldErrors(fieldsToPulse);
          setErrors(
            esErrorDeCargoPorCarrera
              ? { ...sanitizeApiErrors(apiErrors), rol: [backendMessage] }
              : sanitizeApiErrors(apiErrors)
          );
        }
        if (typeof apiErrors === 'string' && apiErrors.includes('<!DOCTYPE')) {
          // El backend devolvió HTML (error 500 de Django), no un ValidationError JSON.
          // Ya no enmascaramos el error con un mensaje falso de "docente": informamos al
          // operador que ocurrió un fallo del servidor y lo registramos en consola.
          console.error('Error 500 del servidor (HTML en lugar de JSON):', err.response?.status, err.response?.statusText);
          toast.error('Error interno del servidor. Revise la consola o contacte al administrador.');
        } else if (typeof apiErrors === 'object') {
          toast.error(textoErroresUsuario(apiErrors, 'Ocurrió un error inesperado al crear el usuario.'));
        } else {
          toast.error(getBackendErrorMessage(apiErrors, 'Ocurrió un error inesperado al crear el usuario.'));
        }
      } else {
        toast.error('Ocurrió un error inesperado.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const nombreCompletoError = Array.isArray(errors?.nombre_completo)
    ? errors.nombre_completo[0]
    : (typeof errors?.nombre_completo === 'string'
      ? errors.nombre_completo
      : (Array.isArray(errors?.first_name)
        ? errors.first_name[0]
        : (Array.isArray(errors?.last_name)
          ? errors.last_name[0]
          : (typeof errors?.first_name === 'string'
            ? errors.first_name
            : (typeof errors?.last_name === 'string' ? errors.last_name : null)))));


  const cancelarCreacion = () => {
    setIsCreating(false);
    setVinculacionRapidaDocente(false);
    if (volverANuevoDocente) {
      sessionStorage.setItem('abrirModalNuevoDocente', 'true');
      navigate('/fondo-tiempo/docentes');
    }
  };

  // Errores de los roles (y de la carrera si no hay selector) como texto bajo los roles.
  const textoDeError = (error) => (Array.isArray(error) ? (error[0] || '') : (typeof error === 'string' ? error : ''));
  const errorBajoListaCreacion = textoDeError(errors?.rol)
    || textoDeError(errors?.asignaciones)
    || textoDeError(errors?.non_field_errors)
    || textoDeError(errors?.carrera);

  const obtenerRolLabel = (rolValue) => roles.find((item) => item.value === rolValue)?.label || rolValue || 'Sin rol';

  const mostrarNombreCompletoCreacion = true;
  const mostrarCiCreacion = true;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-azulado-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 bg-azulado-100">
        <div role="alert" className={`${BLOQUE} p-8 max-w-md w-full text-center`}>
          <p className="text-lg font-bold text-red-700">{error}</p>
          <p className="mt-2 text-sm text-slate-600">
            No se pudo obtener la lista de usuarios. Revise su conexión e intente de nuevo.
          </p>
          <button
            type="button"
            onClick={cargarDatos}
            className={`${BOTON} mt-5 px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white`}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const puedeGestionarUsuarios = () => esSuperuserActual || esDirectorCarreraActual;
  const puedeEliminarUsuarios = () => esSuperuserActual || esDirectorCarreraActual;
  // Motivo por el que no se puede editar o eliminar a un usuario ('' si se puede); se
  // muestra en pantalla bajo los botones. Las mismas reglas que el backend.
  const MOTIVO_SUPERUSUARIO = 'Cuenta de superusuario: no se edita ni se elimina desde aquí.';
  const motivoNoEditar = (usuario) => {
    if (usuario?.is_superuser) return MOTIVO_SUPERUSUARIO;
    if (esSuperuserActual) return '';
    if (!usuarioPerteneceACarrerasGestionables(usuario)) return 'Es de otra carrera: no puedes editarlo.';
    if (obtenerRolesUsuario(usuario).includes('director')) return 'A un Director solo lo edita el superusuario.';
    return '';
  };
  const puedeEditarUsuario = (usuario) => puedeGestionarUsuarios() && !motivoNoEditar(usuario);
  // El Director no activa, desactiva ni elimina a un Director ni al Jefe de Estudios
  // (lo designa el Consejo de Carrera); sí a docentes y al Instituto. Igual que el backend.
  const tieneCargoDeDireccion = (usuario) => cargosDelUsuario(usuario).some((cargo) => ['director', 'jefe_estudios'].includes(cargo));
  const puedeCambiarEstadoUsuario = (usuario) => puedeEditarUsuario(usuario)
    && (esSuperuserActual || !tieneCargoDeDireccion(usuario));
  // Eliminar: nunca un superusuario ni a sí mismo. Con datos registrados el backend lo
  // rechaza (lo avisa el modal al pulsar Eliminar): solo se puede desactivar.
  const motivoNoEliminar = (usuario) => {
    if (usuario?.is_superuser) return MOTIVO_SUPERUSUARIO;
    if (String(usuario?.id) === String(user?.id)) return 'No puedes eliminar tu propia cuenta.';
    if (esSuperuserActual) return '';
    const motivoEdicion = motivoNoEditar(usuario);
    if (motivoEdicion) return motivoEdicion;
    if (tieneCargoDeDireccion(usuario)) return 'Al Jefe de Estudios solo lo elimina el superusuario: lo designa el Consejo de Carrera.';
    return '';
  };
  const puedeEliminarUsuario = (usuario) => Boolean(usuario) && puedeEliminarUsuarios() && !motivoNoEliminar(usuario);
  const obtenerNombreUsuario = (usuario) => ((usuario?.first_name || usuario?.last_name)
    ? `${(usuario.first_name || '').trim()} ${(usuario.last_name || '').trim()}`.trim()
    : (usuario?.nombre_completo || '-'));
  // --- Piezas comunes de las vistas de tarjetas y lista ---
  // El contador sigue a la carrera elegida (solo el superusuario puede elegirla).
  const usuariosCarrera = selectedCarrera
    ? usuarios.filter((usuario) => obtenerCarreraIdsUsuario(usuario).includes(String(selectedCarrera)))
    : usuarios;
  const totalActivosUsuarios = usuariosCarrera.filter((usuario) => usuario.is_active !== false).length;
  const nombreCarreraFiltro = carrerasGestionables.find((carrera) => String(carrera.id) === String(selectedCarrera))?.nombre;
  const { paginaActual, totalPaginas, itemsPagina: usuariosPagina } = paginar(usuariosFiltrados, pagina, vista);
  const irAPagina = (nuevaPagina) => {
    setPagina(nuevaPagina);
    listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const claveVista = `${selectedCarrera}-${searchTerm}-${showOnlyOrphans}-${paginaActual}`;

  // Solo la foto que el usuario se puso; sin ella (el backend manda el logo de la
  // carrera en su lugar), la silueta gris de cuenta sin foto.
  const fotoUsuario = (usuario, tamano) => (
    usuario?.perfil?.foto_perfil && usuario.perfil.foto_perfil_es_propia ? (
      <img src={usuario.perfil.foto_perfil} alt="" className={`${tamano} rounded-full object-cover flex-shrink-0`} />
    ) : (
      <SiluetaUsuario className={`${tamano} flex-shrink-0`} />
    )
  );

  const chipsRoles = (usuario) => {
    if (usuario.is_superuser) {
      return <span className={`${CHIP_ROL} bg-amber-50 text-amber-800 ring-amber-200`}>Super Admin</span>;
    }
    const roles = obtenerRolesUsuario(usuario);
    if (roles.length === 0) return <span className="text-xs text-slate-500">Sin rol</span>;
    const docenteInactivo = usuarioTieneDocenteInactivo(usuario);
    return roles.map((rol) => (
      <span key={rol} className={`${CHIP_ROL} ${ROL_STYLES[rol] || ROL_STYLES.docente}`}>
        {ROL_LABELS[rol] || rol}
        {docenteInactivo && rol === 'docente' ? ' (inactivo)' : ''}
      </span>
    ));
  };

  const avisosUsuario = (usuario) => (
    <>
      {!usuario.perfil && <span className="text-xs font-semibold text-amber-700">Sin perfil</span>}
      {usuarioTienePerfilDocentePendiente(usuario) && <span className="text-xs font-semibold text-amber-700">Falta crear la ficha de docente</span>}
    </>
  );

  const estadoUsuario = (usuario) => (
    usuario.is_superuser ? (
      <span className="text-xs font-semibold text-amber-700">Protegido</span>
    ) : (
      <span className="flex items-center gap-2.5">
        <Interruptor
          chico
          isActive={usuario.is_active}
          disabled={!puedeCambiarEstadoUsuario(usuario)}
          onChange={() => puedeCambiarEstadoUsuario(usuario) && handleToggleActivo(usuario)}
          etiqueta={usuario.is_active ? 'Desactivar usuario' : 'Activar usuario'}
        />
        <span className={`text-xs ${usuario.is_active ? 'text-slate-700' : 'font-semibold text-red-700'}`}>
          {usuario.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </span>
    )
  );

  const accionesUsuario = (usuario) => {
    if (!puedeGestionarUsuarios()) return null;
    const bloqueado = !puedeEditarUsuario(usuario);
    const puedeBorrar = puedeEliminarUsuario(usuario);
    const motivoEdicion = motivoNoEditar(usuario);
    const motivoEliminacion = puedeEliminarUsuarios() ? motivoNoEliminar(usuario) : '';
    const motivos = [...new Set([motivoEdicion, motivoEliminacion].filter(Boolean))];
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button data-escritura
          type="button"
          onClick={() => !bloqueado && abrirModalEditar(usuario)}
          disabled={bloqueado}
          title={motivoEdicion || 'Editar'}
          className={`${BOTON_CHICO} bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500`}
        >
          <FaEdit size={12} />
          <span>Editar</span>
        </button>
        {puedeEliminarUsuarios() && (
          <button data-escritura
            type="button"
            onClick={() => puedeBorrar && handleEliminar(usuario)}
            disabled={!puedeBorrar || verificandoEliminarId === usuario.id}
            title={motivoEliminacion || 'Eliminar'}
            className={`${BOTON_CHICO} bg-red-400 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-400`}
          >
            <FaTrash size={11} />
            <span>{verificandoEliminarId === usuario.id ? 'Verificando...' : 'Eliminar'}</span>
          </button>
        )}
        {motivos.map((motivo) => (
          <p key={motivo} className="basis-full text-xs text-slate-500">{motivo}</p>
        ))}
      </div>
    );
  };

  // La carrera solo la ve el superusuario; el Director solo gestiona usuarios de la suya.
  // Anchos fijos para C.I., Carrera, Estado y Acciones, así el encabezado y las filas
  // quedan alineados; el espacio que sobra se lo reparten Usuario y Rol.
  const columnasLista = esSuperuserActual
    ? 'xl:grid-cols-[minmax(0,1.4fr)_7rem_8rem_minmax(0,1.2fr)_10rem_12rem]'
    : 'xl:grid-cols-[minmax(0,1.4fr)_7rem_minmax(0,1.2fr)_10rem_12rem]';

  const estadoFilaLista = (usuario) => (
    usuario.is_superuser ? (
      <span className={`${CHIP_ESTADO} bg-amber-50 text-amber-700 ring-amber-300`}>Protegido</span>
    ) : (
      <span className="flex items-center gap-2.5">
        <Interruptor
          chico
          isActive={usuario.is_active}
          disabled={!puedeCambiarEstadoUsuario(usuario)}
          onChange={() => puedeCambiarEstadoUsuario(usuario) && handleToggleActivo(usuario)}
          etiqueta={usuario.is_active ? 'Desactivar usuario' : 'Activar usuario'}
        />
        <span className={`${CHIP_ESTADO} ${usuario.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-300' : 'bg-red-50 text-red-700 ring-red-300'}`}>
          {usuario.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </span>
    )
  );

  return (
    <div className="min-h-screen bg-azulado-100 text-slate-800">
      <div className="w-full max-w-[92rem] mx-auto px-3 sm:px-4 md:px-8 pt-16 md:pt-20 pb-6 space-y-4">
        {/* Bloque 1: encabezado con la acción y, al lado, el total (como el dashboard de fondos) */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className={`${BLOQUE} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0">
                <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 ring-1 ring-inset ring-azulado-300 text-blue-900 items-center justify-center flex-shrink-0">
                  <UsuariosIcon className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Cuentas y permisos del sistema
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">Usuarios</h2>
                </div>
              </div>
              {puedeGestionarUsuarios() && (
                <button data-escritura
                  type="button"
                  onClick={handleToggleCreateForm}
                  className={`${BOTON} w-full sm:w-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
                >
                  <MasIcon className="w-5 h-5" />
                  <span>Nuevo Usuario</span>
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Usuarios</p>
                {esSuperuserActual && (
                  <p key={selectedCarrera || 'todas'} className="animate-campo-entrada mt-1.5 text-sm font-semibold text-white leading-snug line-clamp-2">
                    {nombreCarreraFiltro || 'Todas las carreras'}
                  </p>
                )}
              </div>
              <span className="text-5xl font-bold tabular-nums leading-none">
                <NumeroAnimado valor={usuariosCarrera.length} />
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <NumeroAnimado valor={totalActivosUsuarios} singular="activo" plural="activos" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-blue-100 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                <NumeroAnimado valor={usuariosCarrera.length - totalActivosUsuarios} singular="inactivo" plural="inactivos" />
              </span>
            </div>
          </div>
        </div>

        {/* Bloque 2: búsqueda, carrera (solo superusuario), huérfanos y vista */}
        <div className={`${BLOQUE} p-3 flex flex-wrap items-center gap-2 sm:gap-3`}>
          <CampoBusqueda value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nombre o C.I." />
          {esSuperuserActual && (
            <div className="min-w-0 flex-1 sm:flex-none sm:w-64">
              <FiltroDesplegable
                value={selectedCarrera}
                onChange={setSelectedCarrera}
                options={carrerasGestionables.map((carrera) => ({ value: carrera.id, label: carrera.nombre }))}
                placeholder="Todas las carreras"
                ariaLabel="Filtrar por carrera"
                emptyText="No hay carreras que coincidan"
              />
            </div>
          )}
          {hayOrfanos && (
            <button
              type="button"
              onClick={() => setShowOnlyOrphans((prev) => !prev)}
              className={`${BOTON_CHICO} h-9 ${showOnlyOrphans ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200 hover:bg-red-100'}`}
            >
              {showOnlyOrphans ? 'Mostrar todos' : 'Ver sin perfil o ficha'}
            </button>
          )}
          <SelectorVista vista={vista} onCambiar={cambiarVista} className="ml-auto" />
        </div>

        {/* Bloque 3: usuarios en tarjetas o en lista (15 por página en lista y 9 en tarjetas) */}
        <div ref={listaRef} className="scroll-mt-4" />
        {usuariosFiltrados.length > 0 ? (
          vista === 'lista' ? (
            // Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas.
            <div key={`lista-${claveVista}`} className={`${BLOQUE} overflow-hidden`}>
              <div className={`hidden xl:grid ${columnasLista} items-center gap-6 px-5 py-3 bg-azulado-100 text-xs font-medium text-slate-500 [border-bottom:1px_solid_#B8C9E1]`}>
                <span>Usuario</span>
                <span>C.I.</span>
                {esSuperuserActual && <span>Carrera</span>}
                <span>Rol</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>
              <div className="divide-y divide-azulado-300">
                {usuariosPagina.map((usuario, indice) => {
                  const inactivo = usuario.is_active === false && !usuario.is_superuser;
                  return (
                    <div
                      key={usuario.id}
                      style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                      className={`animate-fondo-entrada grid grid-cols-1 ${columnasLista} items-center gap-x-6 gap-y-2 px-5 py-3 transition-colors ${
                        inactivo ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-azulado-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {fotoUsuario(usuario, 'w-9 h-9 text-sm')}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">{obtenerNombreUsuario(usuario)}</div>
                          <div className="text-xs text-slate-500 truncate">@{usuario.username}</div>
                          <div className="flex flex-col">{avisosUsuario(usuario)}</div>
                        </div>
                      </div>
                      <div className="text-sm text-slate-500 tabular-nums">
                        <span className="xl:hidden text-xs font-semibold text-slate-700">C.I.: </span>{usuario.ci || '—'}
                      </div>
                      {esSuperuserActual && (
                        <div className="text-sm font-semibold text-slate-800 truncate">{obtenerTextoCarrerasUsuario(usuario)}</div>
                      )}
                      <div className="flex flex-wrap gap-1.5">{chipsRoles(usuario)}</div>
                      <div>{estadoFilaLista(usuario)}</div>
                      {accionesUsuario(usuario) || <span />}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div key={`tarjetas-${claveVista}`} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {usuariosPagina.map((usuario, indice) => {
                const inactivo = usuario.is_active === false && !usuario.is_superuser;
                return (
                  <div
                    key={usuario.id}
                    style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                    className={`${BLOQUE} animate-fondo-entrada p-5 flex flex-col gap-4 ${inactivo ? '!bg-red-50/70 !ring-red-200' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {fotoUsuario(usuario, 'w-12 h-12')}
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-blue-900 leading-tight truncate">{obtenerNombreUsuario(usuario)}</h3>
                          <p className="text-sm text-slate-600 truncate">@{usuario.username}</p>
                        </div>
                      </div>
                      {inactivo && (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 ring-1 ring-inset ring-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                          Inactivo
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">{chipsRoles(usuario)}</div>

                    <dl className={`grid ${esSuperuserActual ? 'grid-cols-2 divide-x' : 'grid-cols-1'} divide-azulado-300 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 py-2.5`}>
                      <div className="min-w-0 px-4">
                        <dt className="text-xs font-semibold text-blue-800">C.I.</dt>
                        <dd className="mt-0.5 text-[13px] font-semibold text-slate-800 tabular-nums">{usuario.ci || '—'}</dd>
                      </div>
                      {esSuperuserActual && (
                        <div className="min-w-0 px-4">
                          <dt className="text-xs font-semibold text-blue-800">Carrera</dt>
                          <dd className="mt-0.5 text-[13px] font-semibold text-slate-800 truncate">{obtenerTextoCarrerasUsuario(usuario)}</dd>
                        </div>
                      )}
                    </dl>

                    <div className="flex flex-col">{avisosUsuario(usuario)}</div>

                    <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-2 [border-top:1px_solid_#B8C9E1]">
                      {estadoUsuario(usuario)}
                      {accionesUsuario(usuario)}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className={`${BLOQUE} p-10 sm:p-12 text-center`}>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {usuarios.length > 0 ? 'No hay usuarios que coincidan' : 'No hay usuarios registrados'}
            </h3>
            <p className="text-slate-600">
              {usuarios.length > 0 ? 'Prueba con otro nombre o C.I.' : 'Crea el primer usuario del sistema.'}
            </p>
          </div>
        )}

        <Paginacion paginaActual={paginaActual} totalPaginas={totalPaginas} onCambiar={irAPagina} />
      </div>

      {/* MODAL DE CREACIÓN DE USUARIO */}
      {isCreating && createPortal((
        <div className="fixed inset-0 z-50 overflow-y-auto bg-blue-950/30 backdrop-blur-sm">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="nuevo-usuario-titulo"
              className="w-full max-w-6xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up"
              style={{ animationDuration: '180ms' }}
            >
              <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
                <div className="min-w-0">
                  <h2 id="nuevo-usuario-titulo" className="text-xl font-bold text-blue-900">Nuevo usuario</h2>
                  <p className="mt-0.5 text-sm text-slate-600">Cuenta de acceso, carrera y roles del usuario.</p>
                </div>
                <button
                  type="button"
                  onClick={cancelarCreacion}
                  aria-label="Cerrar"
                  className="flex-shrink-0 rounded-full p-2 -mr-2 text-slate-500 hover:text-blue-900 hover:bg-azulado-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="divide-y divide-azulado-200">
                  <SeccionUsuario titulo="Cuenta">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-4">
                      <CampoUsuario label="Usuario" name="username" value={formData.username || ''} onChange={handleChange} clearError={clearFieldError} error={errors.username} required pulse={errorPulse.username || 0} />
                      <CampoUsuario
                        label="Nombre completo"
                        name="nombre_completo"
                        value={formData.nombre_completo || ''}
                        onChange={handleChange}
                        clearError={clearFieldError}
                        error={nombreCompletoError}
                        required
                        pulse={errorPulse.nombre_completo || errorPulse.first_name || errorPulse.last_name || 0}
                      />
                      <CampoUsuario
                        label="Correo institucional"
                        name="email"
                        type="text"
                        value={formData.email || ''}
                        onChange={handleChange}
                        clearError={clearFieldError}
                        error={errors.email}
                        required
                        pulse={errorPulse.email || 0}
                        autoComplete="email"
                        inputMode="email"
                      />
                      <CampoUsuario
                        label="C.I."
                        name="ci"
                        type="text"
                        value={formData.ci || ''}
                        onChange={handleChange}
                        clearError={clearFieldError}
                        error={errors.ci}
                        pulse={errorPulse.ci || 0}
                        maxLength={15}
                      />
                    </div>
                  </SeccionUsuario>

                  <SeccionUsuario titulo="Roles y carrera">
                    <ListaTransferenciaRoles
                      roles={rolesDisponiblesLista}
                      asignados={rolesAsignadosLista}
                      seleccionIzquierda={selectedRoleLeft}
                      onSeleccionarIzquierda={(valor) => {
                        setSelectedRoleLeft(valor);
                        setErrors((prev) => (prev?.rol ? { ...prev, rol: null } : prev));
                      }}
                      seleccionDerecha={selectedRoleRight}
                      onSeleccionarDerecha={setSelectedRoleRight}
                      onMoverDerecha={moverRolDerecha}
                      onMoverIzquierda={moverRolIzquierda}
                      bloquearAsignar={vinculacionRapidaDocente || rolesAsignadosLista.length >= 2}
                      bloquearQuitar={vinculacionRapidaDocente}
                      etiquetaRol={obtenerRolLabel}
                      carrera={formData.carrera || carreraPropiaEditor}
                      carreras={carrerasGestionables}
                      elegirCarrera={esSuperuserActual}
                      onCambiarCarrera={cambiarCarreraUsuario}
                      error={errorBajoListaCreacion}
                      aviso={esSuperuserActual ? '' : 'La carrera es la tuya: se asigna sola.'}
                      pulso={leftPanelPulsing || rightPanelPulsing}
                    />

                    {[formData.rol, ...asignacionesExtra.map((item) => item.rol)].includes('jefe_estudios') && (
                      <CampoResolucionJefe
                        archivo={resolucionJefe}
                        error={errors.resolucion_jefe}
                        onChange={(archivo) => {
                          setResolucionJefe(archivo);
                          setErrors((prev) => ({ ...prev, resolucion_jefe: null }));
                        }}
                      />
                    )}
                  </SeccionUsuario>

                  <SeccionUsuario titulo="Contraseña">
                    <div className="rounded-2xl bg-white ring-1 ring-inset ring-azulado-300 px-4 py-3">
                      <p className="text-sm text-slate-700" aria-live="polite">
                        Contraseña inicial: <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 ring-1 ring-inset ring-blue-200 font-bold text-blue-900">{formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">El usuario deberá cambiarla al iniciar sesión.</p>
                    </div>
                  </SeccionUsuario>
                </div>

                <div className="px-5 sm:px-6 py-4 flex flex-col-reverse sm:flex-row justify-end gap-2 [border-top:1px_solid_#B8C9E1]">
                  <button
                    type="button"
                    onClick={cancelarCreacion}
                    className={`${BOTON} px-5 py-2.5 bg-white text-slate-700 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100`}
                  >
                    {volverANuevoDocente ? 'Cancelar y volver' : 'Cancelar'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-50`}
                  >
                    {isSubmitting
                      ? (volverANuevoDocente ? 'Guardando y volviendo...' : 'Creando...')
                      : (volverANuevoDocente ? 'Guardar y volver' : 'Crear usuario')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Edición */}
      <ModalUsuario
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaveSuccess={(usuarioActualizado) => {
          setShowModal(false);
          if (usuarioActualizado?.id) {
            setUsuarios((prev) => prev.map((usuario) => (
              usuario.id === usuarioActualizado.id ? usuarioActualizado : usuario
            )));
            setUsuarioEditando(usuarioActualizado);
          }
        }}
        userToEdit={usuarioEditando}
        docentes={docentes}
        carreras={carrerasGestionables}
        roles={roles}
        currentUser={user}
      />

      {/* Confirmación de pausa o reactivación */}
      {showToggleModal && usuarioToToggle && (
        <ModalCentrado onClose={() => setShowToggleModal(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-6 pt-6">
              <h4 className="text-xl font-bold text-blue-900">
                {usuarioToToggle.is_active ? 'Pausar acceso' : 'Reactivar acceso'}
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                {usuarioToToggle.is_active
                  ? <>Se pausará el acceso de <strong className="text-slate-900">{usuarioToToggle.username}</strong> al sistema.</>
                  : <>Se reactivará el acceso de <strong className="text-slate-900">{usuarioToToggle.username}</strong> al sistema.</>}
              </p>
              <p className="mt-2 text-xs text-slate-500">Esta acción se puede revertir desde el interruptor de estado.</p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 py-6">
              <button
                type="button"
                onClick={() => setShowToggleModal(false)}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await api.post(`/usuarios/${usuarioToToggle.id}/toggle_activo/`);
                    toast.success(`Usuario ${usuarioToToggle.is_active ? 'desactivado' : 'reactivado'} con éxito`);
                    setShowToggleModal(false);
                    setUsuarios((prev) => prev.map((usuario) => (
                      usuario.id === usuarioToToggle.id
                        ? (response.data?.id ? response.data : { ...usuario, is_active: !usuario.is_active })
                        : usuario
                    )));
                  } catch (err) {
                    console.error('Error:', err);
                    toast.error('Error al cambiar el estado del usuario');
                  }
                }}
                className={`${BOTON} px-5 py-2.5 text-white ${usuarioToToggle.is_active ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
              >
                {usuarioToToggle.is_active ? 'Pausar acceso' : 'Reactivar'}
              </button>
            </div>
          </div>
        </ModalCentrado>
      )}

      {/* Confirmación de eliminación */}
      {eliminacion && (eliminacion.datos.tiene_datos ? (
        <ModalConfirmar
          key={`no-${eliminacion.usuario.id}`}
          informativo
          titulo="No se puede eliminar"
          mensaje={<><strong className="text-slate-900">{eliminacion.usuario.username}</strong> tiene datos registrados. Desactívelo en su lugar.</>}
          detalle={(eliminacion.datos.detalle || []).map((item) => `${item.etiqueta}: ${item.cantidad}`)}
          onCancelar={() => setEliminacion(null)}
        />
      ) : (
        <ModalConfirmar
          key={`si-${eliminacion.usuario.id}`}
          tono="peligro"
          titulo="Eliminar usuario"
          mensaje={(
            <>
              Se eliminará <strong className="text-slate-900">{eliminacion.usuario.username}</strong> de forma permanente
              {eliminacion.datos.ficha_docente
                ? <>, junto con su ficha de docente (<strong className="text-slate-900">{eliminacion.datos.ficha_docente}</strong>).</>
                : '. No tiene ficha de docente.'}
            </>
          )}
          textoAccion="Eliminar"
          textoTrabajando="Eliminando..."
          onConfirmar={confirmarEliminar}
          onCancelar={() => setEliminacion(null)}
        />
      ))}
    </div>
  );
}

export default GestionUsuarios;
