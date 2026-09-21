"""
Script para reparar usuarios sin perfil
========================================
Busca usuarios que deberían tener perfil pero no lo tienen y lo crea.
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from fondos.models import PerfilUsuario

def reparar_perfiles():
    print("=" * 70)
    print("🔧 REPARACIÓN DE USUARIOS SIN PERFIL")
    print("=" * 70)
    
    # Buscar todos los usuarios sin perfil
    usuarios_sin_perfil = []
    for user in User.objects.all():
        if not hasattr(user, 'perfil'):
            usuarios_sin_perfil.append(user)
    
    if not usuarios_sin_perfil:
        print("\n✅ Todos los usuarios tienen perfil")
        return
    
    print(f"\n⚠️  Se encontraron {len(usuarios_sin_perfil)} usuario(s) sin perfil:")
    for user in usuarios_sin_perfil:
        print(f"   - {user.username} ({user.email})")
    
    print("\n¿Desea crear el perfil para estos usuarios? (s/n)")
    confirmacion = input("> ").lower()
    
    if confirmacion != 's':
        print("❌ Operación cancelada")
        return
    
    # Crear perfil para cada usuario sin perfil
    for user in usuarios_sin_perfil:
        try:
            perfil = PerfilUsuario.objects.create(
                user=user,
                rol='docente',  # Rol por defecto
                carrera=None,
                docente=None,
                telefono='',
                activo=True,
                debe_cambiar_password=False
            )
            print(f"\n✅ Perfil creado para {user.username}")
            print(f"   Rol: docente (por defecto)")
            print(f"   Docente: None (sin vincular)")
        except Exception as e:
            print(f"\n❌ Error al crear perfil para {user.username}: {str(e)}")
    
    print("\n" + "=" * 70)
    print("✅ REPARACIÓN COMPLETADA")
    print("=" * 70)

if __name__ == '__main__':
    reparar_perfiles()
