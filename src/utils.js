const { v4: uuidv4 } = require("uuid");

// Парсинг сообщения с поддержкой различных форматов ввода
const parseMessage = (text) => {
  try {
    // Первый формат: "Текст" "12:00,16:00" 30 или «Текст» «12:00,16:00» 30
    const regexWithQuotes =
      /^["""«]([^"""«»]+)["""»]\s+["""«]([^"""«»]+)["""»]\s+(\d+|infinity|пн|вт|ср|чт|пт|сб|вс|пн,вт|пн,ср|пн,чт|пн,пт|пн,сб|пн,вс|вт,ср|вт,чт|вт,пт|вт,сб|вт,вс|ср,чт|ср,пт|ср,сб|ср,вс|чт,пт|чт,сб|чт,вс|пт,сб|пт,вс|сб,вс|пн,вт,ср|пн,вт,чт|пн,вт,пт|пн,вт,сб|пн,вт,вс|пн,ср,чт|пн,ср,пт|пн,ср,сб|пн,ср,вс|пн,чт,пт|пн,чт,сб|пн,чт,вс|пн,пт,сб|пн,пт,вс|пн,сб,вс|вт,ср,чт|вт,ср,пт|вт,ср,сб|вт,ср,вс|вт,чт,пт|вт,чт,сб|вт,чт,вс|вт,пт,сб|вт,пт,вс|вт,сб,вс|ср,чт,пт|ср,чт,сб|ср,чт,вс|ср,пт,сб|ср,пт,вс|ср,сб,вс|чт,пт,сб|чт,пт,вс|чт,сб,вс|пт,сб,вс)$/i;

    // Второй формат: "Текст" 12:00 30 или «Текст» 12:00 30
    const regexWithoutTimeQuotes =
      /^["""«]([^"""«»]+)["""»]\s+([0-9]{1,2}:[0-9]{2})\s+(\d+|infinity|пн|вт|ср|чт|пт|сб|вс|пн,вт|пн,ср|пн,чт|пн,пт|пн,сб|пн,вс|вт,ср|вт,чт|вт,пт|вт,сб|вт,вс|ср,чт|ср,пт|ср,сб|ср,вс|чт,пт|чт,сб|чт,вс|пт,сб|пт,вс|сб,вс|пн,вт,ср|пн,вт,чт|пн,вт,пт|пн,вт,сб|пн,вт,вс|пн,ср,чт|пн,ср,пт|пн,ср,сб|пн,ср,вс|пн,чт,пт|пн,чт,сб|пн,чт,вс|пн,пт,сб|пн,пт,вс|пн,сб,вс|вт,ср,чт|вт,ср,пт|вт,ср,сб|вт,ср,вс|вт,чт,пт|вт,чт,сб|вт,чт,вс|вт,пт,сб|вт,пт,вс|вт,сб,вс|ср,чт,пт|ср,чт,сб|ср,чт,вс|ср,пт,сб|ср,пт,вс|ср,сб,вс|чт,пт,сб|чт,пт,вс|чт,сб,вс|пт,сб,вс)$/i;

    let match = text.match(regexWithQuotes);
    let isTimeInQuotes = true;

    if (!match) {
      match = text.match(regexWithoutTimeQuotes);
      isTimeInQuotes = false;

      if (!match) {
        return {
          success: false,
          error:
            'Неверный формат сообщения. Используйте одну из форм:\n1. "Текст сообщения" "ЧЧ:ММ,ЧЧ:ММ" КОЛ-ВО_ДНЕЙ\n2. «Текст сообщения» «ЧЧ:ММ,ЧЧ:ММ» КОЛ-ВО_ДНЕЙ\n3. "Текст сообщения" ЧЧ:ММ КОЛ-ВО_ДНЕЙ\n4. «Текст сообщения» ЧЧ:ММ КОЛ-ВО_ДНЕЙ\n\nВместо КОЛ-ВО_ДНЕЙ можно указать "infinity" для бесконечной отправки или конкретные дни недели (пн, вт, ср, чт, пт, сб, вс) через запятую.',
        };
      }
    }

    const [, message, timeString, daysStr] = match;

    // Проверка на days_of_week, infinity или числовое значение
    let days;
    let daysOfWeek = [];
    const weekdayPatterns =
      /^(пн|вт|ср|чт|пт|сб|вс)(,(пн|вт|ср|чт|пт|сб|вс))*$/i;

    if (daysStr.toLowerCase() === "infinity") {
      days = 36500; // Примерно 100 лет - условно бесконечно
    } else if (weekdayPatterns.test(daysStr.toLowerCase())) {
      days = 36500; // Для дней недели тоже используем "бесконечно"

      // Преобразуем сокращения дней недели в числа (0 - воскресенье, 1 - понедельник, и т.д.)
      const dayMap = {
        пн: 1,
        вт: 2,
        ср: 3,
        чт: 4,
        пт: 5,
        сб: 6,
        вс: 0,
      };

      daysOfWeek = daysStr
        .toLowerCase()
        .split(",")
        .map((day) => dayMap[day]);
    } else {
      days = parseInt(daysStr, 10);

      if (isNaN(days) || days <= 0) {
        return {
          success: false,
          error:
            "Количество дней должно быть положительным числом, 'infinity' или днями недели (пн, вт, ср, чт, пт, сб, вс)",
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
        days_of_week: daysOfWeek,
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

// Парсинг команды отправки уведомления вида: /notification "Текст сообщения"
const parseNotificationCommand = (text) => {
  try {
    const regex = /^\/notification\s+["«]([^"»]+)["»]$/i;
    const match = text.match(regex);

    if (!match) {
      return {
        success: false,
        error:
          'Неверный формат команды. Используйте: /notification "Текст сообщения"',
      };
    }

    return {
      success: true,
      message: match[1],
    };
  } catch (err) {
    console.error("Ошибка при парсинге команды отправки уведомления:", err);
    return {
      success: false,
      error: "Произошла ошибка при обработке команды",
    };
  }
};

module.exports = {
  parseMessage,
  parseDeleteCommand,
  parseNotificationCommand,
};
