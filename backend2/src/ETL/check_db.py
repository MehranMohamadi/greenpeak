#!/usr/bin/env python3
"""
Database status checker for ETL pipeline
"""

from etl_config import setup_etl_environment

def main():
    logger, db = setup_etl_environment('db_check')
    
    if db is None:
        logger.error("Failed to connect to database")
        return
    
    try:
        collections = db.list_collection_names()
        print(f"Collections: {collections}")
        print("\nDocument counts:")
        
        total_docs = 0
        for name in collections:
            count = db[name].count_documents({})
            print(f"  {name}: {count}")
            total_docs += count
        
        print(f"\nTotal documents across all collections: {total_docs}")
        
        # Check which collections have recent data
        print("\nRecent data check:")
        for name in collections:
            try:
                latest = db[name].find_one(
                    {}, 
                    sort=[("date", -1)]
                )
                if latest and "date" in latest:
                    print(f"  {name}: Latest date = {latest['date']}")
                else:
                    print(f"  {name}: No date field found")
            except Exception as e:
                print(f"  {name}: Error checking dates - {e}")
                
    except Exception as e:
        logger.error(f"Error checking database: {e}")

if __name__ == "__main__":
    main()
