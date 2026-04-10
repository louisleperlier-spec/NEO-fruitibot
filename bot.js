require("dotenv").config();
const { Telegraf } = require("telegraf");
const Anthropic = require("@anthropic-ai/sdk");
const store = require("./store");
const { botActions } = require("./store/botSlice");
const { gainActions } = require("./store/gainSlice");
const { createCanvas } = require("@napi-rs/c...
;

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es un expert en design Frutiger Aero. Réponds UNIQUEMENT avec un JSON valide sans backticks:
{"title":"2-3 mots","subtitle":"max 5 mots","description":"max 10 mots","palette":{"bg1":"#hex aqua","bg2":"#hex teal","accent":"#hex vif","text":"#hex sombre"},"mood":"serene ou dreamy ou fresh ou vibrant ou crystal ou pure"}`;

async function getDesignData(theme) {
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Affiche Frutiger Aero pour : ${theme}` }],
  });
  return JSON.parse((msg.content[0]?.text || "").replace(/```[a-z]*|```/g, "").trim());
}

const W = 1240, H = 1748;

function hex2rgba(hex, a) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return `rgba(0,180,220,${a})`;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawBubble(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x-r*.35,y-r*.35,r*.04,x,y,r);
  g.addColorStop(0,"rgba(255,255,255,0.80)");
  g.addColorStop(0.3,"rgba(200,245,255,0.40)");
  g.addColorStop(0.75,"rgba(140,220,255,0.12)");
  g.addColorStop(1,"rgba(255,255,255,0.03)");
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,0.55)"; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x-r*.28,y-r*.30,r*.20,0,Math.PI*2);
  ctx.fillStyle="rgba(255,255,255,0.65)"; ctx.fill();
}

function drawLeaf(ctx, x, y, rot, sc, col) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.scale(sc,sc);
  ctx.beginPath(); ctx.moveTo(0,0);
  ctx.bezierCurveTo(26,-55,88,-70,76,-24);
  ctx.bezierCurveTo(64,12,16,22,0,0);
  ctx.fillStyle=hex2rgba(col,.46); ctx.fill();
  ctx.strokeStyle=hex2rgba(col,.72); ctx.lineWidth=2/sc;
  ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(36,-28,60,-40); ctx.stroke();
  ctx.restore();
}

function drawDrop(ctx, x, y, r, col) {
  ctx.save(); ctx.translate(x,y);
  ctx.beginPath(); ctx.moveTo(0,-r);
  ctx.bezierCurveTo(r*.70,-r*.38,r*.70,r*.38,0,r);
  ctx.bezierCurveTo(-r*.70,r*.38,-r*.70,-r*.38,0,-r);
  ctx.fillStyle=hex2rgba(col,.44); ctx.fill();
  ctx.strokeStyle=hex2rgba(col,.62); ctx.lineWidth=1.5; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-r*.20,-r*.36,r*.13,r*.25,-0.4,0,Math.PI*2);
  ctx.fillStyle="rgba(255,255,255,0.62)"; ctx.fill();
  ctx.restore();
}

function drawFlare(ctx, x, y, col) {
  const g = ctx.createRadialGradient(x,y,0,x,y,155);
  g.addColorStop(0,"rgba(255,255,255,0.90)");
  g.addColorStop(0.14,hex2rgba(col,.52));
  g.addColorStop(0.45,"rgba(255,255,255,0.07)");
  g.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=g; ctx.fillRect(x-155,y-155,310,310);
  ctx.save(); ctx.translate(x,y);
  for(let i=0;i<12;i++){
    ctx.rotate(Math.PI/6);
    ctx.fillStyle="rgba(255,255,255,0.05)";
    ctx.beginPath(); ctx.moveTo(-2,0); ctx.lineTo(2,0);
    ctx.lineTo(1,280); ctx.lineTo(-1,280); ctx.fill();
  }
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  if (!text) return;
  const words = text.split(" "); let line = "";
  for (const w of words) {
    const test = line + w + " ";
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), cx, y); line = w + " "; y += lh;
    } else line = test;
  }
  ctx.fillText(line.trim(), cx, y);
}

function renderPoster(d) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const p = d.palette || {};
  const bg = ctx.createLinearGradient(0,0,W*.6,H);
  bg.addColorStop(0,p.bg1||"#5bc8e8");
  bg.addColorStop(0.52,p.bg2||"#1aafaa");
  bg.addColorStop(1,"#c8f0f5");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  const amb = ctx.createRadialGradient(W*.1,H*.06,0,W*.1,H*.06,W*1.05);
  amb.addColorStop(0,"rgba(255,255,255,0.50)");
  amb.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=amb; ctx.fillRect(0,0,W,H);
  [[W*.8,H*.13,385,p.accent,.16],[W*.1,H*.75,305,p.bg1,.21],[W*.57,H*.92,255,p.bg2,.13],[W*.95,H*.5,205,"#fff",.09],[W*.27,H*.09,170,p.accent,.08],[W*.44,H*.49,315,"#fff",.06]].forEach(([ox,oy,or,oc,oa])=>{
    const og=ctx.createRadialGradient(ox-or*.3,oy-or*.3,0,ox,oy,or);
    og.addColorStop(0,hex2rgba(oc,oa*2)); og.addColorStop(.5,hex2rgba(oc,oa)); og.addColorStop(1,hex2rgba(oc,0));
    ctx.fillStyle=og; ctx.beginPath(); ctx.arc(ox,oy,or,0,Math.PI*2); ctx.fill();
  });
  [[105,188,50],[1092,352,40],[190,1122,60],[955,1315,44],[626,140,32],[70,665,38],[1155,825,54],[373,1592,40],[765,492,27],[486,1379,34],[850,250,22]].forEach(([x,y,r])=>drawBubble(ctx,x,y,r));
  drawLeaf(ctx,50,70,.32,1.1,p.accent); drawLeaf(ctx,W-50,90,-.52,.9,p.bg2);
  drawLeaf(ctx,40,H-86,.92,1.25,p.accent); drawLeaf(ctx,W-46,H-135,-.38,.86,p.bg2);
  drawLeaf(ctx,W*.34,H*.078,.15,.58,p.accent); drawLeaf(ctx,W*.64,H*.91,-.2,.62,p.bg2);
  drawDrop(ctx,W*.87,H*.37,30,p.accent); drawDrop(ctx,W*.07,H*.53,24,p.bg2); drawDrop(ctx,W*.91,H*.71,20,p.accent);
  const barG=ctx.createLinearGradient(80,0,W-80,0);
  barG.addColorStop(0,hex2rgba(p.accent,.07)); barG.addColorStop(.5,p.accent||"#00c8e0"); barG.addColorStop(1,hex2rgba(p.bg2,.07));
  ctx.fillStyle=barG; rrect(ctx,80,H*.114,W-160,10,5); ctx.fill();
  const CX=W/2, CY=H*.234, CR=80;
  const cg=ctx.createRadialGradient(CX-22,CY-22,4,CX,CY,CR);
  cg.addColorStop(0,"rgba(255,255,255,0.95)"); cg.addColorStop(.42,hex2rgba(p.accent,.66)); cg.addColorStop(1,hex2rgba(p.bg2,.76));
  ctx.beginPath(); ctx.arc(CX,CY,CR,0,Math.PI*2); ctx.fillStyle=cg; ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,0.86)"; ctx.lineWidth=6;
  ctx.beginPath(); ctx.arc(CX,CY,CR,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle=hex2rgba(p.accent,.40); ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(CX,CY,CR-14,0,Math.PI*2); ctx.stroke();
  ctx.save(); ctx.translate(CX,CY);
  ctx.beginPath(); ctx.moveTo(0,-37); ctx.bezierCurveTo(27,-10,31,16,0,31); ctx.bezierCurveTo(-31,16,-27,-10,0,-37);
  ctx.fillStyle=hex2rgba(p.text,.76); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-9,-13,7,12,-.5,0,Math.PI*2); ctx.fillStyle="rgba(255,255,255,0.72)"; ctx.fill();
  ctx.restore();
  const GX=80,GY=H*.293,GW=W-160,GH=H*.498,GR=56;
  ctx.shadowColor="rgba(0,50,90,.15)"; ctx.shadowBlur=95; ctx.shadowOffsetY=26;
  rrect(ctx,GX,GY,GW,GH,GR); ctx.fillStyle="rgba(255,255,255,0.17)"; ctx.fill();
  ctx.shadowColor="transparent"; ctx.shadowBlur=0; ctx.shadowOffsetY=0;
  ctx.strokeStyle="rgba(255,255,255,0.66)"; ctx.lineWidth=2.5;
  rrect(ctx,GX,GY,GW,GH,GR); ctx.stroke();
  const sh=ctx.createLinearGradient(GX,GY,GX,GY+GH*.5);
  sh.addColorStop(0,"rgba(255,255,255,0.44)"); sh.addColorStop(1,"rgba(255,255,255,0)");
  rrect(ctx,GX+3,GY+3,GW-6,GH*.48,GR); ctx.fillStyle=sh; ctx.fill();
  const TC=W/2;
  ctx.textAlign="center"; ctx.textBaseline="middle";
  const tg=ctx.createLinearGradient(160,0,W-160,0);
  tg.addColorStop(0,p.text||"#003040"); tg.addColorStop(.55,p.bg2||"#007a8c"); tg.addColorStop(1,p.text||"#003040");
  const title=(d.title||"AERO").toUpperCase();
  const titleY=GY+GH*.21;
  ctx.shadowColor=hex2rgba(p.bg2,.30); ctx.shadowBlur=24;
  if(title.length>14){ ctx.font=`bold 78px sans-serif`; const ws=title.split(" "),mid=Math.ceil(ws.length/2); ctx.fillStyle=tg; ctx.fillText(ws.slice(0,mid).join(" "),TC,titleY-52); ctx.fillText(ws.slice(mid).join(" "),TC,titleY+52); }
  else if(title.length>10){ ctx.font=`bold 94px sans-serif`; ctx.fillStyle=tg; ctx.fillText(title,TC,titleY); }
  else { ctx.font=`bold 120px sans-serif`; ctx.fillStyle=tg; ctx.fillText(title,TC,titleY); }
  ctx.shadowBlur=0; ctx.shadowColor="transparent";
  ctx.font=`600 48px sans-serif`; ctx.fillStyle=hex2rgba(p.text,.68);
  ctx.fillText(d.subtitle||"",TC,GY+GH*.51);
  const dg=ctx.createLinearGradient(GX+90,0,GX+GW-90,0);
  dg.addColorStop(0,"rgba(255,255,255,0)"); dg.addColorStop(.5,hex2rgba(p.accent,.54)); dg.addColorStop(1,"rgba(255,255,255,0)");
  ctx.strokeStyle=dg; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(GX+90,GY+GH*.63); ctx.lineTo(GX+GW-90,GY+GH*.63); ctx.stroke();
  ctx.font=`italic 35px serif`; ctx.fillStyle=hex2rgba(p.text,.48);
  wrapText(ctx,d.description||"",TC,GY+GH*.745,GW-180,48);
  const BT=GY+GH+55,pw=252,ph=58;
  const pillG=ctx.createLinearGradient(TC-pw/2,BT,TC+pw/2,BT);
  pillG.addColorStop(0,hex2rgba(p.accent,.20)); pillG.addColorStop(1,hex2rgba(p.bg2,.20));
  rrect(ctx,TC-pw/2,BT,pw,ph,29); ctx.fillStyle=pillG; ctx.fill();
  ctx.strokeStyle=hex2rgba(p.accent,.56); ctx.lineWidth=1.4;
  rrect(ctx,TC-pw/2,BT,pw,ph,29); ctx.stroke();
  ctx.font=`600 27px sans-serif`; ctx.fillStyle=hex2rgba(p.text,.80);
  ctx.fillText(`✦  ${(d.mood||"AERO").toUpperCase()}  ✦`,TC,BT+ph/2);
  const dy=H*.933;
  [0,1,2,3,4].forEach(i=>{ const dr=i===2?13:7; ctx.beginPath(); ctx.arc(TC-80+i*40,dy,dr,0,Math.PI*2); ctx.fillStyle=hex2rgba(p.accent,i===2?.86:.36); ctx.fill(); });
  const bbG=ctx.createLinearGradient(80,0,W-80,0);
  bbG.addColorStop(0,hex2rgba(p.accent,.06)); bbG.addColorStop(.5,p.accent||"#00c8e0"); bbG.addColorStop(1,hex2rgba(p.bg2,.06));
  ctx.fillStyle=bbG; rrect(ctx,80,H*.961,W-160,8,4); ctx.fill();
  drawFlare(ctx,W*.82,H*.066,p.accent);
  drawFlare(ctx,W*.16,H*.910,p.bg2);
  return canvas;
}

bot.start((ctx) => ctx.reply(`🌊 *Frutiger Aero Poster Studio*\n\nEnvoie-moi un thème !\n\n• Printemps japonais\n• Ocean bioluminescent\n• Aurore boréale\n• Crystal Rain`, { parse_mode: "Markdown" }));
bot.help((ctx) => ctx.reply(`Envoie un thème pour générer une affiche A6 300 DPI prête pour Etsy !`));
bot.command("aero", async (ctx) => { const theme = ctx.message.text.replace("/aero","").trim(); if (!theme) return ctx.reply("Donne un thème ! Ex: /aero aurore boréale"); await handleGeneration(ctx, theme); });

bot.command("sale", (ctx) => {
  store.dispatch(gainActions.recordSale());
  const { salesCount, totalRevenue, pricePerPoster } = store.getState().gain;
  ctx.reply(`💰 Vente enregistrée !\n\n• Ventes : *${salesCount}*\n• Prix unitaire : *${pricePerPoster.toFixed(2)} €*\n• Revenu total : *${totalRevenue.toFixed(2)} €*`, { parse_mode: "Markdown" });
});

bot.command("price", (ctx) => {
  const input = ctx.message.text.replace("/price", "").trim();
  const price = parseFloat(input);
  if (isNaN(price) || price <= 0) return ctx.reply("Usage : /price 4.99");
  store.dispatch(gainActions.setSalePrice(price));
  ctx.reply(`✅ Prix mis à jour : *${price.toFixed(2)} €* par affiche`, { parse_mode: "Markdown" });
});

bot.command("gain", (ctx) => {
  const { salesCount, totalRevenue, pricePerPoster } = store.getState().gain;
  const { stats } = store.getState().bot;
  ctx.reply(
    `📊 *Tableau de bord Gains*\n\n` +
    `🎨 Affiches générées : *${stats.totalGenerated}*\n` +
    `🛒 Ventes enregistrées : *${salesCount}*\n` +
    `💶 Prix unitaire : *${pricePerPoster.toFixed(2)} €*\n` +
    `💰 Revenu total : *${totalRevenue.toFixed(2)} €*`,
    { parse_mode: "Markdown" }
  );
});

bot.on("text", async (ctx) => { if (ctx.message.text.startsWith("/")) return; await handleGeneration(ctx, ctx.message.text); });

async function handleGeneration(ctx, theme) {
  const chatId = ctx.chat.id;
  store.dispatch(botActions.generationStarted(chatId));
  const status = await ctx.reply(`⏳ Génération de *"${theme}"*…`, { parse_mode: "Markdown" });
  try {
    await ctx.telegram.editMessageText(chatId, status.message_id, null, `🎨 Design en cours…`);
    const designData = await getDesignData(theme);
    await ctx.telegram.editMessageText(chatId, status.message_id, null, `🖼 Rendu…`);
    const canvas = renderPoster(designData);
    const buffer = canvas.toBuffer("image/png");
    await ctx.telegram.deleteMessage(chatId, status.message_id);
    await ctx.replyWithDocument(
      { source: buffer, filename: `frutiger-aero-${Date.now()}.png` },
      { caption: `✦ *${designData.title}*\n_${designData.subtitle}_\n\n${designData.description}\n\n🎨 ${designData.mood?.toUpperCase()} · A6 · 300 DPI · Etsy ✅`, parse_mode: "Markdown" }
    );
    store.dispatch(botActions.generationFinished(chatId));
  } catch (err) {
    store.dispatch(botActions.generationFailed(chatId));
    await ctx.telegram.editMessageText(chatId, status.message_id, null, `❌ Erreur : ${err.message}`).catch(()=>{});
  }
}

bot.launch().then(() => {
  store.dispatch(botActions.setBotStatus("running"));
  console.log("🌊 Bot démarré !");
});
process.once("SIGINT", () => { store.dispatch(botActions.setBotStatus("stopped")); bot.stop("SIGINT"); });
process.once("SIGTERM", () => { store.dispatch(botActions.setBotStatus("stopped")); bot.stop("SIGTERM"); });
