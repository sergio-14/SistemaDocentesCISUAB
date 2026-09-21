from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_docente_user(apps, schema_editor):
    Docente = apps.get_model('fondos', 'Docente')
    PerfilUsuario = apps.get_model('fondos', 'PerfilUsuario')

    perfiles = PerfilUsuario.objects.exclude(user_id=None).exclude(docente_id=None)
    for perfil in perfiles.iterator():
        Docente.objects.filter(pk=perfil.docente_id, user_id=None).update(user_id=perfil.user_id)


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0060_add_datos_laborales'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='docente',
            name='user',
            field=models.OneToOneField(blank=True, help_text='Usuario del sistema vinculado al docente', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='docente_relacion', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='docente',
            name='apellido_materno',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AlterField(
            model_name='docente',
            name='apellido_paterno',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AlterField(
            model_name='docente',
            name='nombres',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.RunPython(backfill_docente_user, migrations.RunPython.noop),
    ]
