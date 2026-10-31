export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function dinheiro(centavos: number): string { return moeda.format(centavos / 100); }
export function parseDinheiro(entrada: string): number | null {
  const texto = entrada.trim().replace(/\s/g, '');
  // Aceita 1234,56, 1.234,56, 1234.56 e 1234; nunca avalia fórmulas.
  const normalizado = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(texto)
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto.replace(',', '.');
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(normalizado)) return null;
  const [reais, decimais = ''] = normalizado.split('.');
  const valor = Number(reais) * 100 + Number(decimais.padEnd(2, '0'));
  return Number.isSafeInteger(valor) && valor >= 0 ? valor : null;
}
export function formatoEntrada(centavos: number): string { return (centavos / 100).toFixed(2).replace('.', ','); }
export function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function mesAtual(): string { return hojeLocal().slice(0, 7); }
export function deslocarMes(mes: string, deslocamento: number): string {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + deslocamento, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function ultimoDia(mes: string): number {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(ano, m, 0).getDate();
}
export function dataDoMes(mes: string, dia: number): string {
  return `${mes}-${String(Math.min(Math.max(1, Math.floor(dia)), ultimoDia(mes))).padStart(2, '0')}`;
}
export function formatoData(data: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}
export function nomeMes(mes: string): string {
  if (!/^\d{4}-\d{2}$/.test(mes)) return mes;
  const [a, m] = mes.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(a, m - 1, 1));
}
export function mesCurto(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(a, m - 1, 1)).replace('.', '');
}
export function mesDaFatura(dataCompra: string, fechamento: number, vencimento: number): string {
  const mesCompra = dataCompra.slice(0, 7);
  const diaCompra = Number(dataCompra.slice(8, 10));
  const diaFechamento = Math.min(fechamento, ultimoDia(mesCompra));
  const mesFechamento = diaCompra <= diaFechamento ? mesCompra : deslocarMes(mesCompra, 1);
  // Fatura nunca vence antes da data de fechamento.
  return vencimento > fechamento ? mesFechamento : deslocarMes(mesFechamento, 1);
}
export function repartirCentavos(total: number, parcelas: number): number[] {
  const base = Math.floor(total / parcelas);
  const resto = total - base * parcelas;
  return Array.from({ length: parcelas }, (_, indice) => base + (indice >= parcelas - resto ? 1 : 0));
}
export function idNovo(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function soma<T>(itens: T[], valor: (item: T) => number): number {
  return itens.reduce((total, item) => total + valor(item), 0);
}
export function periodoValido(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [a, m, d] = data.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= ultimoDia(`${a}-${String(m).padStart(2, '0')}`);
}
