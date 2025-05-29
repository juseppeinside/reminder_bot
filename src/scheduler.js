const cron = require("node-cron");
const {
  getAllNotifications,
  decrementDaysLeft,
  cleanupExpiredNotifications,
  deleteNotification,
} = require("./db");
const config = require("../config");

// Инициализация планировщика
const initScheduler = (bot) => {
  // Проверка уведомлений каждую минуту
  cron.schedule("* * * * *", async () => {
    try {
      // Получаем текущее время в МСК (UTC+3)
      const now = new Date();
      const moscowTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // UTC+3
      const hours = moscowTime.getUTCHours();
      const minutes = moscowTime.getUTCMinutes();
      const currentTime = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;

      // Получаем все активные уведомления
      const notifications = await getAllNotifications();

      // Создаем массив уведомлений, которые нужно удалить после отправки
      const notificationsToDelete = [];

      // Отправляем уведомления, если текущее время совпадает с запланированным
      for (const notification of notifications) {
        // Проверяем каждое время для уведомления
        for (const time of notification.times) {
          // Если часы и минуты совпадают с текущим временем
          if (time === currentTime) {
            try {
              await bot.sendMessage(notification.user_id, notification.message);
              console.log(
                `Отправлено уведомление: ${notification.id} пользователю ${notification.user_id}`
              );

              // Если осталось 1 день, добавляем уведомление в список на удаление
              if (notification.days_left === 1) {
                notificationsToDelete.push(notification.id);
              }
            } catch (err) {
              console.error(
                `Ошибка при отправке уведомления ${notification.id}:`,
                err.message
              );
            }
          }
        }
      }

      // Удаляем уведомления, которые уже выполнили свою последнюю отправку
      for (const id of notificationsToDelete) {
        try {
          await deleteNotification(id);
          console.log(`Удалено уведомление ${id} после последней отправки`);
        } catch (err) {
          console.error(`Ошибка при удалении уведомления ${id}:`, err.message);
        }
      }
    } catch (err) {
      console.error("Ошибка при проверке уведомлений:", err);
    }
  });

  // Ежедневное уменьшение оставшихся дней в полночь по МСК
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        console.log("Обновление оставшихся дней для уведомлений...");
        const updatedCount = await decrementDaysLeft();
        console.log(`Обновлено ${updatedCount} уведомлений`);

        // Удаление истекших уведомлений
        const deletedCount = await cleanupExpiredNotifications();
        console.log(`Удалено ${deletedCount} истекших уведомлений`);
      } catch (err) {
        console.error("Ошибка при обновлении оставшихся дней:", err);
      }
    },
    {
      timezone: config.TIMEZONE,
    }
  );

  console.log("Планировщик уведомлений запущен");
};

module.exports = { initScheduler };
