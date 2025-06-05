const sqlite3 = require("sqlite3").verbose();
const config = require("../config");
const path = require("path");
const fs = require("fs");

const dbPath = path.resolve(config.DB_PATH);

// Функция для миграции базы данных
const migrateDatabase = () => {
  return new Promise((resolve, reject) => {
    console.log("Проверка и миграция базы данных...");

    // Подключаемся к базе данных
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Ошибка при подключении к базе данных:", err.message);
        reject(err);
        return;
      }

      db.serialize(() => {
        // Создаем таблицу, если она не существует
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
              reject(err);
              return;
            }

            // Проверяем, существует ли столбец days_of_week
            db.all("PRAGMA table_info(notifications)", (err, rows) => {
              if (err) {
                console.error(
                  "Ошибка при получении информации о таблице:",
                  err.message
                );
                reject(err);
                return;
              }

              // Проверяем наличие необходимых столбцов
              let hasDaysOfWeek = false;
              let hasTargetDate = false;

              for (const row of rows) {
                if (row.name === "days_of_week") {
                  hasDaysOfWeek = true;
                }
                if (row.name === "target_date") {
                  hasTargetDate = true;
                }
              }

              // Добавляем необходимые столбцы, если их нет
              const promises = [];

              // Если столбца days_of_week нет, добавляем его
              if (!hasDaysOfWeek) {
                promises.push(
                  new Promise((resolveColumn, rejectColumn) => {
                    console.log(
                      "Добавление столбца days_of_week в таблицу notifications..."
                    );
                    db.run(
                      "ALTER TABLE notifications ADD COLUMN days_of_week TEXT DEFAULT '[]'",
                      (err) => {
                        if (err) {
                          console.error(
                            "Ошибка при добавлении столбца days_of_week:",
                            err.message
                          );
                          rejectColumn(err);
                          return;
                        }
                        console.log(
                          "Столбец days_of_week успешно добавлен в таблицу notifications"
                        );
                        resolveColumn();
                      }
                    );
                  })
                );
              }

              // Если столбца target_date нет, добавляем его
              if (!hasTargetDate) {
                promises.push(
                  new Promise((resolveColumn, rejectColumn) => {
                    console.log(
                      "Добавление столбца target_date в таблицу notifications..."
                    );
                    db.run(
                      "ALTER TABLE notifications ADD COLUMN target_date TEXT",
                      (err) => {
                        if (err) {
                          console.error(
                            "Ошибка при добавлении столбца target_date:",
                            err.message
                          );
                          rejectColumn(err);
                          return;
                        }
                        console.log(
                          "Столбец target_date успешно добавлен в таблицу notifications"
                        );
                        resolveColumn();
                      }
                    );
                  })
                );
              }

              // Ожидаем завершения всех операций
              if (promises.length > 0) {
                Promise.all(promises)
                  .then(() => {
                    db.close();
                    resolve();
                  })
                  .catch((err) => {
                    db.close();
                    reject(err);
                  });
              } else {
                console.log(
                  "Все необходимые столбцы уже существуют в таблице notifications"
                );
                db.close();
                resolve();
              }
            });
          }
        );
      });
    });
  });
};

// Если файла базы данных не существует, создаем его
if (!fs.existsSync(dbPath)) {
  console.log(`База данных не найдена. Создаем новую базу данных: ${dbPath}`);
  fs.writeFileSync(dbPath, "");
}

// Миграция базы данных перед использованием
migrateDatabase()
  .then(() => {
    console.log("Миграция базы данных завершена успешно.");
  })
  .catch((err) => {
    console.error("Ошибка при миграции базы данных:", err);
    process.exit(1);
  });

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Ошибка при подключении к базе данных:", err.message);
  } else {
    console.log("Подключение к базе данных SQLite успешно установлено");
  }
});

// Добавить новое ежедневное уведомление
const addNotification = (
  id,
  userId,
  message,
  times,
  daysLeft,
  daysOfWeek = [],
  targetDate = null
) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, message, times, days_left, days_of_week, target_date, type) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 'daily')
    `);

    stmt.run(
      id,
      userId,
      message,
      JSON.stringify(times),
      daysLeft,
      JSON.stringify(daysOfWeek),
      targetDate,
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id,
            userId,
            message,
            times,
            daysLeft,
            daysOfWeek,
            targetDate,
            type: "daily",
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
          const result = rows.map((row) => {
            const notification = {
              ...row,
              times: JSON.parse(row.times),
            };

            // Проверка и добавление пустого массива, если нет days_of_week
            if (
              !row.hasOwnProperty("days_of_week") ||
              row.days_of_week === null
            ) {
              notification.days_of_week = [];
            } else {
              try {
                notification.days_of_week = JSON.parse(row.days_of_week);
              } catch (e) {
                notification.days_of_week = [];
              }
            }

            return notification;
          });

          resolve(result);
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
          const result = rows.map((row) => {
            const notification = {
              ...row,
              times: JSON.parse(row.times),
            };

            // Проверка и добавление пустого массива, если нет days_of_week
            if (
              !row.hasOwnProperty("days_of_week") ||
              row.days_of_week === null
            ) {
              notification.days_of_week = [];
            } else {
              try {
                notification.days_of_week = JSON.parse(row.days_of_week);
              } catch (e) {
                notification.days_of_week = [];
              }
            }

            return notification;
          });

          resolve(result);
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
          const result = rows.map((row) => {
            const notification = {
              ...row,
              times: JSON.parse(row.times),
            };

            // Проверка и добавление пустого массива, если нет days_of_week
            if (
              !row.hasOwnProperty("days_of_week") ||
              row.days_of_week === null
            ) {
              notification.days_of_week = [];
            } else {
              try {
                notification.days_of_week = JSON.parse(row.days_of_week);
              } catch (e) {
                notification.days_of_week = [];
              }
            }

            return notification;
          });

          resolve(result);
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
       WHERE type = 'daily' AND days_left > 0 AND (days_of_week IS NULL OR days_of_week = '[]')`,
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

// Очистка истекших уведомлений
const cleanupExpiredNotifications = () => {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM notifications 
       WHERE (type = 'daily' AND days_left <= 0 AND (days_of_week IS NULL OR days_of_week = '[]')) 
       OR (type = 'monthly' AND months_left <= 0)`,
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
  getAllNotifications,
  getAllDailyNotifications,
  getUserNotifications,
  deleteNotification,
  decrementDaysLeft,
  decrementMonthsLeft,
  cleanupExpiredNotifications,
};
