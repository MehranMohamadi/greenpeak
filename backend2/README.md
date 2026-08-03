# SP500 Dashboard API v2.0

A scalable, well-structured FastAPI backend for the S&P 500 financial data dashboard.

## 🏗️ Architecture Overview

This is a complete restructure of the original backend with the following improvements:

- **Modular Design**: Clean separation of concerns with dedicated layers
- **Type Safety**: Full Pydantic models for request/response validation
- **Scalable Structure**: Easy to extend with new endpoints and features
- **Production Ready**: PM2 configuration, logging, and environment management
- **Developer Friendly**: Comprehensive documentation and tooling

## 📁 Project Structure

```
backend_restructured/
├── src/                          # Main source code
│   ├── __init__.py
│   ├── main.py                   # FastAPI app factory
│   ├── api/                      # API layer
│   │   └── v1/                   # API version 1
│   │       ├── endpoints/        # Route handlers
│   │       │   ├── market.py     # Market data endpoints
│   │       │   ├── economic.py   # Economic data endpoints
│   │       │   └── system.py     # System & session endpoints
│   │       └── __init__.py
│   ├── core/                     # Core configuration
│   │   ├── config.py             # Settings management
│   │   └── __init__.py
│   ├── models/                   # Data models
│   │   ├── schemas.py            # Pydantic models
│   │   └── __init__.py
│   ├── services/                 # Business logic
│   │   ├── data_service.py       # Data processing service
│   │   ├── session_service.py    # Session calculation service
│   │   └── __init__.py
│   └── utils/                    # Utility functions
│       ├── data_utils.py         # Data manipulation utilities
│       └── __init__.py
├── data/                         # Data storage
│   └── raw/                      # Raw CSV files
├── config/                       # Configuration files
├── scripts/                      # Utility scripts
├── tests/                        # Test files
├── logs/                         # Log files (created at runtime)
├── main.py                       # Application entry point
├── requirements.txt              # Python dependencies
├── ecosystem.config.json         # PM2 configuration
├── start.sh                      # Linux/Mac startup script
├── start.bat                     # Windows startup script
├── .env.example                  # Environment template
├── .env.development              # Development environment
└── README.md                     # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- pip (Python package manager)
- Optional: PM2 for production deployment

### Development Setup

1. **Clone and navigate to the restructured backend:**
   ```bash
   cd backend_restructured
   ```

2. **Run the setup script:**
   
   **Linux/Mac:**
   ```bash
   chmod +x start.sh
   ./start.sh --create-venv --install --dev
   ```
   
   **Windows:**
   ```cmd
   start.bat --create-venv --install --dev
   ```

3. **Access the API:**
   - API: http://localhost:8000/api/v1/
   - Documentation: http://localhost:8000/docs
   - Alternative docs: http://localhost:8000/redoc

### Production Setup

1. **Setup for production:**
   ```bash
   ./start.sh --create-venv --install
   ```

2. **Using PM2 (recommended):**
   ```bash
   # Install PM2 globally
   npm install -g pm2
   
   # Update the path in ecosystem.config.json
   # Then start with PM2
   pm2 start ecosystem.config.json
   
   # Monitor
   pm2 monit
   
   # View logs
   pm2 logs sp500-dashboard-api
   ```

## 📊 Data Requirements

Place your CSV files in the `data/raw/` directory:

- `S&P_ohlc.csv` - S&P 500 OHLC data
- `DFF.csv` - Federal Funds Rate
- `GDP.csv` - Real GDP data
- `CPI.csv` - Consumer Price Index
- `UNRATE.csv` - Unemployment rate
- `WALCL.csv` - Federal Reserve balance sheet
- `GS10.csv` - 10-Year Treasury rate
- `VIX_ohlc.csv` - VIX volatility index
- `merged-treasury-rates-2000-2025.csv` - Treasury rates
- `SOFR.csv` - Secured Overnight Financing Rate
- `REAINTRATREARAT10Y.csv` - Real interest rate

## 🔗 API Endpoints

### System Endpoints
- `GET /api/v1/system/health` - Health check
- `GET /api/v1/system/session` - Forex market sessions

### Market Data Endpoints
- `GET /api/v1/market/sp500` - S&P 500 OHLC data
- `GET /api/v1/market/vix` - VIX volatility data
- `GET /api/v1/market/treasury` - Treasury rates
- `GET /api/v1/market/dff` - Federal Funds Rate
- `GET /api/v1/market/10year` - 10-Year Treasury Rate
- `GET /api/v1/market/sofr` - SOFR data
- `GET /api/v1/market/real-interest-rate` - Real interest rate

### Economic Data Endpoints
- `GET /api/v1/economic/gdp` - Real GDP data
- `GET /api/v1/economic/cpi` - Consumer Price Index
- `GET /api/v1/economic/unemployment` - Unemployment rate
- `GET /api/v1/economic/fed-balance-sheet` - Federal Reserve balance sheet

### Query Parameters

Most endpoints support:
- `limit` - Limit number of records
- `start_date` - Start date (YYYY-MM-DD)
- `end_date` - End date (YYYY-MM-DD)

## ⚙️ Configuration

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```env
# API Configuration
API_TITLE="SP500 Dashboard API"
API_VERSION="2.0.0"
DEBUG=false

# Server Configuration
HOST="0.0.0.0"
PORT=8000
WORKERS=1
RELOAD=false

# Environment
ENVIRONMENT="production"

# CORS Configuration
CORS_ORIGINS="*"
```

### Development vs Production

- **Development**: Auto-reload, debug mode, detailed error messages
- **Production**: Optimized for performance, limited debug info

## 🔄 Migration from Old Backend

The new structure maintains backward compatibility with the original API while providing enhanced features:

### Endpoint Mapping

| Old Endpoint | New Endpoint | Notes |
|--------------|--------------|-------|
| `/api/sp500` | `/api/v1/market/sp500` | Enhanced with metadata |
| `/api/dff` | `/api/v1/market/dff` | Improved response format |
| `/api/gdp` | `/api/v1/economic/gdp` | Better error handling |
| `/session` | `/api/v1/system/session` | Same functionality |

### Key Improvements

1. **Type Safety**: All responses are validated with Pydantic models
2. **Better Error Handling**: Consistent error responses with HTTP status codes
3. **Enhanced Metadata**: Each response includes comprehensive metadata
4. **Query Parameters**: Standardized filtering across endpoints
5. **Documentation**: Auto-generated API documentation

## 🧪 Testing

Run tests (when implemented):
```bash
pytest tests/
```

## 📝 Logging

Logs are written to the `logs/` directory:
- `combined.log` - All logs
- `out.log` - Standard output
- `error.log` - Error logs

## 🔧 Development

### Adding New Endpoints

1. **Create endpoint in appropriate router** (`src/api/v1/endpoints/`)
2. **Add business logic to service** (`src/services/`)
3. **Define Pydantic models** (`src/models/schemas.py`)
4. **Update router imports** in `src/api/v1/endpoints/__init__.py`

### Adding New Data Sources

1. **Add data processing logic** to `DataService`
2. **Create appropriate Pydantic models**
3. **Add endpoint in relevant router**
4. **Update documentation**

## 🚀 Deployment

### Using PM2 (Recommended)

1. Update `ecosystem.config.json` with your paths
2. Start with PM2: `pm2 start ecosystem.config.json`
3. Save PM2 config: `pm2 save && pm2 startup`

### Using Docker (Future)

```dockerfile
# Dockerfile example for future use
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "main.py"]
```

## 🐛 Troubleshooting

### Common Issues

1. **Import Errors**: Ensure you're running from the project root
2. **Missing Data Files**: Check that CSV files are in `data/raw/`
3. **Port Already in Use**: Change PORT in `.env` file
4. **Virtual Environment Issues**: Delete `venv/` and recreate

### Debug Mode

Enable debug mode in `.env`:
```env
DEBUG=true
ENVIRONMENT="development"
```

## 📈 Performance

- **Memory Usage**: ~50-100MB base memory
- **Response Time**: <100ms for most endpoints
- **Concurrent Requests**: Scales with worker count
- **File Loading**: CSV files cached in memory for faster responses

## 🤝 Contributing

1. Follow the existing code structure
2. Add type hints to all functions
3. Include docstrings for public methods
4. Update tests for new features
5. Update this README for significant changes

## 📄 License

[Your License Here]

---

## 🎯 Next Steps

1. **Add Authentication**: JWT tokens for secured endpoints
2. **Add Rate Limiting**: Protect against abuse
3. **Add Caching**: Redis for frequently requested data
4. **Add Websockets**: Real-time data streaming
5. **Add Database**: PostgreSQL for persistent storage
6. **Add Monitoring**: Prometheus/Grafana integration
