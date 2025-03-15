# Базовый образ
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package.json ./
COPY scripts/update-deps.sh ./scripts/

# Делаем скрипт исполняемым
RUN chmod +x ./scripts/update-deps.sh

# Обновляем lock-файл и устанавливаем зависимости
RUN ./scripts/update-deps.sh
RUN npm install

# Копируем остальные файлы проекта
COPY . .

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
