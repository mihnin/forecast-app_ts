import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Typography, 
  Steps, 
  Card, 
  Button, 
  Upload, 
  Form, 
  Select, 
  Input, 
  Switch, 
  InputNumber, 
  Divider, 
  Tag, 
  Row, 
  Col, 
  Space, 
  Alert, 
  Progress, 
  Collapse, 
  Radio, 
  Tooltip, 
  Modal,
  message,
  Checkbox,
  Drawer
} from 'antd';
import { 
  UploadOutlined, 
  InboxOutlined, 
  FileExcelOutlined, 
  SettingOutlined, 
  CalendarOutlined, 
  AimOutlined, 
  TeamOutlined, 
  TagOutlined, 
  FieldTimeOutlined, 
  LineChartOutlined, 
  ExperimentOutlined, 
  SaveOutlined, 
  FileTextOutlined, 
  BarChartOutlined,
  InfoCircleOutlined,
  FileZipOutlined,
  ClockCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import { dataService, trainingService } from '../services/api';
import { useQueueStatus } from '../hooks/useQueueStatus';
import QueueIndicator from '../components/queue/QueueIndicator';
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';
import PredictionResultsView from '../components/visualization/PredictionResultsView';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Dragger } = Upload;
const { Step } = Steps;
const { Panel } = Collapse;

const MainPage = () => {
  // Форма
  const [form] = Form.useForm();
  
  // Состояния приложения
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [datasetId, setDatasetId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [taskId, setTaskId] = useState(null);
  const [modelId, setModelId] = useState(null);
  const [predictionTaskId, setPredictionTaskId] = useState(null);
  const [logsVisible, setLogsVisible] = useState(false);
  const [logs, setLogs] = useState([]);
  const [predictionResults, setPredictionResults] = useState(null);

  // ID пользователя (в реальном приложении это придет из системы аутентификации)
  const [userId] = useState("user123");

  // Получение информации об очереди
  const { queueStatus } = useQueueStatus();

  // Получение списка доступных моделей и метрик
  const { data: modelConfig, isLoading: configLoading } = useQuery(
    'modelConfig',
    trainingService.getAvailableModels,
    {
      staleTime: 3600000, // 1 час
      onSuccess: (data) => {
        console.log("Загружена конфигурация моделей:", data);
      }
    }
  );

  // Отслеживание статуса задачи обучения
  const { 
    data: taskStatus, 
    isLoading: taskStatusLoading
  } = useQuery(
    ['taskStatus', taskId],
    () => trainingService.getTaskStatus(taskId),
    {
      enabled: !!taskId,
      refetchInterval: (data) => {
        if (data?.status === 'completed' || data?.status === 'failed') {
          return false;
        }
        return 2000; // Проверка каждые 2 секунды
      },
      onSuccess: (data) => {
        if (data.status === 'completed') {
          message.success('Обучение модели успешно завершено!');
          setModelId(data.result?.model_id);
          setTrainingInProgress(false);
          setTrainingProgress(100);
        } else if (data.status === 'failed') {
          message.error('Ошибка при обучении модели: ' + data.error);
          setTrainingInProgress(false);
        } else if (data.status === 'executing') {
          setTrainingProgress(50); // Примерный прогресс
        }
      }
    }
  );

  // Обработчик изменения файла
  const handleFileChange = ({ fileList }) => {
    setFileList(fileList);
  };

  // Обработчик загрузки файла
  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.error('Пожалуйста, выберите файл для загрузки');
      return;
    }

    const file = fileList[0].originFileObj;
    setUploading(true);
    setUploadProgress(0);

    try {
      // Эмуляция прогресса загрузки
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      // Используем сервис для загрузки данных
      const chunkSize = form.getFieldValue('chunkSize') || 100000;
      const response = await dataService.uploadData(file, chunkSize);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setDatasetId(response.dataset_id);
      
      // Получение колонок датасета
      if (response.dataset_id) {
        const columnsData = await dataService.getColumns(response.dataset_id);
        setColumns(columnsData);
      }

      message.success('Файл успешно загружен!');
      setCurrentStep(1); // Переход к следующему шагу
    } catch (error) {
      message.error(`Ошибка при загрузке файла: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Обработчик обучения модели
  const handleTrainModel = async () => {
    try {
      // Валидация формы
      const values = await form.validateFields();
      
      // Подготовка параметров обучения
      const trainingParams = {
        dataset_id: datasetId,
        columns: {
          date_column: values.dateColumn,
          target_column: values.targetColumn,
          id_column: values.idColumn
        },
        static_features: values.staticFeatures || [],
        fill_method: values.fillMethod || "None",
        group_cols: values.groupCols || [],
        use_holidays: values.useHolidays || false,
        freq: values.freq || "auto",
        metric: values.metric || "MASE",
        models: values.models || ["* (все)"],
        presets: values.presets || "medium_quality",
        prediction_length: values.predictionLength || 10,
        time_limit: values.timeLimit || 60,
        mean_only: values.meanOnly || false
      };

      setTrainingInProgress(true);
      setTrainingProgress(10);

      // Запуск обучения через API
      const response = await trainingService.trainModel(userId, trainingParams);
      
      if (response && response.task_id) {
        setTaskId(response.task_id);
        message.info(`Задача обучения создана (ID: ${response.task_id}). Позиция в очереди: ${response.position}`);
      } else {
        throw new Error("Не удалось создать задачу обучения");
      }
    } catch (error) {
      message.error(`Ошибка при запуске обучения: ${error.message}`);
      setTrainingInProgress(false);
    }
  };

  // Обработчик для получения результатов прогнозирования
  const handleGetPredictionResults = async () => {
    try {
      if (!predictionTaskId) {
        message.error('Сначала необходимо выполнить прогнозирование');
        return;
      }

      // Запрос на получение результатов
      const results = await dataService.getPredictionResult(predictionTaskId);
      setPredictionResults(results);
      message.success('Результаты прогнозирования загружены');
    } catch (error) {
      message.error(`Ошибка при получении результатов: ${error.message}`);
    }
  };

  // Обработчик запуска прогнозирования
  const handlePredict = async () => {
    try {
      if (!modelId) {
        message.error("Сначала необходимо обучить модель");
        return;
      }

      // Подготовка параметров прогнозирования
      const predictionParams = {
        model_id: modelId,
        dataset_id: datasetId,
        prediction_length: form.getFieldValue('predictionLength') || 10
      };

      // Запуск прогнозирования через API
      const response = await dataService.predict(userId, predictionParams);
      
      if (response && response.task_id) {
        setPredictionTaskId(response.task_id);
        message.info(`Задача прогнозирования создана (ID: ${response.task_id}). Позиция в очереди: ${response.position}`);
        
        // Автоматически загружаем результаты через некоторое время
        setTimeout(() => {
          handleGetPredictionResults();
        }, 3000); // Задержка для имитации времени выполнения
      } else {
        throw new Error("Не удалось создать задачу прогнозирования");
      }
    } catch (error) {
      message.error(`Ошибка при запуске прогнозирования: ${error.message}`);
    }
  };

  // Обработчик сохранения результатов
  const handleSaveResults = async () => {
    try {
      if (!predictionTaskId) {
        message.error("Сначала необходимо выполнить прогнозирование");
        return;
      }

      // Экспорт в CSV
      const result = await dataService.exportPrediction(predictionTaskId, 'csv');
      
      // Создание ссылки для скачивания
      const url = window.URL.createObjectURL(new Blob([result]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `prediction_${predictionTaskId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      message.success('Результаты успешно сохранены в CSV');
    } catch (error) {
      message.error(`Ошибка при сохранении результатов: ${error.message}`);
    }
  };

  // Обработчик показа логов
  const handleShowLogs = () => {
    // В реальном приложении здесь был бы запрос к API для получения логов
    setLogs([
      { time: '2023-04-16 10:15:23', level: 'INFO', message: 'Загрузка данных' },
      { time: '2023-04-16 10:15:25', level: 'INFO', message: 'Данные успешно загружены' },
      { time: '2023-04-16 10:15:26', level: 'INFO', message: 'Запуск обучения модели' },
      { time: '2023-04-16 10:16:30', level: 'INFO', message: 'Модель успешно обучена' },
      { time: '2023-04-16 10:16:35', level: 'INFO', message: 'Запуск прогнозирования' },
      { time: '2023-04-16 10:16:45', level: 'INFO', message: 'Прогноз успешно создан' }
    ]);
    setLogsVisible(true);
  };

  // Обработчик скачивания логов
  const handleDownloadLogs = () => {
    // В реальном приложении здесь был бы запрос к API для получения файла логов
    const logsText = logs.map(log => `${log.time} [${log.level}] ${log.message}`).join('\n');
    const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
    
    // Создание ссылки для скачивания
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'application_logs.txt');
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    message.success('Логи успешно скачаны');
  };

  // Обработчик скачивания моделей и логов
  const handleDownloadArchive = () => {
    // В реальном приложении здесь был бы запрос к API для получения архива
    message.success('Архив с моделями и логами будет скачан');
  };

  // Настройка загрузчика файлов
  const uploadProps = {
    name: 'file',
    multiple: false,
    fileList,
    beforeUpload: (file) => {
      // Проверка типа файла
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                   file.type === 'application/vnd.ms-excel' ||
                   file.name.endsWith('.csv');
      if (!isExcel) {
        message.error(`${file.name} не является Excel или CSV файлом`);
      }
      
      // Проверка размера файла (ограничение 200MB)
      const isLt200M = file.size / 1024 / 1024 < 200;
      if (!isLt200M) {
        message.error('Файл должен быть меньше 200MB!');
      }
      
      return isExcel && isLt200M;
    },
    onChange: handleFileChange,
    onDrop(e) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  // Определение шагов
  const steps = [
    {
      title: 'Загрузка данных',
      icon: <UploadOutlined />,
      content: (
        <div className="step-content">
          <Card title="Загрузка данных">
            <Form form={form} layout="vertical">
              <Form.Item 
                name="chunkSize" 
                label="Настройки для больших файлов"
                initialValue={100000}
                tooltip="Количество строк, обрабатываемых за один раз для больших файлов"
              >
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={1000} 
                  max={1000000}
                  step={1000}
                  addonAfter="строк"
                />
              </Form.Item>

              <Form.Item
                name="file"
                label="Train (обязательно)"
              >
                <Dragger {...uploadProps} disabled={uploading}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">Перетащите файл сюда или нажмите для выбора</p>
                  <p className="ant-upload-hint">
                    Поддерживаются CSV и Excel файлы (.csv, .xls, .xlsx)
                  </p>
                  <p className="ant-upload-hint">
                    Лимит 200MB на файл
                  </p>
                </Dragger>
              </Form.Item>

              {uploading && (
                <Progress percent={uploadProgress} status="active" />
              )}

              <Form.Item>
                <Button 
                  type="primary" 
                  onClick={handleUpload} 
                  loading={uploading} 
                  disabled={fileList.length === 0}
                  icon={<UploadOutlined />}
                >
                  Загрузить данные
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      )
    },
    {
      title: 'Колонки датасета',
      icon: <FileTextOutlined />,
      content: (
        <div className="step-content">
          <Card title="Колонки датасета">
            <Form form={form} layout="vertical">
              <Form.Item
                name="dateColumn"
                label="Колонка с датой"
                tooltip="Выберите колонку, содержащую даты или временные метки"
                rules={[{ required: true, message: 'Пожалуйста, выберите колонку с датой' }]}
              >
                <Select placeholder="Выберите колонку с датой">
                  {columns.map(column => (
                    <Option key={column} value={column}>{column}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="targetColumn"
                label="Колонка target"
                tooltip="Выберите целевую колонку для прогнозирования"
                rules={[{ required: true, message: 'Пожалуйста, выберите целевую колонку' }]}
              >
                <Select placeholder="Выберите целевую колонку">
                  {columns.map(column => (
                    <Option key={column} value={column}>{column}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="idColumn"
                label="Колонка ID (категориальный)"
                tooltip="Выберите колонку с идентификаторами временных рядов (если данные содержат несколько рядов)"
                rules={[{ required: true, message: 'Пожалуйста, выберите колонку ID' }]}
              >
                <Select placeholder="Выберите колонку ID">
                  {columns.map(column => (
                    <Option key={column} value={column}>{column}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Divider orientation="left">Статические признаки (до 3)</Divider>

              <Form.Item
                name="staticFeatures"
                tooltip="Выберите до 3-х статических признаков, которые не меняются со временем для каждого временного ряда"
              >
                <Select 
                  mode="multiple" 
                  placeholder="Выберите статические колонки" 
                  maxTagCount={3}
                  optionFilterProp="children"
                >
                  {columns.filter(column => 
                    column !== form.getFieldValue('dateColumn') && 
                    column !== form.getFieldValue('targetColumn') &&
                    column !== form.getFieldValue('idColumn')
                  ).map(column => (
                    <Option key={column} value={column}>{column}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="useHolidays"
                valuePropName="checked"
                initialValue={false}
              >
                <Checkbox>Учитывать праздники РФ?</Checkbox>
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  onClick={() => setCurrentStep(2)} 
                  disabled={!form.getFieldValue('dateColumn') || !form.getFieldValue('targetColumn') || !form.getFieldValue('idColumn')}
                >
                  Далее
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      )
    },
    {
      title: 'Обработка пропусков',
      icon: <SettingOutlined />,
      content: (
        <div className="step-content">
          <Card title="Обработка пропусков">
            <Form form={form} layout="vertical">
              <Form.Item
                name="fillMethod"
                label="Способ заполнения пропусков"
                tooltip="Выберите метод заполнения пропущенных значений в данных"
                initialValue="None"
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
                label="Колонки для группировки"
                tooltip="Выберите колонки для группировки при заполнении пропусков (работает для методов Group mean)"
              >
                <Select 
                  mode="multiple" 
                  placeholder="Выберите колонки для группировки" 
                  optionFilterProp="children"
                  disabled={form.getFieldValue('fillMethod') !== 'Group mean'}
                >
                  {columns.filter(column => 
                    column !== form.getFieldValue('targetColumn')
                  ).map(column => (
                    <Option key={column} value={column}>{column}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" onClick={() => setCurrentStep(3)}>
                  Далее
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      )
    },
    {
      title: 'Частота (freq)',
      icon: <FieldTimeOutlined />,
      content: (
        <div className="step-content">
          <Card title="Частота данных">
            <Form form={form} layout="vertical">
              <Form.Item
                name="freq"
                label="freq"
                tooltip="Укажите частоту данных временного ряда"
                initialValue="auto"
              >
                <Select>
                  <Option value="auto">Авто-определение</Option>
                  <Option value="Y">Год (Y)</Option>
                  <Option value="Q">Квартал (Q)</Option>
                  <Option value="M">Месяц (M)</Option>
                  <Option value="W">Неделя (W)</Option>
                  <Option value="D">День (D)</Option>
                  <Option value="H">Час (H)</Option>
                  <Option value="T">Минута (T)</Option>
                  <Option value="S">Секунда (S)</Option>
                  <Option value="B">Рабочие дни (B)</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" onClick={() => setCurrentStep(4)}>
                  Далее
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      )
    },
    {
      title: 'Метрика и модели',
      icon: <AimOutlined />,
      content: (
        <div className="step-content">
          <Card title="Метрика и модели">
            <Form form={form} layout="vertical">
              <Form.Item
                name="metric"
                label="Метрика"
                tooltip="Выберите метрику для оценки качества моделей"
                initialValue="MAE"
              >
                <Select>
                  {modelConfig && Object.entries(modelConfig.metrics).map(([key, value]) => (
                    <Option key={key} value={value}>{key}</Option>
                  ))}
                  {!modelConfig && (
                    <>
                      <Option value="MAE">MAE (Mean absolute error)</Option>
                      <Option value="MAPE">MAPE (Mean absolute percentage error)</Option>
                      <Option value="MASE">MASE (Mean absolute scaled error)</Option>
                      <Option value="RMSE">RMSE (Root mean squared error)</Option>
                      <Option value="RMSLE">RMSLE (Root mean squared logarithmic error)</Option>
                      <Option value="SMAPE">SMAPE (Symmetric mean absolute percentage error)</Option>
                    </>
                  )}
                </Select>
              </Form.Item>

              <Form.Item
                name="models"
                label="Модели AutoGluon"
                tooltip="Выберите модели для обучения или оставьте 'все' для автоматического выбора"
                initialValue={["* (все)"]}
              >
                <Select 
                  mode="multiple" 
                  placeholder="Выберите модели" 
                  optionFilterProp="children"
                  maxTagCount={3}
                  defaultValue={["* (все)"]}
                >
                  <Option value="* (все)">* (все)</Option>
                  {modelConfig && Object.entries(modelConfig.models).map(([key, value]) => (
                    <Option key={key} value={key}>{key} ({value})</Option>
                  ))}
                  {!modelConfig && (
                    <>
                      <Option value="DeepARModel">DeepARModel (RNN)</Option>
                      <Option value="AutoETSModel">AutoETSModel (Экспоненциальное сглаживание)</Option>
                      <Option value="AutoARIMAModel">AutoARIMAModel (ARIMA)</Option>
                      <Option value="SimpleFeedForwardModel">SimpleFeedForwardModel (Нейронная сеть)</Option>
                      <Option value="SeasonalNaiveModel">SeasonalNaiveModel (Сезонная наивная модель)</Option>
                    </>
                  )}
                </Select>
              </Form.Item>

              <Form.Item
                name="presets"
                label="Presets"
                tooltip="Выберите предустановку, определяющую компромисс между скоростью и качеством"
                initialValue="medium_quality"
              >
                <Select>
                  <Option value="fast_training">fast_training (быстро)</Option>
                  <Option value="medium_quality">medium_quality (средне)</Option>
                  <Option value="high_quality">high_quality (высоко)</Option>
                  <Option value="best_quality">best_quality (максимально)</Option>
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="predictionLength"
                    label="prediction_length"
                    tooltip="Горизонт прогнозирования (количество временных шагов)"
                    initialValue={10}
                  >
                    <InputNumber 
                      style={{ width: '100%' }} 
                      min={1} 
                      max={365}
                      addonAfter={
                        <Tooltip title="Единицы времени зависят от выбранной частоты данных">
                          <InfoCircleOutlined />
                        </Tooltip>
                      }
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="timeLimit"
                    label="time_limit (sec)"
                    tooltip="Ограничение времени обучения в секундах"
                    initialValue={60}
                  >
                    <InputNumber 
                      style={{ width: '100%' }} 
                      min={10} 
                      max={3600}
                      addonAfter="сек"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="meanOnly"
                valuePropName="checked"
                initialValue={false}
              >
                <Checkbox>Прогнозировать только среднее (mean)?</Checkbox>
              </Form.Item>

              <Form.Item>
                <Button type="primary" onClick={() => setCurrentStep(5)}>
                  Далее
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      )
    },
    {
      title: 'Обучение модели',
      icon: <ExperimentOutlined />,
      content: (
        <div className="step-content">
          <Card title="Обучение модели">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="Обучение, Прогноз и Сохранение"
                description="Нажав кнопку «Обучить модель», вы запустите процесс обучения модели с выбранными параметрами."
                type="info"
                showIcon
              />

              <Form.Item>
                <Checkbox defaultChecked disabled>Обучение, Прогноз и Сохранение</Checkbox>
              </Form.Item>

              {trainingInProgress && (
                <div>
                  <Progress percent={trainingProgress} status="active" />
                  <Text type="secondary">Выполняется обучение модели...</Text>
                </div>
              )}

              {modelId && (
                <Alert
                  message="Модель успешно обучена"
                  description={`ID модели: ${modelId}`}
                  type="success"
                  showIcon
                />
              )}

              <Button 
                type="primary" 
                onClick={handleTrainModel} 
                loading={trainingInProgress}
                disabled={!datasetId}
                style={{ marginTop: 16 }}
                icon={<ExperimentOutlined />}
              >
                Обучить модель
              </Button>
            </Space>
          </Card>
        </div>
      )
    },
    {
      title: 'Прогноз',
      icon: <LineChartOutlined />,
      content: (
        <div className="step-content">
          <Card title="Прогнозирование">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="Запуск прогнозирования"
                description="Нажмите кнопку «Сделать прогноз» для запуска прогнозирования на обученной модели."
                type="info"
                showIcon
              />

              {predictionTaskId && (
                <Alert
                  message="Прогноз успешно создан"
                  description={`ID задачи прогнозирования: ${predictionTaskId}`}
                  type="success"
                  showIcon
                />
              )}

              <Button 
                type="primary" 
                onClick={handlePredict} 
                disabled={!modelId}
                style={{ marginTop: 16, marginBottom: 16 }}
                icon={<LineChartOutlined />}
              >
                Сделать прогноз
              </Button>
              
              {predictionTaskId && !predictionResults && (
                <Button 
                  onClick={handleGetPredictionResults}
                  icon={<SyncOutlined />}
                >
                  Загрузить результаты
                </Button>
              )}
              
              {predictionResults && (
                <PredictionResultsView 
                  predictionResult={predictionResults} 
                  onDownload={handleSaveResults} 
                />
              )}
            </Space>
          </Card>
        </div>
      )
    },
    {
      title: 'Сохранение результатов',
      icon: <SaveOutlined />,
      content: (
        <div className="step-content">
          <Card title="Сохранение результатов прогноза">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                onClick={handleSaveResults} 
                disabled={!predictionTaskId}
                icon={<SaveOutlined />}
              >
                Сохранить результаты в CSV
              </Button>
            </Space>
          </Card>
        </div>
      )
    },
    {
      title: 'Логи приложения',
      icon: <FileTextOutlined />,
      content: (
        <div className="step-content">
          <Card title="Логи приложения">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                onClick={handleShowLogs} 
                icon={<FileTextOutlined />}
              >
                Показать логи
              </Button>
              <Button 
                onClick={handleDownloadLogs} 
                icon={<DownloadOutlined />}
              >
                Скачать логи
              </Button>
            </Space>
          </Card>
        </div>
      )
    },
    {
      title: 'Выгрузка моделей и логов',
      icon: <FileZipOutlined />,
      content: (
        <div className="step-content">
          <Card title="Выгрузка моделей и логов">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                onClick={handleDownloadArchive} 
                icon={<FileZipOutlined />}
              >
                Скачать архив (модели + логи)
              </Button>
            </Space>
          </Card>
        </div>
      )
    },
  ];

  return (
    <div className="main-page">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>TimeFlow - Прогнозирование временных рядов с AutoGluon</Title>
        
        <QueueIndicator 
          totalTasks={queueStatus.totalTasks}
          pendingTasks={queueStatus.pendingTasks}
          executingTasks={queueStatus.executingTasks}
          completedTasks={queueStatus.completedTasks}
          failedTasks={queueStatus.failedTasks}
        />
        
        <Card>
          <Row>
            <Col xs={24} md={6} style={{ 
              borderRight: '1px solid #f0f0f0', 
              padding: '0 16px',
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 280px)'
            }}>
              <Steps 
                current={currentStep} 
                onChange={setCurrentStep} 
                direction="vertical"
                items={steps.map((step, index) => ({
                  title: step.title,
                  icon: step.icon,
                  disabled: index > 0 && !datasetId,
                  description: index === currentStep ? (
                    <Text type="secondary">Текущий шаг</Text>
                  ) : null
                }))}
              />
            </Col>
            <Col xs={24} md={18} style={{ padding: '0 16px' }}>
              {steps[currentStep].content}
            </Col>
          </Row>
        </Card>
      </Space>

      {/* Модальное окно для отображения логов */}
      <Drawer
        title="Логи приложения"
        width={600}
        placement="right"
        onClose={() => setLogsVisible(false)}
        open={logsVisible}
      >
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {logs.map((log, index) => (
            <div key={index} style={{ marginBottom: 8, fontFamily: 'monospace' }}>
              <Tag color={log.level === 'INFO' ? 'blue' : log.level === 'ERROR' ? 'red' : 'orange'}>
                {log.level}
              </Tag>
              <Text code>{log.time}</Text>
              <Text> {log.message}</Text>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  );
};

export default MainPage;