"""
Script de Recuperación Automática de PerfilUsuario
===================================================
Este script recrea el perfil de un usuario de forma NO interactiva.
Recibe todos los datos por argumentos de línea de comandos.

Uso:
    python backend/recuperar_perfil_auto.py <username> <ci> <rol> [codigo_carrera]

Ejemplos:
    python backend/recuperar_perfil_auto.py victor 1234567 docente
    python backend/recuperar_perfil_auto.py victor 1234567 director IS
    python backend/recuperar_perfil_auto.py victor 1234567 jefe_estudios MAT
    python backend/recuperar_perfil_auto.py victor 1234567 iiisyp IS

Roles válidos: docente, director, jefe_estudios, iiisyp
"""
import os
import sys
import django

# Configurar Django ANTES de importar modelos
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from fondos.models import PerfilUsuario, Docente, Carrera

def recuperar_perfil_auto(username, ci, rol, codigo_carrera=None):
    print("=" * 70)
    print("🔧 RECUPERACIÓN AUTOMÁTICA DE PERFIL - UABJB")
    print("=" * 70)
    
    # Validar rol
    roles_validos = ['docente', 'director', 'jefe_estudios', 'iiisyp']
    if rol not in roles_validos:
        print(f"\n❌ ERROR: Rol '{rol}' no es válido")
        print(f"Roles válidos: {', '.join(roles_validos)}")
        return False
    
    # 1. Buscar al usuario
    try:
        user = User.objects.get(username=username)
        print(f"\n✅ Usuario encontrado: {user.username}")
        print(f"   Email: {user.email}")
        print(f"   Nombre: {user.first_name} {user.last_name}")
    except User.DoesNotExist:
        print(f"\n❌ ERROR: No existe el usuario '{username}'")
        return False
    
    # 2. Verificar si ya tiene perfil
    if hasattr(user, 'perfil') and user.perfil:
        print(f"\n⚠️  ADVERTENCIA: El usuario YA tiene un perfil")
        print(f"   Rol actual: {user.perfil.get_rol_display()}")
        print(f"   Carrera: {user.perfil.carrera.nombre if user.perfil.carrera else 'Ninguna'}")
        print(f"   🗑️  ELIMINANDO perfil anterior para continuar...")
        user.perfil.delete()
        print(f"   ✓ Perfil anterior eliminado")
    
    # 3. Buscar o crear Docente (si el rol es docente)
    docente = None
    if rol == 'docente':
        print(f"\n🔍 Buscando docente con CI: {ci}")
        docente = Docente.objects.filter(ci=ci).first()
        
        if docente:
            print(f"✅ Docente encontrado: {docente.nombre_completo}")
        else:
            print(f"⚠️  No existe docente con CI {ci}")
            print(f"📝 Creando nuevo docente con los datos del usuario...")
            
            # Obtener apellidos del nombre completo del usuario
            nombre_completo = f"{user.first_name} {user.last_name}".strip()
            partes = nombre_completo.split()
            
            if len(partes) >= 2:
                apellido_paterno = partes[0]
                apellido_materno = partes[-1] if len(partes) > 2 else ''
                nombres = ' '.join(partes[1:-1]) if len(partes) > 2 else partes[1]
            else:
                apellido_paterno = nombre_completo
                apellido_materno = ''
                nombres = ''
            
            docente = Docente.objects.create(
                nombres=nombres or user.first_name,
                apellido_paterno=apellido_paterno or user.last_name,
                apellido_materno=apellido_materno or '',
                ci=ci,
                categoria='asistente',
                dedicacion='horario_40',
                email=user.email or '',
                telefono=''
            )
            print(f"✅ Docente creado: {docente.nombre_completo}")
    
    # 4. Obtener Carrera (si el rol lo requiere)
    carrera = None
    if rol in ['director', 'jefe_estudios', 'iiisyp'] and codigo_carrera:
        print(f"\n🔍 Buscando carrera con código: {codigo_carrera}")
        carrera = Carrera.objects.filter(codigo=codigo_carrera).first()
        
        if carrera:
            print(f"✅ Carrera encontrada: {carrera.nombre}")
        else:
            print(f"⚠️  No existe carrera con código {codigo_carrera}")
            print(f"📝 Listando carreras disponibles:")
            carreras = list(Carrera.objects.all())
            for i, c in enumerate(carreras, 1):
                print(f"   {i}. {c.nombre} (Código: {c.codigo})")
            
            if len(carreras) > 0:
                carrera = carreras[0]
                print(f"⚠️  Usando primera carrera: {carrera.nombre}")
            else:
                print(f"⚠️  No hay carreras registradas, continuando sin carrera")
    
    # 5. Crear el nuevo perfil
    print(f"\n📝 Creando nuevo perfil para {user.username}...")
    
    try:
        perfil = PerfilUsuario.objects.create(
            user=user,
            rol=rol,
            carrera=carrera,
            telefono='',
            activo=True,
            debe_cambiar_password=False
        )
        print(f"✅ PERFIL CREADO: {perfil.get_rol_display()}")
    except Exception as e:
        print(f"❌ ERROR al crear perfil: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    # 6. Vincular Docente al perfil (si existe)
    if docente:
        print(f"\n🔗 Vinculando docente al perfil...")
        try:
            perfil.docente = docente
            perfil.save()
            print(f"✅ DOCENTE VINCULADO: {docente.nombre_completo}")
        except Exception as e:
            print(f"❌ ERROR al vincular docente: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    # 7. Verificación final
    print("\n" + "=" * 70)
    print("✅ VERIFICACIÓN FINAL")
    print("=" * 70)
    
    user.refresh_from_db()
    perfil.refresh_from_db()
    
    print(f"\n📊 DATOS DEL USUARIO REPARADO:")
    print(f"   Username: {user.username}")
    print(f"   Email: {user.email}")
    print(f"   Nombre: {user.first_name} {user.last_name}")
    print(f"   Rol: {perfil.get_rol_display()}")
    print(f"   Carrera: {perfil.carrera.nombre if perfil.carrera else 'Ninguna'}")
    print(f"   Docente: {perfil.docente.nombre_completo if perfil.docente else 'Ninguno'}")
    print(f"   CI: {perfil.docente.ci if perfil.docente else 'N/A'}")
    
    print(f"\n🎉 ¡REPARACIÓN COMPLETADA EXITOSAMENTE!")
    print(f"El usuario '{username}' ya puede acceder al sistema normalmente.")
    print("=" * 70)
    
    return True

if __name__ == '__main__':
    # Validar argumentos
    if len(sys.argv) < 4:
        print("\n❌ ERROR: Faltan argumentos")
        print("\nUso: python backend/recuperar_perfil_auto.py <username> <ci> <rol> [codigo_carrera]")
        print("\nEjemplos:")
        print("  python backend/recuperar_perfil_auto.py victor 1234567 docente")
        print("  python backend/recuperar_perfil_auto.py victor 1234567 director IS")
        print("  python backend/recuperar_perfil_auto.py victor 1234567 iiisyp IS")
        print("\nRoles válidos: docente, director, jefe_estudios, iiisyp")
        sys.exit(1)
    
    # Obtener argumentos
    username = sys.argv[1]
    ci = sys.argv[2]
    rol = sys.argv[3]
    codigo_carrera = sys.argv[4] if len(sys.argv) > 4 else None
    
    # Ejecutar recuperación
    exito = recuperar_perfil_auto(username, ci, rol, codigo_carrera)
    
    # Salir con código apropiado
    sys.exit(0 if exito else 1)
