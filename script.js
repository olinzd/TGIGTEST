// КОНФИГУРАЦИЯ FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDmoAORpz-NhWQskyW_p9IwCKrClC419LQ",
    authDomain: "testtgid.firebaseapp.com",
    projectId: "testtgid",
    storageBucket: "testtgid.firebasestorage.app",
    messagingSenderId: "262521008550",
    appId: "1:262521008550:web:640971c8590503dde95f67"
};

// Инициализация Firebase
let db, auth;

try {
    const app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log('✅ Firebase инициализирован');
} catch (error) {
    showError('Ошибка инициализации Firebase: ' + error.message);
}

// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Переменные для управления состоянием
let currentWeekStart = getStartOfWeek(new Date());
let employees = [];
let shifts = [];
let employeeColors = {};
let currentUser = null;
let userEmployeeId = null;
const ADMIN_TELEGRAM_ID = "5605512692";

// Элементы DOM
const calendarElement = document.getElementById('calendar');
const weekTitleElement = document.getElementById('weekTitle');
const prevWeekBtn = document.getElementById('prevWeek');
const nextWeekBtn = document.getElementById('nextWeek');
const shiftDetailsElement = document.getElementById('shiftDetails');
const shiftInfoElement = document.getElementById('shiftInfo');
const closeDetailsBtn = document.getElementById('closeDetails');
const adminPanel = document.getElementById('adminPanel');
const userFilter = document.getElementById('userFilter');
const userShiftsInfo = document.getElementById('userShiftsInfo');
const registerEmployeeBtn = document.getElementById('registerEmployee');
const employeeIdInput = document.getElementById('employeeIdInput');
const telegramIdInput = document.getElementById('telegramIdInput');
const registrationResult = document.getElementById('registrationResult');

// Функции для работы с датами
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function formatDate(date) {
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short'
    });
}

function getWeekRange(startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    return {
        start: startDate,
        end: endDate,
        title: `${startDate.toLocaleDateString('ru-RU')} - ${endDate.toLocaleDateString('ru-RU')}`
    };
}

function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

// Проверка прав администратора
function isAdmin() {
    return currentUser && currentUser.toString() === ADMIN_TELEGRAM_ID;
}

// Поиск employeeId по Telegram ID
async function findEmployeeIdByTelegramId(telegramId) {
    try {
        const snapshot = await db.collection('user_mappings')
            .where('telegramId', '==', telegramId.toString())
            .get();
        
        if (!snapshot.empty) {
            return snapshot.docs[0].data().employeeId;
        }
        return null;
    } catch (error) {
        console.error('Ошибка поиска employeeId:', error);
        return null;
    }
}

// Регистрация пользователя
async function registerUser(employeeId, telegramId) {
    try {
        await db.collection('user_mappings').add({
            employeeId: employeeId.toString(),
            telegramId: telegramId.toString(),
            registeredAt: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        return false;
    }
}

// Генерация цветов для сотрудников
function generateEmployeeColors(employeesList) {
    const colors = {};
    const colorPalette = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFBE0B', '#FB5607',
        '#FF006E', '#8338EC', '#3A86FF', '#38B000', '#9D4EDD',
        '#F72585', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0'
    ];
    
    employeesList.forEach((employee, index) => {
        colors[employee.id] = colorPalette[index % colorPalette.length];
    });
    
    return colors;
}

// Получение уникальных ID сотрудников из текущей недели
function getEmployeesInCurrentWeek() {
    const weekRange = getWeekRange(currentWeekStart);
    
    // Получаем уникальные employeeId из смен текущей недели
    const employeeIdsInWeek = new Set();
    shifts.forEach(shift => {
        const shiftDate = new Date(shift.date);
        if (shiftDate >= weekRange.start && shiftDate <= weekRange.end) {
            employeeIdsInWeek.add(shift.employeeId);
        }
    });
    
    // Фильтруем сотрудников только тех, кто есть в текущей неделе
    return employees.filter(employee => employeeIdsInWeek.has(employee.id));
}

// Загрузка данных из Firestore
async function loadEmployees() {
    try {
        const snapshot = await db.collection('employees').get();
        employees = snapshot.docs.map(doc => ({
            id: doc.data().id,
            name: doc.data().name
        }));
        return employees;
    } catch (error) {
        console.error('Ошибка загрузки сотрудников:', error);
        throw error;
    }
}

async function loadShifts() {
    try {
        const weekRange = getWeekRange(currentWeekStart);
        const startStr = weekRange.start.toISOString().split('T')[0];
        const endStr = new Date(weekRange.end.getTime() + 86400000).toISOString().split('T')[0];
        
        const snapshot = await db.collection('shifts')
            .where('date', '>=', startStr)
            .where('date', '<', endStr)
            .get();
        
        shifts = snapshot.docs.map(doc => doc.data());
        return shifts;
    } catch (error) {
        console.error('Ошибка загрузки смен:', error);
        throw error;
    }
}

// Отображение календаря
function renderCalendar() {
    const weekRange = getWeekRange(currentWeekStart);
    weekTitleElement.textContent = weekRange.title;
    
    calendarElement.innerHTML = '';
    
    // Получаем сотрудников только для текущей недели
    const employeesInWeek = getEmployeesInCurrentWeek();
    employeeColors = generateEmployeeColors(employeesInWeek);
    
    // Создаем колонки для каждого дня недели
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekRange.start);
        currentDate.setDate(weekRange.start.getDate() + i);
        
        const dayColumn = document.createElement('div');
        dayColumn.className = `day-column ${isToday(currentDate) ? 'today' : ''}`;
        
        // Заголовок дня
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.innerHTML = `
            <div class="day-name">${currentDate.toLocaleDateString('ru-RU', { weekday: 'short' })}</div>
            <div class="day-date">${currentDate.getDate()}</div>
        `;
        
        dayColumn.appendChild(dayHeader);
        
        // Фильтруем смены для этого дня
        const dayShifts = shifts.filter(shift => {
            const shiftDate = new Date(shift.date);
            return shiftDate.toDateString() === currentDate.toDateString();
        });
        
        // Добавляем кружки смен
        dayShifts.forEach(shift => {
            // Проверяем, является ли это смена текущего пользователя
            const isUserShift = userEmployeeId && shift.employeeId === userEmployeeId;
            
            const shiftCircle = document.createElement('div');
            shiftCircle.className = `shift-circle ${isUserShift ? 'user-shift' : ''}`;
            shiftCircle.style.backgroundColor = employeeColors[shift.employeeId] || '#666';
            shiftCircle.title = `${shift.employeeName}: ${shift.hours}ч (${shift.shiftType})`;
            shiftCircle.textContent = shift.hours;
            
            // Обработчик клика для показа деталей
            shiftCircle.addEventListener('click', () => showShiftDetails(shift));
            
            dayColumn.appendChild(shiftCircle);
        });
        
        calendarElement.appendChild(dayColumn);
    }
    
    // Добавляем легенду только для сотрудников текущей недели
    renderEmployeeLegend(employeesInWeek);
    
    // Показываем информацию о сменах пользователя
    if (userEmployeeId) {
        showUserShiftsInfo();
    }
}

// Показать информацию о сменах пользователя
function showUserShiftsInfo() {
    const userShifts = shifts.filter(shift => shift.employeeId === userEmployeeId);
    const totalHours = userShifts.reduce((sum, shift) => sum + parseInt(shift.hours), 0);
    
    userShiftsInfo.innerHTML = `
        <div class="user-shifts-stats">
            <span>Смен: ${userShifts.length}</span>
            <span>Часов: ${totalHours}</span>
        </div>
    `;
    userFilter.style.display = 'block';
}

function renderEmployeeLegend(employeesToShow) {
    // Удаляем предыдущую легенду если есть
    const existingLegend = document.querySelector('.employee-legend');
    if (existingLegend) {
        existingLegend.remove();
    }
    
    if (employeesToShow.length === 0) {
        return;
    }
    
    const legendContainer = document.createElement('div');
    legendContainer.className = 'employee-legend';
    legendContainer.innerHTML = '<strong>Сотрудники на этой неделе:</strong>';
    
    employeesToShow.forEach(employee => {
        const isCurrentUser = userEmployeeId === employee.id;
        const legendItem = document.createElement('div');
        legendItem.className = `legend-item ${isCurrentUser ? 'current-user' : ''}`;
        legendItem.innerHTML = `
            <span class="legend-color" style="background-color: ${employeeColors[employee.id]}"></span>
            <span>${employee.name} ${isCurrentUser ? '(Вы)' : ''}</span>
        `;
        legendContainer.appendChild(legendItem);
    });
    
    calendarElement.parentNode.insertBefore(legendContainer, calendarElement.nextSibling);
}

function showShiftDetails(shift) {
    const isUserShift = userEmployeeId && shift.employeeId === userEmployeeId;
    
    shiftInfoElement.innerHTML = `
        <div class="shift-info-item ${isUserShift ? 'user-shift-info' : ''}">
            <span class="shift-info-label">Сотрудник:</span>
            <span class="shift-info-value">${shift.employeeName} ${isUserShift ? '(Вы)' : ''}</span>
        </div>
        <div class="shift-info-item">
            <span class="shift-info-label">Дата:</span>
            <span class="shift-info-value">${new Date(shift.date).toLocaleDateString('ru-RU')}</span>
        </div>
        <div class="shift-info-item">
            <span class="shift-info-label">Часы:</span>
            <span class="shift-info-value">${shift.hours}ч</span>
        </div>
        <div class="shift-info-item">
            <span class="shift-info-label">Тип смены:</span>
            <span class="shift-info-value">${shift.shiftType}</span>
        </div>
        <div class="shift-info-item">
            <span class="shift-info-label">Месяц:</span>
            <span class="shift-info-value">${shift.month}</span>
        </div>
    `;
    
    shiftDetailsElement.style.display = 'block';
}

function showLoading() {
    calendarElement.innerHTML = '<div class="spinner"></div>';
}

function showError(message) {
    calendarElement.innerHTML = `<div class="error">❌ ${message}</div>`;
}

// Навигация по неделям
function navigateWeek(direction) {
    currentWeekStart.setDate(currentWeekStart.getDate() + (direction * 7));
    loadData();
}

// Основная функция загрузки данных
async function loadData() {
    showLoading();
    
    try {
        await loadEmployees();
        await loadShifts();
        renderCalendar();
    } catch (error) {
        showError('Ошибка загрузки данных: ' + error.message);
    }
}

// Инициализация приложения
async function initApp() {
    try {
        // Инициализация Telegram Web App
        tg.ready();
        tg.expand();

        // Получаем Telegram ID пользователя
        currentUser = tg.initDataUnsafe.user?.id;
        console.log('Telegram User ID:', currentUser);

        // Проверяем инициализацию Firebase
        if (!db) {
            showError('Firebase не инициализирован');
            return;
        }

        // Проверяем права администратора
        if (isAdmin()) {
            adminPanel.style.display = 'block';
            console.log('👑 Администратор вошел в систему');
        }

        // Ищем employeeId для текущего пользователя
        if (currentUser) {
            userEmployeeId = await findEmployeeIdByTelegramId(currentUser);
            if (userEmployeeId) {
                console.log('Найден employeeId:', userEmployeeId);
            }
        }

        // Загружаем данные
        await loadData();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError('Ошибка инициализации приложения');
    }
}

// Обработчики событий
prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
nextWeekBtn.addEventListener('click', () => navigateWeek(1));
closeDetailsBtn.addEventListener('click', () => {
    shiftDetailsElement.style.display = 'none';
});

registerEmployeeBtn.addEventListener('click', async () => {
    const employeeId = employeeIdInput.value;
    const telegramId = telegramIdInput.value;
    
    if (!employeeId || !telegramId) {
        registrationResult.innerHTML = '<div class="error">Заполните все поля</div>';
        return;
    }
    
    const success = await registerUser(employeeId, telegramId);
    if (success) {
        registrationResult.innerHTML = '<div class="success">Пользователь успешно зарегистрирован!</div>';
        employeeIdInput.value = '';
        telegramIdInput.value = '';
    } else {
        registrationResult.innerHTML = '<div class="error">Ошибка регистрации</div>';
    }
    
    setTimeout(() => {
        registrationResult.innerHTML = '';
    }, 3000);
});

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);
