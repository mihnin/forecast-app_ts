"""
Memory storage model for application data without a database
"""
import logging
from typing import Any, Dict

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Базовый класс для моделей без БД
class Base:
    """
    Base class for data models (without database)
    """
    __tablename__ = ""
    
    @classmethod
    def create_table(cls):
        """
        Stub method for compatibility
        """
        pass

# Dummy session for compatibility
class MemorySession:
    """
    Dummy session for compatibility with previous code
    """
    def __init__(self):
        self.closed = False
    
    def close(self):
        """
        Dummy close method
        """
        self.closed = True
    
    def commit(self):
        """
        Dummy commit method
        """
        pass
    
    def rollback(self):
        """
        Dummy rollback method
        """
        pass
    
    def refresh(self, obj):
        """
        Dummy refresh method
        """
        pass
    
    def add(self, obj):
        """
        Dummy add method
        """
        pass
    
    def delete(self, obj):
        """
        Dummy delete method
        """
        pass

# Фабрика сессий для совместимости
SessionLocal = lambda: MemorySession()

def get_db():
    """
    Get database session (memory-based)
    
    Yields:
        MemorySession: Memory session for compatibility
    """
    db = MemorySession()
    try:
        yield db
    finally:
        db.close()

logger.info("Using in-memory storage for all data (no database)")