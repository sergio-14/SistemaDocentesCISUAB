import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Componente Modal base para el módulo POA
 * Se renderiza directamente en document.body para asegurar que se superponga sobre todo
 */
const Modal = ({ children, onClose, className = '' }) => {
  const modalRef = React.useRef(null);
  // Manejar tecla Escape para cerrar
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && onClose) {
        const modalesAbiertos = Array.from(document.querySelectorAll('.poa-modal'));
        if (modalesAbiertos[modalesAbiertos.length - 1] !== modalRef.current) return;
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Bloquear scroll del body mientras el modal está abierto
  React.useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const modalContent = (
    <div 
      ref={modalRef}
      className={`poa-modal ${className}`}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-panel-overlay">
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
