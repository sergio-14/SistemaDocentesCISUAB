import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Trash2 } from 'lucide-react';
import api, { deleteProfilePicture, uploadProfilePicture } from '../../apis/api';
import { useActiveRole } from '../../contexts/activeRole';
import { getApiErrorMessage } from '../../utils/formErrors';
import ModalConfirmar from '../common/ModalConfirmar';
import { BLOQUE, BOTON_CHICO } from '../fondos/estilosFondo';
import { EVENTO_FOTO_PERFIL_ACTUALIZADA } from '../ProfilePicture';
import FotoPerfil from './FotoPerfil';

const fecha = (iso) => {
  const [anio, mes, dia] = String(iso || '').split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '—';
};

function ListaDatos({ datos }) {
  return (
    <dl className="divide-y divide-azulado-300">
      {datos.map((dato) => (
        <div key={dato.label} className="grid gap-1 px-3 py-3.5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-sm font-semibold text-blue-800">{dato.label}</dt>
          <dd className="text-sm font-medium text-slate-900 break-words">{dato.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

// Foto propia: cambiarla (PNG o JPG) o eliminarla para volver a la predeterminada.
function FotoEditable({ user, onProfileUpdate }) {
  const entradaRef = useRef(null);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const esPropia = Boolean(user?.perfil?.foto_perfil_es_propia);

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

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-28 h-28 sm:w-32 sm:h-32">
        {vistaPrevia
          ? <img src={vistaPrevia} alt="Foto de perfil" className="w-full h-full rounded-full object-cover bg-white shadow-md" />
          : <FotoPerfil user={user} />}
      </div>
      <input ref={entradaRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={subir} />
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => entradaRef.current?.click()}
          disabled={subiendo}
          className={`${BOTON_CHICO} bg-blue-900 hover:bg-blue-950 text-white disabled:opacity-60`}
        >
          <Camera className="w-3.5 h-3.5" strokeWidth={2} />
          <span>{subiendo ? 'Subiendo...' : esPropia ? 'Cambiar foto' : 'Subir foto'}</span>
        </button>
        {esPropia && (
          <button
            type="button"
            onClick={() => setConfirmarEliminar(true)}
            disabled={subiendo}
            className={`${BOTON_CHICO} bg-azulado-100 ring-1 ring-inset ring-azulado-300 text-red-700 hover:bg-red-50 disabled:opacity-60`}
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Eliminar foto</span>
          </button>
        )}
      </div>

      {confirmarEliminar && (
        <ModalConfirmar
          titulo="¿Eliminar foto de perfil?"
          etiqueta="Mi cuenta"
          mensaje="Se mostrará la imagen predeterminada (o el logo de su carrera)."
          tono="peligro"
          textoAccion="Eliminar foto"
          textoTrabajando="Eliminando..."
          onConfirmar={eliminar}
          onCancelar={() => setConfirmarEliminar(false)}
        />
      )}
    </div>
  );
}

// Datos de la ficha docente (los registra la Dirección de Carrera): antes, "Mi perfil".
function FichaDocente({ docenteId }) {
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/docentes/${docenteId}/`)
      .then((respuesta) => setFicha(respuesta.data))
      .catch((err) => setError(getApiErrorMessage(err, 'No se pudo cargar su ficha docente.')));
  }, [docenteId]);

  if (error) return <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">{error}</p>;
  if (!ficha) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-blue-900" />
      </div>
    );
  }

  const vinculos = (ficha.vinculos || []).filter((vinculo) => vinculo.activo !== false);
  const anios = Number(ficha.antiguedad) || 0;
  return (
    <>
      <ListaDatos datos={[
        { label: vinculos.length > 1 ? 'Carreras' : 'Carrera', valor: vinculos.map((v) => v.carrera_nombre).join(', ') || '—' },
        { label: 'Dedicación', valor: vinculos.map((v) => v.tipo_dedicacion).join(', ') || '—' },
        { label: 'Categoría', valor: vinculos.map((v) => v.tipo_categoria).join(', ') || '—' },
        { label: 'Fecha de ingreso', valor: fecha(ficha.fecha_ingreso) },
        { label: 'Antigüedad', valor: `${anios} ${anios === 1 ? 'año' : 'años'}` },
        { label: 'Vacación que le corresponde', valor: `${ficha.dias_vacacion ?? 0} días hábiles por gestión` },
      ]}
      />
      <p className="mt-2 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
        La vacación sale de la antigüedad en años completos: 15 días desde 1 año, 20 desde 5 y 30 desde
        10. En cada fondo, la antigüedad se mide al inicio de su gestión. Si algún dato no es correcto,
        pídale a la Dirección de Carrera que lo corrija en su ficha.
      </p>
    </>
  );
}

// Perfil: datos de la cuenta (solo lectura; los cambia la administración en Usuarios), la
// foto y, para el docente, su ficha.
function PestanaPerfil({ onProfileUpdate }) {
  const { effectiveUser, assignments, activeRole, getRoleLabel } = useActiveRole();
  const nombre = `${effectiveUser?.first_name || ''} ${effectiveUser?.last_name || ''}`.trim() || '—';
  const docenteId = effectiveUser?.perfil?.docente_id || effectiveUser?.perfil?.docente;
  const esDocente = activeRole === 'docente' && !effectiveUser?.is_superuser;

  let roles;
  if (effectiveUser?.is_superuser) roles = 'Super Admin';
  else if (assignments.length) roles = assignments.map((item) => `${item.rol_display || getRoleLabel(item.rol)}${item.carrera_nombre ? ` · ${item.carrera_nombre}` : ''}`).join(', ');
  else roles = getRoleLabel(effectiveUser?.perfil?.rol);

  return (
    <div className="space-y-4">
      <div className={`${BLOQUE} p-5 sm:p-6 grid grid-cols-1 gap-6 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start`}>
        <FotoEditable user={effectiveUser} onProfileUpdate={onProfileUpdate} />
        <div className="min-w-0">
          <h3 className="px-3 text-lg font-bold text-blue-900">Datos de la cuenta</h3>
          <ListaDatos datos={[
            { label: 'Nombre', valor: nombre },
            { label: 'Usuario', valor: effectiveUser?.username || '—' },
            { label: 'Correo', valor: effectiveUser?.email || 'Sin correo registrado' },
            { label: assignments.length > 1 ? 'Roles' : 'Rol', valor: roles },
          ]}
          />
          <p className="mt-2 px-3 text-xs text-slate-500">
            Para corregir el nombre, el correo o los roles, pídaselo a la administración del sistema.
          </p>
        </div>
      </div>

      {esDocente && docenteId && (
        <div className={`${BLOQUE} p-5 sm:p-6`}>
          <h3 className="px-3 text-lg font-bold text-blue-900">Ficha docente</h3>
          <p className="px-3 text-sm text-slate-600">Registrada por la Dirección de Carrera.</p>
          <div className="mt-2">
            <FichaDocente docenteId={docenteId} />
          </div>
        </div>
      )}
    </div>
  );
}

export default PestanaPerfil;
