require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const {
  parseMessage,
  parseDeleteCommand,
  parseNotificationCommand,
} = require("./utils");
const { processUserMessage } = require("./services/botMessageProcessor");
const {
  addNotification,
  getUserNotifications,
  deleteNotification,
  getAllUsers,
} = require("./db");
const { initScheduler } = require("./scheduler");
const config = require("../config");
const {
  WELCOME_MESSAGE,
  HELP_MESSAGE,
  EMPTY_NOTIFICATIONS_LIST,
  NOTIFICATION_LIST_ERROR,
  NOTIFICATION_DELETION_ERROR,
  INSUFFICIENT_PERMISSIONS,
  NOTIFICATION_SENT,
  USERS_LIST_ERROR,
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

// Обработка команды /users
bot.onText(/\/users/, async (msg) => {
  const chatId = msg.chat.id;

  // Проверка на права администратора
  if (
    config.ADMIN_USER_ID &&
    chatId.toString() !== config.ADMIN_USER_ID.toString()
  ) {
    await bot.sendMessage(chatId, INSUFFICIENT_PERMISSIONS);
    return;
  }

  try {
    const users = await getAllUsers();
    await bot.sendMessage(
      chatId,
      `📊 Всего зарегистрировано пользователей: ${users.length}`
    );
  } catch (err) {
    console.error("Ошибка при получении списка пользователей:", err);
    await bot.sendMessage(chatId, USERS_LIST_ERROR);
  }
});

// Обработка команды /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  await bot.sendMessage(chatId, HELP_MESSAGE.replace("{userId}", userId));
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

    // Функция для разделения сообщений на части
    const splitIntoChunks = (notifications) => {
      const chunks = [];
      let currentChunk = [];
      let currentLength = 0;
      const maxLength = 3500; // Максимальная длина сообщения Telegram

      for (const notification of notifications) {
        // Оцениваем длину текущего уведомления
        let notificationText = `📝 Сообщение: ${notification.message}\n`;
        notificationText += `🕒 Время: ${notification.times.join(", ")}\n`;
        notificationText += `🆔 ID: ${notification.id}\n`;

        if (notification.type === "daily") {
          notificationText += `📅 Тип: Ежедневное\n`;

          // Если есть дни недели, добавляем их
          if (
            notification.days_of_week &&
            notification.days_of_week.length > 0
          ) {
            const daysText = notification.days_of_week
              .map((day) => dayNumberToName(day))
              .join(", ");

            notificationText += `📆 Дни недели: ${daysText}\n`;
          } else {
            notificationText += `⏳ Осталось дней: ${
              notification.days_left === 36500
                ? "♾️ (бесконечно)"
                : notification.days_left
            }\n`;
          }

          notificationText += "\n";
        } else if (notification.type === "monthly") {
          notificationText += `🗓️ Тип: Ежемесячное (${notification.day_of_month} число)\n`;
          notificationText += `⏳ Осталось месяцев: ${
            notification.months_left === 36500 / 30
              ? "♾️ (бесконечно)"
              : notification.months_left
          }\n\n`;
        }

        // Проверяем, превысит ли добавление текущего уведомления максимальную длину
        if (currentLength + notificationText.length > maxLength) {
          // Если да, начинаем новый чанк
          chunks.push(currentChunk);
          currentChunk = [notificationText];
          currentLength = notificationText.length;
        } else {
          // Если нет, добавляем к текущему чанку
          currentChunk.push(notificationText);
          currentLength += notificationText.length;
        }
      }

      // Добавляем последний чанк, если он не пустой
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      return chunks;
    };

    // Разбиваем уведомления на части
    const chunks = splitIntoChunks(notifications);

    // Отправляем каждую часть как отдельное сообщение
    for (let i = 0; i < chunks.length; i++) {
      const messageHeader =
        i === 0
          ? `📋 Ваши активные уведомления (часть ${i + 1}/${
              chunks.length
            }):\n\n`
          : `📋 Часть ${i + 1}/${chunks.length}:\n\n`;

      const message = messageHeader + chunks[i].join("");
      await bot.sendMessage(chatId, message);
    }
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

// Обработка команды отправки уведомления всем пользователям
bot.onText(/\/notification[\s\S]*/, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = msg.text; // Используем полный текст сообщения вместо match[0]

  // Проверка на права администратора
  if (
    config.ADMIN_USER_ID &&
    chatId.toString() !== config.ADMIN_USER_ID.toString()
  ) {
    await bot.sendMessage(chatId, INSUFFICIENT_PERMISSIONS);
    return;
  }

  const result = parseNotificationCommand(text);

  if (!result.success) {
    await bot.sendMessage(chatId, "❌ " + result.error);
    return;
  }

  try {
    // Получаем список всех пользователей
    const users = await getAllUsers();

    // Функция задержки
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Разбиваем пользователей на группы по 10 человек
    const batchSize = 10;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      // Отправляем сообщения пакетно
      const sendPromises = batch.map(async (userId) => {
        try {
          await bot.sendMessage(userId, result.message, { parse_mode: "HTML" });
          successCount++;
          return true;
        } catch (err) {
          // Если не сработало с HTML, пробуем без форматирования
          try {
            await bot.sendMessage(userId, result.message);
            successCount++;
            return true;
          } catch (secondErr) {
            console.error(
              `Ошибка при отправке уведомления пользователю ${userId}:`,
              secondErr
            );
            errorCount++;
            return false;
          }
        }
      });

      // Ждем завершения отправки текущей группы
      await Promise.all(sendPromises);

      // Отправляем промежуточный статус для больших списков
      if (users.length > 20 && (i + batchSize) % 20 === 0) {
        await bot.sendMessage(
          chatId,
          `⏳ Прогресс: ${Math.min(i + batchSize, users.length)}/${
            users.length
          } (${successCount} успешно, ${errorCount} с ошибками)`
        );
      }

      // Делаем паузу между пакетами, чтобы не превысить лимиты Telegram
      if (i + batchSize < users.length) {
        await delay(1000);
      }
    }

    // Отправляем итоговый отчет
    await bot.sendMessage(chatId, `${NOTIFICATION_SENT}`);
  } catch (err) {
    console.error("Ошибка при отправке уведомления всем пользователям:", err);
    await bot.sendMessage(
      chatId,
      "❌ Произошла ошибка при отправке уведомления"
    );
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
