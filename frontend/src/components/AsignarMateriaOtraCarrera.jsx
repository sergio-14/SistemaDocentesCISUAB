import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { obtenerTodos } from '../apis/api';
import { MENSAJE_REVISA_CAMPOS, getApiErrorMessage } from '../utils/formErrors';
import { validarRangoHora24 } from '../utils/horas24';
import ProgramaAnaliticoAccion from './fondos/ProgramaAnaliticoAccion';
import CampoHora24 from './common/CampoHora24';
import MensajeErrorCampo from './common/MensajeErrorCampo';
import FiltroDesplegable from './common/FiltroDesplegable';
import { BLOQUE, BOTON, BOTON_CHICO } from './fondos/estilosFondo';
import { Avatar } from './fondos/ElementosFondo';

// Doble carrera: el Jefe de Estudios asigna una materia de SU carrera a un docente de otra.
// La carga va al Fondo de Tiempo del docente en su carrera, que este Jefe no ve: aquí solo
// se ven y se quitan las materias que asignó su carrera.

const PARALELOS = ['A', 'B', 'C', 'D', 'E', 'F'];
const DIAS = [
  ['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'],
  ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'],
];
const FORM_VACIO = {
  calendario: '', materia: '', paralelo: 'A', dia_semana: 'lunes', hora_inicio: '', hora_fin: '', aula: '',
};

// Campos con el estilo del módulo (píldora azulada, etiqueta chica arriba).
const inputCls = 'w-full h-11 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100';
const labelCls = 'mb-1.5 pl-1 block text-xs font-semibold text-slate-700';

const AsignarMateriaOtraCarrera = () => {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [docente, setDocente] = useState(null);
  const [calendarios, setCalendarios] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [pulso, setPulso] = useState(0);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    obtenerTodos('/calendarios/')
      .then(setCalendarios)
      .catch((error) => toast.error(getApiErrorMessage(error, 'No se pudieron cargar los calendarios')));
  }, []);

  // Búsqueda por nombre (mínimo 3 letras), con una pausa para no consultar en cada tecla.
  useEffect(() => {
    if (busqueda.trim().length < 3) {
      setResultados([]);
      return undefined;
    }
    const temporizador = setTimeout(() => {
      api.get('/docentes/buscar/', { params: { q: busqueda.trim() } })
        .then((respuesta) => setResultados(respuesta.data))
        .catch((error) => toast.error(getApiErrorMessage(error, 'No se pudo buscar docentes')));
    }, 300);
    return () => clearTimeout(temporizador);
  }, [busqueda]);

  const calendario = calendarios.find((cal) => String(cal.id) === String(form.calendario));

  useEffect(() => {
    setMaterias([]);
    if (!calendario) return;
    obtenerTodos('/materias/', { carrera: calendario.carrera, activo: true })
      .then(setMaterias)
      .catch((error) => toast.error(getApiErrorMessage(error, 'No se pudieron cargar las materias')));
  }, [calendario]);

  const cargarCargas = (docenteId) => {
    obtenerTodos('/cargas-horarias/', { docente: docenteId })
      // Solo las materias de los calendarios de su carrera (no el resto del fondo del docente).
      .then((todas) => setCargas(todas.filter((carga) => calendarios.some((cal) => cal.id === carga.calendario))))
      .catch((error) => toast.error(getApiErrorMessage(error, 'No se pudieron cargar las materias asignadas')));
  };

  const elegirDocente = (elegido) => {
    setDocente(elegido);
    setResultados([]);
    setBusqueda('');
    setForm(FORM_VACIO);
    setErrores({});
    cargarCargas(elegido.id);
  };

  const cambiarValor = (campo, valor) => {
    setForm((previo) => ({ ...previo, [campo]: valor, ...(campo === 'calendario' ? { materia: '' } : {}) }));
    setErrores((previos) => ({ ...previos, [campo]: undefined }));
  };
  const cambiar = (campo) => (evento) => cambiarValor(campo, evento.target.value);
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
      toast.success('Materia asignada al Fondo de Tiempo del docente');
      setForm({ ...FORM_VACIO, calendario: form.calendario });
      cargarCargas(docente.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo asignar la materia'));
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (carga) => {
    if (!window.confirm(`¿Quitar ${carga.materia_nombre} (paralelo ${carga.paralelo})?`)) return;
    try {
      await api.delete(`/cargas-horarias/${carga.id}/`);
      toast.success('Materia quitada');
      cargarCargas(docente.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo quitar la materia'));
    }
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
  const gestionesSinFondo = (persona) => gestionesCarrera.filter(
    (gestion) => !(persona?.gestiones_con_fondo || []).includes(gestion),
  );
  const avisoSinFondo = (persona) => gestionesSinFondo(persona).map((gestion) => (
    <span key={gestion} className="whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-900 ring-1 ring-inset ring-sky-200">
      Sin fondo {gestion}
    </span>
  ));
  const opcionesMateria = materias.map((m) => ({ value: String(m.id), label: `${m.sigla} - ${m.nombre} (${m.horas_totales} h/sem)` }));
  const opcionesParalelo = PARALELOS.map((p) => ({ value: p, label: `Paralelo ${p}` }));
  const opcionesDia = DIAS.map(([valor, etiqueta]) => ({ value: valor, label: etiqueta }));

  return (
    <div className={`${BLOQUE} p-5 sm:p-6`}>
      {/* Plegada por defecto: es una tarea aparte de la carga de los docentes de la carrera. */}
      <button
        type="button"
        onClick={() => setAbierta((prev) => !prev)}
        aria-expanded={abierta}
        className="w-full flex items-center justify-between gap-4 text-left"
      >
        <span className="min-w-0">
          <span className="block text-base font-bold text-blue-900">Docentes de otra carrera</span>
          <span className="mt-0.5 block text-sm text-slate-600">
            Asigne una materia de su carrera a un docente de otra carrera. La carga va a su Fondo de Tiempo en su carrera.
          </span>
        </span>
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-azulado-100 text-blue-900 ring-1 ring-inset ring-azulado-300">
          <svg className={`w-4 h-4 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {abierta && (
        <div className="animate-campo-entrada mt-5 pt-5 space-y-5 [border-top:1px_solid_#B8C9E1]">
          <div className="relative max-w-xl">
            <label className={labelCls} htmlFor="buscar-docente-otra-carrera">Buscar docente por nombre</label>
            <label className="flex items-center gap-2 h-11 px-4 rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300 focus-within:ring-2 focus-within:ring-blue-900/40">
              <svg className="w-[18px] h-[18px] text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                id="buscar-docente-otra-carrera"
                type="text"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Escriba al menos 3 letras del nombre o apellido"
                className="w-full text-sm text-slate-800 placeholder:text-slate-500 outline-none"
                style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
              />
            </label>
            {resultados.length > 0 && (
              <ul className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border-2 border-[#3A56AF] bg-white p-2 shadow-xl">
                {resultados.map((resultado) => (
                  <li key={resultado.id}>
                    <button
                      type="button"
                      onClick={() => elegirDocente(resultado)}
                      className="flex w-full justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#2C4AAE] hover:text-white"
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-medium">{resultado.nombre_completo}</span>
                        {avisoSinFondo(resultado)}
                      </span>
                      <span className="opacity-70 tabular-nums whitespace-nowrap">C.I. …{resultado.ci_ultimos || '----'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {docente && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 px-4 py-3">
                <Avatar nombre={docente.nombre_completo} size="w-10 h-10 text-sm" />
                <div className="min-w-0">
                  <p className="font-bold text-blue-900 truncate">{docente.nombre_completo}</p>
                  <p className="text-xs text-slate-600 tabular-nums">C.I. …{docente.ci_ultimos || '----'}</p>
                </div>
                {avisoSinFondo(docente)}
              </div>

              <form onSubmit={asignar} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                    disabled={!calendario}
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
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="otra-carrera-aula">Aula</label>
                  <input id="otra-carrera-aula" type="text" value={form.aula} onChange={cambiar('aula')} className={inputCls} placeholder="Ej: B-12" />
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
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={guardando}
                    className={`${BOTON} w-full h-11 bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-60`}
                  >
                    {guardando ? 'Asignando...' : `Asignar${horasAnuales ? ` (${horasAnuales} h/año)` : ''}`}
                  </button>
                </div>
              </form>

              <div>
                <h3 className="mb-2 text-sm font-bold text-blue-900">Materias asignadas por su carrera</h3>
                {cargas.length === 0 ? (
                  <p className="rounded-2xl bg-azulado-100 px-4 py-6 text-center text-sm text-slate-600">
                    Todavía no tiene materias de su carrera.
                  </p>
                ) : (
                  // Cuadrícula en vez de <table>: el CSS del módulo POA da estilo a todas las tablas.
                  <div className="rounded-2xl bg-white ring-1 ring-azulado-300 overflow-hidden">
                    <div className="hidden lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_5rem_6rem] gap-4 bg-azulado-50 px-4 py-2.5 text-xs font-semibold text-blue-800 [border-bottom:1px_solid_#D2DDEE]">
                      <span>Materia</span>
                      <span>Calendario</span>
                      <span>Horario</span>
                      <span className="text-right">h/año</span>
                      <span />
                    </div>
                    <div className="divide-y divide-azulado-200">
                      {cargas.map((carga) => (
                        <div key={carga.id} className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_5rem_6rem] items-center gap-x-4 gap-y-1.5 px-4 py-3 text-tabla text-slate-700 hover:bg-azulado-50">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800">{`${carga.materia_sigla} - ${carga.materia_nombre} (${carga.paralelo})`}</div>
                            <ProgramaAnaliticoAccion
                              fondoId={carga.fondo}
                              materiaId={carga.materia}
                              calendarioId={carga.calendario}
                              url={carga.programa_analitico_url}
                              puedeSubir={['borrador', 'observado'].includes(carga.fondo_estado)}
                              onSubido={() => cargarCargas(docente.id)}
                            />
                          </div>
                          <div className="min-w-0 truncate">{nombreCalendario(carga.calendario)}</div>
                          <div className="capitalize tabular-nums">{`${carga.dia_semana} ${(carga.hora_inicio || '').slice(0, 5)}-${(carga.hora_fin || '').slice(0, 5)}`}</div>
                          <div className="lg:text-right font-bold text-blue-900 tabular-nums">{carga.horas}</div>
                          <div className="lg:text-right">
                            {/* Solo con el fondo en borrador u observado (como el backend). */}
                            <button
                              type="button"
                              onClick={() => quitar(carga)}
                              disabled={!['borrador', 'observado'].includes(carga.fondo_estado)}
                              title={['borrador', 'observado'].includes(carga.fondo_estado)
                                ? undefined
                                : 'El fondo ya fue presentado: la materia no se puede quitar.'}
                              className={`${BOTON_CHICO} bg-red-400 hover:bg-red-500 text-white disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed`}
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AsignarMateriaOtraCarrera;
