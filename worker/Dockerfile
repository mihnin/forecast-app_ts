FROM python:3.10-slim

WORKDIR /app

# Устанавливаем необходимые системные зависимости
RUN apt-get update && apt-get install -y \
    build-essential \
    libmagic1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Копируем только минимально необходимые файлы
COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Создаем необходимые директории
RUN mkdir -p app/core app/services/forecasting app/services/features app/services/data app/models

# Копируем только необходимые файлы приложения
COPY backend/app/core/config.py app/core/
COPY backend/app/core/worker.py app/core/
COPY backend/app/core/queue.py app/core/
COPY backend/app/services/forecasting/* app/services/forecasting/
COPY backend/app/services/features/* app/services/features/
COPY backend/app/services/data/data_processing.py app/services/data/

# Создаем пустые файлы __init__.py, чтобы Python модули работали корректно
RUN touch app/__init__.py app/core/__init__.py app/services/__init__.py app/services/forecasting/__init__.py \
    app/services/features/__init__.py app/services/data/__init__.py

# Запускаем Celery воркер
CMD ["python", "-m", "celery", "-A", "app.core.worker", "worker", "--loglevel=info"]