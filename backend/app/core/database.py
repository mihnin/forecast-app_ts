"""
Database configuration and connection management
"""
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import time
import logging
from app.core.config import settings

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Проверка доступности БД PostgreSQL
def is_database_available(url, max_retries=3, retry_delay=2):
    """
    Проверяет доступность базы данных
    
    Args:
        url: URL базы данных
        max_retries: Максимальное количество попыток подключения
        retry_delay: Задержка между попытками в секундах
        
    Returns:
        bool: True если БД доступна, False в противном случае
    """
    from sqlalchemy.exc import OperationalError
    
    temp_engine = None
    for attempt in range(max_retries):
        try:
            temp_engine = create_engine(url)
            with temp_engine.connect() as connection:
                connection.execute("SELECT 1")
            if temp_engine:
                temp_engine.dispose()
            return True
        except OperationalError as e:
            logger.warning(f"Попытка {attempt+1}/{max_retries} подключения к БД не удалась: {str(e)}")
            time.sleep(retry_delay)
        finally:
            if temp_engine:
                temp_engine.dispose()
    
    return False

# Database URL construction - использование переменной окружения
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@db:5432/forecast_db")

# Проверяем доступность PostgreSQL и используем SQLite в памяти как резервный вариант
USE_MEMORY_DB = False
if not is_database_available(SQLALCHEMY_DATABASE_URL):
    logger.warning("PostgreSQL недоступен, использую SQLite в памяти")
    SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
    USE_MEMORY_DB = True

# Create engine with appropriate arguments
if USE_MEMORY_DB:
    # Для SQLite включаем поддержку внешних ключей
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for database models
Base = declarative_base()

# Metadata object for database schema operations
metadata = MetaData()

def get_db():
    """
    Get database session
    
    Yields:
        Session: Database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Если используем БД в памяти, создаем таблицы при запуске
if USE_MEMORY_DB:
    Base.metadata.create_all(bind=engine)