"""
Sector Performance Data Fetcher
Fetches sector performance data from Yahoo Finance using SPDR ETFs.

This script fetches:
1. Technology Sector (XLK) - SPDR Technology ETF
2. Financial Services (XLF) - SPDR Financial ETF  
3. Healthcare (XLV) - SPDR Healthcare ETF
4. Energy Sector (XLE) - SPDR Energy ETF
5. Utilities (XLU) - SPDR Utilities ETF
6. Consumer Discretionary (XLY) - SPDR Consumer Discretionary ETF
7. Consumer Staples (XLP) - SPDR Consumer Staples ETF
8. Industrials (XLI) - SPDR Industrial ETF
9. Materials (XLB) - SPDR Materials ETF
10. Real Estate (XLRE) - SPDR Real Estate ETF
11. Communication Services (XLC) - SPDR Communication Services ETF

Calculates relative performance and sector rotation signals.
Run: python sector_performance_fetcher.py
"""

import logging
import os
from datetime import datetime, timedelta, UTC
from typing import Dict, Any, Tuple, Optional
import pandas as pd
from pymongo import UpdateOne, ASCENDING
from pymongo.errors import BulkWriteError

# Import ETL common configuration with yfinance curl_cffi support
from etl_config import setup_etl_environment, create_ticker, download_data

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('sector_performance_fetcher.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SectorPerformanceFetcher:
    """Fetches sector performance data from Yahoo Finance using SPDR ETFs."""
    
    def __init__(self):
        """Initialize the fetcher with configuration."""
        # Setup environment using common configuration
        self.logger, self.db = setup_etl_environment('sector_performance_fetcher')
        
        # Store logger reference for convenience
        global logger
        logger = self.logger
        
        # Get MongoDB client from database reference
        if self.db is not None:
            self.mongo_client = self.db.client
        else:
            raise Exception("MongoDB connection failed")
        
        # Test connections
        self._test_connections()
        
        # S&P 500 Sector ETFs
        self.sector_etfs = {
            'technology': {
                'symbol': 'XLK',
                'name': 'Technology Sector',
                'full_name': 'SPDR Technology Select Sector ETF',
                'description': 'Technology sector performance via XLK ETF'
            },
            'financials': {
                'symbol': 'XLF',
                'name': 'Financial Services',
                'full_name': 'SPDR Financial Select Sector ETF',
                'description': 'Financial services sector performance via XLF ETF'
            },
            'healthcare': {
                'symbol': 'XLV',
                'name': 'Healthcare Sector',
                'full_name': 'SPDR Health Care Select Sector ETF',
                'description': 'Healthcare sector performance via XLV ETF'
            },
            'energy': {
                'symbol': 'XLE',
                'name': 'Energy Sector',
                'full_name': 'SPDR Energy Select Sector ETF',
                'description': 'Energy sector performance via XLE ETF'
            },
            'utilities': {
                'symbol': 'XLU',
                'name': 'Utilities Sector',
                'full_name': 'SPDR Utilities Select Sector ETF',
                'description': 'Utilities sector performance via XLU ETF'
            },
            'consumer_discretionary': {
                'symbol': 'XLY',
                'name': 'Consumer Discretionary',
                'full_name': 'SPDR Consumer Discretionary Select Sector ETF',
                'description': 'Consumer discretionary sector performance via XLY ETF'
            },
            'consumer_staples': {
                'symbol': 'XLP',
                'name': 'Consumer Staples',
                'full_name': 'SPDR Consumer Staples Select Sector ETF',
                'description': 'Consumer staples sector performance via XLP ETF'
            },
            'industrials': {
                'symbol': 'XLI',
                'name': 'Industrials Sector',
                'full_name': 'SPDR Industrial Select Sector ETF',
                'description': 'Industrials sector performance via XLI ETF'
            },
            'materials': {
                'symbol': 'XLB',
                'name': 'Materials Sector',
                'full_name': 'SPDR Materials Select Sector ETF',
                'description': 'Materials sector performance via XLB ETF'
            },
            'real_estate': {
                'symbol': 'XLRE',
                'name': 'Real Estate Sector',
                'full_name': 'SPDR Real Estate Select Sector ETF',
                'description': 'Real estate sector performance via XLRE ETF'
            },
            'communication_services': {
                'symbol': 'XLC',
                'name': 'Communication Services',
                'full_name': 'SPDR Communication Services Select Sector ETF',
                'description': 'Communication services sector performance via XLC ETF'
            }
        }
        
        # Performance metrics to calculate
        self.performance_metrics = {
            'price_performance': {
                'name': 'Sector Price Performance',
                'frequency': 'Daily',
                'unit': 'Index Value',
                'description': 'Daily closing prices for sector ETFs'
            },
            'relative_performance': {
                'name': 'Sector Relative Performance',
                'frequency': 'Daily',
                'unit': 'Percent',
                'description': 'Performance relative to S&P 500 benchmark'
            },
            'momentum_score': {
                'name': 'Sector Momentum Score',
                'frequency': 'Daily',
                'unit': 'Score',
                'description': 'Combined momentum score based on multiple timeframes'
            },
            'sector_rotation_signal': {
                'name': 'Sector Rotation Signal',
                'frequency': 'Daily',
                'unit': 'Signal',
                'description': 'Sector rotation strength signal (Strong Buy/Buy/Hold/Sell/Strong Sell)'
            }
        }
        
        # API rate limiting
        self.api_delay = 0.2
        self.max_retries = 3
        self.retry_delay = 5
        
        # Setup collection
        self.collection_name = 'sector_performance'
        self.collection = self.db[self.collection_name]
        self._setup_collection()
    
    def _test_connections(self):
        """Test MongoDB connection."""
        try:
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
            # Create compound unique index on sector, metric, and date
            try:
                self.collection.create_index([
                    ("sector", ASCENDING),
                    ("metric", ASCENDING),
                    ("date", ASCENDING)
                ], unique=True, background=True, name="sector_metric_date_unique")
                logger.info("Created unique index: sector_metric_date_unique")
            except Exception as e:
                if "already exists" not in str(e):
                    raise e
                logger.info("Index already exists: sector_metric_date_unique")
            
            # Create individual indexes
            for field, index_name in [
                ("sector", "sector_idx"),
                ("metric", "metric_idx"),
                ("date", "date_idx"), 
                ("updated_at", "updated_at_idx")
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
    
    def _fetch_sector_price_data(self, start_date: str = '2020-01-01') -> Dict[str, pd.DataFrame]:
        """Fetch price data for all sector ETFs."""
        try:
            logger.info("Fetching price data for %d sector ETFs", len(self.sector_etfs))
            
            # Get all symbols
            symbols = [config['symbol'] for config in self.sector_etfs.values()]
            symbols.append('SPY')  # Add S&P 500 benchmark
            
            # Download data for all symbols at once
            data = download_data(symbols, start=start_date, progress=False)
            
            if data.empty:
                logger.error("No price data retrieved for sector ETFs")
                return {}
            
            # Handle single vs multiple symbol data structure
            sector_data = {}
            
            if len(symbols) == 1:
                # Single symbol case
                symbol = symbols[0]
                if 'Adj Close' in data.columns:
                    prices = data['Adj Close'].dropna()
                else:
                    prices = data['Close'].dropna()
                    
                # Find which sector this symbol belongs to
                for sector, config in self.sector_etfs.items():
                    if config['symbol'] == symbol:
                        sector_data[sector] = prices
                        break
            else:
                # Multiple symbols case
                if 'Adj Close' in data.columns:
                    adj_close = data['Adj Close']
                elif isinstance(data.columns, pd.MultiIndex):
                    # Multi-level columns (symbol, metric)
                    adj_close_data = {}
                    for symbol in symbols:
                        try:
                            if ('Adj Close', symbol) in data.columns:
                                adj_close_data[symbol] = data[('Adj Close', symbol)]
                            elif ('Close', symbol) in data.columns:
                                adj_close_data[symbol] = data[('Close', symbol)]
                        except KeyError:
                            logger.warning("No price data for symbol: %s", symbol)
                            continue
                    adj_close = pd.DataFrame(adj_close_data)
                else:
                    # Fallback - try to use Close if Adj Close not available
                    adj_close = data['Close'] if 'Close' in data.columns else data
                
                # Convert to individual DataFrames
                for sector, config in self.sector_etfs.items():
                    symbol = config['symbol']
                    if symbol in adj_close.columns:
                        sector_data[sector] = adj_close[symbol].dropna()
                        logger.info("Retrieved %d price points for %s (%s)", 
                                   len(sector_data[sector]), sector, symbol)
                    else:
                        logger.warning("No data for %s (%s)", sector, symbol)
                
                # Add SPY benchmark
                if 'SPY' in adj_close.columns:
                    sector_data['spy_benchmark'] = adj_close['SPY'].dropna()
                    logger.info("Retrieved %d price points for SPY benchmark", 
                               len(sector_data['spy_benchmark']))
            
            return sector_data
            
        except Exception as e:
            logger.error("Error fetching sector price data: %s", e)
            return {}
    
    def _calculate_relative_performance(self, sector_data: Dict[str, pd.Series], 
                                       benchmark_data: pd.Series) -> Dict[str, pd.Series]:
        """Calculate relative performance vs S&P 500."""
        try:
            relative_performance = {}
            
            for sector, prices in sector_data.items():
                if sector == 'spy_benchmark':
                    continue
                    
                # Align dates between sector and benchmark
                common_dates = prices.index.intersection(benchmark_data.index)
                if len(common_dates) == 0:
                    logger.warning("No common dates for %s and benchmark", sector)
                    continue
                
                sector_aligned = prices.loc[common_dates]
                benchmark_aligned = benchmark_data.loc[common_dates]
                
                # Calculate daily returns
                sector_returns = sector_aligned.pct_change()
                benchmark_returns = benchmark_aligned.pct_change()
                
                # Calculate cumulative relative performance
                relative_returns = sector_returns - benchmark_returns
                cumulative_relative = (1 + relative_returns).cumprod() - 1
                
                relative_performance[sector] = cumulative_relative * 100  # Convert to percentage
                
                logger.info("Calculated relative performance for %s: %.2f%% latest", 
                           sector, cumulative_relative.iloc[-1] * 100)
            
            return relative_performance
            
        except Exception as e:
            logger.error("Error calculating relative performance: %s", e)
            return {}
    
    def _calculate_momentum_scores(self, sector_data: Dict[str, pd.Series]) -> Dict[str, pd.Series]:
        """Calculate momentum scores for each sector."""
        try:
            momentum_scores = {}
            
            for sector, prices in sector_data.items():
                if sector == 'spy_benchmark':
                    continue
                
                # Calculate multiple timeframe momentum
                momentum_data = []
                
                for i, price in enumerate(prices):
                    # Calculate momentum for different periods
                    momentum_components = []
                    
                    # 1-month momentum (20 trading days)
                    if i >= 20:
                        month_return = (price / prices.iloc[i-20]) - 1
                        momentum_components.append(month_return * 0.2)  # 20% weight
                    
                    # 3-month momentum (60 trading days)
                    if i >= 60:
                        quarter_return = (price / prices.iloc[i-60]) - 1
                        momentum_components.append(quarter_return * 0.3)  # 30% weight
                    
                    # 6-month momentum (120 trading days)
                    if i >= 120:
                        half_year_return = (price / prices.iloc[i-120]) - 1
                        momentum_components.append(half_year_return * 0.3)  # 30% weight
                    
                    # 1-year momentum (250 trading days)
                    if i >= 250:
                        year_return = (price / prices.iloc[i-250]) - 1
                        momentum_components.append(year_return * 0.2)  # 20% weight
                    
                    # Combined momentum score
                    if momentum_components:
                        momentum_score = sum(momentum_components)
                        # Normalize to 0-100 scale
                        normalized_score = max(0, min(100, (momentum_score + 1) * 50))
                        momentum_data.append(normalized_score)
                    else:
                        momentum_data.append(50)  # Neutral score
                
                momentum_scores[sector] = pd.Series(momentum_data, index=prices.index)
                
                logger.info("Calculated momentum scores for %s: %.2f latest", 
                           sector, momentum_data[-1] if momentum_data else 0)
            
            return momentum_scores
            
        except Exception as e:
            logger.error("Error calculating momentum scores: %s", e)
            return {}
    
    def _generate_rotation_signals(self, momentum_scores: Dict[str, pd.Series], 
                                  relative_performance: Dict[str, pd.Series]) -> Dict[str, pd.Series]:
        """Generate sector rotation signals."""
        try:
            rotation_signals = {}
            
            # Get all common dates
            all_dates = set()
            for series in momentum_scores.values():
                all_dates.update(series.index)
            for series in relative_performance.values():
                all_dates.update(series.index)
            
            common_dates = sorted(list(all_dates))
            
            for sector in momentum_scores.keys():
                if sector not in relative_performance:
                    continue
                    
                signals = []
                momentum_series = momentum_scores[sector]
                rel_perf_series = relative_performance[sector]
                
                for date in common_dates:
                    # Get momentum and relative performance for this date
                    momentum = momentum_series.get(date, 50)  # Default neutral
                    rel_perf = rel_perf_series.get(date, 0)   # Default neutral
                    
                    # Generate signal based on momentum and relative performance
                    signal_score = 0
                    
                    # Momentum component (0-40 points)
                    if momentum > 70:
                        signal_score += 40
                    elif momentum > 60:
                        signal_score += 30
                    elif momentum > 50:
                        signal_score += 20
                    elif momentum > 40:
                        signal_score += 10
                    else:
                        signal_score += 0
                    
                    # Relative performance component (0-40 points)
                    if rel_perf > 10:
                        signal_score += 40
                    elif rel_perf > 5:
                        signal_score += 30
                    elif rel_perf > 0:
                        signal_score += 20
                    elif rel_perf > -5:
                        signal_score += 10
                    else:
                        signal_score += 0
                    
                    # Technical momentum (0-20 points)
                    # Simple trend check - is recent performance improving?
                    if len(signals) >= 5:
                        recent_trend = sum(signals[-5:]) / 5
                        if momentum > recent_trend:
                            signal_score += 20
                        elif momentum > recent_trend - 5:
                            signal_score += 10
                    else:
                        signal_score += 10  # Neutral for early data
                    
                    # Convert to signal strength (0-100)
                    signals.append(signal_score)
                
                rotation_signals[sector] = pd.Series(signals, index=common_dates)
                
                logger.info("Generated rotation signals for %s: %.0f latest", 
                           sector, signals[-1] if signals else 0)
            
            return rotation_signals
            
        except Exception as e:
            logger.error("Error generating rotation signals: %s", e)
            return {}
    
    def _save_sector_data(self, data_type: str, sector_data: Dict[str, pd.Series], 
                         metric_config: Dict[str, Any]) -> bool:
        """Save sector data to MongoDB."""
        try:
            documents = []
            today = datetime.now().strftime('%Y-%m-%d')
            
            for sector, series in sector_data.items():
                sector_config = self.sector_etfs.get(sector, {})
                
                for date, value in series.items():
                    date_str = date.strftime('%Y-%m-%d')
                    
                    # Skip future dates
                    if date_str > today:
                        continue
                    
                    doc = {
                        'date': date_str,
                        'sector': sector,
                        'metric': data_type,
                        'value': float(value),
                        'updated_at': datetime.now(UTC),
                        'metadata': {
                            'name': metric_config['name'],
                            'frequency': metric_config['frequency'],
                            'unit': metric_config['unit'],
                            'description': metric_config['description'],
                            'source': 'Yahoo Finance',
                            'symbol': sector_config.get('symbol', 'N/A'),
                            'sector_name': sector_config.get('name', sector),
                            'etf_name': sector_config.get('full_name', 'N/A')
                        }
                    }
                    documents.append(doc)
            
            if not documents:
                logger.warning("No documents to save for %s", data_type)
                return False
            
            # Bulk upsert documents
            operations = []
            for doc in documents:
                filter_query = {
                    'date': doc['date'],
                    'sector': doc['sector'],
                    'metric': doc['metric']
                }
                operations.append(UpdateOne(filter_query, {'$set': doc}, upsert=True))
            
            if operations:
                try:
                    result = self.collection.bulk_write(operations, ordered=False)
                    upserted_count = result.upserted_count + result.modified_count
                    logger.info("✅ Saved %d records for %s (%d new/updated)", 
                               len(documents), data_type, upserted_count)
                    return True
                    
                except BulkWriteError as bwe:
                    logger.warning("Some duplicate records for %s: %d errors", 
                                 data_type, len(bwe.details.get('writeErrors', [])))
                    return True
            
            return False
            
        except Exception as e:
            logger.error("Error saving %s data: %s", data_type, e)
            return False
    
    def _get_existing_date_range(self, metric: str) -> Tuple[Optional[datetime], Optional[datetime]]:
        """Get the date range of existing data for a metric."""
        try:
            earliest = self.collection.find_one(
                {"metric": metric},
                sort=[("date", 1)]
            )
            
            latest = self.collection.find_one(
                {"metric": metric},
                sort=[("date", -1)]
            )
            
            if earliest and latest:
                earliest_date = datetime.strptime(earliest["date"], "%Y-%m-%d")
                latest_date = datetime.strptime(latest["date"], "%Y-%m-%d")
                return earliest_date, latest_date
            else:
                return None, None
                
        except Exception as e:
            logger.error("Error getting existing date range for %s: %s", metric, e)
            return None, None
    
    def fetch_all_sector_data(self) -> bool:
        """Fetch all sector performance data."""
        logger.info("🚀 Starting Sector Performance Data Fetch")
        logger.info("📊 Sectors to process: %d", len(self.sector_etfs))
        logger.info("📈 Metrics to calculate: %d", len(self.performance_metrics))
        logger.info("🗂️  Collection: %s.%s", self.mongodb_database, self.collection_name)
        logger.info("=" * 80)
        
        start_time = datetime.now()
        successful_metrics = 0
        
        try:
            # Check if we need to update data
            existing_start, existing_end = self._get_existing_date_range('price_performance')
            
            if existing_start and existing_end:
                days_since_update = (datetime.now() - existing_end).days
                if days_since_update < 1:
                    logger.info("✅ Sector data is up to date (last update: %d days ago)", 
                               days_since_update)
                    return True
                else:
                    logger.info("📥 Updating sector data (last update: %d days ago)", 
                               days_since_update)
                    # Use last known date as start for incremental update
                    start_date = (existing_end - timedelta(days=30)).strftime('%Y-%m-%d')
            else:
                logger.info("📥 No existing data - fetching complete history")
                start_date = '2020-01-01'
            
            # Step 1: Fetch raw price data
            logger.info("📊 Step 1: Fetching sector price data")
            sector_price_data = self._fetch_sector_price_data(start_date)
            
            if not sector_price_data:
                logger.error("❌ Failed to fetch sector price data")
                return False
            
            # Extract benchmark data
            spy_benchmark = sector_price_data.pop('spy_benchmark', None)
            if spy_benchmark is None:
                logger.error("❌ No SPY benchmark data available")
                return False
            
            # Step 2: Save price performance data
            logger.info("📊 Step 2: Saving price performance data")
            if self._save_sector_data('price_performance', sector_price_data, 
                                    self.performance_metrics['price_performance']):
                successful_metrics += 1
            
            # Step 3: Calculate and save relative performance
            logger.info("📊 Step 3: Calculating relative performance")
            relative_performance = self._calculate_relative_performance(sector_price_data, spy_benchmark)
            
            if relative_performance:
                if self._save_sector_data('relative_performance', relative_performance,
                                        self.performance_metrics['relative_performance']):
                    successful_metrics += 1
            
            # Step 4: Calculate and save momentum scores
            logger.info("📊 Step 4: Calculating momentum scores")
            momentum_scores = self._calculate_momentum_scores(sector_price_data)
            
            if momentum_scores:
                if self._save_sector_data('momentum_score', momentum_scores,
                                        self.performance_metrics['momentum_score']):
                    successful_metrics += 1
            
            # Step 5: Generate and save rotation signals
            logger.info("📊 Step 5: Generating rotation signals")
            rotation_signals = self._generate_rotation_signals(momentum_scores, relative_performance)
            
            if rotation_signals:
                if self._save_sector_data('sector_rotation_signal', rotation_signals,
                                        self.performance_metrics['sector_rotation_signal']):
                    successful_metrics += 1
            
        except Exception as e:
            logger.error("❌ Error in sector data fetch: %s", e)
        
        # Final summary
        end_time = datetime.now()
        duration = end_time - start_time
        success_rate = (successful_metrics / len(self.performance_metrics)) * 100
        
        logger.info("=" * 80)
        logger.info("🎯 FETCH COMPLETED")
        logger.info("✅ Successful metrics: %d/%d (%.1f%%)", 
                   successful_metrics, len(self.performance_metrics), success_rate)
        logger.info("⏱️  Total duration: %s", str(duration).split('.')[0])
        logger.info("💾 Database: %s.%s", self.mongodb_database, self.collection_name)
        
        # Print data summary
        self._print_data_summary()
        
        return successful_metrics == len(self.performance_metrics)
    
    def _print_data_summary(self):
        """Print summary of sector performance data."""
        try:
            logger.info("📊 SECTOR PERFORMANCE DATA SUMMARY:")
            
            for metric in self.performance_metrics.keys():
                count = self.collection.count_documents({'metric': metric})
                
                if count > 0:
                    # Get sample data by sector
                    sectors_with_data = self.collection.distinct('sector', {'metric': metric})
                    
                    latest_sample = self.collection.find_one(
                        {'metric': metric},
                        sort=[('date', -1)]
                    )
                    
                    earliest_sample = self.collection.find_one(
                        {'metric': metric},
                        sort=[('date', 1)]
                    )
                    
                    logger.info("   %s: %d records across %d sectors", 
                               metric, count, len(sectors_with_data))
                    
                    if latest_sample and earliest_sample:
                        logger.info("     Range: %s to %s", 
                                   earliest_sample['date'], latest_sample['date'])
                        logger.info("     Latest (%s): %.4f", 
                                   latest_sample['sector'], latest_sample['value'])
                else:
                    logger.info("   %s: No data", metric)
            
        except Exception as e:
            logger.error("Error generating summary: %s", e)

def main():
    """Main entry point."""
    try:
        fetcher = SectorPerformanceFetcher()
        success = fetcher.fetch_all_sector_data()
        
        if success:
            print("\n🎉 All sector performance data fetched successfully!")
            print("💡 You can now use this data in your SP500 Dashboard.")
        else:
            print("\n⚠️ Some metrics failed to fetch. Check the logs for details.")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        logger.error("Fatal error: %s", e)

if __name__ == "__main__":
    main()
