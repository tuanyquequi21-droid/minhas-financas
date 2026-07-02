// =========================================================================
// ⚠️ EDITE AS DUAS LINHAS ABAIXO COLOCANDO SUAS CHAVES DO SUPABASE
// =========================================================================
const SUPABASE_URL = "https://iecdvnsvnobpxqnusitw.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q";           
// ======// =========================================================================

// =========================================================================
// SISTEMA DE GESTÃO FINANCEIRA PREMIUM (VERSÃO LOCAL INTEGRADA - REVISADA)
// =========================================================================

let usuarioLogado = null;
let mesSelecionado = "2026-07";
let mesesDisponiveis = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
let gastos = [];
let salarios = {};
let meuGrafico = null;

// LOGIN LOCAL ROBUSTO
function executarLogin() {
    const emailField = document.getElementById('loginEmail');
    let email = "usuario@financas.com";
    if (emailField && emailField.value.trim() !== "") {
        email = emailField.value.trim();
    }
    usuarioLogado = { email: email };
    localStorage.setItem('sessao_usuario', JSON.stringify(usuarioLogado));
    entrarNoPainel();
}

function entrarNoPainel() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    const userTag = document.getElementById('userDisplayTag');
    if (userTag) userTag.innerText = `👤 Logado como: ${usuarioLogado.email}`;
    
    carregarDados();
}

function deslogar() {
    localStorage.removeItem('sessao_usuario');
    usuarioLogado = null;
    window.location.reload();
}

function carregarDados() {
    gastos = JSON.parse(localStorage.getItem('cloud_gastos')) || [];
    salarios = JSON.parse(localStorage.getItem('cloud_salarios')) || {};
    atualizarInterface();
}

// CONTROLES VISUAIS DOS CAMPOS DO FORMULÁRIO
function alternarCamposTipo() {
    const tipoSelect = document.getElementById('tipoContaSelect');
    if (!tipoSelect) return;
    
    const tipo = tipoSelect.value;
    const camposParcelas = document.getElementById('camposParcelas');
    const campoValorNormal = document.getElementById('campoValorNormal');
    const valorInput = document.getElementById('valorInput');

    if (tipo === 'parcelado') {
        if (camposParcelas) camposParcelas.style.display = 'grid';
        if (campoValorNormal) campoValorNormal.style.display = 'none';
        if (valorInput) valorInput.removeAttribute('required');
    } else {
        if (camposParcelas) camposParcelas.style.display = 'none';
        if (campoValorNormal) campoValorNormal.style.display = 'block';
        if (valorInput) valorInput.setAttribute('required', 'true');
    }
    calcularTotalParcelas();
}

function calcularTotalParcelas() {
    const qtdInput = document.getElementById('qtdParcelasInput');
    const valorParcInput = document.getElementById('valorParcelaInput');
    const texto = document.getElementById('textoValorTotal');
    
    const qtd = qtdInput ? (parseInt(qtdInput.value) || 0) : 0;
    const valorParc = valorParcInput ? (parseFloat(valorParcInput.value) || 0) : 0;
    const total = qtd * valorParc;
    
    if (texto) texto.innerText = `R$ ${total.toFixed(2)}`;
}

// SALVAR GASTO
function salvarGasto(e) {
    if (e) e.preventDefault();
    
    const descField = document.getElementById('desc');
    const catField = document.getElementById('categoria');
    const vencField = document.getElementById('vencimento');
    const familiarCheck = document.getElementById('gastoFamiliarCheck');
    const tipoSelect = document.getElementById('tipoContaSelect');

    if (!descField || !vencField) return;

    const desc = descField.value;
    const categoria = catField ? catField.value : 'Outros';
    const vencimentoOriginal = vencField.value;
    const ehFamiliar = familiarCheck ? familiarCheck.checked : false;
    const tipoConta = tipoSelect ? tipoSelect.value : 'normal';

    if (!vencimentoOriginal) {
        alert("Por favor, selecione uma data de vencimento.");
        return;
    }

    const dataBase = new Date(vencimentoOriginal + "T00:00:00");
    const idGrupo = Date.now().toString();

    if (tipoConta === "parcelado") {
        const qtdInput = document.getElementById('qtdParcelasInput');
        const valorParcInput = document.getElementById('valorParcelaInput');
        
        const qtdParcelas = qtdInput ? (parseInt(qtdInput.value) || 2) : 2;
        const valorParcela = valorParcInput ? (parseFloat(valorParcInput.value) || 0) : 0;
        const valorTotalCalculado = qtdParcelas * valorParcela;

        for (let i = 0; i < qtdParcelas; i++) {
            const dataParcela = new Date(dataBase);
            dataParcela.setMonth(dataBase.getMonth() + i);
            
            const ano = dataParcela.getFullYear();
            const mes = String(dataParcela.getMonth() + 1).padStart(2, '0');
            const dia = String(dataParcela.getDate()).padStart(2, '0');

            gastos.push({
                id: `${idGrupo}_${i}`,
                idGrupo: idGrupo,
                usuarioDono: usuarioLogado.email,
                desc: `${desc} (${i + 1}/${qtdParcelas}) [Total: R$${valorTotalCalculado.toFixed(2)}]`,
                categoria,
                valor: valorParcela,
                vencimento: `${ano}-${mes}-${dia}`,
                ehFamiliar,
                pago: false,
                tipo: 'parcelado'
            });
        }
    } else if (tipoConta === "recorrente") {
        const valorInput = document.getElementById('valorInput');
        const valorTotal = valorInput ? (parseFloat(valorInput.value) || 0) : 0;
        
        for (let i = 0; i < 12; i++) {
            const dataFixa = new Date(dataBase);
            dataFixa.setMonth(dataBase.getMonth() + i);
            
            const ano = dataFixa.getFullYear();
            const mes = String(dataFixa.getMonth() + 1).padStart(2, '0');
            const dia = String(dataFixa.getDate()).padStart(2, '0');

            gastos.push({
                id: `${idGrupo}_f${i}`,
                idGrupo: idGrupo,
                usuarioDono: usuarioLogado.email,
                desc: `${desc} 🔄`,
                categoria,
                valor: valorTotal,
                vencimento: `${ano}-${mes}-${dia}`,
                ehFamiliar,
                pago: false,
                tipo: 'recorrente'
            });
        }
    } else {
        const valorInput = document.getElementById('valorInput');
        const valorTotal = valorInput ? (parseFloat(valorInput.value) || 0) : 0;
        
        gastos.push({
            id: idGrupo,
            idGrupo: idGrupo,
            usuarioDono: usuarioLogado.email,
            desc, categoria, valor: valorTotal, vencimento: vencimentoOriginal, ehFamiliar, pago: false, tipo: 'normal'
        });
    }

    localStorage.setItem('cloud_gastos', JSON.stringify(gastos));
    
    const form = document.getElementById('gastoForm');
    if (form) form.reset();
    
    if (vencField) vencField.value = new Date().toISOString().split('T')[0];
    if (tipoSelect) tipoSelect.value = 'normal';
    
    alternarCamposTipo();
    atualizarInterface();
}

function deletarGasto(id, idGrupo, tipo) {
    if (tipo === 'parcelado' || tipo === 'recorrente') {
        const conf = confirm("Deseja apagar TODAS as recorrências/parcelas desta série?");
        if (conf) gastos = gastos.filter(g => g.idGrupo !== idGrupo);
        else gastos = gastos.filter(g => g.id !== id);
    } else {
        gastos = gastos.filter(g => g.id !== id);
    }
    localStorage.setItem('cloud_gastos', JSON.stringify(gastos));
    atualizarInterface();
}

function alternarStatusPago(id) {
    gastos = gastos.map(g => { if(g.id === id) g.pago = !g.pago; return g; });
    localStorage.setItem('cloud_gastos', JSON.stringify(gastos));
    atualizarInterface();
}

function criarNovoMes() {
    const m = prompt("Digite o mês (AAAA-MM):");
    if(m && !mesesDisponiveis.includes(m)) { 
        mesesDisponiveis.push(m); 
        mesesDisponiveis.sort(); 
        mesSelecionado = m; 
        atualizarInterface(); 
    }
}

function exportarDados() {
    const backup = { gastos, salarios, mesesDisponiveis };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `backup_financeiro_${mesSelecionado}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importarDados(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importado = JSON.parse(e.target.result);
            if (importado.gastos) gastos = importado.gastos;
            if (importado.salarios) salarios = importado.salarios;
            if (importado.mesesDisponiveis) mesesDisponiveis = importado.mesesDisponiveis;
            
            localStorage.setItem('cloud_gastos', JSON.stringify(gastos));
            localStorage.setItem('cloud_salarios', JSON.stringify(salarios));
            alert("🎯 Sincronização realizada! Dados atualizados com sucesso.");
            atualizarInterface();
        } catch (err) {
            alert("Arquivo de sincronização inválido.");
        }
    };
    reader.readAsText(file);
}

// INTERFACE, DASHBOARD E CÁLCULOS ROBUSTOS (CORRIGIDO)
function atualizarInterface() {
    const tabsContainer = document.getElementById('tabsMeses');
    if(!tabsContainer) return;
    tabsContainer.innerHTML = '';
    
    mesesDisponiveis.forEach(m => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${m === mesSelecionado ? 'active' : ''}`;
        btn.innerText = m; 
        btn.onclick = () => { mesSelecionado = m; atualizarInterface(); };
        tabsContainer.appendChild(btn);
    });

    const salKey = `${usuarioLogado?.email}_${mesSelecionado}`;
    const salInput = document.getElementById('salarioInput');
    
    if(salInput) {
        salInput.value = salarios[salKey] || '';
        salInput.onchange = (e) => {
            salarios[salKey] = parseFloat(e.target.value) || 0;
            localStorage.setItem('cloud_salarios', JSON.stringify(salarios));
            atualizarInterface();
        };
    }

    const meuSalarioAtual = salarios[salKey] || 0;
    let totalFamiliarDoMes = 0; 
    let meusGastosAPagar = 0; 
    let resumoGrafico = {};
    const tbody = document.getElementById('tabelaCorpo'); 
    if(tbody) tbody.innerHTML = '';

    gastos.forEach(g => {
        if(g.vencimento && g.vencimento.startsWith(mesSelecionado)) {
            const visivel = (g.usuarioDono === usuarioLogado.email) || g.ehFamiliar;
            if(visivel) {
                if(g.ehFamiliar) {
                    totalFamiliarDoMes += g.valor;
                } else if(!g.pago) {
                    meusGastosAPagar += g.valor;
                }
                
                resumoGrafico[g.categoria] = (resumoGrafico[g.categoria] || 0) + g.valor;

                if (tbody) {
                    const tr = document.createElement('tr');
                    if(g.pago) tr.className = "linha-paga";
                    
                    let etiquetaTipo = '👤 Individual';
                    if(g.ehFamiliar) etiquetaTipo = '💜 Conjunta';
                    if(g.tipo === 'parcelado') etiquetaTipo += ' 📦';
                    
                    tr.innerHTML = `
                        <td><strong>${g.desc}</strong></td>
                        <td>${g.categoria}</td>
                        <td><small>${g.usuarioDono ? g.usuarioDono.split('@')[0] : 'user'}</small></td>
                        <td>${g.vencimento}</td>
                        <td>R$ ${g.valor.toFixed(2)}</td>
                        <td>${etiquetaTipo}</td>
                        <td>
                            <button class="tab-btn" style="padding:4px 8px; font-size:0.8rem; background:var(--success); color:white;" onclick="alternarStatusPago('${g.id}')">Pago</button>
                            <button class="tab-btn" style="padding:4px 8px; font-size:0.8rem; background:var(--danger); color:white;" onclick="deletarGasto('${g.id}', '${g.idGrupo}', '${g.tipo}')">X</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                }
            }
        }
    });

    // CORREÇÃO DOS IDS DO DASHBOARD: Atualiza textos usando innerText com segurança
    const elemFamiliar = document.getElementById('dashFamiliar');
    const elemAPagar = document.getElementById('dashAPagar');
    const elemSaldo = document.getElementById('dashSaldo');

    if (elemFamiliar) elemFamiliar.innerText = `R$ ${totalFamiliarDoMes.toFixed(2)}`;
    if (elemAPagar) elemAPagar.innerText = `R$ ${meusGastosAPagar.toFixed(2)}`;
    
    const saldoFinal = meuSalarioAtual - (meusGastosAPagar + totalFamiliarDoMes);
    if (elemSaldo) elemSaldo.innerText = `R$ ${saldoFinal.toFixed(2)}`;
    
    renderizarGrafico(resumoGrafico);
}

function renderizarGrafico(dados) {
    const canvas = document.getElementById('graficoCategorias');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (meuGrafico) meuGrafico.destroy();
    
    const keys = Object.keys(dados);
    const values = Object.values(dados);
    
    if(keys.length === 0) { 
        keys.push("Nenhum Gasto"); 
        values.push(0); 
    }

    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: { 
            labels: keys, 
            datasets: [{ 
                data: values, 
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899'] 
            }] 
        },
        options: { 
            plugins: { 
                legend: { labels: { color: '#f8fafc' } } 
            } 
        }
    });
}

// INICIALIZADOR COMPLETO DE SEGURANÇA
window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('gastoForm');
    if (form) {
        form.addEventListener('submit', salvarGasto);
    }
    
    const tipoSelect = document.getElementById('tipoContaSelect');
    if(tipoSelect) tipoSelect.addEventListener('change', alternarCamposTipo);
    
    const qtdInput = document.getElementById('qtdParcelasInput');
    const valorParcInput = document.getElementById('valorParcelaInput');
    if(qtdInput) qtdInput.addEventListener('input', calcularTotalParcelas);
    if(valorParcInput) valorParcInput.addEventListener('input', calcularTotalParcelas);

    const vencField = document.getElementById('vencimento');
    if(vencField) vencField.value = new Date().toISOString().split('T')[0];

    const sessaoSalva = localStorage.getItem('sessao_usuario');
    if (sessaoSalva) {
        usuarioLogado = JSON.parse(sessaoSalva);
        entrarNoPainel();
    }
});