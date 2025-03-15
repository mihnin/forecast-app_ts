import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Steps, 
  Button, 
  Form, 
  Select, 
  InputNumber, 
  Space, 
  Typography,
  Divider,
  message,
  Radio,
  Tabs,
  Table,
  List,
  Tag,
  Result,
  Spin,
  Statistic,
  Row,
  Col
} from 'antd';
import { 
  DatabaseOutlined, 
  SettingOutlined, 
  LineChartOutlined, 
  CheckCircleOutlined,
  DownloadOutlined,
  ExportOutlined
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import { dataService, predictionService, trainingService } from '../services/api';
import { useTaskStatus, useQueueStatus } from '../hooks/useQueueStatus';
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';
import QueueIndicator from '../components/queue/QueueIndicator';
import TaskStatusBar from '../components/queue/TaskStatusBar';
import TimeSeriesChart from '../components/charts/TimeSeriesChart';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;
const { TabPane } = Tabs;

const Prediction = () => {
  // Состояния
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [userId] = useState('user123'); // В реальном приложении это должно приходить из системы аутентификации
  const [exportFormat, setExportFormat] = useState('json');

  // Получение информации об очереди
  const { queueStatus } = useQueueStatus();

  // Запрос на получение списка моделей
  const { data: models, isLoading: modelsLoading, error: modelsError } = useQuery(
    'trainedModels',
    () => {
      // Эмуляция запроса списка моделей
      // В реальном приложении здесь будет запрос к API
      return Promise.resolve([
        { id: 'model1', name: 'DeepAR (14.04.2023)', bestScore: 0.85 },
        { id: 'model2', name: 'WeightedEnsemble (15.04.2023)', bestScore: 0.92 },
      ]);
    },
    {
      staleTime: 60000, // 1 минута
    }
  );

  // Запрос на получение списка датасетов
  const { data: datasets, isLoading: datasetsLoading, error: datasetsError } = useQuery(
    'datasets',
    () => {
      // Эмуляция запроса списка датасетов
      // В реальном приложении здесь будет запрос к API
      return Promise.resolve([
        { id: 'dataset1', name: 'train_data1.csv', rows: 1000, columns: 5 },
        { id: 'dataset2', name: 'train_data2.csv', rows: 2000, columns: 7 },
      ]);
    },
    {
      staleTime: 60000, // 1 минута
    }
  );

  // Отслеживание статуса задачи прогнозирования
  const { 
    data: taskStatus, 
    isLoading: taskStatusLoading, 
    error: taskStatusError 
  } = useTaskStatus(
    taskId,
    (data) => {
      // При успешном завершении задачи
      message.success('Прогнозирование успешно завершено!');
      setCurrentStep(3); // Переходим к шагу результатов
    },
    (data) => {
      // При ошибке выполнения задачи
      message.error('Ошибка при прогнозировании: ' + data.error);
    }
  );

  // Запрос результатов прогнозирования
  const { 
    data: predictionResult, 
    isLoading: predictionResultLoading, 
    error: predictionResultError 
  } = useQuery(
    ['predictionResult', taskId],
    () => predictionService.getPredictionResult(taskId),
    {
      enabled: !!taskId && taskStatus?.status === 'completed',
      staleTime: Infinity, // Результаты не устаревают
    }
  );

  // Обработчик изменения модели
  const handleModelChange = (value) => {
    setSelectedModel(value);
  };

  // Обработчик изменения датасета
  const handleDatasetChange = (value) => {
    setSelectedDataset(value);
  };

  // Обработчик отправки формы
  const handleSubmit = (values) => {
    // Запуск прогнозирования
    predictionService.predict(userId, selectedModel, selectedDataset, values.predictionLength)
      .then((response) => {
        setTaskId(response.task_id);
        message.info(`Задача прогнозирования создана (ID: ${response.task_id}). Позиция в очереди: ${response.position}`);
        setCurrentStep(2); // Переходим к шагу выполнения
      })
      .catch((error) => {
        message.error('Ошибка при создании задачи прогнозирования: ' + error.message);
      });
  };

  // Обработчик экспорта
  const handleExport = () => {
    predictionService.exportPrediction(taskId, exportFormat)
      .then((data) => {
        if (exportFormat === 'json') {
          // Для JSON просто показываем сообщение
          message.success('Данные экспортированы в JSON');
        } else {
          // Для Excel и CSV скачиваем файл
          const url = window.URL.createObjectURL(new Blob([data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `prediction_${taskId}.${exportFormat}`);
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
      })
      .catch((error) => {
        message.error('Ошибка при экспорте результатов: ' + error.message);
      });
  };

  // Переход к следующему шагу
  const nextStep = () => {
    setCurrentStep(currentStep + 1);
  };

  // Переход к предыдущему шагу
  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  // Получение содержимого в зависимости от текущего шага
  const getStepContent = () => {
    switch (currentStep) {
      case 0: // Выбор модели
        return (
          <Card>
            {modelsLoading ? (
              <Loading tip="Загрузка списка моделей..." />
            ) : modelsError ? (
              <ErrorDisplay error={modelsError} />
            ) : (
              <Form form={form} layout="vertical" initialValues={{ model: undefined }}>
                <Form.Item
                  name="model"
                  label="Выберите обученную модель для прогнозирования:"
                  rules={[{ required: true, message: 'Пожалуйста, выберите модель' }]}
                >
                  <Select 
                    placeholder="Выберите модель" 
                    onChange={handleModelChange}
                    style={{ width: '100%' }}
                  >
                    {models.map((model) => (
                      <Option key={model.id} value={model.id}>
                        {model.name} (Оценка: {model.bestScore.toFixed(2)})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="primary" onClick={nextStep} disabled={!selectedModel}>
                    Далее
                  </Button>
                </div>
              </Form>
            )}
          </Card>
        );
      case 1: // Выбор данных и параметров прогнозирования
        return (
          <Card>
            {datasetsLoading ? (
              <Loading tip="Загрузка списка датасетов..." />
            ) : datasetsError ? (
              <ErrorDisplay error={datasetsError} />
            ) : (
              <Form 
                form={form} 
                layout="vertical" 
                initialValues={{
                  predictionLength: null,
                }}
                onFinish={handleSubmit}
              >
                <Form.Item
                  name="dataset"
                  label="Выберите данные для прогнозирования:"
                  rules={[{ required: true, message: 'Пожалуйста, выберите датасет' }]}
                >
                  <Select 
                    placeholder="Выберите датасет" 
                    onChange={handleDatasetChange}
                    style={{ width: '100%' }}
                  >
                    {datasets.map((dataset) => (
                      <Option key={dataset.id} value={dataset.id}>
                        {dataset.name} ({dataset.rows} строк, {dataset.columns} колонок)
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="predictionLength"
                  label="Горизонт прогноза (оставьте пустым для использования значения из модели):"
                >
                  <InputNumber min={1} max={365} style={{ width: '100%' }} />
                </Form.Item>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={prevStep}>
                    Назад
                  </Button>
                  <Button type="primary" htmlType="submit" disabled={!selectedDataset}>
                    Запустить прогнозирование
                  </Button>
                </div>
              </Form>
            )}
          </Card>
        );
      case 2: // Выполнение прогнозирования
        return (
          <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Title level={4}>Выполнение прогнозирования</Title>
              
              <QueueIndicator 
                totalTasks={queueStatus.totalTasks}
                pendingTasks={queueStatus.pendingTasks}
                executingTasks={queueStatus.executingTasks}
                completedTasks={queueStatus.completedTasks}
                failedTasks={queueStatus.failedTasks}
              />
              
              {taskStatus && (
                <TaskStatusBar 
                  status={taskStatus.status}
                  position={taskStatus.position}
                  createdAt={taskStatus.created_at}
                  updatedAt={taskStatus.updated_at}
                  estimatedTime={30} // Предполагаемое время выполнения задачи прогнозирования
                />
              )}
              
              {taskStatus?.status === 'failed' && (
                <div>
                  <Title level={5} style={{ color: 'red' }}>Ошибка при прогнозировании</Title>
                  <Text type="danger">{taskStatus.error}</Text>
                  <div style={{ marginTop: 16 }}>
                    <Button type="primary" onClick={() => setCurrentStep(1)}>
                      Вернуться к настройкам
                    </Button>
                  </div>
                </div>
              )}
            </Space>
          </Card>
        );
      case 3: // Результаты прогнозирования
        return (
          <Card>
            {predictionResultLoading ? (
              <Loading tip="Загрузка результатов прогнозирования..." />
            ) : predictionResultError ? (
              <ErrorDisplay error={predictionResultError} />
            ) : predictionResult ? (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Result
                  status="success"
                  title="Прогнозирование успешно завершено!"
                  subTitle="Результаты прогноза готовы к просмотру и экспорту"
                />

                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic title="ID прогноза" value={predictionResult.prediction_id.substring(0, 8) + '...'} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="Количество прогнозов" value={predictionResult.predictions.length} suffix="точек" />
                  </Col>
                  <Col span={8}>
                    <Statistic title="Квантили" value={Object.keys(predictionResult.predictions[0]).filter(key => key !== 'item_id' && key !== 'timestamp').join(', ')} />
                  </Col>
                </Row>

                <Divider />

                <Tabs defaultActiveKey="1">
                  <TabPane tab="Графики" key="1">
                    {predictionResult.plots && Object.keys(predictionResult.plots).filter(k => k !== 'metadata').map((itemId) => (
                      <div key={itemId} className="chart-container">
                        <Title level={4}>Прогноз для {itemId}</Title>
                        <TimeSeriesChart 
                          data={predictionResult.plots[itemId]} 
                          itemId={itemId}
                          quantiles={predictionResult.plots.metadata.quantiles}
                        />
                      </div>
                    ))}
                  </TabPane>
                  <TabPane tab="Таблица" key="2">
                    <Table 
                      dataSource={predictionResult.predictions.slice(0, 100)} 
                      rowKey={(record) => `${record.item_id}-${record.timestamp}`}
                      scroll={{ x: 'max-content' }}
                      pagination={{ 
                        pageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50'],
                      }}
                    >
                      <Table.Column title="ID" dataIndex="item_id" key="item_id" />
                      <Table.Column 
                        title="Дата" 
                        dataIndex="timestamp" 
                        key="timestamp" 
                        render={(text) => new Date(text).toLocaleString('ru-RU')}
                      />
                      {predictionResult.plots.metadata.quantiles.map((quantile) => (
                        <Table.Column 
                          title={`Квантиль ${quantile}`} 
                          dataIndex={quantile} 
                          key={quantile} 
                          render={(value) => value.toFixed(2)}
                        />
                      ))}
                    </Table>
                  </TabPane>
                </Tabs>

                <Divider />

                <div>
                  <Title level={4}>Экспорт результатов</Title>
                  <Space>
                    <Radio.Group value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                      <Radio.Button value="json">JSON</Radio.Button>
                      <Radio.Button value="csv">CSV</Radio.Button>
                      <Radio.Button value="excel">Excel</Radio.Button>
                    </Radio.Group>
                    <Button 
                      type="primary" 
                      icon={<DownloadOutlined />} 
                      onClick={handleExport}
                    >
                      Экспортировать
                    </Button>
                  </Space>
                </div>

                <Divider />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={() => setCurrentStep(0)}>
                    Новое прогнозирование
                  </Button>
                  <Button type="primary" icon={<ExportOutlined />} onClick={() => window.location.href = "/queue"}>
                    К статусу задач
                  </Button>
                </div>
              </Space>
            ) : (
              <Text>Нет данных о результатах прогнозирования</Text>
            )}
          </Card>
        );
      default:
        return <div>Неизвестный шаг</div>;
    }
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>Прогнозирование</Title>
        
        <QueueIndicator 
          totalTasks={queueStatus.totalTasks}
          pendingTasks={queueStatus.pendingTasks}
          executingTasks={queueStatus.executingTasks}
          completedTasks={queueStatus.completedTasks}
          failedTasks={queueStatus.failedTasks}
        />

        <div className="steps-container">
          <Steps current={currentStep}>
            <Step title="Выбор модели" icon={<DatabaseOutlined />} />
            <Step title="Настройка" icon={<SettingOutlined />} />
            <Step title="Выполнение" icon={<LineChartOutlined />} />
            <Step title="Результаты" icon={<CheckCircleOutlined />} />
          </Steps>
        </div>

        {getStepContent()}
      </Space>
    </div>
  );
};

export default Prediction;