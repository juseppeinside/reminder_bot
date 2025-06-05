module.exports = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  GIGACHAT_CLIENT_ID: process.env.GIGACHAT_CLIENT_ID,
  GIGACHAT_CLIENT_SECRET: process.env.GIGACHAT_CLIENT_SECRET,
  GIGACHAT_SCOPE: process.env.GIGACHAT_SCOPE,
  DB_PATH: "notifications.db",
  TIMEZONE: "Europe/Moscow", // UTC+3
  GIGACHAT_API_KEY:
    process.env.GIGACHAT_API_KEY || "your_gigachat_api_key_here",
  ADMIN_USER_ID: process.env.ADMIN_USER_ID || "", // ID администратора
};
