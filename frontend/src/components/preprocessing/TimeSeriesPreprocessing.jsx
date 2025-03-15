import React, { useState, useEffect } from 'react';
import { Card, Space, Select, Button, Alert, Table, Typography, Tabs, Statistic, Row, Col } from 'antd';
import { LineChartOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import TimeSeriesChart from '../charts/TimeSeriesChart';
import api from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const TimeSeriesPreprocessing = ({
    datasetId,
    dateColumn,
    valueColumn,
    onProcessingComplete
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [gaps, setGaps] = useState(null);
    const [outliers, setOutliers] = useState(null);
    const [processingMethod, setProcessingMethod] = useState('linear');
    const [activeTab, setActiveTab] = useState('gaps');

    useEffect(() => {
        if (datasetId && dateColumn && valueColumn) {
            loadGapsAndOutliers();
        }
    }, [datasetId, dateColumn, valueColumn]);

    const loadGapsAndOutliers = async () => {
        setLoading(true);
        setError(null);
        
        try {
            // Загружаем информацию о пропусках
            const gapsResponse = await api.get(`/preprocessing/gaps/${datasetId}`, {
                params: { date_column: dateColumn, value_column: valueColumn }
            });
            setGaps(gapsResponse.data);
            
            // Загружаем информацию о выбросах
            const outliersResponse = await api.get(`/preprocessing/outliers/${datasetId}`, {
                params: { 
                    date_column: dateColumn, 
                    value_column: valueColumn,
                    threshold: 3.0
                }
            });
            setOutliers(outliersResponse.data);
            
        } catch (err) {
            setError('Ошибка при анализе данных');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFillMissing = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await api.post(`/preprocessing/fill-missing/${datasetId}`, null, {
                params: {
                    date_column: dateColumn,
                    value_column: valueColumn,
                    method: processingMethod
                }
            });
            
            if (response.data.success) {
                onProcessingComplete(response.data.dataset_id);
            }
        } catch (err) {
            setError('Ошибка при заполнении пропущенных значений');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const gapsColumns = [
        {
            title: 'Начало периода',
            dataIndex: 'start',
            key: 'start',
            render: (date) => new Date(date).toLocaleDateString()
        },
        {
            title: 'Конец периода',
            dataIndex: 'end',
            key: 'end',
            render: (date) => new Date(date).toLocaleDateString()
        },
        {
            title: 'Количество пропусков',
            dataIndex: 'count',
            key: 'count'
        }
    ];

    const outliersColumns = [
        {
            title: 'Дата',
            dataIndex: 'date',
            key: 'date',
            render: (date) => new Date(date).toLocaleDateString()
        },
        {
            title: 'Значение',
            dataIndex: 'value',
            key: 'value',
            render: (value) => value.toFixed(2)
        },
        {
            title: 'Z-score',
            dataIndex: 'z_score',
            key: 'z_score',
            render: (score) => score.toFixed(2)
        }
    ];

    return (
        <Card>
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
                <TabPane
                    tab={
                        <span>
                            <WarningOutlined />
                            Пропуски в данных
                        </span>
                    }
                    key="gaps"
                >
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        {gaps && (
                            <>
                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Statistic
                                            title="Всего пропусков"
                                            value={gaps.total_missing}
                                            suffix="значений"
                                        />
                                    </Col>
                                    <Col span={8}>
                                        <Statistic
                                            title="Периодов с пропусками"
                                            value={gaps.gaps.length}
                                        />
                                    </Col>
                                </Row>

                                <Card title="Периоды с пропущенными данными">
                                    <Table
                                        columns={gapsColumns}
                                        dataSource={gaps.gaps}
                                        pagination={false}
                                        size="small"
                                    />
                                </Card>

                                <Card title="Заполнение пропусков">
                                    <Space>
                                        <Select
                                            value={processingMethod}
                                            onChange={setProcessingMethod}
                                            style={{ width: 200 }}
                                        >
                                            <Option value="linear">Линейная интерполяция</Option>
                                            <Option value="cubic">Кубическая интерполяция</Option>
                                            <Option value="ffill">Перенос последнего значения</Option>
                                            <Option value="bfill">Перенос следующего значения</Option>
                                            <Option value="mean">Среднее значение</Option>
                                        </Select>
                                        <Button 
                                            type="primary"
                                            onClick={handleFillMissing}
                                            loading={loading}
                                            disabled={!gaps || gaps.total_missing === 0}
                                        >
                                            Заполнить пропуски
                                        </Button>
                                    </Space>
                                </Card>
                            </>
                        )}
                    </Space>
                </TabPane>

                <TabPane
                    tab={
                        <span>
                            <LineChartOutlined />
                            Выбросы
                        </span>
                    }
                    key="outliers"
                >
                    {outliers && (
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Statistic
                                        title="Обнаружено выбросов"
                                        value={outliers.total_outliers}
                                        suffix="значений"
                                    />
                                </Col>
                                <Col span={8}>
                                    <Statistic
                                        title="Порог (Z-score)"
                                        value={outliers.threshold}
                                        precision={1}
                                    />
                                </Col>
                            </Row>

                            <Card title="Обнаруженные выбросы">
                                <Table
                                    columns={outliersColumns}
                                    dataSource={outliers.outliers}
                                    pagination={{ pageSize: 10 }}
                                    size="small"
                                />
                            </Card>
                        </Space>
                    )}
                </TabPane>
            </Tabs>

            {error && (
                <Alert
                    message="Ошибка"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginTop: 16 }}
                />
            )}
        </Card>
    );
};

export default TimeSeriesPreprocessing;