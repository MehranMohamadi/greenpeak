from pymongo import ASCENDING, DESCENDING

COLLECTIONS = {"indicator": "gp_indicator_narrative_snapshots", "domain": "gp_domain_narrative_snapshots", "market": "gp_market_narrative_snapshots"}


class MongoNarrativeRepository:
    def __init__(self, client, database: str):
        self.db = client[database]

    def ensure_indexes(self):
        for collection in COLLECTIONS.values():
            self.db[collection].create_index([("subject_id", ASCENDING), ("as_of_date", DESCENDING), ("analysis_generated_at", DESCENDING)])
            self.db[collection].create_index([("provenance.input_hash", ASCENDING), ("provenance.model", ASCENDING)])
        self.db.gp_llm_runs.create_index("run_id", unique=True)

    def find_reusable(self, level: str, input_hash: str, model: str):
        return self.db[COLLECTIONS[level]].find_one({"provenance.input_hash": input_hash, "provenance.model": model}, {"_id": False})

    def save(self, level: str, document: dict):
        self.db[COLLECTIONS[level]].insert_one(document)

    def latest(self, level: str, subject_id: str):
        return self.db[COLLECTIONS[level]].find_one({"subject_id": subject_id}, {"_id": False}, sort=[("as_of_date", DESCENDING), ("analysis_generated_at", DESCENDING)])

    def save_run(self, document: dict):
        self.db.gp_llm_runs.insert_one(document)
