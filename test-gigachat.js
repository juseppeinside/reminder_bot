require("dotenv").config();
const axios = require("axios");
const https = require("https");
const { v4: uuidv4 } = require("uuid");

async function testGigaChatAuth() {
  try {
    console.log("Начинаю тест авторизации GigaChat API...");

    // Получаем учетные данные из .env файла
    const clientId = process.env.GIGACHAT_CLIENT_ID;
    const clientSecret = process.env.GIGACHAT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error(
        "Ошибка: Не указаны GIGACHAT_CLIENT_ID или GIGACHAT_CLIENT_SECRET в .env файле"
      );
      return;
    }

    console.log("Client ID:", clientId);
    console.log(
      "Client Secret (первые 4 символа):",
      clientSecret.substring(0, 4) + "..."
    );

    // Формируем уникальный идентификатор запроса
    const rqUID = uuidv4();

    console.log("Используем RqUID:", rqUID);

    // Отправляем запрос на получение токена с использованием client_id и client_secret в заголовке
    console.log("Отправляю запрос на авторизацию...");

    // Обратите внимание, что мы отправляем как форму, а не как JSON
    const formData = new URLSearchParams();
    formData.append("scope", "GIGACHAT_API_PERS");

    const authResponse = await axios({
      method: "post",
      url: "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        RqUID: rqUID,
        Authorization: `Basic ${Buffer.from(
          clientId + ":" + clientSecret
        ).toString("base64")}`,
      },
      data: formData,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    // Выводим результат
    console.log("Успешно получен токен:", authResponse.data);

    // Теперь проверим запрос к API
    console.log("Отправляю тестовый запрос к GigaChat API...");

    const chatResponse = await axios({
      method: "post",
      url: "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authResponse.data.access_token}`,
      },
      data: {
        model: "GigaChat",
        messages: [
          {
            role: "user",
            content: "Привет! Как дела?",
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    console.log("Успешно получен ответ от GigaChat API!");
    console.log("Ответ:", chatResponse.data.choices[0].message.content);
  } catch (error) {
    console.error("Ошибка при тестировании GigaChat API:");

    if (error.response) {
      // Ответ был получен, но с ошибкой
      console.error("Статус ответа:", error.response.status);
      console.error("Данные ответа:", error.response.data);
      console.error(
        "Заголовки ответа:",
        JSON.stringify(error.response.headers, null, 2)
      );
    } else if (error.request) {
      // Запрос был отправлен, но ответ не получен
      console.error(
        "Запрос был отправлен, но ответ не получен:",
        error.request
      );
    } else {
      // Произошла ошибка при настройке запроса
      console.error("Ошибка:", error.message);
    }
  }
}

// Запускаем тест
testGigaChatAuth();
