/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 👈 AGREGADO para soportar modo oscuro
  theme: {
    extend: {
      colors: {
        // Blanco azulado del módulo de Fondo de Tiempo: menos brillante que el blanco puro.
        // 100 es el fondo del panel y 50 el de los bloques, para que se distingan entre sí.
        'azulado': {
          50: '#F7F9FD',
          100: '#DFE8F5',
          200: '#D2DDEE',
          300: '#B8C9E1',
        },
        'uab-blue': {
          50: '#EBF5FF',
          100: '#D6EBFF',
          200: '#B3D9FF',
          300: '#80C1FF',
          400: '#4DA3FF',
          500: '#1A85FF',
          600: '#0066E6',
          700: '#004DB3',
          800: '#003580',
          900: '#001D4D',
        },
        'uab-green': {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        'uab-gold': {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        // Colores semánticos de botones del módulo POA
        'btn-nuevo': '#059669',
        'btn-nuevo-dark': '#047857',
        'btn-guardar': '#0ea5a4',
        'btn-guardar-dark': '#0f766e',
        'btn-cancelar': '#f3f4f6',
        'btn-cancelar-dark': '#e5e7eb',
        'btn-editar': '#f59e0b',
        'btn-editar-dark': '#d97706',
        'btn-eliminar': '#ef4444',
        'btn-eliminar-dark': '#dc2626',
        'btn-volver': '#bbc7dfff',
        'btn-volver-dark': '#d1d5db',
        'btn-info': '#10b981',
        'btn-info-dark': '#059669',
      },
      // Tipografía: los valores son variables CSS definidas en src/index.css (sección
      // "Tipografía"). El sistema usa la escala nueva y el POA conserva la de Tailwind.
      fontFamily: {
        'sans': ['var(--fuente-sans)'],
      },
      fontSize: {
        'xs': ['var(--texto-xs)', { lineHeight: 'var(--interlineado-xs)' }],
        'sm': ['var(--texto-sm)', { lineHeight: 'var(--interlineado-sm)' }],
        'base': ['var(--texto-base)', { lineHeight: 'var(--interlineado-base)' }],
        'lg': ['var(--texto-lg)', { lineHeight: 'var(--interlineado-lg)' }],
        'xl': ['var(--texto-xl)', { lineHeight: 'var(--interlineado-xl)' }],
        '2xl': ['var(--texto-2xl)', { lineHeight: 'var(--interlineado-2xl)' }],
        '3xl': ['var(--texto-3xl)', { lineHeight: 'var(--interlineado-3xl)' }],
      },
      fontWeight: {
        'bold': 'var(--peso-bold)',
        'extrabold': 'var(--peso-extrabold)',
        'black': 'var(--peso-black)',
      },
      boxShadow: {
        'uab': '0 4px 6px -1px rgba(0, 102, 230, 0.1), 0 2px 4px -1px rgba(0, 102, 230, 0.06)',
        'uab-lg': '0 10px 15px -3px rgba(0, 102, 230, 0.1), 0 4px 6px -2px rgba(0, 102, 230, 0.05)',
      },
      // 👇 AGREGADO: Animaciones para el sistema de slots
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { 
            opacity: '0', 
            transform: 'scale(0.95)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'scale(1)' 
          },
        }
      }
    },
  },
  plugins: [],
}