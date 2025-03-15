import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Space, 
  Card, 
  Table, 
  Button, 
  Tabs, 
  Row, 
  Col,
  Tag,
  Switch,
  Tooltip,
  Empty,
  Select,
  Radio,
  Statistic,
  Divider,
  Collapse,
  Alert,
  message
} from 'antd';
import { 
  BarChartOutlined, 
  LineChartOutlined, 
  AreaChartOutlined, 
  AppstoreOutlined,
  TableOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  SyncOutlined,
  FileExcelOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import { trainingService } from '../services/api';
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';
import { Bar, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler
} from 'chart.js';

// Регистрируем компоненты Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  ChartTooltip,
  Legend
);

const { Title: TitleTypography, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse;
const { Option } = Select;

const ModelComparison = () => {
  const [selectedModels, setSelectedModels] = useState([]);
  const [metricType, setMetricType] = useState('score_val');
  const [sortByMetric, setSortByMetric] = useState(true);
  const [showComparisonChart, setShowComparisonChart] = useState(true);
  const [activeTab, setActiveTab] = useState('1');
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);

  // Получение списка обученных моделей
  const { 
    data: trainedModels, 
    isLoading: modelsLoading, 
    error: modelsError,
    refetch: refetchModels
  } = useQuery(
    'trainedModels',
    trainingService.getTrainedModels,
    {
      staleTime: 60000, // 1 минута
      refetchInterval: 300000, // Обновлять каждые 5 минут
      onSuccess: (data) => {
        // Если есть модели и ни одна не выбрана, выбираем первые 3 (или меньше)
        if (data && data.length > 0 && selectedModels.length === 0) {
          const initialSelected = data.slice(0, Math.min(3, data.length)).map(model => model.id);
          setSelectedModels(initialSelected);

          // Если нет выбранного датасета, выбираем датасет первой модели
          if (!selectedDatasetId && data[0].dataset_id) {
            setSelectedDatasetId(data[0].dataset_id);
          }
        }
      }
    }
  );

  // Получение списка датасетов
  const { 
    data: datasets, 
    isLoading: datasetsLoading, 
    error: datasetsError 
  } = useQuery(
    'datasets',
    () => {
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

  // Фильтрация моделей по выбранному датасету
  const filteredModels = trainedModels?.filter(model => 
    !selectedDatasetId || model.dataset_id === selectedDatasetId
  ) || [];

  // Обработчик выбора моделей
  const handleModelSelectionChange = (values) => {
    setSelectedModels(values);
  };

  // Обработчик изменения метрики
  const handleMetricChange = (e) => {
    setMetricType(e.target.value);
  };

  // Обработчик экспорта сравнения в Excel
  const handleExportComparison = () => {
    try {
      // В реальном приложении здесь был бы вызов API
      message.success('Сравнение моделей экспортировано в Excel');
    } catch (error) {
      message.error(`Ошибка при экспорте: ${error.message}`);
    }
  };

  // Обработчик выбора датасета
  const handleDatasetChange = (value) => {
    setSelectedDatasetId(value);
    
    // Сбрасываем выбранные модели при смене датасета
    setSelectedModels([]);
  };

  // Получаем данные выбранных моделей
  const getSelectedModelsData = () => {
    if (!trainedModels) return [];
    
    return trainedModels
      .filter(model => selectedModels.includes(model.id))
      .sort((a, b) => {
        if (sortByMetric) {
          // Сортировка по выбранной метрике
          return metricType === 'training_time' ? 
            a[metricType] - b[metricType] : 
            b[metricType] - a[metricType];
        }
        // Сортировка по времени создания (новые сверху)
        return new Date(b.created_at) - new Date(a.created_at);
      });
  };

  // Подготовка данных для таблицы сравнения
  const getComparisonTableData = () => {
    const selectedModelsData = getSelectedModelsData();
    
    if (selectedModelsData.length === 0) {
      return [];
    }
    
    // Собираем все уникальные метрики из всех моделей
    const allMetrics = new Set();
    selectedModelsData.forEach(model => {
      if (model.metrics) {
        Object.keys(model.metrics).forEach(metric => allMetrics.add(metric));
      }
    });
    
    // Создаем строки таблицы
    return Array.from(allMetrics).map(metric => {
      const row = { 
        metric_name: metric,
        key: metric
      };
      
      selectedModelsData.forEach(model => {
        const value = model.metrics?.[metric] ?? null;
        row[model.id] = value !== null ? value : '-';
      });
      
      return row;
    });
  };
  
  // Подготовка колонок для таблицы сравнения
  const getComparisonTableColumns = () => {
    const selectedModelsData = getSelectedModelsData();
    
    if (selectedModelsData.length === 0) {
      return [
        {
          title: 'Метрика',
          dataIndex: 'metric_name',
          key: 'metric_name',
        }
      ];
    }
    
    const columns = [
      {
        title: 'Метрика',
        dataIndex: 'metric_name',
        key: 'metric_name',
        width: 150,
        fixed: 'left',
      }
    ];
    
    selectedModelsData.forEach(model => {
      columns.push({
        title: () => (
          <Tooltip title={`ID: ${model.id}`}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{model.name || model.best_model}</div>
              <div style={{ fontSize: '12px' }}>
                {new Date(model.created_at).toLocaleDateString('ru-RU')}
              </div>
            </div>
          </Tooltip>
        ),
        dataIndex: model.id,
        key: model.id,
        render: (value, record) => (
          <div style={{ textAlign: 'center' }}>
            {typeof value === 'number' ? 
              value.toFixed(4) : 
              value
            }
          </div>
        ),
        width: 120,
      });
    });
    
    return columns;
  };

  // Данные для графика сравнения моделей
  const getModelComparisonChartData = () => {
    const selectedModelsData = getSelectedModelsData();
    
    if (selectedModelsData.length === 0) {
      return null;
    }
    
    // Выбираем метрику для сравнения
    const metricLabels = {
      'score_val': 'Оценка на валидации',
      'score_test': 'Оценка на тесте',
      'fit_time': 'Время обучения (сек)',
      'pred_time': 'Время прогноза (сек/выборка)'
    };
    
    return {
      labels: selectedModelsData.map(model => model.name || model.best_model),
      datasets: [
        {
          label: metricLabels[metricType] || metricType,
          data: selectedModelsData.map(model => model[metricType] || 0),
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)',
            'rgba(153, 102, 255, 0.5)',
            'rgba(255, 159, 64, 0.5)',
            'rgba(199, 199, 199, 0.5)',
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(199, 199, 199, 1)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };

  // Настройки для графика сравнения
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Сравнение моделей',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(4);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: metricType.includes('time'), // Начинать с нуля только для временных метрик
        title: {
          display: true,
          text: metricType === 'score_val' ? 'Оценка на валидации' : 
                metricType === 'score_test' ? 'Оценка на тесте' :
                metricType === 'fit_time' ? 'Время обучения (сек)' :
                'Время прогноза (сек/выборка)',
        }
      }
    }
  };

  // Данные для радара моделей
  const getModelRadarChartData = () => {
    const selectedModelsData = getSelectedModelsData();
    
    if (selectedModelsData.length === 0) {
      return null;
    }
    
    // Определяем метрики для радара
    const radarMetrics = ['score_val', 'inference_speed', 'training_speed', 'complexity'];
    
    // Нормализуем значения для радара (от 0 до 1)
    const normalizedData = {};
    
    radarMetrics.forEach(metric => {
      // Получаем все значения для метрики
      const values = selectedModelsData.map(model => {
        if (metric === 'inference_speed') {
          // Для скорости инференса берем обратное значение от pred_time
          // (меньшее время = лучшая скорость)
          return model.pred_time ? 1 / model.pred_time : 0;
        } else if (metric === 'training_speed') {
          // Для скорости обучения берем обратное значение от fit_time
          return model.fit_time ? 1 / model.fit_time : 0;
        } else if (metric === 'complexity') {
          // Сложность модели (пример, в реальном приложении нужно использовать реальные данные)
          return model.complexity || 0.5;
        }
        return model[metric] || 0;
      });
      
      // Находим максимальное и минимальное значения
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const range = maxValue - minValue;
      
      // Нормализуем значения
      normalizedData[metric] = values.map(value => 
        range === 0 ? 0.5 : (value - minValue) / range
      );
    });
    
    return {
      labels: [
        'Точность (валидация)', 
        'Скорость прогноза', 
        'Скорость обучения', 
        'Сложность модели'
      ],
      datasets: selectedModelsData.map((model, index) => ({
        label: model.name || model.best_model,
        data: [
          normalizedData['score_val'][index],
          normalizedData['inference_speed'][index],
          normalizedData['training_speed'][index],
          normalizedData['complexity'][index]
        ],
        fill: true,
        backgroundColor: `rgba(54, 162, 235, ${0.2 + (index * 0.1)})`,
        borderColor: `rgba(54, 162, 235, ${0.7 + (index * 0.1)})`,
        pointBackgroundColor: `rgba(54, 162, 235, ${0.7 + (index * 0.1)})`,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: `rgba(54, 162, 235, ${0.7 + (index * 0.1)})`,
      }))
    };
  };

  // Настройки для радара
  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Характеристики моделей',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${(context.parsed.r * 100).toFixed(0)}%`;
          }
        }
      }
    },
    scales: {
      r: {
        angleLines: {
          display: true
        },
        suggestedMin: 0,
        suggestedMax: 1,
        ticks: {
          display: false
        }
      }
    }
  };

  // Подготовка данных для таблицы лидерборда
  const getLeaderboardTableColumns = () => [
    {
      title: 'Модель',
      dataIndex: 'best_model',
      key: 'best_model',
      render: (text, record) => (
        <div>
          <div>{text}</div>
          {record.is_ensemble && (
            <Tag color="blue">Ансамбль</Tag>
          )}
        </div>
      ),
      sorter: (a, b) => a.best_model.localeCompare(b.best_model),
    },
    {
      title: 'Оценка (валидация)',
      dataIndex: 'score_val',
      key: 'score_val',
      render: (text) => text.toFixed(4),
      sorter: (a, b) => b.score_val - a.score_val,
      defaultSortOrder: 'descend',
    },
    {
      title: 'Оценка (тест)',
      dataIndex: 'score_test',
      key: 'score_test',
      render: (text) => (text ? text.toFixed(4) : '-'),
      sorter: (a, b) => (b.score_test || 0) - (a.score_test || 0),
    },
    {
      title: 'Время обучения',
      dataIndex: 'fit_time',
      key: 'fit_time',
      render: (text) => `${text.toFixed(2)} сек`,
      sorter: (a, b) => a.fit_time - b.fit_time,
    },
    {
      title: 'Время прогноза',
      dataIndex: 'pred_time',
      key: 'pred_time',
      render: (text) => `${text.toFixed(4)} сек/выб.`,
      sorter: (a, b) => a.pred_time - b.pred_time,
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString('ru-RU'),
      sorter: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            onClick={() => handleViewModelDetails(record.id)}
            icon={<InfoCircleOutlined />}
          >
            Детали
          </Button>
          <Button 
            size="small"
            type="primary"
            onClick={() => handleUseModel(record.id)}
            icon={<LineChartOutlined />}
          >
            Использовать
          </Button>
        </Space>
      ),
    },
  ];

  // Эмуляция данных моделей, если они не загружены
  const mockTrainedModels = [
    {
      id: 'model1',
      name: 'AutoGluon Model 1',
      best_model: 'DeepARModel',
      score_val: 0.921,
      score_test: 0.918,
      fit_time: 120.5,
      pred_time: 0.0025,
      created_at: '2023-04-14T10:30:00',
      dataset_id: 'dataset1',
      is_ensemble: false,
      metrics: {
        'MASE': 0.921,
        'RMSE': 10.45,
        'MAE': 8.32,
        'MAPE': 12.6,
        'R²': 0.85
      },
      complexity: 0.7
    },
    {
      id: 'model2',
      name: 'AutoGluon Ensemble',
      best_model: 'WeightedEnsemble',
      score_val: 0.956,
      score_test: 0.944,
      fit_time: 324.8,
      pred_time: 0.0052,
      created_at: '2023-04-15T14:45:00',
      dataset_id: 'dataset1',
      is_ensemble: true,
      metrics: {
        'MASE': 0.956,
        'RMSE': 8.21,
        'MAE': 6.45,
        'MAPE': 9.3,
        'R²': 0.92
      },
      complexity: 0.9
    },
    {
      id: 'model3',
      name: 'Simple Feed Forward',
      best_model: 'SimpleFeedForwardModel',
      score_val: 0.875,
      score_test: 0.864,
      fit_time: 45.2,
      pred_time: 0.0012,
      created_at: '2023-04-16T09:15:00',
      dataset_id: 'dataset2',
      is_ensemble: false,
      metrics: {
        'MASE': 0.875,
        'RMSE': 12.87,
        'MAE': 10.15,
        'MAPE': 14.3,
        'R²': 0.78
      },
      complexity: 0.4
    }
  ];

  // Используем данные моделей или заглушку
  const displayedModels = trainedModels || mockTrainedModels;

  // Обработчики действий с моделями
  const handleViewModelDetails = (modelId) => {
    message.info(`Просмотр деталей модели ${modelId}`);
    // В реальном приложении здесь будет переход на страницу деталей модели
  };

  const handleUseModel = (modelId) => {
    message.success(`Модель ${modelId} выбрана для прогнозирования`);
    // В реальном приложении здесь будет переход на страницу прогнозирования с выбранной моделью
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <TitleTypography level={2}>Сравнение моделей</TitleTypography>
          </Col>
          <Col>
            <Space>
              <Button 
                icon={<SyncOutlined />} 
                onClick={refetchModels}
                loading={modelsLoading}
              >
                Обновить
              </Button>
              <Button 
                type="primary" 
                icon={<ExperimentOutlined />}
                onClick={() => window.location.href = "/training"}
              >
                Обучить новую модель
              </Button>
            </Space>
          </Col>
        </Row>

        {modelsLoading ? (
          <Loading tip="Загрузка моделей..." />
        ) : modelsError ? (
          <ErrorDisplay error={modelsError} onRetry={refetchModels} />
        ) : (
          <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
            <TabPane 
              tab={
                <span>
                  <BarChartOutlined />
                  Сравнительный анализ
                </span>
              } 
              key="1"
            >
              <Card>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={12}>
                      <Space>
                        <Text strong>Датасет:</Text>
                        <Select 
                          placeholder="Все датасеты" 
                          style={{ width: 250 }}
                          value={selectedDatasetId}
                          onChange={handleDatasetChange}
                          allowClear
                        >
                          {datasets?.map((dataset) => (
                            <Option key={dataset.id} value={dataset.id}>
                              {dataset.name} ({dataset.rows} строк)
                            </Option>
                          ))}
                        </Select>
                      </Space>
                    </Col>
                    <Col xs={24} md={12}>
                      <Space>
                        <Text strong>Метрика:</Text>
                        <Radio.Group 
                          value={metricType} 
                          onChange={handleMetricChange}
                          buttonStyle="solid"
                        >
                          <Radio.Button value="score_val">Валидация</Radio.Button>
                          <Radio.Button value="score_test">Тест</Radio.Button>
                          <Radio.Button value="fit_time">Время обучения</Radio.Button>
                          <Radio.Button value="pred_time">Время прогноза</Radio.Button>
                        </Radio.Group>
                        <Tooltip title="Сортировать по метрике">
                          <Switch 
                            checked={sortByMetric} 
                            onChange={setSortByMetric} 
                            checkedChildren="Метрика" 
                            unCheckedChildren="Дата"
                          />
                        </Tooltip>
                      </Space>
                    </Col>
                  </Row>

                  <Divider orientation="left">Выберите модели для сравнения</Divider>
                  
                  <Select
                    mode="multiple"
                    placeholder="Выберите модели для сравнения"
                    value={selectedModels}
                    onChange={handleModelSelectionChange}
                    style={{ width: '100%' }}
                    optionLabelProp="label"
                  >
                    {filteredModels.map(model => (
                      <Option 
                        key={model.id} 
                        value={model.id}
                        label={`${model.name || model.best_model}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>
                            {model.name || model.best_model}
                            {model.is_ensemble && <Tag color="blue" style={{ marginLeft: 8 }}>Ансамбль</Tag>}
                          </span>
                          <span style={{ color: '#999' }}>
                            {new Date(model.created_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </Option>
                    ))}
                  </Select>

                  {selectedModels.length === 0 ? (
                    <Empty description="Выберите модели для сравнения" />
                  ) : (
                    <>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} md={12}>
                          <Card 
                            title="Сравнение по метрике" 
                            extra={
                              <Switch 
                                checked={showComparisonChart} 
                                onChange={setShowComparisonChart} 
                                checkedChildren="График" 
                                unCheckedChildren="График"
                              />
                            }
                          >
                            {showComparisonChart ? (
                              <div style={{ height: 300 }}>
                                <Bar 
                                  data={getModelComparisonChartData()} 
                                  options={chartOptions}
                                />
                              </div>
                            ) : (
                              <Table 
                                dataSource={getSelectedModelsData()} 
                                columns={[
                                  {
                                    title: 'Модель',
                                    dataIndex: 'best_model',
                                    key: 'best_model',
                                  },
                                  {
                                    title: metricType === 'score_val' ? 'Оценка (валидация)' :
                                          metricType === 'score_test' ? 'Оценка (тест)' :
                                          metricType === 'fit_time' ? 'Время обучения (сек)' :
                                          'Время прогноза (сек/выборка)',
                                    dataIndex: metricType,
                                    key: metricType,
                                    render: value => (typeof value === 'number' ? value.toFixed(4) : '-'),
                                    sorter: (a, b) => {
                                      if (metricType === 'fit_time' || metricType === 'pred_time') {
                                        return a[metricType] - b[metricType];
                                      }
                                      return b[metricType] - a[metricType];
                                    },
                                    defaultSortOrder: (metricType === 'fit_time' || metricType === 'pred_time') ? 
                                      'ascend' : 'descend',
                                  }
                                ]}
                                pagination={false}
                                size="small"
                              />
                            )}
                          </Card>
                        </Col>
                        <Col xs={24} md={12}>
                          <Card title="Радар характеристик">
                            <div style={{ height: 300 }}>
                              <Radar 
                                data={getModelRadarChartData()} 
                                options={radarOptions}
                              />
                            </div>
                          </Card>
                        </Col>
                      </Row>

                      <Card title="Сравнение метрик">
                        <Table 
                          dataSource={getComparisonTableData()} 
                          columns={getComparisonTableColumns()}
                          pagination={false}
                          scroll={{ x: 'max-content' }}
                          size="small"
                          bordered
                        />
                      </Card>

                      <div style={{ textAlign: 'right' }}>
                        <Button 
                          type="primary" 
                          icon={<FileExcelOutlined />}
                          onClick={handleExportComparison}
                        >
                          Экспорт сравнения
                        </Button>
                      </div>
                    </>
                  )}
                </Space>
              </Card>
            </TabPane>
            
            <TabPane 
              tab={
                <span>
                  <TableOutlined />
                  Лидерборд моделей
                </span>
              } 
              key="2"
            >
              <Card>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Space>
                        <Text strong>Датасет:</Text>
                        <Select 
                          placeholder="Все датасеты" 
                          style={{ width: 250 }}
                          value={selectedDatasetId}
                          onChange={handleDatasetChange}
                          allowClear
                        >
                          {datasets?.map((dataset) => (
                            <Option key={dataset.id} value={dataset.id}>
                              {dataset.name} ({dataset.rows} строк)
                            </Option>
                          ))}
                        </Select>
                      </Space>
                    </Col>
                    <Col>
                      <Button 
                        icon={<DownloadOutlined />}
                        onClick={() => message.success('Таблица лидерборда экспортирована')}
                      >
                        Экспорт таблицы
                      </Button>
                    </Col>
                  </Row>

                  <Table 
                    dataSource={filteredModels} 
                    columns={getLeaderboardTableColumns()}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                    }}
                  />
                </Space>
              </Card>
            </TabPane>
            
            <TabPane 
              tab={
                <span>
                  <AppstoreOutlined />
                  Типы моделей
                </span>
              } 
              key="3"
            >
              <Card>
                <Collapse defaultActiveKey={['1', '2']}>
                  <Panel header="Статистические модели" key="1">
                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={8}>
                        <Card title="Naïve" size="small">
                          <Paragraph>
                            Простая прогнозная модель, где прогноз равен последнему наблюдению.
                          </Paragraph>
                          <Tag color="blue">Быстрая</Tag>
                          <Tag color="orange">Низкая точность</Tag>
                        </Card>
                      </Col>
                      <Col xs={24} md={8}>
                        <Card title="ARIMA" size="small">
                          <Paragraph>
                            Авторегрессионная интегрированная модель скользящего среднего для временных рядов.
                          </Paragraph>
                          <Tag color="blue">Интерпретируемая</Tag>
                          <Tag color="green">Средняя точность</Tag>
                        </Card>
                      </Col>
                      <Col xs={24} md={8}>
                        <Card title="ETS" size="small">
                          <Paragraph>
                            Экспоненциальное сглаживание с декомпозицией на тренд и сезонность.
                          </Paragraph>
                          <Tag color="blue">Учитывает сезонность</Tag>
                          <Tag color="green">Средняя точность</Tag>
                        </Card>
                      </Col>
                    </Row>
                  </Panel>
                  
                  <Panel header="Модели глубокого обучения" key="2">
                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={8}>
                        <Card title="DeepAR" size="small">
                          <Paragraph>
                            Авторегрессионная модель на основе RNN для вероятностного прогнозирования.
                          </Paragraph>
                          <Tag color="purple">Вероятностная</Tag>
                          <Tag color="green">Высокая точность</Tag>
                        </Card>
                      </Col>
                      <Col xs={24} md={8}>
                        <Card title="Transformer" size="small">
                          <Paragraph>
                            Модель на основе механизма внимания для захвата сложных зависимостей.
                          </Paragraph>
                          <Tag color="red">Требовательная</Tag>
                          <Tag color="green">Высокая точность</Tag>
                        </Card>
                      </Col>
                      <Col xs={24} md={8}>
                        <Card title="N-BEATS" size="small">
                          <Paragraph>
                            Нейронная сеть с интерпретируемыми блоками тренда и сезонности.
                          </Paragraph>
                          <Tag color="blue">Интерпретируемая</Tag>
                          <Tag color="green">Высокая точность</Tag>
                        </Card>
                      </Col>
                    </Row>
                  </Panel>
                  
                  <Panel header="Ансамблевые методы" key="3">
                    <Row gutter={[16, 16]}>
                      <Col xs={24}>
                        <Card title="Weighted Ensemble" size="small">
                          <Paragraph>
                            Взвешенный ансамбль моделей, который объединяет прогнозы нескольких моделей с разными весами.
                          </Paragraph>
                          <Paragraph>
                            AutoGluon TimesSeries автоматически создает ансамбли из лучших моделей для повышения точности прогнозирования.
                          </Paragraph>
                          <Tag color="red">Комплексная</Tag>
                          <Tag color="green">Наивысшая точность</Tag>
                        </Card>
                      </Col>
                    </Row>
                  </Panel>
                </Collapse>
                
                <Divider />
                
                <Alert
                  message="О библиотеке AutoGluon TimeSeries"
                  description={
                    <div>
                      <Paragraph>
                        AutoGluon TimeSeries 1.2 - это библиотека автоматического машинного обучения для прогнозирования временных рядов, 
                        которая упрощает обучение высокоточных моделей без необходимости ручной настройки.
                      </Paragraph>
                      <Paragraph>
                        Ключевые возможности:
                        <ul>
                          <li>Автоматический выбор и настройка различных моделей временных рядов</li>
                          <li>Создание ансамблей для повышения точности прогнозирования</li>
                          <li>Поддержка различных частот данных (ежедневные, еженедельные, ежемесячные и т.д.)</li>
                          <li>Вероятностное прогнозирование с квантилями для оценки неопределенности</li>
                        </ul>
                      </Paragraph>
                    </div>
                  }
                  type="info"
                  showIcon
                />
              </Card>
            </TabPane>
          </Tabs>
        )}
      </Space>
    </div>
  );
};

export default ModelComparison;