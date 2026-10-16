import fotoPredeterminada from '../../assets/logoPre.jpg';

// Foto de perfil del usuario (la propia o el logo de su carrera); sin foto, o si no carga,
// la imagen predeterminada. Solo muestra (cambiarla o eliminarla es en Mi cuenta) y se dibuja
// igual que ProfilePicture: un círculo blanco con sombra que recorta la imagen.
function FotoPerfil({ user }) {
  return (
    <div className="relative w-full h-full mx-auto">
      <div className="w-full h-full rounded-full overflow-hidden shadow-md relative bg-white">
        <img
          src={user?.perfil?.foto_perfil || fotoPredeterminada}
          alt="Perfil"
          onError={(evento) => {
            if (!evento.currentTarget.src.endsWith(fotoPredeterminada)) evento.currentTarget.src = fotoPredeterminada;
          }}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}

export default FotoPerfil;
