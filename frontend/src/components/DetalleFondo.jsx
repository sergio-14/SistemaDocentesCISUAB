import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { getFondoTiempoDetalle, presentarFondoADirector, aprobarFondo } from '../apis/api';
import api from '../apis/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import toast from 'react-hot-toast';
import { Pencil as PencilIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useActiveRole } from '../contexts/activeRole';
import FormularioObservar from './FormularioObservar';
import BotonFlotanteObservaciones from './BotonFlotanteObservaciones';
import FormularioEvaluarInforme from './FormularioEvaluarInforme';
import CargaHorariaManager from './CargaHorariaManager';
import ModalCentrado from './common/ModalCentrado';
import EstadoTimeline from './fondos/EstadoTimeline';
import FiltroUnidades from './fondos/FiltroUnidades';
import ProgramaAnaliticoAccion from './fondos/ProgramaAnaliticoAccion';
import DocumentoActividadAccion from './fondos/DocumentoActividadAccion';
import { BLOQUE, BOTON } from './fondos/estilosFondo';
import { Avatar, BarraProgreso, EstadoPill, Etiqueta } from './fondos/ElementosFondo';
import { getApiErrorMessage, getDownloadErrorMessage } from '../utils/formErrors';
import { sanitizarHtmlInforme } from '../utils/sanitizarHtmlInforme';
import useConsultaPeriodica from '../utils/useConsultaPeriodica';

// Helpers para extraer datos del vínculo DocenteCarrera desde docente.vinculos
const getVinculoCarrera = (docente, carreraId) => {
  if (!docente?.vinculos) return null;
  return docente.vinculos.find(v => String(v.carrera) === String(carreraId)) || docente.vinculos[0] || null;
};

// Materia asignada por el Jefe de otra carrera (doble carrera): la gestiona esa Jefatura.
const EtiquetaOtraCarrera = ({ detalle }) => (
  detalle?.es_de_otra_carrera ? (
    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
      {detalle.carrera_calendario}
    </span>
  ) : null
);

const ActividadAsignadaCell = ({ detalle }) => {
  // Clases en aula: el calendario (y la carrera, si es otra) distingue la misma materia
  // dada en dos semestres, igual que en el PDF.
  if (detalle?.tipo_actividad === 'clases_aula' && detalle?.calendario_nombre) {
    return (
      <>
        {detalle.titulo_actividad || '-'}
        <span className="font-medium text-slate-600"> · {detalle.calendario_nombre}</span>
      </>
    );
  }
  return <>{detalle?.titulo_actividad || '-'}<EtiquetaOtraCarrera detalle={detalle} /></>;
};

// Cada carga aparece una sola vez: primero las clases en aula (materia · calendario) y
// luego las demás como filas propias, sin agruparlas bajo ninguna materia.
const ordenarDetallesCarga = (categoria) => {
  const detalles = categoria?.detalles_carga || [];
  const esClase = (detalle) => detalle.tipo_actividad === 'clases_aula';
  return [...detalles.filter(esClase), ...detalles.filter((detalle) => !esClase(detalle))];
};

const ORDEN_UNIDADES = ['academica', 'investigacion', 'extension_universitaria', 'interaccion_social', 'gestion', 'academica_administrativa', 'social_cultural_deportiva'];

// Cada unidad tiene siempre el mismo color (gráfico y lista de actividades).
const COLOR_UNIDAD = {
  academica: '#1E3A8A',
  investigacion: '#0284C7',
  extension_universitaria: '#059669',
  interaccion_social: '#F59E0B',
  gestion: '#6366F1',
  academica_administrativa: '#14B8A6',
  social_cultural_deportiva: '#FB7185',
};
const colorUnidad = (tipo) => COLOR_UNIDAD[tipo] || '#64748B';

const ABREVIATURA_DEDICACION = {
  tiempo_completo: 'Tiempo completo',
  medio_tiempo: 'Medio tiempo',
  horario_16: 'TH-16',
  horario_24: 'TH-24',
  horario_40: 'TH-40',
  horario_48: 'TH-48',
};

// Secciones del informe de cumplimiento, con el formato anterior (antes de las 7 unidades) y el actual (Art. 28).
const SECCIONES_INFORME_ANTERIOR = [
  { campo: 'seccion_academica', titulo: 'Académica', tipo: 'academica' },
  { campo: 'seccion_investigacion', titulo: 'Investigación', tipo: 'investigacion' },
  { campo: 'seccion_extension_interaccion', titulo: 'Extensión Universitaria e Interacción Social', tipo: 'extension_universitaria' },
  { campo: 'seccion_asesorias_tutorias', titulo: 'Asesorías y Tutorías', tipo: 'gestion' },
  { campo: 'seccion_academica_administrativa', titulo: 'Académica-Administrativa', tipo: 'academica_administrativa' },
  { campo: 'seccion_social_cultural_deportiva', titulo: 'Social, Cultural y Deportiva', tipo: 'social_cultural_deportiva' },
  { campo: 'conclusiones_generales', titulo: 'Conclusiones Generales', tipo: null },
];
const SECCIONES_INFORME = [
  { campo: 'seccion_academica', titulo: 'Académica', tipo: 'academica' },
  { campo: 'seccion_investigacion', titulo: 'Investigación', tipo: 'investigacion' },
  { campo: 'seccion_extension_universitaria', titulo: 'Extensión Universitaria', tipo: 'extension_universitaria' },
  { campo: 'seccion_interaccion_social', titulo: 'Interacción Social', tipo: 'interaccion_social' },
  { campo: 'seccion_gestion', titulo: 'Gestión', tipo: 'gestion' },
  { campo: 'seccion_academica_administrativa', titulo: 'Académica-Administrativa', tipo: 'academica_administrativa' },
  { campo: 'seccion_social_cultural_deportiva', titulo: 'Social, Cultural y Deportiva', tipo: 'social_cultural_deportiva' },
  { campo: 'conclusiones_generales', titulo: 'Conclusiones Generales', tipo: null },
];

// Botones del panel de acciones: a lo ancho y con el estilo de los botones del dashboard.
const ACCION = `${BOTON} w-full py-2.5`;
const ACCION_DESHABILITADA = 'bg-slate-200 text-slate-500 cursor-not-allowed';
const ACCION_SECUNDARIA = 'bg-white/70 text-blue-900 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100';

function DetalleFondo() {
  const { activeAssignment, activeRole, effectiveUser } = useActiveRole();
  const { id } = useParams();
  const navigate = useNavigate();
  const [fondo, setFondo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [error, setError] = useState(null);
  const [mostrarFormObservar, setMostrarFormObservar] = useState(false);

  // Extraer datos del vínculo DocenteCarrera para el docente de este fondo
  const vinculo = getVinculoCarrera(fondo?.docente, fondo?.carrera);
  const dedicacionDocente = vinculo?.dedicacion || null;
  const categoriaDocente = vinculo?.categoria || null;
  const [mostrarModalAprobar, setMostrarModalAprobar] = useState(false);
  const [documentoDecanatura, setDocumentoDecanatura] = useState(null);
  const observacionesRef = useRef();
  const [mostrarFormEvaluarInforme, setMostrarFormEvaluarInforme] = useState(false);
  const [mostrarModalIniciarEjecucion, setMostrarModalIniciarEjecucion] = useState(false);
  const [mostrarModalInforme, setMostrarModalInforme] = useState(false);
  // Carga que se corrige en su fila de la tabla: solo horas (y descripción en "Otros").
  // { id, horas, titulo, esOtros, error, guardando }
  const [edicionCarga, setEdicionCarga] = useState(null);
  // Unidades desmarcadas en el filtro de "Actividades planificadas" (al inicio, ninguna).
  const [unidadesOcultas, setUnidadesOcultas] = useState(() => new Set());
  // Sube al eliminar una carga desde la tabla: el gestor recarga sus cargas y totales.
  const [versionCargas, setVersionCargas] = useState(0);
  const [slideGrafico, setSlideGrafico] = useState(0);
  const slideGraficoRef = useRef(0);
  const timerGraficoRef = useRef(null);
  const prevTotalesCategoriasRef = useRef({});
  const estadoFondoRef = useRef(null);
  const observacionesPendientesRef = useRef(0);
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
  const esDirector = rolOperativo === 'director';
  const esJefeEstudios = rolOperativo === 'jefe_estudios';
  const esIisyp = rolOperativo === 'iiisyp';
  // Nadie revisa (aprueba, observa, inicia o evalúa) su propio fondo; el fondo del
  // Director de la carrera lo revisa el superusuario con el documento de la Decanatura.
  const esRevisorDelFondo = Boolean(fondo) && !fondo.es_fondo_propio && (
    fondo.es_fondo_de_director ? esSuperAdmin : (esDirector && !esIisyp)
  );
  const requiereDocumentoDecanatura = Boolean(fondo?.es_fondo_de_director);
  const puedeGestionarCarga = esSuperAdmin || esJefeEstudios;
  const soloLecturaPorRol = !puedeGestionarCarga;
  const puedePresentarADirector = fondo?.estado === 'borrador' && (esJefeEstudios || esSuperAdmin);
  const puedeReenviarADirector = fondo?.estado === 'observado' && (esJefeEstudios || esSuperAdmin);
  const fondoPresentadoADirector = fondo?.estado === 'presentado_director' && (esJefeEstudios || esSuperAdmin);
  // Un fondo rechazado vuelve a borrador para corregirlo (Jefe de su carrera o superusuario).
  const puedeVolverABorrador = fondo?.estado === 'rechazado' && (esJefeEstudios || esSuperAdmin);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se recarga al cambiar de fondo o de rol activo.
  }, [id, activeAssignment?.id]);

  // Guarda el ultimo total por categoria para detectar aparicion de tarjetas (0 -> >0)
  useEffect(() => {
    if (!fondo?.categorias) return;
    const snapshot = {};
    fondo.categorias.forEach((categoria) => {
      snapshot[categoria.tipo] = Number(categoria.total_horas || 0);
    });
    prevTotalesCategoriasRef.current = snapshot;
  }, [fondo?.categorias]);

  // Evita overlays residuales al entrar a otro detalle
  useEffect(() => {
    setUnidadesOcultas(new Set());
    setMostrarFormObservar(false);
    setMostrarFormEvaluarInforme(false);
    setMostrarModalAprobar(false);
    setMostrarModalIniciarEjecucion(false);
    setMostrarModalInforme(false);
  }, [id]);

  // Limpiar todos los modales al desmontar el componente
  useEffect(() => {
    return () => {
      setMostrarFormObservar(false);
      setMostrarFormEvaluarInforme(false);
      setMostrarModalAprobar(false);
      setMostrarModalIniciarEjecucion(false);
      setMostrarModalInforme(false);
    };
  }, [activeAssignment?.id]);

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
      estadoFondoRef.current = response.data.estado;
      observacionesPendientesRef.current = pendientes;

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

  const debeVigilarCambios =
    (esJefeEstudios && fondo?.estado === 'presentado_director') ||
    (esDirector && ['borrador', 'observado'].includes(fondo?.estado));

  useConsultaPeriodica(() => {
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
        estadoFondoRef.current = response.data.estado;
        observacionesPendientesRef.current = pendientes;
      })
      .catch((err) => {
        console.warn('No se pudo sincronizar el estado del fondo:', err);
      });
  }, 5000, debeVigilarCambios);

  const handleActualizacionHoras = () => {
    cargarDetalle({ silencioso: true });
  };

  const cerrarPanel = () => {
    navigate('/fondo-tiempo');
  };

  const presentarADirector = async () => {
    const esReenvio = fondo.estado === 'observado';
    try {
      if (!unidadesCompletas) {
        toast.error(`La suma de las unidades debe ser exactamente ${horasEfectivasAnuales} horas (horas efectivas).`);
        return;
      }
      if (documentosFaltantes.length > 0) {
        toast.error(motivoPresentacionBloqueada);
        return;
      }

      await presentarFondoADirector(fondo.id);
      setFondo((prev) => prev ? {
        ...prev,
        estado: 'presentado_director',
        fecha_presentacion: new Date().toISOString(),
      } : prev);
      if (esReenvio) {
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

  const volverABorrador = async () => {
    try {
      await api.post(`/fondos-tiempo/${fondo.id}/volver-a-borrador/`);
      estadoFondoRef.current = 'borrador';
      toast.success('El fondo volvió a borrador para corregirlo');
      await cargarDetalle({ silencioso: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo devolver el fondo a borrador'));
    }
  };

  const aprobarFondoHandler = async () => {
    if (requiereDocumentoDecanatura && !documentoDecanatura) {
      toast.error('Adjunte el documento de la Decanatura (PDF) para aprobar el fondo del Director.');
      return;
    }
    try {
      await aprobarFondo(fondo.id, requiereDocumentoDecanatura ? documentoDecanatura : null);
      toast.success('Fondo aprobado exitosamente');
      setMostrarModalAprobar(false);
      setDocumentoDecanatura(null);
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
      .catch(async (error) => {
        console.error('Error al generar PDF:', error);
        toast.dismiss('pdf-oficial');
        // El motivo del backend (checklist de salud, permisos...) aunque la respuesta sea un blob.
        toast.error(await getDownloadErrorMessage(error, 'No se pudo generar el PDF del fondo'));
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
    observacionesPendientesRef.current = Math.max(1, observacionesPendientesRef.current + 1);
    estadoFondoRef.current = 'observado';

    if (observacionesRef.current) {
      await observacionesRef.current.actualizarObservaciones();
    }
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

  const iniciarEdicionCarga = (detalle) => {
    setEdicionCarga({
      id: detalle.id,
      horas: String(detalle.horas ?? ''),
      titulo: detalle.titulo_actividad || '',
      esOtros: detalle.tipo_actividad === 'otros',
      error: '',
      guardando: false,
    });
  };

  const guardarEdicionCarga = async () => {
    const edicion = edicionCarga;
    if (!edicion || edicion.guardando) return;
    const horas = Number(edicion.horas);
    const titulo = edicion.titulo.trim();
    if (String(edicion.horas).trim() === '' || !Number.isInteger(horas) || horas < 1) {
      setEdicionCarga({ ...edicion, error: 'Ingrese un número entero de horas mayor a 0.' });
      return;
    }
    if (edicion.esOtros && (!titulo || titulo.toLowerCase() === 'otros')) {
      setEdicionCarga({ ...edicion, error: 'Describa la actividad: en "Otros" la descripción es obligatoria.' });
      return;
    }
    const cambios = edicion.esOtros ? { horas, titulo_actividad: titulo } : { horas };
    setEdicionCarga({ ...edicion, guardando: true, error: '' });
    try {
      await api.patch(`/cargas-horarias/${edicion.id}/`, cambios);
      toast.success('Carga actualizada');
      setEdicionCarga(null);
      setVersionCargas((version) => version + 1);
      await cargarDetalle({ silencioso: true });
    } catch (err) {
      // El mensaje del backend (400 de validación, 403 de permisos o estado) en la misma fila.
      const mensaje = getApiErrorMessage(err, 'No se pudo guardar la carga');
      setEdicionCarga((prev) => (prev && prev.id === edicion.id ? { ...prev, guardando: false, error: mensaje } : prev));
    }
  };

  const handleDeleteCarga = async (id) => {
    if (!confirm("¿Eliminar esta asignación de carga horaria?")) return;
    try {
      await api.delete(`/cargas-horarias/${id}/`);
      toast.success("Asignación eliminada");
      if (edicionCarga?.id === id) setEdicionCarga(null);
      setVersionCargas((version) => version + 1);
      cargarDetalle({ silencioso: true });
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, 'No se pudo eliminar la asignación'));
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Cargando detalles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className={`${BLOQUE} p-6 max-w-md w-full text-center`}>
          <p className="text-red-600 font-semibold">{error}</p>
          {error.includes('sesión') && (
            <button
              onClick={() => navigate('/login')}
              className={`${BOTON} mt-4 px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white`}
            >
              Ir a Login
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!fondo) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className={`${BLOQUE} p-6 max-w-lg w-full`}>
          <p className="text-slate-800 font-semibold mb-1">
            No se pudo cargar el detalle del Fondo de Tiempo.
          </p>
          <p className="text-sm text-slate-600 mb-4">
            La respuesta del servidor llegó vacía o incompleta para este registro.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={cargarDetalle}
              className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white`}
            >
              Reintentar
            </button>
            <button
              onClick={cerrarPanel}
              className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  const datosGrafico = [...(fondo.categorias || [])]
    .filter(cat => cat.total_horas > 0)
    .sort((a, b) => ORDEN_UNIDADES.indexOf(a.tipo) - ORDEN_UNIDADES.indexOf(b.tipo))
    .map(cat => ({
      tipo: cat.tipo,
      name: cat.tipo_display,
      value: parseFloat(cat.total_horas),
      porcentaje: parseFloat(cat.porcentaje)
    }));
  // Cada unidad suma sus ítems (horas por año); para presentar, el total es exactamente
  // las horas efectivas.
  const horasEfectivasAnuales = Math.round(Number(fondo.horas_efectivas || 0));
  const totalUnidades = Math.round(Number(fondo.total_asignado || 0));
  const unidadesCompletas = horasEfectivasAnuales > 0 && totalUnidades === horasEfectivasAnuales;
  const avanceUnidades = horasEfectivasAnuales > 0
    ? Math.min(100, Math.round((totalUnidades / horasEfectivasAnuales) * 100))
    : 0;
  // Art. 15 y 18: cada materia de clases en aula (por calendario) necesita su programa analítico.
  // Arts. 14, 16, 17 y 20: cada proyecto o curso necesita su documento (PDF).
  const documentosFaltantes = [
    ...(fondo.programas_analiticos_faltantes || []),
    ...(fondo.documentos_actividad_faltantes || []),
  ];
  const puedeConfirmarPresentacion = unidadesCompletas && documentosFaltantes.length === 0;
  const motivoPresentacionBloqueada = !unidadesCompletas
    ? `Unidades: ${totalUnidades} de ${horasEfectivasAnuales} h/año (deben sumar exactamente las horas efectivas)`
    : documentosFaltantes.join('. ');
  // Las cargas (y sus PDF) se modifican solo con el fondo en borrador u observado, por el
  // superusuario o el Jefe de Estudios de la carrera de la carga (las materias de otra
  // carrera, desde la pantalla de esa Jefatura). El backend aplica las mismas reglas.
  const fondoEditable = ['borrador', 'observado'].includes(fondo.estado) && !fondo.archivado;
  const puedeModificarCarga = (detalle) => (
    fondoEditable && (esSuperAdmin || (esJefeEstudios && !detalle.es_de_otra_carrera))
  );
  const mostrarAccionesCarga = puedeGestionarCarga && fondoEditable;

  const ocultarDetallePorBorradorDirector = esDirector && !esSuperAdmin && fondo.estado === 'borrador';
  const { activo: etapaActiva, vencido: etapaVencida } = verificarEstadoCronometro();
  const categoriasVisibles = [...(fondo.categorias || [])]
    .sort((a, b) => ORDEN_UNIDADES.indexOf(a.tipo) - ORDEN_UNIDADES.indexOf(b.tipo))
    .filter((categoria) => Number(categoria.total_horas || 0) > 0);
  const categoriasMostradas = categoriasVisibles.filter((categoria) => !unidadesOcultas.has(categoria.tipo));
  const unidadesFiltro = [...(fondo.categorias || [])]
    .sort((a, b) => ORDEN_UNIDADES.indexOf(a.tipo) - ORDEN_UNIDADES.indexOf(b.tipo))
    .map((categoria) => ({
      tipo: categoria.tipo,
      nombre: categoria.tipo_display,
      conCarga: Number(categoria.total_horas || 0) > 0,
    }));
  // Columnas de la lista de actividades (con o sin la de acciones).
  const columnasActividades = mostrarAccionesCarga
    ? 'lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_7.5rem_minmax(0,1.8fr)_8rem]'
    : 'lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_7.5rem_minmax(0,1.8fr)]';

  return (
    <div className="min-h-full w-full max-w-[92rem] mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-6 space-y-4 text-slate-800">

      {/* Encabezado como en el dashboard: docente y sus datos, y al lado el tiempo en etapa */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className={`${BLOQUE} p-5 sm:p-6`}>
          <div className="flex items-center gap-4 min-w-0">
            <Avatar nombre={fondo.docente?.nombre_completo} size="w-14 h-14 text-lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-xl sm:text-2xl font-bold text-blue-900 leading-tight">
                  {fondo.docente?.nombre_completo || 'Docente'}
                </h2>
                <EstadoPill estado={fondo.estado} />
              </div>
              <p className="mt-1 text-sm font-medium text-slate-700">
                {fondo.carrera?.nombre || 'Carrera'}
                {fondo.descripcion && <> · {fondo.descripcion}</>}
              </p>
            </div>
          </div>

          <dl className="mt-5 pt-4 flex flex-wrap gap-y-3 [border-top:1px_solid_#B8C9E1]">
            {[
              { label: 'Categoría', valor: <span className="capitalize">{categoriaDocente || '—'}</span> },
              {
                label: 'Dedicación',
                valor: dedicacionDocente
                  ? `${ABREVIATURA_DEDICACION[dedicacionDocente] || 'TH'} · ${fondo.antiguedad} años`
                  : '—',
              },
              { label: 'Gestión', valor: <span className="tabular-nums">{fondo.gestion}</span> },
            ].map((dato, indice) => (
              <div key={dato.label} className={`pr-6 sm:pr-8 ${indice > 0 ? 'pl-6 sm:pl-8 [border-left:1px_solid_#B8C9E1]' : ''}`}>
                <dt className="text-xs font-semibold text-blue-800">{dato.label}</dt>
                <dd className="mt-0.5 text-sm font-bold text-slate-900 whitespace-nowrap">{dato.valor}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-blue-900 to-blue-950 text-white p-5 sm:p-6 flex items-center justify-between gap-4 shadow-[0_4px_14px_rgba(30,58,138,0.25)]">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-200">
              <span className={`h-2 w-2 rounded-full ${etapaActiva ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
              Tiempo en etapa
            </p>
            <p className="mt-1 text-sm text-blue-100">
              {etapaVencida ? 'plazo de la etapa cumplido' : 'desde la creación del fondo'}
            </p>
          </div>
          {etapaVencida ? (
            <span className="text-2xl font-bold leading-none">Vencido</span>
          ) : (
            <span className="text-right leading-none">
              <span className="block text-5xl font-bold tabular-nums">{etapaActiva ? calcularDiasEnEtapa() : 0}</span>
              <span className="text-sm font-medium text-blue-100">días</span>
            </span>
          )}
        </div>
      </div>

      {ocultarDetallePorBorradorDirector ? (
        <div className={`${BLOQUE} p-5 sm:p-6`}>
          <h3 className="text-lg font-bold text-blue-900">Fondo pendiente de presentación</h3>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">
            Este fondo aún no ha sido presentado por el Jefe de Estudios. La carga por unidad y las acciones de revisión estarán disponibles cuando el fondo sea presentado formalmente al Director.
          </p>
        </div>
      ) : (
        <>
          {/* Tres columnas simétricas (misma altura): balance | carga | acciones */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12 items-stretch">

            {/* Izquierda: balance de horas, distribución y ejecución */}
            <div className="xl:col-span-3 flex flex-col gap-4">
              <div className={`${BLOQUE} p-6`}>
                <h3 className="text-base font-bold text-blue-900 mb-4">Balance de horas</h3>
                <div className="divide-y divide-azulado-300 text-sm">
                  <div className="flex justify-between gap-3 pb-2.5">
                    <span className="text-slate-600">Horas efectivas</span>
                    <span className="font-bold text-slate-800 tabular-nums">{horasEfectivasAnuales} h</span>
                  </div>
                  <div className="flex justify-between gap-3 py-2.5">
                    <span className="text-slate-600">Suma de unidades</span>
                    <span className={`font-bold tabular-nums ${unidadesCompletas ? 'text-emerald-600' : 'text-slate-800'}`}>{totalUnidades} h</span>
                  </div>
                  <div className="flex justify-between gap-3 pt-2.5">
                    <span className="text-slate-600">Por asignar</span>
                    <span className={`font-bold tabular-nums ${fondo.horas_disponibles < 0 ? 'text-red-500' : 'text-sky-700'}`}>
                      {Math.round(fondo.horas_disponibles)} h
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <BarraProgreso valor={avanceUnidades} color={unidadesCompletas ? 'bg-emerald-500' : 'bg-blue-900'} />
                  <span className="text-xs font-bold text-blue-900 tabular-nums w-9 text-right">{avanceUnidades}%</span>
                </div>
              </div>

              {/* Distribución de horas por unidad: gráfico de anillo y barras, en carrusel */}
              {datosGrafico.length > 0 && (() => {
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
                  <div className={`${BLOQUE} p-6 flex-1 flex flex-col`}>
                    <h3 className="text-base font-bold text-blue-900 mb-2">Distribución</h3>

                    <div className="relative overflow-hidden flex-1 min-h-[11rem]">
                      <div
                        className="absolute inset-0 flex transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${slideGrafico * 100}%)` }}
                      >
                        {/* Gráfico de anillo */}
                        <div className="min-w-full h-full flex-shrink-0">
                          <ResponsiveContainer width="100%" height="100%" minHeight={160}>
                            <PieChart>
                              <Pie
                                data={datosGrafico}
                                cx="50%"
                                cy="45%"
                                innerRadius={40}
                                outerRadius={58}
                                paddingAngle={2}
                                stroke="#F7F9FD"
                                strokeWidth={2}
                                dataKey="value"
                              >
                                {datosGrafico.map((entry) => (
                                  <Cell key={entry.tipo} fill={colorUnidad(entry.tipo)} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => `${Math.round(value)} h`} />
                              <Legend verticalAlign="bottom" height={18} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#475569' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Barras proporcionales */}
                        <div className="min-w-full h-full flex-shrink-0 flex flex-col justify-center gap-2">
                          {datosGrafico.map((entry) => {
                            const pct = maxVal > 0 ? (entry.value / maxVal) * 100 : 0;
                            return (
                              <div key={entry.tipo} className="flex items-center gap-2" title={`${entry.name}: ${Math.round(entry.value)} h`}>
                                <span className="w-16 truncate text-xs font-medium text-slate-600">
                                  {entry.name?.split(' ')[0]}
                                </span>
                                <div className="flex-1 h-2 bg-azulado-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%`, backgroundColor: colorUnidad(entry.tipo) }}
                                  />
                                </div>
                                <span className="w-9 text-right text-xs font-bold text-slate-700 tabular-nums">
                                  {Math.round(entry.value)} h
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center gap-2 mt-3">
                      {[0, 1].map((i) => (
                        <button
                          key={i}
                          onClick={() => irASlide(i)}
                          className={`transition-all duration-300 rounded-full ${slideGrafico === i
                            ? 'w-5 h-2 bg-blue-900'
                            : 'w-2 h-2 bg-azulado-300 hover:bg-sky-400'
                            }`}
                          title={i === 0 ? 'Gráfico de anillo' : 'Barras comparativas'}
                          aria-label={i === 0 ? 'Gráfico de anillo' : 'Barras comparativas'}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Resumen de ejecución */}
              {fondo.estado_ejecutor && (
                <div className={`${BLOQUE} p-6`}>
                  <h3 className="text-base font-bold text-blue-900 mb-4">Ejecución</h3>
                  <div className="space-y-2 text-sm">
                    {fondo.fecha_inicio_ejecucion && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-600">Inicio</span>
                        <span className="font-semibold text-slate-800">
                          {new Date(fondo.fecha_inicio_ejecucion).toLocaleDateString('es-BO')}
                        </span>
                      </div>
                    )}
                    {fondo.semestre && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-600">Semestre</span>
                        <span className="font-semibold text-slate-800">{fondo.semestre}</span>
                      </div>
                    )}
                    {fondo.total_horas_ejecutadas && (
                      <div className="flex justify-between gap-3 pt-2 [border-top:1px_solid_#B8C9E1]">
                        <span className="text-slate-600">Ejecutadas</span>
                        <span className="font-bold text-blue-900">{fondo.total_horas_ejecutadas} h</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Centro: carga del fondo (en tablet va primero, a todo el ancho) */}
            <div className={`${BLOQUE} p-6 md:col-span-2 md:order-first xl:order-none xl:col-span-6 flex flex-col`}>
              <div className="mb-5">
                <h3 className="text-base font-bold text-blue-900">
                  {puedeGestionarCarga ? 'Carga del Fondo de Tiempo' : 'Horas por unidad'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Cada unidad suma sus ítems en horas por año; las clases en aula salen de la materia y su calendario.
                </p>
              </div>
              <div className="flex-1 flex flex-col justify-center">
              {puedeGestionarCarga ? (
                <CargaHorariaManager
                  fondoId={fondo.id}
                  docenteId={fondo.docente?.id}
                  gestion={fondo.gestion}
                  calendarios={fondo.calendarios}
                  onCargaUpdate={handleActualizacionHoras}
                  readOnly={soloLecturaPorRol || !fondoEditable}
                  versionCargas={versionCargas}
                />
              ) : (
                <div>
                  <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_4.5rem] gap-3 px-3 pb-2.5 text-xs font-semibold text-blue-800 [border-bottom:1px_solid_#B8C9E1]">
                    <span>Unidad</span>
                    <span className="text-right">Horas/año</span>
                    <span className="text-right">%</span>
                  </div>
                  <div className="divide-y divide-azulado-300">
                    {[...(fondo.categorias || [])]
                      .sort((a, b) => ORDEN_UNIDADES.indexOf(a.tipo) - ORDEN_UNIDADES.indexOf(b.tipo))
                      .map((categoria) => (
                        <div key={categoria.tipo} className="grid grid-cols-[minmax(0,1fr)_5.5rem_4.5rem] items-center gap-3 px-3 py-2.5 text-tabla">
                          <span className="flex items-center gap-2.5 text-slate-700 min-w-0">
                            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: colorUnidad(categoria.tipo) }} />
                            <span className="truncate">{categoria.tipo_display}</span>
                          </span>
                          <span className="text-right font-semibold text-slate-800 tabular-nums">{Math.round(Number(categoria.total_horas || 0))}</span>
                          <span className="text-right text-slate-600 tabular-nums">{Number(categoria.porcentaje || 0).toFixed(1)}%</span>
                        </div>
                      ))}
                    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_4.5rem] items-center gap-3 px-3 py-2.5 text-tabla font-bold text-blue-900">
                      <span>Total</span>
                      <span className="text-right tabular-nums">{totalUnidades}</span>
                      <span className="text-right tabular-nums">
                        {horasEfectivasAnuales > 0 ? ((totalUnidades / horasEfectivasAnuales) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Derecha: estado y acciones. Las etapas ocupan el alto disponible y las
                acciones quedan abajo: primero las del trámite, al final el PDF. */}
            <div className={`${BLOQUE} p-6 xl:col-span-3 flex flex-col`}>
              <h3 className="text-base font-bold text-blue-900 mb-4">Estado y acciones</h3>

              {/* Arts. 15 y 18: presentado después de los plazos del calendario (no bloquea). */}
              {fondo.fuera_de_plazo?.length > 0 && (
                <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700 space-y-1">
                  {fondo.fuera_de_plazo.map((texto) => (
                    <p key={texto} className="font-semibold">{texto}</p>
                  ))}
                </div>
              )}

              <EstadoTimeline estado={fondo.estado} className="flex-1" />

              <div className="mt-5 pt-5 space-y-2 [border-top:1px_solid_#B8C9E1]">
                <p className="pb-1 text-xs font-semibold text-blue-800">Acciones</p>
                {/* JEFATURA: acciones principales de flujo */}
                {puedeVolverABorrador && (
                  <button data-escritura
                    onClick={volverABorrador}
                    className={`${ACCION} bg-slate-500 hover:bg-slate-600 text-white`}
                  >
                    Volver a borrador
                  </button>
                )}

                {/* JEFATURA: Presentar a Director */}
                {puedePresentarADirector && (
                  <button
                    onClick={presentarADirector}
                    disabled={!puedeConfirmarPresentacion}
                    className={`${ACCION} ${puedeConfirmarPresentacion ? 'bg-blue-900 hover:bg-blue-950 text-white' : ACCION_DESHABILITADA}`}
                    title={puedeConfirmarPresentacion ? 'Presentar al Director' : motivoPresentacionBloqueada}
                  >
                    Presentar al Director
                  </button>
                )}

                {/* JEFATURA: Volver a presentar a Director */}
                {puedeReenviarADirector && (
                  <button
                    onClick={presentarADirector}
                    disabled={!puedeConfirmarPresentacion}
                    className={`${ACCION} ${puedeConfirmarPresentacion ? 'bg-amber-500 hover:bg-amber-600 text-white' : ACCION_DESHABILITADA}`}
                    title={puedeConfirmarPresentacion ? 'Reenviar al Director' : motivoPresentacionBloqueada}
                  >
                    Reenviar al Director
                  </button>
                )}

                {fondoPresentadoADirector && (
                  <p className="flex items-center justify-center gap-2 rounded-full bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Esperando revisión del Director
                  </p>
                )}

                {/* ADMIN/DIRECTOR: Revisar */}
                {fondo.estado === 'presentado_director' && esRevisorDelFondo && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={abrirFormularioObservar}
                      className={`${ACCION} bg-amber-500 hover:bg-amber-600 text-white`}
                    >
                      Observar
                    </button>
                    <button
                      onClick={() => setMostrarModalAprobar(true)}
                      className={`${ACCION} bg-emerald-500 hover:bg-emerald-600 text-white`}
                    >
                      Aprobar
                    </button>
                  </div>
                )}

                {fondo.puede_iniciar_ejecucion && (
                  <button
                    onClick={() => setMostrarModalIniciarEjecucion(true)}
                    className={`${ACCION} bg-sky-600 hover:bg-sky-700 text-white`}
                  >
                    Iniciar ejecución
                  </button>
                )}

                {/* DOCENTE: Presentar Informe - página dedicada, no modal */}
                {/* Lo decide el backend con el rol activo (docente dueño, fondo en ejecución,
                    informe sin enviar): User.is_staff no sirve, un Jefe también es docente. */}
                {fondo.puede_editar_informe && (
                  <button
                    onClick={() => window.open(`/fondos/${fondo.id}/informe`, '_blank', 'noopener,noreferrer')}
                    className={`${ACCION} bg-blue-900 hover:bg-blue-950 text-white`}
                  >
                    Redactar informe
                  </button>
                )}

                {/* Informe presentado o aprobado: solo lectura y PDF para todo el que ve el
                    fondo (el backend ya limita el detalle: docente dueño, Jefe, Director e
                    Instituto de la carrera, superusuario). */}
                {['informe_presentado', 'finalizado'].includes(fondo.estado) && (
                  <button
                    onClick={() => window.open(`/fondos/${fondo.id}/informe`, '_blank', 'noopener,noreferrer')}
                    className={`${ACCION} bg-blue-900 hover:bg-blue-950 text-white`}
                  >
                    Ver informe
                  </button>
                )}

                {/* ADMIN: Evaluar Informe */}
                {fondo.estado === 'informe_presentado' && esRevisorDelFondo && (
                  <>
                    <button
                      onClick={() => setMostrarModalInforme(true)}
                      className={`${ACCION} ${ACCION_SECUNDARIA}`}
                    >
                      Revisar informe
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setMostrarModalObservarInforme(true)}
                        className={`${ACCION} bg-amber-500 hover:bg-amber-600 text-white`}
                      >
                        Correcciones
                      </button>
                      <button
                        onClick={() => setMostrarFormEvaluarInforme(true)}
                        className={`${ACCION} bg-emerald-500 hover:bg-emerald-600 text-white`}
                      >
                        Aprobar
                      </button>
                    </div>
                  </>
                )}

                <button
                  onClick={abrirPdfEnNuevaPestana}
                  className={`${ACCION} ${ACCION_SECUNDARIA}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  Ver PDF del fondo
                </button>
              </div>
            </div>
          </div>

          {/* Actividades planificadas, una sección por unidad */}
          {fondo.categorias && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-2">
                <h3 className="text-xl font-bold text-blue-900">Actividades planificadas</h3>
                {categoriasVisibles.length > 0 && (
                  <FiltroUnidades unidades={unidadesFiltro} ocultas={unidadesOcultas} onCambiar={setUnidadesOcultas} />
                )}
              </div>

              {categoriasVisibles.length === 0 ? (
                <div className={`${BLOQUE} p-10 text-center text-sm text-slate-600`}>
                  Sin actividades planificadas para mostrar
                </div>
              ) : categoriasMostradas.length === 0 ? (
                <div className={`${BLOQUE} p-10 text-center text-sm text-slate-600`}>
                  Marque al menos una unidad en el desplegable para ver sus actividades.
                </div>
              ) : categoriasMostradas.map((categoria) => {
                const color = colorUnidad(categoria.tipo);
                const totalActual = Number(categoria.total_horas || 0);
                const totalPrevio = Number(prevTotalesCategoriasRef.current[categoria.tipo] || 0);
                const aparecioRecien = totalPrevio <= 0 && totalActual > 0;
                const porcentajeUnidad = parseFloat(categoria.porcentaje) || 0;
                const detalles = ordenarDetallesCarga(categoria);

                return (
                  <div key={categoria.tipo} className={`${BLOQUE} p-5 sm:p-6 ${aparecioRecien ? 'animate-fade-in' : ''}`}>
                    {/* Encabezado de la unidad */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-3.5 w-3.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <div className="min-w-0">
                          <h4 className="text-lg font-bold text-slate-800 leading-tight">{categoria.tipo_display}</h4>
                          <p className="text-sm text-slate-600">
                            {detalles.length} {detalles.length === 1 ? 'actividad' : 'actividades'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-900 tabular-nums leading-tight">{Math.round(totalActual)} h/año</p>
                          <p className="text-xs text-slate-600">{porcentajeUnidad.toFixed(1)}% de las horas efectivas</p>
                        </div>
                        <div className="hidden sm:block w-32">
                          <div className="h-2 w-full rounded-full bg-azulado-200 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, porcentajeUnidad)}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tabla de actividades (cuadrícula: el CSS del POA da estilo a todas las <table>) */}
                    {detalles.length > 0 ? (
                      <div className="rounded-2xl bg-white ring-1 ring-azulado-300 overflow-hidden">
                        <div className={`hidden lg:grid ${columnasActividades} bg-azulado-50 text-xs font-semibold text-blue-800 [border-bottom:1px_solid_#D2DDEE]`}>
                          <span className="px-5 py-3">Actividad asignada</span>
                          <span className="px-5 py-3">Tipo</span>
                          <span className="px-5 py-3 text-center">Horas/año</span>
                          <span className="px-5 py-3">Evidencias</span>
                          {mostrarAccionesCarga && <span className="px-5 py-3 text-center">Acciones</span>}
                        </div>
                        <div className="divide-y divide-azulado-300">
                          {detalles.map((detalle, dIdx) => {
                            const editando = edicionCarga?.id === detalle.id;
                            const inputEdicion = 'h-9 rounded-full text-tabla outline-none ring-1 ring-inset focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100';
                            const teclasEdicion = (e) => {
                              if (e.key === 'Enter') { e.preventDefault(); guardarEdicionCarga(); }
                              if (e.key === 'Escape') setEdicionCarga(null);
                            };
                            return (
                            <div
                              key={detalle.id ?? dIdx}
                              className={`grid grid-cols-1 ${columnasActividades} transition-colors ${editando ? 'bg-azulado-50' : 'hover:bg-azulado-50'}`}
                            >
                              <div className="px-5 pt-4 pb-1 lg:py-4 text-tabla font-semibold text-slate-800 min-w-0">
                                {editando && edicionCarga.esOtros ? (
                                  <input
                                    type="text"
                                    value={edicionCarga.titulo}
                                    onChange={(e) => setEdicionCarga((prev) => ({ ...prev, titulo: e.target.value, error: '' }))}
                                    onKeyDown={teclasEdicion}
                                    disabled={edicionCarga.guardando}
                                    aria-label="Descripción de la actividad"
                                    className={`animate-campo-entrada w-full px-4 font-semibold text-slate-800 ${inputEdicion} ring-azulado-300`}
                                  />
                                ) : (
                                  <ActividadAsignadaCell detalle={detalle} />
                                )}
                                {detalle.tipo_actividad === 'clases_aula' && (
                                  <ProgramaAnaliticoAccion
                                    fondoId={fondo.id}
                                    materiaId={detalle.materia_id}
                                    calendarioId={detalle.calendario_id}
                                    url={detalle.programa_analitico_url}
                                    puedeSubir={puedeModificarCarga(detalle)}
                                    onSubido={() => cargarDetalle({ silencioso: true })}
                                  />
                                )}
                                {detalle.requiere_documento && (
                                  <DocumentoActividadAccion
                                    cargaId={detalle.id}
                                    clase={detalle.requiere_documento}
                                    url={detalle.documento_url}
                                    puedeSubir={puedeModificarCarga(detalle)}
                                    onSubido={() => cargarDetalle({ silencioso: true })}
                                  />
                                )}
                              </div>
                              <div className="px-5 py-1 lg:py-4 text-tabla text-slate-600">
                                <span className="lg:hidden font-semibold text-blue-800">Tipo: </span>
                                {detalle.tipo_actividad_display || '-'}
                              </div>
                              <div className="px-5 py-1 lg:py-4 text-tabla font-bold text-blue-900 lg:text-center tabular-nums">
                                <span className="lg:hidden font-semibold text-blue-800">Horas/año: </span>
                                {editando ? (
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    autoFocus={!edicionCarga.esOtros}
                                    value={edicionCarga.horas}
                                    onChange={(e) => setEdicionCarga((prev) => ({ ...prev, horas: e.target.value, error: '' }))}
                                    onKeyDown={teclasEdicion}
                                    disabled={edicionCarga.guardando}
                                    aria-label="Horas por año"
                                    className={`animate-campo-entrada w-24 px-3 text-center font-bold text-blue-900 tabular-nums ${inputEdicion} ${edicionCarga.error ? 'ring-red-400/80' : 'ring-azulado-300'}`}
                                  />
                                ) : detalle.horas}
                              </div>
                              <div className="px-5 py-1 lg:py-4 text-tabla text-slate-600 break-words">
                                <span className="lg:hidden font-semibold text-blue-800">Evidencias: </span>
                                {detalle.evidencias || '-'}
                              </div>
                              {mostrarAccionesCarga && (
                                <div className="px-5 pt-1 pb-4 lg:py-3 flex items-center lg:justify-center">
                                  {editando ? (
                                    <div className="animate-campo-entrada flex flex-wrap gap-1.5 lg:justify-center">
                                      <button
                                        type="button"
                                        onClick={guardarEdicionCarga}
                                        disabled={edicionCarga.guardando}
                                        className={`${BOTON} px-3 py-1.5 text-xs bg-blue-900 hover:bg-blue-950 text-white disabled:opacity-60`}
                                      >
                                        {edicionCarga.guardando ? 'Guardando...' : 'Guardar'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEdicionCarga(null)}
                                        disabled={edicionCarga.guardando}
                                        className={`${BOTON} px-3 py-1.5 text-xs text-slate-600 hover:bg-azulado-200 disabled:opacity-60`}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : puedeModificarCarga(detalle) ? (
                                    <div className="flex gap-1">
                                      {/* Clases en aula: sus horas son automáticas (materia y calendario). */}
                                      {detalle.tipo_actividad !== 'clases_aula' && (
                                        <button
                                          type="button"
                                          onClick={() => iniciarEdicionCarga(detalle)}
                                          className="p-2 rounded-full text-blue-900 hover:bg-azulado-200 transition-colors"
                                          title={detalle.tipo_actividad === 'otros' ? 'Editar horas y descripción' : 'Editar horas'}
                                          aria-label={detalle.tipo_actividad === 'otros' ? 'Editar horas y descripción' : 'Editar horas'}
                                        >
                                          <PencilIcon className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCarga(detalle.id)}
                                        className="p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors"
                                        title="Eliminar asignación"
                                        aria-label="Eliminar asignación"
                                      >
                                        <TrashIcon className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : detalle.es_de_otra_carrera ? (
                                    <span className="text-xs text-slate-500 lg:text-center">
                                      Jefatura de {detalle.carrera_calendario}
                                    </span>
                                  ) : null}
                                </div>
                              )}
                              {editando && edicionCarga.error && (
                                <p className="animate-campo-entrada col-span-full px-5 pb-3 text-xs font-semibold text-red-600 lg:!border-l-0">
                                  {edicionCarga.error}
                                </p>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-2xl bg-azulado-100 py-8 text-center text-sm text-slate-600">Sin actividades registradas</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

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
      {/* Modal de observaciones */}
      {fondo && mostrarFormObservar && (
        <FormularioObservar
          fondo={fondo}
          onObservar={handleObservacionEnviada}
          onCancelar={cerrarFormularioObservar}
        />
      )}

      {/* Modal Evaluar Informe */}
      {fondo && mostrarFormEvaluarInforme && (
        <FormularioEvaluarInforme
          fondoId={fondo.id}
          requiereDocumentoDecanatura={requiereDocumentoDecanatura}
          onInformeEvaluado={async () => {
            setMostrarFormEvaluarInforme(false);
            await cargarDetalle({ silencioso: true });
          }}
          onCancelar={() => setMostrarFormEvaluarInforme(false)}
        />
      )}

      {/* Modal de confirmación para aprobar */}
      {fondo && mostrarModalAprobar && (
        <ModalCentrado onClose={() => setMostrarModalAprobar(false)}>
          <div className="w-full max-w-md rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl">
            <div className="px-6 pt-6">
              <h3 className="text-xl font-bold text-blue-900">Confirmar aprobación</h3>
              <p className="mt-1 text-sm text-slate-600">¿Está seguro de aprobar este fondo? Al aprobarlo:</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600 list-disc pl-5">
                <li>El fondo quedará bloqueado para edición</li>
                <li>El docente será notificado</li>
                <li>Se registrará la fecha de aprobación</li>
                <li>El fondo pasará a estado "Aprobado por Director"</li>
              </ul>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="divide-y divide-azulado-300 rounded-2xl bg-azulado-100 text-sm">
                {[
                  { label: 'Docente', valor: fondo.docente?.nombre_completo || 'N/A' },
                  { label: 'Fondo', valor: fondo.descripcion },
                  { label: 'Gestión', valor: fondo.gestion },
                ].map((fila) => (
                  <div key={fila.label} className="flex justify-between gap-3 px-4 py-2.5">
                    <span className="text-slate-500">{fila.label}</span>
                    <span className="font-semibold text-slate-800 text-right">{fila.valor}</span>
                  </div>
                ))}
              </div>
              {requiereDocumentoDecanatura && (
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
                  <p className="font-semibold">Fondo del Director de la carrera</p>
                  <p>Para aprobarlo adjunte el documento de la Decanatura (PDF, obligatorio).</p>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setDocumentoDecanatura(e.target.files?.[0] || null)}
                    className="block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:font-semibold file:text-amber-800"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
              <button
                onClick={() => setMostrarModalAprobar(false)}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
              >
                Cancelar
              </button>
              <button
                onClick={aprobarFondoHandler}
                disabled={requiereDocumentoDecanatura && !documentoDecanatura}
                className={`${BOTON} px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Aprobar fondo
              </button>
            </div>
          </div>
        </ModalCentrado>
      )}

      {/* Modal Iniciar Ejecución */}
      {fondo && mostrarModalIniciarEjecucion && (
        <ModalCentrado onClose={() => setMostrarModalIniciarEjecucion(false)}>
          <div className="w-full max-w-md rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-xl font-bold text-blue-900">Confirmar inicio de ejecución</h3>
              <p className="mt-1 text-sm text-slate-600">¿Está seguro de iniciar la ejecución? Al iniciarla:</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600 list-disc pl-5">
                <li>El fondo quedará activo durante el semestre</li>
                <li>El docente podrá ejecutar las actividades planificadas</li>
                <li>Se registrará la fecha de inicio</li>
                <li>El fondo pasará a estado "En Ejecución"</li>
              </ul>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
              <button
                onClick={() => setMostrarModalIniciarEjecucion(false)}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
              >
                Cancelar
              </button>
              <button
                onClick={iniciarEjecucionHandler}
                className={`${BOTON} px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white`}
              >
                Iniciar ejecución
              </button>
            </div>
          </div>
        </ModalCentrado>
      )}

      {/* Modal Ver Informe */}
      {mostrarModalInforme && fondo.informe_actual && (
        <ModalCentrado onClose={() => setMostrarModalInforme(false)}>
          <div className="w-full max-w-4xl max-h-[calc(100vh-3rem)] rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-blue-900">Informe de Cumplimiento</h3>
                <p className="text-sm text-slate-600 truncate">
                  {fondo.docente?.nombre_completo}
                  {fondo.informe_actual.fecha_elaboracion && (
                    <> · Presentado el {new Date(fondo.informe_actual.fecha_elaboracion).toLocaleDateString('es-BO', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</>
                  )}
                </p>
              </div>
              <button
                onClick={() => setMostrarModalInforme(false)}
                className="flex-shrink-0 rounded-full p-2 -mr-2 text-slate-500 hover:text-blue-900 hover:bg-azulado-200 transition-colors"
                title="Cerrar"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {(fondo.informe_actual.formato_secciones === 'anterior' ? SECCIONES_INFORME_ANTERIOR : SECCIONES_INFORME)
                .map(({ campo, titulo, tipo }) => (
                  fondo.informe_actual[campo] && (
                    <div key={campo} className="rounded-2xl bg-white ring-1 ring-azulado-300 overflow-hidden">
                      <div className="flex items-center gap-2.5 px-4 py-3 [border-bottom:1px_solid_#D2DDEE]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tipo ? colorUnidad(tipo) : '#64748B' }} />
                        <h4 className="text-sm font-bold text-slate-800">{titulo}</h4>
                      </div>
                      <div
                        className="p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-line [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                        dangerouslySetInnerHTML={{ __html: sanitizarHtmlInforme(fondo.informe_actual[campo]) }}
                      />
                    </div>
                  )
                ))}
            </div>

            {fondo.estado === 'informe_presentado' && esRevisorDelFondo && (
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 py-4 [border-top:1px_solid_#B8C9E1]">
                <button
                  onClick={() => { setMostrarModalInforme(false); setMostrarModalObservarInforme(true); }}
                  className={`${BOTON} px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white`}
                >
                  Solicitar correcciones
                </button>
                <button
                  onClick={() => { setMostrarModalInforme(false); setMostrarFormEvaluarInforme(true); }}
                  className={`${BOTON} px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white`}
                >
                  Aprobar informe
                </button>
              </div>
            )}
          </div>
        </ModalCentrado>
      )}

      {/* Modal Solicitar Correcciones al Informe */}
      {mostrarModalObservarInforme && (
        <ModalCentrado>
          <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl">
            <div className="px-6 pt-6">
              <h3 className="text-xl font-bold text-blue-900">Solicitar correcciones al informe</h3>
              <p className="mt-1 text-sm text-slate-600">
                Explique qué debe corregir {fondo.docente?.nombre_completo}. El informe volverá a estado editable para que lo actualice y lo reenvíe.
              </p>
            </div>
            <div className="px-6 py-4">
              <textarea
                value={comentarioObservarInforme}
                onChange={(e) => setComentarioObservarInforme(e.target.value)}
                rows={5}
                disabled={enviandoObservacionInforme}
                placeholder="Ej: Falta detallar los resultados por materia en la sección Académica..."
                className="w-full px-4 py-3 rounded-2xl text-sm text-slate-800 placeholder:text-slate-500 outline-none resize-none ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100"
              />
              <p className="mt-1.5 pl-1 text-xs text-slate-500">Mínimo 10 caracteres.</p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
              <button
                onClick={() => { setMostrarModalObservarInforme(false); setComentarioObservarInforme(''); }}
                disabled={enviandoObservacionInforme}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200 disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                onClick={solicitarCorreccionesInforme}
                disabled={enviandoObservacionInforme || comentarioObservarInforme.trim().length < 10}
                className={`${BOTON} px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {enviandoObservacionInforme && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                Enviar solicitud
              </button>
            </div>
          </div>
        </ModalCentrado>
      )}

    </div>
  );
}

export default DetalleFondo;
