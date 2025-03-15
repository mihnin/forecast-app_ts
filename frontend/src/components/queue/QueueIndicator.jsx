import React from 'react';
import { Alert, Space, Badge, Typography, Progress, Tooltip, Statistic, Row, Col, Card } from 'antd';
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  FieldTimeOutlined
} from '@ant-design/icons';

const { Text } = Typography;

// Компонент для отображения состояния очереди задач на разных страницах
const QueueIndicator = ({ 
  totalTasks, 
  pendingTasks, 
  executingTasks, 
  completedTasks, 
  failedTasks,
  averageWaitingTime,
  averageExecutionTime 
}) => {
  // Выбор типа и сообщения оповещения в зависимости от состояния очереди
  let alertType = 'info';
  let alertMessage = '';
  let icon = <ClockCircleOutlined className="status-icon" />;
  
  // Процент загрузки сервера (условно)
  const serverLoad = Math.min(100, (pendingTasks * 2 + executingTasks * 3) * 10);
  
  // Форматирование времени в удобный вид
  const formatTime = (seconds) => {
    if (!seconds) return '—';
    
    if (seconds < 60) {
      return `${Math.round(seconds)} сек.`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)} мин.`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return `${hours} ч. ${minutes} мин.`;
    }
  };

  if (pendingTasks === 0 && executingTasks === 0) {
    alertType = 'success';
    alertMessage = 'Сервер свободен, задачи будут обработаны сразу';
    icon = <CheckCircleOutlined className="status-icon" />;
  } else if (pendingTasks > 5) {
    alertType = 'warning';
    alertMessage = `Система загружена. В очереди ${pendingTasks} задач, ожидание может занять продолжительное время`;
    icon = <ExclamationCircleOutlined className="status-icon" />;
  } else if (pendingTasks > 0) {
    alertType = 'info';
    alertMessage = `В очереди ${pendingTasks} задач. Ваша задача будет добавлена в очередь`;
    icon = <ClockCircleOutlined className="status-icon" />;
  } else if (executingTasks > 0 && pendingTasks === 0) {
    alertType = 'info';
    alertMessage = 'Выполняются задачи, но очередь свободна. Ваша задача будет обработана скоро';
    icon = <SyncOutlined spin className="status-icon" />;
  }

  // Статус загрузки системы
  const getLoadStatus = () => {
    if (serverLoad < 30) {
      return { status: 'success', text: 'Низкая' };
    } else if (serverLoad < 70) {
      return { status: 'normal', text: 'Средняя' };
    } else {
      return { status: 'exception', text: 'Высокая' };
    }
  };
  
  const loadStatus = getLoadStatus();

  return (
    <div className="queue-indicator">
      <Alert
        className="queue-indicator"
        type={alertType}
        icon={icon}
        message={alertMessage}
        description={
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} lg={14}>
              <Space size="large">
                <Badge color="blue" text={<Text strong>{`Всего задач: ${totalTasks}`}</Text>} />
                <Badge color="gold" text={<Text strong>{`В очереди: ${pendingTasks}`}</Text>} />
                <Badge color="cyan" text={<Text strong>{`Выполняется: ${executingTasks}`}</Text>} />
                <Badge color="green" text={<Text strong>{`Завершено: ${completedTasks}`}</Text>} />
                <Badge color="red" text={<Text strong>{`Ошибок: ${failedTasks}`}</Text>} />
              </Space>
            </Col>
            <Col xs={24} lg={10}>
              <Card size="small" bordered={false} style={{ background: 'transparent' }}>
                <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Tooltip title="Среднее время ожидания в очереди">
                    <Statistic 
                      value={formatTime(averageWaitingTime)} 
                      title="Ожидание" 
                      prefix={<ClockCircleOutlined />} 
                      valueStyle={{ fontSize: '14px' }}
                    />
                  </Tooltip>
                  <Tooltip title="Среднее время выполнения задачи">
                    <Statistic 
                      value={formatTime(averageExecutionTime)} 
                      title="Выполнение" 
                      prefix={<FieldTimeOutlined />} 
                      valueStyle={{ fontSize: '14px' }}
                    />
                  </Tooltip>
                  <Tooltip title="Загрузка системы">
                    <div>
                      <Text type="secondary">Загрузка:</Text> <Text strong>{loadStatus.text}</Text>
                      <Progress percent={serverLoad} status={loadStatus.status} showInfo={false} size="small" />
                    </div>
                  </Tooltip>
                </Space>
              </Card>
            </Col>
          </Row>
        }
        showIcon
      />
    </div>
  );
};

export default QueueIndicator;