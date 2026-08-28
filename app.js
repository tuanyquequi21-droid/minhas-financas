// Armazenamento local e instância global do gráfico
let listaRegistros = [];
let graficoInstancia = null;

// --- NAVEGAÇÃO ENTRE ABAS ---
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

// --- SELEÇÃO DE TIPO (ENTRADA OU SAÍDA) ---
function selecionarTipoForm(tipo) {
    document.getElementById('tipoLancamento').value = tipo;
    document.getElementById('btnTipoSaida').className = tipo === 'saida' ? 'type-btn active-saida' : 'type-btn';
    document.getElementById('btnTipoEntrada').className = tipo === 'entrada' ? 'type-btn active-entrada' : 'type-btn';
}

// --- CONTROLE DA EDIÇÃO INLINE ---
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

// --- SALVAR NOVO REGISTRO ---
async function salvarGasto() {
    const desc = document.getElementById('desc')?.value;
    const categoria = document.getElementById('categoria')?.value;
    const vencimento = document.getElementById('vencimento')?.value;
    const valor = parseFloat(document.getElementById('valorInput')?.value);
    const tipo = document.getElementById('tipoLancamento')?.value || 'saida';

    if (!desc || isNaN(valor) || !vencimento) {
        alert("Por favor, preencha a descrição, o valor e a data de vencimento.");
        return;
    }

    const novoObjeto = {
        id: Date.now().toString(),
        descricao: desc,
        categoria: categoria,
        vencimento: vencimento,
        valor: valor,
        tipo: tipo
    };

    listaRegistros.push(novoObjeto);
    
    // Atualiza tabela e limpa o formulário
    document.getElementById('gastoForm').reset();
    selecionarTipoForm('saida');
    
    renderizarTabela();
    mudarAba('Resumo', document.querySelector('.tab-btn-top'));
}

// --- SALVAR ALTERAÇÃO INLINE ---
function salvarEdicaoInline() {
    const id = document.getElementById('editIdInline').value;
    const desc = document.getElementById('editDescInline').value;
    const categoria = document.getElementById('editCategoriaInline').value;
    const valor = parseFloat(document.getElementById('editValorInline').value);
    const vencimento = document.getElementById('editVencimentoInline').value;
    const tipo = document.getElementById('editTipoInline').value;

    const index = listaRegistros.findIndex(item => item.id == id);
    if (index !== -1) {
        listaRegistros[index] = { id, descricao: desc, categoria, valor, vencimento, tipo };
    }

    fecharEdicaoInline();
    renderizarTabela();
}

// --- EXCLUSÃO DE REGISTRO ---
function excluirRegistro(id) {
    if (confirm("Tem certeza de que deseja remover este lançamento?")) {
        listaRegistros = listaRegistros.filter(item => item.id != id);
        renderizarTabela();
    }
}

// --- RENDERIZAÇÃO DA TABELA E TOTAIS ---
function renderizarTabela() {
    const tbody = document.getElementById('tabelaCorpo');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    let totalEntradas = 0;
    let totalSaidas = 0;

    listaRegistros.forEach(item => {
        if (item.tipo === 'entrada') totalEntradas += item.valor;
        else totalSaidas += item.valor;

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
            <td data-label="Valor">R$ ${item.valor.toFixed(2)}</td>
            <td data-label="Ações">
                <button class="btn-acao" onclick="abrirEdicaoInline('${item.id}', '${item.descricao}', '${item.categoria}', ${item.valor}, '${item.vencimento}', '${item.tipo}')">✏️ Editar</button>
                <button class="btn-acao" style="color:var(--danger);" onclick="excluirRegistro('${item.id}')">🗑️ Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Atualiza os cards da Dashboard
    document.getElementById('dashEntradas').innerText = `R$ ${totalEntradas.toFixed(2)}`;
    document.getElementById('dashSaidas').innerText = `R$ ${totalSaidas.toFixed(2)}`;
    document.getElementById('dashSaldo').innerText = `R$ ${(totalEntradas - totalSaidas).toFixed(2)}`;
}

// --- CALENDÁRIO / AGENDA COMPLETO ---
function renderizarAgenda() {
    const container = document.getElementById('calendarioAgenda');
    if (!container) return;

    container.innerHTML = '';
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // Cabeçalho dos dias
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

    // Espaços vazios do início
    for (let p = 0; p < primeiroDiaSemana; p++) {
        const vazio = document.createElement('div');
        vazio.style.visibility = 'hidden';
        container.appendChild(vazio);
    }

    // Preenchimento dos dias
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

// --- GRÁFICO COM LEGENDAS FIXAS NO RODAPÉ ---
function renderizarGrafico() {
    const canvas = document.getElementById('graficoCategorias');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (graficoInstancia) graficoInstancia.destroy();

    // Consolida valores por categoria
    const categoriasValores = {};
    listaRegistros.forEach(item => {
        if (item.tipo === 'saida') {
            categoriasValores[item.categoria] = (categoriasValores[item.categoria] || 0) + item.valor;
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
                    position: 'bottom', // Legenda na parte inferior no Mobile
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

// --- INICIALIZAÇÃO DA INTERFACE ---
window.addEventListener('DOMContentLoaded', () => {
    // Exibe a tela após o carregamento
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    renderizarTabela();
});

function filtrarTabela() {
    const termo = document.getElementById('campoPesquisa').value.toLowerCase();
    document.querySelectorAll('#tabelaCorpo tr').forEach(linha => {
        const texto = linha.innerText.toLowerCase();
        linha.style.display = texto.includes(termo) ? '' : 'none';
    });
}