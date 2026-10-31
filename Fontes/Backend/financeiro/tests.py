from copy import deepcopy

from django.test import SimpleTestCase

from .serializers import Estado


class ValidacaoFinanceiraTests(SimpleTestCase):
    def estado_vazio(self):
        return {
            "categorias": [{"id": "outros", "nome": "Outros", "tipo": "despesa"}],
            "etiquetas": [], "cartoes": [], "entradas": [], "despesas": [],
            "clientes": [], "agendas": [], "recebimentosAgenda": [],
            "recorrencias": [], "faturasPagas": [],
        }

    def despesa(self):
        return {
            "id": "d1", "grupoId": "g1", "descricao": "Mercado", "valorCentavos": 15000,
            "dataCompra": "2026-10-30", "mes": "2026-10", "categoriaId": "outros",
            "etiquetas": [], "contexto": "pessoal", "metodo": "pix",
            "cartaoId": None, "paga": False, "parcela": 1, "parcelas": 1,
            "recorrenciaId": None,
        }

    def test_aceita_lancamento_manual_em_centavos(self):
        dados = self.estado_vazio()
        dados["despesas"] = [self.despesa()]
        self.assertTrue(Estado(data=dados).is_valid())

    def test_rejeita_float_e_campo_de_categoria_estranha(self):
        dados = self.estado_vazio()
        gasto = self.despesa()
        gasto["valorCentavos"] = 150.5
        dados["despesas"] = [gasto]
        self.assertFalse(Estado(data=dados).is_valid())

        dados = self.estado_vazio()
        gasto = self.despesa()
        gasto["categoriaId"] = "categoria-inexistente"
        dados["despesas"] = [gasto]
        self.assertFalse(Estado(data=dados).is_valid())

    def test_rejeita_ids_duplicados(self):
        dados = self.estado_vazio()
        dados["despesas"] = [self.despesa(), deepcopy(self.despesa())]
        self.assertFalse(Estado(data=dados).is_valid())

    def test_rejeita_data_inexistente(self):
        dados = self.estado_vazio()
        gasto = self.despesa()
        gasto["dataCompra"] = "2026-02-31"
        dados["despesas"] = [gasto]
        self.assertFalse(Estado(data=dados).is_valid())
