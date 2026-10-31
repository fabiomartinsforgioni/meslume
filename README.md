<p align="center"><img src="Fontes/Frontend/public/brand/meslume-logo.png" alt="Meslume" width="480"></p>

# Meslume

Organização financeira pessoal, inicialmente local no Windows. O lançamento de gastos é manual e central ao produto. Fluxos de entradas, cartões e faturas, categorias, agendas e recorrências são operados na interface.

## Execução atual

- Angular: frontend estático após `npm run build`.
- Django + Waitress: API em `127.0.0.1:4318`.
- Caddy: HTTP local em `127.0.0.1:8080`, com encaminhamento de `/api/*` e `/admin/*` ao Waitress.
- PostgreSQL 17: banco de homologação definido no `backend.env`, fora do repositório.
- Autenticação: conta local Django, cookie de sessão e CSRF.
- Persistência inicial: o estado do usuário é validado e salvo em JSONB no PostgreSQL, com versão para impedir sobrescrita concorrente. É uma **ponte de homologação**, não o modelo de dados final normalizado por entidade.

Os cálculos financeiros desta fase ainda são executados no frontend, em **centavos inteiros**, e deverão ser consolidados e recalculados no backend antes de produção externa. Não usar este MVP para movimentações financeiras reais críticas sem validar backup, restauração e regras de negócio.

## Desenvolvimento local

**Backend** (PowerShell, pasta `Fontes\Backend`): ative `.venv`, instale `requirements.txt`, confira `C:\Meslume\Configuracao\backend.env` e execute `python manage.py check` e `python manage.py migrate`. Para criar conta local, execute `python manage.py createsuperuser` (não publicar credenciais). Para testes da validação: `python manage.py test financeiro.tests`.

**Frontend** (PowerShell, pasta `Fontes\Frontend`): `npm ci`, `npm test -- --watch=false` e `npm run build`. Os assets serão gerados em `dist/meslume/browser`.

**Caddy**, exemplo a adaptar ao arquivo de configuração já usado pelo serviço:

```caddyfile
127.0.0.1:8080 {
    handle /api/* {
        reverse_proxy 127.0.0.1:4318
    }
    handle /admin/* {
        reverse_proxy 127.0.0.1:4318
    }
    handle {
        root * C:/Projetos/Meslume/Fontes/Frontend/dist/meslume/browser
        try_files {path} /index.html
        file_server
    }
}
```

Não exponha esse endpoint na internet nem na rede local antes de configurar HTTPS, host, autorização e controles adicionais. O acesso atual é exclusivamente local.

## Armazenamento e operação

As informações financeiras **não ficam em localStorage**. O navegador apenas mantém a preferência visual do tema. Ao salvar algo, espere o status `Salvo no PostgreSQL` antes de fechar a aba. Se houver erro, não feche a página e use `Tentar salvar`. Alterações concorrentes entre duas abas são bloqueadas com HTTP 409, sem sobrescrever silenciosamente a outra aba.

Dados são segregados pelo usuário Django autenticado. Ainda não foi implementada a visão doméstica compartilhada entre usuários. Backups PostgreSQL e uma restauração em banco separado devem ser validados antes de usar dados reais. Dados privados, configurações, logs, pacotes e backups ficam em `C:\Meslume`, fora do Git.

## Segurança e contribuição

Leia `AGENTS.md`. Nunca versionar credenciais, banco, arquivos de configuração privados, dumps ou dados financeiros. O sistema não tem integrações bancárias nesta etapa. Código deve ser revisado e testado antes de qualquer alteração no ambiente.
