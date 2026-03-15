let soldos = {};
let habilitacao = {};
let disponibilidade = {};
let ativa = {};
let compensacao = {};
let localidade = {};
let pensao = {};
let saude = {};
let irpf = {};
let patentes = [];

function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Carregar todos os JSONs
async function carregarDados() {
    try {
        const [
            s, h, d, a, c, l, p, sa, ir, pat
        ] = await Promise.all([
            fetch("../json/soldo.json").then(r => r.json()),
            fetch("../json/habilitacao.json").then(r => r.json()),
            fetch("../json/disponibilidade.json").then(r => r.json()),
            fetch("../json/ativa.json").then(r => r.json()),
            fetch("../json/compensacao.json").then(r => r.json()),
            fetch("../json/localidade.json").then(r => r.json()),
            fetch("../json/pensao.json").then(r => r.json()),
            fetch("../json/saude.json").then(r => r.json()),
            fetch("../json/irpf.json").then(r => r.json()),
            fetch("../json/patentes.json").then(r => r.json())
        ]);

        soldos = s;
        habilitacao = h;
        disponibilidade = d;
        ativa = a;
        compensacao = c;
        localidade = l;
        pensao = p;
        saude = sa;
        irpf = ir;
        patentes = pat.patentes;

        preencherSelects();
    } catch (error) {
        console.error("Erro ao carregar JSONs:", error);
    }
}

// Preenche selects
function preencherSelects() {
    // Ano
    const anoSelect = document.getElementById("ano");
    anoSelect.innerHTML = `<option value="">Selecione</option>
        <option value="2026">2026</option>`;

    // Patente
    const patSelect = document.getElementById("patente");
    patSelect.innerHTML = `<option value="">Selecione</option>`;
    patentes.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        patSelect.appendChild(opt);
    });

    // Habilitação
    const habSelect = document.getElementById("habilitacao");
    habSelect.innerHTML = `<option value="">Selecione</option>`;
    Object.keys(habilitacao).forEach(nivel => {
        Object.keys(habilitacao[nivel]).forEach(sub => {
            const percent = habilitacao[nivel][sub];
            const opt = document.createElement("option");
            opt.value = percent;
            opt.textContent = `${nivel} - ${sub} (${percent}%)`;
            habSelect.appendChild(opt);
        });
    });

    // Localidade especial
const locSelect = document.getElementById("localidade");
locSelect.innerHTML = `<option value="">Selecione</option>`;
localidade.percentuais.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = `${p}%`;
    locSelect.appendChild(opt);
});

    // Compensação orgânica
const compSelect = document.getElementById("compensacao");
compSelect.innerHTML = `<option value="">Selecione</option>`;
compensacao.percentuais.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = `${p}%`;
    compSelect.appendChild(opt);
});

// Compensação orgânica de voo
const compVooSelect = document.getElementById("compensacaoVoo");
compVooSelect.innerHTML = `<option value="">Selecione</option>`;
compensacao.percentuais.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = `${p}%`;
    compVooSelect.appendChild(opt);
});

// Cotas de voo incorporadas
const cotasSelect = document.getElementById("cotasVoo");
cotasSelect.innerHTML = `<option value="">Selecione</option>`;
compensacao.percentuais.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = `${p}%`;
    cotasSelect.appendChild(opt);
});
}

// Calcular salário
document.getElementById("btnCalcular").addEventListener("click", calcularSalario);

function calcularSalario() {
    const ano = document.getElementById("ano").value;
    const patente = document.getElementById("patente").value;
    const habPercent = parseFloat(document.getElementById("habilitacao").value) || 0;
    const compPercent = parseFloat(document.getElementById("compensacao").value) || 0;
    const compVooPercent = parseFloat(document.getElementById("compensacaoVoo").value) || 0;
    const cotasVooPercent = parseFloat(document.getElementById("cotasVoo").value) || 0;
    const locPercent = parseFloat(document.getElementById("localidade").value) || 0;

    if (!ano || !patente) {
        alert("Selecione ano e patente.");
        return;
    }

    // Valores base
    const soldo = soldos[ano][patente];
    const valorAtiva = (ativa[patente] / 100) * soldo;
    const valorDisponibilidade = (disponibilidade[patente] / 100) * soldo;
    const valorHabilitacao = (habPercent / 100) * soldo;
    const valorCompensacao = (compPercent / 100) * soldo;
    const valorCompensacaoVoo = (compVooPercent / 100) * soldo;
    const valorCotasVoo = (cotasVooPercent / 100) * soldo;
    const valorLocalidade = (locPercent / 100) * soldo;
    

    // Total remuneração (bruta)
const remuneracaoTotal = soldo + valorAtiva + valorDisponibilidade + valorHabilitacao + valorCompensacao + valorCompensacaoVoo + valorCotasVoo + valorLocalidade;
// --- ADICIONAL: grava o valor (R$) do adicional de localidade — não altera nenhum cálculo ---
localStorage.setItem("valorLocalidade", String(valorLocalidade));

// 🔹 Salvar no localStorage
localStorage.setItem("patenteSelecionada", patente);
localStorage.setItem("remuneracaoBruta", String(remuneracaoTotal));

// Base de cálculo dos descontos
const baseDescontos =
soldo +
valorAtiva +
valorDisponibilidade +
valorHabilitacao +
valorCompensacao +
valorCompensacaoVoo +
valorCotasVoo;

    // Descontos
    const descontoPensao = (pensao.percentuais[0] / 100) * baseDescontos;
    const descontoSaude = (saude.percentuais[0] / 100) * baseDescontos;

    // Base IRPF
const baseIR = remuneracaoTotal - descontoPensao - descontoSaude;

// IRPF pela tabela normal
let descontoIR = 0;
for (const faixa of irpf.faixas) {
    if (baseIR >= faixa.inicio && (faixa.limite === null || baseIR <= faixa.limite)) {
        descontoIR = (baseIR * (faixa.aliquota / 100)) - faixa.deducao;
        break;
    }
}
if (descontoIR < 0) descontoIR = 0;

// Regra especial: isenção até R$ 5.000,00 e redução até R$ 7.350,00
let redutorIRPF = 0;

// Na prática da FAB, a regra usa os rendimentos tributáveis mensais
// (antes de pensão e saúde), e não a baseIR já deduzida.
const rendimentosTributaveisMensais = remuneracaoTotal;

if (irpf.redutor_isencao_5000) {
    const regra = irpf.redutor_isencao_5000;

    const isencaoTotalAte = Number(regra.isencao_total_ate);
    const faixaReducaoAte = Number(regra.faixa_reducao_ate);
    const constante = Number(regra.formula.constante);
    const coeficienteRenda = Number(regra.formula.coeficiente_renda);

    // Até R$ 5.000,00 de rendimentos tributáveis mensais: IRPF zero
    if (rendimentosTributaveisMensais <= isencaoTotalAte) {
        redutorIRPF = descontoIR;
        descontoIR = 0;
    }

    // De R$ 5.000,01 até R$ 7.350,00: aplica redutor
    else if (rendimentosTributaveisMensais <= faixaReducaoAte) {
        redutorIRPF = constante - (coeficienteRenda * rendimentosTributaveisMensais);

        if (redutorIRPF < 0) redutorIRPF = 0;
        if (redutorIRPF > descontoIR) redutorIRPF = descontoIR;

        descontoIR = descontoIR - redutorIRPF;
    }
}

    // Salário líquido
    const liquido = remuneracaoTotal - descontoPensao - descontoSaude - descontoIR;

const itensRemuneracao = [
    { nome: "Soldo", valor: soldo },
    { nome: `Adicional Ativa (${ativa[patente]}%)`, valor: valorAtiva },
    { nome: `Adicional Disponibilidade (${disponibilidade[patente]}%)`, valor: valorDisponibilidade },
    { nome: `Adicional Habilitação (${habPercent}%)`, valor: valorHabilitacao },
    { nome: `Adicional Compensação Orgânica (${compPercent}%)`, valor: valorCompensacao },
    { nome: `Compensação Orgânica de Voo (${compVooPercent}%)`, valor: valorCompensacaoVoo },
    { name: `Cotas de Voo (${cotasVooPercent}%)`, valor: valorCotasVoo },
    { nome: `Adicional Localidade Especial (${locPercent}%)`, valor: valorLocalidade }
];

// Ordena do maior valor para o menor
itensRemuneracao.sort((a, b) => b.valor - a.valor);

// Monta as linhas da parte da remuneração
let linhasRemuneracao = "";
itensRemuneracao.forEach(item => {
    const nomeItem = item.nome || item.name;
    linhasRemuneracao += `
    <tr>
        <td>${nomeItem}</td>
        <td>R$ ${formatarMoeda(item.valor)}</td>
    </tr>
    `;
});

    // Tabela resultado
    let tabela = `
    <table border="1" cellpadding="5" cellspacing="0" style="width:100%; border-collapse: collapse;">
        <thead>
            <tr style="background:#004080; color:white;">
                <th colspan="2">Resumo da Remuneração</th>
            </tr>
        </thead>
        <tbody>
            <!-- Remuneração -->
${linhasRemuneracao}
            <tr style="background:#006400; color:white; font-weight:bold;">
                <td>Total Remuneração</td>
                <td>R$ ${formatarMoeda(remuneracaoTotal)}</td>
</tr>

            <!-- IRPF -->
           <tr><td>Base de Cálculo IRPF</td><td>R$ ${formatarMoeda(baseIR)}</td></tr>
            <tr><td>Redutor / Isenção IRPF</td><td>R$ ${formatarMoeda(redutorIRPF)}</td></tr>
            <tr><td>Desconto IRPF</td><td>R$ ${formatarMoeda(descontoIR)}</td></tr>
            <tr><td>Pensão Militar (${pensao.percentuais[0]}%)</td><td>R$ ${formatarMoeda(descontoPensao)}</td></tr>
            <tr><td>Saúde (${saude.percentuais[0]}%)</td><td>R$ ${formatarMoeda(descontoSaude)}</td></tr>
            <tr style="background:#8B0000; color:white; font-weight:bold;">
                <td>Total Descontos</td>
                <td>R$ ${formatarMoeda(descontoPensao + descontoSaude + descontoIR)}</td>
</tr>

            <!-- Salário líquido -->
           <tr style="background:#004080; color:white; font-weight:bold;">
                 <td>Salário Líquido</td>
                <td>R$ ${formatarMoeda(liquido)}</td>
</tr>
        </tbody>
    </table>
    `;

    document.getElementById("resultado").innerHTML = tabela;


}

function compartilharSite() {

  if (navigator.share) {

    navigator.share({
      title: "BIZU MASTER",
      text: "Confira esse site que calcula salário e transferência dos militares automaticamente:",
      url: "https://www.bizumaster.com.br"
    });

  } else {

    navigator.clipboard.writeText(window.location.href);
    alert("Link copiado! Agora você pode compartilhar.");

  }

}

// Inicializar
carregarDados();
