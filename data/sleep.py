import json
from datetime import datetime, timedelta
from pathlib import Path

from config import TZ

SLEEP_FILE = Path("sleep.json")


def load_sleep() -> dict:
    if SLEEP_FILE.exists():
        with open(SLEEP_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_sleep(data: dict) -> None:
    with open(SLEEP_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def log_sleep_time(user_id: int, sleep_time: str) -> None:
    data  = load_sleep()
    uid   = str(user_id)
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    if uid not in data:
        data[uid] = {}
    data[uid].setdefault(today, {})
    data[uid][today]["sleep"] = sleep_time
    save_sleep(data)


def log_wake_time(user_id: int, wake_time: str) -> float | None:
    data  = load_sleep()
    uid   = str(user_id)
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    if uid not in data:
        data[uid] = {}
    data[uid].setdefault(today, {})
    data[uid][today]["wake"] = wake_time

    duration   = None
    sleep_time = data[uid][today].get("sleep")
    if sleep_time:
        try:
            s = datetime.strptime(sleep_time, "%H:%M")
            w = datetime.strptime(wake_time,  "%H:%M")
            if w < s:       # tun yarim kechadan o'tib uxlagan
                w += timedelta(days=1)
            diff     = w - s
            duration = round(diff.seconds / 3600, 1)
            data[uid][today]["duration"] = duration
        except Exception:
            pass

    save_sleep(data)
    return duration


def get_weekly_sleep(user_id: int) -> list:
    data  = load_sleep().get(str(user_id), {})
    today = datetime.now(TZ).date()
    result = []
    for i in range(6, -1, -1):
        day     = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        result.append({"date": day_str, "entry": data.get(day_str, {})})
    return result


def get_avg_sleep(user_id: int) -> float | None:
    weekly    = get_weekly_sleep(user_id)
    durations = [w["entry"].get("duration") for w in weekly if w["entry"].get("duration")]
    if not durations:
        return None
    return round(sum(durations) / len(durations), 1)


def get_sleep_days_count(user_id: int) -> int:
    data = load_sleep().get(str(user_id), {})
    return len([d for d, e in data.items() if e.get("sleep") or e.get("wake")])
