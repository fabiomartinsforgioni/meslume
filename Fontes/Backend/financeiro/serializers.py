from datetime import date

from rest_framework import serializers


LIMITE_CENTAVOS = 10**12


class InteiroEstrito(serializers.IntegerField):
    def to_internal_value(self, data):
        if type(data) is not int:
            self.fail("invalid")
        return super().to_internal_value(data)


class DataISO(serializers.RegexField):
    def __init__(self, **kwargs):
        super().__init__(r"^\d{4}-\d{2}-\d{2}$", **kwargs)

    def to_internal_value(self, data):
        valor = super().to_internal_value(data)
        try:
            date.fromisoformat(valor)
        except (ValueError, TypeError):
            raise serializers.ValidationError("Data inválida.")
        return valor


class MesISO(serializers.RegexField):
    def __init__(self, **kwargs):
        super().__init__(r"^\d{4}-(0[1-9]|1[0-2])$", **kwargs)


class Id(serializers.CharField):
    def __init__(self, **kwargs):
        super().__init__(max_length=80, allow_blank=False, **kwargs)


class Categoria(serializers.Serializer):
    id = Id()
    nome = serializers.CharField(max_length=120)
    tipo = serializers.ChoiceField(choices=["despesa", "receita"])


class Etiqueta(serializers.Serializer):
    id = Id()
    nome = serializers.CharField(max_length=120)
    cor = serializers.RegexField(r"^#[0-9a-fA-F]{6}$")


class Cartao(serializers.Serializer):
    id = Id()
    nome = serializers.CharField(max_length=80)
    titular = serializers.CharField(max_length=100, allow_blank=True)
    fechamento = InteiroEstrito(min_value=1, max_value=31)
    vencimento = InteiroEstrito(min_value=1, max_value=31)
    limiteCentavos = InteiroEstrito(min_value=0, max_value=LIMITE_CENTAVOS, allow_null=True)


class Entrada(serializers.Serializer):
    id = Id()
    descricao = serializers.CharField(max_length=120)
    valorCentavos = InteiroEstrito(min_value=1, max_value=LIMITE_CENTAVOS)
    data = DataISO()
    mes = MesISO()
    origem = serializers.ChoiceField(choices=["principal", "outros"])
    recebida = serializers.BooleanField()


class Despesa(serializers.Serializer):
    id = Id()
    grupoId = Id()
    descricao = serializers.CharField(max_length=120)
    valorCentavos = InteiroEstrito(min_value=1, max_value=LIMITE_CENTAVOS)
    dataCompra = DataISO()
    mes = MesISO()
    categoriaId = Id()
    etiquetas = serializers.ListField(child=Id(), max_length=20)
    contexto = serializers.ChoiceField(choices=["pessoal", "agendas"])
    metodo = serializers.ChoiceField(choices=["pix", "debito", "dinheiro", "boleto", "credito"])
    cartaoId = Id(allow_null=True)
    paga = serializers.BooleanField()
    parcela = InteiroEstrito(min_value=1, max_value=60)
    parcelas = InteiroEstrito(min_value=1, max_value=60)
    recorrenciaId = Id(allow_null=True)


class ClienteAgenda(serializers.Serializer):
    id = Id()
    nome = serializers.CharField(max_length=120)
    diariaCentavos = InteiroEstrito(min_value=0, max_value=LIMITE_CENTAVOS)


class Agenda(serializers.Serializer):
    id = Id()
    clienteId = Id()
    data = DataISO()
    competencia = MesISO()
    valorCentavos = InteiroEstrito(min_value=1, max_value=LIMITE_CENTAVOS)
    status = serializers.ChoiceField(choices=["prevista", "realizada", "cancelada"])
    previsaoPagamento = DataISO(allow_null=True)


class RecebimentoAgenda(serializers.Serializer):
    id = Id()
    clienteId = Id()
    competencia = MesISO()
    data = DataISO()
    valorCentavos = InteiroEstrito(min_value=1, max_value=LIMITE_CENTAVOS)
    observacao = serializers.CharField(allow_blank=True, max_length=200)


class Recorrencia(serializers.Serializer):
    id = Id()
    descricao = serializers.CharField(max_length=120)
    valorCentavos = InteiroEstrito(min_value=1, max_value=LIMITE_CENTAVOS)
    dia = InteiroEstrito(min_value=1, max_value=31)
    categoriaId = Id()
    contexto = serializers.ChoiceField(choices=["pessoal", "agendas"])
    metodo = serializers.ChoiceField(choices=["pix", "debito", "dinheiro", "boleto", "credito"])
    cartaoId = Id(allow_null=True)
    ativa = serializers.BooleanField()


class Estado(serializers.Serializer):
    categorias = Categoria(many=True, max_length=100)
    etiquetas = Etiqueta(many=True, max_length=100)
    cartoes = Cartao(many=True, max_length=50)
    entradas = Entrada(many=True, max_length=10000)
    despesas = Despesa(many=True, max_length=15000)
    clientes = ClienteAgenda(many=True, max_length=1000)
    agendas = Agenda(many=True, max_length=10000)
    recebimentosAgenda = RecebimentoAgenda(many=True, max_length=10000)
    recorrencias = Recorrencia(many=True, max_length=1000)
    faturasPagas = serializers.ListField(child=serializers.CharField(max_length=90), max_length=12000)

    def validate(self, estado):
        for nome in ["categorias", "etiquetas", "cartoes", "entradas", "despesas", "clientes", "agendas", "recebimentosAgenda", "recorrencias"]:
            ids = [item["id"] for item in estado[nome]]
            if len(ids) != len(set(ids)):
                raise serializers.ValidationError({nome: "IDs duplicados."})

        categorias = {item["id"] for item in estado["categorias"] if item["tipo"] == "despesa"}
        cartoes = {item["id"] for item in estado["cartoes"]}
        clientes = {item["id"] for item in estado["clientes"]}
        etiquetas = {item["id"] for item in estado["etiquetas"]}
        recorrencias = {item["id"] for item in estado["recorrencias"]}

        for d in estado["despesas"]:
            if d["categoriaId"] not in categorias or any(e not in etiquetas for e in d["etiquetas"]):
                raise serializers.ValidationError({"despesas": "Categoria ou etiqueta inexistente."})
            if d["parcela"] > d["parcelas"]:
                raise serializers.ValidationError({"despesas": "Parcela inválida."})
            if (d["metodo"] == "credito") != (d["cartaoId"] is not None) or (d["cartaoId"] is not None and d["cartaoId"] not in cartoes):
                raise serializers.ValidationError({"despesas": "Vínculo de cartão inválido."})
            if d["recorrenciaId"] is not None and d["recorrenciaId"] not in recorrencias:
                # Registros antigos podem sobreviver à exclusão da regra recorrente.
                pass

        for r in estado["recorrencias"]:
            if r["categoriaId"] not in categorias:
                raise serializers.ValidationError({"recorrencias": "Categoria inexistente."})
            if (r["metodo"] == "credito") != (r["cartaoId"] is not None) or (r["cartaoId"] is not None and r["cartaoId"] not in cartoes):
                raise serializers.ValidationError({"recorrencias": "Cartão inválido."})

        for a in [*estado["agendas"], *estado["recebimentosAgenda"]]:
            if a["clienteId"] not in clientes:
                raise serializers.ValidationError({"agendas": "Cliente inexistente."})

        for e in estado["entradas"]:
            if e["mes"] != e["data"][:7]:
                raise serializers.ValidationError({"entradas": "Mês diferente da data."})

        if len(estado["faturasPagas"]) != len(set(estado["faturasPagas"])):
            raise serializers.ValidationError({"faturasPagas": "Duplicidade de fatura."})
        for chave in estado["faturasPagas"]:
            cartao, divisor, mes = chave.partition("|")
            if not divisor or cartao not in cartoes or len(mes) != 7 or mes[4:5] != "-" or mes[5:] not in [f"{i:02d}" for i in range(1, 13)]:
                raise serializers.ValidationError({"faturasPagas": "Referência inválida."})
        return estado
