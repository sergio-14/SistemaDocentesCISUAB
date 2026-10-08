import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../apis/api';
import ModalCentrado from '../common/ModalCentrado';
import { BOTON } from '../fondos/estilosFondo';
import { AvisoUsuario } from './PiezasFormularioUsuario';

const ROLES = {
  iiisyp: 'Instituto de investigación',
  director: 'Director de Carrera',
  jefe_estudios: 'Jefe de Estudios',
  docente: 'Docente',
};

const fecha = (valor) => {
  if (!valor) return '—';
  const dia = new Date(String(valor).length === 10 ? `${valor}T00:00:00` : valor);
  return Number.isNaN(dia.getTime()) ? '—' : dia.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Cuadro del perfil con su título.
const Cuadro = ({ titulo, children, className = '' }) => (
  <section className={`rounded-2xl bg-white ring-1 ring-inset ring-azulado-300 p-4 ${className}`}>
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-blue-700">{titulo}</h3>
    {children}
  </section>
);

// Mensaje que aparece al pasar el cursor (o con el foco) sobre un botón que no se puede usar.
const ConMensaje = ({ mensaje, children }) => (
  <div className="relative group">
    {children}
    {mensaje && (
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden w-72 rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium leading-snug text-white shadow-lg group-hover:block group-focus-within:block"
      >
        {mensaje}
      </span>
    )}
  </div>
);

const Dato = ({ etiqueta, children }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5 [&+&]:[border-top:1px_solid_#E3EAF5]">
    <dt className="text-xs font-semibold text-slate-500">{etiqueta}</dt>
    <dd className="text-sm font-semibold text-slate-800 text-right break-words min-w-0">{children}</dd>
  </div>
);

/**
 * Perfil de un usuario (botón "Ver" de la lista): cuenta, carrera y roles, ficha de
 * docente y datos registrados, con Editar y Eliminar. Si alguno no se puede usar, el
 * motivo se muestra en un cuadro junto a los botones.
 */
function PerfilUsuario({
  usuario,
  foto,
  chipsRoles,
  mostrarCarrera,
  puedeEliminarUsuarios,
  motivoEditar,
  motivoEliminar,
  verificandoEliminar,
  onEditar,
  onEliminar,
  onCerrar,
}) {
  const [datos, setDatos] = useState(null);
  const [errorDatos, setErrorDatos] = useState('');

  // Los datos registrados (lo que impide eliminarlo) se piden al abrir el perfil.
  useEffect(() => {
    let vigente = true;
    api.get(`/usuarios/${usuario.id}/dependencias/`)
      .then(({ data }) => { if (vigente) setDatos(data || {}); })
      .catch(() => { if (vigente) setErrorDatos('No se pudo consultar si tiene datos registrados.'); });
    return () => { vigente = false; };
  }, [usuario.id]);

  // Escape cierra el perfil (no si encima está abierta una confirmación: esa se cierra sola).
  useEffect(() => {
    const alPulsar = (event) => {
      if (event.key !== 'Escape' || document.querySelector('[role="alertdialog"]')) return;
      onCerrar();
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  const perfil = usuario.perfil || {};
  const asignaciones = (usuario.asignaciones || []).filter((item) => item.activo !== false);
  const nombre = usuario.nombre_completo || `${usuario.first_name || ''} ${usuario.last_name || ''}`.trim() || usuario.username;
  const tieneDocente = Boolean(perfil.docente_id);
  const esDocente = perfil.rol === 'docente' || asignaciones.some((item) => item.rol === 'docente');
  // Con datos registrados el backend no lo deja eliminar: se avisa antes de pulsar.
  const motivoNoEliminar = motivoEliminar
    || (datos?.tiene_datos ? 'No se puede eliminar: tiene datos registrados. Desactívelo en su lugar.' : '');
  const motivos = [...new Set([motivoEditar, puedeEliminarUsuarios ? motivoNoEliminar : ''].filter(Boolean))];

  // Editar y Eliminar siempre se pueden pulsar: si no se puede, el motivo sale como
  // error en el perfil y en el toast.
  const [errorAccion, setErrorAccion] = useState('');
  const intentar = (motivo, accion) => {
    if (motivo) {
      setErrorAccion(motivo);
      toast.error(motivo);
      return;
    }
    setErrorAccion('');
    accion();
  };

  return (
    <ModalCentrado onClose={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="perfil-usuario-titulo"
        className="w-full max-w-5xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up"
        style={{ animationDuration: '180ms' }}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-6 pb-5 [border-bottom:1px_solid_#B8C9E1]">
          <div className="flex items-center gap-4 min-w-0">
            {foto}
            <div className="min-w-0">
              <h2 id="perfil-usuario-titulo" className="text-xl font-bold text-blue-900 leading-tight truncate">{nombre}</h2>
              <p className="text-sm text-slate-600 truncate">@{usuario.username}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
                  usuario.is_active ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'
                }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${usuario.is_active ? 'bg-emerald-600' : 'bg-red-500'}`} />
                  {usuario.is_active ? 'Activo' : 'Inactivo'}
                </span>
                {chipsRoles}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex-shrink-0 rounded-full p-2 -mr-2 text-slate-500 hover:text-blue-900 hover:bg-azulado-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Cuadro titulo="Cuenta">
            <dl>
              <Dato etiqueta="Correo">{usuario.email || '—'}</Dato>
              <Dato etiqueta="C.I.">{usuario.ci || '—'}</Dato>
              <Dato etiqueta="Teléfono">{usuario.telefono || perfil.telefono || '—'}</Dato>
              <Dato etiqueta="Alta en el sistema">{fecha(usuario.date_joined)}</Dato>
              <Dato etiqueta="Contraseña">{perfil.debe_cambiar_password ? 'Debe cambiarla al iniciar sesión' : 'Personal (ya la cambió)'}</Dato>
            </dl>
          </Cuadro>

          <Cuadro titulo={mostrarCarrera ? 'Carrera y roles' : 'Roles'}>
            {mostrarCarrera && (
              <div className="mb-3 rounded-xl bg-azulado-100 ring-1 ring-inset ring-azulado-300 px-3 py-2.5">
                <p className="text-xs font-semibold text-slate-500">Carrera vinculada</p>
                <p className="mt-0.5 text-sm font-bold text-blue-900">
                  {perfil.carrera_nombre || 'Sin carrera'}
                  {usuario.carrera_codigo && <span className="ml-1.5 font-semibold text-slate-500">({usuario.carrera_codigo})</span>}
                </p>
              </div>
            )}
            {asignaciones.length === 0 ? (
              <p className="text-sm text-slate-600">Sin roles asignados.</p>
            ) : (
              <ul className="space-y-1.5">
                {asignaciones.map((item) => (
                  <li key={item.id || `${item.rol}-${item.carrera}`} className="flex items-center justify-between gap-3 rounded-xl bg-sky-600/80 px-3 py-2 text-sm font-semibold text-white">
                    <span>{item.rol_display || ROLES[item.rol] || item.rol}{item.rol === perfil.rol && asignaciones.length > 1 ? ' · Principal' : ''}</span>
                    {item.resolucion_consejo && (
                      <a
                        href={item.resolucion_consejo}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30"
                      >
                        Ver resolución
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Cuadro>

          <Cuadro titulo="Ficha de docente">
            {tieneDocente ? (
              <dl>
                <Dato etiqueta="Docente vinculado">{perfil.docente_nombre || '—'}</Dato>
                <Dato etiqueta="Fecha de ingreso">{fecha(perfil.fecha_ingreso)}</Dato>
                <Dato etiqueta="Antigüedad">{perfil.antiguedad != null ? `${perfil.antiguedad} año${perfil.antiguedad === 1 ? '' : 's'}` : '—'}</Dato>
                <Dato etiqueta="Vacaciones">{perfil.dias_vacacion != null ? `${perfil.dias_vacacion} días` : '—'}</Dato>
              </dl>
            ) : (
              <p className={`rounded-xl px-3 py-2.5 text-xs leading-snug ring-1 ring-inset ${
                esDocente ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-azulado-100 text-slate-700 ring-azulado-300'
              }`}
              >
                {esDocente
                  ? 'Tiene el rol Docente pero aún no tiene ficha: su parte docente (fondo de tiempo y carga horaria) queda pendiente. Se crea en Docentes > Nuevo docente.'
                  : 'No tiene ficha de docente: no tiene el rol Docente.'}
              </p>
            )}
          </Cuadro>

          <Cuadro titulo="Datos registrados">
            {errorDatos ? (
              <p className="rounded-xl bg-red-50 ring-1 ring-inset ring-red-200 px-3 py-2 text-xs text-red-700">{errorDatos}</p>
            ) : !datos ? (
              <p className="text-sm text-slate-500">Consultando…</p>
            ) : datos.tiene_datos ? (
              <>
                <ul className="flex flex-wrap gap-1.5">
                  {(datos.detalle || []).map((item) => (
                    <li key={item.clave || item.etiqueta} className="rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {item.etiqueta}: <span className="text-blue-900">{item.cantidad}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <AvisoUsuario>Por estos datos no se puede eliminar ni cambiar su usuario, nombre, C.I. ni carrera.</AvisoUsuario>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-700">
                Sin datos registrados: se puede eliminar.
                {datos.ficha_docente && <span className="text-slate-500"> Al eliminarlo se borra también su ficha de docente.</span>}
              </p>
            )}
          </Cuadro>
        </div>

        <div className="px-5 sm:px-6 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between [border-top:1px_solid_#B8C9E1]">
          <div className="min-w-0 space-y-1.5">
            {errorAccion ? (
              <p role="alert" className="rounded-xl bg-red-50 ring-1 ring-inset ring-red-200 px-3 py-2.5 text-sm font-medium leading-snug text-red-700">{errorAccion}</p>
            ) : (
              motivos.map((motivo) => <AvisoUsuario key={motivo}>{motivo}</AvisoUsuario>)
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onCerrar}
              className={`${BOTON} px-5 py-2.5 bg-white text-slate-700 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100`}
            >
              Cerrar
            </button>
            {puedeEliminarUsuarios && (
              <ConMensaje mensaje={motivoNoEliminar}>
                <button
                  data-escritura
                  type="button"
                  onClick={() => intentar(motivoNoEliminar, onEliminar)}
                  disabled={verificandoEliminar}
                  className={`${BOTON} w-full px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white disabled:opacity-60 ${motivoNoEliminar ? 'opacity-70' : ''}`}
                >
                  {verificandoEliminar ? 'Verificando...' : 'Eliminar'}
                </button>
              </ConMensaje>
            )}
            <ConMensaje mensaje={motivoEditar}>
              <button
                data-escritura
                type="button"
                onClick={() => intentar(motivoEditar, onEditar)}
                className={`${BOTON} w-full px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm ${motivoEditar ? 'opacity-70' : ''}`}
              >
                Editar
              </button>
            </ConMensaje>
          </div>
        </div>
      </div>
    </ModalCentrado>
  );
}

export default PerfilUsuario;
