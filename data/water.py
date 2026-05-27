import json
from datetime import datetime
from pathlib import Path

from config import TZ

WATER_FILE = Path("water.json")


def load_water() -> dict:
    if WATER_FILE.exists():
        with open(WATER_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_water(data: dict) -> None:
    with open(WATER_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def set_water_reminder(user_id: int, interval_hours: int) -> None:
    data = load_water()
    uid  = str(user_id)
    if uid not in data:
        data[uid] = {"enabled": False, "interval": 2, "drank": {}}
    data[uid]["enabled"]  = True
    data[uid]["interval"] = interval_hours
    save_water(data)


def disable_water_reminder(user_id: int) -> None:
    data = load_water()
    uid  = str(user_id)
    if uid in data:
        data[uid]["enabled"] = False
        save_water(data)


def get_water_settings(user_id: int) -> dict:
    return load_water().get(str(user_id), {"enabled": False, "interval": 2, "drank": {}})


def log_drank(user_id: int) -> int:
    data  = load_water()
    uid   = str(user_id)
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    if uid not in data:
        data[uid] = {"enabled": False, "interval": 2, "drank": {}}
    data[uid].setdefault("drank", {})
    data[uid]["drank"].setdefault(today, 0)
    data[uid]["drank"][today] += 1
    save_water(data)
    return data[uid]["drank"][today]


def get_today_drank(user_id: int) -> int:
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    return load_water().get(str(user_id), {}).get("drank", {}).get(today, 0)


def get_all_enabled_users() -> dict:
    """Bot qayta ishga tushganda interval joblarini tiklash uchun."""
    data = load_water()
    return {uid: info for uid, info in data.items() if info.get("enabled")}


def get_water_days_count(user_id: int) -> int:
    drank = load_water().get(str(user_id), {}).get("drank", {})
    return len([d for d, c in drank.items() if c > 0])
