"""
Script para eliminar todos los usuarios excepto 'denytva'
SOLO PARA ENTORNOS DE DESARROLLO
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from fondos.models import PerfilUsuario, Docente, FondoTiempo

def limpiar_usuarios():
    print("⚠️  ADVERTENCIA: Esto eliminará todos los usuarios excepto 'denytva'")
    print("¿Estás seguro de que quieres continuar? (escribe 'SI' para confirmar)")
    confirmacion = input("> ")
    
    if confirmacion != 'SI':
        print("❌ Operación cancelada")
        return
    
    # Usuario a conservar
    usuario_admin = User.objects.filter(username='denytva').first()
    if not usuario_admin:
        print("❌ No se encontró el usuario 'denytva'")
        return
    
    print(f"\n✅ Usuario conservado: {usuario_admin.username}")
    
    # Obtener todos los usuarios excepto el admin
    usuarios_a_eliminar = User.objects.exclude(username='denytva')
    total = usuarios_a_eliminar.count()
    
    print(f"\n📋 Usuarios a eliminar: {total}")
    
    eliminados = 0
    errores = 0
    
    for user in usuarios_a_eliminar:
        try:
            # Verificar si tiene Fondo de Tiempo
            if FondoTiempo.objects.filter(docente__usuario=user).exists():
                print(f"⚠️  SKIP: {user.username} - Tiene Fondo de Tiempo")
                errores += 1
                continue
            
            # Eliminación manual (mismo método que el ViewSet)
            if hasattr(user, 'perfil'):
                PerfilUsuario.objects.filter(user=user).delete()
            
            docente_relacionado = Docente.objects.filter(usuario=user).first()
            if docente_relacionado:
                docente_relacionado.delete()
            
            user.delete()
            eliminados += 1
            print(f"✓ Eliminado: {user.username}")
            
        except Exception as e:
            errores += 1
            print(f"✗ Error con {user.username}: {str(e)}")
    
    print(f"\n{'='*50}")
    print(f"✅ Eliminados: {eliminados}")
    print(f"⚠️  Errores/Skip: {errores}")
    print(f"{'='*50}")

if __name__ == '__main__':
    limpiar_usuarios()
