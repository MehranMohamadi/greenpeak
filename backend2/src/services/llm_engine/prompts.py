from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path

from .prompt_store import PromptStore

PROMPT_ROOT = Path(__file__).resolve().parents[4] / "prompts" / "greenpeak"
PROMPT_DEFINITIONS = {
    "core_system": ("core_system.md", "دستور مشترک تحلیل‌ها", "دستور مشترک تحلیل شاخص، گروه و گزارش بازار"),
    "indicator": ("indicator_analysis.md", "تحلیل شاخص", "تفسیر ویژگی‌ها و وضعیت هر شاخص"),
    "domain": ("domain_analysis.md", "تحلیل گروه", "جمع‌بندی شاخص‌های هر گروه تحلیلی"),
    "market": ("market_analysis.md", "گزارش بازار آمریکا", "جریان بازار، افق‌های زمانی و عوامل اثرگذار بر بازار"),
    "news": ("news_analysis.md", "تحلیل خبر", "ترجمه و تفسیر خبر و ترسیم زنجیرهٔ اثر آن بر بازار"),
    "chat_planner": ("chat_planner.md", "دستیار: انتخاب شواهد", "انتخاب داده‌های لازم برای پاسخ به سؤال کاربر"),
    "chat_answer": ("chat_answer.md", "دستیار: تولید پاسخ", "پاسخ دستیار با استفاده از شواهد دریافت‌شده"),
}


class UnknownPrompt(ValueError):
    pass


@dataclass(frozen=True)
class PromptPack:
    version: str
    content: str
    hash: str


def get_prompt_store():
    from ...core.config import get_settings
    return PromptStore(get_settings().greenpeak_llm_router_db_path)


def default_prompt(prompt_id: str, root: Path = PROMPT_ROOT) -> PromptPack:
    if prompt_id not in PROMPT_DEFINITIONS:
        raise UnknownPrompt("Unknown prompt")
    raw = (root / PROMPT_DEFINITIONS[prompt_id][0]).read_text(encoding="utf-8")
    header, body = raw.split("\n", 1)
    version = header.split(":", 1)[1].strip()
    content = body.lstrip("\n")
    return PromptPack(version, content, "sha256:" + sha256(content.encode("utf-8")).hexdigest())


def _component(prompt_id, overrides, root):
    default = default_prompt(prompt_id, root)
    saved = overrides.get(prompt_id)
    if saved:
        version = f"{saved['base_version']}-admin.{saved['revision']}"
        content = saved["content"]
    else:
        version, content = default.version, default.content
    # Preserve the exact default analysis files, including their version header.
    if saved:
        raw = f"prompt_version: {version}\n\n{content}"
    else:
        raw = (root / PROMPT_DEFINITIONS[prompt_id][0]).read_text(encoding="utf-8")
    return version, content, raw


def load_text_prompt(prompt_id: str) -> PromptPack:
    version, content, _ = _component(prompt_id, get_prompt_store().current(), PROMPT_ROOT)
    return PromptPack(version, content, "sha256:" + sha256(content.encode("utf-8")).hexdigest())


def load_prompt(level: str, root: Path = PROMPT_ROOT) -> PromptPack:
    if level not in {"indicator", "domain", "market"}:
        raise ValueError("unknown analysis level")
    overrides = get_prompt_store().current() if root == PROMPT_ROOT else {}
    components = [_component(prompt_id, overrides, root) for prompt_id in ("core_system", level)]
    versions = [item[0] for item in components]
    parts = [item[2] for item in components]
    content = "\n\n".join(parts)
    return PromptPack("+".join(versions), content, "sha256:" + sha256(content.encode("utf-8")).hexdigest())


def prompt_catalog(store=None):
    store = store or get_prompt_store()
    overrides = store.current()
    components = {key: _component(key, overrides, PROMPT_ROOT) for key in PROMPT_DEFINITIONS}
    documents = []
    for key, (_, title, description) in PROMPT_DEFINITIONS.items():
        default = default_prompt(key)
        version, content, raw = components[key]
        if key in {"indicator", "domain", "market"}:
            effective = "\n\n".join((components["core_system"][2], raw))
        else:
            effective = raw if key == "core_system" else content
        saved = overrides.get(key)
        documents.append({
            "id": key, "title": title, "description": description,
            "content": content, "default_content": default.content,
            "version": version, "revision": saved["revision"] if saved else 0,
            "customized": content != default.content, "updated_at": saved["updated_at"] if saved else None,
            "effective_content": effective,
            "effective_hash": "sha256:" + sha256(effective.encode("utf-8")).hexdigest(),
        })
    return {"prompts": documents}
