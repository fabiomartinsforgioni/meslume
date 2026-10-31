from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="EstadoFinanceiro",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("dados", models.JSONField(default=dict)),
                ("versao", models.PositiveBigIntegerField(default=0)),
                ("alterado_em", models.DateTimeField(auto_now=True)),
                ("proprietario", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="estado_financeiro",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"verbose_name": "estado financeiro", "verbose_name_plural": "estados financeiros"},
        ),
    ]
