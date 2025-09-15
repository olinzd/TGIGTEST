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

async function authenticateAnonymously() {
    showLoading('Аутентификация в Firebase...');
    
    try {
        const userCredential = await auth.signInAnonymously();
        return userCredential.user;
    } catch (error) {
        showError('Ошибка аутентификации: ' + error.message);
        throw error;
    }
}

// Функция получения данных пользователя Telegram
function getTelegramUserData() {
    const user = tg.initDataUnsafe.user;
    
    if (!user || !user.id) {
        showError('Данные пользователя Telegram не доступны');
        throw new Error('No Telegram user data');
    }

    return {
        tg_id: user.id,
        tg_username: user.username || 'не указан',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        language_code: user.language_code || '',
        is_premium: user.is_premium || false,
        timestamp: new Date().toISOString()
    };
}

// Функция сохранения данных в Firestore
async function saveUserData(userData) {
    showLoading('Сохранение в базу данных...');
    
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('Пользователь не аутентифицирован');
        }

        const dataWithAuth = {
            ...userData,
            firebase_uid: currentUser.uid,
            auth_timestamp: new Date().toISOString()
        };

        await db.collection('users').doc(userData.tg_id.toString()).set(dataWithAuth, { 
            merge: true 
        });
        
        return true;
    } catch (error) {
        showError('Ошибка сохранения: ' + error.message);
        
        // Показываем дополнительную информацию для отладки
        showDebugInfo({
            error: error.message,
            userData: userData,
            firebaseConfig: {
                projectId: firebaseConfig.projectId,
                authDomain: firebaseConfig.authDomain
            },
            timestamp: new Date().toISOString()
        });
        
        throw error;
    }
}

// Основная функция инициализации приложения
async function initApp() {
    try {
        // Инициализация Telegram Web App
        tg.ready();
        tg.BackButton.hide();
        tg.expand();

        // Проверяем инициализацию Firebase
        if (!db || !auth) {
            showError('Firebase не инициализирован');
            return;
        }

        // Аутентификация в Firebase
        const firebaseUser = await authenticateAnonymously();
        
        // Получаем данные пользователя Telegram
        const userData = getTelegramUserData();
        
        // Сохраняем данные
        await saveUserData(userData);
        
        // Показываем успех
        showSuccess(`
            Данные успешно сохранены!<br>
            ID: ${userData.tg_id}<br>
            Username: @${userData.tg_username}<br>
            Имя: ${userData.first_name} ${userData.last_name}
        `);
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
    }
}

// Переменные для управления состоянием
let currentWeekStart = getStartOfWeek(new Date());
let employees = [];
let shifts = [];
let employeeColors = {};

// Элементы DOM
const calendarElement = document.getElementById('calendar');
const weekTitleElement = document.getElementById('weekTitle');
const prevWeekBtn = document.getElementById('prevWeek');
const nextWeekBtn = document.getElementById('nextWeek');
const shiftDetailsElement = document.getElementById('shiftDetails');
const shiftInfoElement = document.getElementById('shiftInfo');
const closeDetailsBtn = document.getElementById('closeDetails');

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
    const startStr = weekRange.start.toISOString().split('T')[0];
    const endStr = new Date(weekRange.end.getTime() + 86400000).toISOString().split('T')[0];
    
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
            const shiftCircle = document.createElement('div');
            shiftCircle.className = 'shift-circle';
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
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <span class="legend-color" style="background-color: ${employeeColors[employee.id]}"></span>
            <span>${employee.name}</span>
        `;
        legendContainer.appendChild(legendItem);
    });
    
    calendarElement.parentNode.insertBefore(legendContainer, calendarElement.nextSibling);
}

function showShiftDetails(shift) {
    shiftInfoElement.innerHTML = `
        <div class="shift-info-item">
            <span class="shift-info-label">Сотрудник:</span>
            <span class="shift-info-value">${shift.employeeName}</span>
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

        // Проверяем инициализацию Firebase
        if (!db) {
            showError('Firebase не инициализирован');
            return;
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

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);
