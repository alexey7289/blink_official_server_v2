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
  voltage: 5
};

// Находим интерактивные элементы на странице по ID
const wifiBtn = document.getElementById('wifi-status');
const powerBtn = document.getElementById('power-btn');
const versionSpan = document.getElementById('logo-version');
const voltageContainer = document.getElementById('voltage-toggle-container');
const colorType = document.getElementById('rgb-selector');

/**
 * 1. Отправка измененных настроек обратно на контроллер ESP32
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

/**-----------------------------------------------------------------------------
 * 2. Функция отслеживания тапа по кнопке напряжения (Железобетонная привязка)
-----------------------------------------------------------------------------**/
function attachVoltageListener() {
  // Селектор ищет ЛЮБУЮ кнопку Material Web, которая сейчас создана внутри контейнера
  const currentBtn = voltageContainer.querySelector('md-filled-button, md-outlined-button');
  
  if (currentBtn) {
    console.log("[System] Найдена кнопка вольтажа в DOM. Привязываю событие клика...");
    
    // Навешиваем событие клика
    currentBtn.addEventListener('click', (event) => {
      event.preventDefault();
      console.log('[User Action] Пользователь нажал на переключатель напряжения.');
      
      // Логика триггера: меняем 5 на 12, или 12 на 5
      currentSettings.voltage = (currentSettings.voltage === 5) ? 12 : 5;
      console.log(`[NVS] Локальный слепок памяти обновлен. voltage = ${currentSettings.voltage}V`);
      
      // Сразу вызываем перерисовку интерфейса и отправляем пакет на ESP32
      updateUI(currentSettings);
      saveSettingsToServer();
    });
  } else {
    console.error("[System] Критическая ошибка: Кнопка вольтажа не найдена внутри контейнера!");
  }
}

/**
 * 3. Функция обновления визуального состояния UI на основе данных настроек
 */
function updateUI(settings) {
  console.log("[UI] Начинаю обновление элементов интерфейса...");
  // --- Обновление порядка каналов ленты ---
  if (colorType) {
    colorType.value = settings.color_type;
    console.log(`[UI] -> Порядок каналов в меню выставлен на: ${settings.color_type}`);
  }

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

  // --- Динамическое переключение типа кнопки Напряжения ---
  if (voltageContainer) {
    if (settings.voltage === 12) {
      voltageContainer.innerHTML = '<md-filled-button>12V</md-filled-button>';
      console.log("[UI] -> Кнопка напряжения отрисована как: ЗАЛИТАЯ (12V)");
    } else {
      voltageContainer.innerHTML = '<md-outlined-button>5V</md-outlined-button>';
      console.log("[UI] -> Кнопка напряжения отрисована как: КОНТУРНАЯ (5V)");
    }
    
    // РЕШЕНИЕ: Даем браузеру микропаузу (10 миллисекунд), чтобы он гарантированно 
    // успел внедрить новый HTML-код кнопки в память, и только потом вешаем клик!
    setTimeout(attachVoltageListener, 10);

  } else {
    console.error("[UI] Ошибка: Контейнер #voltage-toggle-container не найден!");
  }
  
  console.log("[UI] Обновление интерфейса успешно завершено.");
}

/**
 * 4. Инициализация: Загрузка актуальных настроек (NVS) с сервера ESP32
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

// ==========================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ (Слушаем действия пользователя)
// ==========================================================================

// Слушаем лампочку питания в шапке
if (powerBtn) {
  powerBtn.addEventListener('change', () => {
    console.log('[User Action] Пользователь нажал на кнопку питания (лампочку).');
    currentSettings.system_power = powerBtn.selected;
    console.log(`[NVS] Локальный слепок памяти обновлен. system_power = ${currentSettings.system_power}`);
    saveSettingsToServer();
  });
}

// Слушаем изменение выпадающего списка порядка каналов
if (colorType) {
  colorType.addEventListener('change', () => {
    console.log('[User Action] Пользователь изменил порядок каналов RGB.');
    
    // Записываем строковое значение (например, "BGR") прямо в слепок памяти
    currentSettings.color_type = colorType.value;
    console.log(`[NVS] Локальный слепок памяти обновлен. color_order = "${currentSettings.color_type}"`);
    
    // Отправляем обновленный JSON на веб-сервер ESP32
    saveSettingsToServer();
  });
}

// Навигация (Нижняя панель m3-nav-bar)
const navItems = document.querySelectorAll('.m3-nav-item');
if (navItems.length > 0) {
  console.log(`[Navigation] Найдено кнопок меню для отслеживания: ${navItems.length}`);
  navItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      const tabLabel = item.querySelector('.m3-label')?.textContent || `Вкладка #${index + 1}`;
      console.log(`[User Action] Пользователь переключился на вкладку: "${tabLabel}"`);
      
      const currentActive = document.querySelector('.m3-nav-item--active');
      if (currentActive) {
        currentActive.classList.remove('m3-nav-item--active');
      }
      item.classList.add('m3-nav-item--active');
      console.log(`[UI] Класс активности m3-nav-item--active успешно переключен.`);
    });
  });
} else {
  console.error("[Navigation] Ошибка: Элементы .m3-nav-item не найдены на странице!");
}

// Запуск автоматической загрузки данных при старте страницы
document.addEventListener('DOMContentLoaded', () => {
  console.log("[System] Страница загружена. Запускаю синхронизацию с NVS...");
  loadSettingsFromServer();
});
