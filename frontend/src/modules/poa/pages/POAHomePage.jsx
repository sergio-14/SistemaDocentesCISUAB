import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  FaArrowRight,
  FaBell,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaFileAlt,
  FaMoneyBillWave,
  FaPlayCircle,
} from 'react-icons/fa';
import { getBandejaSeguimientoPOA, getDocumentosPOAPorGestion, getTableroPOA } from '../../../apis/poa.api';
import { getPoaNavigationContext, replacePoaNavigationContext } from '../utils/navigationContext';
import './POAHomePage.css';
import './POADirectorHome.css';

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

const getPendingSolicitudes = (documento) => {
  const solicitudes = Array.isArray(documento?.solicitudes_cambio_pendientes)
    ? documento.solicitudes_cambio_pendientes
    : [];
  return solicitudes.filter((solicitud) => !solicitud?.estado || solicitud.estado === 'pendiente');
};

const normalizeDocumentList = (response) => {
  const data = response?.data;
  return Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
};

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

function DirectorHomeDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationContext = getPoaNavigationContext(location.state);
  const gestion = Number(navigationContext.gestion) || new Date().getFullYear();
  const [documentos, setDocumentos] = useState(null);
  const [tablero, setTablero] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setDocumentos(null);
    setTablero(null);
    setError('');

    Promise.all([
      getDocumentosPOAPorGestion(gestion),
      getTableroPOA({ gestion }),
    ])
      .then(([documentosResponse, tableroResponse]) => {
        if (!active) return;
        setDocumentos(normalizeDocumentList(documentosResponse));
        setTablero(tableroResponse?.data || {});
      })
      .catch(() => {
        if (active) setError('No se pudo cargar el panel de Dirección.');
      });

    return () => { active = false; };
  }, [gestion]);

  const abrirDocumentos = (path, lista) => {
    navigate(path, {
      state: {
        ...replacePoaNavigationContext({ gestion, documentosPath: path }),
        documentos: lista,
      },
    });
  };

  const abrirAlerta = (alerta) => {
    if (alerta?.accion === 'ver_materiales') {
      navigate('/poa/consolidado-requerimientos', { state: { materialTab: 'entregas' } });
      return;
    }
    if (alerta?.referencia?.documento_id) {
      navigate(`/poa/seguimiento/programa/${alerta.referencia.documento_id}`, {
        state: { modo: 'ejecucion', gestion },
      });
    }
  };

  if (error) {
    return <div className="poa-dashboard__message poa-dashboard__message--error" role="alert">{error}</div>;
  }
  if (!documentos || !tablero) {
    return <div className="poa-dashboard__message" role="status">Cargando panel de Dirección…</div>;
  }

  const documentosEnRevision = documentos.filter((documento) => documento?.estado === 'revision');
  const solicitudesPendientes = documentos.reduce((total, documento) => total + getPendingSolicitudes(documento).length, 0);
  const documentosPendientes = documentos.filter((documento) => (
    documento?.estado === 'revision' || getPendingSolicitudes(documento).length > 0
  ));
  const aprobados = documentos.filter((documento) => documento?.estado === 'aprobado');
  const enEjecucion = documentos.filter((documento) => documento?.estado === 'ejecucion');
  const agenda = tablero.agenda_mensual || {};
  const presupuesto = tablero.presupuesto || {};
  const avanceFinanciero = Number(presupuesto.planificado)
    ? Math.round(Number(presupuesto.comprometido || 0) / Number(presupuesto.planificado) * 100)
    : 0;
  const alertasDirector = (tablero.alertas || []).filter((alerta) => (
    Array.isArray(alerta.destinatarios) && alerta.destinatarios.includes('director')
  ));
  const conteoPendientes = documentosPendientes.length + solicitudesPendientes;
  const partesPendientes = [
    documentosPendientes.length > 0
      ? `${documentosPendientes.length} ${documentosPendientes.length === 1 ? 'documento' : 'documentos'}`
      : null,
    solicitudesPendientes > 0
      ? `${solicitudesPendientes} ${solicitudesPendientes === 1 ? 'solicitud de cambio pendiente' : 'solicitudes de cambio pendientes'}`
      : null,
  ].filter(Boolean);

  return (
    <section className="poa-dashboard poa-dashboard--director" aria-labelledby="poa-director-title">
      <header className="poa-dashboard__overview">
        <div className="poa-dashboard__title-block">
          <p className="poa-dashboard__eyebrow">Gestión POA · {tablero.gestion || gestion}</p>
          <h1 id="poa-director-title">Panel de Dirección</h1>
          <p className="poa-dashboard__intro">
            Revise los documentos y cambios de su carrera, e inicie la ejecución de los POA aprobados.
          </p>
        </div>
      </header>

      <section
        className={`poa-director-notice ${conteoPendientes ? 'poa-director-notice--pending' : 'poa-director-notice--clear'}`}
        aria-label="Notificaciones de revisión"
      >
        <span className="poa-director-notice__icon" aria-hidden="true"><FaBell /></span>
        <div className="poa-director-notice__body">
          <h2>{conteoPendientes ? 'Revisiones pendientes' : 'Bandeja de revisión al día'}</h2>
          <p role="status" aria-live="polite" aria-atomic="true">
            {conteoPendientes
              ? `${partesPendientes.join(' y ')} ${conteoPendientes === 1 ? 'requiere' : 'requieren'} atención.`
              : 'No tiene documentos ni solicitudes de cambio pendientes de revisión.'}
          </p>
        </div>
        <button
          type="button"
          className="poa-director-notice__action"
          onClick={() => abrirDocumentos('/poa/documentos-revision', documentosPendientes)}
        >
          Ver revisiones <FaArrowRight aria-hidden="true" />
          {conteoPendientes > 0 && <span className="poa-director-notice__count" aria-label={`${conteoPendientes} pendientes`}>{conteoPendientes}</span>}
        </button>
      </section>

      <div className="poa-dashboard__kpis" aria-label="Resumen de Dirección">
        <Kpi label="Documentos en revisión" value={documentosEnRevision.length} tone={documentosEnRevision.length ? 'attention' : 'default'} />
        <Kpi label="Solicitudes de cambio" value={solicitudesPendientes} tone={solicitudesPendientes ? 'attention' : 'default'} />
        <Kpi label="Aprobados para iniciar" value={aprobados.length} tone={aprobados.length ? 'positive' : 'default'} />
        <Kpi label="Documentos en ejecución" value={enEjecucion.length} />
      </div>

      <div className="poa-dashboard__content">
        <div className="poa-director-queues">
          <section className="poa-dashboard__panel poa-director-queue">
            <div className="poa-dashboard__panel-heading">
              <div>
                <h2>Documentos que requieren revisión</h2>
                <p>Documentos enviados por su carrera y solicitudes de cambio pendientes.</p>
              </div>
              <span className="poa-dashboard__document-count">{documentosPendientes.length} pendientes</span>
            </div>
            <div className="poa-director-queue__list">
              {documentosPendientes.slice(0, 5).map((documento) => {
                const solicitudes = getPendingSolicitudes(documento).length;
                const titulo = documento.programa || documento.nombre || `Documento POA #${documento.id}`;
                return (
                  <button
                    type="button"
                    className="poa-director-queue__item"
                    key={documento.id}
                    onClick={() => abrirDocumentos('/poa/documentos-revision', documentosPendientes)}
                    aria-label={`Revisar ${titulo}`}
                  >
                    <span className="poa-director-queue__item-icon" aria-hidden="true"><FaFileAlt /></span>
                    <span className="poa-director-queue__item-main">
                      <span className="poa-director-queue__item-title">{titulo}</span>
                      <span className="poa-director-queue__item-meta">
                        {documento.estado === 'revision' ? 'Documento en revisión' : 'Solicitud de cambio pendiente'}
                        {solicitudes > 0 && documento.estado === 'revision' ? ` · ${solicitudes} cambio(s)` : ''}
                      </span>
                    </span>
                    <FaArrowRight className="poa-director-queue__arrow" aria-hidden="true" />
                  </button>
                );
              })}
              {!documentosPendientes.length && (
                <p className="poa-dashboard__empty">No hay revisiones pendientes para esta gestión.</p>
              )}
              {documentosPendientes.length > 5 && (
                <button
                  type="button"
                  className="poa-director-queue__more"
                  onClick={() => abrirDocumentos('/poa/documentos-revision', documentosPendientes)}
                >
                  Ver los {documentosPendientes.length} documentos pendientes <FaArrowRight aria-hidden="true" />
                </button>
              )}
            </div>
          </section>

          <section className="poa-dashboard__panel poa-director-queue">
            <div className="poa-dashboard__panel-heading">
              <div>
                <h2>Aprobados para iniciar ejecución</h2>
                <p>Los documentos aprobados pueden pasar a la etapa de ejecución.</p>
              </div>
              <span className="poa-dashboard__document-count">{aprobados.length} documentos</span>
            </div>
            <div className="poa-director-queue__list">
              {aprobados.slice(0, 4).map((documento) => {
                const titulo = documento.programa || documento.nombre || `Documento POA #${documento.id}`;
                return (
                  <button
                    type="button"
                    className="poa-director-queue__item"
                    key={documento.id}
                    onClick={() => abrirDocumentos('/poa/documentos', aprobados)}
                    aria-label={`Abrir documento aprobado: ${titulo}`}
                  >
                    <span className="poa-director-queue__item-icon poa-director-queue__item-icon--approved" aria-hidden="true"><FaPlayCircle /></span>
                    <span className="poa-director-queue__item-main">
                      <span className="poa-director-queue__item-title">{titulo}</span>
                      <span className="poa-director-queue__item-meta">Aprobado · listo para iniciar</span>
                    </span>
                    <FaArrowRight className="poa-director-queue__arrow" aria-hidden="true" />
                  </button>
                );
              })}
              {!aprobados.length && (
                <p className="poa-dashboard__empty">No hay documentos aprobados pendientes de inicio.</p>
              )}
              {aprobados.length > 4 && (
                <button
                  type="button"
                  className="poa-director-queue__more"
                  onClick={() => abrirDocumentos('/poa/documentos', aprobados)}
                >
                  Ver los {aprobados.length} documentos aprobados <FaArrowRight aria-hidden="true" />
                </button>
              )}
            </div>
          </section>

          <section className="poa-dashboard__panel poa-director-queue">
            <div className="poa-dashboard__panel-heading">
              <div>
                <h2>POA en ejecución</h2>
                <p>Acceda al seguimiento de actividades de los documentos activos.</p>
              </div>
              <span className="poa-dashboard__document-count">{enEjecucion.length} documentos</span>
            </div>
            <div className="poa-director-queue__list">
              {enEjecucion.slice(0, 4).map((documento) => {
                const titulo = documento.programa || documento.nombre || `Documento POA #${documento.id}`;
                return (
                  <button
                    type="button"
                    className="poa-director-queue__item"
                    key={documento.id}
                    onClick={() => abrirSeguimiento(documento)}
                    aria-label={`Ver seguimiento de ${titulo}`}
                  >
                    <span className="poa-director-queue__item-icon poa-director-queue__item-icon--approved" aria-hidden="true"><FaPlayCircle /></span>
                    <span className="poa-director-queue__item-main">
                      <span className="poa-director-queue__item-title">{titulo}</span>
                      <span className="poa-director-queue__item-meta">En ejecución</span>
                    </span>
                    <FaArrowRight className="poa-director-queue__arrow" aria-hidden="true" />
                  </button>
                );
              })}
              {!enEjecucion.length && (
                <p className="poa-dashboard__empty">No hay documentos en ejecución para esta gestión.</p>
              )}
              {enEjecucion.length > 4 && (
                <button
                  type="button"
                  className="poa-director-queue__more"
                  onClick={() => abrirDocumentos('/poa/documentos', enEjecucion)}
                >
                  Ver los {enEjecucion.length} documentos en ejecución <FaArrowRight aria-hidden="true" />
                </button>
              )}
            </div>
          </section>
        </div>

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
              <h2><FaExclamationTriangle aria-hidden="true" /> Alertas de la carrera</h2>
            </div>
            <div className="poa-dashboard__alerts">
              {alertasDirector.length
                ? alertasDirector.map((alerta, index) => (
                    alerta.accion === 'ver_materiales' || alerta.referencia?.documento_id ? (
                      <button type="button" key={`${alerta.mensaje}-${index}`} onClick={() => abrirAlerta(alerta)}>
                        {alerta.mensaje}<FaArrowRight aria-hidden="true" />
                      </button>
                    ) : <p className="poa-director-alert" key={`${alerta.mensaje}-${index}`}>{alerta.mensaje}</p>
                  ))
                : <p className="poa-dashboard__no-alerts">No hay alertas para esta gestión.</p>}
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
  return esDirector ? <DirectorHomeDashboard /> : <ElaboradorHomeDashboard />;
}
