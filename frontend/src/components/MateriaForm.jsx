import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../apis/api';
import toast from 'react-hot-toast';

const InputField = ({ label, name, type = 'text', value, onChange, required, error }) => (
  <div>
        <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">{label} {required && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
            className={`w-full px-4 py-2.5 rounded-xl border-2 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm hover:shadow-md ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
    />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

const ChevronDown = ({ open = false }) => (
    <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#263F8A]/10 dark:bg-[#263F8A]/25 ring-1 ring-[#263F8A]/35 dark:ring-[#263F8A]/45">
            <svg
                className={`w-3 h-3 text-[#263F8A] dark:text-[#8EA0D9] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
        </span>
    </div>
);

const CustomSelect = ({
    value,
    options,
    onChange,
    placeholder,
    error,
    disabled = false,
    emptyText = 'Sin opciones disponibles',
    menuMaxHeight = 'max-h-56',
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const selected = options.find((opt) => opt.value?.toString() === value?.toString());

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const handlePick = (newValue) => {
        onChange(newValue);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => !disabled && setOpen((prev) => !prev)}
                disabled={disabled}
                className={`w-full text-left pl-3.5 pr-10 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-sm shadow-sm transition-all ${
                    disabled
                        ? 'border-slate-300/80 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
                        : open
                            ? 'border-[#263F8A] dark:border-[#3A56AF] ring-2 ring-[#263F8A]/35 dark:ring-[#3A56AF]/35 text-slate-900 dark:text-slate-100'
                            : error
                                ? 'border-red-500 text-slate-800 dark:text-slate-100'
                                : 'border-[#263F8A]/45 dark:border-[#3A56AF]/60 hover:border-[#263F8A]/75 dark:hover:border-[#4B67C0] text-slate-800 dark:text-slate-100'
                }`}
            >
                <span className="block truncate font-semibold">{selected ? selected.label : placeholder}</span>
                <ChevronDown open={open} />
            </button>

            {open && !disabled && (
                <div className={`absolute z-30 mt-1.5 w-full overflow-auto rounded-xl border border-[#263F8A]/40 dark:border-[#3A56AF]/60 bg-white dark:bg-slate-900 shadow-xl shadow-[#263F8A]/20 dark:shadow-black/35 ${menuMaxHeight}`}>
                    {options.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{emptyText}</div>
                    ) : (
                        options.map((opt) => {
                            const active = opt.value?.toString() === value?.toString();
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handlePick(opt.value)}
                                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors border-l-2 ${
                                        active
                                            ? 'bg-[#263F8A]/10 dark:bg-[#263F8A]/30 border-[#263F8A] dark:border-[#5C77CC] text-[#263F8A] dark:text-[#B6C3EC] font-semibold'
                                            : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/90'
                                    }`}
                                    title={opt.label}
                                >
                                    <span className="block truncate">{opt.label}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
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
        semestre: '',
        carrera: '',
        horas_teoricas: 0,
        horas_practicas: 0,
    });
    const [errors, setErrors] = useState({});

    const carreraOptions = (carreras || []).map((c) => ({
        value: String(c.id),
        label: c.nombre,
    }));

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const carreraFromFilter = searchParams.get('carrera');

        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        // iiisyp es solo lectura: no puede acceder al form de gestion de materias
        const esAdmin = userData?.is_superuser || userData?.perfil?.rol === 'director';

        if (!esAdmin) {
            toast.error("No tienes permisos para gestionar materias");
            navigate('/fondo-tiempo/materias');
            return;
        }

        const fetchCarreras = async () => {
            try {
                const res = await api.get('/carreras/');
                const carrerasData = res.data.results || res.data;
                setCarreras(carrerasData);

                if (!id && carreraFromFilter) {
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
    }, [id, location.search, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSelectChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrors({});

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
                setErrors(apiErrors);
                Object.keys(apiErrors).forEach(key => {
                    const msg = Array.isArray(apiErrors[key]) ? apiErrors[key].join(' ') : apiErrors[key];
                    if (key === 'non_field_errors') {
                        toast.error(msg);
                    } else {
                        toast.error(`Error en ${key}: ${msg}`);
                    }
                });
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

    return (
        <div className="min-h-screen bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
            <div className="max-w-4xl w-full">
                <div className="bg-white/75 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-slate-600/50 shadow-2xl overflow-hidden animate-slide-up" style={{ animationDuration: '180ms' }}>
                    <div className="px-6 py-4 border-b border-[#7F97E8]/45 bg-[#2C4AAE]">
                        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                            {id ? '✏️ Editar Materia' : '➕ Nueva Materia'}
                        </h1>
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2 rounded-xl border border-[#3D6DE0]/30 dark:border-[#4B67C0]/40 bg-gradient-to-r from-white/60 via-[#3D6DE0]/5 to-cyan-400/10 dark:from-slate-800/55 dark:to-cyan-900/20 p-4 shadow-sm">
                                <InputField label="Nombre de la Materia" name="nombre" value={formData.nombre} onChange={handleChange} required error={errors.nombre} />
                            </div>

                            <div>
                                <InputField label="Sigla" name="sigla" value={formData.sigla} onChange={handleChange} required error={errors.sigla} />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-2 text-slate-800 dark:text-slate-300">Carrera <span className="text-red-500">*</span></label>
                                <CustomSelect
                                    value={String(formData.carrera || '')}
                                    options={carreraOptions}
                                    onChange={(value) => handleSelectChange('carrera', value)}
                                    placeholder="Seleccione una carrera"
                                    error={errors.carrera}
                                />
                                {errors.carrera && <p className="text-xs text-red-600 mt-1">{errors.carrera}</p>}
                            </div>

                            <InputField label="Semestre" name="semestre" type="number" value={formData.semestre} onChange={handleChange} required error={errors.semestre} />
                            <InputField label="Horas Teóricas" name="horas_teoricas" type="number" value={formData.horas_teoricas} onChange={handleChange} required error={errors.horas_teoricas} />
                            <InputField label="Horas Prácticas" name="horas_practicas" type="number" value={formData.horas_practicas} onChange={handleChange} required error={errors.horas_practicas} />
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => navigate('/fondo-tiempo/materias')}
                                className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-semibold transition-colors border border-slate-300 dark:border-slate-600"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
                            >
                                {loading ? 'Guardando...' : '💾 Guardar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MateriaForm;