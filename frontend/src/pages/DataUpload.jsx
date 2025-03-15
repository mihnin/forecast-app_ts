import React, { useState } from 'react';
import { Upload, Button, Card, Typography, Alert } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import FileUploadProgress from '../components/common/FileUploadProgress';
import api from '../services/api';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const DataUpload = () => {
    const navigate = useNavigate();
    const [uploadState, setUploadState] = useState({
        uploading: false,
        processingStage: null,
        progress: 0,
        fileName: '',
        totalRows: 0,
        error: null
    });

    const handleUpload = async (file) => {
        setUploadState({
            ...uploadState,
            uploading: true,
            processingStage: 'uploading',
            fileName: file.name,
            progress: 0,
            error: null
        });

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post('/data/upload', formData, {
                onUploadProgress: (progressEvent) => {
                    const percentage = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setUploadState(prev => ({
                        ...prev,
                        progress: percentage
                    }));
                }
            });

            if (response.data.success) {
                setUploadState(prev => ({
                    ...prev,
                    processingStage: 'completed',
                    progress: 100,
                    totalRows: response.data.info.rows_count
                }));

                // Переходим к анализу данных через 1.5 секунды
                setTimeout(() => {
                    navigate('/analysis', { 
                        state: { 
                            datasetId: response.data.dataset_id,
                            fileName: file.name
                        } 
                    });
                }, 1500);
            }
        } catch (error) {
            setUploadState(prev => ({
                ...prev,
                error: error.response?.data?.detail || 'Ошибка при загрузке файла',
                processingStage: null
            }));
        }
    };

    const uploadProps = {
        name: 'file',
        multiple: false,
        accept: '.csv,.xlsx',
        customRequest: ({ file }) => handleUpload(file),
        showUploadList: false
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>
            <Title level={2}>Загрузка данных</Title>
            <Text>
                Загрузите CSV или Excel файл с временным рядом для анализа и прогнозирования.
                Файл должен содержать колонку с датами и числовые значения для прогнозирования.
            </Text>

            {uploadState.error && (
                <Alert
                    message="Ошибка"
                    description={uploadState.error}
                    type="error"
                    showIcon
                    style={{ marginTop: 16, marginBottom: 16 }}
                />
            )}

            {uploadState.processingStage ? (
                <FileUploadProgress
                    uploadProgress={uploadState.progress}
                    processingStage={uploadState.processingStage}
                    fileName={uploadState.fileName}
                    totalRows={uploadState.totalRows}
                    error={uploadState.error}
                />
            ) : (
                <Card style={{ marginTop: 16 }}>
                    <Dragger {...uploadProps} disabled={uploadState.uploading}>
                        <p className="ant-upload-drag-icon">
                            <UploadOutlined />
                        </p>
                        <p className="ant-upload-text">
                            Нажмите или перетащите файл в эту область для загрузки
                        </p>
                        <p className="ant-upload-hint">
                            Поддерживаются файлы CSV и Excel (xlsx)
                        </p>
                    </Dragger>
                </Card>
            )}
        </div>
    );
};

export default DataUpload;