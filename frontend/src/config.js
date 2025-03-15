/**
 * Конфигурация для фронтенда
 */

// URL бэкенда API
export const API_URL = process.env.REACT_APP_API_URL || '';

// Настройки запросов по умолчанию
export const DEFAULT_SETTINGS = {
  // Таймаут запроса в миллисекундах
  REQUEST_TIMEOUT: 30000,
  
  // Максимальное число повторных попыток при ошибке
  MAX_RETRY_COUNT: 3,
  
  // Задержка между повторными попытками в миллисекундах
  RETRY_DELAY: 1000
}; 