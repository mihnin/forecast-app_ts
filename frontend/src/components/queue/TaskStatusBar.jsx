import React from 'react';
import { Card, Progress, Typography, Space, Tag } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  SyncOutlined, 
  ExclamationCircleOutlined,
  HourglassOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

// Компонент для отображения статуса задачи и позиции в очереди
const TaskStatusBar = ({ status, position, createdAt, updatedAt, estimatedTime }) => {
  // Определение иконки и цвета для статуса
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { 
          icon: <HourglassOutlined />, 
          color: 'orange', 
          text: 'В очереди',
          percent: 0 
        };
      case 'executing':
        return { 
          icon: <SyncOutlined spin />, 
          color: 'blue', 
          text: 'Выполняется',
          percent: 50 
        };
      case 'completed':
        return { 
          icon: <CheckCircleOutlined />, 
          color: 'green', 
          text: 'Завершено',
          percent: 100 
        };
      case 'failed':
        return { 
          icon: <ExclamationCircleOutlined />, 
          color: 'red', 
          text: 'Ошибка',
          percent: 100 
        };
      default:
        return { 
          icon: <ClockCircleOutlined />, 
          color: 'gray', 
          text: 'Неизвестно',
          percent: 0 
        };
    }
  };

  const statusInfo = getStatusInfo(status);
  
  // Форматирование даты
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('ru-RU');
  };

  // Расчет времени ожидания
  const getWaitingInfo = () => {
    if (status === 'pending' && position > 0) {
      const waitTime = Math.max(1, Math.round(estimatedTime * position / 60));
      return `Примерное время ожидания: ${waitTime} мин.`;
    }
    if (status === 'executing') {
      return 'Задача выполняется...';
    }
    if (status === 'completed') {
      return 'Задача завершена';
    }
    if (status === 'failed') {
      return 'Задача завершилась с ошибкой';
    }
    return '';
  };

  return (
    <Card className="status-card">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Tag color={statusInfo.color} icon={statusInfo.icon} style={{ padding: '5px 10px' }}>
              {statusInfo.text}
            </Tag>
            {position > 0 && status === 'pending' && (
              <Tag color="purple">
                <Space>
                  <Text>Позиция в очереди: {position}</Text>
                </Space>
              </Tag>
            )}
          </Space>
          <Space>
            <Text type="secondary">Создано: {formatDate(createdAt)}</Text>
            {status !== 'pending' && (
              <Text type="secondary">Обновлено: {formatDate(updatedAt)}</Text>
            )}
          </Space>
        </div>
        
        <Progress 
          percent={statusInfo.percent} 
          status={status === 'failed' ? 'exception' : status === 'completed' ? 'success' : 'active'} 
          showInfo={status !== 'pending'} 
        />
        
        <Text>{getWaitingInfo()}</Text>
      </Space>
    </Card>
  );
};

export default TaskStatusBar;