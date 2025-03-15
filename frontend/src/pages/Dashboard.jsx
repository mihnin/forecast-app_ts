import React from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Typography, 
  Space, 
  Button, 
  Divider,
  List,
  Avatar
} from 'antd';
import { 
  UploadOutlined, 
  ExperimentOutlined, 
  LineChartOutlined, 
  BarChartOutlined,
  DatabaseOutlined,
  HourglassOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  FileOutlined,
  HddOutlined
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useQueueStatus } from '../hooks/useQueueStatus';
import QueueIndicator from '../components/queue/QueueIndicator';

const { Title, Paragraph, Text } = Typography;

const Dashboard = () => {
  // Получение информации об очереди
  const { queueStatus } = useQueueStatus();

  // Данные о функциях приложения
  const features = [
    {
      title: 'Загрузка данных',
      icon: <UploadOutlined className="feature-icon" />,
      description: 'Загрузка файлов CSV и Excel для анализа и прогнозирования',
      link: '/upload'
    },
    {
      title: 'Анализ данных',
      icon: <BarChartOutlined className="feature-icon" />,
      description: 'Визуализация и анализ временных рядов, выявление трендов и сезонности',
      link: '/analysis'
    },
    {
      title: 'Обучение моделей',
      icon: <ExperimentOutlined className="feature-icon" />,
      description: 'Обучение моделей прогнозирования с использованием AutoGluon',
      link: '/training'
    },
    {
      title: 'Прогнозирование',
      icon: <LineChartOutlined className="feature-icon" />,
      description: 'Создание прогнозов на основе обученных моделей',
      link: '/prediction'
    }
  ];

  // Данные о последних активностях (в реальном приложении они будут приходить с сервера)
  const recentActivities = [
    {
      id: 1,
      type: 'upload',
      title: 'Загружен файл sales_data.csv',
      description: '1000 строк, 7 колонок',
      time: '10 минут назад',
      icon: <FileOutlined style={{ color: '#1890ff' }} />
    },
    {
      id: 2,
      type: 'training',
      title: 'Завершено обучение модели',
      description: 'WeightedEnsemble (MASE: 0.82)',
      time: '30 минут назад',
      icon: <ExperimentOutlined style={{ color: '#52c41a' }} />
    },
    {
      id: 3,
      type: 'prediction',
      title: 'Создан прогноз',
      description: 'Горизонт: 30 дней',
      time: '1 час назад',
      icon: <LineChartOutlined style={{ color: '#722ed1' }} />
    },
    {
      id: 4,
      type: 'analysis',
      title: 'Выполнен анализ данных',
      description: 'Анализ сезонности данных о продажах',
      time: '2 часа назад',
      icon: <BarChartOutlined style={{ color: '#fa8c16' }} />
    }
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>Обзор системы прогнозирования</Title>
          <Paragraph>
            Добро пожаловать в интерфейс управления системой прогнозирования временных рядов. 
            Эта платформа предоставляет инструменты для анализа данных, обучения моделей и 
            создания точных прогнозов с использованием AutoGluon TimeSeries.
          </Paragraph>
        </div>

        <QueueIndicator 
          totalTasks={queueStatus.totalTasks}
          pendingTasks={queueStatus.pendingTasks}
          executingTasks={queueStatus.executingTasks}
          completedTasks={queueStatus.completedTasks}
          failedTasks={queueStatus.failedTasks}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="Задач в очереди" 
                value={queueStatus.pendingTasks} 
                prefix={<HourglassOutlined />}
                valueStyle={{ color: queueStatus.pendingTasks > 0 ? '#faad14' : '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="Выполняется" 
                value={queueStatus.executingTasks} 
                prefix={<SettingOutlined />} 
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="Завершено" 
                value={queueStatus.completedTasks} 
                prefix={<CheckCircleOutlined />} 
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic 
                title="Всего датасетов" 
                value={2} // В реальном приложении будет приходить с сервера
                prefix={<DatabaseOutlined />} 
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        <Divider orientation="left">Функциональность системы</Divider>

        <Row gutter={[16, 16]}>
          {features.map((feature, index) => (
            <Col xs={24} sm={12} md={6} key={index}>
              <Card className="feature-card" hoverable>
                <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
                  <div style={{ textAlign: 'center' }}>
                    {feature.icon}
                    <Title level={4}>{feature.title}</Title>
                  </div>
                  <Paragraph>{feature.description}</Paragraph>
                  <Link to={feature.link}>
                    <Button type="primary" style={{ width: '100%' }}>
                      Перейти
                    </Button>
                  </Link>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Divider orientation="left">Последние активности</Divider>

        <Card>
          <List
            itemLayout="horizontal"
            dataSource={recentActivities}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={item.icon} />}
                  title={item.title}
                  description={
                    <Space>
                      <Text>{item.description}</Text>
                      <Text type="secondary">{item.time}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </div>
  );
};

export default Dashboard;