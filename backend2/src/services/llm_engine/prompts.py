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


def _update_schedules():
    from ...core.config import Settings, get_settings
    from ..analysis_schedule import analysis_slots

    settings = get_settings()
    defaults = Settings.model_fields

    def daily_summary(hour, minute, timezone):
        clock = f"{hour:02d}:{minute:02d}".translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
        timezone_label = "تهران" if timezone == "Asia/Tehran" else timezone
        return f"روزانه یک بار؛ شروع ساعت {clock} به وقت {timezone_label}"

    default_daily = daily_summary(
        defaults["greenpeak_daily_analysis_hour"].default,
        defaults["greenpeak_daily_analysis_minute"].default,
        defaults["greenpeak_daily_analysis_timezone"].default,
    )
    configured_daily = daily_summary(
        settings.greenpeak_daily_analysis_hour,
        settings.greenpeak_daily_analysis_minute,
        settings.greenpeak_daily_analysis_timezone,
    ) if settings.greenpeak_daily_analysis_enabled else "زمان‌بندی خودکار غیرفعال است."
    daily_details = (
        "این ساعت زمان شروع چرخه است؛ ابتدا شاخص‌ها، سپس گروه‌ها و در پایان گزارش بازار تولید می‌شود. "
        "اجرا به آماده بودن داده‌ها و سرویس مدل وابسته است؛ زمان پایان ثابت نیست."
    )
    schedules = {
        key: {"default_summary_fa": default_daily, "configured_summary_fa": configured_daily,
              "details_fa": daily_details}
        for key in ("core_system", "indicator", "domain", "market")
    }
    schedules["core_system"] = {**schedules["core_system"], "details_fa":
        "اجرای مستقل ندارد؛ همراه هر تحلیل شاخص، گروه و بازار استفاده می‌شود. " + daily_details}
    def market_summary(*, defaults=False):
        slots = analysis_slots(settings, defaults=defaults)
        if not slots:
            return "زمان‌بندی خودکار غیرفعال است."
        times = []
        for slot in slots:
            clock = f"{slot.hour:02d}:{slot.minute:02d}".translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
            zone = "تهران" if slot.timezone == "Asia/Tehran" else slot.timezone
            times.append(f"ساعت {clock} به وقت {zone}")
        frequency = "روزانه دو نوبت" if len(slots) == 2 else "روزانه یک بار"
        return f"{frequency}؛ شروع " + " و ".join(times)

    schedules["market"] = {
        "default_summary_fa": market_summary(defaults=True),
        "configured_summary_fa": market_summary(),
        "details_fa": "نوبت اول در پایان چرخهٔ تحلیل شاخص‌ها و گروه‌ها تولید می‌شود. "
                      "نوبت دوم فقط گزارش بازار را با خبرها و وضعیت تازهٔ شاخص و تحلیل‌های ذخیره‌شدهٔ گروه‌ها "
                      "به‌روز می‌کند. این ساعت‌ها زمان شروع اجرا هستند؛ زمان پایان ثابت نیست.",
    }
    schedules["core_system"]["default_summary_fa"] = schedules["market"]["default_summary_fa"]
    schedules["core_system"]["configured_summary_fa"] = schedules["market"]["configured_summary_fa"]
    schedules["core_system"]["details_fa"] = (
        "اجرای مستقل ندارد؛ همراه تحلیل شاخص، گروه و بازار و نوبت دوم گزارش بازار استفاده می‌شود. "
        + schedules["market"]["details_fa"]
    )
    for key, summary, details in (
        ("news", "با درخواست تحلیل خبر؛ بدون ساعت ثابت",
         "هنگام درخواست تحلیل یک خبر اجرا می‌شود. خروجی ذخیره‌شدهٔ سازگار دوباره استفاده می‌شود؛ "
         "در صورت تغییر پرامپت، با درخواست بعدی خبر دوباره تحلیل می‌شود."),
        ("chat_planner", "با هر پیام جدید کاربر؛ بدون ساعت ثابت",
         "مرحلهٔ اول دستیار است؛ پیش از دریافت شواهد و تولید پاسخ اجرا می‌شود."),
        ("chat_answer", "با هر پیام جدید کاربر؛ بدون ساعت ثابت",
         "پس از انتخاب و دریافت شواهد، برای تولید پاسخ همان پیام اجرا می‌شود."),
    ):
        schedules[key] = {"default_summary_fa": summary, "configured_summary_fa": summary,
                          "details_fa": details}
    return schedules


def prompt_catalog(store=None):
    store = store or get_prompt_store()
    overrides = store.current()
    components = {key: _component(key, overrides, PROMPT_ROOT) for key in PROMPT_DEFINITIONS}
    schedules = _update_schedules()
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
            "update_schedule": schedules[key],
        })
    return {"prompts": documents}
