import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { horasSemanalesDedicacion } from '../utils/dedicaciones';
import {
  MENSAJE_RESOLUCION_JEFE, MENSAJE_UNA_SOLA_CARRERA, asignacionesIniciales, asignacionesParaEnviar, cargosDelUsuario, cuerpoConArchivo, esArchivoPdf,
} from '../utils/asignacionesUsuario';
import CampoResolucionJefe from './common/CampoResolucionJefe';
import FiltroDesplegable from './common/FiltroDesplegable';
import { BOTON, BOTON_CHICO } from './fondos/estilosFondo';

const LABEL_CAMPO = 'block text-xs font-semibold text-slate-700 mb-1.5 pl-1';

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
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resolucionJefe, setResolucionJefe] = useState(null);
  const [indiceAsignacionActiva, setIndiceAsignacionActiva] = useState(0);
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
    setIndiceAsignacionActiva(0);
    setErrors({});
    setShowResetConfirm(false);
    setResolucionJefe(null);
  }, [userToEdit, carreras, esDirectorEditor, carreraPropiaEditor]);

  const handleChange = (e) => {
    const { name, value } = e.target;
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

  const handleRolChange = (e) => {
    const newRol = e.target.value;
    setFormData((prev) => ({
      ...prev,
      rol: newRol,
      carrera: carreraPropiaEditor || ((newRol === 'director' || newRol === 'jefe_estudios' || newRol === 'docente')
        ? prev.carrera
        : ''),
      docente: newRol === 'docente' ? prev.docente : '',
    }));
  };

  const handleAsignacionChange = (index, field, value) => {
    setAsignacionesExtra((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const MAX_ASIGNACIONES_TOTAL = 2;
  const totalAsignaciones = 1 + asignacionesExtra.length;
  const primeraAsignacionCompleta = Boolean(String(formData.rol || '').trim() && String(formData.carrera || '').trim());
  const puedeAgregarAsignacion = primeraAsignacionCompleta && totalAsignaciones < MAX_ASIGNACIONES_TOTAL;

  // Un Jefe de Estudios nuevo (no lo era ya) exige la resolución del Consejo de Carrera.
  const designaJefeNuevo = [formData.rol, ...asignacionesExtra.map((item) => item.rol)].includes('jefe_estudios')
    && !(userToEdit?.asignaciones || []).some((item) => item.rol === 'jefe_estudios' && item.activo !== false);

  const agregarAsignacion = () => {
    if (!puedeAgregarAsignacion) return;
    setAsignacionesExtra((prev) => (prev.length >= 1 ? prev : [...prev, { rol: '', carrera: carreraPropiaEditor, docente: '' }]));
    setIndiceAsignacionActiva(1);
  };

  const eliminarAsignacion = (index) => {
    setAsignacionesExtra((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setIndiceAsignacionActiva(0);
  };

  const handleRolSeleccionActual = (e) => {
    if (indiceAsignacionActiva === 0) {
      handleRolChange(e);
      return;
    }
    handleAsignacionChange(0, 'rol', e.target.value);
  };

  const handleCarreraSeleccionActual = (e) => {
    if (indiceAsignacionActiva === 0) {
      handleChange(e);
      return;
    }
    handleAsignacionChange(0, 'carrera', e.target.value);
  };

  const tieneDocenteVinculado = Boolean(userToEdit?.perfil?.docente_id);
  const nombreDocenteVinculado = userToEdit?.perfil?.docente_nombre || 'Sin nombre';
  const esSuperusuarioEditado = Boolean(userToEdit?.is_superuser);
  const mostrarInfoDocente = formData.rol === 'docente' && tieneDocenteVinculado;
  const mostrarCiAutoridad = formData.rol === 'director' || formData.rol === 'jefe_estudios';
  const obtenerRolLabel = (rolValue) => roles.find((item) => item.value === rolValue)?.label || rolValue || 'Sin rol';
  const obtenerCarreraLabel = (carreraValue) => carreras.find((item) => String(item.id) === String(carreraValue))?.nombre || 'Sin carrera';
  const obtenerResumenAsignacion = (item, index) => {
    const rol = String(item?.rol || '').trim();
    const carrera = String(item?.carrera || '').trim();
    // La carrera solo la ve el superusuario; para los demás es siempre la suya.
    if (!puedeElegirCarrera) return `#${index + 1} ${rol ? obtenerRolLabel(rol) : 'Selecciona rol'}`;
    if (!rol && !carrera) return `#${index + 1} Selecciona rol y carrera`;
    if (!rol) return `#${index + 1} Selecciona rol - ${obtenerCarreraLabel(carrera)}`;
    if (!carrera) return `#${index + 1} ${obtenerRolLabel(rol)} - selecciona carrera`;
    return `#${index + 1} ${obtenerRolLabel(rol)} - ${obtenerCarreraLabel(carrera)}`;
  };
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
  const asignacionesError = Array.isArray(errors?.asignaciones)
    ? errors.asignaciones[0]
    : (typeof errors?.asignaciones === 'string' ? errors.asignaciones : null);

  const handleResetearPassword = async () => {
    const passwordPorDefecto = `${userToEdit.username}UABJB`;
    setResettingPassword(true);

    try {
      await api.post(`/usuarios/${userToEdit.id}/resetear_password/`);
      toast.success(`Contraseña restablecida. Nueva contraseña: ${passwordPorDefecto}`);
      setShowResetConfirm(false);
      onSaveSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.detail || 'No se pudo restablecer la contraseña');
    } finally {
      setResettingPassword(false);
    }
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
      setIndiceAsignacionActiva(0);
      toast.error(!rolNormalizado && !carreraNormalizada
        ? 'Debe seleccionar un rol y una carrera.'
        : (!rolNormalizado ? 'Debe seleccionar un rol.' : 'Debe seleccionar una carrera.'));
      setLoading(false);
      return;
    }

    const segundaAsignacion = asignacionesExtra[0] || null;
    if (segundaAsignacion) {
      const segundaRol = String(segundaAsignacion.rol || '').trim();
      const segundaCarrera = String(segundaAsignacion.carrera || '').trim();

      if (!segundaRol || !segundaCarrera) {
        setErrors((prev) => ({
          ...prev,
          rol: !segundaRol ? ['Debe seleccionar el segundo rol.'] : prev.rol,
          carrera: !segundaCarrera ? ['Debe seleccionar la carrera del segundo rol.'] : prev.carrera,
          asignaciones: ['Complete el segundo rol y su carrera antes de actualizar.'],
        }));
        setIndiceAsignacionActiva(1);
        toast.error(!segundaRol && !segundaCarrera
          ? 'Debe seleccionar el segundo rol y su carrera.'
          : (!segundaRol ? 'Debe seleccionar el segundo rol.' : 'Debe seleccionar la carrera del segundo rol.'));
        setLoading(false);
        return;
      }

      const primeraClave = `${rolNormalizado}::${carreraNormalizada}`;
      const segundaClave = `${segundaRol}::${segundaCarrera}`;
      if (primeraClave === segundaClave) {
        setErrors((prev) => ({
          ...prev,
          asignaciones: ['No se puede repetir el mismo rol en la misma carrera.'],
        }));
        setIndiceAsignacionActiva(1);
        toast.error('No se puede repetir el mismo rol en la misma carrera.');
        setLoading(false);
        return;
      }

      if (segundaCarrera !== carreraNormalizada) {
        setErrors((prev) => ({ ...prev, asignaciones: [MENSAJE_UNA_SOLA_CARRERA] }));
        setIndiceAsignacionActiva(1);
        toast.error(MENSAJE_UNA_SOLA_CARRERA);
        setLoading(false);
        return;
      }
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

    if (!esSuperusuarioEditado) {
      payload.asignaciones = asignacionesParaEnviar(asignacionesExtra);
    }

    // Director y Jefe de Estudios deben enviar carrera
    if ((formData.rol === 'director' || formData.rol === 'jefe_estudios') && !esSuperusuarioEditado) {
      payload.carrera = carreraNormalizada;
    } else if (formData.rol === 'docente') {
      payload.docente = docenteId;
      if (carreraNormalizada) {
        payload.carrera = carreraNormalizada;
      }
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
        const rolError = Array.isArray(apiErrors?.rol)
          ? apiErrors.rol[0]
          : (typeof apiErrors?.rol === 'string' ? apiErrors.rol : null);
        if (rolError) {
          errorMsg = rolError;
        }

        const errorMessages = [];
        
        Object.entries(apiErrors).forEach(([field, messages]) => {
          const msgs = Array.isArray(messages) ? messages : [messages];
          msgs.forEach(msg => {
            const msgStr = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : String(msg);
            if (msgStr.trim()) {
              const fieldLabel = field === 'non_field_errors' ? '' : `${field}: `;
              errorMessages.push(`${fieldLabel}${msgStr.trim()}`);
            }
          });
        });
        
        // Limitar a los primeros 2 errores
        if (!rolError) {
          errorMsg = errorMessages.slice(0, 2).join('; ') || 'Error de validación.';
        }
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

  const rolActual = indiceAsignacionActiva === 0 ? (formData.rol || '') : (asignacionesExtra[0]?.rol || '');
  const carreraActual = indiceAsignacionActiva === 0 ? (formData.carrera || '') : (asignacionesExtra[0]?.carrera || '');

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-blue-950/30 backdrop-blur-sm animate-fade-in" style={{ animationDuration: '160ms' }}>
      <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-4xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '180ms' }}>
          <div className="px-5 sm:px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
            <h3 className="text-xl font-bold text-blue-900">Editar Usuario</h3>
            <p className="mt-0.5 text-sm text-slate-600">@{userToEdit.username}</p>
          </div>

          <form id="user-form" onSubmit={handleSubmit} noValidate>
            <div className="p-4 sm:p-6">
              {identidadBloqueada && (
                <div className="mb-4 rounded-2xl bg-amber-50 ring-1 ring-inset ring-amber-200 px-4 py-3 text-sm text-amber-900">
                  Este usuario ya tiene datos registrados ({identidadBloqueada.map((item) => `${item.etiqueta}: ${item.cantidad}`).join(', ')}).
                  El usuario, el nombre y el C.I. no se pueden cambiar, y solo se puede desactivar (no eliminar).
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Usuario" name="username" value={formData.username} onChange={handleChange} disabled={Boolean(identidadBloqueada)} error={errors.username} />
                <InputField label="Nombre completo" name="nombre_completo" value={formData.nombre_completo || ''} onChange={handleChange} disabled={Boolean(identidadBloqueada)} error={errors.nombre_completo || errors.first_name || errors.last_name} />

                <div>
                  <label htmlFor="editar-usuario-rol" className={LABEL_CAMPO}>Rol</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <FiltroDesplegable
                        id="editar-usuario-rol"
                        value={rolActual}
                        onChange={(valor) => handleRolSeleccionActual({ target: { name: 'rol', value: valor } })}
                        options={rolesDisponiblesModal.map((rol) => ({ value: rol.value, label: rol.label }))}
                        placeholder="Seleccione un rol"
                        ariaLabel="Rol"
                        permitirQuitar={false}
                        invalido={Boolean(errors.rol)}
                        disabled={esSuperusuarioEditado}
                      />
                    </div>
                    {!esSuperusuarioEditado && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!puedeAgregarAsignacion) {
                            toast.error(asignacionesExtra.length > 0 ? 'Ya existe un segundo rol asignado.' : 'Primero selecciona rol y carrera.');
                            return;
                          }
                          agregarAsignacion();
                        }}
                        disabled={!puedeAgregarAsignacion}
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-900 text-white hover:bg-blue-950 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Agregar un segundo rol"
                        aria-label="Agregar un segundo rol"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      </button>
                    )}
                  </div>
                  <MensajeError error={errors.rol} />
                </div>

                {/* Solo el superusuario elige la carrera; para los demás es la suya. */}
                {puedeElegirCarrera && (
                  <div>
                    <label htmlFor="editar-usuario-carrera" className={LABEL_CAMPO}>Carrera</label>
                    <FiltroDesplegable
                      id="editar-usuario-carrera"
                      value={carreraActual}
                      onChange={(valor) => handleCarreraSeleccionActual({ target: { name: 'carrera', value: valor } })}
                      options={carreras.map((carrera) => ({ value: carrera.id, label: carrera.nombre }))}
                      placeholder="Seleccione una carrera"
                      ariaLabel="Carrera"
                      emptyText="No hay carreras que coincidan"
                      permitirQuitar={false}
                      invalido={Boolean(errors.carrera)}
                      disabled={esSuperusuarioEditado}
                    />
                    <MensajeError error={errors.carrera} />
                  </div>
                )}

                {asignacionesExtra.length > 0 && (
                  <div className="md:col-span-2 animate-panel-asignacion overflow-hidden">
                    <div className="rounded-2xl bg-white ring-1 ring-inset ring-azulado-300 px-4 py-3">
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-blue-900">Roles del usuario</p>
                        <button
                          type="button"
                          onClick={() => eliminarAsignacion(0)}
                          className={`${BOTON_CHICO} bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100`}
                        >
                          Quitar el segundo rol
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {asignacionesActivas.map((item, index) => (
                          <button
                            key={`${item.rol || 'sin-rol'}-${item.carrera || 'sin-carrera'}-${index}`}
                            type="button"
                            onClick={() => setIndiceAsignacionActiva(index)}
                            className={`${BOTON_CHICO} ${
                              indiceAsignacionActiva === index
                                ? 'bg-sky-600 text-white'
                                : 'bg-azulado-100 text-blue-900 ring-1 ring-inset ring-azulado-300 hover:bg-blue-900 hover:text-white'
                            }`}
                          >
                            {obtenerResumenAsignacion(item, index)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {asignacionesError && (
                  <p className="md:col-span-2 -mt-2 pl-1 text-xs font-semibold text-red-600">{asignacionesError}</p>
                )}
                {designaJefeNuevo && (
                  <CampoResolucionJefe
                    className="md:col-span-2"
                    archivo={resolucionJefe}
                    error={errors.resolucion_jefe}
                    onChange={(archivo) => {
                      setResolucionJefe(archivo);
                      setErrors((prev) => ({ ...prev, resolucion_jefe: null }));
                    }}
                  />
                )}
                {errorFondoTiempo && (
                  <p className="md:col-span-2 -mt-2 pl-1 text-sm font-semibold text-red-600">{errorFondoTiempo}</p>
                )}

                {mostrarCiAutoridad ? (
                  <InputField label="C.I." name="ci" value={formData.ci} onChange={handleChange} disabled={Boolean(identidadBloqueada)} error={errors.ci} maxLength={15} />
                ) : (
                  <div>
                    <label htmlFor="editar-usuario-docente" className={LABEL_CAMPO}>Vincular a docente existente</label>
                    <FiltroDesplegable
                      id="editar-usuario-docente"
                      value={formData.docente}
                      onChange={(valor) => handleChange({ target: { name: 'docente', value: valor } })}
                      options={docentes.map((docente) => ({ value: docente.id, label: obtenerNombreCompletoDocente(docente) }))}
                      placeholder={tieneDocenteVinculado ? nombreDocenteVinculado : 'Seleccione un docente'}
                      ariaLabel="Vincular a docente existente"
                      emptyText="No hay docentes que coincidan"
                      permitirQuitar={false}
                      invalido={Boolean(errors.docente)}
                      disabled={tieneDocenteVinculado}
                    />
                    <MensajeError error={errors.docente} />
                    {mostrarInfoDocente && (
                      <p className="mt-1 pl-1 text-xs text-emerald-700">Docente vinculado: {nombreDocenteVinculado}</p>
                    )}
                  </div>
                )}

                <InputField label="Correo institucional" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} />
                <div>
                  <span className={LABEL_CAMPO}>Contraseña inicial</span>
                  <div className="flex h-11 items-center px-4 rounded-full bg-amber-50 ring-1 ring-inset ring-amber-200 text-sm font-mono font-semibold text-amber-900">
                    {formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}
                  </div>
                </div>
              </div>
            </div>
          </form>

          <div className="px-5 sm:px-6 py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 [border-top:1px_solid_#B8C9E1]">
            <div>
              {puedeRestablecerPassword && (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={loading || resettingPassword}
                  className={`${BOTON} w-full sm:w-auto px-4 py-2.5 bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={`Restablecer contraseña a: ${userToEdit?.username}UABJB`}
                >
                  {resettingPassword ? 'Restableciendo...' : 'Restablecer contraseña'}
                </button>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200 disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="user-form"
                disabled={loading}
                className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-blue-950/30 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !resettingPassword) setShowResetConfirm(false);
          }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '160ms' }}>
            <div className="px-6 pt-6">
              <h4 className="text-xl font-bold text-blue-900">Restablecer contraseña</h4>
              <p className="mt-1 text-sm text-slate-600">
                Se restablecerá la contraseña de <strong className="text-slate-900">{userToEdit?.username}</strong> a la contraseña inicial.
              </p>
            </div>
            <div className="px-6 py-4 space-y-2">
              <div className="rounded-2xl bg-amber-50 ring-1 ring-inset ring-amber-200 px-4 py-3 text-sm text-amber-900">
                Contraseña por defecto: <strong className="font-mono">{userToEdit?.username}UABJB</strong>
              </div>
              <p className="pl-1 text-xs text-slate-500">El usuario deberá cambiarla al iniciar sesión.</p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={resettingPassword}
                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200 disabled:opacity-50`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetearPassword}
                disabled={resettingPassword}
                className={`${BOTON} px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {resettingPassword ? 'Restableciendo...' : 'Restablecer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

const MensajeError = ({ error }) => (
  error ? <p className="mt-1 pl-1 text-xs text-red-600">{Array.isArray(error) ? error[0] : error}</p> : null
);

const InputField = ({ label, name, type = 'text', value, onChange, disabled, readOnly, error, ...rest }) => (
  <div>
    <label htmlFor={`editar-usuario-${name}`} className={LABEL_CAMPO}>{label}</label>
    <input
      id={`editar-usuario-${name}`}
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      readOnly={readOnly}
      {...rest}
      className={`w-full h-11 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-inset ${
        error ? 'ring-2 ring-red-500' : 'ring-1 ring-azulado-300 focus:ring-2 focus:ring-blue-900/40'
      } ${(disabled || readOnly) ? '!bg-slate-100 text-slate-500 cursor-not-allowed' : '!bg-azulado-100'}`}
    />
    <MensajeError error={error} />
  </div>
);

export default ModalUsuario;
