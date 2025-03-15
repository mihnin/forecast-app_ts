import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { queueService } from '../services/api';

// Хук для периодического опроса статуса задачи
export const useTaskStatus = (taskId, onComplete, onFail) => {
  const queryClient = useQueryClient();
  
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
        // Иначе проверяем каждые 2 секунды
        return 2000;
      },
      onSuccess: (data) => {
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

  return { data, error, isLoading, refreshStatus };
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
    failedTasks: 0
  });

  const { queueInfo, error, isLoading, refetch } = useQueueInfo();

  useEffect(() => {
    if (queueInfo) {
      setQueueStatus({
        totalTasks: queueInfo.total_tasks,
        pendingTasks: queueInfo.pending_tasks,
        executingTasks: queueInfo.executing_tasks,
        completedTasks: queueInfo.completed_tasks,
        failedTasks: queueInfo.failed_tasks
      });
    }
  }, [queueInfo]);

  return { queueStatus, error, isLoading, refetch };
};