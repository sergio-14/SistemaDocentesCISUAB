import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../apis/api';
import toast from 'react-hot-toast';
import { horasSemanalesDedicacion } from '../utils/dedicaciones';
import { MENSAJE_UNA_SOLA_CARRERA, asignacionesIniciales, asignacionesParaEnviar } from '../utils/asignacionesUsuario';

const obtenerNombreCompletoDocente = (docente) => {
  if (!docente) return '';
  // Si ya tiene nombre_completo, usarlo
  if (docente.nombre_completo) return docente.nombre_completo;
  // Si no, construir desde campos separados
  return `${docente.nombres || ''} ${docente.apellido_paterno || ''} ${docente.apellido_materno || ''}`.trim();
};

// Componente Select con Dropdown animado (igual que en ListaDocentes)
const SelectConDropdown = ({ label, name, value, onChange, options, error, disabled = false, required = false, placeholder = 'Seleccione...' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const selectedLabel = options.find(opt => opt.value === value)?.label;

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={`w-full px-4 py-3 rounded-2xl text-left flex items-center justify-between transition-all ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'
        } ${
          error
            ? 'border-2 border-red-500 bg-white dark:bg-slate-800'
            : open
              ? 'border-2 border-[#2C4AAE] bg-white dark:bg-slate-800'
                : 'border-2 border-slate-400 bg-slate-100 dark:bg-slate-700 hover:border-[#2C4AAE]'
        }`}
      >
        <span className={`${selectedLabel ? 'text-slate-800 dark:text-white font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
          {selectedLabel || placeholder}
        </span>
        <div className="w-8 h-8 bg-[#2C4AAE] hover:bg-[#1a3a8a] rounded-lg flex items-center justify-center transition-colors">
          <svg
            className={`w-4 h-4 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border-2 border-[#2C4AAE] bg-white dark:bg-slate-800 shadow-xl max-h-48 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange({ target: { name, value: option.value } });
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === option.value
                  ? 'bg-[#2C4AAE] text-white font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-[#2C4AAE] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

const ToggleSwitch = ({ isActive, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      isActive
        ? 'bg-emerald-500 dark:bg-emerald-600 focus:ring-emerald-400 dark:focus:ring-emerald-500'
        : 'bg-slate-500 dark:bg-slate-600 focus:ring-slate-400 dark:focus:ring-slate-500'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
        isActive ? 'translate-x-6' : 'translate-x-0.5'
      }`}
    />
  </button>
);

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
  // Solo el superusuario elige la carrera; para cualquier otro es automáticamente la suya.
  const puedeElegirCarrera = Boolean(currentUser?.is_superuser);
  const carreraPropiaEditor = !puedeElegirCarrera && (carreras || []).length === 1 ? String(carreras[0].id) : '';
  const rolesDisponiblesModal = (roles || []).filter((rol) => {
    if (currentUser?.is_superuser) return true;
    if (esDirectorEditor) return !['iiisyp', 'director'].includes(rol.value);
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

    try {
      const response = await api.put(`/usuarios/${userToEdit.id}/`, payload);

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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="bg-[#2C4AAE] px-6 py-4 rounded-t-2xl dark:bg-[#1a3a8a]">
          <h3 className="text-xl font-bold text-white">
            Editar Usuario ✓
          </h3>
        </div>

        <form id="user-form" onSubmit={handleSubmit} className="flex-1 overflow-visible">
          <div className="p-6">
            {identidadBloqueada && (
              <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
                Este usuario ya tiene datos registrados ({identidadBloqueada.map((item) => `${item.etiqueta}: ${item.cantidad}`).join(', ')}).
                El usuario, el nombre y el C.I. no se pueden cambiar, y solo se puede desactivar (no eliminar).
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Usuario" name="username" value={formData.username} onChange={handleChange} required disabled={Boolean(identidadBloqueada)} error={errors.username} />
              <InputField label="Nombre completo" name="nombre_completo" value={formData.nombre_completo || ''} onChange={handleChange} required disabled={Boolean(identidadBloqueada)} error={errors.nombre_completo || errors.first_name || errors.last_name} />

              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <SelectConDropdown
                    label="Rol"
                    name="rol"
                    value={indiceAsignacionActiva === 0 ? (formData.rol || '') : (asignacionesExtra[0]?.rol || '')}
                    onChange={handleRolSeleccionActual}
                    options={rolesDisponiblesModal.map((rol) => ({ value: rol.value, label: rol.label }))}
                    error={errors.rol}
                    disabled={esSuperusuarioEditado}
                    required
                  />
                </div>
                {!esSuperusuarioEditado && (
                  <div className="shrink-0 pt-[28px]">
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
                      className={`h-[52px] w-16 rounded-2xl border-2 text-2xl font-black text-white shadow-sm transition-colors ${puedeAgregarAsignacion ? 'border-[#2C4AAE] bg-[#2C4AAE] hover:bg-[#1a3a8a]' : 'cursor-not-allowed border-slate-400 bg-slate-400'}`}
                      aria-label="Agregar segunda asignacion"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {puedeElegirCarrera && (
                <SelectConDropdown
                  label="Carrera"
                  name="carrera"
                  value={indiceAsignacionActiva === 0 ? (formData.carrera || '') : (asignacionesExtra[0]?.carrera || '')}
                  onChange={handleCarreraSeleccionActual}
                  options={carreras.map((c) => ({ value: c.id, label: c.nombre }))}
                  error={errors.carrera}
                  disabled={esSuperusuarioEditado}
                  required
                  placeholder="Seleccione una carrera..."
                />
              )}

              {asignacionesExtra.length > 0 && (
                <div className="md:col-span-2 animate-panel-asignacion overflow-hidden">
                  <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-700/30">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Panel de asignaciones activas</p>
                      <button
                        type="button"
                        onClick={() => eliminarAsignacion(0)}
                        className="h-9 shrink-0 rounded-xl border-2 border-red-500 px-3 text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
                      >
                        Quitar selección 2
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {asignacionesActivas.map((item, index) => (
                        <button
                          key={`${item.rol || 'sin-rol'}-${item.carrera || 'sin-carrera'}-${index}`}
                          type="button"
                          onClick={() => setIndiceAsignacionActiva(index)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-left text-xs font-semibold transition-colors ${
                            indiceAsignacionActiva === index
                              ? 'border-[#2C4AAE] bg-[#2C4AAE] text-white'
                              : 'border-[#2C4AAE]/30 bg-[#2C4AAE]/10 text-[#2C4AAE] dark:text-blue-300'
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
                <p className="md:col-span-2 -mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                  {asignacionesError}
                </p>
              )}
              {errorFondoTiempo && (
                <p className="md:col-span-2 -mt-2 text-sm font-semibold text-red-600 dark:text-red-400">
                  {errorFondoTiempo}
                </p>
              )}

              <div className="hidden">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0" />
                  {!esSuperusuarioEditado && (
                    <div className="shrink-0 pt-[28px]">
                      <button
                        type="button"
                        onClick={asignacionesExtra.length > 0 ? () => setAsignacionesExtra([]) : agregarAsignacion}
                        disabled={!puedeAgregarAsignacion && asignacionesExtra.length === 0}
                        className={`h-[52px] w-[52px] rounded-2xl text-3xl font-bold text-white ${(!puedeAgregarAsignacion && asignacionesExtra.length === 0) ? 'cursor-not-allowed bg-slate-400' : 'bg-[#2C4AAE]'}`}
                      >
                        {asignacionesExtra.length > 0 ? '−' : '+'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                {mostrarCiAutoridad ? (
                  <InputField label="C.I." name="ci" value={formData.ci} onChange={handleChange} disabled={Boolean(identidadBloqueada)} error={errors.ci} maxLength={15} />
                ) : (
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                      Vincular a Docente Existente
                    </label>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <SelectConDropdown
                          name="docente"
                          value={formData.docente}
                          onChange={handleChange}
                          options={docentes.map((d) => ({ value: d.id, label: obtenerNombreCompletoDocente(d) }))}
                          error={errors.docente}
                          disabled={tieneDocenteVinculado}
                          placeholder={tieneDocenteVinculado ? nombreDocenteVinculado : 'Seleccione un docente'}
                        />
                      </div>
                    </div>
                    {mostrarInfoDocente && (
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">
                        Docente vinculado: {nombreDocenteVinculado}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <InputField label="Correo institucional" name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} />
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Contraseña inicial</label>
                <div className="w-full px-4 py-3 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-mono font-semibold">
                  {formData.username ? `${formData.username}UABJB` : 'usuarioUABJB'}
                </div>
              </div>

            </div>
          </div>
        </form>

        <div className="px-6 py-4 bg-slate-100 dark:bg-slate-700 border-t border-slate-300 dark:border-slate-600 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div>
              {userToEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={loading || resettingPassword}
                      className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-bold shadow-sm transition-all ${
                        resettingPassword
                          ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-700'
                          : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40'
                      }`}
                      title={`Restablecer contraseña a: ${userToEdit?.username}UABJB`}
                    >
                      🔑 {resettingPassword ? 'Restableciendo...' : 'Restablecer Contraseña'}
                    </button>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="user-form"
                disabled={loading}
                className={`px-6 py-2.5 rounded-xl font-bold text-white bg-[#2C4AAE] hover:bg-[#1a3a8a] transition-all disabled:opacity-50 ${
                  loading
                    ? 'cursor-not-allowed'
                    : ''
                }`}
              >
                {loading ? 'Guardando...' : 'Actualizar Usuario'}
              </button>
            </div>
          </div>
        </div>

        {showResetConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
              onClick={() => !resettingPassword && setShowResetConfirm(false)}
            />
            <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-amber-300/40 bg-slate-900 shadow-2xl dark:border-amber-700/50">
              <div className="border-b border-slate-700/70 bg-gradient-to-r from-amber-900/30 to-slate-900 px-5 py-4">
                <h4 className="flex items-center gap-2 text-lg font-bold text-amber-300">
                  <span>🔐</span>
                  Confirmar Restablecimiento
                </h4>
              </div>
              <div className="space-y-3 px-5 py-4 text-slate-200">
                <p className="text-sm leading-relaxed">
                  Se restablecerá la contraseña de <strong className="text-white">{userToEdit?.username}</strong> a la contraseña inicial.
                </p>
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                  Contraseña por defecto: <strong className="text-amber-300">{userToEdit?.username}UABJB</strong>
                </div>
                <p className="text-xs text-slate-400">
                  El usuario deberá cambiarla al iniciar sesión.
                </p>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-700/70 bg-slate-950/70 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resettingPassword}
                  className="rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleResetearPassword}
                  disabled={resettingPassword}
                  className={`rounded-lg px-4 py-2 font-bold text-white ${
                    resettingPassword ? 'cursor-not-allowed bg-slate-500' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {resettingPassword ? 'Restableciendo...' : 'Confirmar y Restablecer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

const InputField = ({ label, name, type = 'text', value, onChange, required, disabled, readOnly, error, ...rest }) => (
  <div>
    <label className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-300">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      {...rest}
      className={`w-full rounded-xl border-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white px-4 py-3 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error ? 'border-red-500' : 'border-slate-400 dark:border-slate-600'
      } ${(disabled || readOnly) ? 'cursor-not-allowed bg-slate-200 dark:bg-slate-700/50' : ''}`}
    />
    {error && <p className="mt-1 text-xs text-red-600">{Array.isArray(error) ? error[0] : error}</p>}
  </div>
);

export default ModalUsuario;
