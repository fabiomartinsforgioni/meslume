import { FinanceStore } from './finance.store';

describe('Agendas presenciais por competencia de recebimento', () => {
  let store: FinanceStore;

  beforeEach(() => {
    store = new FinanceStore();
    store.mes.set('2026-10');
    store.salvarCliente({ id: 'fabritech', nome: 'Cliente demonstrativo', diaria: '40,00' });
  });

  it('agrupa tres dias de setembro na competencia de outubro, sem duplicar', () => {
    const formulario = { clienteId: 'fabritech', competencia: '2026-10',
      datas: ['2026-09-14', '2026-09-21', '2026-09-28'],
      valor: '40,00', status: 'realizada' as const, previsaoPagamento: '2026-10-20' };
    expect(store.salvarAgendasEmLote(formulario)).toEqual({ criadas: 3, ignoradas: 0, erro: null });
    expect(store.salvarAgendasEmLote(formulario)).toEqual({ criadas: 0, ignoradas: 3, erro: null });
    expect(store.agendasMes('2026-09')).toHaveSize(0);
    expect(store.agendasMes('2026-10')).toHaveSize(3);
    expect(store.saldoAgendas('2026-10').realizado).toBe(12000);
    expect(store.saldoAgendas('2026-10').recebido).toBe(0);
  });

  it('registra recebimento parcial real com data independente da competencia', () => {
    store.salvarAgendasEmLote({ clienteId: 'fabritech', competencia: '2026-10',
      datas: ['2026-09-14', '2026-09-21', '2026-09-28'],
      valor: '40,00', status: 'realizada', previsaoPagamento: '2026-10-20' });
    const primeiro = store.salvarRecebimentoAgenda({ id: '', clienteId: 'fabritech',
      competencia: '2026-10', data: '2026-11-02', valor: '70,00', observacao: 'parcial' });
    expect(primeiro).toBeNull();
    expect(store.saldoAgendas('2026-10').recebido).toBe(7000);
    expect(store.saldoAgendas('2026-10').aReceber).toBe(5000);
    expect(store.salvarRecebimentoAgenda({ id: '', clienteId: 'fabritech',
      competencia: '2026-10', data: '2026-11-03', valor: '50,01', observacao: '' })).toBeTruthy();
    expect(store.salvarRecebimentoAgenda({ id: '', clienteId: 'fabritech',
      competencia: '2026-10', data: '2026-11-03', valor: '50,00', observacao: '' })).toBeNull();
    expect(store.saldoAgendas('2026-10').aReceber).toBe(0);
    expect(store.saldoAgendas('2026-10').recebido).toBe(12000);
  });

  it('diferencia previsto, realizado e recebido', () => {
    store.salvarAgendasEmLote({ clienteId: 'fabritech', competencia: '2026-10',
      datas: ['2026-09-14', '2026-09-21'], valor: '40,00', status: 'realizada', previsaoPagamento: '' });
    store.salvarAgendasEmLote({ clienteId: 'fabritech', competencia: '2026-10',
      datas: ['2026-09-28'], valor: '40,00', status: 'prevista', previsaoPagamento: '' });
    const resumo = store.saldoAgendas('2026-10');
    expect(resumo.previsto).toBe(12000);
    expect(resumo.realizado).toBe(8000);
    expect(resumo.recebido).toBe(0);
    expect(resumo.aReceber).toBe(8000);
  });
});
