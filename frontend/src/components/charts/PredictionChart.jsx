import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Space, 
  Select, 
  Switch, 
  Tooltip, 
  Radio, 
  Divider, 
  Typography,
  Empty
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';

// Регистрируем компоненты Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

const { Text } = Typography;

/**
 * Компонент для визуализации результатов прогнозирования временных рядов
 * 
 * @param {Object} data - Данные временного ряда для отображения
 * @param {Array} data.timestamps - Массив временных меток
 * @param {Array} data.actual - Массив фактических значений
 * @param {Array} data.forecast - Массив прогнозных значений
 * @param {Object} data.quantiles - Объект с прогнозами по квантилям (например, {'0.1': [...], '0.9': [...]})
 * @param {string} title - Заголовок графика
 * @param {string} seriesName - Название временного ряда
 */
const PredictionChart = ({ data, title, seriesName }) => {
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);
  const [selectedQuantiles, setSelectedQuantiles] = useState(['0.5']);
  const [dateFormat, setDateFormat] = useState('day');
  const [showActualValues, setShowActualValues] = useState(true);

  // Проверка наличия данных
  if (!data || !data.timestamps || !data.forecast) {
    return (
      <Card>
        <Empty description="Нет данных для построения графика" />
      </Card>
    );
  }

  // Форматирование меток времени в зависимости от выбранного формата
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
  const labels = data.timestamps.map(formatTimestamp);
  
  // Определение индекса начала прогноза
  const forecastStartIdx = data.actual ? data.actual.filter(val => val !== null).length : 0;
  
  // Создание меток для разделения истории и прогноза
  const backgroundColors = labels.map((_, index) => 
    index < forecastStartIdx ? 'rgba(240, 240, 240, 0.3)' : 'rgba(230, 247, 255, 0.3)'
  );

  // Подготовка данных для графика
  const chartData = {
    labels,
    datasets: []
  };

  // Добавление фактических значений, если они есть и должны отображаться
  if (data.actual && showActualValues) {
    chartData.datasets.push({
      label: 'Фактические значения',
      data: data.actual,
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 2,
      spanGaps: false, // Не соединять точки через пропуски (null)
    });
  }

  // Добавление прогнозных значений
  if (selectedQuantiles.includes('0.5')) {
    chartData.datasets.push({
      label: 'Прогноз (медиана)',
      data: Array(forecastStartIdx).fill(null).concat(data.forecast),
      borderColor: 'rgba(54, 162, 235, 1)',
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 2,
      spanGaps: true,
    });
  }

  // Добавление выбранных квантилей (кроме 0.5, она уже добавлена)
  if (data.quantiles) {
    selectedQuantiles.forEach(quantile => {
      if (quantile !== '0.5' && data.quantiles[quantile]) {
        chartData.datasets.push({
          label: `Квантиль ${quantile}`,
          data: Array(forecastStartIdx).fill(null).concat(data.quantiles[quantile]),
          borderColor: quantile < '0.5' 
            ? 'rgba(255, 99, 132, 0.8)' 
            : 'rgba(75, 192, 192, 0.8)',
          backgroundColor: 'transparent',
          pointRadius: 1,
          pointHoverRadius: 4,
          borderWidth: 1,
          borderDash: [5, 5],
          spanGaps: true,
        });
      }
    });
  }

  // Добавление доверительного интервала (заливка между квантилями 0.1 и 0.9)
  if (showConfidenceInterval && data.quantiles && data.quantiles['0.1'] && data.quantiles['0.9']) {
    // Создаем верхнюю границу доверительного интервала
    chartData.datasets.push({
      label: 'Верхняя граница (90%)',
      data: Array(forecastStartIdx).fill(null).concat(data.quantiles['0.9']),
      borderColor: 'transparent',
      pointRadius: 0,
      spanGaps: true,
      fill: '+1', // Заполнять до следующего датасета
    });

    // Создаем нижнюю границу доверительного интервала
    chartData.datasets.push({
      label: 'Нижняя граница (10%)',
      data: Array(forecastStartIdx).fill(null).concat(data.quantiles['0.1']),
      borderColor: 'transparent',
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      pointRadius: 0,
      spanGaps: true,
      fill: '-1', // Заполнять до предыдущего датасета
    });
  }

  // Настройки графика
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        onClick: (e, legendItem, legend) => {
          // Переопределяем поведение по умолчанию, чтобы скрывать только отображаемые наборы данных
          const index = legendItem.datasetIndex;
          const meta = legend.chart.getDatasetMeta(index);
          
          // Не скрываем квантили, если они используются для доверительного интервала
          const isConfidenceBound = 
            legendItem.text === 'Верхняя граница (90%)' || 
            legendItem.text === 'Нижняя граница (10%)';
            
          if (!isConfidenceBound || !showConfidenceInterval) {
            meta.hidden = meta.hidden === null ? !legend.chart.data.datasets[index].hidden : null;
            legend.chart.update();
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (tooltipItems) => {
            // Показываем полную дату в подсказке
            const idx = tooltipItems[0].dataIndex;
            return new Date(data.timestamps[idx]).toLocaleString('ru-RU');
          },
          label: (context) => {
            const label = context.dataset.label || '';
            let value = context.parsed.y;
            if (value !== null && !isNaN(value)) {
              value = value.toFixed(2);
              return `${label}: ${value}`;
            }
            return null;
          }
        }
      },
      title: {
        display: !!title,
        text: title || `Прогноз для ${seriesName || ''}`,
        font: {
          size: 16
        }
      }
    },
    interaction: {
      mode: 'nearest',
      intersect: false,
      axis: 'x'
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Дата'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        title: {
          display: true,
          text: 'Значение'
        },
        beginAtZero: false
      }
    },
    elements: {
      line: {
        tension: 0.3 // Сглаживание линий
      }
    },
    annotation: {
      annotations: {
        line1: {
          type: 'line',
          xMin: forecastStartIdx - 0.5,
          xMax: forecastStartIdx - 0.5,
          borderColor: 'rgba(55, 55, 55, 0.5)',
          borderWidth: 2,
          borderDash: [5, 5],
          label: {
            content: 'Начало прогноза',
            enabled: true,
            position: 'top'
          }
        }
      }
    }
  };

  // Получение доступных квантилей из данных
  const availableQuantiles = data.quantiles 
    ? Object.keys(data.quantiles).sort() 
    : ['0.5'];

  // Обработчик изменения выбранных квантилей
  const handleQuantilesChange = (values) => {
    // Всегда включаем 0.5 (медиана)
    if (!values.includes('0.5')) {
      values.push('0.5');
    }
    setSelectedQuantiles(values);
  };

  // Обработчик включения/выключения доверительного интервала
  const handleConfidenceIntervalChange = (checked) => {
    setShowConfidenceInterval(checked);
  };

  return (
    <Card>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space wrap>
          <div>
            <Text>Формат даты:</Text>
            <Radio.Group 
              value={dateFormat} 
              onChange={(e) => setDateFormat(e.target.value)}
              size="small"
              style={{ marginLeft: 8 }}
            >
              <Radio.Button value="day">День</Radio.Button>
              <Radio.Button value="month">Месяц</Radio.Button>
              <Radio.Button value="year">Год</Radio.Button>
              <Radio.Button value="datetime">Дата и время</Radio.Button>
              <Radio.Button value="time">Время</Radio.Button>
            </Radio.Group>
          </div>

          <Divider type="vertical" />

          {data.actual && (
            <Tooltip title="Показать/скрыть фактические значения">
              <Switch
                checked={showActualValues}
                onChange={setShowActualValues}
                checkedChildren="Факт"
                unCheckedChildren="Факт"
                defaultChecked
              />
            </Tooltip>
          )}

          <Tooltip title="Показать/скрыть доверительный интервал">
            <Switch
              checked={showConfidenceInterval}
              onChange={handleConfidenceIntervalChange}
              checkedChildren="Интервал"
              unCheckedChildren="Интервал"
              disabled={!data.quantiles || !data.quantiles['0.1'] || !data.quantiles['0.9']}
            />
          </Tooltip>
          
          <Select
            mode="multiple"
            style={{ minWidth: 240 }}
            placeholder="Выберите квантили"
            value={selectedQuantiles}
            onChange={handleQuantilesChange}
            options={availableQuantiles.map(q => ({ 
              label: `Квантиль ${q}${q === '0.5' ? ' (медиана)' : ''}`, 
              value: q 
            }))}
            disabled={!data.quantiles}
            maxTagCount={3}
          />
          
          <Tooltip title="Квантили представляют различные уровни вероятности прогноза. Медиана (0.5) - это центральное значение, а другие квантили отражают верхние и нижние границы прогноза с разной степенью уверенности.">
            <InfoCircleOutlined style={{ color: '#1677ff' }} />
          </Tooltip>
        </Space>
        
        <div style={{ height: 400, position: 'relative' }}>
          <Line data={chartData} options={chartOptions} />
          
          {/* Вертикальная линия, разделяющая историю и прогноз */}
          {forecastStartIdx > 0 && (
            <div 
              style={{
                position: 'absolute',
                left: `${(forecastStartIdx / labels.length) * 100}%`,
                top: 0,
                bottom: 0,
                borderLeft: '2px dashed rgba(0, 0, 0, 0.2)',
                pointerEvents: 'none',
                zIndex: 1
              }}
            >
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 5,
                  background: 'rgba(255, 255, 255, 0.8)',
                  padding: '2px 5px',
                  borderRadius: 3,
                  fontSize: 12
                }}
              >
                Прогноз →
              </div>
            </div>
          )}
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            График показывает {showActualValues ? 'фактические и ' : ''}прогнозные значения
            {showConfidenceInterval && data.quantiles && data.quantiles['0.1'] && data.quantiles['0.9'] 
              ? ' с доверительным интервалом 80%' 
              : ''}
          </Text>
        </div>
      </Space>
    </Card>
  );
};

export default PredictionChart;