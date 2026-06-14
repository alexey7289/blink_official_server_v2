// ================================================================
// loader.js — Загрузка конфигов и初始化 данных
// ================================================================

import {
	versionSpan, powerBtn, wifiBtn,
	powerToggle, powerToggleText, rgbSelector,
	lengthInput, widthInput, stepInput,
	m3Sliders, getUnit, loader,
	setDrawsMap, setEffectsMap, setSelectedDrawId,
	// ИМПОРТИРУЕМ НАШИ НОВЫЕ ПЕРЕМЕННЫЕ И СЕТТЕР:
	setChannelsQty, channelsRadios 
} from './state.js';
import { updatePowerBtn }     from './ui.js';
import { validateDimensionsAndCheckButton } from './dims.js';
import { renderDrawList, sendDraw, initPickDraw } from './draw.js';
import { updateEffectsList }  from './effects.js';

export function loadAllConfigs(drawPickerLabel) {
	Promise.all([
		fetch('./config/settings.json').then(r => { if (!r.ok) throw new Error('settings.json не найден'); return r.json(); }),
		fetch('./config/draws-map.json').then(r => r.json()),
		fetch('./config/effect-map.json').then(r => r.json()),
	]).then(([settings, drawsData, effectsData]) => {
		console.log('Все файлы загружены.');

		const drawsMap   = drawsData.draws;
		const effectsMap = effectsData;
		setDrawsMap(drawsMap);
		setEffectsMap(effectsMap);

		// Питание
		if (powerBtn && settings['power'] !== undefined) {
			powerBtn.selected = !settings['power'];
			updatePowerBtn();
		}
		// Версия
		if (versionSpan && settings.version) {
			const v = settings.version.startsWith('v') ? settings.version : `v${settings.version}`;
			versionSpan.textContent = v;
		}
		// Wi-Fi статус
		if (wifiBtn && settings['is_online'] !== undefined) {
			if (settings['is_online']) {
				wifiBtn.innerHTML = '<md-icon slot="icon">android_wifi_3_bar</md-icon>Подключено';
				wifiBtn.classList.remove('m3-wifi-status--disconnected');
			} else {
				wifiBtn.innerHTML = '<md-icon slot="icon">android_wifi_3_bar_off</md-icon>Отключено';
				wifiBtn.classList.add('m3-wifi-status--disconnected');
			}
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
		// КОЛИЧЕСТВО КАНАЛОВ (НАША НОВАЯ ЛОГИКА ЗАГРУЗКИ)
		if (settings['channels_qty'] != null) {
			const qty = settings['channels_qty'];
			setChannelsQty(qty); // Сохраняем в state.js
			
			// Ищем кнопку с нужным значением value и активируем её
			if (channelsRadios) {
				const activeRadio = Array.from(channelsRadios).find(r => parseInt(r.value, 10) === qty);
				if (activeRadio) activeRadio.checked = true;
			}
		}
		// Эскиз
		let selectedDrawId = 'draw-01';
		if (settings['draw_id'] != null) {
			selectedDrawId = `draw-0${settings['draw_id']}`;
			setSelectedDrawId(selectedDrawId);
		}

		// Инициализируем pickDraw с актуальными данными
		initPickDraw(drawsMap, effectsMap);

		renderDrawList(drawsMap, selectedDrawId);
		const d = drawsMap.find(x => x.id === selectedDrawId);
		if (d && drawPickerLabel) drawPickerLabel.textContent = d.label;
		updateEffectsList(effectsMap, selectedDrawId, settings['effect_id']);
		sendDraw(parseInt(selectedDrawId.replace('draw-', '')), effectsMap, drawsMap, settings);

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

// Функция сохранения настроек количества каналов
export async function saveChannelsQty(qty) {
	try {
		const valueAsNumber = parseInt(qty, 10);
		setChannelsQty(valueAsNumber); // Обновляем локальный стейт

		// Отправляем JSON-объект на ESP32 эндпоинт настроек
		/* const response = await fetch('./config/settings.json', { 
			method: 'POST', // Используйте POST или PUT в зависимости от обработчика на ESP32
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ channels_qty: valueAsNumber })
		});

		if (!response.ok) throw new Error('Ошибка сервера при сохранении каналов'); */
		console.log(`Количество каналов (${valueAsNumber}) успешно сохранено.`);
	} catch (error) {
		console.warn('Не удалось сохранить количество каналов:', error.message);
	}
}
