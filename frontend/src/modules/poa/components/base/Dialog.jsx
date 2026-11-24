import React from 'react';
import { FaExclamationTriangle, FaInfoCircle, FaTrashAlt, FaTimes } from 'react-icons/fa';
import Modal from './Modal';

const ICONS = {
  info: <FaInfoCircle className="text-sky-300" size={18} />,
  warning: <FaExclamationTriangle className="text-amber-300" size={18} />,
  danger: <FaTrashAlt className="text-red-300" size={18} />,
};

const COLORS = {
  info: 'border-sky-400/40 bg-sky-950/90',
  warning: 'border-amber-400/40 bg-amber-950/90',
  danger: 'border-red-400/40 bg-red-950/90',
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
    <Modal onClose={handleCancel} className="z-[260]">
      <div className={`modal-panel w-full max-w-md overflow-hidden ${COLORS[type] || COLORS.info}`}>
        <div className="modal-header flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-2xl bg-white/10 p-2 shadow-inner">
            {ICONS[type] || ICONS.info}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-extrabold text-white leading-tight">{title}</h3>
            {message && <p className="mt-2 text-sm leading-relaxed text-slate-100/90 whitespace-pre-line">{message}</p>}
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
          <div className="modal-body px-5 py-4 text-sm text-slate-100/90">
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
