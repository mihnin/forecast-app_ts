from celery import Celery
import logging
import os
from app.core.config import settings
from app.core.queue import JobQueue
from app.services.forecasting.training import train_model
from app.services.forecasting.prediction import make_prediction

logger = logging.getLogger(__name__)

# Initialize Celery
celery_app = Celery('tasks')
celery_app.conf.broker_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
celery_app.conf.result_backend = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"

# Initialize queue
queue = JobQueue()

@celery_app.task(name="process_task")
def process_task(task_id: str):
    """
    Обрабатывает задачу из очереди
    
    Args:
        task_id: Идентификатор задачи
    """
    try:
        # Получаем информацию о задаче
        tasks = queue.get_all_tasks()
        task = next((t for t in tasks if t.get("task_id") == task_id), None)
        
        if not task:
            logger.error(f"Задача с ID {task_id} не найдена")
            return
        
        logger.info(f"Обработка задачи {task_id} (тип: {task.get('task_type')})")
        
        task_type = task.get("task_type")
        params = task.get("params", {})
        
        result = None
        
        # Выполняем задачу в зависимости от типа
        if task_type == "training":
            result = train_model(params)
        elif task_type == "prediction":
            result = make_prediction(params)
        elif task_type == "analysis":
            # Здесь будет функция анализа данных
            pass
        else:
            logger.error(f"Неизвестный тип задачи: {task_type}")
            queue.fail_task(task_id, f"Неизвестный тип задачи: {task_type}")
            return
        
        # Отмечаем задачу как выполненную
        queue.complete_task(task_id, result)
        logger.info(f"Задача {task_id} успешно выполнена")
    
    except Exception as e:
        logger.error(f"Ошибка при обработке задачи {task_id}: {str(e)}")
        queue.fail_task(task_id, str(e))


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


@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    """
    Настройка периодических задач
    """
    # Проверка очереди каждые 10 секунд
    sender.add_periodic_task(10.0, process_queue.s(), name='check_queue_every_10s')