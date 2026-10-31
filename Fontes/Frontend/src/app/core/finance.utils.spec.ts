import { mesDaFatura, parseDinheiro, repartirCentavos } from './finance.utils';

describe('Regras monetárias - protótipo', () => {
  it('não perde centavos ao repartir o valor total', () => {
    expect(repartirCentavos(10000, 3)).toEqual([3333, 3333, 3334]);
  });

  it('interpreta valor digitado com vírgula como centavos inteiros', () => {
    expect(parseDinheiro('1.234,56')).toBe(123456);
    expect(parseDinheiro('35,90')).toBe(3590);
    expect(parseDinheiro('abc')).toBeNull();
  });

  it('determina o mês de fatura considerando o fechamento', () => {
    expect(mesDaFatura('2026-10-29', 5, 12)).toBe('2026-11');
  });
});
