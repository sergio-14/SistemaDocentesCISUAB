import React, { useEffect, useMemo } from 'react';
import { FaChevronRight } from 'react-icons/fa';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildPoaNavigationState, getPoaNavigationContext } from '../utils/navigationContext';

const truncate = (value, fallback) => {
  const text = String(value || fallback || '').trim();
  return text.length > 46 ? `${text.slice(0, 43)}…` : text;
};

const PoaBreadcrumb = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const context = useMemo(() => getPoaNavigationContext(location.state), [location.key, location.state]);
  const path = location.pathname || '';
  const documentoId = context.documentoId;
  const objetivoId = context.objetivoId || context.objetivoEspecificoId;
  const actividad = context.actividad || {};
  const actividadId = context.actividadId || actividad.id;
  const documentoLabel = truncate(context.documentoNombre, documentoId ? `Programa #${documentoId}` : 'Documentos');
  const objetivoLabel = truncate(context.objetivoNombre, objetivoId ? `Objetivo #${objetivoId}` : 'Objetivo');
  const actividadLabel = truncate(context.actividadNombre || actividad.codigo || actividad.nombre, actividadId ? `Actividad #${actividadId}` : 'Actividad');

  const isDetail = path.startsWith('/poa/objetivos-especificos') || path.startsWith('/poa/actividades') || path.startsWith('/poa/presupuestos');
  const sectionLabel = path.includes('/evidencias') ? 'Evidencias' : path.startsWith('/poa/presupuestos') ? 'Presupuesto' : path.startsWith('/poa/actividades') ? 'Actividades' : 'Objetivos';

  useEffect(() => {
    const title = path.includes('/evidencias') ? `POA | Evidencias — ${actividadLabel}`
      : path.startsWith('/poa/presupuestos') ? `POA | Presupuesto — ${actividadLabel}`
        : path.startsWith('/poa/actividades') ? `POA | Actividades — ${objetivoLabel}`
          : path.startsWith('/poa/objetivos-especificos') ? `POA | Objetivos — ${documentoLabel}`
            : path.startsWith('/poa/consolidado-requerimientos') ? 'POA | Bandeja de compras'
              : path.startsWith('/poa/reportes') ? 'POA | Reportes' : 'POA | Documentos';
    document.title = title;
  }, [actividadLabel, documentoLabel, objetivoLabel, path]);

  if (!isDetail) return null;
  const state = (patch) => buildPoaNavigationState(location.state, patch);
  const links = [
    { label: 'Documentos', onClick: () => navigate(context.documentosPath || '/poa/documentos', { state: state({}) }) },
    ...(documentoId ? [{ label: documentoLabel, onClick: () => navigate(`/poa/objetivos-especificos/${documentoId}`, { state: state({ documentoId }) }) }] : []),
    ...(objetivoId ? [{ label: objetivoLabel, onClick: () => navigate(`/poa/actividades/${objetivoId}`, { state: state({ objetivoId }) }) }] : []),
    ...(actividadId && objetivoId && (path.includes('/evidencias') || path.startsWith('/poa/presupuestos')) ? [{ label: actividadLabel, onClick: () => navigate(`/poa/actividades/${objetivoId}`, { state: state({ objetivoId }) }) }] : []),
    { label: sectionLabel, onClick: null },
  ];
  return <nav aria-label="Ruta de navegación" className="hidden md:flex items-center gap-2 min-h-7 overflow-hidden text-xs text-slate-500 dark:text-slate-400">
    {links.map((item, index) => <React.Fragment key={`${item.label}-${index}`}>
      {index > 0 && <FaChevronRight className="shrink-0 text-[9px] text-slate-400" />}
      {item.onClick ? <button type="button" onClick={item.onClick} title={item.label} className="max-w-56 truncate hover:text-blue-700 hover:underline dark:hover:text-sky-300">{item.label}</button> : <span className="max-w-56 truncate font-semibold text-slate-700 dark:text-slate-200" title={item.label}>{item.label}</span>}
    </React.Fragment>)}
  </nav>;
};

export default PoaBreadcrumb;
