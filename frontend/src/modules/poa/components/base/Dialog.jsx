import React from 'react';
import { FaExclamationTriangle, FaInfoCircle, FaTrashAlt, FaTimes } from 'react-icons/fa';
import Modal from './Modal';

const ICONS = {
  info: <FaInfoCircle className="text-blue-700" size={18} />,
  warning: <FaExclamationTriangle className="text-amber-700" size={18} />,
  danger: <FaTrashAlt className="text-rose-700" size={18} />,
};

const COLORS = {
  info: 'border-blue-200 bg-white',
  warning: 'border-amber-200 bg-amber-50',
  danger: 'border-rose-200 bg-rose-50',
};

const ButtonBase = ({ children, className = '', ...props }) => (
  <button
    type="button"
    {...props}
    className={`min-w-[104px] rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${className}`}
  >
    {children}
  </button>
);

const Dialog = ({
  open,
  type = 'info',
  title,
  message,
  children,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  onClose,
  hideCancel = false,
  confirmDisabled = false,
}) => {
  const titleId = React.useId();
  const messageId = React.useId();
  if (!open) return null;

  const confirmButtonClass =
    type === 'danger'
      ? 'btn-danger'
      : type === 'warning'
        ? 'bg-amber-300 hover:bg-amber-200 text-slate-950 border border-amber-200'
        : 'btn-primary text-white';

  const handleCancel = () => {
    if (onCancel) onCancel();
    if (onClose) onClose();
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    if (onClose) onClose();
  };

  return (
    <Modal onClose={handleCancel} className="z-[260]" ariaLabelledBy={titleId} ariaDescribedBy={message ? messageId : undefined}>
      <div className={`modal-panel poa-dialog-panel poa-dialog-${type} w-full max-w-md overflow-hidden ${COLORS[type] || COLORS.info}`}>
        <div className="modal-header flex items-start gap-3">
          <div className={`poa-dialog-icon poa-dialog-icon-${type} mt-0.5 shrink-0 rounded-2xl p-2`}>
            {ICONS[type] || ICONS.info}
          </div>
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-base font-extrabold text-slate-900 leading-tight">{title}</h3>
            {message && <p id={messageId} className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">{message}</p>}
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="btn-header-icon shrink-0 rounded-xl p-2 transition"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <FaTimes size={13} />
          </button>
        </div>

        {children && (
          <div className="modal-body px-5 py-4 text-sm text-slate-700">
            {children}
          </div>
        )}

        <div className="modal-actions flex items-center justify-end gap-3 px-5 py-4">
          {!hideCancel && (
            <ButtonBase
              onClick={handleCancel}
              className="btn-cancel"
            >
              {cancelText}
            </ButtonBase>
          )}
          <ButtonBase
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className={`${confirmButtonClass} disabled:opacity-50`}
          >
            {confirmText}
          </ButtonBase>
        </div>
      </div>
    </Modal>
  );
};

export default Dialog;
