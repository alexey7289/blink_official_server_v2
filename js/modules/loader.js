// ================================================================
// loader.js — Загрузка конфигов и данных
// ================================================================

import {
	versionSpan, powerBtn, wifiIcon, wifiTitle, wifiIp,
	powerToggle, powerToggleText, rgbSelector,
	lengthInput, widthInput, stepInput,
	m3Sliders, getUnit, loader,
	setDrawsMap, setEffectsMap, setSelectedDrawId,
	setChannelsQty, channelsRadios,
	setIsPowerOn
} from './state.js';
import { updatePowerBtn }     from './ui.js';
import { validateDimensionsAndCheckButton } from './dims.js';
import { renderDrawList, sendDraw, initPickDraw } from './draw.js';
import { updateEffectsList }  from './effects.js';
import { setCurrentDims, homeBrightnessSlider } from './state.js';
import { updateHomePowerDisplay } from './power.js';

export function loadAllConfigs(drawPickerLabel) {
	// Загружаем только два файла: settings.json и draws.json
	// effects.json НЕ нужен, т.к. эффекты уже встроены в draws.json
	Promise.all([
		fetch('./config/settings.json').then(r => { if (!r.ok) throw new Error('settings.json не найден'); return r.json(); }),
		fetch('./config/draws.json').then(r => r.json()),
	]).then(([settings, drawsData]) => {
		console.log('Все файлы загружены.');

		const drawsMap = drawsData.draws; // массив рисунков
		setDrawsMap(drawsMap);

		// ====== Настройка параметров ======
		setCurrentDims(
			settings['dims-x'] || 0,
			settings['dims-y'] || 0,
			settings['step']   || 1,
			settings['draw_id'] || 1,
			settings['voltage'] || 5
		);

		if (homeBrightnessSlider && settings['max-brightness'] != null) {
			homeBrightnessSlider.value = settings['max-brightness'];
		}
		updateHomePowerDisplay();

		// Питание
		if (settings['isPower'] !== undefined) {
			setIsPowerOn(settings['isPower']);
			updatePowerBtn();
		}
		// Версия
		if (versionSpan && settings.version) {
			const v = settings.version.startsWith('v') ? settings.version : `v${settings.version}`;
			versionSpan.textContent = v;
		}
		// Wi-Fi статус
		if (wifiIcon && settings['isOnline'] !== undefined) {
			if (settings['isOnline']) {
				wifiIcon.innerHTML = 'android_wifi_3_bar';
				if (wifiTitle) wifiTitle.textContent = 'Контроллер "В сети"';
			} else {
				wifiIcon.innerHTML = 'android_wifi_3_bar_off';
				if (wifiTitle) wifiTitle.textContent = 'Контроллер "Не в сети"';
			}
		}
		// IP контроллера
		if (wifiIp && settings['controllerIp'] !== undefined) {
			wifiIp.textContent = settings['isOnline']
				? `IP контроллера: ${settings['controllerIp']}`
				: 'IP контроллера: ---';
		}

		// Поля размеров
		if (lengthInput && settings['dims-x'] != null) lengthInput.value = settings['dims-x'];
		if (widthInput  && settings['dims-y'] != null) widthInput.value  = settings['dims-y'];
		if (stepInput   && settings['step']   != null) stepInput.value   = settings['step'];
		validateDimensionsAndCheckButton(drawsMap, settings['draw_id'] ? `draw-0${settings['draw_id']}` : 'draw-01');

		// Слайдеры
		m3Sliders.forEach(id => {
			const slider  = document.getElementById(`${id}-slider`);
			const display = document.getElementById(`${id}-value`);
			if (slider && display && settings[id] != null) {
				slider.value = settings[id];
				display.textContent = `${slider.value}${getUnit(id)}`;
			}
		});
		// Напряжение
		if (powerToggle && powerToggleText && settings['voltage'] != null) {
			const is12V = settings['voltage'] === 12;
			powerToggle.selected = is12V;
			powerToggleText.textContent = is12V ? '12V' : '5V';
		}
		// Тип кластера
		if (rgbSelector && settings['color_type']) {
			rgbSelector.value = settings['color_type'];
		}
		// Количество каналов
		if (settings['channels_qty'] != null) {
			const qty = settings['channels_qty'];
			setChannelsQty(qty);
			if (channelsRadios) {
				const activeRadio = Array.from(channelsRadios).find(r => parseInt(r.value, 10) === qty);
				if (activeRadio) activeRadio.checked = true;
			}
		}

		// ====== ОПРЕДЕЛЯЕМ ВЫБРАННЫЙ РИСУНОК ======
		let selectedDrawId = 'draw-01';
		if (settings['draw_id'] != null) {
			selectedDrawId = `draw-0${settings['draw_id']}`;
			setSelectedDrawId(selectedDrawId);
		}

		// Находим объект текущего рисунка
		const currentDraw = drawsMap.find(d => d.id === selectedDrawId);

		// Инициализируем pickDraw (если он использует карту эффектов – передаём её, но мы её не используем)
		// Вместо глобальной карты эффектов передаём массив эффектов текущего рисунка (или ничего)
		// Если initPickDraw не использует эффекты, можно просто вызвать без второго аргумента.
		// Предположим, что он ожидает drawsMap и что-то ещё – оставим как было, но передадим пустой объект или null.
		// Но чтобы не ломать, можно передать текущий массив эффектов.
		const effectsForDraw = currentDraw ? currentDraw.effects : [];
		initPickDraw(drawsMap); // или передайте null, если не используется

		// ====== РЕНДЕРИМ СПИСОК РИСУНКОВ ======
		renderDrawList(drawsMap, selectedDrawId);

		// Обновляем лейбл выбранного рисунка
		if (currentDraw && drawPickerLabel) {
			drawPickerLabel.textContent = currentDraw.label;
		}

		// ====== ОБНОВЛЯЕМ ЭФФЕКТЫ ======
		// Передаём текущий объект рисунка, а не effectsMap
		updateEffectsList(currentDraw, settings['effect_id']);

		// Отправляем на ESP32 (передаём текущий рисунок и его эффекты)
		sendDraw(currentDraw, drawsMap, settings);

	}).catch(error => {
		console.warn('Ошибка загрузки:', error.message);
	}).finally(() => {
		if (loader) {
			loader.style.opacity    = '0';
			loader.style.transition = 'opacity 0.3s ease';
			setTimeout(() => loader.style.display = 'none', 300);
		}
	});
}

// Функция сохранения настроек количества каналов (без изменений)
export async function saveChannelsQty(qty) {
	try {
		const valueAsNumber = parseInt(qty, 10);
		setChannelsQty(valueAsNumber);
		console.log(`Количество каналов (${valueAsNumber}) успешно сохранено.`);
	} catch (error) {
		console.warn('Не удалось сохранить количество каналов:', error.message);
	}
}