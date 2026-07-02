// =========================================================================
// ⚠️ EDITE AS DUAS LINHAS ABAIXO COLOCANDO SUAS CHAVES DO SUPABASE
// =========================================================================
const SUPABASE_URL = "https://iecdvnsvnobpxqnusitw.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q";           
// ======// =========================================================================

const bancoSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

let usuarioLogado = null;
let mesSelecionado = "2026-07";
let mesesDisponiveis = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
let gastos = [];
let salarios = {};
let meuGrafico = null;

// Função de Login
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
            alert("❌ Erro de Login: " + error.message);
        } else {
            usuarioLogado = data.user;
            localStorage.setItem('sessao_usuario', JSON.stringify(usuarioLogado));
            entrarNoPainel();
        }
    } catch (err) {
        alert("Erro ao tentar conectar com o servidor de autenticação.");
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

// 🌐 BUSCA OS DADOS DIRETO DA NUVEM (SUPABASE)
async function carregarDadosNuvem() {
    try {
        // 1. Busca os gastos salvos na tabela do banco de dados
        const { data: dadosGastos, error: erroGastos } = await bancoSupabase
            .from('gastos')
            .select('*');

        if (erroGastos) throw erroGastos;
        gastos = dadosGastos || [];

        // 2. Busca os salários salvos na tabela de salários
        const { data: dadosSalarios, error: erroSalarios } = await bancoSupabase
            .from('salarios')
            .select('*');

        if (erroSalarios) throw erroSalarios;
        
        // Converte o formato do banco para o formato do nosso app
        salarios = {};
        if (dadosSalarios) {
            dadosSalarios.forEach(s => {
                salarios[s.chave_salario] = s.valor;
            });
        }

        atualizarInterface();
    } catch (error) {
        console.error("Erro ao carregar dados em nuvem, usando contingência local:", error);
        // Se a tabela ainda não estiver criada no Supabase, ele avisa no console
    }
}

// 🌐 SALVA O GASTO DIRETO NA NUVEM
async function salvarGasto(e) {
    e.preventDefault();
    const desc = document.getElementById('desc').value;
    const categoria = document.getElementById('categoria').value;
    const valorTotal = parseFloat(document.getElementById('valorInput').value);
    const vencimentoOriginal = document.getElementById('vencimento').value;
    const ehFamiliar = document.getElementById('gastoFamiliarCheck').checked;

    const tipoConta = prompt("Digite o tipo da conta:\n1 - Normal (Só este mês)\n2 - Fixa / Recorrente (Todo mês)\n3 - Parcelada", "1");
    
    const dataBase = new Date(vencimentoOriginal + "T00:00:00");
    const idGrupo = Date.now().toString();
    let novosGastosNuvem = [];

    if (tipoConta === "3") {
        const qtdParcelas = parseInt(prompt("Em quantas vezes deseja parcelar?", "2")) || 2;
        const valorParcela = valorTotal / qtdParcelas;

        for (let i = 0; i < qtdParcelas; i++) {
            const dataParcela = new Date(dataBase);
            dataParcela.setMonth(dataBase.getMonth() + i);
            
            const ano = dataParcela.getFullYear();
            const mes = String(dataParcela.getMonth() + 1).padStart(2, '0');
            const dia = String(dataParcela.getDate()).padStart(2, '0');

            novosGastosNuvem.push({
                id_grupo: idGrupo,
                usuario_dono: usuarioLogado.email,
                desc: `${desc} (${i + 1}/${qtdParcelas})`,
                categoria,
                valor: valorParcela,
                vencimento: `${ano}-${mes}-${dia}`,
                eh_familiar: ehFamiliar,
                pago: false,
                tipo: 'parcelado'
            });
        }
    } else if (tipoConta === "2") {
        for (let i = 0; i < 12; i++) {
            const dataFixa = new Date(dataBase);
            dataFixa.setMonth(dataBase.getMonth() + i);
            
            const ano = dataFixa.getFullYear();
            const mes = String(dataFixa.getMonth() + 1).padStart(2, '0');
            const dia = String(dataFixa.getDate()).padStart(2, '0');

            novosGastosNuvem.push({
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
        novosGastosNuvem.push({
            id_grupo: idGrupo,
            usuario_dono: usuarioLogado.email,
            desc, categoria, valor: valorTotal, vencimento: vencimentoOriginal, eh_familiar: ehFamiliar, pago: false, tipo: 'normal'
        });
    }

    try {
        // Envia o array de novos gastos direto para a tabela do Supabase
        const { error } = await bancoSupabase.from('gastos').insert(novosGastosNuvem);
        if (error) throw error;
        
        document.getElementById('gastoForm').reset();
        document.getElementById('vencimento').value = new Date().toISOString().split('T')[0];
        await carregarDadosNuvem(); // Recarrega os dados atualizados da nuvem
    } catch (err) {
        alert("Erro ao salvar dados na nuvem: " + err.message);
    }
}

// 🌐 DELETA DO BANCO DE DADOS
async function deletarGasto(id, idGrupo, tipo) {
    try {
        if (tipo === 'parcelado' || tipo === 'recorrente') {
            const conf = confirm("Esta conta faz parte de uma série. Deseja apagar TODAS as parcelas/recorrências dela?");
            if (conf) {
                const { error } = await bancoSupabase.from('gastos').delete().eq('id_grupo', idGrupo);
                if (error) throw error;
            } else {
                const { error } = await bancoSupabase.from('gastos').delete().eq('id', id);
                if (error) throw error;
            }
        } else {
            const { error } = await bancoSupabase.from('gastos').delete().eq('id', id);
            if (error) throw error;
        }
        await carregarDadosNuvem();
    } catch (err) {
        alert("Erro ao deletar da nuvem: " + err.message);
    }
}

// 🌐 ALTERNA STATUS DE PAGO NA NUVEM
async function alternarStatusPago(id, statusAtual) {
    try {
        const { error } = await bancoSupabase
            .from('gastos')
            .update({ pago: !statusAtual })
            .eq('id', id);

        if (error) throw error;
        await carregarDadosNuvem();
    } catch (err) {
        alert("Erro ao atualizar status na nuvem: " + err.message);
    }
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

// ATUALIZAÇÃO DA TELA
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
    
    // 🌐 SALVA O SALÁRIO NA NUVEM AO MUDAR O VALOR
    document.getElementById('salarioInput').onchange = async (e) => {
        const valorSalario = parseFloat(e.target.value) || 0;
        try {
            // Tenta fazer um "Upsert" (insere se não existir, atualiza se já existir)
            const { error } = await bancoSupabase
                .from('salarios')
                .upsert({ chave_salario: salKey, valor: valorSalario }, { onConflict: 'chave_salario' });
            
            if (error) throw error;
            await carregarDadosNuvem();
        } catch (err) {
            alert("Erro ao salvar salário na nuvem: " + err.message);
        }
    };

    const meuSalarioAtual = salarios[salKey] || 0;
    let totalFamiliarDoMes = 0; 
    let meusGastosAPagar = 0; 
    let resumoGrafico = {};
    const tbody = document.getElementById('tabelaCorpo'); 
    tbody.innerHTML = '';

    gastos.forEach(g => {
        if(g.vencimento.startsWith(mesSelecionado)) {
            const visivel = (g.usuario_dono === usuarioLogado.email) || g.eh_familiar;
            if(visivel) {
                if(g.eh_familiar) totalFamiliarDoMes += g.valor;
                else if(!g.pago) meusGastosAPagar += g.valor;
                resumoGrafico[g.categoria] = (resumoGrafico[g.categoria] || 0) + g.valor;

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

// CHECK DE SESSÃO AO INICIAR
window.addEventListener('DOMContentLoaded', async () => {
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