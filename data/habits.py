import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from config import TZ

HABITS_FILE = Path("habits.json")


def load_habits() -> dict:
    if HABITS_FILE.exists():
        with open(HABITS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_habits(data: dict) -> None:
    with open(HABITS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_user_habits(user_id: int) -> list:
    return load_habits().get(str(user_id), {}).get("tasks", [])


def get_today_completed(user_id: int) -> list:
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    return load_habits().get(str(user_id), {}).get("completed", {}).get(today, [])


def get_task_days_done(user_id: int, task_id: str) -> int:
    completed = load_habits().get(str(user_id), {}).get("completed", {})
    return sum(1 for day_ids in completed.values() if task_id in day_ids)


def toggle_habit(user_id: int, task_id: str) -> bool:
    data = load_habits()
    uid   = str(user_id)
    today = datetime.now(TZ).strftime("%Y-%m-%d")

    if uid not in data:
        data[uid] = {"tasks": [], "completed": {}}
    data[uid].setdefault("completed", {})
    data[uid]["completed"].setdefault(today, [])

    lst = data[uid]["completed"][today]
    if task_id in lst:
        lst.remove(task_id)
        done = False
    else:
        lst.append(task_id)
        done = True

    save_habits(data)
    return done


def get_streak(user_id: int) -> int:
    completed = load_habits().get(str(user_id), {}).get("completed", {})
    if not completed:
        return 0
    today     = datetime.now(TZ).date()
    today_str = today.strftime("%Y-%m-%d")
    start = today if (today_str in completed and completed[today_str]) \
            else today - timedelta(days=1)
    streak = 0
    check  = start
    while True:
        s = check.strftime("%Y-%m-%d")
        if s in completed and completed[s]:
            streak += 1
            check  -= timedelta(days=1)
        else:
            break
    return streak


def get_weekly_stats(user_id: int) -> list:
    completed = load_habits().get(str(user_id), {}).get("completed", {})
    tasks     = get_user_habits(user_id)
    if not tasks:
        return []
    today  = datetime.now(TZ).date()
    result = []
    for i in range(6, -1, -1):
        day     = today - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        done    = len(completed.get(day_str, []))
        total   = len(tasks)
        pct     = int((done / total) * 100) if total else 0
        result.append({"date": day_str, "done": done, "total": total, "pct": pct})
    return result


MILESTONES = {30, 60, 90, 120, 150, 180, 365}


def _mini_bar(done: int, total: int, width: int = 8) -> str:
    filled = min(int((done / total) * width), width)
    return "█" * filled + "░" * (width - filled)


def build_habits_keyboard(user_id: int) -> InlineKeyboardMarkup:
    tasks           = get_user_habits(user_id)
    completed_today = get_today_completed(user_id)
    keyboard        = []

    for task in tasks:
        duration  = task.get("duration", 0)
        days_done = get_task_days_done(user_id, task["id"])

        if duration > 0 and days_done >= duration:
            label = f"🏆 {task['text']} — {duration} kun TUGALLANDI!"
            keyboard.append([InlineKeyboardButton(label, callback_data="habit_finished")])
        elif duration > 0:
            checked = "✅" if task["id"] in completed_today else "☐"
            pct     = int((days_done / duration) * 100)
            label   = f"{checked} {task['text']}  {days_done}/{duration} ({pct}%)"
            keyboard.append([InlineKeyboardButton(label, callback_data=f"habit_{task['id']}")])
        else:
            checked = "✅" if task["id"] in completed_today else "☐"
            label   = f"{checked} {task['text']}"
            keyboard.append([InlineKeyboardButton(label, callback_data=f"habit_{task['id']}")])

    total = len(tasks)
    done  = len([t for t in tasks if t["id"] in completed_today])
    keyboard.append([
        InlineKeyboardButton(f"📊 {done}/{total} bajarildi", callback_data="habit_stats")
    ])
    return InlineKeyboardMarkup(keyboard)


def habits_header(user_id: int) -> str:
    tasks           = get_user_habits(user_id)
    completed_today = get_today_completed(user_id)
    today           = datetime.now(TZ).strftime("%Y-%m-%d")
    total           = len(tasks)
    done            = len([t for t in tasks if t["id"] in completed_today])

    if total == 0:
        return (
            "📌 *Kunlik vazifalar*\n\n"
            "Hali vazifalar yo'q.\n"
            "`/addhabit Matn` — doimiy\n"
            "`/addhabit Matn 20` — 20 kunlik"
        )

    progress    = int((done / total) * 10)
    bar         = "🟩" * progress + "⬜" * (10 - progress)
    streak      = get_streak(user_id)
    streak_line = f"🔥 *{streak} kun ketma-ket!*\n" if streak >= 2 else ""

    long_term = [t for t in tasks if t.get("duration", 0) > 0]
    goals_text = ""
    if long_term:
        goals_text = "\n🎯 *Maqsadlar:*\n"
        for t in long_term:
            days_done = get_task_days_done(user_id, t["id"])
            dur       = t["duration"]
            if days_done >= dur:
                goals_text += f"🏆 {t['text']}: *tugallandi!* ({dur}/{dur})\n"
            else:
                mini = _mini_bar(days_done, dur)
                pct  = int((days_done / dur) * 100)
                goals_text += f"📈 {t['text']}: `{mini}` {days_done}/{dur} kun ({pct}%)\n"

    return (
        f"📌 *Kunlik vazifalar — {today}*\n"
        f"{bar} {done}/{total}\n"
        f"{streak_line}"
        f"{goals_text}\n"
        "Tugmani bosib belgilang:"
    )


def check_milestone(user_id: int, task_id: str) -> int | None:
    days_done = get_task_days_done(user_id, task_id)
    if days_done in MILESTONES:
        return days_done
    return None


def add_task(user_id: int, text: str, duration: int = 0) -> None:
    data = load_habits()
    uid  = str(user_id)
    if uid not in data:
        data[uid] = {"tasks": [], "completed": {}}
    data[uid]["tasks"].append({
        "id":       str(uuid.uuid4()),
        "text":     text,
        "duration": duration,
        "started":  datetime.now(TZ).strftime("%Y-%m-%d"),
    })
    save_habits(data)


def remove_task(user_id: int, task_id: str) -> dict | None:
    data  = load_habits()
    uid   = str(user_id)
    tasks = data.get(uid, {}).get("tasks", [])
    task  = next((t for t in tasks if t["id"] == task_id), None)
    if task:
        data[uid]["tasks"] = [t for t in tasks if t["id"] != task_id]
        save_habits(data)
    return task
