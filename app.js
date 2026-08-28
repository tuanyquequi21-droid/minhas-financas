// --- 1. CONFIGURAÇÃO E CONEXÃO COM O SUPABASE ---
// Insira a URL e a Key pública do seu projeto Supabase abaixo se ainda não estiverem configuradas globalmente:
const SUPABASE_URL = 'https://iecdvnsvnobpxqnusitw.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q';


// Inicialização sem conflito de nomes
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioAtual = null;
let transacoesCache = [];
let mesSelecionado = new Date().toISOString().slice(0, 7);
let tipoSelecionado = 'saida';

// 🔄 INICIALIZAÇÃO
window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        usuarioAtual = session.user;
        mostrarSistema();
    }
});

// 🔐 AUTENTICAÇÃO
async function executarLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginSenha').value;

    if (!email || !password) return alert('Preencha o e-mail e a senha.');

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return alert('Erro no login: ' + error.message);

    usuarioAtual = data.user;
    mostrarSistema();
}

async function deslogar() {
    await supabaseClient.auth.signOut();
    location.reload();
}

function mostrarSistema() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userDisplayTag').innerText = `👤 ${usuarioAtual.email}`;
    
    document.getElementById('cadVencimento').value = new Date().toISOString().slice(0, 10);

    gerarSeletorMeses();
    carregarTransacoes();
}

// 🔀 FORMATO DO FORMULÁRIO
function selecionarTipo(tipo) {
    tipoSelecionado = tipo;
    document.getElementById('btnSaida').classList.toggle('active', tipo === 'saida');
    document.getElementById('btnEntrada').classList.toggle('active', tipo === 'entrada');
}

function alternarCampoParcelas() {
    const recorrencia = document.getElementById('cadRecorrencia').value;
    document.getElementById('boxParcelas').style.display = recorrencia === 'parcelado' ? 'block' : 'none';
}

// 📅 CARROSSEL DE MESES
function gerarSeletorMeses() {
    const container = document.getElementById('tabsMeses');
    if (!container) return;
    container.innerHTML = '';

    const hoje = new Date();
    for (let i = -6; i <= 6; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const chaveMes = d.toISOString().slice(0, 7);
        const nomeMes = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');

        const btn = document.createElement('button');
        btn.className = `tab-btn ${chaveMes === mesSelecionado ? 'active' : ''}`;
        btn.innerText = nomeMes.toUpperCase();
        btn.onclick = () => {
            document.querySelectorAll('.tabs-container .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mesSelecionado = chaveMes;
            renderizarDados();
        };
        container.appendChild(btn);
    }
}

// 📦 BUSCAR REGISTROS
async function carregarTransacoes() {
    const { data, error } = await supabaseClient
        .from('transacoes')
        .select('*')
        .order('vencimento', { ascending: true });

    if (error) return alert('Erro ao carregar dados: ' + error.message);

    transacoesCache = data || [];
    renderizarDados();
}

// 💾 SALVAR REGISTRO (ÚNICO, FIXO OU PARCELADO)
async function salvarLancamento(e) {
    e.preventDefault();

    const descricao = document.getElementById('cadDescricao').value;
    const categoria = document.getElementById('cadCategoria').value;
    const vencimentoStr = document.getElementById('cadVencimento').value;
    const valor = parseFloat(document.getElementById('cadValor').value);
    const recorrencia = document.getElementById('cadRecorrencia').value;
    const totalParcelas = parseInt(document.getElementById('cadTotalParcelas').value) || 1;

    const [ano, mes, dia] = vencimentoStr.split('-').map(Number);
    let registrosParaInserir = [];

    if (recorrencia === 'parcelado') {
        for (let i = 0; i < totalParcelas; i++) {
            const dataParcela = new Date(ano, (mes - 1) + i, dia);
            const vencimentoISO = dataParcela.toISOString().split('T')[0];

            registrosParaInserir.push({
                user_id: usuarioAtual.id,
                tipo: tipoSelecionado,
                descricao: `${descricao} (${i + 1}/${totalParcelas})`,
                categoria: categoria,
                valor: valor,
                vencimento: vencimentoISO,
                recorrencia: 'parcelado',
                parcela_atual: i + 1,
                total_parcelas: totalParcelas,
                pago: false
            });
        }
    } else {
        registrosParaInserir.push({
            user_id: usuarioAtual.id,
            tipo: tipoSelecionado,
            descricao: descricao,
            categoria: categoria,
            valor: valor,
            vencimento: vencimentoStr,
            recorrencia: recorrencia,
            pago: false
        });
    }

    const { error } = await supabaseClient.from('transacoes').insert(registrosParaInserir);

    if (error) {
        alert('Erro ao salvar: ' + error.message);
    } else {
        document.getElementById('formCadastro').reset();
        document.getElementById('cadVencimento').value = new Date().toISOString().slice(0, 10);
        alternarCampoParcelas();
        carregarTransacoes();
    }
}

// 📊 RENDERIZAR TABELA E VALORES
function renderizarDados() {
    const tabela = document.getElementById('tabelaCorpo');
    tabela.innerHTML = '';

    const filtrados = transacoesCache.filter(item => item.vencimento.startsWith(mesSelecionado));

    let totalEntradas = 0;
    let totalSaidas = 0;

    filtrados.forEach(item => {
        const valor = parseFloat(item.valor) || 0;
        if (item.tipo === 'entrada') totalEntradas += valor;
        else totalSaidas += valor;

        let badgeRecorrencia = '';
        if (item.recorrencia === 'fixo') {
            badgeRecorrencia = `<span style="background:#3b82f620; color:#60a5fa; padding:2px 6px; border-radius:4px; font-size:0.75rem; margin-left: 5px;">📌 Fixo</span>`;
        } else if (item.recorrencia === 'parcelado') {
            badgeRecorrencia = `<span style="background:#f59e0b20; color:#fbbf24; padding:2px 6px; border-radius:4px; font-size:0.75rem; margin-left: 5px;">💳 Parcelado</span>`;
        }

        const tr = document.createElement('tr');
        tr.style.opacity = item.pago ? '0.4' : '1';

        tr.innerHTML = `
            <td>${item.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Saída'}</td>
            <td>
                <strong style="${item.pago ? 'text-decoration: line-through;' : ''}">${item.descricao}</strong>
                ${badgeRecorrencia}
            </td>
            <td>${item.categoria}</td>
            <td>${item.vencimento.split('-').reverse().join('/')}</td>
            <td style="font-weight:bold; color: ${item.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)'}">
                R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </td>
            <td>
                <button class="btn-acao" onclick="alternarPago('${item.id}', ${!item.pago})">
                    ${item.pago ? '✅ Pago' : '⏳ Pendente'}
                </button>
                <button class="btn-acao" onclick="deletarItem('${item.id}')" style="color:var(--danger); margin-left: 8px;">🗑️</button>
            </td>
        `;
        tabela.appendChild(tr);
    });

    document.getElementById('dashEntradas').innerText = `R$ ${totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('dashSaidas').innerText = `R$ ${totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    
    const saldo = totalEntradas - totalSaidas;
    const elSaldo = document.getElementById('dashSaldo');
    elSaldo.innerText = `R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    elSaldo.style.color = saldo >= 0 ? 'var(--success)' : 'var(--danger)';
}

// 🟢/🔴 ALTERNAR PAGO / PENDENTE
async function alternarPago(id, novoStatus) {
    const { error } = await supabaseClient
        .from('transacoes')
        .update({ pago: novoStatus })
        .eq('id', id);

    if (error) return alert('Erro ao atualizar: ' + error.message);
    
    const item = transacoesCache.find(t => t.id === id);
    if (item) item.pago = novoStatus;
    renderizarDados();
}

// 🗑️ DELETAR REGISTRO
async function deletarItem(id) {
    if (!confirm('Deseja realmente remover este lançamento?')) return;

    const { error } = await supabaseClient
        .from('transacoes')
        .delete()
        .eq('id', id);

    if (error) return alert('Erro ao deletar: ' + error.message);

    transacoesCache = transacoesCache.filter(t => t.id !== id);
    renderizarDados();
}