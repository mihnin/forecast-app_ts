import json
import time
from typing import Dict, List, Any, Optional, Union
import aioredis
from celery import Celery
import uuid
import logging

logger = logging.getLogger(__name__)

class JobQueue:
    """
    Queue system for managing jobs to prevent server overload
    """
    def __init__(self):
        """
        Initialize the job queue with Redis connection
        """
        self.redis = None
        self.celery = Celery('tasks', broker='redis://redis:6379/0')

    async def initialize(self):
        """
        Асинхронная инициализация очереди при запуске приложения
        """
        try:
            # Initialize Redis connection
            self.redis = await aioredis.create_redis_pool('redis://redis:6379/0')
            await self.redis.ping()
            logger.info("Successfully initialized connection to Redis")
            
            # Очищаем устаревшие флаги выполнения
            executing_keys = await self.redis.keys("executing:*")
            if executing_keys:
                await self.redis.delete(*executing_keys)
                logger.info(f"Cleared {len(executing_keys)} stale execution flags")
                
        except Exception as e:
            logger.error(f"Failed to initialize queue: {str(e)}")
            raise
    
    def add_task(self, user_id: str, task_type: str, params: Dict[str, Any]) -> str:
        """
        Add a new task to the queue and return its ID
        
        Args:
            user_id: Unique identifier for the user
            task_type: Type of task (e.g., 'training', 'prediction')
            params: Parameters for the task
            
        Returns:
            task_id: Unique ID for the task
        """
        task_id = str(uuid.uuid4())
        
        task_data = {
            "task_id": task_id,
            "user_id": user_id,
            "task_type": task_type,
            "params": params,
            "status": "pending",
            "created_at": time.time(),
            "updated_at": time.time(),
            "position": self._get_queue_length() + 1
        }
        
        # Store task in Redis
        self.redis.hset("tasks", task_id, json.dumps(task_data))
        # Add to queue
        self.redis.rpush("task_queue", task_id)
        
        logger.info(f"Task {task_id} added to queue, position: {task_data['position']}")
        
        return task_id
    
    def get_position(self, task_id: str) -> int:
        """
        Get the current position of a task in the queue
        
        Args:
            task_id: ID of the task
            
        Returns:
            position: Position in queue (0 means executing, -1 means not found)
        """
        # Check if task is being executed
        executing = self.redis.get(f"executing:{task_id}")
        if executing:
            return 0
        
        # Check if task is in queue
        task_queue = self.redis.lrange("task_queue", 0, -1)
        for i, queued_task_id in enumerate(task_queue):
            if task_id == queued_task_id.decode('utf-8'):
                return i + 1
        
        # Check if task exists but is not in queue (completed or failed)
        task_data = self.redis.hget("tasks", task_id)
        if task_data:
            task_json = json.loads(task_data)
            if task_json["status"] in ["completed", "failed"]:
                return 0
        
        return -1  # Task not found
    
    def get_next_task(self) -> Optional[Dict[str, Any]]:
        """
        Get the next task from queue and mark it as executing
        
        Returns:
            task_data: Task data or None if queue is empty
        """
        task_id = self.redis.lpop("task_queue")
        if not task_id:
            return None
        
        task_id = task_id.decode('utf-8')
        task_data = self.redis.hget("tasks", task_id)
        
        if not task_data:
            return None
            
        task_json = json.loads(task_data)
        task_json["status"] = "executing"
        task_json["updated_at"] = time.time()
        
        # Mark as executing
        self.redis.hset("tasks", task_id, json.dumps(task_json))
        self.redis.set(f"executing:{task_id}", "1", ex=3600)  # 1 hour expiry
        
        return task_json
    
    def complete_task(self, task_id: str, result: Dict[str, Any] = None) -> None:
        """
        Mark a task as completed
        
        Args:
            task_id: ID of the task
            result: Result data from task execution
        """
        task_data = self.redis.hget("tasks", task_id)
        if not task_data:
            return
            
        task_json = json.loads(task_data)
        task_json["status"] = "completed"
        task_json["updated_at"] = time.time()
        task_json["result"] = result
        
        # Calculate execution duration
        if task_json.get("start_time"):
            task_json["execution_duration"] = task_json["updated_at"] - task_json["start_time"]
        
        # Update task data
        self.redis.hset("tasks", task_id, json.dumps(task_json))
        # Remove executing flag
        self.redis.delete(f"executing:{task_id}")
        
        # Add final log entry
        self.add_task_log(
            task_id, 
            "INFO", 
            "Задача успешно завершена",
            {"result_summary": result.get("summary") if result and isinstance(result, dict) else None}
        )
        
        logger.info(f"Task {task_id} marked as completed")
    
    def fail_task(self, task_id: str, error: str) -> None:
        """
        Mark a task as failed
        
        Args:
            task_id: ID of the task
            error: Error message
        """
        task_data = self.redis.hget("tasks", task_id)
        if not task_data:
            return
            
        task_json = json.loads(task_data)
        task_json["status"] = "failed"
        task_json["updated_at"] = time.time()
        task_json["error"] = error
        
        # Calculate execution duration
        if task_json.get("start_time"):
            task_json["execution_duration"] = task_json["updated_at"] - task_json["start_time"]
        
        # Update task data
        self.redis.hset("tasks", task_id, json.dumps(task_json))
        # Remove executing flag
        self.redis.delete(f"executing:{task_id}")
        
        # Add error log entry
        self.add_task_log(
            task_id, 
            "ERROR", 
            f"Задача завершилась с ошибкой: {error}"
        )
        
        logger.info(f"Task {task_id} marked as failed: {error}")
    
    def get_all_tasks(self) -> List[Dict[str, Any]]:
        """
        Get all tasks in the system
        
        Returns:
            tasks: List of all tasks
        """
        tasks = []
        for task_id in self.redis.hkeys("tasks"):
            task_data = self.redis.hget("tasks", task_id)
            if task_data:
                tasks.append(json.loads(task_data))
        return tasks
    
    def _get_queue_length(self) -> int:
        """
        Get the current length of the queue
        
        Returns:
            length: Number of tasks in queue
        """
        return self.redis.llen("task_queue")
        
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Получение информации о задаче по ID
        
        Args:
            task_id: ID задачи
            
        Returns:
            Информация о задаче или None, если задача не найдена
        """
        task_data = self.redis.hget("tasks", task_id)
        if not task_data:
            return None
        return json.loads(task_data)

    def get_task_logs(self, task_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get logs for a task
        
        Args:
            task_id: ID of the task
            limit: Maximum number of records
            
        Returns:
            List of task logs
        """
        # Get logs from Redis
        logs_data = self.redis.lrange(f"task_log:{task_id}", 0, limit - 1)
        logs = []
        for log_data in logs_data:
            log = json.loads(log_data)
            logs.append(log)
        return logs

    def add_task_log(self, task_id: str, level: str, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        """
        Add a log entry for a task
        
        Args:
            task_id: ID of the task
            level: Log level (INFO, WARNING, ERROR)
            message: Log message
            details: Additional information
        """
        log_entry = {
            "timestamp": time.time(),
            "level": level,
            "message": message,
            "details": details
        }
        # Add log to the beginning of the list (so new ones are first)
        self.redis.lpush(f"task_log:{task_id}", json.dumps(log_entry))
        # Limit the number of log entries
        self.redis.ltrim(f"task_log:{task_id}", 0, 999)  # Store maximum 1000 entries

    def retry_task(self, task_id: str) -> bool:
        """
        Повторная попытка выполнения неудавшейся задачи
        
        Args:
            task_id: ID задачи
            
        Returns:
            True, если задача добавлена в очередь, иначе False
        """
        if not task_id:
            logger.error("Не указан ID задачи для повторной попытки")
            return False
            
        task_data = self.redis.hget("tasks", task_id)
        if not task_data:
            logger.error(f"Задача с ID {task_id} не найдена")
            return False
            
        task_json = json.loads(task_data)
        if task_json["status"] != "failed":
            logger.error(f"Задача с ID {task_id} не находится в состоянии 'failed' (текущий статус: {task_json['status']})")
            return False
        
        # Обновляем состояние задачи
        task_json["status"] = "pending"
        task_json["updated_at"] = time.time()
        task_json["retry_count"] = task_json.get("retry_count", 0) + 1
        task_json["error"] = None
        
        # Добавляем задачу в очередь
        self.redis.hset("tasks", task_id, json.dumps(task_json))
        self.redis.rpush("task_queue", task_id)
        
        # Логируем операцию
        logger.info(f"Задача {task_id} добавлена для повторной попытки (попытка #{task_json['retry_count']})")
        
        # Добавляем запись в лог задачи
        self.add_task_log(
            task_id, 
            "INFO", 
            f"Задача добавлена для повторного выполнения (попытка #{task_json['retry_count']})"
        )
        
        return True

    def update_task_progress(self, task_id: str, progress: int, stage: Optional[str] = None) -> bool:
        """
        Update task progress
        
        Args:
            task_id: ID of the task
            progress: Progress percentage (0-100)
            stage: Current stage of execution
            
        Returns:
            True if update was successful, otherwise False
        """
        task_data = self.redis.hget("tasks", task_id)
        if not task_data:
            return False
            
        task_json = json.loads(task_data)
        
        # Check that task is in executing state
        if task_json["status"] != "executing":
            return False
        
        task_json["progress"] = progress
        task_json["updated_at"] = time.time()
        
        if stage and task_json.get("stage") != stage:
            task_json["stage"] = stage
            # Add log entry when stage changes
            self.add_task_log(
                task_id, 
                "INFO", 
                f"Execution stage: {stage}, progress: {progress}%"
            )
        
        self.redis.hset("tasks", task_id, json.dumps(task_json))
        return True

    def get_queue_stats(self) -> Dict[str, Any]:
        """
        Получение статистики очереди
        
        Returns:
            Словарь со статистикой:
            - total_tasks: общее количество задач
            - pending_tasks: количество ожидающих задач
            - executing_tasks: количество выполняемых задач
            - completed_tasks: количество завершенных задач
            - failed_tasks: количество неудавшихся задач
            - average_waiting_time: среднее время ожидания (сек)
            - average_execution_time: среднее время выполнения (сек)
        """
        tasks = self.get_all_tasks()
        
        # Statistics by status
        total_tasks = len(tasks)
        pending_tasks = sum(1 for task in tasks if task["status"] == "pending")
        executing_tasks = sum(1 for task in tasks if task["status"] == "executing")
        completed_tasks = sum(1 for task in tasks if task["status"] == "completed")
        failed_tasks = sum(1 for task in tasks if task["status"] == "failed")
        
        # Time statistics
        now = time.time()
        waiting_times = []
        execution_times = []
        
        for task in tasks:
            if task["status"] in ["executing", "completed", "failed"]:
                # For executing tasks use last update time as start time
                start_time = task.get("start_time", task["created_at"])
                # Waiting time = execution start time - creation time
                waiting_time = start_time - task["created_at"]
                waiting_times.append(waiting_time)
            
            if task["status"] in ["completed", "failed"]:
                # For completed tasks use either explicit start_time or created_at
                start_time = task.get("start_time", task["created_at"])
                # Execution time = completion time - execution start time
                execution_time = task["updated_at"] - start_time
                execution_times.append(execution_time)
        
        average_waiting_time = sum(waiting_times) / len(waiting_times) if waiting_times else 0
        average_execution_time = sum(execution_times) / len(execution_times) if execution_times else 0
        
        return {
            "total_tasks": total_tasks,
            "pending_tasks": pending_tasks,
            "executing_tasks": executing_tasks,
            "completed_tasks": completed_tasks,
            "failed_tasks": failed_tasks,
            "average_waiting_time": average_waiting_time,
            "average_execution_time": average_execution_time
        }
    
    async def cleanup(self):
        """
        Асинхронное освобождение ресурсов Redis при завершении работы
        """
        if self.redis is not None:
            self.redis.close()
            await self.redis.wait_closed()
            logger.info("Redis connection closed")