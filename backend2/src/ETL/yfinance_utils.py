"""
Yahoo Finance Utilities
Centralized yfinance configuration with curl_cffi support for better request handling.

This module provides a configured yfinance Ticker factory that:
1. Uses curl_cffi session when available for better request handling
2. Falls back to standard requests with proper user-agent
3. Provides consistent error handling across all ETL scripts
4. Implements retry logic and rate limiting protection

Usage:
    from yfinance_utils import create_ticker, configure_yfinance
    
    # Configure yfinance globally (call once at startup)
    configure_yfinance()
    
    # Create tickers with optimal configuration
    ticker = create_ticker('AAPL')
    data = ticker.history(period='1y')
"""

import yfinance as yf
import yfinance.shared as yf_shared
import logging
import time
import random
import sys
from typing import Optional

logger = logging.getLogger(__name__)

# Global session variable
_session: Optional[object] = None
_configured = False

def configure_yfinance():
    """
    Configure yfinance globally with curl_cffi if available.
    This should be called once at the start of each ETL script.
    """
    global _session, _configured
    
    if _configured:
        return
    
    try:
        from curl_cffi import requests as curl_requests
        import requests as std_requests
        
        # Create session with User-Agent
        _session = curl_requests.Session(
            impersonate="chrome110",
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            }
        )
        
        # CRITICAL: Direct monkey-patch of yfinance's request functions
        import yfinance.utils
        
        # Store original functions
        original_get = std_requests.get
        original_post = std_requests.post
        
        def patched_get(url, **kwargs):
            # Force User-Agent into every request
            if 'headers' not in kwargs:
                kwargs['headers'] = {}
            kwargs['headers']['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            return _session.get(url, **kwargs)
        
        def patched_post(url, **kwargs):
            # Force User-Agent into every request
            if 'headers' not in kwargs:
                kwargs['headers'] = {}
            kwargs['headers']['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            return _session.post(url, **kwargs)
        
        # Replace yfinance's requests - use the correct attribute name
        if hasattr(yfinance.utils, '_requests'):
            yfinance.utils._requests.get = patched_get
            yfinance.utils._requests.post = patched_post
        if hasattr(yfinance.utils, 'requests'):
            yfinance.utils.requests.get = patched_get
            yfinance.utils.requests.post = patched_post
        
        # Also patch standard requests module
        std_requests.get = patched_get
        std_requests.post = patched_post
        
        # Also patch any direct imports
        try:
            import yfinance.base
            if hasattr(yfinance.base, '_requests'):
                yfinance.base._requests.get = patched_get
                yfinance.base._requests.post = patched_post
            if hasattr(yfinance.base, 'requests'):
                yfinance.base.requests.get = patched_get
                yfinance.base.requests.post = patched_post
        except Exception:
            pass
        
        logger.info("✅ curl_cffi configured and FORCED User-Agent patching applied")
    except ImportError:
        logger.warning("⚠️  curl_cffi not available, using standard requests")
        _session = None
    
    # Set User-Agent header for yfinance shared headers
    yf_shared._HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
    }
    
    _configured = True
    logger.info("🔧 yfinance configured with FORCED User-Agent injection")

def _add_delay():
    """Add a small random delay to avoid rate limiting."""
    delay = random.uniform(0.5, 1.5)  # Random delay between 0.5-1.5 seconds
    time.sleep(delay)

def create_ticker(symbol: str, max_retries: int = 3) -> yf.Ticker:
    """
    Create a yfinance Ticker with optimal configuration and retry logic.
    
    Args:
        symbol: Stock symbol (e.g., 'AAPL', '^GSPC', 'SPY')
        max_retries: Maximum number of retry attempts
        
    Returns:
        Configured yfinance Ticker instance
        
    Raises:
        Exception: If ticker creation fails completely after all retries
    """
    if not _configured:
        configure_yfinance()
    
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                # Add exponential backoff for retries
                delay = (2 ** attempt) + random.uniform(0, 1)
                logger.info(f"Retrying ticker creation for {symbol} in {delay:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            
            if _session is not None:
                # Use curl_cffi session for better request handling
                ticker = yf.Ticker(symbol, session=_session)
            else:
                # Fallback to standard yfinance
                ticker = yf.Ticker(symbol)
            
            # Add a small delay after successful creation
            _add_delay()
            return ticker
            
        except Exception as e:
            logger.warning(f"⚠️  Attempt {attempt + 1} failed to create ticker for {symbol}: {e}")
            if attempt == max_retries - 1:
                logger.error(f"❌ All attempts failed for ticker {symbol}")
                raise
    
    # This should never be reached, but just in case
    raise Exception(f"Failed to create ticker for {symbol} after {max_retries} attempts")

def create_tickers(symbols: list, max_retries: int = 3) -> yf.Tickers:
    """
    Create multiple yfinance Tickers with optimal configuration and retry logic.
    
    Args:
        symbols: List of stock symbols
        max_retries: Maximum number of retry attempts
        
    Returns:
        Configured yfinance Tickers instance
    """
    if not _configured:
        configure_yfinance()
    
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                # Add exponential backoff for retries
                delay = (2 ** attempt) + random.uniform(0, 1)
                logger.info(f"Retrying tickers creation in {delay:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            
            if _session is not None:
                # Use curl_cffi session for better request handling
                tickers = yf.Tickers(' '.join(symbols), session=_session)
            else:
                # Fallback to standard yfinance
                tickers = yf.Tickers(' '.join(symbols))
            
            # Add a small delay after successful creation
            _add_delay()
            return tickers
            
        except Exception as e:
            logger.warning(f"⚠️  Attempt {attempt + 1} failed to create tickers: {e}")
            if attempt == max_retries - 1:
                logger.error(f"❌ All attempts failed for tickers")
                raise
    
    # This should never be reached, but just in case
    raise Exception(f"Failed to create tickers after {max_retries} attempts")

def download_data(symbols, max_retries: int = 3, **kwargs):
    """
    Download data for multiple symbols using yfinance with optimal configuration and retry logic.
    
    Args:
        symbols: String of space-separated symbols or list of symbols
        max_retries: Maximum number of retry attempts
        **kwargs: Additional arguments passed to yfinance.download
        
    Returns:
        Downloaded data from yfinance
    """
    if not _configured:
        configure_yfinance()
    
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                # Add exponential backoff for retries
                delay = (2 ** attempt) + random.uniform(0, 1)
                logger.info(f"Retrying download in {delay:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            
            # Note: yfinance.download doesn't accept session parameter directly
            # But the global session configuration should be used
            data = yf.download(symbols, **kwargs)
            
            # Add a small delay after successful download
            _add_delay()
            return data
            
        except Exception as e:
            logger.warning(f"⚠️  Attempt {attempt + 1} failed to download data: {e}")
            if attempt == max_retries - 1:
                logger.error(f"❌ All attempts failed for download")
                raise
    
    # This should never be reached, but just in case
    raise Exception(f"Failed to download data after {max_retries} attempts")

def get_session_info() -> dict:
    """
    Get information about the current yfinance session configuration.
    
    Returns:
        Dictionary with session configuration details
    """
    return {
        'curl_cffi_available': _session is not None,
        'configured': _configured,
        'user_agent': yf_shared._HEADERS.get('User-Agent', 'Not set'),
        'session_type': 'curl_cffi' if _session is not None else 'standard'
    }

# Auto-configure when module is imported
configure_yfinance()
