"""Financial display contracts without operational diagnostics."""


def public_narrative(response):
    data = {key: value for key, value in response["data"].items()
            if key not in {"provenance", "analysis_version", "revision_id"}}
    if "coverage" in data:
        data["coverage"] = {"status": data["coverage"]["status"]}
    metadata = {key: value for key, value in response.get("metadata", {}).items() if key != "storage"}
    return {**response, "data": data, "metadata": metadata}


def public_feature_snapshot(snapshot):
    data = {key: snapshot[key] for key in (
        "indicator_id", "as_of_date", "source", "current", "features", "feature_reasons",
        "derived_features", "state", "quality", "semantics", "llm_context",
    )}
    data["source"] = {key: value for key, value in data["source"].items()
                      if key not in {"collection", "raw_indicator", "raw_document_ids", "received_count", "valid_count"}}
    data["quality"] = {key: value for key, value in data["quality"].items()
                       if key in {"status", "freshness_days", "flags", "warnings"}}
    data["llm_context"] = {"summary_template_fa": data["llm_context"].get("summary_template_fa")}
    return data


def public_broker_comparison(data):
    result = {key: value for key, value in data.items() if key not in {"eligible_broker_count", "excluded_broker_count"}}
    result["brokers"] = []
    for broker in data["brokers"]:
        item = {key: value for key, value in broker.items()
                if key not in {"sample_users", "sample_accounts", "commission_sample_deals", "dividend_sample_records"}}
        item["symbols"] = [{key: value for key, value in symbol.items() if key != "sample_accounts"} for symbol in broker["symbols"]]
        result["brokers"].append(item)
    return result


def public_mt5_snapshot(data):
    result = {key: data[key] for key in (
        "timestamp_utc", "source", "account", "portfolio_metrics", "symbol_metrics", "positions",
        "pending_orders", "broker_symbol_data", "swap_metrics", "trade_history_delta", "calculation_status",
    )}
    result["source"] = {key: data["source"][key] for key in ("broker_company", "trade_server", "account_identifier")}
    return result
