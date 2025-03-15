"""
Service for time series statistical analysis
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from statsmodels.tsa.seasonal import seasonal_decompose
from scipy import stats
import logging

logger = logging.getLogger(__name__)

class TimeSeriesAnalyzer:
    def __init__(self, data: pd.DataFrame, date_column: str, value_column: str):
        """
        Initialize analyzer with data
        
        Args:
            data: DataFrame with time series data
            date_column: Name of the date column
            value_column: Name of the value column
        """
        self.data = data
        self.date_column = date_column
        self.value_column = value_column
        
        # Ensure date column is datetime
        self.data[date_column] = pd.to_datetime(self.data[date_column])
        # Sort by date
        self.data = self.data.sort_values(date_column)

    def get_basic_statistics(self) -> Dict[str, float]:
        """
        Calculate basic statistics of the time series
        """
        values = self.data[self.value_column]
        return {
            "mean": float(values.mean()),
            "median": float(values.median()),
            "std": float(values.std()),
            "min": float(values.min()),
            "max": float(values.max()),
            "missing_values": int(values.isnull().sum()),
            "skewness": float(stats.skew(values.dropna())),
            "kurtosis": float(stats.kurtosis(values.dropna())),
            "range": float(values.max() - values.min())
        }

    def detect_anomalies(self, threshold: float = 3.0) -> List[Dict[str, Any]]:
        """
        Detect anomalies using Z-score method
        
        Args:
            threshold: Z-score threshold for anomaly detection
            
        Returns:
            List of anomalies with dates and values
        """
        values = self.data[self.value_column]
        dates = self.data[self.date_column]
        
        # Calculate Z-scores
        z_scores = stats.zscore(values)
        
        # Find anomalies
        anomalies = []
        for date, value, zscore in zip(dates, values, z_scores):
            if abs(zscore) > threshold:
                anomalies.append({
                    "date": date.isoformat(),
                    "value": float(value),
                    "zscore": float(zscore),
                    "type": "high" if zscore > 0 else "low"
                })
        
        return anomalies

    def analyze_seasonality(self, period: Optional[int] = None) -> Dict[str, Any]:
        """
        Analyze seasonality in the time series
        
        Args:
            period: Number of periods for seasonal decomposition
                   If None, will try to detect automatically
                   
        Returns:
            Dictionary with seasonality analysis results
        """
        try:
            # If period not provided, try to detect it
            if period is None:
                # Try daily seasonality (7 days) or monthly (12 months)
                freq = pd.infer_freq(self.data[self.date_column])
                if freq in ['D', 'B']:
                    period = 7
                elif freq in ['M', 'MS']:
                    period = 12
                else:
                    period = 7  # default to weekly
            
            # Perform seasonal decomposition
            decomposition = seasonal_decompose(
                self.data[self.value_column],
                period=period,
                extrapolate_trend='freq'
            )
            
            # Calculate seasonality strength
            seasonal_strength = (
                np.var(decomposition.seasonal) /
                (np.var(decomposition.seasonal) + np.var(decomposition.resid))
            )
            
            # Determine trend direction
            trend_coefficient = np.polyfit(
                range(len(decomposition.trend)),
                decomposition.trend,
                1
            )[0]
            
            trend_direction = (
                "Возрастающий" if trend_coefficient > 0
                else "Убывающий" if trend_coefficient < 0
                else "Отсутствует"
            )
            
            # Format components for frontend
            components = pd.DataFrame({
                'date': self.data[self.date_column],
                'trend': decomposition.trend,
                'seasonal': decomposition.seasonal,
                'residual': decomposition.resid
            })
            
            return {
                "main_period": period,
                "strength": float(seasonal_strength),
                "trend_direction": trend_direction,
                "components": components.to_dict(orient='records')
            }
            
        except Exception as e:
            logger.error(f"Error in seasonality analysis: {str(e)}")
            return {
                "main_period": None,
                "strength": 0.0,
                "trend_direction": "Не удалось определить",
                "components": None
            }

    def get_full_analysis(self) -> Dict[str, Any]:
        """
        Perform complete analysis of the time series
        """
        return {
            "statistics": self.get_basic_statistics(),
            "anomalies": self.detect_anomalies(),
            "seasonality": self.analyze_seasonality()
        }