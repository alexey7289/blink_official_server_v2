/* [Считыватель (Fetch)] ──> Настройки из ESP32 
								 │
								 ▼
						  [Переменные (State)] <── [Слушатели (Events)] ── Действия пользователя
								 │
								 ▼
						  [Функции (Логика)] ──> Расчет пикселей / Валидация
								 │
								 ▼
						  [Экспорт (Output)] ──> Обновление экрана (HTML) / Запросы на ESP32 */

// Ждем полную загрузку HTML-страницы браузером
document.addEventListener('DOMContentLoaded', () => {
	console.log('Страница загружена. Инициализация модулей.');
	

	// ===========================================================================
	// 0. БЛОК «ПЕРЕМЕННЫЕ» (Объявляем в самом начале, чтобы их видели все блоки ниже)
	// ===========================================================================

	const versionSpan        = document.getElementById('logo-version');
	const powerBtn           = document.getElementById('power-btn');
	const mainContent        = document.querySelector('main');
	// Навигация по табам
	const navItems           = document.querySelectorAll('.m3-nav-item[data-tab]');
	const pages              = document.querySelectorAll('[data-page]');
	// Поля выбора анимации
	const effectSelector     = document.getElementById('effect-selector');
	const animSpeedContainer = document.getElementById('anim-speed-container');
	const softstartContainer = document.getElementById('softstart-container');
	// Статус и настройки
	const wifiBtn            = document.getElementById('wifi-status');
	const powerToggle        = document.getElementById('power-toggle');
	const powerToggleText    = document.getElementById('power-toggle-text');
	const rgbSelector        = document.getElementById('rgb-selector');
	const COLOR_TYPE_MAP     = ['RGB', 'RBG', 'GRB', 'GBR', 'BRG', 'BGR'];
	// Слайдеры
	const animSlider         = document.getElementById('animation-speed-slider');
	const softSlider         = document.getElementById('softstart-speed-slider');
	const brightSlider       = document.getElementById('max-brightness-slider');
	// Корни ID слайдеров (совпадают с ключами в settings.json)
	const m3Sliders          = ['animation-speed', 'softstart-speed', 'max-brightness'];
	// Единицы измерения для слайдеров
	const getUnit            = (id) => id.includes('brightness') ? ' %' : ' мс';
	// Поля размеров
	const lengthInput        = document.getElementById('length-field');
	const widthInput         = document.getElementById('width-field');
	const stepInput          = document.getElementById('step-field');
	const saveDimensionsBtn  = document.getElementById('save-dimensions-btn');
	const extraDimsContainer = document.getElementById('extra-dims-container');
	const extraDimsFields    = document.getElementById('extra-dims-fields');
	// Выбор эскиза
	const drawPickerLabel    = document.getElementById('draw-picker-label');
	const drawList           = document.getElementById('draw-list');
	const loader             = document.getElementById('app-loader');
	// Состояние
	let effectsMap    = {};
	let drawsMap      = [];
	let selectedDrawId = 'draw-01';
	let isSaved       = false;


	// ================================================================
	// 1. БЛОК «СЧИТЫВАТЕЛЬ» (Загрузка всех конфигов при старте)
	// ================================================================

	Promise.all([
		fetch('./config/settings.json').then(r => { if (!r.ok) throw new Error('settings.json не найден'); return r.json(); }),
		fetch('./config/draws-map.json').then(r => r.json()),
		fetch('./config/effect-map.json').then(r => r.json()),
	]).then(([settings, drawsData, effectsData]) => {
		console.log('Все файлы загружены.');

		drawsMap   = drawsData.draws;
		effectsMap = effectsData;

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
		if (widthInput  && settings['dims-y']  != null) widthInput.value  = settings['dims-y'];
		if (stepInput   && settings['step']   != null) stepInput.value   = settings['step'];
		validateDimensionsAndCheckButton();
		// Слайдеры
		m3Sliders.forEach(id => {
			const slider = document.getElementById(`${id}-slider`);
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
		// Эскиз
		if (settings['draw_id'] != null) {
			selectedDrawId = `draw-0${settings['draw_id']}`;
		}
		renderDrawList();
		const d = drawsMap.find(x => x.id === selectedDrawId);
		if (d && drawPickerLabel) drawPickerLabel.textContent = d.label;
		updateEffectsList(selectedDrawId, settings['effect_id']);
		sendDraw(parseInt(selectedDrawId.replace('draw-', '')), settings);

	}).catch(error => {
		console.warn('Ошибка загрузки:', error.message);
		renderDrawList();
	}).finally(() => {
		if (loader) {
			loader.style.opacity = '0';
			loader.style.transition = 'opacity 0.3s ease';
			setTimeout(() => loader.style.display = 'none', 300);
		}
	});


	// =============================================================================
	// 2. БЛОК «СЛУШАТЕЛИ»
	// =============================================================================

	// Активная страница при старте
	document.querySelector('[data-page="settings"]').classList.add('page--active');

	// Навигация по табам
	navItems.forEach(btn => {
		btn.addEventListener('click', () => {
			const target = btn.dataset.tab;
			navItems.forEach(b => b.classList.remove('m3-nav-item--active'));
			btn.classList.add('m3-nav-item--active');
			pages.forEach(p => p.classList.remove('page--active'));
			document.querySelector(`[data-page="${target}"]`).classList.add('page--active');
		});
	});

	// Поля основных размеров
	[lengthInput, widthInput, stepInput].forEach(input => {
		if (!input) return;
		input.addEventListener('input', () => {
			input.value = input.value.replace(',', '.');
			if (isSaved) { isSaved = false; resetSaveBtn(); }
			validateDimensionsAndCheckButton();
		});
	});

	// Поля extra-dims через делегирование (создаются динамически)
	if (extraDimsContainer) {
		extraDimsContainer.addEventListener('input', (e) => {
			if (e.target.tagName.toLowerCase() === 'md-outlined-text-field') {
				e.target.value = e.target.value.replace(',', '.');
				if (isSaved) { isSaved = false; resetSaveBtn(); }
				validateDimensionsAndCheckButton();
			}
		});
	}

	// Слайдеры
	m3Sliders.forEach(id => {
		const slider = document.getElementById(`${id}-slider`);
		const display = document.getElementById(`${id}-value`);
		if (!slider || !display) return;
		slider.addEventListener('input', () => {
			display.textContent = `${slider.value}${getUnit(id)}`;
		});
		slider.addEventListener('change', () => {
			console.log(`${id}: ${slider.value}${getUnit(id)}`);
			// fetch(`/set?${id}=${slider.value}`);
		});
	});


	// ================================================================
	// 3. БЛОК «ФУНКЦИИ»
	// ================================================================

	// Управление питанием
	function updatePowerBtn() {
		if (!powerBtn || !mainContent) return;
		const isPowerOff = powerBtn.selected;
		if (isPowerOff) {
			mainContent.style.opacity      = '0.15';
			mainContent.style.pointerEvents = 'none';
			mainContent.style.userSelect    = 'none';
			console.log('[UI] -> Питание ВЫКЛ');
		} else {
			mainContent.style.opacity      = '1';
			mainContent.style.pointerEvents = 'auto';
			mainContent.style.userSelect    = 'auto';
			console.log('[UI] -> Питание ВКЛ');
		}
	}

	// Сброс кнопки "Сохранить" в исходное состояние
	function resetSaveBtn() {
		if (!saveDimensionsBtn) return;
		saveDimensionsBtn.disabled = false;
		saveDimensionsBtn.innerHTML = `<md-icon slot="icon">upload</md-icon>Сохранить`;
		saveDimensionsBtn.style.removeProperty('--md-filled-button-container-color');
		saveDimensionsBtn.style.removeProperty('--md-filled-button-label-text-color');
	}

	// Рендер дополнительных полей размеров из draws-map.json
	function renderExtraDims(draw, initialValues = {}) {
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
	}

	// Валидация размеров и управление кнопкой "Сохранить"
	function validateDimensionsAndCheckButton() {
		const length = parseFloat(lengthInput ? lengthInput.value : 0);
		const width  = parseFloat(widthInput  ? widthInput.value  : 0);
		const step   = parseFloat(stepInput   ? stepInput.value   : 0);
		let hasAnyError = false;

		// Проверяем шаг резки
		if (isNaN(step) || step <= 0) {
			if (stepInput) { stepInput.error = true; stepInput.errorText = "Ошибка"; }
			hasAnyError = true;
		} else {
			if (stepInput) { stepInput.error = false; stepInput.supportingText = " "; }
		}

		// Проверка одного поля на кратность шагу
		function checkField(inputElement, value) {
			if (!inputElement) return;
			if (!inputElement.value || isNaN(value)) {
				inputElement.error = false;
				inputElement.supportingText = " ";
				hasAnyError = true;
				return;
			}
			if (isNaN(step) || step <= 0) {
				inputElement.supportingText = " ";
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
				inputElement.errorText = "Не делится";
				hasAnyError = true;
				// Подсвечиваем шаг как причину ошибки
				if (stepInput) { stepInput.error = true; stepInput.errorText = "Проверь шаг"; }
			}
		}

		// Проверяем основные поля
		checkField(lengthInput, length);
		checkField(widthInput, width);

		// Проверяем extra-dims поля
		const currentDraw = drawsMap.find(d => d.id === selectedDrawId);
		if (currentDraw && currentDraw['extra-dims']) {
			currentDraw['extra-dims'].forEach(f => {
				const input = document.getElementById(`extra-dim-${f.id}`);
				if (input) checkField(input, parseFloat(input.value));
			});
		}

		// Управление кнопкой — не трогаем если уже в состоянии "Сохранено"
		if (saveDimensionsBtn && !isSaved) {
			saveDimensionsBtn.disabled = hasAnyError;
		}
	}

	// Видимость слайдеров в зависимости от эффекта
	function updateSliderVisibility(effectId) {
		const id           = parseInt(effectId);
		const showAnim     = id === 3 || id === 4 || id === 5 || id === 6;
		const showSoftstart = id === 2 || id === 3 || id === 4 || id === 5 || id === 6;
		const animSlider      = document.getElementById('animation-speed-slider');
		const softstartSlider = document.getElementById('softstart-speed-slider');
		const animContainer      = document.getElementById('anim-speed-container');
		const softstartContainer = document.getElementById('softstart-container');
		if (animSlider)      animSlider.disabled      = !showAnim;
		if (softstartSlider) softstartSlider.disabled = !showSoftstart;
		if (animContainer)      animContainer.style.opacity      = showAnim      ? '1' : '0.3';
		if (softstartContainer) softstartContainer.style.opacity = showSoftstart ? '1' : '0.3';
	}

	// Обновление списка эффектов при смене эскиза
	function updateEffectsList(drawValue, effectId = null) {
		if (!effectsMap[drawValue] || !effectSelector) return;
		const allowed = effectsMap[drawValue].effects;
		effectSelector.innerHTML = allowed.map(e => `
			<md-select-option value="${e.id}">
				<div slot="headline">${e.label}</div>
			</md-select-option>
		`).join('');

		const targetId = effectId ? `anim-0${effectId}` : null;
		const match = targetId && allowed.find(e => e.id === targetId);

		setTimeout(() => {
			effectSelector.value = match ? targetId : allowed[0].id;
			effectSelector.dispatchEvent(new Event('change'));
			const newId = parseInt(effectSelector.value.replace('anim-', ''));
			updateSliderVisibility(newId);
			sendEffect(newId);
		}, 150);
	}

	// Применение анимации к SVG предпросмотру
	function sendEffect(id) {
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

	// Смена SVG предпросмотра
	function updateSvgPreview(drawId) {
		const svgObject = document.querySelector('object[data*=".svg"]');
		if (!svgObject) return;
		svgObject.data = `./components/anim${drawId}/anim${drawId}.svg`;
		console.log(`SVG предпросмотр сменён на: anim${drawId}.svg`);
	}

	// Рендер списка эскизов в модалке
	function renderDrawList() {
		if (!drawList) return;
		drawList.innerHTML = drawsMap.map(d => `
			<md-list-item class="responsive-list-item">
				<details class="m3-draw-modal-custom-details" name="schemas">
					<summary class="m3-draw-modal-details-summary">
						<md-radio name="draw-pick" value="${d.id}"
							${selectedDrawId === d.id ? 'checked' : ''}
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

	// Выбор эскиза из модалки
	function pickDraw(id) {
		selectedDrawId = id;
		const d = drawsMap.find(x => x.id === id);
		if (d && drawPickerLabel) drawPickerLabel.textContent = d.label;
		renderDrawList();
		const numId = parseInt(id.replace('draw-', ''));
		sendDraw(numId);
	}
	window.pickDraw = pickDraw;


	// ================================================================
	// 4. БЛОК «ЭКСПОРТ» (Отправка данных на ESP32)
	// ================================================================

	// Кнопка питания
	if (powerBtn) {
		powerBtn.addEventListener('click', () => updatePowerBtn());
	}

	// Переключатель напряжения
	if (powerToggle && powerToggleText) {
		powerToggle.addEventListener('change', () => {
			powerToggleText.textContent = powerToggle.selected ? '12V' : '5V';
			console.log(`Напряжение: ${powerToggleText.textContent}`);
			// fetch(`/set?voltage=${powerToggle.selected ? 12 : 5}`);
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

			// Reboot ESP32 после сохранения
			console.log('Отправляем reboot на ESP32...');
			// fetch('/reboot');

			// Переводим кнопку в состояние "Сохранено"
			isSaved = true;
			saveDimensionsBtn.disabled = true;
			saveDimensionsBtn.innerHTML = `<md-icon slot="icon">check</md-icon>Сохранено`;
			saveDimensionsBtn.style.setProperty('--md-filled-button-container-color', '#e0e0e0');
			saveDimensionsBtn.style.setProperty('--md-filled-button-label-text-color', '#9e9e9e');
		});
	}

	// Слайдеры отправка при отпускании
	if (animSlider) {
		animSlider.addEventListener('change', () => {
			console.log(`Скорость анимации: ${animSlider.value} мс`);
			// fetch(`/set?animation-speed=${animSlider.value}`);
		});
	}
	if (softSlider) {
		softSlider.addEventListener('change', () => {
			console.log(`Скорость плавного включения: ${softSlider.value} мс`);
			// fetch(`/set?softstart-speed=${softSlider.value}`);
		});
	}
	if (brightSlider) {
		brightSlider.addEventListener('change', () => {
			console.log(`Максимальная яркость: ${brightSlider.value} %`);
			// fetch(`/set?max-brightness=${brightSlider.value}`);
		});
	}

	// Тип светодиодов
	if (rgbSelector) {
		rgbSelector.addEventListener('change', () => {
			const id = COLOR_TYPE_MAP.indexOf(rgbSelector.value);
			console.log(`Тип кластера: ${rgbSelector.value} (ID: ${id})`);
			// fetch(`/set?color_type_id=${id}`);
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

	// Смена эскиза — обновляем SVG, эффекты и extra-dims
	function sendDraw(id, initialValues = {}) {
		updateSvgPreview(id);
		updateEffectsList(`draw-0${id}`, initialValues['effect_id']);
		const draw = drawsMap.find(d => d.id === `draw-0${id}`);
		if (draw) renderExtraDims(draw, initialValues);
		const svgObject = document.querySelector('object[data*=".svg"]');
		if (svgObject) {
			svgObject.addEventListener('load', () => {
				const currentEffectId = parseInt(effectSelector.value.replace('anim-', ''));
				sendEffect(currentEffectId);
			}, { once: true });
		}
		console.log(`Эскиз отправлен на ESP32: ID=${id}`);
		// fetch(`/set?draw_id=${id}`);
	}


}); // Конец DOMContentLoaded
