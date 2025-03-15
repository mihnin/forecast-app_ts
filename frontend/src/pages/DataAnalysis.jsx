import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, Space, Typography, Select, Spin, Alert, Form, Tabs } from 'antd';
import TimeSeriesAnalysis from '../components/analysis/TimeSeriesAnalysis';
import TimeSeriesPreprocessing from '../components/preprocessing/TimeSeriesPreprocessing';
import TimeSeriesDecomposition from '../components/analysis/TimeSeriesDecomposition';
import api from '../services/api';

const { Title } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const DataAnalysis = () => {
    const location = useLocation();
    const { datasetId, fileName } = location.state || {};
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [columns, setColumns] = useState([]);
    const [selectedColumns, setSelectedColumns] = useState({
        date: '',
        value: ''
    });
    const [analysisData, setAnalysisData] = useState(null);
    const [activeTab, setActiveTab] = useState('analysis');
    const [currentDatasetId, setCurrentDatasetId] = useState(datasetId);
    
    // Загрузка списка колонок при монтировании
    useEffect(() => {
        if (currentDatasetId) {
            loadColumns(currentDatasetId);
        }
    }, [currentDatasetId]);
    
    // Загрузка результатов анализа при выборе колонок
    useEffect(() => {
        if (selectedColumns.date && selectedColumns.value) {
            loadAnalysis();
        }
    }, [selectedColumns, currentDatasetId]);
    
    const loadColumns = async (dsId) => {
        try {
            const response = await api.get(`/data/columns/${dsId}`);
            setColumns(response.data);
            
            // Автоматически выбираем первую колонку с датой
            const dateColumn = response.data.find(col => 
                col.toLowerCase().includes('date') || 
                col.toLowerCase().includes('time')
            );
            
            if (dateColumn) {
                setSelectedColumns(prev => ({ ...prev, date: dateColumn }));
            }
        } catch (err) {
            setError('Ошибка при загрузке списка колонок');
        }
    };
    
    const loadAnalysis = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await api.get(`/analysis/stats/${currentDatasetId}`, {
                params: {
                    date_column: selectedColumns.date,
                    value_column: selectedColumns.value
                }
            });
            setAnalysisData(response.data);
        } catch (err) {
            setError('Ошибка при анализе данных');
        } finally {
            setLoading(false);
        }
    };
    
    const handleColumnChange = (type, value) => {
        setSelectedColumns(prev => ({ ...prev, [type]: value }));
    };

    const handleProcessingComplete = (newDatasetId) => {
        setCurrentDatasetId(newDatasetId);
        setActiveTab('analysis');
    };
    
    if (!currentDatasetId) {
        return (
            <Alert
                message="Ошибка"
                description="Не указан идентификатор набора данных"
                type="error"
                showIcon
            />
        );
    }
    
    return (
        <div style={{ padding: '24px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Title level={2}>Анализ данных</Title>
                {fileName && (
                    <Alert
                        message={`Анализ файла: ${fileName}`}
                        type="info"
                        showIcon
                    />
                )}
                
                <Card title="Выбор данных для анализа">
                    <Form layout="vertical">
                        <Space>
                            <Form.Item label="Колонка с датами">
                                <Select
                                    value={selectedColumns.date}
                                    onChange={(value) => handleColumnChange('date', value)}
                                    style={{ width: 200 }}
                                    placeholder="Выберите колонку с датами"
                                >
                                    {columns.map(col => (
                                        <Option key={col} value={col}>{col}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            
                            <Form.Item label="Колонка со значениями">
                                <Select
                                    value={selectedColumns.value}
                                    onChange={(value) => handleColumnChange('value', value)}
                                    style={{ width: 200 }}
                                    placeholder="Выберите колонку со значениями"
                                >
                                    {columns.map(col => (
                                        <Option key={col} value={col}>{col}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Space>
                    </Form>
                </Card>
                
                {error && (
                    <Alert
                        message="Ошибка"
                        description={error}
                        type="error"
                        showIcon
                    />
                )}
                
                <Tabs activeKey={activeTab} onChange={setActiveTab}>
                    <TabPane tab="Анализ" key="analysis">
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <Spin size="large" />
                            </div>
                        ) : (
                            analysisData && (
                                <>
                                    <TimeSeriesAnalysis
                                        data={analysisData.raw_data}
                                        dateColumn={selectedColumns.date}
                                        valueColumn={selectedColumns.value}
                                        statistics={analysisData.statistics}
                                        anomalies={analysisData.anomalies}
                                        seasonality={analysisData.seasonality}
                                    />
                                    <TimeSeriesDecomposition
                                        datasetId={currentDatasetId}
                                        dateColumn={selectedColumns.date}
                                        valueColumn={selectedColumns.value}
                                    />
                                </>
                            )
                        )}
                    </TabPane>
                    
                    <TabPane tab="Предобработка" key="preprocessing">
                        {selectedColumns.date && selectedColumns.value && (
                            <TimeSeriesPreprocessing
                                datasetId={currentDatasetId}
                                dateColumn={selectedColumns.date}
                                valueColumn={selectedColumns.value}
                                onProcessingComplete={handleProcessingComplete}
                            />
                        )}
                    </TabPane>
                </Tabs>
            </Space>
        </div>
    );
};

export default DataAnalysis;