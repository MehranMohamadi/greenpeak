#!/usr/bin/env python3
"""
FRED Sector Performance Fetcher

Fetches sector performance data from FRED instead of Yahoo Finance.
Uses Federal Reserve economic data for sector indices and performance metrics.

Features:
- FRED sector index data
- Industry production indices
- Sector-specific economic indicators
- No rate limiting issues
- Historical data back to 1970s

Usage:
    python sector_performance_fred.py
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import pandas as pd
from fredapi import Fred
from etl_config import setup_etl_environment
import os

class SectorPerformanceFredFetcher:
    """Fetches sector performance data from FRED API."""
    
    def __init__(self):
        """Initialize the fetcher."""
        self.logger, self.db = setup_etl_environment('sector_performance_fred')
        
        if self.db is None:
            raise Exception("MongoDB connection failed")
        
        self.collection = self.db['sector_performance']
        
        # Get FRED API key
        self.fred_api_key = os.environ.get('FRED_API_KEY', '')
        if not self.fred_api_key:
            raise ValueError("FRED_API_KEY not found in environment variables")
        
        # Initialize FRED API
        self.fred = Fred(api_key=self.fred_api_key)
        
        # FRED sector and industry indicators
        self.sector_indicators = {
            'technology': {
                'series_id': 'NASDAQCOM',
                'name': 'NASDAQ Composite Index',
                'description': 'Technology-heavy composite index',
                'unit': 'Index',
                'frequency': 'Daily'
            },
            'industrial_production': {
                'series_id': 'INDPRO',
                'name': 'Industrial Production Index',
                'description': 'Total Industrial Production',
                'unit': 'Index 2017=100',
                'frequency': 'Monthly'
            },
            'manufacturing': {
                'series_id': 'CAPUTLMFGM',
                'name': 'Capacity Utilization: Manufacturing',
                'description': 'Manufacturing capacity utilization',
                'unit': 'Percent',
                'frequency': 'Monthly'
            },
            'energy_production': {
                'series_id': 'IPG211111CS',
                'name': 'Industrial Production: Crude Oil',
                'description': 'Crude oil production index',
                'unit': 'Index 2017=100',
                'frequency': 'Monthly'
            },
            'retail_sales': {
                'series_id': 'RSAFS',
                'name': 'Advance Retail Sales',
                'description': 'Retail and Food Services Sales',
                'unit': 'Millions of Dollars',
                'frequency': 'Monthly'
            },
            'housing_starts': {
                'series_id': 'HOUST',
                'name': 'Housing Starts',
                'description': 'Total Housing Starts',
                'unit': 'Thousands of Units',
                'frequency': 'Monthly'
            },
            'financial_sector': {
                'series_id': 'NCBCMDPMVCE',
                'name': 'Nonfinancial Corporate Business Credit Market Debt',
                'description': 'Corporate debt outstanding',
                'unit': 'Millions of Dollars',
                'frequency': 'Quarterly'
            },
            'healthcare_employment': {
                'series_id': 'CES6562000001',
                'name': 'All Employees: Health Care and Social Assistance',
                'description': 'Healthcare sector employment',
                'unit': 'Thousands of Persons',
                'frequency': 'Monthly'
            },
            'utilities_production': {
                'series_id': 'IPG2211A2N',
                'name': 'Industrial Production: Electric Power Generation',
                'description': 'Electric power generation index',
                'unit': 'Index 2017=100',
                'frequency': 'Monthly'
            },
            'consumer_sentiment': {
                'series_id': 'UMCSENT',
                'name': 'University of Michigan Consumer Sentiment',
                'description': 'Consumer confidence indicator',
                'unit': 'Index 1966:Q1=100',
                'frequency': 'Monthly'
            },
            'transportation': {
                'series_id': 'IPG336111N',
                'name': 'Industrial Production: Motor Vehicles',
                'description': 'Motor vehicle production index',
                'unit': 'Index 2017=100',
                'frequency': 'Monthly'
            },
            'materials_production': {
                'series_id': 'IPG327S',
                'name': 'Industrial Production: Nonmetallic Mineral Products',
                'description': 'Materials and construction materials',
                'unit': 'Index 2017=100',
                'frequency': 'Monthly'
            }
        }
        
        self.logger.info(f"Initialized FRED sector fetcher for {len(self.sector_indicators)} indicators")
    
    def fetch_sector_data(self, sector: str, config: Dict, start_date: str = None) -> List[Dict]:
        """Fetch data for a specific sector indicator."""
        records = []
        
        try:
            series_id = config['series_id']
            
            # Set default start date to 15 years ago
            if not start_date:
                start_date = (datetime.now() - timedelta(days=15*365)).strftime('%Y-%m-%d')
            
            self.logger.info(f"Fetching {sector} data from FRED series {series_id}")
            
            # Fetch data from FRED
            data = self.fred.get_series(
                series_id=series_id,
                start=start_date,
                end=datetime.now().strftime('%Y-%m-%d')
            )
            
            if data.empty:
                self.logger.warning(f"No data returned for {series_id}")
                return records
            
            # Convert to records
            for date, value in data.items():
                if pd.notna(value):
                    record = {
                        'sector': sector,
                        'series_id': series_id,
                        'name': config['name'],
                        'description': config['description'],
                        'date': date.strftime('%Y-%m-%d'),
                        'value': float(value),
                        'unit': config['unit'],
                        'frequency': config['frequency'],
                        'source': 'FRED',
                        'last_updated': datetime.utcnow().isoformat()
                    }
                    records.append(record)
            
            self.logger.info(f"✅ {sector}: {len(records)} records fetched")
            return records
            
        except Exception as e:
            self.logger.error(f"❌ Error fetching {sector}: {e}")
            return records
    
    def store_sector_data(self, records: List[Dict]) -> int:
        """Store sector data in MongoDB."""
        if not records:
            return 0
        
        try:
            # Upsert records to avoid duplicates
            operations = []
            for record in records:
                operations.append({
                    'updateOne': {
                        'filter': {
                            'sector': record['sector'],
                            'date': record['date']
                        },
                        'update': {'$set': record},
                        'upsert': True
                    }
                })
            
            if operations:
                result = self.collection.bulk_write(operations, ordered=False)
                return result.upserted_count + result.modified_count
            
        except Exception as e:
            self.logger.error(f"Error storing data: {e}")
            return 0
        
        return 0
    
    def fetch_all_sectors(self, start_date: str = None) -> Dict[str, int]:
        """Fetch data for all sector indicators."""
        results = {}
        total_records = 0
        start_time = datetime.now()
        
        self.logger.info(f"🚀 Starting FRED sector performance fetch for {len(self.sector_indicators)} indicators")
        
        for i, (sector, config) in enumerate(self.sector_indicators.items(), 1):
            try:
                self.logger.info(f"[{i}/{len(self.sector_indicators)}] Processing {sector}")
                
                # Fetch data
                records = self.fetch_sector_data(sector, config, start_date)
                
                if records:
                    # Store data
                    stored_count = self.store_sector_data(records)
                    results[sector] = stored_count
                    total_records += stored_count
                    self.logger.info(f"✅ {sector}: {stored_count} records stored")
                else:
                    results[sector] = 0
                    self.logger.warning(f"⚠️ {sector}: No data available")
                
                # Small delay between requests
                if i < len(self.sector_indicators):
                    import time
                    time.sleep(0.5)
                    
            except Exception as e:
                self.logger.error(f"❌ Failed to process {sector}: {e}")
                results[sector] = 0
        
        # Summary
        end_time = datetime.now()
        duration = end_time - start_time
        successful_sectors = len([s for s, c in results.items() if c > 0])
        
        self.logger.info("=" * 60)
        self.logger.info("📊 FRED SECTOR PERFORMANCE FETCH SUMMARY")
        self.logger.info("=" * 60)
        self.logger.info(f"Successful sectors: {successful_sectors}/{len(self.sector_indicators)}")
        self.logger.info(f"Total records: {total_records}")
        self.logger.info(f"Duration: {str(duration).split('.')[0]}")
        
        for sector, count in results.items():
            status = "✅" if count > 0 else "❌"
            self.logger.info(f"  {status} {sector}: {count} records")
        
        return results
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of stored data."""
        try:
            total_records = self.collection.count_documents({})
            sectors = self.collection.distinct('sector')
            
            # Get latest data by sector
            latest_data = {}
            for sector in sectors:
                latest = self.collection.find_one(
                    {'sector': sector},
                    sort=[('date', -1)]
                )
                if latest:
                    latest_data[sector] = {
                        'latest_date': latest.get('date'),
                        'value': latest.get('value'),
                        'name': latest.get('name')
                    }
            
            return {
                'total_records': total_records,
                'sectors': len(sectors),
                'sectors_list': sectors,
                'latest_data': latest_data
            }
            
        except Exception as e:
            self.logger.error(f"Error getting summary: {e}")
            return {}


def main():
    """Main execution function."""
    try:
        fetcher = SectorPerformanceFredFetcher()
        
        # Fetch data for last 15 years
        start_date = (datetime.now() - timedelta(days=15*365)).strftime('%Y-%m-%d')
        results = fetcher.fetch_all_sectors(start_date=start_date)
        
        # Print summary
        summary = fetcher.get_summary()
        
        print("\n📈 FINAL SUMMARY")
        print(f"Total records: {summary.get('total_records', 0)}")
        print(f"Sectors: {summary.get('sectors', 0)}")
        
        if summary.get('latest_data'):
            print("\nLatest data by sector:")
            for sector, data in summary['latest_data'].items():
                print(f"  {sector}: {data['latest_date']} - {data['value']:.2f} ({data['name']})")
        
        print("\n✅ FRED sector performance fetch completed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    main()
