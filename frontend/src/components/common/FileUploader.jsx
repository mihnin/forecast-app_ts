import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { InboxOutlined } from '@ant-design/icons';
import { Typography, Progress } from 'antd';

const { Text } = Typography;

const FileUploader = ({ onFileSelected, uploading = false, progress = 0 }) => {
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
  });

  return (
    <div
      {...getRootProps()}
      className="file-uploader"
      style={{
        borderColor: isDragActive ? '#1890ff' : '#d9d9d9',
        opacity: uploading ? 0.7 : 1,
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
        Поддерживаются файлы CSV и Excel (.csv, .xls, .xlsx)
      </Text>
      
      {uploading && (
        <div style={{ marginTop: 16 }}>
          <Progress percent={progress} status="active" />
          <Text type="secondary">Загрузка файла...</Text>
        </div>
      )}
    </div>
  );
};

export default FileUploader;