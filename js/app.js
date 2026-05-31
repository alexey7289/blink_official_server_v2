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
	const saveBtn = document.getElementById('save-dimensions-btn');
	const saveDimensionsBtn = document.getElementById('save-dimensions-btn');



	// ================================================================
	// 1. БЛОК «СЧИТЫВАТЕЛЬ» (Загрузка настроек с ESP32 при старте)
	// ================================================================

	// Делаем ОДИН общий запрос к файлу конфигурации
	fetch('/config/settings.json')
		.then(response => {
			if (!response.ok) {
				throw new Error('ESP32 вернул ошибку или файл предустановок не найден');
			}
			return response.json();
		})
		.then(settings => {
			console.log('Файл settings.json успешно загружен. Все найденные данные:', settings);

			// Кнопка питания и ее состояние
			if (powerBtn && settings['power'] !== undefined) {
				powerBtn.selected = !settings['power'];
				console.log(`Кнопка питания инициализирована. Состояние: ${settings['power'] ? 'ВКЛ' : 'ВЫКЛ'}`);
				if (typeof updatePowerBtn === 'function') {
					updatePowerBtn();
				}
			}

			// Обновление текстовой версии в логотипе
			if (versionSpan) {
				const formattedVersion = settings.version.startsWith('v') ? settings.version : `v${settings.version}`;
				versionSpan.textContent = formattedVersion;
				console.log(`Версия сайта в логотипе обновлена на: ${formattedVersion}`);
			}

			// Обновление индикатора Wi-fi из JSON
			if (wifiBtn && settings['is_online'] !== undefined) {
				if (settings['is_online'] === true) {
					// Если ESP32 в сети — ставим иконку сигнала и текст "Подключено"
					wifiBtn.innerHTML = '<md-icon slot="icon">android_wifi_3_bar</md-icon>Подключено';
					wifiBtn.classList.remove('m3-wifi-status--disconnected');
					console.log("[UI] -> Индикатор Wi-Fi: ПОДКЛЮЧЕНО (иконка: android_wifi_3_bar)");
				} else {
					// Если ESP32 не в сети — ставим перечеркнутую иконку и текст "Отключено"
					wifiBtn.innerHTML = '<md-icon slot="icon">android_wifi_3_bar_off</md-icon>Отключено';
					wifiBtn.classList.add('m3-wifi-status--disconnected');
					console.log("[UI] -> Индикатор Wi-Fi: ОТКЛЮЧЕНО (иконка: android_wifi_3_bar_off)");
				}
			}

			// Данные о размерах из settings.json файла
			if (lengthInput) lengthInput.value = settings['length'];
			if (widthInput)  widthInput.value  = settings['width'];
			if (stepInput)   stepInput.value   = settings['step'];

			// Функция расчета кратности
			if (typeof validateDimensionsAndCheckButton === 'function') {
				validateDimensionsAndCheckButton();
			}

			// Данные из сладеров
			m3Sliders.forEach(id => {
					const slider = document.getElementById(`${id}-slider`);
					const valueDisplay = document.getElementById(`${id}-value`);

					// Если слайдер есть на странице и этот ключ есть в JSON от ESP32
					if (slider && valueDisplay && settings[id] !== undefined) {
							slider.value = settings[id]; // Двигаем ползунок на нужную позицию
							valueDisplay.textContent = `${slider.value}${getUnit(id)}`; // Обновляем текст
					}
			});

			// Данные о напряжении питания
			if (powerToggle && powerToggleText && settings['voltage'] !== undefined) {
				const is12V = settings['voltage'] === 12;
				powerToggle.selected = is12V;
				powerToggleText.textContent = is12V ? '12В' : '5В';
				console.log(`Напряжение инициализировано: ${powerToggleText.textContent}`);
			}

			// Инициализация типа светодиодов из settings.json
			if (rgbSelector && settings['color_type'] !== undefined) {
				rgbSelector.value = settings['color_type'];
				console.log(`Тип светодиодов инициализирован: ${settings['color_type']}`);
			}
		})
		.catch(error => {
			console.warn('Файл не найден на ПК. Используем дефолты из HTML:', error.message);
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
	// Слушаем поле ввода длины
	if (lengthInput) {
		lengthInput.addEventListener('input', () => {
			lengthInput.value = lengthInput.value.replace(',', '.');
			console.log('User изменил длину:', lengthInput.value);
			validateDimensionsAndCheckButton(); // Вызов математики для пересчета
		});
	}
	// Слушаем поле вода ширины
	if (widthInput) {
		widthInput.addEventListener('input', () => {
			widthInput.value = widthInput.value.replace(',', '.');
			console.log('User изменил ширину:', widthInput.value);
			validateDimensionsAndCheckButton();
		});
	}
	// Слушаем поле ввода шага
	if (stepInput) {
		stepInput.addEventListener('input', () => {
			stepInput.value = stepInput.value.replace(',', '.');
			console.log('User изменил шаг:', stepInput.value);
			validateDimensionsAndCheckButton();
		});
	}
	// Слушаем слайдер скорости анимации
	if (animSlider && animValue) {
		animSlider.addEventListener('input', () => {
			animValue.textContent = `${animSlider.value} мс`;
		});
	}
	// Слушаем слайдер скорости плавного включения
	if (softSlider && softValue) {
		softSlider.addEventListener('input', () => {
			softValue.textContent = `${softSlider.value} мс`;
		});
	}
	// Слушаем слайдер максимальной яркости
	if (brightSlider && brightValue) {
		brightSlider.addEventListener('input', () => {
			brightValue.textContent = `${brightSlider.value} %`;
		});
	}






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
		if (saveBtn) {
			saveBtn.disabled = hasAnyError;
		}
	}





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



}); // Конец глобального обработчика DOMContentLoaded
