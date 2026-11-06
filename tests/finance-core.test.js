'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../finance-core.js');

test('divide valores em centavos sem perder ou criar dinheiro', () => {
  const parts = F.split(10.01, 3);
  assert.deepEqual(parts, [3.34, 3.34, 3.33]);
  assert.equal(parts.reduce((sum, value) => sum + F.cents(value), 0), F.cents(10.01));
});

test('soma meses preservando o último dia válido', () => {
  assert.equal(F.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(F.addMonths('2024-01-31', 1), '2024-02-29');
});

test('saldo realizado usa a data real do pagamento', () => {
  const rows = [
    { tipo: 'entrada', valor: 500, status: 'pago', data: '2026-10-01', vencimento: '2026-10-01', data_pagamento: '2026-10-30' },
    { tipo: 'saida', valor: 200, status: 'pago', data: '2026-10-20', vencimento: '2026-10-20', data_pagamento: '2026-11-02', valor_pago: 190 },
    { tipo: 'saida', valor: 300, status: 'pendente', data: '2026-11-10', vencimento: '2026-11-10' }
  ];
  const result = F.summary(rows, '2026-11', { saldo_inicial: 1000, data_inicio: '2026-01-01', hoje: '2026-11-06' });
  assert.equal(result.previous, 150000);
  assert.equal(result.spent, 19000);
  assert.equal(result.closing, 131000);
  assert.equal(result.projected, 101000);
});

test('dívidas ignora lançamentos excluídos e encerrados', () => {
  const rows = [
    { valor: 15, status: 'pago' },
    { valor: 10, status: 'pendente', data: '2026-12-01' },
    { valor: 100, status: 'pendente', excluido_em: '2026-11-01' },
    { valor: 20, status: 'encerrado' }
  ];
  const result = F.debt(rows);
  assert.equal(result.total, 2500);
  assert.equal(result.paid, 1500);
  assert.equal(result.pending, 1000);
  assert.equal(result.pendingCount, 1);
});

test('CSV protege campos que começam com caracteres de fórmula', () => {
  const csv = F.csv([{ descricao: '=HYPERLINK("https://example.com")', tipo: 'saida', categoria: 'Outros', data: '2026-11-01', valor: 1, status: 'pendente' }]);
  assert.match(csv, /"'=HYPERLINK/);
});
