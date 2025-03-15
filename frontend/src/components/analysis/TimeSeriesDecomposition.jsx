import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { Card, Row, Col, Spin, Alert } from 'antd';

const TimeSeriesDecomposition = ({ datasetId, dateColumn, valueColumn }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [decompositionData, setDecompositionData] = useState(null);

    useEffect(() => {
        const fetchDecomposition = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(
                    `/api/analysis/decompose/${datasetId}?` +
                    `date_column=${dateColumn}&` +
                    `value_column=${valueColumn}`
                );
                
                if (!response.ok) {
                    throw new Error(`Ошибка HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                setDecompositionData(data);
            } catch (err) {
                setError(`Ошибка при получении декомпозиции: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        if (datasetId && dateColumn && valueColumn) {
            fetchDecomposition();
        }
    }, [datasetId, dateColumn, valueColumn]);

    if (loading) {
        return <Spin size="large" />;
    }

    if (error) {
        return <Alert type="error" message={error} />;
    }

    if (!decompositionData) {
        return null;
    }

    const plotConfig = {
        displayModeBar: true,
        scrollZoom: true,
        responsive: true
    };

    const commonLayout = {
        autosize: true,
        height: 200,
        margin: { t: 20, r: 20, l: 40, b: 30 },
        showlegend: false,
        xaxis: { 
            type: 'date',
            rangeslider: { visible: false }
        }
    };

    return (
        <Card title="Декомпозиция временного ряда" className="decomposition-card">
            <Row gutter={[0, 16]}>
                <Col span={24}>
                    <Plot
                        data={[{
                            x: decompositionData.dates,
                            y: decompositionData.observed,
                            type: 'scatter',
                            name: 'Исходный ряд'
                        }]}
                        layout={{
                            ...commonLayout,
                            title: { text: 'Исходный ряд', font: { size: 14 } }
                        }}
                        config={plotConfig}
                    />
                </Col>
                <Col span={24}>
                    <Plot
                        data={[{
                            x: decompositionData.dates,
                            y: decompositionData.trend,
                            type: 'scatter',
                            name: 'Тренд',
                            line: { color: '#2196f3' }
                        }]}
                        layout={{
                            ...commonLayout,
                            title: { text: 'Тренд', font: { size: 14 } }
                        }}
                        config={plotConfig}
                    />
                </Col>
                <Col span={24}>
                    <Plot
                        data={[{
                            x: decompositionData.dates,
                            y: decompositionData.seasonal,
                            type: 'scatter',
                            name: 'Сезонность',
                            line: { color: '#4caf50' }
                        }]}
                        layout={{
                            ...commonLayout,
                            title: { text: 'Сезонность', font: { size: 14 } }
                        }}
                        config={plotConfig}
                    />
                </Col>
                <Col span={24}>
                    <Plot
                        data={[{
                            x: decompositionData.dates,
                            y: decompositionData.residual,
                            type: 'scatter',
                            name: 'Остатки',
                            line: { color: '#ff9800' }
                        }]}
                        layout={{
                            ...commonLayout,
                            title: { text: 'Остатки', font: { size: 14 } }
                        }}
                        config={plotConfig}
                    />
                </Col>
            </Row>
        </Card>
    );
};

export default TimeSeriesDecomposition;