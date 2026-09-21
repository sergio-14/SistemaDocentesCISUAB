import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { getFondoTiempoDetalle, crearActividad, eliminarActividad, presentarFondoADirector, aprobarFondo } from '../apis/api';
import api from '../apis/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import DistribuirHoras from './DistribuirHoras';
import { useActiveRole } from '../contexts/ActiveRoleContext';
import FormularioObservar from './FormularioObservar';
import BotonFlotanteObservaciones from './BotonFlotanteObservaciones';

// Helpers para extraer datos del vínculo DocenteCarrera desde docente.vinculos
const getVinculoCarrera = (docente, carreraId) => {
  if (!docente?.vinculos) return null;
  return docente.vinculos.find(v => String(v.carrera) === String(carreraId)) || docente.vinculos[0] || null;
};
import FormularioPresentarInforme from './FormularioPresentarInforme';
import FormularioEvaluarInforme from './FormularioEvaluarInforme';
import ThemeToggle from './ThemeToggle';
import CargaHorariaManager from './CargaHorariaManager';
import { getApiErrorMessage } from '../utils/formErrors';
import { FileText as ArchivoIcon, Check as CheckIcon, Trash2 as TrashIcon, AlertTriangle as AlertTriangleIcon, Info as InfoIcon, Send as SendIcon, EyeOff as EyeOffIcon, X as XIcon, Plus as PlusIcon, ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon, Pencil as PencilIcon, Calendar as CalendarIcon, User as UserIcon } from 'lucide-react';
import { Eye, CheckCircle2, FileDown, ChevronLeft, ChevronRight, Paperclip } from 'lucide-react';

// Alias for template consistency
const EyeIcon = Eye;

const ActividadAsignadaCell = ({ detalle, compact = false }) => {
  if (!detalle?.es_subactividad_academica) {
    return <>{detalle?.titulo_actividad || '-'}</>;
  }

  return (
    <div className="flex items-center gap-2 pl-5 whitespace-nowrap">
      <span className="font-black text-sky-700 dark:text-sky-300">-</span>
      <span className={compact ? 'font-semibold' : ''}>{detalle.titulo_actividad || '-'}</span>
    </div>
  );
};

const ordenarDetallesCarga = (categoria) => {
  const detalles = categoria?.detalles_carga || [];
  if (categoria?.tipo !== 'academica') {
    return detalles;
  }

  const usados = new Set();
  const materias = detalles.filter((detalle) => detalle.tipo_actividad === 'clases_aula' && detalle.materia_id);
  const ordenados = [];

  materias.forEach((materia) => {
    ordenados.push(materia);
    usados.add(materia.id);

    detalles
      .filter((detalle) => (
        detalle.es_subactividad_academica
        && String(detalle.materia_id || '') === String(materia.materia_id || '')
      ))
      .sort((a, b) => String(a.tipo_actividad_display || '').localeCompare(String(b.tipo_actividad_display || ''), 'es'))
      .forEach((detalle) => {
        ordenados.push(detalle);
        usados.add(detalle.id);
      });
  });

  detalles.forEach((detalle) => {
    if (!usados.has(detalle.id)) {
      ordenados.push(detalle);
    }
  });

  return ordenados;
};

const ToastDistribucionGuardada = ({ t, onHidden }) => {
  const onHiddenCalledRef = useRef(false);

  useEffect(() => {
    if (!t.visible && !onHiddenCalledRef.current) {
      onHiddenCalledRef.current = true;
      const timeoutId = setTimeout(onHidden, 180);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [t.visible, onHidden]);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-xl border border-emerald-400/70 bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/25 transition-all duration-200 ${
        t.visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-300 text-[11px] font-black text-emerald-950">✓</span>
      <span>✅ Distribución guardada correctamente</span>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className="ml-2 rounded-lg p-1 text-green-50/80 transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Cerrar notificación"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

const ToastDistribucionGuardadaSimple = ({ t, onHidden }) => {
  const onHiddenCalledRef = useRef(false);

  useEffect(() => {
    if (!t.visible && !onHiddenCalledRef.current) {
      onHiddenCalledRef.current = true;
      const timeoutId = setTimeout(onHidden, 180);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [t.visible, onHidden]);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-xl border border-emerald-400/70 bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/25 transition-all duration-200 ${
        t.visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-300 text-emerald-950">
        <CheckIcon className="h-3 w-3" strokeWidth={3} />
      </span>
      <span>Distribución guardada correctamente</span>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className="ml-2 rounded-lg p-1 text-emerald-50/80 transition-colors hover:bg-white/15 hover:text-white"
        aria-label="Cerrar notificacion"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

// --- Iconos SVG personalizados ---
const PaperAirplaneIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

const ExclamationTriangleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
  </svg>
);

const CheckBadgeIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ArrowPathIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-3.181-3.182l-3.182 3.182m0 0a8.25 8.25 0 01-11.664 0l-3.182-3.182" />
  </svg>
);

const LockClosedIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const PlayCircleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
  </svg>
);

const DocumentTextIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const DocumentMagnifyingGlassIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const DocenteIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.221 69.17 69.17 0 00-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
  </svg>
);

const InvestigacionIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>
);

const ExtensionIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.963A3.426 3.426 0 0012 15.75c1.262 0 2.427-.393 3.379-1.085m-6.758 0a3.426 3.426 0 01-3.379-1.085 3.426 3.426 0 01-3.379 1.085C4.26 15.366 3 16.827 3 18.75V19.5a.75.75 0 00.75.75h12.586a.75.75 0 00.75-.75v-.75c0-1.923-1.26-3.384-3.006-3.963zM12 6a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
  </svg>
);

const AsesoriasIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
);

const TribunalesIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
  </svg>
);

const AdministrativoIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.67.38m-4.5-8.006c-1.572-.236-3.176-.387-4.812-.387s-3.24.15-4.812.387m4.812 0v4.5m0-4.5c.325 0 .649.01.976.029.935.058 1.848.179 2.735.357.811.16 1.596.374 2.343.633.587.204 1.144.457 1.66.754.516.336.991.75 1.39 1.238.358.397.667.857.914 1.368.204.42.36.877.463 1.352M6.75 14.15c-.194.165-.42.295-.67.38m0 0c-.877.294-1.593.766-2.09 1.337A2.18 2.18 0 003.75 17.385v2.866M6.75 14.15a2.18 2.18 0 01.75-1.661V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
  </svg>
);

const VidaUniversitariaIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
  </svg>
);

const ExternalLinkIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);
import toast from 'react-hot-toast';
import EstadoTimeline from './fondos/EstadoTimeline';
import EvidenciaActividadModal from './EvidenciaActividadModal';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
const CATEGORIAS_BLOQUEADAS = [];

const CATEGORY_ICONS = {
  'academica': DocenteIcon,
  'investigacion': InvestigacionIcon,
  'extension_universitaria': ExtensionIcon,
  'interaccion_social': AsesoriasIcon,
  'gestion': AdministrativoIcon,
  'academica_administrativa': TribunalesIcon,
  'social_cultural_deportiva': VidaUniversitariaIcon,
};

function DetalleFondo({ isDark }) {
  const { activeAssignment, activeRole, effectiveUser } = useActiveRole();
  const { id } = useParams();
  const navigate = useNavigate();
  const [fondo, setFondo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [error, setError] = useState(null);
  const [mostrarFormActividad, setMostrarFormActividad] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [mostrarFormObservar, setMostrarFormObservar] = useState(false);

  // Extraer datos del vínculo DocenteCarrera para el docente de este fondo
  const vinculo = getVinculoCarrera(fondo?.docente, fondo?.carrera);
  const dedicacionDocente = vinculo?.dedicacion || null;
  const categoriaDocente = vinculo?.categoria || null;
  const [mostrarModalAprobar, setMostrarModalAprobar] = useState(false);
  const observacionesRef = useRef();
  const [observacionesPendientes, setObservacionesPendientes] = useState(0);
  const [actividadAEditar, setActividadAEditar] = useState(null);
  const [mostrarFormEditar, setMostrarFormEditar] = useState(false);
  const [actividadAEliminar, setActividadAEliminar] = useState(null);
  const scrollPosRef = useRef(0);
  const contenedorRef = useRef(null);
  const refWidgetReferencia = useRef(null);
  const refWidgetAcciones = useRef(null);
  const refWidgetCarga = useRef(null);
  const [esStaff, setEsStaff] = useState(false);
  const [mostrarFormPresentarInforme, setMostrarFormPresentarInforme] = useState(false);
  const [mostrarFormEvaluarInforme, setMostrarFormEvaluarInforme] = useState(false);
  const [mostrarModalIniciarEjecucion, setMostrarModalIniciarEjecucion] = useState(false);
  const [mostrarModalInforme, setMostrarModalInforme] = useState(false);
  const [evidenciaActividadModal, setEvidenciaActividadModal] = useState(null);
  const [cargaParaEditar, setCargaParaEditar] = useState(null);
  const [panelCentral, setPanelCentral] = useState('resumen');
  const [direccionPanel, setDireccionPanel] = useState('derecha');
  const [animarPanelCentral, setAnimarPanelCentral] = useState(false);
  const [slideGrafico, setSlideGrafico] = useState(0);
  const vistaActual = 'docente';
  const slideGraficoRef = useRef(0);
  const timerGraficoRef = useRef(null);
  const prevTotalesCategoriasRef = useRef({});
  const estadoFondoRef = useRef(null);
  const observacionesPendientesRef = useRef(0);
  const [animarTransicionMacroMicro, setAnimarTransicionMacroMicro] = useState(false);
  const secuenciaGuardadoTimeoutsRef = useRef([]);
  const limpiarSecuenciaGuardado = () => {
    secuenciaGuardadoTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    secuenciaGuardadoTimeoutsRef.current = [];
  };
  const [secuenciaGuardado, setSecuenciaGuardado] = useState({
    activa: false,
    balance: true,
    distribucion: true,
    acciones: true,
  });
  const iniciarSecuenciaGuardado = () => {
    limpiarSecuenciaGuardado();
    setAnimarPanelCentral(false);
    setPanelCentral('resumen');
    setAnimarTransicionMacroMicro(false);
    setSecuenciaGuardado({
      activa: true,
      balance: false,
      distribucion: false,
      acciones: false,
    });

    secuenciaGuardadoTimeoutsRef.current = [
      setTimeout(() => {
        setAnimarTransicionMacroMicro(true);
        setSecuenciaGuardado((prev) => ({ ...prev, balance: true }));
      }, 0),
      setTimeout(() => {
        setSecuenciaGuardado((prev) => ({ ...prev, distribucion: true }));
      }, 500),
      setTimeout(() => {
        setSecuenciaGuardado((prev) => ({ ...prev, acciones: true }));
      }, 1000),
      setTimeout(() => {
        setDireccionPanel('derecha');
        setAnimarPanelCentral(true);
        setPanelCentral('carga');
      }, 1500),
      setTimeout(() => {
        setAnimarTransicionMacroMicro(false);
        setSecuenciaGuardado({
          activa: false,
          balance: true,
          distribucion: true,
          acciones: true,
        });
      }, 2250),
    ];
  };

  // La redacción/edición del Informe de Cumplimiento vive ahora en una página
  // dedicada (EditorInformePage.jsx, ruta /fondos/:id/informe) en vez de un
  // modal aquí. Solo quedan los estados para "Ver Informe" (solo lectura) y
  // el flujo de observaciones del Director, que siguen siendo parte de esta vista.
  const [mostrarModalObservarInforme, setMostrarModalObservarInforme] = useState(false);
  const [comentarioObservarInforme, setComentarioObservarInforme] = useState('');
  const [enviandoObservacionInforme, setEnviandoObservacionInforme] = useState(false);

  // iiisyp es solo lectura: no puede aprobar ni gestionar fondos
  const rolOperativo = activeRole || activeAssignment?.rol || effectiveUser?.perfil?.rol || usuarioActual?.perfil?.rol;
  const esSuperAdmin = usuarioActual?.is_superuser === true;
  const esAdmin = false;
  const esDirector = rolOperativo === 'director';
  const esJefeEstudios = rolOperativo === 'jefe_estudios';
  const esIisyp = rolOperativo === 'iiisyp';
  const puedeGestionarDistribucion = esSuperAdmin || esJefeEstudios;
  const puedeGestionarCarga = esSuperAdmin || esJefeEstudios;
  const soloLecturaPorRol = !puedeGestionarCarga;
  const puedePresentarADirector = fondo?.estado === 'borrador' && (esJefeEstudios || esSuperAdmin);
  const puedeReenviarADirector = fondo?.estado === 'observado' && (esJefeEstudios || esSuperAdmin);
  const fondoPresentadoADirector = fondo?.estado === 'presentado_director' && (esJefeEstudios || esSuperAdmin);

  useEffect(() => {
    // Define panel inicial por rol al entrar a la vista.
    setAnimarPanelCentral(false);
    setPanelCentral('resumen');
  }, [puedeGestionarCarga]);

  const solicitarCorreccionesInforme = async () => {
    if (comentarioObservarInforme.trim().length < 10) {
      toast.error('Debes explicar qué debe corregir el docente (mínimo 10 caracteres).');
      return;
    }
    try {
      setEnviandoObservacionInforme(true);
      await api.post(`/fondos-tiempo/${fondo.id}/observar-informe/`, { comentario: comentarioObservarInforme.trim() });
      toast.success('Se solicitaron correcciones al docente.');
      setMostrarModalObservarInforme(false);
      setComentarioObservarInforme('');
      setMostrarModalInforme(false);
      await cargarDetalle({ silencioso: true });
    } catch (err) {
      console.error('Error al observar informe:', err);
      toast.error(getApiErrorMessage(err, 'No se pudo enviar la solicitud de corrección'));
    } finally {
      setEnviandoObservacionInforme(false);
    }
  };


  useEffect(() => {
    estadoFondoRef.current = null;
    observacionesPendientesRef.current = 0;
    cargarDetalle();
  }, [id, activeAssignment?.id]);

  // Guarda el ultimo total por categoria para detectar aparicion de tarjetas (0 -> >0)
  useEffect(() => {
    if (!fondo?.categorias) return;
    const snapshot = {};
    fondo.categorias.forEach((categoria) => {
      snapshot[categoria.id] = Number(categoria.total_horas || 0);
    });
    prevTotalesCategoriasRef.current = snapshot;
  }, [fondo?.categorias]);

  // Evita overlays residuales al entrar a otro detalle
  useEffect(() => {
    setMostrarFormActividad(false);
    setMostrarFormEditar(false);
    setMostrarFormObservar(false);
    setMostrarFormPresentarInforme(false);
    setMostrarFormEvaluarInforme(false);
    setMostrarModalAprobar(false);
    setMostrarModalIniciarEjecucion(false);
    setMostrarModalInforme(false);
    setActividadAEliminar(null);
  }, [id]);

  // Limpiar todos los modales al desmontar el componente
  useEffect(() => {
    return () => {
      limpiarSecuenciaGuardado();
      setMostrarFormActividad(false);
      setMostrarFormEditar(false);
      setMostrarFormObservar(false);
      setMostrarFormPresentarInforme(false);
      setMostrarFormEvaluarInforme(false);
      setMostrarModalAprobar(false);
      setMostrarModalIniciarEjecucion(false);
      setMostrarModalInforme(false);
      setActividadAEliminar(null);
    };
  }, [activeAssignment?.id]);

  // Sincronizar altura de Acciones y CargaHoraria con el grupo Balance+Distribución
  useEffect(() => {
    const refEl = refWidgetReferencia.current;
    const accionesEl = refWidgetAcciones.current;
    const cargaEl = refWidgetCarga.current;
    if (!refEl) return;

    const sync = () => {
      const h = refEl.getBoundingClientRect().height;
      if (accionesEl) {
        accionesEl.style.height = h + 'px';
        accionesEl.style.overflowY = 'auto';
      }
      if (cargaEl) {
        cargaEl.style.height = h + 'px';
        cargaEl.style.overflowY = 'auto';
      }
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(refEl);
    return () => observer.disconnect();
  });

  useEffect(() => {
    const cargarUsuario = async () => {
      try {
        const response = await api.get('/usuario/');
        setUsuarioActual(response.data);
      } catch (err) {
        console.error('Error al cargar usuario:', err);
      }
    };

    cargarUsuario();
  }, [activeAssignment?.id]);

  // Timer automático del carrusel de gráfica (avanza cada 5 seg)
  useEffect(() => {
    timerGraficoRef.current = setInterval(() => {
      const next = (slideGraficoRef.current + 1) % 2;
      slideGraficoRef.current = next;
      setSlideGrafico(next);
    }, 5000);
    return () => {
      if (timerGraficoRef.current) clearInterval(timerGraficoRef.current);
    };
  }, []);

  const cargarDetalle = async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setLoading(true);
      setError(null);
      const response = await getFondoTiempoDetalle(id);
      setFondo(response.data);
      const pendientes = response.data.observaciones_detalladas?.filter(obs => !obs.resuelta).length || 0;
      setObservacionesPendientes(pendientes);
      estadoFondoRef.current = response.data.estado;
      observacionesPendientesRef.current = pendientes;

      // Verificar si el usuario es staff/director
      try {
        const userResponse = await api.get('/usuario/');
        setEsStaff(userResponse.data.is_staff || false);
      } catch (userErr) {
        console.warn('No se pudo verificar permisos de usuario:', userErr);
        setEsStaff(false);
      }

      if (!silencioso) setLoading(false);
    } catch (err) {
      console.error('Error al cargar detalle:', err);

      if (err.response?.status === 401) {
        setError('Sesión expirada. Por favor, inicia sesión nuevamente.');
      } else {
        setError('Error al cargar el detalle del fondo');
      }
      if (!silencioso) setLoading(false);
    }
  };

  useEffect(() => {
    const debeVigilarCambios =
      (esJefeEstudios && fondo?.estado === 'presentado_director') ||
      (esDirector && ['borrador', 'observado'].includes(fondo?.estado));

    if (!debeVigilarCambios) return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      getFondoTiempoDetalle(id)
        .then((response) => {
          const pendientes = response.data.observaciones_detalladas?.filter(obs => !obs.resuelta).length || 0;
          if (estadoFondoRef.current === null) {
            estadoFondoRef.current = response.data.estado;
            observacionesPendientesRef.current = pendientes;
            return;
          }

          const cambioDetectado =
            response.data.estado !== estadoFondoRef.current ||
            pendientes !== observacionesPendientesRef.current;

          if (!cambioDetectado) return;

          setFondo(response.data);
          setObservacionesPendientes(pendientes);
          estadoFondoRef.current = response.data.estado;
          observacionesPendientesRef.current = pendientes;
        })
        .catch((err) => {
          console.warn('No se pudo sincronizar el estado del fondo:', err);
        });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [id, activeAssignment?.id, fondo?.estado, esJefeEstudios, esDirector]);

  const handleActualizacionHoras = () => {
    cargarDetalle({ silencioso: true });
  };

  const cerrarPanel = () => {
    navigate('/fondo-tiempo');
  };

  const abrirFormularioActividad = (categoria) => {
    if (!puedeGestionarDistribucion) {
      toast.error('Solo Jefatura puede agregar actividades.');
      return;
    }
    setCategoriaSeleccionada(categoria);
    setMostrarFormActividad(true);
  };

  const abrirFormularioActividadGlobal = () => {
    if (!puedeGestionarDistribucion) {
      toast.error('Solo Jefatura puede agregar actividades.');
      return;
    }
    const catDefault = fondo.categorias?.find(c => c.tipo === 'social_cultural_deportiva') || fondo.categorias?.[0] || { id: '' };
    setCategoriaSeleccionada({ id: catDefault.id, nombre: catDefault.tipo_display });
    setMostrarFormActividad(true);
  };

  const cerrarFormularioActividad = () => {
    setMostrarFormActividad(false);
    setCategoriaSeleccionada(null);
  };

  const getScrollContainer = () => {
    let element = contenedorRef.current;

    while (element && element !== document.body) {
      const hasScroll = element.scrollHeight > element.clientHeight;
      const overflowY = window.getComputedStyle(element).overflowY;

      if (hasScroll && (overflowY === 'auto' || overflowY === 'scroll')) {
        return element;
      }

      element = element.parentElement;
    }

    return null;
  };

  const guardarActividad = async (actividadData) => {
    if (!puedeGestionarDistribucion) {
      toast.error('No tienes permisos para agregar actividades.');
      return;
    }
    try {
      const scrollContainer = getScrollContainer();
      scrollPosRef.current = scrollContainer
        ? scrollContainer.scrollTop
        : window.scrollY;

      await crearActividad(actividadData);
      toast.success('Actividad agregada exitosamente');
      cerrarFormularioActividad();
      await cargarDetalle({ silencioso: true });

      setTimeout(() => {
        const container = getScrollContainer();
        if (container) {
          container.scrollTop = scrollPosRef.current;
        } else {
          window.scrollTo(0, scrollPosRef.current);
        }
      }, 300);
    } catch (err) {
      console.error('Error al guardar actividad:', err);
      toast.error(getApiErrorMessage(err, 'Error al guardar la actividad'));
    }
  };

  const editarActividadHandler = (actividad) => {
    if (!puedeGestionarDistribucion) {
      toast.error('No tienes permisos para editar actividades.');
      return;
    }
    setActividadAEditar(actividad);
    setCategoriaSeleccionada({
      id: actividad.categoria,
      nombre: actividad.categoria_nombre || 'Categoría'
    });
    setMostrarFormEditar(true);
  };

  const actualizarActividad = async (actividadData) => {
    if (!puedeGestionarDistribucion) {
      toast.error('No tienes permisos para editar actividades.');
      return;
    }
    try {
      const scrollContainer = getScrollContainer();
      scrollPosRef.current = scrollContainer
        ? scrollContainer.scrollTop
        : window.scrollY;

      await api.put(`/actividades/${actividadAEditar.id}/`, actividadData);
      toast.success('Actividad actualizada exitosamente');
      setMostrarFormEditar(false);
      setActividadAEditar(null);
      await cargarDetalle({ silencioso: true });

      setTimeout(() => {
        const container = getScrollContainer();
        if (container) {
          container.scrollTop = scrollPosRef.current;
        } else {
          window.scrollTo(0, scrollPosRef.current);
        }
      }, 300);
    } catch (err) {
      console.error('Error al actualizar actividad:', err);
      toast.error(getApiErrorMessage(err, 'Error al actualizar la actividad'));
    }
  };

  const confirmarEliminarActividad = async () => {
    if (!actividadAEliminar) return;
    if (!puedeGestionarDistribucion) {
      toast.error('No tienes permisos para eliminar actividades.');
      return;
    }

    try {
      const scrollContainer = getScrollContainer();
      scrollPosRef.current = scrollContainer
        ? scrollContainer.scrollTop
        : window.scrollY;

      await eliminarActividad(actividadAEliminar);
      toast.success('Actividad eliminada');
      setActividadAEliminar(null);
      await cargarDetalle({ silencioso: true });

      setTimeout(() => {
        const container = getScrollContainer();
        if (container) {
          container.scrollTop = scrollPosRef.current;
        } else {
          window.scrollTo(0, scrollPosRef.current);
        }
      }, 300);
    } catch (err) {
      console.error('Error al eliminar:', err);
      toast.error('❌ Error al eliminar la actividad');
    }
  };

  const presentarADirector = async () => {
    const esReenvio = fondo.estado === 'observado';
    try {
      const requisitosPresentacion = validarRequisitos();
      if (!requisitosPresentacion.total) {
        toast.error('Complete la distribución de horas y asigne al menos una materia antes de presentar');
        return;
      }

      await presentarFondoADirector(fondo.id);
      setFondo((prev) => prev ? {
        ...prev,
        estado: 'presentado_director',
        fecha_presentacion: new Date().toISOString(),
      } : prev);
      if (esReenvio) {
        setObservacionesPendientes(0);
        observacionesPendientesRef.current = 0;
      }
      estadoFondoRef.current = 'presentado_director';
      toast.success(esReenvio ? 'Fondo reenviado al Director correctamente' : 'Fondo presentado al Director exitosamente');
    } catch (err) {
      console.error('Error al presentar:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);

      toast.error(getApiErrorMessage(err, 'Error al presentar el fondo'));
    }
  };

  const aprobarFondoHandler = async () => {
    try {
      const response = await aprobarFondo(fondo.id);
      toast.success('Fondo aprobado exitosamente');
      setMostrarModalAprobar(false);
      await cargarDetalle({ silencioso: true });
    } catch (err) {
      console.error('Error al aprobar:', err);
      toast.error(getApiErrorMessage(err, 'Error al aprobar el fondo'));
    }
  };

  const abrirPdfEnNuevaPestana = () => {
    toast.loading('Generando PDF...', { id: 'pdf-oficial' });
    api.get(`/fondos-tiempo/${id}/pdf-oficial/`, { responseType: 'blob' })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        // Un <a target="_blank"> "clickeado" programáticamente abre el blob
        // en una pestaña nueva sin que el bloqueador de pop-ups lo detenga
        // (a diferencia de window.open() llamado después de un await).
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        toast.dismiss('pdf-oficial');
      })
      .catch((error) => {
        console.error('Error al generar PDF:', error);
        toast.dismiss('pdf-oficial');
        toast.error('❌ Error al generar el PDF');
      });
  };

  const iniciarEjecucionHandler = async () => {
    try {
      await api.post(`/fondos-tiempo/${fondo.id}/iniciar_ejecucion/`);
      toast.success('Ejecución iniciada exitosamente');
      setMostrarModalIniciarEjecucion(false);
      await cargarDetalle({ silencioso: true });
    } catch (err) {
      console.error('Error al iniciar ejecución:', err);
      toast.error(getApiErrorMessage(err, 'Error al iniciar la ejecucion'));
    }
  };


  const abrirFormularioObservar = () => {
    setMostrarFormObservar(true);
  };

  const cerrarFormularioObservar = () => {
    setMostrarFormObservar(false);
  };

  const handleObservacionEnviada = async () => {
    cerrarFormularioObservar();
    setFondo((prev) => prev ? {
      ...prev,
      estado: 'observado',
    } : prev);
    setObservacionesPendientes((prev) => {
      const siguiente = Math.max(1, Number(prev || 0) + 1);
      observacionesPendientesRef.current = siguiente;
      return siguiente;
    });
    estadoFondoRef.current = 'observado';

    if (observacionesRef.current) {
      await observacionesRef.current.actualizarObservaciones();
    }
  };

  const getPeriodoLabel = (periodo) => {
    const periodos = {
      '1S': 'Primer Semestre',
      '2S': 'Segundo Semestre',
      'A': 'Anual',
      'V': 'Verano'
    };
    return periodos[periodo] || periodo;
  };

  const calcularDiasEnEtapa = () => {
    if (!fondo || !fondo.fecha_creacion) return 0;
    const fechaCreacion = new Date(fondo.fecha_creacion);
    const ahora = new Date();
    const diferenciaMilisegundos = ahora - fechaCreacion;
    const dias = Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
    return dias;
  };

  const verificarEstadoCronometro = () => {
    if (!fondo || !fondo.fecha_finalizacion) return { activo: false, vencido: false };
    
    const ahora = new Date();
    const fechaFinalizacion = new Date(fondo.fecha_finalizacion);
    
    // Si la fecha de hoy es igual o mayor a la fecha de finalización estimada, está vencido
    const vencido = ahora >= fechaFinalizacion;
    
    return { 
      activo: !vencido,  // Activo si NO está vencido
      vencido: vencido
    };
  };

  const getColoresDiasEnEtapa = () => {
    const { activo, vencido } = verificarEstadoCronometro();
    
    // Punto verde si está activo (dentro del plazo), rojo si vencido
    const punto = activo ? 'bg-green-500' : 'bg-red-500';
    
    // Número siempre azul (visible)
    const numero = 'text-blue-600 dark:text-blue-400';
    
    return { numero, punto, activo, vencido };
  };

  const obtenerTextoDiasEnEtapa = () => {
    const { activo, vencido } = verificarEstadoCronometro();
    
    // Si está vencido, mostrar "Vencido"
    if (vencido) {
      return 'Vencido';
    }
    
    // Si está activo, mostrar días desde creación
    if (activo) {
      return `${calcularDiasEnEtapa()} días`;
    }
    
    return '0 días';
  };

  const getEstadoBadgeColor = (estado) => {
    const colores = {
      'borrador': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-500',
      'presentado_director': 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
      'revision_director': 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
      'aprobado_director': 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
      'en_ejecucion': 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
      'informe_presentado': 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700',
      'finalizado': 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700',
      'observado': 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700',
      'rechazado': 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
    };
    return colores[estado] || colores['borrador'];
  };

  const obtenerIniciales = (nombre) => {
    if (!nombre) return '??';
    return nombre.split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const validarRequisitos = () => {
    if (!fondo) return { horas: false, micro: false, total: false };

    const totalAsignado = Number(fondo.total_asignado || 0);
    const horasObjetivo = Number(fondo.horas_semana || 0);
    const horas = horasObjetivo > 0 && Math.abs(totalAsignado - horasObjetivo) < 0.1;
    const micro = microCompletoExacto;

    return {
      horas,
      micro,
      total: horas && micro
    };
  };

  // --- RENDERIZADO INTELIGENTE DE EVIDENCIAS ---
  const renderEvidencia = (actividad) => {
    const texto = actividad.evidencias;
    const archivo = actividad.archivo_evidencia;

    // 1. Prioridad: Si hay archivo adjunto, mostrar botón de descarga
    if (archivo) {
      return (
        <a
          href={archivo}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-colors border border-indigo-200 dark:border-indigo-800 shadow-sm group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 group-hover:scale-110 transition-transform">
            <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
          </svg>
          Ver Archivo
        </a>
      );
    }

    if (!texto) return <span className="text-slate-300 dark:text-slate-600 italic text-xs">-</span>;

    // 2. Detectar URL en el texto (http o www)
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/;
    const match = texto.match(urlRegex);

    if (match) {
      let url = match[0];
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold transition-colors border border-blue-200 dark:border-blue-800 shadow-sm group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 group-hover:scale-110 transition-transform">
            <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
            <path d="M11.603 7.96a.75.75 0 00-1.06-1.06l-2.25 2.25a4 4 0 005.656 5.656l3-3a4 4 0 00-.225-5.865.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.25-1.25z" />
          </svg>
          Ver Respaldo
        </a>
      );
    }

    // 3. Texto normal (Memo, Referencia, etc) - Estilo Badge
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-300 dark:border-slate-600 max-w-full truncate" title={texto}>
        {texto}
      </span>
    );
  };

  const handleEditCarga = (detalle, tipoCategoria) => {
    setCargaParaEditar({ ...detalle, categoria: tipoCategoria });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Edita la asignación en el formulario superior', { icon: '✏️' });
  };

  const handleDeleteCarga = async (id) => {
    if (!confirm("¿Eliminar esta asignación de carga horaria?")) return;
    try {
      await api.delete(`/cargas-horarias/${id}/`);
      toast.success("Asignación eliminada");
      cargarDetalle({ silencioso: true });
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-xl shadow-md max-w-md">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-red-700 dark:text-red-400 font-semibold mb-2">{error}</p>
              {error.includes('sesión') && (
                <button
                  onClick={() => navigate('/login')}
                  className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Ir a Login
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!fondo) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-6 rounded-xl shadow-md max-w-lg w-full">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-amber-800 dark:text-amber-300 font-semibold mb-2">
                No se pudo cargar el detalle del Fondo de Tiempo.
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
                La respuesta del servidor llegó vacia o incompleta para este registro.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={cargarDetalle}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors"
                >
                  Reintentar
                </button>
                <button
                  onClick={cerrarPanel}
                  className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium transition-colors"
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const datosGrafico = fondo.categorias
    ?.filter(cat => cat.total_horas > 0)
    .map(cat => ({
      name: cat.tipo_display,
      value: parseFloat(cat.total_horas),
      porcentaje: parseFloat(cat.porcentaje)
    })) || [];
  const tieneDistribucionGuardada = Number(fondo.total_asignado || 0) > 0 || datosGrafico.length > 0;
  const mostrarBalanceWidget = secuenciaGuardado.activa ? secuenciaGuardado.balance : tieneDistribucionGuardada;
  const mostrarDistribucionWidget = secuenciaGuardado.activa ? secuenciaGuardado.distribucion : tieneDistribucionGuardada;
  const mostrarAccionesWidget = secuenciaGuardado.activa ? secuenciaGuardado.acciones : tieneDistribucionGuardada;
  const objetivoMicroAnual = Math.round(Number(fondo.horas_efectivas || 1712));
  const totalMicroAnual = Math.round((fondo.categorias || []).reduce(
    (total, categoria) => total + Number(categoria.total_carga_horaria || 0),
    0
  ));
  const microCompletoExacto = objetivoMicroAnual > 0 && totalMicroAnual === objetivoMicroAnual;
  const tieneProgramaAnalitico = Boolean(fondo.tiene_programa_analitico);
  const puedeConfirmarPresentacion = microCompletoExacto && tieneProgramaAnalitico;
  const motivoPresentacionBloqueada = !microCompletoExacto
    ? `Micro incompleto: ${totalMicroAnual}/${objetivoMicroAnual} hrs/año`
    : (!tieneProgramaAnalitico ? 'Debe adjuntar el Programa Analítico antes de presentar al Director' : '');

  const puedeEditar = fondo.puede_editar;
  const ocultarDetallePorBorradorDirector = esDirector && !esSuperAdmin && fondo.estado === 'borrador';
  const puedeEditarDocente = (Boolean(puedeEditar) || esSuperAdmin) && !esAdmin && puedeGestionarDistribucion;
  const puedeEditarDistribucion = puedeEditarDocente && ['borrador', 'observado'].includes(fondo.estado);

  const mostrarCargaAcademica = panelCentral === 'carga';
  const panelCentralInfo = mostrarCargaAcademica
    ? {
        titulo: 'Asignacion de Carga Especifica (Micro)',
        descripcion: 'Detalle las materias, paralelos y horarios que sustentan la categoria Academica.'
      }
    : {
        titulo: 'Distribucion de Horas (Macro)',
        descripcion: `Asigne las ${Math.round(Number(fondo.horas_semana || 40))} horas semanales en las 7 categorias reglamentarias.`
      };

  const desplazarDerecha = () => {
    if (!puedeGestionarCarga) return;
    setDireccionPanel('derecha');
    setAnimarPanelCentral(true);
    setPanelCentral((prev) => (prev === 'resumen' ? 'carga' : 'resumen'));
  };

  const desplazarIzquierda = () => {
    if (!puedeGestionarCarga) return;
    setDireccionPanel('izquierda');
    setAnimarPanelCentral(true);
    setPanelCentral((prev) => (prev === 'resumen' ? 'carga' : 'resumen'));
  };

  const handleDistribucionGuardada = () => {
    limpiarSecuenciaGuardado();
    setPanelCentral('resumen');
    setAnimarTransicionMacroMicro(false);
    setSecuenciaGuardado({
      activa: true,
      balance: false,
      distribucion: false,
      acciones: false,
    });

    toast.success('Distribución guardada correctamente');
    secuenciaGuardadoTimeoutsRef.current.push(
      setTimeout(iniciarSecuenciaGuardado, 1000)
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Contenido Simétrico (3 columnas: izq - centro - drch) */}
      <div ref={contenedorRef} className="flex-1 overflow-y-auto scroll-smooth">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-8 py-8">

          {/* Header Card Rediseñado v3 */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-300 dark:border-slate-700 mb-8 relative group">

            {/* Decoración de fondo */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl"></div>
            </div>

            {/* Botón cerrar - Mitad adentro mitad afuera */}
            <div className="absolute -top-3 -right-3 z-50">
              <button
                onClick={cerrarPanel}
                className="p-2 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all hover:scale-110 shadow-lg border-2 border-slate-300 dark:border-slate-600"
                title="Volver al listado"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 md:p-8 relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center gap-6 lg:gap-8">

              {/* Avatar e Info Principal en fila */}
              <div className="flex flex-col md:flex-row items-center md:items-start lg:items-center gap-5 lg:gap-6 flex-1 w-full lg:w-auto">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-3xl md:text-4xl shadow-lg ring-4 ring-white dark:ring-slate-800/50 transform group-hover:scale-105 transition-transform duration-300">
                    {obtenerIniciales(fondo.docente?.nombre_completo)}
                  </div>
                </div>

                {/* Información Central */}
                <div className="flex-1 text-center md:text-left space-y-2 w-full">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">
                      {fondo.docente?.nombre_completo || 'Docente'}
                    </h1>
                    <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 mt-2 font-medium">
                      <span className="bg-slate-100/80 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-600/50">
                        {fondo.carrera?.nombre || 'Carrera'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-center md:justify-start w-full">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/80 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      {fondo.asignatura}
                    </div>
                  </div>
                </div>
              </div>

              {/* Divisor vertical en desktop */}
              <div className="hidden lg:block w-px h-24 bg-slate-200/80 dark:bg-slate-700/80 self-center"></div>

              {/* Widgets de Información Secundaria apilados verticalmente (Categoría arriba de Balance) */}
              <div className="flex flex-col gap-2.5 justify-center w-full lg:w-48 shrink-0">
                {categoriaDocente && (
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 px-4 py-2 flex items-center justify-start gap-3 w-full shadow-sm hover:shadow transition-shadow">
                    <div className="text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-bold tracking-widest text-slate-800 dark:text-slate-200 uppercase leading-none pb-0.5">Categoría</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm capitalize leading-tight">
                        {categoriaDocente}
                      </span>
                    </div>
                  </div>
                )}

                {dedicacionDocente && (
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 px-4 py-2 flex items-center justify-start gap-3 w-full shadow-sm hover:shadow transition-shadow">
                    <div className="text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-bold tracking-widest text-slate-800 dark:text-slate-200 uppercase leading-none pb-0.5">Balance Legal</span>
                      <div className="flex items-center gap-1.5 leading-tight">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                            {dedicacionDocente === 'tiempo_completo' ? 'TC'
                             : dedicacionDocente === 'medio_tiempo' ? 'MT'
                             : dedicacionDocente === 'horario_16' ? 'TH-16'
                             : dedicacionDocente === 'horario_24' ? 'TH-24'
                             : dedicacionDocente === 'horario_40' ? 'TH-40'
                             : dedicacionDocente === 'horario_48' ? 'TH-48'
                             : 'TH'}
                        </span>
                        <span className="text-green-500 font-bold">•</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{fondo.antiguedad} años</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Divisor vertical en desktop */}
              <div className="hidden lg:block w-px h-24 bg-slate-200/80 dark:bg-slate-700/80 self-center"></div>

              {/* Metadata (Estado, Periodo, Gestión) Compacto */}
              <div className="flex flex-col gap-2.5 min-w-[160px] w-full lg:w-48 shrink-0">
                {/* Tiempo en Etapa */}
                <div className="px-4 py-2.5 rounded-xl border shadow-sm flex flex-col items-center justify-center bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center gap-2 w-full justify-center mb-1">
                    <div className={`w-3 h-3 rounded-full ${getColoresDiasEnEtapa().punto} shadow-md animate-pulse`}></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200">Tiempo en Etapa</span>
                  </div>
                  <p className={`text-2xl font-black leading-tight ${getColoresDiasEnEtapa().numero}`}>
                    {obtenerTextoDiasEnEtapa()}
                  </p>
                </div>

                {/* Periodo y Gestión (Combinados) */}
                <div className="flex gap-2.5 w-full">
                  <div className="flex-1 bg-slate-50/70 dark:bg-slate-800/40 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col items-center justify-center py-2 px-1">
                    <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest pb-0.5">Periodo</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">{getPeriodoLabel(fondo.periodo)}</span>
                  </div>
                  <div className="flex-1 bg-slate-50/70 dark:bg-slate-800/40 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-col items-center justify-center py-2 px-1">
                    <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest pb-0.5">Gestión</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-none">{fondo.gestion}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {ocultarDetallePorBorradorDirector ? (
            <div className="rounded-[1.4rem] border border-slate-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-slate-800/95 p-5 shadow-lg shadow-slate-200/60 dark:shadow-slate-950/20">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                  <InfoIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Fondo pendiente de presentacion
                  </h2>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Este fondo aun no ha sido presentado por el Jefe de Estudios. La distribucion Macro, las asignaciones Micro y las acciones de revision estaran disponibles cuando el fondo sea presentado formalmente al Director.
                  </p>
                </div>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* ================================================= */}
            {/* PANEL IZQUIERDO - Widgets de estado y balance */}
            {/* ================================================= */}
            <div className="lg:col-span-3 flex flex-col space-y-6">

              {/* Grupo alineado: Balance de Horas + Distribución (referencia de altura para Acciones) */}
              <div ref={refWidgetReferencia} className="flex flex-col gap-6 sticky top-24">

                {/* Widget Balance de Horas */}
                <div
                  className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm p-6 relative overflow-hidden ${!mostrarBalanceWidget ? 'hidden' : ''} ${animarTransicionMacroMicro ? 'animate-slide-up' : ''}`}
                  style={animarTransicionMacroMicro ? { animationDuration: '140ms', animationFillMode: 'both' } : undefined}
                >
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Balance de Horas
                  </h3>
                  <div className="space-y-5">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-300 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Requerido</span>
                      <span className="font-black text-slate-800 dark:text-white">{Math.round(fondo.horas_efectivas)}h</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-slate-300 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Asignado</span>
                      <span className="font-black text-green-600 dark:text-green-400">{Math.round(fondo.total_asignado)}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Disponible</span>
                      <span className={`font-black text-lg ${fondo.horas_disponibles < 0 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                        {Math.round(fondo.horas_disponibles)}h
                      </span>
                    </div>
                  </div>
                </div>

                {/* Widget Gráfico Distribución - Carrusel */}
                {mostrarDistribucionWidget && datosGrafico.length > 0 && (() => {
                  const totalHoras = datosGrafico.reduce((s, d) => s + d.value, 0);
                  const maxVal = Math.max(...datosGrafico.map(d => d.value));

                  const irASlide = (idx) => {
                    setSlideGrafico(idx);
                    slideGraficoRef.current = idx;
                    // Reiniciar timer
                    if (timerGraficoRef.current) clearInterval(timerGraficoRef.current);
                    timerGraficoRef.current = setInterval(() => {
                      const next = (slideGraficoRef.current + 1) % 2;
                      slideGraficoRef.current = next;
                      setSlideGrafico(next);
                    }, 5000);
                  };

                  return (
                    <div
                      className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm p-6 relative overflow-hidden ${animarTransicionMacroMicro ? 'animate-slide-up' : ''}`}
                      style={animarTransicionMacroMicro ? { animationDuration: '140ms', animationFillMode: 'both' } : undefined}
                    >
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Distribución
                      </h3>

                      {/* Área de slides */}
                      <div className="relative overflow-hidden" style={{ height: '11rem' }}>
                        <div
                          className="flex transition-transform duration-500 ease-in-out h-full"
                          style={{ transform: `translateX(-${slideGrafico * 100}%)` }}
                        >
                          {/* SLIDE 1 — PieChart */}
                          <div className="min-w-full h-full flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                              <PieChart>
                                <Pie
                                  data={datosGrafico}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={40}
                                  outerRadius={58}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {datosGrafico.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value) => `${Math.round(value)}h`} />
                                <Legend verticalAlign="bottom" height={18} iconSize={8} wrapperStyle={{ fontSize: '9px' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          {/* SLIDE 2 — Figuras geométricas (barras proporcionales) */}
                          <div className="min-w-full h-full flex-shrink-0 flex flex-col justify-between py-1">
                            <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                              {datosGrafico.map((entry, index) => {
                                const pct = maxVal > 0 ? (entry.value / maxVal) * 100 : 0;
                                const color = COLORS[index % COLORS.length];
                                return (
                                  <div key={index} className="flex items-center gap-2">
                                    {/* Etiqueta */}
                                    <span
                                      className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate"
                                      style={{ minWidth: '56px', maxWidth: '56px' }}
                                    >
                                      {entry.name?.split(' ')[0]}
                                    </span>
                                    {/* Barra */}
                                    <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-700 rounded-md overflow-hidden">
                                      <div
                                        className="h-full rounded-md transition-all duration-700"
                                        style={{ width: `${pct}%`, backgroundColor: color }}
                                      />
                                    </div>
                                    {/* Valor */}
                                    <span className="text-[9px] font-bold" style={{ color, minWidth: '26px', textAlign: 'right' }}>
                                      {Math.round(entry.value)}h
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Total */}
                            <p className="text-[9px] text-center text-slate-400 dark:text-slate-500 font-medium mt-1">
                              Total: <span className="font-bold text-slate-600 dark:text-slate-300">{Math.round(totalHoras)}h</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Puntos de navegación */}
                      <div className="flex justify-center gap-2 mt-3">
                        {[0, 1].map((i) => (
                          <button
                            key={i}
                            onClick={() => irASlide(i)}
                            className={`transition-all duration-300 rounded-full ${slideGrafico === i
                              ? 'w-4 h-2 bg-blue-500'
                              : 'w-2 h-2 bg-slate-300 dark:bg-slate-600 hover:bg-blue-300 dark:hover:bg-blue-700'
                              }`}
                            title={i === 0 ? 'Gráfico de pastel' : 'Barras comparativas'}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}

              </div>{/* fin grupo widgets-referencia */}

              {/* Widget Resumen Ejecución */}
              {fondo.estado_ejecutor && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 to-blue-600"></div>

                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    Ejecución
                  </h3>

                  <div className="space-y-3 text-sm">
                    {fondo.fecha_inicio_ejecucion && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Inicio:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {new Date(fondo.fecha_inicio_ejecucion).toLocaleDateString('es-BO')}
                        </span>
                      </div>
                    )}
                    {fondo.semestre && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Semestre:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{fondo.semestre}</span>
                      </div>
                    )}
                    {fondo.total_horas_ejecutadas && (
                      <div className="flex justify-between pt-2 border-t border-slate-300 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400">Ejecutadas:</span>
                        <span className="font-black text-blue-600 dark:text-blue-400">{fondo.total_horas_ejecutadas}h</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Widget Observaciones Pendientes */}
              {false && observacionesPendientes > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 to-orange-600"></div>

                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <span className="text-lg">⚠️</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">Pendientes</p>
                      <p className="font-black text-amber-700 dark:text-amber-300 text-2xl">{observacionesPendientes}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* ================================================= */}
            {/* COLUMNA CENTRAL (CONTENIDO PRINCIPAL) */}
            {/* ================================================= */}
            <div className="lg:col-span-6 space-y-8">

              {/* Caja central simétrica con tabs integrados */}
              <div className="relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm overflow-visible min-h-[34rem] flex flex-col">
                <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                {puedeGestionarCarga ? (
                  <div className="fondo-central-nav-overlay">
                    <div className="fondo-central-nav">
                      <button
                        onClick={desplazarIzquierda}
                        className="fondo-central-nav-btn btn-left"
                        title={mostrarCargaAcademica ? 'Ver distribucion macro' : 'Ver asignacion micro'}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        onClick={desplazarDerecha}
                        className="fondo-central-nav-btn btn-right"
                        title={mostrarCargaAcademica ? 'Ver distribucion macro' : 'Ver asignacion micro'}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="p-5 flex-1 min-h-0 overflow-hidden">
                  <div
                    key={panelCentral}
                    className={`fondo-panel-shell ${animarPanelCentral ? (direccionPanel === 'derecha' ? 'fondo-panel-enter-right' : 'fondo-panel-enter-left') : ''}`}
                  >
                    {puedeGestionarCarga && (
                      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-center dark:border-blue-900/40 dark:bg-blue-950/20">
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {panelCentralInfo.titulo}
                        </h2>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {panelCentralInfo.descripcion}
                        </p>
                      </div>
                    )}
                    <div className="fondo-central-flex flex-1 min-h-0 gap-4">
                      <div className="fondo-central-stage">
                        {puedeGestionarCarga && mostrarCargaAcademica ? (
                          <div key="panel-carga" className="fondo-panel-anim">
                            <div className="h-full overflow-y-auto pr-1">
                              <CargaHorariaManager
                                docenteId={fondo.docente?.id}
                                calendarioId={fondo.calendario_academico?.id}
                                onCargaUpdate={handleActualizacionHoras}
                                cargaEdicion={cargaParaEditar}
                                onCancelarEdicion={() => setCargaParaEditar(null)}
                                readOnly={soloLecturaPorRol}
                              />
                            </div>
                          </div>
                        ) : (
                          <div key="panel-resumen" className="fondo-panel-anim fondo-distribucion-grow">
                            <div className="h-full flex flex-col justify-center">
                              <DistribuirHoras
                                fondoId={fondo.id}
                                horasEfectivas={fondo.horas_efectivas}
                                horasObjetivo={fondo.horas_semana}
                                editable={puedeEditarDistribucion}
                                onActualizar={handleActualizacionHoras}
                                onGuardarExitoso={handleDistribucionGuardada}
                                canAddActivity={false}
                                hideActionButtons={esAdmin || !puedeEditarDistribucion}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* ================================================= */}
            {/* PANEL DERECHO - Widget Acciones */}
            {/* ================================================= */}
            <div className="lg:col-span-3 space-y-6">
              <div className="sticky top-24 space-y-6">

                {/* Widget Acciones - alineado con Balance de Horas (top) y Distribución (bottom) */}
                <div
                  ref={refWidgetAcciones}
                  className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm p-5 relative overflow-hidden flex flex-col ${!mostrarAccionesWidget ? 'hidden' : ''} ${animarTransicionMacroMicro ? 'animate-slide-up' : ''}`}
                  style={animarTransicionMacroMicro ? { animationDuration: '140ms', animationFillMode: 'both' } : undefined}
                >
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Acciones
                  </h3>

                  <div className="flex-1 flex flex-col">
                    <EstadoTimeline 
                      estado={fondo.estado}
                      tieneObservaciones={observacionesPendientes > 0}
                      observacionesPendientes={observacionesPendientes}
                    />
                  </div>

                  <div className="space-y-2.5 mt-auto pt-2">
                    {/* JEFATURA: acciones principales de flujo */}
                    {false && puedePresentarADirector && (
                      <button
                        onClick={presentarADirector}
                        className="w-full py-2 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2 transition-all hover:scale-[1.02] text-xs"
                      >
                        <PaperAirplaneIcon className="w-3.5 h-3.5" />
                        Presentar
                      </button>
                    )}

                    {false && puedeReenviarADirector && (
                      <button
                        onClick={presentarADirector}
                        className="w-full py-2 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30 flex justify-center items-center gap-2 transition-all hover:scale-[1.02] text-xs"
                      >
                        <ArrowPathIcon className="w-3.5 h-3.5" />
                        Reenviar al Director
                      </button>
                    )}
                    {/* Acciones rápidas superiores */}
                    <div className="space-y-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                      {fondo.tiene_programa_analitico && fondo.programa_analitico_url && (
                        <a
                          href={fondo.programa_analitico_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 rounded-xl font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 flex justify-center items-center gap-2 border border-blue-200 dark:border-blue-800 transition-all shadow-sm hover:shadow-md group text-xs"
                        >
                          <ExternalLinkIcon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                          Programa Analítico
                        </a>
                      )}

                      <button
                        onClick={abrirPdfEnNuevaPestana}
                        className="w-full py-2 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 dark:from-indigo-700 dark:to-blue-700 dark:hover:from-indigo-800 dark:hover:to-blue-800 shadow-md hover:shadow-lg flex justify-center items-center gap-2 transition-all text-xs border border-indigo-500 dark:border-indigo-600"
                      >
                        <FileDown className="w-3.5 h-3.5" /> PDF
                      </button>


                    </div>

                    {/* JEFATURA: Presentar a Director */}
                    {puedePresentarADirector && (
                      <button
                        onClick={presentarADirector}
                        disabled={!puedeConfirmarPresentacion}
                        className={`w-full py-2 rounded-xl font-bold text-white shadow-lg flex justify-center items-center gap-2 transition-all text-xs ${
                          puedeConfirmarPresentacion
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30 hover:scale-[1.02]'
                            : 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-70 shadow-none'
                        }`}
                        title={puedeConfirmarPresentacion ? 'Presentar al Director' : motivoPresentacionBloqueada}
                      >
                        <PaperAirplaneIcon className="w-3.5 h-3.5" />
                        Presentar
                      </button>
                    )}

                    {/* ADMIN/DIRECTOR: Revisar */}
                    {fondo.estado === 'presentado_director' && esDirector && !esIisyp && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={abrirFormularioObservar}
                          className="py-1.5 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-md hover:shadow-lg transition-all text-xs flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Observar
                        </button>
                        <button
                          onClick={() => setMostrarModalAprobar(true)}
                          className="py-1.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg transition-all text-xs flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aprobar
                        </button>
                      </div>
                    )}

                    {/* JEFATURA: Volver a presentar a Director */}
                    {puedeReenviarADirector && (
                      <button
                        onClick={presentarADirector}
                        disabled={!puedeConfirmarPresentacion}
                        className={`w-full py-2 rounded-xl font-bold text-white shadow-lg flex justify-center items-center gap-2 transition-all text-xs ${
                          puedeConfirmarPresentacion
                            ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30 hover:scale-[1.02]'
                            : 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-70 shadow-none'
                        }`}
                        title={puedeConfirmarPresentacion ? 'Reenviar al Director' : motivoPresentacionBloqueada}
                      >
                        <SendIcon className="w-3.5 h-3.5" />
                        Reenviar al Director
                      </button>
                    )}

                    {/* ADMIN: Iniciar Ejecución */}
                    {fondoPresentadoADirector && (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 rounded-xl font-bold text-white bg-slate-500/80 dark:bg-slate-600/80 cursor-not-allowed opacity-80 flex justify-center items-center gap-2 text-xs border border-slate-400/40 dark:border-slate-500/40"
                      >
                        <SendIcon className="w-3.5 h-3.5" />
                        Presentado al Director
                      </button>
                    )}

                    {fondo.estado === 'aprobado_director' && esDirector && !esIisyp && (
                      <button
                        onClick={() => setMostrarModalIniciarEjecucion(true)}
                        className="w-full py-2 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/30 flex justify-center items-center gap-2 transition-all hover:scale-[1.02] text-xs"
                      >
                        <PlayCircleIcon className="w-3.5 h-3.5" />
                        Iniciar
                      </button>
                    )}

                    {/* DOCENTE: Presentar Informe - página dedicada, no modal */}
                    {fondo.estado === 'en_ejecucion' && !esStaff && (
                      <button
                        onClick={() => window.open(`/fondos/${fondo.id}/informe`, '_blank', 'noopener,noreferrer')}
                        className="w-full py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2 transition-all hover:scale-[1.02] text-xs"
                      >
                        <DocumentTextIcon className="w-3.5 h-3.5" />
                        Informe
                      </button>
                    )}

                    {/* ADMIN: Evaluar Informe */}
                    {fondo.estado === 'informe_presentado' && esDirector && !esIisyp && (
                      <div className="space-y-1.5">
                        <button
                          onClick={() => setMostrarModalInforme(true)}
                          className="w-full py-1.5 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors text-xs"
                        >
                          Ver Informe
                        </button>
                        <button
                          onClick={() => setMostrarFormEvaluarInforme(true)}
                          className="w-full py-2 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/30 flex justify-center items-center gap-2 transition-all hover:scale-[1.02] text-xs"
                        >
                          <CheckBadgeIcon className="w-3.5 h-3.5" />
                          Aprobar Informe
                        </button>
                        <button
                          onClick={() => setMostrarModalObservarInforme(true)}
                          className="w-full py-2 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30 flex justify-center items-center gap-2 transition-all hover:scale-[1.02] text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Solicitar Correcciones
                        </button>
                      </div>
                    )}

                  </div>
                </div>

              </div>
            </div>

            {/* ================================================= */}
            {/* FILA COMPLETA - Actividades Planificadas (col-span-12) */}
            {/* ================================================= */}
            {fondo.categorias && (
              <div id="fondo-actividades-planificadas" className="lg:col-span-12 space-y-6 fondo-tiempo-cards">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3 pb-2 border-b border-slate-300 dark:border-slate-700">
                  <span className="text-2xl">📋</span> Actividades Planificadas
                </h2>

                <div className="grid grid-cols-1 gap-4">
                  {(() => {
                    const ORDEN_FUNCIONES = ['academica', 'investigacion', 'extension_universitaria', 'interaccion_social', 'gestion', 'academica_administrativa', 'social_cultural_deportiva'];
                    const categoriasOrdenadas = [...fondo.categorias].sort((a, b) => {
                      return ORDEN_FUNCIONES.indexOf(a.tipo) - ORDEN_FUNCIONES.indexOf(b.tipo);
                    });

                    const categoriasVisibles = categoriasOrdenadas.filter(
                      (categoria) => Number(categoria.total_horas || 0) > 0
                    );

                    if (categoriasVisibles.length === 0) {
                      return (
                        <div className="md:col-span-2 lg:col-span-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center">
                          <p className="text-slate-600 dark:text-slate-300 font-medium">
                            Sin actividades planificadas para mostrar
                          </p>
                        </div>
                      );
                    }

                    return categoriasVisibles.map((categoria, idx) => {
                      const esBloqueada = CATEGORIAS_BLOQUEADAS.includes(categoria.tipo);
                      const Icon = CATEGORY_ICONS[categoria.tipo] || DocumentTextIcon;
                      const color = COLORS[idx % COLORS.length];
                      const totalActual = Number(categoria.total_horas || 0);
                      const totalCargaHoraria = Number(categoria.total_carga_horaria || 0);
                      const totalPrevio = Number(prevTotalesCategoriasRef.current[categoria.id] || 0);
                      const aparecioRecien = totalPrevio <= 0 && totalActual > 0;

                      return (
                        <div key={categoria.id} className={`group bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col ${aparecioRecien ? 'animate-fade-in' : ''}`}>

                          {/* Header de categoría con diseño moderno */}
                          <div className="px-6 py-5 flex justify-between items-center bg-white dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 relative overflow-hidden">
                            {/* Acento de color superior (como en Distribución) */}
                            <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: color }}></div>

                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-4 pl-2">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-600 shadow-sm">
                                  <Icon className="w-6 h-6" style={{ color: color }} strokeWidth={2} />
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight transition-colors">
                                    {categoria.tipo_display}
                                  </h3>
                                  <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                      Presupuesto: <span className="font-bold" style={{ color: color }}>{categoria.total_horas}</span> hrs/sem
                                    </span>
                                    {totalCargaHoraria > 0 && (
                                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50">
                                        Detalle de carga: <span className="font-bold">{totalCargaHoraria}</span> hrs/anio
                                      </span>
                                    )}
                                    <span className="text-slate-300 dark:text-slate-600">|</span>
                                    <span>{parseFloat(categoria.porcentaje).toFixed(1)}% del total</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              {esBloqueada && <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-lg border border-slate-300 dark:border-slate-600 flex items-center gap-1"><LockClosedIcon className="w-3 h-3" /> Auto</span>}

                              {/* Botón agregar actividad removido y reubicado en widget Distribución de Horas */}
                            </div>
                          </div>

                          {/* Tabla de actividades */}
                          <div className="p-0 flex-1 flex flex-col">
                            {/* 1. MOSTRAR CARGA HORARIA (JEFATURA) SI EXISTE */}
                            {vistaActual === 'jefatura' && categoria.detalles_carga && categoria.detalles_carga.length > 0 && (
                              <div className="border-b border-slate-300 dark:border-slate-700">
                                {!esBloqueada && (
                                  <div className="px-6 py-2 bg-blue-50/40 dark:bg-blue-900/10 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider border-b border-blue-100 dark:border-blue-800/30 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    Asignación Jefatura (Base de Horas)
                                  </div>
                                )}
                                <div className="overflow-x-auto">
                                  <table className="min-w-full">
                                    <thead>
                                      <tr className="bg-slate-50/30 dark:bg-slate-800/30 border-b border-slate-300 dark:border-slate-700">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actividad Asignada</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Horas</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Evidencias</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-8">Respaldo</th>
                                        {esJefeEstudios && (
                                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ordenarDetallesCarga(categoria).map((detalle, dIdx) => (
                                        <tr key={dIdx} className="border-b border-slate-200 dark:border-slate-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 last:border-0 transition-colors">
                                          <td className="px-6 py-3.5 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                            <ActividadAsignadaCell detalle={detalle} />
                                          </td>
                                          <td className="px-6 py-3.5 text-sm text-slate-600 dark:text-slate-400">{detalle.tipo_actividad_display || '-'}</td>
                                          <td className="px-6 py-3.5 text-sm font-bold text-slate-800 dark:text-white text-right">{detalle.horas}</td>
                                          <td className="px-6 py-3.5 text-sm text-slate-500 dark:text-slate-400">{detalle.evidencias || '-'}</td>
                                          <td className="px-6 py-3.5 text-sm text-slate-500 dark:text-slate-400 italic pl-8">
                                            <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">{detalle.respaldo || 'Sin respaldo'}</span>
                                          </td>
                                          {esJefeEstudios && (
                                            <td className="px-6 py-3.5 text-right">
                                              <div className="flex gap-1 justify-end">
                                                <button
                                                  onClick={() => handleEditCarga(detalle, categoria.tipo)}
                                                  className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                  title="Editar asignación"
                                                >
                                                  <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteCarga(detalle.id)}
                                                  className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                  title="Eliminar asignación"
                                                >
                                                  <TrashIcon className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* 2. MOSTRAR ACTIVIDADES MANUALES (SI NO ESTÁ BLOQUEADA) */}
                            {vistaActual === 'docente' && !esBloqueada && (
                              <div>
                                {false && categoria.detalles_carga && categoria.detalles_carga.length > 0 && categoria.actividades && categoria.actividades.length > 0 && (
                                  <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-y border-slate-300 dark:border-slate-700 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                    Fondo de Tiempo - Gestion Jefatura
                                  </div>
                                )}

                                {false && categoria.actividades && categoria.actividades.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                      <thead>
                                        <tr className="bg-slate-50/30 dark:bg-slate-800/30 border-b border-slate-300 dark:border-slate-700">
                                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/3">
                                            Actividad
                                          </th>
                                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Hrs/Semana
                                          </th>
                                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Hrs/Año
                                          </th>
                                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/4">
                                            Evidencias
                                          </th>
                                          {puedeEditarDocente && !esBloqueada && (
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                              Acciones
                                            </th>
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {categoria.actividades.map((actividad, actIdx) => (
                                          <tr
                                            key={actividad.id}
                                            className={`border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${actIdx === categoria.actividades.length - 1 ? 'border-b-0' : ''
                                              }`}
                                          >
                                            <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                              {actividad.detalle}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 text-center">
                                              {actividad.horas_semana}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-sm font-bold text-slate-800 dark:text-white min-w-[3rem]">
                                                {actividad.horas_año}
                                              </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                              {renderEvidencia(actividad)}
                                            </td>
                                            {puedeEditarDocente && !esBloqueada && (
                                              <td className="px-6 py-4 text-right">
                                                <div className="flex gap-1 justify-end">
                                                  <button
                                                    onClick={() => editarActividadHandler(actividad)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                    title="Editar actividad"
                                                  >
                                                    <PencilIcon className="w-4 h-4" />
                                                  </button>
                                                  <button
                                                    onClick={() => setActividadAEliminar(actividad.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                    title="Eliminar actividad"
                                                  >
                                                    <TrashIcon className="w-4 h-4" />
                                                  </button>
                                                </div>
                                              </td>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : categoria.detalles_carga && categoria.detalles_carga.length > 0 ? (
                                  <div>
                                    <div className="px-6 py-2 bg-blue-50/40 dark:bg-blue-900/10 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider border-b border-blue-100 dark:border-blue-800/30 flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                      Detalle de la carga
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full">
                                        <thead>
                                          <tr className="bg-slate-50/30 dark:bg-slate-800/30 border-b border-slate-300 dark:border-slate-700">
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                              Actividad Asignada
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                              Tipo
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                              Horas
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                              Evidencias
                                            </th>
                                            {fondo.estado === 'en_ejecucion' && (
                                              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Archivos
                                              </th>
                                            )}
                                            {puedeGestionarCarga && (
                                              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Acciones
                                              </th>
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {ordenarDetallesCarga(categoria).map((detalle, dIdx) => (
                                            <tr key={dIdx} className="border-b border-slate-200 dark:border-slate-800/50 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                                              <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                                <ActividadAsignadaCell detalle={detalle} compact />
                                              </td>
                                              <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                                {detalle.tipo_actividad_display || '-'}
                                              </td>
                                              <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 text-right font-semibold">
                                                {detalle.horas}
                                              </td>
                                              <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                                {detalle.evidencias || '-'}
                                              </td>
                                              {fondo.estado === 'en_ejecucion' && (
                                                <td className="px-6 py-4 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => setEvidenciaActividadModal({
                                                      cargaHorariaId: detalle.id,
                                                      titulo: detalle.titulo_actividad || detalle.tipo_actividad_display || 'Actividad',
                                                    })}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                    title={rolOperativo === 'docente' ? 'Subir o ver evidencias' : 'Ver evidencias'}
                                                  >
                                                    <Paperclip className="w-4 h-4" />
                                                  </button>
                                                </td>
                                              )}
                                              {puedeGestionarCarga && (
                                                <td className="px-6 py-4 text-right">
                                                  <div className="flex gap-1 justify-end">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleEditCarga(detalle, categoria.tipo)}
                                                      className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                      title="Editar asignacion"
                                                    >
                                                      <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeleteCarga(detalle.id)}
                                                      className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                      title="Eliminar asignacion"
                                                    >
                                                      <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                  </div>
                                                </td>
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-8 bg-slate-50/30 dark:bg-slate-800/30">
                                    <p className="text-slate-400 dark:text-slate-500 italic text-sm flex flex-col items-center gap-2">
                                      <span className="text-2xl opacity-50">📭</span>
                                      Sin actividades registradas
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    });
                  })()}
                </div>
              </div>
            )}

          </div>
          )}

        </div>
      </div>


      {/* BOTÓN OBSERVACIONES - Portal para que quede fijo en la esquina de la pantalla.
          Restringido a pedido: el chat flotante queda reservado exclusivamente para
          que Director y Jefe de Estudios se comuniquen entre si sobre este fondo.
          Superadmin, IISYP y el docente no lo ven. */}
      {!ocultarDetallePorBorradorDirector && (esDirector || esJefeEstudios) && ReactDOM.createPortal(
        <div className="fixed bottom-[6.5rem] right-16 z-[9999]">
          <BotonFlotanteObservaciones
            ref={observacionesRef}
            fondoId={fondo.id}
            estadoFondo={fondo.estado}
            onObservacionCambiada={async () => {
              await cargarDetalle({ silencioso: true });
            }}
          />
        </div>,
        document.body
      )}
      {/* Modal de observaciones - Portal para centrar en pantalla */}
      {fondo && mostrarFormObservar && ReactDOM.createPortal(
        <FormularioObservar
          fondo={fondo}
          onObservar={handleObservacionEnviada}
          onCancelar={cerrarFormularioObservar}
        />,
        document.body
      )}

      {/* ============================================ */}
      {/* NUEVO: Modal Presentar Informe */}
      {/* ============================================ */}
      {
        fondo && mostrarFormPresentarInforme && (
          <FormularioPresentarInforme
            fondoId={fondo.id}
            onInformePresentado={async () => {
              setMostrarFormPresentarInforme(false);
              await cargarDetalle({ silencioso: true });
            }}
            onCancelar={() => setMostrarFormPresentarInforme(false)}
          />
        )
      }

      {/* ============================================ */}
      {/* NUEVO: Modal Evaluar Informe */}
      {/* ============================================ */}
      {
        fondo && mostrarFormEvaluarInforme && (
          <FormularioEvaluarInforme
            fondoId={fondo.id}
            onInformeEvaluado={async () => {
              setMostrarFormEvaluarInforme(false);
              await cargarDetalle({ silencioso: true });
            }}
            onCancelar={() => setMostrarFormEvaluarInforme(false)}
          />
        )
      }

      {/* Modal de confirmación para aprobar */}
      {
        fondo && mostrarModalAprobar && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>✅</span> Confirmar Aprobación
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg p-4">
                  <p className="text-slate-800 dark:text-slate-200 font-semibold mb-2">
                    ¿Estás seguro de aprobar este fondo?
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Al aprobar:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                    <li>El fondo quedará bloqueado para edición</li>
                    <li>El docente será notificado</li>
                    <li>Se registrará la fecha de aprobación</li>
                    <li>El fondo pasará a estado "Aprobado por Director"</li>
                  </ul>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Docente:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {fondo.docente?.nombre_completo || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Asignatura:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {fondo.asignatura || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Gestión:</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {fondo.gestion} - {fondo.periodo_display}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => setMostrarModalAprobar(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={aprobarFondoHandler}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
                >
                  <CheckBadgeIcon className="w-5 h-5" />
                  <span>Aprobar</span>
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* ============================================ */}
      {/* NUEVO: Modal Iniciar Ejecución */}
      {/* ============================================ */}
      {
        fondo && mostrarModalIniciarEjecucion && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>🚀</span> Confirmar Inicio de Ejecución
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 rounded-lg p-4">
                  <p className="text-slate-800 dark:text-slate-200 font-semibold mb-2">
                    ¿Estás seguro de iniciar la ejecución?
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Al iniciar:
                  </p>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                    <li>El fondo quedará activo durante el semestre</li>
                    <li>El docente podrá ejecutar las actividades planificadas</li>
                    <li>Se registrará la fecha de inicio</li>
                    <li>El fondo pasará a estado "En Ejecución"</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => setMostrarModalIniciarEjecucion(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={iniciarEjecucionHandler}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
                >
                  <PlayCircleIcon className="w-6 h-6" />
                  <span>Iniciar</span>
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal Ver Informe - Rediseñado */}
      {mostrarModalInforme && fondo.informe_actual && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header elegante */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-6 py-4 border-b border-blue-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        Informe de Cumplimiento
                      </h2>
                      <p className="text-xs text-blue-100">
                        {fondo.docente?.nombre_completo}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMostrarModalInforme(false)}
                    className="p-2 rounded-lg hover:bg-white/20 text-white transition-all hover:scale-110"
                    title="Cerrar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Contenido con diseño mejorado */}
              <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-900/10 p-6">
                <div className="max-w-3xl mx-auto space-y-5">

                  {/* Secciones del informe por categoria */}
                  {[
                    { campo: 'seccion_academica', titulo: 'Académica', header: 'bg-gradient-to-r from-blue-500/10 to-blue-500/5 dark:from-blue-900/30 dark:to-blue-900/10' },
                    { campo: 'seccion_investigacion', titulo: 'Investigación', header: 'bg-gradient-to-r from-purple-500/10 to-purple-500/5 dark:from-purple-900/30 dark:to-purple-900/10' },
                    { campo: 'seccion_extension_interaccion', titulo: 'Extensión Universitaria e Interacción Social', header: 'bg-gradient-to-r from-teal-500/10 to-teal-500/5 dark:from-teal-900/30 dark:to-teal-900/10' },
                    { campo: 'seccion_asesorias_tutorias', titulo: 'Asesorías y Tutorías', header: 'bg-gradient-to-r from-indigo-500/10 to-indigo-500/5 dark:from-indigo-900/30 dark:to-indigo-900/10' },
                    { campo: 'seccion_academica_administrativa', titulo: 'Académica-Administrativa', header: 'bg-gradient-to-r from-cyan-500/10 to-cyan-500/5 dark:from-cyan-900/30 dark:to-cyan-900/10' },
                    { campo: 'seccion_social_cultural_deportiva', titulo: 'Social, Cultural y Deportiva', header: 'bg-gradient-to-r from-pink-500/10 to-pink-500/5 dark:from-pink-900/30 dark:to-pink-900/10' },
                    { campo: 'conclusiones_generales', titulo: 'Conclusiones Generales', header: 'bg-gradient-to-r from-green-500/10 to-green-500/5 dark:from-green-900/30 dark:to-green-900/10' },
                  ].map(({ campo, titulo, header }) => (
                    fondo.informe_actual[campo] && (
                      <div key={campo} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className={`${header} px-4 py-3 border-b border-slate-200 dark:border-slate-700`}>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {titulo}
                          </h3>
                        </div>
                        <div
                          className="p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                          dangerouslySetInnerHTML={{ __html: fondo.informe_actual[campo] }}
                        />
                      </div>
                    )
                  ))}

                  {/* Info de fecha */}
                  <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        Presentado el:
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {new Date(fondo.informe_actual.fecha_elaboracion).toLocaleDateString('es-BO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {fondo.estado === 'informe_presentado' && esDirector && !esIisyp && (
                <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                  <button
                    onClick={() => { setMostrarModalInforme(false); setMostrarModalObservarInforme(true); }}
                    className="px-5 py-2.5 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg transition-all flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" /> Solicitar Correcciones
                  </button>
                  <button
                    onClick={() => { setMostrarModalInforme(false); setMostrarFormEvaluarInforme(true); }}
                    className="px-5 py-2.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg transition-all flex items-center gap-2"
                  >
                    <CheckBadgeIcon className="w-4 h-4" /> Aprobar Informe
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Solicitar Correcciones al Informe */}
        {mostrarModalObservarInforme && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="bg-orange-500 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5" /> Solicitar Correcciones al Informe
                </h3>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Explica qué debe corregir {fondo.docente?.nombre_completo}. El informe volverá a estado editable para que lo actualice y lo reenvíe.
                </p>
                <textarea
                  value={comentarioObservarInforme}
                  onChange={(e) => setComentarioObservarInforme(e.target.value)}
                  rows={5}
                  disabled={enviandoObservacionInforme}
                  placeholder="Ej: Falta detallar los resultados por materia en la sección Académica..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Mínimo 10 caracteres.</p>
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => { setMostrarModalObservarInforme(false); setComentarioObservarInforme(''); }}
                  disabled={enviandoObservacionInforme}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={solicitarCorreccionesInforme}
                  disabled={enviandoObservacionInforme || comentarioObservarInforme.trim().length < 10}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {enviandoObservacionInforme ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  Enviar solicitud
                </button>
              </div>
            </div>
          </div>
        )}
      {/* Modal de confirmación para eliminar - Portal para centrar en pantalla */}
      {actividadAEliminar && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🗑️</span> Confirmar Eliminación
              </h2>
            </div>
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4 mb-4">
                <p className="text-slate-800 dark:text-slate-200 font-semibold mb-2">
                  ¿Estás seguro de eliminar esta actividad?
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Esta acción no se puede deshacer. La actividad se eliminará permanentemente.
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setActividadAEliminar(null)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminarActividad}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL EVIDENCIAS DE ACTIVIDAD (Fondo en Ejecucion) */}
      <EvidenciaActividadModal
        open={Boolean(evidenciaActividadModal)}
        onClose={() => setEvidenciaActividadModal(null)}
        cargaHorariaId={evidenciaActividadModal?.cargaHorariaId}
        tituloActividad={evidenciaActividadModal?.titulo}
        puedeSubir={rolOperativo === 'docente'}
      />

    </div>
  );
}

export default DetalleFondo;
