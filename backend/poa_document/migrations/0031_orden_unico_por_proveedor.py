from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('poa_document', '0030_detalleordencompra_origenes_compra'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='ordencomprapoa',
            name='poa_orden_numero_carrera_gestion',
        ),
        migrations.AddConstraint(
            model_name='ordencomprapoa',
            constraint=models.UniqueConstraint(
                fields=('carrera', 'gestion', 'proveedor', 'numero'),
                name='poa_orden_numero_proveedor_carrera_gestion',
            ),
        ),
    ]
