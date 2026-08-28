// Variable global para armazenar o gráfico
let graficoInstancia = null;

// --- 1. MUDANÇA DE ABAS E CARREGAMENTO DOS COMPONENTES ---
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

// --- 2. SALVAR NOVO REGISTRO (ENTRADA / SAÍDA) ---
async function salvarGasto() {
    const desc = document.getElementById('desc')?.value;
    const categoria = document.getElementById('categoria')?.value;
    const vencimento = document.getElementById('vencimento')?.value;
    const valor = parseFloat(document.getElementById('valorInput')?.value);
    const tipo = document.getElementById('tipoLancamento')?.value || 'saida';

    if (!desc || isNaN(valor) || !vencimento) {
        alert("Por favor, preencha a descrição, o valor e o vencimento corretamente.");
        return;
    }

    const novoObjeto = {
        descricao: desc,
        categoria: categoria,
        vencimento: vencimento,
        valor: valor,
        tipo: tipo
    };

    // Caso utilize Supabase:
    if (typeof supabase !== 'undefined') {
        const { error } = await supabase.from('transacoes').insert([novoObjeto]);
        if (error) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao salvar o registro.");
            return;
        }
    }

    // Limpa os campos após salvar
    document.getElementById('gastoForm')?.reset();
    
    // Atualiza a tela e volta para a visão geral
    if (typeof carregarDados === 'function') await carregarDados();
    mudarAba('Resumo', document.querySelector('.tab-btn-top'));
}

// --- 3. ATUALIZAÇÃO INLINE (CORREÇÃO DO FORMULÁRIO DE EDIÇÃO) ---
async function atualizarRegistroInline(id) {
    const desc = document.getElementById('editDescInline')?.value;
    const categoria = document.getElementById('editCategoriaInline')?.value;
    const valor = parseFloat(document.getElementById('editValorInline')?.value);
    const vencimento = document.getElementById('editVencimentoInline')?.value;
    const tipo = document.getElementById('editTipoInline')?.value;

    if (!id || !desc || isNaN(valor)) {
        alert("Dados inválidos para alteração.");
        return;
    }

    const dadosAtualizados = {
        descricao: desc,
        categoria: categoria,
        valor: valor,
        vencimento: vencimento,
        tipo: tipo
    };

    if (typeof supabase !== 'undefined') {
        const { error } = await supabase.from('transacoes').update(dadosAtualizados).eq('id', id);
        if (error) {
            console.error("Erro na atualização:", error);
            alert("Erro ao atualizar o registro.");
            return;
        }
    }

    fecharEdicaoInline();
    if (typeof carregarDados === 'function') await carregarDados();
}

// --- 4. RENDERIZAÇÃO DA AGENDA / CALENDÁRIO ---
function renderizarAgenda() {
    const container = document.getElementById('calendarioAgenda');
    if (!container) return;

    container.innerHTML = '';
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // Rótulos dos dias da semana
    diasSemana.forEach(dia => {
        const header = document.createElement('div');
        header.className = 'dia-header';
        header.innerText = dia;
        container.appendChild(header);
    });

    // Renderiza a grade básica de dias
    for (let i = 1; i <= 31; i++) {
        const cardDia = document.createElement('div');
        cardDia.className = 'dia-card';
        cardDia.innerHTML = `<span style="font-weight:600;">${i}</span>`;
        container.appendChild(cardDia);
    }
}

// --- 5. RENDERIZAÇÃO DO GRÁFICO (LEGENDAS FIXAS NO RODAPÉ) ---
function renderizarGrafico() {
    const canvas = document.getElementById('graficoCategorias');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (graficoInstancia) {
        graficoInstancia.destroy();
    }

    // Estrutura de dados base do gráfico
    graficoInstancia = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Outros'],
            datasets: [{
                data: [0, 0, 0, 0, 0, 0], // Pode substituir pelas suas variáveis de soma
                backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom', // Garante exibição abaixo em dispositivos móveis
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