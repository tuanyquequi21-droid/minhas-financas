/* Motor financeiro independente da interface. Todos os cálculos usam centavos. */
(function(root) {
'use strict';
const cents = value => Math.round(Number(value || 0) * 100);
const date = value => String(value || '').slice(0,10);
const due = t => date(t.vencimento || t.data);
const paid = t => ['pago','quitado'].includes(t.status);
const live = t => !t.excluido_em && t.status !== 'encerrado';
const amount = t => cents(t.valor);
const paidAmount = t => cents(t.valor_pago == null ? t.valor : t.valor_pago);
const paidDate = t => date(t.data_pagamento || t.data || t.vencimento);
const month = value => date(value).slice(0,7);
function addMonths(value, delta) {
 const [y,m,d=1]=value.split('-').map(Number);
 const target=new Date(y,m-1+delta,1); const last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
 return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;
}
function status(t,today) {return !live(t)?'encerrado':paid(t)?'pago':due(t)<today?'vencido':'pendente';}
function summary(rows, ref, cfg={}) {
 const start=ref+'-01', end=addMonths(start,1);
 const baseline=date(cfg.data_inicio || '1900-01-01');
 let previous=baseline<end?cents(cfg.saldo_inicial):0, received=0, spent=0, expectedIn=0, expectedOut=0, open=0, overdue=0, paidDue=0, scheduledDue=0, inOpen=0;
 let projectedOpen=0;
 for(const t of rows.filter(live)) {
  if(!Number.isFinite(amount(t))) continue;
  const sign=t.tipo==='entrada'?1:-1, d=due(t);
  if(paid(t)) {
   const pd=paidDate(t), v=paidAmount(t);
   if(pd>=baseline && pd<start) previous+=sign*v;
   else if(pd>=baseline && pd>=start && pd<end) {if(sign===1)received+=v;else spent+=v;}
  } else if(d<end) projectedOpen+=sign*amount(t);
  if(month(d)===ref) {
   if(sign===1) {expectedIn+=amount(t);if(!paid(t))inOpen+=amount(t);}
   else {expectedOut+=amount(t);scheduledDue+=amount(t);if(paid(t))paidDue+=paidAmount(t);else open+=amount(t);}
  }
  if(sign===-1 && !paid(t) && d<end && d<(cfg.hoje || new Date().toISOString().slice(0,10))) overdue+=amount(t);
 }
 const closing=previous+received-spent;
 return {previous,received,spent,closing,expectedIn,expectedOut,open,overdue,paidDue,scheduledDue,inOpen,projected:closing+projectedOpen};
}
function split(total,count) {
 const value=cents(total); if(!Number.isInteger(count)||count<1||count>72||value<count)throw Error('Valor ou parcelas inválidos. Cada parcela precisa ter pelo menos R$ 0,01.');
 return Array.from({length:count},(_,i)=>(Math.floor(value/count)+(i<value%count?1:0))/100);
}
function debt(rows) {
 const active=rows.filter(live), settled=active.filter(paid), pending=active.filter(t=>!paid(t)).sort((a,b)=>due(a).localeCompare(due(b)));
 return {total:active.reduce((s,t)=>s+amount(t),0),paid:settled.reduce((s,t)=>s+paidAmount(t),0),pending:pending.reduce((s,t)=>s+amount(t),0),paidCount:settled.length,pendingCount:pending.length,next:pending[0]||null};
}
function budget(rows,ref,category) {
 return rows.filter(t=>live(t)&&t.tipo==='saida'&&t.categoria===category&&month(due(t))===ref).reduce((s,t)=>s+amount(t),0);
}
function csv(rows) {
 const cell=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"';
 const out=[['Descrição','Tipo','Categoria','Vencimento','Parcela','Total parcelas','Valor previsto','Status','Pagamento','Valor pago','Grupo','Observações']];
 rows.forEach(t=>out.push([t.descricao,t.tipo,t.categoria,due(t),t.parcela_atual,t.total_parcelas,(Number(t.valor)||0).toFixed(2),t.status,paid(t)?paidDate(t):'',paid(t)?(paidAmount(t)/100).toFixed(2):'',t.grupo_id||'',t.observacoes||'']));
 return '\uFEFF'+out.map(r=>r.map(cell).join(';')).join('\r\n');
}
root.FinanceCore={cents,date,due,paid,live,amount,paidAmount,paidDate,month,addMonths,status,summary,split,debt,budget,csv};
if(typeof module!=='undefined')module.exports=root.FinanceCore;
})(typeof globalThis!=='undefined'?globalThis:window);
