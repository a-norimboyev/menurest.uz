import json
import uuid
from datetime import datetime
from pathlib import Path

from config import TZ

EXPENSE_FILE = Path("expenses.json")


def load_expenses() -> dict:
    if EXPENSE_FILE.exists():
        with open(EXPENSE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_expenses(data: dict) -> None:
    with open(EXPENSE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def add_expense(user_id: int, amount: float, category: str) -> None:
    data = load_expenses()
    uid  = str(user_id)
    if uid not in data:
        data[uid] = {"expenses": [], "limit": 0}
    data[uid]["expenses"].append({
        "id":       str(uuid.uuid4()),
        "amount":   amount,
        "category": category,
        "date":     datetime.now(TZ).strftime("%Y-%m-%d"),
        "time":     datetime.now(TZ).strftime("%H:%M"),
    })
    save_expenses(data)


def set_limit(user_id: int, limit: float) -> None:
    data = load_expenses()
    uid  = str(user_id)
    if uid not in data:
        data[uid] = {"expenses": [], "limit": 0}
    data[uid]["limit"] = limit
    save_expenses(data)


def get_limit(user_id: int) -> float:
    return load_expenses().get(str(user_id), {}).get("limit", 0)


def get_today_expenses(user_id: int) -> list:
    today    = datetime.now(TZ).strftime("%Y-%m-%d")
    expenses = load_expenses().get(str(user_id), {}).get("expenses", [])
    return [e for e in expenses if e["date"] == today]


def get_month_expenses(user_id: int) -> list:
    month    = datetime.now(TZ).strftime("%Y-%m")
    expenses = load_expenses().get(str(user_id), {}).get("expenses", [])
    return [e for e in expenses if e["date"].startswith(month)]


def get_total(expenses: list) -> float:
    return sum(e["amount"] for e in expenses)


def delete_last_expense(user_id: int) -> dict | None:
    data     = load_expenses()
    uid      = str(user_id)
    expenses = data.get(uid, {}).get("expenses", [])
    if not expenses:
        return None
    last = expenses.pop()
    save_expenses(data)
    return last


def get_total_expense_count(user_id: int) -> int:
    return len(load_expenses().get(str(user_id), {}).get("expenses", []))
