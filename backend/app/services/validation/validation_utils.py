import pandas as pd
import logging
from typing import List, Dict, Any, Union, Optional

logger = logging.getLogger(__name__)

def validate_columns(df: pd.DataFrame, required_columns: List[str], raise_error: bool = True) -> Union[bool, None]:
    """
    Проверяет наличие необходимых колонок в DataFrame
    
    Args:
        df: DataFrame для проверки
        required_columns: Список необходимых колонок
        raise_error: Вызывать ли исключение или возвращать результат проверки
        
    Returns:
        True, если все колонки найдены, иначе ValueError или False
    """
    if df is None:
        if raise_error:
            raise ValueError("DataFrame не инициализирован (None)")
        return False
    
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        if raise_error:
            raise ValueError(f"В DataFrame отсутствуют обязательные колонки: {', '.join(missing_columns)}")
        return False
    return True


def validate_date_column(df: pd.DataFrame, date_col: str, raise_error: bool = True) -> Union[bool, None]:
    """
    Проверяет, что колонка содержит даты
    
    Args:
        df: DataFrame для проверки
        date_col: Название колонки с датами
        raise_error: Вызывать ли исключение или возвращать результат проверки
        
    Returns:
        True, если колонка содержит даты, иначе ValueError или False
    """
    if df is None:
        if raise_error:
            raise ValueError("DataFrame не инициализирован (None)")
        return False
    
    if date_col not in df.columns:
        if raise_error:
            raise ValueError(f"Колонка {date_col} не найдена в DataFrame")
        return False
    
    if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
        try:
            # Пытаемся преобразовать к datetime
            pd.to_datetime(df[date_col], errors='raise')
        except Exception as e:
            if raise_error:
                raise ValueError(f"Колонка {date_col} содержит некорректные значения дат: {e}")
            return False
    
    return True


def safe_get_from_dict(dictionary: Dict[str, Any], key_path: Union[str, List[str]], default: Any = None) -> Any:
    """
    Безопасно извлекает значение из вложенного словаря по пути ключей
    
    Args:
        dictionary: Исходный словарь
        key_path: Путь к ключу в виде строки с разделителями "." или списка ключей
        default: Значение по умолчанию, если ключ не найден
        
    Returns:
        Значение по ключу или значение по умолчанию
    """
    if dictionary is None:
        return default
    
    if isinstance(key_path, str):
        key_path = key_path.split('.')
    
    current = dictionary
    for key in key_path:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return default
    
    return current