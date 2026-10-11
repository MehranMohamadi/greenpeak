"""Serialized administrative account changes without erasing financial history."""

import json
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from .auth import AuthError, AuthStorageError, LocalUserCollection


class AccountManagementError(AuthError):
    def __init__(self, message, status_code=409):
        super().__init__(message)
        self.status_code = status_code


def _validate(documents, target_id, actor_id, action, confirmation):
    actor = next((row for row in documents if str(row['_id']) == actor_id), None)
    if not actor or actor.get('role') != 'admin' or not actor.get('is_active', True) or actor.get('deleted_at'):
        raise AccountManagementError('Administrator access required.', 403)
    target = next((row for row in documents if str(row['_id']) == target_id and not row.get('deleted_at')), None)
    if not target:
        raise AccountManagementError('User not found.', 404)
    if target_id == actor_id:
        raise AccountManagementError('You cannot demote or delete your own account.')
    if target.get('role') == 'admin' and target.get('is_active', True):
        active_admins = [row for row in documents if row.get('role') == 'admin' and row.get('is_active', True) and not row.get('deleted_at')]
        if len(active_admins) <= 1:
            raise AccountManagementError('The last active administrator cannot be removed.')
    if action == 'delete' and confirmation != target['username']:
        raise AccountManagementError('Enter the exact username to confirm deletion.', 400)
    return target


def _fields(target, actor_id, action):
    now = datetime.now(timezone.utc)
    fields = {'role': 'user', 'updated_at': now, 'role_changed_by': actor_id, 'role_changed_at': now}
    if action == 'delete':
        fields.update(is_active=False, deleted_at=now, deleted_by=actor_id,
                      session_version=target.get('session_version', 0) + 1)
    return fields


def manage_account(service, target_id, actor_id, action, confirmation=None):
    try:
        return _manage_account(service, target_id, actor_id, action, confirmation)
    except sqlite3.Error as exc:
        raise AuthStorageError('Local authentication database is unavailable.') from exc


def _manage_account(service, target_id, actor_id, action, confirmation=None):
    if action not in {'demote', 'delete'}:
        raise ValueError('Unsupported account action')
    collection = service.collection
    if isinstance(collection, LocalUserCollection):
        # Role checks and mutation share one transaction, including concurrent admins.
        with collection._connect() as connection:
            connection.execute('BEGIN IMMEDIATE')
            documents = [collection._document(row) for row in connection.execute('SELECT * FROM gp_users')]
            target = _validate(documents, target_id, actor_id, action, confirmation)
            target.update(_fields(target, actor_id, action))
            connection.execute('UPDATE gp_users SET role = ?, is_active = ?, extra_json = ? WHERE id = ?',
                               (target['role'], int(target['is_active']), json.dumps(target, default=str), target['_id']))
    else:
        try:
            identifier = ObjectId(target_id)
        except InvalidId:
            raise AccountManagementError('User not found.', 404)
        # MongoDB standalone installations cannot use multi-document transactions.
        # A unique leased lock serializes demotions/deletions across workers.
        locks = collection.database.gp_auth_management_locks
        owner = secrets.token_hex(16)
        now = datetime.now(timezone.utc)
        try:
            lock = locks.find_one_and_update(
                {'_id': 'users', '$or': [{'expires_at': {'$lte': now}}, {'owner': owner}]},
                {'$set': {'owner': owner, 'expires_at': now + timedelta(minutes=2)}},
                upsert=True, return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            raise AccountManagementError('Another account change is in progress. Try again.')
        if not lock or lock.get('owner') != owner:
            raise AccountManagementError('Another account change is in progress. Try again.')
        try:
            documents = list(collection.find(
                {'deleted_at': None, '$or': [{'role': 'admin'}, {'_id': identifier}]},
                {'username': 1, 'role': 1, 'is_active': 1, 'session_version': 1},
            ))
            target = _validate(documents, target_id, actor_id, action, confirmation)
            fields = _fields(target, actor_id, action)
            if action == 'delete':
                collection.database.gp_mt5_connections.update_many(
                    {'user_id': target_id, 'revoked_at': None},
                    {'$set': {'revoked_at': fields['deleted_at']}},
                )
            collection.update_one({'_id': identifier}, {'$set': fields})
            target.update(fields)
        finally:
            locks.delete_one({'_id': 'users', 'owner': owner})
    return {'id': str(target['_id']), 'username': target['username'], 'role': target['role']}
