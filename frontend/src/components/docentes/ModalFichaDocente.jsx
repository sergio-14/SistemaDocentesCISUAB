import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BadgeCheck, CalendarClock, Pencil, Phone } from 'lucide-react';
import api from '../../apis/api';
import { fechaCorta } from '../../utils/fechas';
import { getApiErrorMessage } from '../../utils/formErrors';
import ModalCentrado from '../common/ModalCentrado';
import { Cargando, Datos, SinDatos, Tarjeta } from '../cuenta/Bloques';
import { Avatar, Etiqueta } from '../fondos/ElementosFondo';
import { BLOQUE, BOTON, BOTON_CHICO } from '../fondos/estilosFondo';

const inputCls = 'w-full h-10 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-1 ring-inset ring-azulado-300 focus:ring-2 focus:ring-blue-900/40 !bg-azulado-100';

// Teléfono y correo: quien puede los completa aquí mismo, aunque la ficha esté fija.
function Contacto({ docente, puedeEditar, onGuardado }) {
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState({ telefono: '', email: '' });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const empezar = () => {
    setDatos({ telefono: docente.telefono || '', email: docente.email || '' });
    setErrores({});
    setEditando(true);
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    try {
      const { data } = await api.patch(`/docentes/${docente.id}/datos-contacto/`, datos);
      toast.success('Datos de contacto guardados');
      setEditando(false);
      onGuardado(data);
    } catch (err) {
      const respuesta = err.response?.status === 400 ? err.response.data : null;
      if (respuesta) setErrores(respuesta);
      else toast.error(getApiErrorMessage(err, 'No se pudieron guardar los datos de contacto.'));
    } finally {
      setGuardando(false);
    }
  };

  const error = (campo) => (Array.isArray(errores[campo]) ? errores[campo].join(' ') : errores[campo]);
  const accion = puedeEditar && !editando ? (
    <button type="button" onClick={empezar} className={`${BOTON_CHICO} bg-blue-900 hover:bg-blue-950 text-white`}>
      <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
      <span>Completar</span>
    </button>
  ) : null;

  return (
    <Tarjeta titulo="Contacto" icono={Phone} accion={accion}>
      {editando ? (
        <form onSubmit={guardar} noValidate className="flex flex-1 flex-col gap-3">
          {[['telefono', 'Teléfono', 'tel', 'Ej. 71234567'], ['email', 'Correo', 'email', 'nombre@uabjb.edu.bo']].map(([campo, etiqueta, tipo, ayuda]) => (
            <div key={campo}>
              <label htmlFor={`ficha-${campo}`} className="text-xs font-medium text-slate-600">{etiqueta}</label>
              <input
                id={`ficha-${campo}`}
                type={tipo}
                value={datos[campo]}
                placeholder={ayuda}
                onChange={(e) => { setDatos((previo) => ({ ...previo, [campo]: e.target.value })); setErrores((previo) => ({ ...previo, [campo]: undefined })); }}
                className={`mt-1 ${inputCls} ${error(campo) ? '!ring-red-300' : ''}`}
              />
              {error(campo) && <p className="mt-1 px-1 text-xs text-red-600">{error(campo)}</p>}
            </div>
          ))}
          <div className="mt-auto pt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)} disabled={guardando} className={`${BOTON} text-slate-600 hover:text-blue-900`}>Cancelar</button>
            <button type="submit" disabled={guardando} className={`${BOTON} bg-blue-900 hover:bg-blue-950 text-white disabled:opacity-60`}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      ) : (
        <Datos datos={[
          { label: 'Teléfono', valor: docente.telefono || <span className="font-medium text-slate-500">Sin teléfono</span> },
          { label: 'C.I.', valor: docente.ci || '—' },
          { label: 'Correo', valor: docente.email || docente.usuario_email || <span className="font-medium text-slate-500">Sin correo</span>, ancho: true },
        ]}
        />
      )}
    </Tarjeta>
  );
}

// Ficha del docente en una ventana con el diseño de Mi cuenta: a la izquierda la tarjeta
// del docente y a la derecha tarjetas en pares de igual altura. Solo lectura, salvo el
// teléfono y el correo (superusuario, Director o Jefe de su carrera: puedeEditarContacto).
function ModalFichaDocente({ docenteId, puedeEditarContacto, onClose, onActualizado }) {
  const [docente, setDocente] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/docentes/${docenteId}/`)
      .then((respuesta) => setDocente(respuesta.data))
      .catch((err) => setError(getApiErrorMessage(err, 'No se pudo cargar la ficha del docente.')));
  }, [docenteId]);

  useEffect(() => {
    const alPulsar = (evento) => {
      if (evento.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onClose]);

  const vinculos = (docente?.vinculos || []).filter((vinculo) => vinculo.activo !== false);
  const anios = Number(docente?.antiguedad) || 0;

  let contenido;
  if (error) contenido = <Tarjeta titulo="Ficha" ancha><SinDatos>{error}</SinDatos></Tarjeta>;
  else if (!docente) contenido = <Tarjeta titulo="Ficha" ancha><Cargando /></Tarjeta>;
  else {
    contenido = (
      <>
        <Contacto
          docente={docente}
          puedeEditar={puedeEditarContacto}
          onGuardado={(actualizado) => { setDocente(actualizado); onActualizado?.(actualizado); }}
        />
        <Tarjeta titulo="Vínculo" icono={BadgeCheck}>
          {vinculos.length === 0 ? <SinDatos>Sin vínculo activo</SinDatos> : (
            <Datos datos={[
              { label: vinculos.length > 1 ? 'Carreras' : 'Carrera', valor: vinculos.map((v) => v.carrera_nombre).join(', ') },
              { label: 'Condición', valor: vinculos.map((v) => v.tipo_condicion).join(', ') || '—' },
              { label: 'Categoría', valor: vinculos.map((v) => v.tipo_categoria).join(', ') || '—' },
              { label: 'Dedicación', valor: vinculos.map((v) => v.tipo_dedicacion).join(', ') || '—' },
            ]}
            />
          )}
        </Tarjeta>
        <Tarjeta titulo="Antigüedad y vacación" icono={CalendarClock} ancha>
          <Datos datos={[
            { label: 'Fecha de ingreso', valor: <span className="tabular-nums">{fechaCorta(docente.fecha_ingreso)}</span> },
            { label: 'Antigüedad', valor: `${anios} ${anios === 1 ? 'año' : 'años'}` },
            { label: 'Vacación', valor: `${docente.dias_vacacion ?? 0} días hábiles por gestión` },
          ]}
          />
          <p className="mt-auto pt-4 text-xs text-slate-500">
            {docente.tiene_historial
              ? 'Ficha fija: el docente tiene un Fondo de Tiempo presentado o informes. Solo el teléfono y el correo se pueden completar.'
              : 'La vacación sale de la antigüedad en años completos: 15 días desde 1 año, 20 desde 5 y 30 desde 10.'}
          </p>
        </Tarjeta>
      </>
    );
  }

  return (
    <ModalCentrado onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Ficha del docente" className="w-full max-w-5xl overflow-hidden rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Ficha del docente</p>
            <h3 className="text-xl font-bold text-slate-800">{docente?.nombre_completo || 'Docente'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-azulado-200 hover:text-slate-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto bg-azulado-100 p-4 sm:p-5 [border-top:1px_solid_#B8C9E1]">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
            <aside className={`${BLOQUE} p-6 flex flex-col items-center text-center`}>
              <Avatar nombre={docente?.nombre_completo} size="w-24 h-24 text-2xl" />
              <h2 className="mt-4 text-lg font-bold text-blue-900 leading-tight break-words">{docente?.nombre_completo || '—'}</h2>
              {docente?.usuario_nombre && <p className="text-sm text-slate-600 break-all">{docente.usuario_nombre}</p>}
              <p className="mt-2 text-sm font-semibold text-blue-800">Docente</p>
              {vinculos.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {vinculos.map((vinculo) => <Etiqueta key={vinculo.id || vinculo.carrera}>{vinculo.carrera_nombre}</Etiqueta>)}
                </div>
              )}
              {docente && (
                <span className={`mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
                  docente.activo ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-red-50 text-red-800 ring-red-200'
                }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${docente.activo ? 'bg-emerald-600' : 'bg-red-600'}`} />
                  {docente.activo ? 'Activo' : 'Inactivo'}
                </span>
              )}
            </aside>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{contenido}</div>
          </div>
        </div>
      </div>
    </ModalCentrado>
  );
}

export default ModalFichaDocente;
