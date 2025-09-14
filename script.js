// КОНФИГУРАЦИЯ FIREBASE - ВАШИ ДАННЫЕ
const firebaseConfig = {
    apiKey: "AIzaSyDmoAORpz-NhWQskyW_p9IwCKrClC419LQ",
    authDomain: "testtgid.firebaseapp.com",
    projectId: "testtgid",
    storageBucket: "testtgid.firebasestorage.app",
    messagingSenderId: "262521008550",
    appId: "1:262521008550:web:640971c8590503dde95f67"
};

// Инициализация Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Элементы DOM
const statusElement = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');
const refreshBtn = document.getElementById('refreshBtn');

// Функция анонимной аутентификации в Firebase
async function authenticateAnonymously() {
    try {
        console.log('Начинаем анонимную аутентификацию...');
        const userCredential = await auth.signInAnonymously();
        console.log('✅ Аутентификация успешна. UID:', userCredential.user.uid);
        return userCredential.user;
    } catch (error) {
        console.error('❌ Ошибка аутентификации:', error);
        throw new Error('Не удалось выполнить аутентификацию: ' + error.message);
    }
}

// Функция получения данных пользователя Telegram
function getTelegramUserData() {
    try {
        const user = tg.initDataUnsafe.user;
        
        if (!user || !user.id) {
            throw new Error('Данные пользователя Telegram не доступны');
        }

        return {
            tg_id: user.id,
            tg_username: user.username || 'не указан',
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            language_code: user.language_code || '',
            is_premium: user.is_premium || false,
            photo_url: user.photo_url || '',
            is_bot: user.is_bot || false,
            telegram_data: JSON.stringify(tg.initDataUnsafe),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            last_updated: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ Ошибка получения данных Telegram:', error);
        throw new Error('Не удалось получить данные пользователя: ' + error.message);
    }
}

// Функция сохранения данных в Firestore
async function saveUserData(userData) {
    try {
        // Проверяем аутентификацию
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('Пользователь не аутентифицирован');
        }

        // Добавляем UID аутентификации к данным
        const dataWithAuth = {
            ...userData,
            firebase_uid: currentUser.uid,
            auth_timestamp: new Date().toISOString(),
            app_version: '1.0.0'
        };

        // Сохраняем в Firestore
        await db.collection('users').doc(userData.tg_id.toString()).set(dataWithAuth, { 
            merge: true 
        });
        
        console.log('✅ Данные успешно сохранены в Firestore');
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка сохранения в Firestore:', error);
        throw new Error('Не удалось сохранить данные: ' + error.message);
    }
}

// Функция обновления интерфейса
function updateUI(userData, firebaseUser) {
    statusElement.innerHTML = `
        <div class="status-success">
            <h3>✅ Данные успешно сохранены!</h3>
            
            <div class="user-data-item">
                <span class="user-data-label">Telegram ID:</span>
                <span class="user-data-value">${userData.tg_id}</span>
            </div>
            
            <div class="user-data-item">
                <span class="user-data-label">Username:</span>
                <span class="user-data-value">@${userData.tg_username}</span>
            </div>
            
            <div class="user-data-item">
                <span class="user-data-label">Имя:</span>
                <span class="user-data-value">${userData.first_name} ${userData.last_name}</span>
            </div>
            
            <div class="user-data-item">
                <span class="user-data-label">Firebase UID:</span>
                <span class="user-data-value">${firebaseUser.uid}</span>
            </div>
            
            <div class="user-data-item">
                <span class="user-data-label">Premium:</span>
                <span class="user-data-value">${userData.is_premium ? '✅ Да' : '❌ Нет'}</span>
            </div>
            
            <div class="user-data-item">
                <span class="user-data-label">Язык:</span>
                <span class="user-data-value">${userData.language_code || 'не указан'}</span>
            </div>
            
            <div class="user-data-item">
                <span class="user-data-label">Время сохранения:</span>
                <span class="user-data-value">${new Date().toLocaleString('ru-RU')}</span>
            </div>
        </div>
    `;
}

// Функция обработки ошибок
function handleError(error) {
    console.error('❌ Критическая ошибка:', error);
    
    statusElement.innerHTML = `
        <div class="status-error">
            <h3>❌ Произошла ошибка</h3>
            <p>${error.message}</p>
            <p><small>Попробуйте перезагрузить приложение</small></p>
            <button onclick="location.reload()" style="
                margin-top: 15px;
                padding: 10px 20px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
            ">🔄 Перезагрузить</button>
        </div>
    `;
}

// Функция показа уведомления в Telegram
function showTelegramNotification(message, isSuccess = true) {
    tg.showPopup({
        title: isSuccess ? '✅ Успех' : '❌ Ошибка',
        message: message,
        buttons: [{ type: 'ok' }]
    });
}

// Основная функция инициализации приложения
async function initApp() {
    try {
        console.log('🚀 Инициализация приложения...');
        
        // Инициализация Telegram Web App
        tg.ready();
        tg.BackButton.hide();
        tg.expand();
        tg.enableClosingConfirmation();

        // Показываем загрузку
        statusElement.innerHTML = '<div class="loading">🔐 Аутентификация...</div>';

        // Аутентификация в Firebase
        const firebaseUser = await authenticateAnonymously();
        
        // Получаем данные пользователя Telegram
        statusElement.innerHTML = '<div class="loading">📡 Получение данных Telegram...</div>';
        const userData = getTelegramUserData();
        
        // Сохраняем данные
        statusElement.innerHTML = '<div class="loading">💾 Сохранение в базу данных...</div>';
        await saveUserData(userData);
        
        // Обновляем интерфейс
        updateUI(userData, firebaseUser);
        
        console.log('🎯 Приложение успешно инициализировано');
        
    } catch (error) {
        handleError(error);
    }
}

// Обработчик кнопки сохранения
saveBtn.addEventListener('click', async () => {
    try {
        tg.showPopup({
            title: '⏳',
            message: 'Обновляем данные...'
        });

        const userData = getTelegramUserData();
        await saveUserData(userData);
        
        showTelegramNotification('Данные успешно обновлены в базе!');
        
        // Обновляем UI
        const firebaseUser = auth.currentUser;
        updateUI(userData, firebaseUser);
        
    } catch (error) {
        showTelegramNotification('Ошибка при обновлении: ' + error.message, false);
    }
});

// Обработчик кнопки обновления
refreshBtn.addEventListener('click', () => {
    location.reload();
});

// Обработчики состояния аутентификации
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('👤 Пользователь аутентифицирован:', user.uid);
    } else {
        console.log('👤 Пользователь вышел из системы');
    }
});

// Запуск приложения при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM загружен, запускаем приложение...');
    initApp();
});

// Обработчик ошибок
window.addEventListener('error', (event) => {
    console.error('🚨 Глобальная ошибка:', event.error);
    handleError(event.error);
});
