"""
FRED System Risk Data Fetcher
Single file to fetch ALL historical data for systemic risk indicators.

This script:
1. Fetches VIX, CDS Spreads, and Financial Stress Index from FRED API
2. Calculates Credit Spread using bond ETFs (HYG vs Treasury ETFs)
3. Calculates 2Y/10Y Yield Curve spread from FRED (DGS2 and DGS10)
4. Uses batch processing to handle API rate limits
5. Automatically creates MongoDB collections and indexes
6. Handles data gaps and missing values
7. Provides progress tracking and error handling

Run: python system_risk_fetcher.py
"""

import logging
import time
import os
from datetime import datetime, timedelta, UTC
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
from fredapi import Fred
from pymongo import MongoClient, UpdateOne, ASCENDING
from pymongo.errors import BulkWriteError

# Import ETL common configuration with yfinance curl_cffi support
from etl_config import setup_etl_environment, create_ticker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('system_risk_fetcher.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SystemRiskFetcher:
    """Fetches all historical systemic risk data from FRED and calculates derived indicators."""
    
    def __init__(self):
        """Initialize the fetcher with configuration."""
        # Setup environment using common configuration
        self.logger, self.db = setup_etl_environment('system_risk_fetcher')
        
        # Store logger reference for convenience
        global logger
        logger = self.logger
        
        # Get FRED API key from environment
        self.fred_api_key = os.environ.get('FRED_API_KEY', '')
        if not self.fred_api_key:
            raise ValueError("FRED_API_KEY not found in environment variables or .env file")
        
        # Initialize FRED connection
        self.fred = Fred(api_key=self.fred_api_key)
        
        # Get MongoDB client from database reference
        if self.db is not None:
            self.mongo_client = self.db.client
        else:
            raise Exception("MongoDB connection failed")
        
        # Test connections
        self._test_connections()
        
        # System Risk Indicators Configuration - 5 indicators with proper FRED series
        self.indicators = {
            'vix': {
                'type': 'fred',
                'series_id': 'VIXCLS',
                'name': 'CBOE Volatility Index: VIX',
                'start_date': '1990-01-02',  # VIX historical start
                'frequency': 'Daily',
                'unit': 'Index',
                'seasonal_adjustment': 'Not Seasonally Adjusted'
            },
            'credit_spread_hyg': {
                'type': 'fred',
                'series_id': 'BAMLH0A0HYM2',
                'name': 'ICE BofA US High Yield Index Option-Adjusted Spread',
                'start_date': '1996-12-30',  # Historical start
                'frequency': 'Daily',
                'unit': 'Percent',
                'seasonal_adjustment': 'Not Seasonally Adjusted'
            },
            'yield_curve_2y10y': {
                'type': 'fred',
                'series_id': 'T10Y2Y',
                'name': '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity',
                'start_date': '1976-06-01',  # T10Y2Y start date
                'frequency': 'Daily',
                'unit': 'Percent',
                'seasonal_adjustment': 'Not Seasonally Adjusted'
            },
            'cds_spreads_investment_grade': {
                'type': 'fred',
                'series_id': 'BAMLC0A4CBBB',
                'name': 'ICE BofA BBB US Corporate Index Option-Adjusted Spread',
                'start_date': '1996-12-31',  # Historical start
                'frequency': 'Daily',
                'unit': 'Percent',
                'seasonal_adjustment': 'Not Seasonally Adjusted'
            },
            'financial_stress_index': {
                'type': 'fred',
                'series_id': 'STLFSI4',
                'name': 'St. Louis Fed Financial Stress Index',
                'start_date': '1993-12-31',  # Historical start
                'frequency': 'Weekly',
                'unit': 'Index',
                'seasonal_adjustment': 'Not Seasonally Adjusted'
            }
        }
        
        # API rate limiting configuration
        self.api_delay = 0.3  # 300ms between requests
        self.batch_size_days = 3650  # Fetch 10 years at a time
        self.max_retries = 3
        self.retry_delay = 5  # 5 seconds between retries
        
        # Setup collection
        self.collection_name = 'systemic_risk'
        self.collection = self.db[self.collection_name]
        self._setup_collection()
    
    def _test_connections(self):
        """Test FRED and MongoDB connections."""
        try:
            # Test FRED API
            self.fred.get_series('GDP', limit=1)
            logger.info("FRED API connection successful")
            
            # Test MongoDB
            self.mongo_client.admin.command('ping')
            logger.info("MongoDB connection successful")
            
        except Exception as e:
            logger.error("Connection test failed: %s", e)
            raise
    
    def _setup_collection(self):
        """Setup MongoDB collection with proper indexes."""
        logger.info("Setting up MongoDB collection: %s", self.collection_name)
        
        try:
            # Drop existing indexes that might conflict
            try:
                existing_indexes = self.collection.index_information()
                for index_name in existing_indexes:
                    if index_name != '_id_' and 'indicator' in index_name:
                        self.collection.drop_index(index_name)
                        logger.info("Dropped existing index: %s", index_name)
            except Exception:
                pass  # Ignore errors when dropping indexes
            
            # Create compound unique index on indicator and date
            try:
                self.collection.create_index([
                    ("indicator", ASCENDING),
                    ("date", ASCENDING)
                ], unique=True, background=True, name="indicator_date_unique")
                logger.info("Created unique index: indicator_date_unique")
            except Exception as e:
                if "already exists" not in str(e):
                    raise e
                logger.info("Index already exists: indicator_date_unique")
            
            # Create individual indexes for queries
            for field, index_name in [
                ("indicator", "indicator_idx"),
                ("date", "date_idx"), 
                ("updated_at", "updated_at_idx"),
                ("data_source", "source_idx")
            ]:
                try:
                    self.collection.create_index(field, background=True, name=index_name)
                    logger.info("Created index: %s", index_name)
                except Exception as e:
                    if "already exists" not in str(e):
                        logger.warning("Could not create index %s: %s", index_name, e)
                    else:
                        logger.info("Index already exists: %s", index_name)
            
            logger.info("Collection setup completed successfully")
            
        except Exception as e:
            logger.error("Error setting up collection: %s", e)
            raise
    
    def _get_series_metadata(self, series_id: str) -> Dict[str, Any]:
        """Get detailed metadata for a FRED series."""
        try:
            series_info = self.fred.get_series_info(series_id)
            
            metadata = {
                'title': str(series_info.get('title', 'Unknown')),
                'units': str(series_info.get('units', 'Unknown')),
                'frequency': str(series_info.get('frequency', 'Unknown')),
                'seasonal_adjustment': str(series_info.get('seasonal_adjustment', 'Unknown')),
                'last_updated': str(series_info.get('last_updated', 'Unknown')),
                'observation_start': str(series_info.get('observation_start', 'Unknown')),
                'observation_end': str(series_info.get('observation_end', 'Unknown')),
                'popularity': int(series_info.get('popularity', 0)) if series_info.get('popularity') else 0,
                'notes': str(series_info.get('notes', ''))[:500]  # Limit notes length
            }
            
            return metadata
            
        except Exception as e:
            logger.warning("Could not fetch metadata for %s: %s", series_id, e)
            return {
                'title': 'Unknown',
                'units': 'Unknown',
                'frequency': 'Unknown',
                'seasonal_adjustment': 'Unknown',
                'last_updated': 'Unknown',
                'observation_start': 'Unknown',
                'observation_end': 'Unknown',
                'popularity': 0,
                'notes': ''
            }
    
    def _chunk_date_range(self, start_date: datetime, end_date: datetime, chunk_days: int) -> List[Tuple[datetime, datetime]]:
        """Split date range into chunks for batch processing."""
        chunks = []
        current_start = start_date
        
        while current_start < end_date:
            current_end = min(current_start + timedelta(days=chunk_days), end_date)
            chunks.append((current_start, current_end))
            current_start = current_end + timedelta(days=1)
        
        return chunks
    
    def _get_existing_date_range(self, indicator: str) -> Tuple[Optional[datetime], Optional[datetime]]:
        """Get the date range of existing data for an indicator."""
        try:
            # Get earliest date
            earliest = self.collection.find_one(
                {"indicator": indicator},
                sort=[("date", 1)]
            )
            
            # Get latest date
            latest = self.collection.find_one(
                {"indicator": indicator},
                sort=[("date", -1)]
            )
            
            if earliest and latest:
                earliest_date = datetime.strptime(earliest["date"], "%Y-%m-%d")
                latest_date = datetime.strptime(latest["date"], "%Y-%m-%d")
                return earliest_date, latest_date
            else:
                return None, None
                
        except Exception as e:
            logger.error("Error getting existing date range for %s: %s", indicator, e)
            return None, None
    
    def _fetch_etf_data(self, symbol: str, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """Fetch ETF data from Yahoo Finance."""
        try:
            logger.info("Fetching ETF data for %s from %s to %s", 
                       symbol, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
            
            ticker = create_ticker(symbol)
            hist = ticker.history(
                start=start_date.strftime('%Y-%m-%d'),
                end=(end_date + timedelta(days=1)).strftime('%Y-%m-%d'),  # Add 1 day to include end_date
                interval="1d"
            )
            
            if hist.empty:
                logger.warning("No data returned for ETF %s", symbol)
                return pd.DataFrame()
            
            # Reset index to get date as column
            hist = hist.reset_index()
            hist['Date'] = hist['Date'].dt.strftime('%Y-%m-%d')
            
            return hist
            
        except Exception as e:
            logger.error("Error fetching ETF data for %s: %s", symbol, e)
            return pd.DataFrame()
    
    def _calculate_etf_yield_approximation(self, etf_data: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """Calculate an approximation of ETF yield using price changes and dividend yield."""
        try:
            if etf_data.empty:
                return pd.DataFrame()
            
            # For bond ETFs, we'll use the inverse relationship between price and yield
            # This is an approximation - actual yield data would be better but not available via free APIs
            
            # Calculate rolling volatility as a proxy for yield changes
            etf_data = etf_data.copy()
            etf_data['Price_Change'] = etf_data['Close'].pct_change()
            
            # For Treasury ETFs, use a base yield approximation
            if symbol in ['IEF', 'TLT', 'SHY']:  # Treasury ETFs
                # Use a baseline yield and adjust based on price movements
                base_yield = 3.0  # Approximate base treasury yield
                etf_data['Yield_Approx'] = base_yield - (etf_data['Price_Change'] * 100)
            else:  # Corporate/High Yield ETFs
                # Use higher baseline for corporate bonds
                base_yield = 5.0  # Approximate base corporate yield
                etf_data['Yield_Approx'] = base_yield - (etf_data['Price_Change'] * 100)
            
            # Smooth the yield approximation
            etf_data['Yield_Approx'] = etf_data['Yield_Approx'].rolling(window=5, center=True).mean()
            etf_data['Yield_Approx'] = etf_data['Yield_Approx'].fillna(method='bfill').fillna(method='ffill')
            
            return etf_data[['Date', 'Yield_Approx']]
            
        except Exception as e:
            logger.error("Error calculating yield approximation for %s: %s", symbol, e)
            return pd.DataFrame()
    
    def _fetch_fred_data_chunk(self, indicator: str, config: Dict[str, Any], start_date: datetime, end_date: datetime) -> bool:
        """Fetch FRED data for a specific date range chunk."""
        series_id = config['series_id']
        
        try:
            logger.info("Fetching %s data from %s to %s", 
                       indicator, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
            
            # Fetch data from FRED
            fred_data = self.fred.get_series(
                series_id,
                observation_start=start_date.strftime('%Y-%m-%d'),
                observation_end=end_date.strftime('%Y-%m-%d')
            )
            
            if fred_data.empty:
                logger.info("No data returned for %s in date range", indicator)
                return True
            
            # Get series metadata
            metadata = self._get_series_metadata(series_id)
            
            # Prepare documents for bulk insert
            documents = []
            for date, value in fred_data.items():
                # Skip null/NaN values
                if pd.isna(value):
                    continue
                
                date_str = date.strftime('%Y-%m-%d')
                
                document = {
                    'date': date_str,
                    'indicator': indicator,
                    'value': float(value),
                    'data_source': 'FRED',
                    'fred_series_id': series_id,  # Always set this field
                    'updated_at': datetime.now(UTC),
                    'metadata': {
                        'name': config['name'],
                        'frequency': config['frequency'],
                        'unit': config['unit'],
                        'seasonal_adjustment': config.get('seasonal_adjustment', 'Unknown'),
                        'source': 'Federal Reserve Economic Data (FRED)',
                        'fred_metadata': metadata
                    }
                }
                
                documents.append(document)
            
            if not documents:
                logger.info("No valid data points for %s in date range", indicator)
                return True
            
            # Bulk upsert documents
            operations = []
            for doc in documents:
                filter_query = {
                    'date': doc['date'],
                    'indicator': doc['indicator']
                }
                operations.append(UpdateOne(filter_query, {'$set': doc}, upsert=True))
            
            if operations:
                try:
                    result = self.collection.bulk_write(operations, ordered=False)
                    upserted_count = result.upserted_count + result.modified_count
                    logger.info("Processed %d records for %s (%d new/updated)", 
                               len(documents), indicator, upserted_count)
                    
                except BulkWriteError as bwe:
                    # Handle duplicate key errors gracefully
                    logger.warning("Some duplicate records for %s: %d errors", 
                                 indicator, len(bwe.details.get('writeErrors', [])))
            
            return True
            
        except Exception as e:
            logger.error("Error fetching FRED data chunk for %s: %s", indicator, e)
            return False
    
    def _fetch_calculated_fred_data_chunk(self, indicator: str, config: Dict[str, Any], start_date: datetime, end_date: datetime) -> bool:
        """Fetch and calculate data from multiple FRED series."""
        try:
            logger.info("Calculating %s data from %s to %s", 
                       indicator, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
            
            fred_series = config['fred_series']
            data_frames = {}
            
            # Fetch all required series
            for series_name, series_id in fred_series.items():
                try:
                    data = self.fred.get_series(
                        series_id,
                        observation_start=start_date.strftime('%Y-%m-%d'),
                        observation_end=end_date.strftime('%Y-%m-%d')
                    )
                    if not data.empty:
                        data_frames[series_name] = data
                    time.sleep(0.1)  # Small delay between series
                except Exception as e:
                    logger.warning("Failed to fetch %s (%s): %s", series_name, series_id, e)
            
            if len(data_frames) < 2:
                logger.warning("Insufficient data for calculation of %s", indicator)
                return True
            
            # Combine data and calculate spread
            combined_df = pd.DataFrame()
            for series_name, data in data_frames.items():
                combined_df[series_name] = data
            
            # Calculate the spread (10Y - 2Y)
            if 'ten_year' in combined_df.columns and 'two_year' in combined_df.columns:
                combined_df['spread'] = combined_df['ten_year'] - combined_df['two_year']
            else:
                logger.error("Required series not available for %s calculation", indicator)
                return False
            
            # Remove rows where spread cannot be calculated
            combined_df = combined_df.dropna(subset=['spread'])
            
            if combined_df.empty:
                logger.info("No valid calculated data for %s in date range", indicator)
                return True
            
            # Prepare documents for bulk insert
            documents = []
            for date, row in combined_df.iterrows():
                if pd.isna(row['spread']):
                    continue
                
                date_str = date.strftime('%Y-%m-%d')
                
                document = {
                    'date': date_str,
                    'indicator': indicator,
                    'value': float(row['spread']),
                    'data_source': 'FRED_CALCULATED',
                    'calculation_inputs': {
                        'ten_year': float(row['ten_year']) if not pd.isna(row['ten_year']) else None,
                        'two_year': float(row['two_year']) if not pd.isna(row['two_year']) else None
                    },
                    'updated_at': datetime.now(UTC),
                    'metadata': {
                        'name': config['name'],
                        'frequency': config['frequency'],
                        'unit': config['unit'],
                        'calculation': config['calculation'],
                        'source': 'Federal Reserve Economic Data (FRED) - Calculated',
                        'fred_series_used': fred_series
                    }
                }
                
                documents.append(document)
            
            if not documents:
                logger.info("No valid calculated data points for %s in date range", indicator)
                return True
            
            # Bulk upsert documents
            operations = []
            for doc in documents:
                filter_query = {
                    'date': doc['date'],
                    'indicator': doc['indicator']
                }
                operations.append(UpdateOne(filter_query, {'$set': doc}, upsert=True))
            
            if operations:
                try:
                    result = self.collection.bulk_write(operations, ordered=False)
                    upserted_count = result.upserted_count + result.modified_count
                    logger.info("Processed %d calculated records for %s (%d new/updated)", 
                               len(documents), indicator, upserted_count)
                    
                except BulkWriteError as bwe:
                    # Handle duplicate key errors gracefully
                    logger.warning("Some duplicate records for %s: %d errors", 
                                 indicator, len(bwe.details.get('writeErrors', [])))
            
            return True
            
        except Exception as e:
            logger.error("Error calculating data chunk for %s: %s", indicator, e)
            return False
    
    def _fetch_calculated_etf_data_chunk(self, indicator: str, config: Dict[str, Any], start_date: datetime, end_date: datetime) -> bool:
        """Fetch ETF data and calculate credit spreads."""
        try:
            logger.info("Calculating ETF-based %s data from %s to %s", 
                       indicator, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
            
            etfs = config['etfs']
            
            # Fetch ETF data
            hyg_data = self._fetch_etf_data(etfs['high_yield'], start_date, end_date)
            treasury_data = self._fetch_etf_data(etfs['treasury'], start_date, end_date)
            
            if hyg_data.empty or treasury_data.empty:
                logger.warning("Insufficient ETF data for %s calculation", indicator)
                return True
            
            # Calculate yield approximations
            hyg_yield = self._calculate_etf_yield_approximation(hyg_data, etfs['high_yield'])
            treasury_yield = self._calculate_etf_yield_approximation(treasury_data, etfs['treasury'])
            
            if hyg_yield.empty or treasury_yield.empty:
                logger.warning("Could not calculate yields for %s", indicator)
                return True
            
            # Merge on date and calculate spread
            merged = pd.merge(hyg_yield, treasury_yield, on='Date', suffixes=('_hyg', '_treasury'))
            merged['spread'] = merged['Yield_Approx_hyg'] - merged['Yield_Approx_treasury']
            
            # Remove invalid spreads
            merged = merged.dropna(subset=['spread'])
            
            if merged.empty:
                logger.info("No valid calculated spreads for %s in date range", indicator)
                return True
            
            # Prepare documents for bulk insert
            documents = []
            for _, row in merged.iterrows():
                if pd.isna(row['spread']):
                    continue
                
                document = {
                    'date': row['Date'],
                    'indicator': indicator,
                    'value': float(row['spread']),
                    'data_source': 'ETF_CALCULATED',
                    'calculation_inputs': {
                        'hyg_yield_approx': float(row['Yield_Approx_hyg']) if not pd.isna(row['Yield_Approx_hyg']) else None,
                        'treasury_yield_approx': float(row['Yield_Approx_treasury']) if not pd.isna(row['Yield_Approx_treasury']) else None
                    },
                    'updated_at': datetime.now(UTC),
                    'metadata': {
                        'name': config['name'],
                        'frequency': config['frequency'],
                        'unit': config['unit'],
                        'calculation': config['calculation'],
                        'source': 'Yahoo Finance ETF Data - Calculated',
                        'etfs_used': etfs,
                        'note': 'Yield approximation based on ETF price movements'
                    }
                }
                
                documents.append(document)
            
            if not documents:
                logger.info("No valid calculated ETF data points for %s in date range", indicator)
                return True
            
            # Bulk upsert documents
            operations = []
            for doc in documents:
                filter_query = {
                    'date': doc['date'],
                    'indicator': doc['indicator']
                }
                operations.append(UpdateOne(filter_query, {'$set': doc}, upsert=True))
            
            if operations:
                try:
                    result = self.collection.bulk_write(operations, ordered=False)
                    upserted_count = result.upserted_count + result.modified_count
                    logger.info("Processed %d ETF-calculated records for %s (%d new/updated)", 
                               len(documents), indicator, upserted_count)
                    
                except BulkWriteError as bwe:
                    # Handle duplicate key errors gracefully
                    logger.warning("Some duplicate records for %s: %d errors", 
                                 indicator, len(bwe.details.get('writeErrors', [])))
            
            return True
            
        except Exception as e:
            logger.error("Error calculating ETF data chunk for %s: %s", indicator, e)
            return False
    
    def _fetch_indicator_data(self, indicator: str, config: Dict[str, Any]) -> bool:
        """Fetch all historical data for a single indicator."""
        logger.info("=" * 60)
        logger.info("Starting data fetch for: %s", config['name'])
        logger.info("Data type: %s", config['type'])
        
        try:
            # Define date range
            start_date = datetime.strptime(config['start_date'], '%Y-%m-%d')
            end_date = datetime.now()
            
            # Check existing data
            existing_start, existing_end = self._get_existing_date_range(indicator)
            total_chunks_needed = 0
            
            if existing_start and existing_end:
                logger.info("Existing data: %s to %s", 
                           existing_start.strftime('%Y-%m-%d'), 
                           existing_end.strftime('%Y-%m-%d'))
                
                # Calculate gaps to fill
                chunks_to_fetch = []
                
                # Gap before existing data
                if start_date < existing_start:
                    gap_end = existing_start - timedelta(days=1)
                    chunks_to_fetch.extend(self._chunk_date_range(start_date, gap_end, self.batch_size_days))
                    logger.info("Need to fetch historical gap: %s to %s", 
                               start_date.strftime('%Y-%m-%d'), gap_end.strftime('%Y-%m-%d'))
                
                # Gap after existing data
                if existing_end < end_date:
                    gap_start = existing_end + timedelta(days=1)
                    chunks_to_fetch.extend(self._chunk_date_range(gap_start, end_date, self.batch_size_days))
                    logger.info("Need to fetch recent gap: %s to %s", 
                               gap_start.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
                
                total_chunks_needed = len(chunks_to_fetch)
                
                if total_chunks_needed == 0:
                    logger.info("Data is complete and up to date for %s", indicator)
                    return True
                    
            else:
                # No existing data - fetch everything
                chunks_to_fetch = self._chunk_date_range(start_date, end_date, self.batch_size_days)
                total_chunks_needed = len(chunks_to_fetch)
                logger.info("No existing data - fetching complete history")
            
            logger.info("Total chunks to process: %d", total_chunks_needed)
            
            # Process chunks with progress tracking
            successful_chunks = 0
            for i, (chunk_start, chunk_end) in enumerate(chunks_to_fetch, 1):
                logger.info("Processing chunk %d/%d", i, total_chunks_needed)
                
                retry_count = 0
                while retry_count < self.max_retries:
                    # All indicators are now FRED-based
                    success = self._fetch_fred_data_chunk(indicator, config, chunk_start, chunk_end)
                    
                    if success:
                        successful_chunks += 1
                        break
                    else:
                        retry_count += 1
                        if retry_count < self.max_retries:
                            logger.warning("Retrying chunk %d/%d (attempt %d/%d)", 
                                         i, total_chunks_needed, retry_count + 1, self.max_retries)
                            time.sleep(self.retry_delay)
                        else:
                            logger.error("Failed to fetch chunk %d/%d after %d retries", 
                                       i, total_chunks_needed, self.max_retries)
                
                # Rate limiting
                if i < total_chunks_needed:  # Don't delay after last chunk
                    time.sleep(self.api_delay)
            
            # Summary
            success_rate = (successful_chunks / total_chunks_needed) * 100 if total_chunks_needed > 0 else 100
            logger.info("Completed %s: %d/%d chunks successful (%.1f%%)", 
                       indicator, successful_chunks, total_chunks_needed, success_rate)
            
            return successful_chunks == total_chunks_needed
            
        except Exception as e:
            logger.error("Error fetching %s: %s", indicator, e)
            return False
    
    def get_data_summary(self) -> Dict[str, Any]:
        """Get summary of data in the collection."""
        try:
            summary = {}
            
            for indicator in self.indicators.keys():
                count = self.collection.count_documents({'indicator': indicator})
                
                if count > 0:
                    # Get date range
                    earliest = self.collection.find_one(
                        {'indicator': indicator},
                        sort=[('date', 1)]
                    )
                    latest = self.collection.find_one(
                        {'indicator': indicator},
                        sort=[('date', -1)]
                    )
                    
                    summary[indicator] = {
                        'count': count,
                        'earliest_date': earliest['date'] if earliest else None,
                        'latest_date': latest['date'] if latest else None,
                        'latest_value': latest['value'] if latest else None
                    }
                else:
                    summary[indicator] = {
                        'count': 0,
                        'earliest_date': None,
                        'latest_date': None,
                        'latest_value': None
                    }
            
            return summary
            
        except Exception as e:
            logger.error("Error generating data summary: %s", e)
            return {}
    
    def fetch_all_indicators(self) -> bool:
        """Fetch all systemic risk indicators."""
        logger.info("Starting FRED System Risk Data Fetch")
        logger.info("Indicators to process: %d", len(self.indicators))
        logger.info("Collection: %s.%s", self.db.name, self.collection_name)
        logger.info("API delay: %s seconds", self.api_delay)
        logger.info("Batch size: %d days", self.batch_size_days)
        logger.info("=" * 80)
        
        start_time = datetime.now()
        successful_indicators = 0
        
        for i, (indicator, config) in enumerate(self.indicators.items(), 1):
            logger.info("Processing indicator %d/%d: %s", i, len(self.indicators), indicator)
            
            if self._fetch_indicator_data(indicator, config):
                successful_indicators += 1
                logger.info("Successfully processed %s", indicator)
            else:
                logger.error("Failed to process %s", indicator)
            
            # Delay between indicators
            if i < len(self.indicators):
                time.sleep(self.api_delay * 2)  # Longer delay between indicators
        
        # Final summary
        end_time = datetime.now()
        duration = end_time - start_time
        success_rate = (successful_indicators / len(self.indicators)) * 100
        
        logger.info("=" * 80)
        logger.info("FETCH COMPLETED")
        logger.info("Successful indicators: %d/%d (%.1f%%)", 
                   successful_indicators, len(self.indicators), success_rate)
        logger.info("Total duration: %s", str(duration).split('.')[0])
        logger.info("Database: %s.%s", self.db.name, self.collection_name)
        
        # Print data summary
        summary = self.get_data_summary()
        logger.info("DATA SUMMARY:")
        for indicator, stats in summary.items():
            if stats['count'] > 0:
                logger.info("   %s: %d records (%s to %s, latest: %.4f)", 
                           indicator, stats['count'], 
                           stats['earliest_date'], stats['latest_date'], stats['latest_value'])
            else:
                logger.info("   %s: No data", indicator)
        
        return successful_indicators == len(self.indicators)

def main():
    """Main entry point."""
    try:
        fetcher = SystemRiskFetcher()
        success = fetcher.fetch_all_indicators()
        
        if success:
            print("\nAll systemic risk data fetched successfully!")
            print("You can now use this data in your SP500 Dashboard.")
        else:
            print("\nSome indicators failed to fetch. Check the logs for details.")
            
    except Exception as e:
        print(f"\nError: {e}")
        logger.error("Fatal error: %s", e)

if __name__ == "__main__":
    main()
