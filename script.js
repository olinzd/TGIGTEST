// Конфигурация Firebase (ЗАМЕНИТЕ НА СВОЮ!)
const firebaseConfig = {
  apiKey: "AIzaSyDmoAORpz-NhWQskyW_p9IwCKrClC419LQ",
  authDomain: "testtgid.firebaseapp.com",
  projectId: "testtgid",
  storageBucket: "testtgid.firebasestorage.app",
  messagingSenderId: "262521008550",
  appId: "1:262521008550:web:640971c8590503dde95f67"
};

// Инициализация Firebase (ОБНОВЛЕННАЯ!)
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); // ← ЭТУ СТРОЧКУ ДОБАВИТЬ

// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Остальной код остается без изменений...
