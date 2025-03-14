import pandas as pd
import numpy as np
import os
import logging
from typing import Tuple, Dict, Any, Optional, List
from fastapi import HTTPException
from app.models.data import DatasetInfo

logger = logging.getLogger(__name__)

def process_uploaded_file(file_path: str, chunk_size: int = 100000) -> Tuple[pd.DataFrame, DatasetInfo]:
    """
    Обработка загруженного файла и извлечение информации о нем
    
    Args:
        file_path: Путь к загруженному файлу
        chunk_size: Размер чанка для больших файлов
        
    Returns:
        df: Загруженный и обработанный DataFrame
        info: Информация о датасете
    """
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Файл не найден: {file_path}")
    
    file_ext = os.path.splitext(file_path)[1].lower()
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    
    logger.info(f"Обработка файла: {file_path} ({file_size_mb:.2f} МБ)")
    
    try:
        if file_ext == '.csv':
            if file_size_mb > 100 and chunk_size:
                df = load_csv_in_chunks(file_path, chunk_size)
            else:
                df = load_csv_standard(file_path)
        elif file_ext in ('.xls', '.xlsx'):
            if file_size_mb > 100:
                logger.warning("Большие Excel-файлы могут загружаться медленно")
            df = pd.read_excel(file_path)
        else:
            raise HTTPException(status_code=400, detail=f"Неподдерживаемый формат файла: {file_ext}")
        
        # Создаем информацию о датасете
        info = DatasetInfo(
            rows=len(df),
            columns=len(df.columns),
            column_names=df.columns.tolist(),
            missing_values={col: int(df[col].isna().sum()) for col in df.columns}
        )
        
        logger.info(f"Файл успешно загружен: {len(df)} строк, {len(df.columns)} колонок")
        
        return df, info
    
    except pd.errors.EmptyDataError:
        logger.error("Пустой CSV-файл или нет данных")
        raise HTTPException(status_code=400, detail="Файл пуст или не содержит данных")
    except pd.errors.ParserError as e:
        logger.error(f"Ошибка парсинга: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Ошибка чтения файла: {str(e)}")
    except Exception as e:
        logger.error(f"Критическая ошибка: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки: {str(e)}")


def load_csv_standard(file_path: str) -> pd.DataFrame:
    """
    Стандартная загрузка CSV без разбиения на чанки
    """
    try:
        # Определение разделителя
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            sample = f.read(4096)
            
        if ',' in sample:
            sep = ','
        elif ';' in sample:
            sep = ';'
        elif '\t' in sample:
            sep = '\t'
        else:
            sep = None  # Автоопределение pandas
        
        # Чтение файла
        if sep is None:
            df = pd.read_csv(file_path, sep=None, engine='python', thousands=' ')
        else:
            df = pd.read_csv(file_path, sep=sep, thousands=' ')
        
        if df.shape[1] == 1:
            logger.warning("Автоопределение разделителя нашло только 1 столбец")
        
        return df
    except Exception as e:
        logger.error(f"Ошибка при стандартной загрузке CSV: {str(e)}")
        raise


def load_csv_in_chunks(file_path: str, chunk_size: int) -> pd.DataFrame:
    """
    Оптимизированная загрузка большого CSV файла чанками для экономии памяти
    """
    try:
        # Определение разделителя на маленьком образце
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            sample = f.read(4096)
            
        if ',' in sample:
            sep = ','
        elif ';' in sample:
            sep = ';'
        elif '\t' in sample:
            sep = '\t'
        else:
            sep = None  # Автоопределение pandas
        
        # Чтение по частям
        chunks = []
        chunk_iter = pd.read_csv(
            file_path, 
            sep=sep if sep else ',',  # Используем определенный разделитель или запятую по умолчанию
            engine='python' if sep is None else 'c',
            chunksize=chunk_size, 
            encoding='utf-8', 
            errors='replace',
            thousands=' ',
            low_memory=True
        )
        
        for i, chunk in enumerate(chunk_iter):
            chunks.append(chunk)
            logger.info(f"Загружен чанк {i+1}, строк: {len(chunk)}")
        
        # Объединяем чанки
        df = pd.concat(chunks, ignore_index=True)
        logger.info(f"Успешно загружен большой CSV по частям. Всего строк: {len(df)}")
        
        return df
    except Exception as e:
        logger.error(f"Ошибка при загрузке CSV чанками: {str(e)}")
        raise


def convert_to_timeseries(df: pd.DataFrame, id_col: str, timestamp_col: str, target_col: str) -> pd.DataFrame:
    """
    Преобразует DataFrame в формат с колонками (item_id, timestamp, target)
    
    Args:
        df: Исходный датафрейм
        id_col: Название колонки с идентификаторами
        timestamp_col: Название колонки с датами
        target_col: Название целевой колонки
        
    Returns:
        Датафрейм с переименованными колонками для AutoGluon
    """
    # Проверяем наличие необходимых колонок
    required_cols = [id_col, timestamp_col, target_col]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Отсутствуют необходимые колонки: {', '.join(missing_cols)}")
    
    # Создаем копию датафрейма
    df_local = df.copy()
    
    # Переименовываем колонки
    column_mapping = {
        id_col: "item_id",
        timestamp_col: "timestamp",
        target_col: "target"
    }
    
    # Выполняем переименование
    df_local = df_local.rename(columns=column_mapping)
    
    # Проверяем, что колонки были успешно переименованы
    for new_col in ["item_id", "timestamp", "target"]:
        if new_col not in df_local.columns:
            raise ValueError(f"Не удалось создать колонку '{new_col}'")
    
    # Преобразуем item_id в строку и сортируем
    df_local["item_id"] = df_local["item_id"].astype(str)
    df_local = df_local.sort_values(["item_id", "timestamp"])
    df_local = df_local.reset_index(drop=True)
    
    logger.info(f"Преобразовано в TimeSeriesDataFrame формат. Колонки: {list(df_local.columns)}")
    
    return df_local


def split_train_test(df: pd.DataFrame, date_col: str, test_size: float = 0.2, validation_size: float = 0.0):
    """
    Разделяет временной ряд на обучающую, тестовую и опционально валидационную выборки
    
    Args:
        df: Исходный датафрейм
        date_col: Название колонки с датами
        test_size: Доля данных для тестовой выборки
        validation_size: Доля данных для валидационной выборки
        
    Returns:
        Кортеж из train, test и опционально validation датафреймов
    """
    # Убеждаемся, что колонка даты в формате datetime
    if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
        df = df.copy()
        df[date_col] = pd.to_datetime(df[date_col])
    
    # Сортируем по дате
    df_sorted = df.sort_values(date_col)
    
    # Вычисляем индексы разделения
    n = len(df_sorted)
    test_idx = int(n * (1 - test_size))
    
    if validation_size > 0:
        val_idx = int(n * (1 - test_size - validation_size))
        train = df_sorted.iloc[:val_idx]
        val = df_sorted.iloc[val_idx:test_idx]
        test = df_sorted.iloc[test_idx:]
        return train, test, val
    else:
        train = df_sorted.iloc[:test_idx]
        test = df_sorted.iloc[test_idx:]
        return train, test, None