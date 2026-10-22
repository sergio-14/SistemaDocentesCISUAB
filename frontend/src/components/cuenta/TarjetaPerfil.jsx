import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, LogIn, Trash2 } from 'lucide-react';
import { deleteProfilePicture, uploadProfilePicture } from '../../apis/api';
import { ZONA_HORARIA_BOLIVIA, diasDesdeHoy, fechaBoliviaDe } from '../../utils/fechas';
import { getApiErrorMessage } from '../../utils/formErrors';
import ModalConfirmar from '../common/ModalConfirmar';
import { Etiqueta } from '../fondos/ElementosFondo';
import { BLOQUE, BOTON_CHICO } from '../fondos/estilosFondo';
import { EVENTO_FOTO_PERFIL_ACTUALIZADA } from '../ProfilePicture';
import FotoPerfil from './FotoPerfil';

const ultimoIngreso = (iso) => {
  if (!iso) return { fecha: 'Sin registro', relativo: '' };
  const fecha = new Date(iso).toLocaleString('es-BO', {
    timeZone: ZONA_HORARIA_BOLIVIA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const dias = -diasDesdeHoy(fechaBoliviaDe(iso));
  let relativo = 'hoy';
  if (dias === 1) relativo = 'ayer';
  else if (dias > 1) relativo = `hace ${dias} días`;
  return { fecha, relativo };
};

// Tarjeta angosta de Mi cuenta: foto (subir, cambiar o eliminar), nombre, rol activo,
// carrera(s) y último ingreso.
// franja: en escritorio (xl) la tarjeta va arriba, horizontal y baja, para que las tres
// columnas de bloques usen todo el ancho de la ventana.
function TarjetaPerfil({ user, rol, carreras, ultimoIngresoIso, onProfileUpdate, franja = false }) {
  const entradaRef = useRef(null);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const esPropia = Boolean(user?.perfil?.foto_perfil_es_propia);
  const nombre = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username;
  const ingreso = ultimoIngreso(ultimoIngresoIso);

  useEffect(() => () => {
    if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  const avisarCambio = () => {
    window.dispatchEvent(new Event(EVENTO_FOTO_PERFIL_ACTUALIZADA));
    onProfileUpdate?.();
  };

  const subir = async (evento) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    setVistaPrevia(URL.createObjectURL(archivo));
    setSubiendo(true);
    try {
      await uploadProfilePicture(archivo);
      toast.success('Foto de perfil actualizada');
      avisarCambio();
    } catch (err) {
      setVistaPrevia(null);
      toast.error(getApiErrorMessage(err, 'No se pudo subir la foto.'));
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = async () => {
    try {
      await deleteProfilePicture();
    } catch (err) {
      throw new Error(getApiErrorMessage(err, 'No se pudo eliminar la foto.'));
    }
    setVistaPrevia(null);
    setConfirmarEliminar(false);
    toast.success('Foto eliminada');
    avisarCambio();
  };

  const x = (clases) => (franja ? clases : '');
  return (
    <aside className={`${BLOQUE} p-6 flex flex-col items-center text-center ${x('xl:flex-row xl:items-center xl:gap-5 xl:py-3 xl:text-left')}`}>
      <div className={`w-28 h-28 flex-shrink-0 ${x('xl:w-16 xl:h-16')}`}>
        {vistaPrevia
          ? <img src={vistaPrevia} alt="Perfil" className="w-full h-full rounded-full object-cover bg-white shadow-md" />
          : <FotoPerfil user={user} />}
      </div>
      <input ref={entradaRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={subir} />
      <div className={`mt-3 flex flex-wrap justify-center gap-2 ${x('xl:order-3 xl:mt-0 xl:ml-auto')}`}>
        <button
          type="button"
          onClick={() => entradaRef.current?.click()}
          disabled={subiendo}
          className={`${BOTON_CHICO} bg-blue-900 hover:bg-blue-950 text-white disabled:opacity-60`}
        >
          <Camera className="w-3.5 h-3.5" strokeWidth={2} />
          <span>{subiendo ? 'Subiendo...' : esPropia ? 'Cambiar' : 'Subir foto'}</span>
        </button>
        {esPropia && (
          <button
            type="button"
            onClick={() => setConfirmarEliminar(true)}
            disabled={subiendo}
            className={`${BOTON_CHICO} bg-red-400 hover:bg-red-500 text-white disabled:opacity-60`}
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Eliminar</span>
          </button>
        )}
      </div>

      <div className={`flex flex-col items-center min-w-0 ${x('xl:order-2 xl:items-start')}`}>
        <div className={`flex flex-col items-center ${x('xl:flex-row xl:items-baseline xl:gap-2')}`}>
          <h2 className={`mt-4 text-lg font-bold text-blue-900 leading-tight break-words ${x('xl:mt-0')}`}>{nombre}</h2>
          <p className="text-sm text-slate-600 break-all">@{user?.username}</p>
        </div>
        <div className={`mt-2 flex flex-wrap items-center justify-center gap-1.5 ${x('xl:justify-start')}`}>
          <span className={`text-sm font-semibold text-blue-800 w-full ${x('xl:w-auto')}`}>{rol}</span>
          {carreras.map((carrera) => <Etiqueta key={carrera}>{carrera}</Etiqueta>)}
        </div>
      </div>

      <div className={`mt-5 w-full pt-4 [border-top:1px_solid_#B8C9E1] text-left ${x('xl:order-4 xl:mt-0 xl:w-auto xl:pt-0 xl:pl-5 xl:[border-top:0] xl:[border-left:1px_solid_#B8C9E1]')}`}>
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <LogIn className="w-3.5 h-3.5" strokeWidth={1.75} />
          Último ingreso
        </p>
        <p className="mt-0.5 text-sm font-bold text-slate-900 tabular-nums">{ingreso.fecha}</p>
        {ingreso.relativo && <p className="text-xs text-slate-500">{ingreso.relativo}</p>}
      </div>

      {confirmarEliminar && (
        <ModalConfirmar
          titulo="¿Eliminar foto de perfil?"
          etiqueta="Mi cuenta"
          mensaje="Se mostrará la imagen predeterminada."
          tono="peligro"
          textoAccion="Eliminar foto"
          textoTrabajando="Eliminando..."
          onConfirmar={eliminar}
          onCancelar={() => setConfirmarEliminar(false)}
        />
      )}
    </aside>
  );
}

export default TarjetaPerfil;
