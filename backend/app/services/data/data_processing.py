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


def convert_to_timeseries(df: pd.DataFrame, id_col: str, timestamp_col: str, target_col: str, 
                         freq: Optional[str] = None, fill_method: str = "ffill") -> pd.DataFrame:
    """
    Преобразует DataFrame в формат с колонками (item_id, timestamp, target) и переводит в указанную частоту
    
    Args:
        df: Исходный датафрейм
        id_col: Название колонки с идентификаторами
        timestamp_col: Название колонки с датами
        target_col: Название целевой колонки
        freq: Частота данных (D-день, M-месяц, Q-квартал, Y-год, H-час, T-минута, None-автоопределение)
        fill_method: Метод заполнения пропусков после преобразования частоты
        
    Returns:
        Датафрейм с переименованными колонками для AutoGluon и правильной частотой
    """
    # Проверяем наличие необходимых колонок
    required_cols = [id_col, timestamp_col, target_col]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Отсутствуют необходимые колонки: {', '.join(missing_cols)}")
    
    # Создаем копию датафрейма
    df_local = df.copy()
    
    # Убедимся, что колонка с датами имеет правильный тип
    if not pd.api.types.is_datetime64_any_dtype(df_local[timestamp_col]):
        df_local[timestamp_col] = pd.to_datetime(df_local[timestamp_col], errors="coerce")
    
    # Преобразуем item_id в строку
    df_local[id_col] = df_local[id_col].astype(str)
    
    # Переименовываем колонки
    column_mapping = {
        id_col: "item_id",
        timestamp_col: "timestamp",
        target_col: "target"
    }
    
    # Список колонок, которые нужно сохранить
    all_cols = list(df_local.columns)
    mapped_cols = list(column_mapping.keys())
    unchanged_cols = [col for col in all_cols if col not in mapped_cols]
    
    # Применяем переименование
    df_local = df_local.rename(columns=column_mapping)
    
    # Определяем начальные и конечные даты для каждого временного ряда
    if freq:
        # Преобразуем в мультииндекс для упрощения работы с временными рядами
        df_local = df_local.set_index(["item_id", "timestamp"])
    
        # Для каждого ID выполняем преобразование частоты
        result_pieces = []
        for item_id, group in df_local.groupby("item_id", as_index=False):
            # Определяем дату начала и конца для конкретного ряда
            start_date = group.index.get_level_values("timestamp").min()
            end_date = group.index.get_level_values("timestamp").max()
            
            # Создаем регулярный временной индекс
            if freq in ["D", "B", "H", "min", "T", "S"]:
                # Для дней, рабочих дней, часов, минут, секунд
                idx = pd.date_range(start=start_date, end=end_date, freq=freq)
            elif freq in ["M", "MS"]:
                # Для месяцев
                idx = pd.date_range(start=start_date.replace(day=1), 
                                    end=end_date + pd.offsets.MonthEnd(0), 
                                    freq=freq)
            elif freq in ["Q", "QS"]:
                # Для кварталов
                idx = pd.date_range(start=start_date.replace(day=1), 
                                    end=end_date + pd.offsets.QuarterEnd(0), 
                                    freq=freq)
            elif freq in ["Y", "YS"]:
                # Для годов
                idx = pd.date_range(start=start_date.replace(month=1, day=1), 
                                    end=end_date + pd.offsets.YearEnd(0), 
                                    freq=freq)
            else:
                # Для других частот используем стандартный date_range
                idx = pd.date_range(start=start_date, end=end_date, freq=freq)
            
            # Создаем полный мультииндекс для данного ID
            multi_idx = pd.MultiIndex.from_product([[item_id], idx], names=["item_id", "timestamp"])
            
            # Переиндексируем данные группы
            piece = group.reindex(multi_idx)
            
            # Заполняем пропуски
            if fill_method == "ffill":
                piece = piece.fillna(method="ffill").fillna(method="bfill")
            elif fill_method == "linear":
                piece = piece.interpolate(method="linear")
            elif fill_method == "zero":
                piece = piece.fillna(0)
            
            result_pieces.append(piece)
        
        # Собираем все кусочки вместе
        if result_pieces:
            df_local = pd.concat(result_pieces)
            # Сбрасываем индекс
            df_local = df_local.reset_index()
        else:
            df_local = pd.DataFrame(columns=["item_id", "timestamp", "target"] + unchanged_cols)
    
    # Сортируем по ID и дате
    df_local = df_local.sort_values(["item_id", "timestamp"]).reset_index(drop=True)
    
    # Проверяем, что необходимые колонки созданы
    for new_col in ["item_id", "timestamp", "target"]:
        if new_col not in df_local.columns:
            raise ValueError(f"Не удалось создать колонку '{new_col}'")
    
    # Логируем информацию
    freq_str = freq if freq else "определена автоматически"
    logger.info(f"Преобразовано в TimeSeriesDataFrame формат с частотой {freq_str}. Колонки: {list(df_local.columns)}")
    
    return df_local


def detect_frequency(df: pd.DataFrame, timestamp_col: str, id_col: Optional[str] = None) -> str:
    """
    Определяет частоту временного ряда на основе данных
    
    Args:
        df: Датафрейм с данными
        timestamp_col: Название колонки с датами
        id_col: Название колонки с идентификаторами (опционально)
        
    Returns:
        Строка с частотой в формате pandas (D, M, Q, Y, H, T, ...)
    """
    # Проверяем наличие колонки с датами
    if timestamp_col not in df.columns:
        raise ValueError(f"Колонка {timestamp_col} не найдена в датафрейме")
    
    # Убедимся, что колонка с датами имеет правильный тип
    timestamps = df[timestamp_col]
    if not pd.api.types.is_datetime64_any_dtype(timestamps):
        timestamps = pd.to_datetime(timestamps, errors="coerce")
    
    # Определяем частоту для каждого ID отдельно, если указан id_col
    if id_col and id_col in df.columns:
        freq_counts = {}
        for name, group in df.groupby(id_col):
            group_timestamps = group[timestamp_col]
            if not pd.api.types.is_datetime64_any_dtype(group_timestamps):
                group_timestamps = pd.to_datetime(group_timestamps, errors="coerce")
            
            if len(group_timestamps) > 1:
                # Сортируем и находим разницы между последовательными метками времени
                sorted_ts = group_timestamps.sort_values()
                diffs = sorted_ts.diff().dropna()
                
                if len(diffs) > 0:
                    # Находим наиболее частый интервал
                    most_common_diff = diffs.value_counts().index[0]
                    freq = pd.infer_freq(sorted_ts)
                    if freq:
                        freq_counts[freq] = freq_counts.get(freq, 0) + 1
                    else:
                        # Если автоматическое определение не сработало, пробуем определить вручную
                        seconds = most_common_diff.total_seconds()
                        
                        if seconds == 60:  # 1 минута
                            inferred_freq = "T"
                        elif seconds == 3600:  # 1 час
                            inferred_freq = "H"
                        elif seconds == 86400:  # 1 день
                            inferred_freq = "D"
                        elif 25 <= seconds / 86400 <= 35:  # ~1 месяц (в днях)
                            inferred_freq = "M"
                        elif 85 <= seconds / 86400 <= 95:  # ~3 месяца (в днях)
                            inferred_freq = "Q"
                        elif 350 <= seconds / 86400 <= 380:  # ~1 год (в днях)
                            inferred_freq = "Y"
                        else:
                            inferred_freq = "D"  # По умолчанию - день
                        
                        freq_counts[inferred_freq] = freq_counts.get(inferred_freq, 0) + 1
        
        # Возвращаем наиболее часто встречающуюся частоту
        if freq_counts:
            return max(freq_counts.items(), key=lambda x: x[1])[0]
    
    # Если id_col не указан или не удалось определить частоту по группам
    # Пробуем определить общую частоту для всего набора данных
    if len(timestamps) > 1:
        sorted_ts = timestamps.sort_values()
        freq = pd.infer_freq(sorted_ts)
        
        if freq:
            return freq
        
        # Если автоматическое определение не сработало
        diffs = sorted_ts.diff().dropna()
        if len(diffs) > 0:
            most_common_diff = diffs.value_counts().index[0]
            seconds = most_common_diff.total_seconds()
            
            if seconds == 60:  # 1 минута
                return "T"
            elif seconds == 3600:  # 1 час
                return "H"
            elif seconds == 86400:  # 1 день
                return "D"
            elif 25 <= seconds / 86400 <= 35:  # ~1 месяц (в днях)
                return "M"
            elif 85 <= seconds / 86400 <= 95:  # ~3 месяца (в днях)
                return "Q"
            elif 350 <= seconds / 86400 <= 380:  # ~1 год (в днях)
                return "Y"
    
    # Если не удалось определить частоту, возвращаем "D" (день) по умолчанию
    return "D"


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