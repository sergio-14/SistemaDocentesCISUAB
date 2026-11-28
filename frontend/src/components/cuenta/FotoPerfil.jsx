import { fotoPredeterminada, imagenSinCarrera } from '../../utils/fotoPerfil';

// Foto de perfil del usuario (la propia); sin foto, el logo de su carrera activa y, si no
// carga, la imagen predeterminada. Solo muestra (cambiarla o eliminarla es en Mi cuenta) y se dibuja
// igual que ProfilePicture: un círculo blanco con sombra que recorta la imagen.
function FotoPerfil({ user }) {
  const predeterminada = fotoPredeterminada(user);
  return (
    <div className="relative w-full h-full mx-auto">
      <div className="w-full h-full rounded-full overflow-hidden shadow-md relative bg-white">
        <img
          src={user?.perfil?.foto_perfil || predeterminada}
          alt="Perfil"
          onError={(evento) => {
            if (!evento.currentTarget.src.endsWith(imagenSinCarrera)) evento.currentTarget.src = imagenSinCarrera;
          }}
          // La foto propia llena el círculo; un logo se ve entero.
          className={`w-full h-full ${user?.perfil?.foto_perfil ? 'object-cover' : 'object-contain'}`}
        />
      </div>
    </div>
  );
}

export default FotoPerfil;
