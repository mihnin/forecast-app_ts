FROM python:3.10-slim

WORKDIR /app

# Устанавливаем необходимые системные зависимости
RUN apt-get update && apt-get install -y \
    build-essential \
    libmagic1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements и устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальные файлы проекта
COPY . .

# Запускаем Celery воркер
CMD ["celery", "-A", "app.core.worker", "worker", "--loglevel=info"]