"""
FRED Economic Data Fetcher with MongoDB Integration
Fetches key economic indicators from Federal Reserve Economic Data (FRED) and stores in MongoDB
"""

import os
import sys
import pandas as pd
from fredapi import Fred
from datetime import datetime, timedelta
import logging

# Add the backend2 directory to Python path for imports
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

try:
    from src.core.config import get_settings
    from src.services.mongodb_service import MongoDBService
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure you're running this script from the backend2 directory")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FredDataFetcher:
    """
    Fetches economic data from FRED API
    """
    
    def __init__(self, api_key=None, use_mongodb=True):
        """
        Initialize FRED API client
        
        Args:
            api_key (str): FRED API key. If None, will try to get from environment variable
            use_mongodb (bool): Whether to use MongoDB for storage
        """
        settings = get_settings()

        if api_key is None:
            # Try to get from settings first, then environment variable
            api_key = settings.fred_api_key if settings.fred_api_key else os.getenv('FRED_API_KEY')
            
        if not api_key:
            raise ValueError(
                "FRED API key is required. Please:\n"
                "1. Set FRED_API_KEY environment variable, or\n"
                "2. Add fred_api_key to your .env file, or\n"
                "3. Pass api_key parameter directly\n"
                "Get your free API key at: https://fred.stlouisfed.org/docs/api/api_key.html"
            )
            
        self.fred = Fred(api_key=api_key)
        self.use_mongodb = use_mongodb
        
        # Initialize MongoDB service if enabled
        if self.use_mongodb:
            try:
                self.mongodb = MongoDBService()
                logger.info("MongoDB service initialized")
            except Exception as e:
                logger.warning(f"MongoDB initialization failed: {e}")
                self.use_mongodb = False
                self.mongodb = None
        else:
            self.mongodb = None
        
        # FRED series IDs for the requested indicators
        self.series_ids = {
            'real_interest_rate': 'REAINTRATREARAT10Y',  # 10-Year Real Interest Rate
            'federal_funds_rate': 'FEDFUNDS',            # Federal Funds Rate
            'treasury_10year': 'GS10',                   # 10-Year Treasury Constant Maturity Rate
            'sofr': 'SOFR',                             # Secured Overnight Financing Rate
            'balance_sheet': 'WALCL'                     # Total Assets (Fed Balance Sheet)
        }
    
    def fetch_latest_data(self):
        """
        Fetch the latest available data for all indicators
        
        Returns:
            dict: Dictionary containing latest values for each indicator
        """
        latest_data = {}
        
        for indicator, series_id in self.series_ids.items():
            try:
                # Get data for the last 30 days to ensure we get the latest available
                end_date = datetime.now()
                start_date = end_date - timedelta(days=30)
                
                data = self.fred.get_series(series_id, start=start_date, end=end_date)
                
                if not data.empty:
                    latest_value = data.iloc[-1]
                    latest_date = data.index[-1]
                    
                    latest_data[indicator] = {
                        'value': float(latest_value),
                        'date': latest_date.strftime('%Y-%m-%d'),
                        'series_id': series_id
                    }
                    
                    logger.info(f"{indicator}: {latest_value} (as of {latest_date.strftime('%Y-%m-%d')})")
                else:
                    logger.warning(f"No data available for {indicator} ({series_id})")
                    
            except Exception as e:
                logger.error(f"Error fetching {indicator}: {str(e)}")
                
        return latest_data
    
    def fetch_and_store_all_data(self, start_date=None, end_date=None):
        """
        Fetch historical data for all indicators and store in MongoDB.
        
        Args:
            start_date (str): Start date in 'YYYY-MM-DD' format. Default: 1 year ago
            end_date (str): End date in 'YYYY-MM-DD' format. Default: today
            
        Returns:
            dict: Summary of stored data
        """
        if start_date is None:
            start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
        if end_date is None:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        results = {}
        
        for indicator, series_id in self.series_ids.items():
            try:
                logger.info(f"Fetching {indicator} data from FRED...")
                
                # Fetch data from FRED
                data = self.fred.get_series(series_id, start=start_date, end=end_date)
                
                if not data.empty:
                    # Convert to list of dictionaries for MongoDB
                    mongo_data = []
                    for date, value in data.items():
                        if pd.notna(value):  # Skip NaN values
                            mongo_data.append({
                                'date': date.strftime('%Y-%m-%d'),
                                'value': float(value),
                                'series_id': series_id,
                                'fetched_at': datetime.utcnow()
                            })
                    
                    # Store in MongoDB if enabled
                    if self.use_mongodb and self.mongodb:
                        success = self.mongodb.insert_monetary_data(indicator, mongo_data)
                        if success:
                            results[indicator] = {
                                'status': 'success',
                                'records_stored': len(mongo_data),
                                'date_range': f"{start_date} to {end_date}"
                            }
                        else:
                            results[indicator] = {
                                'status': 'storage_failed',
                                'records_fetched': len(mongo_data)
                            }
                    else:
                        results[indicator] = {
                            'status': 'fetched_only',
                            'records_fetched': len(mongo_data),
                            'note': 'MongoDB not available'
                        }
                    
                    logger.info(f"Processed {len(mongo_data)} data points for {indicator}")
                    
                else:
                    results[indicator] = {
                        'status': 'no_data',
                        'message': f"No data available for {series_id}"
                    }
                    logger.warning(f"No data available for {indicator} ({series_id})")
                    
            except Exception as e:
                results[indicator] = {
                    'status': 'error',
                    'message': str(e)
                }
                logger.error(f"Error fetching {indicator}: {str(e)}")
        
        return results

    def update_latest_data(self):
        """
        Fetch and store only the latest data points for all indicators.
        Useful for daily updates.
        
        Returns:
            dict: Summary of updated data
        """
        # Get data for the last 7 days to ensure we catch the latest
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        return self.fetch_and_store_all_data(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d')
        )
    
    def get_series_info(self):
        """
        Get information about each series
        
        Returns:
            dict: Dictionary containing series information
        """
        series_info = {}
        
        for indicator, series_id in self.series_ids.items():
            try:
                info = self.fred.get_series_info(series_id)
                series_info[indicator] = {
                    'title': info['title'],
                    'units': info['units'],
                    'frequency': info['frequency'],
                    'last_updated': info['last_updated'],
                    'series_id': series_id
                }
            except Exception as e:
                logger.error(f"Error getting info for {indicator}: {str(e)}")
                
        return series_info

def main():
    """
    Main function to demonstrate the FRED data fetcher with MongoDB integration
    """
    try:
        # Initialize the fetcher with MongoDB enabled
        fetcher = FredDataFetcher(use_mongodb=True)
        
        print("=== FRED Economic Data Fetcher with MongoDB ===\n")
        
        # Get series information
        print("Series Information:")
        series_info = fetcher.get_series_info()
        for indicator, info in series_info.items():
            print(f"{indicator.replace('_', ' ').title()}: {info.get('title', 'N/A')}")
            print(f"  Units: {info.get('units', 'N/A')}")
            print(f"  Frequency: {info.get('frequency', 'N/A')}")
            print()
        
        # Get latest data
        print("Latest Data from FRED:")
        latest_data = fetcher.fetch_latest_data()
        for indicator, data in latest_data.items():
            print(f"{indicator.replace('_', ' ').title()}: {data['value']} (as of {data['date']})")
        print()
        
        # Fetch and store historical data (last 3 months)
        print("Fetching and storing historical data for the last 3 months...")
        start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
        
        storage_results = fetcher.fetch_and_store_all_data(start_date=start_date)
        
        print("\nStorage Results:")
        for indicator, result in storage_results.items():
            status = result.get('status', 'unknown')
            print(f"{indicator.replace('_', ' ').title()}: {status}")
            
            if 'records_stored' in result:
                print(f"  Records stored: {result['records_stored']}")
            elif 'records_fetched' in result:
                print(f"  Records fetched: {result['records_fetched']}")
            
            if 'message' in result:
                print(f"  Message: {result['message']}")
            
            if 'note' in result:
                print(f"  Note: {result['note']}")
            print()
        
        # Show MongoDB statistics if available
        if fetcher.use_mongodb and fetcher.mongodb:
            print("MongoDB Collection Statistics:")
            for indicator in fetcher.series_ids.keys():
                stats = fetcher.mongodb.get_collection_stats(indicator)
                if stats:
                    print(f"{indicator.replace('_', ' ').title()}:")
                    print(f"  Total records: {stats.get('total_records', 0)}")
                    print(f"  Date range: {stats.get('oldest_date', 'N/A')} to {stats.get('latest_date', 'N/A')}")
                    print(f"  Latest value: {stats.get('latest_value', 'N/A')}")
                    print()
        
    except Exception as e:
        logger.error(f"Error in main: {str(e)}")
        print(f"Error: {str(e)}")
        if "FRED API key" in str(e):
            print("Make sure to set your FRED_API_KEY environment variable")


def update_data():
    """
    Function specifically for updating latest data (can be used for scheduled updates)
    """
    try:
        fetcher = FredDataFetcher(use_mongodb=True)
        print("Updating latest monetary policy data...")
        
        results = fetcher.update_latest_data()
        
        print("Update Results:")
        for indicator, result in results.items():
            print(f"{indicator}: {result.get('status', 'unknown')}")
        
        return results
        
    except Exception as e:
        logger.error(f"Error updating data: {e}")
        return {}