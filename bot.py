import asyncio
import html
import json
import logging
import os
import sqlite3
from pathlib import Path

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup,
    KeyboardButton, Message, ReplyKeyboardMarkup, WebAppInfo,
)

logging.basicConfig(level=logging.INFO)

TOKEN = os.environ["BOT_TOKEN"]
WEBAPP_URL = os.environ["WEBAPP_URL"]  # https://USERNAME.github.io/REPO/
GROUP_ID = int(os.getenv("GROUP_ID", "0") or 0)
ADMIN_IDS = {int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()}

MENU = json.loads(Path(__file__).with_name("menu.json").read_text("utf-8"))
PRICES = {i["id"]: (i["name"], i["price"]) for c in MENU["cats"] for i in c["items"]}

db = sqlite3.connect(os.getenv("DB_PATH", "orders.db"))
db.execute(
    "create table if not exists orders("
    "id integer primary key autoincrement, user_id integer, total integer, "
    "status text default 'yangi', created text default current_timestamp)"
)
db.commit()

bot = Bot(TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()


def fmt(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def status_kb(oid: int, step: str) -> InlineKeyboardMarkup | None:
    if step == "new":
        rows = [("✅ Qabul qilish", "acc"), ("❌ Bekor qilish", "can")]
    elif step == "acc":
        rows = [("🍽 Tayyor", "rdy"), ("❌ Bekor qilish", "can")]
    else:
        return None
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=t, callback_data=f"o:{oid}:{a}") for t, a in rows]
    ])


@dp.message(CommandStart())
async def start(m: Message):
    kb = ReplyKeyboardMarkup(
        resize_keyboard=True,
        keyboard=[[KeyboardButton(text="🍽 Buyurtma berish", web_app=WebAppInfo(url=WEBAPP_URL))]],
    )
    await m.answer("Assalomu alaykum! Buyurtma berish uchun pastdagi tugmani bosing.", reply_markup=kb)


@dp.message(Command("id"))
async def show_ids(m: Message):
    await m.answer(f"Chat ID: <code>{m.chat.id}</code>\nSizning ID: <code>{m.from_user.id}</code>")


@dp.message(F.web_app_data)
async def on_order(m: Message):
    try:
        d = json.loads(m.web_app_data.data)
        lines, total = [], 0
        for iid, q in d["items"]:
            name, price = PRICES[iid]  # narx faqat serverdagi menu.json dan olinadi
            q = max(1, min(int(q), 50))
            total += price * q
            lines.append(f"• {html.escape(name)} × {q} = {fmt(price * q)}")
        if not lines:
            raise ValueError("empty")
        otype = "Yetkazib berish" if d.get("type") == "delivery" else "Olib ketish"
        place = (
            f"Manzil: {html.escape(str(d.get('address', ''))[:200])}"
            if d.get("type") == "delivery"
            else f"Filial: {html.escape(str(d.get('branch', ''))[:60])}"
        )
        phone = html.escape(str(d.get("phone", ""))[:20])
        note = html.escape(str(d.get("note", ""))[:200])
    except (KeyError, ValueError, TypeError, json.JSONDecodeError):
        await m.answer("Buyurtmani o‘qib bo‘lmadi. Iltimos, qaytadan urinib ko‘ring.")
        return

    if not GROUP_ID:
        await m.answer("Buyurtma qabul qilinmadi: bot hali sozlanmagan.")
        return

    cur = db.execute("insert into orders(user_id,total) values(?,?)", (m.from_user.id, total))
    db.commit()
    oid = cur.lastrowid
    user = f'<a href="tg://user?id={m.from_user.id}">{html.escape(m.from_user.full_name)}</a>'
    text = (
        f"🆕 <b>Buyurtma №{oid}</b>\n\n" + "\n".join(lines)
        + f"\n\n<b>Jami: {fmt(total)} so‘m</b> (naqd)\n{otype}\n{place}\nTelefon: {phone}\n"
        + (f"Izoh: {note}\n" if note else "")
        + f"Mijoz: {user}"
    )
    try:
        await bot.send_message(GROUP_ID, text, reply_markup=status_kb(oid, "new"))
    except Exception:
        logging.exception("Guruhga yuborib bo'lmadi")
        await m.answer("Buyurtmani yuborishda xatolik. Iltimos, birozdan so‘ng qayta urinib ko‘ring.")
        return
    await m.answer(f"✅ Buyurtma №{oid} qabul qilindi. Jami: {fmt(total)} so‘m. Holati haqida xabar beramiz.")


STATUS = {
    "acc": ("qabul qilindi", "✅ Buyurtmangiz qabul qilindi va tayyorlanmoqda."),
    "rdy": ("tayyor", "🍽 Buyurtmangiz tayyor!"),
    "can": ("bekor qilindi", "❌ Buyurtmangiz bekor qilindi."),
}


@dp.callback_query(F.data.startswith("o:"))
async def on_status(c: CallbackQuery):
    if c.from_user.id not in ADMIN_IDS:
        await c.answer("Sizda ruxsat yo‘q.", show_alert=True)
        return
    _, oid, act = c.data.split(":")
    row = db.execute("select user_id from orders where id=?", (oid,)).fetchone()
    if not row or act not in STATUS:
        await c.answer("Buyurtma topilmadi.", show_alert=True)
        return
    label, msg = STATUS[act]
    db.execute("update orders set status=? where id=?", (label, oid))
    db.commit()
    await c.message.edit_text(
        c.message.html_text + f"\n\n<b>Holat:</b> {label}",
        reply_markup=status_kb(int(oid), act),
    )
    try:
        await bot.send_message(row[0], f"№{oid}: {msg}")
    except Exception:
        logging.warning("Mijozga xabar yuborib bo'lmadi")
    await c.answer("Yangilandi")


async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
