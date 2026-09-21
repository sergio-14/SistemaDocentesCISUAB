import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FaClipboardList, FaImage, FaTimes } from 'react-icons/fa';
import { getDetalleSeguimientoProgramaPOA } from '../../../apis/poa.api';
import { buildPoaNavigationState } from '../utils/navigationContext';
import Modal from '../components/base/Modal';

const estado = (value) => ({ completado: 'Completada', en_ejecucion: 'En ejecución', programado: 'Programada', cancelado: 'Cancelada' }[value] || value);
const formatoMonto = (value) => Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const presupuesto = (actividad) => Number(actividad.presupuesto_total || 0);

const ResumenPresupuesto = ({ actividad, completo = false }) => {
  if (!actividad.tiene_presupuesto) return <span>Sin presupuesto planificado</span>;
  return <span>{completo ? 'Total planificado: ' : ''}Bs. {formatoMonto(presupuesto(actividad))}</span>;
};

const MediosVerificacion = ({ actividad }) => {
  const medios = actividad.medios_verificacion || actividad.situacion_actual?.medios_verificacion || [];
  if (!actividad.tiene_evidencia) return <span>Sin evidencia registrada</span>;
  if (!medios.length) return <span>Evidencia registrada sin medios adjuntos</span>;

  return (
    <ul className="mt-1 space-y-1">
      {medios.map((medio, index) => {
        const destino = medio.tipo === 'link' ? medio.url : (medio.archivo_url || medio.archivo);
        const etiqueta = medio.tipo === 'link' ? `Enlace ${index + 1}` : `Archivo ${index + 1}`;
        return (
          <li key={medio.id || `${medio.tipo}-${index}`}>
            {destino ? <a href={destino} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline dark:text-sky-300">{etiqueta}</a> : etiqueta}
          </li>
        );
      })}
    </ul>
  );
};

export default function SeguimientoProgramaPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [actual, setActual] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setError('');
    getDetalleSeguimientoProgramaPOA(documentId)
      .then((response) => { if (mounted) setData(response.data); })
      .catch((requestError) => { if (mounted) setError(requestError?.response?.data?.detail || 'No se pudo cargar el seguimiento del programa.'); });
    return () => { mounted = false; };
  }, [documentId]);

  if (error) return <div className="mx-auto mt-6 max-w-[1500px] rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">{error}</div>;
  if (!data) return <div className="mx-auto mt-6 max-w-[1500px] text-slate-700">Cargando seguimiento…</div>;

  const modo = location.state?.modo || 'ejecucion';
  const abrirEvidencia = (actividad) => {
    const objetivo = data.objetivos.find((item) => item.actividades.some((candidate) => candidate.id === actividad.id));
    navigate(`/poa/actividades/${actividad.id}/evidencias`, {
      state: buildPoaNavigationState({}, {
        gestion: data.gestion, documentoId: data.id, documentoNombre: data.programa,
        objetivoId: objetivo.id, objetivoNombre: objetivo.codigo, actividadId: actividad.id,
        actividadNombre: actividad.codigo, retornoPoaPath: `/poa/seguimiento/programa/${data.id}`,
        retornoPoaMode: modo,
      }),
    });
  };

  return (
    <section className="mx-auto w-full max-w-[1500px] pb-8">
      <header className="rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs text-slate-600 dark:text-slate-300">GESTIÓN {data.gestion}</p>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{data.programa}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Actividades organizadas por Objetivo Específico.</p>
      </header>

      <div className="mt-4 space-y-4">
        {data.objetivos.map((objetivo, index) => (
          <section key={objetivo.id} className="overflow-hidden rounded-2xl border bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white"><span className="mr-2 text-sm text-[#365d7d]">{objetivo.codigo || `OE-${index + 1}`}</span>{objetivo.descripcion}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr><th className="text-left">Actividad</th><th className="text-left">Periodo</th><th className="text-left">Producto esperado</th><th className="text-left">Presupuesto planificado</th><th aria-label="Acciones" /></tr></thead>
                <tbody>{objetivo.actividades.map((actividad) => (
                  <tr key={actividad.id}>
                    <td><b>{actividad.codigo} · {actividad.nombre}</b><small className="block text-slate-500">{estado(actividad.estado)} · {actividad.avance}%</small></td>
                    <td>{actividad.mes_inicio || '—'} a {actividad.mes_fin || '—'}</td>
                    <td>{actividad.productos_esperados || 'Sin registrar'}</td>
                    <td><ResumenPresupuesto actividad={actividad} /></td>
                    <td><button onClick={() => setActual(actividad)} className="rounded-lg border px-3 py-2 text-xs font-bold"><FaClipboardList className="mr-1 inline" />Ver</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      {actual && (
        <Modal onClose={() => setActual(null)}>
          <section className="modal-panel">
            <div className="modal-header flex justify-between p-5"><div><small>{actual.codigo}</small><h3>{actual.nombre}</h3></div><button type="button" onClick={() => setActual(null)} aria-label="Cerrar"><FaTimes /></button></div>
            <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
              <p><b>Estado y avance</b><br />{estado(actual.estado)} · {actual.avance}%</p>
              <p><b>Responsable y periodo</b><br />{actual.responsable} · {actual.mes_inicio} a {actual.mes_fin}</p>
              <p><b>Productos esperados</b><br />{actual.productos_esperados || 'Sin registrar'}</p>
              <div><b>Medios de verificación</b><br /><MediosVerificacion actividad={actual} /></div>
              <p><b>Indicador</b><br />{actual.indicador_descripcion || 'Sin registrar'} · Meta: {actual.indicador_meta}</p>
              <p><b>Presupuesto</b><br /><ResumenPresupuesto actividad={actual} completo /></p>
              {actual.tiene_evidencia && <p><b>Ejecución física</b><br />Programado: {actual.situacion_actual?.programado ?? 0} · Ejecutado: {actual.situacion_actual?.ejecutado ?? 0}</p>}
              {actual.tiene_evidencia && <p><b>Resultados logrados</b><br />{actual.situacion_actual?.resultados_logrados || 'Sin registrar'}</p>}
            </div>
            <footer className="modal-actions flex justify-end gap-2 p-4"><button className="btn-cancel rounded px-3 py-2" onClick={() => setActual(null)}>Cerrar</button><button className="btn-primary rounded px-3 py-2" onClick={() => abrirEvidencia(actual)}><FaImage className="mr-1 inline" />{actual.tiene_evidencia ? 'Ver evidencia' : 'Registrar evidencia'}</button></footer>
          </section>
        </Modal>
      )}
    </section>
  );
}
