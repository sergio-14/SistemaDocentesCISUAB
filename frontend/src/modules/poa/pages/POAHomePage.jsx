import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaArrowRight,
  FaCalendarAlt,
  FaChartLine,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaFileAlt,
  FaImage,
  FaMoneyBillWave,
} from 'react-icons/fa';
import { getBandejaSeguimientoPOA, getTableroPOA } from '../../../apis/poa.api';

const money = (value) => `Bs. ${Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
const estados = {
  elaboracion: 'En elaboración',
  revision: 'En revisión',
  observado: 'Observados',
  aprobado: 'Aprobados',
  ejecucion: 'En ejecución',
};

function Kpi({ label, value, Icon, tone = 'blue' }) {
  return (
    <article className={`poa-kpi poa-kpi-${tone}`}>
      <div className="poa-kpi-topline">
        <span className="poa-kpi-label">{label}</span>
        <span className="poa-kpi-icon" aria-hidden="true"><Icon /></span>
      </div>
      <strong className="poa-kpi-value">{value}</strong>
    </article>
  );
}

function ProgressBar({ value, label }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className="poa-progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
    >
      <span className="poa-progress-value" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export default function POAHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [modo, setModo] = useState(() => location.state?.modo || 'ejecucion');
  const [data, setData] = useState(null);
  const [tablero, setTablero] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (location.state?.modo) setModo(location.state.modo);
  }, [location.state?.modo]);

  useEffect(() => {
    const gestion = new Date().getFullYear();
    setData(null);
    setTablero(null);
    setError('');
    Promise.all([
      getBandejaSeguimientoPOA({ gestion, modo }),
      getTableroPOA({ gestion }),
    ])
      .then(([bandeja, resumen]) => {
        setData(bandeja.data);
        setTablero(resumen.data);
      })
      .catch(() => setError('No se pudo cargar el tablero de trabajo.'));
  }, [modo]);

  if (error) {
    return <div className="poa-page-message poa-page-message-error" role="alert">{error}</div>;
  }

  if (!data || !tablero) {
    return <div className="poa-page-message" role="status" aria-live="polite">Cargando tablero de trabajo…</div>;
  }

  const resumen = data.resumen || {};
  const estadosDocumento = tablero.estados_documento || {};
  const agenda = tablero.agenda_mensual || {};
  const presupuesto = tablero.presupuesto || {};
  const programas = Array.isArray(data.programas) ? data.programas : [];
  const avanceFisico = Number(resumen.avance_fisico || 0);
  const avanceFinanciero = Number(presupuesto.planificado)
    ? Math.round(Number(presupuesto.comprometido || 0) / Number(presupuesto.planificado) * 100)
    : 0;

  const kpis = modo === 'ejecucion'
    ? [
      ['Programas activos', resumen.documentos, FaFileAlt, 'blue'],
      ['Actividades activas', resumen.actividades, FaClipboardCheck, 'indigo'],
      ['Avance físico', `${avanceFisico}%`, FaChartLine, 'green'],
      ['Sin evidencia', Math.max(0, resumen.actividades - resumen.con_evidencia), FaImage, 'amber'],
    ]
    : [
      ['En elaboración', estadosDocumento.elaboracion || 0, FaFileAlt, 'blue'],
      ['En revisión', estadosDocumento.revision || 0, FaClipboardCheck, 'indigo'],
      ['Observados', estadosDocumento.observado || 0, FaExclamationTriangle, 'amber'],
      ['Aprobados', estadosDocumento.aprobado || 0, FaChartLine, 'green'],
    ];

  const abrirAlerta = (alerta) => {
    if (alerta.accion === 'ver_materiales') {
      navigate('/poa/consolidado-requerimientos', { state: { materialTab: 'entregas' } });
    } else if (alerta.referencia?.documento_id) {
      navigate(`/poa/seguimiento/programa/${alerta.referencia.documento_id}`, { state: { modo: 'ejecucion' } });
    }
  };

  const porcentajeFinanciero = Math.max(0, Math.min(100, avanceFinanciero));

  return (
    <section className="poa-dashboard">
      <header className="poa-dashboard-intro">
        <div className="poa-dashboard-heading">
          <p className="poa-eyebrow">Gestión POA · {data.gestion}</p>
          <h2>Bandeja de trabajo</h2>
          <p>Revise la preparación documental, la ejecución de actividades y los materiales de su carrera.</p>
        </div>
        <div className="poa-budget-summary">
          <span>Presupuesto comprometido</span>
          <strong>{money(presupuesto.comprometido)}</strong>
          <small>de {money(presupuesto.planificado)} planificados</small>
        </div>
        <div className="poa-dashboard-tabs" role="group" aria-label="Vista del tablero">
          <button type="button" onClick={() => setModo('ejecucion')} aria-pressed={modo === 'ejecucion'}>
            Ejecución
          </button>
          <button type="button" onClick={() => setModo('planificado')} aria-pressed={modo === 'planificado'}>
            Planificación
          </button>
        </div>
      </header>

      <div className="poa-kpi-grid">
        {kpis.map(([label, value, Icon, tone]) => (
          <Kpi key={label} label={label} value={value ?? 0} Icon={Icon} tone={tone} />
        ))}
      </div>

      <div className="poa-dashboard-grid">
        <section className="poa-panel poa-worklist">
          <header className="poa-panel-heading">
            <div>
              <h3>{modo === 'ejecucion' ? 'Programas en ejecución' : 'Documentos en planificación'}</h3>
              <p>Abra un programa para acceder a sus objetivos, actividades y evidencias.</p>
            </div>
            <span className="poa-count-badge">{programas.length} documentos</span>
          </header>

          <div className="poa-program-list">
            {programas.map((programa) => (
              <Link
                key={programa.id}
                to={`/poa/seguimiento/programa/${programa.id}`}
                state={{ modo }}
                className="poa-program-link"
              >
                <span className="poa-program-copy">
                  <strong>{programa.programa}</strong>
                  <small>
                    {modo === 'planificado'
                      ? estados[programa.estado_documento]
                      : `${programa.en_ejecucion} en ejecución · ${programa.completadas}/${programa.total_actividades} completadas`}
                  </small>
                  {modo === 'ejecucion' && <ProgressBar value={programa.avance_porcentaje} label={`Avance de ${programa.programa}`} />}
                </span>
                <FaArrowRight className="poa-program-arrow" aria-hidden="true" />
              </Link>
            ))}
            {programas.length === 0 && (
              <p className="poa-empty-state">No hay documentos para esta vista.</p>
            )}
          </div>
        </section>

        <aside className="poa-dashboard-aside">
          <section className="poa-panel">
            <header className="poa-panel-heading poa-panel-heading-compact">
              <h3><FaCalendarAlt aria-hidden="true" /> Agenda de {agenda.mes || 'este mes'}</h3>
            </header>
            <div className="poa-agenda-grid">
              <p>Programadas<strong>{agenda.programadas || 0}</strong></p>
              <p>En curso<strong>{agenda.en_ejecucion || 0}</strong></p>
              <p>Completadas<strong>{agenda.completadas || 0}</strong></p>
              <p>Retrasadas<strong>{agenda.retrasadas || 0}</strong></p>
            </div>
          </section>

          <section className="poa-panel">
            <header className="poa-panel-heading poa-panel-heading-compact">
              <h3><FaExclamationTriangle aria-hidden="true" /> Trabajo prioritario</h3>
            </header>
            <div className="poa-alert-list">
              {tablero.alertas?.length
                ? tablero.alertas.map((alerta, index) => (
                  <button key={`${alerta.mensaje}-${index}`} type="button" onClick={() => abrirAlerta(alerta)}>
                    {alerta.mensaje}
                  </button>
                ))
                : <p className="poa-success-state">No hay acciones pendientes.</p>}
            </div>
          </section>

          <section className="poa-panel poa-finance-panel">
            <header className="poa-panel-heading poa-panel-heading-compact">
              <h3><FaMoneyBillWave aria-hidden="true" /> Ejecución presupuestaria</h3>
            </header>
            <p className="poa-finance-progress-label">Comprometido <strong>{porcentajeFinanciero}%</strong></p>
            <ProgressBar value={porcentajeFinanciero} label="Presupuesto comprometido" />
            <dl className="poa-finance-details">
              <div><dt>Recibido</dt><dd>{money(presupuesto.recibido)}</dd></div>
              <div><dt>Entregado</dt><dd>{money(presupuesto.entregado)}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </section>
  );
}
