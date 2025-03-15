import React from 'react';
import { Card, Row, Col, Statistic, Table, Space, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const TimeSeriesStats = ({ statistics, beforeStats, afterStats }) => {
    const compareStats = (before, after, key) => {
        if (!before || !after) return null;
        const diff = after[key] - before[key];
        const color = diff > 0 ? '#3f8600' : diff < 0 ? '#cf1322' : '';
        return diff !== 0 ? (
            <Text type="secondary" style={{ color }}>
                ({diff > 0 ? '+' : ''}{diff.toFixed(2)})
            </Text>
        ) : null;
    };

    const basicStatsColumns = [
        {
            title: 'Показатель',
            dataIndex: 'metric',
            key: 'metric',
        },
        {
            title: 'До обработки',
            dataIndex: 'before',
            key: 'before',
            render: value => value?.toFixed(2) || '-'
        },
        {
            title: 'После обработки',
            dataIndex: 'after',
            key: 'after',
            render: (value, record) => (
                <Space>
                    {value?.toFixed(2) || '-'}
                    {compareStats(record.beforeObj, record.afterObj, record.key)}
                </Space>
            )
        }
    ];

    const getBasicStatsData = () => {
        const metrics = [
            { key: 'mean', name: 'Среднее значение' },
            { key: 'median', name: 'Медиана' },
            { key: 'std', name: 'Стандартное отклонение' },
            { key: 'skewness', name: 'Асимметрия' },
            { key: 'kurtosis', name: 'Эксцесс' }
        ];

        return metrics.map(({ key, name }) => ({
            key,
            metric: name,
            before: beforeStats?.[key],
            after: afterStats?.[key],
            beforeObj: beforeStats,
            afterObj: afterStats
        }));
    };

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card title={
                <Space>
                    <span>Основные характеристики ряда</span>
                    <InfoCircleOutlined />
                </Space>
            }>
                <Row gutter={16}>
                    <Col span={6}>
                        <Statistic
                            title="Длина ряда"
                            value={statistics.length}
                            suffix="значений"
                        />
                    </Col>
                    <Col span={6}>
                        <Statistic
                            title="Период наблюдений"
                            value={statistics.period_days}
                            suffix="дней"
                        />
                    </Col>
                    <Col span={6}>
                        <Statistic
                            title="Частота наблюдений"
                            value={statistics.frequency}
                        />
                    </Col>
                    <Col span={6}>
                        <Statistic
                            title="Пропущенные значения"
                            value={statistics.missing_values}
                            suffix={`(${(statistics.missing_percentage || 0).toFixed(1)}%)`}
                        />
                    </Col>
                </Row>
            </Card>

            {(beforeStats || afterStats) && (
                <Card title="Сравнение статистик до и после обработки">
                    <Table
                        columns={basicStatsColumns}
                        dataSource={getBasicStatsData()}
                        pagination={false}
                        size="small"
                    />
                </Card>
            )}

            {statistics.seasonality && (
                <Card title="Анализ сезонности">
                    <Row gutter={16}>
                        <Col span={8}>
                            <Statistic
                                title="Основной сезонный период"
                                value={statistics.seasonality.main_period}
                                suffix="точек"
                            />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="Сила сезонности"
                                value={statistics.seasonality.strength}
                                suffix="%"
                            />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="Тренд"
                                value={statistics.trend_direction}
                                valueStyle={{
                                    color: statistics.trend_direction === 'Растущий' ? '#3f8600' : 
                                           statistics.trend_direction === 'Падающий' ? '#cf1322' : '#000'
                                }}
                            />
                        </Col>
                    </Row>
                </Card>
            )}
        </Space>
    );
};

export default TimeSeriesStats;