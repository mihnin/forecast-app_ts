import React, { useState } from 'react';
import { Card, Progress, Typography, Space, Tag, Button, Tooltip, Modal, Table, Badge } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  SyncOutlined, 
  ExclamationCircleOutlined,
  HourglassOutlined,
  ReloadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

// Инициализация dayjs для отображения относительного времени
dayjs.extend(relativeTime);
dayjs.locale('ru');

const { Text, Title } = Typography;

// Компонент для отображения статуса задачи и позиции в очереди
const TaskStatusBar = ({ 
  status, 
  position, 
  progress = 0,
  createdAt, 
  updatedAt, 
  estimatedEndTime,
  stage,
  error,
  onRetry,
  logs = [],
  onRefreshLogs,
  estimatedTime 
}) => {
  const [logsVisible, setLogsVisible] = useState(false);

  // Определение иконки и цвета для статуса
  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { 
          icon: <HourglassOutlined />, 
          color: 'orange', 
          text: 'В очереди'
        };
      case 'executing':
        return { 
          icon: <SyncOutlined spin />, 
          color: 'blue', 
          text: 'Выполняется'
        };
      case 'completed':
        return { 
          icon: <CheckCircleOutlined />, 
          color: 'green', 
          text: 'Завершено'
        };
      case 'failed':
        return { 
          icon: <ExclamationCircleOutlined />, 
          color: 'red', 
          text: 'Ошибка'
        };
      default:
        return { 
          icon: <ClockCircleOutlined />, 
          color: 'gray', 
          text: 'Неизвестно'
        };
    }
  };

  const statusInfo = getStatusInfo(status);
  
  // Форматирование даты
  const formatDate = (timestamp) => {
    return dayjs(timestamp * 1000).format('DD.MM.YYYY HH:mm:ss');
  };

  // Расчет времени с момента создания/обновления
  const getTimeAgo = (timestamp) => {
    return dayjs(timestamp * 1000).fromNow();
  };

  // Расчет оставшегося времени
  const getRemainingTime = () => {
    if (status === 'pending' && position > 0 && estimatedTime) {
      const waitTimeMin = Math.max(1, Math.round(estimatedTime * position / 60));
      return `≈ ${waitTimeMin} мин.`;
    }
    
    if (status === 'executing' && estimatedEndTime) {
      const now = dayjs();
      const endTime = dayjs(estimatedEndTime * 1000);
      const diff = endTime.diff(now, 'second');
      
      if (diff <= 0) {
        return 'завершается...';
      }
      
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      
      if (minutes > 0) {
        return `≈ ${minutes} мин. ${seconds} сек.`;
      }
      
      return `≈ ${seconds} сек.`;
    }
    
    return '';
  };

  // Получение текста о статусе задачи
  const getStatusText = () => {
    if (status === 'pending' && position > 0) {
      return `Задача ожидает в очереди, позиция: ${position}`;
    }
    if (status === 'executing') {
      return stage ? `Задача выполняется: ${stage}` : 'Задача выполняется...';
    }
    if (status === 'completed') {
      return 'Задача успешно завершена';
    }
    if (status === 'failed') {
      return `Задача завершилась с ошибкой: ${error || 'неизвестная ошибка'}`;
    }
    return '';
  };

  // Обработчик показа логов
  const handleShowLogs = () => {
    if (onRefreshLogs) {
      onRefreshLogs();
    }
    setLogsVisible(true);
  };

  // Столбцы для таблицы логов
  const logColumns = [
    {
      title: 'Время',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => formatDate(timestamp),
      width: 180,
    },
    {
      title: 'Уровень',
      dataIndex: 'level',
      key: 'level',
      render: (level) => {
        const color = level === 'ERROR' ? 'red' : level === 'WARNING' ? 'orange' : 'blue';
        return <Badge color={color} text={level} />;
      },
      width: 100,
    },
    {
      title: 'Сообщение',
      dataIndex: 'message',
      key: 'message',
    }
  ];

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
                  <ClockCircleOutlined />
                  <Text>Позиция в очереди: {position}</Text>
                </Space>
              </Tag>
            )}
            {stage && status === 'executing' && (
              <Tag color="cyan">
                {stage}
              </Tag>
            )}
          </Space>
          
          <Space>
            <Text type="secondary">Создано: {getTimeAgo(createdAt)}</Text>
            {status !== 'pending' && (
              <Text type="secondary">Обновлено: {getTimeAgo(updatedAt)}</Text>
            )}
            <Button 
              size="small" 
              icon={<FileTextOutlined />} 
              onClick={handleShowLogs}
            >
              Логи
            </Button>
            {status === 'failed' && onRetry && (
              <Button 
                size="small" 
                type="primary" 
                danger 
                icon={<ReloadOutlined />} 
                onClick={onRetry}
              >
                Повторить
              </Button>
            )}
          </Space>
        </div>
        
        <Progress 
          percent={progress} 
          status={
            status === 'failed' ? 'exception' : 
            status === 'completed' ? 'success' : 
            'active'
          } 
          showInfo={true} 
        />
        
        <Space size="large" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text>{getStatusText()}</Text>
          {getRemainingTime() && (
            <Tooltip title="Оценка оставшегося времени">
              <Tag color="blue">
                <ClockCircleOutlined /> Осталось: {getRemainingTime()}
              </Tag>
            </Tooltip>
          )}
        </Space>
      </Space>

      {/* Модальное окно для отображения логов задачи */}
      <Modal
        title="Логи выполнения задачи"
        open={logsVisible}
        onCancel={() => setLogsVisible(false)}
        footer={[
          <Button key="refresh" onClick={onRefreshLogs} icon={<ReloadOutlined />}>
            Обновить
          </Button>,
          <Button key="close" type="primary" onClick={() => setLogsVisible(false)}>
            Закрыть
          </Button>
        ]}
        width={800}
      >
        <Table 
          dataSource={logs}
          columns={logColumns}
          rowKey={(record, index) => `${record.timestamp}-${index}`}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Modal>
    </Card>
  );
};

export default TaskStatusBar;