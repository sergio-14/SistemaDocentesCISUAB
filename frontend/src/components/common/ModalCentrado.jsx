import { createPortal } from 'react-dom';

// Modal del módulo de Fondo de Tiempo: se monta en <body> para que la animación de
// entrada de la página (que usa transform) no lo encierre, y cubre solo el área a la
// derecha del sidebar (--fondo-sidebar-width) con el fondo empañado.
function ModalCentrado({ children, onClose }) {
  return createPortal(
    <div
      className="fixed top-0 right-0 bottom-0 z-[60] flex overflow-y-auto bg-blue-950/30 backdrop-blur-sm p-3 sm:p-6"
      style={{ left: 'var(--fondo-sidebar-width, 0px)' }}
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="m-auto w-full flex justify-center">
        {children}
      </div>
    </div>,
    document.body
  );
}

export default ModalCentrado;
