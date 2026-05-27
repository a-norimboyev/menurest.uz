import json
import uuid
from datetime import datetime
from pathlib import Path

from config import TZ

GOALS_FILE = Path("goals.json")


def load_goals() -> dict:
    if GOALS_FILE.exists():
        with open(GOALS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_goals(data: dict) -> None:
    with open(GOALS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def add_goal(user_id: int, title: str, deadline_days: int = 0) -> str:
    data = load_goals()
    uid  = str(user_id)
    if uid not in data:
        data[uid] = []
    goal_id = str(uuid.uuid4())
    data[uid].append({
        "id":            goal_id,
        "title":         title,
        "progress":      0,
        "deadline_days": deadline_days,
        "started":       datetime.now(TZ).strftime("%Y-%m-%d"),
        "done":          False,
        "finished":      None,
    })
    save_goals(data)
    return goal_id


def get_user_goals(user_id: int) -> list:
    return load_goals().get(str(user_id), [])


def update_progress(user_id: int, goal_id: str, progress: int) -> dict | None:
    data  = load_goals()
    uid   = str(user_id)
    goals = data.get(uid, [])
    goal  = next((g for g in goals if g["id"] == goal_id), None)
    if goal:
        goal["progress"] = min(progress, 100)
        if goal["progress"] >= 100:
            goal["done"]     = True
            goal["finished"] = datetime.now(TZ).strftime("%Y-%m-%d")
        save_goals(data)
    return goal


def delete_goal(user_id: int, goal_id: str) -> dict | None:
    data  = load_goals()
    uid   = str(user_id)
    goals = data.get(uid, [])
    goal  = next((g for g in goals if g["id"] == goal_id), None)
    if goal:
        data[uid] = [g for g in goals if g["id"] != goal_id]
        save_goals(data)
    return goal


def get_done_goals_count(user_id: int) -> int:
    return len([g for g in get_user_goals(user_id) if g["done"]])
