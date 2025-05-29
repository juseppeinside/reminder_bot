const sqlite3 = require("sqlite3").verbose();
const config = require("../config");
const path = require("path");

const dbPath = path.resolve(config.DB_PATH);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Ошибка при подключении к базе данных:", err.message);
  } else {
    console.log("Подключение к базе данных SQLite успешно установлено");

    // Создание таблицы для хранения уведомлений
    db.run(
      `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      times TEXT NOT NULL,
      days_left INTEGER,
      type TEXT NOT NULL DEFAULT 'daily',
      day_of_month INTEGER,
      months_left INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
      (err) => {
        if (err) {
          console.error("Ошибка при создании таблицы:", err.message);
        } else {
          console.log("Таблица уведомлений создана или уже существует");
        }
      }
    );
  }
});

// Добавить новое ежедневное уведомление
const addNotification = (id, userId, message, times, daysLeft) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, message, times, days_left, type) 
      VALUES (?, ?, ?, ?, ?, 'daily')
    `);

    stmt.run(
      id,
      userId,
      message,
      JSON.stringify(times),
      daysLeft,
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, userId, message, times, daysLeft, type: "daily" });
        }
      }
    );

    stmt.finalize();
  });
};

// Добавить новое ежемесячное уведомление
const addMonthlyNotification = (
  id,
  userId,
  message,
  times,
  monthsLeft,
  dayOfMonth
) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, message, times, months_left, day_of_month, type) 
      VALUES (?, ?, ?, ?, ?, ?, 'monthly')
    `);

    stmt.run(
      id,
      userId,
      message,
      JSON.stringify(times),
      monthsLeft,
      dayOfMonth,
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id,
            userId,
            message,
            times,
            monthsLeft,
            dayOfMonth,
            type: "monthly",
          });
        }
      }
    );

    stmt.finalize();
  });
};

// Получить все активные уведомления
const getAllNotifications = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM notifications WHERE 
       (type = 'daily' AND days_left > 0) OR 
       (type = 'monthly' AND months_left > 0)`,
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(
            rows.map((row) => ({
              ...row,
              times: JSON.parse(row.times),
            }))
          );
        }
      }
    );
  });
};

// Получить все активные ежедневные уведомления
const getAllDailyNotifications = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM notifications WHERE type = 'daily' AND days_left > 0`,
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(
            rows.map((row) => ({
              ...row,
              times: JSON.parse(row.times),
            }))
          );
        }
      }
    );
  });
};

// Получить все активные ежемесячные уведомления
const getAllMonthlyNotifications = () => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM notifications WHERE type = 'monthly' AND months_left > 0`,
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(
            rows.map((row) => ({
              ...row,
              times: JSON.parse(row.times),
            }))
          );
        }
      }
    );
  });
};

// Получить уведомления конкретного пользователя
const getUserNotifications = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM notifications WHERE user_id = ? AND 
       ((type = 'daily' AND days_left > 0) OR 
        (type = 'monthly' AND months_left > 0))`,
      [userId],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(
            rows.map((row) => ({
              ...row,
              times: JSON.parse(row.times),
            }))
          );
        }
      }
    );
  });
};

// Удалить уведомление по ID
const deleteNotification = (id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM notifications WHERE id = ?`, [id], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes > 0);
      }
    });
  });
};

// Уменьшить количество оставшихся дней для всех ежедневных уведомлений
const decrementDaysLeft = () => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE notifications SET days_left = days_left - 1 
       WHERE type = 'daily' AND days_left > 0`,
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
};

// Уменьшить количество оставшихся месяцев для всех ежемесячных уведомлений,
// которые уже отправлены в текущем месяце
const decrementMonthsLeft = (processedIds) => {
  if (!processedIds || processedIds.length === 0) {
    return Promise.resolve(0);
  }

  const placeholders = processedIds.map(() => "?").join(",");

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE notifications SET months_left = months_left - 1 
       WHERE type = 'monthly' AND months_left > 0 AND id IN (${placeholders})`,
      processedIds,
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
};

// Удалить уведомления с нулевым количеством оставшихся дней/месяцев
const cleanupExpiredNotifications = () => {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM notifications WHERE 
       (type = 'daily' AND days_left <= 0) OR 
       (type = 'monthly' AND months_left <= 0)`,
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
};

module.exports = {
  db,
  addNotification,
  addMonthlyNotification,
  getAllNotifications,
  getAllDailyNotifications,
  getAllMonthlyNotifications,
  getUserNotifications,
  deleteNotification,
  decrementDaysLeft,
  decrementMonthsLeft,
  cleanupExpiredNotifications,
};
