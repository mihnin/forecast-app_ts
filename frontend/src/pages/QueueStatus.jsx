import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Space, Tag, Button, Tooltip, Modal, Collapse, Tabs, Empty, Statistic, Row, Col, Progress } from 'antd';
import { 
  SyncOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  HourglassOutlined,
  EyeOutlined,
  ReloadOutlined,
  FireOutlined,
  FileTextOutlined,
  DashboardOutlined,
  FieldTimeOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useQueueInfo, useTaskStatus } from '../hooks/useQueueStatus';
import QueueIndicator from '../components/queue/QueueIndicator';
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

// Устанавливаем русскую локализацию
dayjs.locale('ru');

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TabPane } = Tabs;

const QueueStatus = () => {
  const { queueInfo, error, isLoading, refetch } = useQueueInfo();
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [taskLogs, setTaskLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('1');
  
  // Используем хук для отслеживания статуса выбранной задачи
  const {
    data: taskStatus,
    getTaskLogs,
    retryTask
  } = useTaskStatus(
    selectedTask?.task_id,
    () => refetch(), // При завершении задачи обновляем список
    () => refetch()  // При ошибке тоже обновляем список
  );

  // Форматирование даты
  const formatDate = (timestamp) => {
    return dayjs(timestamp * 1000).format('DD.MM.YYYY HH:mm:ss');
  };

  // Расчет времени с момента создания/обновления
  const getTimeAgo = (timestamp) => {
    return dayjs(timestamp * 1000).fromNow();
  };

  // Форматирование времени в удобный вид
  const formatDuration = (seconds) => {
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

  // Открытие модального окна с деталями задачи
  const handleViewTask = (task) => {
    setSelectedTask(task);
    setModalVisible(true);
  };
  
  // Обработчик загрузки логов задачи
  const handleLoadLogs = async () => {
    if (!selectedTask?.task_id) return;
    
    try {
      const logs = await getTaskLogs();
      setTaskLogs(logs);
      setLogModalVisible(true);
    } catch (error) {
      console.error("Ошибка при загрузке логов:", error);
    }
  };
  
  // Обработчик повторной попытки выполнения задачи
  const handleRetryTask = async () => {
    if (!selectedTask?.task_id) return;
    
    try {
      await retryTask();
      refetch(); // Обновляем список задач
      setModalVisible(false); // Закрываем модальное окно
    } catch (error) {
      console.error("Ошибка при повторной попытке выполнения задачи:", error);
    }
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
    
    const taskTypeIconMap = {
      'training': <FireOutlined />,
      'prediction': <DashboardOutlined />,
      'analysis': <FileTextOutlined />
    };
    
    const taskTypeName = taskTypeMap[task.task_type] || task.task_type;
    const taskTypeIcon = taskTypeIconMap[task.task_type];
    
    return (
      <Space>
        {taskTypeIcon}
        <span>{taskTypeName}</span>
      </Space>
    );
  };

  // Определение колонок таблицы
  const columns = [
    {
      title: 'ID задачи',
      dataIndex: 'task_id',
      key: 'task_id',
      ellipsis: true,
      width: 100,
      render: (id) => id.substring(0, 8) + '...',
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
      title: 'Прогресс',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress, record) => (
        <div style={{ width: 120 }}>
          <Progress 
            percent={progress} 
            size="small" 
            status={
              record.status === 'failed' ? 'exception' : 
              record.status === 'completed' ? 'success' : 
              'active'
            }
          />
        </div>
      ),
    },
    {
      title: 'Этап',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage) => stage || '—',
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (timestamp) => <Tooltip title={formatDate(timestamp)}>{getTimeAgo(timestamp)}</Tooltip>,
    },
    {
      title: 'Обновлена',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (timestamp) => <Tooltip title={formatDate(timestamp)}>{getTimeAgo(timestamp)}</Tooltip>,
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
              size="small"
            />
          </Tooltip>
          {record.status === 'failed' && (
            <Tooltip title="Повторить задачу">
              <Button 
                icon={<ReloadOutlined />} 
                onClick={() => {
                  setSelectedTask(record);
                  handleRetryTask();
                }} 
                type="primary" 
                danger
                ghost
                size="small"
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Колонки для таблицы логов
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
        return <Tag color={color}>{level}</Tag>;
      },
      width: 100,
    },
    {
      title: 'Сообщение',
      dataIndex: 'message',
      key: 'message',
    }
  ];

  if (isLoading) {
    return <Loading tip="Загрузка информации об очереди..." />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }

  const renderPendingTasks = () => {
    const pendingTasks = queueInfo?.tasks.filter(task => task.status === 'pending') || [];
    
    if (pendingTasks.length === 0) {
      return <Empty description="Ожидающих задач нет" />;
    }
    
    return (
      <Table 
        dataSource={pendingTasks} 
        columns={columns.filter(col => col.key !== 'updated_at')}
        rowKey="task_id"
        pagination={false}
        size="small"
      />
    );
  };
  
  const renderExecutingTasks = () => {
    const executingTasks = queueInfo?.tasks.filter(task => task.status === 'executing') || [];
    
    if (executingTasks.length === 0) {
      return <Empty description="Нет выполняемых задач" />;
    }
    
    return (
      <Table 
        dataSource={executingTasks} 
        columns={columns}
        rowKey="task_id"
        pagination={false}
        size="small"
      />
    );
  };
  
  const renderCompletedTasks = () => {
    const completedTasks = queueInfo?.tasks.filter(task => task.status === 'completed') || [];
    
    if (completedTasks.length === 0) {
      return <Empty description="Нет завершенных задач" />;
    }
    
    return (
      <Table 
        dataSource={completedTasks} 
        columns={columns.filter(col => col.key !== 'progress')}
        rowKey="task_id"
        pagination={{ pageSize: 5 }}
        size="small"
      />
    );
  };
  
  const renderFailedTasks = () => {
    const failedTasks = queueInfo?.tasks.filter(task => task.status === 'failed') || [];
    
    if (failedTasks.length === 0) {
      return <Empty description="Нет неудавшихся задач" />;
    }
    
    return (
      <Table 
        dataSource={failedTasks} 
        columns={columns}
        rowKey="task_id"
        pagination={false}
        size="small"
      />
    );
  };

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
            averageWaitingTime={queueInfo.average_waiting_time}
            averageExecutionTime={queueInfo.average_execution_time}
          />
        )}

        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Statistic 
                title="Среднее время ожидания" 
                value={formatDuration(queueInfo?.average_waiting_time)} 
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic 
                title="Среднее время выполнения" 
                value={formatDuration(queueInfo?.average_execution_time)} 
                prefix={<FieldTimeOutlined />}
              />
            </Col>
            <Col xs={24} md={8}>
              <Statistic 
                title="Успешность выполнения" 
                value={
                  queueInfo?.completed_tasks + queueInfo?.failed_tasks > 0 
                  ? `${Math.round(queueInfo.completed_tasks / (queueInfo.completed_tasks + queueInfo.failed_tasks) * 100)}%` 
                  : '—'
                } 
                prefix={<CheckCircleOutlined />}
                valueStyle={{ 
                  color: queueInfo?.completed_tasks / (queueInfo?.completed_tasks + queueInfo?.failed_tasks) > 0.8 
                    ? '#3f8600' 
                    : queueInfo?.completed_tasks / (queueInfo?.completed_tasks + queueInfo?.failed_tasks) < 0.5 
                    ? '#cf1322' 
                    : '#faad14'
                }}
              />
            </Col>
          </Row>
        </Card>

        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab={`Все задачи (${queueInfo?.total_tasks || 0})`} key="1">
              <Table 
                dataSource={queueInfo?.tasks || []} 
                columns={columns}
                rowKey="task_id"
                pagination={{ 
                  pageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50'],
                }}
              />
            </TabPane>
            <TabPane tab={`В очереди (${queueInfo?.pending_tasks || 0})`} key="2">
              {renderPendingTasks()}
            </TabPane>
            <TabPane tab={`Выполняются (${queueInfo?.executing_tasks || 0})`} key="3">
              {renderExecutingTasks()}
            </TabPane>
            <TabPane tab={`Завершены (${queueInfo?.completed_tasks || 0})`} key="4">
              {renderCompletedTasks()}
            </TabPane>
            <TabPane tab={`Ошибки (${queueInfo?.failed_tasks || 0})`} key="5">
              {renderFailedTasks()}
            </TabPane>
          </Tabs>
        </Card>
      </Space>

      {/* Модальное окно с деталями задачи */}
      <Modal
        title={`Детали задачи ${selectedTask?.task_id?.substring(0, 8)}...`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button 
            key="logs" 
            onClick={handleLoadLogs} 
            icon={<FileTextOutlined />}
          >
            Логи задачи
          </Button>,
          selectedTask?.status === 'failed' && (
            <Button 
              key="retry" 
              type="primary" 
              danger 
              icon={<ReloadOutlined />} 
              onClick={handleRetryTask}
            >
              Повторить
            </Button>
          ),
          <Button 
            key="close" 
            type="primary" 
            onClick={() => setModalVisible(false)}
          >
            Закрыть
          </Button>
        ].filter(Boolean)}
        width={700}
      >
        {selectedTask && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small" title="Основная информация">
                  <p><Text strong>Тип задачи:</Text> {renderTaskType(selectedTask)}</p>
                  <p><Text strong>Статус:</Text> {renderStatus(selectedTask.status)}</p>
                  <p><Text strong>Этап:</Text> {selectedTask.stage || '—'}</p>
                  <p><Text strong>Позиция в очереди:</Text> {selectedTask.position === 0 ? '—' : selectedTask.position}</p>
                  <p><Text strong>Создана:</Text> {formatDate(selectedTask.created_at)}</p>
                  <p><Text strong>Обновлена:</Text> {formatDate(selectedTask.updated_at)}</p>
                  <p><Text strong>Прогресс:</Text> {selectedTask.progress}%</p>
                  {selectedTask.retry_count > 0 && (
                    <p><Text strong>Попыток выполнения:</Text> {selectedTask.retry_count}</p>
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="Детали выполнения">
                  {selectedTask.status === 'failed' && selectedTask.error && (
                    <div>
                      <Text strong type="danger">Ошибка:</Text>
                      <pre style={{ 
                        whiteSpace: 'pre-wrap', 
                        color: 'red',
                        backgroundColor: '#fff1f0',
                        padding: '8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        maxHeight: '100px',
                        overflow: 'auto'
                      }}>
                        {selectedTask.error}
                      </pre>
                    </div>
                  )}
                  
                  {selectedTask.estimated_end_time && selectedTask.status === 'executing' && (
                    <p>
                      <Text strong>Ожидаемое время завершения:</Text> {formatDate(selectedTask.estimated_end_time)}
                    </p>
                  )}
                  
                  <Progress 
                    percent={selectedTask.progress} 
                    status={
                      selectedTask.status === 'failed' ? 'exception' : 
                      selectedTask.status === 'completed' ? 'success' : 
                      'active'
                    } 
                  />
                </Card>
              </Col>
            </Row>
            
            {selectedTask.status === 'completed' && selectedTask.result && (
              <Collapse>
                <Panel header="Результаты задачи" key="1">
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '12px',
                    maxHeight: '300px',
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(selectedTask.result, null, 2)}
                  </pre>
                </Panel>
              </Collapse>
            )}
          </Space>
        )}
      </Modal>
      
      {/* Модальное окно с логами задачи */}
      <Modal
        title={`Логи задачи ${selectedTask?.task_id?.substring(0, 8)}...`}
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={[
          <Button 
            key="refresh" 
            onClick={handleLoadLogs} 
            icon={<ReloadOutlined />}
          >
            Обновить
          </Button>,
          <Button 
            key="close" 
            type="primary" 
            onClick={() => setLogModalVisible(false)}
          >
            Закрыть
          </Button>
        ]}
        width={800}
      >
        {taskLogs.length > 0 ? (
          <Table 
            dataSource={taskLogs}
            columns={logColumns}
            rowKey={(record, index) => `${record.timestamp}-${index}`}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        ) : (
          <Empty description="Логи не найдены" />
        )}
      </Modal>
    </div>
  );
};

export default QueueStatus;