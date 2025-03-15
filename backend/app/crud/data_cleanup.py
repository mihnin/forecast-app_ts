"""
Функции для очистки данных из базы данных
"""
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
from app.core.database import USE_MEMORY_DB
from typing import List, Optional

# Настройка логирования
logger = logging.getLogger(__name__)

def cleanup_user_data(db: Session, user_id: Optional[str] = None) -> bool:
    """
    Очищает данные пользователя из базы данных
    
    Args:
        db: Сессия базы данных
        user_id: ID пользователя (если None, то очищаются все данные)
        
    Returns:
        bool: True если данные успешно очищены, False в противном случае
    """
    try:
        # Список таблиц, в которых могут быть данные пользователя
        # Обновите этот список в соответствии с вашей схемой БД
        tables = [
            "forecast_results",
            "time_series_data",
            "forecast_jobs",
            "uploaded_files"
        ]
        
        # Если используем БД в памяти, просто пропускаем очистку
        if USE_MEMORY_DB:
            logger.info("Используется БД в памяти, данные будут очищены автоматически после перезапуска")
            return True
        
        with db.begin():
            for table in tables:
                # Проверяем существование таблицы
                table_exists = db.execute(
                    text(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}')")
                ).scalar()
                
                if not table_exists:
                    logger.warning(f"Таблица {table} не существует, пропускаем")
                    continue
                
                # Строим запрос на удаление
                if user_id:
                    # Проверяем наличие column user_id
                    column_exists = db.execute(
                        text(f"SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'user_id')")
                    ).scalar()
                    
                    if column_exists:
                        db.execute(text(f"DELETE FROM {table} WHERE user_id = :user_id"), {"user_id": user_id})
                        logger.info(f"Очищены данные пользователя {user_id} из таблицы {table}")
                    else:
                        logger.warning(f"Таблица {table} не имеет столбца user_id, пропускаем")
                else:
                    # Очищаем всю таблицу
                    db.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
                    logger.info(f"Очищена вся таблица {table}")
        
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Ошибка при очистке данных: {str(e)}")
        return False

def get_table_sizes(db: Session) -> dict:
    """
    Возвращает размеры таблиц в базе данных
    
    Args:
        db: Сессия базы данных
        
    Returns:
        dict: Словарь с размерами таблиц
    """
    if USE_MEMORY_DB:
        return {"message": "Используется БД в памяти, размеры таблиц не доступны"}
    
    try:
        sizes = {}
        query = text("""
            SELECT tablename, pg_size_pretty(pg_total_relation_size(quote_ident(tablename))) as size
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(quote_ident(tablename)) DESC
        """)
        
        result = db.execute(query)
        for row in result:
            sizes[row[0]] = row[1]
        
        return sizes
    except Exception as e:
        logger.error(f"Ошибка при получении размеров таблиц: {str(e)}")
        return {"error": str(e)} 