// Insira a URL e a Key pública do seu projeto Supabase abaixo se ainda não estiverem configuradas globalmente:
const SUPABASE_URL = 'https://iecdvnsvnobpxqnusitw.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q';


const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioLogado = null;
let usernameAtual = "";
let transacoesCache = [];
let tipoSelecionado = 'entrada';
let meuGrafico = null;
let dataCalendarioAtual = new Date();

function escaparHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function navegarPara(paginaId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const navItems = document.querySelectorAll('.nav-item');

    if (paginaId === 'dashboard') {
        document.getElementById('pageDashboard').classList.add('active');
        if (navItems[0]) navItems[0].classList.add('active');
    } else if (paginaId === 'novoLancamento') {
        document.getElementById('pageNovoLancamento').classList.add('active');
        if (navItems[1]) navItems[1].classList.add('active');
    } else if (paginaId === 'contas') {
        document.getElementById('pageContas').classList.add('active');
        if (navItems[2]) navItems[2].classList.add('active');
        prepararContasMes(); renderizarContasMes();
    } else if (paginaId === 'parcelas') {
        document.getElementById('pageParcelas').classList.add('active');
        if (navItems[3]) navItems[3].classList.add('active');
        renderizarParcelamentos();
    } else if (paginaId === 'historico') {
        document.getElementById('pageHistorico').classList.add('active');
        if (navItems[4]) navItems[4].classList.add('active');
    }

    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function alternarCamposParcela() {
    const tipo = document.getElementById('recorrencia').value;
    document.getElementById('boxParcelas').style.display = tipo === 'parcelado' ? 'block' : 'none';
}

// AUTENTICAÇÃO
async function fazerLogin() {
    const usernameInput = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginSenha').value;

    if (!usernameInput) return alert("Digite o nome de usuário.");

    const emailFake = `${usernameInput}@sistema.local`;

    const { data, error } = await sb.auth.signInWithPassword({
        email: emailFake,
        password: password
    });

    if (error) {
        alert("Erro ao logar: Usuário ou senha incorretos.");
    } else {
        iniciarSessao(data.user, usernameInput);
    }
}

async function verificarSessao() {
    const { data: { user } } = await sb.auth.getUser();
    if (user && user.email) {
        const username = user.email.split('@')[0];
        iniciarSessao(user, username);
    }
}

function iniciarSessao(user, username) {
    usuarioLogado = user;
    usernameAtual = username;

    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('appSection').style.display = 'block';
    document.getElementById('userDisplayTag').innerText = `@${usernameAtual}`;

    document.getElementById('data').valueAsDate = new Date();
    
    // Inicializa o campo de mês do Dashboard com o mês atual YYYY-MM
    const agora = new Date();
    const inputMesDash = document.getElementById('filtroMesDashboard');
    if (inputMesDash) {
        inputMesDash.value = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    }

    carregarTransacoes();
}

async function deslogar() {
    await sb.auth.signOut();
    location.reload();
}

function selecionarTipo(tipo) {
    tipoSelecionado = tipo;
    document.getElementById('btnEntrada').classList.toggle('active', tipo === 'entrada');
    document.getElementById('btnSaida').classList.toggle('active', tipo === 'saida');
}

// SALVAR LANÇAMENTO
async function salvarTransacao(e) {
    e.preventDefault();

    if (!usuarioLogado) return alert("Sessão expirada. Faça login novamente.");

    const targetUserId = usuarioLogado.id;
    const descBase = document.getElementById('desc').value;
    const valorTotal = parseFloat(document.getElementById('valor').value);
    const dataInicialStr = document.getElementById('data').value;
    const categoria = document.getElementById('categoria').value;
    const tipoRecorrencia = document.getElementById('recorrencia').value;

    let numLancamentos = 1;
    if (tipoRecorrencia === 'parcelado') {
        numLancamentos = parseInt(document.getElementById('totalParcelas').value) || 1;
    } else if (tipoRecorrencia === 'fixo') {
        numLancamentos = 12;
    }

    const listaParaInserir = [];
    const [anoOriginal, mesOriginal, diaOriginal] = dataInicialStr.split('-').map(Number);

    for (let i = 0; i < numLancamentos; i++) {
        let anoDestino = anoOriginal;
        let mesDestinoIndex = (mesOriginal - 1) + i;

        anoDestino += Math.floor(mesDestinoIndex / 12);
        mesDestinoIndex = mesDestinoIndex % 12;

        const ultimoDiaDoMes = new Date(anoDestino, mesDestinoIndex + 1, 0).getDate();
        const diaAjustado = Math.min(diaOriginal, ultimoDiaDoMes);

        const mesStr = String(mesDestinoIndex + 1).padStart(2, '0');
        const diaStr = String(diaAjustado).padStart(2, '0');
        const dataFormatada = `${anoDestino}-${mesStr}-${diaStr}`;

        let descFinal = descBase;
        let valorFinal = valorTotal;

        if (tipoRecorrencia === 'parcelado') {
            descFinal = `${descBase} (${i + 1}/${numLancamentos})`;
            valorFinal = valorTotal / numLancamentos;
        } else if (tipoRecorrencia === 'fixo') {
            descFinal = `${descBase} 🔄`;
        }

        listaParaInserir.push({
            user_id: targetUserId,
            descricao: descFinal,
            valor: valorFinal,
            data: dataFormatada,
            vencimento: dataFormatada,
            categoria: categoria,
            tipo: tipoSelecionado,
            recorrencia: tipoRecorrencia,
            parcela_atual: tipoRecorrencia === 'parcelado' ? i + 1 : 1,
            total_parcelas: numLancamentos,
            status: 'pendente'
        });
    }

    const { error } = await sb.from('transacoes').insert(listaParaInserir);

    if (error) {
        alert("Erro ao salvar: " + error.message);
    } else {
        document.getElementById('formTransacao').reset();
        document.getElementById('data').valueAsDate = new Date();
        alternarCamposParcela();
        selecionarTipo('entrada');
        alert("Lançamento(s) salvo(s) com sucesso!");
        carregarTransacoes();
        navegarPara('dashboard');
    }
}

// CARREGAR TRANSAÇÕES
async function carregarTransacoes() {
    if (!usuarioLogado) return;

    const { data, error } = await sb
        .from('transacoes')
        .select('*')
        .eq('user_id', usuarioLogado.id)
        .order('data', { ascending: false });

    if (!error && data) {
        transacoesCache = data;
        popularFiltroMeses();
        renderizarDados();
    }
}

// POPULA O SELECT DO HISTÓRICO COMPLETO
function popularFiltroMeses() {
    const select = document.getElementById('filtroMes');
    if (!select) return;

    const valorSelecionadoAnteriormente = select.value;
    let htmlOptions = '<option value="todos">Todos os Meses</option>';

    const mesesMap = new Set();
    transacoesCache.forEach(t => {
        if (t.data && t.data.length >= 7) {
            mesesMap.add(t.data.substring(0, 7)); // Extrai YYYY-MM
        }
    });

    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    Array.from(mesesMap).sort().reverse().forEach(mesAno => {
        const [ano, mes] = mesAno.split('-');
        const idxMes = parseInt(mes, 10) - 1;
        if (idxMes >= 0 && idxMes < 12) {
            const nomeFormatado = `${nomesMeses[idxMes]} / ${ano}`;
            htmlOptions += `<option value="${mesAno}">${nomeFormatado}</option>`;
        }
    });

    select.innerHTML = htmlOptions;
    
    // Restaura a seleção do usuário ou volta para "todos"
    if (valorSelecionadoAnteriormente && select.querySelector(`option[value="${valorSelecionadoAnteriormente}"]`)) {
        select.value = valorSelecionadoAnteriormente;
    } else {
        select.value = 'todos';
    }
}

// RENDERIZAÇÃO DE DADOS (DASHBOARD E HISTÓRICO COMPLETO)
function renderizarDados() {
    let totEntradas = 0, totSaidas = 0;
    const catMap = {};
    
    const tbodyDashboard = document.getElementById('tabelaRegistros');
    // Mapeia tanto o ID principal quanto um fallback para a tabela do Histórico
    const tbodyHistorico = document.getElementById('tabelaHistoricoCorpo') || document.getElementById('tabelaHistorico');
    
    let htmlDashboard = '';
    let htmlHistorico = '';

    // 1. FILTRO E PROCESSAMENTO DO DASHBOARD
    const inputMesDash = document.getElementById('filtroMesDashboard');
    const mesDashSelecionado = inputMesDash ? inputMesDash.value.trim() : '';

    const registrosDashboard = transacoesCache.filter(t => {
        if (!mesDashSelecionado) return true;
        return t.data && t.data.startsWith(mesDashSelecionado);
    });

    registrosDashboard.forEach(t => {
        if (t.tipo === 'entrada') {
            totEntradas += t.valor;
        } else {
            totSaidas += t.valor;
            catMap[t.categoria] = (catMap[t.categoria] || 0) + t.valor;
        }

        htmlDashboard += criarLinhaTabela(t);
    });

    // 2. FILTRO E PROCESSAMENTO DO HISTÓRICO COMPLETO
    const selectMesHist = document.getElementById('filtroMes');
    const mesHistSelecionado = selectMesHist ? selectMesHist.value.trim() : 'todos';

    const registrosHistorico = transacoesCache.filter(t => {
        if (!mesHistSelecionado || mesHistSelecionado === 'todos') return true;
        return t.data && t.data.startsWith(mesHistSelecionado);
    });

    registrosHistorico.forEach(t => {
        htmlHistorico += criarLinhaTabela(t);
    });

    // Injeta os dados nas respectivas tabelas caso existam na DOM
    if (tbodyDashboard) tbodyDashboard.innerHTML = htmlDashboard;
    if (tbodyHistorico) tbodyHistorico.innerHTML = htmlHistorico;

    // Atualiza os cards de totais do Dashboard
    const elEntradas = document.getElementById('totalEntradas');
    const elSaidas = document.getElementById('totalSaidas');
    const elSaldo = document.getElementById('saldoTotal');

    if (elEntradas) elEntradas.innerText = `R$ ${totEntradas.toFixed(2)}`;
    if (elSaidas) elSaidas.innerText = `R$ ${totSaidas.toFixed(2)}`;
    if (elSaldo) elSaldo.innerText = moeda(totEntradas - totSaidas);

    const hoje = hojeISO();
    const entradasRealizadas = registrosDashboard.filter(t => t.tipo === 'entrada' && t.status === 'quitado').reduce((a,t)=>a+Number(t.valor||0),0);
    const saidasPagas = registrosDashboard.filter(t => t.tipo === 'saida' && t.status === 'quitado').reduce((a,t)=>a+Number(t.valor||0),0);
    const saidasPendentes = registrosDashboard.filter(t => t.tipo === 'saida' && t.status !== 'quitado').reduce((a,t)=>a+Number(t.valor||0),0);
    const saidasVencidas = registrosDashboard.filter(t => t.tipo === 'saida' && t.status !== 'quitado' && (t.vencimento||t.data) < hoje).reduce((a,t)=>a+Number(t.valor||0),0);
    setTexto('saldoRealizado', moeda(entradasRealizadas-saidasPagas));
    setTexto('totalPendente', moeda(saidasPendentes));
    setTexto('totalVencido', moeda(saidasVencidas));
    renderizarContasMes(); renderizarParcelamentos();

    desenharGrafico(catMap);
    renderizarCalendario();
}

// FUNÇÃO AUXILIAR PARA GERAR A LINHA DA TABELA
function criarLinhaTabela(t) {
    let badgeTipo = '';
    if (t.recorrencia === 'fixo') badgeTipo = ' <small style="color:var(--text-secondary);">(Fixo)</small>';

    const isQuitado = t.status === 'quitado';
    const badgeStatusClass = isQuitado ? 'quitado' : 'pendente';
    const textoStatus = isQuitado ? 'Quitado ✅' : 'Pendente ⏳';

    const dataFormatada = t.data ? t.data.split('T')[0].split('-').reverse().join('/') : '-';

    return `
        <tr>
            <td>
                <span class="status-badge ${badgeStatusClass}" onclick="alternarStatusQuitado('${t.id}', '${t.status}')">
                    ${textoStatus}
                </span>
            </td>
            <td>${dataFormatada}</td>
            <td>${escaparHtml(t.descricao)} ${badgeTipo}</td>
            <td>${escaparHtml(t.categoria)}</td>
            <td class="${t.tipo === 'entrada' ? 'txt-success' : 'txt-danger'}">${t.tipo.toUpperCase()}</td>
            <td>R$ ${t.valor.toFixed(2)}</td>
            <td>
                <div class="actions-cell">
                    <button class="btn-icon" onclick="abrirModalEdicao('${t.id}')" title="Editar">✏️</button>
                    <button class="btn-icon" onclick="deletarTransacao('${t.id}')" title="Excluir">🗑️</button>
                </div>
            </td>
        </tr>
    `;
}

// CALENDÁRIO
function mudarMesCalendario(delta) {
    dataCalendarioAtual.setMonth(dataCalendarioAtual.getMonth() + delta);
    renderizarCalendario();
}

function renderizarCalendario() {
    const grid = document.getElementById('calendarDays');
    if (!grid) return;

    let calHtml = '';
    const ano = dataCalendarioAtual.getFullYear();
    const mes = dataCalendarioAtual.getMonth();

    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesHoje = hoje.getMonth();
    const anoHoje = hoje.getFullYear();

    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const elTituloMes = document.getElementById('calTituloMes');
    if (elTituloMes) elTituloMes.innerText = `${nomesMeses[mes]} ${ano}`;

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();

    for (let i = 0; i < primeiroDiaSemana; i++) {
        calHtml += `<div class="cal-day empty"></div>`;
    }

    for (let dia = 1; dia <= totalDiasMes; dia++) {
        const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const itensDia = transacoesCache.filter(t => (t.vencimento || t.data) === dataStr);

        const isHoje = (dia === diaHoje && mes === mesHoje && ano === anoHoje) ? 'today' : '';

        let eventosHtml = '';
        itensDia.slice(0, 2).forEach(item => {
            const classeTipo = item.tipo === 'entrada' ? 'entrada' : 'saida';
            eventosHtml += `
                <div class="cal-event-item ${classeTipo}">
                    ${escaparHtml(item.descricao)} (R$${item.valor.toFixed(0)})
                </div>
            `;
        });

        if (itensDia.length > 2) {
            eventosHtml += `<small style="color:var(--text-secondary);">+${itensDia.length - 2} mais...</small>`;
        }

        calHtml += `
            <div class="cal-day ${isHoje}" onclick="exibirDetalhesDia('${dataStr}')">
                <span class="cal-day-num">${dia}</span>
                <div class="cal-events">${eventosHtml}</div>
            </div>
        `;
    }

    grid.innerHTML = calHtml;
}

// JANELA MODAL PARA DETALHAR OS VENCIMENTOS DO DIA CLICADO
function exibirDetalhesDia(dataStr) {
    const itens = transacoesCache.filter(t => (t.vencimento || t.data) === dataStr);
    const [ano, mes, dia] = dataStr.split('-');
    
    const elModalTitulo = document.getElementById('modalDiaTitulo');
    if (elModalTitulo) elModalTitulo.innerText = `Lançamentos de ${dia}/${mes}/${ano}`;
    const corpo = document.getElementById('modalDiaCorpo');

    if (!corpo) return;

    if (itens.length === 0) {
        corpo.innerHTML = '<p style="color: var(--text-secondary);">Nenhum lançamento ou vencimento nesta data.</p>';
    } else {
        let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
        itens.forEach(t => {
            const cor = t.tipo === 'entrada' ? '#10b981' : '#ef4444';
            const statusText = t.status === 'quitado' ? '✅ Quitado' : '⏳ Pendente';
            html += `
                <li style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${escaparHtml(t.descricao)}</strong><br>
                        <small style="color: var(--text-secondary);">${escaparHtml(t.categoria)} | ${statusText}</small>
                    </div>
                    <span style="color: ${cor}; font-weight: bold;">R$ ${t.valor.toFixed(2)}</span>
                </li>
            `;
        });
        html += '</ul>';
        corpo.innerHTML = html;
    }

    const modal = document.getElementById('modalDetalhesDia');
    if (modal) modal.style.display = 'flex';
}

function fecharModalDia() {
    const modal = document.getElementById('modalDetalhesDia');
    if (modal) modal.style.display = 'none';
}

// AÇÕES E DEMAIS FUNÇÕES
async function deletarTransacao(id) {
    if (confirm("Tem certeza que deseja excluir esta transação?")) {
        const { error } = await sb.from('transacoes').delete().eq('id', id);
        if (!error) carregarTransacoes();
    }
}

async function alternarStatusQuitado(id, statusAtual) {
    const novoStatus = statusAtual === 'quitado' ? 'pendente' : 'quitado';
    const { error } = await sb.from('transacoes').update({ status: novoStatus }).eq('id', id);
    if (!error) carregarTransacoes();
}

function abrirModalEdicao(id) {
    const item = transacoesCache.find(t => t.id === id);
    if (!item) return;

    document.getElementById('editId').value = item.id;
    document.getElementById('editDesc').value = item.descricao;
    document.getElementById('editValor').value = item.valor;
    document.getElementById('editData').value = item.data;
    document.getElementById('editCategoria').value = item.categoria;
    document.getElementById('editStatus').value = item.status || 'pendente';

    const modal = document.getElementById('modalEdicao');
    if (modal) modal.style.display = 'flex';
}

function fecharModalEdicao() {
    const modal = document.getElementById('modalEdicao');
    if (modal) modal.style.display = 'none';
}

async function salvarEdicaoTransacao(e) {
    e.preventDefault();

    const id = document.getElementById('editId').value;
    const novosDados = {
        descricao: document.getElementById('editDesc').value,
        valor: parseFloat(document.getElementById('editValor').value),
        data: document.getElementById('editData').value,
        vencimento: document.getElementById('editData').value,
        categoria: document.getElementById('editCategoria').value,
        status: document.getElementById('editStatus').value
    };

    const { error } = await sb.from('transacoes').update(novosDados).eq('id', id);

    if (!error) {
        fecharModalEdicao();
        carregarTransacoes();
    }
}

function desenharGrafico(dadosCategorias) {
    const canvas = document.getElementById('meuGrafico');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (meuGrafico) meuGrafico.destroy();

    const corTexto = document.body.classList.contains('light-theme') ? '#0f172a' : '#f8fafc';

    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dadosCategorias),
            datasets: [{
                data: Object.values(dadosCategorias),
                backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: corTexto } } }
        }
    });
}

function aplicarTemaSalvo() {
    if (localStorage.getItem('tema_pref') === 'light') {
        document.body.classList.add('light-theme');
        const btnTema = document.getElementById('btnTema');
        if (btnTema) btnTema.innerText = '☀️ Claro';
    }
}

function alternarTema() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('tema_pref', isLight ? 'light' : 'dark');
    
    const btnTema = document.getElementById('btnTema');
    if (btnTema) btnTema.innerText = isLight ? '☀️ Claro' : '🌙 Escuro';
    
    if (transacoesCache.length > 0) renderizarDados();
}

// INICIALIZAÇÃO
aplicarTemaSalvo();
verificarSessao();

// ================= V2: GESTÃO DE CONTAS E PARCELAS =================
function moeda(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function hojeISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function setTexto(id,valor){ const el=document.getElementById(id); if(el) el.textContent=valor; }
function dataBR(v){ if(!v) return '-'; const p=v.split('T')[0].split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:v; }
function statusFinanceiro(t){ if(t.status==='quitado') return 'pago'; const v=t.vencimento||t.data; return v && v<hojeISO()?'vencido':'pendente'; }
function prepararContasMes(){
  const mes=document.getElementById('contasMes'); if(mes&&!mes.value){ const d=new Date(); mes.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  const cat=document.getElementById('contasCategoria'); if(cat){ const atual=cat.value||'todos'; const cats=[...new Set(transacoesCache.filter(t=>t.tipo==='saida').map(t=>t.categoria).filter(Boolean))].sort(); cat.innerHTML='<option value="todos">Todas</option>'+cats.map(c=>`<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join(''); if([...cat.options].some(o=>o.value===atual))cat.value=atual; }
}
function renderizarContasMes(){
  const tbody=document.getElementById('tabelaContasMes'); if(!tbody)return; prepararContasMes();
  const mes=document.getElementById('contasMes').value, filtro=document.getElementById('contasStatus').value, categoria=document.getElementById('contasCategoria').value, busca=document.getElementById('contasBusca').value.trim().toLowerCase();
  let itens=transacoesCache.filter(t=>t.tipo==='saida' && (t.vencimento||t.data||'').startsWith(mes));
  const previsto=itens.reduce((a,t)=>a+Number(t.valor||0),0), pago=itens.filter(t=>statusFinanceiro(t)==='pago').reduce((a,t)=>a+Number(t.valor||0),0), vencido=itens.filter(t=>statusFinanceiro(t)==='vencido').reduce((a,t)=>a+Number(t.valor||0),0);
  setTexto('contasPrevisto',moeda(previsto));setTexto('contasPago',moeda(pago));setTexto('contasPendente',moeda(previsto-pago));setTexto('contasVencido',moeda(vencido));
  itens=itens.filter(t=>(filtro==='todos'||statusFinanceiro(t)===filtro)&&(categoria==='todos'||t.categoria===categoria)&&(!busca||(t.descricao||'').toLowerCase().includes(busca))).sort((a,b)=>(a.vencimento||a.data).localeCompare(b.vencimento||b.data));
  tbody.innerHTML=itens.length?itens.map(t=>{ const st=statusFinanceiro(t), label=st==='pago'?'Pago ✅':st==='vencido'?'Vencido ⚠️':'Pendente ⏳'; const parcela=t.recorrencia==='parcelado'?`${t.parcela_atual||'-'}/${t.total_parcelas||'-'}`:(t.recorrencia==='fixo'?'Fixa':'—'); return `<tr><td><span class="status-badge ${st==='pago'?'quitado':st}">${label}</span></td><td>${dataBR(t.vencimento||t.data)}</td><td>${escaparHtml(t.descricao)}</td><td>${escaparHtml(t.categoria)}</td><td>${parcela}</td><td>${moeda(t.valor)}</td><td><div class="actions-cell">${st!=='pago'?`<button class="btn-pay" onclick="marcarComoPago('${t.id}')">✓ Pagar</button>`:`<button class="btn-sm" onclick="alternarStatusQuitado('${t.id}','quitado')">Desfazer</button>`}<button class="btn-icon" onclick="abrirModalEdicao('${t.id}')">✏️</button><button class="btn-icon" onclick="deletarTransacao('${t.id}')">🗑️</button></div></td></tr>`}).join(''):'<tr><td colspan="7" class="muted">Nenhuma conta encontrada para os filtros selecionados.</td></tr>';
}
async function marcarComoPago(id){ const {error}=await sb.from('transacoes').update({status:'quitado'}).eq('id',id); if(error) return alert('Erro ao marcar como pago: '+error.message); carregarTransacoes(); }
function renderizarParcelamentos(){
  const box=document.getElementById('listaParcelamentos'); if(!box)return; const itens=transacoesCache.filter(t=>t.tipo==='saida'&&t.recorrencia==='parcelado');
  const grupos={}; itens.forEach(t=>{ const nome=(t.descricao||'').replace(/\s*\(\d+\/\d+\)\s*$/,'').trim(); const key=`${nome}|${t.categoria}|${t.total_parcelas}`; (grupos[key]??=[]).push(t); });
  const cards=Object.values(grupos).map(g=>{g.sort((a,b)=>(a.parcela_atual||0)-(b.parcela_atual||0)); const total=g.reduce((a,t)=>a+Number(t.valor||0),0), pagos=g.filter(t=>t.status==='quitado'), pago=pagos.reduce((a,t)=>a+Number(t.valor||0),0), restante=total-pago, pct=total?Math.round(pago/total*100):0, prox=g.find(t=>t.status!=='quitado'); const nome=(g[0].descricao||'').replace(/\s*\(\d+\/\d+\)\s*$/,''); return `<div class="debt-card"><div class="debt-head"><div><strong>${escaparHtml(nome)}</strong><div class="muted">${escaparHtml(g[0].categoria||'')}</div></div><strong>${pct}%</strong></div><div class="progress"><span style="width:${pct}%"></span></div><div class="debt-meta"><span>Parcelas pagas: <b>${pagos.length}/${g.length}</b></span><span>Restante: <b>${moeda(restante)}</b></span><span>Total: <b>${moeda(total)}</b></span><span>Próx. vencimento: <b>${prox?dataBR(prox.vencimento||prox.data):'Quitado'}</b></span></div></div>`; });
  box.innerHTML=cards.length?cards.join(''):'<div class="card muted">Nenhum parcelamento cadastrado.</div>';
}
