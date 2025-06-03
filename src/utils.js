const { v4: uuidv4 } = require("uuid");

// Парсинг сообщения с поддержкой различных форматов ввода
const parseMessage = (text) => {
  try {
    // Первый формат: "Текст" "12:00,16:00" 30 или «Текст» «12:00,16:00» 30
    const regexWithQuotes =
      /^["""«]([^"""«»]+)["""»]\s+["""«]([^"""«»]+)["""»]\s+(\d+|infinity)$/i;

    // Второй формат: "Текст" 12:00 30 или «Текст» 12:00 30
    const regexWithoutTimeQuotes =
      /^["""«]([^"""«»]+)["""»]\s+([0-9]{1,2}:[0-9]{2})\s+(\d+|infinity)$/i;

    let match = text.match(regexWithQuotes);
    let isTimeInQuotes = true;

    if (!match) {
      match = text.match(regexWithoutTimeQuotes);
      isTimeInQuotes = false;

      if (!match) {
        return {
          success: false,
          error:
            'Неверный формат сообщения. Используйте одну из форм:\n1. "Текст сообщения" "ЧЧ:ММ,ЧЧ:ММ" КОЛ-ВО_ДНЕЙ\n2. «Текст сообщения» «ЧЧ:ММ,ЧЧ:ММ» КОЛ-ВО_ДНЕЙ\n3. "Текст сообщения" ЧЧ:ММ КОЛ-ВО_ДНЕЙ\n4. «Текст сообщения» ЧЧ:ММ КОЛ-ВО_ДНЕЙ\n\nВместо КОЛ-ВО_ДНЕЙ можно указать "infinity" для бесконечной отправки.',
        };
      }
    }

    const [, message, timeString, daysStr] = match;

    // Проверка на infinity или числовое значение
    let days;
    if (daysStr.toLowerCase() === "infinity") {
      days = 36500; // Примерно 100 лет - условно бесконечно
    } else {
      days = parseInt(daysStr, 10);

      if (isNaN(days) || days <= 0) {
        return {
          success: false,
          error:
            "Количество дней должно быть положительным числом или 'infinity'",
        };
      }
    }

    // Парсинг времени в зависимости от формата
    let times;
    if (isTimeInQuotes) {
      times = timeString.split(",").map((time) => time.trim());
    } else {
      times = [timeString.trim()];
    }

    const validTimes = [];
    const invalidTimes = [];

    for (const time of times) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
      const timeMatch = time.match(timeRegex);

      if (timeMatch) {
        const hours = timeMatch[1].padStart(2, "0");
        const minutes = timeMatch[2];
        validTimes.push(`${hours}:${minutes}`);
      } else {
        invalidTimes.push(time);
      }
    }

    if (invalidTimes.length > 0) {
      return {
        success: false,
        error: `Неверный формат времени: ${invalidTimes.join(
          ", "
        )}. Используйте формат ЧЧ:ММ`,
      };
    }

    if (validTimes.length === 0) {
      return {
        success: false,
        error: "Необходимо указать хотя бы одно время для уведомления",
      };
    }

    return {
      success: true,
      data: {
        message,
        times: validTimes,
        days,
        id: uuidv4(),
        type: "daily", // Тип уведомления - ежедневное
      },
    };
  } catch (err) {
    console.error("Ошибка при парсинге сообщения:", err);
    return {
      success: false,
      error: "Произошла ошибка при обработке сообщения",
    };
  }
};

// Парсинг команды /month для ежемесячных уведомлений
const parseMonthCommand = (text) => {
  try {
    // Формат: /month "Текст" "12:00,16:00" 5 12 или /month «Текст» «12:00,16:00» 5 12
    const regexWithQuotes =
      /^\/month\s+["""«]([^"""«»]+)["""»]\s+["""«]([^"""«»]+)["""»]\s+(\d+|infinity)\s+(\d+)$/i;

    // Формат: /month "Текст" 12:00 5 12 или /month «Текст» 12:00 5 12
    const regexWithoutTimeQuotes =
      /^\/month\s+["""«]([^"""«»]+)["""»]\s+([0-9]{1,2}:[0-9]{2})\s+(\d+|infinity)\s+(\d+)$/i;

    let match = text.match(regexWithQuotes);
    let isTimeInQuotes = true;

    if (!match) {
      match = text.match(regexWithoutTimeQuotes);
      isTimeInQuotes = false;

      if (!match) {
        return {
          success: false,
          error:
            'Неверный формат команды. Используйте одну из форм:\n1. /month "Текст сообщения" "ЧЧ:ММ,ЧЧ:ММ" КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА\n2. /month «Текст сообщения» «ЧЧ:ММ,ЧЧ:ММ» КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА\n3. /month "Текст сообщения" ЧЧ:ММ КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА\n4. /month «Текст сообщения» ЧЧ:ММ КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА\n\nВместо КОЛ-ВО_МЕСЯЦЕВ можно указать "infinity" для бесконечной отправки.',
        };
      }
    }

    const [, message, timeString, monthsStr, dayOfMonthStr] = match;

    // Проверка дня месяца
    const dayOfMonth = parseInt(dayOfMonthStr, 10);
    if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      return {
        success: false,
        error: "День месяца должен быть числом от 1 до 28",
      };
    }

    // Проверка на infinity или числовое значение для количества месяцев
    let months;
    if (monthsStr.toLowerCase() === "infinity") {
      months = 36500 / 30; // Примерно 100 лет - условно бесконечно
    } else {
      months = parseInt(monthsStr, 10);

      if (isNaN(months) || months <= 0) {
        return {
          success: false,
          error:
            "Количество месяцев должно быть положительным числом или 'infinity'",
        };
      }
    }

    // Парсинг времени в зависимости от формата
    let times;
    if (isTimeInQuotes) {
      times = timeString.split(",").map((time) => time.trim());
    } else {
      times = [timeString.trim()];
    }

    const validTimes = [];
    const invalidTimes = [];

    for (const time of times) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
      const timeMatch = time.match(timeRegex);

      if (timeMatch) {
        const hours = timeMatch[1].padStart(2, "0");
        const minutes = timeMatch[2];
        validTimes.push(`${hours}:${minutes}`);
      } else {
        invalidTimes.push(time);
      }
    }

    if (invalidTimes.length > 0) {
      return {
        success: false,
        error: `Неверный формат времени: ${invalidTimes.join(
          ", "
        )}. Используйте формат ЧЧ:ММ`,
      };
    }

    if (validTimes.length === 0) {
      return {
        success: false,
        error: "Необходимо указать хотя бы одно время для уведомления",
      };
    }

    return {
      success: true,
      data: {
        message,
        times: validTimes,
        months,
        dayOfMonth,
        id: uuidv4(),
        type: "monthly", // Тип уведомления - ежемесячное
      },
    };
  } catch (err) {
    console.error("Ошибка при парсинге команды /month:", err);
    return {
      success: false,
      error: "Произошла ошибка при обработке команды",
    };
  }
};

// Парсинг команды удаления вида: /delete uuid
const parseDeleteCommand = (text) => {
  try {
    const regex =
      /^\/delete\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
    const match = text.match(regex);

    if (!match) {
      return {
        success: false,
        error: "Неверный формат команды удаления. Используйте: /delete UUID",
      };
    }

    return {
      success: true,
      id: match[1],
    };
  } catch (err) {
    console.error("Ошибка при парсинге команды удаления:", err);
    return {
      success: false,
      error: "Произошла ошибка при обработке команды",
    };
  }
};

/**
 * Парсит команду /ai
 * @param {string} text - Текст команды
 * @returns {object} - Результат парсинга
 */
const parseAiCommand = (text) => {
  const aiCommandRegex = /\/ai\s+(.+)/;
  const match = text.match(aiCommandRegex);

  if (!match) {
    return {
      success: false,
      error: "Неверный формат команды. Пример: /ai текст сообщения",
    };
  }

  const message = match[1].trim();

  if (!message) {
    return {
      success: false,
      error: "Текст сообщения не может быть пустым",
    };
  }

  return {
    success: true,
    data: {
      message,
    },
  };
};

module.exports = {
  parseMessage,
  parseMonthCommand,
  parseDeleteCommand,
  parseAiCommand,
};
