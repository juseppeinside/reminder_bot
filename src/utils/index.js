/**
 * Индексный файл утилит
 */
const { v4: uuidv4 } = require("uuid");

// Функция для разбора сообщения
const parseMessage = (text) => {
  try {
    // Паттерны для различных форматов сообщений
    const patterns = [
      // "сообщение" "время" дни_или_дни_недели
      /["«]([^"»]+)["»]\s+["«]([0-9:,]+)["»]\s+([A-Za-z0-9,а-яА-Я]+)/,
      // "сообщение" время дни_или_дни_недели
      /["«]([^"»]+)["»]\s+([0-9:]+)\s+([A-Za-z0-9,а-яА-Я]+)/,
    ];

    // Проверяем каждый паттерн
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const [, message, timeStr, days] = match;

        // Преобразуем строку времени в массив времен
        const times = timeStr.includes(",")
          ? timeStr.split(",").map((t) => t.trim())
          : [timeStr.trim()];

        // Генерируем UUID для уведомления
        const id = uuidv4();

        // Расширенная проверка форматов дней недели
        // Эта проверка позволяет обрабатывать разные форматы: "пн,вт,ср", "пн, вт, ср", "пн вт ср"
        const weekdayPattern =
          /^(пн|вт|ср|чт|пт|сб|вс)([,\s]+(пн|вт|ср|чт|пт|сб|вс))*$/i;

        // Проверяем, содержит ли строка дней недели только коды дней
        if (weekdayPattern.test(days.trim())) {
          // Нормализуем формат дней недели - разделяем запятыми без пробелов
          const normalizedDays = days
            .trim()
            .toLowerCase()
            .split(/[,\s]+/)
            .filter((day) => /^(пн|вт|ср|чт|пт|сб|вс)$/i.test(day))
            .join(",");

          return {
            success: true,
            data: {
              id,
              message: message.trim(),
              times,
              days: normalizedDays, // Возвращаем нормализованную строку с днями недели
            },
          };
        } else {
          // Это количество дней
          let daysCount;
          if (days.toLowerCase() === "infinity") {
            daysCount = 36500; // ~100 лет
          } else {
            daysCount = parseInt(days, 10);
            if (isNaN(daysCount) || daysCount <= 0) {
              return {
                success: false,
                error: "Количество дней должно быть положительным числом",
              };
            }
          }

          return {
            success: true,
            data: {
              id,
              message: message.trim(),
              times,
              days: daysCount,
            },
          };
        }
      }
    }

    return {
      success: false,
      error: "Неверный формат сообщения",
    };
  } catch (err) {
    console.error("Ошибка при парсинге сообщения:", err);
    return {
      success: false,
      error: "Ошибка при парсинге сообщения",
    };
  }
};

// Импортируем и реэкспортируем все функции из модулей utils
const { parseDeleteCommand } = require("./notificationParser");
const dateTimeUtils = require("./dateTime");
const messageFormatters = require("./messageFormatters");
const notificationParser = require("./notificationParser");

module.exports = {
  parseMessage,
  parseDeleteCommand,
  ...dateTimeUtils,
  ...messageFormatters,
  ...notificationParser,
};
