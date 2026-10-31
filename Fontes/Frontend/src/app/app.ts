import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Agenda, Cartao, Categoria, ClienteAgenda, Despesa, Entrada, Etiqueta,
  FormAgenda, FormAgendasLote, FormCartao, FormCliente, FormDespesa, FormEntrada,
  FormRecebimentoAgenda, FormRecorrencia, RecebimentoAgenda, Recorrencia, TipoPagina
} from './core/finance.models';
import { FinanceStore } from './core/finance.store';
import { FinanceSync } from './core/finance.sync';
import {
  dataDoMes, dinheiro, deslocarMes, formatoData, formatoEntrada,
  hojeLocal, mesCurto, nomeMes, parseDinheiro, soma, mesDaFatura, ultimoDia
} from './core/finance.utils';

type Modal = 'despesa' | 'entrada' | 'cartao' | 'cliente' | 'agenda' | 'agendas-lote' | 'recebimento-agenda' | 'etiqueta' | 'categoria' | 'recorrencia' | null;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly store = inject(FinanceStore);
  readonly sync = inject(FinanceSync);
  usuarioLogin = '';
  senhaLogin = '';

  constructor() {
    void this.sync.iniciar();
  }

  entrar(): void {
    void this.sync.entrar(this.usuarioLogin, this.senhaLogin).finally(() => {
      this.senhaLogin = '';
    });
  }

  readonly pagina = signal<TipoPagina>('painel');
  readonly modal = signal<Modal>(null);
  readonly busca = signal('');
  readonly filtroCategoria = signal('');
  readonly cartaoSelecionado = signal('');
  readonly erro = signal('');
  readonly aviso = signal('');

  readonly paginas: { id: TipoPagina; nome: string; icone: string; grupo: string }[] = [
    { id: 'painel', nome: 'Visão geral', icone: '▦', grupo: 'Principal' },
    { id: 'lancamentos', nome: 'Gastos', icone: '▤', grupo: 'Principal' },
    { id: 'entradas', nome: 'Entradas', icone: '↗', grupo: 'Principal' },
    { id: 'cartoes', nome: 'Cartões e faturas', icone: '▣', grupo: 'Organização' },
    { id: 'agendas', nome: 'Agendas', icone: '▦', grupo: 'Organização' },
    { id: 'recorrencias', nome: 'Recorrências', icone: '↻', grupo: 'Organização' },
    { id: 'categorias', nome: 'Categorias', icone: '◫', grupo: 'Cadastros' },
    { id: 'etiquetas', nome: 'Etiquetas', icone: '◇', grupo: 'Cadastros' },
    { id: 'relatorios', nome: 'Relatórios', icone: '▥', grupo: 'Análise' },
    { id: 'configuracoes', nome: 'Configurações', icone: '⚙', grupo: 'Sistema' }
  ];

  formDespesa: FormDespesa = this.formDespesaInicial();
  formEntrada: FormEntrada = this.formEntradaInicial();
  formCartao: FormCartao = this.formCartaoInicial();
  formCliente: FormCliente = this.formClienteInicial();
  formAgenda: FormAgenda = this.formAgendaInicial();
  formLote: FormAgendasLote = this.formLoteInicial();
  mesPresenca = deslocarMes(this.store.mes(), -1);
  formRecebimento: FormRecebimentoAgenda = this.formRecebimentoInicial();
  formRecorrencia: FormRecorrencia = this.formRecorrenciaInicial();
  formEtiqueta = { id: '', nome: '', cor: '#17866e' };
  formCategoria: { id: string; nome: string; tipo: 'despesa' | 'receita' } = { id: '', nome: '', tipo: 'despesa' };

  readonly dinheiro = dinheiro;
  readonly dataDoMes = dataDoMes;
  readonly deslocarMes = deslocarMes;
  readonly formatoData = formatoData;
  readonly nomeMes = nomeMes;
  readonly mesCurto = mesCurto;

  tituloPagina(): string { return this.paginas.find(p => p.id === this.pagina())?.nome ?? 'Meslume'; }
  navegar(pagina: TipoPagina): void { this.pagina.set(pagina); this.busca.set(''); this.filtroCategoria.set(''); this.aviso.set(''); }
  moverMes(direcao: number): void { this.store.mes.set(deslocarMes(this.store.mes(), direcao)); }
  adicionarPorPagina(): void {
    if (this.pagina() === 'entradas') this.abrirEntrada();
    else if (this.pagina() === 'cartoes') this.abrirCartao();
    else if (this.pagina() === 'agendas') this.abrirLote();
    else if (this.pagina() === 'recorrencias') this.abrirRecorrencia();
    else if (this.pagina() === 'categorias') this.abrirCategoria();
    else if (this.pagina() === 'etiquetas') this.abrirEtiqueta();
    else this.abrirDespesa();
  }
  tituloAcao(): string {
    return ({
      entradas: 'Nova entrada', cartoes: 'Novo cartão', agendas: 'Selecionar dias',
      recorrencias: 'Nova recorrência', categorias: 'Nova categoria', etiquetas: 'Nova etiqueta'
    } as Partial<Record<TipoPagina, string>>)[this.pagina()] ?? 'Novo gasto';
  }

  private formDespesaInicial(): FormDespesa {
    return { id: '', descricao: '', valor: '', dataCompra: hojeLocal(), categoriaId: 'outros',
      etiquetas: [], contexto: 'pessoal', metodo: 'pix', cartaoId: '', parcelas: 1, primeiraParcela: 1, mesPrimeira: this.store.mes(),
      tipoValor: 'parcela', paga: false };
  }
  private formEntradaInicial(): FormEntrada {
    return { id: '', descricao: '', valor: '', data: hojeLocal(), origem: 'principal', recebida: false };
  }
  private formCartaoInicial(): FormCartao {
    return { id: '', nome: '', titular: '', fechamento: 5, vencimento: 12, limite: '' };
  }
  private formClienteInicial(): FormCliente { return { id: '', nome: '', diaria: '40,00' }; }
  private formAgendaInicial(): FormAgenda {
    return { id: '', clienteId: this.store.estado().clientes[0]?.id ?? '', data: hojeLocal(),
      competencia: this.store.mes(), valor: '40,00', status: 'realizada', previsaoPagamento: '' };
  }
  private formLoteInicial(): FormAgendasLote {
    const cliente = this.store.estado().clientes[0];
    return { clienteId: cliente?.id ?? '', competencia: this.store.mes(), datas: [],
      valor: cliente ? formatoEntrada(cliente.diariaCentavos) : '40,00',
      status: 'realizada', previsaoPagamento: '' };
  }
  private formRecebimentoInicial(): FormRecebimentoAgenda {
    const competencia = this.store.mes();
    const cliente = this.store.estado().clientes.find(c =>
      this.store.totalRealizadoAgenda(competencia, c.id) > this.store.totalRecebidoAgenda(competencia, c.id)
    ) ?? this.store.estado().clientes[0];
    const clienteId = cliente?.id ?? '';
    const restante = Math.max(0, this.store.totalRealizadoAgenda(competencia, clienteId) -
      this.store.totalRecebidoAgenda(competencia, clienteId));
    return { id: '', clienteId, competencia, data: hojeLocal(),
      valor: formatoEntrada(restante), observacao: '' };
  }
  abrirLote(): void {
    this.formLote = this.formLoteInicial();
    this.mesPresenca = deslocarMes(this.store.mes(), -1);
    this.abrir('agendas-lote');
  }
  alterarCompetenciaLote(competencia: string): void {
    this.formLote.competencia = competencia;
    this.mesPresenca = deslocarMes(competencia, -1);
    this.formLote.datas = [];
  }
  alterarMesPresenca(mes: string): void {
    this.mesPresenca = mes;
    this.formLote.datas = [];
  }
  diasPresenca(): Array<{ dia: number; data: string } | null> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(this.mesPresenca)) return [];
    const [ano, mes] = this.mesPresenca.split('-').map(Number);
    const inicio = new Date(ano, mes - 1, 1).getDay();
    const vazios = Array.from({ length: inicio }, () => null);
    const dias = Array.from({ length: ultimoDia(this.mesPresenca) }, (_, i) => ({
      dia: i + 1, data: dataDoMes(this.mesPresenca, i + 1)
    }));
    return [...vazios, ...dias];
  }
  diaSelecionado(data: string): boolean { return this.formLote.datas.includes(data); }
  alternarDia(data: string): void {
    this.formLote.datas = this.diaSelecionado(data)
      ? this.formLote.datas.filter(d => d !== data)
      : [...this.formLote.datas, data].sort();
  }
  clienteLoteAlterado(id: string): void {
    this.formLote.clienteId = id;
    const cliente = this.store.estado().clientes.find(c => c.id === id);
    if (cliente) this.formLote.valor = formatoEntrada(cliente.diariaCentavos);
  }
  totalLote(): number {
    const valor = parseDinheiro(this.formLote.valor);
    return (valor ?? 0) * this.formLote.datas.length;
  }
  abrirRecebimentoAgenda(item?: RecebimentoAgenda): void {
    this.formRecebimento = item ? {
      id: item.id, clienteId: item.clienteId, competencia: item.competencia,
      data: item.data, valor: formatoEntrada(item.valorCentavos), observacao: item.observacao
    } : this.formRecebimentoInicial();
    this.abrir('recebimento-agenda');
  }
  clienteRecebimentoAlterado(id: string): void {
    this.formRecebimento.clienteId = id;
    if (!this.formRecebimento.id) this.atualizarValorRecebimento();
  }
  competenciaRecebimentoAlterada(mes: string): void {
    this.formRecebimento.competencia = mes;
    if (!this.formRecebimento.id) this.atualizarValorRecebimento();
  }
  private atualizarValorRecebimento(): void {
    const { competencia, clienteId } = this.formRecebimento;
    this.formRecebimento.valor = formatoEntrada(Math.max(0,
      this.store.totalRealizadoAgenda(competencia, clienteId) -
      this.store.totalRecebidoAgenda(competencia, clienteId)));
  }
  recebimentosVisiveis(): RecebimentoAgenda[] {
    return [...this.store.recebimentosAgendaMes()].sort((a, b) => b.data.localeCompare(a.data));
  }
  excluirRecebimentoAgenda(item: RecebimentoAgenda): void {
    if (this.confirmar(`Excluir o recebimento de ${dinheiro(item.valorCentavos)}?`)) {
      this.store.excluirRecebimentoAgenda(item.id);
    }
  }
  private formRecorrenciaInicial(): FormRecorrencia {
    return { id: '', descricao: '', valor: '', dia: 5, categoriaId: 'outros',
      contexto: 'pessoal', metodo: 'pix', cartaoId: '', ativa: true };
  }
  abrirDespesa(contexto: 'pessoal' | 'agendas' = 'pessoal', item?: Despesa): void {
    this.formDespesa = item ? this.store.formularioDespesa(item) : { ...this.formDespesaInicial(), contexto };
    this.abrir('despesa');
  }
  sugerirMesParcela(): void {
    const cartao = this.store.estado().cartoes.find(c => c.id === this.formDespesa.cartaoId);
    if (this.formDespesa.metodo === 'credito' && cartao && this.formDespesa.primeiraParcela === 1) {
      this.formDespesa.mesPrimeira = mesDaFatura(
        this.formDespesa.dataCompra, cartao.fechamento, cartao.vencimento
      );
    }
  }
  atualizarNumeroParcelas(): void {
    if (this.formDespesa.primeiraParcela > this.formDespesa.parcelas) {
      this.formDespesa.primeiraParcela = this.formDespesa.parcelas;
    }
  }
  idCartaoValido(): boolean {
    return this.store.estado().cartoes.some(c => c.id === this.formDespesa.cartaoId);
  }
  abrirEntrada(item?: Entrada): void {
    this.formEntrada = item ? { id: item.id, descricao: item.descricao, valor: formatoEntrada(item.valorCentavos),
      data: item.data, origem: item.origem, recebida: item.recebida } : this.formEntradaInicial();
    this.abrir('entrada');
  }
  abrirCartao(item?: Cartao): void {
    this.formCartao = item ? { id: item.id, nome: item.nome, titular: item.titular,
      fechamento: item.fechamento, vencimento: item.vencimento,
      limite: item.limiteCentavos === null ? '' : formatoEntrada(item.limiteCentavos) } : this.formCartaoInicial();
    this.abrir('cartao');
  }
  abrirCliente(item?: ClienteAgenda): void {
    this.formCliente = item ? { id: item.id, nome: item.nome, diaria: formatoEntrada(item.diariaCentavos) } : this.formClienteInicial();
    this.abrir('cliente');
  }
  abrirAgenda(item?: Agenda): void {
    this.formAgenda = item ? { id: item.id, clienteId: item.clienteId, data: item.data,
      competencia: item.competencia, valor: formatoEntrada(item.valorCentavos), status: item.status,
      previsaoPagamento: item.previsaoPagamento ?? '' } : this.formAgendaInicial();
    this.abrir('agenda');
  }
  abrirEtiqueta(item?: Etiqueta): void {
    this.formEtiqueta = item ? { ...item } : { id: '', nome: '', cor: '#17866e' };
    this.abrir('etiqueta');
  }
  abrirCategoria(item?: Categoria): void {
    this.formCategoria = item ? { ...item } : { id: '', nome: '', tipo: 'despesa' };
    this.abrir('categoria');
  }
  abrirRecorrencia(item?: Recorrencia): void {
    this.formRecorrencia = item ? {
      id: item.id, descricao: item.descricao, valor: formatoEntrada(item.valorCentavos),
      dia: item.dia, categoriaId: item.categoriaId, contexto: item.contexto,
      metodo: item.metodo, cartaoId: item.cartaoId ?? '', ativa: item.ativa
    } : this.formRecorrenciaInicial();
    this.abrir('recorrencia');
  }
  private abrir(tipo: Modal): void { this.erro.set(''); this.modal.set(tipo); }
  fecharModal(): void { this.modal.set(null); this.erro.set(''); }
  @HostListener('document:keydown.escape') fecharAoEscapar(): void { if (this.modal()) this.fecharModal(); }
  clienteAlterado(id: string): void {
    const cliente = this.store.estado().clientes.find(c => c.id === id);
    if (cliente && !this.formAgenda.id) this.formAgenda.valor = formatoEntrada(cliente.diariaCentavos);
  }
  alternarEtiqueta(id: string): void {
    this.formDespesa.etiquetas = this.formDespesa.etiquetas.includes(id)
      ? this.formDespesa.etiquetas.filter(x => x !== id)
      : [...this.formDespesa.etiquetas, id];
  }
  etiquetaMarcada(id: string): boolean { return this.formDespesa.etiquetas.includes(id); }

  salvarModal(): void {
    if (this.modal() === 'agendas-lote') {
      const retorno = this.store.salvarAgendasEmLote(this.formLote);
      if (retorno.erro) { this.erro.set(retorno.erro); return; }
      this.fecharModal();
      this.aviso.set(`${retorno.criadas} dia(s) presencial(is) registrado(s), ${retorno.ignoradas} duplicado(s) ignorado(s). Confira o status de gravação no cabeçalho.`);
      return;
    }
    let erro: string | null = null;
    switch (this.modal()) {
      case 'despesa': erro = this.store.salvarDespesa(this.formDespesa); break;
      case 'entrada': erro = this.store.salvarEntrada(this.formEntrada); break;
      case 'cartao': erro = this.store.salvarCartao(this.formCartao); break;
      case 'cliente': erro = this.store.salvarCliente(this.formCliente); break;
      case 'agenda': erro = this.store.salvarAgenda(this.formAgenda); break;
      case 'recebimento-agenda': erro = this.store.salvarRecebimentoAgenda(this.formRecebimento); break;
      case 'etiqueta': erro = this.store.salvarEtiqueta(this.formEtiqueta.nome, this.formEtiqueta.cor, this.formEtiqueta.id); break;
      case 'categoria': erro = this.store.salvarCategoria(this.formCategoria.nome, this.formCategoria.tipo, this.formCategoria.id); break;
      case 'recorrencia': erro = this.store.salvarRecorrencia(this.formRecorrencia); break;
    }
    if (erro) { this.erro.set(erro); return; }
    this.fecharModal();
    this.aviso.set('Alteração registrada. Aguarde o status Salvo no PostgreSQL.');
  }
  confirmar(mensagem: string): boolean { return window.confirm(mensagem); }
  excluirDespesa(item: Despesa): void {
    const m = item.parcelas > 1
      ? `Excluir as parcelas cadastradas deste grupo (${item.descricao})?`
      : `Excluir o gasto "${item.descricao}"?`;
    if (this.confirmar(m)) this.store.excluirGrupo(item.grupoId);
  }
  excluirEntrada(item: Entrada): void {
    if (this.confirmar(`Excluir a entrada "${item.descricao}"?`)) this.store.excluirEntrada(item.id);
  }
  excluirCartao(item: Cartao): void {
    if (!this.confirmar(`Excluir o cartão "${item.nome}"?`)) return;
    const erro = this.store.excluirCartao(item.id);
    if (erro) this.aviso.set(erro);
  }
  excluirCliente(item: ClienteAgenda): void {
    if (!this.confirmar(`Excluir o cliente "${item.nome}"?`)) return;
    const erro = this.store.excluirCliente(item.id);
    if (erro) this.aviso.set(erro);
  }
  excluirAgenda(item: Agenda): void {
    if (!this.confirmar('Excluir este dia presencial?')) return;
    const erro = this.store.excluirAgenda(item.id);
    if (erro) this.aviso.set(erro);
  }
  excluirEtiqueta(item: Etiqueta): void {
    if (this.confirmar('Excluir esta etiqueta dos cadastros e gastos vinculados?')) this.store.excluirEtiqueta(item.id);
  }
  excluirCategoria(item: Categoria): void {
    if (!this.confirmar(`Excluir a categoria "${item.nome}"?`)) return;
    const erro = this.store.excluirCategoria(item.id);
    if (erro) this.aviso.set(erro);
  }
  excluirRecorrencia(item: Recorrencia): void {
    if (this.confirmar('Excluir a regra recorrente? Os gastos já gerados serão preservados.')) this.store.excluirRecorrencia(item.id);
  }
  gerarRecorrencias(): void {
    const { criadas, ignoradas } = this.store.gerarRecorrencias();
    this.aviso.set(`${criadas} lançamento(s) gerado(s); ${ignoradas} já existia(m). Nenhum gasto foi marcado como pago.`);
  }
  demonstracao(): void {
    if (!this.confirmar('Substituir os dados temporários atuais por uma demonstração totalmente fictícia?')) return;
    this.store.carregarDemonstracao();
    this.cartaoSelecionado.set('');
    this.aviso.set('Demonstração fictícia carregada. Ela será gravada no PostgreSQL.');
  }
  limpar(): void {
    if (!this.confirmar('Limpar TODOS os registros temporários do protótipo?')) return;
    this.store.limparDemonstracao();
    this.cartaoSelecionado.set('');
    this.aviso.set('Registros apagados. A exclusão será gravada no PostgreSQL.');
  }

  despesasVisiveis(contexto: 'pessoal' | 'agendas' = 'pessoal'): Despesa[] {
    const busca = this.busca().toLocaleLowerCase('pt-BR').trim();
    const cat = this.filtroCategoria();
    return this.store.despesasMes(this.store.mes(), contexto)
      .filter(d => (!busca || d.descricao.toLocaleLowerCase('pt-BR').includes(busca)) && (!cat || d.categoriaId === cat))
      .sort((a, b) => b.dataCompra.localeCompare(a.dataCompra) || b.parcela - a.parcela);
  }
  entradasVisiveis(): Entrada[] {
    const busca = this.busca().toLocaleLowerCase('pt-BR').trim();
    return this.store.entradasMes().filter(e => !busca || e.descricao.toLocaleLowerCase('pt-BR').includes(busca))
      .sort((a, b) => b.data.localeCompare(a.data));
  }
  agendasVisiveis(): Agenda[] { return [...this.store.agendasMes()].sort((a, b) => a.data.localeCompare(b.data)); }
  resumoDiasAgendas(): { previstas: number; realizadas: number } {
    const agendas = this.store.agendasMes();
    return { previstas: agendas.filter(a => a.status === 'prevista').length,
      realizadas: agendas.filter(a => a.status === 'realizada').length };
  }
  cartaoAtual(): Cartao | null {
    const cartoes = this.store.estado().cartoes;
    return cartoes.find(c => c.id === this.cartaoSelecionado()) ?? cartoes[0] ?? null;
  }
  parcelasCartao(cartaoId: string): Despesa[] {
    return this.store.despesasMes().filter(d => d.cartaoId === cartaoId)
      .sort((a, b) => a.descricao.localeCompare(b.descricao));
  }
  contagemParcelas(cartaoId: string): number {
    return this.parcelasCartao(cartaoId).filter(d => d.parcelas > 1).length;
  }
  detalhesParcelamento(item: Despesa): string {
    return item.parcelas > 1 ? `${item.parcela}/${item.parcelas}` : 'À vista';
  }
  percentual(valor: number, total: number): number {
    return total > 0 ? Math.max(0, Math.min(100, (valor / total) * 100)) : 0;
  }
  nomeCategoria(id: string): string { return this.store.obterCategoria(id); }
  nomeCartao(id: string | null): string { return id ? this.store.obterCartao(id) : 'Sem cartão'; }
  maiorValorSerie(): number {
    return Math.max(1, ...this.store.serieMeses().flatMap(x => [x.entradas, x.gastos]));
  }
  totalDespesasTodas(): number { return this.store.totalDespesas() + this.store.totalDespesas(this.store.mes(), 'agendas'); }
  corGrafico(indice: number): string {
    return ['#138a76', '#576fd0', '#e6a546', '#9c6dd3', '#e17077', '#27a2ae', '#a4a853'][indice % 7];
  }
  graficoRosca(): string {
    const dados = this.store.resumoCategorias();
    const total = soma(dados, d => d.total);
    if (!total) return 'conic-gradient(var(--border) 0 100%)';
    let inicio = 0;
    const fatias = dados.map((d, i) => {
      const fim = inicio + 100 * d.total / total;
      const parte = `${this.corGrafico(i)} ${inicio}% ${fim}%`;
      inicio = fim;
      return parte;
    });
    return `conic-gradient(${fatias.join(',')})`;
  }
  agendaResumo() { return this.store.saldoAgendas(); }
  categoriasDespesa(): Categoria[] { return this.store.estado().categorias.filter(c => c.tipo === 'despesa'); }
  valorValido(texto: string): boolean { return parseDinheiro(texto) !== null; }
  doMesAtual(): string { return dataDoMes(this.store.mes(), 1); }
}
