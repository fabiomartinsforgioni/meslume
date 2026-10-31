import { FinanceStore } from './finance.store';

describe('Fluxos financeiros de interface', () => {
  let store: FinanceStore;

  beforeEach(() => {
    store = new FinanceStore();
    store.mes.set('2026-10');
    store.salvarCartao({ id: 'c1', nome: 'Cartão de teste', titular: '', fechamento: 5, vencimento: 12, limite: '' });
  });

  it('registra valor da parcela 8/12 sem dividir novamente', () => {
    const erro = store.salvarDespesa({
      id: '', descricao: 'Compra de teste', valor: '120,00', dataCompra: '2026-01-05',
      categoriaId: 'compras', etiquetas: [], contexto: 'pessoal', metodo: 'credito',
      cartaoId: 'c1', primeiraParcela: 8, parcelas: 12,
      mesPrimeira: '2026-10', tipoValor: 'parcela', paga: false
    });
    expect(erro).toBeNull();
    expect(store.estado().despesas.map(d => d.parcela)).toEqual([8, 9, 10, 11, 12]);
    expect(store.estado().despesas.every(d => d.valorCentavos === 12000)).toBe(true);
    expect(store.totalCartao('c1', '2026-10')).toBe(12000);
    expect(store.totalCartao('c1', '2026-11')).toBe(12000);
  });

  it('calcula sobra prevista como entradas menos gastos do mês', () => {
    store.salvarEntrada({ id: '', descricao: 'Entrada principal', valor: '1700,00',
      data: '2026-10-05', origem: 'principal', recebida: false });
    store.salvarDespesa({ id: '', descricao: 'Despesa fictícia', valor: '200,00',
      dataCompra: '2026-10-06', categoriaId: 'outros', etiquetas: [],
      contexto: 'pessoal', metodo: 'pix', cartaoId: '', parcelas: 1,
      primeiraParcela: 1, mesPrimeira: '2026-10', tipoValor: 'parcela', paga: false });
    expect(store.saldoPrevisto('2026-10')).toBe(150000);
    expect(store.saldoRealizado('2026-10')).toBe(0);
  });

  it('não cria nova despesa ao quitar uma fatura', () => {
    store.salvarDespesa({ id: '', descricao: 'Compra fictícia', valor: '50,00',
      dataCompra: '2026-10-01', categoriaId: 'outros', etiquetas: [],
      contexto: 'pessoal', metodo: 'credito', cartaoId: 'c1', parcelas: 1,
      primeiraParcela: 1, mesPrimeira: '2026-10', tipoValor: 'parcela', paga: false });
    const quantidade = store.estado().despesas.length;
    store.marcarFatura('c1', '2026-10');
    expect(store.estado().despesas.length).toBe(quantidade);
    expect(store.totalPago('2026-10')).toBe(5000);
  });
});
