// =========================================================================
// ⚠️ EDITE AS DUAS LINHAS ABAIXO COLOCANDO SUAS CHAVES DO SUPABASE
// =========================================================================
const SUPABASE_URL = "https://iecdvnsvnobpxqnusitw.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q";           
// =========================================================================

const bancoSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioLogado = null;
let mesSelecionado = "2026-07";
let mesesDisponiveis = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
let gastos = [];
let salarios = {};
let meuGrafico = null;

async function executarLogin() {
    const emailField = document.getElementById('loginEmail');
    const senhaField = document.getElementById('loginSenha');

    if (!emailField || !senhaField || !emailField.value) {
        alert("Por favor, digite seu e-mail e sua senha.");
        return;
    }

    const email = emailField.value.trim();
    const senha = senhaField.value;

    try {
        const { data, error } = await bancoSupabase.auth.signInWithPassword({ email: email, password: senha });
        if (error) {
            alert("❌ Supabase recusou o login: " + error.message);
        } else {
            usuarioLogado = data.user;
            entrarNoPainel();
        }
    } catch (err) {
        console.warn("Rede instável ou bloqueada. Entrando em Modo Local.");
        usuarioLogado = { email: email };
        entrarNoPainel();
    }
}

function entrarNoPainel() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userDisplayTag').innerText = `👤 Logado como: ${usuarioLogado.email}`;
    carregarDados();
}

function deslogar() {
    try { bancoSupabase.auth.signOut(); } catch(e){}
    usuarioLogado = null;
    window.location.reload();
}

function carregarDados() {
    gastos = JSON.parse(localStorage.getItem('cloud_gastos')) || [];
    salarios = JSON.parse(localStorage.getItem('cloud_salarios')) || {};
    atualizarInterface();
}

// 🚀 REQUISITOS ADICIONADOS: GERENCIADOR DE RECORRÊNCIA E PARCELAS
function salvarGasto(e) {
    e.preventDefault();
    const desc = document.getElementById('desc').value;
    const categoria = document.getElementById('categoria').value;
    const valorTotal = parseFloat(document.getElementById('valorInput').value);
    const vencimentoOriginal = document.getElementById('vencimento').value;
    const ehFamiliar = document.getElementById('gastoFamiliarCheck').checked;

    // Pergunta se é Fixa, Parcelada ou Normal
    const tipoConta = prompt("Digite o tipo da conta:\n1 - Normal (Só este mês)\n2 - Fixa / Recorrente (Todo mês)\n3 - Parcelada", "1");
    
    const dataBase = new Date(vencimentoOriginal + "T00:00:00");
    const idGrupo = Date.now().toString(); // Vincula as parcelas do mesmo grupo

    if (tipoConta === "3") {
        // CONTA PARCELADA
        const qtdParcelas = parseInt(prompt("Em quantas vezes deseja parcelar?", "2")) || 2;
        const valorParcela = valorTotal / qtdParcelas; // Cálculo automático da parcela

        for (let i = 0; i < qtdParcelas; i++) {
            const dataParcela = new Date(dataBase);
            dataParcela.setMonth(dataBase.getMonth() + i);
            
            const ano = dataParcela.getFullYear();
            const mes = String(dataParcela.getMonth() + 1).padStart(2, '0');
            const dia = String(dataParcela.getDate()).padStart(2, '0');
            const novaDataStr = `${ano}-${mes}-${dia}`;

            gastos.push({
                id: `${idGrupo}_${i}`,
                idGrupo: idGrupo,
                usuarioDono: usuarioLogado.email,
                desc: `${desc} (${i + 1}/${qtdParcelas})`,
                categoria,
                valor: valorParcela,
                vencimento: novaDataStr,
                ehFamiliar,
                pago: false,
                tipo: 'parcelado'
            });
        }
    } else if (tipoConta === "2") {
        // CONTA RECORRENTE / FIXA (Replica para os próximos 12 meses para automação)
        for (let i = 0; i < 12; i++) {
            const dataFixa = new Date(dataBase);
            dataFixa.setMonth(dataBase.getMonth() + i);
            
            const ano = dataFixa.getFullYear();
            const mes = String(dataFixa.getMonth() + 1).padStart(2, '0');
            const dia = String(dataFixa.getDate()).padStart(2, '0');
            const novaDataStr = `${ano}-${mes}-${dia}`;

            gastos.push({
                id: `${idGrupo}_f${i}`,
                idGrupo: idGrupo,
                usuarioDono: usuarioLogado.email,
                desc: `${desc} 🔄`,
                categoria,
                valor: valorTotal,
                vencimento: novaDataStr,
                ehFamiliar,
                pago: false,
                tipo: 'recorrente'
            });
        }
    } else {
        // CONTA NORMAL
        gastos.push({
            id: idGrupo,
            idGrupo: idGrupo,
            usuarioDono: usuarioLogado.email,
            desc, categoria, valor: valorTotal, vencimento: vencimentoOriginal, ehFamiliar, pago: false, tipo: 'normal'
        });
    }

    localStorage.setItem('cloud_gastos', JSON.stringify(gastos));
    document.getElementById('gastoForm').reset();
    document.getElementById('vencimento').value = new Date().toISOString().split('T')[0];
    atualizarInterface();
}

function deletarGasto(id, idGrupo, tipo) {
    if (tipo === 'parcelado' || tipo === 'recorrente') {
        const conf = confirm("Esta conta faz parte de uma série (parcelada/recorrente). Deseja apagar TODAS as parcelas/recorrências dela?");
        if (conf) {
            gastos = gastos.filter(g => g.idGrupo !== idGrupo);
        } else {
            gastos = gastos.filter(g => g.id !== id);
        }
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
    document.getElementById('salarioInput').value = salarios[salKey] || '';
    document.getElementById('salarioInput').onchange = (e) => {
        salarios[salKey] = parseFloat(e.target.value) || 0;
        localStorage.setItem('cloud_salarios', JSON.stringify(salarios));
        atualizarInterface();
    };

    const meuSalarioAtual = salarios[salKey] || 0;
    let totalFamiliarDoMes = 0; 
    let meusGastosAPagar = 0; 
    let resumoGrafico = {};
    const tbody = document.getElementById('tabelaCorpo'); 
    tbody.innerHTML = '';

    gastos.forEach(g => {
        if(g.vencimento.startsWith(mesSelecionado)) {
            const visivel = (g.usuarioDono === usuarioLogado.email) || g.ehFamiliar;
            if(visivel) {
                if(g.ehFamiliar) totalFamiliarDoMes += g.valor;
                else if(!g.pago) meusGastosAPagar += g.valor;
                resumoGrafico[g.categoria] = (resumoGrafico[g.categoria] || 0) + g.valor;

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
    });

    document.getElementById('dashSalario').innerText = `R$ ${meuSalarioAtual.toFixed(2)}`;
    document.getElementById('dashFamiliar').innerText = `R$ ${totalFamiliarDoMes.toFixed(2)}`;
    document.getElementById('dashAPagar').innerText = `R$ ${meusGastosAPagar.toFixed(2)}`;
    const saldoFinal = meuSalarioAtual - (meusGastosAPagar + totalFamiliarDoMes);
    document.getElementById('dashSaldo').innerText = `R$ ${saldoFinal.toFixed(2)}`;
    renderizarGrafico(resumoGrafico);
}

function renderizarGrafico(dados) {
    const ctx = document.getElementById('graficoCategorias').getContext('2d');
    if (meuGrafico) meuGrafico.destroy();
    
    const keys = Object.keys(dados);
    const values = Object.values(dados);
    if(keys.length === 0) { keys.push("Nenhum"); values.push(1); }

    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: keys, datasets: [{ data: values, backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444'] }] },
        options: { plugins: { legend: { labels: { color: '#f8fafc' } } } }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    const vencField = document.getElementById('vencimento');
    if(vencField) vencField.value = new Date().toISOString().split('T')[0];
});