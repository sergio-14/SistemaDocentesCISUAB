import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getDocentes, getCarreras, crearFondoTiempo, getCalendarioActivo, getCalendarios } from '../apis/api';
import api, { obtenerTodos } from '../apis/api';
import toast from 'react-hot-toast';
import {
  ERROR_FIELD_BORDER_CLASS,
  ERROR_MOTION_CLASS,
  ERROR_SHAKE_DURATION_MS,
  sanitizeApiErrors,
  getApiErrorMessage,
} from '../utils/formErrors';
import { puedeCrearFondoTiempo } from '../utils/fondoTiempoPermissions';

const SelectConDropdown = ({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = 'Seleccione...',
  disabled = false,
  error,
  onFocus,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const selectedLabel = options.find((opt) => String(opt.value) === String(value))?.label;
  const inputValue = open ? search : (selectedLabel || '');
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (optionValue) => {
    if (disabled) return;
    onChange({ target: { name, value: optionValue } });
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
          {label} {error && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className={`relative h-[46px] w-full rounded-xl border-2 bg-slate-50 dark:bg-slate-700 shadow-sm ${
        disabled ? 'opacity-70' : ''
      } ${
        error
          ? ERROR_FIELD_BORDER_CLASS
          : open
            ? 'border-[#3A56AF] dark:border-[#3A56AF]'
            : 'border-slate-300 dark:border-slate-600'
      }`}>
        <input
          ref={inputRef}
          name={name}
          type="text"
          value={inputValue}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={(event) => {
            if (disabled) return;
            onFocus?.(event);
            setOpen(true);
            setSearch('');
          }}
          onClick={(event) => {
            if (disabled) return;
            onFocus?.(event);
            setOpen(true);
          }}
          onChange={(event) => {
            if (disabled) return;
            setSearch(event.target.value);
            setOpen(true);
            if (value) onChange({ target: { name, value: '' } });
          }}
          className={`h-full w-full px-4 py-0 pr-12 rounded-xl bg-transparent outline-none text-sm ${
            !selectedLabel || open ? 'italic' : ''
          } ${
            selectedLabel || open
              ? 'text-slate-800 dark:text-white font-semibold'
              : 'text-slate-400 dark:text-slate-500'
          } disabled:cursor-not-allowed`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            if (disabled) return;
            onFocus?.({ target: { name } });
            setOpen((prev) => !prev);
            setSearch('');
          }}
          className="absolute right-3 top-1/2 flex items-center justify-center h-6 w-6 rounded-md bg-[#2C4AAE] ring-1 ring-[#2C4AAE] hover:bg-[#1a3a8a] transition-colors disabled:bg-slate-500 disabled:ring-slate-500"
          style={{ transform: 'translateY(-50%)' }}
        >
          <svg
            className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-xl border-2 border-[#3A56AF] bg-white dark:bg-slate-900 shadow-xl max-h-60 overflow-auto">
          <div className="p-2">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left px-4 py-2.5 text-sm rounded-lg transition-colors ${
                  String(value) === String(option.value)
                    ? 'bg-cyan-50 dark:bg-cyan-900/30 shadow-[inset_2px_0_0_0_#06b6d4] text-cyan-800 dark:text-cyan-200 font-semibold'
                    : 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-[#2C4AAE] hover:text-white hover:shadow-[inset_2px_0_0_0_#2C4AAE] dark:hover:bg-[#2C4AAE]'
                }`}
              >
                <span className="block truncate">{option.label}</span>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm italic text-slate-500 dark:text-slate-400">
              Sin resultados
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

function FormularioFondo({ editar = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [docentes, setDocentes] = useState([]);
  const [carreras, setCarreras] = useState([]);
  const [calendarios, setCalendarios] = useState([]);
  const [calendarioActivo, setCalendarioActivo] = useState(null);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [carreraBloqueada, setCarreraBloqueada] = useState(false);
  const [cargandoDocentes, setCargandoDocentes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDatos, setLoadingDatos] = useState(true);
  const [error, setError] = useState('');
  const [erroresCampos, setErroresCampos] = useState({});
  // Campos que están actualmente "sacudiéndose" (shake animation).
  const [shakingFields, setShakingFields] = useState({});

  // Dispara la sacudida (shake) de 460ms en los campos indicados.
  const triggerShake = (fields) => {
    if (!fields || fields.length === 0) return;
    const next = {};
    fields.forEach((f) => { next[f] = true; });
    setShakingFields(next);
    setTimeout(() => setShakingFields({}), ERROR_SHAKE_DURATION_MS);
  };
  
  const [formData, setFormData] = useState({
    docente: '',
    carrera: '',
    gestion: '',
    estado: 'borrador',
  });

  const obtenerNombreDocente = (docente) => {
    if (!docente) return '';
    return docente.nombre_completo
      || `${docente.nombres || ''} ${docente.apellido_paterno || ''} ${docente.apellido_materno || ''}`.trim()
      || docente.usuario_nombre
      || `Docente ${docente.id}`;
  };

  const obtenerVinculoActivo = (docente) => {
    const vinculos = Array.isArray(docente?.vinculos) ? docente.vinculos : [];
    return vinculos.find((vinculo) => vinculo?.activo !== false) || vinculos[0] || null;
  };

  const obtenerId = (value) => {
    if (!value) return '';
    if (typeof value === 'object') return value.id || '';
    return value;
  };

  const obtenerCarreraPerfil = (perfil, userData) => (
    obtenerId(perfil?.carrera)
    || obtenerId(userData?.perfil?.carrera)
    || obtenerId(localStorage.getItem('carrera_activa_id'))
  );

  const docentePerteneceACarrera = (docente, carreraId) => {
    if (!carreraId) return true;
    const carreraString = String(carreraId);

    if (String(obtenerId(docente?.carrera)) === carreraString) return true;
    if (String(docente?.carrera_id || '') === carreraString) return true;

    const vinculos = Array.isArray(docente?.vinculos) ? docente.vinculos : [];
    return vinculos.some((vinculo) => (
      vinculo?.activo !== false
      && String(obtenerId(vinculo?.carrera)) === carreraString
    ));
  };

  const docenteBloqueadoPorNavegacion = !editar && Boolean(location.state?.docenteId);
  const docenteSeleccionado = docentes.find((docente) => String(docente.id) === String(formData.docente || ''));
  const vinculoDocenteSeleccionado = obtenerVinculoActivo(docenteSeleccionado);
  const docenteDedicacionExclusiva = vinculoDocenteSeleccionado?.dedicacion === 'dedicacion_exclusiva';

  useEffect(() => {
    cargarDatosPorRol();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial: solo al abrir o cambiar de fondo.
  }, [id, editar]);

  const cargarDocentesPorCarrera = async (
    carreraId,
    docenteActual = '',
    gestion = formData.gestion
  ) => {
    if (!carreraId) {
      setDocentes([]);
      if (!docenteActual) {
        setFormData(prev => ({ ...prev, docente: '' }));
      }
      return [];
    }

    try {
      setCargandoDocentes(true);
      const params = { carrera: carreraId };
      if (gestion && !editar) {
        params.sin_fondo_gestion = gestion;
      }
      const lista = await getDocentes(params);
      const filtrados = lista.filter((docente) => docentePerteneceACarrera(docente, carreraId));
      setDocentes(filtrados);

      if (!docenteActual) {
        setFormData(prev => ({
          ...prev,
          docente: filtrados.some((docente) => String(docente.id) === String(prev.docente)) ? prev.docente : ''
        }));
      }

      return filtrados;
    } catch (err) {
      console.error('Error al cargar docentes por carrera:', err);
      toast.error(getApiErrorMessage(err, 'Error al cargar docentes de la carrera'));
      setDocentes([]);
      return [];
    } finally {
      setCargandoDocentes(false);
    }
  };

  const cargarDatosPorRol = async () => {
    try {
      setLoadingDatos(true);

      const [userResponse, perfilResponse, carrerasLista, calendariosLista] = await Promise.all([
        api.get('/usuario/'),
        api.get('/perfil/').catch(() => null),
        getCarreras(),
        getCalendarios()
      ]);

      const userData = userResponse.data;
      const perfilData = userData.perfil || perfilResponse?.data || null;
      const carreraPerfilId = obtenerCarreraPerfil(perfilData, userData);
      const bloquearCarrera = !userData.is_superuser && ['director', 'jefe_estudios'].includes(perfilData?.rol);
      const docenteDesdeNavegacion = location.state?.docenteId || '';
      const carreraInicial = bloquearCarrera ? carreraPerfilId : '';

      setUsuarioActual(userData);
      setCarreraBloqueada(bloquearCarrera);
      setCarreras(carrerasLista);
      setCalendarios(calendariosLista);

      if (!editar) {
        setFormData(prev => ({
          ...prev,
          carrera: carreraInicial,
          docente: docenteDesdeNavegacion,
        }));

        if (carreraInicial) {
          await cargarDocentesPorCarrera(carreraInicial, docenteDesdeNavegacion, '');
        } else {
          setDocentes([]);
        }
      }

      try {
        const calendarioActivoRes = await getCalendarioActivo();
        setCalendarioActivo(calendarioActivoRes.data);

        if (!editar && calendarioActivoRes.data) {
          setFormData(prev => ({
            ...prev,
            gestion: calendarioActivoRes.data.gestion,
            carrera: carreraInicial,
            docente: docenteDesdeNavegacion,
          }));

          if (carreraInicial) {
            await cargarDocentesPorCarrera(carreraInicial, docenteDesdeNavegacion, calendarioActivoRes.data.gestion);
          } else {
            setDocentes([]);
          }
        }
      } catch (err) {
        // Sin calendario activo el backend responde 404. Cualquier otro error (p. ej. al
        // cargar docentes) no se oculta como si faltara el calendario.
        if (err?.response?.status === 404) {
          console.warn('No hay calendario activo configurado');
        } else {
          console.error('Error al cargar el calendario activo y sus datos:', err);
          toast.error(getApiErrorMessage(err, 'Error al cargar el calendario activo'));
        }
      }

      if (editar && id) {
        await cargarFondo();
      }
    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('Error al cargar los datos iniciales');
      toast.error(getApiErrorMessage(err, 'Error al cargar los datos iniciales'));
    } finally {
      setLoadingDatos(false);
    }
  };

  const cargarFondo = async () => {
    try {
      const response = await api.get(`/fondos-tiempo/${id}/`);

      const fondo = response.data;
      const docenteId = obtenerId(fondo.docente);
      const carreraId = obtenerId(fondo.carrera);
      setFormData({
        docente: docenteId,
        carrera: carreraId,
        gestion: fondo.gestion,
        estado: fondo.estado,
      });
      if (carreraId) {
        await cargarDocentesPorCarrera(carreraId, docenteId, fondo.gestion);
      }
    } catch (err) {
      console.error('Error al cargar fondo:', err);
      setError('Error al cargar el fondo de tiempo');
      toast.error('❌ Error al cargar el fondo de tiempo');
      setLoadingDatos(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: newValue
      };

      if (name === 'gestion' && !docenteBloqueadoPorNavegacion) {
        updated.docente = '';
      }

      if (name === 'carrera') {
        updated.docente = '';
      }

      return updated;
    });

    if (name === 'carrera') {
      cargarDocentesPorCarrera(value, '', formData.gestion);
    }

    if (name === 'gestion' && value) {
      cargarDocentesPorCarrera(formData.carrera, '', value);
    }

    if (erroresCampos[name]) {
      setErroresCampos({
        ...erroresCampos,
        [name]: ''
      });
    }
  };

  const handleDocenteChange = (e) => {
    const docenteId = e.target.value;

    setFormData(prev => ({
      ...prev,
      docente: docenteId
    }));

    setErroresCampos(prev => {
      const next = { ...prev };
      delete next.docente;
      return next;
    });
  };

  // Limpieza inmediata del borde rojo al hacer focus/click en el campo.
  // REGLA GLOBAL: el error y su borde desaparecen apenas el usuario interactúa.
  const handleFieldFocus = (e) => {
    const { name } = e.target;
    if (erroresCampos[name]) {
      setErroresCampos(prev => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validarFormulario = () => {
    const errores = {};

    if (!formData.docente) {
      errores.docente = 'Debe seleccionar un docente.';
    }
    if (docenteDedicacionExclusiva) {
      errores.docente = 'Docente exento de distribución de tiempo (Art. 25°)';
    }
    if (!formData.carrera) {
      errores.carrera = 'Por favor, seleccione una opción.';
    }
    if (!formData.gestion) {
      errores.gestion = 'Por favor, seleccione una opción.';
    }

    setErroresCampos(errores);
    return errores;
  };

  const verificarDuplicado = async () => {
    try {
      const fondos = await obtenerTodos('/fondos-tiempo/', {
        docente: formData.docente,
        gestion: formData.gestion,
      });
      
      const duplicados = fondos.filter(f => 
        (!editar || f.id !== parseInt(id)) &&
        f.docente === parseInt(formData.docente) &&
        f.gestion === parseInt(formData.gestion)
      );
      
      return duplicados.length > 0;
    } catch (err) {
      console.error('Error al verificar duplicados:', err);
      return false;
    }
  };

  const simplificarMensajeError = (mensaje) => {
    if (mensaje.toLowerCase().includes('conjunto único') || 
        mensaje.toLowerCase().includes('unique') ||
        mensaje.toLowerCase().includes('duplicado') ||
        mensaje.toLowerCase().includes('ya existe')) {
      return '⚠️ Ya existe un fondo de tiempo con estos datos. No se permiten duplicados.';
    }
    return mensaje;
  };

  const extraerMensajeValidacion = (data) => {
    if (!data) return 'Datos inválidos.';
    if (typeof data === 'string') return data;
    if (data.error && typeof data.error === 'string') return data.error;
    if (data.detail && typeof data.detail === 'string') return data.detail;
    if (data.non_field_errors && Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return data.non_field_errors[0];
    }

    if (typeof data === 'object') {
      const primerCampo = Object.keys(data)[0];
      const primerError = data[primerCampo];
      if (Array.isArray(primerError) && primerError.length > 0) return String(primerError[0]);
      if (typeof primerError === 'string') return primerError;
      if (typeof primerError === 'object' && primerError !== null) {
        const subValor = Object.values(primerError)[0];
        if (Array.isArray(subValor) && subValor.length > 0) return String(subValor[0]);
        if (typeof subValor === 'string') return subValor;
      }
    }

    return 'Datos inválidos.';
  };

  const mapearErroresBackendACampos = (data) => {
    const origen = data?.details || data;
    if (!origen || typeof origen !== 'object') return {};

    const errores = {};

    Object.entries(origen).forEach(([clave, valor]) => {
      if (['error', 'detail', 'details', 'non_field_errors'].includes(clave)) return;

      const claveCampo = clave;
      const mensaje = Array.isArray(valor)
        ? String(valor[0])
        : typeof valor === 'string'
          ? valor
          : extraerMensajeValidacion(valor);

      if (mensaje && !errores[claveCampo]) {
        errores[claveCampo] = mensaje;
      }
    });

    return errores;
  };

  const enfocarPrimerCampoConError = (errores) => {
    const primerCampo = Object.keys(errores)[0];
    if (!primerCampo) return;

    setTimeout(() => {
      const campo = document.querySelector(`[name="${primerCampo}"]`);
      if (campo) {
        campo.focus();
        campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 0);
  };

  const handleSubmit = async (e) => {
    // REGLA GLOBAL: detener por completo el comportamiento por defecto para
    // evitar parpadeo/re-renderizado de modales.
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    setError('');

    if (!editar && !puedeCrearFondoTiempo(usuarioActual)) {
      const mensajeError = 'No tienes permisos para crear Fondos de Tiempo. Esta tarea corresponde a Jefatura de Estudios.';
      setError(mensajeError);
      toast.error(mensajeError);
      return;
    }

    const erroresValidados = validarFormulario();
    const hayErrores = Object.keys(erroresValidados).length > 0;

    if (hayErrores) {
      // Disparar sacudida (shake) de 460ms en los campos con error.
      triggerShake(Object.keys(erroresValidados));
      enfocarPrimerCampoConError(erroresValidados);
      return;
    }
    
    if (!editar) {
      const esDuplicado = await verificarDuplicado();
      
      if (esDuplicado) {
        const mensajeError = '⚠️ Ya existe un fondo de tiempo con estos datos (mismo docente y gestión). No se permiten duplicados.';
        setError(mensajeError);
        toast.error(mensajeError, {
          duration: 6000,
          icon: '❌',
          position: 'top-right',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    
    setLoading(true);
    
    try {
      const payload = {
        ...formData,
        docente: (formData.docente && typeof formData.docente === 'object') ? formData.docente.id : formData.docente,
        carrera: (formData.carrera && typeof formData.carrera === 'object') ? formData.carrera.id : formData.carrera,
        gestion: parseInt(formData.gestion),
      };
      
      if (editar && id) {
        await api.put(`/fondos-tiempo/${id}/`, payload);
        toast.success('Fondo de tiempo actualizado exitosamente');
      } else {
        await crearFondoTiempo(payload);
        toast.success('Fondo de tiempo creado exitosamente');
      }
      
      setTimeout(() => {
        navigate('/fondo-tiempo');
      }, 1000);
      
    } catch (err) {
      console.error('❌ Error completo:', err);
      
      setErroresCampos({});
      
      let mensajeError = `Error al ${editar ? 'actualizar' : 'crear'} el fondo de tiempo.`;
      
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data;

        if (status === 400) {
          const erroresBackend = sanitizeApiErrors(mapearErroresBackendACampos(data));
          if (Object.keys(erroresBackend).length > 0) {
            setErroresCampos(erroresBackend);
            triggerShake(Object.keys(erroresBackend));
            enfocarPrimerCampoConError(erroresBackend);
          }

          const mensajeEspecifico = simplificarMensajeError(extraerMensajeValidacion(data));
          const mensajeValidacion = `ERROR DE VALIDACIÓN: ${mensajeEspecifico}`;
          setError(mensajeValidacion);
          toast.error(mensajeValidacion, {
            duration: 7000,
            icon: '⛔',
            position: 'top-right',
          });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        } else if (status === 403) {
          mensajeError = '🚫 No tienes permisos para realizar esta acción';
        } else if (status === 404) {
          mensajeError = '❓ El fondo de tiempo no existe';
        } else if (status === 500) {
          mensajeError = '⚠️ Error en el servidor. Intenta nuevamente más tarde.';
        }
      } else if (err.request) {
        mensajeError = '📡 No se pudo conectar con el servidor. Verifica tu conexión.';
      }
      
      const mensajeSimplificado = simplificarMensajeError(mensajeError);
      
      setError(mensajeSimplificado);
      
      toast.error(mensajeSimplificado, {
        duration: 6000,
        icon: '❌',
        position: 'top-right',
      });
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } finally {
      setLoading(false);
    }
  };

  if (loadingDatos) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            Cargando datos del fondo...
          </p>
        </div>
      </div>
    );
  }

  const carreraOptions = carreras.map((carrera) => ({
    value: carrera.id,
    label: carrera.nombre,
  }));

  const docenteOptions = formData.carrera
    ? docentes.map((docente) => ({
        value: docente.id,
        label: obtenerNombreDocente(docente),
      }))
    : [];

  const gestionOptions = [...new Set(
    calendarios
      .filter((calendario) => String(obtenerId(calendario.carrera)) === String(formData.carrera))
      .map((calendario) => calendario.gestion)
  )]
    .sort((a, b) => b - a)
    .map((gestion) => ({ value: gestion, label: `Gestión ${gestion}` }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 animate-fade-in flex items-center justify-center">
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                {editar ? '✏️ Editar Fondo de Tiempo' : '➕ Crear Nuevo Fondo de Tiempo'}
              </h1>
              <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
                Complete la información requerida para el fondo de tiempo docente.
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-slate-300 dark:border-slate-600"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} noValidate className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-slate-300 dark:border-slate-700 flex flex-col overflow-hidden animate-slide-up" style={{ animationDuration: '180ms' }}>
          <div className="bg-[#2C4AAE] px-6 py-4">
            <h2 className="text-xl font-bold text-white">
              {editar ? 'Editar Fondo de Tiempo' : 'Nuevo Fondo de Tiempo'}
            </h2>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 p-6 space-y-8 transition-all duration-300 ease-out">
              
              {/* Mensaje de error global */}
              {error && (
                <div className="mb-6 p-4 rounded-xl border-l-4 border-red-500 bg-gradient-to-r from-red-50 to-rose-50/30 dark:from-red-900/20 dark:to-rose-900/10 shadow-sm">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Campo Docente */}
                      <div className={`${shakingFields.docente ? ERROR_MOTION_CLASS : ''} order-2`}>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                          Docente {erroresCampos.docente && <span className="text-red-500">*</span>}
                        </label>
                        <SelectConDropdown
                          name="docente"
                          label=""
                          value={formData.docente}
                          onChange={handleDocenteChange}
                          onFocus={() => handleFieldFocus({ target: { name: 'docente' } })}
                          disabled={editar || docenteBloqueadoPorNavegacion || !formData.gestion}
                          options={docenteOptions}
                          placeholder={
                            !formData.carrera
                              ? 'Seleccione una carrera primero'
                              : !formData.gestion
                                ? 'Seleccione una gestión primero'
                                : cargandoDocentes
                                  ? 'Cargando docentes...'
                                  : docenteOptions.length === 0
                                    ? 'Todos los docentes tienen fondo de tiempo en esta gestión'
                                    : 'Seleccione un docente'
                          }
                          error={erroresCampos.docente}
                        />
                        {erroresCampos.docente && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erroresCampos.docente}</p>
                        )}
                        {formData.carrera && formData.gestion && !cargandoDocentes && docenteOptions.length === 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                            Todos los docentes tienen fondo de tiempo en esta gestión
                          </p>
                        )}
                        {docenteDedicacionExclusiva && (
                          <div className="mt-2 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                            Docente exento de distribución de tiempo (Art. 25°)
                          </div>
                        )}
                      </div>

                      {/* Carrera */}
                      <div className={`${shakingFields.carrera ? ERROR_MOTION_CLASS : ''} order-1`}>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                          Carrera {erroresCampos.carrera && <span className="text-red-500">*</span>}
                        </label>
                        <SelectConDropdown
                          name="carrera"
                          label=""
                          value={formData.carrera}
                          onChange={handleChange}
                          onFocus={() => handleFieldFocus({ target: { name: 'carrera' } })}
                          disabled={loading || editar || carreraBloqueada}
                          options={carreraOptions}
                          placeholder="Seleccione una carrera"
                          error={erroresCampos.carrera}
                        />
                        {erroresCampos.carrera && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erroresCampos.carrera}</p>
                        )}
                      </div>

                      {/* Gestión */}
                      <div className={`${shakingFields.gestion ? ERROR_MOTION_CLASS : ''} order-3`}>
                        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">
                          Gestión {erroresCampos.gestion && <span className="text-red-500">*</span>}
                          {calendarioActivo && String(formData.gestion) === String(calendarioActivo.gestion) && (
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Activa
                            </span>
                          )}
                        </label>
                        <SelectConDropdown
                          name="gestion"
                          label=""
                          value={formData.gestion}
                          onChange={handleChange}
                          onFocus={() => handleFieldFocus({ target: { name: 'gestion' } })}
                          disabled={loading || editar || !formData.carrera}
                          options={gestionOptions}
                          placeholder={
                            !formData.carrera
                              ? 'Seleccione una carrera primero'
                              : gestionOptions.length === 0
                                ? 'La carrera no tiene calendarios académicos'
                                : 'Seleccione una gestión'
                          }
                          error={erroresCampos.gestion}
                        />
                        {erroresCampos.gestion && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erroresCampos.gestion}</p>
                        )}
                      </div>
              </div>

                  {/* Nota final */}
                  <div className="p-5 rounded-xl border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50/30 dark:from-blue-900/20 dark:to-indigo-900/10 shadow-sm">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-xs text-blue-800 dark:text-blue-300">
                        <p className="font-bold mb-2">Resumen:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Después de crear, asigne las materias y actividades de cada unidad: el total debe coincidir con las horas efectivas</li>
                          <li>El programa analítico (PDF) se sube por materia en el detalle del fondo y es obligatorio para presentarlo al Director</li>
                          <li>Un solo fondo por docente y gestión: reúne las materias de todos los calendarios del año</li>
                          <li>Solo fondos en "borrador" pueden editarse</li>
                        </ul>
                      </div>
                    </div>
                  </div>
          </div>
          {/* Footer con botones */}
          <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || docenteDedicacionExclusiva}
              className="px-6 py-2.5 rounded-xl text-white font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando...' : (editar ? 'Actualizar Fondo' : 'Crear Fondo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FormularioFondo;
