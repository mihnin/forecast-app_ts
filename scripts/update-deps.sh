#!/bin/bash

# Скрипт для обновления package-lock.json перед установкой зависимостей
echo "Обновление package-lock.json..."

# Удаляем существующий lock-файл, если он есть
if [ -f package-lock.json ]; then
  rm package-lock.json
fi

# Создаем новый lock-файл
npm install --package-lock-only

echo "Lock-файл успешно обновлен"
