// --- 1. CONFIGURAÇÃO E CONEXÃO COM O SUPABASE ---
// Insira a URL e a Key pública do seu projeto Supabase abaixo se ainda não estiverem configuradas globalmente:
const SUPABASE_URL = 'https://iecdvnsvnobpxqnusitw.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioAtual = null;
let transacoesCache = [];
let perfisCache = [];
let meuchart = null;
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

    if (!email || !password) return alert('Preencha e-mail e senha.');

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return alert('Erro no login: ' + error.message);

    usuarioAtual = data.user;
    mostrarSistema();
}

async function deslogar() {
    await supabaseClient.auth.signOut();
    location.reload();
}

async function mostrarSistema() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userDisplayTag').innerText = `👤 ${usuarioAtual.email}`;
    
    document.getElementById('cadVencimento').value = new Date().toISOString().slice(0, 10);

    await carregarPerfis();
    gerarSeletorMeses();
    carregarTransacoes();
}

// 👥 BUSCAR DEMAIS USUÁRIOS PARA CONTA EM CONJUNTO
async function carregarPerfis() {
    const { data } = await supabaseClient.from('perfis').select('*');
    perfisCache = data || [];
    
    const select = document.getElementById('cadUsuarioCompartilhar');
    select.innerHTML = '<option value="">Selecione o usuário...</option>';
    
    perfisCache.filter(p => p.id !== usuarioAtual.id).forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.email}</option>`;
    });
}

// 🔀 CONTROLES DO FORMULÁRIO
function selecionarTipo(tipo) {
    tipoSelecionado = tipo;
    document.getElementById('btnSaida').classList.toggle('active', tipo === 'saida');
    document.getElementById('btnEntrada').classList.toggle('active', tipo === 'entrada');
}

function alternarCampoParcelas() {
    const recorrencia = document.getElementById('cadRecorrencia').value;
    document.getElementById('boxParcelas').style.display = recorrencia === 'parcelado' ? 'block' : 'none';
}

function alternarCampoConjunto() {
    const marcado = document.getElementById('cadEmConjunto').checked;
    document.getElementById('boxCompartilhar').style.display = marcado ? 'block' : 'none';
}

// 📅 NAVEGAÇÃO DE MESES
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

// 📦 CARREGAR REGISTROS
async function carregarTransacoes() {
    const { data, error } = await supabaseClient
        .from('transacoes')
        .select('*')
        .order('vencimento', { ascending: true });

    if (error) return alert('Erro ao carregar dados: ' + error.message);

    transacoesCache = data || [];
    renderizarDados();
}

// 💾 SALVAR OU EDITAR REGISTRO
async function salvarLancamento(e) {
    e.preventDefault();

    const idEdicao = document.getElementById('editId').value;
    const descricao = document.getElementById('cadDescricao').value;
    const categoria = document.getElementById('cadCategoria').value;
    const vencimentoStr = document.getElementById('cadVencimento').value;
    const valor = parseFloat(document.getElementById('cadValor').value);
    const recorrencia = document.getElementById('cadRecorrencia').value;
    const totalParcelas = parseInt(document.getElementById('cadTotalParcelas').value) || 1;
    
    const emConjunto = document.getElementById('cadEmConjunto').checked;
    const compartilhadoCom = emConjunto ? document.getElementById('cadUsuarioCompartilhar').value : null;

    if (idEdicao) {
        // Atualizar registro existente
        const { error } = await supabaseClient.from('transacoes').update({
            tipo: tipoSelecionado,
            descricao,
            categoria,
            vencimento: vencimentoStr,
            valor,
            em_conjunto: emConjunto,
            compartilhado_com: compartilhadoCom
        }).eq('id', idEdicao);

        if (error) return alert('Erro ao atualizar: ' + error.message);
    } else {
        // Inserir Novo
        const [ano, mes, dia] = vencimentoStr.split('-').map(Number);
        let registrosParaInserir = [];

        if (recorrencia === 'parcelado') {
            for (let i = 0; i < totalParcelas; i++) {
                const dataParcela = new Date(ano, (mes - 1) + i, dia);
                registrosParaInserir.push({
                    user_id: usuarioAtual.id,
                    tipo: tipoSelecionado,
                    descricao: `${descricao} (${i + 1}/${totalParcelas})`,
                    categoria,
                    valor,
                    vencimento: dataParcela.toISOString().split('T')[0],
                    recorrencia: 'parcelado',
                    pago: false,
                    em_conjunto: emConjunto,
                    compartilhado_com: compartilhadoCom
                });
            }
        } else {
            registrosParaInserir.push({
                user_id: usuarioAtual.id,
                tipo: tipoSelecionado,
                descricao,
                categoria,
                valor,
                vencimento: vencimentoStr,
                recorrencia,
                pago: false,
                em_conjunto: emConjunto,
                compartilhado_com: compartilhadoCom
            });
        }

        const { error } = await supabaseClient.from('transacoes').insert(registrosParaInserir);
        if (error) return alert('Erro ao salvar: ' + error.message);
    }

    limparFormulario();
    carregarTransacoes();
}

function limparFormulario() {
    document.getElementById('editId').value = '';
    document.getElementById('formCadastro').reset();
    document.getElementById('formTitulo').innerText = 'Cadastrar Movimentação';
    document.getElementById('btnSalvar').innerText = 'Salvar Lançamento';
    document.getElementById('btnCancelarEdit').style.display = 'none';
    document.getElementById('cadVencimento').value = new Date().toISOString().slice(0, 10);
    alternarCampoParcelas();
    alternarCampoConjunto();
}

// ✏️ PREPARAR EDIÇÃO
function editarItem(id) {
    const item = transacoesCache.find(t => t.id === id);
    if (!item) return;

    document.getElementById('editId').value = item.id;
    document.getElementById('cadDescricao').value = item.descricao;
    document.getElementById('cadCategoria').value = item.categoria;
    document.getElementById('cadVencimento').value = item.vencimento;
    document.getElementById('cadValor').value = item.valor;
    
    document.getElementById('cadEmConjunto').checked = item.em_conjunto || false;
    alternarCampoConjunto();
    if (item.em_conjunto) {
        document.getElementById('cadUsuarioCompartilhar').value = item.compartilhado_com || '';
    }

    selecionarTipo(item.tipo);
    document.getElementById('formTitulo').innerText = 'Editar Lançamento';
    document.getElementById('btnSalvar').innerText = 'Atualizar';
    document.getElementById('btnCancelarEdit').style.display = 'inline-block';
}

// 🏁 ANTECIPAR / FINALIZAR DÍVIDA
async function alternarFinalizado(id, statusAtual) {
    const novoStatus = !statusAtual;
    const updateObj = { finalizado: novoStatus };
    
    // Se estiver finalizando/antecipando, também marcamos como pago
    if (novoStatus) updateObj.pago = true;

    const { error } = await supabaseClient.from('transacoes').update(updateObj).eq('id', id);
    if (error) return alert('Erro ao atualizar status: ' + error.message);

    carregarTransacoes();
}

// 🟢/🔴 STATUS PAGO
async function alternarPago(id, novoStatus) {
    const { error } = await supabaseClient.from('transacoes').update({ pago: novoStatus }).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    carregarTransacoes();
}

// 📊 RENDERIZAR TABELA + PESQUISA + GRÁFICO
function renderizarDados() {
    const tabela = document.getElementById('tabelaCorpo');
    tabela.innerHTML = '';
    const termoBusca = (document.getElementById('campoBusca')?.value || '').toLowerCase();

    // Filtra pelo Mês Atual E pelo termo de Busca (Pesquisa)
    const filtrados = transacoesCache.filter(item => {
        const porMes = item.vencimento.startsWith(mesSelecionado);
        const porTexto = item.descricao.toLowerCase().includes(termoBusca) || item.categoria.toLowerCase().includes(termoBusca);
        return porMes && porTexto;
    });

    let totalEntradas = 0;
    let totalSaidas = 0;
    let categoriasSaidas = {};

    filtrados.forEach(item => {
        const valor = parseFloat(item.valor) || 0;
        if (item.tipo === 'entrada') {
            totalEntradas += valor;
        } else {
            totalSaidas += valor;
            categoriasSaidas[item.categoria] = (categoriasSaidas[item.categoria] || 0) + valor;
        }

        // Tags visuais
        let badgeTag = '';
        if (item.em_conjunto) {
            const parceiro = perfisCache.find(p => p.id === (item.user_id === usuarioAtual.id ? item.compartilhado_com : item.user_id));
            const emailParceiro = parceiro ? parceiro.email.split('@')[0] : 'Conjunto';
            badgeTag += `<span style="background:#8b5cf620; color:#a78bfa; padding:2px 6px; border-radius:4px; font-size:0.75rem; margin-left: 5px;">👥 ${emailParceiro}</span>`;
        }
        if (item.finalizado) {
            badgeTag += `<span style="background:#22c55e20; color:#4ade80; padding:2px 6px; border-radius:4px; font-size:0.75rem; margin-left: 5px;">🏁 Antecipado/Finalizado</span>`;
        }

        const tr = document.createElement('tr');
        tr.style.opacity = item.pago || item.finalizado ? '0.5' : '1';

        tr.innerHTML = `
            <td>${item.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Saída'}</td>
            <td>
                <strong style="${item.pago ? 'text-decoration: line-through;' : ''}">${item.descricao}</strong>
                ${badgeTag}
            </td>
            <td>${item.categoria}</td>
            <td>${item.vencimento.split('-').reverse().join('/')}</td>
            <td style="font-weight:bold; color: ${item.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)'}">
                R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </td>
            <td>
                <button class="btn-acao" onclick="alternarPago('${item.id}', ${!item.pago})" title="Marcar como Pago">
                    ${item.pago ? '✅ Pago' : '⏳ Pendente'}
                </button>
                <button class="btn-acao" onclick="alternarFinalizado('${item.id}', ${item.finalizado})" title="Antecipar / Quitar Dívida">
                    🎯
                </button>
                <button class="btn-acao" onclick="editarItem('${item.id}')" title="Editar">✏️</button>
                <button class="btn-acao" onclick="deletarItem('${item.id}')" style="color:var(--danger);" title="Excluir">🗑️</button>
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

    desenharGrafico(categoriasSaidas);
}

// 📈 RENDERIZAR GRÁFICO
function desenharGrafico(dadosCategorias) {
    const ctx = document.getElementById('graficoCategorias');
    if (!ctx) return;

    if (meuchart) meuchart.destroy();

    const labels = Object.keys(dadosCategorias);
    const valores = Object.values(dadosCategorias);

    if (labels.length === 0) {
        labels.push('Sem Saídas');
        valores.push(1);
    }

    meuchart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });
}

// 🗑️ DELETAR REGISTRO
async function deletarItem(id) {
    if (!confirm('Deseja realmente remover este lançamento?')) return;
    const { error } = await supabaseClient.from('transacoes').delete().eq('id', id);
    if (error) return alert('Erro ao deletar: ' + error.message);
    carregarTransacoes();
}