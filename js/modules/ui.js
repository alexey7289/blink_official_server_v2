// ================================================================
// ui.js — Обновление интерфейса (питание, навигация, wifi)
// ================================================================

// ИМПОРТИРУЕМ ФОРМУ РАДИО-КНОПОК ИЗ СТЕЙТА:
import { powerBtn, mainContent, navItems, pages, channelsForm, isPowerOn, setIsPowerOn } from './state.js';
// ИМПОРТИРУЕМ ФУНКЦИЮ ОТПРАВКИ ИЗ ЛОАДЕРА:
import { saveChannelsQty } from './loader.js';
// ИМПОРТ УПРАЛЕНИЯ ТЕМАМИ СТРАНИЦЫ
import { themeToggleBtn } from './state.js';

// Управление питанием
export function updatePowerBtn() {
	if (!powerBtn || !mainContent) return;
	const navBar = document.querySelector('.m3-nav-bar');

	if (!isPowerOn) {
		// Питание ВЫКЛ
		mainContent.style.opacity       = '0.15';
		mainContent.style.pointerEvents = 'none';
		mainContent.style.userSelect    = 'none';
		if (navBar) {
			navBar.style.opacity       = '0.15';
			navBar.style.pointerEvents = 'none';
		}
		powerBtn.innerHTML = `<md-icon slot="icon">light_off</md-icon>`;
		console.log('[UI] -> Питание ВЫКЛ');
	} else {
		// Питание ВКЛ
		mainContent.style.opacity       = '1';
		mainContent.style.pointerEvents = 'auto';
		mainContent.style.userSelect    = 'auto';
		if (navBar) {
			navBar.style.opacity       = '1';
			navBar.style.pointerEvents = 'auto';
		}
		powerBtn.innerHTML = `<md-icon slot="icon">lightbulb</md-icon>`;
		console.log('[UI] -> Питание ВКЛ');
	}
}

// Переключение питания по клику на FAB
export function initPowerBtn() {
	if (!powerBtn) return;
	powerBtn.addEventListener('click', () => {
		setIsPowerOn(!isPowerOn);
		updatePowerBtn();
	});
}

// Управление включения/выключения темной темы
export function initTheme() {
	// Восстанавливаем тему из localStorage
	const savedTheme = localStorage.getItem('theme');
	if (savedTheme === 'dark') {
		document.documentElement.setAttribute('data-theme', 'dark');
		if (themeToggleBtn) themeToggleBtn.selected = true;
	}

	if (themeToggleBtn) {
		themeToggleBtn.addEventListener('click', () => {
			const isDark = themeToggleBtn.selected;
			if (isDark) {
				document.documentElement.setAttribute('data-theme', 'dark');
				localStorage.setItem('theme', 'dark');
			} else {
				document.documentElement.removeAttribute('data-theme');
				localStorage.setItem('theme', 'light');
			}
		});
	}
}




// Навигация по табам
export function initNavigation() {
	// Активная страница при старте
	document.querySelector('[data-page="home"]').classList.add('page--active');

	navItems.forEach(btn => {
		btn.addEventListener('click', () => {
			const target = btn.dataset.tab;
			navItems.forEach(b => b.classList.remove('m3-nav-item--active'));
			btn.classList.add('m3-nav-item--active');
			pages.forEach(p => p.classList.remove('page--active'));
			document.querySelector(`[data-page="${target}"]`).classList.add('page--active');
		});
	});
}

// НАША НОВАЯ ФУНКЦИЯ ДЛЯ ОБРАБОТКИ СОБЫТИЙ РАДИО-КНОПОК
export function initChannelsEvents() {
	if (!channelsForm) return;

	channelsForm.addEventListener('change', (event) => {
		// Проверяем, что событие всплыло именно от веб-компонента md-radio
		if (event.target.tagName.toLowerCase() === 'md-radio') {
			const selectedValue = event.target.value;
			console.log(`[UI] -> Выбрано каналов: ${selectedValue}`);
			
			// Вызываем отправку JSON на ESP32
			saveChannelsQty(selectedValue);
		}
	});
}
