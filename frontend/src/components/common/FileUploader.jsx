import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { InboxOutlined } from '@ant-design/icons';
import { Typography, Progress, Alert } from 'antd';

const { Text } = Typography;

const FileUploader = ({ onFileSelected, uploading = false, progress = 0, error = null }) => {
  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileSelected(acceptedFiles[0]);
      }
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
    disabled: uploading,
    maxSize: 100 * 1024 * 1024 // 100 MB
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className="file-uploader"
        style={{
          padding: '20px',
          border: '2px dashed #d9d9d9',
          borderRadius: '8px',
          background: isDragActive ? '#fafafa' : '#fff',
          cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.7 : 1,
          marginBottom: '16px'
        }}
      >
        <input {...getInputProps()} />
        <InboxOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
        <p style={{ marginBottom: 4 }}>
          {isDragActive ? (
            <Text strong>Перетащите файл сюда...</Text>
          ) : (
            <Text>
              Перетащите файл сюда или <Text strong>нажмите для выбора</Text>
            </Text>
          )}
        </p>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Поддерживаются файлы CSV и Excel (*.csv, *.xls, *.xlsx)
          <br />
          Максимальный размер файла: 100 MB
          <br />
          Файл должен содержать минимум 2 колонки и 10 строк данных
        </Text>
      </div>

      {error && (
        <Alert
          message="Ошибка загрузки"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}
      
      {uploading && (
        <div style={{ marginTop: 16 }}>
          <Progress
            percent={progress}
            status={error ? 'exception' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            {progress < 100 ? 'Загрузка файла...' : 'Обработка данных...'}
          </Text>
        </div>
      )}
    </div>
  );
};

export default FileUploader;