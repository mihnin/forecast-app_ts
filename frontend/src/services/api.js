import axios from 'axios';

// Создаем экземпляр axios с базовыми настройками
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api/v1',  // Изменено с http://localhost:8000/api/v1
  headers: {
    'Content-Type': 'application/json',
  },
  // Добавляем настройки для CORS
  withCredentials: false,
});

// Настраиваем перехватчик для запросов
api.interceptors.request.use(
  config => {
    // Добавляем заголовки для всех запросов
    config.headers = {
      ...config.headers,
      'Accept': 'application/json',
    };
    
    // Если отправляем FormData, не устанавливаем Content-Type вручную
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  error => Promise.reject(error)
);

// Настраиваем перехватчик для обработки ошибок
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response) {
      console.error('Response error:', error.response.status, error.response.data);
      
      switch (error.response.status) {
        case 405:
          // Попытка повторить запрос с предварительным OPTIONS
          const { config } = error;
          try {
            await api.options(config.url);
            return await api(config);
          } catch (retryError) {
            console.error('Ошибка при повторной попытке запроса:', retryError);
          }
          break;
        default:
          break;
      }
    }
    return Promise.reject(error);
  }
);

// Сервис для работы с данными
export const dataService = {
  // Загрузка файла с данными
  uploadData: async (file, chunkSize = 100000) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Для FormData нужно использовать multipart/form-data
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: {
        chunk_size: chunkSize,
      },
      // Добавляем настройки для обработки timeout и повторных попыток
      timeout: 30000,
      retry: 3,
      retryDelay: 1000,
    };
    
    try {
      const response = await api.post('/data/upload', formData, config);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 405) {
        // Если получили 405, пробуем отправить предварительный OPTIONS запрос
        await api.options('/data/upload');
        // Повторяем основной запрос
        return (await api.post('/data/upload', formData, config)).data;
      }
      throw error;
    }
  },
  
  // Получение списка колонок датасета
  getColumns: async (datasetId) => {
    const response = await api.get(`/data/columns/${datasetId}`);
    return response.data;
  },
  
  // Получение предпросмотра данных
  getPreview: async (datasetId, rows = 10) => {
    const response = await api.get(`/data/preview/${datasetId}`, {
      params: { rows },
    });
    return response.data;
  },
  
  // Запуск анализа данных
  analyzeData: async (datasetId, columns, analysisType, params = {}) => {
    const response = await api.post('/data/analyze', {
      dataset_id: datasetId,
      columns,
      analysis_type: analysisType,
      params,
    });
    return response.data;
  },
};

// Сервис для работы с обучением моделей
export const trainingService = {
  // Запуск обучения модели
  trainModel: async (userId, params) => {
    const response = await api.post('/training/train', {
      user_id: userId,
      params,
    });
    return response.data;
  },
  
  // Получение результатов обучения
  getTrainingResult: async (taskId) => {
    const response = await api.get(`/training/result/${taskId}`);
    return response.data;
  },
  
  // Получение списка доступных моделей
  getAvailableModels: async () => {
    const response = await api.get('/training/models');
    return response.data;
  },
  
  // Получение списка обученных моделей
  getTrainedModels: async () => {
    // Новый метод для получения списка обученных моделей
    const response = await api.get('/training/models/trained');
    return response.data;
  },
};

// Сервис для работы с прогнозированием
export const predictionService = {
  // Запуск прогнозирования
  predict: async (userId, modelId, datasetId, predictionLength = null) => {
    const response = await api.post('/prediction/forecast', {
      user_id: userId,
      params: {
        model_id: modelId,
        dataset_id: datasetId,
        prediction_length: predictionLength,
      },
    });
    return response.data;
  },
  
  // Получение результатов прогнозирования
  getPredictionResult: async (taskId) => {
    const response = await api.get(`/prediction/result/${taskId}`);
    return response.data;
  },
  
  // Экспорт прогноза в различных форматах
  exportPrediction: async (taskId, format = 'json') => {
    const response = await api.get(`/prediction/export/${taskId}`, {
      params: { format },
      responseType: format === 'json' ? 'json' : 'blob',
    });
    
    if (format === 'json') {
      return response.data;
    } else {
      // Для Excel и CSV возвращаем Blob
      return response.data;
    }
  },
};

// Сервис для работы с очередью задач
export const queueService = {
  // Получение статуса задачи
  getTaskStatus: async (taskId) => {
    if (!taskId) return null;
    const response = await api.get(`/queue/status/${taskId}`);
    return response.data;
  },
  
  // Получение информации об очереди
  getQueueInfo: async () => {
    const response = await api.get('/queue/info');
    return response.data;
  },
  
  // Получение логов задачи
  getTaskLogs: async (taskId, limit = 100) => {
    const response = await api.get(`/queue/logs/${taskId}`, {
      params: { limit }
    });
    return response.data;
  },
  
  // Повторная попытка выполнения задачи
  retryTask: async (taskId) => {
    const response = await api.post(`/queue/retry/${taskId}`);
    return response.data;
  }
};

export default {
  dataService,
  trainingService,
  predictionService,
  queueService,
};