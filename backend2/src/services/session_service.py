"""Session calculation service for forex market sessions."""

import datetime
import pytz
from typing import List, Dict, Any, Optional
from ..models.schemas import SessionStatus, MarketOverview, SessionResponse


class SessionService:
    """Service for calculating forex market session statuses."""

    def __init__(self):
        """Initialize the session service."""
        self.markets = [
            {
                "name": "Sydney",
                "timezone": "Australia/Sydney",
                "local_open": 8,
                "local_close": 17,
                "description": "Asia-Pacific Session",
                "currency_pairs": ["AUD/USD", "NZD/USD", "AUD/JPY"]
            },
            {
                "name": "Tokyo",
                "timezone": "Asia/Tokyo",
                "local_open": 9,
                "local_close": 18,
                "description": "Asian Session",
                "currency_pairs": ["USD/JPY", "GBP/JPY", "AUD/JPY"]
            },
            {
                "name": "London",
                "timezone": "Europe/London",
                "local_open": 8,
                "local_close": 17,
                "description": "European Session",
                "currency_pairs": ["EUR/USD", "GBP/USD", "EUR/GBP"]
            },
            {
                "name": "New York",
                "timezone": "America/New_York",
                "local_open": 8,
                "local_close": 17,
                "description": "North American Session",
                "currency_pairs": ["USD/CAD", "EUR/USD", "GBP/USD"]
            }
        ]

    def get_timezone_offset(self, tz_name: str, dt: datetime.datetime) -> float:
        """Get current timezone offset for a given timezone at a specific datetime."""
        try:
            tz = pytz.timezone(tz_name)
            localized_dt = tz.localize(dt.replace(tzinfo=None))
            return localized_dt.utcoffset().total_seconds() / 3600
        except Exception:
            # Fallback offsets
            fallbacks = {
                "Australia/Sydney": 10,  # AEST
                "Asia/Tokyo": 9,         # JST
                "Europe/London": 0,      # GMT
                "America/New_York": -5   # EST
            }
            return fallbacks.get(tz_name, 0)

    def is_market_holiday(self, dt: datetime.datetime, market: str) -> bool:
        """Check if it's a market holiday (basic implementation)."""
        # New Year's Day
        if dt.month == 1 and dt.day == 1:
            return True
        # Christmas Day
        if dt.month == 12 and dt.day == 25:
            return True
        # Boxing Day for some markets
        if market in ["Sydney", "London"] and dt.month == 12 and dt.day == 26:
            return True
        return False

    def calculate_session_hours(
        self, 
        market_name: str, 
        timezone_name: str, 
        local_open: int, 
        local_close: int, 
        current_utc: datetime.datetime
    ) -> tuple[int, int]:
        """Calculate UTC open/close hours for a market session with DST handling."""
        current_date = current_utc.date()
        
        # Create local datetime objects for market open/close
        market_open = datetime.datetime.combine(current_date, datetime.time(local_open, 0))
        market_close = datetime.datetime.combine(current_date, datetime.time(local_close, 0))
        
        # Handle overnight sessions (close next day)
        if local_close < local_open:
            market_close = market_close + datetime.timedelta(days=1)
        
        # Get timezone offset for current date
        offset = self.get_timezone_offset(timezone_name, market_open)
        
        # Convert to UTC
        utc_open = market_open - datetime.timedelta(hours=offset)
        utc_close = market_close - datetime.timedelta(hours=offset)
        
        return utc_open.hour, utc_close.hour

    def is_session_open(
        self, 
        utc_open: int, 
        utc_close: int, 
        current_hour: int, 
        is_weekend: bool, 
        market_name: str, 
        current_dt: datetime.datetime
    ) -> bool:
        """Check if a session is currently open."""
        if is_weekend:
            return False
            
        if self.is_market_holiday(current_dt, market_name):
            return False
        
        # Handle sessions that cross midnight
        if utc_close < utc_open:
            return current_hour >= utc_open or current_hour < utc_close
        else:
            return utc_open <= current_hour < utc_close

    def calculate_sessions(self) -> SessionResponse:
        """Calculate the open/closed status of major forex market sessions."""
        # Current UTC time
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        hour_utc = now_utc.hour
        minute_utc = now_utc.minute
        day_of_week = now_utc.weekday()  # 0 = Monday, 6 = Sunday
        
        # Check if it's weekend (forex markets closed)
        is_weekend = day_of_week >= 5  # Saturday = 5, Sunday = 6
        
        result = []
        
        for market in self.markets:
            # Calculate current UTC hours for this market
            utc_open, utc_close = self.calculate_session_hours(
                market["name"], 
                market["timezone"], 
                market["local_open"], 
                market["local_close"], 
                now_utc
            )
            
            # Check if session is open
            is_open = self.is_session_open(
                utc_open, utc_close, hour_utc, is_weekend, market["name"], now_utc
            )
            
            # Calculate overlapping sessions
            overlaps = []
            if is_open and not is_weekend:
                for other_market in self.markets:
                    if other_market["name"] != market["name"]:
                        other_utc_open, other_utc_close = self.calculate_session_hours(
                            other_market["name"], 
                            other_market["timezone"], 
                            other_market["local_open"], 
                            other_market["local_close"], 
                            now_utc
                        )
                        
                        other_is_open = self.is_session_open(
                            other_utc_open, other_utc_close, hour_utc, is_weekend, 
                            other_market["name"], now_utc
                        )
                        
                        if other_is_open:
                            overlaps.append(other_market["name"])
            
            # Calculate next open/close times
            next_open = None
            next_close = None
            
            if is_open:
                # Calculate minutes until close
                if utc_close < utc_open:  # overnight session
                    if hour_utc >= utc_open:
                        next_close = (24 - hour_utc + utc_close) * 60 - minute_utc
                    else:
                        next_close = (utc_close - hour_utc) * 60 - minute_utc
                else:
                    next_close = (utc_close - hour_utc) * 60 - minute_utc
            else:
                # Calculate minutes until open
                if utc_close < utc_open:  # overnight session
                    if hour_utc < utc_open and hour_utc >= utc_close:
                        next_open = (utc_open - hour_utc) * 60 - minute_utc
                    elif hour_utc >= utc_open:
                        next_open = (24 - hour_utc + utc_open) * 60 - minute_utc
                    else:
                        next_open = (utc_open - hour_utc) * 60 - minute_utc
                else:
                    if hour_utc < utc_open:
                        next_open = (utc_open - hour_utc) * 60 - minute_utc
                    else:
                        next_open = (24 - hour_utc + utc_open) * 60 - minute_utc
            
            # Handle weekend adjustments
            if is_weekend:
                if day_of_week == 5:  # Saturday
                    next_open = (2 * 24 * 60) + (utc_open * 60) - (hour_utc * 60) - minute_utc
                elif day_of_week == 6:  # Sunday
                    next_open = (1 * 24 * 60) + (utc_open * 60) - (hour_utc * 60) - minute_utc
            
            session_status = SessionStatus(
                name=market["name"],
                timezone=market["timezone"],
                description=market["description"],
                status="open" if is_open else "closed",
                local_open_time=f"{market['local_open']:02d}:00",
                local_close_time=f"{market['local_close']:02d}:00",
                utc_open_hour=utc_open,
                utc_close_hour=utc_close,
                overlapping_sessions=overlaps,
                is_weekend=is_weekend,
                is_holiday=self.is_market_holiday(now_utc, market["name"]),
                current_utc_hour=hour_utc,
                current_utc_minute=minute_utc,
                next_open_minutes=max(0, next_open) if next_open is not None else None,
                next_close_minutes=max(0, next_close) if next_close is not None else None,
                major_pairs=market["currency_pairs"]
            )
            
            result.append(session_status)
        
        # Calculate market overview
        active_sessions = [s for s in result if s.status == "open"]
        total_volume_score = len(active_sessions)
        
        # High volume periods (session overlaps)
        high_volume_periods = []
        if len(active_sessions) >= 2:
            session_names = [s.name for s in active_sessions]
            high_volume_periods = [f"{session_names[0]}-{session_names[1]} Overlap"]
        
        # Next major event
        next_major_event = None
        if result:
            if all(s.status == "closed" for s in result):
                # Find next session to open
                next_opens = [s.next_open_minutes for s in result if s.next_open_minutes is not None]
                if next_opens:
                    min_minutes = min(next_opens)
                    next_session = next(s for s in result if s.next_open_minutes == min_minutes)
                    next_major_event = {
                        "type": "session_open",
                        "session": next_session.name,
                        "minutes": min_minutes
                    }
            else:
                # Find next session to close
                open_sessions = [s for s in result if s.status == "open"]
                if open_sessions:
                    next_closes = [s.next_close_minutes for s in open_sessions if s.next_close_minutes is not None]
                    if next_closes:
                        min_minutes = min(next_closes)
                        next_session = next(s for s in open_sessions if s.next_close_minutes == min_minutes)
                        next_major_event = {
                            "type": "session_close",
                            "session": next_session.name,
                            "minutes": min_minutes
                        }
        
        market_overview = MarketOverview(
            active_sessions_count=len(active_sessions),
            active_sessions=[s.name for s in active_sessions],
            is_weekend=is_weekend,
            current_utc_time=now_utc.isoformat(),
            current_local_times={
                session.name: {
                    "time": (now_utc + datetime.timedelta(hours=self.get_timezone_offset(session.timezone, now_utc))).strftime("%H:%M"),
                    "date": (now_utc + datetime.timedelta(hours=self.get_timezone_offset(session.timezone, now_utc))).strftime("%Y-%m-%d")
                } for session in result
            },
            market_status="holiday" if any(s.is_holiday for s in result) else 
                         "weekend" if is_weekend else
                         "high_volume" if len(active_sessions) >= 2 else
                         "active" if len(active_sessions) > 0 else "closed",
            volume_score=total_volume_score,
            high_volume_periods=high_volume_periods,
            next_major_event=next_major_event
        )
        
        return SessionResponse(sessions=result, market_overview=market_overview)
