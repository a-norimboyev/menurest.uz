import uuid
from datetime import datetime, timedelta

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from config import TZ, scheduler
from keyboards import MAIN_MENU
from data.reminders import (
    get_active_sorted,
    get_user_reminders,
    next_occurrence,
    set_user_reminders,
)


async def add_reminder(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    from jobs import send_reminder

    user_id = update.effective_user.id
    args    = context.args

    if len(args) < 3:
        await update.message.reply_text(
            "❌ Format: `/add SANA VAQT MATN`\n\nMisol: `/add ertaga 14:00 Vrach`",
            parse_mode="Markdown",
        )
        return

    date_str, time_str = args[0].lower(), args[1]
    text = " ".join(args[2:])
    now  = datetime.now(TZ)

    if date_str == "bugun":
        target_date = now.date()
    elif date_str == "ertaga":
        target_date = (now + timedelta(days=1)).date()
    else:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            await update.message.reply_text(
                "❌ Sana: `bugun`, `ertaga` yoki `YYYY-MM-DD`", parse_mode="Markdown"
            )
            return

    try:
        target_time = datetime.strptime(time_str, "%H:%M").time()
    except ValueError:
        await update.message.reply_text("❌ Vaqt: `HH:MM`", parse_mode="Markdown")
        return

    target_dt = TZ.localize(datetime.combine(target_date, target_time))
    if target_dt < now:
        await update.message.reply_text("⚠️ Bu vaqt o'tib ketgan!")
        return

    reminder_id = str(uuid.uuid4())
    reminders   = get_user_reminders(user_id)
    reminders.append({"id": reminder_id, "datetime": target_dt.isoformat(), "text": text})
    set_user_reminders(user_id, reminders)

    scheduler.add_job(
        send_reminder, "date",
        run_date=target_dt,
        args=[context.bot, user_id, text],
        id=f"reminder_{user_id}_{reminder_id}",
        replace_existing=True,
    )
    await update.message.reply_text(
        f"✅ Eslatma qo'shildi!\n\n📅 {target_dt.strftime('%Y-%m-%d %H:%M')}\n📝 {text}",
        reply_markup=MAIN_MENU,
    )


async def list_reminders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    active  = get_active_sorted(user_id)
    if not active:
        await update.message.reply_text("📭 Faol eslatmalar yo'q.", reply_markup=MAIN_MENU)
        return
    text = "📋 *Barcha eslatmalar:*\n\n"
    for i, r in enumerate(active, 1):
        dt    = datetime.fromisoformat(r["datetime"])
        label = "🔄 " if r.get("repeat") else "📅 "
        text += f"{i}. {label}{dt.strftime('%Y-%m-%d %H:%M')}\n   📝 {r['text']}\n\n"
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=MAIN_MENU)


async def today_reminders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _show_day(update, 0, "📅 *Bugungi reja:*")


async def tomorrow_reminders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await _show_day(update, 1, "📅 *Ertangi reja:*")


async def week_reminders(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id  = update.effective_user.id
    now      = datetime.now(TZ)
    week_end = now + timedelta(days=7)
    items = [
        r for r in get_user_reminders(user_id)
        if now < datetime.fromisoformat(r["datetime"]) <= week_end
    ]
    if not items:
        await update.message.reply_text("📭 Keyingi 7 kunda eslatmalar yo'q.", reply_markup=MAIN_MENU)
        return
    items.sort(key=lambda x: x["datetime"])
    days_uz = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]
    text = "🗓 *Haftalik reja (keyingi 7 kun):*\n"
    cur  = None
    for r in items:
        dt  = datetime.fromisoformat(r["datetime"])
        day = dt.strftime("%Y-%m-%d")
        if day != cur:
            cur   = day
            text += f"\n📆 *{day} — {days_uz[dt.weekday()]}*\n"
        text += f"  🕐 {dt.strftime('%H:%M')} — {r['text']}\n"
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=MAIN_MENU)


async def _show_day(update: Update, offset: int, title: str) -> None:
    user_id     = update.effective_user.id
    target_date = (datetime.now(TZ) + timedelta(days=offset)).date()
    items = [
        r for r in get_user_reminders(user_id)
        if datetime.fromisoformat(r["datetime"]).date() == target_date
    ]
    if not items:
        await update.message.reply_text(f"{title}\n\n📭 Bu kunda eslatmalar yo'q.", reply_markup=MAIN_MENU)
        return
    items.sort(key=lambda x: x["datetime"])
    text = f"{title}\n\n"
    for r in items:
        dt    = datetime.fromisoformat(r["datetime"])
        text += f"🕐 {dt.strftime('%H:%M')} — {r['text']}\n"
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=MAIN_MENU)


async def delete_reminder(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    active  = get_active_sorted(user_id)
    if not active:
        await update.message.reply_text("📭 O'chirish uchun faol eslatmalar yo'q.")
        return
    keyboard = []
    for r in active:
        dt    = datetime.fromisoformat(r["datetime"])
        label = f"🗑 {dt.strftime('%m-%d %H:%M')} — {r['text'][:25]}"
        keyboard.append([InlineKeyboardButton(label, callback_data=f"del_{r['id']}")])
    keyboard.append([InlineKeyboardButton("❌ Bekor qilish", callback_data="del_cancel")])
    await update.message.reply_text(
        "Qaysi eslatmani o'chirmoqchisiz?",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def delete_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query   = update.callback_query
    await query.answer()
    if query.data == "del_cancel":
        await query.edit_message_text("✅ Bekor qilindi.")
        return
    rid       = query.data.replace("del_", "", 1)
    user_id   = query.from_user.id
    reminders = get_user_reminders(user_id)
    to_del    = next((r for r in reminders if r["id"] == rid), None)
    if not to_del:
        await query.edit_message_text("❌ Eslatma topilmadi.")
        return
    reminders.remove(to_del)
    set_user_reminders(user_id, reminders)
    try:
        scheduler.remove_job(f"reminder_{user_id}_{rid}")
    except Exception:
        pass
    await query.edit_message_text(f"🗑 O'chirildi: *{to_del['text']}*", parse_mode="Markdown")


async def add_recurring(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    from jobs import send_recurring_reminder

    user_id = update.effective_user.id
    args    = context.args

    if len(args) < 3:
        await update.message.reply_text(
            "❌ Format: `/addr TAKROR VAQT MATN`\n\n"
            "`daily` — har kuni\n`weekly` — har hafta\n`monthly` — har oy\n\n"
            "Misol: `/addr daily 09:00 Sport`",
            parse_mode="Markdown",
        )
        return

    repeat, time_str = args[0].lower(), args[1]
    text = " ".join(args[2:])

    if repeat not in ("daily", "weekly", "monthly"):
        await update.message.reply_text("❌ Takror: `daily`, `weekly`, `monthly`", parse_mode="Markdown")
        return
    try:
        target_time = datetime.strptime(time_str, "%H:%M").time()
    except ValueError:
        await update.message.reply_text("❌ Vaqt: `HH:MM`", parse_mode="Markdown")
        return

    now       = datetime.now(TZ)
    target_dt = TZ.localize(datetime.combine(now.date(), target_time))
    if target_dt <= now:
        target_dt = next_occurrence(target_dt, repeat)

    rid       = str(uuid.uuid4())
    reminders = get_user_reminders(user_id)
    reminders.append({"id": rid, "datetime": target_dt.isoformat(), "text": text, "repeat": repeat})
    set_user_reminders(user_id, reminders)

    scheduler.add_job(
        send_recurring_reminder, "date",
        run_date=target_dt,
        args=[context.bot, user_id, rid],
        id=f"reminder_{user_id}_{rid}",
        replace_existing=True,
    )
    names = {"daily": "har kuni", "weekly": "har hafta", "monthly": "har oy"}
    await update.message.reply_text(
        f"✅ Takrorlanuvchi eslatma!\n\n🔄 {names[repeat]}, soat {time_str}\n📝 {text}",
        reply_markup=MAIN_MENU,
    )
