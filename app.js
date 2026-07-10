

// =========================================================================
// ⚠️ EDITE AS DUAS LINHAS ABAIXO COLOCANDO SUAS CHAVES DO SUPABASE
// =========================================================================
const SUPABASE_URL = "https://iecdvnsvnobpxqnusitw.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllY2R2bnN2bm9icHhxbnVzaXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzEyODQsImV4cCI6MjA5ODUwNzI4NH0.sh55ms3OxevckA3OlbF_vl00j8E6CmTWKfG4bQYhj0Q";           
// ======// =========================================================================

let bancoSupabase = null;
try {
    if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes("sua-url-aqui")) {
        bancoSupabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
    }
} catch(e) {
    console.error("Erro ao carregar SDK Supabase:", e);
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
        alert("Por favor, preencha todos os campos."); 
        return;
    }
    
    if (!bancoSupabase) {
        alert("Atenção: Conexão pendente com o Supabase. Verifique suas chaves no app.js.");
        return;
    }

    try {
        const { data, error } = await bancoSupabase.auth.signInWithPassword({
            email: emailField.value.trim(), password: senhaField.value
        });
        if (error) { alert("Erro: " + error.message); return; }
        usuarioLogado = data.user;
        localStorage.setItem('sessao_usuario', JSON.stringify(usuarioLogado));
        entrarNoPainel();
    } catch (err) { alert("Erro de conexão com o servidor."); }
}

function entrarNoPainel() {
    const loginTela = document.getElementById('telaLogin');
    const appTela = document.getElementById('appContainer');
    const tagUsuario = document.getElementById('userDisplayTag');

    if (loginTela) loginTela.style.display = 'none';
    if (appTela) appTela.style.display = 'block';
    if (usuarioLogado && tagUsuario) {
        tagUsuario.innerText = `👤 ${usuarioLogado.email.split('@')[0]}`;
    }
    carregarDadosNuvem();
}

function deslogar() {
    try { bancoSupabase.auth.signOut(); } catch(e){}
    localStorage.removeItem('sessao_usuario');
    window.location.reload();
}

async function carregarDadosNuvem() {
    if (!usuarioLogado || !bancoSupabase) return;
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
        if(camposP) camposP.style.display = 'flex'; 
        if(campoV) campoV.style.display = 'none';
    } else {
        if(camposP) camposP.style.display = 'none'; 
        if(campoV) campoV.style.display = 'block';
    }
}

async function salvarGasto(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!bancoSupabase) return;
    
    const desc = document.getElementById('desc').value.trim();
    const categoria = document.getElementById('categoria').value;
    const vencimentoOriginal = document.getElementById('vencimento').value;
    const ehFamiliar = document.getElementById('gastoFamiliarCheck').checked;
    const tipoConta = document.getElementById('tipoContaSelect').value;
    
    if (!desc || !vencimentoOriginal) {
        alert("Por favor, preencha a descrição e a data de vencimento.");
        return;
    }

    const idGrupo = Date.now().toString();
    let novosGastos = [];

    if (tipoConta === "parcelado") {
        const qtd = parseInt(document.getElementById('qtdParcelasInput').value) || 2;
        const val = parseFloat(document.getElementById('valorParcelaInput').value) || 0;
        if(val <= 0) { alert("Insira um valor válido para a parcela."); return; }
        let dataBase = new Date(vencimentoOriginal + "T00:00:00");
        for (let i = 0; i < qtd; i++) {
            let d = new Date(dataBase); d.setMonth(dataBase.getMonth() + i);
            novosGastos.push({
                id_grupo: idGrupo, usuario_dono: usuarioLogado.email,
                desc: `${desc} (${i + 1}/${qtd})`, categoria: categoria, valor: val,
                vencimento: d.toISOString().split('T')[0], eh_familiar: ehFamiliar, pago: false, tipo: 'parcelado',
                encerrado: false
            });
        }
    } else {
        const val = parseFloat(document.getElementById('valorInput').value) || 0;
        if(val <= 0) { alert("Insira um valor válido para o registro."); return; }
        novosGastos.push({
            id_grupo: idGrupo, usuario_dono: usuarioLogado.email,
            desc: desc, categoria: categoria, valor: val, vencimento: vencimentoOriginal, eh_familiar: ehFamiliar, pago: false, tipo: tipoConta,
            encerrado: false
        });
    }

    try {
        const { error } = await bancoSupabase.from('gastos').insert(novosGastos);
        if (error) { alert("Erro: " + error.message); return; }
        document.getElementById('gastoForm').reset();
        document.getElementById('tipoContaSelect').value = 'normal';
        alternarCamposTipo();
        await carregarDadosNuvem();
    } catch (err) { alert("Erro crítico ao salvar."); }
}

function atualizarInterface() {
    const appTela = document.getElementById('appContainer');
    if (!appTela || appTela.style.display === 'none' || !usuarioLogado) return;

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

    // 🔥 NOVAS VARIÁVEIS DE CÁLCULO FINANCEIRO
    let totalFamiliar = 0;
    let meusGastosAPagar = 0;
    let meusGastosJaPagos = 0; 
    let resumoGrafico = {};
    
    const tbody = document.getElementById('tabelaCorpo');
    if(tbody) tbody.innerHTML = '';

    gastos.forEach(g => {
        if(g.vencimento && g.vencimento.startsWith(mesSelecionado)) {
            const visivel = (g.usuario_dono === emailU) || g.eh_familiar;
            if(visivel) {
                // Se o item foi finalizado/encerrado permanentemente, ele não entra nos cálculos normais
                const estaEncerrado = g.encerrado || g.desc.includes("[QUITADO]");

                if (!estaEncerrado) {
                    if(g.eh_familiar) {
                        totalFamiliar += g.valor;
                    } else {
                        // 🔥 NOVA MATEMÁTICA: SEPARA O QUE ESTÁ PAGO DO QUE FALTA PAGAR
                        if(g.pago) {
                            meusGastosJaPagos += g.valor;
                        } else {
                            meusGastosAPagar += g.valor;
                        }
                    }
                    resumoGrafico[g.categoria] = (resumoGrafico[g.categoria] || 0) + g.valor;
                }

                if(tbody) {
                    const tr = document.createElement('tr');
                    
                    // Estilização dependendo do estado da conta
                    if (estaEncerrado) {
                        tr.style.opacity = "0.3";
                        tr.style.background = "#1e293b";
                    } else if(g.pago) {
                        tr.style.opacity = "0.6";
                        tr.style.textDecoration = "line-through";
                    }
                    
                    const textoPagamento = g.pago && g.data_pagamento ? `<br><small style="color:var(--success); font-weight:normal; text-decoration:none; display:inline-block;">✓ Pago em: ${g.data_pagamento.split('-').reverse().join('/')}</small>` : '';
                    const textoEncerrado = estaEncerrado ? `<br><small style="color:#f43f5e; font-weight:bold; text-decoration:none;">🔒 CONTA ENCERRADA</small>` : '';
                    
                    const iconeBotao = g.pago ? '↩' : '✓';
                    const corBotao = g.pago ? 'var(--text-muted)' : 'var(--success)';

                    tr.innerHTML = `
                        <td data-label="Descrição"><b>${g.desc}</b>${textoPagamento}${textoEncerrado}</td>
                        <td data-label="Categoria">${g.categoria}</td>
                        <td data-label="Vencimento">${g.vencimento.split('-').reverse().join('/')}</td>
                        <td data-label="Valor">R$ ${g.valor.toFixed(2)}</td>
                        <td style="text-align:center; text-decoration:none !important;">
                            ${!estaEncerrado ? `<button title="Marcar como Pago" style="background:${corBotao}; color:#0f172a; padding:6px 10px; border:none; border-radius:4px; font-size:0.8rem; font-weight:bold; cursor:pointer;" onclick="alternarStatusPago('${g.id}', ${g.pago})">${iconeBotao}</button>` : ''}
                            ${!estaEncerrado ? `<button title="Encerrar/Quitar Conta" style="background:#f43f5e; color:white; padding:6px 10px; border:none; border-radius:4px; font-size:0.8rem; cursor:pointer;" onclick="encerrarContaDefinitivo('${g.id}', '${g.desc}')">🔒</button>` : ''}
                            <button title="Excluir" style="background:var(--danger); color:white; padding:6px 10px; border:none; border-radius:4px; font-size:0.8rem; cursor:pointer;" onclick="deletarGasto('${g.id}', '${g.id_grupo}', '${g.tipo}')">X</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                }
            }
        }
    });

    // 🔥 ATUALIZAÇÃO DOS BLOCOS DO DASHBOARD
    const rSal = salarios[salKey] || 0; // Renda Recebida
    
    const dFam = document.getElementById('dashFamiliar');
    const dPag = document.getElementById('dashAPagar');
    const dJaPago = document.getElementById('dashJaPago'); // Asegure-se de criar este ID no seu HTML
    const dSal = document.getElementById('dashSaldo');

    if(dFam) dFam.innerText = `R$ ${totalFamiliar.toFixed(2)}`;
    if(dPag) dPag.innerText = `R$ ${meusGastosAPagar.toFixed(2)}`;
    if(dJaPago) dJaPago.innerText = `R$ ${meusGastosJaPagos.toFixed(2)}`;
    
    // 🔥 CÁLCULO DO SALDO PEDIDO: RENDA - APENAS O QUE JÁ FOI PAGO
    const saldoCalculado = rSal - meusGastosJaPagos;
    if(dSal) dSal.innerText = `R$ ${saldoCalculado.toFixed(2)}`;
    
    renderizarGrafico(resumoGrafico);
}

async function alternarStatusPago(id, status) {
    if(!bancoSupabase) return;
    const dataAtual = !status ? new Date().toISOString().split('T')[0] : null;
    try { 
        let dadosAtualizar = { pago: !status };
        if (gastos.length > 0 && 'data_pagamento' in gastos[0]) {
            dadosAtualizar.data_pagamento = dataAtual;
        }
        await bancoSupabase.from('gastos').update(dadosAtualizar).eq('id', id); 
        await carregarDadosNuvem(); 
    } catch(e){}
}

// 🔥 NOVA FUNÇÃO PARA FINALIZAR/QUITAR CONTA DEFINITIVAMENTE
async function encerrarContaDefinitivo(id, descricaoAntiga) {
    if(!bancoSupabase) return;
    if(!confirm(`Deseja encerrar e quitar em definitivo a conta "${descricaoAntiga}"? Ela sairá dos cálculos ativos.`)) return;
    
    try {
        let dadosAtualizar = { desc: descricaoAntiga + " [QUITADO]" };
        // Caso sua tabela tenha a coluna estrutural 'encerrado'
        if (gastos.length > 0 && 'encerrado' in gastos[0]) {
            dadosAtualizar.encerrado = true;
        }
        // Força o status de pago ao mesmo tempo
        dadosAtualizar.pago = true;

        await bancoSupabase.from('gastos').update(dadosAtualizar).eq('id', id);
        await carregarDadosNuvem();
    } catch(e) {
        console.error("Erro ao encerrar conta:", e);
    }
}

async function deletarGasto(id, idGrupo, tipo) {
    if(!bancoSupabase) return;
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

window.onload = function() {
    const btnLogin = document.getElementById('btnEntrarLogin') || document.querySelector('#telaLogin button') || document.querySelector('button');
    if (btnLogin) {
        btnLogin.onclick = function(e) {
            if(e && typeof e.preventDefault === 'function') e.preventDefault();
            executarLogin();
        };
    }

    document.getElementById('gastoForm')?.addEventListener('submit', salvarGasto);
    const btnSalvar = document.getElementById('btnSalvarGasto');
    if (btnSalvar) { btnSalvar.onclick = salvarGasto; }
    document.getElementById('tipoContaSelect')?.addEventListener('change', alternarCamposTipo);
    
    const sessao = localStorage.getItem('sessao_usuario');
    if(sessao) { 
        usuarioLogado = JSON.parse(sessao); 
        entrarNoPainel(); 
    }
};