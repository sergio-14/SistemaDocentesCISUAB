import React, { useCallback, useEffect, useState } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import toast from 'react-hot-toast';
import api from '../apis/api';
import { hoyBolivia } from '../utils/fechas';
import { getApiErrorMessage } from '../utils/formErrors';

// Feriados por gestión (el año de la fecha). Solo el superusuario los carga: el fondo de
// tiempo descuenta los que caen de lunes a viernes, por la jornada diaria del docente.

const TIPOS = [
  { value: 'nacional', label: 'Nacional' },
  { value: 'departamental', label: 'Departamental' },
];
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const FORMULARIO_VACIO = { fecha: '', nombre: '', tipo: 'nacional' };

const leerUsuario = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const diaSemana = (iso) => {
  const [anio, mes, dia] = String(iso).split('-').map(Number);
  return DIAS_SEMANA[new Date(anio, mes - 1, dia).getDay()];
};

const formatoFecha = (iso) => String(iso).split('-').reverse().join('/');

const inputClase = 'w-full rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500';

const ListaFeriados = () => {
  const esSuperAdmin = leerUsuario()?.is_superuser === true;
  const [gestion, setGestion] = useState(() => Number(hoyBolivia().slice(0, 4)));
  const [feriados, setFeriados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrarId, setConfirmarBorrarId] = useState(null);

  const cargarFeriados = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get('/feriados/', { params: { gestion } });
      setFeriados(Array.isArray(data) ? data : data?.results || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los feriados.'));
      setFeriados([]);
    } finally {
      setCargando(false);
    }
  }, [gestion]);

  useEffect(() => {
    if (esSuperAdmin) cargarFeriados();
  }, [esSuperAdmin, cargarFeriados]);

  if (!esSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 p-6 text-slate-700 dark:text-slate-300">
          Solo el superusuario gestiona los feriados.
        </div>
      </div>
    );
  }

  const diasHabiles = feriados.filter((f) => f.es_habil).length;

  const cancelarEdicion = () => {
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
  };

  const editar = (feriado) => {
    setEditandoId(feriado.id);
    setFormulario({ fecha: feriado.fecha, nombre: feriado.nombre, tipo: feriado.tipo });
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!formulario.fecha || !formulario.nombre.trim()) {
      toast.error('Complete la fecha y el nombre del feriado.');
      return;
    }
    setGuardando(true);
    try {
      if (editandoId) {
        await api.patch(`/feriados/${editandoId}/`, formulario);
        toast.success('Feriado actualizado');
      } else {
        await api.post('/feriados/', formulario);
        toast.success('Feriado registrado');
      }
      const gestionFecha = Number(formulario.fecha.slice(0, 4));
      cancelarEdicion();
      // Se muestra la gestión del feriado guardado.
      if (gestionFecha !== gestion) setGestion(gestionFecha);
      else cargarFeriados();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar el feriado.'));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (id) => {
    try {
      await api.delete(`/feriados/${id}/`);
      toast.success('Feriado eliminado');
      if (editandoId === id) cancelarEdicion();
      cargarFeriados();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el feriado.'));
    } finally {
      setConfirmarBorrarId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Encabezado y gestión */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Feriados
              </h1>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                El fondo de tiempo descuenta los feriados de la gestión que caen de lunes a viernes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setGestion((g) => g - 1)} className="px-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Gestión anterior">‹</button>
              <span className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 font-bold min-w-[110px] text-center">Gestión {gestion}</span>
              <button type="button" onClick={() => setGestion((g) => g + 1)} className="px-3 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Gestión siguiente">›</button>
            </div>
          </div>
          {!cargando && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                {feriados.length} feriado{feriados.length !== 1 ? 's' : ''} cargado{feriados.length !== 1 ? 's' : ''}
              </span>
              <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                {diasHabiles} de lunes a viernes (se descuentan)
              </span>
            </div>
          )}
          {!cargando && feriados.length === 0 && (
            <p className="mt-4 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-300">
              No hay feriados cargados para esta gestión.
            </p>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={guardar} className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
            {editandoId ? 'Editar feriado' : 'Nuevo feriado'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_200px] gap-4">
            <label className="block">
              <span className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Fecha *</span>
              <input type="date" value={formulario.fecha} onChange={(e) => setFormulario((f) => ({ ...f, fecha: e.target.value }))} className={inputClase} />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Nombre *</span>
              <input type="text" maxLength={150} value={formulario.nombre} onChange={(e) => setFormulario((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Aniversario del Beni" className={inputClase} />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Tipo *</span>
              <select value={formulario.tipo} onChange={(e) => setFormulario((f) => ({ ...f, tipo: e.target.value }))} className={inputClase}>
                {TIPOS.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
              </select>
            </label>
          </div>
          {formulario.fecha && (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              {diaSemana(formulario.fecha)}
              {['Sábado', 'Domingo'].includes(diaSemana(formulario.fecha)) ? ': cae en fin de semana, no se descuenta del fondo.' : ': se descuenta del fondo.'}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-3">
            {editandoId && (
              <button type="button" onClick={cancelarEdicion} className="px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700">
                Cancelar
              </button>
            )}
            <button type="submit" disabled={guardando} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold">
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Registrar feriado'}
            </button>
          </div>
        </form>

        {/* Lista */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Día</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">Cargando feriados...</td></tr>
              )}
              {!cargando && feriados.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">Sin feriados en la gestión {gestion}.</td></tr>
              )}
              {!cargando && feriados.map((feriado) => (
                <tr key={feriado.id} className="border-t border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  <td className="px-4 py-3 font-semibold">{formatoFecha(feriado.fecha)}</td>
                  <td className="px-4 py-3">
                    {diaSemana(feriado.fecha)}
                    {!feriado.es_habil && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">(no se descuenta)</span>}
                  </td>
                  <td className="px-4 py-3">{feriado.nombre}</td>
                  <td className="px-4 py-3">{feriado.tipo_display}</td>
                  <td className="px-4 py-3">
                    {confirmarBorrarId === feriado.id ? (
                      <div className="flex justify-end items-center gap-2">
                        <span className="text-xs text-slate-600 dark:text-slate-300">¿Eliminar?</span>
                        <button type="button" onClick={() => borrar(feriado.id)} className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold">Sí</button>
                        <button type="button" onClick={() => setConfirmarBorrarId(null)} className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-xs">No</button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => editar(feriado)} className="text-blue-600 hover:text-blue-500" title="Editar"><FaEdit size={16} /></button>
                        <button type="button" onClick={() => setConfirmarBorrarId(feriado.id)} className="text-red-600 hover:text-red-500" title="Eliminar"><FaTrash size={16} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ListaFeriados;
