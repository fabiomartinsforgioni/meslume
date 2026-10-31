import { Injectable, effect, inject, signal } from '@angular/core';
import { FinanceState } from './finance.models';
import { FinanceStore } from './finance.store';

type EstadoAcesso = 'iniciando' | 'login' | 'carregando' | 'pronto' | 'falha';
type EstadoGravacao = 'salvo' | 'pendente' | 'salvando' | 'erro';

interface Sessao { autenticado: boolean; usuario: string | null; }
interface Snapshot { dados: FinanceState | null; versao: number; }

@Injectable({ providedIn: 'root' })
export class FinanceSync {
  private readonly store = inject(FinanceStore);
  readonly acesso = signal<EstadoAcesso>('iniciando');
  readonly gravacao = signal<EstadoGravacao>('salvo');
  readonly mensagem = signal('');
  readonly usuario = signal('');
  private versao = 0;
  private ultimoSalvo = '';
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private emEnvio = false;
  private iniciou = false;

  constructor() {
    effect(() => {
      const snapshot = JSON.stringify(this.store.estado());
      if (this.acesso() === 'pronto' && snapshot !== this.ultimoSalvo) {
        this.agendar();
      }
    });

    window.addEventListener('beforeunload', evento => {
      if (this.acesso() === 'pronto' && this.gravacao() !== 'salvo') {
        evento.preventDefault();
      }
    });
  }

  private cookie(nome: string): string {
    const item = document.cookie.split('; ').find(c => c.startsWith(`${nome}=`));
    return item ? decodeURIComponent(item.slice(nome.length + 1)) : '';
  }

  private async requisitar<T>(rota: string, metodo: 'GET' | 'POST' | 'PUT' = 'GET', dados?: unknown): Promise<T> {
    const resposta = await fetch(`/api/v1/${rota}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: {
        ...(metodo !== 'GET' ? { 'Content-Type': 'application/json', 'X-CSRFToken': this.cookie('meslume_csrftoken') } : {})
      },
      ...(dados === undefined ? {} : { body: JSON.stringify(dados) })
    });
    const json = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const retorno = json as { erro?: string };
      throw new Error(retorno.erro || `Falha HTTP ${resposta.status} em ${rota}`);
    }
    return json as T;
  }

  async iniciar(): Promise<void> {
    if (this.iniciou) return;
    this.iniciou = true;
    await this.conferirSessao();
  }

  async conferirSessao(): Promise<void> {
    this.acesso.set('iniciando');
    this.mensagem.set('');
    try {
      const sessao = await this.requisitar<Sessao>('sessao/');
      if (!sessao.autenticado) {
        this.acesso.set('login');
        return;
      }
      this.usuario.set(sessao.usuario ?? '');
      await this.carregar();
    } catch {
      this.mensagem.set('Não foi possível acessar a API. Verifique o serviço MeslumeApi e o proxy do Caddy.');
      this.acesso.set('falha');
    }
  }

  async entrar(usuario: string, senha: string): Promise<void> {
    this.mensagem.set('');
    try {
      const sessao = await this.requisitar<Sessao>('sessao/entrar/', 'POST', { usuario, senha });
      this.usuario.set(sessao.usuario ?? '');
      await this.carregar();
    } catch (erro) {
      this.mensagem.set(erro instanceof Error ? erro.message : 'Não foi possível entrar.');
      this.acesso.set('login');
    }
  }

  private async carregar(): Promise<void> {
    this.acesso.set('carregando');
    try {
      const snapshot = await this.requisitar<Snapshot>('estado/');
      if (snapshot.dados) this.store.estado.set(snapshot.dados);
      else this.store.limparDemonstracao();
      this.versao = snapshot.versao;
      this.ultimoSalvo = JSON.stringify(this.store.estado());
      this.gravacao.set('salvo');
      this.mensagem.set('');
      this.acesso.set('pronto');
    } catch {
      this.mensagem.set('Falha ao carregar os dados financeiros. Nenhuma edição foi liberada.');
      this.acesso.set('falha');
    }
  }

  private agendar(): void {
    if (this.gravacao() === 'erro') return;
    this.gravacao.set('pendente');
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => { void this.salvar(); }, 350);
  }

  async salvar(): Promise<void> {
    if (this.acesso() !== 'pronto' || this.emEnvio || this.gravacao() === 'erro') return;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    const atual = JSON.stringify(this.store.estado());
    if (atual === this.ultimoSalvo) {
      this.gravacao.set('salvo');
      return;
    }
    this.emEnvio = true;
    this.gravacao.set('salvando');
    try {
      const retorno = await this.requisitar<{ versao: number }>('estado/', 'PUT', {
        versao: this.versao,
        dados: JSON.parse(atual) as FinanceState
      });
      this.versao = retorno.versao;
      this.ultimoSalvo = atual;
      this.emEnvio = false;
      this.mensagem.set('');
      if (JSON.stringify(this.store.estado()) === atual) this.gravacao.set('salvo');
      else this.agendar();
    } catch (erro) {
      this.emEnvio = false;
      this.gravacao.set('erro');
      this.mensagem.set(`${erro instanceof Error ? erro.message : 'Erro ao gravar.'} Não feche a página. Tente novamente.`);
    }
  }

  tentarNovamente(): void {
    if (this.acesso() !== 'pronto') {
      void this.conferirSessao();
      return;
    }
    if (this.gravacao() === 'erro') {
      this.gravacao.set('pendente');
      void this.salvar();
    }
  }

  async sair(): Promise<void> {
    if (this.gravacao() !== 'salvo') {
      this.mensagem.set('Aguarde a gravação ou corrija a falha antes de sair.');
      return;
    }
    try {
      await this.requisitar<unknown>('sessao/sair/', 'POST', {});
      this.acesso.set('login');
      this.store.limparDemonstracao();
      this.versao = 0;
      this.ultimoSalvo = '';
      this.usuario.set('');
    } catch {
      this.mensagem.set('Não foi possível encerrar a sessão.');
    }
  }
}
