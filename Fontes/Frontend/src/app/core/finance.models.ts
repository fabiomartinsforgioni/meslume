export type Contexto = 'pessoal' | 'agendas';
export type Metodo = 'pix' | 'debito' | 'dinheiro' | 'boleto' | 'credito';
export type StatusAgenda = 'prevista' | 'realizada' | 'cancelada';
export type TipoPagina = 'painel' | 'lancamentos' | 'entradas' | 'cartoes' | 'agendas' | 'recorrencias' | 'categorias' | 'etiquetas' | 'relatorios' | 'configuracoes';

export interface Categoria { id: string; nome: string; tipo: 'despesa' | 'receita'; }
export interface Etiqueta { id: string; nome: string; cor: string; }
export interface Cartao { id: string; nome: string; titular: string; fechamento: number; vencimento: number; limiteCentavos: number | null; }
export interface Entrada { id: string; descricao: string; valorCentavos: number; data: string; mes: string; origem: 'principal' | 'outros'; recebida: boolean; }
export interface Despesa {
  id: string;
  grupoId: string;
  descricao: string;
  valorCentavos: number;
  dataCompra: string;
  mes: string;
  categoriaId: string;
  etiquetas: string[];
  contexto: Contexto;
  metodo: Metodo;
  cartaoId: string | null;
  paga: boolean;
  parcela: number;
  parcelas: number;
  recorrenciaId: string | null;
}
export interface ClienteAgenda { id: string; nome: string; diariaCentavos: number; }
export interface Agenda {
  id: string; clienteId: string; data: string; competencia: string; valorCentavos: number;
  status: StatusAgenda; previsaoPagamento: string | null;
}
export interface RecebimentoAgenda {
  id: string; clienteId: string; competencia: string; data: string;
  valorCentavos: number; observacao: string;
}
export interface FormAgendasLote {
  clienteId: string; competencia: string; datas: string[];
  valor: string; status: StatusAgenda; previsaoPagamento: string;
}
export interface FormRecebimentoAgenda {
  id: string; clienteId: string; competencia: string; data: string;
  valor: string; observacao: string;
}
export interface Recorrencia {
  id: string; descricao: string; valorCentavos: number; dia: number; categoriaId: string;
  contexto: Contexto; metodo: Metodo; cartaoId: string | null; ativa: boolean;
}
export interface FinanceState {
  categorias: Categoria[]; etiquetas: Etiqueta[]; cartoes: Cartao[];
  entradas: Entrada[]; despesas: Despesa[]; clientes: ClienteAgenda[];
  agendas: Agenda[]; recebimentosAgenda: RecebimentoAgenda[];
  recorrencias: Recorrencia[]; faturasPagas: string[];
}

export interface FormDespesa {
  id: string; descricao: string; valor: string; dataCompra: string;
  categoriaId: string; etiquetas: string[]; contexto: Contexto;
  metodo: Metodo; cartaoId: string; parcelas: number; primeiraParcela: number;
  mesPrimeira: string; tipoValor: 'parcela' | 'total'; paga: boolean;
}
export interface FormEntrada {
  id: string; descricao: string; valor: string; data: string;
  origem: 'principal' | 'outros'; recebida: boolean;
}
export interface FormCartao {
  id: string; nome: string; titular: string; fechamento: number; vencimento: number; limite: string;
}
export interface FormCliente { id: string; nome: string; diaria: string; }
export interface FormAgenda {
  id: string; clienteId: string; data: string; competencia: string;
  valor: string; status: StatusAgenda; previsaoPagamento: string;
}
export interface FormRecorrencia {
  id: string; descricao: string; valor: string; dia: number; categoriaId: string;
  contexto: Contexto; metodo: Metodo; cartaoId: string; ativa: boolean;
}
