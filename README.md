# Tez Taom — Telegram Mini App

Mini App frontend GitHub Pages'da, buyurtma API va Telegram webhook esa Cloudflare Workers'da ishlaydi. Render talab qilinmaydi.

## 1. GitHub Pages
Repository Settings → Pages → Deploy from a branch → main / (root).
Mini App URL: https://infoschooluz.github.io/tez-taom-bot/

## 2. Cloudflare Worker
1. Cloudflare hisobiga kiring: https://dash.cloudflare.com/
2. Workers & Pages → Create → Worker yarating (nomi masalan `tez-taom-api`).
3. `worker.js` kodini Worker editoriga joylang va Deploy qiling.
4. Worker → Settings → Variables and Secrets bo‘limida quyidagi qiymatlarni qo‘shing:
   - `BOT_TOKEN` — BotFather bergan token (Secret).
   - `GROUP_ID` — buyurtmalar guruhi chat ID raqami (masalan -100...).
   - `ADMIN_IDS` — administrator Telegram ID raqamlari, vergul bilan (masalan 123456,789012).
   - `WEBHOOK_SECRET` — tasodifiy uzun maxfiy satr (Secret; faqat A-Z, a-z, 0-9, underscore va tire ishlating).
5. Worker URL manzilini oling, masalan `https://tez-taom-api.<sizning-subdomain>.workers.dev`.
6. `index.html` ichidagi `API_URL` qiymatini aynan shu Worker URL'iga almashtiring va GitHub'ga commit qiling.
7. Worker'da `/health` manzilini ochib `{"ok":true}` javobini tekshiring.

## 3. Telegram webhook'ni ulash
Eski Render'dagi polling bot ishlayotgan bo‘lsa, avval uni STOP qiling. Telegram'da webhook va getUpdates polling bir vaqtda ishlamaydi.

Quyidagi URL'ni brauzerda oching; `<BOT_TOKEN>`, `<WORKER_URL>` va `<WEBHOOK_SECRET>` o‘rniga o‘zingizning qiymatlaringizni qo‘ying:

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>/telegram/webhook&secret_token=<WEBHOOK_SECRET>
```

Javobda `"ok":true` chiqishi kerak. Tokenni hech kimga yubormang va GitHub'ga joylamang.

## 4. BotFather
BotFather → /setmenubutton → botni tanlang → URL:
`https://infoschooluz.github.io/tez-taom-bot/`
Tugma nomi: `🍔 Buyurtma berish`

## 5. Buyurtma oqimi
- Mini App Telegram `initData` ni API'ga yuboradi.
- Worker imzoni tekshiradi va narxlarni serverdagi menyu ro‘yxatidan hisoblaydi.
- Buyurtma guruhga yuboriladi.
- Admin guruhdagi inline tugmalar orqali qabul qiladi, tayyorlaydi yoki bekor qiladi; mijozga bot xabar beradi.

## Eslatma
- Bot tokenini hech qachon frontend yoki GitHub repozitoriyga yozmang.
- Bot guruhga qo‘shilgan va xabar yuborish huquqiga ega bo‘lishi kerak.
- Admin ID'larini `ADMIN_IDS` ga kiriting.
- `bot.py` avvalgi polling varianti sifatida qoldirilgan; Worker webhook rejimi yoqilganda Render'dagi eski polling jarayonini to‘xtating.
- Bepul Cloudflare Workers tarifida limitlar mavjud; amaldagi shartlarni Cloudflare tarif sahifasidan tekshiring.
