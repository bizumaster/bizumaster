// defasagem.js — calculadora comparativa de defasagem do transporte de bagagem militar

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function carregarLocalidadesDefasagem() {
  try {
    const response = await fetch("./json/origemedestino.json");
    const dados = await response.json();

    const origemSelect = document.getElementById("origem");
    const destinoSelect = document.getElementById("destino");
    if (!origemSelect || !destinoSelect) return;

    origemSelect.innerHTML = '<option value="">Selecione</option>';
    destinoSelect.innerHTML = '<option value="">Selecione</option>';

    (dados.localidades || []).forEach(localidade => {
      const opt1 = document.createElement("option");
      opt1.value = localidade;
      opt1.textContent = localidade;
      origemSelect.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = localidade;
      opt2.textContent = localidade;
      destinoSelect.appendChild(opt2);
    });
  } catch (error) {
    console.error("Erro ao carregar origemedestino.json:", error);
    const resultado = document.getElementById("resultadoDefasagem");
    if (resultado) {
      resultado.innerHTML = `<div style="color:red">Erro ao carregar localidades. Veja console.</div>`;
    }
  }
}

function buscarValorPorM3(tabela, distancia) {
  for (const faixa of (tabela || [])) {
    const min = Number(faixa.min) || 0;
    const max = faixa.max == null ? Infinity : Number(faixa.max);
    if (distancia >= min && distancia <= max) {
      return Number(faixa.valorPorM3) || 0;
    }
  }
  return 0;
}

async function calcularDefasagem(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();

  const resultadoDiv = document.getElementById("resultadoDefasagem");
  if (resultadoDiv) resultadoDiv.innerHTML = "";

  const normalize = s => (s || "").toString().normalize
    ? s.toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "")
        .toLowerCase()
        .trim()
    : s.toString().toLowerCase().trim();

  const findKeyInsensitive = (obj, key) => {
    if (!obj || !key) return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, key)) return key;

    const target = normalize(key);
    for (const k of Object.keys(obj)) {
      if (normalize(k) === target) return k;
    }
    return undefined;
  };

  try {
    const origemRaw = document.getElementById("origem")?.value;
    const destinoRaw = document.getElementById("destino")?.value;
    const patenteRaw = localStorage.getItem("patenteSelecionada");
    const remuneracaoBruta = Number(localStorage.getItem("remuneracaoBruta"));

    const veiculoResposta = document.getElementById("veiculo")?.value || "";
    const tipoVeiculo = document.getElementById("tipoVeiculo")?.value || "";

    const valorLocalidadeStored = localStorage.getItem("valorLocalidade");
    const valorLocalidade = (() => {
      const texto = (valorLocalidadeStored || "0").toString().trim();
      let n = Number(texto);
      if (Number.isFinite(n)) return n;
      n = Number(texto.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    })();

    const remuneracaoParaAjuda = Math.max(0, remuneracaoBruta - valorLocalidade);

    if (!origemRaw || !destinoRaw || !patenteRaw || Number.isNaN(remuneracaoBruta)) {
      const msg = "Preencha a aba Salário antes de calcular a defasagem.";
      if (resultadoDiv) resultadoDiv.innerHTML = `<div style="color:darkorange">${msg}</div>`;
      console.warn(msg);
      return;
    }

    if (!veiculoResposta) {
      const msg = "Selecione se haverá veículo na transferência.";
      if (resultadoDiv) resultadoDiv.innerHTML = `<div style="color:darkorange">${msg}</div>`;
      return;
    }

    if (veiculoResposta === "sim" && !tipoVeiculo) {
      const msg = "Selecione o tipo de veículo.";
      if (resultadoDiv) resultadoDiv.innerHTML = `<div style="color:darkorange">${msg}</div>`;
      return;
    }

    const [
      distJSON, valorAtualJSON, valorIPCAJSON, valorSMJSON,
      transitoJSON, cubagemJSON, ajudaJSON
    ] = await Promise.all([
      fetch("./json/distancia.json").then(r => r.json()),
      fetch("./json/valorpordistancia.json").then(r => r.json()),
      fetch("./json/valorpordistanciaIPCA.json").then(r => r.json()),
      fetch("./json/valorpordistanciaSM.json").then(r => r.json()),
      fetch("./json/transito.json").then(r => r.json()),
      fetch("./json/cubagem.json").then(r => r.json()),
      fetch("./json/ajudadecusto.json").then(r => r.json())
    ]);

    const origemKey = findKeyInsensitive(distJSON, origemRaw);
    if (!origemKey) {
      const msg = `Origem "${origemRaw}" não encontrada em distancia.json.`;
      if (resultadoDiv) resultadoDiv.innerHTML = `<div style="color:red">${msg}</div>`;
      console.warn(msg);
      return;
    }

    const destinoObj = distJSON[origemKey] || {};
    const destinoKey = findKeyInsensitive(destinoObj, destinoRaw);
    if (!destinoKey) {
      const msg = `Destino "${destinoRaw}" não encontrado em distancia.json para a origem "${origemKey}".`;
      if (resultadoDiv) resultadoDiv.innerHTML = `<div style="color:red">${msg}</div>`;
      console.warn(msg);
      return;
    }

    const distancia = Number(destinoObj[destinoKey]);
    if (Number.isNaN(distancia)) {
      const msg = `Distância inválida entre ${origemKey} → ${destinoKey}.`;
      if (resultadoDiv) resultadoDiv.innerHTML = `<div style="color:red">${msg}</div>`;
      console.error(msg);
      return;
    }

    // dias de trânsito
    let diasTransito = 0;
    for (const faixa of (transitoJSON || [])) {
      const min = Number(faixa.min) || 0;
      const max = faixa.max == null ? Infinity : Number(faixa.max);
      if (distancia >= min && distancia <= max) {
        diasTransito = Number(faixa.dias) || 0;
        break;
      }
    }

    // valores por m³ nas 3 tabelas
    const valorAtual = buscarValorPorM3(valorAtualJSON, distancia);
    const valorIPCA = buscarValorPorM3(valorIPCAJSON, distancia);
    const valorSM = buscarValorPorM3(valorSMJSON, distancia);

    // cubagem
    const patenteKey = findKeyInsensitive(cubagemJSON, patenteRaw);
    let cubagemBase = 0;
    const mensagens = [];

    if (!patenteKey) {
      mensagens.push(`Patente "${patenteRaw}" não encontrada em cubagem.json.`);
    } else {
      cubagemBase = Number(cubagemJSON[patenteKey]) || 0;
    }

    let multiplicadorVeiculo = 1;
    if (veiculoResposta === "sim") {
      if (tipoVeiculo === "carro") multiplicadorVeiculo += 0.12;
      else if (tipoVeiculo === "moto") multiplicadorVeiculo += 0.03;
      else if (tipoVeiculo === "carro_moto") multiplicadorVeiculo += 0.15;
    }

    const cubagemAjustada = cubagemBase * multiplicadorVeiculo;

    if (cubagemBase === 0) {
      mensagens.push(`Cubagem base igual a 0 para a patente. Resultado pode ser 0.`);
    }

    const transporteAtual = cubagemAjustada * valorAtual;
    const transporteIPCA = cubagemAjustada * valorIPCA;
    const transporteSM = cubagemAjustada * valorSM;

    // ajuda de custo (referência, não corrigida — não vem da tabela do decreto)
    const dependenteVal = document.getElementById("dependente")?.value;
    const especialVal = document.getElementById("especial")?.value;
    const dependente = dependenteVal === "sim";
    const especial = especialVal === "sim";

    let multiplicadorAjuda = 0;
    for (const ajuda of (ajudaJSON?.ajuda_de_custo || [])) {
      if (ajuda.dependente === dependente && ajuda.especial === especial) {
        multiplicadorAjuda = Number(ajuda.multiplicador) || 0;
        break;
      }
    }

    const ajudaDeCusto = Number(remuneracaoParaAjuda || 0) * multiplicadorAjuda;

    const totalAtual = transporteAtual + ajudaDeCusto;
    const totalIPCA = transporteIPCA + ajudaDeCusto;
    const totalSM = transporteSM + ajudaDeCusto;

    const diferencaSM = transporteSM - transporteAtual;
    const percentualSM = transporteAtual > 0
      ? ((transporteSM / transporteAtual - 1) * 100)
      : 0;

    console.log("DEBUG_DEFASAGEM", {
      origemKey, destinoKey, distancia, diasTransito,
      valorAtual, valorIPCA, valorSM,
      cubagemBase, cubagemAjustada,
      transporteAtual, transporteIPCA, transporteSM,
      ajudaDeCusto, totalAtual, totalIPCA, totalSM
    });

    if (resultadoDiv) {
      let avisosHTML = "";
      if (mensagens.length) {
        avisosHTML = `<div style="color:darkorange; margin-bottom:8px;">${mensagens.join(" / ")}</div>`;
      }

      resultadoDiv.innerHTML = `
        ${avisosHTML}

        <table class="tabela-comparativa-defasagem">
          <thead>
            <tr>
              <th>Transporte de Bagagem (${cubagemAjustada.toFixed(1)} m³ — ${distancia} km)</th>
              <th>Tabela de 2002 (atual)</th>
              <th>Corrigido pelo IPCA</th>
              <th>Corrigido pelo Salário Mínimo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Valor a receber</td>
              <td>R$ ${formatarMoeda(transporteAtual)}</td>
              <td>R$ ${formatarMoeda(transporteIPCA)}</td>
              <td class="destaque-sm">R$ ${formatarMoeda(transporteSM)}</td>
            </tr>

            <tr class="linha-secao">
              <td colspan="4">Demais itens da transferência (não afetados pelo decreto de 2002)</td>
            </tr>

            <tr>
              <td>Dias de Trânsito</td>
              <td colspan="3" class="valor-unico">${diasTransito}</td>
            </tr>
            <tr>
              <td>Ajuda de Custo (referência)</td>
              <td colspan="3" class="valor-unico">R$ ${formatarMoeda(ajudaDeCusto)}</td>
            </tr>

            <tr class="linha-total">
              <td>Total da Transferência</td>
              <td>R$ ${formatarMoeda(totalAtual)}</td>
              <td>R$ ${formatarMoeda(totalIPCA)}</td>
              <td class="destaque-sm">R$ ${formatarMoeda(totalSM)}</td>
            </tr>
          </tbody>
        </table>

        <div class="resumo-defasagem">
          <p>
            Se a tabela do transporte de bagagem (Anexo V do Decreto nº 4.307/2002) tivesse
            sido corrigida pelo salário mínimo desde 2002, você receberia
            <strong>R$ ${formatarMoeda(diferencaSM)}</strong> a mais nesta transferência —
            um valor <strong>${percentualSM.toFixed(0)}% maior</strong> do que o pago hoje.
          </p>
        </div>
      `;
    }
  } catch (error) {
    console.error("Erro ao calcular defasagem:", error);
    const resultadoDiv = document.getElementById("resultadoDefasagem");
    if (resultadoDiv) {
      resultadoDiv.innerHTML = `<div style="color:red">Erro ao calcular. Veja console para detalhes.</div>`;
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  carregarLocalidadesDefasagem();

  const veiculoEl = document.getElementById("veiculo");
  const opcoesVeiculo = document.getElementById("opcoesVeiculo");
  const tipoVeiculo = document.getElementById("tipoVeiculo");

  if (veiculoEl && opcoesVeiculo && tipoVeiculo) {
    opcoesVeiculo.style.display = veiculoEl.value === "sim" ? "block" : "none";

    veiculoEl.addEventListener("change", function () {
      if (this.value === "sim") {
        opcoesVeiculo.style.display = "block";
      } else {
        opcoesVeiculo.style.display = "none";
        tipoVeiculo.value = "";
      }
    });
  }

  const calcularBtn = document.getElementById("calcularDefasagemBtn");
  if (calcularBtn) {
    calcularBtn.addEventListener("click", calcularDefasagem);
  }
});
