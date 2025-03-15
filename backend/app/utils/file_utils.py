"""
Utilities for secure file handling
"""
import os
import hashlib
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException
import magic
import logging
import mimetypes
import pandas as pd

logger = logging.getLogger(__name__)

# Разрешенные типы MIME для загрузки
ALLOWED_MIME_TYPES = {
    'text/csv': '.csv',
    'application/vnd.ms-excel': '.csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/octet-stream': '.csv',  # Иногда CSV определяется как octet-stream
    'text/plain': '.csv'  # Иногда CSV определяется как text/plain
}

# Максимальный размер файла (100 МБ)
MAX_FILE_SIZE = 100 * 1024 * 1024

def secure_filename(filename: str) -> str:
    """
    Безопасное преобразование имени файла
    
    Args:
        filename: Исходное имя файла
        
    Returns:
        Безопасное имя файла
    """
    # Удаляем потенциально опасные символы
    filename = "".join(c for c in filename if c.isalnum() or c in "._-")
    
    # Добавляем хеш для уникальности
    name, ext = os.path.splitext(filename)
    file_hash = hashlib.md5(name.encode()).hexdigest()[:8]
    
    return f"{name}_{file_hash}{ext}"

def validate_file_content(file_path: str) -> bool:
    """
    Проверка содержимого файла на корректность
    
    Args:
        file_path: Путь к файлу
        
    Returns:
        bool: True если файл корректен, иначе False
    """
    try:
        # Пробуем прочитать файл как pandas DataFrame
        df = pd.read_csv(file_path) if file_path.endswith('.csv') else pd.read_excel(file_path)
        
        # Проверяем базовые требования к данным
        if len(df.columns) < 2:  # Минимум 2 колонки (дата и значение)
            raise ValueError("Файл должен содержать минимум 2 колонки (дата и значение)")
        
        if len(df) < 10:  # Минимум 10 строк для анализа
            raise ValueError("Файл должен содержать минимум 10 строк данных")
            
        return True
    except Exception as e:
        logger.error(f"Ошибка при проверке содержимого файла: {str(e)}")
        return False

async def save_upload_file(upload_file: UploadFile, directory: str) -> Tuple[str, str]:
    """
    Безопасное сохранение загруженного файла
    
    Args:
        upload_file: Загруженный файл
        directory: Директория для сохранения
        
    Returns:
        Tuple[str, str]: (путь к сохраненному файлу, безопасное имя файла)
        
    Raises:
        HTTPException: При ошибке проверки или сохранения файла
    """
    try:
        # Проверяем расширение файла
        if not validate_file_extension(upload_file.filename):
            raise HTTPException(
                status_code=415,
                detail="Неподдерживаемый тип файла. Разрешены только CSV и Excel файлы."
            )

        # Проверяем размер файла
        file_size = 0
        content = b""
        
        while chunk := await upload_file.read(8192):
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"Файл слишком большой. Максимальный размер: {MAX_FILE_SIZE/1024/1024}MB"
                )
            content += chunk
        
        # Определяем тип файла по содержимому
        mime = magic.Magic(mime=True)
        file_type = mime.from_buffer(content)
        
        # Проверяем тип файла, учитывая возможные вариации определения MIME-типа
        if file_type not in ALLOWED_MIME_TYPES and not any(
            allowed_type in file_type for allowed_type in ['csv', 'excel', 'spreadsheet']
        ):
            raise HTTPException(
                status_code=415,
                detail=f"Неподдерживаемый тип файла: {file_type}. Разрешены только CSV и Excel файлы."
            )
        
        # Создаем безопасное имя файла
        safe_filename = secure_filename(upload_file.filename)
        file_path = os.path.join(directory, safe_filename)
        
        # Создаем директорию, если она не существует
        os.makedirs(directory, exist_ok=True)
        
        # Сохраняем файл
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Проверяем содержимое файла
        if not validate_file_content(file_path):
            os.remove(file_path)  # Удаляем некорректный файл
            raise HTTPException(
                status_code=400,
                detail="Некорректное содержимое файла. Файл должен содержать минимум 2 колонки и 10 строк данных."
            )
        
        logger.info(f"Файл {safe_filename} успешно сохранен в {file_path}")
        return file_path, safe_filename
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при сохранении файла: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении файла: {str(e)}")

def validate_file_extension(filename: str) -> bool:
    """
    Проверка расширения файла
    
    Args:
        filename: Имя файла
        
    Returns:
        bool: True если расширение допустимо, иначе False
    """
    _, ext = os.path.splitext(filename)
    return ext.lower() in ['.csv', '.xlsx', '.xls']

def clean_old_files(directory: str, max_age_hours: int = 24) -> None:
    """
    Удаление старых временных файлов
    
    Args:
        directory: Директория с файлами
        max_age_hours: Максимальный возраст файлов в часах
    """
    try:
        import time
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        if os.path.exists(directory):
            for filename in os.listdir(directory):
                file_path = os.path.join(directory, filename)
                if os.path.isfile(file_path):
                    file_age = current_time - os.path.getmtime(file_path)
                    if file_age > max_age_seconds:
                        os.remove(file_path)
                        logger.info(f"Удален старый файл: {filename}")
                    
    except Exception as e:
        logger.error(f"Ошибка при очистке старых файлов: {str(e)}")