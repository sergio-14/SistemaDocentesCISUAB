import { Routes, Route, Outlet } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './index.css';
import { useTheme } from '../../useTheme';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PoaBreadcrumb from './components/PoaBreadcrumb';
import ChatFlotantePOA from './components/ChatFlotantePOA';
import GestionSelectorModal from './components/GestionSelectorModal';
import { getUsuariosPOA } from '../../apis/poa.api';
import { replacePoaNavigationContext } from './utils/navigationContext';

function POAApp({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveTheme: theme, setTheme } = useTheme();
  const [showGestionModal, setShowGestionModal] = useState(false);
  const [headerSelectedActividad, setHeaderSelectedActividad] = useState(null);
  const [showHeader, setShowHeader] = useState(true);
  const [forceShowHeader, setForceShowHeader] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [poaRoles, setPoaRoles] = useState([]);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef(null);

  const isHome = location?.pathname === '/poa' || location?.pathname === '/poa/';
  const isActividadesPage = location?.pathname?.includes('/poa/actividades/');
  const isEvidenciasPage = location?.pathname?.includes('/poa/actividades/') && location?.pathname?.includes('/evidencias');
  const isPresupuestosPage = location?.pathname?.startsWith('/poa/presupuestos');
  const isObjetivosPage = location?.pathname?.startsWith('/poa/objetivos-especificos');

  useEffect(() => {
    let mounted = true;
    if (!user?.id) {
      setPoaRoles([]);
      return undefined;
    }
    getUsuariosPOA({ activo: true })
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        const docenteId = Number(user?.perfil?.docente || 0);
        const propios = list.filter((a) => {
          const byUser = Number(a?.user) === Number(user.id) || Number(a?.user_detalle?.id) === Number(user.id);
          const byDocente = docenteId > 0 && (Number(a?.docente) === docenteId || Number(a?.docente_detalle?.id) === docenteId);
          return byUser || byDocente;
        });
        const roles = [...new Set(propios.map((a) => a?.rol).filter(Boolean))];
        setPoaRoles(roles);
      })
      .catch(() => {
        if (mounted) setPoaRoles([]);
      });

    return () => { mounted = false; };
  }, [user?.id]);

  // Admin principal POA: solo superusuario global
  const isAdminPrincipal = Boolean(user?.is_superuser);

  const poaPermissions = {
    canEdit: poaRoles.includes('elaborador'),
    // Los accesos POA los gestiona el Director de Carrera o el superusuario.
    canManageAccess: isAdminPrincipal || Boolean(user?.perfil?.rol === 'director'),
    canReview: Boolean(user?.is_superuser || user?.perfil?.rol === 'director'),
  };

  const openGestionSelector = () => {
    setShowGestionModal(true);
  };

  const openRevisionBoard = () => {
    const targetPath = '/poa/documentos-revision';
    const gestion = new Date().getFullYear() + 1;
    setShowGestionModal(false);
    navigate(targetPath, {
      state: replacePoaNavigationContext({ gestion, documentosPath: targetPath }),
    });
  };

  // Control del header por scroll
  useEffect(() => {
    if (isHome) return undefined;
    lastScrollY.current = window.scrollY || window.pageYOffset || 0;
    const THRESHOLD = 20;
    const MIN_DISTANCE = 50;
    const DEBOUNCE_MS = 60;

    const onScroll = () => {
      if (forceShowHeader) return;
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        const y = window.scrollY || window.pageYOffset || 0;
        const delta = y - lastScrollY.current;
        if (Math.abs(delta) < THRESHOLD) return;
        if (delta > 0 && y > MIN_DISTANCE) {
          setShowHeader(false);
        } else if (delta < 0) {
          setShowHeader(true);
        }
        lastScrollY.current = y;
      }, DEBOUNCE_MS);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    setShowHeader(true);
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeout.current) { clearTimeout(scrollTimeout.current); scrollTimeout.current = null; }
    };
  }, [isHome, forceShowHeader]);

  // Escuchar eventos para mostrar/ocultar el header global
  useEffect(() => {
    const onShowHeader = () => {
      setShowHeader(true);
      setForceShowHeader(true);
    };
    const onHideHeader = () => {
      setShowHeader(false);
      setForceShowHeader(false);
      setHeaderSelectedActividad(null);
    };
    window.addEventListener('show-global-header', onShowHeader);
    window.addEventListener('hide-global-header', onHideHeader);
    return () => {
      window.removeEventListener('show-global-header', onShowHeader);
      window.removeEventListener('hide-global-header', onHideHeader);
    };
  }, []);

  // Escuchar eventos para mostrar acciones en el header (actividades)
  useEffect(() => {
    const onHeaderActions = (e) => {
      const sel = e?.detail?.selectedActividad ?? null;
      setHeaderSelectedActividad(sel);
    };
    window.addEventListener('header-actions', onHeaderActions);
    return () => window.removeEventListener('header-actions', onHeaderActions);
  }, []);

  return (
    <div className={`poa-app flex h-screen overflow-hidden transition-colors duration-500`}>
      <ChatFlotantePOA currentUser={user} />

      {/* Sidebar */}
      <Sidebar
        theme={theme}
        onOpenGestionSelector={openGestionSelector}
        onOpenRevisionBoard={openRevisionBoard}
        setSidebarExpanded={setSidebarExpanded}
        user={user}
        poaPermissions={poaPermissions}
        poaRoles={poaRoles}
      />

      {/* Modal de gestiÃ³n */}
      {showGestionModal && (
        <GestionSelectorModal
          currentUser={user}
          poaRoles={poaRoles}
          canCreateDocument={poaPermissions.canEdit}
          onClose={() => setShowGestionModal(false)}
          onSuccess={({ gestion, documentos }) => {
            const targetPath = '/poa/documentos';
            setShowGestionModal(false);
            navigate(targetPath, {
              state: {
                ...replacePoaNavigationContext({ gestion, documentosPath: targetPath }),
                documentos,
              },
            });
          }}
        />
      )}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-72' : 'md:ml-20'}`}>
        {/* Header */}
        <Header 
          theme={theme}
          isHome={isHome}
          showHeader={showHeader}
          headerSelectedActividad={headerSelectedActividad}
          setTheme={setTheme}
          sidebarExpanded={sidebarExpanded}
          poaPermissions={poaPermissions}
        />

        {/* Contenido central */}
        <section className={`poa-main-surface flex flex-col items-stretch justify-start flex-1 min-h-0 overflow-y-auto ${isHome ? 'pt-2 md:pt-2 pb-6' : 'pt-28 md:pt-16 pb-6'} ${isHome ? 'px-4 md:px-6 lg:px-8' : isEvidenciasPage ? 'px-4 md:px-8 lg:px-10' : (isActividadesPage || isPresupuestosPage || isObjetivosPage) ? 'px-2 md:px-4' : 'px-4 md:px-20'} w-full`}>
          <PoaBreadcrumb />
          <Outlet context={{ user, poaRoles, poaPermissions }} />
        </section>
      </main>

    </div>
  );
}

export default POAApp;
