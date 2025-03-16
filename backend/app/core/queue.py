import json
import time
from typing import Dict, List, Any, Optional, Union
import redis
from celery import Celery
import uuid
import logging
from fastapi.logger import logger as fastapi_logger

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
logger.handlers = fastapi_logger.handlers

class JobQueue:
    """
    Queue system for managing jobs to prevent server overload
    """
    def __init__(self):
        """
        Initialize the job queue with Redis connection
        """
        try:
            # Initialize Redis connection
            self.redis = redis.Redis(host='redis', port=6379, db=0, socket_connect_timeout=5)
            self.redis.ping()
            self.celery = Celery('tasks', broker='redis://redis:6379/0')
            logger.info("Successfully initialized connection to Redis")
        except Exception as e:
            logger.error(f"Failed to initialize Redis connection: {str(e)}")
            # Используем заглушку для Redis
            self.redis = None
            self.celery = None
            
    # Заглушка для ensure_backward_compatibility
    async def initialize(self):
        """
        Stub method for backward compatibility
        """
        logger.info("Using synchronous initialization, this method is a noop.")
        pass

    def add_task(self, user_id: str, task_type: str, params: Dict[str, Any]) -> str:
        """
        Add a task to the queue
        
        Args:
            user_id: User identifier
            task_type: Type of task (prediction, training, etc.)
            params: Task parameters
            
        Returns:
            str: Task ID
        """
        if not self.redis:
            logger.warning("Redis is not available, can't add task")
            return str(uuid.uuid4())  # Return a fake ID

        # Generate task ID
        task_id = str(uuid.uuid4())
        
        # Create task data
        task_data = {
            "task_id": task_id,
            "user_id": user_id,
            "task_type": task_type,
            "params": params,
            "status": "pending",
            "created_at": time.time(),
            "updated_at": time.time()
        }
        
        # Convert task data to JSON
        task_json = json.dumps(task_data)
        
        # Add task to queue
        self.redis.lpush("task_queue", task_id)
        
        # Store task data
        self.redis.set(f"task:{task_id}", task_json)
        
        # Log task creation
        self.add_task_log(task_id, "info", f"Task created: {task_type}")
        
        return task_id

    def get_position(self, task_id: str) -> int:
        """
        Get the position of a task in the queue
        
        Args:
            task_id: Task ID
            
        Returns:
            int: Position in queue (0 if executing, -1 if not in queue)
        """
        if not self.redis:
            return -1

        # Check if task is in queue
        queue = self.redis.lrange("task_queue", 0, -1)
        queue = [item.decode('utf-8') for item in queue]
        
        if task_id in queue:
            return queue.index(task_id) + 1
        
        # Check if task is executing
        executing = self.redis.get(f"executing:{task_id}")
        if executing:
            return 0
            
        return -1
    
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
        Get all tasks
        
        Returns:
            List[Dict[str, Any]]: List of tasks
        """
        if not self.redis:
            return []

        # Get all task keys
        tasks = []
        task_keys = self.redis.keys("task:*")
        
        # Get task data
        for key in task_keys:
            task_json = self.redis.get(key)
            if task_json:
                task = json.loads(task_json)
                tasks.append(task)
                
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
        Get a task by ID
        
        Args:
            task_id: Task ID
            
        Returns:
            Optional[Dict[str, Any]]: Task data or None if not found
        """
        if not self.redis:
            # Return fake data in case Redis is not available
            return {
                "task_id": task_id,
                "status": "pending",
                "created_at": time.time(),
                "updated_at": time.time()
            }

        task_json = self.redis.get(f"task:{task_id}")
        if task_json:
            return json.loads(task_json)
        return None

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
        Get queue statistics
        
        Returns:
            Dict[str, Any]: Queue statistics
        """
        if not self.redis:
            return {
                "total_tasks": 0,
                "pending_tasks": 0,
                "executing_tasks": 0,
                "completed_tasks": 0,
                "failed_tasks": 0
            }

        # Get all tasks
        tasks = self.get_all_tasks()
        
        # Count by status
        total = len(tasks)
        pending = sum(1 for task in tasks if task.get("status") == "pending")
        executing = sum(1 for task in tasks if task.get("status") == "executing")
        completed = sum(1 for task in tasks if task.get("status") == "completed")
        failed = sum(1 for task in tasks if task.get("status") == "failed")
        
        # Calculate average waiting and execution times
        waiting_times = []
        execution_times = []
        
        for task in tasks:
            created_at = task.get("created_at", 0)
            started_at = task.get("started_at")
            completed_at = task.get("completed_at")
            
            if started_at and created_at:
                waiting_time = started_at - created_at
                waiting_times.append(waiting_time)
                
            if completed_at and started_at:
                execution_time = completed_at - started_at
                execution_times.append(execution_time)
                
        avg_waiting_time = sum(waiting_times) / len(waiting_times) if waiting_times else None
        avg_execution_time = sum(execution_times) / len(execution_times) if execution_times else None
        
        return {
            "total_tasks": total,
            "pending_tasks": pending,
            "executing_tasks": executing,
            "completed_tasks": completed,
            "failed_tasks": failed,
            "average_waiting_time": avg_waiting_time,
            "average_execution_time": avg_execution_time
        }
    
    async def cleanup(self):
        """
        Cleanup method for backward compatibility
        """
        logger.info("Cleanup is now a noop method")
        pass