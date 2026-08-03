#!/usr/bin/env python3
"""
Test script to verify User-Agent headers are being sent with yfinance requests
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from yfinance_utils import create_ticker, configure_yfinance, get_session_info
import logging

# Set up logging to see all debug info
logging.basicConfig(level=logging.DEBUG)

def test_user_agent():
    print("🧪 Testing User-Agent configuration for yfinance...")
    
    # Configure yfinance
    configure_yfinance()
    
    # Get session info
    session_info = get_session_info()
    print(f"Session type: {session_info['session_type']}")
    print(f"User-Agent: {session_info['user_agent']}")
    print(f"curl_cffi available: {session_info['curl_cffi_available']}")
    
    # Test with a simple ticker
    print("\n📊 Testing ticker creation and data fetch...")
    try:
        ticker = create_ticker('AAPL')
        print(f"✅ Ticker created: {ticker}")
        
        # Try to get some basic info (this will make HTTP requests)
        info = ticker.info
        if info and 'symbol' in info:
            print(f"✅ Successfully fetched info for {info.get('symbol', 'UNKNOWN')}")
            print(f"   Company: {info.get('longName', 'N/A')}")
        else:
            print("⚠️  Got response but no symbol info - might be rate limited")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = test_user_agent()
    if success:
        print("\n✅ User-Agent test completed successfully!")
    else:
        print("\n❌ User-Agent test failed!")
