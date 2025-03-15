// src/components/charts/TimeSeriesChart.jsx
import React, { useState, useCallback } from 'react';
import { Card, Space, Switch, Select, Tooltip, Button } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, DragOutlined } from '@ant-design/icons';
import Plot from 'react-plotly.js';

const TimeSeriesChart = ({ 
    data,
    predictions,
    title = "Временной ряд",
    dateColumn,
    valueColumn,
    height = 400
}) => {
    const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);
    const [interactionMode, setInteractionMode] = useState('zoom');
    const [selectedRange, setSelectedRange] = useState(null);
    const [autoScale, setAutoScale] = useState(true);
    
    // Форматируем данные для отображения
    const traces = [];
    
    // Исторические данные
    traces.push({
        type: 'scatter',
        mode: 'lines',
        name: 'Исторические данные',
        x: data.map(d => d[dateColumn]),
        y: data.map(d => d[valueColumn]),
        line: { color: '#1890ff' }
    });

    // Прогноз
    if (predictions && predictions.length > 0) {
        traces.push({
            type: 'scatter',
            mode: 'lines',
            name: 'Прогноз',
            x: predictions.map(d => d.date),
            y: predictions.map(d => d.mean),
            line: { color: '#52c41a', dash: 'dash' }
        });

        // Доверительный интервал
        if (showConfidenceInterval && predictions[0].lower && predictions[0].upper) {
            traces.push({
                type: 'scatter',
                name: 'Доверительный интервал',
                x: [...predictions.map(d => d.date), ...predictions.map(d => d.date).reverse()],
                y: [...predictions.map(d => d.upper), ...predictions.map(d => d.lower).reverse()],
                fill: 'toself',
                fillcolor: 'rgba(82, 196, 26, 0.1)',
                line: { color: 'transparent' },
                showlegend: false
            });
        }
    }

    // Обработчики событий
    const handleRangeSelect = useCallback((event) => {
        if (event && event.range) {
            setSelectedRange(event.range);
            setAutoScale(false);
        }
    }, []);

    const handleResetZoom = () => {
        setSelectedRange(null);
        setAutoScale(true);
    };

    const layout = {
        title: title,
        height: height,
        xaxis: {
            title: 'Дата',
            range: selectedRange ? [selectedRange.x[0], selectedRange.x[1]] : undefined,
            rangeslider: { visible: true }
        },
        yaxis: {
            title: valueColumn,
            autorange: autoScale
        },
        dragmode: interactionMode,
        hovermode: 'x unified',
        showlegend: true,
        legend: {
            orientation: 'h',
            yanchor: 'bottom',
            y: 1.02,
            xanchor: 'right',
            x: 1
        }
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false
    };

    return (
        <Card>
            <Space style={{ marginBottom: 16 }}>
                <Tooltip title="Режим масштабирования">
                    <Button
                        icon={<ZoomInOutlined />}
                        type={interactionMode === 'zoom' ? 'primary' : 'default'}
                        onClick={() => setInteractionMode('zoom')}
                    />
                </Tooltip>
                <Tooltip title="Режим перемещения">
                    <Button
                        icon={<DragOutlined />}
                        type={interactionMode === 'pan' ? 'primary' : 'default'}
                        onClick={() => setInteractionMode('pan')}
                    />
                </Tooltip>
                <Button 
                    icon={<ZoomOutOutlined />}
                    onClick={handleResetZoom}
                    disabled={autoScale}
                >
                    Сбросить масштаб
                </Button>
                {predictions && predictions.length > 0 && (
                    <Switch
                        checked={showConfidenceInterval}
                        onChange={setShowConfidenceInterval}
                        checkedChildren="Доверительный интервал"
                        unCheckedChildren="Доверительный интервал"
                    />
                )}
            </Space>

            <Plot
                data={traces}
                layout={layout}
                config={config}
                onSelectedData={handleRangeSelect}
                style={{ width: '100%' }}
            />
        </Card>
    );
};

export default TimeSeriesChart;