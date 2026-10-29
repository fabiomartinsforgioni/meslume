<p align="center">
  <img src="Fontes/Frontend/public/brand/meslume-logo.png" alt="Meslume" width="480">
</p>

# Meslume

Organização financeira pessoal para acompanhar entradas, despesas, cartões, parcelas, assinaturas e receitas de agendas presenciais, com visões separadas e consolidadas.

## Estado do projeto

Preparação inicial. Os arquivos de identidade visual e as regras de desenvolvimento estão disponíveis. A aplicação, o banco, os serviços Windows e o backup automático ainda serão implementados. O desenvolvimento será feito pelo responsável, com orientação do chat.

## Tecnologias e direção

- Backend Python, com Django e Django REST Framework como proposta inicial.
- Frontend Angular com TypeScript.
- Banco PostgreSQL.
- Interface responsiva para computador e celular.
- Execução local no Windows, com serviços de início automático e backup programado como requisitos.

## Estrutura

```text
Fontes/
  Backend/                 backend, testes e migrações, a implementar
  Frontend/
    public/
      brand/               logo e símbolo em PNG transparente
      favicon.ico          ícone com múltiplas resoluções
      favicon-32.png       alternativa PNG de 32 pixels
Infra/
  Windows/                 scripts de operação, a implementar
AGENTS.md                  orientações consolidadas
```

As pastas de backend e infraestrutura estão preparadas localmente e aparecerão no Git quando receberem arquivos úteis. O repositório não mantém arquivos artificiais apenas para representar diretórios vazios.

## Instalação e execução

Ainda não há aplicação executável nem comandos de instalação validados. Esta seção receberá os procedimentos reais de dependências, configuração, migrações, build, testes, serviços, backup e restauração à medida que forem implementados.

As instruções públicas usarão caminhos relativos e configuração por ambiente. Documentação privada, dados financeiros, pacotes, segredos, logs e backups ficam fora do repositório.

## Identidade visual

A proposta inicial usa azul escuro e verde, com um M e uma lua crescente. Os PNGs têm transparência. O favicon ICO contém tamanhos de 16, 32, 48, 64, 128 e 256 pixels.

Ao preparar o Angular para copiar a pasta `public` para a raiz publicada, a logo poderá ser referenciada como `/brand/meslume-logo.png` e o favicon como `/favicon.ico`. Para publicação em subdiretório, ajustar os caminhos à base da aplicação. A configuração e a integração ainda precisam ser feitas durante o desenvolvimento.

```html
<!-- Dentro de <head> no index.html, após configurar a publicação dos assets -->
<link rel="icon" type="image/x-icon" href="favicon.ico">
```

## Desenvolvimento e segurança

Leia o `AGENTS.md`. Mantenha fontes formatados, dependências justificadas, migrações versionadas e testes das regras financeiras e de autorização. Nunca envie planilhas reais, credenciais ou dumps ao GitHub. Exemplos devem usar somente dados fictícios.

Use branches curtas para mudanças e abra pull requests quando isso ajudar a revisão. A branch padrão é `main`. Contribuições devem explicar a mudança e como ela foi validada. Não inclua dados pessoais em issues.

Um canal privado de relato de vulnerabilidades ainda será definido antes da abertura do serviço ao público. Enquanto isso, não publique detalhes sensíveis em issues.

## Licença

A licença será escolhida explicitamente pelo responsável. A visibilidade pública deste repositório não concede, por si só, uma licença de uso ou redistribuição.
