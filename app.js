// =========================================================================
// ⚠️ EDITE AS DUAS LINHAS ABAIXO COLOCANDO SUAS CHAVES DO SUPABASE
// =========================================================================
const SUPABASE_URL = "https://iecdvnsvnobpxqnusitw.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q";           
// ======// =========================================================================

const bancoSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

let usuarioLogado = null;
let mesSelecionado = "2026-07";
let mesesDisponiveis = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
let gastos = [];
let salarios = {};
let meuGrafico = null;

// LOGIN ROBUSTO VIA SUPABASE
async function executarLogin() {
    const emailField = document.getElementById('loginEmail');
    const senhaField = document.getElementById('loginSenha');

    if (!emailField || !senhaField || !emailField.value) {
        alert("Por favor, digite seu e-mail e sua senha.");
        return;
    }

    try {
        const { data, error } = await bancoSupabase.auth.signInWithPassword({
            email: emailField.value.trim(),
            password: senhaField.value
        });
        
        if (error) {
            alert("❌ Erro de Login: " + error.message);
        } else {
            usuarioLogado = data.user;
            localStorage.setItem('sessao_usuario', JSON.stringify(usuarioLogado));
            entrarNoPainel();
        }
    } catch (err) {
        alert("Erro ao conectar com o banco.");
    }
}

function entrarNoPainel() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userDisplayTag').innerText = `👤 Logado como: ${usuarioLogado.email}`;
    carregarDadosNuvem();
}

function deslogar() {
    try { bancoSupabase.auth.signOut(); } catch(e){}
    localStorage.removeItem('sessao_usuario');
    usuarioLogado = null;
    window.location.reload();
}

// 🌐 BUSCA AUTOMÁTICA DA NUVEM
async function carregarDadosNuvem() {
    try {
        const { data: dadosGastos } = await bancoSupabase.from('gastos').select('*');
        gastos = dadosGastos || [];

        const { data: dadosSalarios } = await bancoSupabase.from('salarios').select('*');
        salarios = {};
        if (dadosSalarios) {
            dadosSalarios.forEach(s => { salarios[s.chave_salario] = s.valor; });
        }
        atualizarInterface();
    } catch (error) {
        console.error("Erro ao sincronizar com a nuvem:", error);
    }
}

// CONTROLES VISUAIS DOS CAMPOS
function alternarCamposTipo() {
    const tipo = document.getElementById('tipoContaSelect').value;
    const camposParcelas = document.getElementById('camposParcelas');
    const campoValorNormal = document.getElementById('campoValorNormal');
    const valorInput = document.getElementById('valorInput');

    if (tipo === 'parcelado') {
        camposParcelas.style.display = 'grid';
        campoValorNormal.style.display = 'none';
        if (valorInput) valorInput.removeAttribute('required');
    } else {
        camposParcelas.style.display = 'none';
        campoValorNormal.style.display = 'block';
        if (valorInput) valorInput.setAttribute('required', 'true');
    }
    calcularTotalParcelas();
}

function calcularTotalParcelas() {
    const qtd = parseInt(document.getElementById('qtdParcelasInput').value) || 0;
    const valorParc = parseFloat(document.getElementById('valorParcelaInput').value) || 0;
    const total = qtd * valorParc;
    document.getElementById('textoValorTotal').innerText = `R$ ${total.toFixed(2)}`;
}

// 🌐 SALVA DIRETO NO BANCO DE DADOS
async function salvarGasto(e) {
    if (e) e.preventDefault();
    
    const desc = document.getElementById('desc').value;
    const categoria = document.getElementById('categoria').value;
    const vencimentoOriginal = document.getElementById('vencimento').value;
    const ehFamiliar = document.getElementById('gastoFamiliarCheck').checked;
    const tipoConta = document.getElementById('tipoContaSelect').value;

    const dataBase = new Date(vencimentoOriginal + "T00:00:00");
    const idGrupo = Date.now().toString();
    let novosGastos = [];

    if (tipoConta === "parcelado") {
        const qtdParcelas = parseInt(document.getElementById('qtdParcelasInput').value) || 2;
        const valorParcela = parseFloat(document.getElementById('valorParcelaInput').value) || 0;
        const valorTotalCalculado = qtdParcelas * valorParcela;

        for (let i = 0; i < qtdParcelas; i++) {
            const dataParcela = new Date(dataBase);
            dataParcela.setMonth(dataBase.getMonth() + i);
            
            const ano = dataParcela.getFullYear();
            const mes = String(dataParcela.getMonth() + 1).padStart(2, '0');
            const dia = String(dataParcela.getDate()).padStart(2, '0');

            novosGastos.push({
                id_grupo: idGrupo,
                usuario_dono: usuarioLogado.email,
                desc: `${desc} (${i + 1}/${qtdParcelas}) [Total: R$${valorTotalCalculado.toFixed(2)}]`,
                categoria,
                valor: valorParcela,
                vencimento: `${ano}-${mes}-${dia}`,
                eh_familiar: ehFamiliar,
                pago: false,
                tipo: 'parcelado'
            });
        }
    } else if (tipoConta === "recorrente") {
        const valorTotal = parseFloat(document.getElementById('valorInput').value) || 0;
        for (let i = 0; i < 12; i++) {
            const dataFixa = new Date(dataBase);
            dataFixa.setMonth(dataBase.getMonth() + i);
            
            const ano = dataFixa.getFullYear();
            const mes = String(dataFixa.getMonth() + 1).padStart(2, '0');
            const dia = String(dataFixa.getDate()).padStart(2, '0');

            novosGastos.push({
                id_grupo: idGrupo,
                usuario_dono: usuarioLogado.email,
                desc: `${desc} 🔄`,
                categoria,
                valor: valorTotal,
                vencimento: `${ano}-${mes}-${dia}`,
                eh_familiar: ehFamiliar,
                pago: false,
                tipo: 'recorrente'
            });
        }
    } else {
        const valorTotal = parseFloat(document.getElementById('valorInput').value) || 0;
        novosGastos.push({
            id_grupo: idGrupo,
            usuario_dono: usuarioLogado.email,
            desc, categoria, valor: valorTotal, vencimento: vencimentoOriginal, eh_familiar: ehFamiliar, pago: false, tipo: 'normal'
        });
    }

    try {
        await bancoSupabase.from('gastos').insert(novosGastos);
        document.getElementById('gastoForm').reset();
        document.getElementById('vencimento').value = new Date().toISOString().split('T')[0];
        document.getElementById('tipoContaSelect').value = 'normal';
        alternarCamposTipo();
        await carregarDadosNuvem();
    } catch (err) {
        alert("Erro ao salvar no banco.");
    }
}

// 🌐 DELETA DIRETO NO BANCO
async function deletarGasto(id, idGrupo, tipo) {
    try {
        if (tipo === 'parcelado' || tipo === 'recorrente') {
            const conf = confirm("Deseja apagar TODAS as recorrências/parcelas desta série?");
            if (conf) await bancoSupabase.from('gastos').delete().eq('id_grupo', idGrupo);
            else await bancoSupabase.from('gastos').delete().eq('id', id);
        } else {
            await bancoSupabase.from('gastos').delete().eq('id', id);
        }
        await carregarDadosNuvem();
    } catch (e) {}
}

// 🌐 ATUALIZA STATUS DE PAGO NO BANCO
async function alternarStatusPago(id, statusAtual) {
    try {
        await bancoSupabase.from('gastos').update({ pago: !statusAtual }).eq('id', id);
        await carregarDadosNuvem();
    } catch (e) {}
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

// ATUALIZAÇÃO DO DASHBOARD E GRÁFICO
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
        salInput.onchange = async (e) => {
            const valorSalario = parseFloat(e.target.value) || 0;
            await bancoSupabase.from('salarios').upsert({ chave_salario: salKey, valor: valorSalario }, { onConflict: 'chave_salario' });
            await carregarDadosNuvem();
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
            const visivel = (g.usuario_dono === usuarioLogado.email) || g.eh_familiar;
            if(visivel) {
                if(g.eh_familiar) totalFamiliarDoMes += g.valor;
                else if(!g.pago) meusGastosAPagar += g.valor;
                
                resumoGrafico[g.categoria] = (resumoGrafico[g.categoria] || 0) + g.valor;

                if (tbody) {
                    const tr = document.createElement('tr');
                    if(g.pago) tr.className = "linha-paga";
                    
                    let etiquetaTipo = '👤 Individual';
                    if(g.eh_familiar) etiquetaTipo = '💜 Conjunta';
                    if(g.tipo === 'parcelado') etiquetaTipo += ' 📦';
                    
                    tr.innerHTML = `
                        <td><strong>${g.desc}</strong></td>
                        <td>${g.categoria}</td>
                        <td><small>${g.usuario_dono ? g.usuario_dono.split('@')[0] : 'user'}</small></td>
                        <td>${g.vencimento}</td>
                        <td>R$ ${g.valor.toFixed(2)}</td>
                        <td>${etiquetaTipo}</td>
                        <td>
                            <button class="tab-btn" style="padding:4px 8px; font-size:0.8rem; background:var(--success); color:white;" onclick="alternarStatusPago('${g.id}', ${g.pago})">Pago</button>
                            <button class="tab-btn" style="padding:4px 8px; font-size:0.8rem; background:var(--danger); color:white;" onclick="deletarGasto('${g.id}', '${g.id_grupo}', '${g.tipo}')">X</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                }
            }
        }
    });

    document.getElementById('dashFamiliar').innerText = `R$ ${totalFamiliarDoMes.toFixed(2)}`;
    document.getElementById('dashAPagar').innerText = `R$ ${meusGastosAPagar.toFixed(2)}`;
    const saldoFinal = meuSalarioAtual - (meusGastosAPagar + totalFamiliarDoMes);
    document.getElementById('dashSaldo').innerText = `R$ ${saldoFinal.toFixed(2)}`;
    
    renderizarGrafico(resumoGrafico);
}

function renderizarGrafico(dados) {
    const canvas = document.getElementById('graficoCategorias');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (meuGrafico) meuGrafico.destroy();
    
    const keys = Object.keys(dados);
    const values = Object.values(dados);
    if(keys.length === 0) { keys.push("Nenhum"); values.push(1); }

    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: keys, datasets: [{ data: values, backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899'] }] },
        options: { plugins: { legend: { labels: { color: '#f8fafc' } } } }
    });
}

// INICIALIZADOR DE SESSÃO AUTOMÁTICO DO BANCO
window.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('gastoForm');
    if (form) form.addEventListener('submit', salvarGasto);
    
    const tipoSelect = document.getElementById('tipoContaSelect');
    if(tipoSelect) tipoSelect.addEventListener('change', alternarCamposTipo);
    
    document.getElementById('qtdParcelasInput')?.addEventListener('input', calcularTotalParcelas);
    document.getElementById('valorParcelaInput')?.addEventListener('input', calcularTotalParcelas);

    const vencField = document.getElementById('vencimento');
    if(vencField) vencField.value = new Date().toISOString().split('T')[0];

    try {
        const { data: { session } } = await bancoSupabase.auth.getSession();
        if (session && session.user) {
            usuarioLogado = session.user;
            entrarNoPainel();
            return;
        }
    } catch (e) {}

    const sessaoSalva = localStorage.getItem('sessao_usuario');
    if (sessaoSalva) {
        usuarioLogado = JSON.parse(sessaoSalva);
        entrarNoPainel();
    }
});