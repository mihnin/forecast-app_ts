import React from 'react';
import { Layout } from 'antd';

const { Footer: AntFooter } = Layout;

const Footer = () => {
  return (
    <AntFooter style={{ textAlign: 'center' }}>
      TimeFlow - Система прогнозирования временных рядов ©{new Date().getFullYear()} Создано с использованием React и Ant Design
    </AntFooter>
  );
};

export default Footer;