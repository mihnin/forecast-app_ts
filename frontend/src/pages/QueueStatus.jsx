import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Space, Tag, Button, Tooltip, Modal, Collapse } from 'antd';
import { 
  SyncOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  HourglassOutlined,
  EyeOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useQueueInfo } from '../hooks/useQueueStatus';
import QueueIndicator from '../components/queue/QueueIndicator';
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const QueueStatus = () => {
  const { queueInfo, error, isLoading, refetch } = useQueueInfo();
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Форматирование даты
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('ru-RU');
  };

  // Открытие модального окна с деталями задачи
  const handleViewTask = (task) => {
    setSelectedTask(task);
    setModalVisible(true);
  };

  // Формат отображения статуса задачи
  const renderStatus = (status) => {
    switch (status) {
      case 'pending':
        return <Tag icon={<HourglassOutlined />} color="orange">В очереди</Tag>;
      case 'executing':
        return <Tag icon={<SyncOutlined spin />} color="blue">Выполняется</Tag>;
      case 'completed':
        return <Tag icon={<CheckCircleOutlined />} color="green">Завершено</Tag>;
      case 'failed':
        return <Tag icon={<CloseCircleOutlined />} color="red">Ошибка</Tag>;
      default:
        return <Tag color="default">Неизвестно</Tag>;
    }
  };

  // Отображение типа задачи
  const renderTaskType = (task) => {
    const taskTypeMap = {
      'training': 'Обучение модели',
      'prediction': 'Прогнозирование',
      'analysis': 'Анализ данных'
    };
    
    return taskTypeMap[task.task_type] || task.task_type;
  };

  // Определение колонок таблицы
  const columns = [
    {
      title: 'ID задачи',
      dataIndex: 'task_id',
      key: 'task_id',
      ellipsis: true,
      width: 220,
    },
    {
      title: 'Тип',
      dataIndex: 'task_type',
      key: 'task_type',
      render: (_, record) => renderTaskType(record),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status) => renderStatus(status),
    },
    {
      title: 'Позиция',
      dataIndex: 'position',
      key: 'position',
      render: (position) => position === 0 ? '-' : position,
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (timestamp) => formatDate(timestamp),
    },
    {
      title: 'Обновлена',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (timestamp) => formatDate(timestamp),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Просмотр деталей">
            <Button 
              icon={<EyeOutlined />} 
              onClick={() => handleViewTask(record)} 
              type="primary" 
              ghost
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (isLoading) {
    return <Loading tip="Загрузка информации об очереди..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>Статус задач</Title>
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={refetch}
          >
            Обновить
          </Button>
        </div>

        {queueInfo && (
          <QueueIndicator 
            totalTasks={queueInfo.total_tasks} 
            pendingTasks={queueInfo.pending_tasks}
            executingTasks={queueInfo.executing_tasks}
            completedTasks={queueInfo.completed_tasks}
            failedTasks={queueInfo.failed_tasks}
          />
        )}

        <Card>
          <Table 
            columns={columns} 
            dataSource={queueInfo?.tasks || []}
            rowKey="task_id"
            pagination={{ 
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
            }}
          />
        </Card>
      </Space>

      {/* Модальное окно с деталями задачи */}
      <Modal
        title={`Детали задачи ${selectedTask?.task_id?.substring(0, 8)}...`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedTask && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>Тип задачи:</Text> {renderTaskType(selectedTask)}
            </div>
            <div>
              <Text strong>Статус:</Text> {renderStatus(selectedTask.status)}
            </div>
            <div>
              <Text strong>Позиция в очереди:</Text> {selectedTask.position === 0 ? '-' : selectedTask.position}
            </div>
            <div>
              <Text strong>Создана:</Text> {formatDate(selectedTask.created_at)}
            </div>
            <div>
              <Text strong>Обновлена:</Text> {formatDate(selectedTask.updated_at)}
            </div>

            {selectedTask.status === 'failed' && selectedTask.error && (
              <Collapse>
                <Panel header="Информация об ошибке" key="1">
                  <pre style={{ whiteSpace: 'pre-wrap', color: 'red' }}>
                    {selectedTask.error}
                  </pre>
                </Panel>
              </Collapse>
            )}

            {selectedTask.status === 'completed' && selectedTask.result && (
              <Collapse>
                <Panel header="Результаты задачи" key="1">
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(selectedTask.result, null, 2)}
                  </pre>
                </Panel>
              </Collapse>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default QueueStatus;