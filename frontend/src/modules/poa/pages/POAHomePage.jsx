import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  FaArrowRight,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaMoneyBillWave,
} from 'react-icons/fa';
import { getBandejaSeguimientoPOA, getTableroPOA } from '../../../apis/poa.api';
import DirectorDashboardPage from './director/DirectorDashboardPage';
import './POAHomePage.css';

const money = (value) => `Bs. ${Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
const estados = {
  elaboracion: 'En elaboración',
  revision: 'En revisión',
  observado: 'Observados',
  aprobado: 'Aprobados',
  ejecucion: 'En ejecución',
};

function Kpi({ label, value, tone = 'default' }) {
  return (
    <article className={`poa-dashboard__kpi poa-dashboard__kpi--${tone}`}>
      <p className="poa-dashboard__kpi-label">{label}</p>
      <p className="poa-dashboard__kpi-value">{value}</p>
    </article>
  );
}

function ElaboradorHomeDashboard() {
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
    return (
      <div className="poa-dashboard__message poa-dashboard__message--error" role="alert">
        {error}
      </div>
    );
  }

  if (!data || !tablero) {
    return <div className="poa-dashboard__message" role="status">Cargando tablero de trabajo…</div>;
  }

  const resumen = data.resumen || {};
  const estadosDocumento = tablero.estados_documento || {};
  const agenda = tablero.agenda_mensual || {};
  const presupuesto = tablero.presupuesto || {};
  const avanceFisico = Number(resumen.avance_fisico || 0);
  const avanceFinanciero = Number(presupuesto.planificado)
    ? Math.round(Number(presupuesto.comprometido || 0) / Number(presupuesto.planificado) * 100)
    : 0;
  const kpis = modo === 'ejecucion'
    ? [
        { label: 'Programas activos', value: resumen.documentos },
        { label: 'Actividades activas', value: resumen.actividades },
        { label: 'Avance físico', value: `${avanceFisico}%`, tone: 'positive' },
        { label: 'Sin evidencia', value: Math.max(0, resumen.actividades - resumen.con_evidencia), tone: 'attention' },
      ]
    : [
        { label: 'En elaboración', value: estadosDocumento.elaboracion || 0 },
        { label: 'En revisión', value: estadosDocumento.revision || 0 },
        { label: 'Observados', value: estadosDocumento.observado || 0, tone: 'attention' },
        { label: 'Aprobados', value: estadosDocumento.aprobado || 0, tone: 'positive' },
      ];

  const abrirAlerta = (alerta) => {
    if (alerta.accion === 'ver_materiales') {
      navigate('/poa/consolidado-requerimientos', { state: { materialTab: 'entregas' } });
    } else if (alerta.referencia?.documento_id) {
      navigate(`/poa/seguimiento/programa/${alerta.referencia.documento_id}`, {
        state: { modo: 'ejecucion' },
      });
    }
  };

  const abrirSeguimiento = (documento) => {
    navigate(`/poa/seguimiento/programa/${documento.id}`, {
      state: { modo: 'ejecucion', gestion },
    });
  };

  return (
    <section className="poa-dashboard" aria-labelledby="poa-dashboard-title">
      <header className="poa-dashboard__overview">
        <div className="poa-dashboard__title-block">
          <p className="poa-dashboard__eyebrow">Gestión POA · {data.gestion}</p>
          <h1 id="poa-dashboard-title">Bandeja de trabajo</h1>
          <p className="poa-dashboard__intro">
            Controle la preparación documental, la ejecución de actividades y los materiales de su carrera.
          </p>
        </div>

        <nav className="poa-dashboard__tabs" aria-label="Vista del tablero">
          <button
            type="button"
            aria-pressed={modo === 'ejecucion'}
            className={modo === 'ejecucion' ? 'is-active' : ''}
            onClick={() => setModo('ejecucion')}
          >
            Ejecución
          </button>
          <button
            type="button"
            aria-pressed={modo === 'planificado'}
            className={modo === 'planificado' ? 'is-active' : ''}
            onClick={() => setModo('planificado')}
          >
            Planificación
          </button>
        </nav>
      </header>

      <div className="poa-dashboard__kpis" aria-label="Indicadores del tablero">
        {kpis.map((kpi) => <Kpi key={kpi.label} {...kpi} />)}
      </div>

      <div className="poa-dashboard__content">
        <section className="poa-dashboard__panel poa-dashboard__programs">
          <div className="poa-dashboard__panel-heading">
            <div>
              <h2>{modo === 'ejecucion' ? 'Programas en ejecución' : 'Documentos en planificación'}</h2>
              <p>Abra un programa para acceder a sus objetivos, actividades y evidencias.</p>
            </div>
            <span className="poa-dashboard__document-count">{data.programas.length} documentos</span>
          </div>

          <div className="poa-dashboard__program-list">
            {data.programas.map((programa) => {
              const porcentaje = Math.min(100, Math.max(0, Number(programa.avance_porcentaje || 0)));

              return (
                <button
                  type="button"
                  key={programa.id}
                  className="poa-dashboard__program"
                  onClick={() => navigate(`/poa/seguimiento/programa/${programa.id}`, { state: { modo } })}
                >
                  <span className="poa-dashboard__program-main">
                    <span className="poa-dashboard__program-name">{programa.programa}</span>
                    <span className="poa-dashboard__program-meta">
                      {modo === 'planificado'
                        ? estados[programa.estado_documento]
                        : `${programa.en_ejecucion} en ejecución · ${programa.completadas}/${programa.total_actividades} completadas`}
                    </span>
                  </span>
                  <FaArrowRight className="poa-dashboard__program-arrow" aria-hidden="true" />
                  {modo === 'ejecucion' && (
                    <span className="poa-dashboard__program-progress">
                      <span
                        className="poa-dashboard__progress"
                        role="progressbar"
                        aria-label={`Avance de ${programa.programa}`}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={porcentaje}
                      >
                        <span style={{ width: `${porcentaje}%` }} />
                      </span>
                      <span className="poa-dashboard__program-percent">{porcentaje}%</span>
                    </span>
                  )}
                </button>
              );
            })}
            {!data.programas.length && (
              <p className="poa-dashboard__empty">No hay documentos para esta vista.</p>
            )}
          </div>
        </section>

        <aside className="poa-dashboard__aside">
          <section className="poa-dashboard__panel">
            <div className="poa-dashboard__panel-heading poa-dashboard__panel-heading--compact">
              <h2><FaCalendarAlt aria-hidden="true" /> Agenda de {agenda.mes || 'este mes'}</h2>
            </div>
            <div className="poa-dashboard__agenda">
              <p>Programadas <b>{agenda.programadas || 0}</b></p>
              <p>En curso <b>{agenda.en_ejecucion || 0}</b></p>
              <p>Completadas <b>{agenda.completadas || 0}</b></p>
              <p>Retrasadas <b>{agenda.retrasadas || 0}</b></p>
            </div>
          </section>

          <section className="poa-dashboard__panel">
            <div className="poa-dashboard__panel-heading poa-dashboard__panel-heading--compact">
              <h2><FaExclamationTriangle aria-hidden="true" /> Trabajo prioritario</h2>
            </div>
            <div className="poa-dashboard__alerts">
              {tablero.alertas?.length
                ? tablero.alertas.map((alerta, index) => (
                    <button
                      type="button"
                      key={`${alerta.mensaje}-${index}`}
                      onClick={() => abrirAlerta(alerta)}
                    >
                      {alerta.mensaje}
                      <FaArrowRight aria-hidden="true" />
                    </button>
                  ))
                : <p className="poa-dashboard__no-alerts">No hay acciones pendientes.</p>}
            </div>
          </section>

          <section className="poa-dashboard__panel poa-dashboard__budget-panel">
            <div className="poa-dashboard__budget-heading">
              <div>
                <h2><FaMoneyBillWave aria-hidden="true" /> Ejecución presupuestaria</h2>
                <p className="poa-dashboard__section-label">Comprometido</p>
              </div>
              <p className="poa-dashboard__budget-percent">{avanceFinanciero}%</p>
            </div>
            <p className="poa-dashboard__budget-amount">{money(presupuesto.comprometido)}</p>
            <div
              className="poa-dashboard__progress poa-dashboard__progress--budget"
              role="progressbar"
              aria-label="Presupuesto comprometido"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.min(100, Math.max(0, avanceFinanciero))}
            >
              <span style={{ width: `${Math.min(100, Math.max(0, avanceFinanciero))}%` }} />
            </div>
            <div className="poa-dashboard__budget-footer">
              <span>Planificado <b>{money(presupuesto.planificado)}</b></span>
              <span>Recibido <b>{money(presupuesto.recibido)}</b></span>
              <span>Entregado <b>{money(presupuesto.entregado)}</b></span>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

export default function POAHomePage() {
  const { user } = useOutletContext() || {};
  const esDirector = user?.perfil?.rol === 'director' && !user?.is_superuser;
  return esDirector ? <DirectorDashboardPage /> : <ElaboradorHomeDashboard />;
}
