// Configuração da API Sistema ANA
const API_CONFIG = {
    baseURL: 'https://api.sistemaana.com.br',
    token: 'b4c24dc1e6aa2f63b04545d5a2aa2b17052e5ccd',
    headers: {
        'Authorization': `Bearer b4c24dc1e6aa2f63b04545d5a2aa2b17052e5ccd`,
        'Content-Type': 'application/json',
        'Accept': '*/*'
    }
};

// Variáveis globais
let agendas = [];
let servicos = [];
let diasDisponiveis = [];
let currentDate = new Date();

// Elementos DOM
const agendaSelect = document.getElementById('agendaSelect');
const servicoSelect = document.getElementById('servicoSelect');
const dataInput = document.getElementById('dataInput');
const currentDateEl = document.getElementById('currentDate');
const prevDayBtn = document.getElementById('prevDay');
const nextDayBtn = document.getElementById('nextDay');
const buscarBtn = document.getElementById('buscarHorarios');
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const horariosGrid = document.getElementById('horariosGrid');

// Utilitários
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatDateBR(date) {
    return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    });
}

function formatPrice(price) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(parseFloat(price));
}

function formatDuration(duration) {
    // Converte formato "HH:MM:SS" para texto legível
    const parts = duration.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    
    if (hours > 0) {
        return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
    }
    return `${minutes}min`;
}

function showLoading() {
    loadingMessage.style.display = 'block';
    hideMessages();
}

function hideLoading() {
    loadingMessage.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// Funções da API
async function makeAPIRequest(endpoint, options = {}) {
    try {
        const url = `${API_CONFIG.baseURL}${endpoint}`;
        console.log('Fazendo requisição para:', url);
        console.log('Headers:', API_CONFIG.headers);
        console.log('Options:', options);
        
        const response = await fetch(url, {
            ...options,
            headers: {
                ...API_CONFIG.headers,
                ...options.headers
            }
        });

        console.log('Status da resposta:', response.status);
        console.log('Response headers:', response.headers);

        if (!response.ok) {
            let errorMessage = `Erro ${response.status}: ${response.statusText}`;
            
            try {
                const errorData = await response.json();
                console.log('Dados do erro:', errorData);
                if (errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (e) {
                console.log('Erro ao ler JSON do erro:', e);
                // Se não conseguir ler o JSON do erro, usa a mensagem padrão
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Dados recebidos:', data);
        return data;
    } catch (error) {
        console.error('Erro completo na requisição:', error);
        
        // Verificar se é um erro de CORS
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Erro de conexão: Verifique se a API está acessível ou se há problemas de CORS');
        }
        
        throw error;
    }
}

async function carregarAgendas() {
    try {
        console.log('Iniciando carregamento de agendas...');
        showLoading();
        
        // GET /api/agendamentos/agendas
        const data = await makeAPIRequest('/api/agendamentos/agendas');
        
        console.log('Resposta da API de agendas:', data);
        
        agendas = data.agendas || [];
        
        // Limpar e popular select de agendas
        agendaSelect.innerHTML = '<option value="">Selecione uma agenda</option>';
        
        if (agendas.length === 0) {
            agendaSelect.innerHTML = '<option value="">Nenhuma agenda encontrada</option>';
            hideLoading();
            showError('Nenhuma agenda foi encontrada na resposta da API.');
            return;
        }
        
        agendas.forEach(agenda => {
            const option = document.createElement('option');
            option.value = agenda.calendar_key;
            option.textContent = `${agenda.letter} - ${agenda.calendar_name}`;
            agendaSelect.appendChild(option);
        });
        
        hideLoading();
        showSuccess(`${agendas.length} agendas carregadas com sucesso!`);
        console.log('Agendas carregadas:', agendas);
        
    } catch (error) {
        hideLoading();
        console.error('Erro detalhado ao carregar agendas:', error);
        
        // Mostrar erro específico baseado no tipo
        let errorMsg = 'Erro ao carregar agendas. ';
        
        if (error.message.includes('CORS')) {
            errorMsg += 'Problema de CORS - a API pode não estar configurada para aceitar requisições do navegador.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMsg += 'Não foi possível conectar com a API. Verifique se a URL está correta e se a API está online.';
        } else if (error.message.includes('401')) {
            errorMsg += 'Token de autorização inválido ou expirado.';
        } else {
            errorMsg += error.message;
        }
        
        showError(errorMsg);
        
        // Tentar uma versão simplificada da requisição
        console.log('Tentando requisição manual para debug...');
        testAPIConnection();
    }
}

async function carregarServicos(calendarKey) {
    try {
        showLoading();
        
        // POST /api/agendamentos/agendas/servicos
        const data = await makeAPIRequest('/api/agendamentos/agendas/servicos', {
            method: 'POST',
            body: JSON.stringify({
                calendar_key: calendarKey
            })
        });
        
        servicos = data.services || [];
        
        // Limpar e popular select de serviços
        servicoSelect.innerHTML = '<option value="">Selecione um serviço</option>';
        
        if (servicos.length === 0) {
            servicoSelect.innerHTML = '<option value="">Nenhum serviço encontrado</option>';
            servicoSelect.disabled = true;
            hideLoading();
            return;
        }
        
        servicos.forEach(servico => {
            const option = document.createElement('option');
            option.value = servico.service_key;
            option.textContent = `${servico.service_option} - ${servico.service_name} (${formatDuration(servico.duration)}) - ${formatPrice(servico.price)}`;
            servicoSelect.appendChild(option);
        });
        
        servicoSelect.disabled = false;
        hideLoading();
        showSuccess(`${servicos.length} serviços carregados!`);
        
        // Carregar dias disponíveis automaticamente se tivermos serviço selecionado
        if (servicos.length > 0) {
            await carregarDiasDisponiveis(calendarKey);
        }
        
    } catch (error) {
        hideLoading();
        servicoSelect.disabled = true;
        showError('Erro ao carregar serviços. Tente novamente.');
        console.error('Erro ao carregar serviços:', error);
    }
}

async function carregarDiasDisponiveis(calendarKey, serviceKey = null) {
    if (!serviceKey && servicos.length > 0) {
        // Se não foi passado um serviço específico, use o primeiro disponível para carregar os dias
        serviceKey = servicos[0].service_key;
    }
    
    if (!serviceKey) return;
    
    try {
        // POST /api/agendamentos/agendas/dias
        const data = await makeAPIRequest('/api/agendamentos/agendas/dias', {
            method: 'POST',
            body: JSON.stringify({
                calendar_key: calendarKey,
                service_key: serviceKey
            })
        });
        
        diasDisponiveis = data || [];
        
        // Filtrar apenas dias que não estão completamente bloqueados e são ativos
        const diasValidos = diasDisponiveis.filter(dia => 
            dia.is_active && !dia.is_holiday
        );
        
        console.log(`${diasValidos.length} dias disponíveis carregados`);
        
    } catch (error) {
        console.error('Erro ao carregar dias disponíveis:', error);
        // Não mostra erro aqui pois é uma operação em background
    }
}

function isDiaDisponivel(data) {
    const diaEncontrado = diasDisponiveis.find(dia => dia.day === data);
    
    if (!diaEncontrado) {
        return false; // Se não encontrou o dia, assume que não está disponível
    }
    
    // Verifica se o dia está ativo, não é feriado e não está completamente bloqueado
    return diaEncontrado.is_active && 
           !diaEncontrado.is_holiday && 
           !diaEncontrado.is_blocked;
}

async function buscarHorariosDisponiveis() {
    const calendarKey = agendaSelect.value;
    const serviceKey = servicoSelect.value;
    const day = dataInput.value;
    
    if (!calendarKey || !serviceKey || !day) {
        showError('Por favor, selecione a agenda, serviço e data.');
        return;
    }
    
    // Verificar se o dia está disponível
    if (!isDiaDisponivel(day)) {
        showError('Esta data não está disponível para agendamentos. Selecione outra data.');
        return;
    }
    
    try {
        showLoading();
        hideMessages();
        
        // POST /api/agendamentos/agendas/horarios
        const horarios = await makeAPIRequest('/api/agendamentos/agendas/horarios', {
            method: 'POST',
            body: JSON.stringify({
                calendar_key: calendarKey,
                service_key: serviceKey,
                day: day
            })
        });
        
        // Limpar grid de horários
        horariosGrid.innerHTML = '';
        
        if (!horarios || horarios.length === 0) {
            horariosGrid.innerHTML = '<div class="col-12 text-center"><p>Nenhum horário disponível para esta data.</p></div>';
            hideLoading();
            return;
        }
        
        // Filtrar apenas horários disponíveis
        const horariosDisponiveis = horarios.filter(horario => 
            !horario.booked && 
            !horario.blocked && 
            horario.is_open && 
            horario.number_available > 0
        );
        
        if (horariosDisponiveis.length === 0) {
            horariosGrid.innerHTML = '<div class="col-12 text-center"><p>Todos os horários desta data já estão ocupados.</p></div>';
            hideLoading();
            return;
        }
        
        // Ordenar horários por horário de início
        horariosDisponiveis.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        
        // Renderizar horários
        horariosDisponiveis.forEach(horario => {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            
            const horarioInicio = formatTime(horario.start_date);
            const horarioFim = formatTime(horario.end_date);
            
            timeSlot.innerHTML = `
                <div><strong>${horarioInicio}</strong></div>
                <small>até ${horarioFim}</small>
                <div><small>${horario.number_available} vaga${horario.number_available > 1 ? 's' : ''}</small></div>
            `;
            
            timeSlot.addEventListener('click', () => {
                // Remover seleção anterior
                document.querySelectorAll('.time-slot.selected').forEach(slot => {
                    slot.classList.remove('selected');
                    slot.style.background = '';
                    slot.style.color = '';
                });
                
                // Adicionar seleção atual
                timeSlot.classList.add('selected');
                timeSlot.style.background = '#c9a961';
                timeSlot.style.color = 'white';
                
                // Confirmar agendamento
                confirmarAgendamento(calendarKey, serviceKey, day, horario);
            });
            
            horariosGrid.appendChild(timeSlot);
        });
        
        hideLoading();
        showSuccess(`${horariosDisponiveis.length} horários disponíveis para ${formatDateBR(new Date(day + 'T00:00:00'))}`);
        
    } catch (error) {
        hideLoading();
        showError('Erro ao buscar horários disponíveis. Tente novamente.');
        console.error('Erro ao buscar horários:', error);
    }
}

function confirmarAgendamento(calendarKey, serviceKey, day, horario) {
    const agenda = agendas.find(a => a.calendar_key === calendarKey);
    const servico = servicos.find(s => s.service_key === serviceKey);
    const horarioInicio = formatTime(horario.start_date);
    const horarioFim = formatTime(horario.end_date);
    
    const confirmacao = confirm(
        `Confirmar agendamento?\n\n` +
        `Agenda: ${agenda.calendar_name}\n` +
        `Serviço: ${servico.service_name}\n` +
        `Duração: ${formatDuration(servico.duration)}\n` +
        `Valor: ${formatPrice(servico.price)}\n` +
        `Data: ${formatDateBR(new Date(day + 'T00:00:00'))}\n` +
        `Horário: ${horarioInicio} às ${horarioFim}\n\n` +
        `Deseja prosseguir com o agendamento?`
    );
    
    if (confirmacao) {
        // Redirecionar para WhatsApp ou sistema de agendamento
        const mensagem = encodeURIComponent(
            `Olá! Gostaria de agendar:\n\n` +
            `📅 Serviço: ${servico.service_name}\n` +
            `🕐 Data: ${formatDateBR(new Date(day + 'T00:00:00'))}\n` +
            `⏰ Horário: ${horarioInicio} às ${horarioFim}\n` +
            `💰 Valor: ${formatPrice(servico.price)}\n\n` +
            `Aguardo confirmação!`
        );
        
        // Substitua pelo número de WhatsApp da clínica
        const numeroWhatsApp = '5531999999999'; // Ajuste com o número real
        const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensagem}`;
        
        showSuccess('Redirecionando para WhatsApp para finalizar o agendamento...');
        
        setTimeout(() => {
            window.open(urlWhatsApp, '_blank');
        }, 2000);
    }
}

function atualizarDisponibilidadeDias() {
    // Adicionar classe visual para dias não disponíveis
    const dataAtual = dataInput.value;
    if (dataAtual && !isDiaDisponivel(dataAtual)) {
        dataInput.style.borderColor = '#dc3545';
        dataInput.style.background = '#fff5f5';
    } else {
        dataInput.style.borderColor = '';
        dataInput.style.background = '';
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Ativar debug se houver parâmetro na URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
        document.getElementById('debugInfo').style.display = 'block';
        console.log('Modo debug ativado');
    }
    
    // Definir data atual
    currentDate = new Date();
    dataInput.value = formatDate(currentDate);
    currentDateEl.textContent = formatDateBR(currentDate);
    
    // Carregar agendas iniciais
    console.log('Iniciando aplicação...');
    carregarAgendas();
    
    // Event listener para mudança de agenda
    agendaSelect.addEventListener('change', function() {
        if (this.value) {
            carregarServicos(this.value);
        } else {
            servicoSelect.innerHTML = '<option value="">Selecione uma agenda primeiro</option>';
            servicoSelect.disabled = true;
            horariosGrid.innerHTML = '';
            hideMessages();
        }
    });
    
    // Event listener para mudança de serviço
    servicoSelect.addEventListener('change', function() {
        const calendarKey = agendaSelect.value;
        if (this.value && calendarKey) {
            carregarDiasDisponiveis(calendarKey, this.value);
        }
        atualizarDisponibilidadeDias();
    });
    
    // Event listener para mudança de data
    dataInput.addEventListener('change', function() {
        currentDate = new Date(this.value + 'T00:00:00');
        currentDateEl.textContent = formatDateBR(currentDate);
        atualizarDisponibilidadeDias();
        
        // Limpar horários quando mudar a data
        horariosGrid.innerHTML = '';
        hideMessages();
    });
    
    // Navegação de data
    prevDayBtn.addEventListener('click', function() {
        currentDate.setDate(currentDate.getDate() - 1);
        dataInput.value = formatDate(currentDate);
        currentDateEl.textContent = formatDateBR(currentDate);
        atualizarDisponibilidadeDias();
        horariosGrid.innerHTML = '';
        hideMessages();
    });
    
    nextDayBtn.addEventListener('click', function() {
        currentDate.setDate(currentDate.getDate() + 1);
        dataInput.value = formatDate(currentDate);
        currentDateEl.textContent = formatDateBR(currentDate);
        atualizarDisponibilidadeDias();
        horariosGrid.innerHTML = '';
        hideMessages();
    });
    
    // Buscar horários
    buscarBtn.addEventListener('click', buscarHorariosDisponiveis);
    
    // Buscar automaticamente quando todos os campos estiverem preenchidos
    [agendaSelect, servicoSelect, dataInput].forEach(element => {
        element.addEventListener('change', function() {
            if (agendaSelect.value && servicoSelect.value && dataInput.value) {
                // Pequeno delay para permitir que outras operações terminem
                setTimeout(() => {
                    if (isDiaDisponivel(dataInput.value)) {
                        buscarHorariosDisponiveis();
                    }
                }, 500);
            }
        });
    });
});

// Função utilitária para debug (pode ser removida em produção)
function debugAPI() {
    console.log('Agendas carregadas:', agendas);
    console.log('Serviços carregados:', servicos);
    console.log('Dias disponíveis:', diasDisponiveis);
}

// Função para testar conexão com a API
async function testAPIConnection() {
    try {
        console.log('=== TESTE DE CONEXÃO COM A API ===');
        console.log('URL Base:', API_CONFIG.baseURL);
        console.log('Token:', API_CONFIG.token);
        
        // Teste simples de fetch
        const response = await fetch(`${API_CONFIG.baseURL}/api/agendamentos/agendas`, {
            method: 'GET',
            headers: API_CONFIG.headers,
            mode: 'cors' // Forçar CORS
        });
        
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        console.log('Headers:', [...response.headers.entries()]);
        
        if (response.ok) {
            const data = await response.text(); // Primeiro como texto
            console.log('Resposta como texto:', data);
            
            try {
                const jsonData = JSON.parse(data);
                console.log('Resposta como JSON:', jsonData);
            } catch (e) {
                console.log('Não foi possível parsear como JSON:', e);
            }
        } else {
            console.log('Resposta não foi OK');
            const errorText = await response.text();
            console.log('Texto do erro:', errorText);
        }
        
    } catch (error) {
        console.error('Erro no teste de conexão:', error);
        console.log('Tipo do erro:', error.constructor.name);
        console.log('Mensagem:', error.message);
        
        // Adicionar botão para tentar novamente
        addRetryButton();
    }
}

// Adicionar botão para tentar novamente
function addRetryButton() {
    const existingButton = document.getElementById('retryButton');
    if (existingButton) {
        existingButton.remove();
    }
    
    const retryButton = document.createElement('button');
    retryButton.id = 'retryButton';
    retryButton.className = 'button button-primary';
    retryButton.textContent = 'Tentar Novamente';
    retryButton.style.marginTop = '10px';
    
    retryButton.addEventListener('click', () => {
        retryButton.remove();
        carregarAgendas();
    });
    
    // Adicionar após a mensagem de erro
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv && errorDiv.style.display !== 'none') {
        errorDiv.appendChild(retryButton);
    }
}

// Expor função para debug no console
window.debugAPI = debugAPI;
window.testAPIConnection = testAPIConnection;