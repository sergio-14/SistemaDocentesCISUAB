from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('poa_document', '0009_documentopoa_poa_doc_gestion_unidad_idx'),
    ]

    operations = [
        migrations.AlterField(
            model_name='documentopoa',
            name='unidad_solicitante',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='documentos_poa',
                to='fondos.carrera',
                verbose_name='Carrera solicitante',
            ),
        ),
    ]