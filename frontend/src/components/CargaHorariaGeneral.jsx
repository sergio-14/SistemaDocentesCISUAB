import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../apis/api';

// --- ICONOS ---
const SearchIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const UserIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const BriefcaseIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.67.38m-4.5-8.006c-1.572-.236-3.176-.387-4.812-.387s-3.24.15-4.812.387m4.812 0v4.5m0-4.5c.325 0 .649.01.976.029.935.058 1.848.179 2.735.357.811.16 1.596.374 2.343.633.587.204 1.144.457 1.66.754.516.336.991.75 1.39 1.238.358.397.667.857.914 1.368.204.42.36.877.463 1.352M6.75 14.15c-.194.165-.42.295-.67.38m0 0c-.877.294-1.593.766-2.09 1.337A2.18 2.18 0 003.75 17.385v2.866M6.75 14.15a2.18 2.18 0 01.75-1.661V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
  </svg>
);

const CargaHorariaGeneral = ({ isDark }) => {
  const [docentes, setDocentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDocentes = async () => {
      try {
        const response = await api.get('/docentes/');
        setDocentes(response.data.results || response.data);
      } catch (err) {
        console.error("Error fetching docentes:", err);
        setError("No se pudieron cargar los docentes.");
      } finally {
        setLoading(false);
      }
    };
    fetchDocentes();
  }, []);

  const getInitials = (name) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // Lógica robusta para obtener el email
  const getEmail = (docente) => {
    return docente.email || 
           docente.usuario_email || 
           docente.correo || 
           docente.usuario?.email || 
           docente.user?.email || 
           'Sin email registrado';
  };

  const filteredDocentes = docentes.filter(docente => {
    // 🔒 PROTECCIÓN: Optional chaining para todos los accesos
    const fullName = `${docente?.nombres || ''} ${docente?.apellido_paterno || ''} ${docente?.apellido_materno || ''}`.toLowerCase();
    const ci = docente?.ci || '';
    return fullName.includes(searchTerm.toLowerCase()) || ci.includes(searchTerm);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">Cargando docentes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-xl shadow-md">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Gestión de Carga Horaria
              </h1>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                Seleccione un docente para asignar su carga horaria anual.
              </p>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full md:w-96">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre o CI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Grid of Cards */}
        {filteredDocentes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocentes.map((docente) => (
              <div 
                key={docente.id} 
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col overflow-hidden group"
              >
                {/* Card Header with Avatar */}
                <div className="p-6 flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                    {getInitials(docente?.nombre_completo || `${docente?.nombres || ''} ${docente?.apellido_paterno || ''}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white truncate" title={docente?.nombre_completo || 'Sin nombre'}>
                      {docente?.nombre_completo || `${docente?.nombres || ''} ${docente?.apellido_paterno || ''}`}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-1">
                      <span className="text-xs">📧</span> {getEmail(docente)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        docente.activo 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {docente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {docente.vinculos?.[0]?.categoria || 'Docente'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Body Info */}
                <div className="px-6 pb-4 space-y-3 flex-1">
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                    <BriefcaseIcon className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">Dedicación</p>
                      <p className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                        {(() => {
                            const labels = {
                                tiempo_completo: 'Tiempo Completo',
                                medio_tiempo: 'Medio Tiempo',
                                horario_16: 'Horario 16hrs/sem',
                                horario_24: 'Horario 24hrs/sem',
                                horario_40: 'Horario 40hrs/sem',
                                horario_48: 'Horario 48hrs/sem',
                            };
                            return labels[docente?.vinculos?.[0]?.dedicacion] || docente?.vinculos?.[0]?.dedicacion || 'No especificada';
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                    <UserIcon className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">CI</p>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{docente?.ci || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Card Footer Action */}
                <div className="p-4 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700 mt-auto">
                  <Link
                    to={`/fondo-tiempo/docentes/${docente.id}`}
                    className="block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-center font-bold rounded-xl shadow-md hover:shadow-lg transition-all transform hover:scale-[1.02]"
                  >
                    Gestionar Fondo de Tiempo
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-dashed">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <SearchIcon className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No se encontraron docentes</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Intenta con otro término de búsqueda.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CargaHorariaGeneral;
