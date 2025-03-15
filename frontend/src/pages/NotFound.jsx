import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Компонент для отображения страницы 404 (страница не найдена)
 * Показывает сообщение об ошибке и предлагает перейти на главную страницу
 */
const NotFound = () => {
  return (
    <div className="not-found-container" style={{
      textAlign: 'center',
      padding: '50px 20px',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you are looking for does not exist or has been moved.</p>
      <Link to="/" style={{
        display: 'inline-block',
        marginTop: '20px',
        padding: '10px 20px',
        background: '#007bff',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '4px'
      }}>
        Return to Home Page
      </Link>
    </div>
  );
};

export default NotFound;