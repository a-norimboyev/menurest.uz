import json
from datetime import datetime
from pathlib import Path

from config import TZ

ACHIEVEMENTS_FILE = Path("achievements.json")

ALL_ACHIEVEMENTS: dict[str, dict] = {
    # Odatlar streaki
    "streak_7":   {"name": "🥉 Boshlang'ich",    "desc": "7 kun ketma-ket odatlar bajarilib"},
    "streak_30":  {"name": "🥈 Doimiy",           "desc": "30 kun ketma-ket odatlar bajarilib"},
    "streak_60":  {"name": "🏅 Bardoshli",         "desc": "60 kun ketma-ket odatlar bajarilib"},
    "streak_100": {"name": "🥇 Chempion",          "desc": "100 kun ketma-ket odatlar bajarilib"},
    "streak_365": {"name": "🏆 Afsona",            "desc": "365 kun ketma-ket odatlar bajarilib"},
    # Kayfiyat
    "mood_7":     {"name": "😊 Kayfiyat kuzatuvchi", "desc": "7 kun kayfiyat yozildi"},
    "mood_30":    {"name": "😄 Kayfiyat ustasi",     "desc": "30 kun kayfiyat yozildi"},
    # Xarajat
    "expense_10": {"name": "💰 Tejamkor",          "desc": "10 ta xarajat yozildi"},
    "expense_50": {"name": "💎 Moliyachi",          "desc": "50 ta xarajat yozildi"},
    # Kitoblar
    "book_1":     {"name": "📖 Kitobxon",           "desc": "Birinchi kitob o'qildi"},
    "book_5":     {"name": "📚 Bibliofil",          "desc": "5 ta kitob o'qildi"},
    "book_10":    {"name": "🎓 Olim",               "desc": "10 ta kitob o'qildi"},
    # Suv
    "water_7":    {"name": "💧 Suv ichuvchi",       "desc": "7 kun suv kuzatildi"},
    "water_30":   {"name": "🌊 Gidratlanган",       "desc": "30 kun suv kuzatildi"},
    # Maqsadlar
    "goal_1":     {"name": "🎯 Maqsadchi",          "desc": "Birinchi maqsad tugallandi"},
    "goal_5":     {"name": "🚀 Maqsadlar ustasi",   "desc": "5 ta maqsad tugallandi"},
    # Uyqu
    "sleep_7":    {"name": "😴 Uyqu kuzatuvchi",    "desc": "7 kun uyqu yozildi"},
    "sleep_30":   {"name": "🌙 Tungi muhofiz",      "desc": "30 kun uyqu yozildi"},
    # Fokus
    "focus_10":   {"name": "🍅 Fokuschi",           "desc": "10 ta Pomodoro taymeri tugallandi"},
    "focus_50":   {"name": "🧠 Konsentratsiya",     "desc": "50 ta Pomodoro taymeri tugallandi"},
}


def load_achievements() -> dict:
    if ACHIEVEMENTS_FILE.exists():
        with open(ACHIEVEMENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_achievements(data: dict) -> None:
    with open(ACHIEVEMENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def grant_achievement(user_id: int, achievement_id: str) -> bool:
    """True qaytaradi — yangi qozonilgan bo'lsa."""
    if achievement_id not in ALL_ACHIEVEMENTS:
        return False
    data = load_achievements()
    uid  = str(user_id)
    if uid not in data:
        data[uid] = {}
    if achievement_id not in data[uid]:
        data[uid][achievement_id] = datetime.now(TZ).strftime("%Y-%m-%d")
        save_achievements(data)
        return True
    return False


def get_user_achievements(user_id: int) -> dict:
    return load_achievements().get(str(user_id), {})


def get_pomodoro_count(user_id: int) -> int:
    data = load_achievements()
    uid  = str(user_id)
    return data.get(uid, {}).get("_pomodoro_count", 0)


def increment_pomodoro(user_id: int) -> int:
    data = load_achievements()
    uid  = str(user_id)
    if uid not in data:
        data[uid] = {}
    count = data[uid].get("_pomodoro_count", 0) + 1
    data[uid]["_pomodoro_count"] = count
    save_achievements(data)
    return count
