import React from 'react';
import { Spin, Space } from 'antd';

const Loading = ({ tip = 'Загрузка...' }) => {
  return (
    <div style={{ textAlign: 'center', padding: '30px 0' }}>
      <Space size="middle">
        <Spin size="large" tip={tip} />
      </Space>
    </div>
  );
};

export default Loading;