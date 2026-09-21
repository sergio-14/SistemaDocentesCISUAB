import { useEffect, useRef } from 'react';
import { useInformeDocumento } from './InformeDocumentoContext';

/**
 * Bloque de texto PLANO editable en el documento (encabezado institucional,
 * fecha, destinatario/remitente/referencia, datos de firma): son datos
 * puntuales precargados desde Docente/Carrera/Director, no narrativa que
 * necesite negrita/cursiva propia -el negreado que se ve (p. ej. el cargo
 * del destinatario) lo aplica el estilo del bloque, no el docente-, así que
 * no activan la barra de formato ni aceptan HTML pegado. `multilinea`
 * habilita saltos de línea (usado solo en el encabezado institucional).
 */
export default function InformeCampoPlano({ value, onChange, placeholder = '', className = '', multilinea = false }) {
  const ref = useRef(null);
  const enFocoRef = useRef(false);
  const { setCampoActivo, soloLectura } = useInformeDocumento();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!enFocoRef.current && el.innerText.replace(/\n+$/, '') !== (value || '')) {
      el.innerText = value || '';
    }
  }, [value]);

  const emitirCambio = () => {
    if (!ref.current) return;
    const texto = ref.current.innerText.replace(/\n+$/, '');
    onChange(multilinea ? texto : texto.replace(/\n/g, ' '));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multilinea) {
      e.preventDefault();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const texto = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, multilinea ? texto : texto.replace(/\n/g, ' '));
  };

  return (
    <span
      ref={ref}
      contentEditable={!soloLectura}
      suppressContentEditableWarning
      onFocus={() => { enFocoRef.current = true; setCampoActivo(null); }}
      onBlur={() => { enFocoRef.current = false; }}
      onInput={emitirCambio}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      // El "display" base (inline-block vs block) se decide una sola vez
      // aca segun `multilinea`, nunca mezclado con la className del padre:
      // Tailwind no garantiza que una utilidad "block" pasada por props
      // gane sobre "inline-block" en la misma cadena de clases (misma
      // especificidad CSS), asi que el encabezado (multilinea, con
      // text-center del padre) quedaba angosto y pegado a la izquierda en
      // vez de centrado en todo el ancho.
      className={`informe-campo-editable informe-campo-plano min-w-[2ch] rounded px-1 -mx-1 focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-slate-500 ${soloLectura ? '' : 'hover:bg-blue-50/60 dark:hover:bg-blue-900/10 focus:bg-blue-50/80 dark:focus:bg-blue-900/20 focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-700'} ${multilinea ? 'block w-full whitespace-pre-line' : 'inline-block whitespace-normal break-words'} ${className}`}
    />
  );
}
