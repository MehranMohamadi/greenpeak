"""Admin-only review and experiments; no endpoint publishes reports or sends Telegram."""
import sqlite3
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.routing import APIRoute
import httpx
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from ....core.config import get_settings
from ....services.analysis_quality import service
from ....services.analysis_quality.documents import extract_document as extract_research_document
from ....services.analysis_quality.evidence import create_source, fetch_text, search_web
from ....services.analysis_quality.schemas import (
    CandidateInput, CaseSelection, ComparisonReview, EvaluationInput, ExtractDocument, Feedback,
    FetchSource, HypothesisInput, HypothesisReview, PromoteCandidate, QualityOverview, SourceInput, SourceReview,
)
from ....services.analysis_quality.store import Conflict, Missing
from ....services.llm_engine.prompt_store import PromptConflict
from ....services.llm_engine.provider import ModelDisabledError
from ....services.llm_engine.schemas import MarketNarrative, factor_evidence_references
from .auth import no_store, require_admin


class QualityRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request):
            try:
                return await original(request)
            except Missing:
                raise HTTPException(404, detail="Quality record not found") from None
            except (Conflict, PromptConflict):
                raise HTTPException(409, detail="Record changed; refresh before saving") from None
            except ModelDisabledError:
                raise HTTPException(409, detail="Selected model is disabled") from None
            except (sqlite3.Error, OSError, PyMongoError):
                raise HTTPException(503, detail="Quality storage is unavailable") from None
            except httpx.HTTPError:
                raise HTTPException(502, detail="Source could not be retrieved") from None
            except ValueError as exc:
                raise HTTPException(400, detail=str(exc)) from None
        return handler


router = APIRouter(prefix="/admin/analysis-quality", tags=["Analysis quality"], route_class=QualityRoute,
                   dependencies=[Depends(require_admin), Depends(no_store)])
Actor = Annotated[dict, Depends(require_admin)]


@router.get("", response_model=QualityOverview)
def overview():
    return service.overview(service.get_store(), get_settings())


@router.post("/import-reports")
def import_reports():
    settings = get_settings()
    store = service.get_store()
    imported = 0
    with MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=3000) as client:
        documents = client[settings.mongodb_database].gp_market_narrative_snapshots.find(
            {"subject_id": "sp500"}, {"_id": False}).sort([("as_of_date", -1), ("analysis_generated_at", -1)]).limit(50)
        for document in documents:
            allowed = MarketNarrative.model_fields
            report = MarketNarrative.model_validate({key: value for key, value in document.items() if key in allowed})
            service.capture_report(report.model_dump(mode="json"), store=store)
            imported += 1
    return {"imported": imported, "note": "Historical reports without original inputs cannot be replayed"}


@router.get("/reports/{item_id}")
def report_detail(item_id: str):
    store = service.get_store()
    case = store.get("report", item_id)
    request = case.get("request")
    return {**{key: value for key, value in case.items() if key not in {"system_prompt", "previous", "request"}},
            "evidence": request.get("evidence") if request else None,
            "evidence_refs": factor_evidence_references(request["evidence"]) if request else []}


@router.put("/reports/{item_id}/feedback")
def feedback(item_id: str, body: Feedback, actor: Actor):
    return service.save_feedback(service.get_store(), item_id, body, actor["id"])


@router.put("/reports/{item_id}/case")
def case_selection(item_id: str, body: CaseSelection, actor: Actor):
    store = service.get_store()
    case = store.get("report", item_id)
    if body.split != "none" and not case.get("request"):
        raise ValueError("Only reports with captured original inputs can join the evaluation set")
    return store.save("report", {**case, **body.model_dump(exclude={"expected_revision"})}, actor["id"],
                      item_id=item_id, expected_revision=body.expected_revision)


@router.post("/reports/{item_id}/critique", status_code=202)
def critique(item_id: str, tasks: BackgroundTasks, actor: Actor, model_id: str | None = None):
    store = service.get_store()
    if not store.get("report", item_id).get("request"):
        raise ValueError("Critique needs original captured evidence")
    service.selected_provider(get_settings(), model_id)
    job = store.enqueue("critique", {"report_id": item_id, "model_id": model_id}, actor["id"])
    tasks.add_task(service.run_critic, store, job["id"], get_settings())
    return job


@router.post("/sources")
def add_source(body: SourceInput, actor: Actor):
    return create_source(service.get_store(), body, actor["id"])


@router.get("/sources/{item_id}")
def source_detail(item_id: str):
    return service.get_store().get("source", item_id)


@router.put("/sources/{item_id}/approval")
def approve_source(item_id: str, body: SourceReview, actor: Actor):
    store = service.get_store()
    item = store.get("source", item_id)
    return store.save("source", {**item, "approved": body.approved}, actor["id"], item_id=item_id,
                      expected_revision=body.expected_revision)


@router.post("/sources/fetch")
def fetch_source(body: FetchSource):
    return {"content": fetch_text(body.source_url)}


@router.post("/documents/extract")
def extract_document(body: ExtractDocument):
    return extract_research_document(body.filename, body.data_base64)


@router.get("/research")
def research(query: str = Query(min_length=3, max_length=200)):
    result = search_web(query)
    from ....services.analysis_quality.evidence import tokens
    terms = tokens(query)
    result["library"] = [{key: row[key] for key in ("id", "title", "source_url", "published_at", "approved")}
                         for row in service.get_store().list("source", 100)
                         if terms & tokens(row["title"] + " " + row.get("topics", "") + " " + row["content"])]
    return result


@router.post("/hypotheses")
def add_hypothesis(body: HypothesisInput, actor: Actor):
    return service.create_hypothesis(service.get_store(), body, actor["id"])


@router.put("/hypotheses/{item_id}/review")
def review_hypothesis(item_id: str, body: HypothesisReview, actor: Actor):
    return service.review_hypothesis(service.get_store(), item_id, body, actor["id"])


@router.post("/candidates")
def add_candidate(body: CandidateInput, actor: Actor):
    return service.create_candidate(service.get_store(), body, actor["id"])


@router.post("/suggestions", status_code=202)
def suggest(tasks: BackgroundTasks, actor: Actor):
    store = service.get_store()
    service.selected_provider(get_settings())
    job = store.enqueue("suggestion", {}, actor["id"])
    tasks.add_task(service.run_suggestion, store, job["id"], get_settings())
    return job


@router.post("/evaluations", status_code=202)
def evaluate(body: EvaluationInput, tasks: BackgroundTasks, actor: Actor):
    store = service.get_store()
    for case_id in body.case_ids:
        case = store.get("report", case_id)
        if not case.get("request") or case["split"] not in {"development", "holdout"}:
            raise ValueError("Select captured development or holdout cases")
    if body.candidate_id:
        candidate = store.get("candidate", body.candidate_id)
        if candidate["status"] != "draft":
            raise ValueError("Candidate is no longer a draft")
    service.selected_provider(get_settings(), body.model_id)
    from ....services.llm_engine.prompts import load_prompt
    job = store.enqueue("evaluation", {**body.model_dump(), "results": [],
                        "baseline_prompt": load_prompt("market").content}, actor["id"])
    tasks.add_task(service.run_evaluation, store, job["id"], get_settings())
    return job


@router.get("/evaluations/{item_id}")
def evaluation_detail(item_id: str):
    return service.get_store().get("evaluation", item_id)


@router.put("/evaluations/{item_id}/cases/{case_id}/review")
def review_comparison(item_id: str, case_id: str, body: ComparisonReview, actor: Actor):
    store = service.get_store()
    run = store.get("evaluation", item_id)
    if run["status"] != "completed":
        raise ValueError("Wait for the experiment to finish")
    pair = next((pair for pair in run["results"] if pair["case_id"] == case_id), None)
    if pair is None or "candidate" not in pair["outputs"]:
        raise ValueError("Comparison pair not found")
    pair["review"] = {**body.model_dump(exclude={"expected_revision"}), "actor": actor["id"]}
    return store.save("evaluation", run, actor["id"], item_id=item_id, expected_revision=body.expected_revision)


@router.post("/candidates/{item_id}/promote")
def promote(item_id: str, body: PromoteCandidate, actor: Actor):
    return service.promote_candidate(service.get_store(), item_id, body.expected_prompt_revision, actor["id"])


@router.post("/jobs/{kind}/{item_id}/cancel")
def cancel_job(kind: str, item_id: str, actor: Actor):
    if kind not in {"evaluation", "critique", "suggestion"}:
        raise HTTPException(404, detail="Unknown job type")
    store = service.get_store()
    item = store.get(kind, item_id)
    if item["status"] not in {"queued", "running"}:
        raise ValueError("Job is no longer active")
    return store.save(kind, {**item, "status": "cancelled"}, actor["id"], item_id=item_id, expected_revision=item["revision"])
