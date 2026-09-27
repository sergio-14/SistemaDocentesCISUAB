"""El superusuario deja de tener el rol 'iiisyp': no tiene rol ni carrera.

Sus permisos salen de is_superuser; 'iiisyp' es el Instituto de una carrera,
de solo lectura.
"""
from django.db import migrations


def quitar_rol_a_superusuarios(apps, schema_editor):
    PerfilUsuario = apps.get_model('fondos', 'PerfilUsuario')
    PerfilUsuario.objects.filter(user__is_superuser=True).update(rol='', carrera=None)


def devolver_rol_iiisyp(apps, schema_editor):
    PerfilUsuario = apps.get_model('fondos', 'PerfilUsuario')
    PerfilUsuario.objects.filter(user__is_superuser=True, rol='').update(rol='iiisyp')


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0096_perfilusuario_rol_opcional'),
    ]

    operations = [
        migrations.RunPython(quitar_rol_a_superusuarios, devolver_rol_iiisyp),
    ]
