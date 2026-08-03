"""
Health Check Script for ETL Handler
Performs comprehensive health checks and reports status.
"""

import sys
from datetime import datetime
from pathlib import Path
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Add the backend source to Python path
sys.path.append(str(Path(__file__).parent.parent))

from src.core.config import get_settings
from src.services.mongodb_service import MongoDBService

def check_mongodb_connection() -> bool:
    """Check MongoDB connection and basic operations."""
    try:
        settings = get_settings()
        client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
        
        # Test connection
        client.admin.command('ping')
        
        # Test database access
        db = client[settings.mongodb_database]
        collections = db.list_collection_names()
        
        print(f"✅ MongoDB: Connected (Database: {settings.mongodb_database})")
        print(f"   Collections: {len(collections)}")
        
        client.close()
        return True
        
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        print(f"❌ MongoDB: Connection failed - {e}")
        return False
    except Exception as e:
        print(f"❌ MongoDB: Error - {e}")
        return False

def check_api_keys() -> bool:
    """Check if required API keys are configured."""
    settings = get_settings()
    issues = []
    
    if not settings.fred_api_key or settings.fred_api_key == "":
        issues.append("FRED API key not configured")
    
    if issues:
        print(f"❌ API Keys: {', '.join(issues)}")
        return False
    else:
        print("✅ API Keys: Configured")
        return True

def check_data_freshness() -> bool:
    """Check if data is being updated regularly."""
    try:
        mongo = MongoDBService()
        
        # Check a few key indicators
        indicators_to_check = [
            ('vix_volatility', 'systemic_risk'),
            ('federal_funds_rate', 'monetary_policy'),
            ('sp500_price', 'corporate_earnings')
        ]
        
        all_fresh = True
        
        for indicator, collection_name in indicators_to_check:
            try:
                collection = mongo.get_collection(collection_name)
                latest = collection.find_one(
                    {"indicator": indicator},
                    sort=[("updated_at", -1)]
                )
                
                if latest:
                    updated_at = latest.get('updated_at')
                    if updated_at:
                        hours_old = (datetime.now() - updated_at).total_seconds() / 3600
                        if hours_old < 24:
                            print(f"✅ {indicator}: Fresh ({hours_old:.1f}h old)")
                        else:
                            print(f"⚠️  {indicator}: Stale ({hours_old:.1f}h old)")
                            all_fresh = False
                    else:
                        print(f"⚠️  {indicator}: No timestamp")
                        all_fresh = False
                else:
                    print(f"❌ {indicator}: No data found")
                    all_fresh = False
                    
            except Exception as e:
                print(f"❌ {indicator}: Error checking - {e}")
                all_fresh = False
        
        return all_fresh
        
    except Exception as e:
        print(f"❌ Data Freshness: Error - {e}")
        return False

def check_service_logs() -> bool:
    """Check service logs for recent errors."""
    try:
        log_files = [
            Path('etl_handler.log'),
            Path('etl_service.log'),
            Path('etl_service_error.log')
        ]
        
        error_count = 0
        warning_count = 0
        
        for log_file in log_files:
            if log_file.exists():
                try:
                    # Read last 100 lines
                    with open(log_file, 'r', encoding='utf-8') as f:
                        lines = f.readlines()[-100:]
                    
                    # Count errors and warnings in recent logs
                    for line in lines:
                        if 'ERROR' in line.upper():
                            error_count += 1
                        elif 'WARNING' in line.upper():
                            warning_count += 1
                
                except Exception as e:
                    print(f"⚠️  Could not read {log_file}: {e}")
        
        if error_count == 0 and warning_count == 0:
            print("✅ Logs: No recent errors or warnings")
            return True
        elif error_count == 0:
            print(f"⚠️  Logs: {warning_count} warnings, no errors")
            return True
        else:
            print(f"❌ Logs: {error_count} errors, {warning_count} warnings")
            return False
            
    except Exception as e:
        print(f"❌ Log Check: Error - {e}")
        return False

def check_disk_space() -> bool:
    """Check available disk space."""
    try:
        import shutil
        
        # Check disk space where the application is running
        total, used, free = shutil.disk_usage('.')
        
        free_gb = free / (1024**3)
        used_percent = (used / total) * 100
        
        if free_gb > 1.0:  # At least 1GB free
            print(f"✅ Disk Space: {free_gb:.1f}GB free ({used_percent:.1f}% used)")
            return True
        else:
            print(f"❌ Disk Space: Only {free_gb:.1f}GB free ({used_percent:.1f}% used)")
            return False
            
    except Exception as e:
        print(f"❌ Disk Space: Error checking - {e}")
        return False

def main():
    """Run comprehensive health check."""
    print("🏥 SP500 Dashboard ETL Handler Health Check")
    print("=" * 50)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    checks = [
        ("MongoDB Connection", check_mongodb_connection),
        ("API Keys", check_api_keys),
        ("Data Freshness", check_data_freshness),
        ("Service Logs", check_service_logs),
        ("Disk Space", check_disk_space)
    ]
    
    passed = 0
    total = len(checks)
    
    for check_name, check_func in checks:
        print(f"Checking {check_name}...")
        try:
            if check_func():
                passed += 1
        except Exception as e:
            print(f"❌ {check_name}: Unexpected error - {e}")
        print()
    
    print("=" * 50)
    print(f"Health Check Summary: {passed}/{total} checks passed")
    
    if passed == total:
        print("🎉 All systems are healthy!")
        return 0
    elif passed >= total * 0.8:  # 80% or more passed
        print("⚠️  Some issues detected, but system is mostly functional")
        return 1
    else:
        print("❌ Critical issues detected! System may not be functioning properly")
        return 2

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
