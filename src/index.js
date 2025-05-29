require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { parseMessage, parseDeleteCommand } = require("./utils");
const {
  addNotification,
  getUserNotifications,
  deleteNotification,
} = require("./db");
const { initScheduler } = require("./scheduler");
const config = require("../config");

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
  const message = `Привет! Я бот для отправки регулярных уведомлений.

Чтобы создать уведомление, отправьте сообщение в формате:
"Текст сообщения" "ЧЧ:ММ,ЧЧ:ММ" КОЛ-ВО_ДНЕЙ
или
«Текст сообщения» «ЧЧ:ММ,ЧЧ:ММ» КОЛ-ВО_ДНЕЙ

Например:
"Выпить воды" "12:00,16:00" 30
или
«Выпить воды» «12:00,16:00» 30

Для удаления уведомления используйте команду:
/delete UUID`;

  await bot.sendMessage(chatId, message);
});

// Обработка команды /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const message = `Формат создания уведомления:
"Текст сообщения" "ЧЧ:ММ,ЧЧ:ММ" КОЛ-ВО_ДНЕЙ
или
«Текст сообщения» «ЧЧ:ММ,ЧЧ:ММ» КОЛ-ВО_ДНЕЙ

Где:
- Текст сообщения - сообщение, которое вы хотите получать
- ЧЧ:ММ,ЧЧ:ММ - время отправки (можно указать несколько через запятую)
- КОЛ-ВО_ДНЕЙ - количество дней для отправки

Для удаления уведомления:
/delete UUID

Для просмотра ваших уведомлений:
/list`;

  await bot.sendMessage(chatId, message);
});

// Обработка команды /list
bot.onText(/\/list/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const notifications = await getUserNotifications(chatId);

    if (notifications.length === 0) {
      await bot.sendMessage(chatId, "У вас нет активных уведомлений");
      return;
    }

    let message = "Ваши активные уведомления:\n\n";

    for (const notification of notifications) {
      message += `ID: ${notification.id}\n`;
      message += `Сообщение: ${notification.message}\n`;
      message += `Время: ${notification.times.join(", ")}\n`;
      message += `Осталось дней: ${notification.days_left}\n\n`;
    }

    await bot.sendMessage(chatId, message);
  } catch (err) {
    console.error("Ошибка при получении списка уведомлений:", err);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при получении списка уведомлений"
    );
  }
});

// Обработка команды удаления уведомления
bot.onText(/\/delete (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[0];

  const result = parseDeleteCommand(text);

  if (!result.success) {
    await bot.sendMessage(chatId, result.error);
    return;
  }

  try {
    const deleted = await deleteNotification(result.id);

    if (deleted) {
      await bot.sendMessage(chatId, `Сообщение с uuid ${result.id} удалено`);
    } else {
      await bot.sendMessage(
        chatId,
        `Уведомление с uuid ${result.id} не найдено`
      );
    }
  } catch (err) {
    console.error("Ошибка при удалении уведомления:", err);
    await bot.sendMessage(chatId, "Произошла ошибка при удалении уведомления");
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

  const result = parseMessage(text);

  if (!result.success) {
    await bot.sendMessage(chatId, result.error);
    return;
  }

  try {
    const { id, message, times, days } = result.data;

    // Добавляем уведомление в базу данных
    await addNotification(id, chatId, message, times, days);

    // Отправляем подтверждение
    await bot.sendMessage(chatId, `Принято и ${id}`);
  } catch (err) {
    console.error("Ошибка при создании уведомления:", err);
    await bot.sendMessage(chatId, "Произошла ошибка при создании уведомления");
  }
});

console.log("Бот запущен!");

// Обработка остановки процесса
process.on("SIGINT", () => {
  bot.stopPolling();
  console.log("Бот остановлен");
  process.exit(0);
});
