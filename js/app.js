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

	const versionSpan = document.getElementById('logo-version');
	const powerBtn = document.getElementById('power-btn');
	const mainContent = document.querySelector('main');
	// Навигация по табам
	const navItems = document.querySelectorAll('.m3-nav-item[data-tab]');
	const pages = document.querySelectorAll('[data-page]');
	// Поля выбора анимации и эскиза
	const effectSelector = document.getElementById('effect-selector');

	const animSpeedContainer = document.getElementById('anim-speed-container');
	const softstartContainer = document.getElementById('softstart-container');
	//
	const wifiBtn = document.getElementById('wifi-status');
	const powerToggle = document.getElementById('power-toggle');
	const powerToggleText = document.getElementById('power-toggle-text');
	const rgbSelector = document.getElementById('rgb-selector');
	const COLOR_TYPE_MAP = ['RGB', 'RBG', 'GRB', 'GBR', 'BRG', 'BGR'];
	const animSlider = document.getElementById('animation-speed-slider');
	const animValue  = document.getElementById('animation-speed-value');
	const softSlider = document.getElementById('softstart-speed-slider');
	const softValue  = document.getElementById('softstart-speed-value');
	const brightSlider = document.getElementById('max-brightness-slider');
	const brightValue  = document.getElementById('max-brightness-value');
	// Корни ID элементов (должны совпадать с именами ключей в settings.json)
	const m3Sliders = ['animation-speed', 'softstart-speed', 'max-brightness'];
	// Вспомогательная функция для корректного вывода единиц измерения (мс или %)
	const getUnit = (id) => id.includes('brightness') ? '%' : ' мс';

	const lengthInput = document.getElementById('length-field');
	const widthInput  = document.getElementById('width-field');
	const stepInput   = document.getElementById('step-field');
	const saveDimensionsBtn = document.getElementById('save-dimensions-btn');

	// Получаем настройки эффектов из файла анимаций
	let effectsMap = {};

	// Получаем настройки эскизов 
	const drawPickerBtn   = document.getElementById('draw-picker-btn');
	const drawPickerLabel = document.getElementById('draw-picker-label');
	const drawList        = document.getElementById('draw-list');
	let drawsMap = [];
	window.drawsMap = drawsMap;
	let selectedDrawId = 'draw-01';

	// ================================================================
	// 1. БЛОК «СЧИТЫВАТЕЛЬ» (Загрузка настроек с ESP32 при старте)
	// ================================================================

	// Показываем лоадер
	const loader = document.getElementById('app-loader');

	// Загружаем все три файла одновременно
	Promise.all([
		fetch('./config/settings.json').then(r => { if (!r.ok) throw new Error('settings.json не найден'); return r.json(); }),
		fetch('./config/draws-map.json').then(r => r.json()),
		fetch('./config/effect-map.json').then(r => r.json()),
	]).then(([settings, drawsData, effectsData]) => {
		console.log('Все файлы загружены.');

		// Заполняем данные
		drawsMap   = drawsData.draws;
		effectsMap = effectsData;

		// --- settings.json ---
		if (powerBtn && settings['power'] !== undefined) {
			powerBtn.selected = !settings['power'];
			updatePowerBtn();
		}
		if (versionSpan && settings.version) {
			const v = settings.version.startsWith('v') ? settings.version : `v${settings.version}`;
			versionSpan.textContent = v;
		}
		if (wifiBtn && settings['is_online'] !== undefined) {
			if (settings['is_online']) {
				wifiBtn.innerHTML = '<md-icon slot="icon">android_wifi_3_bar</md-icon>Подключено';
				wifiBtn.classList.remove('m3-wifi-status--disconnected');
			} else {
				wifiBtn.innerHTML = '<md-icon slot="icon">android_wifi_3_bar_off</md-icon>Отключено';
				wifiBtn.classList.add('m3-wifi-status--disconnected');
			}
		}
		if (lengthInput) lengthInput.value = settings['length'];
		if (widthInput)  widthInput.value  = settings['width'];
		if (stepInput)   stepInput.value   = settings['step'];
		if (typeof validateDimensionsAndCheckButton === 'function') {
			validateDimensionsAndCheckButton();
		}
		m3Sliders.forEach(id => {
			const slider = document.getElementById(`${id}-slider`);
			const valueDisplay = document.getElementById(`${id}-value`);
			if (slider && valueDisplay && settings[id] !== undefined) {
				slider.value = settings[id];
				valueDisplay.textContent = `${slider.value}${getUnit(id)}`;
			}
		});
		if (powerToggle && powerToggleText && settings['voltage'] !== undefined) {
			const is12V = settings['voltage'] === 12;
			powerToggle.selected = is12V;
			powerToggleText.textContent = is12V ? '12V' : '5V';
		}
		if (rgbSelector && settings['color_type'] !== undefined) {
			rgbSelector.value = settings['color_type'];
		}

		// --- draws-map + settings ---
		if (settings['draw_id'] !== undefined) {
			selectedDrawId = `draw-0${settings['draw_id']}`;
		}
		renderDrawList(); // теперь drawsMap и selectedDrawId оба готовы

		const d = drawsMap.find(x => x.id === selectedDrawId);
		if (d && drawPickerLabel) drawPickerLabel.textContent = d.label;

		updateEffectsList(selectedDrawId);
		sendDraw(parseInt(selectedDrawId.replace('draw-', '')));

	}).catch(error => {
		console.warn('Ошибка загрузки:', error.message);
		renderDrawList(); // рендерим с дефолтами
	}).finally(() => {
		// Скрываем лоадер в любом случае
		if (loader) {
			loader.style.opacity = '0';
			loader.style.transition = 'opacity 0.3s ease';
			setTimeout(() => loader.style.display = 'none', 300);
		}
	});







	// =============================================================================
	// 2. БЛОК «СЛУШАТЕЛИ» Слушаем страницу html и следим за новыми данными из нее
	// =============================================================================
	// Показываем первую страницу при старте
	document.querySelector('[data-page="home"]').classList.add('page--active');
	// Навигация по tab
	navItems.forEach(btn => {
		btn.addEventListener('click', () => {
			const target = btn.dataset.tab;

			// Переключаем активную кнопку
			navItems.forEach(b => b.classList.remove('m3-nav-item--active'));
			btn.classList.add('m3-nav-item--active');

			// Переключаем страницу
			pages.forEach(p => p.classList.remove('page--active'));
			document.querySelector(`[data-page="${target}"]`).classList.add('page--active');
		});
	});
	// Слушаем поле ввода длины, ширины и шага
	[lengthInput, widthInput, stepInput].forEach(input => {
		if (!input) return;
		input.addEventListener('input', () => {
			input.value = input.value.replace(',', '.');
			validateDimensionsAndCheckButton();
		});
	});
	// Слушаем слайдер скорости анимации, слайдер скорости плавного включения, слайдер максимальной яркости
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
	// 3. БЛОК «ФУНКЦИИ» (Математика)
	// ================================================================
	// Функция управления питанием
	function updatePowerBtn() {
		if (!powerBtn || !mainContent) return;
		// Проверяем состояние кнопки: если selected === true, значит лампочка перечеркнута (Питание ВЫКЛ)
		const isPowerOff = powerBtn.selected;

		if (isPowerOff) {
			// Наш фирменный трюк: делаем весь main полупрозрачным и запрещаем любые клики мышью
			mainContent.style.opacity = '0.15';
			mainContent.style.pointerEvents = 'none';
			mainContent.style.userSelect = 'none';
			console.log('[UI] -> Интерфейс управления ПОЛНОСТЬЮ ПОГАШЕН (Питание ВЫКЛ)');
		} else {
			// Возвращаем интерфейс в яркое и рабочее состояние
			mainContent.style.opacity = '1';
			mainContent.style.pointerEvents = 'auto';
			mainContent.style.userSelect = 'auto';
			console.log('[UI] -> Интерфейс управления АКТИВИРОВАН (Питание ВКЛ)');
		}
	}
	// Функция расчета кратности размеров шагу ленты
	function validateDimensionsAndCheckButton() {
		// Считываем числа из полей
		const length = parseFloat(lengthInput ? lengthInput.value : 0);
		const width  = parseFloat(widthInput ? widthInput.value : 0);
		const step   = parseFloat(stepInput ? stepInput.value : 0);

		// Флаг, который будет следить, есть ли ошибка хотя бы в одном поле
		let hasAnyError = false;

		// 1. Проверяем сам Шаг резки ленты
		if (isNaN(step) || step <= 0) {
			if (stepInput) {
				stepInput.error = true;
				stepInput.errorText = "Ошибка";
			}
			hasAnyError = true; // Шаг неверный — это ошибка
		} else {
			if (stepInput) {
				stepInput.error = false;
				stepInput.supportingText = " ";
			}
		}

		// Внутренняя мини-функция для индивидуального расчета Длины и Ширины
		function checkField(inputElement, value) {
			if (!inputElement) return;

			// Если поле еще пустое — ошибку не вешаем, но и сохранять пока не разрешаем
			if (!inputElement.value || isNaN(value)) {
				inputElement.error = false;
				inputElement.supportingText = " ";
				hasAnyError = true; 
				return;
			}

			// Если шаг равен нулю, считать деление нельзя
			if (isNaN(step) || step <= 0) {
				inputElement.supportingText = " ";
				return;
			}

			const remainder = value % step;
			// Защита от микро-ошибок округления Float в JavaScript (например, 0.0000001)
			const isValid = Math.abs(remainder) < 0.01 || Math.abs(remainder - step) < 0.01;

			if (isValid) {
				const pixelsCount = Math.round(value / step);
				inputElement.error = false;
				inputElement.supportingText = `ОК. ${pixelsCount} пикселей`;
			} else {
				inputElement.error = true;
				inputElement.errorText = "Не кратно шагу резки";
				hasAnyError = true; // Найдена ошибка кратности!
			}
		}

		// Проверяем оба поля индивидуально
		checkField(lengthInput, length);
		checkField(widthInput, width);

		// УПРАВЛЕНИЕ КНОПКОЙ: если есть хоть одна ошибка, вешаем disabled, иначе — снимаем
		if (saveDimensionsBtn) {
			saveDimensionsBtn.disabled = hasAnyError;
		}
	}
	// Функция наложения полупрозрачности на слайдеры
	function updateSliderVisibility(effectId) {
		const id = parseInt(effectId);

		const showAnim       = id === 3 || id === 4;
		const showSoftstart  = id === 2 || id === 3 || id === 4;

		const animSlider      = document.getElementById('animation-speed-slider');
		const softstartSlider = document.getElementById('softstart-speed-slider');
		const animContainer      = document.getElementById('anim-speed-container');
		const softstartContainer = document.getElementById('softstart-container');

		if (animSlider) animSlider.disabled = !showAnim;
		if (softstartSlider) softstartSlider.disabled = !showSoftstart;

		if (animContainer) animContainer.style.opacity = showAnim ? '1' : '0.3';
		if (softstartContainer) softstartContainer.style.opacity = showSoftstart ? '1' : '0.3';
	}
	// Функция обновления списка эффектов по выбранному эскизу
	function updateEffectsList(drawValue) {
		if (!effectsMap[drawValue] || !effectSelector) return;

		const allowed = effectsMap[drawValue].effects;

		// Перестраиваем список опций из JSON
		effectSelector.innerHTML = allowed.map(e => `
			<md-select-option value="${e.id}">
				<div slot="headline">${e.label}</div>
			</md-select-option>
		`).join('');

		// Восстанавливаем текущий эффект если он есть в списке
		const currentId = effectSelector.value;
		const match = allowed.find(e => e.id === currentId);
		effectSelector.value = match ? currentId : allowed[0].id;

		const newId = parseInt(effectSelector.value.replace('anim-', ''));
		updateSliderVisibility(newId);
		sendEffect(newId);
	}
	// Функция применения анимации к SVG-предпросмотру
	function sendEffect(id) {
		const svgObject = document.querySelector('object[data*="anim1.svg"]');
		if (!svgObject) return;

		function applyClass() {
			const svg = svgObject.contentDocument && svgObject.contentDocument.querySelector('svg');
			if (svg) {
				svg.className.baseVal = `anim-0${id}`;
				console.log(`Эффект применён к SVG: anim-0${id}`);
			}
		}

		// Если object уже загружен — применяем сразу, иначе ждём load
		if (svgObject.contentDocument && svgObject.contentDocument.querySelector('svg')) {
			applyClass();
		} else {
			svgObject.addEventListener('load', applyClass, { once: true });
		}

		// fetch(`/set?effect_id=${id}`);
		console.log(`Эффект отправлен на ESP32: ID=${id}`);
	}
	// Функция обновления SVG preview
	function updateSvgPreview(drawId) {
		const svgObject = document.querySelector('object[data*=".svg"]');
		if (!svgObject) return;
		svgObject.data = `./components/anim${drawId}/anim${drawId}.svg`;
		console.log(`SVG предпросмотр сменён на: anim${drawId}.svg`);
	}
	// Функция рендера списка контуров в модалке
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
	// Функция выбора контура
	function pickDraw(id) {
		selectedDrawId = id;
		const d = drawsMap.find(x => x.id === id);
		if (d && drawPickerLabel) drawPickerLabel.textContent = d.label;
		renderDrawList();
		const numId = parseInt(id.replace('draw-', ''));
		sendDraw(numId);
		// диалог не закрываем — пользователь закрывает сам кнопкой "Закрыть"
	}
	window.pickDraw = pickDraw;



	// ================================================================
	// 4. БЛОК «ЭКСПОРТ» (Отправка всех размеров на ESP32 по кнопке)
	// ================================================================
	// По клику на кнопке "Питание" вызываем функция гашения/отображение интерфейса
	if (powerBtn) {
		powerBtn.addEventListener('click', () => {
			updatePowerBtn();
		})
	}
	// Смена напряжения питания с 5V на 12V
	if (powerToggle && powerToggleText) {
		powerToggle.addEventListener('change', () => {
			powerToggleText.textContent = powerToggle.selected ? '12V' : '5V';
			console.log(`Напряжение изменено на: ${powerToggleText.textContent}`);
		});
	}	
	// Отправка количества пикселей в ленте при сохранении по кнопке
	if (saveDimensionsBtn) {
		saveDimensionsBtn.addEventListener('click', () => {
			
			// 1. Считываем миллиметры из полей в момент клика
			const lenMm = parseFloat(lengthInput ? lengthInput.value : 0);
			const widMm = parseFloat(widthInput ? widthInput.value : 0);
			const stepMm = parseFloat(stepInput ? stepInput.value : 0);

			// 2. Вычисляем точное количество пикселей специально для вывода в лог
			const lengthPixels = Math.round(lenMm / stepMm);
			const widthPixels  = Math.round(widMm / stepMm);

			// 3. ВАШ ЛОГ: Теперь он сработает строго при клике и выведет правильные цифры
			console.log(`Данные пикселей в длине: ${lengthPixels} и пикселей в ширине: ${widthPixels} улетели на ESP`);
		});
	}
	// Отправка скорости анимации
	if (animSlider) {
		animSlider.addEventListener('change', () => {
			console.log(`Слайдер анимации отпущен. Значение: ${animSlider.value} мс`);
		})
	}
	// Отправка скорости плавного включения
	if (softSlider) {
		softSlider.addEventListener('change', () => {
			console.log(`Слайдер плавного включения отпущен. Значение: ${softSlider.value} мс`);
		})
	}
	// Отправка максимальной яркости
	if (brightSlider) {
		brightSlider.addEventListener('change', () => {
			console.log(`Слайдер максимальной яркости отпущен. Значение: ${brightSlider.value} %`);
		})
	}
	// Отправка типа светодиодов на ESP32
	if (rgbSelector) {
		rgbSelector.addEventListener('change', () => {
			const id = COLOR_TYPE_MAP.indexOf(rgbSelector.value);
			console.log(`Тип светодиодов изменён: ${rgbSelector.value} (ID: ${id})`);
			// fetch(`/set?color_type_id=${id}`); // раскомментируй когда будешь слать на ESP32
		});
	}
	// Слушатель изменения поля эффектов и отправка его id на ESP32
	[
		{ el: effectSelector, prefix: 'anim-', label: 'Эффект', onChange: (id) => { updateSliderVisibility(id); sendEffect(id); } },
	].forEach(({ el, prefix, label, onChange }) => {
		if (!el) return;
		el.addEventListener('change', () => {
			const id = parseInt(el.value.replace(prefix, ''));
			console.log(`${label} изменён: ${el.value} (ID: ${id})`);
			onChange(id);
		});
	});
	// Отправка новой картинки превью
	function sendDraw(id) {
		updateSvgPreview(id);
		updateEffectsList(`draw-0${id}`);

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


}); // Конец глобального обработчика DOMContentLoaded
