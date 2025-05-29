const cron = require("node-cron");
const {
  getAllNotifications,
  getAllDailyNotifications,
  getAllMonthlyNotifications,
  decrementDaysLeft,
  decrementMonthsLeft,
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

      // Текущий день месяца
      const currentDayOfMonth = moscowTime.getUTCDate();

      // Получаем все активные уведомления
      const notifications = await getAllNotifications();

      // Создаем массив уведомлений, которые нужно удалить после отправки
      const notificationsToDelete = [];

      // Создаем массив ID ежемесячных уведомлений, которые были обработаны в текущем месяце
      const processedMonthlyIds = [];

      // Отправляем уведомления, если текущее время совпадает с запланированным
      for (const notification of notifications) {
        // Проверяем каждое время для уведомления
        for (const time of notification.times) {
          // Если часы и минуты совпадают с текущим временем
          if (time === currentTime) {
            // Для ежедневных уведомлений
            if (notification.type === "daily") {
              try {
                await bot.sendMessage(
                  notification.user_id,
                  notification.message
                );
                console.log(
                  `Отправлено ежедневное уведомление: ${notification.id} пользователю ${notification.user_id}`
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
            // Для ежемесячных уведомлений
            else if (
              notification.type === "monthly" &&
              notification.day_of_month === currentDayOfMonth
            ) {
              try {
                await bot.sendMessage(
                  notification.user_id,
                  notification.message
                );
                console.log(
                  `Отправлено ежемесячное уведомление: ${notification.id} пользователю ${notification.user_id}`
                );

                // Добавляем ID в список обработанных ежемесячных уведомлений
                processedMonthlyIds.push(notification.id);

                // Если осталось 1 месяц, добавляем уведомление в список на удаление
                if (notification.months_left === 1) {
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

      // Уменьшаем количество оставшихся месяцев для обработанных ежемесячных уведомлений
      if (processedMonthlyIds.length > 0) {
        try {
          const updatedCount = await decrementMonthsLeft(processedMonthlyIds);
          console.log(`Обновлено ${updatedCount} ежемесячных уведомлений`);
        } catch (err) {
          console.error("Ошибка при обновлении ежемесячных уведомлений:", err);
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
        console.log(`Обновлено ${updatedCount} ежедневных уведомлений`);

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
