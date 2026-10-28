import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

from ....core.config import get_settings
from ....services.llm_engine.control import ConfigurationConflict, LLMControlStore, configured_models
from ....services.llm_engine.control_schemas import LLMOverview, ModelConnectionResult, UpdateLLMConfiguration
from ....services.llm_engine.connection_probe import UnknownModel, probe_connection
from .auth import require_admin


def no_store(response: Response):
    response.headers['Cache-Control'] = 'no-store'


router = APIRouter(prefix='/admin/llm', tags=['LLM administration'],
                   dependencies=[Depends(require_admin), Depends(no_store)])


@router.post('/{model_id}/test', response_model=ModelConnectionResult)
def connection_test(model_id: str):
    try:
        return probe_connection(get_settings(), model_id)
    except UnknownModel:
        raise HTTPException(404, detail='Model is not configured') from None
    except sqlite3.Error:
        raise HTTPException(503, detail='LLM management storage is unavailable') from None


@router.get('', response_model=LLMOverview)
def overview():
    settings = get_settings()
    try:
        return LLMControlStore(settings.greenpeak_llm_router_db_path).overview(configured_models(settings))
    except sqlite3.Error:
        raise HTTPException(503, detail='LLM management storage is unavailable') from None


@router.put('', response_model=LLMOverview)
def update_configuration(body: UpdateLLMConfiguration, actor: Annotated[dict, Depends(require_admin)]):
    settings = get_settings()
    try:
        models = configured_models(settings)
        store = LLMControlStore(settings.greenpeak_llm_router_db_path)
        store.save(models, [item.model_dump() for item in body.models], body.expected_revision, actor['id'])
        return store.overview(models)
    except ConfigurationConflict:
        raise HTTPException(409, detail='Configuration changed; refresh before saving') from None
    except ValueError:
        raise HTTPException(400, detail='Include each configured model exactly once') from None
    except sqlite3.Error:
        raise HTTPException(503, detail='LLM management storage is unavailable') from None
