from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    """Создание новой задачи"""
    user_id: str = Field(..., description="Идентификатор пользователя")
    task_type: str = Field(..., description="Тип задачи (training, prediction)")
    params: Dict[str, Any] = Field(..., description="Параметры задачи")


class TaskStatus(BaseModel):
    """Статус задачи"""
    task_id: str = Field(..., description="Идентификатор задачи")
    status: str = Field(..., description="Статус задачи (pending, executing, completed, failed)")
    position: int = Field(..., description="Позиция в очереди (0 = выполняется или завершена)")
    progress: int = Field(0, description="Прогресс выполнения задачи (0-100%)")
    created_at: float = Field(..., description="Время создания (UNIX timestamp)")
    updated_at: float = Field(..., description="Время обновления (UNIX timestamp)")
    estimated_end_time: Optional[float] = Field(None, description="Оценка времени завершения (UNIX timestamp)")
    result: Optional[Dict[str, Any]] = Field(None, description="Результат выполнения (если завершена)")
    error: Optional[str] = Field(None, description="Сообщение об ошибке (если не удалось)")
    stage: Optional[str] = Field(None, description="Текущий этап выполнения")
    retry_count: Optional[int] = Field(0, description="Количество попыток выполнения")


class QueueInfo(BaseModel):
    """Информация об очереди"""
    total_tasks: int = Field(..., description="Общее количество задач")
    pending_tasks: int = Field(..., description="Количество ожидающих задач")
    executing_tasks: int = Field(..., description="Количество выполняемых задач")
    completed_tasks: int = Field(..., description="Количество завершенных задач")
    failed_tasks: int = Field(..., description="Количество проваленных задач")
    average_waiting_time: Optional[float] = Field(None, description="Среднее время ожидания (сек)")
    average_execution_time: Optional[float] = Field(None, description="Среднее время выполнения (сек)")
    tasks: List[TaskStatus] = Field(..., description="Список всех задач")


class TaskLog(BaseModel):
    """Запись лога выполнения задачи"""
    task_id: str = Field(..., description="Идентификатор задачи")
    timestamp: float = Field(..., description="Время записи (UNIX timestamp)")
    level: str = Field("INFO", description="Уровень лога (INFO, WARNING, ERROR)")
    message: str = Field(..., description="Сообщение лога")
    details: Optional[Dict[str, Any]] = Field(None, description="Дополнительная информация")