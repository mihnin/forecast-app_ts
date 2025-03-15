/**
 * Вспомогательный скрипт для исправления зависимостей.
 * Запускается командой: node scripts/fix-dependencies.js
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Путь к package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');

console.log('Начинается процесс восстановления зависимостей...');

try {
  // Удаляем node_modules, если они существуют
  if (fs.existsSync('node_modules')) {
    console.log('Удаление папки node_modules...');
    if (process.platform === 'win32') {
      execSync('rmdir /s /q node_modules', { stdio: 'inherit' });
    } else {
      execSync('rm -rf node_modules', { stdio: 'inherit' });
    }
  }

  // Удаляем package-lock.json, если он существует
  if (fs.existsSync('package-lock.json')) {
    console.log('Удаление package-lock.json...');
    fs.unlinkSync('package-lock.json');
  }

  // Создаем свежий package-lock.json
  console.log('Создание нового package-lock.json...');
  execSync('npm install --package-lock-only', { stdio: 'inherit' });

  // Устанавливаем зависимости
  console.log('Установка зависимостей...');
  execSync('npm install', { stdio: 'inherit' });

  console.log('Зависимости успешно восстановлены!');
} catch (error) {
  console.error('Произошла ошибка при восстановлении зависимостей:', error);
  process.exit(1);
}
