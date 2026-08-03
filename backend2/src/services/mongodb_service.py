"""MongoDB service for database operations."""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from ..core.config import get_settings

logger = logging.getLogger(__name__)


class MongoDBService:
    """Service for MongoDB operations."""

    def __init__(self):
        """Initialize MongoDB settings; connect lazily on first database use."""
        self.settings = get_settings()
        self.client: Optional[MongoClient] = None
        self.db: Optional[Database] = None

    def _connect(self):
        """Establish MongoDB connection."""
        try:
            self.client = MongoClient(
                self.settings.mongodb_url,
                serverSelectionTimeoutMS=2000,
                connectTimeoutMS=2000,
            )
            self.db = self.client[self.settings.mongodb_database]
            # Test connection
            self.client.admin.command('ping')
            logger.info(f"Connected to MongoDB: {self.settings.mongodb_database}")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise

    def get_collection(self, collection_name: str) -> Collection:
        """Get a MongoDB collection."""
        if self.db is None:
            self._connect()
        return self.db[collection_name]

    def insert_indicator_data(self, indicator: str, prefix: str, data: List[Dict[str, Any]]) -> bool:
        """
        Insert indicator data into MongoDB.

        Args:
            indicator (str): The indicator name (e.g., 'federal_funds_rate')
            prefix (str): The prefix for the collection name.
            data (List[Dict]): List of data points with date, value, etc.
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            collection = self.get_collection(f"{prefix}_{indicator}")

            # Add metadata to each document
            for item in data:
                item['updated_at'] = datetime.utcnow()
                item['indicator'] = indicator
            
            # Use upsert to avoid duplicates based on date
            for item in data:
                filter_query = {
                    'date': item['date'],
                    'indicator': indicator
                }
                collection.replace_one(filter_query, item, upsert=True)
            
            logger.info(f"Inserted {len(data)} records for {indicator}")
            return True
            
        except Exception as e:
            logger.error(f"Error inserting {indicator} data: {e}")
            return False

    def get_indicator_data(
        self,
        indicator: str,
        prefix: str,
        limit: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve indicator data from MongoDB.

        Args:
            indicator (str): The monetary indicator name
            limit (int): Maximum number of records to return
            start_date (str): Start date filter (YYYY-MM-DD)
            end_date (str): End date filter (YYYY-MM-DD)
            
        Returns:
            List[Dict]: List of data points
        """
        try:
            collection = self.get_collection(f"{prefix}_{indicator}")
            
            # Build query
            query = {'indicator': indicator}
            
            if start_date or end_date:
                date_query = {}
                if start_date:
                    date_query['$gte'] = start_date
                if end_date:
                    date_query['$lte'] = end_date
                query['date'] = date_query
            
            # Execute query with sorting
            cursor = collection.find(query).sort('date', -1)
            
            if limit:
                cursor = cursor.limit(limit)
            
            results = list(cursor)
            
            # Remove MongoDB ObjectId from results
            for result in results:
                result.pop('_id', None)
            
            logger.info(f"Retrieved {len(results)} records for {indicator}")
            return results
            
        except Exception as e:
            logger.error(f"Error retrieving {indicator} data: {e}")
            return []

    def get_latest_indicator_data(self, indicator: str, prefix: str) -> Optional[Dict[str, Any]]:
        """
        Get the latest data point for an indicator.
        
        Args:
            indicator (str): The indicator name

        Returns:
            Dict: Latest data point or None
        """
        try:
            collection = self.get_collection(f"{prefix}_{indicator}")
            
            result = collection.find_one(
                {'indicator': indicator},
                sort=[('date', -1)]
            )
            
            if result:
                result.pop('_id', None)
                return result
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting latest {indicator} data: {e}")
            return None

    def delete_indicator_data(self, indicator: str, prefix: str, before_date: Optional[str] = None) -> int:
        """
        Delete indicator data for cleanup or refresh.

        Args:
            indicator (str): The monetary indicator name
            before_date (str): Optional date to delete data before (YYYY-MM-DD)
            
        Returns:
            int: Number of deleted documents
        """
        try:
            collection = self.get_collection(f"{prefix}_{indicator}")

            query = {'indicator': indicator}
            if before_date:
                query['date'] = {'$lt': before_date}
            
            result = collection.delete_many(query)
            
            logger.info(f"Deleted {result.deleted_count} records for {indicator}")
            return result.deleted_count
            
        except Exception as e:
            logger.error(f"Error deleting {indicator} data: {e}")
            return 0

    def get_collection_stats(self, indicator: str, prefix: str) -> Dict[str, Any]:
        """
        Get statistics about a monetary data collection.
        
        Args:
            indicator (str): The monetary indicator name
            
        Returns:
            Dict: Collection statistics
        """
        try:
            collection = self.get_collection(f"{prefix}_{indicator}")

            total_count = collection.count_documents({'indicator': indicator})
            
            # Get date range
            oldest = collection.find_one(
                {'indicator': indicator},
                sort=[('date', 1)]
            )
            latest = collection.find_one(
                {'indicator': indicator},
                sort=[('date', -1)]
            )
            
            stats = {
                'indicator': indicator,
                'total_records': total_count,
                'oldest_date': oldest['date'] if oldest else None,
                'latest_date': latest['date'] if latest else None,
                'latest_value': latest['value'] if latest else None
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting stats for {indicator}: {e}")
            return {}

    def close(self):
        """Close MongoDB connection."""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")
