// ==========================================================================
// CENTRAL CONTROL MODULE (SmartLight UI & ESP32 NVS Bridge)
// ==========================================================================

console.log("[System] Модуль app.js успешно инициализирован браузером.");

// Глобальный объект для хранения текущего состояния (слепок NVS)
let currentSettings = {
  version: "0.0",
  is_online: false,
  system_power: false,
  brightness: 0,
  animation_mode: 0,
  voltage: 5             // ДОБАВЛЕНО: текущее выбранное напряжение (5 или 12)
};

// Находим интерактивные элементы на странице по ID
const wifiBtn = document.getElementById('wifi-status');
const powerBtn = document.getElementById('power-btn');
const versionSpan = document.getElementById('logo-version');
const voltageContainer = document.getElementById('voltage-toggle-container'); // ДОБАВЛЕНО

/**
 * 1. Функция обновления визуального состояния UI на основе данных настроек
 */
function updateUI(settings) {
  console.log("[UI] Начинаю обновление элементов интерфейса...");

  // --- Обновление текстовой версии в логотипе ---
  if (versionSpan) {
    const formattedVersion = settings.version.startsWith('v') ? settings.version : `v${settings.version}`;
    versionSpan.textContent = formattedVersion;
    console.log(`[UI] -> Версия сайта в логотипе обновлена на: ${formattedVersion}`);
  }

  // --- Обновление индикатора Wi-Fi ---
  if (wifiBtn) {
    if (settings.is_online) {
      wifiBtn.innerHTML = '<md-icon slot="icon">android_wifi_3_bar</md-icon>Подключено';
      wifiBtn.classList.remove('m3-wifi-status--disconnected');
      console.log("[UI] -> Индикатор Wi-Fi: ПОДКЛЮЧЕНО (иконка: android_wifi_3_bar)");
    } else {
      wifiBtn.innerHTML = '<md-icon slot="icon">android_wifi_3_bar_off</md-icon>Отключено';
      wifiBtn.classList.add('m3-wifi-status--disconnected');
      console.log("[UI] -> Индикатор Wi-Fi: ОТКЛЮЧЕНО (иконка: android_wifi_3_bar_off)");
    }
  }

  // --- Обновление кнопки питания (лампочки) ---
  if (powerBtn) {
    powerBtn.selected = settings.system_power;
    console.log(`[UI] -> Состояние лампочки (system_power): ${settings.system_power ? 'ВКЛ' : 'ВЫКЛ'}`);
  }

  // --- ИСПРАВЛЕНО: Динамическое переключение типа кнопки Напряжения ---
  if (voltageContainer) {
    if (settings.voltage === 12) {
      voltageContainer.innerHTML = '<md-filled-button>12V</md-filled-button>';
      console.log("[UI] -> Кнопка напряжения: ЗАЛИТАЯ (12V)");
    } else {
      voltageContainer.innerHTML = '<md-outlined-button>5V</md-outlined-button>';
      console.log("[UI] -> Кнопка напряжения: КОНТУРНАЯ (5V)");
    }
    
    attachVoltageListener();
  } else {
    console.error("[UI] Ошибка: Контейнер #voltage-toggle-container не найден!");
  }
  
  console.log("[UI] Обновление интерфейса успешно завершено.");
} // <-- ВОТ ЭТА СКОБКА, которая закрывает саму функцию updateUI


/**
 * Функция отслеживания тапа по кнопке напряжения
 */
function attachVoltageListener() {
  const currentBtn = voltageContainer.querySelector('.m3-flat-button');
  if (currentBtn) {
	// Используем синтаксис один-к-одному, чтобы старые слушатели не дублировались
	currentBtn.onclick = () => {
	  console.log('[User Action] Пользователь нажал на переключатель напряжения.');
	  
	  // Логика триггера: если было 5, ставим 12, и наоборот
	  currentSettings.voltage = (currentSettings.voltage === 5) ? 12 : 5;
	  
	  console.log(`[NVS] Локальный слепок памяти обновлен. voltage = ${currentSettings.voltage}V`);
	  
	  // Сразу обновляем интерфейс и отправляем пакет на ESP32
	  updateUI(currentSettings);
	  saveSettingsToServer();
	};
  }
}

/**
 * 2. Инициализация: Загрузка актуальных настроек (NVS) с сервера ESP32
 */
async function loadSettingsFromServer() {
  const url = './config/settings.json';
  console.log(`[GET] Отправляю запрос на чтение конфигурации: ${url}`);
  
  try {
	const response = await fetch(url);
	console.log(`[GET] Ответ от сервера получен. Статус: ${response.status} (${response.statusText})`);
	if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
	
	currentSettings = await response.json();
	console.log('[NVS] JSON успешно распарсен во внутреннюю память. Текущий слепок:', currentSettings);
	
	updateUI(currentSettings);
  } catch (error) {
	console.error('[NVS] Критическая ошибка загрузки конфигурации settings.json:', error.message);
  }
}

/**
 * 3. Отправка измененных настроек обратно на контроллер ESP32
 */
async function saveSettingsToServer() {
  const url = '/api/save-settings';
  console.log(`[POST] Подготовка к отправке данных на ESP32. Эндпоинт: ${url}`);
  console.log('[POST] Отправляемый пакет данных:', JSON.stringify(currentSettings));
  
  try {
	const response = await fetch(url, {
	  method: 'POST',
	  headers: { 'Content-Type': 'application/json' },
	  body: JSON.stringify(currentSettings)
	});
	console.log(`[POST] Ответ сервера на сохранение. Статус: ${response.status}`);
  } catch (error) {
	console.warn('[POST] Инфо: Локальный тест. Отправка на ESP32 сымитирована (сервер недоступен). Error:', error.message);
  }
}

// ==========================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ==========================================================================

if (powerBtn) {
  powerBtn.addEventListener('change', () => {
	console.log('[User Action] Пользователь нажал на кнопку питания (лампочку).');
	currentSettings.system_power = powerBtn.selected;
	console.log(`[NVS] Локальный слепок памяти обновлен. system_power = ${currentSettings.system_power}`);
	saveSettingsToServer();
  });
}

// Навигация (Нижняя панель m3-nav-bar)
const navItems = document.querySelectorAll('.m3-nav-item');
if (navItems.length > 0) {
  navItems.forEach((item, index) => {
	item.addEventListener('click', () => {
	  const tabLabel = item.querySelector('.m3-label')?.textContent || `Вкладка #${index + 1}`;
	  console.log(`[User Action] Пользователь переключился на вкладку: "${tabLabel}"`);
	  const currentActive = document.querySelector('.m3-nav-item--active');
	  if (currentActive) currentActive.classList.remove('m3-nav-item--active');
	  item.classList.add('m3-nav-item--active');
	});
  });
}

// Запуск автоматической загрузки данных при старте страницы
document.addEventListener('DOMContentLoaded', () => {
  console.log("[System] Страница загружена. Запускаю синхронизацию с NVS...");
  loadSettingsFromServer();
});
