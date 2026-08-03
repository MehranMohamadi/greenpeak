#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Liquidity Flows Fetcher

Fetches liquidity and flow data from FRED API and other sources.
Implements both working FRED endpoints and placeholder methods for future data sources.

Available Data Sources:
- M2 Money Supply (M2SL) - FRED API
- Reverse Repo Operations (RRPONTSYD) - FRED API  
- ETF Inflows - Placeholder (future: Yahoo Finance/yfinance)
- Equity Fund Flows - Placeholder (future: paid API)
- Margin Debt - Placeholder (future: paid API)
- Institutional Flows - Placeholder (future: paid API)

Usage:
    python liquidity_flows_fetcher.py
"""

import os
import sys
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import pandas as pd
from fredapi import Fred
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, BulkWriteError

# Import ETL common configuration with yfinance curl_cffi support
from etl_config import setup_etl_environment, create_ticker

# Add parent directories to Python path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from src.core.config import get_fred_api_key, settings

# Configure logging with UTF-8 encoding
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('liquidity_flows_fetcher.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


class LiquidityFlowsFetcher:
    """Fetcher for liquidity flows and money supply data."""
    
    def __init__(self):
        """Initialize the fetcher with API keys and database connection."""
        self.fred_api_key = get_fred_api_key()
        self.mongodb_uri = settings.mongodb_url
        
        if not self.fred_api_key:
            raise ValueError("FRED API key not found. Please set FRED_API_KEY environment variable.")
        
        # Initialize FRED API
        self.fred = Fred(api_key=self.fred_api_key)
        
        # Initialize MongoDB connection
        try:
            self.client = MongoClient(self.mongodb_uri)
            self.db = self.client['sp500_dashboard']
            self.collection = self.db['liquidity_flows']
            
            # Create indexes for efficient queries
            self.collection.create_index([("indicator", 1), ("date", 1)], unique=True)
            self.collection.create_index([("date", 1)])
            self.collection.create_index([("fred_series_id", 1)])
            
            logger.info("Connected to MongoDB successfully")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

        # FRED series configuration for available data
        self.fred_series_config = {
            "money_supply_m2": {
                "series_id": "M2SL",
                "description": "M2 Money Stock",
                "unit": "billions_of_dollars",
                "frequency": "monthly",
                "seasonal_adjustment": "seasonally_adjusted"
            },
            "reverse_repo_operations": {
                "series_id": "RRPONTSYD", 
                "description": "Overnight Reverse Repurchase Agreements: Treasury Securities Sold by the Federal Reserve in the Temporary Open Market Operations",
                "unit": "millions_of_dollars",
                "frequency": "daily",
                "seasonal_adjustment": "not_seasonally_adjusted"
            }
        }
        
        # Placeholder configurations for future implementation
        self.placeholder_indicators = {
            "equity_fund_flows": {
                "description": "Equity Fund Flows (Placeholder - Future: Paid API)",
                "unit": "millions_of_dollars",
                "frequency": "weekly", 
                "data_source": "paid_api_placeholder"
            },
            "margin_debt": {
                "description": "Margin Debt (Placeholder - Future: Paid API)",
                "unit": "millions_of_dollars",
                "frequency": "monthly",
                "data_source": "paid_api_placeholder"
            },
            "institutional_flows": {
                "description": "Institutional Flows (Placeholder - Future: Paid API)", 
                "unit": "millions_of_dollars",
                "frequency": "daily",
                "data_source": "paid_api_placeholder"
            }
        }
        
        # ETF configuration for real data
        self.etf_config = {
            "etf_inflows": {
                "description": "ETF Inflows - Major ETF Volume Analysis",
                "unit": "millions_of_dollars",
                "frequency": "daily",
                "data_source": "yahoo_finance",
                "tickers": ["SPY", "QQQ", "IWM", "VTI", "VOO", "IVV", "EFA", "VEA", "GLD", "TLT"]  # Major ETFs
            }
        }

    def fetch_fred_data(self, indicator_name: str, start_date: Optional[str] = None) -> pd.DataFrame:
        """
        Fetch data from FRED API for a specific indicator.
        
        Args:
            indicator_name: Name of the indicator to fetch
            start_date: Start date in 'YYYY-MM-DD' format
            
        Returns:
            DataFrame with date and value columns
        """
        if indicator_name not in self.fred_series_config:
            raise ValueError(f"Unknown FRED indicator: {indicator_name}")
        
        config = self.fred_series_config[indicator_name]
        series_id = config["series_id"]
        
        try:
            logger.info(f"Fetching FRED data for {indicator_name} ({series_id})...")
            
            # Set default start date to 15 years ago if not provided
            if not start_date:
                start_date = (datetime.now() - timedelta(days=15*365)).strftime('%Y-%m-%d')
            
            # Fetch data from FRED
            data = self.fred.get_series(
                series_id=series_id,
                start=start_date,
                end=datetime.now().strftime('%Y-%m-%d')
            )
            
            if data.empty:
                logger.warning(f"No data returned for {series_id}")
                return pd.DataFrame()
            
            # Convert to DataFrame with proper structure
            df = data.reset_index()
            df.columns = ['date', 'value']
            
            # Remove any missing values
            df = df.dropna()
            
            # Convert date to string format
            df['date'] = df['date'].dt.strftime('%Y-%m-%d')
            
            logger.info(f"Successfully fetched {len(df)} records for {indicator_name}")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching FRED data for {indicator_name}: {e}")
            return pd.DataFrame()

    def store_data_batch(self, indicator_name: str, df: pd.DataFrame, config: Dict[str, Any]) -> int:
        """
        Store data in MongoDB with batch processing.
        
        Args:
            indicator_name: Name of the indicator
            df: DataFrame with date and value columns
            config: Configuration dictionary with metadata
            
        Returns:
            Number of documents inserted
        """
        if df.empty:
            return 0
        
        # Prepare documents for batch insert
        documents = []
        for _, row in df.iterrows():
            doc = {
                "indicator": indicator_name,
                "date": row['date'],
                "value": float(row['value']) if pd.notna(row['value']) else None,
                "description": config["description"],
                "unit": config["unit"],
                "frequency": config["frequency"],
                "source": "Federal Reserve Economic Data (FRED)",
                "fred_series_id": config.get("series_id"),
                "seasonal_adjustment": config.get("seasonal_adjustment"),
                "last_updated": datetime.utcnow().isoformat(),
                "data_source": config.get("series_id", config.get("data_source"))
            }
            documents.append(doc)
        
        # Batch insert with error handling
        inserted_count = 0
        batch_size = 1000
        
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            try:
                result = self.collection.insert_many(batch, ordered=False)
                inserted_count += len(result.inserted_ids)
            except BulkWriteError as e:
                # Count successful inserts even if some fail due to duplicates
                inserted_count += e.details.get('nInserted', 0)
                logger.debug(f"Batch insert completed with {e.details.get('nInserted', 0)} inserts")
        
        return inserted_count

    def fetch_etf_inflows_data(self, start_date: Optional[str] = None) -> pd.DataFrame:
        """
        Fetch ETF inflows data from Yahoo Finance using volume and price data.
        
        Args:
            start_date: Start date in 'YYYY-MM-DD' format
            
        Returns:
            DataFrame with date and aggregated ETF inflow estimates
        """
        try:
            logger.info("Fetching ETF inflows data from Yahoo Finance...")
            
            # Set default start date to 5 years ago if not provided (ETF data is large)
            if not start_date:
                start_date = (datetime.now() - timedelta(days=5*365)).strftime('%Y-%m-%d')
            
            config = self.etf_config["etf_inflows"]
            tickers = config["tickers"]
            
            all_etf_data = []
            
            for ticker in tickers:
                try:
                    logger.info(f"Fetching data for {ticker}...")
                    
                    # Download ticker data
                    etf = create_ticker(ticker)
                    hist = etf.history(start=start_date, end=datetime.now().strftime('%Y-%m-%d'))
                    
                    if hist.empty:
                        logger.warning(f"No data available for {ticker}")
                        continue
                    
                    # Calculate daily dollar volume (Volume * Close price)
                    hist['dollar_volume'] = hist['Volume'] * hist['Close']
                    
                    # Reset index to get date as a column
                    hist_reset = hist.reset_index()
                    hist_reset['ticker'] = ticker
                    hist_reset['date'] = hist_reset['Date'].dt.strftime('%Y-%m-%d')
                    
                    # Select only needed columns
                    etf_data = hist_reset[['date', 'dollar_volume', 'ticker']].copy()
                    all_etf_data.append(etf_data)
                    
                    logger.info(f"✓ {ticker}: {len(etf_data)} records fetched")
                    
                except Exception as e:
                    logger.error(f"Error fetching {ticker}: {e}")
                    continue
            
            if not all_etf_data:
                logger.warning("No ETF data available")
                return pd.DataFrame()
            
            # Combine all ETF data
            combined_df = pd.concat(all_etf_data, ignore_index=True)
            
            # Aggregate by date (sum all ETF dollar volumes)
            daily_totals = combined_df.groupby('date')['dollar_volume'].sum().reset_index()
            
            # Convert to millions of dollars
            daily_totals['value'] = daily_totals['dollar_volume'] / 1_000_000
            
            # Select final columns
            result_df = daily_totals[['date', 'value']].copy()
            
            # Sort by date
            result_df = result_df.sort_values('date')
            
            logger.info(f"Successfully aggregated ETF inflows data: {len(result_df)} records")
            return result_df
            
        except Exception as e:
            logger.error(f"Error fetching ETF inflows data: {e}")
            return pd.DataFrame()

    def fetch_placeholder_data(self, indicator_name: str) -> pd.DataFrame:
        """
        Placeholder method for future data source implementations.
        
        Args:
            indicator_name: Name of the placeholder indicator
            
        Returns:
            Empty DataFrame (to be implemented when APIs become available)
        """
        logger.info(f"Placeholder fetch for {indicator_name} - Future implementation needed")
        
        # For now, return empty DataFrame
        # Future implementations would add:
        # - ETF Inflows: yfinance integration
        # - Equity Fund Flows: Paid API integration
        # - Margin Debt: Paid API integration  
        # - Institutional Flows: Paid API integration
        
        return pd.DataFrame()

    def fetch_all_liquidity_data(self, start_date: Optional[str] = None) -> Dict[str, int]:
        """
        Fetch all liquidity flows data from available sources.
        
        Args:
            start_date: Start date in 'YYYY-MM-DD' format
            
        Returns:
            Dictionary with indicator names and counts of inserted records
        """
        results = {}
        total_inserted = 0
        
        logger.info("Starting liquidity flows data fetch...")
        
        # Process FRED API indicators
        for indicator_name, config in self.fred_series_config.items():
            try:
                # Fetch data
                df = self.fetch_fred_data(indicator_name, start_date)
                
                if not df.empty:
                    # Store in MongoDB
                    inserted_count = self.store_data_batch(indicator_name, df, config)
                    results[indicator_name] = inserted_count
                    total_inserted += inserted_count
                    logger.info(f"✓ {indicator_name}: {inserted_count} records inserted")
                else:
                    results[indicator_name] = 0
                    logger.warning(f"✗ {indicator_name}: No data available")
                    
            except Exception as e:
                logger.error(f"✗ {indicator_name}: Failed - {e}")
                results[indicator_name] = 0
        
        # Process placeholder indicators (create structure but no data)
        for indicator_name, config in self.placeholder_indicators.items():
            try:
                # For now just fetch empty data (placeholder)
                df = self.fetch_placeholder_data(indicator_name)
                inserted_count = self.store_data_batch(indicator_name, df, config)
                results[indicator_name] = inserted_count
                
                if inserted_count > 0:
                    total_inserted += inserted_count
                    logger.info(f"✓ {indicator_name}: {inserted_count} records inserted")
                else:
                    logger.info(f"○ {indicator_name}: Placeholder ready (no data source yet)")
                    
            except Exception as e:
                logger.error(f"✗ {indicator_name}: Failed - {e}")
                results[indicator_name] = 0
        
        # Process ETF inflows (real Yahoo Finance data)
        for indicator_name, config in self.etf_config.items():
            try:
                # Fetch real ETF data
                df = self.fetch_etf_inflows_data(start_date)
                
                if not df.empty:
                    # Store in MongoDB
                    inserted_count = self.store_data_batch(indicator_name, df, config)
                    results[indicator_name] = inserted_count
                    total_inserted += inserted_count
                    logger.info(f"✓ {indicator_name}: {inserted_count} records inserted")
                else:
                    results[indicator_name] = 0
                    logger.warning(f"✗ {indicator_name}: No data available")
                    
            except Exception as e:
                logger.error(f"✗ {indicator_name}: Failed - {e}")
                results[indicator_name] = 0
        
        # Summary
        successful_indicators = len([k for k, v in results.items() if v > 0])
        total_indicators = len(results)
        success_rate = (successful_indicators / total_indicators) * 100 if total_indicators > 0 else 0
        
        logger.info(f"\n{'='*50}")
        logger.info(f"LIQUIDITY FLOWS FETCH COMPLETED")
        logger.info(f"{'='*50}")
        logger.info(f"Successful indicators: {successful_indicators}/{total_indicators} ({success_rate:.1f}%)")
        logger.info(f"Total records inserted: {total_inserted}")
        logger.info(f"Results by indicator:")
        
        for indicator, count in results.items():
            status = "✓" if count > 0 else ("○" if indicator in self.placeholder_indicators else "✗")
            logger.info(f"  {status} {indicator}: {count} records")
        
        return results

    def get_data_summary(self) -> Dict[str, Any]:
        """Get summary statistics of stored data."""
        try:
            total_records = self.collection.count_documents({})
            indicators = self.collection.distinct("indicator")
            
            summary = {
                "total_records": total_records,
                "total_indicators": len(indicators),
                "indicators": indicators
            }
            
            # Get record counts by indicator
            indicator_counts = {}
            for indicator in indicators:
                count = self.collection.count_documents({"indicator": indicator})
                indicator_counts[indicator] = count
            
            summary["indicator_counts"] = indicator_counts
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting data summary: {e}")
            return {}

    def cleanup_null_fred_series(self):
        """Remove any documents with null fred_series_id values."""
        try:
            result = self.collection.delete_many({"fred_series_id": None})
            logger.info(f"Cleaned up {result.deleted_count} records with null fred_series_id")
            return result.deleted_count
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            return 0

    def close_connection(self):
        """Close MongoDB connection."""
        if hasattr(self, 'client'):
            self.client.close()
            logger.info("MongoDB connection closed")


def main():
    """Main execution function."""
    try:
        # Initialize fetcher
        fetcher = LiquidityFlowsFetcher()
        
        # Clean up any existing null fred_series_id records
        fetcher.cleanup_null_fred_series()
        
        # Fetch all liquidity flows data (15 years of history)
        start_date = (datetime.now() - timedelta(days=15*365)).strftime('%Y-%m-%d')
        results = fetcher.fetch_all_liquidity_data(start_date=start_date)
        
        # Display summary
        summary = fetcher.get_data_summary()
        logger.info(f"\nFinal Summary:")
        logger.info(f"Total indicators: {summary.get('total_indicators', 0)}")
        logger.info(f"Total records: {summary.get('total_records', 0)}")
        
        # Close connection
        fetcher.close_connection()
        
    except Exception as e:
        logger.error(f"Fatal error in main execution: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
