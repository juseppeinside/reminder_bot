/**
 * Функции для форматирования сообщений
 */
const {
  isRecurringNotification,
  isOneTimeWeekdayNotification,
  dayNumberToName,
  formatDateForDisplay,
} = require("./dateTime");

/**
 * Форматирует сообщение о периодичности уведомления
 * @param {string} text - Исходный текст пользователя
 * @param {number} days - Количество дней для уведомления
 * @param {Array} daysOfWeek - Массив дней недели
 * @returns {string} Отформатированное сообщение о периодичности
 */
const formatPeriodMessage = (text, days, daysOfWeek = []) => {
  // Если указаны конкретные дни недели
  if (daysOfWeek && daysOfWeek.length > 0) {
    // Определяем, есть ли ключевые слова для повторяющегося события
    const isRecurring = isRecurringNotification(text);

    // Явные признаки однократного события
    const isOneTime = isOneTimeWeekdayNotification(text);

    if (isRecurring) {
      return formatPeriodMessageForWeekdays(daysOfWeek);
    } else {
      // Для однократных событий в конкретный день недели
      const daysText = daysOfWeek
        .map((day) => `в ${dayNumberToName(day, true)}`)
        .join(" и ");

      return daysText;
    }
  }

  // Проверяем конкретное значение дней
  if (days !== 36500) {
    if (days === 1) {
      return "только один раз";
    }
    return `${days} дней`;
  }

  const textLower = text.toLowerCase();

  // Специальная обработка для ежедневных напоминаний
  // Проверяем ключевые фразы для ежедневных напоминаний в тексте
  const dailyPhrases = [
    "каждый день",
    "ежедневно",
    "каждодневно",
    "каждые сутки",
    "ежесуточно",
    "все дни",
    "день за днем",
    "изо дня в день",
  ];

  for (const phrase of dailyPhrases) {
    if (textLower.includes(phrase)) {
      return "каждый день";
    }
  }

  // Если нет явного указания на "каждый день", но текст содержит "каждый" без дня недели
  if (
    (textLower.includes("кажд") || textLower.includes("ежедневн")) &&
    !textLower.includes("понедельник") &&
    !textLower.includes("вторник") &&
    !textLower.includes("среду") &&
    !textLower.includes("среда") &&
    !textLower.includes("четверг") &&
    !textLower.includes("пятницу") &&
    !textLower.includes("пятница") &&
    !textLower.includes("субботу") &&
    !textLower.includes("суббота") &&
    !textLower.includes("воскресенье")
  ) {
    return "каждый день";
  }

  // Проверяем, содержит ли исходный запрос упоминание дней недели
  const weekDaysNames = [
    "понедельник",
    "вторник",
    "среда",
    "четверг",
    "пятница",
    "суббота",
    "воскресенье",
  ];

  // Находим все упоминания дней недели в тексте
  const mentionedDays = weekDaysNames.filter((day) => textLower.includes(day));

  if (mentionedDays.length > 0) {
    // Проверяем наличие слова "каждый" или "каждую" перед днем недели
    const hasEvery = isRecurringNotification(text);
    const isOneTimeEvent = isOneTimeWeekdayNotification(text);

    if (hasEvery) {
      if (mentionedDays.length === 1) {
        return `каждый ${mentionedDays[0]}`;
      } else if (mentionedDays.length === 2) {
        return `каждый ${mentionedDays[0]} и ${mentionedDays[1]}`;
      } else {
        const lastDay = mentionedDays.pop();
        return `каждый ${mentionedDays.join(", ")} и ${lastDay}`;
      }
    } else if (isOneTimeEvent) {
      // Для однократных событий
      if (mentionedDays.length === 1) {
        return `в ${mentionedDays[0]}`;
      } else if (mentionedDays.length === 2) {
        return `в ${mentionedDays[0]} и в ${mentionedDays[1]}`;
      } else {
        const lastDay = mentionedDays.pop();
        return `в ${mentionedDays.join(", в ")} и в ${lastDay}`;
      }
    } else {
      return "каждый день";
    }
  } else {
    return "каждый день";
  }
};

/**
 * Форматирует сообщение о периодичности для дней недели
 * @param {Array} daysOfWeek - Массив кодов дней недели
 * @returns {string} Отформатированное сообщение
 */
const formatPeriodMessageForWeekdays = (daysOfWeek) => {
  const daysNames = {
    пн: "понедельник",
    вт: "вторник",
    ср: "среда",
    чт: "четверг",
    пт: "пятница",
    сб: "суббота",
    вс: "воскресенье",
    0: "воскресенье",
    1: "понедельник",
    2: "вторник",
    3: "среда",
    4: "четверг",
    5: "пятница",
    6: "суббота",
  };

  // Преобразуем коды дней в названия
  const daysList = Array.isArray(daysOfWeek)
    ? daysOfWeek.map((day) => daysNames[day])
    : daysOfWeek.split(",").map((day) => daysNames[day.trim()]);

  if (daysList.length === 1) {
    return `каждый ${daysList[0]}`;
  } else if (daysList.length === 2) {
    return `каждый ${daysList[0]} и ${daysList[1]}`;
  } else {
    const lastDay = daysList.pop();
    return `каждый ${daysList.join(", ")} и ${lastDay}`;
  }
};

/**
 * Форматирует сообщение для однократного уведомления с конкретной датой
 * @param {string} dayName - Название дня недели
 * @param {string} formattedDate - Отформатированная дата (ДД.ММ.ГГГГ)
 * @returns {string} Отформатированное сообщение
 */
const formatOneTimeMessage = (dayName, formattedDate) => {
  return `в ${dayName} (${formattedDate})`;
};

/**
 * Форматирует сообщение для подтверждения создания напоминания
 * @param {string} message - Текст напоминания
 * @param {Array} times - Массив времен для напоминания
 * @param {string} periodMessage - Сообщение о периодичности
 * @returns {string} Отформатированное сообщение
 */
const formatConfirmationMessage = (message, times, periodMessage) => {
  return `✅ Создано напоминание:\n📝 ${message}\n🕒 ${times.join(
    ", "
  )}\n📆 ${periodMessage}`;
};

module.exports = {
  formatPeriodMessage,
  formatPeriodMessageForWeekdays,
  formatOneTimeMessage,
  formatConfirmationMessage,
};
