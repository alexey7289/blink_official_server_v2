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
	const lengthInput = document.getElementById('length-field'); // Экспорт данных в index.html на id="length-field"
	const widthInput  = document.getElementById('width-field');  // Экспорт данных в index.html на id="width-field"
	const stepInput   = document.getElementById('step-field');   // Экспорт данных в index.html на id="step-field"
	const saveBtn = document.getElementById('save-dimensions-btn');


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

			if (lengthInput) lengthInput.value = settings['length'];
			if (widthInput)  widthInput.value  = settings['width'];
			if (stepInput)   stepInput.value   = settings['step'];

			console.log('Данные размеров успешно обновлены из JSON:', lengthInput.value, widthInput.value, stepInput.value);
			
			// Функция расчета кратности загружается после загрузки первоначальных данных
			if (typeof validateDimensionsAndCheckButton === 'function') {
				validateDimensionsAndCheckButton();
			}

		})
		.catch(error => {
			console.warn('[Считыватель] Файл не найден на ПК. Используем дефолты из HTML:', error.message);
		});







	// =============================================================================
	// 2. БЛОК «СЛУШАТЕЛИ» Слушаем страницу html и следим за новыми данными из нее
	// =============================================================================
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






	// ================================================================
	// 3. БЛОК «ФУНКЦИИ» (Математика)
	// ================================================================
	// Функция расчета коатности размеров шагу ленты
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
	// Отправка количества пикселей в ленте при сохранении по кнопке
	const saveDimensionsBtn = document.getElementById('save-dimensions-btn');
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












}); // Конец глобального обработчика DOMContentLoaded
