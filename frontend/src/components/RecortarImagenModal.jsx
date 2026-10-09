import { useEffect, useRef, useState } from 'react';
import { Crop } from 'lucide-react';
import toast from 'react-hot-toast';
import ModalCentrado from './common/ModalCentrado';
import { BOTON } from './fondos/estilosFondo';

// El recorte se guarda en fracciones (0-1) de la imagen mostrada.
const RECORTE_INICIAL = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
const MINIMO = 0.05;

const ESQUINAS = [
  { id: 'nw', clase: '-left-2 -top-2 cursor-nwse-resize' },
  { id: 'ne', clase: '-right-2 -top-2 cursor-nesw-resize' },
  { id: 'sw', clase: '-left-2 -bottom-2 cursor-nesw-resize' },
  { id: 'se', clase: '-right-2 -bottom-2 cursor-nwse-resize' },
];

const limitar = (valor, min, max) => Math.min(Math.max(valor, min), max);

/**
 * Recorta una imagen del informe: se arrastra el recuadro para moverlo y sus
 * esquinas para cambiar el tamaño. Devuelve (onAplicar) la imagen recortada como
 * data URL, en el mismo formato que la original (JPG se queda JPG; lo demás, PNG).
 */
export default function RecortarImagenModal({ src, onAplicar, onCancelar }) {
  const imagenRef = useRef(null);
  const arrastreRef = useRef(null);
  const [recorte, setRecorte] = useState(RECORTE_INICIAL);

  useEffect(() => {
    const mover = (e) => {
      const arrastre = arrastreRef.current;
      const rect = imagenRef.current?.getBoundingClientRect();
      if (!arrastre || !rect) return;
      const dx = (e.clientX - arrastre.x) / rect.width;
      const dy = (e.clientY - arrastre.y) / rect.height;
      const r = arrastre.inicial;

      if (arrastre.modo === 'mover') {
        setRecorte({ ...r, x: limitar(r.x + dx, 0, 1 - r.w), y: limitar(r.y + dy, 0, 1 - r.h) });
        return;
      }
      let { x, y, w, h } = r;
      if (arrastre.modo.includes('w')) {
        const nuevoX = limitar(r.x + dx, 0, r.x + r.w - MINIMO);
        w = r.w + (r.x - nuevoX);
        x = nuevoX;
      }
      if (arrastre.modo.includes('e')) w = limitar(r.w + dx, MINIMO, 1 - r.x);
      if (arrastre.modo.includes('n')) {
        const nuevoY = limitar(r.y + dy, 0, r.y + r.h - MINIMO);
        h = r.h + (r.y - nuevoY);
        y = nuevoY;
      }
      if (arrastre.modo.includes('s')) h = limitar(r.h + dy, MINIMO, 1 - r.y);
      setRecorte({ x, y, w, h });
    };
    const soltar = () => { arrastreRef.current = null; };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, []);

  const iniciar = (e, modo) => {
    e.preventDefault();
    e.stopPropagation();
    arrastreRef.current = { modo, x: e.clientX, y: e.clientY, inicial: recorte };
  };

  const aplicar = () => {
    const img = imagenRef.current;
    if (!img) return;
    const ancho = Math.max(1, Math.round(recorte.w * img.naturalWidth));
    const alto = Math.max(1, Math.round(recorte.h * img.naturalHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    lienzo.getContext('2d').drawImage(
      img,
      Math.round(recorte.x * img.naturalWidth), Math.round(recorte.y * img.naturalHeight), ancho, alto,
      0, 0, ancho, alto,
    );
    // La imagen puede ser recién insertada (data:) o ya guardada (/media/...jpg?t=...).
    const esJpg = /^data:image\/jpe?g|\.jpe?g(\?|$)/i.test(src);
    try {
      onAplicar(esJpg ? lienzo.toDataURL('image/jpeg', 0.92) : lienzo.toDataURL('image/png'));
    } catch {
      toast.error('No se pudo recortar esta imagen. Vuelve a insertarla y recórtala.');
    }
  };

  const porcentaje = (valor) => `${valor * 100}%`;

  return (
    <ModalCentrado onClose={onCancelar}>
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-azulado-50 ring-1 ring-azulado-300 shadow-2xl">
        <div className="flex items-start gap-4 px-6 pt-6">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-azulado-200 text-blue-900 ring-1 ring-inset ring-azulado-300">
            <Crop className="h-6 w-6" strokeWidth={1.6} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Imagen del informe</p>
            <h4 className="text-xl font-bold leading-tight text-blue-900">Recortar imagen</h4>
          </div>
        </div>
        <p className="px-6 pt-3 text-sm text-slate-600">
          Arrastra el recuadro para moverlo y sus esquinas para elegir qué parte de la imagen se queda.
        </p>

        <div className="px-6 py-5">
          <div className="flex justify-center overflow-hidden rounded-2xl bg-slate-800 p-4">
            <div className="relative select-none touch-none">
              <img
                ref={imagenRef}
                src={src}
                alt=""
                draggable={false}
                // Las imágenes ya guardadas vienen del servidor: sin CORS el lienzo
                // no deja leerlas para recortarlas.
                crossOrigin={src.startsWith('data:') ? undefined : 'anonymous'}
                className="block max-h-[55vh] max-w-full"
              />
              {/* Fuera del recorte se oscurece; dentro queda la parte que se conserva */}
              <div
                onPointerDown={(e) => iniciar(e, 'mover')}
                className="absolute cursor-move ring-2 ring-white shadow-[0_0_0_9999px_rgba(15,23,42,0.6)]"
                style={{ left: porcentaje(recorte.x), top: porcentaje(recorte.y), width: porcentaje(recorte.w), height: porcentaje(recorte.h) }}
              >
                {ESQUINAS.map(({ id, clase }) => (
                  <span
                    key={id}
                    onPointerDown={(e) => iniciar(e, id)}
                    className={`absolute h-4 w-4 rounded-full border-2 border-white bg-blue-900 shadow ${clase}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 bg-azulado-100/60 px-6 py-4 [border-top:1px_solid_#B8C9E1]">
          <button
            type="button"
            onClick={onCancelar}
            className={`${BOTON} px-5 py-2.5 bg-white text-slate-700 ring-1 ring-inset ring-azulado-300 hover:bg-azulado-100`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            className={`${BOTON} px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white`}
          >
            <Crop className="h-4 w-4" />
            Recortar
          </button>
        </div>
      </div>
    </ModalCentrado>
  );
}
