import React, { useState } from 'react';
import { 
  Card, 
  Space, 
  Typography, 
  Radio, 
  Tooltip, 
  Row, 
  Col, 
  Table, 
  Empty,
  Tag,
  Button,
  List
} from 'antd';
import { InfoCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement
} from 'chart.js';

// Регистрируем компоненты Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend
);

const { Title: TitleTypography, Text, Paragraph } = Typography;

/**
 * Компонент для отображения важности признаков модели
 * 
 * @param {Object} featureImportance - Данные о важности признаков
 * @param {Array} featureImportance.features - Массив названий признаков
 * @param {Array} featureImportance.importance - Массив значений важности
 * @param {string} modelType - Тип модели
 * @param {Object} modelInfo - Дополнительная информация о модели
 */
const ModelFeatureImportance = ({ featureImportance, modelType, modelInfo }) => {
  const [viewType, setViewType] = useState('bar');
  const [normalizeValues, setNormalizeValues] = useState(true);
  
  // Проверка наличия данных
  if (!featureImportance || !featureImportance.features || !featureImportance.importance) {
    return (
      <Card title="Важность признаков">
        <Empty description="Нет данных о важности признаков для этой модели" />
      </Card>
    );
  }

  // Подготовка данных
  const { features, importance } = featureImportance;
  
  // Нормализация значений важности (если требуется)
  const normalizedImportance = normalizeValues 
    ? importance.map(value => {
        const sum = importance.reduce((a, b) => a + b, 0);
        return sum > 0 ? value / sum : 0;
      })
    : importance;
  
  // Сортировка данных по убыванию важности
  const sortedIndices = normalizedImportance
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value)
    .map(item => item.index);
  
  const sortedFeatures = sortedIndices.map(index => features[index]);
  const sortedImportance = sortedIndices.map(index => normalizedImportance[index]);
  
  // Обрезаем до топ-10 признаков для наглядности
  const topFeatures = sortedFeatures.slice(0, 10);
  const topImportance = sortedImportance.slice(0, 10);
  
  // Данные для таблицы
  const tableData = sortedFeatures.map((feature, index) => ({
    key: index,
    feature,
    importance: normalizeValues 
      ? `${(sortedImportance[index] * 100).toFixed(2)}%`
      : sortedImportance[index].toFixed(4),
    value: sortedImportance[index]
  }));
  
  // Данные для столбчатой диаграммы
  const barChartData = {
    labels: topFeatures,
    datasets: [
      {
        label: 'Важность признаков',
        data: topImportance,
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };
  
  // Данные для круговой диаграммы
  const pieChartData = {
    labels: topFeatures,
    datasets: [
      {
        data: topImportance,
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(54, 162, 235, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)',
          'rgba(153, 102, 255, 0.5)',
          'rgba(255, 159, 64, 0.5)',
          'rgba(199, 199, 199, 0.5)',
          'rgba(83, 102, 255, 0.5)',
          'rgba(255, 99, 132, 0.3)',
          'rgba(54, 162, 235, 0.3)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(199, 199, 199, 1)',
          'rgba(83, 102, 255, 1)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Настройки для столбчатой диаграммы
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y', // Горизонтальная диаграмма
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Топ-10 важных признаков',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw;
            return normalizeValues 
              ? `Важность: ${(value * 100).toFixed(2)}%`
              : `Важность: ${value.toFixed(4)}`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: normalizeValues ? 'Относительная важность (%)' : 'Важность признака',
        },
        ticks: {
          callback: function(value) {
            return normalizeValues ? `${(value * 100).toFixed(0)}%` : value.toFixed(2);
          }
        }
      }
    }
  };
  
  // Настройки для круговой диаграммы
  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Распределение важности признаков',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw;
            const label = context.label || '';
            return normalizeValues 
              ? `${label}: ${(value * 100).toFixed(2)}%`
              : `${label}: ${value.toFixed(4)}`;
          }
        }
      }
    }
  };
  
  // Колонки для таблицы
  const columns = [
    {
      title: 'Признак',
      dataIndex: 'feature',
      key: 'feature',
      sorter: (a, b) => a.feature.localeCompare(b.feature),
    },
    {
      title: 'Важность',
      dataIndex: 'importance',
      key: 'importance',
      sorter: (a, b) => a.value - b.value,
      defaultSortOrder: 'descend',
      render: (text, record) => {
        // Определение цвета тега на основе важности
        let color = 'default';
        if (record.value > 0.2) color = 'green';
        else if (record.value > 0.1) color = 'blue';
        else if (record.value > 0.05) color = 'orange';
        
        return <Tag color={color}>{text}</Tag>;
      }
    },
  ];

  // Получение пояснения о важности признаков в зависимости от типа модели
  const getFeatureImportanceExplanation = () => {
    switch (modelType) {
      case 'DeepARModel':
        return 'Важность признаков для DeepAR была оценена с помощью пермутационной важности на тестовом наборе. Больший показатель указывает на большее влияние признака на прогноз.';
      case 'WeightedEnsemble':
        return 'Для ансамблевой модели важность признаков является совокупной из всех моделей, входящих в ансамбль, с учетом их весов.';
      case 'AutoETSModel':
      case 'AutoARIMAModel':
        return 'Для статистических моделей важность признаков была оценена с помощью анализа чувствительности. Больший показатель указывает на более сильное влияние на результат.';
      default:
        return 'Важность признаков показывает относительный вклад каждого признака в результат прогнозирования. Чем выше значение, тем более важен признак для модели.';
    }
  };
  
  // Получение дополнительной информации о модели
  const getFeatureImportanceInfo = () => {
    if (!modelInfo) return null;
    
    return (
      <List
        size="small"
        header={<Text strong>Дополнительная информация</Text>}
        bordered
        dataSource={[
          { label: 'Метод оценки важности', value: modelInfo.importance_method || 'Пермутационная важность' },
          { label: 'Число признаков', value: features.length },
          { label: 'Тип модели', value: modelType }
        ]}
        renderItem={item => (
          <List.Item>
            <Text strong>{item.label}:</Text> {item.value}
          </List.Item>
        )}
      />
    );
  };
  
  return (
    <Card 
      title={
        <Space>
          <TitleTypography level={5}>Важность признаков</TitleTypography>
          <Tooltip title={getFeatureImportanceExplanation()}>
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      }
      extra={
        <Button 
          icon={<DownloadOutlined />}
          size="small"
        >
          Экспорт
        </Button>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Row justify="space-between">
          <Col>
            <Radio.Group 
              value={viewType} 
              onChange={e => setViewType(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="bar">Столбцы</Radio.Button>
              <Radio.Button value="pie">Круговая</Radio.Button>
              <Radio.Button value="table">Таблица</Radio.Button>
            </Radio.Group>
          </Col>
          <Col>
            <Radio.Group 
              value={normalizeValues} 
              onChange={e => setNormalizeValues(e.target.value)}
              buttonStyle="solid"
              optionType="button"
            >
              <Radio.Button value={true}>В процентах</Radio.Button>
              <Radio.Button value={false}>Абсолютные</Radio.Button>
            </Radio.Group>
          </Col>
        </Row>
        
        {viewType === 'bar' && (
          <div style={{ height: 400 }}>
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        )}
        
        {viewType === 'pie' && (
          <div style={{ height: 400 }}>
            <Pie data={pieChartData} options={pieChartOptions} />
          </div>
        )}
        
        {viewType === 'table' && (
          <Table 
            dataSource={tableData} 
            columns={columns}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            size="small"
          />
        )}
        
        {getFeatureImportanceInfo()}
      </Space>
    </Card>
  );
};

export default ModelFeatureImportance;