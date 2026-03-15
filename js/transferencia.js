// transferencia.js (ajustado ao HTML atual)

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// carregar localidades
async function carregarLocalidades() {
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
    const resultado = document.getElementById("resultadoTransferencia");
    if (resultado) {
      resultado.innerHTML = `<div style="color:red">Erro ao carregar localidades. Veja console.</div>`;
    }
  }
}

async function calcularIndenizacao(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();

  const resultadoDiv = document.getElementById("resultadoTransferencia");
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

    // lê o valor do adicional de localidade (padrão 0 se não existir)
    const valorLocalidadeStored = localStorage.getItem("valorLocalidade");
    const valorLocalidade = (() => {
      const texto = (valorLocalidadeStored || "0").toString().trim();

      let n = Number(texto);
      if (Number.isFinite(n)) return n;

      n = Number(texto.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    })();

    // remuneração usada exclusivamente no cálculo da ajuda de custo
    const remuneracaoParaAjuda = Math.max(0, remuneracaoBruta - valorLocalidade);

    if (!origemRaw || !destinoRaw || !patenteRaw || Number.isNaN(remuneracaoBruta)) {
      const msg = "Preencha a aba Salário antes de calcular a transferência.";
      if (resultadoDiv) {
        resultadoDiv.innerHTML = `<div style="color:darkorange">${msg}</div>`;
      }
      console.warn(msg);
      return;
    }

    if (!veiculoResposta) {
      const msg = "Selecione se haverá veículo na transferência.";
      if (resultadoDiv) {
        resultadoDiv.innerHTML = `<div style="color:darkorange">${msg}</div>`;
      }
      return;
    }

    if (veiculoResposta === "sim" && !tipoVeiculo) {
      const msg = "Selecione o tipo de veículo.";
      if (resultadoDiv) {
        resultadoDiv.innerHTML = `<div style="color:darkorange">${msg}</div>`;
      }
      return;
    }

    // carregar JSONs
    const [distJSON, valorJSON, transitoJSON, cubagemJSON, ajudaJSON] = await Promise.all([
      fetch("./json/distancia.json").then(r => r.json()),
      fetch("./json/valorpordistancia.json").then(r => r.json()),
      fetch("./json/transito.json").then(r => r.json()),
      fetch("./json/cubagem.json").then(r => r.json()),
      fetch("./json/ajudadecusto.json").then(r => r.json())
    ]);

    // encontrar chaves de origem/destino tolerantes
    const origemKey = findKeyInsensitive(distJSON, origemRaw);
    if (!origemKey) {
      const msg = `Origem "${origemRaw}" não encontrada em distancia.json (verifique nomes).`;
      if (resultadoDiv) resultadoDiv.innerHTML = `<div style="color:red">${msg}</div>`;
      console.warn(msg, "Chaves disponíveis:", Object.keys(distJSON || {}).slice(0, 10));
      return;
    }

    const destinoObj = distJSON[origemKey] || {};
    const destinoKey = findKeyInsensitive(destinoObj, destinoRaw);
    if (!destinoKey) {
      const msg = `Destino "${destinoRaw}" não encontrado em distancia.json para a origem "${origemKey}".`;
      if (resultadoDiv) resultadoDiv.innerHTML = `<div style="color:red">${msg}</div>`;
      console.warn(msg, "Chaves disponíveis para origem:", Object.keys(destinoObj || {}).slice(0, 10));
      return;
    }

    const distancia = Number(destinoObj[destinoKey]);
    if (Number.isNaN(distancia)) {
      const msg = `Distância inválida entre ${origemKey} → ${destinoKey}: ${destinoObj[destinoKey]}`;
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

    // valor por m³
    let valorPorM3 = 0;
    for (const faixa of (valorJSON || [])) {
      const min = Number(faixa.min) || 0;
      const max = faixa.max == null ? Infinity : Number(faixa.max);
      if (distancia >= min && distancia <= max) {
        valorPorM3 = Number(faixa.valorPorM3) || 0;
        break;
      }
    }

    // cubagem
    const patenteKey = findKeyInsensitive(cubagemJSON, patenteRaw);
    let cubagemBase = 0;
    const mensagens = [];

    if (!patenteKey) {
      mensagens.push(`Patente "${patenteRaw}" não encontrada em cubagem.json.`);
      console.warn(mensagens[mensagens.length - 1]);
    } else {
      cubagemBase = Number(cubagemJSON[patenteKey]) || 0;
    }

    // multiplicador do veículo
    let multiplicadorVeiculo = 1;

    if (veiculoResposta === "sim") {
      if (tipoVeiculo === "carro") {
        multiplicadorVeiculo += 0.12;
      } else if (tipoVeiculo === "moto") {
        multiplicadorVeiculo += 0.03;
      } else if (tipoVeiculo === "carro_moto") {
        multiplicadorVeiculo += 0.15;
      }
    }

    const cubagemAjustada = cubagemBase * multiplicadorVeiculo;

    if (valorPorM3 === 0) {
      mensagens.push(`Nenhum valor encontrado em valorpordistancia.json para ${distancia} km. Usando 0.`);
    }

    if (cubagemBase === 0) {
      mensagens.push(`Cubagem base igual a 0 para a patente. Resultado pode ser 0.`);
    }

    const transporteBagagem = Number(cubagemAjustada || 0) * Number(valorPorM3 || 0);

    // ajuda de custo
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
    const total = transporteBagagem + ajudaDeCusto;

    console.log("DEBUG_TRANSFERENCIA", {
      origemRaw,
      origemKey,
      destinoRaw,
      destinoKey,
      distancia,
      diasTransito,
      valorPorM3,
      patenteRaw,
      patenteKey,
      cubagemBase,
      veiculoResposta,
      tipoVeiculo,
      multiplicadorVeiculo,
      cubagemAjustada,
      transporteBagagem,
      multiplicadorAjuda,
      ajudaDeCusto,
      total
    });

    if (resultadoDiv) {
      let avisosHTML = "";
      if (mensagens.length) {
        avisosHTML = `<div style="color:darkorange; margin-bottom:8px;">${mensagens.join(" / ")}</div>`;
      }

      resultadoDiv.innerHTML = `
        ${avisosHTML}
        <table border="1" cellpadding="5" cellspacing="0" style="width:100%; border-collapse: collapse;">
          <thead>
            <tr style="background:#004080; color:white;">
              <th colspan="2">Resumo da Transferência</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Dias de Trânsito</td><td>${diasTransito}</td></tr>
            <tr><td>Transporte de Bagagem</td><td>R$ ${formatarMoeda(transporteBagagem)}</td></tr>
            <tr><td>Ajuda de Custo</td><td>R$ ${formatarMoeda(ajudaDeCusto)}</td></tr>
            <tr style="background:#006400; color:white; font-weight:bold;">
              <td>Total da Transferência</td>
              <td>R$ ${formatarMoeda(total)}</td>
            </tr>
          </tbody>
        </table>
      `;
    }
  } catch (error) {
    console.error("Erro ao calcular transferência:", error);
    if (resultadoDiv) {
      resultadoDiv.innerHTML = `<div style="color:red">Erro ao calcular transferência. Veja console para detalhes.</div>`;
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  carregarLocalidades();

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

  const calcularBtn = document.getElementById("calcularBtn");
  if (calcularBtn) {
    calcularBtn.addEventListener("click", calcularIndenizacao);
  }
});