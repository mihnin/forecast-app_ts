import json
import time
from typing import Dict, List, Any, Optional
import redis
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
        self.redis = redis.Redis(host="redis", port=6379, db=0)
        self.celery = Celery('tasks', broker='redis://redis:6379/0')
        
        # Make sure Redis is accessible
        try:
            self.redis.ping()
            logger.info("Successfully connected to Redis")
        except redis.ConnectionError as e:
            logger.error(f"Failed to connect to Redis: {e}")
            # Could use a fallback in-memory queue for development
        
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
        
        # Update task data
        self.redis.hset("tasks", task_id, json.dumps(task_json))
        # Remove executing flag
        self.redis.delete(f"executing:{task_id}")
        
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
        
        # Update task data
        self.redis.hset("tasks", task_id, json.dumps(task_json))
        # Remove executing flag
        self.redis.delete(f"executing:{task_id}")
        
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