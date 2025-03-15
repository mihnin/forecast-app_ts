// src/pages/DataAnalysis.jsx
import React, { useState } from 'react';
import { 
  Card, 
  Typography, 
  Space, 
  Button, 
  Form, 
  Select, 
  Tabs, 
  Divider, 
  Tag, 
  Spin, 
  Collapse, 
  Radio,
  Row,
  Col,
  Empty,
  Alert,
  message,
  Table,
  InputNumber,
  Switch,
  Tooltip,
  Statistic
} from 'antd';
import { 
  BarChartOutlined, 
  LineChartOutlined, 
  ExceptionOutlined, 
  ReloadOutlined, 
  AreaChartOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  TableOutlined
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import { dataService } from '../services/api';
import { useQueueStatus } from '../hooks/useQueueStatus';
import QueueIndicator from '../components/queue/QueueIndicator';
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';

// Импортируем компоненты для визуализации
import { Line, Bar, Heatmap } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title as ChartTitle, Tooltip as ChartTooltip, Legend } from 'chart.js';

// Регистрируем компоненты для Chart.js
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ChartTitle, ChartTooltip, Legend);

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { Panel } = Collapse;

const DataAnalysis = () => {
  const [form] = Form.useForm();
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [columns, setColumns] = useState([]);
  const [analysisType, setAnalysisType] = useState('distribution');
  const [analysisParams, setAnalysisParams] = useState({});
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  // Обработчик изменения датасета
  const handleDatasetChange = (value) => {
    setSelectedDataset(value);
    form.setFieldsValue({
      dateColumn: undefined,
      targetColumn: undefined,
      idColumn: undefined,
      staticFeatures: [],
    });
    setAnalysisResult(null);
  };

  // Обработчик изменения типа анализа
  const handleAnalysisTypeChange = (value) => {
    setAnalysisType(value);
    setAnalysisParams({});
  };

  // Обработчик отправки формы
  const handleSubmit = async (values) => {
    if (!selectedDataset) {
      message.error('Пожалуйста, выберите датасет для анализа');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Подготовка параметров для анализа
      const columnSelection = {
        date_column: values.dateColumn,
        target_column: values.targetColumn,
        id_column: values.idColumn || null,
        static_features: values.staticFeatures || [],
      };

      // Параметры в зависимости от типа анализа
      let analysisParams = {};
      switch (analysisType) {
        case 'distribution':
          analysisParams = {};
          break;
        case 'timeseries':
          analysisParams = {
            decompose: values.decompose || false,
            seasonal_period: values.seasonal_period || 'auto',
          };
          break;
        case 'outliers':
          analysisParams = {
            method: values.outlierMethod || 'iqr',
          };
          break;
        case 'correlation':
          analysisParams = {};
          break;
        default:
          analysisParams = {};
      }

      // В реальном приложении здесь будет запрос к API
      // const response = await dataService.analyzeData(selectedDataset, columnSelection, analysisType, analysisParams);
      
      // Эмуляция запроса и ответа
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Эмуляция результатов анализа
      let mockResult;
      switch (analysisType) {
        case 'distribution':
          mockResult = {
            success: true,
            analysis_id: 'dist_' + Date.now(),
            results: {
              stats: {
                count: 1000,
                mean: 120.45,
                std: 30.22,
                min: 10.5,
                '25%': 98.75,
                '50%': 118.2,
                '75%': 142.8,
                max: 230.1
              },
              histogram: {
                bins: [0, 50, 100, 150, 200, 250],
                values: [50, 350, 400, 150, 50]
              }
            }
          };
          break;
        case 'timeseries':
          mockResult = {
            success: true,
            analysis_id: 'ts_' + Date.now(),
            results: {
              trend: {
                dates: ['2022-01-01', '2022-02-01', '2022-03-01'],
                values: [100, 120, 110]
              },
              seasonal: {
                days_of_week: [1, 2, 3, 4, 5, 6, 7],
                values: [95, 100, 105, 110, 115, 90, 85]
              },
              decomposition: {
                trend_strength: 0.65,
                seasonal_strength: 0.4,
                recommendations: [
                  'Обнаружена умеренная сезонность',
                  'Рекомендуется использовать модели с учетом сезонности'
                ]
              }
            }
          };
          break;
        case 'outliers':
          mockResult = {
            success: true,
            analysis_id: 'out_' + Date.now(),
            results: {
              total_rows: 1000,
              outliers_count: 25,
              outliers_percentage: 2.5,
              method: 'IQR (межквартильный размах)',
              recommendations: [
                'Обнаружено 25 выбросов (2.5% данных)',
                'Рекомендуется рассмотреть возможность их обработки'
              ]
            }
          };
          break;
        case 'correlation':
          mockResult = {
            success: true,
            analysis_id: 'corr_' + Date.now(),
            results: {
              correlation_matrix: {
                columns: ['target', 'feature1', 'feature2'],
                data: [
                  [1.0, 0.75, -0.2],
                  [0.75, 1.0, 0.1],
                  [-0.2, 0.1, 1.0]
                ]
              },
              top_correlations: [
                { feature: 'feature1', correlation: 0.75 },
                { feature: 'feature2', correlation: -0.2 }
              ],
              recommendations: [
                'feature1 имеет сильную корреляцию с целевой переменной',
                'feature2 имеет слабую отрицательную корреляцию'
              ]
            }
          };
          break;
        default:
          mockResult = { 
            success: false, 
            message: 'Неизвестный тип анализа' 
          };
      }

      setAnalysisResult(mockResult);
      message.success('Анализ успешно выполнен!');
    } catch (error) {
      console.error('Ошибка при выполнении анализа:', error);
      message.error(`Ошибка при выполнении анализа: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Рендеринг результатов для распределения
  const renderDistributionResults = (results) => {
    if (!results) return <Empty description="Нет данных для отображения" />;

    const { stats, histogram } = results;
    
    // Настройка данных для гистограммы
    const chartData = {
      labels: histogram.bins.slice(0, -1).map((bin, index) => `${bin}-${histogram.bins[index + 1]}`),
      datasets: [
        {
          label: 'Частота',
          data: histogram.values,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Распределение значений',
        },
      },
    };

    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Title level={4}>Распределение целевой переменной</Title>
          </Col>
          
          <Col xs={24} md={8}>
            <Card title="Статистика">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Statistic title="Количество" value={stats.count} />
                <Statistic title="Среднее" value={stats.mean.toFixed(2)} />
                <Statistic title="Ст. отклонение" value={stats.std.toFixed(2)} />
                <Statistic title="Минимум" value={stats.min.toFixed(2)} />
                <Statistic title="25%" value={stats['25%'].toFixed(2)} />
                <Statistic title="Медиана" value={stats['50%'].toFixed(2)} />
                <Statistic title="75%" value={stats['75%'].toFixed(2)} />
                <Statistic title="Максимум" value={stats.max.toFixed(2)} />
              </Space>
            </Card>
          </Col>
          
          <Col xs={24} md={16}>
            <Card title="Гистограмма">
              <div style={{ height: 300 }}>
                <Bar data={chartData} options={chartOptions} />
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // Рендеринг результатов для временного ряда
  const renderTimeSeriesResults = (results) => {
    if (!results) return <Empty description="Нет данных для отображения" />;

    const { trend, seasonal, decomposition } = results;
    
    // Настройка данных для тренда
    const trendChartData = {
      labels: trend.dates,
      datasets: [
        {
          label: 'Тренд',
          data: trend.values,
          fill: false,
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          tension: 0.1,
        },
      ],
    };

    // Настройка данных для сезонности
    const seasonalChartData = {
      labels: seasonal.days_of_week.map(day => `День ${day}`),
      datasets: [
        {
          label: 'Сезонность',
          data: seasonal.values,
          fill: false,
          backgroundColor: 'rgba(153, 102, 255, 0.5)',
          borderColor: 'rgba(153, 102, 255, 1)',
          tension: 0.1,
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
      },
    };

    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Title level={4}>Анализ временного ряда</Title>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="Тренд">
              <div style={{ height: 250 }}>
                <Line data={trendChartData} options={chartOptions} />
              </div>
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="Сезонность">
              <div style={{ height: 250 }}>
                <Line data={seasonalChartData} options={chartOptions} />
              </div>
            </Card>
          </Col>

          <Col span={24}>
            <Card title="Декомпозиция временного ряда">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Statistic
                    title="Сила тренда"
                    value={decomposition.trend_strength}
                    precision={2}
                    suffix={<Tooltip title="Выше значения означают более выраженный тренд"><InfoCircleOutlined /></Tooltip>}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <Statistic
                    title="Сила сезонности"
                    value={decomposition.seasonal_strength}
                    precision={2}
                    suffix={<Tooltip title="Выше значения означают более выраженную сезонность"><InfoCircleOutlined /></Tooltip>}
                  />
                </Col>
                <Col span={24}>
                  <Divider orientation="left">Рекомендации</Divider>
                  <ul>
                    {decomposition.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // Рендеринг результатов для выбросов
  const renderOutliersResults = (results) => {
    if (!results) return <Empty description="Нет данных для отображения" />;

    const { total_rows, outliers_count, outliers_percentage, method, recommendations } = results;

    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Title level={4}>Анализ выбросов</Title>
          </Col>
          
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Всего строк"
                value={total_rows}
                prefix={<TableOutlined />}
              />
            </Card>
          </Col>
          
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Количество выбросов"
                value={outliers_count}
                prefix={<ExceptionOutlined />}
                valueStyle={{ color: outliers_percentage > 5 ? '#cf1322' : '#3f8600' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="Процент выбросов"
                value={outliers_percentage}
                precision={2}
                suffix="%"
                prefix={<BarChartOutlined />}
                valueStyle={{ color: outliers_percentage > 5 ? '#cf1322' : '#3f8600' }}
              />
            </Card>
          </Col>

          <Col span={24}>
            <Card title="Метод обнаружения выбросов">
              <Paragraph>{method}</Paragraph>
            </Card>
          </Col>

          <Col span={24}>
            <Card title="Рекомендации">
              <ul>
                {recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // Рендеринг результатов для корреляций
  const renderCorrelationResults = (results) => {
    if (!results) return <Empty description="Нет данных для отображения" />;

    const { correlation_matrix, top_correlations, recommendations } = results;

    // Подготовка данных для таблицы корреляций
    const corrTableColumns = correlation_matrix.columns.map(col => ({
      title: col,
      dataIndex: col,
      key: col,
      render: (value) => (
        <div style={{ 
          color: value === 1 ? '#000' : value > 0 ? '#3f8600' : '#cf1322',
          fontWeight: Math.abs(value) > 0.7 ? 'bold' : 'normal'
        }}>
          {value.toFixed(2)}
        </div>
      )
    }));

    const corrTableData = correlation_matrix.columns.map((col, index) => {
      const rowData = { key: index };
      correlation_matrix.columns.forEach((colName, colIndex) => {
        rowData[colName] = correlation_matrix.data[index][colIndex];
      });
      return rowData;
    });

    return (
      <div>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Title level={4}>Анализ корреляций</Title>
          </Col>
          
          <Col span={24}>
            <Card title="Матрица корреляций">
              <Table 
                dataSource={corrTableData} 
                columns={corrTableColumns} 
                pagination={false}
                size="small"
                bordered
              />
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="Топ корреляции с целевой переменной">
              <ul>
                {top_correlations.map((corr, index) => (
                  <li key={index}>
                    <Text strong>{corr.feature}:</Text> {corr.correlation.toFixed(2)}
                    <Tag 
                      color={corr.correlation > 0.7 ? 'green' : corr.correlation > 0.3 ? 'blue' : 'orange'}
                      style={{ marginLeft: 8 }}
                    >
                      {corr.correlation > 0.7 ? 'Сильная' : corr.correlation > 0.3 ? 'Средняя' : 'Слабая'}
                    </Tag>
                  </li>
                ))}
              </ul>
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="Рекомендации">
              <ul>
                {recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // Рендеринг результатов в зависимости от типа анализа
  const renderResults = () => {
    if (!analysisResult) return null;
    if (!analysisResult.success) {
      return <Alert message="Ошибка анализа" description={analysisResult.message} type="error" />;
    }

    switch (analysisType) {
      case 'distribution':
        return renderDistributionResults(analysisResult.results);
      case 'timeseries':
        return renderTimeSeriesResults(analysisResult.results);
      case 'outliers':
        return renderOutliersResults(analysisResult.results);
      case 'correlation':
        return renderCorrelationResults(analysisResult.results);
      default:
        return <Empty description="Неизвестный тип анализа" />;
    }
  };

  // Рендеринг параметров анализа в зависимости от типа
  const renderAnalysisParams = () => {
    switch (analysisType) {
      case 'distribution':
        return null; // Для распределения дополнительные параметры не нужны
      
      case 'timeseries':
        return (
          <>
            <Form.Item
              name="decompose"
              label="Выполнить декомпозицию временного ряда"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="seasonal_period"
              label="Период сезонности"
              tooltip="Выберите 'auto' для автоматического определения или укажите конкретное значение"
            >
              <Select defaultValue="auto">
                <Option value="auto">Авто-определение</Option>
                <Option value="7">7 (неделя)</Option>
                <Option value="12">12 (месяц)</Option>
                <Option value="24">24 (день)</Option>
                <Option value="365">365 (год)</Option>
              </Select>
            </Form.Item>
          </>
        );
      
      case 'outliers':
        return (
          <Form.Item
            name="outlierMethod"
            label="Метод обнаружения выбросов"
          >
            <Radio.Group defaultValue="iqr">
              <Radio.Button value="iqr">IQR (межквартильный размах)</Radio.Button>
              <Radio.Button value="zscore">Z-score</Radio.Button>
              <Radio.Button value="dbscan">DBSCAN</Radio.Button>
            </Radio.Group>
          </Form.Item>
        );
      
      case 'correlation':
        return null; // Для корреляций дополнительные параметры не нужны
      
      default:
        return null;
    }
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>Анализ данных</Title>
        
        <QueueIndicator 
          totalTasks={queueStatus.totalTasks}
          pendingTasks={queueStatus.pendingTasks}
          executingTasks={queueStatus.executingTasks}
          completedTasks={queueStatus.completedTasks}
          failedTasks={queueStatus.failedTasks}
        />
        
        <Card title="Выбор данных и параметров анализа">
          {datasetsLoading ? (
            <Loading tip="Загрузка списка датасетов..." />
          ) : datasetsError ? (
            <ErrorDisplay error={datasetsError} />
          ) : (
            <Form 
              form={form} 
              layout="vertical" 
              onFinish={handleSubmit}
              initialValues={{
                outlierMethod: 'iqr',
                decompose: true,
                seasonal_period: 'auto'
              }}
            >
              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="dataset"
                    label="Выберите датасет для анализа"
                    rules={[{ required: true, message: 'Пожалуйста, выберите датасет' }]}
                  >
                    <Select 
                      placeholder="Выберите датасет" 
                      onChange={handleDatasetChange}
                      loading={datasetsLoading}
                    >
                      {datasets?.map((dataset) => (
                        <Option key={dataset.id} value={dataset.id}>
                          {dataset.name} ({dataset.rows} строк, {dataset.columns} колонок)
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={12}>
                  <Form.Item
                    name="analysisType"
                    label="Тип анализа"
                    rules={[{ required: true, message: 'Пожалуйста, выберите тип анализа' }]}
                    initialValue={analysisType}
                  >
                    <Select 
                      placeholder="Выберите тип анализа" 
                      onChange={handleAnalysisTypeChange}
                    >
                      <Option value="distribution">Распределение данных</Option>
                      <Option value="timeseries">Анализ временного ряда</Option>
                      <Option value="outliers">Обнаружение выбросов</Option>
                      <Option value="correlation">Анализ корреляций</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              
              <Divider orientation="left">Выбор колонок</Divider>
              
              <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="dateColumn"
                    label="Колонка с датой"
                    rules={[{ required: true, message: 'Выберите колонку с датой' }]}
                  >
                    <Select 
                      placeholder="Выберите колонку" 
                      loading={columnsLoading}
                      disabled={!selectedDataset}
                    >
                      {columns.map((column) => (
                        <Option key={column} value={column}>{column}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={8}>
                  <Form.Item
                    name="targetColumn"
                    label="Целевая колонка"
                    rules={[{ required: true, message: 'Выберите целевую колонку' }]}
                  >
                    <Select 
                      placeholder="Выберите колонку" 
                      loading={columnsLoading}
                      disabled={!selectedDataset}
                    >
                      {columns.map((column) => (
                        <Option key={column} value={column}>{column}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={8}>
                  <Form.Item
                    name="idColumn"
                    label="Колонка ID (опционально)"
                  >
                    <Select 
                      placeholder="Выберите колонку" 
                      loading={columnsLoading}
                      disabled={!selectedDataset}
                      allowClear
                    >
                      {columns.map((column) => (
                        <Option key={column} value={column}>{column}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              
              {selectedDataset && columns.length > 0 && (
                <Form.Item
                  name="staticFeatures"
                  label="Дополнительные признаки для анализа"
                >
                  <Select 
                    mode="multiple" 
                    placeholder="Выберите дополнительные колонки" 
                    loading={columnsLoading}
                    disabled={!selectedDataset}
                    optionFilterProp="children"
                    maxTagCount={5}
                  >
                    {columns
                      .filter(col => col !== form.getFieldValue('dateColumn') && 
                                    col !== form.getFieldValue('targetColumn'))
                      .map((column) => (
                        <Option key={column} value={column}>{column}</Option>
                      ))}
                  </Select>
                </Form.Item>
              )}
              
              {renderAnalysisParams()}
              
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={isAnalyzing}
                  disabled={!selectedDataset || columnsLoading}
                  icon={<BarChartOutlined />}
                >
                  {isAnalyzing ? 'Выполнение анализа...' : 'Выполнить анализ'}
                </Button>
              </Form.Item>
            </Form>
          )}
        </Card>
        
        {isAnalyzing ? (
          <Card>
            <Loading tip="Выполняется анализ данных..." />
          </Card>
        ) : analysisResult && (
          <Card 
            title={`Результаты ${
              analysisType === 'distribution' ? 'анализа распределения' : 
              analysisType === 'timeseries' ? 'анализа временного ряда' :
              analysisType === 'outliers' ? 'обнаружения выбросов' :
              'анализа корреляций'
            }`}
            extra={
              <Space>
                <Tag color="blue">ID: {analysisResult.analysis_id}</Tag>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => handleSubmit(form.getFieldsValue())}
                >
                  Обновить
                </Button>
              </Space>
            }
          >
            {renderResults()}
          </Card>
        )}
      </Space>
    </div>
  );
};

export default DataAnalysis;