"""
ETL Common Configuration
Shared configuration and utilities for all ETL scripts.

This module provides:
1. Common environment variable loading
2. Centralized yfinance configuration with curl_cffi
3. Shared logging setup
4. Common MongoDB connection utilities

Usage:
    from etl_config import setup_etl_environment, get_mongodb_client, create_ticker

    # Setup everything at once
    logger, db = setup_etl_environment('script_name')

    # Create optimized yfinance tickers
    ticker = create_ticker('AAPL')
"""

import os
import logging
import sys
from pymongo import MongoClient
from yfinance_utils import (
    create_ticker,
    create_tickers,
    configure_yfinance,
    get_session_info,
    download_data,
)


def load_env_file():
    """Load environment variables from .env file in project root."""
    try:
        # Navigate to project root (4 levels up from ETL folder)
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")
        env_path = os.path.abspath(env_path)

        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip().strip('"')
                    os.environ[key] = value
    except FileNotFoundError:
        print("Warning: .env file not found. Using environment variables.")


def setup_logging(script_name: str) -> logging.Logger:
    """Setup logging for ETL scripts."""
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
    )
    logger = logging.getLogger(script_name)
    return logger


def get_mongodb_client():
    """Get configured MongoDB client and database."""
    try:
        mongodb_url = os.getenv("MONGODB_URL")
        database_name = os.getenv("MONGODB_DATABASE", "sp500_dashboard")

        if not mongodb_url:
            raise ValueError("MONGODB_URL not found in environment variables")

        mongodb = MongoClient(mongodb_url)
        db = mongodb[database_name]
        # Test connection
        mongodb.admin.command("ping")

        return mongodb, db
    except Exception as e:
        raise Exception(f"MongoDB connection failed: {e}")


def setup_etl_environment(script_name: str):
    """
    Complete ETL environment setup.

    Args:
        script_name: Name of the ETL script for logging

    Returns:
        tuple: (logger, db) - configured logger and MongoDB database
    """
    # Load environment variables
    load_env_file()

    # Add src directory to path
    current_dir = os.path.dirname(__file__)
    src_dir = os.path.dirname(current_dir)
    if src_dir not in sys.path:
        sys.path.append(src_dir)

    # Setup logging
    logger = setup_logging(script_name)

    # Configure yfinance
    configure_yfinance()
    session_info = get_session_info()
    logger.info(f"🔧 yfinance configured: {session_info['session_type']}")

    # Setup MongoDB
    try:
        mongodb, db = get_mongodb_client()
        logger.info("✅ MongoDB connection established")
        return logger, db
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        return logger, None


# Export the ticker creation functions for convenience
__all__ = [
    "setup_etl_environment",
    "load_env_file",
    "setup_logging",
    "get_mongodb_client",
    "create_ticker",
    "create_tickers",
    "download_data",
    "configure_yfinance",
    "get_session_info",
]
