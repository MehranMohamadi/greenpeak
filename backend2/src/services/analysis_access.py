"""Single per-account entitlement; administrators always retain analysis access."""


def can_view_premium_analysis(user):
    return bool(user and (user.get("role") == "admin" or user.get("can_view_premium_analysis") is True))


def market_for_access(data, allowed):
    if allowed:
        return dict(data)
    # Legacy prose duplicates the restricted outlook/summary. Keep the explicit
    # current-flow fields and all public factors/calendar/news/status fields.
    restricted = {"short_term_outlook_fa", "medium_term_outlook_fa", "summary_fa",
                  "summary_points_fa", "narrative_fa", "systemic_synthesis_fa"}
    return {**{key: value for key, value in data.items() if key not in restricted},
            "premium_analysis_locked": True}
