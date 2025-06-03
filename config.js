module.exports = {
  TELEGRAM_BOT_TOKEN:
    process.env.TELEGRAM_BOT_TOKEN || "your_telegram_bot_token_here",
  DB_PATH: "./notifications.db",
  TIMEZONE: "Europe/Moscow", // UTC+3
  GIGACHAT_API_KEY:
    process.env.GIGACHAT_API_KEY || "your_gigachat_api_key_here",
  GIGACHAT_CLIENT_ID: process.env.GIGACHAT_CLIENT_ID || "your_client_id_here",
  GIGACHAT_CLIENT_SECRET:
    process.env.GIGACHAT_CLIENT_SECRET || "your_client_secret_here",
  GIGACHAT_SCOPE: process.env.GIGACHAT_SCOPE || "GIGACHAT_API_PERS",
};
