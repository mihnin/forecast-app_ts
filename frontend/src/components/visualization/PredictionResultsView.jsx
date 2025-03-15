import React, { useState } from 'react';
import { 
  Card, 
  Tabs, 
  Table, 
  Space, 
  Button, 
  Select, 
  Typography, 
  Row, 
  Col, 
  Statistic,
  Empty,
  Tooltip,
  Tag,
  Radio,
  Divider
} from 'antd';
import { 
  LineChartOutlined, 
  TableOutlined, 
  DownloadOutlined, 
  InfoCircleOutlined,
  DashboardOutlined,
  CloudDownloadOutlined
} from '@ant-design/icons';
import TimeSeriesChart from '../charts/TimeSeriesChart';

const { Title: TitleTypography, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

/**
 * Компонент для отображения результатов прогнозирования
 * @param {Object} predictionResult - Результаты прогнозирования
 * @param {function} onDownload - Функция для скачивания результатов
 */
const PredictionResultsView = ({ predictionResult, onDownload }) => {
  const [activeTab, setActiveTab] = useState('1');
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [dateFormat, setDateFormat] = useState('day');
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);
  const [selectedQuantiles, setSelectedQuantiles] = useState(['0.5']);

  // Проверка наличия данных
  if (!predictionResult || !predictionResult.predictions || !predictionResult.plots) {
    return (
      <Card title="Результаты прогнозирования">
        <Empty 
          description="Нет данных о результатах прогнозирования" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  // Установка первой серии как выбранной, если еще не выбрана
  React.useEffect(() => {
    if (!selectedSeries && predictionResult.plots) {
      const firstSeriesKey = Object.keys(predictionResult.plots).find(k => k !== 'metadata');
      if (firstSeriesKey) {
        setSelectedSeries(firstSeriesKey);
      }
    }
  }, [predictionResult, selectedSeries]);

  // Список серий временных рядов для выбора
  const seriesList = predictionResult.plots ? 
    Object.keys(predictionResult.plots)
      .filter(key => key !== 'metadata')
      .map(id => ({
        id,
        label: `Серия ${id}`
      })) : [];

  // Форматирование меток времени
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    switch (dateFormat) {
      case 'time':
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      case 'month':
        return date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
      case 'year':
        return date.getFullYear().toString();
      case 'datetime':
        return date.toLocaleString('ru-RU', { 
          day: 'numeric', 
          month: 'short', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      default: // день
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  };

  // Подготовка данных для графика
  const getChartData = () => {
    if (!selectedSeries || !predictionResult.plots || !predictionResult.plots[selectedSeries]) {
      return null;
    }

    const seriesData = predictionResult.plots[selectedSeries];
    const { timestamps } = seriesData;
    
    // Создаем массив отформатированных меток времени
    const labels = timestamps.map(formatTimestamp);
    
    // Данные для графика
    const chartData = {
      labels,
      datasets: []
    };

    // Добавляем основной прогноз (медиана - 0.5 квантиль)
    if (selectedQuantiles.includes('0.5')) {
      chartData.datasets.push({
        label: 'Прогноз (медиана)',
        data: seriesData['0.5'],
        borderColor: 'rgba(53, 162, 235, 1)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
      });
    }

    // Добавляем выбранные квантили (кроме 0.5, она уже добавлена)
    selectedQuantiles.forEach(quantile => {
      if (quantile !== '0.5' && seriesData[quantile]) {
        chartData.datasets.push({
          label: `Квантиль ${quantile}`,
          data: seriesData[quantile],
          borderColor: quantile < '0.5' ? 'rgba(255, 99, 132, 0.8)' : 'rgba(75, 192, 192, 0.8)',
          backgroundColor: 'transparent',
          pointRadius: 1,
          pointHoverRadius: 4,
          borderWidth: 1,
          borderDash: [5, 5],
        });
      }
    });

    // Добавляем доверительный интервал (если включен)
    if (showConfidenceInterval && seriesData['0.1'] && seriesData['0.9']) {
      // Верхний интервал
      chartData.datasets.push({
        label: 'Верхняя граница (90%)',
        data: seriesData['0.9'],
        borderColor: 'transparent',
        pointRadius: 0,
        fill: '+1', // Заполнять до следующего датасета
      });

      // Нижний интервал
      chartData.datasets.push({
        label: 'Нижняя граница (10%)',
        data: seriesData['0.1'],
        borderColor: 'transparent',
        backgroundColor: 'rgba(53, 162, 235, 0.2)',
        pointRadius: 0,
        fill: '-1', // Заполнять до предыдущего датасета
      });
    }

    return chartData;
  };

  // Подготовка данных для таблицы
  const getTableData = () => {
    const { predictions } = predictionResult;
    
    // Преобразование данных для таблицы
    const tableData = predictions.map((item, index) => ({
      key: index,
      ...item,
      timestamp_formatted: formatTimestamp(item.timestamp)
    }));

    return tableData;
  };

  // Подготовка колонок для таблицы
  const getTableColumns = () => {
    if (!predictionResult.predictions[0]) {
      return [];
    }

    const prediction = predictionResult.predictions[0];
    const columns = [
      {
        title: 'ID',
        dataIndex: 'item_id',
        key: 'item_id',
        width: 150,
      },
      {
        title: 'Дата/время',
        dataIndex: 'timestamp_formatted',
        key: 'timestamp',
        width: 180,
        sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      }
    ];

    // Добавляем колонки для квантилей
    const quantileKeys = Object.keys(prediction)
      .filter(key => key !== 'item_id' && key !== 'timestamp' && key !== 'timestamp_formatted');
    
    quantileKeys.forEach(key => {
      columns.push({
        title: `Квантиль ${key}`,
        dataIndex: key,
        key,
        render: (value) => value !== null ? value.toFixed(2) : '-',
        sorter: (a, b) => a[key] - b[key],
      });
    });

    return columns;
  };

  // Обработчик изменения выбранной серии
  const handleSeriesChange = (value) => {
    setSelectedSeries(value);
  };

  // Обработчик изменения квантилей
  const handleQuantilesChange = (values) => {
    // Всегда включаем 0.5 (медиана)
    if (!values.includes('0.5')) {
      values.push('0.5');
    }
    setSelectedQuantiles(values);
  };

  // Доступные квантили
  const availableQuantiles = predictionResult.plots?.metadata?.quantiles || ['0.5'];

  return (
    <Card 
      title={
        <Space>
          <TitleTypography level={4}>Результаты прогнозирования</TitleTypography>
          <Tag color="blue">ID: {predictionResult.prediction_id}</Tag>
        </Space>
      }
      extra={
        <Button 
          type="primary" 
          icon={<CloudDownloadOutlined />} 
          onClick={onDownload}
        >
          Экспорт
        </Button>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Statistic 
              title="Количество прогнозов" 
              value={predictionResult.predictions.length} 
              suffix="точек"
              prefix={<DashboardOutlined />}
            />
          </Col>
          <Col xs={24} md={8}>
            <Statistic 
              title="Временных рядов" 
              value={seriesList.length}
              suffix="серий"
              prefix={<LineChartOutlined />}
            />
          </Col>
          <Col xs={24} md={8}>
            <Space>
              <Text strong>Квантили:</Text>
              {availableQuantiles.map(q => (
                <Tag key={q} color={q === '0.5' ? 'blue' : 'default'}>
                  {q}
                </Tag>
              ))}
              <Tooltip title="Квантили представляют разные уровни вероятности прогноза">
                <InfoCircleOutlined />
              </Tooltip>
            </Space>
          </Col>
        </Row>

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          tabBarExtraContent={
            <Space>
              {activeTab === '1' && seriesList.length > 0 && (
                <Select
                  placeholder="Выберите серию"
                  value={selectedSeries}
                  onChange={handleSeriesChange}
                  style={{ width: 150 }}
                  options={seriesList.map(series => ({
                    label: series.label,
                    value: series.id
                  }))}
                />
              )}
              {activeTab === '2' && (
                <Radio.Group 
                  value={dateFormat} 
                  onChange={(e) => setDateFormat(e.target.value)}
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="day">День</Radio.Button>
                  <Radio.Button value="month">Месяц</Radio.Button>
                  <Radio.Button value="datetime">Дата и время</Radio.Button>
                </Radio.Group>
              )}
            </Space>
          }
        >
          <TabPane 
            tab={
              <span>
                <LineChartOutlined />
                График
              </span>
            } 
            key="1"
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Space wrap>
                <Radio.Group 
                  value={dateFormat} 
                  onChange={(e) => setDateFormat(e.target.value)}
                  size="small"
                >
                  <Radio.Button value="day">День</Radio.Button>
                  <Radio.Button value="month">Месяц</Radio.Button>
                  <Radio.Button value="year">Год</Radio.Button>
                  <Radio.Button value="datetime">Дата и время</Radio.Button>
                  <Radio.Button value="time">Время</Radio.Button>
                </Radio.Group>

                <Divider type="vertical" />

                <Tooltip title="Показать/скрыть доверительный интервал">
                  <Button
                    type={showConfidenceInterval ? "primary" : "default"}
                    size="small"
                    onClick={() => setShowConfidenceInterval(!showConfidenceInterval)}
                  >
                    Доверительный интервал
                  </Button>
                </Tooltip>
                
                <Select
                  mode="multiple"
                  style={{ minWidth: 200 }}
                  placeholder="Выберите квантили"
                  value={selectedQuantiles}
                  onChange={handleQuantilesChange}
                  options={availableQuantiles.map(q => ({ 
                    label: `Квантиль ${q}${q === '0.5' ? ' (медиана)' : ''}`, 
                    value: q 
                  }))}
                  maxTagCount={3}
                />
                
                <Tooltip title="Квантили представляют различные уровни вероятности прогноза. Медиана (0.5) - это центральное значение.">
                  <InfoCircleOutlined style={{ color: '#1677ff' }} />
                </Tooltip>
              </Space>

              <div style={{ height: 400 }}>
                {selectedSeries ? (
                  <TimeSeriesChart 
                    data={getChartData()}
                    title={`Прогноз для серии ${selectedSeries}`}
                    seriesName={selectedSeries}
                    availableQuantiles={predictionResult.plots.metadata?.quantiles}
                    showForecastLine={true}
                  />
                ) : (
                  <Empty description="Выберите серию для отображения" />
                )}
              </div>
            </Space>
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <TableOutlined />
                Таблица
              </span>
            } 
            key="2"
          >
            <Table 
              dataSource={getTableData()} 
              columns={getTableColumns()} 
              scroll={{ x: 'max-content' }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
              }}
              size="small"
            />
          </TabPane>
        </Tabs>

        <div style={{ textAlign: 'center' }}>
          <Button 
            icon={<DownloadOutlined />}
            onClick={onDownload}
          >
            Экспортировать результаты
          </Button>
        </div>
      </Space>
    </Card>
  );
};

export default PredictionResultsView;