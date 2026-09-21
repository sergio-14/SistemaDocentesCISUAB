"""
Script de Limpieza de Docente Duplicado - Victor
=================================================
Este script corrige el desastre de nombres y docentes duplicados.

Situación:
- Hay un docente antiguo "Sin Cuenta" con el nombre correcto
- Hay un docente nuevo creado por el script de recuperación con nombre desordenado
- El usuario 'victor' está vinculado al docente nuevo (incorrecto)

Solución:
1. Identificar ambos docentes
2. Transferir el PerfilUsuario al docente antiguo (correcto)
3. Corregir el nombre a "Victor Cruz Zelada"
4. Eliminar el docente duplicado (nuevo)
5. Verificar que todo esté correcto
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from fondos.models import PerfilUsuario, Docente

def limpiar_duplicado_victor():
    print("=" * 70)
    print("🧹 LIMPIEZA DE DOCENTE DUPLICADO - VICTOR CRUZ ZELADA")
    print("=" * 70)
    
    # 1. Buscar al usuario victor
    try:
        user = User.objects.get(username='victor')
        print(f"\n✅ Usuario encontrado: {user.username}")
    except User.DoesNotExist:
        print(f"\n❌ ERROR: No existe el usuario 'victor'")
        return False
    
    # 2. Verificar que tenga perfil
    if not hasattr(user, 'perfil') or not user.perfil:
        print(f"\n❌ ERROR: El usuario 'victor' no tiene perfil")
        return False
    
    perfil = user.perfil
    print(f"✅ Perfil encontrado: {perfil.get_rol_display()}")
    
    # 3. Obtener el docente actualmente vinculado (el duplicado)
    docente_nuevo = perfil.docente
    if not docente_nuevo:
        print(f"\n⚠️  El perfil no tiene docente vinculado")
        return False
    
    print(f"\n📋 DOCENTE ACTUALMENTE VINCULADO (DUPLICADO):")
    print(f"   ID: {docente_nuevo.id}")
    print(f"   Nombre: {docente_nuevo.nombre_completo}")
    print(f"   CI: {docente_nuevo.ci}")
    print(f"   Email: {docente_nuevo.email}")
    
    # 4. Buscar el docente antiguo (el correcto)
    # Buscamos por CI primero
    ci_actual = docente_nuevo.ci
    docentes_mismoci = Docente.objects.filter(ci=ci_actual)
    
    print(f"\n🔍 Buscando docentes con CI: {ci_actual}")
    print(f"   Encontrados: {docentes_mismoci.count()}")
    
    docente_antiguo = None
    
    if docentes_mismoci.count() > 1:
        # Hay duplicados con mismo CI
        for d in docentes_mismoci:
            print(f"\n   - ID {d.id}: {d.nombre_completo}")
            # El antiguo debería tener usuario=None o ser más antiguo
            if hasattr(d, 'usuario') and d.usuario is None:
                docente_antiguo = d
                print(f"   ↑ ESTE parece ser el antiguo (sin usuario)")
        
        if not docente_antiguo:
            # Si todos tienen usuario, tomar el de menor ID (más antiguo)
            docente_antiguo = docentes_mismoci.order_by('id').first()
            print(f"   ↑ Tomando el de menor ID como antiguo")
    
    else:
        # No hay duplicados por CI, buscar por nombre similar
        print(f"\n⚠️  No hay duplicados por CI, buscando por nombre...")
        docentes_similares = Docente.objects.filter(
            apellido_paterno__icontains='cruz'
        ) | Docente.objects.filter(
            nombres__icontains='victor'
        )
        
        for d in docentes_similares:
            print(f"   - ID {d.id}: {d.nombre_completo} (CI: {d.ci})")
            if d.id != docente_nuevo.id:
                docente_antiguo = d
                print(f"   ↑ ESTE parece ser el antiguo")
    
    if not docente_antiguo:
        print(f"\n❌ No se encontró el docente antiguo")
        print(f"   ¿Desea crear uno nuevo con el nombre correcto? (s/n)")
        respuesta = input("> ").lower()
        
        if respuesta == 's':
            print("\nCreando docente correcto...")
            docente_antiguo = Docente.objects.create(
                nombres='Victor',
                apellido_paterno='Cruz',
                apellido_materno='Zelada',
                ci=ci_actual,
                categoria=docente_nuevo.categoria,
                dedicacion=docente_nuevo.dedicacion,
                email=user.email or '',
                telefono=''
            )
            print(f"✅ Docente creado: {docente_antiguo.nombre_completo}")
        else:
            print("❌ Operación cancelada")
            return False
    
    # 5. Mostrar ambos docentes para confirmación
    print("\n" + "=" * 70)
    print("📊 RESUMEN DE DOCENTES")
    print("=" * 70)
    print(f"\n🔴 DOCENTE DUPLICADO (A ELIMINAR):")
    print(f"   ID: {docente_nuevo.id}")
    print(f"   Nombre: {docente_nuevo.nombre_completo}")
    print(f"   CI: {docente_nuevo.ci}")
    
    print(f"\n🟢 DOCENTE ANTIGUO (A CONSERVAR):")
    print(f"   ID: {docente_antiguo.id}")
    print(f"   Nombre: {docente_antiguo.nombre_completo}")
    print(f"   CI: {docente_antiguo.ci}")
    
    print("\n⚠️  ¿Está seguro de que quiere proceder con la limpieza? (s/n)")
    confirmacion = input("> ").lower()
    
    if confirmacion != 's':
        print("❌ Operación cancelada")
        return False
    
    # 6. CORRECCIÓN DEL NOMBRE
    print("\n📝 Corrigiendo nombre del docente antiguo...")
    docente_antiguo.nombres = 'Victor'
    docente_antiguo.apellido_paterno = 'Cruz'
    docente_antiguo.apellido_materno = 'Zelada'
    docente_antiguo.save()
    print(f"✅ Nombre corregido: {docente_antiguo.nombre_completo}")
    
    # 7. TRANSFERIR EL PERFFIL AL DOCENTE ANTIGUO
    print("\n🔗 Transfiriendo perfil al docente antiguo...")
    
    # Primero, quitar el vínculo del docente nuevo
    docente_nuevo.usuario = None
    docente_nuevo.save()
    print(f"   ✓ Docente nuevo desvinculado")
    
    # Ahora vincular el perfil al docente antiguo
    perfil.docente = docente_antiguo
    perfil.save()
    print(f"   ✓ Perfil vinculado al docente antiguo")
    
    # 8. ELIMINAR EL DOCENTE DUPLICADO
    print("\n🗑️  Eliminando docente duplicado...")
    docente_nuevo_id = docente_nuevo.id
    docente_nuevo.delete()
    print(f"   ✓ Docente ID {docente_nuevo_id} eliminado")
    
    # 9. VERIFICACIÓN FINAL
    print("\n" + "=" * 70)
    print("✅ VERIFICACIÓN FINAL")
    print("=" * 70)
    
    user.refresh_from_db()
    perfil.refresh_from_db()
    
    print(f"\n📊 ESTADO FINAL DEL USUARIO 'victor':")
    print(f"   Username: {user.username}")
    print(f"   Email: {user.email}")
    print(f"   Nombre: {user.first_name} {user.last_name}")
    print(f"   Rol: {perfil.get_rol_display()}")
    print(f"   Carrera: {perfil.carrera.nombre if perfil.carrera else 'Ninguna'}")
    print(f"   Docente ID: {perfil.docente.id}")
    print(f"   Docente Nombre: {perfil.docente.nombre_completo}")
    print(f"   Docente CI: {perfil.docente.ci}")
    
    # Verificar que no haya duplicados
    duplicados = Docente.objects.filter(ci=perfil.docente.ci).count()
    if duplicados > 1:
        print(f"\n⚠️  ADVERTENCIA: Todavía hay {duplicados} docentes con el mismo CI!")
    else:
        print(f"\n✅ No hay duplicados de CI")
    
    print(f"\n🎉 ¡LIMPIEZA COMPLETADA EXITOSAMENTE!")
    print(f"Ahora 'victor' tiene el docente correcto con nombre ordenado.")
    print("=" * 70)
    
    return True

if __name__ == '__main__':
    exito = limpiar_duplicado_victor()
    sys.exit(0 if exito else 1)
