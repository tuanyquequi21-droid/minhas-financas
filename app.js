// --- 1. CONFIGURAÇÃO E CONEXÃO COM O SUPABASE ---
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

// MENU & NAVEGAÇÃO
function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

function navegarPara(paginaId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    if (paginaId === 'dashboard') {
        document.getElementById('pageDashboard').classList.add('active');
        document.querySelectorAll('.nav-item')[0].classList.add('active');
    } else if (paginaId === 'novoLancamento') {
        document.getElementById('pageNovoLancamento').classList.add('active');
        document.querySelectorAll('.nav-item')[1].classList.add('active');
    } else if (paginaId === 'historico') {
        document.getElementById('pageHistorico').classList.add('active');
        document.querySelectorAll('.nav-item')[2].classList.add('active');
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
    if (user) {
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
    
    const targetUsername = document.getElementById('userInputTarget').value.trim().toLowerCase();
    let targetUserId = usuarioLogado.id;

    if (targetUsername && targetUsername !== usernameAtual) {
        const { data: profileTarget, error: perfError } = await sb
            .from('profiles')
            .select('id')
            .eq('username', targetUsername)
            .single();

        if (perfError || !profileTarget) {
            return alert(`O usuário "@${targetUsername}" não foi encontrado.`);
        }
        targetUserId = profileTarget.id;
    }

    const descBase = document.getElementById('desc').value;
    const valorTotal = parseFloat(document.getElementById('valor').value);
    const dataInicialStr = document.getElementById('data').value;
    const categoria = document.getElementById('categoria').value;
    const tipoRecorrencia = document.getElementById('recorrencia').value;
    const numParcelas = tipoRecorrencia === 'parcelado' ? parseInt(document.getElementById('totalParcelas').value) : 1;

    const listaParaInserir = [];
    const [ano, mes, dia] = dataInicialStr.split('-').map(Number);

    for (let i = 0; i < numParcelas; i++) {
        const dataParcela = new Date(ano, (mes - 1) + i, dia);
        const dataFormatada = dataParcela.toISOString().split('T')[0];

        let descFinal = descBase;
        let valorFinal = valorTotal;

        if (tipoRecorrencia === 'parcelado') {
            descFinal = `${descBase} (${i + 1}/${numParcelas})`;
            valorFinal = valorTotal / numParcelas;
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
            parcela_atual: i + 1,
            total_parcelas: numParcelas,
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

async function carregarTransacoes() {
    const { data, error } = await sb
        .from('transacoes')
        .select('*')
        .order('data', { ascending: false });

    if (!error) {
        transacoesCache = data;
        popularFiltroMeses();
        renderizarDados();
    }
}

// ORGANIZAÇÃO POR MÊS NO EXTRATO
function popularFiltroMeses() {
    const select = document.getElementById('filtroMes');
    const valorAtual = select.value;
    select.innerHTML = '<option value="todos">Todos os Meses</option>';

    const mesesMap = new Set();
    transacoesCache.forEach(t => {
        if (t.data) {
            const mesAno = t.data.substring(0, 7); // Obtém YYYY-MM
            mesesMap.add(mesAno);
        }
    });

    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    Array.from(mesesMap).sort().reverse().forEach(mesAno => {
        const [ano, mes] = mesAno.split('-');
        const nomeFormatado = `${nomesMeses[parseInt(mes) - 1]} / ${ano}`;
        select.innerHTML += `<option value="${mesAno}">${nomeFormatado}</option>`;
    });

    if (valorAtual) select.value = valorAtual;
}

// AÇÕES: EXCLUIR, QUITAR E EDITAR
async function deletarTransacao(id) {
    if (confirm("Tem certeza que deseja excluir esta transação?")) {
        const { error } = await sb.from('transacoes').delete().eq('id', id);
        if (error) {
            alert("Erro ao excluir: " + error.message);
        } else {
            carregarTransacoes();
        }
    }
}

async function alternarStatusQuitado(id, statusAtual) {
    const novoStatus = statusAtual === 'quitado' ? 'pendente' : 'quitado';
    const { error } = await sb.from('transacoes').update({ status: novoStatus }).eq('id', id);
    if (!error) {
        carregarTransacoes();
    }
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

    document.getElementById('modalEdicao').style.display = 'flex';
}

function fecharModalEdicao() {
    document.getElementById('modalEdicao').style.display = 'none';
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

    if (error) {
        alert("Erro ao atualizar: " + error.message);
    } else {
        fecharModalEdicao();
        carregarTransacoes();
    }
}

// RENDERIZAÇÃO
function renderizarDados() {
    let totEntradas = 0, totSaidas = 0;
    const catMap = {};
    const tbody = document.getElementById('tabelaRegistros');
    tbody.innerHTML = '';

    const mesSelecionado = document.getElementById('filtroMes').value;

    const registrosFiltrados = transacoesCache.filter(t => {
        if (!mesSelecionado || mesSelecionado === 'todos') return true;
        return t.data && t.data.startsWith(mesSelecionado);
    });

    registrosFiltrados.forEach(t => {
        if (t.tipo === 'entrada') totEntradas += t.valor;
        else {
            totSaidas += t.valor;
            catMap[t.categoria] = (catMap[t.categoria] || 0) + t.valor;
        }

        let badgeTipo = '';
        if (t.recorrencia === 'fixo') badgeTipo = ' <small style="color:var(--text-secondary);">(Fixo)</small>';

        const isQuitado = t.status === 'quitado';
        const badgeStatusClass = isQuitado ? 'quitado' : 'pendente';
        const textoStatus = isQuitado ? 'Quitado ✅' : 'Pendente ⏳';

        tbody.innerHTML += `
            <tr>
                <td>
                    <span class="status-badge ${badgeStatusClass}" onclick="alternarStatusQuitado('${t.id}', '${t.status}')">
                        ${textoStatus}
                    </span>
                </td>
                <td>${t.data.split('-').reverse().join('/')}</td>
                <td>${t.descricao} ${badgeTipo}</td>
                <td>${t.categoria}</td>
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
    });

    document.getElementById('totalEntradas').innerText = `R$ ${totEntradas.toFixed(2)}`;
    document.getElementById('totalSaidas').innerText = `R$ ${totSaidas.toFixed(2)}`;
    document.getElementById('saldoTotal').innerText = `R$ ${(totEntradas - totSaidas).toFixed(2)}`;

    desenharGrafico(catMap);
    renderizarCalendario();
}

// CALENDÁRIO EXIBINDO NOMES E VALORES DAS CONTAS NO DIA
function mudarMesCalendario(delta) {
    dataCalendarioAtual.setMonth(dataCalendarioAtual.getMonth() + delta);
    renderizarCalendario();
}

function renderizarCalendario() {
    const grid = document.getElementById('calendarDays');
    grid.innerHTML = '';

    const ano = dataCalendarioAtual.getFullYear();
    const mes = dataCalendarioAtual.getMonth();

    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById('calTituloMes').innerText = `${nomesMeses[mes]} ${ano}`;

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();

    for (let i = 0; i < primeiroDiaSemana; i++) {
        grid.innerHTML += `<div class="cal-day empty"></div>`;
    }

    for (let dia = 1; dia <= totalDiasMes; dia++) {
        const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const itensDia = transacoesCache.filter(t => (t.vencimento || t.data) === dataStr);

        let eventosHtml = '';
        itensDia.forEach(item => {
            const classeTipo = item.tipo === 'entrada' ? 'entrada' : 'saida';
            eventosHtml += `
                <div class="cal-event-item ${classeTipo}" title="${item.descricao} - R$ ${item.valor.toFixed(2)}">
                    ${item.descricao} (R$${item.valor.toFixed(0)})
                </div>
            `;
        });

        grid.innerHTML += `
            <div class="cal-day">
                <span class="cal-day-num">${dia}</span>
                <div class="cal-events">${eventosHtml}</div>
            </div>
        `;
    }
}

// GRÁFICO E TEMA
function desenharGrafico(dadosCategorias) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
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
        document.getElementById('btnTema').innerText = '☀️ Claro';
    }
}

function alternarTema() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('tema_pref', isLight ? 'light' : 'dark');
    document.getElementById('btnTema').innerText = isLight ? '☀️ Claro' : '🌙 Escuro';
    if (transacoesCache.length > 0) renderizarDados();
}

aplicarTemaSalvo();
verificarSessao();