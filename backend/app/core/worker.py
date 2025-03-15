from celery import Celery
import logging
import os
import time
import json
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.queue import JobQueue
from app.services.forecasting.training import train_model
from app.services.forecasting.prediction import make_prediction

logger = logging.getLogger(__name__)

# Инициализация Celery
celery_app = Celery('tasks')
celery_app.conf.broker_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
celery_app.conf.result_backend = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"

# Настройка повторных попыток при ошибках
celery_app.conf.task_acks_late = True  # Подтверждать задачи только после успешного выполнения
celery_app.conf.task_reject_on_worker_lost = True  # Возвращать задачу в очередь при потере воркера
celery_app.conf.worker_prefetch_multiplier = 1  # Получать только одну задачу за раз

# Инициализация очереди
queue = JobQueue()

@celery_app.task(
    name="process_task",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3}
)
def process_task(self, task_id: str):
    """
    Обрабатывает задачу из очереди с механизмом повторных попыток
    
    Args:
        task_id: Идентификатор задачи
    """
    try:
        # Получаем информацию о задаче
        task = queue.get_task(task_id)
        
        if not task:
            logger.error(f"Задача с ID {task_id} не найдена")
            return
        
        logger.info(f"Обработка задачи {task_id} (тип: {task.get('task_type')})")
        queue.add_task_log(task_id, "INFO", f"Начало выполнения задачи (тип: {task.get('task_type')})")
        
        task_type = task.get("task_type")
        params = task.get("params", {})
        
        result = None
        
        # Устанавливаем время начала выполнения, если его еще нет
        if not task.get("start_time"):
            task["start_time"] = time.time()
            queue.redis.hset("tasks", task_id, json.dumps(task))
        
        # Обновляем прогресс до 10%
        queue.update_task_progress(task_id, 10, "Подготовка к выполнению")
        
        # Выполняем задачу в зависимости от типа
        if task_type == "training":
            # Обновляем статус и прогресс на каждом этапе
            queue.update_task_progress(task_id, 15, "Подготовка данных")
            queue.add_task_log(task_id, "INFO", "Подготовка данных для обучения")
            
            # Виртуальный прогресс, если обучение долгое
            start_time = time.time()
            
            # Запуск обучения с передачей функции обратного вызова для обновления прогресса
            def progress_callback(progress, stage=None):
                # Ограничиваем прогресс от 20% до 90%
                scaled_progress = int(20 + progress * 0.7)
                queue.update_task_progress(task_id, scaled_progress, stage)
                queue.add_task_log(task_id, "INFO", f"Обучение: {progress:.1f}% завершено, этап: {stage or 'основной'}")
            
            result = train_model(params, progress_callback=progress_callback)
            
            # Обновляем прогресс
            queue.update_task_progress(task_id, 95, "Сохранение результатов")
            queue.add_task_log(task_id, "INFO", "Сохранение результатов обучения")
            
        elif task_type == "prediction":
            queue.update_task_progress(task_id, 20, "Загрузка данных")
            queue.add_task_log(task_id, "INFO", "Загрузка данных для прогнозирования")
            
            queue.update_task_progress(task_id, 30, "Загрузка модели")
            queue.add_task_log(task_id, "INFO", f"Загрузка модели {params.get('model_id', 'не указана')}")
            
            # Запуск прогнозирования
            result = make_prediction(params)
            
            queue.update_task_progress(task_id, 90, "Обработка результатов")
            queue.add_task_log(task_id, "INFO", "Прогнозирование успешно выполнено")
            
        elif task_type == "analysis":
            # Будущая функциональность для анализа данных
            queue.update_task_progress(task_id, 20, "Анализ данных")
            queue.add_task_log(task_id, "INFO", "Начало анализа данных")
            
            # TODO: Реализовать анализ данных
            
            queue.update_task_progress(task_id, 90, "Формирование отчета")
            queue.add_task_log(task_id, "INFO", "Формирование отчета анализа")
            
        else:
            error_msg = f"Неизвестный тип задачи: {task_type}"
            logger.error(error_msg)
            queue.add_task_log(task_id, "ERROR", error_msg)
            queue.fail_task(task_id, error_msg)
            return
        
        # Отмечаем задачу как выполненную
        queue.complete_task(task_id, result)
        queue.add_task_log(task_id, "INFO", "Задача успешно выполнена")
        logger.info(f"Задача {task_id} успешно выполнена")
    
    except Exception as e:
        error_msg = f"Ошибка при обработке задачи {task_id}: {str(e)}"
        logger.error(error_msg)
        queue.add_task_log(task_id, "ERROR", error_msg)
        queue.fail_task(task_id, str(e))
        # Генерируем исключение для повторной попытки через Celery
        raise self.retry(exc=e)

@celery_app.task(name="process_queue")
def process_queue():
    """
    Проверяет очередь и запускает обработку задач
    """
    try:
        # Получаем следующую задачу
        task = queue.get_next_task()
        
        if task:
            task_id = task.get("task_id")
            logger.info(f"Запуск обработки задачи {task_id}")
            
            # Запускаем обработку задачи
            process_task.delay(task_id)
    
    except Exception as e:
        logger.error(f"Ошибка при проверке очереди: {str(e)}")


@celery_app.task(name="cleanup_old_tasks")
def cleanup_old_tasks():
    """
    Очистка старых задач из системы (старше 30 дней)
    """
    try:
        all_tasks = queue.get_all_tasks()
        current_time = time.time()
        cleanup_threshold = current_time - (30 * 24 * 3600)  # 30 дней
        
        deleted_count = 0
        for task in all_tasks:
            created_at = task.get("created_at", 0)
            if created_at < cleanup_threshold and task.get("status") in ["completed", "failed"]:
                # Удаляем задачу из Redis
                queue.redis.hdel("tasks", task["task_id"])
                # Удаляем логи задачи
                queue.redis.delete(f"task_log:{task['task_id']}")
                deleted_count += 1
        
        if deleted_count > 0:
            logger.info(f"Очищено {deleted_count} старых задач")
    
    except Exception as e:
        logger.error(f"Ошибка при очистке старых задач: {str(e)}")


@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    """
    Настройка периодических задач
    """
    # Проверка очереди каждые 10 секунд
    sender.add_periodic_task(10.0, process_queue.s(), name='check_queue_every_10s')
    
    # Очистка старых задач раз в день
    sender.add_periodic_task(
        86400.0,  # 24 часа
        cleanup_old_tasks.s(),
        name='cleanup_old_tasks_daily'
    )