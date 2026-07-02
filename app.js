// =========================================================================
// ⚠️ EDITE AS DUAS LINHAS ABAIXO COLOCANDO SUAS CHAVES DO SUPABASE
// =========================================================================
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co"; 
const SUPABASE_KEY = "SUA-CHAVE-ANON-PUBLIC";           
// =========================================================================

// Criação do cliente oficial do Supabase utilizando a CDN estável externa
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioLogado = null;
let mesSelecionado = "2026-07";
let mesesDisponiveis = ["2026-07", "2026-08", "2026-09"];
let gastos = [];
let salarios = {};
let meuGrafico = null;

// Função disparada ao clicar no botão "Entrar"
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
        // 1. Tenta fazer o login real na nuvem do Supabase
        const { data, error } = await supabase.auth.signInWithPassword({ email: email, password: senha });
        
        if (error) {
            alert("❌ Supabase recusou o login: " + error.message);
        } else {
            usuarioLogado = data.user;
            entrarNoPainel();
        }
    } catch (err) {
        // 2. SISTEMA DE CONTINGÊNCIA: Se a rede ou CORS bloquear, libera o acesso localmente
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
    try { supabase.auth.signOut(); } catch(e){}
    usuarioLogado = null;
    window.location.reload();
}

function carregarDados() {
    gastos = JSON.parse(localStorage.getItem('cloud_gastos')) || [];
    salarios = JSON.parse(localStorage.getItem('cloud_salarios')) || {};
    atualizarInterface();
}

function salvarGasto(e) {
    e.preventDefault();
    const desc = document.getElementById('desc').value;
    const categoria = document.getElementById('categoria').value;
    const valor = parseFloat(document.getElementById('valorInput').value);
    const vencimento = document.getElementById('vencimento').value;
    const ehFamiliar = document.getElementById('gastoFamiliarCheck').checked;

    gastos.push({
        id: Date.now().toString(),
        usuarioDono: usuarioLogado.email,
        desc, categoria, valor, vencimento, ehFamiliar, pago: false
    });

    localStorage.setItem('cloud_gastos', JSON.stringify(gastos));
    document.getElementById('gastoForm').reset();
    document.getElementById('vencimento').value = new Date().toISOString().split('T')[0];
    atualizarInterface();
}

function deletarGasto(id) {
    gastos = gastos.filter(g => g.id !== id);
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
                tr.innerHTML = `
                    <td><strong>${g.desc}</strong></td>
                    <td>${g.categoria}</td>
                    <td><small>${g.usuarioDono ? g.usuarioDono.split('@')[0] : 'user'}</small></td>
                    <td>${g.vencimento}</td>
                    <td>R$ ${g.valor.toFixed(2)}</td>
                    <td>${g.ehFamiliar ? '💜 Conjunta' : '👤 Individual'}</td>
                    <td>
                        <button class="tab-btn" style="padding:4px 8px; font-size:0.8rem; background:var(--success); color:white;" onclick="alternarStatusPago('${g.id}')">Pago</button>
                        <button class="tab-btn" style="padding:4px 8px; font-size:0.8rem; background:var(--danger); color:white;" onclick="deletarGasto('${g.id}')">X</button>
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

// Inicializador de segurança
window.addEventListener('DOMContentLoaded', () => {
    const vencField = document.getElementById('vencimento');
    if(vencField) vencField.value = new Date().toISOString().split('T')[0];
});