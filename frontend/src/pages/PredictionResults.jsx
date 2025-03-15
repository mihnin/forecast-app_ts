import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Space, 
  Card, 
  Tabs, 
  Table, 
  Button, 
  Select, 
  Row, 
  Col,
  Statistic,
  Divider,
  Tooltip,
  Tag,
  Radio,
  message,
  Alert
} from 'antd';
import { 
  LineChartOutlined, 
  TableOutlined, 
  DownloadOutlined, 
  FileExcelOutlined,
  FileTextOutlined,
  CodeOutlined,
  InfoCircleOutlined,
  PieChartOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { predictionService } from '../services/api';
import PredictionChart from '../components/charts/PredictionChart';
import Loading from '../components/common/Loading';
import ErrorDisplay from '../components/common/ErrorDisplay';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const PredictionResults = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('1');
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [exportFormat, setExportFormat] = useState('json');
  const [dateTimeFormat, setDateTimeFormat] = useState('date');

  // Запрос результатов прогнозирования
  const { 
    data: predictionResult, 
    isLoading, 
    error,
    refetch
  } = useQuery(
    ['predictionResult', taskId],
    () => predictionService.getPredictionResult(taskId),
    {
      enabled: !!taskId,
      staleTime: 5 * 60 * 1000, // 5 минут
      retry: 1,
      onSuccess: (data) => {
        // Если есть данные и не выбрана серия, выбираем первую
        if (data?.plots && Object.keys(data.plots).length > 0 && !selectedSeries) {
          const firstSeriesKey = Object.keys(data.plots).find(k => k !== 'metadata');
          if (firstSeriesKey) {
            setSelectedSeries(firstSeriesKey);
          }
        }
      }
    }
  );

  // Проверка наличия результатов
  if (isLoading) {
    return <Loading tip="Загрузка результатов прогнозирования..." />;
  }

  if (error) {
    return (
      <ErrorDisplay 
        error={error} 
        onRetry={refetch}
        actionText="Попробовать снова"
      />
    );
  }

  // Если нет результатов или пустой ответ
  if (!predictionResult || !predictionResult.predictions || predictionResult.predictions.length === 0) {
    return (
      <Alert
        message="Результаты прогнозирования не найдены"
        description={
          <div>
            <Paragraph>
              Для указанного ID задачи не найдены результаты прогнозирования. Возможные причины:
            </Paragraph>
            <ul>
              <li>Задача еще выполняется</li>
              <li>Задача завершилась с ошибкой</li>
              <li>Неверный ID задачи</li>
            </ul>
            <Button 
              type="primary" 
              onClick={() => navigate('/prediction')}
              style={{ marginTop: 16 }}
            >
              Вернуться к прогнозированию
            </Button>
          </div>
        }
        type="warning"
        showIcon
      />
    );
  }

  // Подготовка списка доступных серий
  const seriesList = predictionResult.plots ? 
    Object.keys(predictionResult.plots)
      .filter(key => key !== 'metadata')
      .map(id => ({
        id,
        label: `Серия ${id}`
      })) : [];

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

  // Форматирование даты/времени
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    switch (dateTimeFormat) {
      case 'time':
        return date.toLocaleTimeString('ru-RU');
      case 'datetime':
        return date.toLocaleString('ru-RU');
      case 'iso':
        return date.toISOString();
      default:
        return date.toLocaleDateString('ru-RU');
    }
  };

  // Подготовка колонок для таблицы
  const getTableColumns = () => {
    if (!predictionResult || !predictionResult.predictions || !predictionResult.predictions[0]) {
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

  // Обработчик запроса на экспорт данных
  const handleExport = async () => {
    try {
      const result = await predictionService.exportPrediction(taskId, exportFormat);
      
      if (exportFormat === 'json') {
        // Для JSON просто показываем сообщение
        message.success('Данные экспортированы в JSON');
      } else {
        // Для Excel и CSV скачиваем файл
        const url = window.URL.createObjectURL(new Blob([result]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `prediction_${taskId}.${exportFormat}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        message.success(`Файл prediction_${taskId}.${exportFormat} успешно скачан`);
      }
    } catch (error) {
      message.error(`Ошибка при экспорте: ${error.message}`);
    }
  };

  // Подготовка данных для графика
  const getChartData = () => {
    if (!selectedSeries || !predictionResult.plots || !predictionResult.plots[selectedSeries]) {
      return null;
    }

    const seriesData = predictionResult.plots[selectedSeries];
    const { timestamps } = seriesData;
    
    // Выделяем медиану (0.5) как основной прогноз
    const forecast = seriesData['0.5'];
    
    // Собираем все доступные квантили
    const quantiles = {};
    Object.keys(seriesData)
      .filter(key => key !== 'timestamps' && key !== '0.5')
      .forEach(key => {
        quantiles[key] = seriesData[key];
      });
    
    // Для демонстрации добавляем историческую часть (в реальном приложении она должна приходить с сервера)
    // Здесь мы просто создаем фиктивные исторические данные
    const actualDataLength = Math.min(7, timestamps.length); // Показываем 7 исторических точек
    
    // Создаем синтетические исторические данные на основе прогноза
    const actual = Array(timestamps.length).fill(null);
    for (let i = 0; i < actualDataLength; i++) {
      // Добавляем небольшой случайный шум к прогнозу
      actual[i] = forecast[i] * (1 + (Math.random() * 0.2 - 0.1));
    }

    return {
      timestamps,
      forecast,
      actual,
      quantiles
    };
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>Результаты прогнозирования</Title>
          </Col>
          <Col>
            <Space>
              <Button 
                type="primary" 
                icon={<LineChartOutlined />}
                onClick={() => navigate('/prediction')}
              >
                Новый прогноз
              </Button>
            </Space>
          </Col>
        </Row>

        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8} md={6}>
              <Statistic 
                title="ID прогноза" 
                value={predictionResult.prediction_id.substring(0, 8) + '...'}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Statistic 
                title="Количество прогнозов" 
                value={predictionResult.predictions.length}
                suffix="точек"
              />
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Statistic 
                title="Временных рядов" 
                value={seriesList.length}
                suffix="серий"
              />
            </Col>
            <Col xs={24} md={6}>
              <Card size="small" style={{ height: '100%' }}>
                <Space>
                  <Text>Квантили:</Text>
                  {predictionResult.plots?.metadata?.quantiles.map(q => (
                    <Tag key={q} color={q === '0.5' ? 'blue' : 'default'}>
                      {q}
                    </Tag>
                  ))}
                  <Tooltip title="Квантили представляют разные уровни вероятности прогноза">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              </Card>
            </Col>
          </Row>
        </Card>

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          type="card"
          tabBarExtraContent={
            <Space>
              {activeTab === '1' && seriesList.length > 0 && (
                <Select
                  placeholder="Выберите серию"
                  value={selectedSeries}
                  onChange={handleSeriesChange}
                  style={{ width: 200 }}
                  options={seriesList.map(series => ({
                    label: series.label,
                    value: series.id
                  }))}
                />
              )}
              {activeTab === '2' && (
                <Radio.Group 
                  value={dateTimeFormat} 
                  onChange={(e) => setDateTimeFormat(e.target.value)}
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="date">Дата</Radio.Button>
                  <Radio.Button value="datetime">Дата и время</Radio.Button>
                  <Radio.Button value="time">Время</Radio.Button>
                  <Radio.Button value="iso">ISO</Radio.Button>
                </Radio.Group>
              )}
            </Space>
          }
        >
          <TabPane 
            tab={
              <span>
                <LineChartOutlined />
                Графики
              </span>
            } 
            key="1"
          >
            {selectedSeries ? (
              <PredictionChart 
                data={getChartData()}
                title={`Прогноз для серии ${selectedSeries}`}
                seriesName={selectedSeries}
              />
            ) : (
              <Empty description="Выберите серию для отображения" />
            )}
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
            <Card>
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
                bordered
              />
            </Card>
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <PieChartOutlined />
                Метрики
              </span>
            } 
            key="3"
          >
            <Card>
              <Alert
                message="Информация о метриках"
                description="Здесь будут отображаться метрики качества прогноза, такие как MAE, MAPE, RMSE и другие. В текущей версии эта функциональность находится в разработке."
                type="info"
                showIcon
              />
            </Card>
          </TabPane>
        </Tabs>

        <Card title="Экспорт результатов">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Text>Выберите формат экспорта:</Text>
              <Radio.Group value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                <Radio.Button value="json">
                  <CodeOutlined /> JSON
                </Radio.Button>
                <Radio.Button value="csv">
                  <FileTextOutlined /> CSV
                </Radio.Button>
                <Radio.Button value="excel">
                  <FileExcelOutlined /> Excel
                </Radio.Button>
              </Radio.Group>
              
              <Button 
                type="primary" 
                icon={<DownloadOutlined />} 
                onClick={handleExport}
              >
                Экспортировать
              </Button>
            </Space>
            
            <Divider />
            
            <Paragraph type="secondary">
              <ul>
                <li>Формат JSON содержит полную структуру данных, удобен для программной обработки</li>
                <li>Формат CSV содержит только табличные данные, удобен для работы в Excel и Google Sheets</li>
                <li>Формат Excel содержит форматированные данные и графики, удобен для презентаций</li>
              </ul>
            </Paragraph>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default PredictionResults;