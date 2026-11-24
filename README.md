# Tez Taom - Telegram Mini App (buyurtma boti)

Mijoz botdagi "Buyurtma berish" tugmasini bosadi, Mini App ochiladi (menyu, savat, olib ketish/yetkazish).
Buyurtma Telegram guruhiga tushadi, admin holatini o'zgartiradi, mijozga xabar boradi.

## Fayllar
- `index.html` - Mini App (GitHub Pages'da turadi)
- `menu.json` - menyu va narxlar (so'mda). Bot narxni FAQAT shu fayldan oladi
- `bot.py` - Python (aiogram 3) bot
- `requirements.txt`, `.env.example`

## Ishga tushirish
1. GitHub'da repo oching, hamma fayllarni yuklang (Add file > Upload files).
2. Settings > Pages > Deploy from a branch > main / (root). Manzil: `https://USERNAME.github.io/REPO/`
3. Botni hostingda ishga tushiring (start buyrug'i: `python bot.py`). Muhit o'zgaruvchilari:
   - `BOT_TOKEN` - BotFather tokeni (hech kimga bermang)
   - `WEBAPP_URL` - 2-qadamdagi manzil
   - `GROUP_ID` - buyurtmalar guruhi ID si
   - `ADMIN_IDS` - admin Telegram ID lari (vergul bilan)
4. ID lar: botga `/id` yozing (sizning ID), guruhda `/id` yozing (guruh ID, minus bilan boshlanadi).
   Keyin `GROUP_ID` va `ADMIN_IDS` ni hostingda kiritib, botni qayta ishga tushiring.

## Eslatma
- Bu birinchi versiya: faqat naqd to'lov. Click/Payme va AI qatlami keyingi bosqichda.
- Mini App `sendData` ishlatadi: faqat botdagi pastki tugma orqali ochilganda buyurtma yuboradi.
- Menyuni o'zgartirish: `menu.json` ni GitHub'da tahrirlang (bot ham qayta ishga tushsin).
