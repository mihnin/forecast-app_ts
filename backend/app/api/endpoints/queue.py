from fastapi import APIRouter, Depends, HTTPException, Query, Path
from typing import List, Optional
import logging
from app.models.queue import TaskStatus, QueueInfo, TaskLog
from app.core.queue import JobQueue

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/status/{task_id}", response_model=TaskStatus)
async def get_task_status(
    task_id: str,
    queue: JobQueue = Depends()
):
    """
    Получение статуса задачи по ID
    """
    try:
        # Получаем информацию о задаче напрямую через новый метод
        task = queue.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Задача с ID {task_id} не найдена")
        
        # Получаем позицию в очереди
        position = queue.get_position(task_id)
        
        # Формируем ответ с учетом новых полей
        return TaskStatus(
            task_id=task_id,
            status=task["status"],
            position=position,
            progress=task.get("progress", 0),
            created_at=task["created_at"],
            updated_at=task["updated_at"],
            estimated_end_time=task.get("estimated_end_time"),
            result=task.get("result"),
            error=task.get("error"),
            stage=task.get("stage"),
            retry_count=task.get("retry_count", 0)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении статуса задачи: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении статуса задачи: {str(e)}")


@router.get("/info", response_model=QueueInfo)
async def get_queue_info(
    queue: JobQueue = Depends()
):
    """
    Получение информации об очереди задач
    """
    try:
        # Используем новый метод для получения статистики очереди
        stats = queue.get_queue_stats()
        
        # Получаем все задачи
        tasks = queue.get_all_tasks()
        
        # Преобразуем задачи в формат ответа
        task_statuses = []
        for task in tasks:
            position = queue.get_position(task["task_id"])
            task_statuses.append(TaskStatus(
                task_id=task["task_id"],
                status=task["status"],
                position=position,
                progress=task.get("progress", 0),
                created_at=task["created_at"],
                updated_at=task["updated_at"],
                estimated_end_time=task.get("estimated_end_time"),
                result=task.get("result"),
                error=task.get("error"),
                stage=task.get("stage"),
                retry_count=task.get("retry_count", 0)
            ))
        
        # Сортируем задачи по времени создания (сначала новые)
        task_statuses.sort(key=lambda x: x.created_at, reverse=True)
        
        return QueueInfo(
            total_tasks=stats["total_tasks"],
            pending_tasks=stats["pending_tasks"],
            executing_tasks=stats["executing_tasks"],
            completed_tasks=stats["completed_tasks"],
            failed_tasks=stats["failed_tasks"],
            average_waiting_time=stats.get("average_waiting_time"),
            average_execution_time=stats.get("average_execution_time"),
            tasks=task_statuses
        )
    
    except Exception as e:
        logger.error(f"Ошибка при получении информации об очереди: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении информации об очереди: {str(e)}")


@router.get("/logs/{task_id}", response_model=List[TaskLog])
async def get_task_logs(
    task_id: str,
    limit: Optional[int] = Query(100, description="Максимальное количество записей"),
    queue: JobQueue = Depends()
):
    """
    Получение логов задачи
    """
    try:
        # Проверяем существование задачи
        task = queue.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Задача с ID {task_id} не найдена")
        
        # Получаем логи задачи
        logs = queue.get_task_logs(task_id)
        
        # Лимитируем количество записей и сортируем по времени (сначала новые)
        logs.sort(key=lambda x: x["timestamp"], reverse=True)
        
        if limit:
            logs = logs[:limit]
        
        # Преобразуем логи в формат ответа
        response = []
        for log in logs:
            response.append(TaskLog(
                task_id=task_id,
                timestamp=log["timestamp"],
                level=log["level"],
                message=log["message"],
                details=log.get("details")
            ))
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении логов задачи: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении логов задачи: {str(e)}")


@router.post("/retry/{task_id}", response_model=TaskStatus)
async def retry_failed_task(
    task_id: str,
    queue: JobQueue = Depends()
):
    """
    Повторная попытка выполнения неудавшейся задачи
    """
    try:
        # Проверяем существование задачи
        task = queue.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Задача с ID {task_id} не найдена")
        
        # Проверяем, что задача завершилась с ошибкой
        if task["status"] != "failed":
            raise HTTPException(status_code=400, detail=f"Задача с ID {task_id} не является неудавшейся")
        
        # Добавляем задачу в очередь для повторного выполнения
        success = queue.retry_task(task_id)
        
        if not success:
            raise HTTPException(status_code=400, detail=f"Не удалось добавить задачу с ID {task_id} для повторного выполнения")
        
        # Получаем обновленный статус задачи
        updated_task = queue.get_task(task_id)
        position = queue.get_position(task_id)
        
        # Формируем ответ
        return TaskStatus(
            task_id=task_id,
            status=updated_task["status"],
            position=position,
            progress=updated_task.get("progress", 0),
            created_at=updated_task["created_at"],
            updated_at=updated_task["updated_at"],
            estimated_end_time=updated_task.get("estimated_end_time"),
            result=updated_task.get("result"),
            error=updated_task.get("error"),
            stage=updated_task.get("stage"),
            retry_count=updated_task.get("retry_count", 0)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при повторном добавлении задачи: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при повторном добавлении задачи: {str(e)}")