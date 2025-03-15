import React, { useState, useEffect } from 'react';
import { Card, Tabs, Space, Typography, Table, Statistic, Row, Col } from 'antd';
import { LineChartOutlined, WarningOutlined, AreaChartOutlined } from '@ant-design/icons';
import TimeSeriesChart from '../charts/TimeSeriesChart';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const TimeSeriesAnalysis = ({ 
    data,
    dateColumn,
    valueColumn,
    frequency,
    statistics,
    anomalies,
    seasonality 
}) => {
    // Форматируем статистики для отображения
    const statsCards = [
        { title: 'Среднее значение', value: statistics?.mean, precision: 2 },
        { title: 'Медиана', value: statistics?.median, precision: 2 },
        { title: 'Стандартное отклонение', value: statistics?.std, precision: 2 },
        { title: 'Минимум', value: statistics?.min, precision: 2 },
        { title: 'Максимум', value: statistics?.max, precision: 2 },
        { title: 'Количество пропусков', value: statistics?.missing_values, precision: 0 }
    ];

    // Форматируем данные об аномалиях для таблицы
    const anomalyColumns = [
        {
            title: 'Дата',
            dataIndex: 'date',
            key: 'date',
            render: (date) => new Date(date).toLocaleString()
        },
        {
            title: 'Значение',
            dataIndex: 'value',
            key: 'value',
            render: (value) => value.toFixed(2)
        },
        {
            title: 'Z-score',
            dataIndex: 'zscore',
            key: 'zscore',
            render: (zscore) => zscore.toFixed(2)
        },
        {
            title: 'Тип',
            dataIndex: 'type',
            key: 'type',
            render: (type) => type === 'high' ? 'Высокое значение' : 'Низкое значение'
        }
    ];

    return (
        <Card>
            <Tabs defaultActiveKey="overview">
                <TabPane 
                    tab={
                        <span><LineChartOutlined /> Обзор данных</span>
                    }
                    key="overview"
                >
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <Title level={4}>Основные статистики</Title>
                        <Row gutter={[16, 16]}>
                            {statsCards.map((stat, index) => (
                                <Col span={8} key={index}>
                                    <Card>
                                        <Statistic 
                                            title={stat.title}
                                            value={stat.value}
                                            precision={stat.precision}
                                        />
                                    </Card>
                                </Col>
                            ))}
                        </Row>

                        <TimeSeriesChart
                            data={data}
                            dateColumn={dateColumn}
                            valueColumn={valueColumn}
                            title="Визуализация временного ряда"
                            height={400}
                        />
                    </Space>
                </TabPane>

                <TabPane
                    tab={
                        <span><WarningOutlined /> Аномалии</span>
                    }
                    key="anomalies"
                >
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <Title level={4}>Обнаруженные аномалии</Title>
                        <Table
                            columns={anomalyColumns}
                            dataSource={anomalies}
                            pagination={{ pageSize: 10 }}
                        />

                        <TimeSeriesChart
                            data={data}
                            dateColumn={dateColumn}
                            valueColumn={valueColumn}
                            anomalies={anomalies}
                            title="Визуализация аномалий"
                            height={400}
                        />
                    </Space>
                </TabPane>

                <TabPane
                    tab={
                        <span><AreaChartOutlined /> Сезонность</span>
                    }
                    key="seasonality"
                >
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <Title level={4}>Анализ сезонности</Title>
                        {seasonality && (
                            <>
                                <Card>
                                    <Row gutter={[16, 16]}>
                                        <Col span={8}>
                                            <Statistic 
                                                title="Основной период"
                                                value={seasonality.main_period}
                                                suffix={frequency === 'D' ? 'дней' : 'периодов'}
                                            />
                                        </Col>
                                        <Col span={8}>
                                            <Statistic 
                                                title="Сила сезонности"
                                                value={seasonality.strength * 100}
                                                suffix="%"
                                                precision={1}
                                            />
                                        </Col>
                                        <Col span={8}>
                                            <Statistic 
                                                title="Тренд"
                                                value={seasonality.trend_direction}
                                            />
                                        </Col>
                                    </Row>
                                </Card>

                                {seasonality.components && (
                                    <Card title="Декомпозиция временного ряда">
                                        <TimeSeriesChart
                                            data={seasonality.components}
                                            dateColumn="date"
                                            valueColumn="seasonal"
                                            title="Сезонная компонента"
                                            height={300}
                                        />
                                    </Card>
                                )}
                            </>
                        )}
                    </Space>
                </TabPane>
            </Tabs>
        </Card>
    );
};

export default TimeSeriesAnalysis;