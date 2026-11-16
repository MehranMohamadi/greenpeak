"""Edition contracts and retention of independently assessed market horizons.

The model writes only the scopes requested for this edition. Python owns report
kind, assessment timestamps and retention; a new pulse cannot rewrite an outlook.
"""
from copy import deepcopy
from datetime import UTC, datetime
from zoneinfo import ZoneInfo


REPORT_TITLES = {
    "weekly": "چشم‌انداز هفته",
    "daily": "نبض روز و مسیر نزدیک",
    "session": "نبض جلسه",
    "weekend": "نبض تعطیلات",
}
PULSE_FIELDS = {
    "narrative_fa", "market_story_fa", "current_market_move_fa", "current_analysis_fa",
    "watch_next_fa", "status_summary", "evidence_refs", "warnings",
}
FACTOR_FIELDS = {
    "positive_drivers", "negative_drivers", "key_risks", "cross_domain_conflicts",
    "market_drivers", "market_potentials", "market_conflicts", "risk_monitor",
    "important_changes", "glance_summary", "factor_classification_version",
    "factor_empty_reasons", "factor_source_evidence", "factors_assessed_at",
}


def scope_market_news(evidence, kind, as_of, now):
    """Give the pulse only dated same-day news, preserving broader outlook input."""
    horizontal = deepcopy(evidence.get("horizontal_evidence") or {})
    today = []
    for item in horizontal.get("recent_market_news", []):
        try:
            published = item.get("published_at")
            if isinstance(published, str):
                published = datetime.fromisoformat(published.replace("Z", "+00:00"))
            if not isinstance(published, datetime) or published.tzinfo is None:
                continue
            if published <= now.astimezone(UTC) and published.astimezone(ZoneInfo("Asia/Tehran")).date() == as_of:
                today.append(item)
        except (TypeError, ValueError, AttributeError):
            continue
    horizontal["today_market_news"] = today
    if kind in {"session", "weekend"}:
        horizontal["recent_market_news"] = today
    return {**evidence, "horizontal_evidence": horizontal}


def edition_contract(kind, schema):
    if kind not in REPORT_TITLES:
        raise ValueError("Unknown market report kind")
    schema = deepcopy(schema)
    fields = set(schema["properties"])
    # All provenance, times and retained content are supplied by Python.
    fields -= {"level", "subject_id", "as_of_date", "data_as_of", "analysis_version",
               "analysis_generated_at", "coverage", "provenance", "revision_id",
               "report_kind", "summary_points_fa", "short_term_outlook_fa", "medium_term_outlook_fa",
               "factor_source_evidence", "factors_assessed_at", "weekly_assessed_at"}
    fields -= {"short_term_assessed_at", "medium_term_assessed_at", "medium_term_reassessed"}
    if kind in {"session", "weekend"}:
        fields &= PULSE_FIELDS
    elif kind == "daily":
        fields -= {"weekly_focus_fa", "weekly_events_fa"}
    schema["properties"] = {key: value for key, value in schema["properties"].items() if key in fields}
    required = ["current_market_move_fa", "current_analysis_fa", "narrative_fa", "market_story_fa", "watch_next_fa"]
    if kind in {"weekly", "daily"}:
        required += ["short_term_view"]
    if kind == "weekly":
        required += ["medium_term_view", "weekly_focus_fa", "weekly_events_fa"]
    schema["required"] = required
    for key in ("short_term_view", "medium_term_view"):
        if key in schema["properties"] and not (kind == "daily" and key == "medium_term_view"):
            schema["properties"][key] = {"$ref": "#/$defs/MarketOutlook"}
    outlook = schema.get("$defs", {}).get("MarketOutlook", {})
    for field in ("assessed_at", "data_as_of"):
        outlook.get("properties", {}).pop(field, None)
    return schema


def edition_instructions(kind):
    return f"""
MANDATORY EDITION SCOPE: {kind} ({REPORT_TITLES[kind]}).
This scope overrides conflicting flow length, horizon and summary instructions above.
Only return the fields in output_contract. Write plain, connected Persian.
current_market_move_fa is one brief meaningful headline/qualitative observation;
current_analysis_fa is 2–3 concise sentences about the SAME observed day/session.
watch_next_fa contains at most one short sentence for the most material next event
or condition; do not repeat it in current_analysis_fa. No five-point summary.
No trading instructions, invented scores, causes, investor motives or sentiment.
Use timestamps to separate today's news from old news and completed sessions from
in-progress observations. News sentiment alone is not observed investor sentiment.
When supplied, prioritize actual contemporaneous reactions and sentiment evidence;
when missing, describe the evidenced news atmosphere cautiously. Never fill a quiet
day with old events presented as new. No fresh news is a valid very short report.
For the pulse, use horizontal_evidence.today_market_news (publication dates are
filtered by Python to the report's Tehran calendar day). Broader recent_market_news
is background for weekly/outlook/factor assessment only, never today's new news.

weekend: only today's important news and the news atmosphere; 40–70 Persian words
total including watch_next_fa, shorter with sparse evidence. Market is closed: no
claim of today's trading reaction and no retelling Friday as today's move. At most
1–2 important stories; say conditionally how they could matter at reopening.
session: only the observed session, new material news and mood; 40–70 words total.
Explain what changed since previous_report only if comparable current evidence
exists. Do not restate yesterday, weekly/medium-term views or generic outlooks.
daily: pulse plus short-term review, 70–110 words for pulse + visible short-term
summary/condition/change_summary. Assess several days to several weeks. Use previous_report to
state whether the prior view changed, with evidence. Normally return null/omit
medium_term_view. Exception: a material, newly evidenced change to the existing
6–12 month fundamental view may trigger a medium-term reassessment. This must
have material_change=true, change_status=changed, an explicit change_summary_fa
and exact evidence_refs to CURRENT supplied dated source objects (not retained
evidence or prior reports). Do not refresh for routine news, unchanged conditions,
missing fresh evidence, or when no prior medium-term assessment exists. Keep the
extra visible summary/condition within the same 110-word daily report budget.
weekly: coherent Monday week-ahead report, 200–300 words across pulse, weekly
focus/events and outlooks; explain the starting mood, week's main theme, up to
three supplied decisive events, near-term path and a 6–12 month fundamental view.
Do not concatenate domain narratives or duplicate the economic calendar.

For each requested *_term_view, summary_fa is ONE sentence; change_condition_fa
is ONE specific evidenced condition that would alter the assessment. detail_fa
gives concise reasons, main scenario and counterevidence (not repeated summary).
change_status is initial without a comparable prior assessment, otherwise changed
or unchanged ONLY after reviewing the supplied prior view against dated evidence.
change_summary_fa explains that review and its reason. Missing new evidence is not
proof of unchanged fundamentals: say explicitly that comparable evidence is absent.
Do not generate assessment timestamps; Python supplies those. Retained outlooks
and factors are historical context, never independent fresh evidence. Incomplete
domain coverage remains provisional and must be acknowledged concisely.
"""


def previous_report(previous):
    if not previous:
        return None
    keys = ("report_kind", "as_of_date", "analysis_generated_at", "current_market_move_fa",
            "current_analysis_fa", "short_term_view", "medium_term_view",
            "short_term_outlook_fa", "medium_term_outlook_fa")
    return {key: previous.get(key) for key in keys}


def compose_edition(generated, previous, kind, metadata, schema, evidence=None):
    allowed = edition_contract(kind, schema)["properties"]
    result = {key: deepcopy(value) for key, value in generated.items() if key in allowed}
    for field in ("current_market_move_fa", "current_analysis_fa", "narrative_fa", "market_story_fa"):
        if not isinstance(result.get(field), str) or not result[field].strip():
            raise ValueError(f"Missing edition field: {field}")
    watch = result.get("watch_next_fa", [])
    if not isinstance(watch, list) or len(watch) > 1 or any(not isinstance(item, str) or not item.strip() for item in watch):
        raise ValueError("Provide at most one meaningful watch-next sentence")
    previous = previous or {}
    medium_update = kind == "daily" and result.get("medium_term_view") is not None
    if medium_update:
        from .llm_engine.schemas import resolve_factor_evidence
        view = result["medium_term_view"]
        if not isinstance(view, dict) or view.get("material_change") is not True or view.get("change_status") != "changed":
            raise ValueError("An exceptional medium-term review requires an explicitly material change")
        refs = view.get("evidence_refs")
        if (not isinstance(refs, list) or not refs or any(not isinstance(ref, str)
                or ref.startswith("/retained_factor_evidence")
                or resolve_factor_evidence(evidence or {}, ref) is None for ref in refs)):
            raise ValueError("A medium-term change must cite current supplied evidence")
    result["medium_term_reassessed"] = medium_update
    for horizon in ("short", "medium"):
        key = f"{horizon}_term_view"
        prose = f"{horizon}_term_outlook_fa"
        refresh = kind == "weekly" or (kind == "daily" and horizon == "short") or (horizon == "medium" and medium_update)
        if refresh:
            view = result.get(key)
            if not isinstance(view, dict):
                raise ValueError(f"Missing assessed outlook: {key}")
            view["assessed_at"] = metadata["analysis_generated_at"]
            view["data_as_of"] = metadata["data_as_of"]
            result[f"{horizon}_term_assessed_at"] = metadata["analysis_generated_at"]
            if view.get("change_status") != "initial" and not (previous.get(key) or previous.get(prose)):
                raise ValueError("Cannot claim changed/unchanged without a prior outlook")
            result[prose] = view.get("detail_fa", "")
        else:
            result[key] = deepcopy(previous.get(key))
            # Legacy prose keeps its original timestamp in UI; do not invent a
            # new summary/condition from an older free-text narrative.
            result[prose] = previous.get(prose, "")
            result[f"{horizon}_term_assessed_at"] = (previous.get(f"{horizon}_term_assessed_at")
                or (previous.get(key) or {}).get("assessed_at")
                or (previous.get("analysis_generated_at") if previous.get(prose) else None))
    if kind != "weekly":
        for key in ("weekly_focus_fa", "weekly_events_fa", "weekly_assessed_at"):
            if key in previous:
                result[key] = deepcopy(previous[key])
    else:
        if not isinstance(result.get("weekly_focus_fa"), str) or not result["weekly_focus_fa"].strip():
            raise ValueError("Weekly focus is required")
        events = result.get("weekly_events_fa", [])
        if not isinstance(events, list) or len(events) > 3 or any(not isinstance(event, str) or not event.strip() for event in events):
            raise ValueError("Provide up to three meaningful weekly events")
        result["weekly_assessed_at"] = metadata["analysis_generated_at"]
    if kind in {"session", "weekend"}:
        for key in FACTOR_FIELDS:
            if key in previous:
                result[key] = deepcopy(previous[key])
        # Preserve the true assessment date for historical factor snapshots too.
        if not result.get("factors_assessed_at") and previous:
            result["factors_assessed_at"] = previous.get("analysis_generated_at")
    else:
        result["factors_assessed_at"] = metadata["analysis_generated_at"]
    result["summary_points_fa"] = []
    result["systemic_synthesis_fa"] = result["current_analysis_fa"]
    result["report_kind"] = kind
    visible = [result["current_market_move_fa"], result["current_analysis_fa"], *watch]
    if kind in {"daily", "weekly"}:
        view = result["short_term_view"]
        visible += [view.get("summary_fa", ""), view.get("change_condition_fa", ""), view.get("change_summary_fa", "")]
    if kind == "weekly":
        view = result["medium_term_view"]
        visible += [result["weekly_focus_fa"], *result.get("weekly_events_fa", []),
                    result["short_term_view"].get("detail_fa", ""),
                    view.get("summary_fa", ""), view.get("change_condition_fa", ""), view.get("change_summary_fa", ""), view.get("detail_fa", "")]
    elif medium_update:
        visible += [result["medium_term_view"].get("summary_fa", ""), result["medium_term_view"].get("change_condition_fa", ""), result["medium_term_view"].get("change_summary_fa", "")]
    limit = {"session": 70, "weekend": 70, "daily": 110, "weekly": 300}[kind]
    if sum(len(str(text).split()) for text in visible) > limit:
        raise ValueError(f"Edition exceeds its {limit}-word visible report limit")
    return result
