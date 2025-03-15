// src/components/charts/TimeSeriesChart.jsx
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
 * Универсальный компонент для визуализации временных рядов и прогнозов
 * 
 * @param {Object} props - Свойства компонента
 * @param {Object} props.data - Данные временного ряда для отображения
 * @param {Array} props.data.timestamps - Массив временных меток
 * @param {Array} props.data.actual - Массив фактических значений (опционально)
 * @param {Array} props.data.forecast - Массив прогнозных значений (опционально)
 * @param {Object} props.data.quantiles - Объект с прогнозами по квантилям (опционально)
 * @param {string} props.title - Заголовок графика
 * @param {string} props.seriesName - Название временного ряда
 * @param {Array} props.availableQuantiles - Доступные квантили (опционально)
 * @param {boolean} props.showForecastLine - Показывать линию прогноза (по умолчанию true)
 */
const TimeSeriesChart = ({ 
  data, 
  title, 
  seriesName,
  availableQuantiles,
  showForecastLine = true
}) => {
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);
  const [selectedQuantiles, setSelectedQuantiles] = useState(['0.5']);
  const [dateFormat, setDateFormat] = useState('day');
  const [showActualValues, setShowActualValues] = useState(true);

  // Получение доступных квантилей из данных, если не указаны явно
  const quantileKeys = availableQuantiles || 
    (data?.quantiles ? Object.keys(data.quantiles).sort() : 
    (typeof data?.['0.5'] !== 'undefined' ? ['0.5'] : []));

  // Установка начального значения для selectedQuantiles, если необходимо
  useEffect(() => {
    // Если в выбранных квантилях нет доступных, добавляем 0.5 если она есть
    if (selectedQuantiles.length === 0 || 
        !selectedQuantiles.some(q => quantileKeys.includes(q))) {
      if (quantileKeys.includes('0.5')) {
        setSelectedQuantiles(['0.5']);
      } else if (quantileKeys.length > 0) {
        setSelectedQuantiles([quantileKeys[0]]);
      }
    }
  }, [quantileKeys, selectedQuantiles]);

  // Проверка наличия данных
  if (!data || !data.timestamps) {
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
  if (showForecastLine && selectedQuantiles.includes('0.5')) {
    const forecastData = data.forecast || data['0.5'];
    if (forecastData) {
      chartData.datasets.push({
        label: 'Прогноз (медиана)',
        data: forecastStartIdx > 0 
          ? Array(forecastStartIdx).fill(null).concat(forecastData.slice(forecastStartIdx))
          : forecastData,
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        spanGaps: true,
      });
    }
  }

  // Добавление выбранных квантилей (кроме 0.5, она уже добавлена выше)
  if (data.quantiles || typeof data['0.1'] !== 'undefined') {
    selectedQuantiles.forEach(quantile => {
      if (quantile !== '0.5') {
        const quantileData = data.quantiles?.[quantile] || data[quantile];
        if (quantileData) {
          chartData.datasets.push({
            label: `Квантиль ${quantile}`,
            data: forecastStartIdx > 0 
              ? Array(forecastStartIdx).fill(null).concat(quantileData.slice(forecastStartIdx))
              : quantileData,
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
      }
    });
  }

  // Добавление доверительного интервала (заливка между квантилями 0.1 и 0.9)
  if (showConfidenceInterval) {
    const lowerQuantile = data.quantiles?.['0.1'] || data['0.1'];
    const upperQuantile = data.quantiles?.['0.9'] || data['0.9'];
    
    if (lowerQuantile && upperQuantile) {
      // Создаем верхнюю границу доверительного интервала
      chartData.datasets.push({
        label: 'Верхняя граница (90%)',
        data: forecastStartIdx > 0 
          ? Array(forecastStartIdx).fill(null).concat(upperQuantile.slice(forecastStartIdx))
          : upperQuantile,
        borderColor: 'transparent',
        pointRadius: 0,
        spanGaps: true,
        fill: '+1', // Заполнять до следующего датасета
      });

      // Создаем нижнюю границу доверительного интервала
      chartData.datasets.push({
        label: 'Нижняя граница (10%)',
        data: forecastStartIdx > 0 
          ? Array(forecastStartIdx).fill(null).concat(lowerQuantile.slice(forecastStartIdx))
          : lowerQuantile,
        borderColor: 'transparent',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        pointRadius: 0,
        spanGaps: true,
        fill: '-1', // Заполнять до предыдущего датасета
      });
    }
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
      annotations: forecastStartIdx > 0 ? {
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
      } : {}
    }
  };

  // Обработчик изменения выбранных квантилей
  const handleQuantilesChange = (values) => {
    // Всегда включаем 0.5 (медиана)
    if (showForecastLine && !values.includes('0.5') && quantileKeys.includes('0.5')) {
      values.push('0.5');
    }
    setSelectedQuantiles(values);
  };

  // Обработчик включения/выключения доверительного интервала
  const handleConfidenceIntervalChange = (checked) => {
    setShowConfidenceInterval(checked);
  };

  const hasConfidenceInterval = (data.quantiles?.['0.1'] && data.quantiles?.['0.9']) || 
                               (data['0.1'] && data['0.9']);

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

          {hasConfidenceInterval && (
            <Tooltip title="Показать/скрыть доверительный интервал">
              <Switch
                checked={showConfidenceInterval}
                onChange={handleConfidenceIntervalChange}
                checkedChildren="Интервал"
                unCheckedChildren="Интервал"
                disabled={!hasConfidenceInterval}
              />
            </Tooltip>
          )}
          
          {quantileKeys.length > 0 && (
            <>
              <Select
                mode="multiple"
                style={{ minWidth: 240 }}
                placeholder="Выберите квантили"
                value={selectedQuantiles}
                onChange={handleQuantilesChange}
                options={quantileKeys.map(q => ({ 
                  label: `Квантиль ${q}${q === '0.5' ? ' (медиана)' : ''}`, 
                  value: q 
                }))}
                maxTagCount={3}
              />
              
              <Tooltip title="Квантили представляют различные уровни вероятности прогноза. Медиана (0.5) - это центральное значение, а другие квантили отражают верхние и нижние границы прогноза с разной степенью уверенности.">
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            </>
          )}
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
            График показывает {showActualValues && data.actual ? 'фактические и ' : ''}прогнозные значения
            {showConfidenceInterval && hasConfidenceInterval 
              ? ' с доверительным интервалом 80%' 
              : ''}
          </Text>
        </div>
      </Space>
    </Card>
  );
};

export default TimeSeriesChart;