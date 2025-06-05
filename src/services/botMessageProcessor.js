/**
 * Логика обработки сообщений и создания уведомлений
 */
const { v4: uuidv4 } = require("uuid");
const { processGigaChatRequest } = require("./gigaChatService");
const { addNotification } = require("../db");
const { parseMessage } = require("../utils");
const getGigaChatPrompt = require("../prompts/gigaChatPrompt");
const {
  isRecurringNotification,
  isOneTimeWeekdayNotification,
  calculateRelativeTime,
  calculateTargetDate,
  dayCodeToNumber,
  formatDateForDisplay,
  dayNumberToName,
  findTimeInText,
} = require("../utils/dateTime");
const {
  formatPeriodMessage,
  formatPeriodMessageForWeekdays,
  formatOneTimeMessage,
  formatConfirmationMessage,
} = require("../utils/messageFormatters");
const {
  extractDaysOfWeek,
  convertDayMatchesToNumbers,
  extractEventName,
  extractDayCodes,
} = require("../utils/notificationParser");

/**
 * Попытка исправить формат ответа нейросети
 * @param {string} aiResponse - Ответ нейросети
 * @param {string} originalText - Оригинальный текст пользователя
 * @returns {Object|null} Исправленный результат или null
 */
const tryFixAIResponse = (aiResponse, originalText) => {
  console.log(
    "Не удалось распарсить ответ нейросети, пробуем исправить формат"
  );

  // Проверка на ответ только с текстом сообщения (без времени и дней)
  if (
    aiResponse &&
    aiResponse.trim() &&
    !aiResponse.includes('"') &&
    !aiResponse.includes(":")
  ) {
    // Ищем время в оригинальном запросе
    const timeMatch = findTimeInText(originalText);

    // Проверяем, есть ли в запросе указание на ежедневное повторение
    const isDaily =
      originalText.toLowerCase().includes("каждый день") ||
      originalText.toLowerCase().includes("ежедневно");

    if (timeMatch) {
      let extractedTime = timeMatch[0];
      // Если время указано без минут (например, "в 13"), добавляем ":00"
      if (!extractedTime.includes(":")) {
        extractedTime = `${extractedTime}:00`;
      }

      // Формируем ответ с учетом ежедневного повторения
      const repetition = isDaily ? "infinity" : "1";
      const formattedResponse = `"${aiResponse.trim()}" "${extractedTime}" ${repetition}`;
      console.log("Исправленный формат (простой текст):", formattedResponse);
      return parseMessage(formattedResponse);
    }
  }

  // Сначала попытаемся извлечь важный глагол действия из оригинального текста
  const actionVerbs = [
    "посещать",
    "выпить",
    "попей",
    "попить",
    "принять",
    "сделать",
    "позвонить",
    "проверить",
    "помыть",
  ];
  let extractedAction = "";

  for (const verb of actionVerbs) {
    if (originalText.toLowerCase().includes(verb)) {
      const verbIndex = originalText.toLowerCase().indexOf(verb);
      const restOfText = originalText.substring(verbIndex);
      // Ограничиваем до 3-х слов или до первого предлога/союза
      const words = restOfText.split(/\s+/).slice(0, 5);
      extractedAction = words.join(" ");

      // Прерываем поиск после нахождения первого глагола
      break;
    }
  }

  // Сначала попробуем простой шаблон для извлечения сообщения, времени и дней недели
  const simplePattern =
    /([^"»\[\]]+)\s+"?([0-9]{1,2}:[0-9]{2})(?:,[0-9]{1,2}:[0-9]{2})*"?\s+((?:\d+|infinity|пн|вт|ср|чт|пт|сб|вс)(?:,(?:пн|вт|ср|чт|пт|сб|вс))*)/i;
  const simpleMatch = aiResponse.match(simplePattern);

  if (simpleMatch) {
    const [, message, time, days] = simpleMatch;
    // Если есть извлеченное действие, используем его вместо сообщения из нейросети
    const finalMessage = extractedAction || message.trim();
    // Форматируем ответ правильно
    const formattedResponse = `"${finalMessage}" "${time.trim()}" ${days.trim()}`;
    console.log("Исправленный формат (простой шаблон):", formattedResponse);
    return parseMessage(formattedResponse);
  }

  // Если простой шаблон не сработал, используем более сложный
  // Улучшенное регулярное выражение для более гибкого распознавания
  const extractPattern =
    /["«]?([^"»\[\]]+)["»]?\s+["«]?([0-9]{1,2}:[0-9]{2}(?:,[0-9]{1,2}:[0-9]{2})*)["»]?\s+((?:\d+|infinity|пн|вт|ср|чт|пт|сб|вс)(?:,(?:пн|вт|ср|чт|пт|сб|вс))*)|[\[\(]([^\]\)]+)[\]\)]\s+[\[\(]([0-9]{1,2}:[0-9]{2}(?:,[0-9]{1,2}:[0-9]{2})*)[\]\)]\s+((?:\d+|infinity|пн|вт|ср|чт|пт|сб|вс)(?:,(?:пн|вт|ср|чт|пт|сб|вс))*)/i;
  const extractMatch = aiResponse.match(extractPattern);

  if (extractMatch) {
    // Определяем, какая группа сработала (с кавычками или со скобками)
    const [
      ,
      msgQuotes,
      timeQuotes,
      daysQuotes,
      msgBrackets,
      timeBrackets,
      daysBrackets,
    ] = extractMatch;

    const extractedMessage = msgQuotes || msgBrackets;
    const extractedTime = timeQuotes || timeBrackets;
    const extractedDays = daysQuotes || daysBrackets;

    // Если есть извлеченное действие, используем его вместо сообщения из нейросети
    const finalMessage = extractedAction || extractedMessage;

    // Форматируем ответ правильно
    const formattedResponse = `"${finalMessage}" "${extractedTime}" ${extractedDays}`;
    console.log("Исправленный формат (сложный шаблон):", formattedResponse);

    // Пробуем снова распарсить
    return parseMessage(formattedResponse);
  }

  // Дополнительная попытка - ищем просто текст, время и дни недели
  const fallbackPattern =
    /([^\d:]+)\s+([0-9]{1,2}:[0-9]{2})\s+((?:пн|вт|ср|чт|пт|сб|вс)(?:,(?:пн|вт|ср|чт|пт|сб|вс))*)/i;
  const fallbackMatch = aiResponse.match(fallbackPattern);

  if (fallbackMatch) {
    const [, message, time, days] = fallbackMatch;
    // Если есть извлеченное действие, используем его вместо сообщения из нейросети
    const finalMessage = extractedAction || message.trim();
    const formattedResponse = `"${finalMessage}" "${time.trim()}" ${days.trim()}`;
    console.log("Исправленный формат (запасной шаблон):", formattedResponse);
    return parseMessage(formattedResponse);
  }

  // Если все шаблоны не сработали, но у нас есть действие и время в ответе нейросети
  const timeMatch = aiResponse.match(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/);
  const daysMatch = aiResponse.match(
    /(пн|вт|ср|чт|пт|сб|вс)(?:[,\s]+(?:и\s+)?(пн|вт|ср|чт|пт|сб|вс))*/
  );

  if (extractedAction && timeMatch && daysMatch) {
    const formattedResponse = `"${extractedAction}" "${timeMatch[0]}" ${daysMatch[0]}`;
    console.log(
      "Исправленный формат (экстремальный случай):",
      formattedResponse
    );
    return parseMessage(formattedResponse);
  }

  // Крайний случай: извлекаем информацию напрямую из оригинального запроса
  if (extractedAction) {
    const timeMatchOriginal = findTimeInText(originalText);

    if (timeMatchOriginal) {
      // Проверяем, есть ли в запросе указание на ежедневное повторение
      const isDaily =
        originalText.toLowerCase().includes("каждый день") ||
        originalText.toLowerCase().includes("ежедневно");

      let extractedTime = timeMatchOriginal[0];
      // Если время указано без минут (например, "в 13"), добавляем ":00"
      if (!extractedTime.includes(":")) {
        extractedTime = `${extractedTime}:00`;
      }

      // Формируем ответ с учетом ежедневного повторения или дней недели
      const dayMatchesOriginal = extractDaysOfWeek(originalText);

      let repetition = "1"; // По умолчанию однократное

      if (isDaily) {
        repetition = "infinity";
      } else if (
        dayMatchesOriginal.length > 0 &&
        isRecurringNotification(originalText)
      ) {
        repetition = extractDayCodes(dayMatchesOriginal);
      }

      const formattedResponse = `"${extractedAction}" "${extractedTime}" ${repetition}`;
      console.log(
        "Исправленный формат (на основе оригинального запроса):",
        formattedResponse
      );
      return parseMessage(formattedResponse);
    }
  }

  return null;
};

/**
 * Создает однократное уведомление на конкретный день недели
 * @param {Object} result - Результат парсинга сообщения
 * @param {string} text - Оригинальный текст сообщения пользователя
 * @param {Array} dayMatches - Найденные в сообщении дни недели
 * @returns {Object} Данные для создания уведомления
 */
const processOneTimeWeekdayNotification = (result, text, dayMatches) => {
  const { id, message, times } = result.data;

  // Получаем текущую дату
  const now = new Date();

  // Преобразуем сокращения дней недели в числа
  const dayMap = {
    пн: 1,
    вт: 2,
    ср: 3,
    чт: 4,
    пт: 5,
    сб: 6,
    вс: 0,
  };

  // Берем первый указанный день недели
  const targetDayOfWeek = dayMap[dayMatches[0].code];

  // Вычисляем целевую дату
  const { targetDate, daysToAdd } = calculateTargetDate(
    now,
    targetDayOfWeek,
    times[0]
  );

  console.log(
    `Создаем уведомление на дату: ${targetDate}, день недели: ${dayMatches[0].name}, дней до события: ${daysToAdd}`
  );

  return {
    id,
    message,
    times,
    days: 1,
    days_of_week: [],
    targetDate,
  };
};

/**
 * Создает повторяющееся уведомление для указанных дней недели
 * @param {Object} result - Результат парсинга сообщения
 * @param {Array} dayMatches - Найденные в сообщении дни недели
 * @returns {Object} Данные для создания уведомления
 */
const processRecurringWeekdayNotification = (result, dayMatches) => {
  const { id, message, times, days } = result.data;

  // Преобразуем дни недели в числовые коды
  const days_of_week = convertDayMatchesToNumbers(dayMatches);

  return {
    id,
    message,
    times,
    days,
    days_of_week,
    targetDate: null,
  };
};

/**
 * Обрабатывает текст напрямую, без использования нейросети
 * @param {string} text - Текст сообщения пользователя
 * @returns {Object|null} Результат обработки или null
 */
const processTextDirectly = (text) => {
  // Ищем время в тексте
  const timeMatch = findTimeInText(text);

  // Если не нашли время, не можем продолжить
  if (!timeMatch) {
    return null;
  }

  // Извлекаем время
  const extractedTime = timeMatch[0];

  // Извлекаем имя события
  const eventName = extractEventName(text);

  // Проверяем на ежедневное повторение
  const isDaily =
    text.toLowerCase().includes("каждый день") ||
    text.toLowerCase().includes("ежедневно");

  // Ищем дни недели в тексте
  const dayMatches = extractDaysOfWeek(text);

  // Если нашли дни недели
  if (dayMatches.length > 0) {
    // Определяем, повторяющееся событие или нет
    const isRecurring = isRecurringNotification(text);
    let formattedResponse;

    if (isRecurring) {
      // Если это повторяющееся событие, используем дни недели
      const extractedDays = extractDayCodes(dayMatches);
      formattedResponse = `"${eventName}" "${extractedTime}" ${extractedDays}`;
    } else {
      // Если однократное событие, используем 1 день
      formattedResponse = `"${eventName}" "${extractedTime}" 1`;
    }

    console.log("Прямой разбор запроса (с днями недели):", formattedResponse);
    return parseMessage(formattedResponse);
  }
  // Если это ежедневное повторение
  else if (isDaily) {
    // Для ежедневных событий используем infinity
    const formattedResponse = `"${eventName}" "${extractedTime}" infinity`;
    console.log("Прямой разбор запроса (ежедневное):", formattedResponse);
    return parseMessage(formattedResponse);
  }
  // Если просто указано время без деталей периодичности
  else if (extractedTime) {
    // По умолчанию одноразовое событие
    const formattedResponse = `"${eventName}" "${extractedTime}" 1`;
    console.log(
      "Прямой разбор запроса (время без периодичности):",
      formattedResponse
    );
    return parseMessage(formattedResponse);
  }

  return null;
};

/**
 * Форматирует сообщение о периодичности для однократного уведомления с конкретной датой
 * @param {string} targetDate - Целевая дата
 * @param {Array} dayMatches - Найденные дни недели
 * @returns {string} Отформатированное сообщение
 */
const formatOneTimeNotificationMessage = (targetDate, dayMatches = null) => {
  // Получаем день недели для целевой даты
  const dateObj = new Date(targetDate);
  const dayOfWeek = dateObj.getDay();

  // Название дня недели
  const dayName =
    dayMatches && dayMatches.length > 0
      ? dayMatches[0].name
      : dayNumberToName(dayOfWeek, true);

  // Форматируем дату для отображения
  const formattedDate = formatDateForDisplay(dateObj);

  return formatOneTimeMessage(dayName, formattedDate);
};

/**
 * Обрабатывает сообщение пользователя и создает уведомление
 * @param {string} text - Текст сообщения пользователя
 * @param {number} chatId - ID чата пользователя
 * @returns {Promise<Object>} Результат обработки
 */
const processUserMessage = async (text, chatId) => {
  try {
    // Получение текущего времени
    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, "0");
    const currentMinutes = now.getMinutes().toString().padStart(2, "0");
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    // Формируем промпт для нейросети
    const prompt = getGigaChatPrompt(currentTimeStr, calculateRelativeTime);

    // Получаем ответ от нейросети
    const aiResponse = await processGigaChatRequest(prompt, text);
    console.log("Ответ нейросети:", aiResponse);

    // Обрабатываем ответ от нейросети
    let result = parseMessage(aiResponse);

    // Если не удалось распарсить ответ нейросети, пробуем исправить формат
    if (!result.success) {
      // Сначала пробуем исправить формат
      result = tryFixAIResponse(aiResponse, text);

      // Если все равно не удалось распарсить
      if (!result || !result.success) {
        // Ждем 1 секунду и пробуем запросить у нейросети еще раз
        console.log(
          "Первая попытка неудачна, ждем 1 секунду и повторяем запрос..."
        );

        // Функция задержки
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        await delay(1000);

        // Делаем повторный запрос к нейросети с более четким указанием формата
        const enhancedPrompt =
          prompt +
          '\n\nВНИМАНИЕ: ВАЖНО строго соблюдать формат ответа: "[Название события]" "[Время]" [Дни]. Не забудь указать все три части!';
        const secondAiResponse = await processGigaChatRequest(
          enhancedPrompt,
          text
        );
        console.log("Повторный ответ нейросети:", secondAiResponse);

        // Пробуем распарсить повторный ответ
        const secondResult = parseMessage(secondAiResponse);

        if (secondResult.success) {
          result = secondResult;
        } else {
          // Если повторный ответ нейросети тоже нужно исправить
          const fixedSecondResult = tryFixAIResponse(secondAiResponse, text);

          if (fixedSecondResult && fixedSecondResult.success) {
            result = fixedSecondResult;
          } else {
            // Если и повторный запрос не помог, пробуем прямой анализ текста
            result = processTextDirectly(text);

            // Если все попытки не удались, возвращаем ошибку
            if (!result || !result.success) {
              return {
                success: false,
                error:
                  '❌ Не удалось обработать ваш запрос. Пожалуйста, используйте формат: "Текст сообщения" "ЧЧ:ММ" КОЛ-ВО_ДНЕЙ или укажите дни недели: пн, вт, ср, чт, пт, сб, вс',
              };
            }
          }
        }
      }
    }

    const { id, message, times, days } = result.data;

    // Проверяем, есть ли дни недели в формате пн, вт, ср...
    const weekdayRegex =
      /(пн|вт|ср|чт|пт|сб|вс)(?:[,\s]+(?:и\s+)?(пн|вт|ср|чт|пт|сб|вс))*/i;
    const extractedDays = result.data.days.toString();
    const weekdayMatch = extractedDays.match(weekdayRegex);

    let days_of_week = [];
    let targetDate = null;

    if (weekdayMatch) {
      // Определяем, повторяющееся это событие или однократное
      const isRecurring = isRecurringNotification(text);
      const isOneTime = isOneTimeWeekdayNotification(text);

      // Разбиваем строку с днями недели, учитывая различные разделители
      const dayCodes = extractedDays
        .toLowerCase()
        .replace(/\s+и\s+/g, ",") // Заменяем "и" на запятые
        .replace(/\s+/g, ",") // Заменяем пробелы на запятые
        .split(/[,\s]+/) // Разбиваем по запятым и пробелам
        .filter((day) => /^(пн|вт|ср|чт|пт|сб|вс)$/i.test(day.trim())) // Фильтруем только валидные коды
        .map((day) => day.trim()); // Обрезаем пробелы

      const dayMatches = dayCodes.map((day) => {
        // Создаем объект с полными названиями дней недели
        const dayNames = {
          пн: "понедельник",
          вт: "вторник",
          ср: "среда",
          чт: "четверг",
          пт: "пятница",
          сб: "суббота",
          вс: "воскресенье",
        };

        return {
          name: dayNames[day],
          code: day,
        };
      });

      // Проверяем, что нашли хотя бы один день недели
      if (dayMatches.length > 0) {
        if ((!isRecurring || isOneTime) && dayMatches.length > 0) {
          // Для однократного уведомления в конкретный день недели
          const notificationData = processOneTimeWeekdayNotification(
            result,
            text,
            dayMatches
          );

          id = notificationData.id;
          message = notificationData.message;
          times = notificationData.times;
          days = notificationData.days;
          days_of_week = notificationData.days_of_week;
          targetDate = notificationData.targetDate;
        } else if (isRecurring) {
          // Для повторяющихся уведомлений
          const notificationData = processRecurringWeekdayNotification(
            result,
            dayMatches
          );

          id = notificationData.id;
          message = notificationData.message;
          times = notificationData.times;
          days = notificationData.days;
          days_of_week = notificationData.days_of_week;
        }
      }
    } else {
      // Проверяем, может быть в тексте есть указание на день недели
      const dayMatches = extractDaysOfWeek(text);

      if (dayMatches.length > 0) {
        // Определяем, повторяющееся это событие или однократное
        const isRecurring = isRecurringNotification(text);
        const isOneTime = isOneTimeWeekdayNotification(text);

        if ((!isRecurring || isOneTime) && dayMatches.length > 0) {
          // Для однократного уведомления в конкретный день недели
          const notificationData = processOneTimeWeekdayNotification(
            { data: { id, message, times, days } },
            text,
            dayMatches
          );

          targetDate = notificationData.targetDate;
        } else if (isRecurring) {
          // Для повторяющихся уведомлений по дням недели
          const notificationData = processRecurringWeekdayNotification(
            { data: { id, message, times, days } },
            dayMatches
          );

          days_of_week = notificationData.days_of_week;
        }
      }
    }

    // Добавляем уведомление в базу данных
    await addNotification(
      id,
      chatId,
      message,
      times,
      days,
      days_of_week,
      targetDate
    );

    // Формируем сообщение о периодичности
    let periodMessage;

    if (days_of_week && days_of_week.length > 0) {
      // Для повторяющихся уведомлений по дням недели
      const daysOfWeekCodes = days_of_week.map((day) => {
        const dayMap = {
          0: "вс",
          1: "пн",
          2: "вт",
          3: "ср",
          4: "чт",
          5: "пт",
          6: "сб",
        };
        return dayMap[day];
      });

      periodMessage = formatPeriodMessageForWeekdays(daysOfWeekCodes);
    } else if (targetDate) {
      // Для однократного уведомления с конкретной датой
      const dayMatches = extractDaysOfWeek(text);
      periodMessage = formatOneTimeNotificationMessage(targetDate, dayMatches);
    } else {
      // Для обычных уведомлений
      periodMessage = formatPeriodMessage(text, days, days_of_week);
    }

    // Формируем сообщение для пользователя
    const confirmationMessage = formatConfirmationMessage(
      message,
      times,
      periodMessage
    );

    return {
      success: true,
      message: confirmationMessage,
    };
  } catch (err) {
    console.error("Ошибка при обработке сообщения:", err);

    // Пробуем обработать сообщение напрямую через парсер
    const directResult = parseMessage(text);

    if (directResult.success) {
      try {
        const { id, message, times, days, days_of_week } = directResult.data;

        // Добавляем уведомление в базу данных с учетом дней недели
        await addNotification(
          id,
          chatId,
          message,
          times,
          days,
          days_of_week || []
        );

        return {
          success: true,
          message: "✅ Принято",
        };
      } catch (directErr) {
        console.error("Ошибка при прямом создании уведомления:", directErr);
        return {
          success: false,
          error: "Произошла ошибка при создании уведомления",
        };
      }
    } else {
      // Пробуем прямой анализ текста
      const result = processTextDirectly(text);

      if (result && result.success) {
        // Обработка успешного результата прямого анализа
        const { id, message, times, days } = result.data;

        // Проверяем, может быть в тексте есть указание на день недели
        const dayMatches = extractDaysOfWeek(text);

        let days_of_week = [];
        let targetDate = null;

        if (dayMatches.length > 0) {
          // Определяем, повторяющееся это событие или однократное
          const isRecurring = isRecurringNotification(text);
          const isOneTime = isOneTimeWeekdayNotification(text);

          if ((!isRecurring || isOneTime) && dayMatches.length > 0) {
            // Для однократного уведомления в конкретный день недели
            const notificationData = processOneTimeWeekdayNotification(
              { data: { id, message, times, days } },
              text,
              dayMatches
            );

            targetDate = notificationData.targetDate;
          } else if (isRecurring) {
            // Для повторяющихся уведомлений по дням недели
            const notificationData = processRecurringWeekdayNotification(
              { data: { id, message, times, days } },
              dayMatches
            );

            days_of_week = notificationData.days_of_week;
          }
        }

        // Добавляем уведомление в базу данных
        await addNotification(
          id,
          chatId,
          message,
          times,
          days,
          days_of_week,
          targetDate
        );

        // Формируем сообщение о периодичности
        let periodMessage;

        if (isRecurringNotification(text) && dayMatches.length > 0) {
          periodMessage = formatPeriodMessageForWeekdays(
            dayMatches.map((d) => d.code)
          );
        } else if (targetDate) {
          periodMessage = formatOneTimeNotificationMessage(
            targetDate,
            dayMatches
          );
        } else {
          periodMessage = "только один раз";
        }

        // Формируем сообщение для пользователя
        const confirmationMessage = formatConfirmationMessage(
          message,
          times,
          periodMessage
        );

        return {
          success: true,
          message: confirmationMessage,
        };
      }

      return {
        success: false,
        error:
          '❌ Не удалось обработать ваш запрос. Пожалуйста, используйте формат: "Текст сообщения" "ЧЧ:ММ" КОЛ-ВО_ДНЕЙ или укажите дни недели: пн, вт, ср, чт, пт, сб, вс',
      };
    }
  }
};

module.exports = {
  processUserMessage,
};
