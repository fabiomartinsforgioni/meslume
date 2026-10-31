from django.urls import path

from . import views

urlpatterns = [
    path("sessao/", views.sessao, name="meslume-sessao"),
    path("sessao/entrar/", views.entrar, name="meslume-entrar"),
    path("sessao/sair/", views.sair, name="meslume-sair"),
    path("estado/", views.estado, name="meslume-estado"),
]
