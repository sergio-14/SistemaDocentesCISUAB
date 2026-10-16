import fotoPredeterminada from '../../assets/logoPre.jpg';

// Foto de perfil del usuario (la propia o el logo de su carrera); sin foto, o si no carga,
// la imagen predeterminada. Solo muestra: cambiarla o eliminarla es en Mi cuenta → Perfil.
function FotoPerfil({ user, className = '' }) {
  return (
    <img
      src={user?.perfil?.foto_perfil || fotoPredeterminada}
      alt="Foto de perfil"
      onError={(evento) => {
        if (!evento.currentTarget.src.endsWith(fotoPredeterminada)) evento.currentTarget.src = fotoPredeterminada;
      }}
      className={`w-full h-full rounded-full object-cover bg-white shadow-md ${className}`}
    />
  );
}

export default FotoPerfil;
