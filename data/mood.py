import json
from datetime import datetime, timedelta
from pathlib import Path

from config import TZ

MOOD_FILE = Path("mood.json")

MOOD_LEVELS = {
    1: "😞 Juda yomon",
    2: "😕 Yomon",
    3: "😐 Normal",
    4: "😊 Yaxshi",
    5: "😄 Ajoyib",
}


def load_mood() -> dict:
    if MOOD_FILE.exists():
        with open(MOOD_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_mood(data: dict) -> None:
    with open(MOOD_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def add_mood(user_id: int, score: int, note: str = "") -> None:
    data  = load_mood()
    uid   = str(user_id)
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    if uid not in data:
        data[uid] = {}
    data[uid][today] = {
        "score": score,
        "note":  note,
        "time":  datetime.now(TZ).strftime("%H:%M"),
    }
    save_mood(data)


def get_today_mood(user_id: int) -> dict | None:
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    return load_mood().get(str(user_id), {}).get(today)


def get_weekly_mood(user_id: int) -> list:
    data  = load_mood().get(str(user_id), {})
    today = datetime.now(TZ).date()
    result = []
    for i in range(6, -1, -1):
        day     = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        result.append({"date": day_str, "entry": data.get(day_str)})
    return result


def get_mood_avg(user_id: int) -> float | None:
    weekly = get_weekly_mood(user_id)
    scores = [w["entry"]["score"] for w in weekly if w["entry"]]
    if not scores:
        return None
    return round(sum(scores) / len(scores), 1)


def get_total_mood_days(user_id: int) -> int:
    return len(load_mood().get(str(user_id), {}))
