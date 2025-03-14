from fastapi import APIRouter, Depends, HTTPException
from typing import List
import logging
from app.models.queue import TaskStatus, QueueInfo
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
        # Получаем информацию о задаче
        tasks = queue.get_all_tasks()
        task = next((t for t in tasks if t.get("task_id") == task_id), None)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Задача с ID {task_id} не найдена")
        
        # Получаем позицию в очереди
        position = queue.get_position(task_id)
        
        # Формируем ответ
        return TaskStatus(
            task_id=task_id,
            status=task["status"],
            position=position,
            created_at=task["created_at"],
            updated_at=task["updated_at"],
            result=task.get("result"),
            error=task.get("error")
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
        # Получаем все задачи
        tasks = queue.get_all_tasks()
        
        # Считаем статистику
        total_tasks = len(tasks)
        pending_tasks = sum(1 for t in tasks if t["status"] == "pending")
        executing_tasks = sum(1 for t in tasks if t["status"] == "executing")
        completed_tasks = sum(1 for t in tasks if t["status"] == "completed")
        failed_tasks = sum(1 for t in tasks if t["status"] == "failed")
        
        # Преобразуем задачи в формат ответа
        task_statuses = []
        for task in tasks:
            position = queue.get_position(task["task_id"])
            task_statuses.append(TaskStatus(
                task_id=task["task_id"],
                status=task["status"],
                position=position,
                created_at=task["created_at"],
                updated_at=task["updated_at"],
                result=task.get("result"),
                error=task.get("error")
            ))
        
        # Сортируем задачи по времени создания (сначала новые)
        task_statuses.sort(key=lambda x: x.created_at, reverse=True)
        
        return QueueInfo(
            total_tasks=total_tasks,
            pending_tasks=pending_tasks,
            executing_tasks=executing_tasks,
            completed_tasks=completed_tasks,
            failed_tasks=failed_tasks,
            tasks=task_statuses
        )
    
    except Exception as e:
        logger.error(f"Ошибка при получении информации об очереди: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении информации об очереди: {str(e)}")