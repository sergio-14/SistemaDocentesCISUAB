import React from 'react';

const Textarea = React.forwardRef(({
  label,
  error,
  helperText,
  id,
  className = '',
  wrapperClassName = '',
  labelClassName = '',
  textareaClassName = '',
  'aria-describedby': describedBy,
  ...props
}, ref) => {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
  const helperId = helperText && !error ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const ariaDescribedBy = [describedBy, helperId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`poa-textarea-wrapper ${wrapperClassName}`}>
      {label && (
        <label htmlFor={fieldId} className={`poa-textarea-label ${labelClassName}`}>
          {label}
        </label>
      )}
      <textarea
        {...props}
        ref={ref}
        id={fieldId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        className={`poa-textarea ${className} ${textareaClassName}`.trim()}
      />
      {helperId && <p id={helperId} className="poa-textarea-helper">{helperText}</p>}
      {errorId && <p id={errorId} role="alert" className="poa-textarea-error">{error}</p>}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
