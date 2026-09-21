import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaBoxOpen, FaClipboardCheck, FaFileAlt, FaFilePdf, FaHome, FaList, FaUsers } from 'react-icons/fa';
import CatalogosMenu from '../pages/CatalogosMenu';
import ProfilePicture from '../../../components/ProfilePicture';

const BackIcon = (props) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>;
const roleName = (user) => user?.is_superuser ? 'Super Admin' : user?.perfil?.rol === 'director' ? 'Director de Carrera' : user?.perfil?.rol === 'coordinador' ? 'Coordinador POA' : 'Usuario';
const userName = (user) => `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Usuario';
const desktop = () => typeof window === 'undefined' || window.innerWidth >= 768;

export default function Sidebar({ onOpenGestionSelector, onOpenRevisionBoard, setSidebarExpanded, user, poaPermissions = {}, poaRoles = [] }) {
  const navigate = useNavigate(); const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(desktop); const [open, setOpen] = useState(() => desktop() && window.localStorage.getItem('poa-sidebar-open') !== 'false'); const [catalogosOpen, setCatalogosOpen] = useState(() => location.pathname.startsWith('/poa/catalogos'));
  const collapsed = !open;
  useEffect(() => { const resize = () => { const next = desktop(); setIsDesktop(next); setOpen(next ? window.localStorage.getItem('poa-sidebar-open') !== 'false' : false); }; resize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  useEffect(() => setSidebarExpanded(isDesktop && open), [isDesktop, open, setSidebarExpanded]);
  const toggle = () => { if (isDesktop) window.localStorage.setItem('poa-sidebar-open', String(!open)); setOpen(!open); };
  const afterNavigate = () => { if (!isDesktop) setOpen(false); };
  const active = (path) => path === '/poa' ? location.pathname === '/poa' || location.pathname === '/poa/' : location.pathname.startsWith(path);
  const itemClass = (path) => `group flex w-full items-center gap-4 rounded-xl transition-all duration-200 ${collapsed ? 'h-14 justify-center' : 'px-4 py-3'} ${active(path) ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[inset_4px_0_0_0_#fff]' : 'text-blue-200 hover:bg-blue-800/50 hover:text-white'}`;
  const link = ({ name, icon: Icon, path }) => <NavLink key={path} to={path} end={path === '/poa'} title={name} className={() => itemClass(path)} onClick={afterNavigate}><Icon className="h-5 w-5 shrink-0" />{!collapsed && <span className="text-sm font-semibold">{name}</span>}</NavLink>;
  const section = (name) => !collapsed && <h3 className="px-5 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[.14em] text-blue-300/80">{name}</h3>;
  return <>
    {!isDesktop && open && <div className="poa-sidebar-backdrop fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}
    {!isDesktop && !open && <button className="poa-sidebar-toggle fixed left-4 top-3 z-50 p-2 text-blue-200" onClick={toggle} title="Abrir menú"><FaBars size={24} /></button>}
    <aside className={`poa-sidebar fixed left-0 top-0 z-40 flex h-screen flex-col bg-gradient-to-b from-blue-900 to-blue-950 text-white shadow-2xl transition-all duration-300 ${isDesktop ? (collapsed ? 'w-20' : 'w-72') : 'w-[min(82vw,20rem)]'} ${isDesktop || open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className={`poa-sidebar-close-row flex pt-2 ${collapsed ? 'justify-center' : 'justify-end px-3'}`}><button onClick={toggle} title={collapsed ? 'Expandir menú' : 'Contraer menú'} className="p-2 text-blue-200 hover:text-white"><FaBars /></button></div>
      <div className="poa-sidebar-profile border-b border-blue-800/50 px-4 pb-4"><div className="flex flex-col items-center gap-3 p-2"><div className={collapsed ? 'h-12 w-12' : 'h-40 w-40'}><ProfilePicture user={user} onUpdate={() => {}} /></div>{!collapsed && <div className="min-w-0 text-center"><p className="truncate text-sm font-semibold">{userName(user)}</p><p className="truncate text-xs text-blue-300">{roleName(user)}</p><p className="mt-1 truncate text-[11px] font-semibold text-cyan-200">{poaRoles.includes('elaborador') ? 'Elaborador POA' : 'Consulta POA'}</p></div>}</div></div>
      <nav className="poa-sidebar-nav flex-1 overflow-y-auto py-3"><div className={collapsed ? 'space-y-2 px-2' : 'space-y-1 px-3'}>{section('Inicio')}{link({ name: 'Inicio', icon: FaHome, path: '/poa' })}{section('Planificación')}<button type="button" className={itemClass('/poa/documentos')} title="Documentos POA" onClick={() => { onOpenGestionSelector?.(); afterNavigate(); }}><FaFileAlt className="h-5 w-5 shrink-0" />{!collapsed && <span className="text-sm font-semibold">Documentos POA</span>}</button><button type="button" className={itemClass('/poa/documentos-revision')} title="Revisión POA" onClick={() => { onOpenRevisionBoard?.(); afterNavigate(); }}><FaClipboardCheck className="h-5 w-5 shrink-0" />{!collapsed && <span className="text-sm font-semibold">Revisión POA</span>}</button>{section('Ejecución y materiales')}{link({ name: 'Materiales', icon: FaBoxOpen, path: '/poa/consolidado-requerimientos' })}{section('Configuración')}<button type="button" className={itemClass('/poa/catalogos')} title="Catálogos" onClick={() => { if (collapsed) { toggle(); return; } setCatalogosOpen((value) => !value); }}><FaList className="h-5 w-5 shrink-0" />{!collapsed && <span className="text-sm font-semibold">Catálogos</span>}</button>{catalogosOpen && !collapsed && <CatalogosMenu onMenuClick={() => { setCatalogosOpen(false); afterNavigate(); }} />}{poaPermissions.canManageAccess && link({ name: 'Accesos POA', icon: FaUsers, path: '/poa/accesos' })}{section('Consultas')}{link({ name: 'Reportes', icon: FaFilePdf, path: '/poa/reportes' })}</div></nav>
      <div className="poa-sidebar-footer border-t border-blue-800/50 p-4"><button onClick={() => navigate('/')} title="Panel de módulos" className={`flex w-full items-center gap-4 rounded-lg text-blue-200 hover:bg-red-500/80 hover:text-white ${collapsed ? 'h-14 justify-center' : 'px-4 py-3'}`}><BackIcon className="h-6 w-6" />{!collapsed && <span className="text-sm font-medium">Panel de módulos</span>}</button></div>
    </aside>
  </>;
}
