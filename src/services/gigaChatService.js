/**
 * Сервис для работы с API GigaChat
 */
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const config = require("../../config");

/**
 * Получает токен доступа к API GigaChat
 * @returns {Promise<string>} Токен доступа
 */
const getGigaChatToken = async () => {
  const clientId = config.GIGACHAT_CLIENT_ID;
  const clientSecret = config.GIGACHAT_CLIENT_SECRET;

  // Формируем данные в формате x-www-form-urlencoded
  const formData = new URLSearchParams();
  formData.append("scope", config.GIGACHAT_SCOPE || "GIGACHAT_API_PERS");

  // Генерируем уникальный идентификатор запроса
  const rqUID = uuidv4();

  try {
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
      httpsAgent: new (require("https").Agent)({
        rejectUnauthorized: false, // Для обхода проблемы с самоподписанным сертификатом
      }),
    });

    return authResponse.data.access_token;
  } catch (error) {
    console.error("Ошибка при получении токена GigaChat:", error.message);
    throw error;
  }
};

/**
 * Отправляет запрос к API GigaChat
 * @param {string} accessToken - Токен доступа
 * @param {string} prompt - Системный промпт
 * @param {string} userMessage - Сообщение пользователя
 * @returns {Promise<string>} Ответ нейросети
 */
const sendGigaChatRequest = async (accessToken, prompt, userMessage) => {
  try {
    const chatResponse = await axios({
      method: "post",
      url: "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        model: "GigaChat",
        messages: [
          {
            role: "system",
            content: prompt,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
        n: 1,
        stream: false,
        top_p: 0.95,
      },
      httpsAgent: new (require("https").Agent)({
        rejectUnauthorized: false, // Для обхода проблемы с самоподписанным сертификатом
      }),
    });

    return chatResponse.data.choices[0].message.content;
  } catch (error) {
    console.error("Ошибка при запросе к API GigaChat:", error.message);
    throw error;
  }
};

/**
 * Выполняет полный цикл запроса к GigaChat
 * @param {string} prompt - Системный промпт
 * @param {string} userMessage - Сообщение пользователя
 * @returns {Promise<string>} Ответ нейросети
 */
const processGigaChatRequest = async (prompt, userMessage) => {
  try {
    const accessToken = await getGigaChatToken();
    const response = await sendGigaChatRequest(
      accessToken,
      prompt,
      userMessage
    );
    return response;
  } catch (error) {
    console.error("Ошибка при обработке запроса к GigaChat:", error);
    throw error;
  }
};

module.exports = {
  getGigaChatToken,
  sendGigaChatRequest,
  processGigaChatRequest,
};
