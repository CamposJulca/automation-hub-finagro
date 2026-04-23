from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('facturacion', '0001_initial'),
    ]

    operations = [
        # Ampliar campos que pueden tener valores más largos
        migrations.AlterField(
            model_name='facturaelectronica',
            name='numero_factura',
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AlterField(
            model_name='facturaelectronica',
            name='proveedor_nit',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AlterField(
            model_name='facturaelectronica',
            name='archivo',
            field=models.CharField(blank=True, max_length=1000),
        ),
        # Agregar columna tipo_documento
        migrations.AddField(
            model_name='facturaelectronica',
            name='tipo_documento',
            field=models.CharField(
                choices=[
                    ('Invoice',    'Factura Electrónica'),
                    ('CreditNote', 'Nota Crédito'),
                    ('DebitNote',  'Nota Débito'),
                    ('SinXML',     'Sin XML'),
                    ('Unknown',    'Desconocido'),
                ],
                default='Invoice',
                max_length=30,
            ),
        ),
        # Reemplazar unique_together
        migrations.AlterUniqueTogether(
            name='facturaelectronica',
            unique_together={('tipo_documento', 'proveedor_nit', 'numero_factura')},
        ),
    ]
