import os

import pytest
from fastapi import HTTPException

os.environ["DEBUG"] = "false"

from src.api.v1.endpoints.analysis import _authorize_manual_run
from src.core.config import get_settings


def test_manual_analysis_is_open_only_outside_production(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "development")
    _authorize_manual_run(None)


def test_manual_analysis_requires_production_admin_token(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "greenpeak_analysis_admin_token", "secret-token")
    with pytest.raises(HTTPException) as error:
        _authorize_manual_run(None)
    assert error.value.status_code == 403
    _authorize_manual_run("Bearer secret-token")
