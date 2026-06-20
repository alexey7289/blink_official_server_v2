/* ================================================================
   app.js — Точка входа. Только импорты и инициализация.
   ================================================================
   Модули:
     state.js   — DOM-переменные и состояние
     ui.js      — питание, навигация
     dims.js    — размеры, валидация, extra-dims
     effects.js — эффекты анимации, слайдеры
     draw.js    — эскизы, модальное окно
     loader.js  — загрузка JSON конфигов
   ================================================================ */

import {
	powerBtn, powerToggle, powerToggleText,
	rgbSelector, COLOR_TYPE_MAP,
	animSlider, softSlider, brightSlider, m3Sliders, getUnit,
	effectSelector, saveDimensionsBtn,
	lengthInput, widthInput, stepInput,
	extraDimsContainer, drawPickerLabel,
	isSaved, setIsSaved
} from './modules/state.js';

import { updatePowerBtn, initNavigation, initChannelsEvents, initTheme, initPowerBtn }             from './modules/ui.js';
import { validateDimensionsAndCheckButton, resetSaveBtn, renderExtraDims } from './modules/dims.js';
import { updateSliderVisibility, sendEffect }          from './modules/effects.js';
import { loadAllConfigs }                              from './modules/loader.js';

document.addEventListener('DOMContentLoaded', () => {
	console.log('Страница загружена. Инициализация модулей.');

	// Навигация
	initNavigation();
	initTheme();
	initChannelsEvents();
	initPowerBtn();

	// Загружаем все конфиги
	loadAllConfigs(drawPickerLabel);

	// ── Слушатели ──────────────────────────────────────────────

	// Питание
	if (powerBtn) {
		powerBtn.addEventListener('click', () => updatePowerBtn());
	}

	// Напряжение
	if (powerToggle && powerToggleText) {
		powerToggle.addEventListener('change', () => {
			powerToggleText.textContent = powerToggle.selected ? '12V' : '5V';
			console.log(`Напряжение: ${powerToggleText.textContent}`);
			// fetch(`/set?voltage=${powerToggle.selected ? 12 : 5}`);
		});
	}

	// Тип кластера
	if (rgbSelector) {
		rgbSelector.addEventListener('change', () => {
			const id = COLOR_TYPE_MAP.indexOf(rgbSelector.value);
			console.log(`Тип кластера: ${rgbSelector.value} (ID: ${id})`);
			// fetch(`/set?color_type_id=${id}`);
		});
	}

	// Слайдеры — отображение значения и отправка
	m3Sliders.forEach(id => {
		const slider  = document.getElementById(`${id}-slider`);
		const display = document.getElementById(`${id}-value`);
		if (!slider || !display) return;
		slider.addEventListener('input',  () => { display.textContent = `${slider.value}${getUnit(id)}`; });
		slider.addEventListener('change', () => {
			console.log(`${id}: ${slider.value}${getUnit(id)}`);
			// fetch(`/set?${id}=${slider.value}`);
		});
	});

	// Поля размеров
	[lengthInput, widthInput, stepInput].forEach(input => {
		if (!input) return;
		input.addEventListener('input', () => {
			input.value = input.value.replace(',', '.');
			if (isSaved) { setIsSaved(false); resetSaveBtn(); }
			validateDimensionsAndCheckButton();
		});
	});

	// Extra-dims через делегирование (создаются динамически)
	if (extraDimsContainer) {
		extraDimsContainer.addEventListener('input', (e) => {
			if (e.target.tagName.toLowerCase() === 'md-outlined-text-field') {
				e.target.value = e.target.value.replace(',', '.');
				if (isSaved) { setIsSaved(false); resetSaveBtn(); }
				validateDimensionsAndCheckButton();
			}
		});
	}

	// Кнопка "Сохранить размеры"
	if (saveDimensionsBtn) {
		saveDimensionsBtn.addEventListener('click', () => {
			const lenMm  = parseFloat(lengthInput ? lengthInput.value : 0);
			const widMm  = parseFloat(widthInput  ? widthInput.value  : 0);
			const stepMm = parseFloat(stepInput   ? stepInput.value   : 0);
			const dimA   = parseFloat(document.getElementById('extra-dim-a')?.value || 0);
			const dimB   = parseFloat(document.getElementById('extra-dim-b')?.value || 0);
			const lengthPixels = Math.round(lenMm / stepMm);
			const widthPixels  = Math.round(widMm / stepMm);
			console.log(`Пикселей: длина=${lengthPixels}, ширина=${widthPixels}, a=${dimA}, b=${dimB}`);
			// fetch(`/set?dims-x=${lengthPixels}&dims-y=${widthPixels}&step=${stepMm}&dims-a=${dimA}&dims-b=${dimB}`);
			console.log('Отправляем reboot на ESP32...');
			// fetch('/reboot');
			setIsSaved(true);
			saveDimensionsBtn.disabled = true;
			saveDimensionsBtn.innerHTML = `<md-icon slot="icon">check</md-icon>Сохранено`;
			saveDimensionsBtn.style.setProperty('--md-filled-button-container-color', '#e0e0e0');
			saveDimensionsBtn.style.setProperty('--md-filled-button-label-text-color', '#9e9e9e');
		});
	}

	// Селектор эффектов
	if (effectSelector) {
		effectSelector.addEventListener('change', () => {
			const id = parseInt(effectSelector.value.replace('anim-', ''));
			console.log(`Эффект изменён: ${effectSelector.value} (ID: ${id})`);
			updateSliderVisibility(id);
			sendEffect(id);
		});
	}

}); // Конец DOMContentLoaded
