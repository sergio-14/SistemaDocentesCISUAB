import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { horasSemanalesDedicacion } from '../utils/dedicaciones';
import {
  MENSAJE_RESOLUCION_JEFE,
  asignacionesIniciales, asignacionesParaEnviar, cargosDelUsuario, cuerpoConArchivo, esArchivoPdf, motivoNoAsignarRol, textoErroresUsuario,
} from '../utils/asignacionesUsuario';
import { ERROR_MOTION_CLASS, ERROR_SHAKE_DURATION_MS } from '../utils/formErrors';
import CampoResolucionJefe from './common/CampoResolucionJefe';
import FiltroDesplegable from './common/FiltroDesplegable';
import CampoUsuario from './usuarios/CampoUsuario';
import { CandadoIcon, NotaUsuario, SeccionUsuario, SelectorRoles } from './usuarios/PiezasFormularioUsuario';
import ModalConfirmar from './common/ModalConfirmar';
import SelectorCarreraUsuario from './usuarios/SelectorCarreraUsuario';
import { BOTON } from './fondos/estilosFondo';

// Brinco del panel de roles cuando aparece (o se repite) un error.
const useBrinco = (activo, repeticion) => {
  const [brinco, setBrinco] = useState(false);
  useEffect(() => {
    if (!activo) {
      setBrinco(false);
      return undefined;
    }
    setBrinco(false);
    const frameId = requestAnimationFrame(() => setBrinco(true));
    const timeoutId = setTimeout(() => setBrinco(false), ERROR_SHAKE_DURATION_MS);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [activo, repeticion]);
  return brinco;
};

const primerError = (error) => (Array.isArray(error) ? (error[0] || '') : (typeof error === 'string' ? error : ''));

const obtenerNombreCompletoDocente = (docente) => {
  if (!docente) return '';
  // Si ya tiene nombre_completo, usarlo
  if (docente.nombre_completo) return docente.nombre_completo;
  // Si no, construir desde campos separados
  return `${docente.nombres || ''} ${docente.apellido_paterno || ''} ${docente.apellido_materno || ''}`.trim();
};

const buildNombreCompleto = (firstName = '', lastName = '') =>
  `${firstName || ''} ${lastName || ''}`.trim();

const splitNombreCompleto = (nombreCompleto = '') => {
  const partes = String(nombreCompleto).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) {
    return { first_name: '', last_name: '' };
  }
  return {
    first_name: partes[0],
    last_name: partes.slice(1).join(' '),
  };
};

const ROLES_AUTORIDAD_FONDO = new Set(['director', 'jefe_estudios']);

const obtenerHorasVinculo = (vinculo) => {
  const horasExplicitas = Number(vinculo?.horas_semanales_maximas);
  if (Number.isFinite(horasExplicitas)) {
    return horasExplicitas;
  }

  return horasSemanalesDedicacion(vinculo?.dedicacion);
};

const calcularErrorFondoTiempo = ({ docenteId, asignaciones, docentes }) => {
  if (!docenteId || !Array.isArray(asignaciones) || !Array.isArray(docentes)) {
    return '';
  }

  const bloquesValidos = asignaciones
    .map((bloque) => ({
      rol: String(bloque?.rol || '').trim(),
      carrera: String(bloque?.carrera || '').trim(),
    }))
    .filter((bloque) => bloque.rol && bloque.carrera);

  const tieneAutoridad = bloquesValidos.some((bloque) => ROLES_AUTORIDAD_FONDO.has(bloque.rol));
  const tieneDocencia = bloquesValidos.some((bloque) => bloque.rol === 'docente');

  if (!tieneAutoridad || !tieneDocencia) {
    return '';
  }

  const docente = docentes.find((item) => String(item?.id) === String(docenteId));
  const vinculosActivos = Array.isArray(docente?.vinculos)
    ? docente.vinculos.filter((vinculo) => vinculo?.activo !== false)
    : [];

  if (vinculosActivos.length === 0) {
    return '';
  }

  const horasContractuales = Math.max(...vinculosActivos.map((vinculo) => obtenerHorasVinculo(vinculo)), 0);
  const horasTotales = bloquesValidos.reduce((total, bloque) => {
    const vinculoCarrera = vinculosActivos.find((vinculo) => String(vinculo?.carrera) === String(bloque.carrera));
    return total + obtenerHorasVinculo(vinculoCarrera);
  }, 0);

  if (horasTotales > horasContractuales) {
    return `El docente excede su fondo de tiempo contractual (${horasTotales}/${horasContractuales} horas)`;
  }

  return '';
};

const ModalUsuario = ({ isOpen, onClose, onSaveSuccess, userToEdit, docentes, carreras, roles, currentUser }) => {
  const [formData, setFormData] = useState({});
  const [asignacionesExtra, setAsignacionesExtra] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resolucionJefe, setResolucionJefe] = useState(null);
  const [repeticionRol, setRepeticionRol] = useState(0);
  const [repeticionAsignaciones, setRepeticionAsignaciones] = useState(0);
  const brincoRoles = useBrinco(
    Boolean(errors?.rol || errors?.asignaciones || errors?.non_field_errors),
    repeticionRol + repeticionAsignaciones,
  );
  // Si el usuario ya tiene datos registrados, su identidad (usuario, nombre, C.I.)
  // no se puede cambiar. null = sin datos (o todavía sin verificar).
  const [identidadBloqueada, setIdentidadBloqueada] = useState(null);

  useEffect(() => {
    setIdentidadBloqueada(null);
    if (!isOpen || !userToEdit?.id) return undefined;
    let vigente = true;
    api.get(`/usuarios/${userToEdit.id}/dependencias/`)
      .then((response) => {
        if (vigente && response.data?.tiene_datos) setIdentidadBloqueada(response.data.detalle || []);
      })
      .catch((err) => {
        // El backend valida igual al guardar; esto solo es una ayuda visual.
        console.error('No se pudo verificar los datos registrados del usuario:', err);
      });
    return () => { vigente = false; };
  }, [isOpen, userToEdit?.id]);
  const esDirectorEditor = currentUser?.perfil?.rol === 'director' && !currentUser?.is_superuser;
  // Contraseña: el Director solo la restablece a docentes sin cargo (o a sí mismo); igual que el backend.
  const puedeRestablecerPassword = Boolean(userToEdit) && (
    currentUser?.is_superuser
    || (esDirectorEditor && (String(userToEdit.id) === String(currentUser?.id) || cargosDelUsuario(userToEdit).length === 0))
  );
  // Solo el superusuario elige la carrera; para cualquier otro es automáticamente la suya.
  const puedeElegirCarrera = Boolean(currentUser?.is_superuser);
  const carreraPropiaEditor = !puedeElegirCarrera && (carreras || []).length === 1 ? String(carreras[0].id) : '';
  const rolesDisponiblesModal = (roles || []).filter((rol) => {
    if (currentUser?.is_superuser) return true;
    // El Director asigna Instituto y Jefe de Estudios en su carrera; Director de Carrera, no.
    if (esDirectorEditor) return rol.value !== 'director';
    return rol.value !== 'iiisyp';
  });

  useEffect(() => {
    // No se inventa ningún rol (ver utils/asignacionesUsuario.js).
    const { extras } = asignacionesIniciales({
      asignaciones: userToEdit?.asignaciones,
      perfil: userToEdit?.perfil,
      esDirectorEditor,
      carreraIdsPermitidas: new Set((carreras || []).map((carrera) => String(carrera.id))),
    });

    const initialData = {
      username: userToEdit?.username || '',
      email: userToEdit?.email || '',
      first_name: userToEdit?.first_name || '',
      last_name: userToEdit?.last_name || '',
      nombre_completo: buildNombreCompleto(userToEdit?.first_name || '', userToEdit?.last_name || ''),
      ci: userToEdit?.ci || '',
      rol: userToEdit?.perfil?.rol || '',
      carrera: userToEdit?.perfil?.carrera || carreraPropiaEditor,
      docente: userToEdit?.perfil?.docente_id || '',
    };

    setFormData(initialData);
    setAsignacionesExtra(extras);
    setErrors({});
    setShowResetConfirm(false);
    setResolucionJefe(null);
  }, [userToEdit, carreras, esDirectorEditor, carreraPropiaEditor]);

  // Limpia el error de un campo al enfocarlo o al escribir en él.
  const clearFieldError = (fieldName) => {
    setErrors((prev) => {
      const campos = fieldName === 'nombre_completo' ? ['nombre_completo', 'first_name', 'last_name'] : [fieldName];
      if (!campos.some((campo) => prev?.[campo])) return prev;
      const next = { ...prev };
      campos.forEach((campo) => delete next[campo]);
      return next;
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    clearFieldError(name);
    if (name === 'nombre_completo') {
      const split = splitNombreCompleto(value);
      setFormData((prev) => ({
        ...prev,
        nombre_completo: value,
        first_name: split.first_name,
        last_name: split.last_name,
      }));
      return;
    }
    const normalizedValue = name === 'ci'
      ? String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)
      : value;
    setFormData((prev) => ({ ...prev, [name]: normalizedValue }));
  };

  // --- Roles (las mismas reglas que en Nuevo usuario) ---
  const rolesAsignadosLista = [
    { rol: formData.rol || '', carrera: formData.carrera || '' },
    ...asignacionesExtra,
  ].filter((item) => String(item.rol || '').trim());

  // Las reglas de los roles se avisan bajo los botones, sin toast.
  const marcarErrorRol = (mensaje) => {
    setErrors((prev) => ({ ...prev, rol: [mensaje] }));
    setRepeticionRol((valor) => valor + 1);
  };

  // Todos los roles del usuario van en su única carrera (la de su contrato).
  const moverRolDerecha = (rolValue) => {
    if (!rolValue) return;
    setErrors((prev) => ({ ...prev, rol: null, asignaciones: null }));

    const motivo = motivoNoAsignarRol(rolValue, rolesAsignadosLista);
    if (motivo) {
      marcarErrorRol(motivo);
      return;
    }

    if (!formData.rol) {
      setFormData((prev) => ({ ...prev, rol: rolValue, carrera: prev.carrera || carreraPropiaEditor }));
    } else {
      setAsignacionesExtra([{ rol: rolValue, carrera: formData.carrera || carreraPropiaEditor, docente: '' }]);
    }
  };

  const moverRolIzquierda = (index) => {
    setErrors((prev) => ({ ...prev, rol: null, asignaciones: null }));
    if (index === 0 && asignacionesExtra.length > 0) {
      // El segundo rol pasa a ser el principal; la carrera no cambia.
      setFormData((prev) => ({ ...prev, rol: asignacionesExtra[0].rol }));
      setAsignacionesExtra([]);
    } else if (index === 0) {
      setFormData((prev) => ({ ...prev, rol: '' }));
    } else {
      setAsignacionesExtra([]);
    }
  };

  // Clic en un rol: si ya lo tiene, se quita; si no, se agrega.
  const alternarRol = (rolValue) => {
    const indice = rolesAsignadosLista.findIndex((item) => item.rol === rolValue);
    if (indice >= 0) moverRolIzquierda(indice);
    else moverRolDerecha(rolValue);
  };

  // La carrera es del usuario: se aplica a todos sus roles.
  const cambiarCarreraUsuario = (carreraValue) => {
    const carrera = String(carreraValue || '');
    setFormData((prev) => ({ ...prev, carrera }));
    setAsignacionesExtra((prev) => prev.map((item) => ({ ...item, carrera })));
    setErrors((prev) => ({ ...prev, carrera: null, asignaciones: null }));
  };

  // Un Jefe de Estudios nuevo (no lo era ya) exige la resolución del Consejo de Carrera.
  const designaJefeNuevo = [formData.rol, ...asignacionesExtra.map((item) => item.rol)].includes('jefe_estudios')
    && !(userToEdit?.asignaciones || []).some((item) => item.rol === 'jefe_estudios' && item.activo !== false);

  const tieneDocenteVinculado = Boolean(userToEdit?.perfil?.docente_id);
  const nombreDocenteVinculado = userToEdit?.perfil?.docente_nombre || 'Sin nombre';
  const esSuperusuarioEditado = Boolean(userToEdit?.is_superuser);
  const asignacionesActivas = [
    { rol: formData.rol || '', carrera: formData.carrera || '' },
    ...asignacionesExtra,
  ];
  const docenteParaFondoTiempo = formData.rol === 'docente'
    ? formData.docente
    : (userToEdit?.perfil?.docente_id || '');
  const errorFondoTiempo = calcularErrorFondoTiempo({
    docenteId: docenteParaFondoTiempo,
    asignaciones: asignacionesActivas,
    docentes,
  });
  // Errores de los roles (y de la carrera si no hay selector) como texto bajo la lista.
  const errorBajoLista = primerError(errors?.rol)
    || primerError(errors?.asignaciones)
    || primerError(errors?.non_field_errors)
    || (puedeElegirCarrera ? '' : primerError(errors?.carrera))
    || errorFondoTiempo;

  // Lo confirma ModalConfirmar: si falla, el motivo se muestra en el mismo modal.
  const handleResetearPassword = async () => {
    try {
      await api.post(`/usuarios/${userToEdit.id}/resetear_password/`);
    } catch (err) {
      throw new Error(err?.response?.data?.error || err?.response?.data?.detail || 'No se pudo restablecer la contraseña.');
    }
    toast.success(`Contraseña restablecida. Nueva contraseña: ${userToEdit.username}UABJB`);
    setShowResetConfirm(false);
    onSaveSuccess();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const esUsuarioSistema = ['director', 'jefe_estudios'].includes(formData.rol);
    const ciNormalizado = (formData.ci || '').trim();
    const rolNormalizado = String(formData.rol || '').trim();
    const carreraNormalizada = String(formData.carrera || '').trim();

    if (!rolNormalizado || !carreraNormalizada) {
      setErrors((prev) => ({
        ...prev,
        rol: !rolNormalizado ? ['Debe seleccionar un rol.'] : prev.rol,
        carrera: !carreraNormalizada ? ['Debe seleccionar una carrera.'] : prev.carrera,
      }));
      setRepeticionRol((valor) => valor + 1);
      toast.error(!rolNormalizado && !carreraNormalizada
        ? 'Debe seleccionar un rol y una carrera.'
        : (!rolNormalizado ? 'Debe seleccionar un rol.' : 'Debe seleccionar una carrera.'));
      setLoading(false);
      return;
    }

    const segundaRol = String(asignacionesExtra[0]?.rol || '').trim();
    if (segundaRol && segundaRol === rolNormalizado) {
      setErrors((prev) => ({ ...prev, asignaciones: ['No se puede repetir el mismo rol.'] }));
      setRepeticionAsignaciones((valor) => valor + 1);
      toast.error('No se puede repetir el mismo rol.');
      setLoading(false);
      return;
    }

    if (errorFondoTiempo) {
      setErrors((prev) => ({
        ...prev,
        asignaciones: [errorFondoTiempo],
      }));
      toast.error(errorFondoTiempo);
      setLoading(false);
      return;
    }

    if (esUsuarioSistema && !ciNormalizado) {
      setErrors((prev) => ({
        ...prev,
        ci: ['El C.I. es obligatorio para este tipo de usuario.'],
      }));
      toast.error('El C.I. es obligatorio para este tipo de usuario.');
      setLoading(false);
      return;
    }

    const docenteId = formData.rol === 'docente' ? Number(formData.docente) : null;
    if (formData.rol === 'docente' && !docenteId) {
      setErrors((prev) => ({
        ...prev,
        docente: ['Debe seleccionar un docente para vincular.'],
      }));
      toast.error('Debe seleccionar un docente para vincular.');
      setLoading(false);
      return;
    }

    const payload = {
      username: formData.username,
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      ci: ciNormalizado || null,
      rol: rolNormalizado,
      is_active: userToEdit.is_active,
    };

    // El superusuario no tiene rol de carrera: no se envía.
    if (esSuperusuarioEditado) {
      delete payload.rol;
    }

    // Una sola carrera para todos los roles, también si el principal es Instituto.
    if (!esSuperusuarioEditado) {
      payload.carrera = carreraNormalizada;
      payload.asignaciones = asignacionesParaEnviar(
        asignacionesExtra.map((item) => ({ ...item, carrera: carreraNormalizada })),
      );
    }
    if (formData.rol === 'docente') {
      payload.docente = docenteId;
    }

    if (designaJefeNuevo && !esArchivoPdf(resolucionJefe)) {
      const mensaje = resolucionJefe ? 'La resolución del Consejo de Carrera debe ser un PDF.' : MENSAJE_RESOLUCION_JEFE;
      setErrors((prev) => ({ ...prev, resolucion_jefe: [mensaje] }));
      toast.error(mensaje);
      setLoading(false);
      return;
    }
    const { cuerpo, config } = cuerpoConArchivo(payload, 'resolucion_jefe', designaJefeNuevo ? resolucionJefe : null);

    try {
      const response = await api.put(`/usuarios/${userToEdit.id}/`, cuerpo, config);

      if (formData.rol === 'docente' && !response?.data?.perfil?.docente_id) {
        toast.error('No se pudo vincular el docente al usuario. Intenta nuevamente.');
        setErrors((prev) => ({
          ...prev,
          docente: ['El usuario se actualizo pero no quedo vinculado al docente.'],
        }));
        return;
      }

      toast.success('Usuario actualizado correctamente');
      onSaveSuccess(response.data);
    } catch (err) {
      console.error('Error al guardar usuario:', err);
      const apiErrors = err.response?.data;
      let errorMsg = 'Ocurrió un error inesperado.';

      if (apiErrors && typeof apiErrors === 'object') {
        setErrors(apiErrors);
        if (apiErrors.rol || apiErrors.non_field_errors) setRepeticionRol((valor) => valor + 1);
        if (apiErrors.asignaciones) setRepeticionAsignaciones((valor) => valor + 1);
        errorMsg = textoErroresUsuario(apiErrors, 'Error de validación.');
      } else if (err.response?.data && typeof err.response.data === 'string') {
        if (err.response.data.includes('<!DOCTYPE html>') || err.response.data.includes('<html')) {
          errorMsg = 'Error interno del servidor al actualizar usuario. Vuelve a intentar o reporta este caso.';
        } else {
          errorMsg = err.response.data;
        }
      } else if (err.message) {
        errorMsg = `Error de red: ${err.message}`;
      }

      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !userToEdit) return null;

  // El restablecimiento usa el usuario guardado, no el que se está escribiendo.
  const passwordPorDefecto = `${userToEdit.username}UABJB`;
  const textoErrorDocente = primerError(errors.docente);
  const textoDatosRegistrados = identidadBloqueada && identidadBloqueada.length > 0
    ? ` (${identidadBloqueada.map((item) => `${item.etiqueta}: ${item.cantidad}`).join(', ')})`
    : '';
  // La ficha de docente solo se elige si el rol principal es Docente y aún no tiene una.
  const docenteEditable = formData.rol === 'docente' && !tieneDocenteVinculado;
  const notaDocente = tieneDocenteVinculado
    ? 'Ya está vinculado a su ficha de docente.'
    : (formData.rol === 'docente' ? '' : 'Solo si el rol principal es Docente.');
  const notaCarrera = !puedeElegirCarrera
    ? 'Es tu carrera: se asigna sola.'
    : (identidadBloqueada ? 'No se puede cambiar: el usuario tiene datos registrados.' : 'Todos los roles del usuario van en esta carrera.');

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-blue-950/30 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="editar-usuario-titulo"
          className="w-full max-w-3xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up"
          style={{ animationDuration: '180ms' }}
        >
          <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
            <div className="min-w-0">
              <h2 id="editar-usuario-titulo" className="text-xl font-bold text-blue-900">Editar usuario</h2>
              <p className="mt-0.5 text-sm text-slate-600 truncate">
                @{userToEdit.username}
                {(userToEdit.first_name || userToEdit.last_name) && ` · ${`${userToEdit.first_name || ''} ${userToEdit.last_name || ''}`.trim()}`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Cerrar"
              className="flex-shrink-0 rounded-full p-2 -mr-2 text-slate-500 hover:text-blue-900 hover:bg-azulado-200 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="divide-y divide-azulado-200">
              <SeccionUsuario titulo="Cuenta">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                  <CampoUsuario
                    idPrefijo="editar-usuario"
                    label="Usuario"
                    name="username"
                    value={formData.username || ''}
                    onChange={handleChange}
                    clearError={clearFieldError}
                    error={errors.username}
                    disabled={Boolean(identidadBloqueada)}
                    required
                  />
                  <CampoUsuario
                    idPrefijo="editar-usuario"
                    label="Nombre completo"
                    name="nombre_completo"
                    value={formData.nombre_completo || ''}
                    onChange={handleChange}
                    clearError={clearFieldError}
                    error={errors.nombre_completo || errors.first_name || errors.last_name}
                    disabled={Boolean(identidadBloqueada)}
                    required
                  />
                  <CampoUsuario
                    idPrefijo="editar-usuario"
                    label="Correo institucional"
                    name="email"
                    type="text"
                    value={formData.email || ''}
                    onChange={handleChange}
                    clearError={clearFieldError}
                    error={errors.email}
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                  <CampoUsuario
                    idPrefijo="editar-usuario"
                    label="C.I."
                    name="ci"
                    value={formData.ci || ''}
                    onChange={handleChange}
                    clearError={clearFieldError}
                    error={errors.ci}
                    disabled={Boolean(identidadBloqueada)}
                    maxLength={15}
                  />
                </div>
                {identidadBloqueada && (
                  <NotaUsuario tipo="bloqueo">
                    Usuario, nombre y C.I. no se pueden cambiar porque tiene datos registrados{textoDatosRegistrados}. Para retirarlo, desactívelo.
                  </NotaUsuario>
                )}
              </SeccionUsuario>

              <SeccionUsuario titulo="Carrera y roles">
                {esSuperusuarioEditado ? (
                  <p className="text-sm text-slate-600">
                    Es el superusuario: no tiene carrera ni roles, tiene acceso a todo el sistema.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                      <SelectorCarreraUsuario
                        id="editar-usuario-carrera"
                        value={formData.carrera}
                        onChange={cambiarCarreraUsuario}
                        carreras={carreras}
                        error={puedeElegirCarrera ? errors.carrera : null}
                        deshabilitado={!puedeElegirCarrera || Boolean(identidadBloqueada)}
                        nota={notaCarrera}
                      />
                      <div>
                        <label htmlFor="editar-usuario-docente" className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5 pl-1">
                          Ficha de docente
                          {!docenteEditable && <CandadoIcon className="w-3 h-3 text-slate-400" />}
                        </label>
                        <FiltroDesplegable
                          id="editar-usuario-docente"
                          value={formData.docente}
                          onChange={(valor) => handleChange({ target: { name: 'docente', value: valor } })}
                          options={docentes.map((docente) => ({ value: docente.id, label: obtenerNombreCompletoDocente(docente) }))}
                          placeholder={tieneDocenteVinculado ? nombreDocenteVinculado : (docenteEditable ? 'Seleccione un docente' : 'Sin ficha de docente')}
                          ariaLabel="Ficha de docente"
                          emptyText="No hay docentes que coincidan"
                          permitirQuitar={false}
                          invalido={Boolean(textoErrorDocente)}
                          disabled={!docenteEditable}
                        />
                        {textoErrorDocente
                          ? <NotaUsuario tipo="error">{textoErrorDocente}</NotaUsuario>
                          : <NotaUsuario>{notaDocente}</NotaUsuario>}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-slate-700 mb-1.5 pl-1">Roles</span>
                      <div className={brincoRoles ? ERROR_MOTION_CLASS : ''}>
                        <SelectorRoles
                          roles={rolesDisponiblesModal}
                          asignados={rolesAsignadosLista.map((item) => item.rol)}
                          onAlternar={alternarRol}
                          invalido={Boolean(errorBajoLista)}
                        />
                      </div>
                      {errorBajoLista
                        ? <NotaUsuario tipo="error">{errorBajoLista}</NotaUsuario>
                        : <NotaUsuario>Máximo 2 roles y un solo cargo (Director, Jefe de Estudios o Instituto).</NotaUsuario>}
                    </div>

                    {designaJefeNuevo && (
                      <CampoResolucionJefe
                        archivo={resolucionJefe}
                        error={errors.resolucion_jefe}
                        onChange={(archivo) => {
                          setResolucionJefe(archivo);
                          setErrors((prev) => ({ ...prev, resolucion_jefe: null }));
                        }}
                      />
                    )}
                  </>
                )}
              </SeccionUsuario>

              <SeccionUsuario titulo="Contraseña">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700">
                      Contraseña inicial: <span className="font-semibold text-slate-900">{passwordPorDefecto}</span>
                    </p>
                    <NotaUsuario>Al restablecerla, el usuario entra con esta contraseña y debe cambiarla.</NotaUsuario>
                  </div>
                  {puedeRestablecerPassword && (
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={loading}
                      className={`${BOTON} flex-shrink-0 px-5 py-2.5 bg-white text-slate-700 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      Restablecer contraseña
                    </button>
                  )}
                </div>
              </SeccionUsuario>
            </div>

            <div className="px-5 sm:px-6 py-4 flex flex-col-reverse sm:flex-row justify-end gap-2 [border-top:1px_solid_#B8C9E1]">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className={`${BOTON} px-5 py-2.5 bg-white text-slate-700 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100 disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showResetConfirm && (
        <ModalConfirmar
          titulo="Restablecer contraseña"
          mensaje={<>La contraseña de <strong className="text-slate-900">{userToEdit.username}</strong> volverá a ser <strong className="text-slate-900">{passwordPorDefecto}</strong> y deberá cambiarla al iniciar sesión.</>}
          textoAccion="Restablecer"
          textoTrabajando="Restableciendo..."
          onConfirmar={handleResetearPassword}
          onCancelar={() => setShowResetConfirm(false)}
        />
      )}
    </div>,
    document.body
  );
};

export default ModalUsuario;
