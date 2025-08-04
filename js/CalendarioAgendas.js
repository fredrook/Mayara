let carrinho = [];
let tipoPagamento = 'integral';
let clienteData = null;
let isPackageService = false;
let packageWeeks = [];
let selectedPackageDays = [];


const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
};

const PAYMENT_CONFIG = {
  walletId: process.env.WALLET_ID_ANA,
  apiKey: process.env.TOKEN_API_KEY_ANA
};

// ===== FUNÇÃO DE CONEXÃO COM BANCO =====
async function executarQueryPostgreSQL(query, params = []) {
  try {
    // Usar a URL de conexão completa do .env
    const databaseUrl = process.env.DATABASE_URL || 
      `postgresql://${DB_CONFIG.username}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`;
    
    // Fazer requisição para endpoint que executa queries no PostgreSQL
    const response = await makeAPIRequest("/api/database/execute", {
      method: "POST",
      body: JSON.stringify({
        connectionString: databaseUrl,
        query: query,
        params: params
      })
    });
    
    return response;
  } catch (error) {
    console.error("Erro ao executar query PostgreSQL:", error);
    throw error;
  }
}
// ===== FUNÇÕES DE CARRINHO =====

function adicionarAoCarrinho(agendamento) {
  // Verificar se é um serviço de pacote
  const servico = servicos.find(s => s.service_key === agendamento.serviceKey);
  
  if (isServicoPackage(servico)) {
    // Para pacotes, validar se tem 4 dias selecionados
    if (selectedPackageDays.length !== 4) {
      showError("Para pacotes, você deve selecionar exatamente 4 dias (1 por semana).");
      return;
    }
    
    // Adicionar todos os dias do pacote
    selectedPackageDays.forEach((dayData, index) => {
      const packageItem = {
        id: Date.now() + index,
        calendarKey: agendamento.calendarKey,
        serviceKey: agendamento.serviceKey,
        serviceName: servico.service_name,
        day: dayData.day,
        horario: dayData.horario,
        price: parseFloat(servico.price) / 4,
        duration: servico.duration,
        isPackage: true,
        packageWeek: index + 1
      };
      carrinho.push(packageItem);
    });
    
    // Limpar seleção de pacote
    selectedPackageDays = [];
    hidePackageSelector();
  } else {
    // Serviço normal
    const item = {
      id: Date.now(),
      calendarKey: agendamento.calendarKey,
      serviceKey: agendamento.serviceKey,
      serviceName: servico.service_name,
      day: agendamento.day,
      horario: agendamento.horario,
      price: parseFloat(servico.price),
      duration: servico.duration,
      isPackage: false
    };
    carrinho.push(item);
  }
  
  atualizarCarrinho();
  showSuccess(`Agendamento adicionado ao carrinho!`);
}

function removerDoCarrinho(itemId) {
  carrinho = carrinho.filter(item => item.id !== itemId);
  atualizarCarrinho();
  showSuccess("Item removido do carrinho.");
}

function atualizarCarrinho() {
  const carrinhoSection = document.getElementById('carrinhoSection');
  const carrinhoItems = document.getElementById('carrinhoItems');
  const carrinhoSummary = document.getElementById('carrinhoSummary');
  const clienteSection = document.getElementById('clienteSection');
  
  if (carrinho.length === 0) {
    carrinhoSection.classList.add('hidden');
    clienteSection.classList.add('hidden');
    carrinhoItems.innerHTML = '<div class="carrinho-empty">Nenhum agendamento adicionado ainda.</div>';
    return;
  }
  
  carrinhoSection.classList.remove('hidden');
  clienteSection.classList.remove('hidden');
  
  // Renderizar itens do carrinho
  carrinhoItems.innerHTML = '';
  carrinho.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'carrinho-item';
    
    const dayFormatted = formatDateBR(new Date(item.day + 'T00:00:00'));
    const packageInfo = item.isPackage ? ` (Pacote - Semana ${item.packageWeek})` : '';
    
    itemDiv.innerHTML = `
      <button class="remove-btn" onclick="removerDoCarrinho(${item.id})" title="Remover">×</button>
      <div><strong>${item.serviceName}${packageInfo}</strong></div>
      <div>📅 ${dayFormatted}</div>
      <div>🕐 ${item.horario}</div>
      <div>⏱️ ${formatDuration(item.duration)}</div>
      <div><strong>${formatPrice(item.price)}</strong></div>
    `;
    
    carrinhoItems.appendChild(itemDiv);
  });
  
  // Atualizar resumo
  const totalServicos = carrinho.length;
  const valorTotal = carrinho.reduce((sum, item) => sum + item.price, 0);
  
  document.getElementById('totalServicos').textContent = totalServicos;
  document.getElementById('valorTotal').textContent = formatPrice(valorTotal);
  
  carrinhoSummary.classList.remove('hidden');
}

// ===== FUNÇÕES DE PACOTE =====

function isServicoPackage(servico) {
  // Verificar se o serviço é um pacote (pode ser baseado no nome ou uma propriedade específica)
  return servico && (
    servico.service_name.toLowerCase().includes('pacote') ||
    servico.service_name.toLowerCase().includes('package') ||
    servico.is_package === true
  );
}

function showPackageSelector() {
  const packageSelector = document.getElementById('packageSelector');
  const packageWeeks = document.getElementById('packageWeeks');
  
  packageSelector.style.display = 'block';
  
  // Gerar 4 semanas a partir da data atual
  const startDate = new Date();
  packageWeeks.innerHTML = '';
  
  for (let week = 0; week < 4; week++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + (week * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekDiv = document.createElement('div');
    weekDiv.className = 'package-week';
    weekDiv.innerHTML = `
      <div class="week-title">Semana ${week + 1}: ${formatDateBR(weekStart)} - ${formatDateBR(weekEnd)}</div>
      <div class="row">
        <div class="col-md-6">
          <input type="date" class="form-control" 
                 id="packageDate${week}" 
                 min="${formatDate(weekStart)}" 
                 max="${formatDate(weekEnd)}"
                 onchange="handlePackageDateChange(${week}, this.value)" />
        </div>
        <div class="col-md-6">
          <select class="form-control" id="packageTime${week}" disabled>
            <option value="">Selecione uma data primeiro</option>
          </select>
        </div>
      </div>
    `;
    
    packageWeeks.appendChild(weekDiv);
  }
}

function hidePackageSelector() {
  const packageSelector = document.getElementById('packageSelector');
  packageSelector.style.display = 'none';
  selectedPackageDays = [];
}

async function handlePackageDateChange(weekIndex, date) {
  if (!date) return;
  
  const agendaSelect = document.getElementById('agendaSelect');
  const servicoSelect = document.getElementById('servicoSelect');
  const timeSelect = document.getElementById(`packageTime${weekIndex}`);
  
  const calendarKey = agendaSelect.value;
  const serviceKey = servicoSelect.value;
  
  if (!calendarKey || !serviceKey) return;
  
  try {
    showLoading();
    
    const horarios = await makeAPIRequest("/api/agendamentos/agendas/horarios", {
      method: "POST",
      body: JSON.stringify({
        calendar_key: calendarKey,
        service_key: serviceKey,
        day: date,
      }),
    });
    
    timeSelect.innerHTML = '<option value="">Selecione um horário</option>';
    
    if (horarios && horarios.length > 0) {
      const horariosDisponiveis = horarios.filter(
        (horario) => !horario.booked && !horario.blocked && horario.is_open && horario.number_available > 0
      );
      
      horariosDisponiveis.forEach((horario) => {
        const option = document.createElement("option");
        option.value = JSON.stringify({
          start_date: horario.start_date,
          end_date: horario.end_date
        });
        option.textContent = `${formatTime(horario.start_date)} às ${formatTime(horario.end_date)}`;
        timeSelect.appendChild(option);
      });
      
      timeSelect.disabled = false;
      timeSelect.onchange = () => handlePackageTimeChange(weekIndex, date, timeSelect.value);
    }
    
    hideLoading();
  } catch (error) {
    hideLoading();
    showError("Erro ao carregar horários para esta data.");
  }
}

function handlePackageTimeChange(weekIndex, date, horarioData) {
  if (!horarioData) return;
  
  const horario = JSON.parse(horarioData);
  const horarioFormatted = `${formatTime(horario.start_date)} às ${formatTime(horario.end_date)}`;
  
  // Atualizar array de dias selecionados do pacote
  const existingIndex = selectedPackageDays.findIndex(day => day.week === weekIndex);
  
  if (existingIndex >= 0) {
    selectedPackageDays[existingIndex] = {
      week: weekIndex,
      day: date,
      horario: horarioFormatted,
      horarioData: horario
    };
  } else {
    selectedPackageDays.push({
      week: weekIndex,
      day: date,
      horario: horarioFormatted,
      horarioData: horario
    });
  }
  
  // Verificar se todas as 4 semanas foram selecionadas
  if (selectedPackageDays.length === 4) {
    showSuccess("Todas as 4 semanas foram selecionadas! Você pode adicionar o pacote ao carrinho.");
  }
}

// ===== FUNÇÕES DE PAGAMENTO =====

function setupPaymentOptions() {
  const paymentOptions = document.querySelectorAll('.payment-option');
  
  paymentOptions.forEach(option => {
    option.addEventListener('click', function() {
      // Remover seleção anterior
      paymentOptions.forEach(opt => opt.classList.remove('selected'));
      
      // Selecionar opção atual
      this.classList.add('selected');
      tipoPagamento = this.dataset.type;
      
      atualizarResumoComPagamento();
    });
  });
}

function atualizarResumoComPagamento() {
  const valorTotal = carrinho.reduce((sum, item) => sum + item.price, 0);
  let valorPagar = valorTotal;
  
  if (tipoPagamento === 'sinal') {
    valorPagar = valorTotal * 0.5; // 50% do valor total
  }
  
  const valorTotalEl = document.getElementById('valorTotal');
  if (valorTotalEl) {
    if (tipoPagamento === 'sinal') {
      valorTotalEl.innerHTML = `${formatPrice(valorPagar)} <small>(Sinal de ${formatPrice(valorTotal)})</small>`;
    } else {
      valorTotalEl.textContent = formatPrice(valorPagar);
    }
  }
}

// ===== FUNÇÕES DE CLIENTE =====

async function buscarOuCriarCliente(nome, telefone) {
  try {
    // Formatar telefone no padrão do sistema: '553189918191'
    const telefoneFormatado = formatarTelefoneParaSistema(telefone);
    
    // 1. Consulta direta na tabela client_b2c para verificar se cliente existe
    const consultaSQL = `
      SELECT id, name, phone, email, created_at, updated_at 
      FROM client_b2c 
      WHERE phone = $1 
      LIMIT 1
    `;
    
    let clienteExistente = null;
    try {
      const resultadoConsulta = await executarQueryPostgreSQL(consultaSQL, [telefoneFormatado]);
      
      if (resultadoConsulta && resultadoConsulta.rows && resultadoConsulta.rows.length > 0) {
        clienteExistente = resultadoConsulta.rows[0];
      }
    } catch (consultaError) {
      console.log("Cliente não encontrado ou erro na consulta, será criado novo cliente");
    }
    
    if (clienteExistente) {
      // Cliente já existe na tabela client_b2c
      console.log("Cliente encontrado na base:", clienteExistente);
      clienteData = {
        id: clienteExistente.id,
        name: clienteExistente.name || nome,
        phone: clienteExistente.phone,
        email: clienteExistente.email || `${telefoneFormatado}@cliente.temp`
      };
      return clienteData;
    } else {
      // 2. Cliente não existe, persistir na tabela client_b2c
      const insertSQL = `
        INSERT INTO client_b2c (name, phone, email, created_at, updated_at) 
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id, name, phone, email, created_at, updated_at
      `;
      
      try {
        const emailTemp = `${telefoneFormatado}@cliente.temp`;
        const resultadoInsert = await executarQueryPostgreSQL(insertSQL, [nome, telefoneFormatado, emailTemp]);
        
        if (resultadoInsert && resultadoInsert.rows && resultadoInsert.rows.length > 0) {
          const novoClienteCriado = resultadoInsert.rows[0];
          console.log("Novo cliente criado na tabela client_b2c:", novoClienteCriado);
          
          clienteData = {
            id: novoClienteCriado.id,
            name: novoClienteCriado.name,
            phone: novoClienteCriado.phone,
            email: novoClienteCriado.email
          };
          
          return clienteData;
        } else {
          throw new Error("Erro ao obter dados do cliente recém-criado");
        }
        
      } catch (insertError) {
        console.error("Erro ao inserir cliente na tabela client_b2c:", insertError);
        throw new Error("Erro ao criar cliente na base de dados: " + insertError.message);
      }
    }
  } catch (error) {
    console.error("Erro ao buscar/criar cliente:", error);
    throw new Error("Erro ao processar dados do cliente: " + error.message);
  }
}

// Função auxiliar para formatar telefone no padrão do sistema
function formatarTelefoneParaSistema(telefone) {
  // Remove todos os caracteres não numéricos
  let telefoneClean = telefone.replace(/\D/g, '');
  
  // Se o telefone não tem código do país (55), adiciona
  if (telefoneClean.length === 11 && telefoneClean.startsWith('0')) {
    // Remove o 0 inicial se houver
    telefoneClean = telefoneClean.substring(1);
  }
  
  // Adiciona código do país se não tiver
  if (telefoneClean.length === 10 || telefoneClean.length === 11) {
    if (!telefoneClean.startsWith('55')) {
      telefoneClean = '55' + telefoneClean;
    }
  }
  
  // Formato final esperado: 553189918191 (55 + DDD + número)
  return telefoneClean;
}

// ===== FUNÇÃO PRINCIPAL DE FINALIZAÇÃO =====

async function finalizarAgendamento() {
  try {
    // Validar dados obrigatórios
    const nome = document.getElementById('clienteNome').value.trim();
    const telefone = document.getElementById('clienteTelefone').value.trim();
    
    if (!nome || !telefone) {
      showError("Por favor, preencha seu nome e telefone.");
      return;
    }
    
    if (carrinho.length === 0) {
      showError("Adicione pelo menos um agendamento ao carrinho.");
      return;
    }
    
    if (!tipoPagamento) {
      showError("Selecione uma forma de pagamento.");
      return;
    }
    
    showLoading();
    
    // 1. Buscar ou criar cliente
    await buscarOuCriarCliente(nome, telefone);
    
    // 2. Calcular valores
    const valorTotal = carrinho.reduce((sum, item) => sum + item.price, 0);
    const valorPagar = tipoPagamento === 'sinal' ? valorTotal * 0.5 : valorTotal;
    
    // 3. Gerar link de pagamento
    const linkPagamento = await gerarLinkPagamento(valorPagar, valorTotal);
    
    // 4. Criar agendamentos
    const agendamentosArray = await criarAgendamentos();
    
    // 5. Exibir resultado
    hideLoading();
    mostrarResultadoFinal(linkPagamento, agendamentosArray);
    
  } catch (error) {
    hideLoading();
    showError(`Erro ao finalizar agendamento: ${error.message}`);
  }
}

async function gerarLinkPagamento(valorPagar, valorTotal) {
  const servicos = carrinho.map(item => item.serviceName).join(', ');
  const nomeServico = `Agendamento: ${servicos}`;
  
  const requestBody = {
    valor: valorPagar,
    nomeServico: nomeServico,
    ASAAS_API_KEY: PAYMENT_CONFIG.apiKey,
    ASAAS_WALLET_ID: PAYMENT_CONFIG.walletId,
    aceitarSinal: tipoPagamento === 'sinal',
    percentilSinal: tipoPagamento === 'sinal' ? 50 : 100
  };
  
  const response = await makeAPIRequest("/api/pagamentos/link", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
  
  return response.data;
}

async function criarAgendamentos() {
  const agendamentosArray = [];
  
  for (const item of carrinho) {
    const agendamento = {
      status: "confirmed",
      calendar_key: item.calendarKey,
      service_list: [
        {
          service_key: item.serviceKey
        }
      ],
      owner_user: {
        email: "sistema@mayarasilvano.com" // Email do sistema
      },
      attendees: [
        {
          name: clienteData.name,
          email: clienteData.email,
          phone: clienteData.phone
        }
      ],
      start: {
        dateTime: `${item.day}T${item.horario.split(' às ')[0]}:00.000Z`
      },
      verify_limits: true,
      send_email: true,
      include_flows: true
    };
    
    try {
      const resultado = await makeAPIRequest("/api/agendamentos/criar", {
        method: "POST",
        body: JSON.stringify(agendamento),
      });
      
      agendamentosArray.push({
        ...item,
        agendamentoId: resultado.id,
        status: 'criado'
      });
    } catch (error) {
      console.error(`Erro ao criar agendamento para ${item.serviceName}:`, error);
      agendamentosArray.push({
        ...item,
        status: 'erro',
        erro: error.message
      });
    }
  }
  
  return agendamentosArray;
}

function mostrarResultadoFinal(linkPagamento, agendamentosArray) {
  const agendamentosComSucesso = agendamentosArray.filter(a => a.status === 'criado');
  const agendamentosComErro = agendamentosArray.filter(a => a.status === 'erro');
  
  let mensagem = `<div style="text-align: center; padding: 20px;">`;
  mensagem += `<h3 style="color: #28a745;">🎉 Agendamentos Processados!</h3>`;
  
  if (agendamentosComSucesso.length > 0) {
    mensagem += `<p><strong>${agendamentosComSucesso.length} agendamento(s) criado(s) com sucesso!</strong></p>`;
  }
  
  if (agendamentosComErro.length > 0) {
    mensagem += `<p style="color: #dc3545;"><strong>${agendamentosComErro.length} agendamento(s) com erro.</strong></p>`;
  }
  
  if (linkPagamento && linkPagamento.url) {
    mensagem += `<p><a href="${linkPagamento.url}" target="_blank" class="btn-finalizar" style="display: inline-block; margin: 10px;">💳 Realizar Pagamento</a></p>`;
  }
  
  mensagem += `<p style="color: #6c757d; font-size: 14px;">Você receberá confirmações no seu celular após o pagamento.</p>`;
  mensagem += `</div>`;
  
  // Exibir em modal ou substituir conteúdo da página
  const container = document.querySelector('.container');
  const novoConteudo = document.createElement('div');
  novoConteudo.innerHTML = mensagem;
  
  container.innerHTML = '';
  container.appendChild(novoConteudo);
  
  // Limpar carrinho
  carrinho = [];
  selectedPackageDays = [];
}

// ===== MODIFICAÇÕES NAS FUNÇÕES EXISTENTES =====

// Modificar a função confirmarAgendamento existente
function confirmarAgendamentoNovo(calendarKey, serviceKey, day, horario) {
  const agendamento = {
    calendarKey: calendarKey,
    serviceKey: serviceKey,
    day: day,
    horario: `${formatTime(horario.start_date)} às ${formatTime(horario.end_date)}`
  };
  
  // Verificar se é serviço de pacote
  const servico = servicos.find(s => s.service_key === serviceKey);
  
  if (isServicoPackage(servico)) {
    isPackageService = true;
    showPackageSelector();
    showSuccess("Serviço de pacote selecionado! Configure as 4 semanas abaixo.");
    
    // Adicionar botão para adicionar ao carrinho
    setTimeout(() => {
      const packageSelector = document.getElementById('packageSelector');
      if (packageSelector && !packageSelector.querySelector('.btn-adicionar')) {
        const btnAdicionar = document.createElement('button');
        btnAdicionar.className = 'btn-adicionar';
        btnAdicionar.textContent = 'Adicionar Pacote ao Carrinho';
        btnAdicionar.onclick = () => adicionarAoCarrinho(agendamento);
        packageSelector.appendChild(btnAdicionar);
      }
    }, 100);
  } else {
    // Serviço normal - adicionar diretamente ao carrinho
    adicionarAoCarrinho(agendamento);
  }
}
 
// ===== INICIALIZAÇÃO DAS NOVAS FUNCIONALIDADES =====

function initializeNewFeatures() {
  // Configurar opções de pagamento
  setupPaymentOptions();
  
  // Selecionar pagamento integral por padrão
  const integralOption = document.querySelector('.payment-option[data-type="integral"]');
  if (integralOption) {
    integralOption.classList.add('selected');
    tipoPagamento = 'integral';
  }
  
  // Configurar máscara para telefone
  const telefoneInput = document.getElementById('clienteTelefone');
  if (telefoneInput) {
    telefoneInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length <= 11) {
        value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        if (value.length < 14) {
          value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
      }
      e.target.value = value;
    });
  }
}

// Modificar a função de inicialização existente para incluir as novas funcionalidades
const originalInitializeApp = initializeApp;
initializeApp = async function() {
  await originalInitializeApp();
  initializeNewFeatures();
};

// Substituir a função confirmarAgendamento original
const originalConfirmarAgendamento = confirmarAgendamento;
confirmarAgendamento = function(calendarKey, serviceKey, day, horario) {
  if (arguments.length === 4) {
    // Nova implementação com parâmetros (SEM WhatsApp)
    confirmarAgendamentoNovo(calendarKey, serviceKey, day, horario);
  } else {
    // Para chamadas sem parâmetros, redirecionar para nova implementação
    showError("Por favor, selecione um horário válido.");
  }
};

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
          <div><strong>as ${horarioFim}</small>
          <div><strong>${horario.number_available} vaga${
          horario.number_available > 1 ? "s" : ""
        }</strong></div>
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

async function criarCompleto(req, res) {
  const { cliente, itensAgendamento, pagamento, pacote } = req.body;

  if (!cliente.telefone || !cliente.nome) {
    return res.status(400).json({ message: "Telefone e nome obrigatórios" });
  }

  // 2. Pesquisar cliente
  let clienteDB = await client_b2c.findOne({ telefone: cliente.telefone });
  if (!clienteDB) {
    clienteDB = await client_b2c.create({ nome: cliente.nome, telefone: cliente.telefone });
  }

  // 3. Validar itens
  if (pacote) {
     // verificar que são exatamente 4 itens, com datas em semanas diferentes
     if (itensAgendamento.length !== 4) {
       return res.status(400)
         .json({ message: "Pacote deve ter exatamente 4 datas, 1 por semana" });
     }
     // extraia semana do ano e garanta unicidade
     const semanas = itensAgendamento.map(item => weekOfYear(item.dia));
     const setS = new Set(semanas);
     if (setS.size !== 4) {
       return res.status(400)
         .json({ message: "Datas do pacote devem estar em semanas diferentes" });
     }
  }

  // 4. Para cada item, chamar /api/agendamentos/criar passando serviço, data e horário
  const agendamentosCriados = [];
  for (const item of itensAgendamento) {
    const criarPayload = {
      status: "CONFIRMED",
      calendar_key: item.calendar_key,
      service_list: [{ service_key: item.service_key }],
      owner_user: { email: clienteDB.email || 'cliente-b2c' },
      attendees: [{ name: cliente.nome, email: clienteDB.email || '', phone: cliente.telefone }],
      start: { dateTime: item.horario },
      verify_limits: true,
      send_email: false,
      include_flows: true
    };
    const ag = await callAPI("/api/agendamentos/criar", criarPayload);
    agendamentosCriados.push(ag);
  }

  // 5. Montar pagamento
  const total = agendamentosCriados
    .reduce((sum, ag) => sum + parseFloat(ag.total_price || ag.price || 0), 0);
  let valor = total;
  let aceitarSinal = false;
  let percentilSinal = 0;
  if (pagamento.tipo === "sinal") {
    aceitarSinal = true;
    percentilSinal = pagamento.percentilSinal || 50;
    valor = total * (percentilSinal / 100);
  }

  const payPayload = {
    valor,
    nomeServico: pacote ? "Pacote 4 sessões" : "Agendamento",
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    ASAAS_WALLET_ID: process.env.ASAAS_WALLET_ID,
    aceitarSinal,
    percentilSinal
  };
  const paymentRes = await callAPI("/api/pagamentos/link", payPayload);

  // 6. Após resposta de pagamento, enviar mensagem via WhatsApp
  if (paymentRes && paymentRes.data && paymentRes.data.link) {
    // montar array de dados para envio
    return res.json({
      cliente: clienteDB,
      agendamentos: agendamentosCriados,
      pagamentoLink: paymentRes.data.link
    });
  } else {
    return res.status(500).json({ message: "Erro ao gerar link pagamento" });
  }
}