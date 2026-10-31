from django.conf import settings
from django.db import models


class EstadoFinanceiro(models.Model):
    proprietario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="estado_financeiro",
    )
    dados = models.JSONField(default=dict)
    versao = models.PositiveBigIntegerField(default=0)
    alterado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "estado financeiro"
        verbose_name_plural = "estados financeiros"
