import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api, { getCarreras } from '../../apis/api';
import toast from 'react-hot-toast';
import { useActiveRole } from '../../contexts/activeRole';
import FiltroDesplegable from '../common/FiltroDesplegable';
import SelectorRueda from '../common/SelectorRueda';
import { BOTON } from '../fondos/estilosFondo';
import {
  getBackendErrorMessage,
  getErrorMessage,
  sanitizeApiErrors,
  useErrorPulse,
} from '../../utils/formErrors';

// Campos con el estilo del módulo (píldora azulada, etiqueta chica arriba).
const LABEL_CAMPO = 'block text-xs font-semibold text-slate-700 mb-1.5 pl-1';
const CAMPO = 'w-full h-11 px-4 rounded-full text-sm text-slate-800 placeholder:text-slate-500 outline-none ring-inset !bg-azulado-100';
const CAMPO_NORMAL = 'ring-1 ring-azulado-300 focus:ring-2 focus:ring-blue-900/40';
const CAMPO_ERROR = 'ring-2 ring-red-500';

const SEMESTRES = Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}° Semestre` }));

const MensajeError = ({ error, motionClass = '' }) => {
  const mensaje = getErrorMessage(error);
  return mensaje ? <p className={`text-xs text-red-600 mt-1 pl-1 ${motionClass}`}>{mensaje}</p> : null;
};

// Horas por semana: campo con botones para subir y bajar de a una.
const NumberInput = ({ label, name, value, onChange, error, onClearError, errorPulse = 0 }) => {
  const { motionClass } = useErrorPulse(error, errorPulse);
  const errorMessage = getErrorMessage(error);

  const cambiar = (delta) => {
    onClearError?.();
    onChange({ target: { name, value: String(Math.max(0, Number(value || 0) + delta)) } });
  };

  const botonPaso = 'flex h-[18px] w-7 items-center justify-center rounded-md bg-[#2C4AAE] hover:bg-blue-900 text-white transition-colors';

  return (
    <div>
      <label className={LABEL_CAMPO}>{label}</label>
      <div className={`relative ${motionClass}`}>
        <input
          type="number"
          name={name}
          value={value}
          onChange={onChange}
          onFocus={onClearError}
          min="0"
          max="12"
          aria-invalid={Boolean(errorMessage)}
          className={`${CAMPO} pr-12 font-semibold tabular-nums ${errorMessage ? CAMPO_ERROR : CAMPO_NORMAL} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
          <button type="button" onClick={() => cambiar(1)} className={botonPaso} aria-label={`Aumentar ${label}`}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z" /></svg>
          </button>
          <button type="button" onClick={() => cambiar(-1)} className={botonPaso} aria-label={`Disminuir ${label}`}>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
          </button>
        </div>
      </div>
      <MensajeError error={error} motionClass={motionClass} />
    </div>
  );
};

const InputField = ({ label, name, value, onChange, error, onClearError, errorPulse = 0, placeholder }) => {
  const { motionClass } = useErrorPulse(error, errorPulse);
  const errorMessage = getErrorMessage(error);

  return (
    <div>
      <label className={LABEL_CAMPO}>{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        onFocus={onClearError}
        placeholder={placeholder}
        aria-invalid={Boolean(errorMessage)}
        className={`${CAMPO} ${errorMessage ? `${CAMPO_ERROR} ${motionClass}` : CAMPO_NORMAL}`}
      />
      <MensajeError error={error} motionClass={motionClass} />
    </div>
  );
};

const MateriaForm = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [carreras, setCarreras] = useState([]);
    const [formData, setFormData] = useState({
        nombre: '',
        sigla: '',
        semestre: 1,
        carrera: '',
        horas_teoricas: 0,
        horas_practicas: 0,
    });
    const [errors, setErrors] = useState({});
    const [errorPulse, setErrorPulse] = useState(0);
    // Solo el superusuario elige la carrera; Director y Jefe usan la suya (rol activo).
    const { effectiveUser, activeRole } = useActiveRole();
    const esSuperAdmin = effectiveUser?.is_superuser === true;

    const carreraOptions = (carreras || []).map((c) => ({
        value: String(c.id),
        label: c.nombre,
    }));

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const carreraFromFilter = searchParams.get('carrera');

        // iiisyp es solo lectura: no puede acceder al form de gestion de materias
        const esAdmin = esSuperAdmin || ['director', 'jefe_estudios'].includes(activeRole);

        if (!esAdmin) {
            toast.error("No tienes permisos para gestionar materias");
            navigate('/fondo-tiempo/materias');
            return;
        }

        const fetchCarreras = async () => {
            try {
                const carrerasData = await getCarreras();
                setCarreras(carrerasData);

                // Director y Jefe: el backend solo devuelve su carrera y es la de la materia nueva.
                if (!id && !esSuperAdmin && carrerasData?.length) {
                    setFormData(prev => ({ ...prev, carrera: String(carrerasData[0].id) }));
                } else if (!id && carreraFromFilter) {
                    const carreraExiste = (carrerasData || []).some((c) => String(c.id) === String(carreraFromFilter));
                    if (carreraExiste) {
                        setFormData(prev => ({
                            ...prev,
                            carrera: String(carreraFromFilter)
                        }));
                    }
                }
            } catch (error) {
                console.error("Error cargando carreras:", error);
                toast.error("Error al cargar carreras");
            }
        };
        fetchCarreras();

        if (id) {
            const fetchMateria = async () => {
                try {
                    const res = await api.get(`/materias/${id}/`);
                    const data = res.data;
                    // Asegurarse de que carrera sea el ID si viene como objeto
                    if (data.carrera && typeof data.carrera === 'object') {
                        data.carrera = data.carrera.id;
                    }
                    setFormData(data);
                } catch (error) {
                    console.error("Error cargando materia:", error);
                    toast.error("Error al cargar la materia");
                }
            };
            fetchMateria();
        }
    }, [id, location.search, navigate, esSuperAdmin, activeRole]);

    const clearFieldError = (fieldName) => {
        setErrors(prev => {
            if (!prev?.[fieldName]) return prev;
            const next = { ...prev };
            delete next[fieldName];
            return next;
        });
    };

    const applyErrors = (nextErrors) => {
        setErrors(nextErrors);
        setErrorPulse(prev => prev + 1);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        clearFieldError(name);
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSelectChange = (fieldName, value) => {
        clearFieldError(fieldName);
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrors({});

        const clientErrors = {};
        if (!String(formData.nombre || '').trim()) {
            clientErrors.nombre = 'El nombre de la materia es obligatorio.';
        }
        if (!String(formData.sigla || '').trim()) {
            clientErrors.sigla = 'La sigla de la materia es obligatoria.';
        }
        if (!String(formData.carrera || '').trim()) {
            clientErrors.carrera = esSuperAdmin ? 'Debe seleccionar una carrera.' : 'No tienes una carrera asignada.';
        }

        // Validaciones de horas
        const horasTeoricas = Number(formData.horas_teoricas) || 0;
        const horasPracticas = Number(formData.horas_practicas) || 0;
        const horasTotales = horasTeoricas + horasPracticas;
        const semestreValue = Number(formData.semestre);

        if (!formData.semestre || isNaN(semestreValue) || semestreValue < 1 || semestreValue > 10) {
            clientErrors.semestre = 'Introduzca un numero entero valido entre 1 y 10.';
        }
        if (horasTeoricas < 0) {
            clientErrors.horas_teoricas = 'Las horas no pueden ser negativas.';
        }
        if (horasPracticas < 0) {
            clientErrors.horas_practicas = 'Las horas no pueden ser negativas.';
        }

        if (!clientErrors.horas_teoricas && !clientErrors.horas_practicas && horasTotales < 2) {
            clientErrors.horas_teoricas = 'La suma de horas teoricas y practicas debe ser minimo 2 horas.';
            clientErrors.horas_practicas = 'La suma de horas teoricas y practicas debe ser minimo 2 horas.';
        }
        if (horasTotales > 12) {
            clientErrors.horas_teoricas = 'La suma de horas teoricas y practicas no puede exceder 12 horas.';
            clientErrors.horas_practicas = 'La suma de horas teoricas y practicas no puede exceder 12 horas.';
        }

        if (Object.keys(clientErrors).length > 0) {
            applyErrors(clientErrors);
            toast.error(getBackendErrorMessage(clientErrors, 'Revise los campos marcados en rojo.'));
            setLoading(false);
            return;
        }

        try {
            let response;
            if (id) {
                response = await api.put(`/materias/${id}/`, formData);
                if (response.status !== 200) {
                    throw new Error('Respuesta inesperada al actualizar materia');
                }
                toast.success('Materia actualizada correctamente');
            } else {
                response = await api.post('/materias/', formData);
                if (response.status !== 201) {
                    throw new Error('Respuesta inesperada al crear materia');
                }
                toast.success('Materia creada correctamente');
            }

            navigate('/fondo-tiempo/materias');
        } catch (err) {
            console.error(err);
            const statusCode = err.response?.status;
            const apiErrors = err.response?.data;
            if (apiErrors) {
                applyErrors(sanitizeApiErrors(apiErrors));
                toast.error(getBackendErrorMessage(apiErrors, 'No se pudo guardar la materia.'));
                if (statusCode === 400) {
                    return;
                }
            } else {
                toast.error('Ocurrió un error inesperado.');
            }
        } finally {
            setLoading(false);
        }
    };

    const semestrePulse = useErrorPulse(errors.semestre, errorPulse);
    const carreraPulse = useErrorPulse(errors.carrera, errorPulse);
    const horasTotales = (Number(formData.horas_teoricas) || 0) + (Number(formData.horas_practicas) || 0);

    // Se monta en <body> y cubre el área a la derecha del sidebar (en el celular, toda la pantalla).
    return createPortal(
        <div
            className="fixed top-0 right-0 bottom-0 z-50 overflow-y-auto bg-blue-950/30 backdrop-blur-sm animate-fade-in"
            style={{ left: 'var(--fondo-sidebar-width, 0px)', animationDuration: '160ms' }}
        >
            <div className="min-h-full flex items-center justify-center p-3 sm:p-6">
                <div className="w-full max-w-3xl rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl animate-slide-up" style={{ animationDuration: '180ms' }}>
                    <div className="px-5 sm:px-6 pt-6 pb-4 [border-bottom:1px_solid_#B8C9E1]">
                        <h2 className="text-xl font-bold text-blue-900">
                            {id ? 'Editar Materia' : 'Nueva Materia'}
                        </h2>
                        <p className="mt-0.5 text-sm text-slate-600">
                            Datos de la asignatura en la malla curricular de la carrera.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-6 space-y-5">
                        <InputField
                            label="Nombre de la materia"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleChange}
                            onClearError={() => clearFieldError('nombre')}
                            error={errors.nombre}
                            errorPulse={errorPulse}
                            placeholder="Ej: Cálculo I"
                        />

                        <div className={`grid grid-cols-1 gap-4 ${esSuperAdmin ? 'sm:grid-cols-2' : ''}`}>
                            <InputField
                                label="Sigla"
                                name="sigla"
                                value={formData.sigla}
                                onChange={handleChange}
                                onClearError={() => clearFieldError('sigla')}
                                error={errors.sigla}
                                errorPulse={errorPulse}
                                placeholder="Ej: MAT-101"
                            />
                            {esSuperAdmin && (
                                <div className={carreraPulse.motionClass}>
                                    <label className={LABEL_CAMPO}>Carrera</label>
                                    <FiltroDesplegable
                                        value={String(formData.carrera || '')}
                                        options={carreraOptions}
                                        onChange={(value) => handleSelectChange('carrera', value)}
                                        placeholder="Seleccione una carrera"
                                        ariaLabel="Carrera"
                                        emptyText="No hay carreras que coincidan"
                                        permitirQuitar={false}
                                        invalido={Boolean(getErrorMessage(errors.carrera))}
                                    />
                                    <MensajeError error={errors.carrera} />
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl bg-white/70 ring-1 ring-inset ring-azulado-300 p-4">
                            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                                <h3 className="text-sm font-bold text-blue-900">Semestre y carga horaria</h3>
                                <span className={`text-xs font-semibold tabular-nums ${horasTotales >= 2 && horasTotales <= 12 ? 'text-slate-600' : 'text-red-600'}`}>
                                    Total: {horasTotales} h/semana
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className={semestrePulse.motionClass}>
                                    <label className={LABEL_CAMPO}>Semestre</label>
                                    <SelectorRueda
                                        value={String(formData.semestre || '')}
                                        options={SEMESTRES}
                                        onChange={(valor) => {
                                            clearFieldError('semestre');
                                            handleChange({ target: { name: 'semestre', value: Number(valor) } });
                                        }}
                                        placeholder="Seleccione..."
                                        titulo="Semestre"
                                        invalido={Boolean(getErrorMessage(errors.semestre))}
                                        claseTexto="text-sm"
                                    />
                                    <MensajeError error={errors.semestre} />
                                </div>
                                <NumberInput
                                    label="Horas teóricas"
                                    name="horas_teoricas"
                                    value={formData.horas_teoricas}
                                    onChange={handleChange}
                                    error={errors.horas_teoricas}
                                    onClearError={() => clearFieldError('horas_teoricas')}
                                    errorPulse={errorPulse}
                                />
                                <NumberInput
                                    label="Horas prácticas"
                                    name="horas_practicas"
                                    value={formData.horas_practicas}
                                    onChange={handleChange}
                                    error={errors.horas_practicas}
                                    onClearError={() => clearFieldError('horas_practicas')}
                                    errorPulse={errorPulse}
                                />
                            </div>
                            <p className="mt-3 pl-1 text-xs text-slate-600">
                                La suma de horas teóricas y prácticas debe estar entre 2 y 12 horas semanales.
                            </p>
                        </div>

                        <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-2 [border-top:1px_solid_#B8C9E1]">
                            <button
                                type="button"
                                onClick={() => navigate('/fondo-tiempo/materias')}
                                className={`${BOTON} px-5 py-2.5 text-slate-700 hover:bg-azulado-200`}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white shadow-sm disabled:opacity-50`}
                            >
                                {loading ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default MateriaForm;
