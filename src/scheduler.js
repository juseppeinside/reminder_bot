const cron = require("node-cron");
const {
  getAllNotifications,
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

      // Текущий день недели (0 - воскресенье, 1 - понедельник, и т.д.)
      const currentDayOfWeek = moscowTime.getUTCDay();

      // Текущая дата в формате YYYY-MM-DD
      const currentDate = moscowTime.toISOString().split("T")[0];

      // Получаем все активные уведомления
      const notifications = await getAllNotifications();

      // Создаем массив уведомлений, которые нужно удалить после отправки
      const notificationsToDelete = [];

      // Создаем массив ID ежемесячных уведомлений, которые были обработаны в текущем месяце
      const processedMonthlyIds = [];

      // Создаем объект для хранения информации о завершающихся уведомлениях для каждого пользователя
      const expiringNotifications = {};

      // Отправляем уведомления, если текущее время совпадает с запланированным
      for (const notification of notifications) {
        // Проверяем каждое время для уведомления
        for (const time of notification.times) {
          // Если часы и минуты совпадают с текущим временем
          if (time === currentTime) {
            // Для ежедневных уведомлений
            if (notification.type === "daily") {
              // Проверяем, если у уведомления задана конкретная дата
              if (notification.target_date) {
                // Если дата уведомления не соответствует текущей дате, пропускаем
                if (notification.target_date !== currentDate) {
                  continue;
                }
              }
              // Проверяем, если у уведомления заданы дни недели
              else if (
                notification.days_of_week &&
                notification.days_of_week.length > 0
              ) {
                // Проверяем, является ли текущий день одним из дней для отправки
                if (!notification.days_of_week.includes(currentDayOfWeek)) {
                  // Если текущий день не входит в список дней для отправки, пропускаем
                  continue;
                }
              }

              try {
                await bot.sendMessage(
                  notification.user_id,
                  `⏰ ${notification.message}`
                );
                console.log(
                  `✅ Отправлено ежедневное уведомление: ${notification.id} пользователю ${notification.user_id}`
                );

                // Если задана конкретная дата (однократное уведомление), добавляем в список на удаление
                if (notification.target_date) {
                  notificationsToDelete.push(notification.id);

                  // Запоминаем уведомление для отправки сообщения о завершении
                  if (!expiringNotifications[notification.user_id]) {
                    expiringNotifications[notification.user_id] = [];
                  }
                  expiringNotifications[notification.user_id].push({
                    message: notification.message,
                    type: "daily",
                  });
                }
                // Если осталось 1 день и нет дней недели, добавляем уведомление в список на удаление
                else if (
                  notification.days_left === 1 &&
                  (!notification.days_of_week ||
                    notification.days_of_week.length === 0)
                ) {
                  notificationsToDelete.push(notification.id);

                  // Запоминаем уведомление для отправки сообщения о завершении
                  if (!expiringNotifications[notification.user_id]) {
                    expiringNotifications[notification.user_id] = [];
                  }
                  expiringNotifications[notification.user_id].push({
                    message: notification.message,
                    type: "daily",
                  });
                }
              } catch (err) {
                console.error(
                  `❌ Ошибка при отправке уведомления ${notification.id}:`,
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
                  `📅 ${notification.message}`
                );
                console.log(
                  `✅ Отправлено ежемесячное уведомление: ${notification.id} пользователю ${notification.user_id}`
                );

                // Добавляем ID в список обработанных ежемесячных уведомлений
                processedMonthlyIds.push(notification.id);

                // Если осталось 1 месяц, добавляем уведомление в список на удаление и запоминаем для уведомления
                if (notification.months_left === 1) {
                  notificationsToDelete.push(notification.id);

                  // Запоминаем уведомление для отправки сообщения о завершении
                  if (!expiringNotifications[notification.user_id]) {
                    expiringNotifications[notification.user_id] = [];
                  }
                  expiringNotifications[notification.user_id].push({
                    message: notification.message,
                    type: "monthly",
                  });
                }
              } catch (err) {
                console.error(
                  `❌ Ошибка при отправке уведомления ${notification.id}:`,
                  err.message
                );
              }
            }
          }
        }
      }

      // Отправляем уведомления о завершении срока действия
      for (const userId in expiringNotifications) {
        if (expiringNotifications.hasOwnProperty(userId)) {
          const userExpiredNotifications = expiringNotifications[userId];

          for (const notification of userExpiredNotifications) {
            try {
              const typeEmoji = notification.type === "daily" ? "⏰" : "📅";
              await bot.sendMessage(
                userId,
                `${typeEmoji} Уведомление "${notification.message}" подошло к концу 🔚\n\nСоздайте новое уведомление, если хотите продолжать получать эти напоминания.`
              );
              console.log(
                `📢 Отправлено уведомление о завершении для пользователя ${userId}`
              );
            } catch (err) {
              console.error(
                `❌ Ошибка при отправке уведомления о завершении:`,
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
          console.log(`🗑️ Удалено уведомление ${id} после последней отправки`);
        } catch (err) {
          console.error(
            `❌ Ошибка при удалении уведомления ${id}:`,
            err.message
          );
        }
      }

      // Уменьшаем количество оставшихся месяцев для обработанных ежемесячных уведомлений
      if (processedMonthlyIds.length > 0) {
        try {
          const updatedCount = await decrementMonthsLeft(processedMonthlyIds);
          console.log(`📊 Обновлено ${updatedCount} ежемесячных уведомлений`);
        } catch (err) {
          console.error(
            "❌ Ошибка при обновлении ежемесячных уведомлений:",
            err
          );
        }
      }
    } catch (err) {
      console.error("❌ Ошибка при проверке уведомлений:", err);
    }
  });

  // Ежедневное уменьшение оставшихся дней в полночь по МСК
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        console.log("🔄 Обновление оставшихся дней для уведомлений...");
        const updatedCount = await decrementDaysLeft();
        console.log(`📊 Обновлено ${updatedCount} ежедневных уведомлений`);

        // Удаление истекших уведомлений
        const deletedCount = await cleanupExpiredNotifications();
        console.log(`🗑️ Удалено ${deletedCount} истекших уведомлений`);
      } catch (err) {
        console.error("❌ Ошибка при обновлении оставшихся дней:", err);
      }
    },
    {
      timezone: config.TIMEZONE,
    }
  );

  console.log("🚀 Планировщик уведомлений запущен");
};

module.exports = { initScheduler };
