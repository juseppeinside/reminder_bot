require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { parseMessage, parseDeleteCommand } = require("./utils");
const { processUserMessage } = require("./services/botMessageProcessor");
const {
  addNotification,
  getUserNotifications,
  deleteNotification,
} = require("./db");
const { initScheduler } = require("./scheduler");
const config = require("../config");
const {
  WELCOME_MESSAGE,
  HELP_MESSAGE,
  EMPTY_NOTIFICATIONS_LIST,
  NOTIFICATION_LIST_ERROR,
  NOTIFICATION_DELETION_ERROR,
} = require("./constants/botMessages");
const { formatDateForDisplay, dayNumberToName } = require("./utils/dateTime");

// Инициализация бота
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });

// Обработка ошибок
bot.on("polling_error", (error) => {
  console.error("Ошибка в работе бота:", error);
});

// Запуск планировщика
initScheduler(bot);

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, WELCOME_MESSAGE);
});

// Обработка команды /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, HELP_MESSAGE);
});

// Обработка команды /list
bot.onText(/\/list/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const notifications = await getUserNotifications(chatId);

    if (notifications.length === 0) {
      await bot.sendMessage(chatId, EMPTY_NOTIFICATIONS_LIST);
      return;
    }

    let message = "📋 Ваши активные уведомления:\n\n";

    for (const notification of notifications) {
      message += `📝 Сообщение: ${notification.message}\n`;
      message += `🕒 Время: ${notification.times.join(", ")}\n`;
      message += `🆔 ID: ${notification.id}\n`;

      if (notification.type === "daily") {
        message += `📅 Тип: Ежедневное\n`;

        // Если есть дни недели, добавляем их
        if (notification.days_of_week && notification.days_of_week.length > 0) {
          const daysText = notification.days_of_week
            .map((day) => dayNumberToName(day))
            .join(", ");

          message += `📆 Дни недели: ${daysText}\n`;
        } else {
          message += `⏳ Осталось дней: ${
            notification.days_left === 36500
              ? "♾️ (бесконечно)"
              : notification.days_left
          }\n`;
        }

        message += "\n";
      } else if (notification.type === "monthly") {
        message += `🗓️ Тип: Ежемесячное (${notification.day_of_month} число)\n`;
        message += `⏳ Осталось месяцев: ${
          notification.months_left === 36500 / 30
            ? "♾️ (бесконечно)"
            : notification.months_left
        }\n\n`;
      }
    }

    await bot.sendMessage(chatId, message);
  } catch (err) {
    console.error("Ошибка при получении списка уведомлений:", err);
    await bot.sendMessage(chatId, NOTIFICATION_LIST_ERROR);
  }
});

// Обработка команды удаления уведомления
bot.onText(/\/delete (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[0];

  const result = parseDeleteCommand(text);

  if (!result.success) {
    await bot.sendMessage(chatId, "❌ " + result.error);
    return;
  }

  try {
    const deleted = await deleteNotification(result.id);

    if (deleted) {
      await bot.sendMessage(chatId, `✅ Сообщение с uuid ${result.id} удалено`);
    } else {
      await bot.sendMessage(
        chatId,
        `❓ Уведомление с uuid ${result.id} не найдено`
      );
    }
  } catch (err) {
    console.error("Ошибка при удалении уведомления:", err);
    await bot.sendMessage(chatId, NOTIFICATION_DELETION_ERROR);
  }
});

// Обработка обычных сообщений (создание уведомлений)
bot.on("message", async (msg) => {
  // Пропускаем команды
  if (msg.text && msg.text.startsWith("/")) {
    return;
  }

  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) {
    return;
  }

  try {
    // Обрабатываем сообщение пользователя
    const result = await processUserMessage(text, chatId);

    // Отправляем ответ пользователю
    await bot.sendMessage(
      chatId,
      result.success ? result.message : result.error
    );
  } catch (err) {
    console.error("Ошибка при обработке сообщения:", err);
    await bot.sendMessage(
      chatId,
      "❌ Произошла ошибка при обработке сообщения"
    );
  }
});

console.log("🚀 Бот запущен!");

// Обработка остановки процесса
process.on("SIGINT", () => {
  bot.stopPolling();
  console.log("🛑 Бот остановлен");
  process.exit(0);
});
