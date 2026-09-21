import os

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError

os.environ["DEBUG"] = "false"

from src.api.v1.endpoints.auth import get_auth_service, router
from src.services.auth import AuthService, verify_password


class InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class MemoryUsers:
    def __init__(self):
        self.documents = []

    def create_index(self, *_args, **_kwargs):
        return "username_normalized_1"

    def insert_one(self, document):
        if self.find_one({"username_normalized": document["username_normalized"]}):
            raise DuplicateKeyError("duplicate username")
        stored = {**document, "_id": str(len(self.documents) + 1)}
        self.documents.append(stored)
        return InsertResult(stored["_id"])

    def find_one(self, query):
        return next((item for item in self.documents if all(item.get(key) == value for key, value in query.items())), None)


def make_client():
    collection = MemoryUsers()
    service = AuthService(collection, "test-secret", token_ttl_seconds=60)
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_auth_service] = lambda: service
    return TestClient(app), collection


def test_signup_login_and_me_round_trip():
    client, collection = make_client()

    signup = client.post("/api/v1/auth/signup", json={"username": "New.User", "password": "secret12"})
    assert signup.status_code == 201
    assert signup.json()["user"]["username"] == "New.User"
    assert collection.documents[0]["password_hash"] != "secret12"
    assert verify_password("secret12", collection.documents[0]["password_hash"])

    login = client.post("/api/v1/auth/login", json={"username": "new.user", "password": "secret12"})
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json() == {"id": "1", "username": "New.User", "role": "user"}


def test_duplicate_username_and_wrong_password_are_rejected():
    client, _ = make_client()
    payload = {"username": "member", "password": "secret12"}
    assert client.post("/api/v1/auth/signup", json=payload).status_code == 201
    assert client.post("/api/v1/auth/signup", json=payload).status_code == 409
    assert client.post("/api/v1/auth/login", json={**payload, "password": "wrong12"}).status_code == 401
