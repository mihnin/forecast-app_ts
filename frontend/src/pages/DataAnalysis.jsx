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
  message
} from 'antd';
import { 
  BarChartOutlined, 
  LineChartOutlined, 
  ExceptionOutlined, 
  ReloadOutlined, 
  AreaChartOutlined
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import { dataService } from '../services/api';
import { useQueueStatus } from '../hooks/useQueueStatus';
import QueueIndicator from '../components/queue/QueueIndicator';
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';

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
          mockResult = { success