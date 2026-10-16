// Apariencia de la interfaz que elige cada usuario en Mi cuenta → Apariencia. Se guarda en
// su perfil (backend: PerfilUsuario.preferencias_interfaz) y se aplica como atributos data-*
// de <html>; index.css (sección "Preferencias de apariencia") los lee solo fuera del POA.

export const PREFERENCIAS_POR_DEFECTO = {
  texto: 'normal',
  esquinas: 'redondeado',
  densidad: 'comoda',
  reducir_animaciones: false,
};

export const OPCIONES_TEXTO = [
  { valor: 'pequeno', etiqueta: 'Pequeño' },
  { valor: 'normal', etiqueta: 'Normal' },
  { valor: 'grande', etiqueta: 'Grande' },
  { valor: 'muy_grande', etiqueta: 'Muy grande' },
];

export const OPCIONES_ESQUINAS = [
  { valor: 'redondeado', etiqueta: 'Redondeado' },
  { valor: 'suave', etiqueta: 'Suave' },
  { valor: 'recto', etiqueta: 'Recto' },
];

export const OPCIONES_DENSIDAD = [
  { valor: 'comoda', etiqueta: 'Cómoda' },
  { valor: 'compacta', etiqueta: 'Compacta' },
];

const VALIDOS = {
  texto: OPCIONES_TEXTO.map((opcion) => opcion.valor),
  esquinas: OPCIONES_ESQUINAS.map((opcion) => opcion.valor),
  densidad: OPCIONES_DENSIDAD.map((opcion) => opcion.valor),
};

// Lo guardado con valores conocidos; lo que falte o no sea válido, por defecto.
export const normalizarPreferencias = (preferencias) => {
  const datos = preferencias && typeof preferencias === 'object' ? preferencias : {};
  return {
    texto: VALIDOS.texto.includes(datos.texto) ? datos.texto : PREFERENCIAS_POR_DEFECTO.texto,
    esquinas: VALIDOS.esquinas.includes(datos.esquinas) ? datos.esquinas : PREFERENCIAS_POR_DEFECTO.esquinas,
    densidad: VALIDOS.densidad.includes(datos.densidad) ? datos.densidad : PREFERENCIAS_POR_DEFECTO.densidad,
    reducir_animaciones: datos.reducir_animaciones === true,
  };
};

// Claves que difieren entre dos juegos de preferencias (para "N cambios").
export const clavesCambiadas = (a, b) => {
  const x = normalizarPreferencias(a);
  const y = normalizarPreferencias(b);
  return Object.keys(PREFERENCIAS_POR_DEFECTO).filter((clave) => x[clave] !== y[clave]);
};

// Pone (o quita, si es el valor por defecto) cada atributo en <html>. null = sin sesión.
export const aplicarPreferencias = (preferencias) => {
  const raiz = document.documentElement;
  const valores = preferencias ? normalizarPreferencias(preferencias) : PREFERENCIAS_POR_DEFECTO;
  const atributos = {
    texto: valores.texto !== 'normal' ? valores.texto : null,
    esquinas: valores.esquinas !== 'redondeado' ? valores.esquinas : null,
    densidad: valores.densidad !== 'comoda' ? valores.densidad : null,
    reducirAnimaciones: valores.reducir_animaciones ? 'true' : null,
  };
  Object.entries(atributos).forEach(([clave, valor]) => {
    if (valor) raiz.dataset[clave] = valor;
    else delete raiz.dataset[clave];
  });
};

// Para animaciones hechas en JavaScript: el sistema operativo o el usuario en Apariencia.
export const animacionesReducidas = () => (
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
  || document.documentElement.dataset.reducirAnimaciones === 'true'
);
