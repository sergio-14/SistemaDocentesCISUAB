from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('poa_document', '0022_flujo_versiones_y_seguimiento')]

    operations = [
        migrations.RenameIndex(
            model_name='seguimientoactividadpoa',
            old_name='poa_seg_act_fecha_idx',
            new_name='poa_documen_activid_a53145_idx',
        ),
    ]
