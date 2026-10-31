import os

from pathlib import Path


# ============================================================================
# MESLUME | DIRETORIOS E CONFIGURACAO PRIVADA
# ============================================================================

BASE_DIR = Path(__file__).resolve().parent.parent

ENV_FILE = Path(
    os.environ.get(
        "MESLUME_ENV_FILE",
        r"C:\Meslume\Configuracao\backend.env",
    )
)

if not ENV_FILE.is_file():
    raise RuntimeError(
        f"Arquivo de configuracao privada nao encontrado: {ENV_FILE}"
    )

for linha in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():

    linha = linha.strip()

    if not linha or linha.startswith("#"):
        continue

    nome, separador, valor = linha.partition("=")

    if not separador or not nome.strip():
        raise RuntimeError(
            "Formato invalido no arquivo de configuracao privada."
        )

    os.environ[nome.strip()] = valor.strip()


def obter_variavel(nome):
    valor = os.environ.get(nome, "").strip()

    if not valor:
        raise RuntimeError(
            f"Variavel obrigatoria nao configurada: {nome}"
        )

    return valor


# ============================================================================
# MESLUME | SEGURANCA
# ============================================================================

SECRET_KEY = obter_variavel("MESLUME_SECRET_KEY")

DEBUG = os.environ.get(
    "MESLUME_DEBUG",
    "false",
).lower() == "true"

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
]

USE_HTTPS = os.environ.get(
    "MESLUME_USE_HTTPS",
    "false",
).lower() == "true"

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = USE_HTTPS
SESSION_COOKIE_SAMESITE = "Lax"

CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SECURE = USE_HTTPS
CSRF_COOKIE_SAMESITE = "Lax"


# ============================================================================
# MESLUME | APLICATIVOS INSTALADOS
# ============================================================================

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "financeiro",
]


# ============================================================================
# MESLUME | MIDDLEWARE
# ============================================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ============================================================================
# MESLUME | ROTAS E TEMPLATES
# ============================================================================

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# ============================================================================
# MESLUME | BANCO DE DADOS POSTGRESQL
# ============================================================================

DB_ENGINE = os.environ.get(
    "MESLUME_DB_ENGINE",
    "postgresql",
).strip().lower()

if DB_ENGINE not in (
    "postgresql",
    "django.db.backends.postgresql",
):
    raise RuntimeError(
        "O Meslume exige PostgreSQL como banco de dados."
    )

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": obter_variavel("MESLUME_DB_NAME"),
        "USER": obter_variavel("MESLUME_DB_USER"),
        "PASSWORD": obter_variavel("MESLUME_DB_PASSWORD"),
        "HOST": obter_variavel("MESLUME_DB_HOST"),
        "PORT": obter_variavel("MESLUME_DB_PORT"),
        "CONN_MAX_AGE": 0,
    }
}


# ============================================================================
# MESLUME | VALIDACAO DE SENHAS
# ============================================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]


# ============================================================================
# MESLUME | API REST
# ============================================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}


# ============================================================================
# MESLUME | INTERNACIONALIZACAO
# ============================================================================

LANGUAGE_CODE = "pt-br"

TIME_ZONE = "America/Sao_Paulo"

USE_I18N = True

USE_TZ = True


# ============================================================================
# MESLUME | ARQUIVOS ESTATICOS
# ============================================================================

STATIC_URL = "static/"

STATIC_ROOT = BASE_DIR / "staticfiles"


# ============================================================================
# MESLUME | CONFIGURACOES PADRAO
# ============================================================================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

DATA_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
SESSION_COOKIE_NAME = 'meslume_sessionid'
CSRF_COOKIE_NAME = 'meslume_csrftoken'
