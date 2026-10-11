import os

import pytest
from fastapi import HTTPException

os.environ["DEBUG"] = "false"

from src.api.v1.endpoints.auth import require_admin


def test_admin_access_accepts_database_role():
    assert require_admin({"id": "admin", "role": "admin"})["id"] == "admin"


def test_admin_access_rejects_users_in_every_environment():
    with pytest.raises(HTTPException) as error:
        require_admin({"id": "member", "role": "user"})
    assert error.value.status_code == 403
