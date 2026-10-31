import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { FinanceSync } from './core/finance.sync';

describe('Meslume - frontend', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{
        provide: FinanceSync,
        useValue: {
          acesso: signal('pronto'),
          gravacao: signal('salvo'),
          usuario: signal('Teste'),
          mensagem: signal(''),
          iniciar: async () => {},
          sair: async () => {},
          tentarNovamente: () => {}
        }
      }]
    }).compileComponents();
  });

  it('inicializa com a visão geral', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.componentInstance.pagina()).toBe('painel');
    expect(fixture.nativeElement.textContent).toContain('Visão geral');
  });

  it('abre o formulário de lançamento manual', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.abrirDespesa();
    fixture.detectChanges();
    expect(fixture.componentInstance.modal()).toBe('despesa');
    expect(fixture.nativeElement.textContent).toContain('Novo gasto');
  });
});
