"""
Script de Recuperación de PerfilUsuario Eliminado
==================================================
Este script recrea el perfil de un usuario que fue eliminado accidentalmente
desde el Admin de Django.

Uso:
    python backend/recuperar_perfil.py <username>
    
Ejemplo:
    python backend/recuperar_perfil.py denytva
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from fondos.models import PerfilUsuario, Docente, Carrera

def recuperar_perfil(username):
    print("=" * 60)
    print("🔧 SCRIPT DE RECUPERACIÓN DE PERFIL DE USUARIO")
    print("=" * 60)
    
    # 1. Buscar al usuario afectado
    try:
        user = User.objects.get(username=username)
        print(f"\n✅ Usuario encontrado: {user.username}")
        print(f"   Email: {user.email}")
        print(f"   Nombre: {user.first_name} {user.last_name}")
    except User.DoesNotExist:
        print(f"\n❌ ERROR: No existe el usuario '{username}'")
        return
    
    # 2. Verificar si ya tiene perfil
    if hasattr(user, 'perfil') and user.perfil:
        print(f"\n⚠️  ADVERTENCIA: El usuario YA tiene un perfil")
        print(f"   Rol: {user.perfil.get_rol_display()}")
        print(f"   Carrera: {user.perfil.carrera.nombre if user.perfil.carrera else 'Ninguna'}")
        print(f"   ¿Estás seguro de que quieres RECREAR el perfil? (s/n)")
        confirmacion = input("> ").lower()
        if confirmacion != 's':
            print("❌ Operación cancelada")
            return
        # Eliminar el perfil existente para crear uno nuevo
        user.perfil.delete()
        print("🗑️  Perfil anterior eliminado")
    
    # 3. Solicitar datos críticos para recrear el perfil
    print("\n" + "=" * 60)
    print("📋 DATOS CRÍTICOS PARA RECUPERAR EL PERFIL")
    print("=" * 60)
    
    # Rol
    print("\nSeleccione el Rol:")
    print("  1. Docente")
    print("  2. Director")
    print("  3. Jefe de Estudios")
    print("  4. Administrador")
    rol_opcion = input("Opción [1-4]: ").strip()
    
    roles_map = {
        '1': 'docente',
        '2': 'director',
        '3': 'jefe_estudios',
        '4': 'iiisyp'
    }
    rol = roles_map.get(rol_opcion, 'docente')
    print(f"✓ Rol seleccionado: {rol}")

    # Carrera (si es director, jefe o admin)
    carrera = None
    if rol in ['director', 'jefe_estudios', 'iiisyp']:
        print("\nCarreras disponibles:")
        carreras = list(Carrera.objects.all())
        for i, c in enumerate(carreras, 1):
            print(f"  {i}. {c.nombre} (Código: {c.codigo})")
        
        carrera_idx = input("Seleccione carrera [número]: ").strip()
        try:
            carrera = carreras[int(carrera_idx) - 1]
            print(f"✓ Carrera seleccionada: {carrera.nombre}")
        except (IndexError, ValueError):
            print("⚠️  Carrera no válida, se dejará sin carrera")
            carrera = None
    
    # 4. Para docentes: buscar o crear el Docente
    docente = None
    if rol == 'docente':
        print("\n" + "=" * 60)
        print("🔍 BUSCAR DOCENTE POR C.I.")
        print("=" * 60)
        
        ci = input("\nIngrese el C.I. del docente: ").strip()
        
        # Buscar si ya existe un docente con ese CI
        docente = Docente.objects.filter(ci=ci).first()
        
        if docente:
            print(f"\n✅ Docente encontrado: {docente.nombre_completo}")
            print(f"   CI: {docente.ci}")
            print(f"   Categoría: {docente.get_categoria_display()}")
            print(f"   Dedicación: {docente.get_dedicacion_display()}")
        else:
            print(f"\n⚠️  No existe docente con CI {ci}")
            print("¿Desea crear un nuevo docente? (s/n)")
            crear = input("> ").lower()
            
            if crear == 's':
                print("\nIngrese datos del nuevo docente:")
                nombres = input("Nombres: ").strip()
                apellido_paterno = input("Apellido Paterno: ").strip()
                apellido_materno = input("Apellido Materno (opcional): ").strip()
                categoria = input("Categoría [catedratico/adjunto/asistente]: ").strip() or 'asistente'
                dedicacion = input("Dedicación [tiempo_completo/medio_tiempo/horario_16/horario_24/horario_40/horario_48]: ").strip() or 'horario_40'
                
                docente = Docente.objects.create(
                    nombres=nombres,
                    apellido_paterno=apellido_paterno,
                    apellido_materno=apellido_materno,
                    ci=ci,
                    categoria=categoria,
                    dedicacion=dedicacion,
                    email=user.email or '',
                    telefono=''
                )
                print(f"\n✅ Docente creado: {docente.nombre_completo}")
            else:
                print("⚠️  No se puede crear perfil de docente sin docente asociado")
                docente = None
    
    # 5. Crear el nuevo perfil (PRIMERO el perfil, LUEGO se vincula el docente)
    print("\n" + "=" * 60)
    print("📝 CREANDO NUEVO PERFIL DE USUARIO")
    print("=" * 60)
    
    try:
        # Crear perfil SIN docente primero
        perfil = PerfilUsuario.objects.create(
            user=user,
            rol=rol,
            carrera=carrera,
            telefono='',
            activo=True,
            debe_cambiar_password=False
        )
        print(f"\n✅ PERFIL CREADO EXITOSAMENTE")
        print(f"   Usuario: {user.username}")
        print(f"   Rol: {perfil.get_rol_display()}")
        print(f"   Carrera: {perfil.carrera.nombre if perfil.carrera else 'Ninguna'}")
        
    except Exception as e:
        print(f"\n❌ ERROR al crear perfil: {str(e)}")
        import traceback
        traceback.print_exc()
        return
    
    # 6. AHORA SÍ: Vincular el docente al perfil creado
    if docente:
        print("\n" + "=" * 60)
        print("🔗 VINCULANDO DOCENTE AL PERFIL")
        print("=" * 60)
        
        try:
            perfil.docente = docente
            perfil.save()
            print(f"\n✅ DOCENTE VINCULADO CORRECTAMENTE")
            print(f"   Docente: {docente.nombre_completo}")
            print(f"   CI: {docente.ci}")
        except Exception as e:
            print(f"\n❌ ERROR al vincular docente: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # 7. Verificación final
    print("\n" + "=" * 60)
    print("✅ VERIFICACIÓN FINAL")
    print("=" * 60)
    
    # Recargar usuario y perfil para verificar
    user.refresh_from_db()
    perfil.refresh_from_db()
    
    if hasattr(user, 'perfil'):
        print(f"\n✓ El usuario AHORA tiene perfil")
        print(f"  - Username: {user.username}")
        print(f"  - Rol: {perfil.get_rol_display()}")
        print(f"  - Carrera: {perfil.carrera.nombre if perfil.carrera else 'Ninguna'}")
        print(f"  - Docente: {perfil.docente.nombre_completo if perfil.docente else 'Ninguno'}")
        print(f"  - CI: {perfil.docente.ci if perfil.docente else 'N/A'}")
        print(f"\n🎉 ¡REPARACIÓN COMPLETADA!")
        print(f"El usuario '{username}' ya puede acceder al sistema normalmente.")
    else:
        print(f"\n❌ ERROR: El usuario sigue sin perfil después de la reparación")
    
    print("\n" + "=" * 60)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("\n❌ ERROR: Debes proporcionar el username del usuario")
        print("\nUso: python backend/recuperar_perfil.py <username>")
        print("Ejemplo: python backend/recuperar_perfil.py denytva\n")
        sys.exit(1)
    
    username = sys.argv[1]
    recuperar_perfil(username)
