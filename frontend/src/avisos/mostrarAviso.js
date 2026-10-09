import toast from 'react-hot-toast';

// Tono del aviso (lo decide el backend, fondos/avisos.py) -> toast del sistema.
const TOAST_POR_TONO = {
  aviso: { mostrar: toast, titulo: 'Novedad' },
  exito: { mostrar: toast.success, titulo: 'Novedad' },
  atencion: { mostrar: toast.error, titulo: 'Atención' },
};

/**
 * Muestra un aviso del Fondo de Tiempo con el toast del sistema (mismas reglas:
 * 4 s, se cierra con la X o con un clic fuera). Con `alVer`, lleva un botón (`etiqueta`,
 * "Ver" si no se indica) que abre lo que corresponde.
 * `id` evita que el mismo aviso salga dos veces si se pide de nuevo.
 */
export default function mostrarAviso({ texto, tono = 'aviso', alVer = null, etiqueta = 'Ver', id = undefined }) {
  const { mostrar, titulo } = TOAST_POR_TONO[tono] || TOAST_POR_TONO.aviso;
  mostrar(texto, {
    id,
    titulo,
    accion: alVer ? { etiqueta, alHacerClic: alVer } : undefined,
  });
}
