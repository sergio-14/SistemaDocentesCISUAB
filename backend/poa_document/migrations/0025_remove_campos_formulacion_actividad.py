from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('poa_document', '0024_compras_recepcion_entrega')]

    operations = [
        migrations.RemoveField(model_name='actividad', name='medio_verificacion'),
        migrations.RemoveField(model_name='actividad', name='formula_indicador'),
        migrations.RemoveField(model_name='actividad', name='tipo_indicador'),
        migrations.RemoveField(model_name='actividad', name='categoria_indicador'),
        migrations.RemoveField(model_name='actividad', name='periodicidad_meta'),
        migrations.RemoveField(model_name='actividad', name='metas_programadas'),
        migrations.RemoveField(model_name='actividad', name='requiere_presupuesto'),
    ]
