// ================================================================
// dims.js — Размеры, валидация и extra-dims поля
// ================================================================

import {
	lengthInput, widthInput, stepInput, saveDimensionsBtn,
	extraDimsContainer, extraDimsFields,
	isSaved, setIsSaved
} from './state.js';

// Сброс кнопки "Сохранить" в исходное состояние
export function resetSaveBtn() {
	if (!saveDimensionsBtn) return;
	saveDimensionsBtn.disabled = false;
	saveDimensionsBtn.innerHTML = `<md-icon slot="icon">upload</md-icon>Сохранить`;
	saveDimensionsBtn.style.removeProperty('--md-filled-button-container-color');
	saveDimensionsBtn.style.removeProperty('--md-filled-button-label-text-color');
}

// Рендер дополнительных полей размеров из draws-map.json
export function renderExtraDims(draw, initialValues = {}) {
	if (!extraDimsContainer || !extraDimsFields) return;
	const dims = draw['extra-dims'] || [];

	if (dims.length === 0) {
		extraDimsContainer.style.display = 'none';
		extraDimsFields.innerHTML = '';
		return;
	}

	extraDimsContainer.style.display = 'block';
	extraDimsFields.innerHTML = dims.map(f => `
		<md-outlined-text-field
			id="extra-dim-${f.id}"
			type="text"
			inputmode="numeric"
			pattern="[0-9.,]*"
			label="${f.label}"
			suffix-text="${f.suffix}"
			supporting-text="${f.hint}"
			value="${initialValues[`dims-${f.id}`] ?? ''}">
		</md-outlined-text-field>
	`).join('');

	// Ждём рендера Web Components и валидируем
	requestAnimationFrame(() => {
		validateDimensionsAndCheckButton();
	});
}

// Валидация размеров и управление кнопкой "Сохранить"
export function validateDimensionsAndCheckButton(drawsMap, selectedDrawId) {
	const length = parseFloat(lengthInput ? lengthInput.value : 0);
	const width  = parseFloat(widthInput  ? widthInput.value  : 0);
	const step   = parseFloat(stepInput   ? stepInput.value   : 0);
	let hasAnyError = false;

	// Проверяем шаг резки
	if (isNaN(step) || step <= 0) {
		if (stepInput) { stepInput.error = true; stepInput.errorText = 'Ошибка'; }
		hasAnyError = true;
	} else {
		if (stepInput) { stepInput.error = false; stepInput.supportingText = ' '; }
	}

	// Проверка одного поля на кратность шагу
	function checkField(inputElement, value) {
		if (!inputElement) return;
		if (!inputElement.value || isNaN(value)) {
			inputElement.error = false;
			inputElement.supportingText = ' ';
			hasAnyError = true;
			return;
		}
		if (isNaN(step) || step <= 0) {
			inputElement.supportingText = ' ';
			return;
		}
		const remainder = value % step;
		const isValid = Math.abs(remainder) < 0.01 || Math.abs(remainder - step) < 0.01;
		if (isValid) {
			const pixelsCount = Math.round(value / step);
			inputElement.error = false;
			inputElement.supportingText = `ОК. ${pixelsCount} пикселей`;
		} else {
			inputElement.error = true;
			inputElement.errorText = 'Не делится';
			hasAnyError = true;
			if (stepInput) { stepInput.error = true; stepInput.errorText = 'Проверь шаг'; }
		}
	}

	// Проверяем основные поля
	checkField(lengthInput, length);
	checkField(widthInput, width);

	// Проверяем extra-dims поля
	if (drawsMap && selectedDrawId) {
		const currentDraw = drawsMap.find(d => d.id === selectedDrawId);
		if (currentDraw && currentDraw['extra-dims']) {
			currentDraw['extra-dims'].forEach(f => {
				const input = document.getElementById(`extra-dim-${f.id}`);
				if (input) checkField(input, parseFloat(input.value));
			});
		}
	}

	// Управление кнопкой
	if (saveDimensionsBtn && !isSaved) {
		saveDimensionsBtn.disabled = hasAnyError;
	}
}
