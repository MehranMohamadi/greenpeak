from pymongo import DESCENDING


class MongoRuleRepository:
    def __init__(self, client, database: str):
        self.collection = client[database].gp_rule_score_snapshots

    def ensure_indexes(self):
        self.collection.create_index([("level", 1), ("subject_id", 1), ("as_of_date", -1), ("rule_config_version", 1), ("rule_config_hash", 1)], unique=True)

    def save(self, document: dict):
        self.collection.update_one({key: document[key] for key in ("level", "subject_id", "as_of_date", "rule_config_version", "rule_config_hash")}, {"$setOnInsert": document}, upsert=True)

    def latest(self, level: str, subject_id: str):
        return self.collection.find_one({"level": level, "subject_id": subject_id}, {"_id": False}, sort=[("as_of_date", DESCENDING), ("calculated_at", DESCENDING)])
