"""
API endpoints для очистки данных
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.crud.data_cleanup import cleanup_user_data, get_table_sizes
from typing import Dict, Any, Optional

router = APIRouter()

@router.post("/cleanup", response_model=Dict[str, Any])
def cleanup_data(
    user_id: Optional[str] = Query(None, description="ID пользователя для удаления (если None, удаляются все данные)"),
    db: Session = Depends(get_db)
):
    """
    Очищает данные пользователя из базы данных
    
    Args:
        user_id: ID пользователя (опционально)
        db: Сессия базы данных
        
    Returns:
        Dict[str, Any]: Результат операции
    """
    success = cleanup_user_data(db, user_id)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Произошла ошибка при очистке данных. Проверьте журнал сервера для подробностей."
        )
    
    return {
        "status": "success",
        "message": f"Данные {'пользователя ' + user_id if user_id else 'всех пользователей'} успешно очищены"
    }

@router.get("/db-stats", response_model=Dict[str, Any])
def get_database_stats(db: Session = Depends(get_db)):
    """
    Возвращает статистику по базе данных
    
    Args:
        db: Сессия базы данных
        
    Returns:
        Dict[str, Any]: Статистика по базе данных
    """
    sizes = get_table_sizes(db)
    
    return {
        "status": "success",
        "data": sizes
    } 