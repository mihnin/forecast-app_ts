import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Steps, 
  Button, 
  Form, 
  Select, 
  InputNumber, 
  Switch, 
  Space, 
  Typography,
  Divider,
  message,
  List,
  Tag,
  Result,
  Table
} from 'antd';
import { 
  DatabaseOutlined, 
  SettingOutlined, 
  ExperimentOutlined, 
  CheckCircleOutlined 
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import { dataService, trainingService } from '../services/api';
import { useTaskStatus, useQueueStatus } from '../hooks/useQueueStatus';
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';
import QueueIndicator from '../components/queue/QueueIndicator';
import TaskStatusBar from '../components/queue/TaskStatusBar';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;

const ModelTraining = () => {
  // Состояния
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [columns, setColumns] = useState([]);
  const [taskId, setTaskId] = useState(null);
  const [userId] = useState('user123'); // В реальном приложении это должно приходить из системы аутентификации

  // Получение информации об очереди
  const { queueStatus } = useQueueStatus();

  // Запрос на получение списка датасетов (в реальном приложении должен быть API для этого)
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

  // Запрос на получение списка колонок выбранного датасета
  const { data: columnsData, isLoading: columnsLoading, error: columnsError, refetch: refetchColumns } = useQuery(
    ['columns', selectedDataset],
    () => dataService.getColumns(selectedDataset),
    {
      enabled: !!selectedDataset,
      onSuccess: (data) => {
        setColumns(data);
      },
    }
  );

  // Запрос на получение списка доступных моделей и метрик
  const { data: modelsData, isLoading: modelsLoading, error: modelsError } = useQuery(
    'availableModels',
    trainingService.getAvailableModels,
    {
      staleTime: 3600000, // 1 час
    }
  );

  // Отслеживание статуса задачи обучения
  const { 
    data: taskStatus, 
    isLoading: taskStatusLoading, 
    error: taskStatusError 
  } = useTaskStatus(
    taskId,
    (data) => {
      // При успешном завершении задачи
      message.success('Обучение модели успешно завершено!');
      setCurrentStep(3); // Переходим к шагу результатов
    },
    (data) => {
      // При ошибке выполнения задачи
      message.error('Ошибка при обучении модели: ' + data.error);
    }
  );

  // Запрос результатов обучения
  const { 
    data: trainingResult, 
    isLoading: trainingResultLoading, 
    error: trainingResultError 
  } = useQuery(
    ['trainingResult', taskId],
    () => trainingService.getTrainingResult(taskId),
    {
      enabled: !!taskId && taskStatus?.status === 'completed',
      staleTime: Infinity, // Результаты не устаревают
    }
  );

  // Обработчик изменения датасета
  const handleDatasetChange = (value) => {
    setSelectedDataset(value);
    form.setFieldsValue({
      dateColumn: undefined,
      targetColumn: undefined,
      idColumn: undefined,
      staticFeatures: [],
    });
  };

  // Обработчик отправки формы
  const handleSubmit = (values) => {
    // Подготовка параметров для обучения
    const trainingParams = {
      dataset_id: selectedDataset,
      columns: {
        date_column: values.dateColumn,
        target_column: values.targetColumn,
        id_column: values.idColumn,
      },
      static_features: values.staticFeatures || [],
      fill_method: values.fillMethod,
      group_cols: values.groupCols || [],
      use_holidays: values.useHolidays,
      freq: values.freq,
      metric: values.metric,
      models: values.models,
      presets: values.presets,
      prediction_length: values.predictionLength,
      time_limit: values.timeLimit,
      mean_only: values.meanOnly,
    };

    // Запуск обучения
    trainingService.trainModel(userId, trainingParams)
      .then((response) => {
        setTaskId(response.task_id);
        message.info(`Задача обучения создана (ID: ${response.task_id}). Позиция в очереди: ${response.position}`);
        setCurrentStep(2); // Переходим к шагу выполнения
      })
      .catch((error) => {
        message.error('Ошибка при создании задачи обучения: ' + error.message);
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
      case 0: // Выбор датасета
        return (
          <Card>
            {datasetsLoading ? (
              <Loading tip="Загрузка списка датасетов..." />
            ) : datasetsError ? (
              <ErrorDisplay error={datasetsError} />
            ) : (
              <Form form={form} layout="vertical" initialValues={{ dataset: undefined }}>
                <Form.Item
                  name="dataset"
                  label="Выберите датасет для обучения модели:"
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

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button type="primary" onClick={nextStep} disabled={!selectedDataset}>
                    Далее
                  </Button>
                </div>
              </Form>
            )}
          </Card>
        );
      case 1: // Настройка параметров обучения
        return (
          <Card>
            {columnsLoading || modelsLoading ? (
              <Loading tip="Загрузка данных..." />
            ) : columnsError || modelsError ? (
              <ErrorDisplay error={columnsError || modelsError} />
            ) : (
              <Form 
                form={form} 
                layout="vertical" 
                initialValues={{
                  fillMethod: 'None',
                  useHolidays: false,
                  freq: 'auto (угадать)',
                  metric: 'MASE (Mean absolute scaled error)',
                  models: ['* (все)'],
                  presets: 'medium_quality',
                  predictionLength: 10,
                  timeLimit: 60,
                  meanOnly: false,
                }}
                onFinish={handleSubmit}
              >
                <Title level={4}>Выбор колонок</Title>
                <Form.Item
                  name="dateColumn"
                  label="Колонка с датой:"
                  rules={[{ required: true, message: 'Пожалуйста, выберите колонку с датой' }]}
                >
                  <Select placeholder="Выберите колонку с датой">
                    {columns.map((column) => (
                      <Option key={column} value={column}>{column}</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="targetColumn"
                  label="Целевая колонка:"
                  rules={[{ required: true, message: 'Пожалуйста, выберите целевую колонку' }]}
                >
                  <Select placeholder="Выберите целевую колонку">
                    {columns.map((column) => (
                      <Option key={column} value={column}>{column}</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="idColumn"
                  label="Колонка ID:"
                  rules={[{ required: true, message: 'Пожалуйста, выберите колонку ID' }]}
                >
                  <Select placeholder="Выберите колонку ID">
                    {columns.map((column) => (
                      <Option key={column} value={column}>{column}</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="staticFeatures"
                  label="Статические признаки (до 3):"
                >
                  <Select 
                    mode="multiple" 
                    placeholder="Выберите статические признаки" 
                    maxTagCount={3}
                    optionFilterProp="children"
                  >
                    {columns.map((column) => (
                      <Option key={column} value={column}>{column}</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Divider />

                <Title level={4}>Обработка данных</Title>
                <Form.Item
                  name="fillMethod"
                  label="Метод заполнения пропусков:"
                >
                  <Select>
                    <Option value="None">Оставить как есть</Option>
                    <Option value="Constant=0">Заполнить нулями</Option>
                    <Option value="Forward fill">Протянуть значения</Option>
                    <Option value="Group mean">Среднее по группе</Option>
                    <Option value="Interpolate">Линейная интерполяция</Option>
                    <Option value="KNN imputer">KNN imputer</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="groupCols"
                  label="Колонки для группировки при заполнении пропусков:"
                >
                  <Select 
                    mode="multiple" 
                    placeholder="Выберите колонки для группировки" 
                    optionFilterProp="children"
                  >
                    {columns.map((column) => (
                      <Option key={column} value={column}>{column}</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="useHolidays"
                  label="Учитывать праздники РФ:"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <Form.Item
                  name="freq"
                  label="Частота данных:"
                >
                  <Select>
                    <Option value="auto (угадать)">Автоматически определить</Option>
                    <Option value="D (день)">Ежедневно (D)</Option>
                    <Option value="H (час)">Ежечасно (H)</Option>
                    <Option value="M (месяц)">Ежемесячно (M)</Option>
                    <Option value="B (рабочие дни)">Рабочие дни (B)</Option>
                    <Option value="W (неделя)">Еженедельно (W)</Option>
                    <Option value="Q (квартал)">Ежеквартально (Q)</Option>
                  </Select>
                </Form.Item>

                <Divider />

                <Title level={4}>Параметры обучения</Title>
                <Form.Item
                  name="metric"
                  label="Метрика оценки:"
                >
                  <Select>
                    {modelsData && Object.entries(modelsData.metrics).map(([key, value]) => (
                      <Option key={key} value={key}>{key}</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="models"
                  label="Модели для обучения:"
                >
                  <Select mode="multiple" placeholder="Выберите модели">
                    <Option value="* (все)">Все модели</Option>
                    {modelsData && Object.entries(modelsData.models).map(([key, value]) => (
                      <Option key={key} value={key}>{key} ({value})</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="presets"
                  label="Пресет качества:"
                >
                  <Select>
                    <Option value="fast_training">Быстрое обучение (fast_training)</Option>
                    <Option value="medium_quality">Среднее качество (medium_quality)</Option>
                    <Option value="high_quality">Высокое качество (high_quality)</Option>
                    <Option value="best_quality">Максимальное качество (best_quality)</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="predictionLength"
                  label="Горизонт прогноза (кол-во точек):"
                  rules={[{ required: true, message: 'Укажите горизонт прогноза' }]}
                >
                  <InputNumber min={1} max={365} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  name="timeLimit"
                  label="Ограничение времени обучения (секунды):"
                  rules={[{ required: true, message: 'Укажите ограничение времени' }]}
                >
                  <InputNumber min={10} max={3600} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  name="meanOnly"
                  label="Прогнозировать только среднее (без квантилей):"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={prevStep}>
                    Назад
                  </Button>
                  <Button type="primary" htmlType="submit">
                    Запустить обучение
                  </Button>
                </div>
              </Form>
            )}
          </Card>
        );
      case 2: // Выполнение обучения
        return (
          <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Title level={4}>Выполнение обучения модели</Title>
              
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
                  estimatedTime={60} // Предполагаемое время выполнения задачи
                />
              )}
              
              {taskStatus?.status === 'failed' && (
                <div>
                  <Title level={5} style={{ color: 'red' }}>Ошибка при обучении модели</Title>
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
      case 3: // Результаты обучения
        return (
          <Card>
            {trainingResultLoading ? (
              <Loading tip="Загрузка результатов обучения..." />
            ) : trainingResultError ? (
              <ErrorDisplay error={trainingResultError} />
            ) : trainingResult ? (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Result
                  status="success"
                  title="Обучение модели успешно завершено!"
                  subTitle={`Модель ${trainingResult.best_model} с оценкой ${trainingResult.best_score.toFixed(4)}`}
                />

                <Divider />

                <Title level={4}>Лидерборд моделей</Title>
                <Table 
                  dataSource={trainingResult.leaderboard} 
                  rowKey="model"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                >
                  <Table.Column title="Модель" dataIndex="model" key="model" />
                  <Table.Column 
                    title="Оценка (validation)" 
                    dataIndex="score_val" 
                    key="score_val" 
                    render={(score) => score.toFixed(4)}
                    sorter={(a, b) => a.score_val - b.score_val}
                  />
                  <Table.Column 
                    title="Время обучения (сек)" 
                    dataIndex="fit_time" 
                    key="fit_time" 
                    render={(time) => time.toFixed(2)}
                  />
                  <Table.Column 
                    title="Инференс (сек/выборка)" 
                    dataIndex="pred_time" 
                    key="pred_time" 
                    render={(time) => time.toFixed(4)}
                  />
                </Table>

                {trainingResult.weighted_ensemble_info && (
                  <>
                    <Divider />
                    <Title level={4}>Информация о взвешенном ансамбле</Title>
                    <List
                      itemLayout="horizontal"
                      dataSource={Object.entries(trainingResult.weighted_ensemble_info).map(([model, weight]) => ({
                        model,
                        weight
                      }))}
                      renderItem={item => (
                        <List.Item>
                          <List.Item.Meta
                            title={item.model}
                            description={`Вес: ${(item.weight * 100).toFixed(2)}%`}
                          />
                        </List.Item>
                      )}
                    />
                  </>
                )}

                <Divider />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={() => setCurrentStep(0)}>
                    Вернуться к выбору датасета
                  </Button>
                  <Button type="primary" onClick={() => window.location.href = "/prediction"}>
                    Перейти к прогнозированию
                  </Button>
                </div>
              </Space>
            ) : (
              <Text>Нет данных о результатах обучения</Text>
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
        <Title level={2}>Обучение модели</Title>
        
        <QueueIndicator 
          totalTasks={queueStatus.totalTasks}
          pendingTasks={queueStatus.pendingTasks}
          executingTasks={queueStatus.executingTasks}
          completedTasks={queueStatus.completedTasks}
          failedTasks={queueStatus.failedTasks}
        />

        <div className="steps-container">
          <Steps current={currentStep}>
            <Step title="Выбор данных" icon={<DatabaseOutlined />} />
            <Step title="Настройка" icon={<SettingOutlined />} />
            <Step title="Обучение" icon={<ExperimentOutlined />} />
            <Step title="Результаты" icon={<CheckCircleOutlined />} />
          </Steps>
        </div>

        {getStepContent()}
      </Space>
    </div>
  );
};

export default ModelTraining;