import logging
import os
import sys

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

load_dotenv()

BOT_TOKEN           = os.getenv("BOT_TOKEN", "")
TIMEZONE            = "Asia/Tashkent"
MORNING_DIGEST_HOUR = 8
EVENING_REPORT_HOUR = 21

TZ        = pytz.timezone(TIMEZONE)
scheduler = AsyncIOScheduler(timezone=TZ)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
