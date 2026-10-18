import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Eye, Send, Loader2, FileWarning, Lock, Download, X, MessageSquare, ClipboardCheck } from 'lucide-react';
import api, { getFondoTiempoDetalle, guardarInformeBorrador } from '../apis/api';
import { useActiveRole } from '../contexts/activeRole';
import { getApiErrorMessage, getDownloadErrorMessage } from '../utils/formErrors';
import { esRevisorDelFondo } from '../utils/fondoTiempoPermissions';
import useConsultaPeriodica from '../utils/useConsultaPeriodica';
import useModoClaro from '../utils/useModoClaro';
import ModalConfirmar from './common/ModalConfirmar';
import FormularioEvaluarInforme from './FormularioEvaluarInforme';
import ModalCorreccionesInforme from './ModalCorreccionesInforme';
import { BLOQUE, BOTON, BOTON_CHICO, BOTON_DOCUMENTO } from './fondos/estilosFondo';
import InformeCampoRico from './InformeCampoRico';
import InformeCampoPlano from './InformeCampoPlano';
import InformeFormatToolbar from './InformeFormatToolbar';
import InformeFirmaImagen from './InformeFirmaImagen';
import { InformeDocumentoContext } from './InformeDocumentoContext';

// Art. 28: las 7 unidades del reglamento (Art. 12) y conclusiones; igual que SECCIONES_INFORME del backend.
const SECCIONES_INFORME = [
  { campo: 'seccion_academica', numero: 1, titulo: 'Académica', requerido: true, placeholder: 'Cumplimiento de objetivos, resultados por materia (estudiantes inscritos, aprobados, reprobados), metodología de evaluación, asesorías y tutorías...' },
  { campo: 'seccion_investigacion', numero: 2, titulo: 'Investigación', requerido: false, placeholder: 'Proyectos de investigación realizados, colaboraciones, resultados concretos...' },
  { campo: 'seccion_extension_universitaria', numero: 3, titulo: 'Extensión Universitaria', requerido: false, placeholder: 'Cursos, seminarios, talleres, conferencias, asistencia técnica, voluntariado...' },
  { campo: 'seccion_interaccion_social', numero: 4, titulo: 'Interacción Social', requerido: false, placeholder: 'Programas y proyectos de proyección social, ferias, campañas, consultorías...' },
  { campo: 'seccion_gestion', numero: 5, titulo: 'Gestión', requerido: false, placeholder: 'Convenios, reuniones, coordinación, modalidades de graduación, políticas académicas...' },
  { campo: 'seccion_academica_administrativa', numero: 6, titulo: 'Académica Administrativa', requerido: false, placeholder: 'Logística de la carrera, CAAC, comisiones, POA, programas analíticos...' },
  { campo: 'seccion_social_cultural_deportiva', numero: 7, titulo: 'Social, Cultural y Deportiva', requerido: false, placeholder: 'Participación en eventos universitarios...' },
  { campo: 'conclusiones_generales', numero: 8, titulo: 'Conclusiones Generales', requerido: true, placeholder: 'Resumen final y recomendaciones para futuras gestiones...' },
];

// Formato anterior: solo para ver los informes presentados antes del cambio (formato_secciones
// 'anterior'), que no se modifican.
const SECCIONES_INFORME_ANTERIOR = [
  { campo: 'seccion_academica', numero: 1, titulo: 'Académica', requerido: true },
  { campo: 'seccion_investigacion', numero: 2, titulo: 'Investigación', requerido: false },
  { campo: 'seccion_extension_interaccion', numero: 3, titulo: 'Extensión Universitaria e Interacción Social', requerido: false },
  { campo: 'seccion_asesorias_tutorias', numero: 4, titulo: 'Asesorías y Tutorías', requerido: false },
  { campo: 'seccion_academica_administrativa', numero: 5, titulo: 'Académica Administrativa', requerido: false },
  { campo: 'seccion_social_cultural_deportiva', numero: 6, titulo: 'Social, Cultural y Deportiva', requerido: false },
  { campo: 'conclusiones_generales', numero: 7, titulo: 'Conclusiones Generales', requerido: true },
];

const CAMPOS_DOCUMENTO = [
  'encabezado_texto', 'fecha_texto',
  'destinatario_nombre', 'destinatario_cargo',
  'remitente_nombre', 'remitente_cargo', 'referencia_texto',
  'saludo_intro_html', 'cierre_html',
  'firma_nombre', 'firma_cargo', 'firma_email', 'firma_imagen_html',
];

const TODOS_LOS_CAMPOS = [
  ...CAMPOS_DOCUMENTO,
  ...new Set([...SECCIONES_INFORME, ...SECCIONES_INFORME_ANTERIOR].map((s) => s.campo)),
];

const AUTOGUARDADO_MS = 30000;
const POSICION_BARRA_STORAGE_KEY = 'informe_posicion_barra';
// Vista previa y descargas del informe: endpoint, extensión del archivo y nombre para los avisos.
const DOCUMENTOS_INFORME = {
  ver: { ruta: 'pdf-informe', extension: 'pdf', nombre: 'PDF' },
  pdf: { ruta: 'pdf-informe', extension: 'pdf', nombre: 'PDF' },
  word: { ruta: 'word-informe', extension: 'docx', nombre: 'Word' },
};
const PANTALLA_ANCHA = '(min-width: 1280px)';
const FUENTE_DOCUMENTO = { fontFamily: 'Verdana, Geneva, Tahoma, sans-serif' };

const contenidoHtmlVacio = (html) => !((html || '').replace(/<[^>]*>/g, '').trim() || /<img\b/i.test(html || ''));

const datosVacios = () => Object.fromEntries(TODOS_LOS_CAMPOS.map((c) => [c, '']));

/**
 * Editor tipo Word del Informe de Fondo de Tiempo: todo el documento
 * (encabezado, datos del oficio, saludo, introducción, las 7 categorías del
 * Art. 12° y el cierre/firma) se edita directamente sobre el mismo
 * documento continuo que luego genera el PDF, en reemplazo del formulario
 * de "7 cajas sueltas" que existía antes. Reutiliza los mismos endpoints ya
 * probados (guardar-informe-borrador, presentar, pdf-informe).
 */
export default function EditorInformePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeRole, effectiveUser } = useActiveRole();

  const [fondo, setFondo] = useState(null);
  const [informeData, setInformeData] = useState(datosVacios());
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [guardando, setGuardando] = useState(false);
  // Documento que se está generando: 'ver' (vista previa), 'pdf' o 'word'.
  const [generando, setGenerando] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [mostrarConfirmarEnvio, setMostrarConfirmarEnvio] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState(null);
  const [campoActivo, setCampoActivo] = useState(null);
  // Ventana abierta por el revisor: 'correcciones' o 'evaluar'.
  const [ventanaRevision, setVentanaRevision] = useState(null);

  // Como el resto del módulo de Fondo de Tiempo, solo en modo claro.
  useModoClaro();

  // Barra de formato arriba o a un costado de la hoja (se recuerda en este navegador).
  // A un costado solo cabe en pantallas anchas; en las demás va siempre arriba.
  const [posicionBarra, setPosicionBarra] = useState(() => {
    try {
      const guardada = localStorage.getItem(POSICION_BARRA_STORAGE_KEY);
      return ['izquierda', 'derecha'].includes(guardada) ? guardada : 'arriba';
    } catch {
      return 'arriba';
    }
  });
  const [pantallaAncha, setPantallaAncha] = useState(() => window.matchMedia(PANTALLA_ANCHA).matches);
  const cabeceraRef = useRef(null);
  const [alturaCabecera, setAlturaCabecera] = useState(0);

  useEffect(() => {
    const media = window.matchMedia(PANTALLA_ANCHA);
    const actualizar = () => setPantallaAncha(media.matches);
    media.addEventListener('change', actualizar);
    return () => media.removeEventListener('change', actualizar);
  }, []);

  // La barra lateral queda fija justo debajo de la cabecera, que cambia de alto.
  useEffect(() => {
    const cabecera = cabeceraRef.current;
    if (!cabecera) return undefined;
    const observador = new ResizeObserver(() => setAlturaCabecera(cabecera.offsetHeight));
    observador.observe(cabecera);
    return () => observador.disconnect();
  }, [cargando, errorCarga]);

  const cambiarPosicionBarra = (posicion) => {
    setPosicionBarra(posicion);
    try {
      localStorage.setItem(POSICION_BARRA_STORAGE_KEY, posicion);
    } catch {
      // Sin almacenamiento la posición simplemente no se recuerda.
    }
  };

  const sucioRef = useRef(false);
  const informeDataRef = useRef(informeData);
  informeDataRef.current = informeData;

  const informe = fondo?.informe_actual || null;
  const seccionesInforme = informe?.formato_secciones === 'anterior' ? SECCIONES_INFORME_ANTERIOR : SECCIONES_INFORME;
  const estadoInforme = informe?.estado || null;
  // Lo decide el backend (docente dueño, fondo en ejecución, informe sin
  // enviar): Director, Jefatura y los demás lo ven en solo lectura.
  const soloLectura = !fondo?.puede_editar_informe;
  // Informe presentado, abierto por el revisor del fondo (Director; en el fondo del
  // Director, el superusuario): puede pedir correcciones o evaluarlo. Los demás, y en
  // cualquier otro estado, lo ven en solo lectura.
  const puedeRevisar = fondo?.estado === 'informe_presentado'
    && esRevisorDelFondo(fondo, { rol: activeRole, esSuperusuario: effectiveUser?.is_superuser === true });
  const nombreDocente = fondo?.docente?.nombre_completo || '';
  const logoCarrera = fondo?.carrera?.logo_carrera || null;

  const cargarFondo = useCallback(async () => {
    try {
      const { data } = await getFondoTiempoDetalle(id);
      setFondo(data);
      const informeActual = data.informe_actual;
      setInformeData(
        informeActual
          ? Object.fromEntries(TODOS_LOS_CAMPOS.map((c) => [c, informeActual[c] || '']))
          : datosVacios()
      );
      sucioRef.current = false;
    } catch (err) {
      console.error('Error al cargar el informe:', err);
      setErrorCarga(getApiErrorMessage(err, 'No se pudo cargar el informe.'));
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargarFondo();
  }, [cargarFondo]);

  const handleCampoChange = useCallback((campo, valor) => {
    setInformeData((prev) => ({ ...prev, [campo]: valor }));
    sucioRef.current = true;
  }, []);

  const guardarBorrador = useCallback(async ({ silencioso = false } = {}) => {
    if (soloLectura) return true;
    try {
      setGuardando(true);
      await guardarInformeBorrador(id, informeDataRef.current);
      sucioRef.current = false;
      setUltimoGuardado(new Date());
      if (!silencioso) toast.success('Borrador guardado. Puedes cerrar y seguir editando cuando quieras.');
      return true;
    } catch (err) {
      console.error('Error al guardar borrador de informe:', err);
      if (!silencioso) toast.error(getApiErrorMessage(err, 'No se pudo guardar el borrador'));
      return false;
    } finally {
      setGuardando(false);
    }
  }, [id, soloLectura]);

  // Auto-guardado cada 30s mientras haya cambios sin guardar (pausado con la
  // pestaña oculta). Al ocultarla se guarda en el acto lo pendiente.
  useConsultaPeriodica(() => {
    if (sucioRef.current) guardarBorrador({ silencioso: true });
  }, AUTOGUARDADO_MS, !soloLectura && !cargando);

  useEffect(() => {
    if (soloLectura || cargando) return undefined;
    const guardarAlOcultar = () => {
      if (document.visibilityState === 'hidden' && sucioRef.current) guardarBorrador({ silencioso: true });
    };
    document.addEventListener('visibilitychange', guardarAlOcultar);
    return () => document.removeEventListener('visibilitychange', guardarAlOcultar);
  }, [soloLectura, cargando, guardarBorrador]);

  // El informe en PDF (vista previa en una pestaña nueva o descargado) o en Word
  // (descargado). Antes se guarda lo pendiente. Va por `api` para que lleve el rol
  // activo (X-Active-Assignment), igual que el resto de pantallas.
  const obtenerDocumento = async (accion) => {
    const { ruta, extension, nombre } = DOCUMENTOS_INFORME[accion];
    try {
      setGenerando(accion);
      if (!soloLectura) {
        const guardado = await guardarBorrador({ silencioso: true });
        if (!guardado) return;
      }
      const { data } = await api.get(`/fondos-tiempo/${id}/${ruta}/`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = blobUrl;
      if (accion === 'ver') {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      } else {
        link.download = `Informe_${(nombreDocente || 'Docente').replace(/\s+/g, '_')}_${fondo?.gestion || ''}.${extension}`;
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      console.error(`Error al generar el ${nombre} del informe:`, err);
      toast.error(await getDownloadErrorMessage(err, `No se pudo generar el ${nombre} del informe`));
    } finally {
      setGenerando(null);
    }
  };

  const abrirConfirmacionEnvio = () => {
    if (contenidoHtmlVacio(informeData.seccion_academica) || contenidoHtmlVacio(informeData.conclusiones_generales)) {
      toast.error('Debes completar al menos la sección Académica y las Conclusiones Generales.');
      return;
    }
    setMostrarConfirmarEnvio(true);
  };

  const enviarInformeFinal = async () => {
    try {
      setEnviando(true);
      await api.post(`/fondos-tiempo/${id}/presentar/`, informeData);
      toast.success('Informe enviado exitosamente.');
      setMostrarConfirmarEnvio(false);
      await cargarFondo();
    } catch (err) {
      console.error('Error al enviar informe:', err);
      toast.error(getApiErrorMessage(err, 'Error al enviar el informe'));
    } finally {
      setEnviando(false);
    }
  };

  const volverAlFondo = () => navigate(`/fondo-tiempo/fondo/${id}`);
  // El informe se abre en una pestaña aparte (desde el fondo): la X la cierra. Si no se
  // puede cerrar (se entró escribiendo la dirección), vuelve al fondo.
  const cerrarVentana = () => {
    window.close();
    window.setTimeout(() => {
      if (!window.closed) volverAlFondo();
    }, 150);
  };

  const barraLateral = pantallaAncha && !soloLectura && posicionBarra !== 'arriba';

  const contexto = useMemo(() => ({ campoActivo, setCampoActivo, soloLectura }), [campoActivo, soloLectura]);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-azulado-100">
        <Loader2 className="w-8 h-8 text-blue-900 animate-spin" />
      </div>
    );
  }

  if (errorCarga || !fondo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-azulado-100 p-6">
        <div className={`${BLOQUE} max-w-md w-full p-8 text-center`}>
          <FileWarning className="w-10 h-10 text-red-500 mx-auto" />
          <p className="mt-3 text-slate-700 font-semibold">{errorCarga || 'No se encontró el fondo.'}</p>
          <button onClick={volverAlFondo} className={`${BOTON} mt-5 bg-blue-900 hover:bg-blue-950 text-white`}>
            <ArrowLeft className="w-4 h-4" />
            Volver al fondo
          </button>
        </div>
      </div>
    );
  }

  // Un solo aviso arriba: en solo lectura, el motivo según el estado; al redactar, el guardado.
  const motivoSoloLectura = fondo.estado === 'finalizado' || estadoInforme === 'aprobado'
    ? 'Informe evaluado, fondo finalizado.'
    : estadoInforme === 'enviado'
      ? 'Informe enviado, en espera de la revisión del Director.'
      : estadoInforme === 'observado'
        ? 'El docente está corrigiendo el informe.'
        : 'El informe lo redacta el docente del fondo mientras está en ejecución.';
  const estadoGuardado = soloLectura
    ? `Solo lectura · ${motivoSoloLectura}`
    : guardando
      ? 'Guardando…'
      : ultimoGuardado
        ? `Guardado a las ${ultimoGuardado.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`
        : 'Sin guardar todavía';

  return (
    <InformeDocumentoContext.Provider value={contexto}>
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-900 to-blue-950">
        {/* Cabecera (azul del sidebar): el dueño del informe y el único aviso de estado. */}
        <header className="bg-gradient-to-r from-blue-900 to-blue-950 text-white">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={cerrarVentana}
                title="Cerrar"
                aria-label="Cerrar el informe"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-200">
                  Informe de cumplimiento{fondo.gestion ? ` · Gestión ${fondo.gestion}` : ''}
                </p>
                <h1 className="text-base md:text-lg font-bold leading-tight break-words">{nombreDocente || 'Fondo de tiempo'}</h1>
              </div>
            </div>
            <p className="inline-flex items-start gap-1.5 self-start lg:self-auto rounded-2xl bg-white/10 px-3 py-2 text-xs text-sky-100">
              {soloLectura ? <Lock className="w-3.5 h-3.5 mt-px shrink-0" /> : guardando ? <Loader2 className="w-3.5 h-3.5 mt-px shrink-0 animate-spin" /> : <Save className="w-3.5 h-3.5 mt-px shrink-0" />}
              {estadoGuardado}
            </p>
          </div>
        </header>

        {/* Barra fija al tope del informe, con dos grupos: a la izquierda las descargas; a la
            derecha la decisión del Director (informe presentado) o, al redactar, guardar y
            enviar. En celular los grupos van uno debajo del otro. Debajo, la barra de formato
            cuando va arriba. */}
        <div ref={cabeceraRef} className="sticky top-0 z-30 bg-azulado-100 rounded-t-[2rem] px-4 md:px-6 pt-4 pb-3">
          <div className="max-w-[1100px] mx-auto space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-blue-800">Descargar:</span>
                {[
                  { accion: 'ver', etiqueta: 'Vista previa', titulo: 'Ver el PDF en una pestaña nueva', icono: Eye },
                  { accion: 'pdf', etiqueta: 'PDF', titulo: 'Descargar en PDF', icono: Download },
                  { accion: 'word', etiqueta: 'Word', titulo: 'Descargar en Word (.docx) para editarlo', icono: Download },
                ].map(({ accion, etiqueta, titulo, icono: Icono }) => (
                  <button
                    key={accion}
                    onClick={() => obtenerDocumento(accion)}
                    disabled={Boolean(generando)}
                    title={titulo}
                    className={`${BOTON_CHICO} ${BOTON_DOCUMENTO} disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {generando === accion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icono className="w-3.5 h-3.5" />}
                    {etiqueta}
                  </button>
                ))}
              </div>

              {puedeRevisar && (
                // En celular la etiqueta va arriba y los dos botones, compactos, a la par.
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="text-xs font-semibold text-blue-800">Decisión:</span>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                    <button
                      onClick={() => setVentanaRevision('correcciones')}
                      className={`${BOTON_CHICO} sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-sm text-blue-900 ring-1 ring-inset ring-blue-900/40 hover:bg-azulado-200`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Pedir correcciones
                    </button>
                    <button
                      onClick={() => setVentanaRevision('evaluar')}
                      className={`${BOTON_CHICO} sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-sm bg-blue-900 hover:bg-blue-950 text-white shadow-sm`}
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Evaluar cumplimiento
                    </button>
                  </div>
                </div>
              )}

              {!soloLectura && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => guardarBorrador()}
                    disabled={guardando || Boolean(generando) || enviando}
                    className={`${BOTON} text-blue-900 ring-1 ring-inset ring-blue-900/40 hover:bg-azulado-200 disabled:opacity-60`}
                  >
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar borrador
                  </button>
                  <button
                    onClick={abrirConfirmacionEnvio}
                    disabled={enviando}
                    className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-60`}
                  >
                    <Send className="w-4 h-4" />
                    Enviar informe
                  </button>
                </div>
              )}
            </div>

            {/* Barra de formato arriba (no en solo lectura) */}
            {!barraLateral && !soloLectura && (
              <InformeFormatToolbar posicion="arriba" onCambiarPosicion={pantallaAncha ? cambiarPosicionBarra : null} />
            )}
          </div>
        </div>

        <main className="flex-1 bg-azulado-100 px-4 md:px-6 pb-16 pt-2">
          <div className={barraLateral ? `flex items-start justify-center gap-6 ${posicionBarra === 'derecha' ? 'flex-row-reverse' : ''}` : ''}>
          {/* Barra de formato a un costado de la hoja, fija al bajar */}
          {barraLateral && (
            <aside className="sticky w-52 shrink-0" style={{ top: alturaCabecera + 16 }}>
              <InformeFormatToolbar posicion={posicionBarra} onCambiarPosicion={cambiarPosicionBarra} />
            </aside>
          )}
          <div className={barraLateral ? 'w-full max-w-[850px] min-w-0' : ''}>
          {/* Avisos: el motivo de solo lectura ya está arriba; aquí, lo que pidió corregir el
              Director y la ayuda para redactar. */}
          <div className="max-w-[850px] mx-auto space-y-3 pt-1">
            {estadoInforme === 'observado' && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 ring-1 ring-inset ring-red-200">
                <p className="text-sm font-semibold text-red-700 mb-1">El Director solicitó correcciones:</p>
                <p className="text-sm text-red-700 whitespace-pre-wrap">{informe?.evaluacion_director}</p>
              </div>
            )}
            {!soloLectura && (
              <p className="px-1 text-xs text-slate-500">
                Edita directamente sobre el documento, como en Word. Tu progreso se guarda solo cada 30 segundos;
                el Director lo recibe recién cuando hagas clic en «Enviar informe».
              </p>
            )}
          </div>

          {/* El documento */}
          <div
            className="max-w-[850px] mx-auto mt-4 bg-white rounded-lg ring-1 ring-azulado-300 shadow-[0_8px_30px_rgba(30,58,138,0.12)] px-8 py-10 md:px-16 md:py-12 text-slate-900"
            style={FUENTE_DOCUMENTO}
          >
            {/* 1. Encabezado institucional (en celular el logo va arriba, centrado, para no
                montarse sobre el texto) */}
            <div className="relative mb-1 min-h-[3.2rem]">
              {logoCarrera && (
                <img src={logoCarrera} alt="Logo de la carrera" className="block mx-auto mb-2 w-14 h-14 object-contain md:absolute md:left-0 md:top-0 md:mb-0" />
              )}
              <InformeCampoPlano
                value={informeData.encabezado_texto}
                onChange={(v) => handleCampoChange('encabezado_texto', v)}
                multilinea
                placeholder="Encabezado institucional..."
                className="block text-center font-bold uppercase text-[12.5px] leading-[1.5] whitespace-pre-line"
              />
            </div>
            <div className="h-[2px] bg-[#3CBECA] mt-3 mb-6" />

            {/* 2. Fecha */}
            <div className="text-right text-[13.5px] mb-6">
              <InformeCampoPlano
                value={informeData.fecha_texto}
                onChange={(v) => handleCampoChange('fecha_texto', v)}
                placeholder="Trinidad, ..."
                className="inline-block"
              />
            </div>

            {/* Destinatario / Remitente / Referencia */}
            <div className="text-[13.5px] leading-relaxed mb-6 space-y-1">
              <div className="flex gap-2">
                <span className="w-14 shrink-0">A&nbsp;&nbsp;&nbsp;&nbsp;:</span>
                <div className="flex-1">
                  <InformeCampoPlano
                    value={informeData.destinatario_nombre}
                    onChange={(v) => handleCampoChange('destinatario_nombre', v)}
                    placeholder="Nombre del Director"
                    bloque
                  />
                  <InformeCampoPlano
                    value={informeData.destinatario_cargo}
                    onChange={(v) => handleCampoChange('destinatario_cargo', v)}
                    placeholder="Cargo del Director"
                    bloque
                    className="font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <span className="w-14 shrink-0">DE&nbsp;&nbsp;:</span>
                <div className="flex-1">
                  <InformeCampoPlano
                    value={informeData.remitente_nombre}
                    onChange={(v) => handleCampoChange('remitente_nombre', v)}
                    placeholder="Nombre del docente"
                    bloque
                  />
                  <InformeCampoPlano
                    value={informeData.remitente_cargo}
                    onChange={(v) => handleCampoChange('remitente_cargo', v)}
                    placeholder="Cargo del docente"
                    bloque
                    className="font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <span className="w-14 shrink-0">REF.&nbsp;:</span>
                <InformeCampoPlano
                  value={informeData.referencia_texto}
                  onChange={(v) => handleCampoChange('referencia_texto', v)}
                  placeholder="Informe de Fondo de Tiempo Docente..."
                  className="flex-1 font-bold underline"
                />
              </div>
            </div>

            {/* 3-4. Saludo + introducción */}
            <InformeCampoRico
              value={informeData.saludo_intro_html}
              onChange={(v) => handleCampoChange('saludo_intro_html', v)}
              placeholder="Señor Director: ..."
              className="block text-[13.5px] leading-relaxed text-justify mb-6"
            />

            {/* 5. Las 7 categorías del Art. 12° */}
            {seccionesInforme.map(({ campo, numero, titulo, requerido, placeholder }) => (
              <div key={campo} className="mb-6">
                <h3 className="font-bold uppercase text-[13.5px] mb-2">
                  {numero}. {titulo}
                  {requerido && !soloLectura && <span className="text-red-500 font-normal normal-case text-xs ml-1">(obligatorio)</span>}
                </h3>
                <InformeCampoRico
                  value={informeData[campo]}
                  onChange={(v) => handleCampoChange(campo, v)}
                  placeholder={placeholder}
                  className="block text-[13.5px] leading-relaxed text-justify min-h-[3rem]"
                />
              </div>
            ))}

            {/* 6. Cierre */}
            <InformeCampoRico
              value={informeData.cierre_html}
              onChange={(v) => handleCampoChange('cierre_html', v)}
              placeholder="Adjunto Informe de las Actividades realizadas como..."
              className="block text-[13.5px] leading-relaxed text-justify mb-2"
            />

            {/* 7. Firma */}
            <div className="flex justify-end mt-14">
              <div className="w-64 text-center text-[13.5px] space-y-1">
                <InformeFirmaImagen
                  value={informeData.firma_imagen_html}
                  onChange={(v) => handleCampoChange('firma_imagen_html', v)}
                />
                <InformeCampoPlano
                  value={informeData.firma_nombre}
                  onChange={(v) => handleCampoChange('firma_nombre', v)}
                  placeholder="Nombre del docente"
                  bloque
                  className="italic text-[16px]"
                />
                <InformeCampoPlano
                  value={informeData.firma_cargo}
                  onChange={(v) => handleCampoChange('firma_cargo', v)}
                  placeholder="Cargo del docente"
                  bloque
                  className="font-bold"
                />
                <InformeCampoPlano
                  value={informeData.firma_email}
                  onChange={(v) => handleCampoChange('firma_email', v)}
                  placeholder="E-mail"
                  bloque
                  className="text-[11px] text-[#0563C1] underline"
                />
              </div>
            </div>

            <p className="text-[13.5px] mt-10">Cc./Arch.</p>
          </div>
          </div>
          </div>
        </main>
      </div>

      {/* Confirmación de envío */}
      {mostrarConfirmarEnvio && (
        <ModalConfirmar
          etiqueta="Informe de cumplimiento"
          titulo="Enviar informe"
          mensaje={<>Se enviará el informe al Director para su revisión. <strong className="text-slate-900">No podrá editarlo después de enviarlo</strong>, salvo que el Director solicite correcciones.</>}
          textoAccion="Sí, enviar"
          textoTrabajando="Enviando..."
          onConfirmar={enviarInformeFinal}
          onCancelar={() => setMostrarConfirmarEnvio(false)}
        />
      )}

      {/* Revisión del Director: al terminar se recarga y el informe queda en solo lectura. */}
      {ventanaRevision === 'correcciones' && (
        <ModalCorreccionesInforme
          fondo={fondo}
          onEnviado={async () => {
            setVentanaRevision(null);
            await cargarFondo();
          }}
          onCancelar={() => setVentanaRevision(null)}
        />
      )}
      {ventanaRevision === 'evaluar' && (
        <FormularioEvaluarInforme
          fondoId={fondo.id}
          requiereDocumentoDecanatura={Boolean(fondo.es_fondo_de_director)}
          onInformeEvaluado={async () => {
            setVentanaRevision(null);
            await cargarFondo();
          }}
          onCancelar={() => setVentanaRevision(null)}
        />
      )}
    </InformeDocumentoContext.Provider>
  );
}
