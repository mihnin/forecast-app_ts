import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, ConfigProvider } from 'antd';
import ruRU from 'antd/lib/locale/ru_RU';

import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import MainPage from './pages/MainPage'; // Новая главная страница
import DataUpload from './pages/DataUpload';
import DataAnalysis from './pages/DataAnalysis';
import ModelTraining from './pages/ModelTraining';
import Prediction from './pages/Prediction';
import PredictionResults from './pages/PredictionResults';
import ModelComparison from './pages/ModelComparison';
import QueueStatus from './pages/QueueStatus';
import DataCleanup from './pages/DataCleanup'; // Используем страницу вместо компонента
import NotFound from './pages/NotFound';

const { Content } = Layout;

function App() {
  return (
    <ConfigProvider locale={ruRU}>
      <Router>
        <Layout style={{ minHeight: '100vh' }}>
          <Header />
          <Layout>
            <Sidebar />
            <Layout style={{ padding: '0 24px 24px' }}>
              <Content
                className="site-layout-content"
                style={{
                  margin: '24px 16px',
                  padding: 24,
                  minHeight: 280,
                  background: '#fff',
                  borderRadius: '8px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}
              >
                <Routes>
                  <Route path="/" element={<MainPage />} /> {/* Заменяем Dashboard на MainPage как главную страницу */}
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/upload" element={<DataUpload />} />
                  <Route path="/analysis" element={<DataAnalysis />} />
                  <Route path="/training" element={<ModelTraining />} />
                  <Route path="/prediction" element={<Prediction />} />
                  <Route path="/prediction/results/:taskId" element={<PredictionResults />} />
                  <Route path="/models" element={<ModelComparison />} />
                  <Route path="/queue" element={<QueueStatus />} />
                  <Route path="/cleanup" element={<DataCleanup />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Content>
            </Layout>
          </Layout>
          <Footer />
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

export default App;