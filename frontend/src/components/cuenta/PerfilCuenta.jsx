import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Trash2 } from 'lucide-react';
import api, { deleteProfilePicture, uploadProfilePicture } from '../../apis/api';
import { useActiveRole } from '../../contexts/activeRole';
import { getApiErrorMessage } from '../../utils/formErrors';
import ModalConfirmar from '../common/ModalConfirmar';
import { BOTON_CHICO } from '../fondos/estilosFondo';
import { EVENTO_FOTO_PERFIL_ACTUALIZADA } from '../ProfilePicture';
import FotoPerfil from './FotoPerfil';
import { Fila, Filas, Seccion } from './Seccion';

const fecha = (iso) => {
  const [anio, mes, dia] = String(iso || '').split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '—';
};

// Foto propia: cambiarla (PNG o JPG) o eliminarla para volver a la predeterminada.
function SeccionFoto({ user, onProfileUpdate }) {
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
    <Seccion titulo="Foto de perfil">
      <div className="flex flex-wrap items-center gap-4 px-4 py-4">
        <div className="w-16 h-16 flex-shrink-0">
          {vistaPrevia
            ? <img src={vistaPrevia} alt="Foto de perfil" className="w-full h-full rounded-full object-cover bg-white shadow-md" />
            : <FotoPerfil user={user} />}
        </div>
        <p className="flex-1 min-w-[10rem] text-sm text-slate-600">
          {esPropia ? 'Su foto se ve en el menú y en el chat.' : 'Sin foto propia: se muestra el logo de su carrera.'}
          <span className="block text-xs text-slate-500">PNG o JPG.</span>
        </p>
        <input ref={entradaRef} type="file" accept="image/png, image/jpeg" className="hidden" onChange={subir} />
        <div className="flex flex-wrap gap-2">
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
              <span>Eliminar</span>
            </button>
          )}
        </div>
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
    </Seccion>
  );
}

// Datos de la ficha docente (los registra la Dirección de Carrera): antes, "Mi perfil".
function SeccionFichaDocente({ docenteId }) {
  const [ficha, setFicha] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/docentes/${docenteId}/`)
      .then((respuesta) => setFicha(respuesta.data))
      .catch((err) => setError(getApiErrorMessage(err, 'No se pudo cargar su ficha docente.')));
  }, [docenteId]);

  let contenido;
  if (error) {
    contenido = <p className="px-4 py-3 text-sm text-sky-900">{error}</p>;
  } else if (!ficha) {
    contenido = (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-7 w-7 border-b-4 border-blue-900" />
      </div>
    );
  } else {
    const vinculos = (ficha.vinculos || []).filter((vinculo) => vinculo.activo !== false);
    const anios = Number(ficha.antiguedad) || 0;
    contenido = (
      <Filas>
        <Fila etiqueta={vinculos.length > 1 ? 'Carreras' : 'Carrera'}>{vinculos.map((v) => v.carrera_nombre).join(', ') || '—'}</Fila>
        <Fila etiqueta="Dedicación">{vinculos.map((v) => v.tipo_dedicacion).join(', ') || '—'}</Fila>
        <Fila etiqueta="Categoría">{vinculos.map((v) => v.tipo_categoria).join(', ') || '—'}</Fila>
        <Fila etiqueta="Fecha de ingreso">{fecha(ficha.fecha_ingreso)}</Fila>
        <Fila etiqueta="Antigüedad">{`${anios} ${anios === 1 ? 'año' : 'años'}`}</Fila>
        <Fila etiqueta="Vacación" ayuda="Días hábiles por gestión">{`${ficha.dias_vacacion ?? 0} días`}</Fila>
      </Filas>
    );
  }

  return (
    <div>
      <Seccion titulo="Ficha docente" extra="Dirección de Carrera">{contenido}</Seccion>
      <p className="mt-2 px-1 text-xs text-slate-500">
        La vacación sale de la antigüedad en años completos: 15 días desde 1 año, 20 desde 5 y 30 desde 10;
        en cada fondo se mide al inicio de su gestión. Si algún dato no es correcto, pídale a la Dirección de
        Carrera que lo corrija.
      </p>
    </div>
  );
}

// Contenido de Mi cuenta: la foto, los datos de la cuenta (solo lectura; los cambia la
// administración en Usuarios) y, para el docente, su ficha.
function PerfilCuenta({ onProfileUpdate }) {
  const { effectiveUser, assignments, activeRole, getRoleLabel } = useActiveRole();
  const nombre = `${effectiveUser?.first_name || ''} ${effectiveUser?.last_name || ''}`.trim() || '—';
  const docenteId = effectiveUser?.perfil?.docente_id || effectiveUser?.perfil?.docente;
  const esDocente = activeRole === 'docente' && !effectiveUser?.is_superuser;

  let roles;
  if (effectiveUser?.is_superuser) roles = [{ clave: 'super', texto: 'Super Admin' }];
  else if (assignments.length) {
    roles = assignments.map((item) => ({
      clave: item.id,
      texto: `${item.rol_display || getRoleLabel(item.rol)}${item.carrera_nombre ? ` · ${item.carrera_nombre}` : ''}`,
    }));
  } else roles = [{ clave: 'rol', texto: getRoleLabel(effectiveUser?.perfil?.rol) }];

  return (
    <div className="space-y-6">
      <SeccionFoto user={effectiveUser} onProfileUpdate={onProfileUpdate} />

      <div>
        <Seccion titulo="Datos de la cuenta" extra="Solo lectura">
          <Filas>
            <Fila etiqueta="Nombre">{nombre}</Fila>
            <Fila etiqueta="Usuario">{effectiveUser?.username || '—'}</Fila>
            <Fila etiqueta="Correo">{effectiveUser?.email || <span className="text-slate-500">Sin correo registrado</span>}</Fila>
            <Fila etiqueta={roles.length > 1 ? 'Roles' : 'Rol'}>
              <span className="flex flex-wrap gap-1.5 sm:justify-end">
                {roles.map((rol) => (
                  <span key={rol.clave} className="inline-flex px-2.5 py-0.5 rounded-full bg-azulado-100 ring-1 ring-inset ring-azulado-300 text-xs font-medium text-slate-700">
                    {rol.texto}
                  </span>
                ))}
              </span>
            </Fila>
          </Filas>
        </Seccion>
        <p className="mt-2 px-1 text-xs text-slate-500">
          Para corregir el nombre, el correo o los roles, pídaselo a la administración del sistema.
        </p>
      </div>

      {esDocente && docenteId && <SeccionFichaDocente docenteId={docenteId} />}
    </div>
  );
}

export default PerfilCuenta;
