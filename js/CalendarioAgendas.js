// Configuração da API Sistema ANA
const API_CONFIG = {
  baseURL: "https://api.sistemaana.com.br",
  token: "b4c24dc1e6aa2f63b04545d5a2aa2b17052e5ccd",
  headers: {
    Authorization: `Bearer b4c24dc1e6aa2f63b04545d5a2aa2b17052e5ccd`,
    "Content-Type": "application/json",
    Accept: "*/*",
  },
};

// Variáveis globais
let agendas = [];
let servicos = [];
let diasDisponiveis = [];
let currentDate = new Date();

// Utilitários
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function formatDateBR(date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateTimeString) {
  const date = new Date(dateTimeString);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatPrice(price) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(parseFloat(price));
}

function formatDuration(duration) {
  const parts = duration.split(":");
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);

  if (hours > 0) {
    return `${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`;
  }
  return `${minutes}min`;
}

function showLoading() {
  const loadingEl = document.getElementById("loadingMessage");
  if (loadingEl) {
    loadingEl.style.display = "block";
    hideMessages();
  }
}

function hideLoading() {
  const loadingEl = document.getElementById("loadingMessage");
  if (loadingEl) {
    loadingEl.style.display = "none";
  }
}

function showError(message) {
  const errorEl = document.getElementById("errorMessage");
  const successEl = document.getElementById("successMessage");

  if (errorEl && successEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
    successEl.style.display = "none";
  }
}

function showSuccess(message) {
  const errorEl = document.getElementById("errorMessage");
  const successEl = document.getElementById("successMessage");

  if (errorEl && successEl) {
    successEl.textContent = message;
    successEl.style.display = "block";
    errorEl.style.display = "none";
  }
}

function hideMessages() {
  const errorEl = document.getElementById("errorMessage");
  const successEl = document.getElementById("successMessage");

  if (errorEl) errorEl.style.display = "none";
  if (successEl) successEl.style.display = "none";
}

// Função para fazer requisições à API
async function makeAPIRequest(endpoint, options = {}) {
  try {
    const url = `${API_CONFIG.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...API_CONFIG.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `Erro ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        // Erro ao ler JSON do erro
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error(
        "Erro de conexão: Verifique se a API está acessível ou se há problemas de CORS"
      );
    }
    throw error;
  }
}

// Carregar agendas
async function carregarAgendas() {
  try {
    showLoading();

    const data = await makeAPIRequest("/api/agendamentos/agendas");
    agendas = data.agendas || [];

    const agendaSelect = document.getElementById("agendaSelect");
    if (!agendaSelect) {
      return;
    }

    // Limpar e popular o select de agendas
    agendaSelect.innerHTML = '<option value="">Selecione uma agenda</option>';

    if (agendas.length === 0) {
      agendaSelect.innerHTML =
        '<option value="">Nenhuma agenda encontrada</option>';
      showError("Nenhuma agenda foi encontrada na resposta da API.");
      return;
    }

    agendas.forEach((agenda) => {
      const option = document.createElement("option");
      option.value = agenda.calendar_key;
      option.textContent = agenda.calendar_name;
      agendaSelect.appendChild(option);
    });

    agendaSelect.disabled = false;
    hideLoading();
    showSuccess(`${agendas.length} agendas carregadas com sucesso!`);
  } catch (error) {
    hideLoading();

    let errorMsg = "Erro ao carregar agendas. ";
    if (error.message.includes("CORS")) {
      errorMsg +=
        "Problema de CORS - a API pode não estar configurada para aceitar requisições do navegador.";
    } else if (error.message.includes("Failed to fetch")) {
      errorMsg +=
        "Não foi possível conectar com a API. Verifique se a URL está correta e se a API está online.";
    } else if (error.message.includes("401")) {
      errorMsg += "Token de autorização inválido ou expirado.";
    } else {
      errorMsg += error.message;
    }

    showError(errorMsg);
  }
}

// Carregar serviços
async function carregarServicos(calendarKey) {
  try {
    if (!calendarKey) {
      return;
    }

    showLoading();

    const servicoSelect = document.getElementById("servicoSelect");
    if (!servicoSelect) {
      return;
    }

    // Resetar o select de serviços
    servicoSelect.innerHTML =
      '<option value="">Carregando serviços...</option>';
    servicoSelect.disabled = true;

    const requestBody = { calendar_key: calendarKey };

    const data = await makeAPIRequest("/api/agendamentos/agendas/servicos", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    servicos = data.services || [];

    // Resetar select de serviços
    servicoSelect.innerHTML = '<option value="">Selecione um serviço</option>';

    if (servicos.length === 0) {
      servicoSelect.innerHTML =
        '<option value="">Nenhum serviço encontrado</option>';
      servicoSelect.disabled = true;
      showError("Nenhum serviço encontrado para esta agenda.");
      return;
    }

    servicos.forEach((servico) => {
      const option = document.createElement("option");
      option.value = servico.service_key;
      option.textContent = `${servico.service_name} (${formatDuration(
        servico.duration
      )}) - ${formatPrice(servico.price)}`;
      servicoSelect.appendChild(option);
    });

    servicoSelect.disabled = false;
    hideLoading();
    showSuccess(`${servicos.length} serviços carregados!`);

    // Carregar dias disponíveis
    if (servicos.length > 0) {
      await carregarDiasDisponiveis(calendarKey);
    }
  } catch (error) {
    hideLoading();

    const servicoSelect = document.getElementById("servicoSelect");
    if (servicoSelect) {
      servicoSelect.disabled = true;
      servicoSelect.innerHTML =
        '<option value="">Erro ao carregar serviços</option>';
    }

    let errorMsg = "Erro ao carregar serviços: ";
    if (error.message.includes("404")) {
      errorMsg += "Agenda não encontrada.";
    } else if (error.message.includes("401")) {
      errorMsg += "Token de autorização inválido.";
    } else {
      errorMsg += error.message;
    }

    showError(errorMsg);
  }
}

// Event handler para mudança de agenda
window.handleAgendaChange = function (selectElement) {
  const selectedValue = selectElement.value;

  if (selectedValue) {
    carregarServicos(selectedValue);
  } else {
    const servicoSelect = document.getElementById("servicoSelect");
    const horariosGrid = document.getElementById("horariosGrid");

    if (servicoSelect) {
      servicoSelect.innerHTML =
        '<option value="">Selecione uma agenda primeiro</option>';
      servicoSelect.disabled = true;
    }
    if (horariosGrid) {
      horariosGrid.innerHTML = "";
    }
    hideMessages();
  }
};

// Event handler para mudança de serviço
window.handleServicoChange = function (selectElement) {
  const agendaSelect = document.getElementById("agendaSelect");
  const calendarKey = agendaSelect ? agendaSelect.value : null;

  if (selectElement.value && calendarKey) {
    carregarDiasDisponiveis(calendarKey, selectElement.value);
  }

  const horariosGrid = document.getElementById("horariosGrid");
  if (horariosGrid) {
    horariosGrid.innerHTML = "";
  }
  hideMessages();
};

// Carregar dias disponíveis
async function carregarDiasDisponiveis(calendarKey, serviceKey = null) {
  if (!serviceKey && servicos.length > 0) {
    serviceKey = servicos[0].service_key;
  }

  if (!serviceKey) return;

  try {
    const data = await makeAPIRequest("/api/agendamentos/agendas/dias", {
      method: "POST",
      body: JSON.stringify({
        calendar_key: calendarKey,
        service_key: serviceKey,
      }),
    });

    diasDisponiveis = data || [];
    // eslint-disable-next-line no-unused-vars
    const diasValidos = diasDisponiveis.filter(
      (dia) => dia.is_active && !dia.is_holiday
    );

    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    // Erro silencioso ao carregar dias disponíveis
  }
}

// Verificar se dia está disponível
function isDiaDisponivel(data) {
  const diaEncontrado = diasDisponiveis.find((dia) => dia.day === data);
  if (!diaEncontrado) return false;
  return (
    diaEncontrado.is_active &&
    !diaEncontrado.is_holiday &&
    !diaEncontrado.is_blocked
  );
}

// Buscar horários disponíveis
async function buscarHorariosDisponiveis() {
  const agendaSelect = document.getElementById("agendaSelect");
  const servicoSelect = document.getElementById("servicoSelect");
  const dataInput = document.getElementById("dataInput");
  const horariosGrid = document.getElementById("horariosGrid");

  const calendarKey = agendaSelect?.value;
  const serviceKey = servicoSelect?.value;
  const day = dataInput?.value;

  if (!calendarKey || !serviceKey || !day) {
    showError("Por favor, selecione a agenda, serviço e data.");
    return;
  }

  if (!isDiaDisponivel(day)) {
    showError(
      "Esta data não está disponível para agendamentos. Selecione outra data."
    );
    return;
  }

  try {
    showLoading();
    hideMessages();

    const horarios = await makeAPIRequest(
      "/api/agendamentos/agendas/horarios",
      {
        method: "POST",
        body: JSON.stringify({
          calendar_key: calendarKey,
          service_key: serviceKey,
          day: day,
        }),
      }
    );

    if (horariosGrid) {
      horariosGrid.innerHTML = "";
    }

    if (!horarios || horarios.length === 0) {
      if (horariosGrid) {
        horariosGrid.innerHTML =
          '<div class="col-12 text-center"><p>Nenhum horário disponível para esta data.</p></div>';
      }
      hideLoading();
      return;
    }

    const horariosDisponiveis = horarios.filter(
      (horario) =>
        !horario.booked &&
        !horario.blocked &&
        horario.is_open &&
        horario.number_available > 0
    );

    if (horariosDisponiveis.length === 0) {
      hideLoading();
      showError("Todos os horários desta data já estão ocupados.");
      return;
    }

    horariosDisponiveis.sort(
      (a, b) => new Date(a.start_date) - new Date(b.start_date)
    );

    if (horariosGrid) {
      horariosDisponiveis.forEach((horario) => {
        const timeSlot = document.createElement("div");
        timeSlot.className = "time-slot";

        const horarioInicio = formatTime(horario.start_date);
        const horarioFim = formatTime(horario.end_date);

        timeSlot.innerHTML = `
          <div><strong>${horarioInicio}</strong></div>
          <small>até ${horarioFim}</small>
          <div><small>${horario.number_available} vaga${
          horario.number_available > 1 ? "s" : ""
        }</small></div>
        `;

        timeSlot.onclick = function () {
          // Remove seleção anterior
          document.querySelectorAll(".time-slot.selected").forEach((slot) => {
            slot.classList.remove("selected");
            slot.style.background = "";
            slot.style.color = "";
          });

          // Seleciona o horário atual
          timeSlot.classList.add("selected");
          timeSlot.style.background = "#c9a961";
          timeSlot.style.color = "white";

          confirmarAgendamento(calendarKey, serviceKey, day, horario);
        };

        horariosGrid.appendChild(timeSlot);
      });
    }

    hideLoading();
    showSuccess(
      `${horariosDisponiveis.length} horários disponíveis para ${formatDateBR(
        new Date(day + "T00:00:00")
      )}`
    );

    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    hideLoading();
    showError("Erro ao buscar horários disponíveis. Tente novamente.");
  }
}

// Confirmar agendamento
function confirmarAgendamento() {
  const confirmacao = confirm(`Deseja prosseguir com o agendamento?`);

  if (confirmacao) {
    const mensagem = encodeURIComponent(
      "👋🏼 Olá ANA, gostaria de acessar seu Menu "
    );

    const numeroWhatsApp = "5531993668024";
    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensagem}`;

    showSuccess("Redirecionando para WhatsApp para finalizar o agendamento...");

    setTimeout(() => {
      window.open(urlWhatsApp, "_blank");
    }, 2000);
  }
}

// Função para navegar entre datas
function navegarData(direcao) {
  const dataInput = document.getElementById("dataInput");
  const currentDateEl = document.getElementById("currentDate");
  const horariosGrid = document.getElementById("horariosGrid");

  if (!dataInput) return;

  currentDate.setDate(currentDate.getDate() + direcao);
  dataInput.value = formatDate(currentDate);

  if (currentDateEl) {
    currentDateEl.textContent = formatDateBR(currentDate);
  }

  if (horariosGrid) {
    horariosGrid.innerHTML = "";
  }

  hideMessages();

  // Auto-buscar se todos os campos estiverem preenchidos
  setTimeout(autoBuscarHorarios, 300);
}

function autoBuscarHorarios() {
  const agendaSelect = document.getElementById("agendaSelect");
  const servicoSelect = document.getElementById("servicoSelect");
  const dataInput = document.getElementById("dataInput");

  if (agendaSelect?.value && servicoSelect?.value && dataInput?.value) {
    if (isDiaDisponivel(dataInput.value)) {
      buscarHorariosDisponiveis();
    }
  }
}

// Configurar event listeners
function setupEventListeners() {
  const agendaSelect = document.getElementById("agendaSelect");
  if (agendaSelect) {
    // Limpar qualquer evento existente
    agendaSelect.onchange = null;
    agendaSelect.removeAttribute("onchange");

    // Forçar o event handler inline
    agendaSelect.setAttribute("onchange", "handleAgendaChange(this)");

    // addEventListener como backup
    agendaSelect.addEventListener("change", function (event) {
      window.handleAgendaChange(event.target);
    });

    // onclick como último recurso
    agendaSelect.addEventListener("click", function (event) {
      setTimeout(() => {
        const currentValue = event.target.value;
        const previousValue =
          event.target.getAttribute("data-previous-value") || "";

        if (currentValue !== previousValue) {
          event.target.setAttribute("data-previous-value", currentValue);
          window.handleAgendaChange(event.target);
        }
      }, 100);
    });

    // Polling como último recurso
    let lastAgendaValue = "";
    const pollAgendaChange = () => {
      const currentValue = agendaSelect.value;
      if (currentValue !== lastAgendaValue && currentValue !== "") {
        lastAgendaValue = currentValue;
        window.handleAgendaChange(agendaSelect);
      } else {
        lastAgendaValue = currentValue;
      }
    };

    setInterval(pollAgendaChange, 500);
  }

  // Configurar serviços
  const servicoSelect = document.getElementById("servicoSelect");
  if (servicoSelect) {
    servicoSelect.onchange = null;
    servicoSelect.removeAttribute("onchange");
    servicoSelect.setAttribute("onchange", "handleServicoChange(this)");

    servicoSelect.addEventListener("change", function (event) {
      window.handleServicoChange(event.target);
    });
  }

  // Event delegation
  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "agendaSelect") {
      window.handleAgendaChange(event.target);
    }

    if (event.target && event.target.id === "servicoSelect") {
      window.handleServicoChange(event.target);
    }

    if (event.target && event.target.id === "dataInput") {
      const dataInput = event.target;
      const currentDateEl = document.getElementById("currentDate");
      const horariosGrid = document.getElementById("horariosGrid");

      currentDate = new Date(dataInput.value + "T00:00:00");
      if (currentDateEl) {
        currentDateEl.textContent = formatDateBR(currentDate);
      }
      if (horariosGrid) {
        horariosGrid.innerHTML = "";
      }
      hideMessages();
      setTimeout(autoBuscarHorarios, 300);
    }
  });

  // Configurar botões de navegação
  const prevDayBtn = document.getElementById("prevDay");
  const nextDayBtn = document.getElementById("nextDay");
  const buscarBtn = document.getElementById("buscarHorarios");

  if (prevDayBtn) {
    prevDayBtn.onclick = () => navegarData(-1);
  }

  if (nextDayBtn) {
    nextDayBtn.onclick = () => navegarData(1);
  }

  if (buscarBtn) {
    buscarBtn.onclick = buscarHorariosDisponiveis;
  }
}

// Inicialização da aplicação
async function initializeApp() {
  try {
    // Aguardar um pouco para garantir que DOM está pronto
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verificar elementos essenciais
    const agendaSelect = document.getElementById("agendaSelect");
    const servicoSelect = document.getElementById("servicoSelect");
    const dataInput = document.getElementById("dataInput");
    const currentDateEl = document.getElementById("currentDate");

    if (!agendaSelect || !servicoSelect || !dataInput || !currentDateEl) {
      setTimeout(initializeApp, 1000);
      return;
    }

    // Configurar data atual
    currentDate = new Date();
    dataInput.value = formatDate(currentDate);
    currentDateEl.textContent = formatDateBR(currentDate);

    // Configurar event listeners
    setupEventListeners();

    // Carregar agendas iniciais
    await carregarAgendas();
  } catch (error) {
    showError("Erro ao inicializar aplicação: " + error.message);
  }
}

// Inicialização quando DOM estiver pronto
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(initializeApp, 200);
});

window.addEventListener("load", function () {
  setTimeout(initializeApp, 300);
});

if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  setTimeout(initializeApp, 100);
}

setTimeout(function () {
  const agendaSelect = document.getElementById("agendaSelect");
  if (agendaSelect && !agendaSelect.hasAttribute("data-initialized")) {
    initializeApp();
  }
}, 2000);
