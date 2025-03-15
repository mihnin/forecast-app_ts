import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { queueService } from '../services/api';

// Хук для периодического опроса статуса задачи с расширенной информацией о прогрессе
export const useTaskStatus = (taskId, onComplete, onFail, onProgress) => {
  const queryClient = useQueryClient();
  const [lastProgress, setLastProgress] = useState(0);
  
  const { data, error, isLoading } = useQuery(
    ['taskStatus', taskId],
    () => queueService.getTaskStatus(taskId),
    {
      enabled: !!taskId,
      refetchInterval: (data) => {
        // Если задача завершена или завершилась с ошибкой, прекращаем опрос
        if (data?.status === 'completed' || data?.status === 'failed') {
          return false;
        }
        
        // Для выполняющихся задач опрашиваем чаще
        if (data?.status === 'executing') {
          return 1000; // Каждую секунду
        }
        
        // Для ожидающих задач достаточно реже
        return 3000; // Каждые 3 секунды
      },
      onSuccess: (data) => {
        // Отслеживаем изменение прогресса
        if (data.progress !== lastProgress) {
          setLastProgress(data.progress);
          if (onProgress) {
            onProgress(data);
          }
        }
        
        // Обработка завершения задачи
        if (data.status === 'completed' && onComplete) {
          onComplete(data);
        } else if (data.status === 'failed' && onFail) {
          onFail(data);
        }
      },
    }
  );

  // Функция для ручного обновления статуса
  const refreshStatus = () => {
    queryClient.invalidateQueries(['taskStatus', taskId]);
  };

  // Функция для повторной попытки выполнения задачи
  const retryTask = async () => {
    if (!taskId) return null;
    
    try {
      const response = await queueService.retryTask(taskId);
      queryClient.invalidateQueries(['taskStatus', taskId]);
      return response;
    } catch (error) {
      console.error("Ошибка при повторной попытке выполнения задачи:", error);
      return null;
    }
  };

  // Функция для получения логов задачи
  const getTaskLogs = async (limit = 100) => {
    if (!taskId) return [];
    
    try {
      return await queueService.getTaskLogs(taskId, limit);
    } catch (error) {
      console.error("Ошибка при получении логов задачи:", error);
      return [];
    }
  };

  return { 
    data, 
    error, 
    isLoading, 
    refreshStatus,
    retryTask,
    getTaskLogs
  };
};

// Хук для периодического опроса информации об очереди
export const useQueueInfo = () => {
  const { data, error, isLoading, refetch } = useQuery(
    'queueInfo',
    queueService.getQueueInfo,
    {
      refetchInterval: 5000, // Обновляем каждые 5 секунд
    }
  );

  return { 
    queueInfo: data, 
    error, 
    isLoading, 
    refetch 
  };
};

// Хук для получения информации о статусе очереди с возможностью обновления
export const useQueueStatus = () => {
  const [queueStatus, setQueueStatus] = useState({
    totalTasks: 0,
    pendingTasks: 0,
    executingTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageWaitingTime: null,
    averageExecutionTime: null
  });

  const { queueInfo, error, isLoading, refetch } = useQueueInfo();

  useEffect(() => {
    if (queueInfo) {
      setQueueStatus({
        totalTasks: queueInfo.total_tasks,
        pendingTasks: queueInfo.pending_tasks,
        executingTasks: queueInfo.executing_tasks,
        completedTasks: queueInfo.completed_tasks,
        failedTasks: queueInfo.failed_tasks,
        averageWaitingTime: queueInfo.average_waiting_time,
        averageExecutionTime: queueInfo.average_execution_time
      });
    }
  }, [queueInfo]);

  return { queueStatus, error, isLoading, refetch };
};