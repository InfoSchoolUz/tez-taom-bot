const MENU = {
  lavash: ["Lavash", 28000], burger: ["Burger", 32000], hotdog: ["Hot-dog", 18000],
  fri: ["Kartoshka fri", 15000], osh: ["Osh", 38000], shashlik: ["Shashlik (1 six)", 14000],
  lagmon: ["Lag‘mon", 30000], cola: ["Coca-Cola 0.5 l", 8000], choy: ["Choy", 5000], sok: ["Sok", 9000]
};
const CORS = {
  "Access-Control-Allow-Origin": "https://infoschooluz.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: {...CORS, "Content-Type": "application/json; charset=utf-8"}
});
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => new Intl.NumberFormat("uz-UZ").format(n);
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
}
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2,"0")).join("");
async function verifyInitData(initData, token) {
  if (!initData || !token) return null;
  const p = new URLSearchParams(initData), hash = p.get("hash");
  if (!hash) return null;
  p.delete("hash");
  const check = [...p.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => k+"="+v).join("\n");
  const secret = await hmac(new TextEncoder().encode("WebAppData"), token);
  if (hex(await hmac(secret, check)) !== hash) return null;
  const authDate = Number(p.get("auth_date") || 0);
  if (!authDate || Math.abs(Date.now()/1000-authDate) > 86400) return null;
  try { return JSON.parse(p.get("user") || "null"); } catch { return null; }
}
async function telegram(env, method, body) {
  const r = await fetch("https://api.telegram.org/bot"+env.BOT_TOKEN+"/"+method, {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.description || "Telegram API xatosi");
  return d.result;
}
function keyboard(userId, state) {
  if (state === "new") return {inline_keyboard:[[
    {text:"✅ Qabul qilish",callback_data:"o:"+userId+":acc"},
    {text:"❌ Bekor qilish",callback_data:"o:"+userId+":can"}
  ]]};
  if (state === "acc") return {inline_keyboard:[[
    {text:"🍽 Tayyor",callback_data:"o:"+userId+":rdy"},
    {text:"❌ Bekor qilish",callback_data:"o:"+userId+":can"}
  ]]};
  return {inline_keyboard:[]};
}
async function order(req, env) {
  const body = await req.json();
  const user = await verifyInitData(body.initData, env.BOT_TOKEN);
  if (!user || !user.id) return json({ok:false,error:"Telegram foydalanuvchisi tasdiqlanmadi. Botni qayta oching."},401);
  const d = body.order || {};
  if (!Array.isArray(d.items) || !d.items.length) return json({ok:false,error:"Savat bo‘sh."},400);
  const lines = []; let total = 0;
  for (const pair of d.items) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [id, rawQty] = pair, item = MENU[id], qty = Number(rawQty);
    if (!item || !Number.isInteger(qty) || qty < 1 || qty > 50) continue;
    total += item[1]*qty;
    lines.push("• "+esc(item[0])+" × "+qty+" = "+fmt(item[1]*qty));
  }
  if (!lines.length) return json({ok:false,error:"Buyurtmadagi taomlar noto‘g‘ri."},400);
  const type = d.type === "delivery" ? "Yetkazib berish" : "Olib ketish";
  const address = type === "Yetkazib berish" ? String(d.address || "").trim().slice(0,200) : "";
  const branch = type === "Olib ketish" ? String(d.branch || "").slice(0,60) : "";
  const phone = String(d.phone || "").slice(0,20);
  const note = String(d.note || "").slice(0,200);
  if (phone.replace(/\D/g,"").length < 9 || (type === "Yetkazib berish" && address.length < 5))
    return json({ok:false,error:"Telefon raqam yoki manzilni tekshiring."},400);
  if (!env.GROUP_ID) return json({ok:false,error:"Buyurtmalar guruhi hali sozlanmagan."},500);
  const oid = String(Date.now()).slice(-8);
  const customer = esc([user.first_name,user.last_name].filter(Boolean).join(" ") || "Telegram mijoz");
  const msg = "🆕 <b>Buyurtma №"+oid+"</b>\n\n"+lines.join("\n")+
    "\n\n<b>Jami: "+fmt(total)+" so‘m</b> (naqd)\n"+type+
    (address ? "\nManzil: "+esc(address) : "\nFilial: "+esc(branch))+
    "\nTelefon: "+esc(phone)+(note ? "\nIzoh: "+esc(note) : "")+
    "\nMijoz: <a href=\"tg://user?id="+user.id+"\">"+customer+"</a>";
  await telegram(env,"sendMessage",{chat_id:env.GROUP_ID,text:msg,parse_mode:"HTML",reply_markup:keyboard(user.id,"new")});
  return json({ok:true,message:"Buyurtma №"+oid+" qabul qilindi. Jami: "+fmt(total)+" so‘m."});
}
async function webhook(req, env) {
  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET)
    return new Response("Forbidden",{status:403});
  const update = await req.json();
  const q = update.callback_query;
  if (!q) return new Response("ok");
  const parts = String(q.data || "").split(":");
  const userId = parts[1], action = parts[2];
  const admins = (env.ADMIN_IDS || "").split(",").map(x=>x.trim()).filter(Boolean);
  if (String(q.message?.chat?.id) !== String(env.GROUP_ID) || !admins.includes(String(q.from?.id))) {
    await telegram(env,"answerCallbackQuery",{callback_query_id:q.id,text:"Sizda ruxsat yo‘q.",show_alert:true});
    return new Response("ok");
  }
  const states = {
    acc:["qabul qilindi","✅ Buyurtmangiz qabul qilindi va tayyorlanmoqda."],
    rdy:["tayyor","🍽 Buyurtmangiz tayyor!"],
    can:["bekor qilindi","❌ Buyurtmangiz bekor qilindi."]
  };
  if (parts[0] !== "o" || !/^\\d+$/.test(userId || "") || !states[action]) {
    await telegram(env,"answerCallbackQuery",{callback_query_id:q.id,text:"Buyurtma ma’lumoti noto‘g‘ri."});
    return new Response("ok");
  }
  const [label, userText] = states[action];
  const base = String(q.message.text || q.message.caption || "").replace(/\n\n<b>Holat:<\/b>.*$/s,"");
  await telegram(env,"editMessageText",{
    chat_id:q.message.chat.id,message_id:q.message.message_id,
    text:base+"\n\n<b>Holat:</b> "+label,parse_mode:"HTML",
    reply_markup:keyboard(userId,action)
  });
  try { await telegram(env,"sendMessage",{chat_id:userId,text:"№"+(base.match(/Buyurtma №(\d+)/)?.[1] || "")+": "+userText}); } catch {}
  await telegram(env,"answerCallbackQuery",{callback_query_id:q.id,text:"Yangilandi"});
  return new Response("ok");
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null,{headers:CORS});
    if (req.method === "GET" && url.pathname === "/health") return json({ok:true,service:"tez-taom-api"});
    if (req.method === "POST" && url.pathname === "/api/order") {
      try { return await order(req,env); }
      catch (e) { console.error(e); return json({ok:false,error:"Server xatosi. Keyinroq qayta urinib ko‘ring."},500); }
    }
    if (req.method === "POST" && url.pathname === "/telegram/webhook") {
      try { return await webhook(req,env); }
      catch (e) { console.error(e); return new Response("Webhook error",{status:500}); }
    }
    return json({ok:false,error:"Not found"},404);
  }
};