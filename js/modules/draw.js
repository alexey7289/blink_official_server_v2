// ================================================================
// draw.js — Логика эскизов и модального окна выбора
// ================================================================

import { drawList, drawPickerLabel, selectedDrawId, setSelectedDrawId } from './state.js';
import { renderExtraDims } from './dims.js';
import { updateEffectsList } from './effects.js';

// Смена SVG предпросмотра
export function updateSvgPreview(drawId) {
	const svgObject = document.querySelector('object[data*=".svg"]');
	if (!svgObject) return;
	svgObject.data = `./components/anim${drawId}/anim${drawId}.svg`;
	console.log(`SVG предпросмотр сменён на: anim${drawId}.svg`);
}

// Рендер списка эскизов в модалке
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
					<svg width="200" height="120" viewBox="0 0 100 70"
						fill="none" style="color:#1d1b20">
						${d.svg}
					</svg>
				</div>
			</details>
		</md-list-item>
	`).join('');
}

// Смена эскиза — обновляем SVG, эффекты и extra-dims
export function sendDraw(id, effectsMap, drawsMap, initialValues = {}) {
	updateSvgPreview(id);
	updateEffectsList(effectsMap, `draw-0${id}`, initialValues['effect_id']);
	const draw = drawsMap.find(d => d.id === `draw-0${id}`);
	if (draw) renderExtraDims(draw, initialValues);
	console.log(`Эскиз отправлен на ESP32: ID=${id}`);
	// fetch(`/set?draw_id=${id}`);
}

// Выбор эскиза из модалки (глобальная — вызывается из onclick в HTML)
export function initPickDraw(drawsMap, effectsMap) {
	window.pickDraw = function(id) {
		setSelectedDrawId(id);
		const d = drawsMap.find(x => x.id === id);
		if (d && drawPickerLabel) drawPickerLabel.textContent = d.label;
		renderDrawList(drawsMap, id);
		const numId = parseInt(id.replace('draw-', ''));
		sendDraw(numId, effectsMap, drawsMap);
	};
}
