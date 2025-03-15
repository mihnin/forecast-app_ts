# Стадия сборки
FROM node:16-alpine as build

WORKDIR /app

# Копируем файлы package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Создаем production build
RUN npm run build

# Стадия production
FROM nginx:alpine

# Копируем результаты сборки
COPY --from=build /app/build /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Добавляем скрипт для правильной обработки маршрутов React
RUN echo $'\n\
location / {\n\
    root /usr/share/nginx/html;\n\
    try_files $uri $uri/ /index.html;\n\
    add_header Cache-Control "no-store, no-cache, must-revalidate";\n\
}\n'\
>> /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]