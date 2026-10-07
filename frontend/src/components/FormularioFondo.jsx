import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getDocentes, getCarreras, crearFondoTiempo, getCalendarioActivo, getCalendarios } from '../apis/api';
import api, { obtenerTodos } from '../apis/api';
import toast from 'react-hot-toast';
import ModalCentrado from './common/ModalCentrado';
import {
  ERROR_MOTION_CLASS,
  ERROR_SHAKE_DURATION_MS,
  MENSAJE_REVISA_CAMPOS,
  sanitizeApiErrors,
  getApiErrorMessage,
} from '../utils/formErrors';
import { puedeCrearFondoTiempo } from '../utils/fondoTiempoPermissions';

// Compara sin mayúsculas ni tildes: "maria" encuentra "María".
const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const SelectConDropdown = ({
  name,
  value,
  onChange,
  options,
  placeholder = 'Seleccione...',
  disabled = false,
  error,
  onFocus,
  // Sin texto de búsqueda se muestran solo las primeras N opciones, bajo este título.
  limiteSinBusqueda = null,
  tituloSinBusqueda = '',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (containerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
      setSearch('');
    };
    // El menú está fijo en pantalla: si se desplaza el modal o cambia el tamaño, se cierra.
    const cerrar = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [open]);

  // El menú se monta en <body> para que pueda salir del modal sin quedar recortado.
  useLayoutEffect(() => {
    if (!open || !containerRef.current) {
      setMenuStyle(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const alturaMax = 240;
    const espacioAbajo = window.innerHeight - rect.bottom - 12;
    const abrirArriba = espacioAbajo < alturaMax && rect.top > espacioAbajo;
    setMenuStyle({
      position: 'fixed',
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      ...(abrirArriba
        ? { bottom: `${window.innerHeight - rect.top + 8}px` }
        : { top: `${rect.bottom + 8}px` }),
      zIndex: 99999,
    });
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const selectedLabel = options.find((opt) => String(opt.value) === String(value))?.label;
  const inputValue = open ? search : (selectedLabel || '');
  const buscando = search.trim() !== '';
  const filteredOptions = buscando
    ? options.filter((option) => normalizar(option.label).includes(normalizar(search.trim())))
    : (limiteSinBusqueda ? options.slice(0, limiteSinBusqueda) : options);

  const handleSelect = (optionValue) => {
    if (disabled) return;
    onChange({ target: { name, value: optionValue } });
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <div className={`relative h-11 w-full rounded-full ${
        disabled ? 'bg-slate-100 opacity-80' : 'bg-azulado-100'
      } ${
        error
          ? 'ring-2 ring-inset ring-red-400/80'
          : open
            ? 'ring-2 ring-inset ring-blue-900/50'
            : 'ring-1 ring-inset ring-azulado-300'
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
          className={`h-full w-full pl-4 pr-12 text-sm outline-none ${
            selectedLabel && !open ? 'text-slate-800 font-semibold' : 'text-slate-700 placeholder:text-slate-500'
          } disabled:cursor-not-allowed`}
          style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            if (disabled) return;
            onFocus?.({ target: { name } });
            setOpen((prev) => !prev);
            setSearch('');
          }}
          className="absolute right-2.5 top-1/2 flex items-center justify-center h-6 w-6 rounded-md bg-[#2C4AAE] ring-1 ring-[#2C4AAE] hover:bg-[#1a3a8a] transition-colors disabled:bg-slate-400 disabled:ring-slate-400"
          style={{ transform: 'translateY(-50%)' }}
          aria-label={open ? 'Cerrar opciones' : 'Ver opciones'}
        >
          {disabled ? (
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 10V7a4 4 0 00-8 0v3m-2 0h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z" />
            </svg>
          ) : (
            <svg
              className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      </div>
      {open && menuStyle && createPortal(
        <div ref={menuRef} className="rounded-xl border-2 border-[#3A56AF] bg-white shadow-xl max-h-60 overflow-auto" style={menuStyle}>
          <div className="p-2">
          {!buscando && tituloSinBusqueda && filteredOptions.length > 0 && (
            <div className="px-3 pt-1 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {tituloSinBusqueda}
            </div>
          )}
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
                  String(value) === String(option.value)
                    ? 'bg-sky-600 text-white font-semibold hover:bg-sky-700'
                    : 'bg-transparent text-slate-700 hover:bg-[#2C4AAE] hover:text-white'
                }`}
              >
                <span className="block truncate">{option.label}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2.5 text-sm text-slate-500">
              Sin resultados
            </div>
          )}
          </div>
        </div>,
        document.body
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

    // Solo se desplaza hasta el campo: hacerle focus() dispararía su onFocus, que
    // limpia el error, y el borde rojo desaparecería antes de verse.
    setTimeout(() => {
      document.querySelector(`[name="${primerCampo}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      toast.error(MENSAJE_REVISA_CAMPOS);
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
      <ModalCentrado>
        <div className="text-center rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 px-10 py-8 shadow-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-slate-700">
            Cargando datos del fondo...
          </p>
        </div>
      </ModalCentrado>
    );
  }

  const carreraOptions = carreras.map((carrera) => ({
    value: carrera.id,
    label: carrera.nombre,
  }));

  const docenteOptions = formData.carrera
    ? [...docentes]
      .sort((a, b) => (
        String(b.fecha_creacion || '').localeCompare(String(a.fecha_creacion || ''))
        || (Number(b.id) || 0) - (Number(a.id) || 0)
      ))
      .map((docente) => ({
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

  const etiqueta = (titulo, extra = null) => (
    <div className="flex items-center gap-2 mb-2 pl-1">
      <span className="text-sm font-semibold text-slate-800">{titulo}</span>
      {extra}
    </div>
  );

  const mensajeCampo = (campo) => (
    erroresCampos[campo] && <p className="text-xs text-red-600 mt-1.5 pl-4">{erroresCampos[campo]}</p>
  );

  return (
    <ModalCentrado>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-2xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up"
        style={{ animationDuration: '180ms' }}
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-7 pt-6 pb-5 [border-bottom:1px_solid_#B8C9E1]">
          <h2 className="text-xl sm:text-2xl font-bold text-blue-900">
            {editar ? 'Editar Fondo de Tiempo' : 'Nuevo Fondo de Tiempo'}
          </h2>
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={loading}
            aria-label="Cerrar"
            className="p-2 -mr-2 rounded-full text-slate-500 hover:text-blue-900 hover:bg-azulado-200 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Campos */}
        <div className="px-5 sm:px-7 py-6 space-y-5">
          {/* Mensaje de error global */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Carrera */}
            <div className={shakingFields.carrera ? ERROR_MOTION_CLASS : ''}>
              {etiqueta('Carrera')}
              <SelectConDropdown
                name="carrera"
                value={formData.carrera}
                onChange={handleChange}
                onFocus={() => handleFieldFocus({ target: { name: 'carrera' } })}
                disabled={loading || editar || carreraBloqueada}
                options={carreraOptions}
                placeholder="Seleccione una carrera"
                error={erroresCampos.carrera}
              />
              {mensajeCampo('carrera')}
            </div>

            {/* Gestión */}
            <div className={shakingFields.gestion ? ERROR_MOTION_CLASS : ''}>
              {etiqueta('Gestión',
                calendarioActivo && String(formData.gestion) === String(calendarioActivo.gestion) && (
                  <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Activa
                  </span>
                )
              )}
              <SelectConDropdown
                name="gestion"
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
              {mensajeCampo('gestion')}
            </div>

            {/* Docente */}
            <div className={`md:col-span-2 ${shakingFields.docente ? ERROR_MOTION_CLASS : ''}`}>
              {etiqueta('Docente')}
              <SelectConDropdown
                name="docente"
                value={formData.docente}
                onChange={handleDocenteChange}
                onFocus={() => handleFieldFocus({ target: { name: 'docente' } })}
                disabled={editar || docenteBloqueadoPorNavegacion || !formData.gestion}
                options={docenteOptions}
                limiteSinBusqueda={5}
                tituloSinBusqueda="Últimos docentes registrados"
                placeholder={
                  !formData.carrera
                    ? 'Seleccione una carrera primero'
                    : !formData.gestion
                      ? 'Seleccione una gestión primero'
                      : cargandoDocentes
                        ? 'Cargando docentes...'
                        : docenteOptions.length === 0
                          ? 'Todos los docentes tienen fondo de tiempo en esta gestión'
                          : 'Escriba el nombre del docente'
                }
                error={erroresCampos.docente}
              />
              {mensajeCampo('docente')}
              {formData.carrera && formData.gestion && !cargandoDocentes && docenteOptions.length === 0 && (
                <p className="text-xs text-amber-700 mt-1.5 pl-4">
                  Todos los docentes tienen fondo de tiempo en esta gestión
                </p>
              )}
              {docenteDedicacionExclusiva && (
                <div className="mt-3 rounded-2xl bg-red-50 ring-1 ring-inset ring-red-200 px-4 py-3 text-sm font-semibold text-red-700">
                  Docente exento de distribución de tiempo (Art. 25°)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pie con botones */}
        <div className="px-5 sm:px-7 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 [border-top:1px_solid_#B8C9E1]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={loading}
            className="inline-flex justify-center items-center px-5 py-2.5 rounded-full text-sm font-semibold text-slate-700 hover:bg-azulado-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || docenteDedicacionExclusiva}
            className="inline-flex justify-center items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-blue-900 hover:bg-blue-950 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : (editar ? 'Actualizar Fondo' : 'Crear Fondo')}
          </button>
        </div>
      </form>
    </ModalCentrado>
  );
}

export default FormularioFondo;
