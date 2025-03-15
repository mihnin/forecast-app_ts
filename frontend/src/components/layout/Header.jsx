import React from 'react';
import { Layout, Menu, Button, Space } from 'antd';
import { AreaChartOutlined, UserOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Header: AntHeader } = Layout;

const Header = () => {
  return (
    <AntHeader style={{ position: 'fixed', zIndex: 1, width: '100%' }}>
      <div className="logo">
        <AreaChartOutlined /> TimeFlow
      </div>
      <div style={{ float: 'right' }}>
        <Space>
          <Button type="text" style={{ color: 'white' }} icon={<UserOutlined />}>
            Вход
          </Button>
        </Space>
      </div>
      <Menu theme="dark" mode="horizontal" defaultSelectedKeys={['1']}>
        <Menu.Item key="1">
          <Link to="/">Главная</Link>
        </Menu.Item>
        <Menu.Item key="2">
          <Link to="/upload">Загрузка данных</Link>
        </Menu.Item>
        <Menu.Item key="3">
          <Link to="/analysis">Анализ данных</Link>
        </Menu.Item>
        <Menu.Item key="4">
          <Link to="/training">Обучение модели</Link>
        </Menu.Item>
        <Menu.Item key="5">
          <Link to="/prediction">Прогнозирование</Link>
        </Menu.Item>
        <Menu.Item key="6">
          <Link to="/queue">Статус задач</Link>
        </Menu.Item>
      </Menu>
    </AntHeader>
  );
};

export default Header;