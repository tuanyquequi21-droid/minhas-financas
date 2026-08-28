// --- 1. CONFIGURAÇÃO E CONEXÃO COM O SUPABASE ---
// Insira a URL e a Key pública do seu projeto Supabase abaixo se ainda não estiverem configuradas globalmente:
const SUPABASE_URL = 'https://iecdvnsvnobpxqnusitw.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q';

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL !== 'SUA_SUPABASE_URL_AQUI') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

let listaRegistros = [];
let graficoInstancia = null;

// --- 2. BUSCAR DADOS DO BANCO DE DADOS (SUPABASE) ---
async function carregarDadosDoBanco() {
    // Se o cliente Supabase estiver inicializado globalmente ou via script
    const client = supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
    
    if (!client) {
        console.warn("Cliente Supabase não encontrado. Verifique as chaves ou o script do Supabase no HTML.");
        return;
    }

    try {
        // Busca todos os registros da tabela 'transacoes' (ou o nome da sua tabela)
        const { data, error } = await client
            .from('transacoes')
            .select('*')
            .order('vencimento', { ascending: true });

        if (error) {
            console.error("Erro ao buscar dados do Supabase:", error);
            return;
        }

        if (data) {
            listaRegistros = data;
            renderizarTabela();
        }
    } catch (err) {
        console.error("Falha na comunicação com o banco de dados:", err);
    }
}

// --- 3. NAVEGAÇÃO ENTRE ABAS ---
function mudarAba(nomeAba, botaoClicado) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn-top').forEach(el => el.classList.remove('active'));
    
    const abaAlvo = document.getElementById('aba' + nomeAba);
    if (abaAlvo) abaAlvo.classList.add('active');
    if (botaoClicado) botaoClicado.classList.add('active');

    if (nomeAba === 'Grafico') {
        renderizarGrafico();
    } else if (nomeAba === 'Agenda') {
        renderizarAgenda();
    }
}

// --- 4. CONTROLE E TIPO DE LANÇAMENTO ---
function selecionarTipoForm(tipo) {
    document.getElementById('tipoLancamento').value = tipo;
    document.getElementById('btnTipoSaida').className = tipo === 'saida' ? 'type-btn active-saida' : 'type-btn';
    document.getElementById('btnTipoEntrada').className = tipo === 'entrada' ? 'type-btn active-entrada' : 'type-btn';
}

function abrirEdicaoInline(id, desc, categoria, valor, vencimento, tipo) {
    document.getElementById('editIdInline').value = id;
    document.getElementById('editDescInline').value = desc;
    document.getElementById('editCategoriaInline').value = categoria;
    document.getElementById('editValorInline').value = valor;
    document.getElementById('editVencimentoInline').value = vencimento;
    setEditType(tipo || 'saida');

    const painel = document.getElementById('painelEdicaoInline');
    painel.style.display = 'block';
    painel.scrollIntoView({ behavior: 'smooth' });
}

function setEditType(tipo) {
    document.getElementById('editTipoInline').value = tipo;
    document.getElementById('btnEditSaida').className = tipo === 'saida' ? 'type-btn active-saida' : 'type-btn';
    document.getElementById('btnEditEntrada').className = tipo === 'entrada' ? 'type-btn active-entrada' : 'type-btn';
}

function fecharEdicaoInline() {
    document.getElementById('painelEdicaoInline').style.display = 'none';
}

// --- 5. INSERIR NOVO REGISTRO NO BANCO ---
async function salvarGasto() {
    const desc = document.getElementById('desc')?.value;
    const categoria = document.getElementById('categoria')?.value;
    const vencimento = document.getElementById('vencimento')?.value;
    const valor = parseFloat(document.getElementById('valorInput')?.value);
    const tipo = document.getElementById('tipoLancamento')?.value || 'saida';

    if (!desc || isNaN(valor) || !vencimento) {
        alert("Por favor, preencha a descrição, o valor e o vencimento.");
        return;
    }

    const novoObjeto = {
        descricao: desc,
        categoria: categoria,
        vencimento: vencimento,
        valor: valor,
        tipo: tipo
    };

    const client = supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
    if (client) {
        const { error } = await client.from('transacoes').insert([novoObjeto]);
        if (error) {
            alert("Erro ao salvar no banco de dados: " + error.message);
            return;
        }
    }

    document.getElementById('gastoForm')?.reset();
    selecionarTipoForm('saida');
    
    // Recarrega do banco e volta para a aba principal
    await carregarDadosDoBanco();
    mudarAba('Resumo', document.querySelector('.tab-btn-top'));
}

// --- 6. ATUALIZAR REGISTRO NO BANCO ---
async function salvarEdicaoInline() {
    const id = document.getElementById('editIdInline').value;
    const desc = document.getElementById('editDescInline').value;
    const categoria = document.getElementById('editCategoriaInline').value;
    const valor = parseFloat(document.getElementById('editValorInline').value);
    const vencimento = document.getElementById('editVencimentoInline').value;
    const tipo = document.getElementById('editTipoInline').value;

    const dadosAtualizados = {
        descricao: desc,
        categoria: categoria,
        valor: valor,
        vencimento: vencimento,
        tipo: tipo
    };

    const client = supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
    if (client) {
        const { error } = await client.from('transacoes').update(dadosAtualizados).eq('id', id);
        if (error) {
            alert("Erro ao atualizar no banco de dados: " + error.message);
            return;
        }
    }

    fecharEdicaoInline();
    await carregarDadosDoBanco();
}

// --- 7. EXCLUIR REGISTRO NO BANCO ---
async function excluirRegistro(id) {
    if (!confirm("Tem certeza de que deseja remover este lançamento?")) return;

    const client = supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
    if (client) {
        const { error } = await client.from('transacoes').delete().eq('id', id);
        if (error) {
            alert("Erro ao excluir do banco de dados: " + error.message);
            return;
        }
    }

    await carregarDadosDoBanco();
}

// --- 8. RENDERIZAÇÃO DA TABELA ---
function renderizarTabela() {
    const tbody = document.getElementById('tabelaCorpo');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    let totalEntradas = 0;
    let totalSaidas = 0;

    listaRegistros.forEach(item => {
        if (item.tipo === 'entrada') totalEntradas += Number(item.valor);
        else totalSaidas += Number(item.valor);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Tipo">
                <span style="font-weight:700; color:${item.tipo === 'entrada' ? 'var(--success)' : 'var(--danger)'}">
                    ${item.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Saída'}
                </span>
            </td>
            <td data-label="Descrição">${item.descricao}</td>
            <td data-label="Categoria">${item.categoria}</td>
            <td data-label="Vencimento">${item.vencimento}</td>
            <td data-label="Valor">R$ ${Number(item.valor).toFixed(2)}</td>
            <td data-label="Ações">
                <button class="btn-acao" onclick="abrirEdicaoInline('${item.id}', '${item.descricao}', '${item.categoria}', ${item.valor}, '${item.vencimento}', '${item.tipo}')">✏️ Editar</button>
                <button class="btn-acao" style="color:var(--danger);" onclick="excluirRegistro('${item.id}')">🗑️ Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('dashEntradas').innerText = `R$ ${totalEntradas.toFixed(2)}`;
    document.getElementById('dashSaidas').innerText = `R$ ${totalSaidas.toFixed(2)}`;
    document.getElementById('dashSaldo').innerText = `R$ ${(totalEntradas - totalSaidas).toFixed(2)}`;
}

// --- 9. RENDERIZAÇÃO DA AGENDA ---
function renderizarAgenda() {
    const container = document.getElementById('calendarioAgenda');
    if (!container) return;

    container.innerHTML = '';
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    diasSemana.forEach(dia => {
        const div = document.createElement('div');
        div.className = 'dia-header';
        div.innerText = dia;
        container.appendChild(div);
    });

    const dataAtual = new Date();
    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();

    for (let p = 0; p < primeiroDiaSemana; p++) {
        const vazio = document.createElement('div');
        vazio.style.visibility = 'hidden';
        container.appendChild(vazio);
    }

    for (let i = 1; i <= totalDiasMes; i++) {
        const cardDia = document.createElement('div');
        cardDia.className = 'dia-card';
        
        if (i === dataAtual.getDate()) {
            cardDia.style.borderColor = 'var(--primary)';
            cardDia.style.background = 'rgba(79, 70, 229, 0.15)';
        }

        cardDia.innerHTML = `<span style="font-weight:700;">${i}</span>`;
        container.appendChild(cardDia);
    }
}

// --- 10. RENDERIZAÇÃO DO GRÁFICO ---
function renderizarGrafico() {
    const canvas = document.getElementById('graficoCategorias');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (graficoInstancia) graficoInstancia.destroy();

    const categoriasValores = {};
    listaRegistros.forEach(item => {
        if (item.tipo === 'saida') {
            categoriasValores[item.categoria] = (categoriasValores[item.categoria] || 0) + Number(item.valor);
        }
    });

    const labels = Object.keys(categoriasValores).length > 0 ? Object.keys(categoriasValores) : ['Sem Lançamentos'];
    const data = Object.keys(categoriasValores).length > 0 ? Object.values(categoriasValores) : [1];

    graficoInstancia = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#f8fafc',
                        padding: 12,
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

// --- INICIALIZAÇÃO ---
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    // Busca as informações do seu Banco de Dados assim que entra no app
    await carregarDadosDoBanco();
});

function filtrarTabela() {
    const termo = document.getElementById('campoPesquisa').value.toLowerCase();
    document.querySelectorAll('#tabelaCorpo tr').forEach(linha => {
        const texto = linha.innerText.toLowerCase();
        linha.style.display = texto.includes(termo) ? '' : 'none';
    });
}