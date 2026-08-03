#!/usr/bin/env python3
"""
Clear yfinance cache and test fresh connection
"""

import os
import sys

def clear_yfinance_cache():
    """Clear all yfinance cache files and databases"""
    try:
        # Clear yfinance cache
        import yfinance.cache
        yfinance.cache.clear()
        print("✅ Cleared yfinance cache")
    except Exception as e:
        print(f"⚠️  Cache clear attempt 1 failed: {e}")
    
    try:
        # Clear peewee database files
        cache_files = [
            'yfinance.cache.db',
            'yfinance.cache',
            '.yfinance_cache.db',
            'cookie.db'
        ]
        
        for cache_file in cache_files:
            if os.path.exists(cache_file):
                os.remove(cache_file)
                print(f"✅ Removed {cache_file}")
    except Exception as e:
        print(f"⚠️  File removal failed: {e}")
    
    # Force module reload
    try:
        modules_to_reload = [
            'yfinance',
            'yfinance.base',
            'yfinance.utils',
            'yfinance.cache',
            'yfinance_utils'
        ]
        
        for module_name in modules_to_reload:
            if module_name in sys.modules:
                del sys.modules[module_name]
                print(f"✅ Reloaded {module_name}")
    except Exception as e:
        print(f"⚠️  Module reload failed: {e}")

def test_fresh_connection():
    """Test with completely fresh yfinance setup"""
    clear_yfinance_cache()
    
    print("\n🧪 Testing fresh yfinance connection...")
    
    from yfinance_utils import create_ticker, configure_yfinance, get_session_info
    
    # Force reconfiguration
    import yfinance_utils
    yfinance_utils._configured = False
    configure_yfinance()
    
    session_info = get_session_info()
    print(f"Session type: {session_info['session_type']}")
    print(f"User-Agent: {session_info['user_agent']}")
    
    try:
        # Test a simple request
        ticker = create_ticker('AAPL')
        info = ticker.info
        
        if info and 'symbol' in info:
            print(f"✅ SUCCESS: Fetched data for {info.get('symbol')} - {info.get('longName', 'N/A')}")
            return True
        else:
            print("⚠️  Got response but limited data")
            return False
            
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False

if __name__ == "__main__":
    success = test_fresh_connection()
    if success:
        print("\n🎉 Fresh connection test PASSED!")
    else:
        print("\n💥 Fresh connection test FAILED!")
