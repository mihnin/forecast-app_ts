from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Dict, Any
import logging
from app.models.prediction import PredictionRequest, PredictionResponse, PredictionResult
from app.core.queue import JobQueue
from app.services.forecasting.prediction import prepare_prediction_task

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/forecast", response_model=PredictionResponse)
async def predict(
    request: PredictionRequest,
    background_tasks: BackgroundTasks,
    queue: JobQueue = Depends()
):
    """
    Запуск прогнозирования
    """
    try:
        # Подготавливаем параметры задачи
        task_params = prepare_prediction_task(request.params)
        
        # Добавляем задачу в очередь
        task_id = queue.add_task(
            user_id=request.user_id,
            task_type="prediction",
            params=task_params
        )
        
        # Получаем позицию в очереди
        position = queue.get_position(task_id)
        
        # Оцениваем время выполнения (условно)
        estimated_time = 30  # Прогнозирование обычно быстрее обучения
        
        return PredictionResponse(
            task_id=task_id,
            position=position,
            estimated_time=estimated_time
        )
    
    except Exception as e:
        logger.error(f"Ошибка при создании задачи прогнозирования: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при создании задачи прогнозирования: {str(e)}")


@router.get("/result/{task_id}", response_model=PredictionResult)
async def get_prediction_result(
    task_id: str,
    queue: JobQueue = Depends()
):
    """
    Получение результатов прогнозирования
    """
    try:
        # Получаем информацию о задаче
        tasks = queue.get_all_tasks()
        task = next((t for t in tasks if t.get("task_id") == task_id), None)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Задача с ID {task_id} не найдена")
        
        if task["status"] != "completed":
            raise HTTPException(status_code=400, detail=f"Задача с ID {task_id} еще не завершена (статус: {task['status']})")
        
        # Получаем результаты прогнозирования
        if "result" not in task or not task["result"]:
            raise HTTPException(status_code=500, detail=f"Результаты для задачи с ID {task_id} отсутствуют")
        
        # Преобразуем результаты для возврата
        result = task["result"]
        
        return PredictionResult(
            prediction_id=task_id,
            predictions=result.get("predictions"),
            plots=result.get("plots")
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении результатов прогнозирования: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении результатов прогнозирования: {str(e)}")


@router.get("/export/{task_id}")
async def export_prediction(
    task_id: str,
    format: str = "json",
    queue: JobQueue = Depends()
):
    """
    Экспорт результатов прогнозирования в различных форматах
    """
    try:
        # Получаем информацию о задаче
        tasks = queue.get_all_tasks()
        task = next((t for t in tasks if t.get("task_id") == task_id), None)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Задача с ID {task_id} не найдена")
        
        if task["status"] != "completed":
            raise HTTPException(status_code=400, detail=f"Задача с ID {task_id} еще не завершена (статус: {task['status']})")
        
        # Получаем результаты прогнозирования
        if "result" not in task or not task["result"]:
            raise HTTPException(status_code=500, detail=f"Результаты для задачи с ID {task_id} отсутствуют")
        
        # Экспорт в зависимости от запрошенного формата
        result = task["result"]
        
        if format == "json":
            # Возвращаем JSON
            return result.get("predictions")
        elif format == "csv":
            # Преобразуем в CSV
            import pandas as pd
            from fastapi.responses import StreamingResponse
            import io
            
            # Преобразуем в DataFrame
            predictions = result.get("predictions")
            df = pd.DataFrame(predictions)
            
            # Сохраняем в буфер
            buffer = io.StringIO()
            df.to_csv(buffer, index=False)
            buffer.seek(0)
            
            # Возвращаем CSV
            return StreamingResponse(
                buffer,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=prediction_{task_id}.csv"}
            )
        elif format == "excel":
            # Преобразуем в Excel
            import pandas as pd
            from fastapi.responses import StreamingResponse
            import io
            
            # Преобразуем в DataFrame
            predictions = result.get("predictions")
            df = pd.DataFrame(predictions)
            
            # Сохраняем в буфер
            buffer = io.BytesIO()
            df.to_excel(buffer, index=False)
            buffer.seek(0)
            
            # Возвращаем Excel
            return StreamingResponse(
                buffer,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename=prediction_{task_id}.xlsx"}
            )
        else:
            raise HTTPException(status_code=400, detail=f"Неподдерживаемый формат: {format}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при экспорте результатов: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при экспорте результатов: {str(e)}")