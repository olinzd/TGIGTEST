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

// Элементы DOM
const statusElement = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');
const refreshBtn = document.getElementById('refreshBtn');

// Функции для отображения статуса
function showLoading(message) {
    statusElement.innerHTML = `
        <div class="status-loading">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

function showSuccess(message) {
    statusElement.innerHTML = `
        <div class="status-success">
            <h3>✅ Успех!</h3>
            <p>${message}</p>
        </div>
    `;
}

function showError(message) {
    statusElement.innerHTML = `
        <div class="status-error">
            <h3>❌ Ошибка</h3>
            <p>${message}</p>
            <p><small>Проверьте настройки Firebase</small></p>
        </div>
    `;
}

function showDebugInfo(info) {
    statusElement.innerHTML += `
        <div class="debug-info">
            <h4>🔍 Информация для отладки:</h4>
            <pre>${JSON.stringify(info, null, 2)}</pre>
        </div>
    `;
}

// Функция анонимной аутентификации
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

// Обработчики кнопок
saveBtn.addEventListener('click', async () => {
    try {
        const userData = getTelegramUserData();
        await saveUserData(userData);
        tg.showPopup({ title: '✅ Успех', message: 'Данные обновлены' });
    } catch (error) {
        tg.showPopup({ title: '❌ Ошибка', message: error.message });
    }
});

refreshBtn.addEventListener('click', () => {
    location.reload();
});

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);
