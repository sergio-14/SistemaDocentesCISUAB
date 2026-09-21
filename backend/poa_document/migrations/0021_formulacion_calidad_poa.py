# Generated manually for Phase 3: quality controls for POA formulation.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('poa_document', '0020_programapoa'),
    ]

    operations = [
        migrations.AddField(
            model_name='documentopoa', name='observacion_elaboracion',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='actividad', name='medio_verificacion',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='actividad', name='formula_indicador',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='actividad', name='tipo_indicador',
            field=models.CharField(choices=[('cuantitativo', 'Cuantitativo'), ('cualitativo', 'Cualitativo')], default='cuantitativo', max_length=20),
        ),
        migrations.AddField(
            model_name='actividad', name='categoria_indicador',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='actividad', name='periodicidad_meta',
            field=models.CharField(choices=[('mensual', 'Mensual'), ('trimestral', 'Trimestral'), ('semestral', 'Semestral'), ('anual', 'Anual')], default='anual', max_length=20),
        ),
        migrations.AddField(
            model_name='actividad', name='metas_programadas',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='actividad', name='requiere_presupuesto',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='actividad', name='riesgo_previsto',
            field=models.TextField(blank=True, default=''),
        ),
    ]
