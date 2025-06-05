/**
 * Функции для парсинга данных уведомлений
 */

const { dayCodeToNumber } = require("./dateTime");

/**
 * Получает информацию о днях недели из текста
 * @param {string} text - Текст с упоминанием дней недели
 * @returns {Array} Массив объектов с информацией о днях недели
 */
const extractDaysOfWeek = (text) => {
  const userDayPatterns = {
    понедельник: "пн",
    вторник: "вт",
    среду: "ср",
    среда: "ср",
    четверг: "чт",
    пятницу: "пт",
    пятница: "пт",
    субботу: "сб",
    суббота: "сб",
    воскресенье: "вс",
  };

  const dayMatches = [];

  // Проверяем текст на наличие названий дней недели
  for (const [dayName, shortDay] of Object.entries(userDayPatterns)) {
    if (text.toLowerCase().includes(dayName)) {
      dayMatches.push({ name: dayName, code: shortDay });
    }
  }

  return dayMatches;
};

/**
 * Преобразует сокращения дней недели в числовые коды
 * @param {Array} dayMatches - Массив объектов с информацией о днях недели
 * @returns {Array} Массив числовых кодов дней недели
 */
const convertDayMatchesToNumbers = (dayMatches) => {
  return dayMatches.map((day) => dayCodeToNumber(day.code));
};

/**
 * Извлекает возможное сообщение из текста, исключая дни недели и время
 * @param {string} text - Исходный текст
 * @param {Object} userDayPatterns - Объект с шаблонами дней недели
 * @returns {string} Извлеченное сообщение
 */
const extractEventName = (
  text,
  userDayPatterns = {
    понедельник: "пн",
    вторник: "вт",
    среду: "ср",
    среда: "ср",
    четверг: "чт",
    пятницу: "пт",
    пятница: "пт",
    субботу: "сб",
    суббота: "сб",
    воскресенье: "вс",
  }
) => {
  // Список ключевых слов для фильтрации (не включаются в название события)
  const keywordsToFilter = [
    "напомни",
    "напомнить",
    "напоминай",
    "каждый",
    "каждую",
    "каждое",
    "через",
    "завтра",
    "послезавтра",
    "мне",
    "меня",
  ];

  // Список стоп-слов, которые обозначают конец именной части
  const stopWords = [
    "в",
    "через",
    "завтра",
    "сегодня",
    "каждый",
    "каждую",
    "в течение",
  ];

  // Проверяем фразы типа "посещать тренировку", "выпить воды", "принять таблетки"
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

  for (const verb of actionVerbs) {
    const verbIndex = text.toLowerCase().indexOf(verb);
    if (verbIndex !== -1) {
      // Берем текст от глагола
      const restOfText = text.substring(verbIndex);
      const words = restOfText.split(/\s+/);

      // Берем максимум 2-3 слова, но останавливаемся на стоп-словах
      let actionWords = [];

      for (let i = 0; i < Math.min(3, words.length); i++) {
        if (stopWords.includes(words[i].toLowerCase())) {
          break;
        }
        actionWords.push(words[i]);
      }

      if (actionWords.length > 0) {
        return actionWords.join(" ");
      }

      // Если список пустой, используем только глагол
      return verb;
    }
  }

  // Если не нашли ничего по шаблонам выше, используем упрощенный алгоритм
  const words = text.split(/\s+/);
  const filteredWords = words.filter((w) => {
    const wLower = w.toLowerCase();
    return (
      !Object.keys(userDayPatterns).some((day) => wLower.includes(day)) &&
      !/[0-9:]/g.test(w) &&
      w.length > 2 &&
      !keywordsToFilter.includes(wLower)
    );
  });

  // Берем только первые 2-3 значимых слова
  if (filteredWords.length > 0) {
    return filteredWords.slice(0, 3).join(" ");
  }

  // Если ничего не нашли, возвращаем общее название
  return "Напоминание";
};

/**
 * Извлекает названия дней недели в виде строки
 * @param {Array} dayMatches - Массив объектов с информацией о днях недели
 * @returns {string} Строка с кодами дней недели через запятую
 */
const extractDayCodes = (dayMatches) => {
  // Проверяем, получили ли мы уже строку с кодами дней недели
  if (typeof dayMatches === "string") {
    // Нормализуем строку - разбиваем по запятым и пробелам
    const normalizedDays = dayMatches
      .toLowerCase()
      .split(/[,\s]+/)
      .filter((day) => /^(пн|вт|ср|чт|пт|сб|вс)$/.test(day))
      .join(",");

    // Если получили непустую строку, возвращаем её
    if (normalizedDays) {
      return normalizedDays;
    }
  }

  // Если это массив объектов, извлекаем коды
  if (Array.isArray(dayMatches) && dayMatches.length > 0) {
    // Проверяем, что это массив объектов с кодами дней недели
    if (dayMatches[0] && dayMatches[0].code) {
      const codes = dayMatches.map((d) => d.code);

      // Проверяем на дубликаты и удаляем их
      const uniqueCodes = [...new Set(codes)];
      return uniqueCodes.join(",");
    }

    // Если это просто массив строк с кодами
    if (typeof dayMatches[0] === "string") {
      // Фильтруем только валидные коды дней недели и убираем дубликаты
      const validCodes = dayMatches
        .filter((code) => /^(пн|вт|ср|чт|пт|сб|вс)$/.test(code))
        .map((code) => code.toLowerCase());

      const uniqueCodes = [...new Set(validCodes)];

      if (uniqueCodes.length > 0) {
        return uniqueCodes.join(",");
      }
    }
  }

  // Если формат неизвестен, возвращаем пустую строку
  console.warn("Неизвестный формат дней недели:", dayMatches);
  return "";
};

/**
 * Парсит команду удаления уведомления
 * @param {string} text - Текст команды
 * @returns {Object} Результат парсинга
 */
const parseDeleteCommand = (text) => {
  const pattern = /\/delete\s+([a-zA-Z0-9-]+)/;
  const match = text.match(pattern);

  if (!match) {
    return {
      success: false,
      error: "Неверный формат команды. Используйте: /delete UUID",
    };
  }

  return {
    success: true,
    id: match[1],
  };
};

module.exports = {
  extractDaysOfWeek,
  convertDayMatchesToNumbers,
  extractEventName,
  extractDayCodes,
  parseDeleteCommand,
};
