import React, { useEffect, useState } from 'react';
import { FaArrowRight, FaBell } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDocumentosPOAPorGestion } from '../../../../apis/poa.api';
import { getPoaNavigationContext, replacePoaNavigationContext } from '../../utils/navigationContext';
import './DirectorDashboardPage.css';

const normalizeDocuments = (response) => {
  const data = response?.data;
  return Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
};

const getPendingRequests = (documento) => {
  const solicitudes = Array.isArray(documento?.solicitudes_cambio_pendientes)
    ? documento.solicitudes_cambio_pendientes
    : [];
  return solicitudes.filter((solicitud) => !solicitud?.estado || solicitud.estado === 'pendiente');
};

export default function DirectorDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const gestion = Number(getPoaNavigationContext(location.state)?.gestion) || new Date().getFullYear();
  const [documentos, setDocumentos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setDocumentos(null);
    setError('');

    getDocumentosPOAPorGestion(gestion)
      .then((response) => {
        if (active) setDocumentos(normalizeDocuments(response));
      })
      .catch(() => {
        if (active) setError('No se pudo cargar el resumen de la gestión.');
      });

    return () => { active = false; };
  }, [gestion]);

  if (error) {
    return <div className="poa-director-dashboard__message poa-director-dashboard__message--error" role="alert">{error}</div>;
  }
  if (!documentos) {
    return <div className="poa-director-dashboard__message" role="status">Cargando resumen de Dirección…</div>;
  }

  const documentosEnRevision = documentos.filter((documento) => documento?.estado === 'revision');
  const documentosPendientes = documentos.filter((documento) => (
    documento?.estado === 'revision' || getPendingRequests(documento).length > 0
  ));
  const solicitudesPendientes = documentos.reduce((total, documento) => total + getPendingRequests(documento).length, 0);
  const aprobados = documentos.filter((documento) => (
    documento?.estado === 'aprobado' && getPendingRequests(documento).length === 0
  ));
  const enEjecucion = documentos.filter((documento) => documento?.estado === 'ejecucion');
  const totalTareasRevision = documentosPendientes.length + solicitudesPendientes;
  const detalleTareasRevision = [
    documentosPendientes.length > 0
      ? `${documentosPendientes.length} ${documentosPendientes.length === 1 ? 'documento' : 'documentos'}`
      : null,
    solicitudesPendientes > 0
      ? `${solicitudesPendientes} ${solicitudesPendientes === 1 ? 'solicitud de cambio' : 'solicitudes de cambio'}`
      : null,
  ].filter(Boolean).join(' y ');

  const abrirRevisiones = () => {
    const path = '/poa/documentos-revision';
    navigate(path, {
      state: {
        ...replacePoaNavigationContext({ gestion, documentosPath: path }),
        documentos: documentosPendientes,
      },
    });
  };

  return (
    <section className="poa-director-dashboard" aria-labelledby="poa-director-dashboard-title">
      <header className="poa-director-dashboard__hero">
        <div className="poa-director-dashboard__hero-copy">
          <p className="poa-director-dashboard__eyebrow">Gestión anual · POA</p>
          <h1 id="poa-director-dashboard-title">Panel de Dirección</h1>
          <p>Revise, observe o apruebe los documentos de su carrera e inicie los POA aprobados.</p>
        </div>
        <div className="poa-director-dashboard__year" aria-label={`Gestión ${gestion}`}>
          <span>Gestión</span>
          <strong>{gestion}</strong>
        </div>
      </header>

      <section
        className={`poa-director-dashboard__notice ${totalTareasRevision ? 'is-pending' : 'is-clear'}`}
        aria-label="Estado de revisiones"
      >
        <span className="poa-director-dashboard__notice-icon" aria-hidden="true"><FaBell /></span>
        <div className="poa-director-dashboard__notice-copy">
          <h2>{totalTareasRevision ? 'Tiene revisiones pendientes' : 'No hay revisiones pendientes'}</h2>
          <p role="status" aria-live="polite" aria-atomic="true">
            {totalTareasRevision
              ? `${detalleTareasRevision} ${totalTareasRevision === 1 ? 'requiere' : 'requieren'} atención.`
              : 'La bandeja de revisión está al día para esta gestión.'}
          </p>
        </div>
        <button type="button" className="poa-director-dashboard__notice-action" onClick={abrirRevisiones}>
          Abrir revisiones
          {totalTareasRevision > 0 && <span>{totalTareasRevision}</span>}
          <FaArrowRight aria-hidden="true" />
        </button>
      </section>

      <div className="poa-director-dashboard__summary" aria-label="Resumen de la gestión">
        <article>
          <span>Documentos en revisión</span>
          <strong>{documentosEnRevision.length}</strong>
        </article>
        <article>
          <span>Solicitudes de cambio</span>
          <strong>{solicitudesPendientes}</strong>
        </article>
        <article>
          <span>Aprobados para iniciar</span>
          <strong>{aprobados.length}</strong>
        </article>
        <article>
          <span>En ejecución</span>
          <strong>{enEjecucion.length}</strong>
        </article>
      </div>
    </section>
  );
}
