// ================================================================
// power.js — Расчёт энергопотребления ленты
// ================================================================

import {
	homeBrightnessSlider, homePowerValue,
	currentDimsX, currentDimsY, currentStep, currentDrawId, currentVoltage,
	brightSlider
} from './state.js';

// Расчёт суммарного тока потребления (в амперах)
export function calcTotalPower(dimsX, dimsY, step, drawId, voltage) {
	if (!step || step <= 0) return 0;

	let totalPower;
	if (drawId === 1 && voltage === 5) {
		totalPower = ((dimsX * 2 + dimsY * 2) / step) * 0.06;
	} else if (drawId === 1 && voltage === 12) {
		totalPower = (((dimsX * 2 + dimsY * 2) / step) * 0.06) * 3;
	} else {
		totalPower = ((dimsX + dimsY) / step) * 0.06;
	}
	return totalPower;
}

// Обновление отображения мощности на Home (учитывает текущую яркость)
export function updateHomePowerDisplay() {
	if (!homePowerValue) return;

	const fullPower = calcTotalPower(currentDimsX, currentDimsY, currentStep, currentDrawId, currentVoltage);
	const brightnessPercent = homeBrightnessSlider ? parseFloat(homeBrightnessSlider.value) : 100;
	const actualPower = fullPower * (brightnessPercent / 100);

	homePowerValue.textContent = `${actualPower.toFixed(2)} А`;
}

// Синхронизация двух слайдеров яркости (tune ↔ home)
export function initBrightnessSync() {
	if (!homeBrightnessSlider || !brightSlider) return;

	// При движении слайдера на Home — обновляем основной слайдер
	homeBrightnessSlider.addEventListener('input', () => {
		brightSlider.value = homeBrightnessSlider.value;
		const display = document.getElementById('max-brightness-value');
		if (display) display.textContent = `${brightSlider.value} %`;
		updateHomePowerDisplay();
	});

	// При движении основного слайдера — обновляем Home
	brightSlider.addEventListener('input', () => {
		homeBrightnessSlider.value = brightSlider.value;
		updateHomePowerDisplay();
	});
}