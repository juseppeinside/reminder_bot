const { v4: uuidv4 } = require("uuid");

// Парсинг сообщения вида: "Текст сообщения" "12:00,16:00" 30
const parseMessage = (text) => {
  try {
    // Регулярное выражение для извлечения сообщения, времен и дней
    const regex = /^"([^"]+)"\s+"([^"]+)"\s+(\d+)$/;
    const match = text.match(regex);

    if (!match) {
      return {
        success: false,
        error:
          'Неверный формат сообщения. Используйте: "Текст сообщения" "ЧЧ:ММ,ЧЧ:ММ" КОЛ-ВО_ДНЕЙ',
      };
    }

    const [, message, timeString, daysStr] = match;
    const days = parseInt(daysStr, 10);

    if (isNaN(days) || days <= 0) {
      return {
        success: false,
        error: "Количество дней должно быть положительным числом",
      };
    }

    // Проверка и парсинг времени
    const times = timeString.split(",").map((time) => time.trim());
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

module.exports = {
  parseMessage,
  parseDeleteCommand,
};
