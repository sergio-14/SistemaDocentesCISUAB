import { useState, useEffect, useRef } from 'react';
import api from '../apis/api';
import toast from 'react-hot-toast';

function MenuReportes({ fondo, usuarioActual }) {
  const [expandido, setExpandido] = useState(false);
  const [hoveredButton, setHoveredButton] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(null); // 'pdf', 'certificado', 'excel', null
  const menuRef = useRef(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setExpandido(false);
      }
    };

    if (expandido) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expandido]);

  // Cerrar modal con ESC
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setModalAbierto(null);
      }
    };

    if (modalAbierto) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [modalAbierto]);

  // Verificar si puede mostrar certificado
  const puedeVerCertificado = fondo.estado === 'finalizado' && fondo.informe?.resultado === 'APROBADO';

  // Verificar si es admin
  const esAdmin = usuarioActual?.is_staff;

  // Abrir modales
  const abrirModalPDF = () => {
    setModalAbierto('pdf');
    setExpandido(false);
  };

  const abrirModalCertificado = () => {
    setModalAbierto('certificado');
    setExpandido(false);
  };

  const abrirModalExcel = () => {
    setModalAbierto('excel');
    setExpandido(false);
  };

  // Descargar PDF Individual
  const descargarPDF = async () => {
    try {
      toast.loading('Generando reporte PDF completo...');
      setModalAbierto(null);
      
      const response = await api.get(`/fondos-tiempo/${fondo.id}/pdf/`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const nombreArchivo = `Fondo_${fondo.docente?.nombre_completo?.replace(/ /g, '_')}_${fondo.gestion}_${fondo.periodo}.pdf`;
      link.setAttribute('download', nombreArchivo);
      
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.dismiss();
      toast.success('📄 Reporte PDF descargado exitosamente');
      
    } catch (error) {
      toast.dismiss();
      console.error('Error al descargar PDF:', error);
      toast.error('❌ Error al generar el reporte PDF');
    }
  };

  // Descargar Certificado
  const descargarCertificado = async () => {
    try {
      toast.loading('Generando certificado oficial...');
      setModalAbierto(null);
      
      const response = await api.get(`/fondos-tiempo/${fondo.id}/certificado/`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const nombreArchivo = `Certificado_${fondo.docente?.nombre_completo?.replace(/ /g, '_')}_${fondo.gestion}.pdf`;
      link.setAttribute('download', nombreArchivo);
      
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.dismiss();
      toast.success('📜 Certificado descargado exitosamente');
      
    } catch (error) {
      toast.dismiss();
      console.error('Error al descargar certificado:', error);
      toast.error('❌ Error al generar el certificado');
    }
  };

  // Descargar Excel
  const descargarExcel = async () => {
    try {
      toast.loading('Generando archivo Excel...');
      setModalAbierto(null);
      
      const response = await api.get(`/fondos-tiempo/${fondo.id}/excel/`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const nombreArchivo = `Fondo_${fondo.docente?.nombre_completo?.replace(/ /g, '_')}_${fondo.gestion}.xlsx`;
      link.setAttribute('download', nombreArchivo);
      
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.dismiss();
      toast.success('📊 Excel descargado exitosamente');
      
    } catch (error) {
      toast.dismiss();
      console.error('Error al descargar Excel:', error);
      toast.error('❌ Error al generar el Excel');
    }
  };

  return (
    <>
      <div ref={menuRef} className="fixed bottom-[5.5rem] right-6 z-30">
        <div className="flex items-center gap-3">
          {/* Botones desplegables */}
          <div className="flex items-center gap-3">
            {/* Certificado */}
            {expandido && puedeVerCertificado && (
              <div className="relative">
                <button
                  onClick={abrirModalCertificado}
                  onMouseEnter={() => setHoveredButton('certificado')}
                  onMouseLeave={() => setHoveredButton(null)}
                  className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 rounded-full shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-110 flex items-center justify-center text-white group animate-slide-in-left"
                  style={{ animationDelay: '0.2s' }}
                >
                  <svg className="w-7 h-7 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                    <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </button>
                {hoveredButton === 'certificado' && (
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-xl animate-fade-in z-50">
                    <div className="font-bold">Certificado de Cumplimiento</div>
                    <div className="text-slate-300">Documento oficial firmado</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-8 border-transparent border-t-slate-900 dark:border-t-slate-700"></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PDF Individual */}
            {expandido && (
              <div className="relative">
                <button
                  onClick={abrirModalPDF}
                  onMouseEnter={() => setHoveredButton('pdf')}
                  onMouseLeave={() => setHoveredButton(null)}
                  className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-110 flex items-center justify-center text-white group animate-slide-in-left"
                  style={{ animationDelay: '0.1s' }}
                >
                  <svg className="w-7 h-7 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                </button>
                {hoveredButton === 'pdf' && (
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-xl animate-fade-in z-50">
                    <div className="font-bold">Reporte Individual Completo</div>
                    <div className="text-slate-300">PDF con toda la información</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-8 border-transparent border-t-slate-900 dark:border-t-slate-700"></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Excel */}
            {expandido && esAdmin && (
              <div className="relative">
                <button
                  onClick={abrirModalExcel}
                  onMouseEnter={() => setHoveredButton('excel')}
                  onMouseLeave={() => setHoveredButton(null)}
                  className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-full shadow-2xl hover:shadow-green-500/50 transition-all duration-300 hover:scale-110 flex items-center justify-center text-white group animate-slide-in-left"
                  style={{ animationDelay: '0s' }}
                >
                  <svg className="w-7 h-7 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                  </svg>
                </button>
                {hoveredButton === 'excel' && (
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-xl animate-fade-in z-50">
                    <div className="font-bold">Exportar a Excel</div>
                    <div className="text-slate-300">Archivo para análisis</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-8 border-transparent border-t-slate-900 dark:border-t-slate-700"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botón principal REPORTES */}
          <div className="relative">
            <button
              onClick={() => setExpandido(!expandido)}
              onMouseEnter={() => setHoveredButton('reportes')}
              onMouseLeave={() => setHoveredButton(null)}
              className={`w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-110 flex items-center justify-center text-white group ${
                expandido ? 'ring-4 ring-blue-300 dark:ring-blue-700' : ''
              }`}
            >
              <svg className={`w-7 h-7 transition-all duration-300 ${expandido ? 'scale-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <div className={`absolute -right-1 -bottom-1 w-5 h-5 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center transition-transform duration-300 ${expandido ? 'rotate-180' : ''}`}>
                <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            </button>
            {hoveredButton === 'reportes' && !expandido && (
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-xl animate-fade-in z-50">
                <div className="font-bold">Reportes y Exportaciones</div>
                <div className="text-slate-300">Click para ver opciones</div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="border-8 border-transparent border-t-slate-900 dark:border-t-slate-700"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Estilos de animación */}
        <style>{`
          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(20px) scale(0.8);
            }
            to {
              opacity: 1;
              transform: translateX(0) scale(1);
            }
          }

          .animate-slide-in-left {
            animation: slideInLeft 0.3s ease-out forwards;
            opacity: 0;
          }
        `}</style>
      </div>

      {/* MODAL PDF */}
      {modalAbierto === 'pdf' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-scale-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Reporte Individual</h3>
                  <p className="text-blue-100 text-sm">PDF Completo</p>
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-4">
              <p className="text-slate-700 dark:text-slate-300">
                Este reporte contiene toda la información del fondo de tiempo:
              </p>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
                {[
                  'Portada profesional con logo UAB-JB',
                  'Resumen ejecutivo y estadísticas',
                  'Información completa del docente',
                  'Distribución de horas por categoría',
                  'Gráfico circular de distribución',
                  'Detalle completo de todas las actividades',
                  'Historial de observaciones (si existen)',
                  'Informe de cumplimiento y evaluación',
                  'Firma digital del director'
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-slate-600 dark:text-slate-300">{item}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Formato:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">PDF</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-600 dark:text-slate-400">Tamaño estimado:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">2-5 páginas</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex gap-3 justify-end border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setModalAbierto(null)}
                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-all font-medium hover:scale-105"
              >
                Cancelar
              </button>
              <button
                onClick={descargarPDF}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CERTIFICADO */}
      {modalAbierto === 'certificado' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-scale-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-500 to-amber-600 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                    <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Certificado Oficial</h3>
                  <p className="text-yellow-100 text-sm">Documento Institucional</p>
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-4">
              <p className="text-slate-700 dark:text-slate-300">
                Certificado oficial de cumplimiento del fondo de tiempo:
              </p>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 space-y-2">
                {[
                  'Documento formal con logo UAB-JB',
                  'Certificación de cumplimiento',
                  'Información del docente y periodo',
                  'Total de horas cumplidas',
                  'Firma del Director de Carrera',
                  'Sello institucional oficial',
                  'Código de verificación único',
                  'Formato para impresión'
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-slate-600 dark:text-slate-300">{item}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Formato:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">PDF Formal</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-600 dark:text-slate-400">Páginas:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">1 página</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-600 dark:text-slate-400">Disponible:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">Solo fondos finalizados</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex gap-3 justify-end border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setModalAbierto(null)}
                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-all font-medium hover:scale-105"
              >
                Cancelar
              </button>
              <button
                onClick={descargarCertificado}
                className="px-5 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar Certificado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCEL */}
      {modalAbierto === 'excel' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-scale-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Exportar a Excel</h3>
                  <p className="text-green-100 text-sm">Análisis de Datos</p>
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-4">
              <p className="text-slate-700 dark:text-slate-300">
                Archivo Excel con datos estructurados para análisis:
              </p>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 space-y-2">
                {[
                  'Hoja de resumen general',
                  'Tabla de distribución por categoría',
                  'Detalle completo de actividades',
                  'Horas semanales y anuales',
                  'Porcentajes calculados',
                  'Gráficos integrados',
                  'Formato con colores institucionales',
                  'Listo para tablas dinámicas'
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-slate-600 dark:text-slate-300">{item}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Formato:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Excel (.xlsx)</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-slate-600 dark:text-slate-400">Compatible:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Excel, Google Sheets</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex gap-3 justify-end border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setModalAbierto(null)}
                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-all font-medium hover:scale-105"
              >
                Cancelar
              </button>
              <button
                onClick={descargarExcel}
                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl transition-all font-medium shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilo adicional para modal */}
      <style>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-scale-in {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

export default MenuReportes;