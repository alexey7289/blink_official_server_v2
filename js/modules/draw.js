// ================================================================
// draw.js — Логика эскизов и модального окна выбора
// ================================================================

import { drawList, drawPickerLabel, setSelectedDrawId } from './state.js';
import { renderExtraDims } from './dims.js';
import { updateEffectsList } from './effects.js';

// Смена SVG предпросмотра (принимает объект draw)
export function updateSvgPreview(draw) {
	const svgObject = document.querySelector('object[data*=".svg"]');
	if (!svgObject) return;
	svgObject.data = draw.perspective;
	console.log(`SVG предпросмотр сменён на: ${draw.perspective}`);
}

// Рендер списка эскизов в модалке (без изменений)
export function renderDrawList(drawsMap, currentSelectedDrawId) {
	if (!drawList) return;
	drawList.innerHTML = drawsMap.map(d => `
		<md-list-item class="responsive-list-item">
			<details class="m3-draw-modal-custom-details" name="schemas">
				<summary class="m3-draw-modal-details-summary">
					<md-radio name="draw-pick" value="${d.id}"
						${currentSelectedDrawId === d.id ? 'checked' : ''}
						onclick="pickDraw('${d.id}')">
					</md-radio>
					<span>${d.label}</span>
					<md-icon class="m3-draw-modal-chevron-icon">expand_more</md-icon>
				</summary>
				<div class="dialog-svg-container">
					<svg viewBox="0 0 200 120"
						fill="none" style="color:#1d1b20">
						${d.svg}
					</svg>
				</div>
			</details>
		</md-list-item>
	`).join('');
}

// Смена эскиза — теперь принимает объект draw, а не id
export function sendDraw(draw, drawsMap, initialValues = {}) {
	updateSvgPreview(draw);                     // передаём объект
	updateEffectsList(draw, initialValues['effect_id']); // передаём объект
	renderExtraDims(draw, initialValues);
	console.log(`Эскиз отправлен на ESP32: ID=${draw.id}`);
	// fetch(`/set?draw_id=${draw.id}`);
}

// Выбор эскиза из модалки (глобальная)
export function initPickDraw(drawsMap) {
	window.pickDraw = function(id) {
		const draw = drawsMap.find(d => d.id === id);
		if (!draw) return;
		setSelectedDrawId(id);
		if (drawPickerLabel) drawPickerLabel.textContent = draw.label;
		renderDrawList(drawsMap, id);
		sendDraw(draw, drawsMap); // передаём объект
	};
}