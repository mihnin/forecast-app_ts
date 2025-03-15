# Базовый образ
FROM node:16-alpine as builder

WORKDIR /app

# Копируем файлы зависимостей фронтенда
COPY frontend/package*.json ./

# Обновляем lock-файл и устанавливаем зависимости
RUN npm install

# Копируем остальные файлы фронтенда
COPY frontend/ ./

# Сборка проекта
RUN npm run build

# Продакшн образ
FROM nginx:alpine

# Копируем результаты сборки в nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
