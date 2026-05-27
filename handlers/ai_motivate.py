"""
AI Motivatsiya — ikki rejim:
  1. ANTHROPIC_API_KEY .env da bo'lsa → Claude AI shaxsiy xabar yozadi
  2. Bo'lmasa → mahalliy aqlli tizim statistikaga qarab xabar tanlaydi
"""
import logging
import os
import random

from telegram import Update
from telegram.ext import ContextTypes

from data.achievements import ALL_ACHIEVEMENTS, get_user_achievements
from data.goals import get_user_goals
from data.habits import get_streak, get_user_habits, get_weekly_stats
from data.mood import get_mood_avg, get_today_mood
from keyboards import MAIN_MENU

logger = logging.getLogger(__name__)

# ─── Mahalliy motivatsiya xabarlari ──────────────────────────────────────────

_HIGH_STREAK = [
    "🔥 {streak} kun ketma-ket! Siz haqiqiy chempionsiz — bu ko'pchilik erisholmaydigan natija!",
    "💪 {streak} kunlik streak — bu shunchaki raqam emas, bu sizning irodangiz! Davom eting!",
    "🏆 {streak} kun uzluksiz! Har kun qilingan kichik qadam bugun katta natijalarga olib keldi!",
    "⚡ {streak} kun! Bilasizmi, 21 kun odatni shakllantiradi deyishadi — siz allaqachon o'tib ketdingiz!",
]

_MEDIUM_STREAK = [
    "🌱 {streak} kun davom ettirdingiz — siz to'g'ri yo'ldasiz! Hech to'xtamang.",
    "✨ {streak} kunlik streak — har kuni oz bo'lsa ham harakat qilish — buyuk kuch!",
    "🎯 {streak} kun! Bugun ham bajarsangiz, ertaga yanada osonlashadi. Davom eting!",
]

_LOW_STREAK = [
    "🌟 Boshlash — eng qiyin qadam. Siz allaqachon uni qildingiz! Bugun ham bajaring.",
    "💡 Har bir chempion ham bir kundan boshlagan. Sizning vaqtingiz endi boshlandi!",
    "🚀 Kichik qadam, lekin to'g'ri yo'nalishda — bu hammadan muhim!",
]

_FULL_DONE = [
    "🎉 Bugun barcha vazifalar bajarildi! Siz haqiqatan ham ajoyibsiz!",
    "✅ 100%! Bugungi siz — ertangi muvaffaqiyatingizning asosi!",
    "🏅 Hammasi bajarilib bo'ldi! Bugun o'zingizga g'urur bilan qarang.",
]

_PARTIAL_DONE = [
    "💪 Bugungi vazifalar qoldi — lekin kun hali tugamadi! Yana birini bajaring.",
    "⚡ Boshlangan ish — yarim bajarilgan ish! Davom eting, qila olasiz!",
    "🎯 Har bir bajarilgan vazifa — keyingisiga kuch beradi. Davom eting!",
]

_GOOD_MOOD = [
    "😊 Kayfiyatingiz yaxshi — bu katta quvvat! Bugun barcha maqsadlarga intiling.",
    "✨ Yaxshi kayfiyat — eng yaxshi vaqt harakat qilish uchun! Foydalaning.",
]

_BAD_MOOD = [
    "🌧 Kayfiyat past bo'lganda ham davom etish — haqiqiy kuch belgisi. Siz buni uddalaysiz!",
    "💙 Yomon kunlar ham o'tadi. Bugun faqat bitta kichik qadam qo'ying — bu yetarli.",
    "🌅 Har bir tun tugaydi. Siz bugun ham kuchliligingizni isbotladingiz — oldinga!",
]

_GOALS_ACTIVE = [
    "🎯 {goals} ta maqsad siz bilan — har kuni ularga bir qadam yaqinlashyapsiz!",
    "🚀 Maqsadlar sizni kuta boshladi. Bugun ular tomon nima qildingiz?",
]

_ACHIEVEMENTS = [
    "🏆 {count} ta yutuq qozonildi — bu sizning qo'ygan izingiz! Ko'proq yutuqlar kutmoqda.",
    "🥇 {count} ta badge — har biri qilingan kuchli ish nishoni! Davom eting.",
]

_GENERAL = [
    "💫 Har kuni o'zingizni biroz yaxshilash — hayotingizni o'zgartiradi. Bugun ham shunday!",
    "🌟 Siz tanlagan yo'l — qiyin, lekin to'g'ri yo'l. Davom eting!",
    "⚡ Katta natijalar kichik kunlik harakatlardan tug'iladi. Bugungi harakatingiz qimmatli!",
    "🔑 Muvaffaqiyat — bir martalik hodisa emas, kunlik tanlov. Siz bugun to'g'ri tanlov qildingiz!",
    "💪 O'zingizga ishoning — chunki siz allaqachon ko'p narsani uddaladingiz!",
]


def _local_motivate(user_id: int) -> str:
    streak  = get_streak(user_id)
    tasks   = get_user_habits(user_id)
    weekly  = get_weekly_stats(user_id)
    mood    = get_today_mood(user_id)
    goals   = [g for g in get_user_goals(user_id) if not g["done"]]
    achs    = {k: v for k, v in get_user_achievements(user_id).items() if not k.startswith("_")}

    lines = []

    # Streak bo'yicha
    if streak >= 30:
        lines.append(random.choice(_HIGH_STREAK).format(streak=streak))
    elif streak >= 7:
        lines.append(random.choice(_MEDIUM_STREAK).format(streak=streak))
    elif streak >= 1:
        lines.append(random.choice(_LOW_STREAK))

    # Vazifalar bo'yicha
    if weekly:
        today_pct = weekly[-1]["pct"] if weekly else 0
        if today_pct == 100:
            lines.append(random.choice(_FULL_DONE))
        elif tasks:
            lines.append(random.choice(_PARTIAL_DONE))

    # Kayfiyat bo'yicha
    if mood:
        if mood["score"] >= 4:
            lines.append(random.choice(_GOOD_MOOD))
        elif mood["score"] <= 2:
            lines.append(random.choice(_BAD_MOOD))

    # Maqsadlar bo'yicha
    if goals and random.random() > 0.4:
        lines.append(random.choice(_GOALS_ACTIVE).format(goals=len(goals)))

    # Yutuqlar bo'yicha
    if len(achs) > 0 and random.random() > 0.5:
        lines.append(random.choice(_ACHIEVEMENTS).format(count=len(achs)))

    # Agar hech narsa tanlilmasa — umumiy
    if not lines:
        lines.append(random.choice(_GENERAL))

    # Eng ko'pi 3 ta gapni tanlash
    selected = lines[:3] if len(lines) > 3 else lines
    return "\n\n".join(selected)


# ─── Asosiy handler ───────────────────────────────────────────────────────────

async def motivate_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()

    # ── 1. Claude AI orqali ──────────────────────────────────────────────────
    if api_key:
        try:
            import anthropic
        except ImportError:
            api_key = ""  # kutubxona yo'q — mahalliy rejimga o'tish

    if api_key:
        msg = await update.message.reply_text("🤖 AI motivatsiya tayyorlanmoqda...")

        streak   = get_streak(user_id)
        tasks    = get_user_habits(user_id)
        weekly   = get_weekly_stats(user_id)
        mood     = get_today_mood(user_id)
        mood_avg = get_mood_avg(user_id)
        goals    = get_user_goals(user_id)
        achs     = get_user_achievements(user_id)

        weekly_pct   = round(sum(w["pct"] for w in weekly) / len(weekly), 0) if weekly else 0
        active_goals = [g for g in goals if not g["done"]]
        done_goals   = [g for g in goals if g["done"]]
        ach_names    = [ALL_ACHIEVEMENTS.get(a, {}).get("name", "") for a in achs if not a.startswith("_")]
        mood_val     = str(mood["score"]) if mood else "kiritilmagan"
        avg_val      = f"{mood_avg}/5" if mood_avg else "malumot yoq"
        ach_val      = ", ".join(ach_names[:6]) if ach_names else "hali yoq"

        user_ctx = (
            f"- Streak: {streak} kun ketma-ket\n"
            f"- Kunlik odatlar soni: {len(tasks)}\n"
            f"- Haftalik ortacha bajarilishi: {weekly_pct:.0f}%\n"
            f"- Bugungi kayfiyat: {mood_val}/5\n"
            f"- Haftalik ortacha kayfiyat: {avg_val}\n"
            f"- Faol maqsadlar: {len(active_goals)} ta\n"
            f"- Tugallangan maqsadlar: {len(done_goals)} ta\n"
            f"- Qozonilgan yutuqlar: {ach_val}\n"
        )

        try:
            import anthropic as _anthropic
            client  = _anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=400,
                system=(
                    "Sen o'zbek tilida shaxsiy motivatsiya kouchi bo'lib, "
                    "qisqa, ilhomlantiruvchi va samimiy xabar yozasan. "
                    "Foydalanuvchi statistikasiga qarab shaxsiy, dalda beruvchi xabar yoz. "
                    "Emoji ishlat. 4-6 jumladan oshma."
                ),
                messages=[{
                    "role": "user",
                    "content": f"Mening bugungi statistikam:\n{user_ctx}\nMenga motivatsion xabar yoz.",
                }],
            )
            text = message.content[0].text
            await msg.edit_text(
                f"🤖 *AI Motivatsiya:*\n\n{text}",
                parse_mode="Markdown",
                reply_markup=MAIN_MENU,
            )
            return
        except Exception as e:
            logger.error(f"Claude API xato: {e}")
            # xato bo'lsa mahalliy rejimga o'tish
            await msg.delete()

    # ── 2. Mahalliy aqlli tizim (API kerak emas) ─────────────────────────────
    text = _local_motivate(user_id)
    streak = get_streak(user_id)
    streak_line = f"🔥 Streak: *{streak} kun*\n\n" if streak >= 1 else ""

    await update.message.reply_text(
        f"💪 *Motivatsiya*\n\n{streak_line}{text}",
        parse_mode="Markdown",
        reply_markup=MAIN_MENU,
    )
