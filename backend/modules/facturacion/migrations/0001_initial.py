from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('execution', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='FacturaElectronica',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('proveedor_nit', models.CharField(max_length=50)),
                ('numero_factura', models.CharField(max_length=50)),
                ('codigo', models.CharField(blank=True, max_length=20)),
                ('valor_factura', models.DecimalField(blank=True, decimal_places=2, max_digits=18, null=True)),
                ('iva_facturado_proveedor', models.DecimalField(blank=True, decimal_places=2, max_digits=18, null=True)),
                ('fecha_emision', models.DateField(blank=True, null=True)),
                ('fecha_vencimiento', models.DateField(blank=True, null=True)),
                ('observaciones', models.TextField(blank=True)),
                ('archivo', models.CharField(blank=True, max_length=500)),
                ('procesado_en', models.DateTimeField(auto_now_add=True)),
                ('execution', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='facturas',
                    to='execution.execution',
                )),
            ],
            options={
                'ordering': ['-procesado_en'],
                'unique_together': {('proveedor_nit', 'numero_factura')},
            },
        ),
    ]
