import React, { useEffect, useState } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';
import { createActividad, updateActividad, searchIndicadoresCatalogo } from '../../../apis/poa.api';
import { Input, Textarea, Select, Modal } from './base';
import { buildClientErrorMessages, formatApiErrors, mapApiErrorsToFieldErrors, ModalErrorAlert } from './formErrorUtils';
import toast from 'react-hot-toast';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CAMPOS_OBLIGATORIOS = ['codigo', 'nombre', 'responsable', 'productos_esperados', 'mes_inicio', 'mes_fin', 'indicador_unidad', 'indicador_linea_base', 'indicador_meta'];
const FORM_INICIAL = { codigo: '', nombre: '', responsable: '', productos_esperados: '', indicador_descripcion: '', indicador_unidad: 'numero', indicador_linea_base: '', indicador_meta: '', mes_inicio: 'enero', mes_fin: 'diciembre', riesgo_previsto: '' };

export default function NuevaActividadModal({ onClose, onCreated, onUpdated, objetivoId, actividad }) {
  const [form, setForm] = useState(FORM_INICIAL);
  const [indicadores, setIndicadores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessages, setErrorMessages] = useState([]);

  useEffect(() => {
    setForm(actividad ? { ...FORM_INICIAL, ...actividad, indicador_descripcion: actividad.indicador_descripcion || '' } : FORM_INICIAL);
    setFieldErrors({}); setErrorMessages([]);
  }, [actividad]);

  useEffect(() => {
    const query = String(form.indicador_descripcion || '').trim();
    if (query.length < 2) { setIndicadores([]); return; }
    searchIndicadoresCatalogo(query).then((response) => setIndicadores(response.data?.results || response.data || [])).catch(() => setIndicadores([]));
  }, [form.indicador_descripcion]);

  const focusFirstError = (errors) => {
    const field = Object.keys(errors || {})[0];
    if (field) requestAnimationFrame(() => document.querySelector(`[name="${field}"]`)?.focus());
  };
  const cambiar = (campo, valor) => {
    setForm((current) => ({ ...current, [campo]: valor }));
    if (fieldErrors[campo]) setFieldErrors((current) => ({ ...current, [campo]: '' }));
  };
  const validar = () => {
    const errors = {};
    CAMPOS_OBLIGATORIOS.forEach((campo) => {
      if (form[campo] === null || form[campo] === undefined || String(form[campo]).trim() === '') errors[campo] = 'Este campo es obligatorio.';
    });
    if (!objetivoId || Number.isNaN(Number(objetivoId))) errors.objetivo_id = 'No se pudo identificar el objetivo de la actividad.';
    if (!errors.mes_inicio && !errors.mes_fin && MESES.indexOf(form.mes_inicio) > MESES.indexOf(form.mes_fin)) errors.mes_fin = 'El mes final no puede ser anterior al mes inicial.';
    ['indicador_linea_base', 'indicador_meta'].forEach((campo) => {
      if (!errors[campo] && (!Number.isInteger(Number(form[campo])) || Number(form[campo]) < 0)) errors[campo] = 'Ingrese un número entero igual o mayor a cero.';
      if (!errors[campo] && form.indicador_unidad === 'porcentaje' && Number(form[campo]) > 100) errors[campo] = 'Cuando la unidad es porcentaje, el valor debe estar entre 0 y 100.';
    });
    return errors;
  };

  const guardar = async (event) => {
    event.preventDefault(); setErrorMessages([]);
    const clientErrors = validar();
    if (Object.keys(clientErrors).length) { setFieldErrors(clientErrors); setErrorMessages(buildClientErrorMessages(clientErrors)); focusFirstError(clientErrors); return; }
    setGuardando(true);
    try {
      const payload = { ...form, objetivo_id: Number(objetivoId), indicador_linea_base: Number(form.indicador_linea_base), indicador_meta: Number(form.indicador_meta) };
      const respuesta = actividad?.id ? await updateActividad(actividad.id, payload) : await createActividad(payload);
      toast.success(respuesta.data?.message || (actividad?.id ? 'Actividad actualizada correctamente.' : 'Actividad creada correctamente.'));
      (actividad?.id ? onUpdated : onCreated)?.(respuesta.data); onClose?.();
    } catch (error) {
      const data = error?.response?.data;
      const errors = mapApiErrorsToFieldErrors(data || {});
      setFieldErrors(errors); setErrorMessages(formatApiErrors(data || error?.message || 'No se pudo guardar la actividad.')); focusFirstError(errors);
    } finally { setGuardando(false); }
  };

  return <Modal onClose={onClose}><div className="modal-panel w-full max-w-3xl"><div className="modal-header flex items-center justify-between"><div><p className="text-xs">Actividad</p><h3>{actividad?.id ? 'Editar actividad' : 'Nueva actividad'}</h3></div><button type="button" onClick={onClose} aria-label="Cerrar"><FaTimes /></button></div><form onSubmit={guardar} className="space-y-4 p-5" noValidate><ModalErrorAlert title="Revise los campos marcados:" messages={errorMessages} /><div className="grid gap-3 md:grid-cols-3"><Input label="Código" name="codigo" required value={form.codigo} error={fieldErrors.codigo} onChange={(e) => cambiar('codigo', e.target.value)} /><div className="md:col-span-2"><Input label="Nombre de la actividad" name="nombre" required value={form.nombre} error={fieldErrors.nombre} onChange={(e) => cambiar('nombre', e.target.value)} /></div><div className="md:col-span-3"><Input label="Responsable" name="responsable" required value={form.responsable} error={fieldErrors.responsable} onChange={(e) => cambiar('responsable', e.target.value)} /></div><div className="md:col-span-3"><Textarea label="Productos esperados" name="productos_esperados" required rows={3} value={form.productos_esperados} error={fieldErrors.productos_esperados} onChange={(e) => cambiar('productos_esperados', e.target.value)} /></div></div><div className="grid gap-3 md:grid-cols-3"><div className="md:col-span-2"><Input label="Indicador" name="indicador_descripcion" list="indicadores-poa" value={form.indicador_descripcion} error={fieldErrors.indicador_descripcion} onChange={(e) => cambiar('indicador_descripcion', e.target.value)} helperText="Opcional según las reglas actuales." /><datalist id="indicadores-poa">{indicadores.map((item) => <option key={item.id || item.descripcion || item.indicador} value={item.descripcion || item.nombre || item.indicador} />)}</datalist></div><Select label="Unidad" name="indicador_unidad" required value={form.indicador_unidad} error={fieldErrors.indicador_unidad} onChange={(e) => cambiar('indicador_unidad', e.target.value)}><option value="numero">Número</option><option value="porcentaje">Porcentaje</option></Select><Input label="Línea base" name="indicador_linea_base" required type="number" min="0" max={form.indicador_unidad === 'porcentaje' ? 100 : undefined} value={form.indicador_linea_base} error={fieldErrors.indicador_linea_base} onChange={(e) => cambiar('indicador_linea_base', e.target.value)} /><Input label="Meta" name="indicador_meta" required type="number" min="0" max={form.indicador_unidad === 'porcentaje' ? 100 : undefined} value={form.indicador_meta} error={fieldErrors.indicador_meta} onChange={(e) => cambiar('indicador_meta', e.target.value)} /><Select label="Mes inicio" name="mes_inicio" required value={form.mes_inicio} error={fieldErrors.mes_inicio} onChange={(e) => { cambiar('mes_inicio', e.target.value); if (MESES.indexOf(e.target.value) > MESES.indexOf(form.mes_fin)) cambiar('mes_fin', e.target.value); }}>{MESES.map((mes) => <option key={mes} value={mes}>{mes[0].toUpperCase() + mes.slice(1)}</option>)}</Select><Select label="Mes fin" name="mes_fin" required value={form.mes_fin} error={fieldErrors.mes_fin} onChange={(e) => cambiar('mes_fin', e.target.value)}>{MESES.map((mes) => <option key={mes} value={mes} disabled={MESES.indexOf(mes) < MESES.indexOf(form.mes_inicio)}>{mes[0].toUpperCase() + mes.slice(1)}</option>)}</Select></div><Textarea label="Riesgo previsto y medida de respuesta" name="riesgo_previsto" rows={2} value={form.riesgo_previsto} error={fieldErrors.riesgo_previsto} onChange={(e) => cambiar('riesgo_previsto', e.target.value)} placeholder="Opcional: riesgo y cómo se atenderá." /><div className="modal-actions flex justify-end gap-2"><button type="button" className="btn-cancel rounded px-3 py-2" onClick={onClose}>Cancelar</button><button disabled={guardando} className="btn-primary rounded px-3 py-2"><FaSave className="mr-1 inline" />{guardando ? 'Guardando…' : 'Guardar actividad'}</button></div></form></div></Modal>;
}
