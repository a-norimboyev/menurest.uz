import json
import uuid
from datetime import datetime
from pathlib import Path

from config import TZ

BOOKS_FILE = Path("books.json")

STATUS_LABELS = {
    "queue":   "⏳ Navbatda",
    "reading": "📖 O'qiyapman",
    "done":    "✅ O'qildi",
}


def load_books() -> dict:
    if BOOKS_FILE.exists():
        with open(BOOKS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_books(data: dict) -> None:
    with open(BOOKS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def add_book(user_id: int, title: str) -> None:
    data = load_books()
    uid  = str(user_id)
    if uid not in data:
        data[uid] = []
    data[uid].append({
        "id":       str(uuid.uuid4()),
        "title":    title,
        "status":   "queue",
        "added":    datetime.now(TZ).strftime("%Y-%m-%d"),
        "finished": None,
    })
    save_books(data)


def get_user_books(user_id: int) -> list:
    return load_books().get(str(user_id), [])


def update_book_status(user_id: int, book_id: str, status: str) -> dict | None:
    data  = load_books()
    uid   = str(user_id)
    books = data.get(uid, [])
    book  = next((b for b in books if b["id"] == book_id), None)
    if book:
        book["status"] = status
        if status == "done":
            book["finished"] = datetime.now(TZ).strftime("%Y-%m-%d")
        save_books(data)
    return book


def delete_book(user_id: int, book_id: str) -> dict | None:
    data  = load_books()
    uid   = str(user_id)
    books = data.get(uid, [])
    book  = next((b for b in books if b["id"] == book_id), None)
    if book:
        data[uid] = [b for b in books if b["id"] != book_id]
        save_books(data)
    return book


def get_done_count(user_id: int) -> int:
    return len([b for b in get_user_books(user_id) if b["status"] == "done"])
