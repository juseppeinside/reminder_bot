require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const {
  parseMessage,
  parseMonthCommand,
  parseDeleteCommand,
} = require("./utils");
const {
  addNotification,
  addMonthlyNotification,
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

Чтобы создать ежедневное уведомление, отправьте сообщение в одном из форматов:

1. "Текст сообщения" "ЧЧ:ММ,ЧЧ:ММ" КОЛ-ВО_ДНЕЙ
2. «Текст сообщения» «ЧЧ:ММ,ЧЧ:ММ» КОЛ-ВО_ДНЕЙ
3. "Текст сообщения" ЧЧ:ММ КОЛ-ВО_ДНЕЙ
4. «Текст сообщения» ЧЧ:ММ КОЛ-ВО_ДНЕЙ

Вместо КОЛ-ВО_ДНЕЙ можно указать "infinity" для бесконечной отправки.

Чтобы создать ежемесячное уведомление, отправьте команду /month в одном из форматов:

1. /month "Текст сообщения" "ЧЧ:ММ,ЧЧ:ММ" КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА
2. /month «Текст сообщения» «ЧЧ:ММ,ЧЧ:ММ» КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА
3. /month "Текст сообщения" ЧЧ:ММ КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА
4. /month «Текст сообщения» ЧЧ:ММ КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА

Где ДЕНЬ_МЕСЯЦА - число от 1 до 28.
Вместо КОЛ-ВО_МЕСЯЦЕВ можно указать "infinity" для бесконечной отправки.

Примеры:
"Выпить воды" "12:00,16:00" 30
«Выпить воды» «12:00,16:00» 30
"Выпить воды" 12:00 30
«Выпить воды» 12:00 infinity
/month "Оплатить счета" 10:00 12 15
/month "Поздравить маму" "10:00,12:00" infinity 3

Для удаления уведомления используйте команду:
/delete UUID`;

  await bot.sendMessage(chatId, message);
});

// Обработка команды /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const message = `Форматы создания уведомления:

Ежедневные уведомления:
1. "Текст сообщения" "ЧЧ:ММ,ЧЧ:ММ" КОЛ-ВО_ДНЕЙ
2. «Текст сообщения» «ЧЧ:ММ,ЧЧ:ММ» КОЛ-ВО_ДНЕЙ
3. "Текст сообщения" ЧЧ:ММ КОЛ-ВО_ДНЕЙ
4. «Текст сообщения» ЧЧ:ММ КОЛ-ВО_ДНЕЙ

Ежемесячные уведомления:
1. /month "Текст сообщения" "ЧЧ:ММ,ЧЧ:ММ" КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА
2. /month «Текст сообщения» «ЧЧ:ММ,ЧЧ:ММ» КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА
3. /month "Текст сообщения" ЧЧ:ММ КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА
4. /month «Текст сообщения» ЧЧ:ММ КОЛ-ВО_МЕСЯЦЕВ ДЕНЬ_МЕСЯЦА

Где:
- Текст сообщения - сообщение, которое вы хотите получать
- ЧЧ:ММ - время отправки (можно указать несколько через запятую, если время в кавычках)
- КОЛ-ВО_ДНЕЙ/КОЛ-ВО_МЕСЯЦЕВ - количество дней/месяцев или "infinity" для бесконечной отправки
- ДЕНЬ_МЕСЯЦА - день месяца (1-28), в который нужно отправлять ежемесячное уведомление

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

      if (notification.type === "daily") {
        message += `Тип: Ежедневное\n`;
        message += `Осталось дней: ${
          notification.days_left === 36500
            ? "∞ (бесконечно)"
            : notification.days_left
        }\n\n`;
      } else if (notification.type === "monthly") {
        message += `Тип: Ежемесячное (${notification.day_of_month} число)\n`;
        message += `Осталось месяцев: ${
          notification.months_left === 36500 / 30
            ? "∞ (бесконечно)"
            : notification.months_left
        }\n\n`;
      }
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

// Обработка команды для создания ежемесячных уведомлений
bot.onText(/\/month.*/, async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  const result = parseMonthCommand(text);

  if (!result.success) {
    await bot.sendMessage(chatId, result.error);
    return;
  }

  try {
    const { id, message, times, months, dayOfMonth } = result.data;

    // Добавляем ежемесячное уведомление в базу данных
    await addMonthlyNotification(
      id,
      chatId,
      message,
      times,
      months,
      dayOfMonth
    );

    // Отправляем подтверждение
    await bot.sendMessage(chatId, `Принято UUID: ${id}`);
  } catch (err) {
    console.error("Ошибка при создании ежемесячного уведомления:", err);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при создании ежемесячного уведомления"
    );
  }
});

// Обработка обычных сообщений (создание ежедневных уведомлений)
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
    await bot.sendMessage(chatId, `Принято UUID: ${id}`);
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
