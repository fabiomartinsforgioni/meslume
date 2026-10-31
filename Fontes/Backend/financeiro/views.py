import json

from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from rest_framework import serializers

from .models import EstadoFinanceiro
from .serializers import Estado


@ensure_csrf_cookie
@require_GET
def sessao(request):
    return JsonResponse({
        "autenticado": request.user.is_authenticated,
        "usuario": request.user.get_username() if request.user.is_authenticated else None,
    })


@csrf_protect
@require_POST
def entrar(request):
    try:
        dados = json.loads(request.body)
        usuario = dados.get("usuario", "")
        senha = dados.get("senha", "")
    except (ValueError, TypeError, AttributeError):
        return JsonResponse({"erro": "Requisição inválida."}, status=400)
    if not isinstance(usuario, str) or not isinstance(senha, str):
        return JsonResponse({"erro": "Credenciais inválidas."}, status=400)
    if len(usuario) > 150 or len(senha) > 1024:
        return JsonResponse({"erro": "Credenciais inválidas."}, status=400)
    autenticado = authenticate(request, username=usuario, password=senha)
    if autenticado is None or not autenticado.is_active:
        return JsonResponse({"erro": "Usuário ou senha inválidos."}, status=401)
    login(request, autenticado)
    return JsonResponse({"autenticado": True, "usuario": autenticado.get_username()})


@csrf_protect
@require_POST
def sair(request):
    logout(request)
    return JsonResponse({"autenticado": False})


@csrf_protect
@require_http_methods(["GET", "PUT"])
def estado(request):
    if not request.user.is_authenticated:
        return JsonResponse({"erro": "Faça login para continuar."}, status=401)

    if request.method == "GET":
        item = EstadoFinanceiro.objects.filter(proprietario=request.user).first()
        return JsonResponse({"versao": item.versao if item else 0, "dados": item.dados if item else None})

    try:
        payload = json.loads(request.body)
    except (ValueError, TypeError):
        return JsonResponse({"erro": "JSON inválido."}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({"erro": "Requisição inválida."}, status=400)
    versao = payload.get("versao")
    if type(versao) is not int or versao < 0:
        return JsonResponse({"erro": "Versão inválida."}, status=400)
    validador = Estado(data=payload.get("dados"))
    if not validador.is_valid():
        return JsonResponse({"erro": "Dados financeiros inválidos.", "detalhes": validador.errors}, status=400)

    with transaction.atomic():
        # A linha do proprietário serializa gravações e evita versões concorrentes duplicadas.
        type(request.user).objects.select_for_update().get(pk=request.user.pk)
        item, _ = EstadoFinanceiro.objects.get_or_create(proprietario=request.user)
        if item.versao != versao:
            return JsonResponse({"erro": "Dados alterados em outra aba. Não sobrescreva sem revisar."}, status=409)
        item.dados = validador.data
        item.versao += 1
        item.save(update_fields=["dados", "versao", "alterado_em"])
    return JsonResponse({"versao": item.versao})
