# Базовый образ
FROM node:16-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей фронтенда
COPY frontend/package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем остальные файлы фронтенда
COPY frontend/ ./

# Проверяем наличие важных файлов перед сборкой
RUN test -f public/index.html || (echo "Error: public/index.html missing!" && exit 1)

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
