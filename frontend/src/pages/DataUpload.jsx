import React, { useState } from 'react';
import { 
  Card, 
  Typography, 
  Space, 
  Button, 
  Input, 
  Form, 
  Divider, 
  Alert, 
  Table, 
  Tag, 
  Statistic, 
  Row, 
  Col, 
  message 
} from 'antd';
import { 
  UploadOutlined, 
  DatabaseOutlined, 
  FileTextOutlined, 
  BarChartOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/api';
import FileUploader from '../components/common/FileUploader';
import { useQueueStatus } from '../hooks/useQueueStatus';
import QueueIndicator from '../components/queue/QueueIndicator';

const { Title, Paragraph, Text } = Typography;

const DataUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedData, setUploadedData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [chunkSize, setChunkSize] = useState(100000);
  const navigate = useNavigate();

  // Получение информации об очереди
  const { queueStatus } = useQueueStatus();

  // Обработчик выбора файла
  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    message.info(`Файл "${selectedFile.name}" выбран (${(selectedFile.size / 1024 / 1024).toFixed(2)} МБ)`);
  };

  // Обработчик изменения размера чанка
  const handleChunkSizeChange = (e) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setChunkSize(value);
    }
  };

  // Обработчик загрузки файла
  const handleUpload = async () => {
    if (!file) {
      message.error('Пожалуйста, выберите файл для загрузки');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Эмуляция прогресса загрузки (в реальном приложении будет через axios onUploadProgress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      const response = await dataService.uploadData(file, chunkSize);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setUploadedData(response);
      
      // Получение предпросмотра данных
      if (response.dataset_id) {
        const preview = await dataService.getPreview(response.dataset_id);
        setPreviewData(preview);
      }

      message.success('Файл успешно загружен!');
    } catch (error) {
      message.error(`Ошибка при загрузке файла: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Обработчик перехода к анализу данных
  const handleGoToAnalysis = () => {
    navigate('/analysis');
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>Загрузка данных</Title>
        
        <QueueIndicator 
          totalTasks={queueStatus.totalTasks}
          pendingTasks={queueStatus.pendingTasks}
          executingTasks={queueStatus.executingTasks}
          completedTasks={queueStatus.completedTasks}
          failedTasks={queueStatus.failedTasks}
        />
        
        <Card>
          <Form layout="vertical">
            <Form.Item label="Файл с данными">
              <FileUploader 
                onFileSelected={handleFileSelected} 
                uploading={uploading}
                progress={uploadProgress}
              />
            </Form.Item>

            <Form.Item label="Размер чанка для больших файлов (количество строк)">
              <Input 
                type="number" 
                value={chunkSize} 
                onChange={handleChunkSizeChange}
                disabled={uploading}
                suffix="строк"
                style={{ width: 200 }}
              />
              <Text type="secondary" style={{ marginLeft: 8 }}>
                Рекомендуется для файлов более 100 МБ
              </Text>
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                icon={<UploadOutlined />} 
                onClick={handleUpload}
                loading={uploading}
                disabled={!file}
              >
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {uploadedData && (
          <>
            <Card>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Alert 
                  message="Данные успешно загружены" 
                  description={uploadedData.message} 
                  type="success" 
                  showIcon 
                />

                <Divider />

                <Title level={4}>Информация о датасете</Title>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic 
                      title="ID датасета" 
                      value={uploadedData.dataset_id.substring(0, 8) + '...'} 
                      prefix={<DatabaseOutlined />} 
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic 
                      title="Строк" 
                      value={uploadedData.info.rows} 
                      prefix={<FileTextOutlined />} 
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic 
                      title="Колонок" 
                      value={uploadedData.info.columns} 
                      prefix={<BarChartOutlined />} 
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic 
                      title="Пропуски" 
                      value={Object.values(uploadedData.info.missing_values).reduce((a, b) => a + b, 0)} 
                      prefix={<div>⚠️</div>} 
                    />
                  </Col>
                </Row>

                <Divider />

                <Title level={4}>Колонки датасета</Title>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {uploadedData.info.column_names.map((column) => (
                    <Tag key={column} color="blue">{column}</Tag>
                  ))}
                </div>

                {previewData && (
                  <>
                    <Divider />
                    <Title level={4}>Предпросмотр данных</Title>
                    <div className="data-preview-table">
                      <Table 
                        dataSource={previewData.preview} 
                        columns={Object.keys(previewData.preview[0]).map(key => ({
                          title: key,
                          dataIndex: key,
                          key: key,
                          ellipsis: true,
                        }))}
                        size="small"
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                      />
                      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        Показано {previewData.displayed_rows} из {previewData.total_rows} строк
                      </Text>
                    </div>
                  </>
                )}
                
                <Divider />
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={() => setUploadedData(null)}>
                    Загрузить другой файл
                  </Button>
                  <Button type="primary" onClick={handleGoToAnalysis}>
                    Перейти к анализу данных
                  </Button>
                </div>
              </Space>
            </Card>
          </>
        )}
      </Space>
    </div>
  );
};

export default DataUpload;