import pandas as pd
import numpy as np
import os
import logging
import traceback  # Добавляем для подробного логирования ошибок
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
        logger.error(f"Файл не найден: {file_path}")
        raise HTTPException(status_code=404, detail=f"Файл не найден: {file_path}")
    
    file_ext = os.path.splitext(file_path)[1].lower()
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    
    logger.info(f"Обработка файла: {file_path} ({file_size_mb:.2f} МБ)")
    
    try:
        # Проверка формата файла
        if file_ext == '.csv':
            if file_size_mb > 100 and chunk_size:
                df = load_csv_in_chunks(file_path, chunk_size)
            else:
                df = load_csv_standard(file_path)
        elif file_ext in ('.xls', '.xlsx'):
            if file_size_mb > 100:
                logger.warning("Большие Excel-файлы могут загружаться медленно")
            try:
                # Более безопасное чтение Excel-файлов с отключенным преобразованием типов
                df = pd.read_excel(file_path, engine='openpyxl', 
                                   dtype_backend='numpy_nullable')
            except ImportError:
                # Если openpyxl не доступен, используем xlrd
                logger.warning("openpyxl не установлен, используем стандартный механизм чтения Excel")
                df = pd.read_excel(file_path)
        else:
            logger.error(f"Неподдерживаемый формат файла: {file_ext}")
            raise HTTPException(status_code=400, detail=f"Неподдерживаемый формат файла: {file_ext}")
        
        # Проверка на пустой датафрейм
        if df.empty:
            logger.error("Загруженный файл не содержит данных")
            raise HTTPException(status_code=400, detail="Файл не содержит данных")
        
        # Проверка на минимальное количество колонок
        if len(df.columns) < 2:
            logger.error("Загруженный файл должен содержать минимум 2 колонки")
            raise HTTPException(status_code=400, detail="Файл должен содержать минимум 2 колонки (дата и значение)")
        
        # Создаем информацию о датасете без создания дополнительных копий данных
        missing_values = {col: int(df[col].isna().sum()) for col in df.columns}
        info = DatasetInfo(
            rows=len(df),
            columns=len(df.columns),
            column_names=df.columns.tolist(),
            missing_values=missing_values
        )
        
        logger.info(f"Файл успешно загружен: {len(df)} строк, {len(df.columns)} колонок")
        
        return df, info
    
    except pd.errors.EmptyDataError:
        logger.error("Пустой CSV-файл или нет данных")
        raise HTTPException(status_code=400, detail="Файл пуст или не содержит данных")
    except pd.errors.ParserError as e:
        logger.error(f"Ошибка парсинга: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Ошибка чтения файла: {str(e)}")
    except MemoryError:
        logger.error("Недостаточно памяти для загрузки файла")
        raise HTTPException(status_code=507, 
                           detail=f"Недостаточно памяти для загрузки файла размером {file_size_mb:.2f} МБ. Попробуйте разделить файл на более мелкие части.")
    except Exception as e:
        # Сохраняем подробный стек ошибки для диагностики
        logger.error(f"Критическая ошибка при обработке файла: {str(e)}")
        logger.error(traceback.format_exc())
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
        
        # Пробуем определить кодировку
        encodings = ['utf-8', 'latin1', 'cp1251', 'ISO-8859-1']
        
        for encoding in encodings:
            try:
                # Чтение файла с определенной кодировкой
                if sep is None:
                    df = pd.read_csv(file_path, sep=None, engine='python', 
                                     encoding=encoding, errors='replace', thousands=' ',
                                     memory_map=True, low_memory=True)
                else:
                    df = pd.read_csv(file_path, sep=sep, encoding=encoding, 
                                    errors='replace', thousands=' ',
                                    memory_map=True, low_memory=True)
                
                # Если дошли до этого места, значит чтение успешно
                logger.info(f"Файл прочитан с кодировкой {encoding}")
                break
            except UnicodeDecodeError:
                if encoding == encodings[-1]:  # Последняя попытка
                    logger.error("Не удалось определить кодировку файла")
                    raise
                continue
            except Exception as e:
                logger.error(f"Ошибка при чтении с кодировкой {encoding}: {str(e)}")
                raise
        
        if df.shape[1] == 1:
            logger.warning("Автоопределение разделителя нашло только 1 столбец. Возможно неправильно определен разделитель.")
        
        return df
    except Exception as e:
        logger.error(f"Ошибка при стандартной загрузке CSV: {str(e)}")
        logger.error(traceback.format_exc())
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
        
        # Определение кодировки
        encodings = ['utf-8', 'latin1', 'cp1251', 'ISO-8859-1']
        encoding_to_use = 'utf-8'  # По умолчанию
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    f.read(4096)
                encoding_to_use = encoding
                break
            except UnicodeDecodeError:
                continue
        
        logger.info(f"Используется кодировка {encoding_to_use} для чтения по частям")
        
        # Чтение по частям с мониторингом памяти
        chunks = []
        total_rows = 0
        chunk_iter = pd.read_csv(
            file_path, 
            sep=sep if sep else ',',  # Используем определенный разделитель или запятую по умолчанию
            engine='python' if sep is None else 'c',
            chunksize=chunk_size, 
            encoding=encoding_to_use, 
            errors='replace',
            thousands=' ',
            low_memory=True,
            memory_map=True,  # Использование mmap для снижения нагрузки на память
            dtype_backend='numpy_nullable'  # Использование более эффективных типов данных
        )
        
        import gc
        for i, chunk in enumerate(chunk_iter):
            # Оптимизация типов данных для экономии памяти
            for col in chunk.select_dtypes(include=['float64']).columns:
                # Пробуем конвертировать float64 в float32, если диапазон позволяет
                if chunk[col].min() >= -3.4e38 and chunk[col].max() <= 3.4e38:
                    chunk[col] = chunk[col].astype('float32')
            
            for col in chunk.select_dtypes(include=['int64']).columns:
                # Пробуем конвертировать int64 в более компактные типы
                if chunk[col].min() >= -32768 and chunk[col].max() <= 32767:
                    chunk[col] = chunk[col].astype('int16')
                elif chunk[col].min() >= -2147483648 and chunk[col].max() <= 2147483647:
                    chunk[col] = chunk[col].astype('int32')
            
            chunks.append(chunk)
            total_rows += len(chunk)
            logger.info(f"Загружен чанк {i+1}, строк: {len(chunk)}, всего строк: {total_rows}")
            
            # Принудительно вызываем сборщик мусора после каждого чанка
            gc.collect()
        
        # Проверяем, есть ли данные
        if not chunks:
            logger.error("CSV файл не содержит данных")
            raise ValueError("CSV файл не содержит данных")
        
        # Объединяем чанки с оптимизацией памяти
        logger.info(f"Объединение {len(chunks)} чанков")
        try:
            # Пробуем использовать pandas concat
            df = pd.concat(chunks, ignore_index=True, copy=False)
        except MemoryError:
            # При нехватке памяти пробуем альтернативный подход
            logger.warning("Недостаточно памяти для стандартного объединения, пробуем альтернативный метод")
            # Сохраняем первый чанк как базу
            df = chunks[0]
            # Добавляем остальные чанки по очереди
            for i, chunk in enumerate(chunks[1:], 1):
                df = pd.concat([df, chunk], ignore_index=True, copy=False)
                # Удаляем использованный чанк для освобождения памяти
                chunks[i] = None
                gc.collect()
        
        logger.info(f"Успешно загружен большой CSV по частям. Всего строк: {len(df)}")
        
        return df
    except MemoryError as e:
        logger.error(f"Недостаточно памяти при загрузке CSV: {str(e)}")
        logger.error(traceback.format_exc())
        raise MemoryError(f"Недостаточно памяти для загрузки файла. Попробуйте использовать меньший размер чанка или разделить файл.")
    except Exception as e:
        logger.error(f"Ошибка при загрузке CSV чанками: {str(e)}")
        logger.error(traceback.format_exc())
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
    import gc
    
    # Проверяем наличие необходимых колонок
    required_cols = [id_col, timestamp_col, target_col]
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Отсутствуют необходимые колонки: {', '.join(missing_cols)}")
    
    # Создаем копию только необходимых колонок для экономии памяти
    cols_to_keep = [id_col, timestamp_col, target_col]
    # Добавляем другие колонки, которые могут быть полезны для анализа
    extra_cols = [col for col in df.columns if col not in [id_col, timestamp_col, target_col]]
    cols_to_keep.extend(extra_cols)
    
    df_local = df[cols_to_keep].copy(deep=False)  # Используем shallow copy
    
    # Убедимся, что колонка с датами имеет правильный тип
    if not pd.api.types.is_datetime64_any_dtype(df_local[timestamp_col]):
        try:
            df_local[timestamp_col] = pd.to_datetime(df_local[timestamp_col], errors="coerce")
        except Exception as e:
            logger.error(f"Ошибка преобразования даты: {str(e)}")
            raise ValueError(f"Не удалось преобразовать колонку {timestamp_col} в тип datetime: {str(e)}") 
    
    # Проверяем на наличие NaT в колонке с датами
    if df_local[timestamp_col].isna().any():
        na_count = df_local[timestamp_col].isna().sum()
        logger.warning(f"Обнаружены пропущенные значения в колонке даты ({na_count} шт.). Эти строки будут удалены.")
        df_local = df_local.dropna(subset=[timestamp_col])
    
    # Проверка на дубликаты дат для каждого ID
    duplicate_mask = df_local.duplicated(subset=[id_col, timestamp_col], keep='first')
    if duplicate_mask.any():
        dup_count = duplicate_mask.sum()
        logger.warning(f"Обнаружены дубликаты дат для ID ({dup_count} шт.). Сохраняем только первые значения.")
        df_local = df_local.drop_duplicates(subset=[id_col, timestamp_col], keep='first')
    
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
    
    # Принудительно вызываем сборщик мусора
    gc.collect()
    
    # Определяем начальные и конечные даты для каждого временного ряда
    if freq and df_local['item_id'].nunique() <= 1000:  # Ограничиваем для предотвращения excessive memory usage
        # Преобразуем в мультииндекс для упрощения работы с временными рядами
        df_local = df_local.set_index(["item_id", "timestamp"])
    
        # Для каждого ID выполняем преобразование частоты
        result_pieces = []
        unique_ids = df_local.index.get_level_values("item_id").unique()
        
        # Предупреждение при большом количестве временных рядов
        if len(unique_ids) > 100:
            logger.warning(
                f"Большое количество временных рядов ({len(unique_ids)}). " +
                "Преобразование частоты может занять длительное время."
            )
        
        for idx, item_id in enumerate(unique_ids):
            try:
                # Определяем дату начала и конца для конкретного ряда
                group = df_local.loc[item_id]
                start_date = group.index.min()
                end_date = group.index.max()
                
                # Создаем регулярный временной индекс в зависимости от частоты
                try:
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
                except Exception as e:
                    logger.error(f"Ошибка при создании временного индекса для {item_id}: {str(e)}")
                    # Используем исходные даты в качестве резервного варианта
                    idx = group.index
                
                # Создаем полный мультииндекс для данного ID
                multi_idx = pd.MultiIndex.from_product([[item_id], idx], names=["item_id", "timestamp"])
                
                # Переиндексируем данные группы
                piece = group.reindex(idx)
                piece.index = multi_idx
                
                # Заполняем пропуски в зависимости от метода
                if fill_method == "ffill":
                    piece = piece.fillna(method="ffill")
                    # Дополнительно заполняем значения в начале ряда методом bfill, если они пропущены
                    piece = piece.fillna(method="bfill")
                elif fill_method == "linear":
                    for col in piece.columns:
                        if pd.api.types.is_numeric_dtype(piece[col]):
                            piece[col] = piece[col].interpolate(method="linear")
                elif fill_method == "zero":
                    piece = piece.fillna(0)
                
                result_pieces.append(piece)
                
                # Логирование прогресса
                if (idx + 1) % 100 == 0 or idx == len(unique_ids) - 1:
                    logger.info(f"Обработано {idx + 1}/{len(unique_ids)} временных рядов")
                
                # Периодически вызываем сборщик мусора при большом количестве рядов
                if (idx + 1) % 500 == 0:
                    gc.collect()
                
            except Exception as e:
                logger.error(f"Ошибка при обработке временного ряда {item_id}: {str(e)}")
                logger.error(traceback.format_exc())
                # Пропускаем проблемный ряд и продолжаем с остальными
                continue
        
        # Собираем все кусочки вместе
        if result_pieces:
            try:
                df_local = pd.concat(result_pieces)
                # Принудительная сборка мусора после объединения
                gc.collect()
                # Сбрасываем индекс
                df_local = df_local.reset_index()
            except MemoryError:
                logger.error("Недостаточно памяти при объединении временных рядов")
                # Альтернативный подход при нехватке памяти
                df_base = result_pieces[0]
                for piece in result_pieces[1:]:
                    df_base = pd.concat([df_base, piece])
                    gc.collect()
                df_local = df_base.reset_index()
        else:
            logger.warning("Не удалось обработать ни один временной ряд. Возвращаем исходные данные.")
            # Восстанавливаем исходные данные
            df_local = df[cols_to_keep].copy()
            df_local = df_local.rename(columns=column_mapping)
            # Убедимся, что колонка с датами имеет правильный тип
            if not pd.api.types.is_datetime64_any_dtype(df_local["timestamp"]):
                df_local["timestamp"] = pd.to_datetime(df_local["timestamp"], errors="coerce")
    
    logger.info(f"Преобразование в формат временных рядов завершено. Строк: {len(df_local)}")
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