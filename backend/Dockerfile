FROM python:3.10-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    libmagic1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Копирование и установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Запуск приложения
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]