import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { obtenerTodos } from '../apis/api';
import { MENSAJE_REVISA_CAMPOS, getApiErrorMessage } from '../utils/formErrors';
import { validarRangoHora24 } from '../utils/horas24';
import ProgramaAnaliticoAccion from './fondos/ProgramaAnaliticoAccion';
import CampoHora24 from './common/CampoHora24';
import MensajeErrorCampo from './common/MensajeErrorCampo';
import FiltroDesplegable from './common/FiltroDesplegable';
import ModalCentrado from './common/ModalCentrado';
import ModalConfirmar from './common/ModalConfirmar';
import { BLOQUE, BOTON, BOTON_CHICO } from './fondos/estilosFondo';
import { Avatar } from './fondos/ElementosFondo';

// Doble carrera: el Jefe de Estudios asigna una materia de SU carrera a un docente de otra.
// La carga va al Fondo de Tiempo del docente en su carrera, que este Jefe no ve. Carga
// Horaria muestra la lista en su vista "Materias asignadas" (mostrarLista, filtrada con su
// buscador) y abre la ventana de asignación con su botón "Asignar materia" (modalAbierto).

const PARALELOS = ['A', 'B', 'C', 'D', 'E', 'F'];
const DIAS = [
  ['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'],
  ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'],
];
const FORM_VACIO = {
  calendario: '', materia: '', paralelo: 'A', dia_semana: 'lunes', hora_inicio: '', hora_fin: '', aula: '',
};
// Letras mínimas para buscar docentes (las mismas que pide el backend).
const MINIMO_BUSQUEDA = 2;
const EDITABLE = ['borrador', 'observado'];
const COLUMNAS = 'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_5rem_6rem]';

// Campos con el estilo del módulo (píldora azulada, etiqueta chica arriba).
const inputCls = 'w-full h-11 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100';
const labelCls = 'mb-1.5 pl-1 block text-xs font-semibold text-slate-700';

// Sin mayúsculas ni tildes: "jose" encuentra "José".
const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const AsignarMateriaOtraCarrera = ({ mostrarLista = false, filtro = '', modalAbierto = false, onCerrarModal }) => {
  const [calendarios, setCalendarios] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [cargaPorQuitar, setCargaPorQuitar] = useState(null);
  // Ventana de asignación
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [docente, setDocente] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [pulso, setPulso] = useState(0);

  // Todas las materias que su carrera asignó a docentes de otras carreras (?otra_carrera=1):
  // al entrar y después de asignar, quitar o subir un programa analítico.
  const cargarCargas = () => {
    obtenerTodos('/cargas-horarias/', { otra_carrera: 1 })
      .then(setCargas)
      .catch((error) => toast.error(getApiErrorMessage(error, 'No se pudieron cargar las materias asignadas')));
  };

  useEffect(() => {
    obtenerTodos('/calendarios/')
      .then(setCalendarios)
      .catch((error) => toast.error(getApiErrorMessage(error, 'No se pudieron cargar los calendarios')));
    cargarCargas();
  }, []);

  // Búsqueda mientras se escribe (una pausa corta para no consultar en cada tecla).
  useEffect(() => {
    const texto = busqueda.trim();
    if (texto.replace(/\s/g, '').length < MINIMO_BUSQUEDA) {
      setResultados([]);
      setBuscando(false);
      return undefined;
    }
    setBuscando(true);
    let vigente = true;
    const temporizador = setTimeout(() => {
      api.get('/docentes/buscar/', { params: { q: texto } })
        .then((respuesta) => vigente && setResultados(respuesta.data))
        .catch((error) => vigente && toast.error(getApiErrorMessage(error, 'No se pudo buscar docentes')))
        .finally(() => vigente && setBuscando(false));
    }, 200);
    return () => { vigente = false; clearTimeout(temporizador); };
  }, [busqueda]);

  const calendario = calendarios.find((cal) => String(cal.id) === String(form.calendario));

  useEffect(() => {
    setMaterias([]);
    if (!calendario) return;
    obtenerTodos('/materias/', { carrera: calendario.carrera, activo: true })
      .then(setMaterias)
      .catch((error) => toast.error(getApiErrorMessage(error, 'No se pudieron cargar las materias')));
  }, [calendario]);

  // Cada vez que se abre la ventana, empieza vacía.
  useEffect(() => {
    if (!modalAbierto) return;
    setDocente(null);
    setBusqueda('');
    setResultados([]);
    setForm(FORM_VACIO);
    setErrores({});
  }, [modalAbierto]);
  const cerrarModal = () => {
    if (!guardando) onCerrarModal();
  };

  const elegirDocente = (elegido) => {
    setDocente(elegido);
    setBusqueda('');
    setResultados([]);
  };
  // Volver a buscar otro docente sin cerrar la ventana (lo ya llenado de la materia se conserva).
  const cambiarDocente = () => setDocente(null);

  const cambiarValor = (campo, valor) => {
    setForm((previo) => ({ ...previo, [campo]: valor, ...(campo === 'calendario' ? { materia: '' } : {}) }));
    setErrores((previos) => ({ ...previos, [campo]: undefined }));
  };
  const claseCampo = (campo) => `${inputCls} ${errores[campo] ? '!ring-2 !ring-red-500' : ''}`;

  const materia = materias.find((m) => String(m.id) === String(form.materia));
  // Clases en aula: horas de la materia x 20 semanas (semestre) o x 40 (anual). El backend las recalcula.
  const horasAnuales = materia && calendario ? Number(materia.horas_totales || 0) * calendario.semanas_de_clase : 0;

  const asignar = async (evento) => {
    evento.preventDefault();
    const rango = validarRangoHora24(form.hora_inicio, form.hora_fin);
    const nuevosErrores = {
      calendario: calendario ? undefined : 'Seleccione el calendario.',
      materia: materia ? undefined : 'Seleccione la materia.',
      hora_inicio: rango.inicio,
      hora_fin: rango.fin,
    };
    if (Object.values(nuevosErrores).some(Boolean)) {
      setErrores(nuevosErrores);
      setPulso((valor) => valor + 1);
      toast.error(MENSAJE_REVISA_CAMPOS);
      return;
    }
    setGuardando(true);
    try {
      await api.post('/cargas-horarias/', {
        docente: docente.id,
        calendario: calendario.id,
        categoria: 'academica',
        tipo_actividad: 'clases_aula',
        materia: materia.id,
        paralelo: form.paralelo,
        dia_semana: form.dia_semana,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        aula: form.aula.trim(),
        horas: horasAnuales,
      });
      toast.success(`${materia.nombre} asignada a ${docente.nombre_completo}`);
      onCerrarModal();
      cargarCargas();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo asignar la materia'));
    } finally {
      setGuardando(false);
    }
  };

  // Si el backend lo rechaza, el motivo queda en el modal (ModalConfirmar).
  const quitar = async () => {
    try {
      await api.delete(`/cargas-horarias/${cargaPorQuitar.id}/`);
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'No se pudo quitar la materia'));
    }
    setCargaPorQuitar(null);
    toast.success('Materia quitada');
    cargarCargas();
  };

  const nombreCalendario = (id) => {
    const cal = calendarios.find((c) => c.id === id);
    // Son los calendarios de la carrera del Jefe: no hace falta repetir la carrera.
    return cal ? `${cal.periodo_display} ${cal.gestion}` : '';
  };

  const opcionesCalendario = calendarios.map((cal) => ({ value: String(cal.id), label: nombreCalendario(cal.id) }));
  // Gestiones de los calendarios de su carrera sin Fondo de Tiempo vigente del docente:
  // ahí no se le puede asignar una materia.
  const gestionesCarrera = [...new Set(calendarios.map((cal) => cal.gestion))].sort();
  const avisoSinFondo = (persona) => gestionesCarrera
    .filter((gestion) => !(persona?.gestiones_con_fondo || []).includes(gestion))
    .map((gestion) => (
      <span key={gestion} className="whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-900 ring-1 ring-inset ring-sky-200">
        Sin fondo {gestion}
      </span>
    ));
  const opcionesMateria = materias.map((m) => ({ value: String(m.id), label: `${m.sigla} - ${m.nombre} (${m.horas_totales} h/sem)` }));
  const opcionesParalelo = PARALELOS.map((p) => ({ value: p, label: `Paralelo ${p}` }));
  const opcionesDia = DIAS.map(([valor, etiqueta]) => ({ value: valor, label: etiqueta }));

  // La lista se filtra mientras se escribe, por docente o por materia.
  const textoFiltro = normalizar(filtro.trim());
  const cargasFiltradas = textoFiltro
    ? cargas.filter((carga) => [carga.docente_nombre, carga.materia_nombre, carga.materia_sigla]
      .some((campo) => normalizar(campo).includes(textoFiltro)))
    : cargas;
  const faltanLetras = busqueda.trim().replace(/\s/g, '').length < MINIMO_BUSQUEDA;

  return (
    <>
      {/* Vista "Materias asignadas" de Carga Horaria: mismo diseño que su vista de lista. */}
      {mostrarLista && (cargas.length === 0 || cargasFiltradas.length === 0 ? (
        <div className={`${BLOQUE} p-10 text-center text-sm text-slate-600`}>
          {cargas.length === 0
            ? 'Su carrera todavía no asignó materias a docentes de otras carreras.'
            : 'Ninguna materia asignada coincide con la búsqueda.'}
        </div>
      ) : (
        // Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas.
        <div className={`${BLOQUE} p-2 sm:p-3`}>
          <div className={`hidden lg:grid ${COLUMNAS} gap-4 px-3 pt-3 pb-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 [border-bottom:1px_solid_#B8C9E1]`}>
            <span>Docente</span>
            <span>Materia</span>
            <span>Calendario</span>
            <span>Horario</span>
            <span className="lg:text-right">h/año</span>
            <span />
          </div>
          <div className="divide-y divide-azulado-300">
            {cargasFiltradas.map((carga, indice) => (
              <div
                key={carga.id}
                style={{ animationDelay: `${Math.min(indice, 8) * 35}ms` }}
                className={`animate-fondo-entrada grid grid-cols-1 ${COLUMNAS} items-center gap-x-4 gap-y-1.5 px-3 py-4 rounded-2xl text-tabla text-slate-700 hover:bg-azulado-100/70 transition-colors`}
              >
                <div className="min-w-0 font-bold text-blue-900 truncate">{carga.docente_nombre}</div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">{`${carga.materia_sigla} - ${carga.materia_nombre} (${carga.paralelo})`}</div>
                  <ProgramaAnaliticoAccion
                    fondoId={carga.fondo}
                    materiaId={carga.materia}
                    calendarioId={carga.calendario}
                    url={carga.programa_analitico_url}
                    puedeSubir={EDITABLE.includes(carga.fondo_estado)}
                    onSubido={cargarCargas}
                  />
                </div>
                <div className="min-w-0 truncate">{nombreCalendario(carga.calendario)}</div>
                <div className="capitalize tabular-nums">{`${carga.dia_semana} ${(carga.hora_inicio || '').slice(0, 5)}-${(carga.hora_fin || '').slice(0, 5)}`}</div>
                <div className="lg:text-right font-bold text-blue-900 tabular-nums">
                  {carga.horas}<span className="lg:hidden font-medium text-slate-500"> h/año</span>
                </div>
                <div className="lg:text-right">
                  {/* Solo con el fondo en borrador u observado (como el backend). */}
                  <button
                    type="button"
                    onClick={() => setCargaPorQuitar(carga)}
                    disabled={!EDITABLE.includes(carga.fondo_estado)}
                    title={EDITABLE.includes(carga.fondo_estado) ? undefined : 'El fondo ya fue presentado: la materia no se puede quitar.'}
                    className={`${BOTON_CHICO} bg-red-400 hover:bg-red-500 text-white disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed`}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {modalAbierto && (
        <ModalCentrado onClose={cerrarModal}>
          <form onSubmit={asignar} noValidate className="w-full max-w-3xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl">
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Docentes de otra carrera</p>
                <h3 className="text-xl font-bold text-slate-800">Asignar materia</h3>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                aria-label="Cerrar"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-azulado-200 hover:text-slate-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Docente: se busca mientras se escribe; elegido, se puede cambiar por otro. */}
              {docente ? (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 px-4 py-3">
                  <Avatar nombre={docente.nombre_completo} size="w-10 h-10 text-sm" />
                  <div className="min-w-0">
                    <p className="font-bold text-blue-900 truncate">{docente.nombre_completo}</p>
                    <p className="text-xs text-slate-600 tabular-nums">C.I. …{docente.ci_ultimos || '----'}</p>
                  </div>
                  {avisoSinFondo(docente)}
                  <button
                    type="button"
                    onClick={cambiarDocente}
                    className={`${BOTON_CHICO} ml-auto bg-white text-blue-900 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-200`}
                  >
                    Cambiar docente
                  </button>
                </div>
              ) : (
                <div>
                  <label className={labelCls} htmlFor="buscar-docente-otra-carrera">Docente</label>
                  <label className="flex items-center gap-2 h-11 px-4 rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300 focus-within:ring-2 focus-within:ring-blue-900/40">
                    <svg className="w-[18px] h-[18px] text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                      id="buscar-docente-otra-carrera"
                      type="text"
                      autoFocus
                      autoComplete="off"
                      value={busqueda}
                      onChange={(evento) => setBusqueda(evento.target.value)}
                      placeholder="Escriba el nombre o apellido del docente"
                      className="w-full text-sm text-slate-800 placeholder:text-slate-500 outline-none"
                      style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
                    />
                  </label>
                  {!faltanLetras && (
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-2xl bg-white ring-1 ring-azulado-300 p-2">
                    {buscando && resultados.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p>
                    ) : resultados.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">No hay docentes de otras carreras con ese nombre.</p>
                    ) : resultados.map((resultado) => (
                      <button
                        key={resultado.id}
                        type="button"
                        onClick={() => elegirDocente(resultado)}
                        className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#2C4AAE] hover:text-white"
                      >
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="font-medium">{resultado.nombre_completo}</span>
                          {avisoSinFondo(resultado)}
                        </span>
                        <span className="opacity-70 tabular-nums whitespace-nowrap">C.I. …{resultado.ci_ultimos || '----'}</span>
                      </button>
                    ))}
                  </div>
                  )}
                </div>
              )}

              {/* Materia: se habilita al elegir el docente. */}
              <fieldset disabled={!docente} className={`grid grid-cols-1 gap-4 md:grid-cols-3 transition-opacity ${docente ? '' : 'opacity-50'}`}>
                <div>
                  <label className={labelCls} htmlFor="otra-carrera-calendario">Calendario</label>
                  <FiltroDesplegable
                    id="otra-carrera-calendario"
                    value={form.calendario}
                    options={opcionesCalendario}
                    onChange={(valor) => cambiarValor('calendario', String(valor))}
                    placeholder="Seleccione el calendario"
                    ariaLabel="Calendario"
                    emptyText="No hay calendarios"
                    permitirQuitar={false}
                    invalido={Boolean(errores.calendario)}
                    disabled={!docente}
                  />
                  <MensajeErrorCampo error={errores.calendario} pulse={pulso} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls} htmlFor="otra-carrera-materia">Materia</label>
                  <FiltroDesplegable
                    id="otra-carrera-materia"
                    value={form.materia}
                    options={opcionesMateria}
                    onChange={(valor) => cambiarValor('materia', String(valor))}
                    placeholder={calendario ? 'Seleccione la materia' : 'Elija primero el calendario'}
                    ariaLabel="Materia"
                    emptyText="No hay materias que coincidan"
                    permitirQuitar={false}
                    invalido={Boolean(errores.materia)}
                    disabled={!docente || !calendario}
                  />
                  <MensajeErrorCampo error={errores.materia} pulse={pulso} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="otra-carrera-paralelo">Paralelo</label>
                  <FiltroDesplegable
                    id="otra-carrera-paralelo"
                    value={form.paralelo}
                    options={opcionesParalelo}
                    onChange={(valor) => cambiarValor('paralelo', valor)}
                    ariaLabel="Paralelo"
                    permitirQuitar={false}
                    disabled={!docente}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="otra-carrera-dia">Día</label>
                  <FiltroDesplegable
                    id="otra-carrera-dia"
                    value={form.dia_semana}
                    options={opcionesDia}
                    onChange={(valor) => cambiarValor('dia_semana', valor)}
                    ariaLabel="Día"
                    permitirQuitar={false}
                    disabled={!docente}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="otra-carrera-aula">Aula</label>
                  <input
                    id="otra-carrera-aula"
                    type="text"
                    value={form.aula}
                    onChange={(evento) => cambiarValor('aula', evento.target.value)}
                    className={inputCls}
                    placeholder="Ej: B-12"
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="otra-carrera-inicio">Hora de inicio (24 h)</label>
                  <CampoHora24
                    id="otra-carrera-inicio"
                    value={form.hora_inicio}
                    onChange={(valor) => cambiarValor('hora_inicio', valor)}
                    invalido={Boolean(errores.hora_inicio)}
                    className={claseCampo('hora_inicio')}
                  />
                  <MensajeErrorCampo error={errores.hora_inicio} pulse={pulso} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="otra-carrera-fin">Hora de fin (24 h)</label>
                  <CampoHora24
                    id="otra-carrera-fin"
                    value={form.hora_fin}
                    onChange={(valor) => cambiarValor('hora_fin', valor)}
                    invalido={Boolean(errores.hora_fin)}
                    className={claseCampo('hora_fin')}
                  />
                  <MensajeErrorCampo error={errores.hora_fin} pulse={pulso} />
                </div>
              </fieldset>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={cerrarModal}
                disabled={guardando}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200 disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!docente || guardando}
                className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {guardando ? 'Asignando...' : `Asignar${horasAnuales ? ` (${horasAnuales} h/año)` : ''}`}
              </button>
            </div>
          </form>
        </ModalCentrado>
      )}

      {cargaPorQuitar && (
        <ModalConfirmar
          tono="peligro"
          etiqueta="Docentes de otra carrera"
          titulo="Quitar materia"
          mensaje={`${cargaPorQuitar.materia_nombre} (paralelo ${cargaPorQuitar.paralelo}) sale del Fondo de Tiempo de ${cargaPorQuitar.docente_nombre}.`}
          textoAccion="Quitar"
          textoTrabajando="Quitando..."
          onConfirmar={quitar}
          onCancelar={() => setCargaPorQuitar(null)}
        />
      )}
    </>
  );
};

export default AsignarMateriaOtraCarrera;
