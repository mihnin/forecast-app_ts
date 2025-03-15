import React from 'react';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  UploadOutlined,
  BarChartOutlined,
  ExperimentOutlined,
  LineChartOutlined,
  HourglassOutlined,
  AppstoreOutlined,
  SettingOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';

const { Sider } = Layout;

const Sidebar = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">Главная (Wizard)</Link>
    },
    {
      key: '/dashboard',
      icon: <SettingOutlined />,
      label: <Link to="/dashboard">Обзор системы</Link>
    },
    {
      key: '/upload',
      icon: <UploadOutlined />,
      label: <Link to="/upload">Загрузка данных</Link>
    },
    {
      key: '/analysis',
      icon: <BarChartOutlined />,
      label: <Link to="/analysis">Анализ данных</Link>
    },
    {
      key: '/training',
      icon: <ExperimentOutlined />,
      label: <Link to="/training">Обучение модели</Link>
    },
    {
      key: '/models',
      icon: <AppstoreOutlined />,
      label: <Link to="/models">Сравнение моделей</Link>
    },
    {
      key: '/prediction',
      icon: <LineChartOutlined />,
      label: <Link to="/prediction">Прогнозирование</Link>
    },
    {
      key: '/queue',
      icon: <HourglassOutlined />,
      label: <Link to="/queue">Статус задач</Link>
    },
    {
      key: '/cleanup',
      icon: <DeleteOutlined />,
      label: <Link to="/cleanup">Очистка данных</Link>
    }
  ];

  return (
    <Sider 
      width={200} 
      style={{ 
        background: '#fff',
        marginTop: 64,
        overflow: 'auto',
        height: 'calc(100vh - 64px)',
        position: 'fixed',
        left: 0,
      }}
    >
      <Menu
        mode="inline"
        selectedKeys={[currentPath]}
        style={{ height: '100%', borderRight: 0 }}
        items={menuItems}
      />
    </Sider>
  );
};

export default Sidebar;