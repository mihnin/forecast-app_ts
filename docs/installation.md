# Инструкция по установке приложения

## Предварительные требования:

- Node.js (версия 16 или выше)
- npm (версия 7 или выше)
- Python (для работы с бэкендом)
- Redis (для работы с очередью задач)

## Установка для разработки:

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/your-username/forecast-app_ts.git
   cd forecast-app_ts
   ```

2. Восстановление зависимостей:
   ```bash
   # Используйте скрипт для автоматического восстановления зависимостей:
   node scripts/fix-dependencies.js

   # Или выполните шаги вручную:
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Запуск приложения в режиме разработки:
   ```bash
   npm run dev
   ```

## Сборка для продакшн:

```bash
npm run build
```

## Docker:

Для запуска в Docker:

```bash
docker build -t forecast-app .
docker run -p 8080:80 forecast-app
```

## Частые проблемы:

### Ошибки при установке зависимостей:

Если вы сталкиваетесь с ошибками при выполнении `npm ci` или `npm install`, попробуйте выполнить:

```bash
node scripts/fix-dependencies.js
```

Это удалит существующие node_modules и package-lock.json, а затем выполнит чистую установку.
