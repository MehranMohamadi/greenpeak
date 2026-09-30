from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class RawNewsItem(BaseModel):
    source: Literal["alpha_vantage", "cnbc_rss", "investing_rss"]
    source_item_id: str | None = None
    url: HttpUrl
    canonical_url: HttpUrl | None = None
    title: str = Field(min_length=1, max_length=1000)
    summary: str | None = None
    published_at: datetime
    fetched_at: datetime
    topics: list[str] = []
    tickers: list[str] = []
    alpha_overall_sentiment_score: float | None = None
    alpha_overall_sentiment_label: str | None = None
    raw_payload: dict[str, Any] = {}


Direction = Literal["up", "down", "mixed", "unclear"]
Confidence = Literal["low", "medium", "high"]
NodeRole = Literal["news", "driver", "market"]


class StrictNewsModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ImpactNode(StrictNewsModel):
    id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=500)
    role: NodeRole
    direction: Direction | None = None
    confidence: Confidence | None = None
    horizon: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=2000)
    evidenceIds: list[str] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class ImpactEdge(StrictNewsModel):
    id: str = Field(min_length=1, max_length=120)
    from_id: str = Field(alias="from", min_length=1, max_length=120)
    to: str = Field(min_length=1, max_length=120)
    direction: Direction
    confidence: Confidence
    reason: str = Field(min_length=1, max_length=2000)
    evidenceIds: list[str] = Field(default_factory=list)
    condition: str | None = Field(default=None, max_length=1000)
    horizon: str | None = Field(default=None, max_length=200)
    meta: dict[str, Any] = Field(default_factory=dict)


class Evidence(StrictNewsModel):
    id: str = Field(min_length=1, max_length=120)
    claim: str = Field(min_length=1, max_length=2000)
    source: str | None = Field(default=None, max_length=500)
    publishedAt: str | None = Field(default=None, max_length=100)
    status: Literal["reported", "derived", "unknown"]

    @model_validator(mode="after")
    def require_source_for_reported_claim(self):
        if self.status == "reported" and not (self.source or "").strip():
            raise ValueError("reported evidence requires a source")
        return self


class ImpactScenario(StrictNewsModel):
    condition: str = Field(min_length=1, max_length=1000)
    edgeIds: list[str] = Field(min_length=1)


class NewsImpactGraph(StrictNewsModel):
    title: str = Field(min_length=1, max_length=1000)
    evidence: list[Evidence] = Field(min_length=1)
    nodes: list[ImpactNode] = Field(min_length=2)
    edges: list[ImpactEdge] = Field(min_length=1)
    uncertainties: list[str] = Field(default_factory=list)
    scenarios: list[ImpactScenario] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_graph_references(self):
        node_ids = [node.id for node in self.nodes]
        evidence_ids = [item.id for item in self.evidence]
        edge_ids = [edge.id for edge in self.edges]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("impact graph node ids must be unique")
        if len(evidence_ids) != len(set(evidence_ids)):
            raise ValueError("impact graph evidence ids must be unique")
        if len(edge_ids) != len(set(edge_ids)):
            raise ValueError("impact graph edge ids must be unique")
        if not any(node.role == "news" for node in self.nodes):
            raise ValueError("impact graph requires a news node")
        if not any(node.role == "market" for node in self.nodes):
            raise ValueError("impact graph requires a market node")

        node_id_set = set(node_ids)
        evidence_id_set = set(evidence_ids)
        edge_id_set = set(edge_ids)
        reachable_node_ids = {node.id for node in self.nodes if node.role == "news"}
        for edge in self.edges:
            if edge.from_id not in node_id_set or edge.to not in node_id_set:
                raise ValueError(f"impact edge {edge.id} references an unknown node")
            if edge.from_id == edge.to:
                raise ValueError(f"impact edge {edge.id} cannot connect a node to itself")
            if not set(edge.evidenceIds).issubset(evidence_id_set):
                raise ValueError(f"impact edge {edge.id} references unknown evidence")
        for _ in self.nodes:
            newly_reachable = {
                edge.to for edge in self.edges if edge.from_id in reachable_node_ids
            }
            if newly_reachable.issubset(reachable_node_ids):
                break
            reachable_node_ids.update(newly_reachable)
        unreachable_node_ids = node_id_set - reachable_node_ids
        if unreachable_node_ids:
            raise ValueError(
                f"impact graph nodes are not reachable from news: {sorted(unreachable_node_ids)}"
            )
        for node in self.nodes:
            if not set(node.evidenceIds).issubset(evidence_id_set):
                raise ValueError(f"impact node {node.id} references unknown evidence")
        for scenario in self.scenarios:
            if not set(scenario.edgeIds).issubset(edge_id_set):
                raise ValueError("impact scenario references an unknown edge")
        return self


