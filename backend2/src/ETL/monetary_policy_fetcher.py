"""
FRED Monetary Policy Data Fetcher
Single file to fetch ALL historical data for monetary policy indicators.

This script:
1. Fetches complete historical data from FRED API
2. Uses batch processing to handle API rate limits
3. Automatically creates MongoDB collections and indexes
4. Handles data gaps and missing values
5. Provides progress tracking and error handling

Run: python monetary_policy_fetcher.py
"""

import logging
import time
import os
from datetime import datetime, timedelta, UTC
from typing import Dict, Any, List, Tuple
import pandas as pd
from fredapi import Fred
from pymongo import MongoClient, UpdateOne, ASCENDING
from pymongo.errors import BulkWriteError

# Load environment variables from .env file
def load_env_file():
    """Load environment variables from project root .env file."""
    try:
        # Navigate to project root (4 levels up from ETL folder)
        env_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env')
        env_path = os.path.abspath(env_path)
        
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"')
                    os.environ[key] = value
    except FileNotFoundError:
        print("Warning: .env file not found in project root. Using environment variables.")

# Load environment variables
load_env_file()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('monetary_policy_fetcher.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MonetaryPolicyFetcher:
    """Fetches all historical monetary policy data from FRED."""
    
    def __init__(self):
        """Initialize the fetcher with configuration."""
        # Get configuration from environment
        self.fred_api_key = os.environ.get('FRED_API_KEY', '')
        self.mongodb_url = os.environ.get('MONGODB_URL')
        self.mongodb_database = os.environ.get('MONGODB_DATABASE', 'sp500_dashboard')
        
        if not self.mongodb_url:
            raise ValueError("MONGODB_URL not found in environment variables or .env file")
        
        # Validate configuration
        if not self.fred_api_key:
            raise ValueError("FRED_API_KEY not found in environment variables or .env file")
        
        # Initialize connections
        self.fred = Fred(api_key=self.fred_api_key)
        self.mongo_client = MongoClient(self.mongodb_url)
        self.db = self.mongo_client[self.mongodb_database]
        
        # Test connections
        self._test_connections()
        
        # Monetary Policy Indicators Configuration - Your 5 indicators only
        self.indicators = {
            'ten_year_treasury': {
                'series_id': 'DGS10',
                'name': '10-Year Treasury Constant Maturity Rate',
                'start_date': '1962-01-02',  # Historical start
                'frequency': 'Daily',
                'unit': 'Percent',
                'seasonal_adjustment': 'Not Seasonally Adjusted'
            },
            'federal_funds_rate': {
                'series_id': 'DFF',
                'name': 'Federal Funds Effective Rate',
                'start_date': '1954-07-01',  # Historical start
                'frequency': 'Daily',
                'unit': 'Percent',
                'seasonal_adjustment': 'Not Seasonally Adjusted'
            },
            'fed_balance_sheet': {
                'series_id': 'WALCL',
                'name': 'All Federal Reserve Banks - Total Assets',
                'start_date': '2002-12-18',  # Historical start
                'frequency': 'Weekly',
                'unit': 'Millions of Dollars',
                'seasonal_adjustment': 'Not Seasonally Adjusted'
            },
            'sofr_rate': {
                'series_id': 'SOFR',
                'name': 'Secured Overnight Financing Rate',
                'start_date': '2018-04-03',  # SOFR inception
                'frequency': 'Daily',
                'unit': 'Percent',
                'seasonal_adjustment': 'Not Seasonally Adjusted'
            },
            'real_interest_rate': {
                'series_id': 'REAINTRATREARAT10Y',
                'name': '10-Year Real Interest Rate',
                'start_date': '2003-01-02',  # Historical start
                'frequency': 'Daily',
                'unit': 'Percent',
                'seasonal_adjustment': 'Not Seasonally Adjusted'
            }
        }
        
        # API rate limiting configuration
        self.api_delay = 0.3  # 300ms between requests (FRED allows 120 requests/minute)
        self.batch_size_days = 5475  # Fetch 15 years at a time - FRED allows large date ranges
        self.max_retries = 3
        self.retry_delay = 5  # 5 seconds between retries
        
        # Setup collection
        self.collection_name = 'monetary_policy'
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
                ("fred_series_id", "series_id_idx")
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
    
    def _get_existing_date_range(self, indicator: str) -> Tuple[datetime, datetime]:
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
    
    def _fetch_data_chunk(self, indicator: str, config: Dict[str, Any], start_date: datetime, end_date: datetime) -> bool:
        """Fetch data for a specific date range chunk."""
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
                    'fred_series_id': series_id,
                    'updated_at': datetime.now(UTC),
                    'metadata': {
                        'name': config['name'],
                        'frequency': config['frequency'],
                        'unit': config['unit'],
                        'seasonal_adjustment': config['seasonal_adjustment'],
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
            logger.error("❌ Error fetching data chunk for %s: %s", indicator, e)
            return False
    
    def _fetch_indicator_data(self, indicator: str, config: Dict[str, Any]) -> bool:
        """Fetch all historical data for a single indicator."""
        logger.info("=" * 60)
        logger.info("Starting data fetch for: %s", config['name'])
        logger.info("FRED Series ID: %s", config['series_id'])
        
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
                    logger.info("📥 Need to fetch historical gap: %s to %s", 
                               start_date.strftime('%Y-%m-%d'), gap_end.strftime('%Y-%m-%d'))
                
                # Gap after existing data
                if existing_end < end_date:
                    gap_start = existing_end + timedelta(days=1)
                    chunks_to_fetch.extend(self._chunk_date_range(gap_start, end_date, self.batch_size_days))
                    logger.info("📥 Need to fetch recent gap: %s to %s", 
                               gap_start.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
                
                total_chunks_needed = len(chunks_to_fetch)
                
                if total_chunks_needed == 0:
                    logger.info("✅ %s data is complete and up to date", indicator)
                    return True
                    
            else:
                # No existing data - fetch everything
                chunks_to_fetch = self._chunk_date_range(start_date, end_date, self.batch_size_days)
                total_chunks_needed = len(chunks_to_fetch)
                logger.info("📥 No existing data - fetching complete history")
            
            logger.info("📦 Total chunks to process: %d", total_chunks_needed)
            
            # Process chunks with progress tracking
            successful_chunks = 0
            for i, (chunk_start, chunk_end) in enumerate(chunks_to_fetch, 1):
                logger.info("🔄 Processing chunk %d/%d", i, total_chunks_needed)
                
                retry_count = 0
                while retry_count < self.max_retries:
                    if self._fetch_data_chunk(indicator, config, chunk_start, chunk_end):
                        successful_chunks += 1
                        break
                    else:
                        retry_count += 1
                        if retry_count < self.max_retries:
                            logger.warning("⚠️ Retrying chunk %d/%d (attempt %d/%d)", 
                                         i, total_chunks_needed, retry_count + 1, self.max_retries)
                            time.sleep(self.retry_delay)
                        else:
                            logger.error("❌ Failed to fetch chunk %d/%d after %d retries", 
                                       i, total_chunks_needed, self.max_retries)
                
                # Rate limiting
                if i < total_chunks_needed:  # Don't delay after last chunk
                    time.sleep(self.api_delay)
            
            # Summary
            success_rate = (successful_chunks / total_chunks_needed) * 100 if total_chunks_needed > 0 else 100
            logger.info("✅ Completed %s: %d/%d chunks successful (%.1f%%)", 
                       indicator, successful_chunks, total_chunks_needed, success_rate)
            
            return successful_chunks == total_chunks_needed
            
        except Exception as e:
            logger.error("❌ Error fetching %s: %s", indicator, e)
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
        """Fetch all monetary policy indicators."""
        logger.info("🚀 Starting FRED Monetary Policy Data Fetch")
        logger.info("📊 Indicators to process: %d", len(self.indicators))
        logger.info("🗂️  Collection: %s.%s", self.mongodb_database, self.collection_name)
        logger.info("⏱️  API delay: %s seconds", self.api_delay)
        logger.info("📦 Batch size: %d days", self.batch_size_days)
        logger.info("=" * 80)
        
        start_time = datetime.now()
        successful_indicators = 0
        
        for i, (indicator, config) in enumerate(self.indicators.items(), 1):
            logger.info("📊 Processing indicator %d/%d: %s", i, len(self.indicators), indicator)
            
            if self._fetch_indicator_data(indicator, config):
                successful_indicators += 1
                logger.info("✅ Successfully processed %s", indicator)
            else:
                logger.error("❌ Failed to process %s", indicator)
            
            # Delay between indicators
            if i < len(self.indicators):
                time.sleep(self.api_delay * 2)  # Longer delay between indicators
        
        # Final summary
        end_time = datetime.now()
        duration = end_time - start_time
        success_rate = (successful_indicators / len(self.indicators)) * 100
        
        logger.info("=" * 80)
        logger.info("🎯 FETCH COMPLETED")
        logger.info("✅ Successful indicators: %d/%d (%.1f%%)", 
                   successful_indicators, len(self.indicators), success_rate)
        logger.info("⏱️  Total duration: %s", str(duration).split('.')[0])
        logger.info("💾 Database: %s.%s", self.mongodb_database, self.collection_name)
        
        # Print data summary
        summary = self.get_data_summary()
        logger.info("📊 DATA SUMMARY:")
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
        fetcher = MonetaryPolicyFetcher()
        success = fetcher.fetch_all_indicators()
        
        if success:
            print("\n🎉 All monetary policy data fetched successfully!")
            print("💡 You can now use this data in your SP500 Dashboard.")
        else:
            print("\n⚠️ Some indicators failed to fetch. Check the logs for details.")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        logger.error("Fatal error: %s", e)

if __name__ == "__main__":
    main()
