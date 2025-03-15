# Стадия сборки
FROM node:16-alpine as build

WORKDIR /app

# Копируем файлы package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости с принудительной чистой установкой
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Настраиваем nginx
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]