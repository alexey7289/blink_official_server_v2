// ================================================================
// ui.js — Обновление интерфейса (питание, навигация, wifi)
// ================================================================

// ИМПОРТИРУЕМ ФОРМУ РАДИО-КНОПОК ИЗ СТЕЙТА:
import { powerBtn, mainContent, navItems, pages, channelsForm } from './state.js';
// ИМПОРТИРУЕМ ФУНКЦИЮ ОТПРАВКИ ИЗ ЛОАДЕРА:
import { saveChannelsQty } from './loader.js';

// Управление питанием
export function updatePowerBtn() {
	if (!powerBtn || !mainContent) return;
	const isPowerOff = powerBtn.selected;
	if (isPowerOff) {
		mainContent.style.opacity       = '0.15';
		mainContent.style.pointerEvents = 'none';
		mainContent.style.userSelect    = 'none';
		console.log('[UI] -> Питание ВЫКЛ');
	} else {
		mainContent.style.opacity       = '1';
		mainContent.style.pointerEvents = 'auto';
		mainContent.style.userSelect    = 'auto';
		console.log('[UI] -> Питание ВКЛ');
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
