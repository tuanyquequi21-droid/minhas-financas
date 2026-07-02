

// =========================================================================
// ⚠️ EDITE AS DUAS LINHAS ABAIXO COLOCANDO SUAS CHAVES DO SUPABASE
// =========================================================================
const SUPABASE_URL = "https://iecdvnsvnobpxqnusitw.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q";           
// ======// =========================================================================
// =========================================================================

let bancoSupabase = null;
try {
    bancoSupabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
} catch(e) {
    console.error("Erro ao carregar SDK Supabase.");
}

let usuarioLogado = null;
let mesSelecionado = "2026-07";
let mesesDisponiveis = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
let gastos = [];
let salarios = {};
let meuGrafico = null;

async function executarLogin() {
    const emailField = document.getElementById('loginEmail');
    const senhaField = document.getElementById('loginSenha');
    if (!emailField || !senhaField || !emailField.value || !senhaField.value) {
        alert("Por favor, preencha todos os campos."); return;
    }
    try {
        const { data, error } = await bancoSupabase.auth.signInWithPassword({
            email: emailField.value.trim(), password: senhaField.value
        });
        if (error) { alert("Erro: " + error.message); return; }
        usuarioLogado = data.user;
        localStorage.setItem('sessao_usuario', JSON.stringify(usuarioLogado));
        entrarNoPainel();
    } catch (err) { alert("Erro de conexão."); }
}

function entrarNoPainel() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    if(usuarioLogado) document.getElementById('userDisplayTag').innerText = `👤 ${usuarioLogado.email.split('@')[0]}`;
    carregarDadosNuvem();
}

function deslogar() {
    try { bancoSupabase.auth.signOut(); } catch(e){}
    localStorage.removeItem('sessao_usuario');
    window.location.reload();
}

async function carregarDadosNuvem() {
    if (!usuarioLogado) return;
    try {
        const { data: dGastos } = await bancoSupabase.from('gastos').select('*');
        gastos = dGastos || [];
    } catch (e) { gastos = []; }

    try {
        const { data: dSalarios } = await bancoSupabase.from('salarios').select('*');
        salarios = {};
        if (dSalarios) dSalarios.forEach(s => { salarios[s.chave_salario] = s.valor; });
    } catch (e) {}
    atualizarInterface();
}

function alternarCamposTipo() {
    const tipo = document.getElementById('tipoContaSelect').value;
    const camposP = document.getElementById('camposParcelas');
    const campoV = document.getElementById('campoValorNormal');
    if (tipo === 'parcelado') {
        camposP.style.display = 'flex'; campoV.style.display = 'none';
    } else {
        camposP.style.display = 'none'; campoV.style.display = 'block';
    }
}

async function salvarGasto(e) {
    if (e) e.preventDefault();
    const desc = document.getElementById('desc').value;
    const categoria = document.getElementById('categoria').value;
    const vencimentoOriginal = document.getElementById('vencimento').value;
    const ehFamiliar = document.getElementById('gastoFamiliarCheck').checked;
    const tipoConta = document.getElementById('tipoContaSelect').value;
    const idGrupo = Date.now().toString();
    let novosGastos = [];

    if (tipoConta === "parcelado") {
        const qtd = parseInt(document.getElementById('qtdParcelasInput').value) || 2;
        const val = parseFloat(document.getElementById('valorParcelaInput').value) || 0;
        let dataBase = new Date(vencimentoOriginal + "T00:00:00");
        for (let i = 0; i < qtd; i++) {
            let d = new Date(dataBase); d.setMonth(dataBase.getMonth() + i);
            novosGastos.push({
                id_grupo: idGrupo, usuario_dono: usuarioLogado.email,
                desc: `${desc} (${i + 1}/${qtd})`, categoria, valor: val,
                vencimento: d.toISOString().split('T')[0], eh_familiar: ehFamiliar, pago: false, tipo: 'parcelado'
            });
        }
    } else {
        const val = parseFloat(document.getElementById('valorInput').value) || 0;
        novosGastos.push({
            id_grupo: idGrupo, usuario_dono: usuarioLogado.email,
            desc, categoria, valor: val, vencimento: vencimentoOriginal, eh_familiar: ehFamiliar, pago: false, tipo: tipoConta
        });
    }

    try {
        await bancoSupabase.from('gastos').insert(novosGastos);
        document.getElementById('gastoForm').reset();
        document.getElementById('tipoContaSelect').value = 'normal';
        alternarCamposTipo();
        await carregarDadosNuvem();
    } catch (err) { alert("Erro ao salvar."); }
}

function atualizarInterface() {
    const containerTabs = document.getElementById('tabsMeses');
    if(!containerTabs) return;
    containerTabs.innerHTML = '';
    
    mesesDisponiveis.forEach(m => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `month-pill ${m === mesSelecionado ? 'active' : ''}`;
        btn.innerText = m;
        btn.onclick = () => { mesSelecionado = m; atualizarInterface(); };
        containerTabs.appendChild(btn);
    });

    const emailU = usuarioLogado.email;
    const salKey = `${emailU}_${mesSelecionado}`;
    const salInput = document.getElementById('salarioInput');
    if(salInput) {
        salInput.value = salarios[salKey] || '';
        salInput.onchange = async (e) => {
            const val = parseFloat(e.target.value) || 0;
            await bancoSupabase.from('salarios').upsert({ chave_salario: salKey, valor: val }, { onConflict: 'chave_salario' });
            await carregarDadosNuvem();
        };
    }

    let totalFamiliar = 0, meusGastos = 0, resumoGrafico = {};
    const tbody = document.getElementById('tabelaCorpo');
    if(tbody) tbody.innerHTML = '';

    gastos.forEach(g => {
        if(g.vencimento && g.vencimento.startsWith(mesSelecionado)) {
            const visivel = (g.usuario_dono === emailU) || g.eh_familiar;
            if(visivel) {
                if(g.eh_familiar) totalFamiliar += g.valor;
                else if(!g.pago) meusGastos += g.valor;
                resumoGrafico[g.categoria] = (resumoGrafico[g.categoria] || 0) + g.valor;

                if(tbody) {
                    const tr = document.createElement('tr');
                    if(g.pago) tr.className = "linha-paga";
                    tr.innerHTML = `
                        <td data-label="Descrição"><b>${g.desc}</b></td>
                        <td data-label="Categoria">${g.categoria}</td>
                        <td data-label="Vencimento">${g.vencimento.split('-').reverse().join('/')}</td>
                        <td data-label="Valor">R$ ${g.valor.toFixed(2)}</td>
                        <td style="text-align:center;">
                            <button style="background:var(--success); color:#0f172a; padding:6px 10px; border:none; border-radius:4px; font-size:0.8rem;" onclick="alternarStatusPago('${g.id}', ${g.pago})">✓</button>
                            <button style="background:var(--danger); color:white; padding:6px 10px; border:none; border-radius:4px; font-size:0.8rem;" onclick="deletarGasto('${g.id}', '${g.id_grupo}', '${g.tipo}')">X</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                }
            }
        }
    });

    document.getElementById('dashFamiliar').innerText = `R$ ${totalFamiliar.toFixed(2)}`;
    document.getElementById('dashAPagar').innerText = `R$ ${meusGastos.toFixed(2)}`;
    const rSal = salarios[salKey] || 0;
    document.getElementById('dashSaldo').innerText = `R$ ${(rSal - (meusGastos + totalFamiliar)).toFixed(2)}`;
    renderizarGrafico(resumoGrafico);
}

async function alternarStatusPago(id, status) {
    try { await bancoSupabase.from('gastos').update({ pago: !status }).eq('id', id); await carregarDadosNuvem(); } catch(e){}
}

async function deletarGasto(id, idGrupo, tipo) {
    if(!confirm("Apagar lançamento(s)?")) return;
    try {
        if(tipo === 'parcelado') await bancoSupabase.from('gastos').delete().eq('id_grupo', idGrupo);
        else await bancoSupabase.from('gastos').delete().eq('id', id);
        await carregarDadosNuvem();
    } catch(e){}
}

function criarNovoMes() {
    const m = prompt("Digite o mês (AAAA-MM):");
    if(m && !mesesDisponiveis.includes(m)) { mesesDisponiveis.push(m); mesesDisponiveis.sort(); mesSelecionado = m; atualizarInterface(); }
}

function renderizarGrafico(dados) {
    const canvas = document.getElementById('graficoCategorias'); if (!canvas) return;
    if (meuGrafico) meuGrafico.destroy();
    const keys = Object.keys(dados), values = Object.values(dados);
    if(keys.length === 0) { keys.push("Nenhum"); values.push(1); }
    meuGrafico = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: keys, datasets: [{ data: values, backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ca8a04', '#ec4899'] }] },
        options: { plugins: { legend: { display: false } } }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('gastoForm')?.addEventListener('submit', salvarGasto);
    document.getElementById('tipoContaSelect')?.addEventListener('change', alternarCamposTipo);
    const sessao = localStorage.getItem('sessao_usuario');
    if(sessao) { usuarioLogado = JSON.parse(sessao); entrarNoPainel(); }
});