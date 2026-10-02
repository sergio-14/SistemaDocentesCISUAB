import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { obtenerTodos } from '../apis/api';
import { ERROR_FIELD_BORDER_CLASS, MENSAJE_REVISA_CAMPOS, getApiErrorMessage } from '../utils/formErrors';
import { validarRangoHora24 } from '../utils/horas24';
import ProgramaAnaliticoAccion from './fondos/ProgramaAnaliticoAccion';
import CampoHora24 from './common/CampoHora24';
import MensajeErrorCampo from './common/MensajeErrorCampo';

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

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

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
  const claseCampo = (campo) => `${inputCls} ${errores[campo] ? ERROR_FIELD_BORDER_CLASS : ''}`;

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
    return cal ? `${cal.periodo_display} ${cal.gestion} · ${cal.carrera_nombre}` : '';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Docentes de otra carrera</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Asigne una materia de su carrera a un docente de otra carrera. La carga va a su Fondo de Tiempo en su carrera.
        </p>
      </div>

      <div className="relative">
        <label className={labelCls} htmlFor="buscar-docente-otra-carrera">Buscar docente por nombre</label>
        <input
          id="buscar-docente-otra-carrera"
          type="text"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Escriba al menos 3 letras del nombre o apellido"
          className={inputCls}
        />
        {resultados.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
            {resultados.map((resultado) => (
              <li key={resultado.id}>
                <button
                  type="button"
                  onClick={() => elegirDocente(resultado)}
                  className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-slate-800"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">{resultado.nombre_completo}</span>
                  <span className="text-slate-500 dark:text-slate-400">C.I. …{resultado.ci_ultimos || '----'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {docente && (
        <div className="space-y-5">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Docente: <span className="font-bold">{docente.nombre_completo}</span>
            <span className="text-slate-500 dark:text-slate-400"> · C.I. …{docente.ci_ultimos || '----'}</span>
          </p>

          <form onSubmit={asignar} noValidate className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="otra-carrera-calendario">Calendario</label>
              <select id="otra-carrera-calendario" value={form.calendario} onChange={cambiar('calendario')} className={claseCampo('calendario')}>
                <option value="">-- Calendario --</option>
                {calendarios.map((cal) => (
                  <option key={cal.id} value={cal.id}>{nombreCalendario(cal.id)}</option>
                ))}
              </select>
              <MensajeErrorCampo error={errores.calendario} pulse={pulso} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="otra-carrera-materia">Materia</label>
              <select id="otra-carrera-materia" value={form.materia} onChange={cambiar('materia')} className={claseCampo('materia')} disabled={!calendario}>
                <option value="">{calendario ? '-- Materia --' : 'Elija primero el calendario'}</option>
                {materias.map((m) => (
                  <option key={m.id} value={m.id}>{`${m.sigla} - ${m.nombre} (${m.horas_totales} h/sem)`}</option>
                ))}
              </select>
              <MensajeErrorCampo error={errores.materia} pulse={pulso} />
            </div>
            <div>
              <label className={labelCls} htmlFor="otra-carrera-paralelo">Paralelo</label>
              <select id="otra-carrera-paralelo" value={form.paralelo} onChange={cambiar('paralelo')} className={inputCls}>
                {PARALELOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="otra-carrera-dia">Día</label>
              <select id="otra-carrera-dia" value={form.dia_semana} onChange={cambiar('dia_semana')} className={inputCls}>
                {DIAS.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="otra-carrera-aula">Aula</label>
              <input id="otra-carrera-aula" type="text" value={form.aula} onChange={cambiar('aula')} className={inputCls} />
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
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {guardando ? 'Asignando...' : `Asignar${horasAnuales ? ` (${horasAnuales} h/año)` : ''}`}
              </button>
            </div>
          </form>

          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">Materias asignadas por su carrera</h3>
            {cargas.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no tiene materias de su carrera.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="px-2 py-1">Materia</th>
                    <th className="px-2 py-1">Calendario</th>
                    <th className="px-2 py-1">Horario</th>
                    <th className="px-2 py-1 text-right">h/año</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {cargas.map((carga) => (
                    <tr key={carga.id} className="border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      <td className="px-2 py-1">
                        {`${carga.materia_sigla} - ${carga.materia_nombre} (${carga.paralelo})`}
                        <ProgramaAnaliticoAccion
                          fondoId={carga.fondo}
                          materiaId={carga.materia}
                          calendarioId={carga.calendario}
                          url={carga.programa_analitico_url}
                          puedeSubir={['borrador', 'observado'].includes(carga.fondo_estado)}
                          onSubido={() => cargarCargas(docente.id)}
                        />
                      </td>
                      <td className="px-2 py-1">{nombreCalendario(carga.calendario)}</td>
                      <td className="px-2 py-1 capitalize">{`${carga.dia_semana} ${(carga.hora_inicio || '').slice(0, 5)}-${(carga.hora_fin || '').slice(0, 5)}`}</td>
                      <td className="px-2 py-1 text-right font-semibold">{carga.horas}</td>
                      <td className="px-2 py-1 text-right">
                        <button type="button" onClick={() => quitar(carga)} className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400">
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AsignarMateriaOtraCarrera;
