import React from 'react';
import { Alert, Space, Badge, Typography } from 'antd';
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';

const { Text } = Typography;

// Компонент для отображения состояния очереди задач на разных страницах
const QueueIndicator = ({ totalTasks, pendingTasks, executingTasks, completedTasks, failedTasks }) => {
  // Выбор типа и сообщения оповещения в зависимости от состояния очереди
  let alertType = 'info';
  let alertMessage = '';
  let icon = <ClockCircleOutlined className="status-icon" />;

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

  return (
    <Alert
      className="queue-indicator"
      type={alertType}
      icon={icon}
      message={
        <Space direction="vertical" size="small">
          <div>{alertMessage}</div>
          <Space size="middle">
            <Badge color="blue" text={<Text strong>{`Всего задач: ${totalTasks}`}</Text>} />
            <Badge color="gold" text={<Text strong>{`В очереди: ${pendingTasks}`}</Text>} />
            <Badge color="cyan" text={<Text strong>{`Выполняется: ${executingTasks}`}</Text>} />
            <Badge color="green" text={<Text strong>{`Завершено: ${completedTasks}`}</Text>} />
            <Badge color="red" text={<Text strong>{`Ошибок: ${failedTasks}`}</Text>} />
          </Space>
        </Space>
      }
    />
  );
};

export default QueueIndicator;