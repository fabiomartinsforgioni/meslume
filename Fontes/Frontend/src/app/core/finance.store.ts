import { Injectable, signal } from '@angular/core';
import {
  Agenda, Cartao, Categoria, ClienteAgenda, Despesa, Entrada, Etiqueta,
  FinanceState, FormAgenda, FormAgendasLote, FormCartao, FormCliente, FormDespesa,
  FormEntrada, FormRecebimentoAgenda, FormRecorrencia, Metodo, Recorrencia, RecebimentoAgenda
} from './finance.models';
import {
  dataDoMes, deslocarMes, formatoEntrada, hojeLocal, idNovo, mesAtual,
  mesDaFatura, parseDinheiro, periodoValido, repartirCentavos, soma
} from './finance.utils';

const CATEGORIAS: Categoria[] = [
  { id: 'alimentacao', nome: 'Alimentação', tipo: 'despesa' },
  { id: 'moradia', nome: 'Moradia', tipo: 'despesa' },
  { id: 'transporte', nome: 'Transporte', tipo: 'despesa' },
  { id: 'saude', nome: 'Saúde', tipo: 'despesa' },
  { id: 'assinaturas', nome: 'Assinaturas', tipo: 'despesa' },
  { id: 'compras', nome: 'Compras', tipo: 'despesa' },
  { id: 'educacao', nome: 'Educação', tipo: 'despesa' },
  { id: 'lazer', nome: 'Lazer', tipo: 'despesa' },
  { id: 'outros', nome: 'Outros', tipo: 'despesa' },
  { id: 'salario', nome: 'Salário', tipo: 'receita' },
  { id: 'extra', nome: 'Outras entradas', tipo: 'receita' }
];

function novoEstado(): FinanceState {
  return {
    categorias: CATEGORIAS.map(c => ({ ...c })), etiquetas: [], cartoes: [],
    entradas: [], despesas: [], clientes: [], agendas: [], recebimentosAgenda: [],
    recorrencias: [], faturasPagas: []
  };
}

@Injectable({ providedIn: 'root' })
export class FinanceStore {
  readonly estado = signal<FinanceState>(novoEstado());
  readonly mes = signal(mesAtual());
  readonly tema = signal<'claro' | 'escuro'>(this.lerTema());

  private lerTema(): 'claro' | 'escuro' {
    try { return localStorage.getItem('meslume-tema') === 'escuro' ? 'escuro' : 'claro'; }
    catch { return 'claro'; }
  }

  alternarTema(): void {
    const proximo = this.tema() === 'claro' ? 'escuro' : 'claro';
    this.tema.set(proximo);
    try { localStorage.setItem('meslume-tema', proximo); } catch { /* Preferência opcional. */ }
  }

  private atualizar(alteracao: (atual: FinanceState) => FinanceState): void {
    this.estado.update(alteracao);
  }

  obterCategoria(id: string): string {
    return this.estado().categorias.find(c => c.id === id)?.nome ?? 'Sem categoria';
  }
  obterCartao(id: string | null): string {
    return this.estado().cartoes.find(c => c.id === id)?.nome ?? 'Sem cartão';
  }
  obterCliente(id: string): string {
    return this.estado().clientes.find(c => c.id === id)?.nome ?? 'Sem cliente';
  }
  obterEtiqueta(id: string): Etiqueta | undefined {
    return this.estado().etiquetas.find(t => t.id === id);
  }

  despesasMes(mes = this.mes(), contexto: 'todos' | 'pessoal' | 'agendas' = 'pessoal'): Despesa[] {
    return this.estado().despesas.filter(d => d.mes === mes && (contexto === 'todos' || d.contexto === contexto));
  }
  entradasMes(mes = this.mes()): Entrada[] {
    return this.estado().entradas.filter(e => e.mes === mes);
  }
  agendasMes(mes = this.mes()): Agenda[] {
    return this.estado().agendas.filter(a => a.competencia === mes);
  }
  recebimentosAgendaMes(mes = this.mes()): RecebimentoAgenda[] {
    return this.estado().recebimentosAgenda.filter(r => r.competencia === mes);
  }
  totalRecebidoAgenda(mes = this.mes(), clienteId?: string): number {
    return soma(this.recebimentosAgendaMes(mes).filter(r => !clienteId || r.clienteId === clienteId), r => r.valorCentavos);
  }
  totalRealizadoAgenda(mes = this.mes(), clienteId?: string): number {
    return soma(this.agendasMes(mes).filter(a => a.status === 'realizada' && (!clienteId || a.clienteId === clienteId)), a => a.valorCentavos);
  }
  totalEntrada(mes = this.mes(), somenteRecebida = false): number {
    return soma(this.entradasMes(mes).filter(e => !somenteRecebida || e.recebida), e => e.valorCentavos);
  }
  totalDespesas(mes = this.mes(), contexto: 'pessoal' | 'agendas' = 'pessoal'): number {
    return soma(this.despesasMes(mes, contexto), d => d.valorCentavos);
  }
  pago(d: Despesa): boolean {
    return d.metodo === 'credito' && d.cartaoId
      ? this.estado().faturasPagas.includes(`${d.cartaoId}|${d.mes}`)
      : d.paga;
  }
  totalPago(mes = this.mes()): number {
    return soma(this.despesasMes(mes).filter(d => this.pago(d)), d => d.valorCentavos);
  }
  saldoPrevisto(mes = this.mes()): number { return this.totalEntrada(mes) - this.totalDespesas(mes); }
  saldoRealizado(mes = this.mes()): number { return this.totalEntrada(mes, true) - this.totalPago(mes); }
  totalCartao(cartaoId: string, mes = this.mes()): number {
    return soma(this.despesasMes(mes).filter(d => d.cartaoId === cartaoId), d => d.valorCentavos);
  }
  faturaPaga(cartaoId: string, mes = this.mes()): boolean {
    return this.estado().faturasPagas.includes(`${cartaoId}|${mes}`);
  }
  marcarFatura(cartaoId: string, mes = this.mes()): void {
    const chave = `${cartaoId}|${mes}`;
    this.atualizar(s => ({
      ...s, faturasPagas: s.faturasPagas.includes(chave)
        ? s.faturasPagas.filter(k => k !== chave)
        : [...s.faturasPagas, chave]
    }));
  }
  saldoAgendas(mes = this.mes()): { previsto: number; realizado: number; recebido: number; aReceber: number; gastos: number; sobrando: number } {
    const agendas = this.agendasMes(mes).filter(a => a.status !== 'cancelada');
    const previsto = soma(agendas, a => a.valorCentavos);
    const realizado = soma(agendas.filter(a => a.status === 'realizada'), a => a.valorCentavos);
    const recebido = this.totalRecebidoAgenda(mes);
    const gastos = this.totalDespesas(mes, 'agendas');
    return { previsto, realizado, recebido, aReceber: realizado - recebido, gastos, sobrando: previsto - gastos };
  }
  resumoCategorias(mes = this.mes()): { nome: string; total: number }[] {
    const mapa = new Map<string, number>();
    for (const d of this.despesasMes(mes)) {
      const nome = this.obterCategoria(d.categoriaId);
      mapa.set(nome, (mapa.get(nome) ?? 0) + d.valorCentavos);
    }
    return Array.from(mapa, ([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }
  resumoPagamentos(mes = this.mes()): { nome: string; total: number }[] {
    const mapa = new Map<string, number>();
    for (const d of this.despesasMes(mes)) {
      const nome = d.metodo === 'credito' ? this.obterCartao(d.cartaoId) : this.rotuloMetodo(d.metodo);
      mapa.set(nome, (mapa.get(nome) ?? 0) + d.valorCentavos);
    }
    return Array.from(mapa, ([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }
  rotuloMetodo(metodo: Metodo): string {
    return ({ pix: 'Pix', debito: 'Débito', dinheiro: 'Dinheiro', boleto: 'Boleto', credito: 'Crédito' })[metodo];
  }
  serieMeses(mes = this.mes()): { mes: string; entradas: number; gastos: number; sobrando: number }[] {
    return Array.from({ length: 6 }, (_, i) => {
      const periodo = deslocarMes(mes, i - 5);
      return { mes: periodo, entradas: this.totalEntrada(periodo), gastos: this.totalDespesas(periodo), sobrando: this.saldoPrevisto(periodo) };
    });
  }

  salvarEntrada(form: FormEntrada): string | null {
    const valor = parseDinheiro(form.valor);
    if (!form.descricao.trim() || valor === null || valor <= 0 || !periodoValido(form.data)) return 'Informe descrição, valor e data válidos.';
    const registro: Entrada = {
      id: form.id || idNovo(), descricao: form.descricao.trim(), valorCentavos: valor,
      data: form.data, mes: form.data.slice(0, 7), origem: form.origem, recebida: form.recebida
    };
    this.atualizar(s => ({ ...s, entradas: [...s.entradas.filter(e => e.id !== registro.id), registro] }));
    this.mes.set(registro.mes);
    return null;
  }
  excluirEntrada(id: string): void { this.atualizar(s => ({ ...s, entradas: s.entradas.filter(e => e.id !== id) })); }
  alternarEntrada(id: string): void {
    this.atualizar(s => ({ ...s, entradas: s.entradas.map(e => e.id === id ? { ...e, recebida: !e.recebida } : e) }));
  }

  salvarDespesa(form: FormDespesa, recorrenciaId: string | null = null): string | null {
    const valor = parseDinheiro(form.valor);
    const parcelas = Number(form.parcelas);
    const primeira = Number(form.primeiraParcela);
    if (!form.descricao.trim() || valor === null || valor <= 0 || !periodoValido(form.dataCompra)) {
      return 'Informe descrição, valor e data da compra válidos.';
    }
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 60 ||
        !Number.isInteger(primeira) || primeira < 1 || primeira > parcelas) {
      return 'Informe a parcela atual entre 1 e o total (máximo de 60 parcelas).';
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.mesPrimeira)) {
      return 'Informe o mês em que a parcela indicada será cobrada.';
    }
    if (!this.estado().categorias.some(c => c.id === form.categoriaId && c.tipo === 'despesa')) {
      return 'Selecione uma categoria de despesa válida.';
    }
    const cartao = this.estado().cartoes.find(c => c.id === form.cartaoId);
    if (form.metodo === 'credito' && !cartao) return 'Cadastre ou selecione o cartão.';
    const restantes = parcelas - primeira + 1;
    if (form.tipoValor !== 'parcela' && form.tipoValor !== 'total') return 'Informe o tipo do valor.';
    if (form.tipoValor === 'total' && valor < restantes) {
      return 'O valor total deve permitir ao menos R$ 0,01 por parcela restante.';
    }
    const anterior = this.estado().despesas.find(d => d.id === form.id);
    const grupoId = anterior?.grupoId ?? idNovo();
    const valores = form.tipoValor === 'parcela'
      ? Array.from({ length: restantes }, () => valor)
      : repartirCentavos(valor, restantes);
    const novas: Despesa[] = valores.map((valorCentavos, indice) => ({
      id: idNovo(), grupoId, descricao: form.descricao.trim(), valorCentavos,
      dataCompra: form.dataCompra, mes: deslocarMes(form.mesPrimeira, indice),
      categoriaId: form.categoriaId, etiquetas: [...form.etiquetas],
      contexto: form.contexto, metodo: form.metodo,
      cartaoId: form.metodo === 'credito' ? cartao!.id : null,
      paga: form.metodo === 'credito' ? false : (indice === 0 && form.paga),
      parcela: primeira + indice, parcelas, recorrenciaId: recorrenciaId ?? anterior?.recorrenciaId ?? null
    }));
    const removidas = this.estado().despesas.filter(d => d.grupoId === grupoId);
    // Uma fatura anteriormente marcada como paga precisa ser revalidada após alteração do valor.
    const faturasAfetadas = new Set(
      [...removidas, ...novas].filter(d => d.cartaoId).map(d => `${d.cartaoId}|${d.mes}`)
    );
    this.atualizar(s => ({
      ...s,
      despesas: [...s.despesas.filter(d => d.grupoId !== grupoId), ...novas],
      faturasPagas: s.faturasPagas.filter(chave => !faturasAfetadas.has(chave))
    }));
    this.mes.set(form.mesPrimeira);
    return null;
  }

  excluirGrupo(grupoId: string): void {
    this.atualizar(s => ({ ...s, despesas: s.despesas.filter(d => d.grupoId !== grupoId) }));
  }
  alternarDespesa(id: string): void {
    this.atualizar(s => ({ ...s, despesas: s.despesas.map(d =>
      d.id === id && d.metodo !== 'credito' ? { ...d, paga: !d.paga } : d
    ) }));
  }
  formularioDespesa(d: Despesa): FormDespesa {
    const grupo = this.estado().despesas.filter(x => x.grupoId === d.grupoId)
      .sort((a, b) => a.parcela - b.parcela);
    const primeira = grupo[0] ?? d;
    const valorUnico = grupo.every(x => x.valorCentavos === primeira.valorCentavos);
    return {
      id: d.id, descricao: d.descricao,
      valor: formatoEntrada(valorUnico ? primeira.valorCentavos : soma(grupo, x => x.valorCentavos)),
      tipoValor: valorUnico ? 'parcela' : 'total',
      dataCompra: d.dataCompra, mesPrimeira: primeira.mes,
      categoriaId: d.categoriaId, etiquetas: [...d.etiquetas],
      contexto: d.contexto, metodo: d.metodo, cartaoId: d.cartaoId ?? '',
      parcelas: d.parcelas, primeiraParcela: primeira.parcela, paga: primeira.paga
    };
  }

  salvarCartao(form: FormCartao): string | null {
    if (!form.nome.trim() || !Number.isInteger(+form.fechamento) || !Number.isInteger(+form.vencimento)
      || +form.fechamento < 1 || +form.fechamento > 31 || +form.vencimento < 1 || +form.vencimento > 31) {
      return 'Informe nome e dias de fechamento/vencimento entre 1 e 31.';
    }
    const limite = form.limite.trim() ? parseDinheiro(form.limite) : null;
    if (form.limite.trim() && limite === null) return 'Informe um limite válido ou deixe em branco.';
    const cartao: Cartao = {
      id: form.id || idNovo(), nome: form.nome.trim(), titular: form.titular.trim(),
      fechamento: +form.fechamento, vencimento: +form.vencimento, limiteCentavos: limite
    };
    this.atualizar(s => ({ ...s, cartoes: [...s.cartoes.filter(c => c.id !== cartao.id), cartao] }));
    return null;
  }
  excluirCartao(id: string): string | null {
    if (this.estado().despesas.some(d => d.cartaoId === id) || this.estado().recorrencias.some(r => r.cartaoId === id)) {
      return 'Este cartão possui gastos ou recorrências vinculados. Remova os vínculos antes.';
    }
    this.atualizar(s => ({ ...s, cartoes: s.cartoes.filter(c => c.id !== id), faturasPagas: s.faturasPagas.filter(k => !k.startsWith(`${id}|`)) }));
    return null;
  }

  salvarCliente(form: FormCliente): string | null {
    const diaria = parseDinheiro(form.diaria);
    if (!form.nome.trim() || diaria === null) return 'Informe nome e valor de diária válidos.';
    const cliente: ClienteAgenda = { id: form.id || idNovo(), nome: form.nome.trim(), diariaCentavos: diaria };
    this.atualizar(s => ({ ...s, clientes: [...s.clientes.filter(c => c.id !== cliente.id), cliente] }));
    return null;
  }
  excluirCliente(id: string): string | null {
    if (this.estado().agendas.some(a => a.clienteId === id) ||
        this.estado().recebimentosAgenda.some(r => r.clienteId === id)) return 'Cliente possui agendas ou recebimentos vinculados.';
    this.atualizar(s => ({ ...s, clientes: s.clientes.filter(c => c.id !== id) }));
    return null;
  }
  salvarAgenda(form: FormAgenda): string | null {
    const valor = parseDinheiro(form.valor);
    if (!this.estado().clientes.some(c => c.id === form.clienteId) ||
        valor === null || valor <= 0 || !periodoValido(form.data) ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.competencia)) {
      return 'Informe cliente, data presencial, competência e diária válidos.';
    }
    if (form.previsaoPagamento && !periodoValido(form.previsaoPagamento)) {
      return 'Data prevista de pagamento inválida.';
    }
    if (this.estado().agendas.some(a => a.id !== form.id && a.clienteId === form.clienteId && a.data === form.data)) {
      return 'Este dia presencial já foi cadastrado para esse cliente.';
    }
    const registro: Agenda = {
      id: form.id || idNovo(), clienteId: form.clienteId, data: form.data,
      competencia: form.competencia, valorCentavos: valor,
      status: form.status, previsaoPagamento: form.previsaoPagamento || null
    };
    const anterior = this.estado().agendas.find(a => a.id === registro.id);
    if (anterior) {
      const realizadoAnteriorApos = this.totalRealizadoAgenda(anterior.competencia, anterior.clienteId) -
        (anterior.status === 'realizada' ? anterior.valorCentavos : 0) +
        (registro.competencia === anterior.competencia && registro.clienteId === anterior.clienteId &&
          registro.status === 'realizada' ? registro.valorCentavos : 0);
      if (this.totalRecebidoAgenda(anterior.competencia, anterior.clienteId) > realizadoAnteriorApos) {
        return 'A mudança deixaria o período de origem com recebimentos maiores que as presenças realizadas.';
      }
    }
    const base = this.estado().agendas.filter(a => a.id !== registro.id);
    const realizadoApos = soma(
      [...base, registro].filter(a => a.clienteId === registro.clienteId &&
        a.competencia === registro.competencia && a.status === 'realizada'), a => a.valorCentavos
    );
    const recebido = this.totalRecebidoAgenda(registro.competencia, registro.clienteId);
    if (recebido > realizadoApos) {
      return 'A alteração deixaria os recebimentos maiores que o valor realizado. Corrija os recebimentos primeiro.';
    }
    this.atualizar(s => ({ ...s, agendas: [...base, registro] }));
    this.mes.set(registro.competencia);
    return null;
  }
  salvarAgendasEmLote(form: FormAgendasLote): { criadas: number; ignoradas: number; erro: string | null } {
    const valor = parseDinheiro(form.valor);
    if (!this.estado().clientes.some(c => c.id === form.clienteId) || valor === null || valor <= 0 ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.competencia) || !form.datas.length ||
        form.datas.some(d => !periodoValido(d))) {
      return { criadas: 0, ignoradas: 0, erro: 'Informe cliente, competência, dias e diária válidos.' };
    }
    if (form.previsaoPagamento && !periodoValido(form.previsaoPagamento)) {
      return { criadas: 0, ignoradas: 0, erro: 'Data prevista de pagamento inválida.' };
    }
    const existentes = new Set(this.estado().agendas
      .filter(a => a.clienteId === form.clienteId).map(a => a.data));
    const novos: Agenda[] = [];
    let ignoradas = 0;
    for (const data of new Set(form.datas).values()) {
      if (existentes.has(data)) { ignoradas++; continue; }
      novos.push({
        id: idNovo(), clienteId: form.clienteId, data, competencia: form.competencia,
        valorCentavos: valor, status: form.status,
        previsaoPagamento: form.previsaoPagamento || null
      });
      existentes.add(data);
    }
    this.atualizar(s => ({ ...s, agendas: [...s.agendas, ...novos] }));
    this.mes.set(form.competencia);
    return { criadas: novos.length, ignoradas, erro: null };
  }
  excluirAgenda(id: string): string | null {
    const agenda = this.estado().agendas.find(a => a.id === id);
    if (!agenda) return null;
    const valorApos = this.totalRealizadoAgenda(agenda.competencia, agenda.clienteId) -
      (agenda.status === 'realizada' ? agenda.valorCentavos : 0);
    if (this.totalRecebidoAgenda(agenda.competencia, agenda.clienteId) > valorApos) {
      return 'Existe recebimento vinculado a essa competência. Ajuste o recebimento antes de excluir o dia.';
    }
    this.atualizar(s => ({ ...s, agendas: s.agendas.filter(a => a.id !== id) }));
    return null;
  }
  salvarRecebimentoAgenda(form: FormRecebimentoAgenda): string | null {
    const valor = parseDinheiro(form.valor);
    if (!this.estado().clientes.some(c => c.id === form.clienteId) ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.competencia) ||
        !periodoValido(form.data) || valor === null || valor <= 0) {
      return 'Informe cliente, competência, data do recebimento e valor válidos.';
    }
    const outros = this.estado().recebimentosAgenda.filter(r => r.id !== form.id);
    if (outros.some(r => r.clienteId === form.clienteId && r.competencia === form.competencia &&
        r.data === form.data && r.valorCentavos === valor && r.observacao === form.observacao.trim().slice(0, 200))) {
      return 'Recebimento idêntico já registrado. Confira antes de salvar novamente.';
    }
    const jaRecebido = soma(outros.filter(r => r.clienteId === form.clienteId && r.competencia === form.competencia), r => r.valorCentavos);
    if (jaRecebido + valor > this.totalRealizadoAgenda(form.competencia, form.clienteId)) {
      return 'O total recebido não pode ultrapassar o valor das presenças realizadas nessa competência.';
    }
    const registro: RecebimentoAgenda = {
      id: form.id || idNovo(), clienteId: form.clienteId, competencia: form.competencia,
      data: form.data, valorCentavos: valor, observacao: form.observacao.trim().slice(0, 200)
    };
    this.atualizar(s => ({ ...s, recebimentosAgenda: [...outros, registro] }));
    this.mes.set(form.competencia);
    return null;
  }
  excluirRecebimentoAgenda(id: string): void {
    this.atualizar(s => ({ ...s, recebimentosAgenda: s.recebimentosAgenda.filter(r => r.id !== id) }));
  }

  salvarEtiqueta(nome: string, cor: string, id = ''): string | null {
    if (!nome.trim()) return 'Informe o nome da etiqueta.';
    if (!/^#[0-9a-fA-F]{6}$/.test(cor)) return 'Cor inválida.';
    const registro: Etiqueta = { id: id || idNovo(), nome: nome.trim(), cor };
    this.atualizar(s => ({ ...s, etiquetas: [...s.etiquetas.filter(t => t.id !== registro.id), registro] }));
    return null;
  }
  excluirEtiqueta(id: string): void {
    this.atualizar(s => ({
      ...s, etiquetas: s.etiquetas.filter(t => t.id !== id),
      despesas: s.despesas.map(d => ({ ...d, etiquetas: d.etiquetas.filter(t => t !== id) }))
    }));
  }
  salvarCategoria(nome: string, tipo: 'despesa' | 'receita', id = ''): string | null {
    if (!nome.trim()) return 'Informe o nome da categoria.';
    const registro: Categoria = { id: id || idNovo(), nome: nome.trim(), tipo };
    this.atualizar(s => ({ ...s, categorias: [...s.categorias.filter(c => c.id !== registro.id), registro] }));
    return null;
  }
  excluirCategoria(id: string): string | null {
    if (this.estado().despesas.some(d => d.categoriaId === id) || this.estado().recorrencias.some(r => r.categoriaId === id)) {
      return 'Categoria vinculada a gastos ou recorrências.';
    }
    this.atualizar(s => ({ ...s, categorias: s.categorias.filter(c => c.id !== id) }));
    return null;
  }

  salvarRecorrencia(form: FormRecorrencia): string | null {
    const valor = parseDinheiro(form.valor);
    const dia = +form.dia;
    if (!form.descricao.trim() || valor === null || valor <= 0 || !Number.isInteger(dia) || dia < 1 || dia > 31) {
      return 'Informe descrição, valor e dia entre 1 e 31.';
    }
    if (form.metodo === 'credito' && !this.estado().cartoes.some(c => c.id === form.cartaoId)) return 'Selecione um cartão.';
    const registro: Recorrencia = {
      id: form.id || idNovo(), descricao: form.descricao.trim(), valorCentavos: valor,
      dia, categoriaId: form.categoriaId, contexto: form.contexto, metodo: form.metodo,
      cartaoId: form.metodo === 'credito' ? form.cartaoId : null, ativa: form.ativa
    };
    this.atualizar(s => ({ ...s, recorrencias: [...s.recorrencias.filter(r => r.id !== registro.id), registro] }));
    return null;
  }
  excluirRecorrencia(id: string): void {
    // Despesas já geradas permanecem como registros independentes.
    this.atualizar(s => ({ ...s, recorrencias: s.recorrencias.filter(r => r.id !== id) }));
  }
  gerarRecorrencias(mes = this.mes()): { criadas: number; ignoradas: number } {
    let criadas = 0; let ignoradas = 0;
    for (const r of this.estado().recorrencias.filter(x => x.ativa)) {
      const data = dataDoMes(mes, r.dia);
      const existente = this.estado().despesas.some(d => d.recorrenciaId === r.id && d.dataCompra.slice(0, 7) === mes);
      if (existente) { ignoradas++; continue; }
      const erro = this.salvarDespesa({
        id: '', descricao: r.descricao, valor: formatoEntrada(r.valorCentavos),
        dataCompra: data, categoriaId: r.categoriaId, etiquetas: [],
        contexto: r.contexto, metodo: r.metodo, cartaoId: r.cartaoId ?? '', parcelas: 1, primeiraParcela: 1,
        mesPrimeira: r.metodo === 'credito' && r.cartaoId
          ? mesDaFatura(data, this.estado().cartoes.find(c => c.id === r.cartaoId)!.fechamento,
              this.estado().cartoes.find(c => c.id === r.cartaoId)!.vencimento) : mes,
        tipoValor: 'parcela', paga: false
      }, r.id);
      if (!erro) criadas++;
    }
    this.mes.set(mes);
    return { criadas, ignoradas };
  }

  limparDemonstracao(): void { this.estado.set(novoEstado()); }

  carregarDemonstracao(): void {
    this.estado.set(novoEstado());
    const mes = this.mes();
    const anterior = deslocarMes(mes, -1);
    const penultimo = deslocarMes(mes, -2);
    this.salvarCartao({ id: 'demo-cartao-a', nome: 'Cartão exemplo A', titular: 'Titular demonstrativo', fechamento: 5, vencimento: 12, limite: '3000,00' });
    this.salvarCartao({ id: 'demo-cartao-b', nome: 'Cartão exemplo B', titular: 'Titular demonstrativo', fechamento: 22, vencimento: 7, limite: '2000,00' });
    this.salvarCliente({ id: 'demo-cliente', nome: 'Cliente demonstrativo', diaria: '40,00' });
    this.salvarEtiqueta('Essencial', '#0f9f89');
    this.salvarEtiqueta('Planejado', '#7c6bdf');
    for (const [i, p] of [penultimo, anterior, mes].entries()) {
      this.salvarEntrada({ id: '', descricao: 'Entrada principal (exemplo)', valor: String(2600 + i * 100), data: dataDoMes(p, 5), origem: 'principal', recebida: i < 2 });
      this.salvarEntrada({ id: '', descricao: 'Outra entrada (exemplo)', valor: '150,00', data: dataDoMes(p, 13), origem: 'outros', recebida: i < 2 });
      this.salvarDespesa({ id: '', descricao: 'Mercado (exemplo)', valor: String(310 + 25 * i), dataCompra: dataDoMes(p, 9), categoriaId: 'alimentacao', etiquetas: [], contexto: 'pessoal', metodo: 'pix', cartaoId: '', parcelas: 1, primeiraParcela: 1, mesPrimeira: p, tipoValor: 'total', paga: i < 2 });
      this.salvarDespesa({ id: '', descricao: 'Transporte (exemplo)', valor: '89,90', dataCompra: dataDoMes(p, 17), categoriaId: 'transporte', etiquetas: [], contexto: 'pessoal', metodo: 'debito', cartaoId: '', parcelas: 1, primeiraParcela: 1, mesPrimeira: p, tipoValor: 'total', paga: i < 2 });
    }
    this.salvarDespesa({ id: '', descricao: 'Compra parcelada (exemplo)', valor: '450,00', dataCompra: dataDoMes(anterior, 2), categoriaId: 'compras', etiquetas: [], contexto: 'pessoal', metodo: 'credito', cartaoId: 'demo-cartao-a', parcelas: 3, primeiraParcela: 1, mesPrimeira: anterior, tipoValor: 'total', paga: false });
    this.salvarDespesa({ id: '', descricao: 'Assinatura (exemplo)', valor: '29,90', dataCompra: dataDoMes(mes, 10), categoriaId: 'assinaturas', etiquetas: [], contexto: 'pessoal', metodo: 'credito', cartaoId: 'demo-cartao-b', parcelas: 1, primeiraParcela: 1, mesPrimeira: mes, tipoValor: 'total', paga: false });
    this.salvarAgendasEmLote({ clienteId: 'demo-cliente', competencia: mes,
      datas: [dataDoMes(anterior, 8), dataDoMes(anterior, 15), dataDoMes(anterior, 22)],
      valor: '40,00', status: 'realizada', previsaoPagamento: dataDoMes(mes, 20) });
    this.salvarRecebimentoAgenda({ id: '', clienteId: 'demo-cliente', competencia: mes,
      data: dataDoMes(mes, 20), valor: '80,00', observacao: 'Recebimento parcial demonstrativo' });
    this.salvarDespesa({ id: '', descricao: 'Almoço em agenda (exemplo)', valor: '18,50', dataCompra: dataDoMes(mes, 8), categoriaId: 'alimentacao', etiquetas: [], contexto: 'agendas', metodo: 'pix', cartaoId: '', parcelas: 1, primeiraParcela: 1, mesPrimeira: mes, tipoValor: 'total', paga: true });
    this.mes.set(mes);
  }
}
