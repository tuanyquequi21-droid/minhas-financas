// Insira a URL e a Key pública do seu projeto Supabase abaixo se ainda não estiverem configuradas globalmente:
const SUPABASE_URL = 'https://iecdvnsvnobpxqnusitw.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q';


'use strict';
const F=FinanceCore;
const demo=new URLSearchParams(location.search).get('demo')==='1';
let sb=null, usuarioLogado=null, usernameAtual='', transacoesCache=[], gruposCache=[], orcamentosCache=[];
let configCache={saldo_inicial:0,data_inicio:'1900-01-01'}, tipoSelecionado='entrada', meuGrafico=null, dataCalendarioAtual=new Date();
let loadVersion=0, mutating=false;
const $=id=>document.getElementById(id);
const moeda=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dinheiro=c=>moeda(c/100);
const setTexto=(id,text)=>{if($(id))$(id).textContent=text;};
const hojeISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dataBR=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const escaparHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeId=id=>/^[\w-]+$/.test(String(id))?String(id):'';
const statusFinanceiro=t=>F.status(t,hojeISO());
function labelStatus(t){const s=statusFinanceiro(t);return s==='encerrado'?'Encerrado':s==='pago'?(t.tipo==='entrada'?'Recebido ✓':'Pago ✓'):s==='vencido'?(t.tipo==='entrada'?'Recebimento atrasado':'Vencido'):'Pendente';}
function avisar(text,error=false){$('mensagemApp').textContent=text;$('mensagemApp').hidden=false;$('mensagemApp').classList.toggle('error',error);
 if(error){const active=[...document.querySelectorAll('.modal')].find(m=>m.style.display==='flex');if(active){let notice=active.querySelector('[data-modal-error]');if(!notice){notice=document.createElement('p');notice.dataset.modalError='true';notice.className='notice error';active.querySelector('.modal-content').prepend(notice);}notice.textContent=text;}}
}
function fecharModal(id){$(id).style.display='none';}
function abrirModal(id){$(id).querySelector('[data-modal-error]')?.remove?.();$(id).style.display='flex';const input=$(id).querySelector('input:not([type=hidden]),select');input?.focus();}
function toggleMenu(){$('sidebar').classList.toggle('open');$('sidebarOverlay').classList.toggle('active');}
function navegarPara(page){
 const pages={dashboard:'pageDashboard',novoLancamento:'pageNovoLancamento',contas:'pageContas',parcelas:'pageParcelas',historico:'pageHistorico',planejamento:'pagePlanejamento',configuracoes:'pageConfiguracoes'};
 document.querySelectorAll('.page-content').forEach(el=>el.classList.toggle('active',el.id===pages[page]));
 document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.getAttribute('onclick').includes("'"+page+"'")));
 $('sidebar').classList.remove('open');$('sidebarOverlay').classList.remove('active');
 if(page==='planejamento')renderizarPlanejamento();if(page==='configuracoes')renderizarConfiguracoes();
}
function alternarCamposParcela(){
 const value=$('recorrencia').value;$('boxParcelas').style.display=value==='parcelado'?'block':'none';
 setTexto('labelValor',value==='parcelado'?'Valor total da compra (R$)':value==='fixo'?'Valor mensal (R$)':'Valor (R$)');
 setTexto('ajudaRecorrencia',tipoSelecionado==='entrada'?'A entrada será registrada somente neste mês. Marque como Recebido quando o dinheiro entrar.':value==='parcelado'?'O valor total será dividido entre as parcelas. Cada mês terá um pagamento independente.':value==='fixo'?'A conta será prevista mensalmente, sem prazo final, até você encerrar a recorrência.':'Um único lançamento na data informada.');
}
function selecionarTipo(tipo){tipoSelecionado=tipo;$('btnEntrada').classList.toggle('active',tipo==='entrada');$('btnSaida').classList.toggle('active',tipo==='saida');$('recorrencia').disabled=tipo==='entrada';if(tipo==='entrada')$('recorrencia').value='unico';alternarCamposParcela();}
async function fazerLogin(){
 if(!sb)return avisar('Preencha seu config.js com a URL e a chave pública do Supabase. Consulte o guia incluído.',true);
 const username=$('loginUsername').value.trim().toLowerCase(),password=$('loginSenha').value;
 if(!username||!password)return;
 try{const {data,error}=await sb.auth.signInWithPassword({email:username.includes('@')?username:`${username}@sistema.local`,password});if(error)throw error;await iniciarSessao(data.user,username.split('@')[0]);}catch(e){avisar('Não foi possível entrar. Confira usuário, senha e conexão.',true);$('mensagemApp').hidden=false;$('loginSection').appendChild($('mensagemApp'));}
}
async function iniciarSessao(user,name){
 usuarioLogado=user;usernameAtual=name;$('loginSection').style.display='none';$('appSection').style.display='block';
 if($('mensagemApp').parentElement===$('loginSection'))document.querySelector('main').prepend($('mensagemApp'));
 setTexto('userDisplayTag',demo?'Demonstração':`@${name}`);
 const mes=hojeISO().slice(0,7);for(const id of ['filtroMesDashboard','contasMes','previsaoMes','orcamentoMes'])$(id).value=mes;
 $('data').value=hojeISO();$('demoBanner').hidden=!demo;await carregarTransacoes();
}
async function verificarSessao(){
 if(demo){seedDemo();await iniciarSessao({id:'demo-user'},'demo');return;}
 if(!sb)return;
 try{const {data,error}=await sb.auth.getUser();if(!error&&data.user)await iniciarSessao(data.user,data.user.email.split('@')[0]);}catch(e){avisar('Falha de conexão ao verificar sessão. Tente novamente.',true);}
}
async function deslogar(){if(!demo&&sb)await sb.auth.signOut();location.href='index.html';}
async function tabelaTodos(tabela){
 let rows=[],offset=0;
 for(;;){const {data,error}=await sb.from(tabela).select('*').eq('user_id',usuarioLogado.id).order('id').range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)break;offset+=500;}
 return rows;
}
async function carregarTransacoes(){
 if(!usuarioLogado)return;const version=++loadVersion;$('loadingApp').hidden=false;
 try{
  const refs=['filtroMesDashboard','contasMes','previsaoMes'].map(id=>$(id).value||hojeISO().slice(0,7)).sort();
  const ate=F.addMonths(refs.at(-1)+'-01',5);
  if(demo)materializarDemo(ate);else{
   const {error}=await sb.rpc('financeiro_materializar',{ate_mes:ate});if(error)throw error;
   const results=await Promise.all([tabelaTodos('transacoes'),tabelaTodos('financeiro_grupos'),tabelaTodos('financeiro_orcamentos'),sb.from('financeiro_config').select('*').eq('user_id',usuarioLogado.id).maybeSingle()]);
   if(version!==loadVersion)return;
   if(results[3].error)throw results[3].error;
   [transacoesCache,gruposCache,orcamentosCache]=results;configCache=results[3].data||{saldo_inicial:0,data_inicio:'1900-01-01'};
  }
  if(version!==loadVersion)return;popularFiltroMeses();prepararContasMes();renderizarDados();renderizarConfiguracoes();return true;
 }catch(e){if(version===loadVersion)avisar('Não foi possível atualizar: '+e.message+'. Se ainda não atualizou o banco, execute migracao_v3.sql antes de usar a V3.',true);return false;}
 finally{if(version===loadVersion)$('loadingApp').hidden=true;}
}
async function executar(action,args){
 if(demo)return executarDemo(action,args);
 const {data,error}=await sb.rpc(action,args);if(error)throw error;return data;
}
async function acao(fn,success){
 if(mutating)return;mutating=true;
 const buttons=[...document.querySelectorAll('button[type=submit]')];buttons.forEach(b=>b.disabled=true);
 try{await fn();const refreshed=await carregarTransacoes();if(refreshed!==false&&success)avisar(success);}catch(e){avisar(e.message,true);}finally{mutating=false;buttons.forEach(b=>b.disabled=false);}
}
function validarPagamento(dia,valor){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dia)||dia>hojeISO())throw Error('Informe uma data de pagamento até hoje.');
 if(dia<configCache.data_inicio)throw Error('O pagamento é anterior à data inicial do controle. Revise Ajustes e Dados.');
 if(!Number.isFinite(valor)||valor<=0)throw Error('Informe um valor maior que zero.');
}
async function salvarTransacao(e){
 e.preventDefault();const dados={descricao:$('desc').value.trim(),valor:Number($('valor').value),data:$('data').value,categoria:$('categoria').value,tipo:tipoSelecionado,recorrencia:tipoSelecionado==='entrada'?'unico':$('recorrencia').value,total_parcelas:Number($('totalParcelas').value),observacoes:$('observacoes').value.trim()};
 await acao(async()=>{if(!dados.descricao||!dados.data||dados.valor<=0)throw Error('Confira descrição, valor e data.');if(dados.recorrencia==='parcelado')F.split(dados.valor,dados.total_parcelas);await executar('financeiro_criar',{dados});$('formTransacao').reset();$('data').value=hojeISO();selecionarTipo('entrada');navegarPara('dashboard');},'Lançamento salvo. Para registrar a entrada ou saída do dinheiro, use Receber ou Pagar.');
}
function popularFiltroMeses(){
 const el=$('filtroMes'),old=el.value||'todos';const months=[...new Set(transacoesCache.filter(t=>!t.excluido_em).map(t=>F.month(F.due(t))))].filter(Boolean).sort().reverse();
 el.innerHTML='<option value="todos">Todos os meses</option>'+months.map(m=>`<option value="${m}">${m.split('-').reverse().join('/')}</option>`).join('');el.value=months.includes(old)?old:'todos';
}
function renderizarDados(){
 const ref=$('filtroMesDashboard').value||hojeISO().slice(0,7),r=F.summary(transacoesCache,ref,{...configCache,hoje:hojeISO()});
 const byDue=transacoesCache.filter(t=>F.live(t)&&F.month(F.due(t))===ref);
 const cat={};byDue.filter(t=>t.tipo==='saida').forEach(t=>cat[t.categoria]=(cat[t.categoria]||0)+Number(t.valor));
 for(const [id,v]of Object.entries({saldoAnterior:r.previous,entradasRecebidas:r.received,saidasPagas:r.spent,totalEntradas:r.expectedIn,totalSaidas:r.expectedOut,saldoTotal:r.projected,saldoRealizado:r.closing,totalPendente:r.open,totalVencido:r.overdue}))setTexto(id,dinheiro(v));
 const initial=F.month(configCache.data_inicio)===ref?F.cents(configCache.saldo_inicial):0;
 if(initial){$('saldoAnterior').title=`Saldo inicial de ${dinheiro(initial)} incluído no saldo anterior / inicial.`;}else $('saldoAnterior').title='';
 $('tabelaRegistros').innerHTML=byDue.sort((a,b)=>F.due(a).localeCompare(F.due(b))).map(criarLinhaTabela).join('')||emptyRow(7,'Nenhum lançamento neste mês.');
 const hist=$('filtroMes').value;const history=transacoesCache.filter(t=>!t.excluido_em&&(hist==='todos'||F.month(F.due(t))===hist)).sort((a,b)=>F.due(b).localeCompare(F.due(a)));
 $('tabelaHistoricoCorpo').innerHTML=history.map(criarLinhaTabela).join('')||emptyRow(7,'Nenhum registro encontrado.');
 renderizarAlertas(ref);renderizarContasMes();renderizarParcelamentos();renderizarPlanejamento();desenharGrafico(cat);renderizarCalendario();
}
function emptyRow(cols,text){return `<tr><td colspan="${cols}" class="empty-state">${escaparHtml(text)}</td></tr>`;}
function badge(t){return `<span class="status-badge ${F.paid(t)?'quitado':statusFinanceiro(t)}">${labelStatus(t)}</span>`;}
function acoesLinha(t){
 if(t.status==='encerrado')return '<span class="muted">No histórico</span>';
 const id=safeId(t.id);
 const grupo=gruposCache.find(g=>g.id===t.grupo_id);
 if(grupo?.motivo==='quitacao'&&F.paid(t))return '<span class="muted">Pagamento preservado na quitação</span>';
 if(t.origem_quitacao)return `<button class="btn-sm" onclick="navegarPara('parcelas')">Ver quitação</button>`;
 return `<div class="actions-cell">${F.paid(t)?`<button class="btn-sm" onclick="desfazerPagamento('${id}')">Desfazer</button>`:`<button class="btn-pay" onclick="marcarComoPago('${id}')">${t.tipo==='entrada'?'Receber':'Pagar'}</button>`}<button class="btn-icon" onclick="abrirModalEdicao('${id}')" title="Editar">✏️</button><button class="btn-icon" onclick="deletarTransacao('${id}')" title="Excluir">🗑️</button></div>`;
}
function criarLinhaTabela(t){return `<tr><td>${badge(t)}${F.paid(t)?`<div class="muted">${dataBR(F.paidDate(t))} · ${dinheiro(F.paidAmount(t))}</div>`:''}</td><td>${dataBR(F.due(t))}</td><td>${escaparHtml(t.descricao)}${t.recorrencia==='fixo'?'<div class="muted">Conta fixa</div>':''}</td><td>${escaparHtml(t.categoria)}</td><td class="${t.tipo==='entrada'?'txt-success':'txt-danger'}">${t.tipo==='entrada'?'ENTRADA':'SAÍDA'}</td><td>${moeda(t.valor)}</td><td>${acoesLinha(t)}</td></tr>`;}
function prepararContasMes(){const budgetOld=$('orcamentoCategoria').value;const el=$('contasCategoria'),old=el.value||'todos',cats=[...new Set(transacoesCache.map(t=>t.categoria).filter(Boolean))].sort();el.innerHTML='<option value="todos">Todas</option>'+cats.map(c=>`<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join('');el.value=cats.includes(old)?old:'todos';$('orcamentoCategoria').innerHTML=[...new Set([...cats,...[...$('categoria').options].map(o=>o.value)])].sort().map(c=>`<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join('');if([...$('orcamentoCategoria').options].some(o=>o.value===budgetOld))$('orcamentoCategoria').value=budgetOld;}
function contasFiltradas(){
 const ref=$('contasMes').value,status=$('contasStatus').value,category=$('contasCategoria').value,query=$('contasBusca').value.toLowerCase().trim(),type=$('contasTipo').value;
 return transacoesCache.filter(t=>F.live(t)&&(type==='todos'||t.tipo===type)&&(F.month(F.due(t))===ref||($('incluirAtrasadas').checked&&!F.paid(t)&&F.month(F.due(t))<ref)))
 .filter(t=>(status==='todos'||(status==='aberto'?!F.paid(t):statusFinanceiro(t)===status))&&(category==='todos'||t.categoria===category)&&(!query||`${t.descricao} ${t.observacoes||''}`.toLowerCase().includes(query))).sort((a,b)=>F.due(a).localeCompare(F.due(b)));
}
function renderizarContasMes(){
 const ref=$('contasMes').value;const type=$('contasTipo').value;
 const base=transacoesCache.filter(t=>F.live(t)&&(type==='todos'||t.tipo===type)&&(F.month(F.due(t))===ref||($('incluirAtrasadas').checked&&!F.paid(t)&&F.month(F.due(t))<ref)));
 const total=base.reduce((s,t)=>s+F.amount(t),0),paid=base.filter(F.paid).reduce((s,t)=>s+F.paidAmount(t),0),open=base.filter(t=>!F.paid(t)).reduce((s,t)=>s+F.amount(t),0),late=base.filter(t=>statusFinanceiro(t)==='vencido').reduce((s,t)=>s+F.amount(t),0);
 for(const [id,v]of Object.entries({contasPrevisto:total,contasPago:paid,contasPendente:open,contasVencido:late}))setTexto(id,dinheiro(v));
 $('tabelaContasMes').innerHTML=contasFiltradas().map(t=>`<tr><td>${badge(t)}</td><td>${dataBR(F.due(t))}</td><td>${escaparHtml(t.descricao)}${F.month(F.due(t))<ref?'<div class="txt-danger">Mês anterior</div>':''}${t.tipo==='entrada'?'<div class="txt-success">Entrada</div>':''}${F.paid(t)?`<div class="muted">${dataBR(F.paidDate(t))} · ${dinheiro(F.paidAmount(t))}</div>`:''}</td><td>${escaparHtml(t.categoria)}</td><td>${t.recorrencia==='parcelado'?`${t.parcela_atual}/${t.total_parcelas}`:t.recorrencia==='fixo'?'Fixa':'Única'}</td><td>${moeda(t.valor)}</td><td>${acoesLinha(t)}</td></tr>`).join('')||emptyRow(7,'Nenhuma conta encontrada para estes filtros.');
}
function renderizarAlertas(ref){
 const end=F.addMonths(ref+'-01',1),pending=transacoesCache.filter(t=>F.live(t)&&t.tipo==='saida'&&!F.paid(t)&&F.due(t)<end).sort((a,b)=>F.due(a).localeCompare(F.due(b)));
 $('alertasFinanceiros').innerHTML=pending.slice(0,4).map(t=>`<div class="alert-row"><div><strong>${escaparHtml(t.descricao)}</strong><div class="muted">${dataBR(F.due(t))} · ${labelStatus(t)}</div></div><strong>${moeda(t.valor)}</strong><button class="btn-pay" onclick="marcarComoPago('${safeId(t.id)}')">Pagar</button></div>`).join('')||'<p class="muted">Tudo em dia até este mês. Nenhuma conta em aberto.</p>';
 const legacy=transacoesCache.filter(t=>!t.excluido_em&&t.tipo==='saida'&&t.recorrencia!=='unico'&&!t.grupo_id).length;
 if(legacy)$('alertasFinanceiros').innerHTML+=`<div class="alert-row"><span class="muted">${legacy} lançamentos antigos podem ser vinculados às suas contas.</span><button class="btn-sm" onclick="abrirAssociacao()">Conferir</button></div>`;
}
function renderizarParcelamentos(){
 const cards=gruposCache.map(g=>{
  const rows=transacoesCache.filter(t=>t.grupo_id===g.id&&!t.excluido_em),d=F.debt(rows),settlement=transacoesCache.find(t=>t.origem_quitacao===g.id&&!t.grupo_id&&!t.excluido_em&&F.paid(t));
  const done=g.motivo==='quitacao'||(g.modalidade==='parcelado'&&d.pendingCount===0&&rows.filter(F.live).length===g.quantidade);
  const label=g.motivo==='quitacao'?'Quitado':g.motivo==='cancelamento'?'Recorrência encerrada':done?'Todas as parcelas pagas':g.modalidade==='fixo'?'Mensal ativa':'Em andamento';
  const pct=g.quantidade?Math.min(100,Math.round(d.paidCount/g.quantidade*100)):0;
  const id=safeId(g.id);
  return `<div class="debt-card"><div class="debt-head"><div><strong>${escaparHtml(g.nome)}</strong><div class="muted">${escaparHtml(g.categoria)} · ${g.modalidade==='fixo'?'Fixa mensal':'Compra parcelada'}</div></div><span class="status-badge ${done?'quitado':g.ativo?'pendente':'encerrado'}">${label}</span></div>${g.quantidade?`<div class="progress"><span style="width:${g.motivo==='quitacao'?100:pct}%"></span></div>`:''}<div class="debt-meta"><span>Pagas: <b>${d.paidCount}${g.quantidade?'/'+g.quantidade:' meses'}</b></span><span>${g.modalidade==='fixo'?'Mensal':'Total contratado'}: <b>${moeda(g.valor)}</b></span><span>${g.modalidade==='fixo'?'Pendente na previsão':'Parcelas restantes'}: <b>${d.pendingCount} · ${dinheiro(d.pending)}</b></span><span>Próximo vencimento: <b>${d.next?dataBR(F.due(d.next)):'—'}</b></span>${settlement?`<span>Quitação em ${dataBR(F.paidDate(settlement))}: <b>${dinheiro(F.paidAmount(settlement))}</b></span>`:''}</div><div class="debt-actions">${d.next?`<button class="btn-pay" onclick="marcarComoPago('${safeId(d.next.id)}')">Pagar próxima</button>`:''}${g.ativo&&g.modalidade==='parcelado'&&d.pendingCount?`<button class="btn-sm" onclick="abrirQuitacao('${id}')">Quitar dívida inteira</button>`:''}${g.ativo&&g.modalidade==='fixo'?`<button class="btn-sm" onclick="encerrarRecorrencia('${id}')">Encerrar recorrência</button>`:''}${g.motivo==='quitacao'?`<button class="btn-sm" onclick="desfazerQuitacao('${id}')">Desfazer quitação</button>`:''}<button class="btn-sm" onclick="verGrupo('${id}')">Ver lançamentos</button></div></div>`;
 });
 const legacy=transacoesCache.filter(t=>!t.excluido_em&&t.tipo==='saida'&&t.recorrencia==='parcelado'&&!t.grupo_id);
 $('listaParcelamentos').innerHTML=cards.join('')+(legacy.length?`<div class="card margin-top"><strong>Parcelas antigas sem vínculo</strong><p class="muted help-line">${legacy.length} lançamentos. Use “Organizar parcelas antigas” para conferir quais pertencem à mesma compra.</p>${legacy.slice(0,6).map(t=>`<p class="help-line">${escaparHtml(t.descricao)} · ${dataBR(F.due(t))} · ${moeda(t.valor)} · ${labelStatus(t)}</p>`).join('')}</div>`:'')||'<div class="card empty-state">Nenhuma conta parcelada ou fixa cadastrada.</div>';
}
function verGrupo(id){const g=gruposCache.find(g=>g.id===id);if(!g)return;setTexto('modalDiaTitulo',g.nome);$('modalDiaCorpo').innerHTML=`<div class="table-responsive"><table class="data-table"><tbody>${transacoesCache.filter(t=>!t.excluido_em&&(t.grupo_id===id||t.origem_quitacao===id)).sort((a,b)=>F.due(a).localeCompare(F.due(b))).map(criarLinhaTabela).join('')}</tbody></table></div>`;abrirModal('modalDetalhesDia');}
function marcarComoPago(id){fecharModal('modalDetalhesDia');const t=transacoesCache.find(t=>t.id===id);if(!t||!F.live(t)||F.paid(t))return;setTexto('pagamentoTitulo',t.tipo==='entrada'?'Registrar recebimento':'Registrar pagamento');setTexto('pagamentoDetalhe',`${t.descricao} · vencimento ${dataBR(F.due(t))}. Somente este lançamento será marcado.`);$('pagamentoId').value=id;$('pagamentoData').value=hojeISO();$('pagamentoData').max=hojeISO();$('pagamentoValor').value=Number(t.valor).toFixed(2);abrirModal('modalPagamento');}
async function confirmarPagamento(e){e.preventDefault();await acao(async()=>{const dia=$('pagamentoData').value,valor_real=Number($('pagamentoValor').value);validarPagamento(dia,valor_real);await executar('financeiro_pagar',{transacao_id:$('pagamentoId').value,dia,valor_real});fecharModal('modalPagamento');},'Pagamento registrado apenas neste lançamento.');}
async function desfazerPagamento(id){const t=transacoesCache.find(t=>t.id===id);if(gruposCache.some(g=>g.id===t?.grupo_id&&g.motivo==='quitacao'))return avisar('Desfaça primeiro a quitação da dívida inteira para alterar seus pagamentos anteriores.',true);if(!confirm('Desfazer este pagamento? O lançamento volta a ficar pendente e o saldo será recalculado.'))return;await acao(()=>executar('financeiro_desfazer',{transacao_id:id}),'Pagamento desfeito.');}
function alternarStatusQuitado(id){const t=transacoesCache.find(t=>t.id===id);if(t)F.paid(t)?desfazerPagamento(id):marcarComoPago(id);}
function abrirQuitacao(id){const g=gruposCache.find(g=>g.id===id);if(!g)return;const d=F.debt(transacoesCache.filter(t=>t.grupo_id===id));$('quitacaoGrupo').value=id;$('quitacaoGrupo').dataset.saldo=(d.pending/100).toFixed(2);$('quitacaoData').value=hojeISO();$('quitacaoData').max=hojeISO();$('quitacaoValor').value=(d.pending/100).toFixed(2);setTexto('quitacaoDetalhe',`${g.nome}: ${d.pendingCount} parcelas pendentes, somando ${dinheiro(d.pending)}. Você pode informar o valor negociado.`);abrirModal('modalQuitacao');}
async function confirmarQuitacao(e){e.preventDefault();await acao(async()=>{const dia=$('quitacaoData').value,valor_real=Number($('quitacaoValor').value);validarPagamento(dia,valor_real);await executar('financeiro_quitar',{grupo:$('quitacaoGrupo').value,dia,valor_real,saldo_esperado:Number($('quitacaoGrupo').dataset.saldo)});fecharModal('modalQuitacao');},'Dívida quitada. Registrado um único pagamento; parcelas restantes encerradas.');}
async function desfazerQuitacao(id){if(!confirm('Desfazer a quitação? O pagamento da quitação será retirado do saldo e as parcelas encerradas voltarão a ficar pendentes.'))return;await acao(()=>executar('financeiro_desfazer_quitacao',{grupo:id}),'Quitação desfeita; pagamentos mensais anteriores preservados.');}
function encerrarRecorrencia(id){const g=gruposCache.find(g=>g.id===id);if(!g)return;$('encerrarGrupo').value=id;$('encerrarMes').value=$('contasMes').value;setTexto('recorrenciaDetalhe',g.nome+' · '+moeda(g.valor)+' por mês');abrirModal('modalRecorrencia');}
async function confirmarEncerramento(e){e.preventDefault();await acao(async()=>{await executar('financeiro_encerrar_recorrencia',{grupo:$('encerrarGrupo').value,ultimo_mes:$('encerrarMes').value+'-01'});fecharModal('modalRecorrencia');},'Recorrência encerrada; histórico preservado.');}

function abrirAssociacao(){$('grupoNome').value='';renderizarAssociacao();abrirModal('modalAssociacao');}
function renderizarAssociacao(){const type=$('grupoModalidade').value;const rows=transacoesCache.filter(t=>!t.excluido_em&&!t.grupo_id&&t.tipo==='saida'&&t.recorrencia===type&&t.status!=='encerrado').sort((a,b)=>F.due(a).localeCompare(F.due(b)));$('itensAssociacao').innerHTML=rows.map(t=>`<label class="association-option"><input type="checkbox" name="associar" value="${safeId(t.id)}"><span><strong>${escaparHtml(t.descricao)}</strong><br><small>${dataBR(F.due(t))} · ${escaparHtml(t.categoria)} · ${moeda(t.valor)} · ${labelStatus(t)}</small></span></label>`).join('')||'<p class="empty-state">Nenhum lançamento antigo deste tipo para vincular.</p>';}
async function confirmarAssociacao(e){e.preventDefault();const ids=[...document.querySelectorAll('input[name=associar]:checked')].map(el=>el.value);if(ids.length<2)return avisar('Selecione pelo menos dois lançamentos da mesma conta.',true);await acao(async()=>{await executar('financeiro_agrupar',{ids,nome:$('grupoNome').value.trim(),modalidade:$('grupoModalidade').value});fecharModal('modalAssociacao');},'Lançamentos vinculados. Confira a conta em Parcelas e Dívidas.');}
function abrirModalEdicao(id){const t=transacoesCache.find(t=>t.id===id);if(!t||!F.live(t)||t.origem_quitacao||gruposCache.some(g=>g.id===t.grupo_id&&g.motivo==='quitacao'))return;for(const [field,value]of Object.entries({editId:t.id,editDesc:t.descricao,editValor:t.valor,editData:F.due(t),editCategoria:t.categoria,editStatus:F.paid(t)?'pago':'pendente',editPagamento:F.paid(t)?F.paidDate(t):'',editValorPago:F.paid(t)?F.paidAmount(t)/100:'',editObs:t.observacoes||''}))$(field).value=value;$('editPagamento').max=hojeISO();atualizarStatusEdicao();abrirModal('modalEdicao');}
function atualizarStatusEdicao(){const paid=$('editStatus').value==='pago';for(const id of ['editPagamento','editValorPago']){$(id).disabled=!paid;$(id).required=paid;}if(paid){if(!$('editPagamento').value)$('editPagamento').value=hojeISO();if(!$('editValorPago').value)$('editValorPago').value=$('editValor').value;}}
function fecharModalEdicao(){fecharModal('modalEdicao');}
async function salvarEdicaoTransacao(e){e.preventDefault();await acao(async()=>{
 const id=$('editId').value,t=transacoesCache.find(t=>t.id===id);if(!t||!F.live(t)||t.origem_quitacao)throw Error('Lançamento não disponível.');
 const data={descricao:$('editDesc').value.trim(),valor:Number($('editValor').value),data:$('editData').value,vencimento:$('editData').value,categoria:$('editCategoria').value,status:$('editStatus').value,observacoes:$('editObs').value.trim(),data_pagamento:null,valor_pago:null};
 if(!data.descricao||!data.data||!Number.isFinite(data.valor)||data.valor<=0)throw Error('Confira os campos.');
 if(data.status==='pago'){data.data_pagamento=$('editPagamento').value;data.valor_pago=Number($('editValorPago').value);validarPagamento(data.data_pagamento,data.valor_pago);}
 if(demo)Object.assign(t,data);else{const {data:updated,error}=await sb.from('transacoes').update(data).eq('id',id).eq('user_id',usuarioLogado.id).eq('status',t.status).is('excluido_em',null).select('id');if(error)throw error;if(!updated.length)throw Error('O lançamento mudou em outra sessão. Atualize e tente novamente.');}
 fecharModalEdicao();},'Alteração salva apenas neste lançamento.');}
async function deletarTransacao(id){const t=transacoesCache.find(t=>t.id===id);if(!t||t.origem_quitacao||gruposCache.some(g=>g.id===t.grupo_id&&g.motivo==='quitacao'))return;if(!confirm(`Mover “${t.descricao}” para a lixeira? O saldo será recalculado. As outras parcelas serão mantidas.`))return;await acao(async()=>{if(demo)t.excluido_em=new Date().toISOString();else{const {error}=await sb.from('transacoes').update({excluido_em:new Date().toISOString()}).eq('id',id).eq('user_id',usuarioLogado.id);if(error)throw error;}},'Lançamento movido para a lixeira.');}
async function restaurarTransacao(id){await acao(async()=>{const t=transacoesCache.find(t=>t.id===id);if(!t||t.origem_quitacao)throw Error('Registro de quitação não pode ser restaurado individualmente.');const g=gruposCache.find(g=>g.id===t.grupo_id);if(g&&!g.ativo&&t.status!=='encerrado')throw Error('Esta conta foi encerrada. Confira o histórico antes de restaurar.');if(demo)t.excluido_em=null;else{const {error}=await sb.from('transacoes').update({excluido_em:null}).eq('id',id).eq('user_id',usuarioLogado.id);if(error)throw error;}},'Lançamento restaurado.');}
async function mudarMesReferencia(value){if(!value)return;dataCalendarioAtual=new Date(Number(value.slice(0,4)),Number(value.slice(5,7))-1,1);await carregarTransacoes();}
async function mudarMesContas(){if($('contasMes').value)await carregarTransacoes();}
async function mudarMesPrevisao(){if($('previsaoMes').value)await carregarTransacoes();}
function renderizarPlanejamento(){
 const ref=$('previsaoMes').value||hojeISO().slice(0,7);$('tabelaPrevisao').innerHTML=Array.from({length:6},(_,i)=>{const m=F.addMonths(ref+'-01',i).slice(0,7),r=F.summary(transacoesCache,m,{...configCache,hoje:hojeISO()});return `<tr><td>${m.split('-').reverse().join('/')}</td><td class="txt-success">${dinheiro(r.expectedIn)}</td><td>${dinheiro(r.expectedOut)}</td><td>${dinheiro(r.open)}</td><td class="${r.projected<0?'txt-danger':'txt-success'}"><strong>${dinheiro(r.projected)}</strong></td></tr>`;}).join('');
 const budgetMonth=$('orcamentoMes').value;const budgets=orcamentosCache.filter(b=>b.mes===budgetMonth);
 $('listaOrcamentos').innerHTML=budgets.map(b=>{const used=F.budget(transacoesCache,budgetMonth,b.categoria),limit=F.cents(b.limite),pct=Math.round(used/limit*100);return `<div class="budget-row"><div class="budget-info"><strong>${escaparHtml(b.categoria)}</strong><p class="muted">${dinheiro(used)} de ${moeda(b.limite)} · ${pct}%${pct>100?' · Limite ultrapassado':''}</p><div class="progress"><span class="${pct>100?'over':''}" style="width:${Math.min(pct,100)}%"></span></div></div><button class="btn-sm" onclick="removerOrcamento('${safeId(b.id)}')">Remover limite</button></div>`;}).join('')||'<p class="empty-state">Defina um limite para começar a acompanhar suas categorias.</p>';
}
async function salvarOrcamento(e){e.preventDefault();await acao(async()=>{const mes=$('orcamentoMes').value,categoria=$('orcamentoCategoria').value,limite=Number($('orcamentoValor').value);if(!mes||!categoria||limite<=0)throw Error('Confira mês, categoria e limite.');if(demo){const b=orcamentosCache.find(b=>b.mes===mes&&b.categoria===categoria);if(b)b.limite=limite;else orcamentosCache.push({id:crypto.randomUUID(),mes,categoria,limite});}else{const {error}=await sb.from('financeiro_orcamentos').upsert({user_id:usuarioLogado.id,mes,categoria,limite},{onConflict:'user_id,mes,categoria'});if(error)throw error;}},'Limite mensal salvo.');}
async function removerOrcamento(id){await acao(async()=>{if(demo)orcamentosCache=orcamentosCache.filter(b=>b.id!==id);else{const {error}=await sb.from('financeiro_orcamentos').delete().eq('id',id).eq('user_id',usuarioLogado.id);if(error)throw error;}},'Limite removido.');}
function renderizarConfiguracoes(){$('configSaldo').value=configCache.saldo_inicial;$('configInicio').value=configCache.data_inicio;$('listaLixeira').innerHTML=transacoesCache.filter(t=>t.excluido_em&&!t.origem_quitacao).map(t=>`<div class="trash-row"><span>${escaparHtml(t.descricao)} · ${dataBR(F.due(t))} · ${moeda(t.valor)}</span><button class="btn-sm" onclick="restaurarTransacao('${safeId(t.id)}')">Restaurar</button></div>`).join('')||'<p class="empty-state">Lixeira vazia.</p>';}
async function salvarConfiguracoes(e){e.preventDefault();const data={saldo_inicial:Number($('configSaldo').value),data_inicio:$('configInicio').value};if(!confirm('Alterar o saldo inicial e a data de início recalcula os saldos de todos os meses. Confirmar?'))return;await acao(async()=>{if(!Number.isFinite(data.saldo_inicial)||!data.data_inicio)throw Error('Confira valor e data.');if(demo)configCache=data;else{const {error}=await sb.from('financeiro_config').upsert({user_id:usuarioLogado.id,...data});if(error)throw error;}},'Saldo inicial atualizado.');}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportarCSV(scope){let rows=transacoesCache.filter(t=>!t.excluido_em);if(scope==='contas')rows=contasFiltradas();if(scope==='historico'&&$('filtroMes').value!=='todos')rows=rows.filter(t=>F.month(F.due(t))===$('filtroMes').value);download(`financeiro-${scope}-${hojeISO()}.csv`,F.csv(rows),'text/csv;charset=utf-8');}
function exportarBackup(){download(`backup-financeiro-${hojeISO()}.json`,JSON.stringify({versao:3,exportado_em:new Date().toISOString(),config:configCache,transacoes:transacoesCache,grupos:gruposCache,orcamentos:orcamentosCache},null,2),'application/json');}
function mudarMesCalendario(delta){dataCalendarioAtual.setDate(1);dataCalendarioAtual.setMonth(dataCalendarioAtual.getMonth()+delta);renderizarCalendario();}
function renderizarCalendario(){
 const y=dataCalendarioAtual.getFullYear(),m=dataCalendarioAtual.getMonth(),title=new Date(y,m,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 setTexto('calTituloMes',title);let html='';for(let i=0;i<new Date(y,m,1).getDay();i++)html+='<div class="cal-day empty"></div>';
 for(let d=1;d<=new Date(y,m+1,0).getDate();d++){
  const date=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,rows=transacoesCache.filter(t=>F.live(t)&&F.due(t)===date);
  html+=`<div class="cal-day ${date===hojeISO()?'today':''}" role="button" tabindex="0" aria-label="Lançamentos de ${dataBR(date)}" onclick="exibirDetalhesDia('${date}')" onkeydown="if(event.key==='Enter')exibirDetalhesDia('${date}')"><span class="cal-day-num">${d}</span><div class="cal-events">${rows.slice(0,2).map(t=>`<div class="cal-event-item ${t.tipo}" title="${escaparHtml(t.descricao)} · ${labelStatus(t)}">${F.paid(t)?'✓ ':statusFinanceiro(t)==='vencido'?'! ':''}${escaparHtml(t.descricao)} (${moeda(t.valor)})</div>`).join('')}${rows.length>2?`<small class="muted">+${rows.length-2} mais</small>`:''}</div></div>`;
 }
 $('calendarDays').innerHTML=html;
}
function exibirDetalhesDia(date){setTexto('modalDiaTitulo','Vencimentos de '+dataBR(date));const rows=transacoesCache.filter(t=>F.live(t)&&F.due(t)===date);$('modalDiaCorpo').innerHTML=rows.length?`<div class="table-responsive"><table class="data-table"><tbody>${rows.map(criarLinhaTabela).join('')}</tbody></table></div>`:'<p class="empty-state">Nenhum lançamento nesta data.</p>';abrirModal('modalDetalhesDia');}
function fecharModalDia(){fecharModal('modalDetalhesDia');}
function desenharGrafico(data){
 const canvas=$('meuGrafico');if(!canvas)return;
 if(typeof Chart==='undefined'){
  canvas.hidden=true;let fallback=$('graficoAlternativo');if(!fallback){fallback=document.createElement('div');fallback.id='graficoAlternativo';canvas.parentElement.appendChild(fallback);}
  const total=Object.values(data).reduce((s,v)=>s+v,0),colors=['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];let cumulative=0;
  const segments=Object.entries(data).map(([c,v],i)=>{const from=cumulative;cumulative+=total?v/total*100:0;return `${colors[i%colors.length]} ${from}% ${cumulative}%`;});
  fallback.innerHTML=total?`<div class="offline-chart"><div class="donut" style="background:conic-gradient(${segments.join(',')})"><div><small class="muted">Previsto</small><strong>${moeda(total)}</strong></div></div><div>${Object.entries(data).map(([c,v],i)=>`<div class="chart-legend"><i style="background:${colors[i%colors.length]}"></i><span>${escaparHtml(c)}</span><strong>${moeda(v)}</strong></div>`).join('')}</div></div>`:'<p class="empty-state">Sem despesas neste mês.</p>';return;
 }
 if(meuGrafico)meuGrafico.destroy();
 meuGrafico=new Chart(canvas.getContext('2d'),{type:'doughnut',data:{labels:Object.keys(data),datasets:[{data:Object.values(data),backgroundColor:['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:document.body.classList.contains('light-theme')?'#0f172a':'#f8fafc'}}}}});
}
function aplicarTemaSalvo(){try{if(localStorage.getItem('tema_pref')==='light')document.body.classList.add('light-theme');}catch{}setTexto('btnTema',document.body.classList.contains('light-theme')?'☀️ Claro':'🌙 Escuro');}
function alternarTema(){const light=document.body.classList.toggle('light-theme');try{localStorage.setItem('tema_pref',light?'light':'dark');}catch{}setTexto('btnTema',light?'☀️ Claro':'🌙 Escuro');if(usuarioLogado)renderizarDados();}

// A demonstração tem dados isolados em memória; nunca grava no Supabase.
function seedDemo(){
 const now=hojeISO(),ref=now.slice(0,7),prior=F.addMonths(ref+'-01',-1),start=F.addMonths(ref+'-01',-2);
 configCache={saldo_inicial:400,data_inicio:prior};transacoesCache=[];gruposCache=[];orcamentosCache=[{id:'budget-food',mes:ref,categoria:'Alimentação',limite:700}];
 const row=(description,value,date,type,status='pendente',category='Outros')=>({id:crypto.randomUUID(),user_id:'demo-user',descricao:description,valor:value,data:date,vencimento:date,tipo:type,categoria:category,status,recorrencia:'unico',parcela_atual:1,total_parcelas:1,...(status==='pago'?{data_pagamento:date,valor_pago:value}:{})});
 transacoesCache.push(row('Salário do mês anterior',3000,prior,'entrada','pago','Salário'),row('Despesas do mês anterior',2400,prior,'saida','pago','Moradia'));
 const first=ref+'-01';transacoesCache.push(row('Salário',3000,first,'entrada','pago','Salário'),row('Mercado',320,first,'saida','pago','Alimentação'),row('Energia',185,ref+'-20','saida','pendente','Moradia'),row('Freelance a receber',600,ref+'-25','entrada','pendente','Outros'));
 const g1={id:crypto.randomUUID(),user_id:'demo-user',nome:'Notebook',categoria:'Outros',modalidade:'parcelado',inicio:start,valor:2400,quantidade:8,ativo:true};
 const g2={id:crypto.randomUUID(),user_id:'demo-user',nome:'Internet',categoria:'Moradia',modalidade:'fixo',inicio:prior,valor:120,quantidade:null,ativo:true};gruposCache.push(g1,g2);materializarDemo(F.addMonths(first,12));
 for(const t of transacoesCache.filter(t=>t.grupo_id&&F.due(t)<first)){t.status='pago';t.data_pagamento=F.due(t);t.valor_pago=t.valor;}
 transacoesCache.push({...row('Curso (1/2)',150,ref+'-10','saida','pendente','Outros'),recorrencia:'parcelado',parcela_atual:1,total_parcelas:2},{...row('Curso (2/2)',150,F.addMonths(ref+'-10',1),'saida','pendente','Outros'),recorrencia:'parcelado',parcela_atual:2,total_parcelas:2});
}
function materializarDemo(ate){
 for(const g of gruposCache.filter(g=>g.ativo)){
  const a=g.inicio.split('-').map(Number),b=ate.split('-').map(Number),count=g.modalidade==='parcelado'?g.quantidade:Math.max(0,(b[0]-a[0])*12+b[1]-a[1]+1);
  if(count>1200)throw Error('Mês muito distante.');
  const values=g.modalidade==='parcelado'?F.split(g.valor,g.quantidade):null;
  for(let i=1;i<=count;i++){if(transacoesCache.some(t=>t.grupo_id===g.id&&t.sequencia===i))continue;const due=F.addMonths(g.inicio,i-1);transacoesCache.push({id:crypto.randomUUID(),user_id:'demo-user',descricao:g.nome+(values?` (${i}/${g.quantidade})`:' 🔄'),valor:values?values[i-1]:g.valor,data:due,vencimento:due,categoria:g.categoria,tipo:'saida',recorrencia:g.modalidade,parcela_atual:values?i:1,total_parcelas:g.quantidade||1,status:'pendente',grupo_id:g.id,sequencia:i,observacoes:g.observacoes||''});}
 }
}
async function executarDemo(action,a){
 const t=transacoesCache.find(t=>t.id===a.transacao_id),g=gruposCache.find(g=>g.id===a.grupo);
 switch(action){
 case 'financeiro_criar':{const d=a.dados;if(d.tipo==='saida'&&d.recorrencia!=='unico'){const id=crypto.randomUUID();gruposCache.push({id,user_id:'demo-user',nome:d.descricao,categoria:d.categoria,modalidade:d.recorrencia,inicio:d.data,valor:d.valor,quantidade:d.recorrencia==='parcelado'?d.total_parcelas:null,observacoes:d.observacoes||'',ativo:true});materializarDemo(F.addMonths(d.data,12));return id;}const id=crypto.randomUUID();transacoesCache.push({id,user_id:'demo-user',...d,vencimento:d.data,recorrencia:'unico',status:'pendente',parcela_atual:1,total_parcelas:1});return id;}
 case 'financeiro_pagar':if(!t||t.status!=='pendente'||!F.live(t))throw Error('Lançamento indisponível.');validarPagamento(a.dia,a.valor_real);Object.assign(t,{status:'pago',data_pagamento:a.dia,valor_pago:a.valor_real});break;
 case 'financeiro_desfazer':if(!t||!F.paid(t)||t.origem_quitacao)throw Error('Pagamento indisponível.');Object.assign(t,{status:'pendente',data_pagamento:null,valor_pago:null});break;
 case 'financeiro_quitar':{
  if(!g||!g.ativo||g.modalidade!=='parcelado')throw Error('Dívida indisponível.');validarPagamento(a.dia,a.valor_real);
  const pending=transacoesCache.filter(t=>t.grupo_id===g.id&&F.live(t)&&!F.paid(t));if(!pending.length)throw Error('Sem parcelas pendentes.');if(a.saldo_esperado!=null&&pending.reduce((s,t)=>s+F.amount(t),0)!==F.cents(a.saldo_esperado))throw Error('As parcelas mudaram. Abra a quitação novamente para conferir.');
  pending.forEach(t=>Object.assign(t,{status:'encerrado',origem_quitacao:g.id}));Object.assign(g,{ativo:false,motivo:'quitacao',encerrado_em:a.dia});
  transacoesCache.push({id:crypto.randomUUID(),user_id:'demo-user',descricao:'Quitação — '+g.nome,valor:a.valor_real,valor_pago:a.valor_real,data:a.dia,vencimento:a.dia,data_pagamento:a.dia,categoria:g.categoria,tipo:'saida',status:'pago',recorrencia:'unico',parcela_atual:1,total_parcelas:1,origem_quitacao:g.id});break;}
 case 'financeiro_desfazer_quitacao':if(!g||g.motivo!=='quitacao')throw Error('Quitação não encontrada.');for(const t of transacoesCache.filter(t=>t.origem_quitacao===g.id&&!t.excluido_em)){if(t.grupo_id){t.status='pendente';t.origem_quitacao=null;}else t.excluido_em=new Date().toISOString();}Object.assign(g,{ativo:true,motivo:null,encerrado_em:null});break;
 case 'financeiro_encerrar_recorrencia':{
  if(!g||!g.ativo||g.modalidade!=='fixo')throw Error('Conta fixa indisponível.');const limit=F.addMonths(a.ultimo_mes,1);
  if(transacoesCache.some(t=>t.grupo_id===g.id&&F.live(t)&&F.paid(t)&&F.due(t)>=limit))throw Error('Existem meses posteriores pagos. Desfaça primeiro.');
  transacoesCache.filter(t=>t.grupo_id===g.id&&F.live(t)&&!F.paid(t)&&F.due(t)>=limit).forEach(t=>t.status='encerrado');Object.assign(g,{ativo:false,motivo:'cancelamento',encerrado_em:a.ultimo_mes});break;}
 case 'financeiro_agrupar':{
  const rows=transacoesCache.filter(t=>a.ids.includes(t.id));if(rows.length!==a.ids.length||rows.length<2||rows.some(t=>t.grupo_id||t.excluido_em||t.tipo!=='saida'||t.recorrencia!==a.modalidade))throw Error('Seleção inválida.');
  rows.sort((a,b)=>F.due(a).localeCompare(F.due(b)));const first=rows[0];if(rows.some(t=>t.categoria!==first.categoria))throw Error('Selecione uma categoria.');
  if(a.modalidade==='parcelado'&&(rows.length!==first.total_parcelas||new Set(rows.map(t=>t.parcela_atual)).size!==rows.length||Math.min(...rows.map(t=>t.parcela_atual))!==1||Math.max(...rows.map(t=>t.parcela_atual))!==rows.length))throw Error('Selecione todas as parcelas, sem duplicações.');
  if(a.modalidade==='fixo'&&new Set(rows.map(t=>F.month(F.due(t)))).size!==rows.length)throw Error('Selecione uma ocorrência por mês.');
  const id=crypto.randomUUID(),start=F.due(first),g={id,user_id:'demo-user',nome:a.nome,categoria:first.categoria,modalidade:a.modalidade,inicio:start,valor:a.modalidade==='parcelado'?rows.reduce((s,t)=>s+Number(t.valor),0):rows.at(-1).valor,quantidade:a.modalidade==='parcelado'?rows.length:null,ativo:true};
  gruposCache.push(g);rows.forEach(t=>{t.grupo_id=id;const x=F.due(t).split('-').map(Number),y=start.split('-').map(Number);t.sequencia=a.modalidade==='parcelado'?t.parcela_atual:(x[0]-y[0])*12+x[1]-y[1]+1;});return id;}
 default:throw Error('Ação não disponível na demonstração.');
 }
}
// Inicialização. Uma configuração ausente não impede a demonstração.
aplicarTemaSalvo();selecionarTipo('entrada');
if(!demo&&typeof SUPABASE_URL!=='undefined'&&typeof SUPABASE_KEY!=='undefined'&&window.supabase){try{sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);}catch{}}
if(!demo&&!sb){$('loginSection').appendChild($('mensagemApp'));avisar('Para usar sua conta, configure config.js. Você também pode conhecer o sistema com dados de exemplo.',true);}
document.querySelectorAll('.nav-item').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal').forEach(m=>fecharModal(m.id));});
verificarSessao();
