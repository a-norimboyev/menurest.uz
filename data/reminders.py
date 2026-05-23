import json
from datetime import datetime, timedelta
from pathlib import Path

from config import TZ

DATA_FILE = Path("reminders.json")


def load_reminders() -> dict:
    if DATA_FILE.exists():
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_reminders(data: dict) -> None:
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_user_reminders(user_id: int) -> list:
    return load_reminders().get(str(user_id), [])


def set_user_reminders(user_id: int, reminders: list) -> None:
    data = load_reminders()
    data[str(user_id)] = reminders
    save_reminders(data)


def get_active_sorted(user_id: int) -> list:
    now = datetime.now(TZ)
    reminders = get_user_reminders(user_id)
    active = [r for r in reminders if datetime.fromisoformat(r["datetime"]) > now]
    return sorted(active, key=lambda x: x["datetime"])


def next_occurrence(dt: datetime, repeat: str) -> datetime:
    if repeat == "daily":
        return dt + timedelta(days=1)
    if repeat == "weekly":
        return dt + timedelta(weeks=1)
    if repeat == "monthly":
        month = dt.month + 1 if dt.month < 12 else 1
        year  = dt.year + (1 if dt.month == 12 else 0)
        try:
            return dt.replace(year=year, month=month)
        except ValueError:
            return dt.replace(year=year, month=month, day=28)
    return dt
