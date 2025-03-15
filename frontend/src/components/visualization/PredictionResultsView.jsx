import React, { useState } from 'react';
import { Card, Space, Typography, Button, Spin, Descriptions, Table, Select } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import TimeSeriesChart from '../charts/TimeSeriesChart';

const { Title, Text } = Typography;
const { Option } = Select;

const PredictionResultsView = ({
    data,
    predictions,
    modelInfo,
    metrics,
    loading,
    onExport,
    onRefresh
}) => {
    const [exportFormat, setExportFormat] = useState('csv');

    // Определяем колонки для таблицы с метриками
    const metricsColumns = [
        {
            title: 'Метрика',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Значение',
            dataIndex: 'value',
            key: 'value',
            render: (value) => typeof value === 'number' ? value.toFixed(4) : value
        }
    ];

    // Форматируем метрики для таблицы
    const metricsData = Object.entries(metrics || {}).map(([key, value], index) => ({
        key: index,
        name: key,
        value: value
    }));

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* График прогноза */}
            <Card>
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Title level={4}>Результаты прогнозирования</Title>
                        <Space>
                            <Select 
                                value={exportFormat}
                                onChange={setExportFormat}
                                style={{ width: 120 }}
                            >
                                <Option value="csv">CSV</Option>
                                <Option value="excel">Excel</Option>
                                <Option value="json">JSON</Option>
                            </Select>
                            <Button 
                                icon={<DownloadOutlined />}
                                onClick={() => onExport(exportFormat)}
                            >
                                Экспорт
                            </Button>
                            <Button 
                                icon={<ReloadOutlined />}
                                onClick={onRefresh}
                                loading={loading}
                            >
                                Обновить
                            </Button>
                        </Space>
                    </Space>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <Spin size="large" />
                        </div>
                    ) : (
                        <TimeSeriesChart
                            data={data}
                            predictions={predictions}
                            dateColumn="date"
                            valueColumn="value"
                            height={500}
                        />
                    )}
                </Space>
            </Card>

            {/* Информация о модели */}
            {modelInfo && (
                <Card title="Информация о модели">
                    <Descriptions bordered column={2}>
                        <Descriptions.Item label="Модель">
                            {modelInfo.model_name}
                        </Descriptions.Item>
                        <Descriptions.Item label="Точность">
                            {modelInfo.accuracy ? `${(modelInfo.accuracy * 100).toFixed(2)}%` : 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Горизонт прогноза">
                            {modelInfo.forecast_horizon} периодов
                        </Descriptions.Item>
                        <Descriptions.Item label="Частота данных">
                            {modelInfo.frequency}
                        </Descriptions.Item>
                        <Descriptions.Item label="Время обучения">
                            {modelInfo.training_time ? `${modelInfo.training_time.toFixed(2)} сек` : 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Последнее обновление">
                            {modelInfo.last_updated ? new Date(modelInfo.last_updated).toLocaleString() : 'N/A'}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>
            )}

            {/* Метрики качества */}
            {metrics && Object.keys(metrics).length > 0 && (
                <Card title="Метрики качества прогноза">
                    <Table 
                        columns={metricsColumns}
                        dataSource={metricsData}
                        pagination={false}
                        size="small"
                    />
                </Card>
            )}
        </Space>
    );
};

export default PredictionResultsView;