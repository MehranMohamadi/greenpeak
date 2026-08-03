"""Data utility functions."""

import datetime
import math
import pandas as pd
from pathlib import Path
from typing import List, Optional, Any, Dict
from ..core.config import get_settings


def safe_float(value: Any) -> Optional[float]:
    """Safely convert value to float, handling NaN and errors."""
    try:
        f = float(value)
        return None if math.isnan(f) else f
    except (ValueError, TypeError):
        return None


def safe_timestamp(date_str: str, date_format: str = "%Y-%m-%d") -> int:
    """Safely convert date string to Unix timestamp."""
    try:
        dt = datetime.datetime.strptime(date_str, date_format)
        
        # Handle dates before Unix epoch (1970-01-01) for Windows compatibility
        try:
            return int(dt.timestamp())
        except (ValueError, OSError):
            # For dates before 1970, calculate timestamp manually
            epoch = datetime.datetime(1970, 1, 1)
            return int((dt - epoch).total_seconds())
    except ValueError as e:
        raise ValueError(f"Error parsing date '{date_str}' with format '{date_format}': {e}")


def load_csv_data(filename: str, date_column: str, sort_by_date: bool = True) -> pd.DataFrame:
    """Load CSV data with error handling."""
    settings = get_settings()
    file_path = settings.data_dir / filename
    
    if not file_path.exists():
        raise FileNotFoundError(f"Data file not found: {filename}")
    
    try:
        df = pd.read_csv(file_path)
        if sort_by_date and date_column in df.columns:
            df = df.sort_values(date_column)
        return df
    except Exception as e:
        raise RuntimeError(f"Error loading CSV file {filename}: {e}")


def load_excel_data(filename: str, sheet_name: str = 0, skiprows: int = 0, header_row: Optional[int] = None) -> pd.DataFrame:
    """Load Excel data with error handling."""
    settings = get_settings()
    file_path = settings.data_dir / filename
    
    if not file_path.exists():
        raise FileNotFoundError(f"Data file not found: {filename}")
    
    try:
        df = pd.read_excel(
            file_path, 
            sheet_name=sheet_name, 
            header=header_row,
            skiprows=skiprows if header_row is None else 0
        )
        return df
    except Exception as e:
        raise RuntimeError(f"Error loading Excel file {filename}: {e}")


def load_performance_graph_data() -> pd.DataFrame:
    """Load and clean S&P 500 performance data from Excel file."""
    try:
        # Load Excel file, skip header rows and use custom column names
        df = load_excel_data("PerformanceGraphExport.xls", sheet_name=0, skiprows=6)
        df.columns = ['date', 'sp500_value']
        
        # Remove any NaN rows
        df = df.dropna()
        
        # Filter out non-date entries and header rows
        # Remove rows where date column contains text like "Effective date"
        df = df[~df['date'].astype(str).str.contains('Effective date', na=False)]
        df = df[~df['date'].astype(str).str.contains('S&P 500', na=False)]
        
        # Filter out any rows where date is not actually a datetime
        date_mask = []
        for idx, row in df.iterrows():
            try:
                # Try to convert to datetime to validate
                pd.to_datetime(row['date'])
                date_mask.append(True)
            except (ValueError, TypeError):
                date_mask.append(False)
        
        df = df[date_mask]
        
        # Now safely convert data types
        df['date'] = pd.to_datetime(df['date'])
        df['sp500_value'] = pd.to_numeric(df['sp500_value'], errors='coerce')
        
        # Remove any rows where conversion failed
        df = df.dropna()
        
        # Sort by date
        df = df.sort_values('date')
        
        # Reset index
        df = df.reset_index(drop=True)
        
        return df
    except Exception as e:
        raise RuntimeError(f"Error loading performance graph data: {e}")


def filter_by_date_range(
    df: pd.DataFrame, 
    date_column: str, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None
) -> pd.DataFrame:
    """Filter dataframe by date range."""
    if start_date:
        df = df[df[date_column] >= start_date]
    if end_date:
        df = df[df[date_column] <= end_date]
    return df


def apply_limit(df: pd.DataFrame, limit: Optional[int] = None) -> pd.DataFrame:
    """Apply record limit to dataframe."""
    if limit:
        return df.tail(limit)
    return df


def calculate_percentage_change(current: float, previous: float) -> Optional[float]:
    """Calculate percentage change between two values."""
    if previous is None or current is None or previous == 0:
        return None
    return ((current - previous) / previous) * 100


def get_data_file_path(filename: str) -> Path:
    """Get full path to data file."""
    settings = get_settings()
    return settings.data_dir / filename


def validate_data_files(required_files: List[str]) -> Dict[str, bool]:
    """Validate that required data files exist."""
    results = {}
    settings = get_settings()
    
    for filename in required_files:
        file_path = settings.data_dir / filename
        results[filename] = file_path.exists()
    
    return results


def get_file_info(filename: str) -> Dict[str, Any]:
    """Get information about a data file."""
    settings = get_settings()
    file_path = settings.data_dir / filename
    
    if not file_path.exists():
        return {"exists": False, "path": str(file_path)}
    
    try:
        df = pd.read_csv(file_path)
        return {
            "exists": True,
            "path": str(file_path),
            "rows": len(df),
            "columns": list(df.columns),
            "size_bytes": file_path.stat().st_size,
            "modified": datetime.datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
        }
    except Exception as e:
        return {
            "exists": True,
            "path": str(file_path),
            "error": str(e)
        }
