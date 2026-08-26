from src.ETL.refresh_rate_series import parse_fred_csv, select_new_observations


def test_parse_fred_csv_skips_missing_values():
    payload = "observation_date,DFF\n2026-08-22,.\n2026-08-23,3.63\n"

    assert parse_fred_csv("DFF", payload) == [("2026-08-23", 3.63)]


def test_select_new_observations_preserves_existing_raw_dates():
    observations = [("2026-08-22", 3.63), ("2026-08-23", 3.63)]

    assert select_new_observations(observations, "2026-08-22") == [("2026-08-23", 3.63)]
