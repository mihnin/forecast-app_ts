import React from 'react';
import { Result, Button } from 'antd';

const ErrorDisplay = ({ error, onRetry }) => {
  let errorMessage = 'Произошла ошибка';
  
  if (error?.response?.data?.detail) {
    errorMessage = error.response.data.detail;
  } else if (error?.message) {
    errorMessage = error.message;
  }
  
  return (
    <Result
      status="error"
      title="Ошибка при выполнении запроса"
      subTitle={errorMessage}
      extra={
        onRetry && (
          <Button type="primary" onClick={onRetry}>
            Попробовать снова
          </Button>
        )
      }
    />
  );
};

export default ErrorDisplay;