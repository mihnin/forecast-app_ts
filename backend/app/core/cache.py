"""
Cache management utilities
"""
import redis
from typing import Optional, Any
import json
import pickle
import hashlib
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class CacheManager:
    def __init__(self):
        self.redis = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=1  # Используем отдельную БД для кеша
        )
        self.default_ttl = 3600  # 1 час по умолчанию

    def _generate_key(self, prefix: str, params: dict) -> str:
        """
        Generate cache key from parameters
        """
        # Сортируем параметры для стабильного хеша
        sorted_params = dict(sorted(params.items()))
        params_str = json.dumps(sorted_params)
        # Создаем хеш параметров
        params_hash = hashlib.md5(params_str.encode()).hexdigest()
        return f"{prefix}:{params_hash}"

    def get(self, prefix: str, params: dict) -> Optional[Any]:
        """
        Get cached value
        """
        try:
            key = self._generate_key(prefix, params)
            data = self.redis.get(key)
            if data:
                return pickle.loads(data)
            return None
        except Exception as e:
            logger.error(f"Error getting cache: {str(e)}")
            return None

    def set(self, prefix: str, params: dict, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Set cache value
        """
        try:
            key = self._generate_key(prefix, params)
            data = pickle.dumps(value)
            self.redis.set(key, data, ex=ttl or self.default_ttl)
            return True
        except Exception as e:
            logger.error(f"Error setting cache: {str(e)}")
            return False

    def delete(self, prefix: str, params: dict) -> bool:
        """
        Delete cached value
        """
        try:
            key = self._generate_key(prefix, params)
            self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Error deleting cache: {str(e)}")
            return False

    def clear_prefix(self, prefix: str) -> bool:
        """
        Clear all cached values with given prefix
        """
        try:
            keys = self.redis.keys(f"{prefix}:*")
            if keys:
                self.redis.delete(*keys)
            return True
        except Exception as e:
            logger.error(f"Error clearing cache prefix: {str(e)}")
            return False

# Глобальный экземпляр менеджера кеша
cache = CacheManager()