/**
 * Вспомогательные функции для работы с датами и временем
 */

/**
 * Расчет относительного времени от базового времени
 * @param {Date} baseTime - Базовое время
 * @param {number} value - Значение (количество минут или часов)
 * @param {string} unit - Единица измерения ('minutes' или 'hours')
 * @returns {string} Результирующее время в формате ЧЧ:ММ
 */
const calculateRelativeTime = (baseTime, value, unit) => {
  const resultTime = new Date(baseTime);

  if (unit === "minutes") {
    resultTime.setMinutes(resultTime.getMinutes() + value);
  } else if (unit === "hours") {
    resultTime.setHours(resultTime.getHours() + value);
  }

  const hours = resultTime.getHours().toString().padStart(2, "0");
  const minutes = resultTime.getMinutes().toString().padStart(2, "0");

  return `${hours}:${minutes}`;
};

/**
 * Проверяет, является ли уведомление повторяющимся на основе текста
 * @param {string} text - Текст сообщения пользователя
 * @returns {boolean} true если уведомление повторяющееся, false в противном случае
 */
const isRecurringNotification = (text) => {
  const textLower = text.toLowerCase();

  // Специальная проверка для "каждый день" и похожих фраз
  if (
    textLower.includes("каждый день") ||
    textLower.includes("ежедневно") ||
    textLower.includes("каждые сутки") ||
    textLower.includes("ежесуточно") ||
    textLower.includes("день в день") ||
    textLower.includes("день за днем") ||
    textLower.includes("изо дня в день") ||
    textLower.includes("постоянно") ||
    textLower.includes("всегда")
  ) {
    return true;
  }

  return (
    textLower.includes("кажд") ||
    textLower.includes("еженедельн") ||
    textLower.includes("регулярн") ||
    textLower.includes("повтор") ||
    textLower.includes("по ") ||
    /\b(по|каждую|каждый|каждое)\s+(пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|сред|четверг|пятниц|суббот|воскресень)/i.test(
      textLower
    )
  );
};

/**
 * Проверяет, является ли уведомление однократным на определенный день недели
 * @param {string} text - Текст сообщения пользователя
 * @returns {boolean} true если это однократное уведомление, false в противном случае
 */
const isOneTimeWeekdayNotification = (text) => {
  const textLower = text.toLowerCase();
  return (
    /\b(в|во)\s+(пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|сред|четверг|пятниц|суббот|воскресень)\b/i.test(
      textLower
    ) && !isRecurringNotification(text)
  );
};

/**
 * Рассчитывает целевую дату для однократного уведомления
 * @param {Date} now - Текущая дата
 * @param {number} targetDayOfWeek - Целевой день недели (0-6)
 * @param {string} timeStr - Время уведомления в формате ЧЧ:ММ
 * @returns {Object} Объект с целевой датой и количеством дней до события
 */
const calculateTargetDate = (now, targetDayOfWeek, timeStr) => {
  const currentDayOfWeek = now.getDay();

  // Вычисляем количество дней до целевого дня недели
  let daysToAdd = (targetDayOfWeek - currentDayOfWeek + 7) % 7;

  // Если указанный день недели сегодня, проверяем, не прошло ли уже указанное время
  if (daysToAdd === 0) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    // Если текущее время позже указанного, переносим на следующую неделю
    if (
      currentHours > hours ||
      (currentHours === hours && currentMinutes >= minutes)
    ) {
      daysToAdd = 7;
    }
  }

  // Создаем дату для целевого дня недели
  const targetDateObj = new Date(now);
  targetDateObj.setDate(now.getDate() + daysToAdd);

  // Форматируем дату в YYYY-MM-DD
  const targetDate = targetDateObj.toISOString().split("T")[0];

  return { targetDate, daysToAdd };
};

/**
 * Преобразует код дня недели в число (0-6)
 * @param {string} dayCode - Код дня недели (пн, вт, ср и т.д.)
 * @returns {number} Числовой код дня недели (0-6)
 */
const dayCodeToNumber = (dayCode) => {
  const dayMap = {
    пн: 1,
    вт: 2,
    ср: 3,
    чт: 4,
    пт: 5,
    сб: 6,
    вс: 0,
  };
  return dayMap[dayCode];
};

/**
 * Преобразует числовой код дня недели в название
 * @param {number} dayNumber - Числовой код дня недели (0-6)
 * @param {boolean} inAccusative - Использовать винительный падеж (в пятницу вместо пятница)
 * @returns {string} Название дня недели
 */
const dayNumberToName = (dayNumber, inAccusative = false) => {
  const daysNamesNominative = {
    0: "воскресенье",
    1: "понедельник",
    2: "вторник",
    3: "среда",
    4: "четверг",
    5: "пятница",
    6: "суббота",
  };

  const daysNamesAccusative = {
    0: "воскресенье",
    1: "понедельник",
    2: "вторник",
    3: "среду",
    4: "четверг",
    5: "пятницу",
    6: "субботу",
  };

  return inAccusative
    ? daysNamesAccusative[dayNumber]
    : daysNamesNominative[dayNumber];
};

/**
 * Форматирует дату в читаемом виде (ДД.ММ.ГГГГ)
 * @param {string|Date} date - Дата в формате YYYY-MM-DD или объект Date
 * @returns {string} Отформатированная дата
 */
const formatDateForDisplay = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  return `${dateObj.getDate().toString().padStart(2, "0")}.${(
    dateObj.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}.${dateObj.getFullYear()}`;
};

/**
 * Ищет время в формате ЧЧ:ММ в тексте
 * @param {string} text - Текст для поиска времени
 * @returns {Array|null} Массив со временем или null, если время не найдено
 */
const findTimeInText = (text) => {
  // Проверяем формат ЧЧ:ММ
  const timePattern = /\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/;
  const timeMatch = text.match(timePattern);

  if (timeMatch) {
    return timeMatch;
  }

  // Проверяем формат, когда указано просто число (например, "в 13" или "в 22")
  const simpleTimePattern = /\b(?:в|к|около)\s+([01]?[0-9]|2[0-3])\b/i;
  const simpleTimeMatch = text.match(simpleTimePattern);

  if (simpleTimeMatch) {
    // Добавляем ":00" к найденному числу
    const hour = simpleTimeMatch[1].padStart(2, "0");
    return [`${hour}:00`];
  }

  // Проверяем формат, когда просто указано число с часами (например, "13 часов" или "22 часа")
  const hourPattern = /\b([01]?[0-9]|2[0-3])\s+(?:час(?:а|ов)?)\b/i;
  const hourMatch = text.match(hourPattern);

  if (hourMatch) {
    // Добавляем ":00" к найденному числу
    const hour = hourMatch[1].padStart(2, "0");
    return [`${hour}:00`];
  }

  return null;
};

module.exports = {
  calculateRelativeTime,
  isRecurringNotification,
  isOneTimeWeekdayNotification,
  calculateTargetDate,
  dayCodeToNumber,
  dayNumberToName,
  formatDateForDisplay,
  findTimeInText,
};
