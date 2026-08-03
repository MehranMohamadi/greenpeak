#!/usr/bin/env python3
"""
Search for correct FRED series for S&P 500 earnings
"""

from fredapi import Fred
import os

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
        print("Warning: .env file not found in project root.")

def main():
    load_env_file()
    
    fred_api_key = os.environ.get('FRED_API_KEY', '')
    if not fred_api_key:
        print('FRED API key not found')
        return

    fred = Fred(api_key=fred_api_key)

    # Search for S&P 500 earnings-related series
    search_terms = ['earnings', 'corporate profits', 'S&P', 'SP500']

    for term in search_terms:
        print(f'=== Searching for: {term} ===')
        try:
            results = fred.search(term, limit=15)
            for idx, row in results.iterrows():
                title = row.get('title', 'Unknown')
                units = row.get('units', 'Unknown')
                if 'SP' in title.upper() or 'S&P' in title or 'earnings' in title.lower() or 'EPS' in title.upper():
                    print(f'  {idx}: {title}')
                    print(f'     Units: {units}')
        except Exception as e:
            print(f'Error searching: {e}')
        print()

if __name__ == "__main__":
    main()
