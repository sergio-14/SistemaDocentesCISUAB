import React from 'react';

/**
 * Componente Select base para el módulo POA
 */
const Select = React.forwardRef(({
  label,
  error,
  helperText,
  children,
  className = '',
  wrapperClassName = '',
  labelClassName = '',
  selectClassName = '',
  ...props
}, ref) => {
  return (
    <div className={`poa-select-wrapper ${wrapperClassName}`}>
      {label && (
        <label className={`poa-select-label block text-sm font-medium ${labelClassName}`}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        aria-invalid={error ? 'true' : undefined}
        className={`
          poa-select
          mt-1 block w-full rounded px-3 py-2
          border border-gray-300
          bg-white
          text-gray-900
          focus:outline-none focus:ring-2 focus:ring-blue-500
          focus:border-blue-500
          disabled:bg-gray-100
          disabled:text-gray-500
          disabled:cursor-not-allowed
          transition-colors duration-200
          cursor-pointer
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${selectClassName}
        `}
        {...props}
      >
        {children}
      </select>
      {helperText && !error && (
        <p className="poa-select-helper mt-1 text-xs text-gray-500">
          {helperText}
        </p>
      )}
      {error && (
        <p role="alert" className="poa-select-error mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
