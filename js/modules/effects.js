// ================================================================
// effects.js — Логика эффектов анимации
// ================================================================

import { effectSelector } from './state.js';

// Видимость слайдеров в зависимости от эффекта
export function updateSliderVisibility(effectId) {
	const id              = parseInt(effectId);
	const showAnim        = id === 3 || id === 4 || id === 5 || id === 6;
	const showSoftstart   = id === 2 || id === 3 || id === 4 || id === 5 || id === 6;
	const animSlider      = document.getElementById('animation-speed-slider');
	const softstartSlider = document.getElementById('softstart-speed-slider');
	const animContainer      = document.getElementById('anim-speed-container');
	const softstartContainer = document.getElementById('softstart-container');
	if (animSlider)          animSlider.disabled          = !showAnim;
	if (softstartSlider)     softstartSlider.disabled     = !showSoftstart;
	if (animContainer)       animContainer.style.opacity       = showAnim      ? '1' : '0.3';
	if (softstartContainer)  softstartContainer.style.opacity  = showSoftstart ? '1' : '0.3';
}

// Обновление списка эффектов при смене эскиза
export function updateEffectsList(effectsMap, drawValue, effectId = null) {
	if (!effectsMap[drawValue] || !effectSelector) return;
	const allowed = effectsMap[drawValue].effects;

	effectSelector.innerHTML = allowed.map(e => `
		<md-select-option value="${e.id}">
			<div slot="headline">${e.label}</div>
		</md-select-option>
	`).join('');

	const targetId = effectId ? `anim-0${effectId}` : null;
	const match    = targetId && allowed.find(e => e.id === targetId);

	setTimeout(() => {
		effectSelector.value = match ? targetId : allowed[0].id;
		const newId = parseInt(effectSelector.value.replace('anim-', ''));
		updateSliderVisibility(newId);
		sendEffect(newId);
	}, 150);
}

// Применение анимации к SVG предпросмотру
export function sendEffect(id) {
	if (isNaN(id)) return;
	const svgObject = document.querySelector('object[data*=".svg"]');
	if (!svgObject) return;

	function applyClass() {
		const svg = svgObject.contentDocument && svgObject.contentDocument.querySelector('svg');
		if (svg) {
			svg.className.baseVal = `anim-0${id}`;
			console.log(`Эффект применён к SVG: anim-0${id}`);
		}
	}

	if (svgObject.contentDocument && svgObject.contentDocument.querySelector('svg')) {
		applyClass();
	} else {
		svgObject.addEventListener('load', applyClass, { once: true });
	}
	console.log(`Эффект отправлен на ESP32: ID=${id}`);
	// fetch(`/set?effect_id=${id}`);
}
