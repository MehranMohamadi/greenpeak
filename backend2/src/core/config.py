"""Core configuration settings."""

from pathlib import Path
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # API Configuration
    api_title: str = "SP500 Dashboard API"
    api_description: str = "FastAPI backend for S&P 500 financial data dashboard"
    api_version: str = "2.0.0"
    debug: bool = False
    greenpeak_enable_pipeline_preview: bool = False
    greenpeak_llm_provider: str = "disabled"
    greenpeak_llm_model: str = ""
    greenpeak_llm_api_key: str = ""
    greenpeak_llm_base_url: str = "https://api.openai.com/v1"
    greenpeak_analysis_admin_token: str = ""
    # Comma-separated dedicated MT5 ingestion tokens. Empty disables ingestion.
    greenpeak_mt5_api_tokens: str = ""
    greenpeak_daily_analysis_enabled: bool = True
    greenpeak_daily_analysis_hour: int = 4
    greenpeak_daily_analysis_minute: int = 0
    greenpeak_daily_analysis_timezone: str = "Asia/Tehran"
    greenpeak_news_enabled: bool = False
    greenpeak_cnbc_rss_url: str = "https://www.cnbc.com/id/10000664/device/rss/rss.html"
    greenpeak_investing_rss_url: str = "https://www.investing.com/rss/news_25.rss"

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1
    reload: bool = False

    # CORS Configuration
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "https://greenpeak.ir",
        "https://www.greenpeak.ir",
    ]
    cors_allow_credentials: bool = True
    cors_allow_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    cors_allow_headers: List[str] = ["*"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [x.strip() for x in v.split(",")]
        return v

    @field_validator("cors_allow_methods", mode="before")
    @classmethod
    def parse_cors_methods(cls, v):
        """Parse CORS methods from string or list."""
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [x.strip() for x in v.split(",")]
        return v

    @field_validator("cors_allow_headers", mode="before")
    @classmethod
    def parse_cors_headers(cls, v):
        """Parse CORS headers from string or list."""
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [x.strip() for x in v.split(",")]
        return v

    # Data Configuration
    data_dir: Path = Path(__file__).parent.parent / "data" / "raw"

    # API Keys
    fred_api_key: str = ""
    alpha_vantage_key: str = ""

    # Yahoo Finance Tickers
    yahoo_tickers: List[str] = []

    # MongoDB Configuration
    mongodb_url: str = "mongodb://127.0.0.1:27017"
    mongodb_database: str = "sp500_dashboard"

    # Environment-specific settings
    environment: str = "development"

    @field_validator("data_dir")
    @classmethod
    def validate_data_dir(cls, v):
        """Ensure data directory exists."""
        if not v.exists():
            v.mkdir(parents=True, exist_ok=True)
        return v

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v):
        """Validate environment setting."""
        valid_envs = ["development", "staging", "production"]
        if v not in valid_envs:
            raise ValueError(f"Environment must be one of: {valid_envs}")
        return v

    @field_validator("yahoo_tickers", mode="before")
    @classmethod
    def parse_yahoo_tickers(cls, v):
        """Parse Yahoo tickers from string or list."""
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return v

    model_config = {
        # Production keeps provider keys in a server-owned frontend env file.
        # Read it as a secondary source so FastAPI and Next.js share the same
        # Alpha Vantage credential without committing or copying the secret.
        "env_file": (
            str(Path(__file__).parent.parent.parent.parent / ".env"),
            str(Path(__file__).parent.parent.parent.parent / "front2" / ".env.production.local"),
        ),
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings."""
    return settings


def get_fred_api_key() -> str:
    """Get FRED API key from settings."""
    return settings.fred_api_key


def get_yahoo_tickers() -> List[str]:
    """Get Yahoo Finance tickers from settings."""
    return settings.yahoo_tickers
