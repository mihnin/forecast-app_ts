import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Card, CardContent, Typography, Alert, 
  Dialog, DialogActions, DialogContent, DialogContentText, 
  DialogTitle, CircularProgress, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { API_URL } from '../config';

/**
 * Компонент для очистки данных из базы данных
 */
const DataCleanup = () => {
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  // Загрузка статистики БД при монтировании компонента
  useEffect(() => {
    fetchDatabaseStats();
  }, []);

  // Получение статистики БД
  const fetchDatabaseStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/v1/cleanup/db-stats`);
      
      if (!response.ok) {
        throw new Error(`Ошибка при получении статистики БД: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDbStats(data.data);
    } catch (err) {
      setError(`Ошибка: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Очистка данных
  const cleanupData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(`${API_URL}/api/v1/cleanup/cleanup`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Ошибка при очистке данных: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSuccess(data.message);
      
      // Обновляем статистику БД после успешной очистки
      fetchDatabaseStats();
    } catch (err) {
      setError(`Ошибка: ${err.message}`);
    } finally {
      setLoading(false);
      setOpenDialog(false);
    }
  };

  // Обработчики для диалога подтверждения
  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  return (
    <Box sx={{ maxWidth: 1000, margin: '0 auto', mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Управление данными
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Статистика базы данных
            </Typography>
            
            <Button 
              startIcon={<RefreshIcon />}
              onClick={fetchDatabaseStats}
              disabled={loading}
            >
              Обновить
            </Button>
          </Box>
          
          {loading && !dbStats ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : dbStats && typeof dbStats === 'object' && !dbStats.message ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Таблица</TableCell>
                    <TableCell>Размер</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(dbStats).map(([table, size]) => (
                    <TableRow key={table}>
                      <TableCell>{table}</TableCell>
                      <TableCell>{size}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography>
              {dbStats?.message || 'Нет данных о размере таблиц'}
            </Typography>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Очистка данных
          </Typography>
          
          <Typography paragraph>
            Вы можете очистить все данные из базы данных. Это действие нельзя отменить.
            Все загруженные файлы, результаты анализа и прогнозирования будут удалены.
          </Typography>
          
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleOpenDialog}
            disabled={loading}
          >
            Очистить все данные
          </Button>
        </CardContent>
      </Card>
      
      {/* Диалог подтверждения */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
      >
        <DialogTitle>Подтвердите очистку данных</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите очистить все данные из базы данных?
            Это действие нельзя отменить. Все загруженные файлы, результаты
            анализа и прогнозирования будут удалены.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Отмена
          </Button>
          <Button 
            onClick={cleanupData} 
            color="error" 
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {loading ? 'Очистка...' : 'Подтвердить очистку'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataCleanup; 