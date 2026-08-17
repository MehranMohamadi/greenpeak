from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path

PROMPT_ROOT = Path(__file__).resolve().parents[4] / "prompts" / "greenpeak"


@dataclass(frozen=True)
class PromptPack:
    version: str
    content: str
    hash: str


def load_prompt(level: str, root: Path = PROMPT_ROOT) -> PromptPack:
    if level not in {"indicator", "domain", "market"}:
        raise ValueError("unknown analysis level")
    parts = [(root / "core_system.md").read_text(encoding="utf-8"), (root / f"{level}_analysis.md").read_text(encoding="utf-8")]
    versions = [part.splitlines()[0].split(":", 1)[1].strip() for part in parts]
    content = "\n\n".join(parts)
    return PromptPack("+".join(versions), content, "sha256:" + sha256(content.encode("utf-8")).hexdigest())
