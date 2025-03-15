import React, { useEffect, useState } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card, Empty, Select, Switch, Space } from 'antd';

// Регистрируем компоненты Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const TimeSeriesChart = ({ data, itemId, quantiles }) => {
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);
  const [selectedQuantiles, setSelectedQuantiles] = useState(['0.5']);

  if (!data || !data.timestamps || !data['0.5']) {
    return (
      <Card>
        <Empty description="Нет данных для построения графика" />
      </Card>
    );
  }

  // Преобразуем метки времени в более читаемый формат
  const labels = data.timestamps.map(timestamp => {
    return new Date(timestamp).toLocaleDateString('ru-RU');
  });

  // Подготовка данных для графика
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Прогноз (квантиль 0.5)',
        data: data['0.5'],
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
      }
    ]
  };

  // Добавляем выбранные квантили (кроме 0.5, она уже добавлена)
  selectedQuantiles.forEach(quantile => {
    if (quantile !== '0.5' && data[quantile]) {
      chartData.datasets.push({
        label: `Квантиль ${quantile}`,
        data: data[quantile],
        borderColor: quantile < '0.5' ? 'rgba(255, 99, 132, 0.8)' : 'rgba(75, 192, 192, 0.8)',
        backgroundColor: quantile < '0.5' ? 'rgba(255, 99, 132, 0.3)' : 'rgba(75, 192, 192, 0.3)',
        borderDash: [5, 5],
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 1,
      });
    }
  });

  // Добавляем заливку для доверительного интервала
  if (showConfidenceInterval && data['0.1'] && data['0.9']) {
    chartData.datasets.push({
      label: 'Доверительный интервал',
      data: data['0.5'], // Центральная линия для заливки
      borderColor: 'transparent',
      backgroundColor: 'rgba(53, 162, 235, 0.2)',
      pointRadius: 0,
      fill: {
        target: 'origin',
        above: 'rgba(53, 162, 235, 0.2)', // Цвет заливки выше линии
        below: 'rgba(53, 162, 235, 0.2)'  // Цвет заливки ниже линии
      },
      borderWidth: 0,
    });
  }

  // Настройки графика
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `Прогноз для ${itemId}`,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    interaction: {
      mode: 'nearest',
      intersect: false,
    },
    scales: {
      y: {
        beginAtZero: false,
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    },
  };

  // Обработчик изменения квантилей
  const handleQuantilesChange = (values) => {
    // Всегда включаем 0.5 (среднее значение)
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
        <Space>
          <Select
            mode="multiple"
            style={{ width: 300 }}
            placeholder="Выберите квантили"
            value={selectedQuantiles}
            onChange={handleQuantilesChange}
            options={quantiles.map(q => ({ label: `Квантиль ${q}`, value: q }))}
          />
          <Switch
            checked={showConfidenceInterval}
            onChange={handleConfidenceIntervalChange}
            checkedChildren="Интервал вкл."
            unCheckedChildren="Интервал выкл."
          />
        </Space>
        
        <div style={{ height: 400 }}>
          <Line data={chartData} options={options} />
        </div>
      </Space>
    </Card>
  );
};

export default TimeSeriesChart;