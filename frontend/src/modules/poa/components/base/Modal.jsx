import React from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getTopModal = () => {
  const modals = Array.from(document.querySelectorAll('.poa-modal'));
  return modals[modals.length - 1] || null;
};

const Modal = ({
  children,
  onClose,
  className = '',
  ariaLabel = 'Diálogo del módulo POA',
  ariaLabelledBy,
  ariaDescribedBy,
}) => {
  const modalRef = React.useRef(null);
  const closeHandlerRef = React.useRef(onClose);
  closeHandlerRef.current = onClose;

  React.useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusableElements = () => Array.from(
      modalRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [],
    ).filter((element) => element.getClientRects().length > 0);

    const initialFocus = modalRef.current?.querySelector('[autofocus]') || focusableElements()[0];
    (initialFocus || modalRef.current)?.focus?.();

    const handleKeyDown = (event) => {
      if (getTopModal() !== modalRef.current) return;

      if (event.key === 'Escape' && closeHandlerRef.current) {
        event.preventDefault();
        closeHandlerRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        modalRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modalRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modalRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div
      ref={modalRef}
      className={`poa-modal ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      tabIndex={-1}
    >
      <div className="modal-panel-overlay">{children}</div>
    </div>,
    document.body,
  );
};

export default Modal;
