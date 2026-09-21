import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaEdit, FaTrash, FaFilePdf, FaMoneyBillAlt, FaImage, FaEllipsisV } from 'react-icons/fa';
import ThemeToggle from './ThemeToggle';
import IconButton from './IconButton';
import { buildPoaNavigationState, getPoaNavigationContext } from '../utils/navigationContext';

const themeStyles = {
  dark: {
    headerBg: 'bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950',
    headerHomeBg: 'bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950',
    headerShadow: 'shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    headerBorder: 'border-b border-blue-700/50',
    headerText: 'text-white',
    headerHomeText: 'text-white',
    primaryButton: 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600',
    buttonShadow: 'shadow-[0_8px_20px_rgba(37,99,235,0.4)]',
    buttonHover: 'hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700',
    buttonText: 'text-white',
  },
  light: {
    headerBg: 'bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900',
    headerHomeBg: 'bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900',
    headerShadow: 'shadow-[0_4px_20px_rgba(30,58,138,0.3)]',
    headerBorder: 'border-b border-blue-600/30',
    headerText: 'text-white',
    headerHomeText: 'text-white',
    primaryButton: 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600',
    buttonShadow: 'shadow-[0_8px_20px_rgba(37,99,235,0.3)]',
    buttonHover: 'hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700',
    buttonText: 'text-white',
  },
};

const Header = ({ 
  theme, 
  isHome, 
  showHeader, 
  headerSelectedActividad, 
  setTheme,
  sidebarExpanded = true,
  poaPermissions = {}
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const themeConfig = themeStyles[theme];
  const canEdit = !!poaPermissions?.canEdit;
  const canManageAccess = !!poaPermissions?.canManageAccess;
  const [mobileActionsOpen, setMobileActionsOpen] = React.useState(false);
  const mobileActionsRef = React.useRef(null);
  const navContext = getPoaNavigationContext(location?.state);
  const isPresupuestoPage = location?.pathname === '/poa/presupuestos';

  React.useEffect(() => {
    const handlePointerDown = (event) => {
      if (!mobileActionsRef.current || mobileActionsRef.current.contains(event.target)) return;
      setMobileActionsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  React.useEffect(() => {
    setMobileActionsOpen(false);
  }, [location?.pathname, headerSelectedActividad]);

  const getActividadForNavigation = () => (
    isPresupuestoPage
      ? (navContext?.actividad || null)
      : (headerSelectedActividad || navContext?.actividad || null)
  );

  const getSelectedObjetivoId = () => (
    navContext?.objetivoId ||
    navContext?.objetivoEspecificoId ||
    getActividadForNavigation()?.objetivoId ||
    getActividadForNavigation()?.objetivo ||
    getActividadForNavigation()?.objetivo_id ||
    null
  );

  const getSelectedDocumentoId = () => (
    navContext?.documentoId ||
    getActividadForNavigation()?.documento_id ||
    getActividadForNavigation()?.documento ||
    null
  );

  const getSelectedActividadId = () => (
    navContext?.actividadId ||
    navContext?.actividad?.id ||
    getActividadForNavigation()?.id ||
    null
  );

  const getDocumentosPath = () => (
    navContext?.documentosPath === '/poa/documentos-revision'
      ? '/poa/documentos-revision'
      : '/poa/documentos'
  );

  const buildHeaderNavigationState = (patch = {}) => buildPoaNavigationState(location?.state, {
    gestion: navContext?.gestion || getActividadForNavigation()?.gestion || getActividadForNavigation()?.documento_gestion,
    documentoId: getSelectedDocumentoId(),
    documentoEstado: navContext?.documentoEstado || getActividadForNavigation()?.documento_estado,
    documentoNombre: navContext?.documentoNombre,
    documentosPath: getDocumentosPath(),
    objetivoId: getSelectedObjetivoId(),
    objetivoNombre: navContext?.objetivoNombre,
    actividadId: getSelectedActividadId(),
    actividadNombre: navContext?.actividadNombre || getActividadForNavigation()?.codigo || getActividadForNavigation()?.nombre,
    ...(getActividadForNavigation() ? { actividad: getActividadForNavigation() } : {}),
    ...patch,
  });

  const handlePoaBack = () => {
    const p = location?.pathname || '';
    const objetivoId = getSelectedObjetivoId();
    const documentoId = getSelectedDocumentoId();
    const retornoPoaPath = navContext?.retornoPoaPath;

    if (p.includes('/seguimiento/programa/')) {
      navigate('/poa', { state: { modo: location.state?.modo || 'ejecucion' } });
      return;
    }

    if (p === '/poa/presupuestos' || p.includes('/evidencias')) {
      if (objetivoId) {
        navigate(`/poa/actividades/${objetivoId}`, {
          replace: true,
          state: buildHeaderNavigationState({ objetivoId }),
        });
        return;
      }
    }

    if (p.startsWith('/poa/actividades')) {
      if (retornoPoaPath) {
        navigate(retornoPoaPath, {
          state: buildHeaderNavigationState({ retornoPoaPath, retornoPoaMode: navContext?.retornoPoaMode }),
        });
        return;
      }
      if (documentoId) {
        navigate(`/poa/objetivos-especificos/${documentoId}`, {
          replace: true,
          state: buildHeaderNavigationState({ documentoId }),
        });
        return;
      }
    }

    if (p.startsWith('/poa/objetivos-especificos')) {
      navigate(getDocumentosPath(), {
        replace: true,
        state: buildHeaderNavigationState({ gestion: navContext?.gestion }),
      });
      return;
    }

    if (navContext?.gestion) {
      navigate(getDocumentosPath(), {
        replace: true,
        state: buildHeaderNavigationState({ gestion: navContext.gestion }),
      });
      return;
    }

    navigate(-1);
  };

  const gradientButtonClasses = (size = 'md') => {
    const sizeMap = {
      md: 'py-1 px-4 text-sm md:text-sm rounded-lg',
      sm: 'py-0.5 px-3 text-xs rounded-full',
    };
    const sizeClasses = sizeMap[size] || sizeMap.md;
    return `${themeConfig.primaryButton} ${themeConfig.buttonText} font-bold ${sizeClasses} ${themeConfig.buttonShadow} ${themeConfig.buttonHover} transition duration-300`;
  };

  const getPageTitle = () => {
    const p = location?.pathname || '';
    // Mostrar título específico para la vista de evidencias
    if (p.includes('/evidencias')) return 'Registro de Evidencias';
    if (p.includes('/seguimiento/programa/')) return 'Seguimiento del programa';
    if (p === '/poa/documentos' || p === '/poa') return 'Documentos POA';
    if (p === '/poa/documentos-revision') return 'Revisión de Documentos POA';
    if (p === '/poa/catalogos/items') return 'Catálogo de items';
    if (p === '/poa/catalogos/indicadores') return 'Catálogo de indicadores';
    if (p.startsWith('/poa/objetivos')) return 'Objetivos Específicos';
    if (p.startsWith('/poa/actividades')) return 'Actividades';
    if (p.startsWith('/poa/catalogos')) return 'Catálogos';
    if (p === '/poa/presupuestos') return 'Detalle Presupuesto';
    if (p === '/poa/consolidado-requerimientos') return 'Bandeja de compras';
    if (p === '/poa/reportes') return 'Reportes';
    if (p === '/poa/personas') return 'Personas';
    return 'Módulo POA';
  };

  const createHeaderAction = ({ key, label, icon, onClick, title, type = 'selected', className = '' }) => ({
    key,
    label,
    icon,
    onClick: () => {
      setMobileActionsOpen(false);
      onClick?.();
    },
    title: title || label,
    type,
    className,
  });

  const renderHeaderButton = (action, extraClassName = '') => (
    <IconButton
      key={action.key}
      showIcon
      icon={action.icon}
      onClick={action.onClick}
      className={`${gradientButtonClasses()} ${action.className || ''} ${extraClassName}`.trim()}
      title={action.title}
    >
      {action.label}
    </IconButton>
  );

  const renderMobileActionMenu = (selectedActions) => {
    if (selectedActions.length === 0) return null;

    return (
      <div className="poa-mobile-actions-menu" ref={mobileActionsRef}>
        <button
          type="button"
          className={`${gradientButtonClasses()} poa-mobile-actions-trigger`}
          onClick={() => setMobileActionsOpen((open) => !open)}
          aria-label="Acciones del elemento seleccionado"
          aria-haspopup="menu"
          aria-expanded={mobileActionsOpen}
          title="Acciones"
        >
          <FaEllipsisV />
        </button>
        {mobileActionsOpen && (
          <div className="poa-mobile-actions-dropdown" role="menu">
            {selectedActions.map((action) => (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                onClick={action.onClick}
                className={action.key.includes('delete') || action.key.includes('eliminar') ? 'is-danger' : ''}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderActions = (actions) => {
    if (actions.length === 0) return null;

    const visibleActions = actions.filter((action) => action.type !== 'selected');
    const selectedActions = actions.filter((action) => action.type === 'selected');
    const newActions = visibleActions.filter((action) => action.type === 'new');
    const desktopActions = selectedActions.length > 0
      ? actions.filter((action) => action.type !== 'new')
      : actions;
    const mobilePrimaryActions = selectedActions.length > 0
      ? []
      : (newActions.length > 0 ? newActions : visibleActions);

    return (
      <>
        <div className="poa-header-actions-desktop">
          {desktopActions.map((action) => renderHeaderButton(action))}
        </div>
        <div className="poa-header-actions-mobile">
          {mobilePrimaryActions.map((action) => renderHeaderButton(action))}
          {renderMobileActionMenu(selectedActions)}
        </div>
      </>
    );
  };

  const renderRightActions = () => {
    const p = location?.pathname || '';
    
    if (p.startsWith('/poa/objetivos-especificos')) {
      if (!canEdit) return null;
      return renderActions([
        createHeaderAction({
          key: 'new-objetivos',
          label: 'Nuevo',
          icon: <FaPlus />,
          type: 'new',
          onClick: () => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'objetivos' } })),
        }),
      ]);
    }
    
    if (p === '/poa/documentos' || p === '/poa/documentos-revision') {
      return renderActions([
        createHeaderAction({
          key: 'pdf-documentos',
          label: 'PDF',
          icon: <FaFilePdf />,
          type: 'utility',
          onClick: () => window.dispatchEvent(new CustomEvent('generate-general-report-poa', { detail: {} })),
          title: 'Generar reporte general',
        }),
        ...(p === '/poa/documentos' && canEdit ? [
          createHeaderAction({
            key: 'new-documentos',
            label: 'Nuevo',
            icon: <FaPlus />,
            type: 'new',
            onClick: () => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'documentos' } })),
          }),
        ] : []),
      ]);
    }
    
    if (p === '/poa/personas') {
      if (!canManageAccess) return null;
      return renderActions([
        createHeaderAction({
          key: 'new-personas',
          label: 'Nuevo',
          icon: <FaPlus />,
          type: 'new',
          onClick: () => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'personas' } })),
        }),
      ]);
    }
    
    if (p.startsWith('/poa/actividades')) {
      return renderActions([
        ...(headerSelectedActividad ? [
          createHeaderAction({
            key: 'presupuesto-actividad',
            label: 'Presupuesto',
            icon: <FaMoneyBillAlt />,
            title: 'Ver presupuesto',
            onClick: () => navigate('/poa/presupuestos', {
              state: buildHeaderNavigationState({
                actividad: headerSelectedActividad,
                actividadId: headerSelectedActividad?.id,
                objetivoId: getSelectedObjetivoId(),
                documentoId: headerSelectedActividad?.documento_id,
                documentoEstado: headerSelectedActividad?.documento_estado,
                gestion: headerSelectedActividad?.gestion || headerSelectedActividad?.documento_gestion || navContext?.gestion,
              }),
            }),
          }),
          createHeaderAction({
            key: 'evidencias-actividad',
            label: 'Evidencias',
            icon: <FaImage />,
            onClick: () => navigate(`/poa/actividades/${headerSelectedActividad.id}/evidencias`, {
              state: buildHeaderNavigationState({
                actividad: headerSelectedActividad,
                actividadId: headerSelectedActividad?.id,
                objetivoId: getSelectedObjetivoId(),
                documentoId: headerSelectedActividad?.documento_id,
                documentoEstado: headerSelectedActividad?.documento_estado,
                gestion: headerSelectedActividad?.gestion || headerSelectedActividad?.documento_gestion || navContext?.gestion,
              }),
            }),
          }),
          ...(canEdit ? [
            createHeaderAction({
              key: 'edit-actividad',
              label: 'Editar',
              icon: <FaEdit />,
              onClick: () => window.dispatchEvent(new CustomEvent('header-action', { detail: { action: 'edit', actividad: headerSelectedActividad } })),
            }),
            createHeaderAction({
              key: 'delete-actividad',
              label: 'Eliminar',
              icon: <FaTrash />,
              onClick: () => window.dispatchEvent(new CustomEvent('header-action', { detail: { action: 'delete', actividad: headerSelectedActividad } })),
            }),
          ] : []),
        ] : []),
        ...(canEdit && !p.includes('/evidencias') ? [
          createHeaderAction({
            key: 'new-actividades',
            label: 'Nuevo',
            icon: <FaPlus />,
            type: 'new',
            onClick: () => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'actividades' } })),
          }),
        ] : []),
      ]);
    }
    
    if (p.startsWith('/poa/presupuestos')) {
      return renderActions([
        ...(headerSelectedActividad && canEdit ? [
          createHeaderAction({
            key: 'edit-presupuesto',
            label: 'Editar',
            icon: <FaEdit />,
            onClick: () => window.dispatchEvent(new CustomEvent('header-action', { detail: { action: 'edit', actividad: headerSelectedActividad } })),
          }),
          createHeaderAction({
            key: 'delete-presupuesto',
            label: 'Eliminar',
            icon: <FaTrash />,
            onClick: () => window.dispatchEvent(new CustomEvent('header-action', { detail: { action: 'delete', actividad: headerSelectedActividad } })),
          }),
        ] : []),
        ...(canEdit ? [
          createHeaderAction({
            key: 'new-presupuestos',
            label: 'Nuevo',
            icon: <FaPlus />,
            type: 'new',
            onClick: () => window.dispatchEvent(new CustomEvent('open-new', { detail: { page: 'presupuestos' } })),
          }),
        ] : []),
      ]);
    }
    
    return null;
  };

  if (isHome) {
    return (
      <header className={`poa-home-header w-full ${themeConfig.headerHomeBg} ${themeConfig.headerHomeText} grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-3 md:px-8 md:py-6 ${themeConfig.headerShadow} ${themeConfig.headerBorder}`}>
        <div className="poa-home-spacer" aria-hidden="true" />
        <div className="poa-home-title min-w-0 text-lg md:text-2xl font-bold tracking-wide leading-tight truncate">Ingeniería de Sistemas</div>
        <div className="poa-home-theme justify-self-end">
          <ThemeToggle theme={theme} setTheme={setTheme} variant="header" />
        </div>
      </header>
    );
  }

  const sidebarOffset = sidebarExpanded ? 'md:left-72' : 'md:left-20';
  const headerWidthClass = sidebarExpanded ? 'md:w-[calc(100%-18rem)]' : 'md:w-[calc(100%-5rem)]';

  return (
    <header className={`poa-page-header ${themeConfig.headerBg} ${themeConfig.headerText} flex flex-wrap items-center gap-y-3 pl-20 pr-3 py-2 md:px-6 md:py-4 fixed top-0 right-0 left-0 z-30 w-full ${headerWidthClass} transform transition-all duration-300 ease-in-out ${sidebarOffset} ${showHeader ? `translate-y-0 opacity-100 ${themeConfig.headerShadow} ${themeConfig.headerBorder}` : '-translate-y-full opacity-0 pointer-events-none'}`}>
      {/* Left: page controls */}
      <div className="poa-header-left flex shrink-0 items-center gap-2 md:mr-4">
        {(() => {
          const p = location?.pathname || '';
          if (p.startsWith('/poa/objetivos-especificos') || p.startsWith('/poa/actividades') || p.startsWith('/poa/presupuestos') || p.includes('/seguimiento/programa/')) {
            return (
              <IconButton 
                showIcon 
                icon={<FaArrowLeft />} 
                onClick={handlePoaBack}
                className={`${gradientButtonClasses()} poa-header-back-button`} 
                title="Volver"
              >
                Volver
              </IconButton>
            );
          }
          return null;
        })()}
      </div>

      {/* Center: page title */}
      <div className="poa-header-title order-3 basis-full min-w-0 px-0 text-center md:order-none md:flex-1 md:px-4">
        <h1 className="text-xl md:text-2xl font-bold truncate">{getPageTitle()}</h1>
      </div>

      {/* Right: actions */}
      <div className="poa-header-actions ml-auto flex shrink-0 items-center gap-2 md:gap-4">
        {renderRightActions()}
      </div>
    </header>
  );
};

export default Header;
