import React from 'react';
import { Progress, Card, Typography, Steps } from 'antd';
import { CloudUploadOutlined, FileSearchOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const FileUploadProgress = ({ 
    uploadProgress, 
    processingStage, 
    fileName, 
    totalRows,
    error 
}) => {
    // Определяем текущий этап обработки
    const currentStep = processingStage === 'uploading' ? 0 
        : processingStage === 'processing' ? 1 
        : processingStage === 'completed' ? 2 
        : 0;

    const steps = [
        {
            title: 'Загрузка',
            icon: <CloudUploadOutlined />,
            description: fileName ? `Загрузка файла ${fileName}` : 'Загрузка файла'
        },
        {
            title: 'Обработка',
            icon: <FileSearchOutlined />,
            description: totalRows ? `Обработано строк: ${totalRows}` : 'Анализ данных'
        },
        {
            title: 'Завершено',
            icon: <CheckCircleOutlined />,
            description: 'Файл успешно загружен и обработан'
        }
    ];

    return (
        <Card style={{ marginBottom: 16 }}>
            <Steps
                current={currentStep}
                items={steps}
                style={{ marginBottom: 24 }}
            />
            
            {processingStage === 'uploading' && (
                <>
                    <Title level={5}>Загрузка файла</Title>
                    <Progress 
                        percent={uploadProgress} 
                        status={error ? 'exception' : 'active'} 
                        strokeColor={{
                            from: '#108ee9',
                            to: '#87d068',
                        }}
                    />
                    {error && <Text type="danger">{error}</Text>}
                </>
            )}

            {processingStage === 'processing' && (
                <>
                    <Title level={5}>Обработка данных</Title>
                    <Progress 
                        percent={100} 
                        status="active" 
                        strokeColor="#1890ff"
                    />
                    <Text>Анализ структуры данных и проверка корректности...</Text>
                </>
            )}

            {processingStage === 'completed' && (
                <>
                    <Title level={5}>Загрузка завершена</Title>
                    <Progress 
                        percent={100} 
                        status="success" 
                    />
                    <Text type="success">
                        Файл успешно загружен и обработан. 
                        {totalRows && ` Обработано строк: ${totalRows}`}
                    </Text>
                </>
            )}
        </Card>
    );
};

export default FileUploadProgress;