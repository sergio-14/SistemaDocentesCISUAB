import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Eye, Send, Loader2, FileWarning, Lock } from 'lucide-react';
import api, { getFondoTiempoDetalle, guardarInformeBorrador } from '../apis/api';
import { API_URL } from '../apis/apiConfig';
import { getApiErrorMessage } from '../utils/formErrors';
import InformeCampoRico from './InformeCampoRico';
import InformeCampoPlano from './InformeCampoPlano';
import InformeFormatToolbar from './InformeFormatToolbar';
import { InformeDocumentoContext } from './InformeDocumentoContext';

const SECCIONES_INFORME = [
  { campo: 'seccion_academica', numero: 1, titulo: 'Académica', requerido: true, placeholder: 'Cumplimiento de objetivos, resultados por materia (estudiantes inscritos, aprobados, reprobados), metodología de evaluación...' },
  { campo: 'seccion_investigacion', numero: 2, titulo: 'Investigación', requerido: false, placeholder: 'Proyectos de investigación realizados, colaboraciones, resultados concretos...' },
  { campo: 'seccion_extension_interaccion', numero: 3, titulo: 'Extensión Universitaria e Interacción Social', requerido: false, placeholder: 'Participación en ferias, consultorías, cursos de actualización...' },
  { campo: 'seccion_asesorias_tutorias', numero: 4, titulo: 'Asesorías y Tutorías', requerido: false, placeholder: 'Tribunales de graduación, tutorías de proyectos...' },
  { campo: 'seccion_academica_administrativa', numero: 5, titulo: 'Académica Administrativa', requerido: false, placeholder: 'Actividades de gestión, POA, comisiones...' },
  { campo: 'seccion_social_cultural_deportiva', numero: 6, titulo: 'Social, Cultural y Deportiva', requerido: false, placeholder: 'Participación en eventos universitarios...' },
  { campo: 'conclusiones_generales', numero: 7, titulo: 'Conclusiones Generales', requerido: true, placeholder: 'Resumen final y recomendaciones para futuras gestiones...' },
];

const CAMPOS_DOCUMENTO = [
  'encabezado_texto', 'fecha_texto',
  'destinatario_nombre', 'destinatario_cargo',
  'remitente_nombre', 'remitente_cargo', 'referencia_texto',
  'saludo_intro_html', 'cierre_html',
  'firma_nombre', 'firma_cargo', 'firma_email',
];

const TODOS_LOS_CAMPOS = [...CAMPOS_DOCUMENTO, ...SECCIONES_INFORME.map((s) => s.campo)];

const AUTOGUARDADO_MS = 30000;
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

  const [fondo, setFondo] = useState(null);
  const [informeData, setInformeData] = useState(datosVacios());
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mostrarConfirmarEnvio, setMostrarConfirmarEnvio] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState(null);
  const [campoActivo, setCampoActivo] = useState(null);

  const sucioRef = useRef(false);
  const informeDataRef = useRef(informeData);
  informeDataRef.current = informeData;

  const informe = fondo?.informe_actual || null;
  const estadoInforme = informe?.estado || null;
  const soloLectura = estadoInforme === 'enviado' || estadoInforme === 'aprobado';
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

  // Auto-guardado cada 30s mientras haya cambios sin guardar.
  useEffect(() => {
    if (soloLectura || cargando) return undefined;
    const intervalId = window.setInterval(() => {
      if (sucioRef.current) guardarBorrador({ silencioso: true });
    }, AUTOGUARDADO_MS);
    return () => window.clearInterval(intervalId);
  }, [soloLectura, cargando, guardarBorrador]);

  const abrirPdfNuevaPestana = async () => {
    try {
      setPrevisualizando(true);
      if (!soloLectura) {
        const guardado = await guardarBorrador({ silencioso: true });
        if (!guardado) return;
      }
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/fondos-tiempo/${id}/pdf-informe/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('No se pudo generar el PDF.');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      console.error('Error al generar la vista previa:', err);
      toast.error('No se pudo generar la vista previa del PDF.');
    } finally {
      setPrevisualizando(false);
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

  const contexto = useMemo(() => ({ campoActivo, setCampoActivo, soloLectura }), [campoActivo, soloLectura]);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (errorCarga || !fondo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-900 p-6 text-center">
        <FileWarning className="w-10 h-10 text-red-500" />
        <p className="text-slate-700 dark:text-slate-300 font-semibold">{errorCarga || 'No se encontró el fondo.'}</p>
        <button
          onClick={volverAlFondo}
          className="px-4 py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all"
        >
          Volver al Fondo
        </button>
      </div>
    );
  }

  return (
    <InformeDocumentoContext.Provider value={contexto}>
      <div className="min-h-screen flex flex-col bg-slate-200 dark:bg-slate-950">
        {/* Barra superior + barra de formato, fijas juntas */}
        <div className="sticky top-0 z-30">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="max-w-[850px] mx-auto px-4 md:px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold text-slate-800 dark:text-white truncate">
                Informe de Fondo de Tiempo{nombreDocente ? ` - ${nombreDocente}` : ''}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {soloLectura
                  ? 'Solo lectura'
                  : guardando
                    ? 'Guardando…'
                    : ultimoGuardado
                      ? `Guardado a las ${ultimoGuardado.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Sin guardar todavía'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!soloLectura && (
                <button
                  onClick={() => guardarBorrador()}
                  disabled={guardando || previsualizando || enviando}
                  className="px-3.5 py-2 rounded-xl font-bold text-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Borrador
                </button>
              )}
              <button
                onClick={abrirPdfNuevaPestana}
                disabled={previsualizando}
                className="px-3.5 py-2 rounded-xl font-bold text-sm text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {previsualizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Previsualizar
              </button>
              {!soloLectura && (
                <button
                  onClick={abrirConfirmacionEnvio}
                  disabled={enviando}
                  className="px-4 py-2 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  Enviar Informe
                </button>
              )}
              <button
                onClick={volverAlFondo}
                className="px-3.5 py-2 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-2 border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al Fondo
              </button>
            </div>
          </div>
        </header>

        <InformeFormatToolbar />
        </div>

        {/* Avisos de estado */}
        {(soloLectura || estadoInforme === 'observado' || !soloLectura) && (
          <div className="max-w-[850px] w-full mx-auto px-4 md:px-6 pt-4">
            {soloLectura && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 p-4 rounded-r-lg flex items-start gap-3 mb-3">
                <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-800 dark:text-emerald-300">
                  Informe {estadoInforme === 'aprobado' ? 'aprobado' : 'enviado'} - en espera de aprobación del Director.
                  Ya no se puede editar, salvo que el Director solicite correcciones.
                </p>
              </div>
            )}
            {estadoInforme === 'observado' && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-lg mb-3">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">
                  El Director solicitó correcciones:
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300 whitespace-pre-wrap">
                  {informe?.evaluacion_director}
                </p>
              </div>
            )}
            {!soloLectura && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-3 rounded-r-lg mb-1">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Edita directamente sobre el documento, como en Word. Tu progreso se guarda automáticamente cada 30
                  segundos; solo se envía al Director cuando hagas clic en "Enviar Informe".
                </p>
              </div>
            )}
          </div>
        )}

        {/* El documento */}
        <main className="flex-1 overflow-y-auto pb-16">
          <div
            className="max-w-[850px] mx-auto my-6 bg-white dark:bg-slate-900 shadow-lg rounded-sm px-8 py-10 md:px-16 md:py-12 text-slate-900 dark:text-slate-100"
            style={FUENTE_DOCUMENTO}
          >
            {/* 1. Encabezado institucional */}
            <div className="relative mb-1 min-h-[3.2rem]">
              {logoCarrera && (
                <img src={logoCarrera} alt="Logo de la carrera" className="absolute left-0 top-0 w-14 h-14 object-contain" />
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
                    className="block"
                  />
                  <InformeCampoPlano
                    value={informeData.destinatario_cargo}
                    onChange={(v) => handleCampoChange('destinatario_cargo', v)}
                    placeholder="Cargo del Director"
                    className="block font-bold"
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
                    className="block"
                  />
                  <InformeCampoPlano
                    value={informeData.remitente_cargo}
                    onChange={(v) => handleCampoChange('remitente_cargo', v)}
                    placeholder="Cargo del docente"
                    className="block font-bold"
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
            {SECCIONES_INFORME.map(({ campo, numero, titulo, requerido, placeholder }) => (
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
                <InformeCampoPlano
                  value={informeData.firma_nombre}
                  onChange={(v) => handleCampoChange('firma_nombre', v)}
                  placeholder="Nombre del docente"
                  className="block italic text-[16px]"
                />
                <InformeCampoPlano
                  value={informeData.firma_cargo}
                  onChange={(v) => handleCampoChange('firma_cargo', v)}
                  placeholder="Cargo del docente"
                  className="block font-bold"
                />
                <InformeCampoPlano
                  value={informeData.firma_email}
                  onChange={(v) => handleCampoChange('firma_email', v)}
                  placeholder="E-mail"
                  className="block text-[11px] text-[#0563C1] underline"
                />
              </div>
            </div>

            <p className="text-[13.5px] mt-10">Cc./Arch.</p>
          </div>
        </main>
      </div>

      {/* Modal de confirmación de envío */}
      {mostrarConfirmarEnvio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <FileWarning className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Confirmar envío</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                ¿Está seguro de enviar este informe? <span className="font-bold">No podrá editarlo después de enviarlo</span>, salvo que el Director solicite correcciones.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setMostrarConfirmarEnvio(false)}
                disabled={enviando}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
              >
                Volver a editar
              </button>
              <button
                onClick={enviarInformeFinal}
                disabled={enviando}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Sí, enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </InformeDocumentoContext.Provider>
  );
}
