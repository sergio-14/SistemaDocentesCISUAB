from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('poa_document', '0029_partidas_presupuesto'),
    ]

    operations = [
        migrations.AddField(
            model_name='detalleordencomprapoa',
            name='origenes_compra',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
