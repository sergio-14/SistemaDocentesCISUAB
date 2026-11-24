import React from 'react';

/**
 * Componente Select base para el módulo POA
 * Con soporte completo para temas claro/oscuro del sistema principal
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
          border border-gray-300 dark:border-sky-600/50
          bg-white dark:bg-slate-900
          text-gray-900 dark:text-slate-100
          focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500
          focus:border-blue-500 dark:focus:border-sky-500
          disabled:bg-gray-100 dark:disabled:bg-slate-800
          disabled:text-gray-500 dark:disabled:text-slate-400
          disabled:cursor-not-allowed
          transition-colors duration-200
          cursor-pointer
          ${error ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' : ''}
          ${selectClassName}
        `}
        {...props}
      >
        {children}
      </select>
      {helperText && !error && (
        <p className="poa-select-helper mt-1 text-xs text-gray-500 dark:text-slate-400">
          {helperText}
        </p>
      )}
      {error && (
        <p role="alert" className="poa-select-error mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
