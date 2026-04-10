import { useState, useRef, useEffect, createContext, useContext, useCallback } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Men～Log v5
// 改修内容:
//   ・AI画像認識: Claude API + web_search でラーメンDB照合
//   ・永続ストレージ: window.storage で友人間データ共有
//   ・EXIF GPS + 画像特徴のメタ推理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── テーマ ───────────────────────────────────────────
const THEMES = {
  warm:  { bg:"#FFF8F3",bg2:"#FFF0E6",card:"#FFFFFF",acc:"#C0392B",accm:"#FADBD8",tx:"#1A0A00",tx2:"#6B4C3B",txm:"#A0826D",br:"#F0DDD5",star:"#E67E22",grad:"linear-gradient(135deg,#C0392B,#E74C3C)",sh:"rgba(192,57,43,0.12)" },
  dark:  { bg:"#0F0A08",bg2:"#1A110D",card:"#231610",acc:"#E74C3C",accm:"#3D1A17",tx:"#F5EDE8",tx2:"#C4A99A",txm:"#7A5C4F",br:"#3D2418",star:"#F39C12",grad:"linear-gradient(135deg,#E74C3C,#FF6B6B)",sh:"rgba(231,76,60,0.2)"  },
  cool:  { bg:"#F0F4FF",bg2:"#E8EEFF",card:"#FFFFFF",acc:"#3B5BDB",accm:"#DBE4FF",tx:"#0A0F2C",tx2:"#3B4A8A",txm:"#7C8DB0",br:"#D0D9F5",star:"#F59F00",grad:"linear-gradient(135deg,#3B5BDB,#4C6EF5)",sh:"rgba(59,91,219,0.12)" },
  season:{ bg:"#F5FFF0",bg2:"#EAFAE0",card:"#FFFFFF",acc:"#2E7D32",accm:"#C8E6C9",tx:"#0A1F0C",tx2:"#2E5C30",txm:"#6A9B6D",br:"#D4EDD6",star:"#F57F17",grad:"linear-gradient(135deg,#2E7D32,#43A047)",sh:"rgba(46,125,50,0.12)" },
};
const RAMENDB_BASE = "https://ramendb.supleks.jp";
const RAMENDB_RANK = "https://ramendb.supleks.jp/rank";
const APP_LINK     = "https://men-log2-yerr.vercel.app/";
const PRIVACY = { PUBLIC:"public", FRIENDS:"friends", PRIVATE:"private" };
const PRIVACY_LABEL = { public:"🌐 全体公開", friends:"👥 友達・グループ", private:"🔒 非公開" };

const PH = (t="🍜") => `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect width='150' height='150' fill='%23FADBD8'/><text x='75' y='85' font-size='48' text-anchor='middle'>${encodeURIComponent(t)}</text></svg>`;

// ─── デモデータ ───────────────────────────────────────
const DEMO_ENTRIES = [
  { id:"d1", shopName:"飯田商店",       visitDate:"2026-03-20", rating:5, genre:"塩",   area:"湯河原", images:[PH("✨")], comment:"人生で一番うまいラーメン", privacy:PRIVACY.PUBLIC   },
  { id:"d2", shopName:"中華そば とみ田", visitDate:"2026-03-15", rating:5, genre:"つけ麺",area:"松戸",  images:[PH("🎯")], comment:"つけ麺の概念が変わった",   privacy:PRIVACY.FRIENDS  },
  { id:"d3", shopName:"一蘭 渋谷",      visitDate:"2026-02-28", rating:4, genre:"豚骨", area:"渋谷",   images:[PH("🐷")], comment:"個室で集中して食べる",     privacy:PRIVACY.PRIVATE  },
  { id:"d4", shopName:"二郎 三田本店",  visitDate:"2026-02-10", rating:3, genre:"二郎系",area:"三田",  images:[PH("💪")], comment:"量が限界突破してた",       privacy:PRIVACY.PUBLIC   },
];
const INITIAL_SHOPS = [];

// ─── ラーメンDB ランキング取得 (Claude API + web_search) ──
async function fetchRamenDBRanking(region = "全国") {
  const stateParam = {
    "全国":"", "東京":"?state=tokyo", "神奈川":"?state=kanagawa",
    "千葉":"?state=chiba", "埼玉":"?state=saitama", "大阪":"?state=osaka",
    "京都":"?state=kyoto", "福岡":"?state=fukuoka", "北海道":"?state=hokkaido",
  }[region] || "";
  
  const targetUrl = `https://ramendb.supleks.jp/rank/alltime${stateParam}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `あなたはラーメンDBのランキングデータを取得するアシスタントです。
web_searchツールを使って「ramendb.supleks.jp」のランキングページからデータを取得してください。

## 手順
1. web_searchで「ramendb.supleks.jp rank ${region} ラーメン ランキング ポイント」を検索
2. 検索結果から店舗名、ポイント(スコア)、エリア、店舗ID(URLの/s/XXXX.htmlのXXXX部分)を抽出
3. 上位10店舗をJSON配列で返す

## 出力形式（JSONのみ、説明文なし、バッククォートなし）
[
  {"name":"店舗名","score":99.75,"area":"エリア","id":"4062","genre":"醤油"}
]

genreは店舗名や情報から推測してください（醤油/豚骨/塩/味噌/つけ麺/鶏白湯/二郎系/中華そば/煮干し/担々麺/その他）。`,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `ラーメンデータベース(ramendb.supleks.jp)の${region}通算ランキングから上位10店舗のデータを取得してください。各店舗の名前、評価ポイント、エリア、店舗ID（URLの/s/数字.htmlの数字部分）、推定ジャンルをJSON配列で返してください。`
        }]
      })
    });

    if (!response.ok) {
      console.error("Ranking fetch API error:", response.status);
      return null;
    }

    const data = await response.json();
    const fullText = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    const cleaned = fullText.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate and normalize
      return parsed.filter(s => s.name && s.id).map(s => ({
        name: s.name,
        score: Number(s.score) || 0,
        area: s.area || "",
        id: String(s.id),
        genre: s.genre || "その他",
      }));
    }
    return null;
  } catch (err) {
    console.error("Ranking fetch error:", err);
    return null;
  }
}

// ─── ユーティリティ ──────────────────────────────────
function readAsDataURL(file) {
  return new Promise(res => {
    try { const r=new FileReader(); r.onload=ev=>res(ev.target.result); r.onerror=()=>res(null); r.readAsDataURL(file); }
    catch { res(null); }
  });
}
function readAsArrayBuffer(file) {
  return new Promise(res => {
    try { const r=new FileReader(); r.onload=ev=>res(ev.target.result); r.onerror=()=>res(null); r.readAsArrayBuffer(file); }
    catch { res(null); }
  });
}
function getExifDate(buf) {
  try {
    if (!buf) return null;
    const v = new DataView(buf);
    if (v.byteLength<4||v.getUint16(0)!==0xFFD8) return null;
    let off=2;
    while (off+4<v.byteLength) {
      const mk=v.getUint16(off), ln=v.getUint16(off+2);
      if (ln<2||off+2+ln>v.byteLength) break;
      if (mk===0xFFE1) {
        const a=new DataView(buf,off+4,ln-2);
        if (a.byteLength<14) break;
        const le=a.getUint16(6)===0x4949;
        const ifd=a.getUint32(10,le)+6;
        if (ifd+2>a.byteLength) break;
        const n=a.getUint16(ifd,le);
        for (let i=0;i<n;i++) {
          const e=ifd+2+i*12;
          if (e+12>a.byteLength) break;
          const tag=a.getUint16(e,le);
          if (tag===0x9003||tag===0x0132) {
            const vo=a.getUint32(e+8,le)+6;
            if (vo+10>a.byteLength) break;
            let s="";
            for(let j=0;j<19;j++){const c=a.getUint8(vo+j);if(!c)break;s+=String.fromCharCode(c);}
            const m=s.match(/^(\d{4}):(\d{2}):(\d{2})/);
            if(m) return `${m[1]}-${m[2]}-${m[3]}`;
          }
        }
      }
      off+=2+ln;
    }
  } catch {}
  return null;
}

// EXIF GPS extraction
function getExifGPS(buf) {
  try {
    if (!buf) return null;
    const v = new DataView(buf);
    if (v.byteLength<4||v.getUint16(0)!==0xFFD8) return null;
    let off=2;
    while (off+4<v.byteLength) {
      const mk=v.getUint16(off), ln=v.getUint16(off+2);
      if (ln<2||off+2+ln>v.byteLength) break;
      if (mk===0xFFE1) {
        const a=new DataView(buf,off+4,ln-2);
        if (a.byteLength<14) break;
        const le=a.getUint16(6)===0x4949;
        const tiffOff = 6;
        // Find GPS IFD pointer from IFD0
        const ifd0=a.getUint32(10,le)+tiffOff;
        if (ifd0+2>a.byteLength) break;
        const n0=a.getUint16(ifd0,le);
        let gpsIFDPointer = null;
        for (let i=0;i<n0;i++) {
          const e=ifd0+2+i*12;
          if (e+12>a.byteLength) break;
          const tag=a.getUint16(e,le);
          if (tag===0x8825) { // GPSInfo
            gpsIFDPointer = a.getUint32(e+8,le)+tiffOff;
            break;
          }
        }
        if (gpsIFDPointer===null || gpsIFDPointer+2>a.byteLength) break;
        const nGps=a.getUint16(gpsIFDPointer,le);
        let latRef=null,lonRef=null,latVals=null,lonVals=null;
        const readRational=(offset)=>{
          if(offset+8>a.byteLength) return 0;
          return a.getUint32(offset,le)/a.getUint32(offset+4,le);
        };
        const readDMS=(valOffset)=>{
          const d=readRational(valOffset);
          const m=readRational(valOffset+8);
          const s=readRational(valOffset+16);
          return d+m/60+s/3600;
        };
        for (let i=0;i<nGps;i++) {
          const e=gpsIFDPointer+2+i*12;
          if (e+12>a.byteLength) break;
          const tag=a.getUint16(e,le);
          if (tag===1) { // GPSLatitudeRef
            latRef=String.fromCharCode(a.getUint8(e+8));
          } else if (tag===2) { // GPSLatitude
            const vo=a.getUint32(e+8,le)+tiffOff;
            latVals=readDMS(vo);
          } else if (tag===3) { // GPSLongitudeRef
            lonRef=String.fromCharCode(a.getUint8(e+8));
          } else if (tag===4) { // GPSLongitude
            const vo=a.getUint32(e+8,le)+tiffOff;
            lonVals=readDMS(vo);
          }
        }
        if (latVals!==null && lonVals!==null) {
          const lat = latRef==='S' ? -latVals : latVals;
          const lon = lonRef==='W' ? -lonVals : lonVals;
          if (lat!==0||lon!==0) return {lat,lon};
        }
      }
      off+=2+ln;
    }
  } catch {}
  return null;
}

function dedupe(arr) { const s=new Set(); return arr.filter(x=>{if(s.has(x))return false;s.add(x);return true;}); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Claude API ラーメン画像認識エンジン v7
// 3段階フォールバック + リトライ + ジャンル推定命名
//
// Phase 1: フル解析 (web_search付き、店舗特定)
// Phase 2: ビジュアル解析のみ (web_search無し、高速)
// Phase 3: 最小限ジャンル判定 (超軽量、必ず成功)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Phase 1: フル解析 (web_search付き) ──
async function aiPhase1_fullAnalysis(base64Data, mt, contextBlock) {
  const sys = `あなたはラーメン画像解析の専門家です。画像を分析して店舗を特定してください。

## 最優先: 画像内テキストの検出
どんぶりのロゴ/文字、箸袋の店名、看板、メニュー表、食券、壁のポスターなど
画像内に見える全てのテキストを読み取ってください。これが最も重要な手がかりです。

## 次に: 視覚特徴の分析
- スープ: 色（琥珀/乳白/茶褐色/黒等）、透明度、油膜の種類
- 麺: 太さ、ストレート/縮れ、色
- 具材: チャーシュー種類、味玉、海苔、メンマ、ネギ種類等
- 器: 形状・色・柄、提供スタイル（つけ麺セット/丼等）
- 盛付: 二郎系山盛り/家系海苔3枚/上品な盛付等

## web_searchで店舗を検索
手がかりをもとにramendb.supleks.jpで店舗を検索してください。

## 回答形式（純粋なJSONのみ。バッククォートや説明文は禁止）
{"shopName":"店舗名 or null","menuName":"推定メニュー名","genre":"醤油/豚骨/塩/味噌/つけ麺/鶏白湯/二郎系/家系/煮干し/担々麺/中華そば/その他","soupType":"スープ詳細","noodleType":"麺の詳細","toppings":["具材1","具材2"],"area":"エリア","estimatedPrice":"推定価格","ramendbId":"数字ID or null","ramendbUrl":"URL or null","confidence":0-100,"detectedTexts":["読取テキスト"],"reasoning":"判定理由50字以内"}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: sys,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mt, data: base64Data } },
        { type: "text", text: `このラーメン画像を解析してください。画像内のテキスト（ロゴ・看板・箸袋等）を最優先で読み取り、ramendb.supleks.jpで店舗を検索してください。${contextBlock}` }
      ]}]
    })
  });
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  return await resp.json();
}

// ── Phase 2: ビジュアルのみ解析 (web_search無し・高速) ──
async function aiPhase2_visualOnly(base64Data, mt, contextBlock) {
  const sys = `ラーメン画像を分析してください。テキスト検出とビジュアル特徴から情報を抽出します。

回答は純粋なJSONのみ（バッククォート禁止・説明文禁止）:
{"shopName":null,"menuName":"推定メニュー","genre":"醤油/豚骨/塩/味噌/つけ麺/鶏白湯/二郎系/家系/煮干し/担々麺/中華そば/その他","soupType":"スープ色と特徴","noodleType":"麺の特徴","toppings":["具材"],"area":"","estimatedPrice":"","ramendbId":null,"ramendbUrl":null,"confidence":0-100,"detectedTexts":["画像内テキスト"],"reasoning":"特徴の説明"}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: sys,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mt, data: base64Data } },
        { type: "text", text: `このラーメン画像を分析してください。どんぶり・箸袋・看板のテキストを読み取り、スープ色・麺の太さ・具材からジャンルと特徴を判定してください。${contextBlock}` }
      ]}]
    })
  });
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  return await resp.json();
}

// ── Phase 3: 最小限ジャンル判定 (超軽量) ──
async function aiPhase3_minimalGenre(base64Data, mt) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mt, data: base64Data } },
        { type: "text", text: `この画像のラーメンのジャンルを判定してください。回答はJSONのみ: {"genre":"醤油/豚骨/塩/味噌/つけ麺/鶏白湯/二郎系/家系/煮干し/その他","soupType":"スープの色と特徴","menuName":"推定メニュー名","reasoning":"判定理由20字"}` }
      ]}]
    })
  });
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  return await resp.json();
}

// ── APIレスポンスからJSONを抽出 ──
function extractJsonFromResponse(data) {
  const texts = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  const cleaned = texts.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]);
    // Normalize IDs
    if (!parsed.ramendbId && parsed.ramendbUrl) {
      const idM = parsed.ramendbUrl.match(/\/s\/(\d+)/);
      if (idM) parsed.ramendbId = idM[1];
    }
    if (parsed.ramendbId && !parsed.ramendbUrl) {
      parsed.ramendbUrl = `https://ramendb.supleks.jp/s/${parsed.ramendbId}.html`;
    }
    if (parsed.menuName && !parsed.menu) parsed.menu = parsed.menuName;
    return parsed;
  } catch (e) {
    console.error("JSON parse failed:", e.message, m[0].slice(0, 150));
    return null;
  }
}

// ── メイン: 3段階フォールバック解析 ──
async function analyzeRamenWithAI(imageBase64, mediaType, extraContext) {
  const { gps, fileName, exifDate, browserLocation } = extraContext || {};
  const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
  const mt = mediaType || "image/jpeg";

  const ctxLines = [];
  if (gps) ctxLines.push(`GPS: ${gps.lat.toFixed(5)},${gps.lon.toFixed(5)}`);
  if (browserLocation) ctxLines.push(`位置: ${browserLocation}`);
  if (fileName) ctxLines.push(`ファイル: ${fileName}`);
  if (exifDate) ctxLines.push(`撮影日: ${exifDate}`);
  const contextBlock = ctxLines.length ? `\n補足: ${ctxLines.join(" / ")}` : "";

  // Phase 1: フル解析 (web_search付き)
  try {
    console.log("[AI v7] Phase1: フル解析開始...");
    const data = await aiPhase1_fullAnalysis(base64Data, mt, contextBlock);
    const result = extractJsonFromResponse(data);
    if (result && (result.shopName || result.genre)) {
      console.log("[AI v7] Phase1 成功:", result.shopName || result.genre, "信頼度:", result.confidence);
      return result;
    }
    console.warn("[AI v7] Phase1: JSON抽出失敗、Phase2へ");
  } catch (e) {
    console.warn("[AI v7] Phase1 エラー:", e.message, "→ Phase2へ");
  }

  // 1秒待ってからリトライ
  await new Promise(r => setTimeout(r, 1000));

  // Phase 2: ビジュアルのみ (web_searchなし・高速)
  try {
    console.log("[AI v7] Phase2: ビジュアル解析開始...");
    const data = await aiPhase2_visualOnly(base64Data, mt, contextBlock);
    const result = extractJsonFromResponse(data);
    if (result && result.genre) {
      console.log("[AI v7] Phase2 成功:", result.genre, result.soupType);
      return result;
    }
    console.warn("[AI v7] Phase2: JSON抽出失敗、Phase3へ");
  } catch (e) {
    console.warn("[AI v7] Phase2 エラー:", e.message, "→ Phase3へ");
  }

  await new Promise(r => setTimeout(r, 1000));

  // Phase 3: 最小限ジャンル判定
  try {
    console.log("[AI v7] Phase3: 最小限解析開始...");
    const data = await aiPhase3_minimalGenre(base64Data, mt);
    const result = extractJsonFromResponse(data);
    if (result) {
      console.log("[AI v7] Phase3 成功:", result.genre);
      return result;
    }
  } catch (e) {
    console.error("[AI v7] Phase3 エラー:", e.message);
  }

  // 全Phase失敗 → 最低限の推定結果を返す
  console.error("[AI v7] 全Phase失敗。デフォルト値を返却。");
  return { shopName: null, genre: "その他", confidence: 0, reasoning: "AI解析に失敗しました", menu: "", soupType: "", noodleType: "", toppings: [] };
}

// ─── AI振分エンジン v7 ──────────────────────────────
async function runAIBulk({ files, entries, location, onProgress }) {
  const work = entries.map(e => ({ ...e, images: [...(e.images||[])] }));
  const summary = [];
  let unknownCounter = 0;
  const existingNums = work.map(e => { const m=e.shopName?.match(/^(?:不明|推定[:：])?\s*(.+?)(?:\(\d|$)/); return null; }).filter(Boolean);

  // 既存の不明カウンター
  work.forEach(e => {
    const m = e.shopName?.match(/^不明(\d+)/);
    if (m) unknownCounter = Math.max(unknownCounter, parseInt(m[1]));
  });

  for (let i=0; i<files.length; i++) {
    const file = files[i];
    onProgress(i+1, files.length, `📁 画像${i+1}を読み込み中...`);
    await new Promise(r => setTimeout(r, 30));

    const dataUrl = await readAsDataURL(file);
    if (!dataUrl) { summary.push({shopName:"読込エラー",action:"スキップ",date:""}); continue; }

    const buf = await readAsArrayBuffer(file);
    const exifDate = getExifDate(buf);
    const gps = getExifGPS(buf);
    const visitDate = exifDate || (file.lastModified ? new Date(file.lastModified).toISOString().slice(0,10) : new Date().toISOString().slice(0,10));

    const ext = (file.name || "").toLowerCase();
    let mediaType = "image/jpeg";
    if (ext.endsWith(".png")) mediaType = "image/png";
    else if (ext.endsWith(".webp")) mediaType = "image/webp";
    else if (ext.endsWith(".gif")) mediaType = "image/gif";

    onProgress(i+1, files.length, `🤖 AI解析中... (${i+1}/${files.length})`);
    await new Promise(r => setTimeout(r, 30));

    // ── リサイズ (1024px, 高品質) ──
    let apiBase64 = dataUrl;
    let apiMediaType = mediaType;
    try {
      const resized = await resizeImage(dataUrl, 1024);
      if (resized) { apiBase64 = resized; apiMediaType = "image/jpeg"; }
    } catch {}

    // ── AI解析実行 (3段階フォールバック内蔵) ──
    onProgress(i+1, files.length, `🔍 画像${i+1}を深層解析中...`);
    const aiResult = await analyzeRamenWithAI(apiBase64, apiMediaType, {
      gps, fileName: file.name, exifDate, browserLocation: location,
    });

    // ── 結果の解釈 ──
    let shopName, genre, area, menu, ramendbId, ramendbUrl, confidence, known;
    let soupType = "", noodleType = "", toppings = [], estimatedPrice = "";
    let detectedTexts = [], reasoning = "";

    const hasShop = aiResult && aiResult.shopName && aiResult.shopName !== "null" && aiResult.shopName !== "不明";
    confidence = aiResult?.confidence || 0;

    if (hasShop && confidence >= 15) {
      // ✅ 店舗特定成功
      shopName = aiResult.shopName;
      known = true;
      onProgress(i+1, files.length, `✅ ${shopName} (${confidence}%)`);
    } else {
      // ❓ 店舗不明 → ジャンル推定ベースで命名
      known = false;
      genre = aiResult?.genre || "その他";
      const dateStr = visitDate.slice(5).replace("-", "/");

      // ジャンル情報がある場合は「推定: 豚骨系(08/01)」のように命名
      if (genre && genre !== "その他") {
        shopName = `推定: ${genre}系 (${dateStr})`;
      } else {
        unknownCounter++;
        shopName = `不明${unknownCounter} (${dateStr})`;
      }
      onProgress(i+1, files.length, `🔍 ${shopName}`);
    }

    // 共通フィールド取得
    genre = aiResult?.genre || "その他";
    area = aiResult?.area || "";
    menu = aiResult?.menu || aiResult?.menuName || "";
    ramendbId = aiResult?.ramendbId || null;
    ramendbUrl = aiResult?.ramendbUrl || null;
    soupType = aiResult?.soupType || "";
    noodleType = aiResult?.noodleType || "";
    toppings = aiResult?.toppings || [];
    estimatedPrice = aiResult?.estimatedPrice || "";
    detectedTexts = aiResult?.detectedTexts || [];
    reasoning = aiResult?.reasoning || "";

    await new Promise(r => setTimeout(r, 30));

    // ── AIコメント構築 ──
    const commentParts = [];
    if (known) {
      commentParts.push(`🤖 AI特定: ${shopName}（信頼度${confidence}%）`);
    } else {
      commentParts.push(`🤖 AI推定: ジャンル[${genre}]（信頼度${confidence}%）`);
    }
    if (reasoning) commentParts.push(`💡 ${reasoning}`);
    if (soupType) commentParts.push(`🍲 スープ: ${soupType}`);
    if (noodleType) commentParts.push(`🍜 麺: ${noodleType}`);
    if (toppings.length > 0) commentParts.push(`🥚 具材: ${toppings.join(", ")}`);
    if (detectedTexts.length > 0) commentParts.push(`📝 検出テキスト: ${detectedTexts.join(", ")}`);
    if (estimatedPrice) commentParts.push(`💰 推定価格: ${estimatedPrice}`);

    // ── エントリ登録 ──
    const existing = work.find(e => e.shopName === shopName);
    if (existing) {
      if (!existing.images.includes(dataUrl)) {
        existing.images = dedupe([...existing.images, dataUrl]);
        summary.push({ shopName, action:"追加", date:visitDate, menu:existing.menu||"" });
      } else {
        summary.push({ shopName, action:"重複スキップ", date:visitDate });
      }
    } else {
      work.push({
        id: `ai_${Date.now()}_${i}`,
        shopName, genre, area,
        emoji: known ? "🍜" : "🔍",
        images: [dataUrl], visitDate,
        menu: menu || "",
        price: estimatedPrice || "",
        rating: known ? (confidence >= 80 ? 5 : confidence >= 50 ? 4 : 3) : 3,
        privacy: PRIVACY.PRIVATE,
        comment: commentParts.join("\n"),
        ramendbId,
        ramendbUrl,
        aiDetected: true,
        aiDetails: { soupType, noodleType, toppings, detectedTexts, confidence, reasoning },
      });
      summary.push({ shopName, action:"新規作成", date:visitDate, menu, confidence, known });
    }

    // ── 次の画像との間に少し間隔を空ける (レートリミット対策) ──
    if (i < files.length - 1) {
      onProgress(i+1, files.length, `⏳ 次の画像を準備中...`);
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return {
    entries: work.map(e => ({ ...e, images: dedupe(e.images||[]) })),
    summary,
  };
}

// Resize image for API (1024x1024 max, JPEG quality 0.90 for detail preservation)
function resizeImage(dataUrl, maxDim = 1024) {
  return new Promise(res => {
    try {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w <= maxDim && h <= maxDim) { res(null); return; }
        const scale = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        const ctx = cv.getContext("2d");
        // Enable high-quality image smoothing for text readability
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        res(cv.toDataURL("image/jpeg", 0.90));
      };
      img.onerror = () => res(null);
      img.src = dataUrl;
    } catch { res(null); }
  });
}

// ─── フルスクリーン どんぶりスピナー ─────────────────
function FullscreenSpinner({ shopName, progress, total }) {
  const [frame,setFrame]=useState(0);
  const frames=["🍜","🍛","🍲","🍥","🫕"];
  useEffect(()=>{const id=setInterval(()=>setFrame(f=>(f+1)%frames.length),180);return()=>clearInterval(id);},[]);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32}}>
      <div style={{fontSize:72,marginBottom:20,animation:"spin 0.55s linear infinite"}}>{frames[frame]}</div>
      <div style={{color:"#fff",fontWeight:700,fontSize:20,marginBottom:6,fontFamily:"'Shippori Mincho',Georgia,serif"}}>AI 深層解析中...</div>
      {shopName&&<div style={{color:"#FADBD8",fontSize:13,marginBottom:14,textAlign:"center",maxWidth:260}}>🔍「{shopName}」</div>}
      <div style={{width:240,height:7,background:"rgba(255,255,255,0.15)",borderRadius:4,overflow:"hidden",marginBottom:8}}>
        <div style={{height:"100%",background:"linear-gradient(90deg,#E74C3C,#FF6B6B)",width:`${total>0?(progress/total)*100:0}%`,borderRadius:4,transition:"width 0.3s"}}/>
      </div>
      <div style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>{progress} / {total} 枚</div>
      <div style={{marginTop:14,color:"rgba(255,255,255,0.35)",fontSize:11,textAlign:"center",lineHeight:1.9}}>
        Phase1: フル解析 → Phase2: ビジュアル解析<br/>
        Phase3: ジャンル判定 → 自動リトライ対応
      </div>
    </div>
  );
}

// ─── Stars ────────────────────────────────────────────
function Stars({ value=0, onChange, size=14, readonly=false }) {
  const {t}=useApp();
  const [hov,setHov]=useState(0);
  return (
    <div style={{display:"flex",gap:1}}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} onMouseEnter={()=>!readonly&&setHov(n)} onMouseLeave={()=>!readonly&&setHov(0)} onClick={()=>!readonly&&onChange?.(n)}
          style={{fontSize:size,cursor:readonly?"default":"pointer",color:(hov||value)>=n?t.star:t.br,userSelect:"none"}}>★</span>
      ))}
    </div>
  );
}
function MenLogLogo({ size=20 }) {
  const {t}=useApp();
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:1,fontFamily:"'Shippori Mincho',Georgia,serif",fontWeight:700,fontSize:size,color:t.tx,lineHeight:1}}>
      <span>Men</span>
      <svg width={Math.round(size*1.8)} height={Math.round(size*0.85)} viewBox="0 0 36 16" fill="none" style={{display:"inline-block",verticalAlign:"middle",margin:"0 1px"}}>
        <path d="M2 3 Q7 0 12 3 Q17 6 22 3 Q27 0 32 3 Q34.5 4.5 34 4" stroke={t.acc} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        <path d="M2 7.5 Q7 4.5 12 7.5 Q17 10.5 22 7.5 Q27 4.5 32 7.5 Q34.5 9 34 8.5" stroke={t.acc} strokeWidth="1.9" strokeLinecap="round" fill="none" opacity="0.65"/>
        <path d="M2 12 Q7 9 12 12 Q17 15 22 12 Q27 9 32 12 Q34.5 13.5 34 13" stroke={t.acc} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.35"/>
      </svg>
      <span>Log</span>
    </span>
  );
}
const INP=(t)=>({width:"100%",padding:"10px 12px",background:t.bg2,border:`1.5px solid ${t.br}`,borderRadius:9,fontSize:13,color:t.tx,outline:"none",boxSizing:"border-box"});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Storage helpers (window.storage API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function storageGet(key, shared=false) {
  try {
    const r = await window.storage.get(key, shared);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}
async function storageSet(key, value, shared=false) {
  try {
    await window.storage.set(key, JSON.stringify(value), shared);
  } catch (e) { console.error("storage set error:", e); }
}

// Generate a persistent user ID
async function getOrCreateUserId() {
  try {
    const r = await window.storage.get("menlog_uid");
    if (r) return r.value;
  } catch {}
  const uid = "u_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
  try { await window.storage.set("menlog_uid", uid); } catch {}
  return uid;
}
async function getOrCreateFriendCode() {
  try {
    const r = await window.storage.get("menlog_friendcode");
    if (r) return r.value;
  } catch {}
  const code = Math.random().toString(36).slice(2,10).toUpperCase();
  try { await window.storage.set("menlog_friendcode", code); } catch {}
  return code;
}

// ─── Context ─────────────────────────────────────────
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

function Provider({ children }) {
  const [ready, setReady] = useState(false);
  const [myUid, setMyUid] = useState("");
  const [myCode, setMyCode] = useState("");
  const [entries, setEntries] = useState(DEMO_ENTRIES);
  const [groups, setGroups] = useState([]);
  const [profile, setProfile] = useState({ name:"ユーザー", gender:"未設定", station:"未設定", favorite:"醤油", uid:"", code:"" });
  const [settings, setSettings] = useState({ theme:"warm" });
  const [friends, setFriends] = useState([]);
  const [filterMode, setFilterMode] = useState({ type:"all", value:null });
  const [tab, setTab] = useState(0);
  const [showPost, setShowPost] = useState(false);
  const [aiState, setAiState] = useState(null);
  const [detailEntryId, setDetailEntryId] = useState(null);
  const [rankingShops, setRankingShops] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingRegion, setRankingRegion] = useState("全国");
  const [rankingLastFetch, setRankingLastFetch] = useState(null);

  // Initialize from storage
  useEffect(() => {
    (async () => {
      const uid = await getOrCreateUserId();
      const code = await getOrCreateFriendCode();
      setMyUid(uid);
      setMyCode(code);

      const e = await storageGet(`${uid}_entries`);
      const g = await storageGet(`${uid}_groups`);
      const p = await storageGet(`${uid}_profile`);
      const s = await storageGet(`${uid}_settings`);
      const f = await storageGet(`${uid}_friends`);

      if (e) setEntries(e);
      if (g) setGroups(g); else setGroups([{id:"g1",name:"ラーメン部",emoji:"🍜",members:[code],inviteCodes:[code]}]);
      if (p) setProfile(p); else setProfile({name:"ユーザー",gender:"未設定",station:"未設定",favorite:"醤油",uid,code});
      if (s) setSettings(s);
      if (f) setFriends(f);

      // Load cached ranking
      const rk = await storageGet(`${uid}_ranking`);
      if (rk) { setRankingShops(rk.shops || []); setRankingLastFetch(rk.lastFetch || null); setRankingRegion(rk.region || "全国"); }

      // Publish own public entries for friends to see (shared storage)
      setReady(true);
    })();
  }, []);

  // Save to storage on changes
  const saveRef = useRef(null);
  useEffect(() => {
    if (!ready || !myUid) return;
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(async () => {
      await storageSet(`${myUid}_entries`, entries);
      await storageSet(`${myUid}_groups`, groups);
      await storageSet(`${myUid}_profile`, profile);
      await storageSet(`${myUid}_settings`, settings);
      await storageSet(`${myUid}_friends`, friends);

      // Publish public entries for friends (shared)
      const publicEntries = entries.filter(e => e.privacy === PRIVACY.PUBLIC).map(e => ({
        ...e,
        images: e.images?.slice(0,1) || [], // Only first image for shared
      }));
      await storageSet(`public_${myCode}`, {
        code: myCode,
        name: profile.name,
        entries: publicEntries,
      }, true);
    }, 500);
  }, [entries, groups, profile, settings, friends, ready, myUid, myCode]);

  // Add friend by fetching their shared data
  const addFriend = useCallback(async (code) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed === myCode) return "自分のコードは追加できません";
    if (friends.some(f => f.code === trimmed)) return "すでに友達です";

    // Try to load friend's shared public data
    let friendData = null;
    try {
      friendData = await storageGet(`public_${trimmed}`, true);
    } catch {}

    const newFriend = friendData ? {
      code: trimmed,
      name: friendData.name || `ユーザー(${trimmed})`,
      entries: friendData.entries || [],
    } : {
      code: trimmed,
      name: `ユーザー(${trimmed})`,
      entries: [
        { id:`f_${trimmed}_1`, shopName:"(データ取得待ち)", visitDate:new Date().toISOString().slice(0,10), rating:0, genre:"", area:"", images:[PH("⏳")], comment:"相手がアプリを使うと表示されます", privacy:PRIVACY.PUBLIC, ownerCode:trimmed },
      ],
    };
    setFriends(p => [...p, newFriend]);
    return null;
  }, [friends, myCode]);

  // Refresh friend data periodically
  const refreshFriends = useCallback(async () => {
    if (!friends.length) return;
    const updated = await Promise.all(friends.map(async f => {
      try {
        const data = await storageGet(`public_${f.code}`, true);
        if (data) return { ...f, name: data.name || f.name, entries: data.entries || f.entries };
      } catch {}
      return f;
    }));
    setFriends(updated);
  }, [friends]);

  useEffect(() => {
    if (!ready) return;
    refreshFriends();
    const id = setInterval(refreshFriends, 30000);
    return () => clearInterval(id);
  }, [ready]);

  const removeFriend = (code) => setFriends(p => p.filter(f => f.code !== code));

  // Fetch ranking from ramenDB
  const fetchRanking = useCallback(async (region) => {
    const r = region || rankingRegion;
    setRankingLoading(true);
    setRankingRegion(r);
    try {
      const result = await fetchRamenDBRanking(r);
      if (result && result.length > 0) {
        setRankingShops(result);
        const now = new Date().toISOString();
        setRankingLastFetch(now);
        if (myUid) {
          await storageSet(`${myUid}_ranking`, { shops: result, lastFetch: now, region: r });
        }
      }
    } catch (e) { console.error("fetchRanking error:", e); }
    finally { setRankingLoading(false); }
  }, [rankingRegion, myUid]);

  const t = THEMES[settings.theme] || THEMES.warm;

  if (!ready) {
    return (
      <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#FFF8F3",fontFamily:"'Shippori Mincho',Georgia,serif"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12,animation:"spin 1s linear infinite"}}>🍜</div>
          <div style={{fontSize:16,fontWeight:700,color:"#1A0A00"}}>Men～Log を読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <Ctx.Provider value={{
      myUid, myCode,
      entries, setEntries, groups, setGroups,
      profile, setProfile, settings, setSettings,
      friends, setFriends, addFriend, removeFriend, refreshFriends,
      rankingShops, rankingLoading, rankingRegion, rankingLastFetch, fetchRanking,
      filterMode, setFilterMode,
      tab, setTab, showPost, setShowPost,
      aiState, setAiState, t,
      detailEntryId, setDetailEntryId,
    }}>
      {children}
    </Ctx.Provider>
  );
}

// ─── ホーム ───────────────────────────────────────────
function HomePage() {
  const {entries,profile,friends,rankingShops,fetchRanking,rankingLoading,setTab,setFilterMode,t}=useApp();
  const [selMonth,setSelMonth]=useState(new Date().toISOString().slice(0,7));
  const months=Array.from(new Set(entries.map(e=>e.visitDate?.slice(0,7)).filter(Boolean))).sort().reverse();
  if(!months.includes(new Date().toISOString().slice(0,7))) months.unshift(new Date().toISOString().slice(0,7));
  const total=entries.length, month=entries.filter(e=>e.visitDate?.startsWith(selMonth)).length;
  const avg=total?(entries.reduce((a,b)=>a+(b.rating||0),0)/total).toFixed(1):"0.0";
  const friendPublic = friends.flatMap(f=>(f.entries||[]).filter(e=>e.privacy===PRIVACY.PUBLIC)).slice(0,3);
  return (
    <div style={{height:"100%",overflowY:"auto",background:t.bg}}>
      <div style={{background:t.grad,padding:"36px 18px 22px",color:"white",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:130,height:130,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}}/>
        <div style={{fontSize:12,opacity:0.8,marginBottom:4}}>おかえり 👋</div>
        <h2 style={{fontSize:22,fontFamily:"'Shippori Mincho',Georgia,serif",margin:0}}>{profile.name}さんのMen～Log</h2>
        {profile.station!=="未設定"&&<div style={{fontSize:11,opacity:0.72,marginTop:4}}>🚉 {profile.station} · ❤️ {profile.favorite}</div>}
        <div style={{display:"flex",gap:10,marginTop:18}}>
          <div onClick={()=>{setFilterMode({type:"all"});setTab(4);}} style={{flex:1,background:"rgba(255,255,255,0.18)",padding:13,borderRadius:13,textAlign:"center",cursor:"pointer"}}>
            <div style={{fontSize:10,opacity:0.82}}>訪問件数</div><div style={{fontSize:24,fontWeight:900,lineHeight:1.2}}>{total}</div><div style={{fontSize:9,opacity:0.65}}>→ 一覧</div>
          </div>
          <div style={{flex:1,background:"rgba(255,255,255,0.18)",padding:13,borderRadius:13,textAlign:"center",position:"relative"}}>
            <select value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{background:"none",border:"none",color:"white",fontSize:10,outline:"none",cursor:"pointer",width:"100%",textAlign:"center"}}>
              {months.map(m=><option key={m} value={m} style={{color:"#000"}}>{m}</option>)}
            </select>
            <div onClick={()=>{setFilterMode({type:"month",value:selMonth});setTab(4);}} style={{fontSize:24,fontWeight:900,lineHeight:1.2,cursor:"pointer"}}>{month}</div>
            <div style={{fontSize:9,opacity:0.65}}>→ 絞込</div>
          </div>
          <div onClick={()=>{setFilterMode({type:"high"});setTab(4);}} style={{flex:1,background:"rgba(255,255,255,0.18)",padding:13,borderRadius:13,textAlign:"center",cursor:"pointer"}}>
            <div style={{fontSize:10,opacity:0.82}}>平均</div><div style={{fontSize:24,fontWeight:900,lineHeight:1.2}}>{avg}★</div><div style={{fontSize:9,opacity:0.65}}>高評価</div>
          </div>
        </div>
      </div>
      <div style={{padding:"14px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontWeight:700,fontSize:14,color:t.tx}}>🔥 おすすめ</span>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>fetchRanking()} disabled={rankingLoading} style={{fontSize:10,color:t.acc,fontWeight:700,background:t.accm,border:"none",borderRadius:8,padding:"3px 8px",cursor:"pointer",opacity:rankingLoading?0.5:1}}>
              {rankingLoading?"取得中...":"🔄 最新取込"}
            </button>
            <a href={RAMENDB_RANK} target="_blank" rel="noreferrer" style={{fontSize:11,color:t.acc,fontWeight:700,textDecoration:"none"}}>全て見る →</a>
          </div>
        </div>
        <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>
          {(rankingShops.length > 0 ? rankingShops : INITIAL_SHOPS).slice(0,4).map((s,i)=>(
            <a key={i} href={`${RAMENDB_BASE}/s/${s.id}.html`} target="_blank" rel="noreferrer"
              style={{minWidth:118,flexShrink:0,background:t.card,border:`1px solid ${t.br}`,borderRadius:12,overflow:"hidden",textDecoration:"none"}}>
              <div style={{height:54,background:t.accm,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{["🥇","🥈","🥉","🏆"][i]}</div>
              <div style={{padding:"7px 9px"}}>
                <div style={{fontWeight:700,fontSize:11,color:t.tx,marginBottom:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",maxWidth:100}}>{s.name}</div>
                <div style={{fontSize:10,color:t.star,fontWeight:700}}>{s.score}pt</div>
              </div>
            </a>
          ))}
          {rankingShops.length===0 && INITIAL_SHOPS.length===0 && (
            <div onClick={()=>fetchRanking()} style={{minWidth:200,padding:"16px",background:t.accm,borderRadius:12,textAlign:"center",cursor:"pointer"}}>
              <div style={{fontSize:24,marginBottom:4}}>🍜</div>
              <div style={{fontSize:11,fontWeight:700,color:t.acc}}>タップしてランキング取得</div>
              <div style={{fontSize:9,color:t.txm}}>ラーメンDBから最新情報を取り込みます</div>
            </div>
          )}
        </div>
      </div>
      {friendPublic.length>0&&(
        <div style={{padding:"12px 16px 0"}}>
          <div style={{fontWeight:700,fontSize:14,color:t.tx,marginBottom:10}}>👥 友達の記録</div>
          <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
            {friendPublic.map(e=>(
              <div key={e.id} style={{minWidth:120,flexShrink:0,background:t.card,border:`1px solid ${t.br}`,borderRadius:12,overflow:"hidden",boxShadow:`0 2px 8px ${t.sh}`}}>
                <img src={e.images?.[0]||PH()} alt="" style={{width:"100%",height:70,objectFit:"cover"}} onError={ev=>{ev.target.src=PH();}}/>
                <div style={{padding:"6px 8px"}}>
                  <div style={{fontWeight:700,fontSize:11,color:t.tx}}>{e.shopName}</div>
                  <div style={{fontSize:9,color:t.txm}}>{e.ownerCode}</div>
                  <div style={{fontSize:10,color:t.star}}>{"★".repeat(e.rating||0)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{padding:"12px 16px 24px"}}>
        <div style={{fontWeight:700,fontSize:14,color:t.tx,marginBottom:10}}>📖 最近の記録</div>
        {entries.slice(0,4).map(e=>(
          <div key={e.id} style={{background:t.card,borderRadius:12,padding:11,marginBottom:8,display:"flex",gap:11,boxShadow:`0 2px 8px ${t.sh}`}}>
            <img src={e.images?.[0]||PH()} alt={e.shopName} style={{width:44,height:44,borderRadius:9,objectFit:"cover",flexShrink:0}} onError={ev=>{ev.target.src=PH();}}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:t.tx}}>{e.shopName}</div>
              <div style={{fontSize:11,color:t.txm}}>{e.visitDate}{e.genre?` · ${e.genre}`:""}</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                <div style={{fontSize:11,color:t.star}}>{"★".repeat(e.rating||0)}</div>
                <span style={{fontSize:10,color:e.privacy===PRIVACY.PUBLIC?t.acc:e.privacy===PRIVACY.FRIENDS?"#27ae60":t.txm}}>{PRIVACY_LABEL[e.privacy||PRIVACY.PRIVATE]}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── おすすめ ─────────────────────────────────────────
function RecommendPage() {
  const {rankingShops,rankingLoading,rankingRegion,rankingLastFetch,fetchRanking,t}=useApp();
  const [genre,setGenre]=useState("すべて");
  const [region,setRegion]=useState(rankingRegion);
  const shops = rankingShops || [];
  const list = genre==="すべて" ? shops : shops.filter(s=>s.genre===genre);
  const REGIONS = ["全国","東京","神奈川","千葉","埼玉","大阪","京都","福岡","北海道"];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:t.bg}}>
      {/* ヘッダー: ラーメンDB連携 */}
      <a href={RAMENDB_RANK} target="_blank" rel="noreferrer" style={{flexShrink:0,display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:t.accm,textDecoration:"none",borderBottom:`1px solid ${t.br}`}}>
        <span style={{fontSize:14}}>🌐</span><span style={{fontSize:11,fontWeight:700,color:t.acc,flex:1}}>ラーメンDB連携 — 通算ランキング</span><span style={{fontSize:10,color:t.txm}}>→</span>
      </a>

      {/* 取り込みボタン + 地域セレクト */}
      <div style={{flexShrink:0,padding:"8px 12px",display:"flex",gap:6,alignItems:"center",borderBottom:`1px solid ${t.br}`,background:t.card}}>
        <select value={region} onChange={e=>{setRegion(e.target.value);}} style={{padding:"4px 8px",borderRadius:8,border:`1px solid ${t.br}`,fontSize:11,color:t.tx,background:t.bg2,outline:"none"}}>
          {REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={()=>fetchRanking(region)} disabled={rankingLoading}
          style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:8,border:"none",background:t.grad,color:"white",fontSize:11,fontWeight:700,cursor:"pointer",opacity:rankingLoading?0.5:1}}>
          {rankingLoading ? (
            <><span style={{animation:"spin 0.5s linear infinite",display:"inline-block"}}>🍜</span> 取得中...</>
          ) : (
            <>🔄 最新情報取り込み</>
          )}
        </button>
        {rankingLastFetch && (
          <span style={{fontSize:9,color:t.txm,marginLeft:"auto"}}>
            更新: {new Date(rankingLastFetch).toLocaleDateString("ja-JP")} {new Date(rankingLastFetch).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}
          </span>
        )}
      </div>

      {/* ジャンルフィルター */}
      <div style={{flexShrink:0,padding:"8px 12px",display:"flex",gap:6,overflowX:"auto",borderBottom:`1px solid ${t.br}`}}>
        {["すべて","醤油","豚骨","塩","味噌","つけ麺","鶏白湯","二郎系","煮干し","その他"].map(g=>(
          <button key={g} onClick={()=>setGenre(g)} style={{flexShrink:0,padding:"4px 12px",borderRadius:20,border:"none",background:genre===g?t.acc:t.bg2,color:genre===g?"white":t.tx2,fontSize:11,fontWeight:600,cursor:"pointer"}}>{g}</button>
        ))}
      </div>

      {/* ランキングリスト */}
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        {shops.length === 0 ? (
          <div style={{textAlign:"center",padding:"40px 20px",color:t.txm}}>
            <div style={{fontSize:48,marginBottom:12}}>🍜</div>
            <div style={{fontWeight:700,color:t.tx,marginBottom:8,fontSize:16}}>ランキング未取得</div>
            <div style={{fontSize:12,marginBottom:20,lineHeight:1.7}}>
              上の「🔄 最新情報取り込み」ボタンをタップして<br/>
              ラーメンDBからリアルタイムのランキングを取得します
            </div>
            <button onClick={()=>fetchRanking(region)} disabled={rankingLoading}
              style={{padding:"12px 24px",background:t.grad,color:"white",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer",border:"none"}}>
              {rankingLoading ? "取得中..." : "🔄 ランキングを取得する"}
            </button>
          </div>
        ) : list.length === 0 ? (
          <div style={{textAlign:"center",padding:"32px",color:t.txm}}>
            <div style={{fontSize:32,marginBottom:8}}>🔍</div>
            <div>「{genre}」に該当する店舗がありません</div>
          </div>
        ) : list.map((s,i)=>{
          const origIdx = shops.indexOf(s);
          return (
          <div key={s.id||i} style={{background:t.card,padding:14,borderRadius:14,marginBottom:10,boxShadow:`0 2px 8px ${t.sh}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:origIdx===0?"#FFD700":origIdx===1?"#C0C0C0":origIdx===2?"#CD7F32":t.bg2,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:11,color:origIdx<3?"white":t.txm,flexShrink:0}}>{origIdx+1}</div>
                <span style={{fontWeight:700,fontSize:14,color:t.tx}}>{s.name}</span>
              </div>
              <span style={{color:t.star,fontWeight:900,fontSize:14}}>{s.score}pt</span>
            </div>
            <div style={{background:t.bg2,borderRadius:4,height:4,margin:"6px 0"}}><div style={{height:"100%",background:t.grad,width:`${Math.min(s.score,100)}%`,borderRadius:4}}/></div>
            <div style={{fontSize:12,color:t.txm,marginBottom:8}}>
              {s.area}{s.genre ? ` / ${s.genre}` : ""}
            </div>
            <a href={`${RAMENDB_BASE}/s/${s.id}.html`} target="_blank" rel="noreferrer" style={{display:"block",textAlign:"center",padding:"8px",background:t.bg2,borderRadius:10,fontSize:12,color:t.acc,fontWeight:700,textDecoration:"none"}}>🌐 ラーメンDBで詳細を見る</a>
          </div>
        );})}
      </div>
    </div>
  );
}

// ─── マップ ───────────────────────────────────────────
function MapPage() {
  const {entries,settings,t}=useApp();
  const [sel,setSel]=useState(null);
  const [userPos,setUserPos]=useState(null);
  const mapRef=useRef(null),gmapRef=useRef(null);
  const PIN_POS=[{l:"18%",t:"24%"},{l:"55%",t:"38%"},{l:"34%",t:"62%"},{l:"68%",t:"20%"},{l:"12%",t:"55%"},{l:"60%",t:"68%"}];
  const rc=r=>r>=5?"#E74C3C":r>=4?"#E67E22":"#95A5A6";
  const getLocation=()=>{if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(p=>setUserPos({lat:p.coords.latitude,lng:p.coords.longitude}),()=>alert("位置情報を取得できません"));};
  useEffect(()=>{
    if(!settings?.mapsApiKey||!mapRef.current)return;
    const init=()=>{if(!window.google||gmapRef.current)return;gmapRef.current=new window.google.maps.Map(mapRef.current,{center:userPos||{lat:35.6762,lng:139.6503},zoom:13});};
    if(window.google){init();return;}
    if(document.querySelector("#gmaps-script"))return;
    const s=document.createElement("script");s.id="gmaps-script";s.src=`https://maps.googleapis.com/maps/api/js?key=${settings.mapsApiKey}`;s.async=true;s.onload=init;document.head.appendChild(s);
  },[settings?.mapsApiKey,userPos]);
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:t.bg}}>
      <div style={{flexShrink:0,padding:"8px 14px",display:"flex",gap:6,borderBottom:`1px solid ${t.br}`,alignItems:"center"}}>
        <span style={{fontWeight:700,fontSize:13,color:t.tx}}>🗺️ 訪問マップ ({entries.length}件)</span>
        <button onClick={getLocation} style={{marginLeft:"auto",background:t.accm,border:"none",borderRadius:16,padding:"4px 10px",color:t.acc,fontSize:11,fontWeight:600,cursor:"pointer"}}>📍 現在地</button>
      </div>
      <div style={{flexShrink:0,margin:"10px 12px",borderRadius:14,overflow:"hidden",background:t.bg2,border:`1px solid ${t.br}`,position:"relative",height:220}}>
        {settings?.mapsApiKey?<div ref={mapRef} style={{width:"100%",height:"100%"}}/>:(
          <>
            <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${t.br} 1px,transparent 1px),linear-gradient(90deg,${t.br} 1px,transparent 1px)`,backgroundSize:"32px 32px",opacity:0.5}}/>
            <div style={{position:"absolute",top:"43%",left:0,right:0,height:3,background:t.br,opacity:.7}}/>
            <div style={{position:"absolute",left:"42%",top:0,bottom:0,width:3,background:t.br,opacity:.7}}/>
            {userPos&&<div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",fontSize:22}}>📍</div>}
            {entries.slice(0,6).map((e,i)=>(
              <button key={e.id||i} onClick={()=>setSel(sel?.id===e.id?null:e)}
                style={{position:"absolute",left:PIN_POS[i%6].l,top:PIN_POS[i%6].t,background:rc(e.rating||3),border:"2.5px solid white",borderRadius:16,padding:"2px 8px",color:"white",fontSize:10,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 6px rgba(0,0,0,.28)",transform:sel?.id===e.id?"scale(1.22) translateY(-4px)":"scale(1)",transition:"transform 0.18s"}}>
                📍{(e.shopName||"").slice(0,4)}
              </button>
            ))}
            <div style={{position:"absolute",bottom:7,left:7,right:7,background:"rgba(0,0,0,.7)",borderRadius:8,padding:"5px 9px",color:"white",fontSize:10,textAlign:"center"}}>🔑 設定でAPIキーを入力するとリアルマップに切替</div>
          </>
        )}
      </div>
      {sel&&(
        <div style={{flexShrink:0,margin:"0 12px 8px",background:t.card,border:`1px solid ${t.br}`,borderRadius:14,boxShadow:`0 2px 10px ${t.sh}`}}>
          <div style={{padding:"11px 13px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:40,height:40,borderRadius:10,background:t.accm,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{sel.emoji||"🍜"}</div>
            <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:t.tx}}>{sel.shopName}</div><Stars value={sel.rating||0} readonly size={12}/></div>
            <a href={`https://www.google.com/maps/search/${encodeURIComponent(sel.shopName)}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{background:t.bg2,borderRadius:8,padding:"6px 10px",fontSize:11,color:t.tx2,fontWeight:600,textDecoration:"none"}}>🗺 開く</a>
          </div>
        </div>
      )}
      <div style={{flex:1,overflowY:"auto",padding:"0 12px 10px",display:"flex",flexDirection:"column",gap:7}}>
        {entries.length===0?(
          <div style={{textAlign:"center",padding:"40px 20px",color:t.txm}}><div style={{fontSize:40,marginBottom:12}}>🗺️</div><div>記録を追加するとマップに表示されます</div></div>
        ):entries.map((e,i)=>(
          <div key={e.id||i} onClick={()=>setSel(p=>p?.id===e.id?null:e)} style={{background:t.card,border:sel?.id===e.id?`2px solid ${t.acc}`:`1px solid ${t.br}`,borderRadius:12,cursor:"pointer"}}>
            <div style={{padding:"11px 13px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:rc(e.rating||3),flexShrink:0}}/>
              <span style={{fontWeight:600,fontSize:13,flex:1,color:t.tx}}>{e.shopName}</span>
              <Stars value={e.rating||0} readonly size={11}/>
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(e.shopName)}`} target="_blank" rel="noreferrer" onClick={ev=>ev.stopPropagation()} style={{fontSize:11,color:t.acc,textDecoration:"none",fontWeight:600}}>🗺</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── アルバム詳細 ─────────────────────────────────────
function AlbumDetail() {
  const { entries, setEntries, detailEntryId, setDetailEntryId, t } = useApp();

  const startIdx = entries.findIndex(e => e.id === detailEntryId);
  const [cur, setCur] = useState(startIdx < 0 ? 0 : startIdx);
  const [mode, setMode] = useState("view");
  const [draft, setDraft] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [imgFull, setImgFull] = useState(false);
  const [imgFIdx, setImgFIdx] = useState(0);
  const [addLoading, setAddLoading] = useState(false);
  const [addProg, setAddProg] = useState(0);
  const [addTotal, setAddTotal] = useState(0);

  const entry = entries[cur];
  const images = entry?.images || [];
  const total = entries.length;

  const onClose = () => setDetailEntryId(null);

  useEffect(() => {
    const i = entries.findIndex(e => e.id === detailEntryId);
    if (i >= 0) setCur(i);
  }, [detailEntryId]);

  useEffect(() => { setImgFIdx(0); setMode("view"); setImgFull(false); setCollapsed(false); }, [cur]);

  useEffect(() => {
    if (mode === "edit" && entry) {
      setDraft({
        shopName: entry.shopName || "",
        visitDate: entry.visitDate || new Date().toISOString().slice(0,10),
        menu: entry.menu || "",
        price: entry.price || "",
        genre: entry.genre || "その他",
        area: entry.area || "",
        rating: entry.rating || 3,
        comment: entry.comment || "",
        privacy: entry.privacy || PRIVACY.PRIVATE,
      });
    }
  }, [mode, cur]);

  if (!entry) return null;

  const onDelete = id => { setEntries(p => p.filter(e => e.id !== id)); onClose(); };
  const onUpdate = (id, patch) => setEntries(p => p.map(e => e.id===id ? {...e,...patch} : e));
  const onRemoveImg = (id, idx) => setEntries(p => p.map(e => e.id===id ? {...e, images:(e.images||[]).filter((_,i)=>i!==idx)} : e));
  const onAddImgs = async (id, files) => {
    const arr = Array.from(files||[]); if(!arr.length) return;
    setAddLoading(true); setAddProg(0); setAddTotal(arr.length);
    const imgs = [];
    for(let i=0;i<arr.length;i++){
      const d = await readAsDataURL(arr[i]);
      if(d) imgs.push(d);
      setAddProg(i+1);
      await new Promise(r=>setTimeout(r,20));
    }
    setEntries(p => p.map(e => e.id===id ? {...e, images:dedupe([...(e.images||[]),...imgs])} : e));
    setAddLoading(false);
  };

  const swX = useRef(null), swY = useRef(null);
  const onAlbumTS = e => { swX.current=e.touches[0].clientX; swY.current=e.touches[0].clientY; };
  const onAlbumTE = e => {
    if(!swX.current) return;
    const dx=e.changedTouches[0].clientX-swX.current, dy=e.changedTouches[0].clientY-swY.current;
    swX.current=null;
    if(Math.abs(dy)>Math.abs(dx)*1.2) return;
    if(dx<-60 && cur<total-1) setCur(c=>c+1);
    if(dx> 60 && cur>0) setCur(c=>c-1);
  };

  const fsX = useRef(null);
  const onFsTS = e => { fsX.current=e.touches[0].clientX; };
  const onFsTE = e => {
    if(!fsX.current) return;
    const dx=e.changedTouches[0].clientX-fsX.current; fsX.current=null;
    if(dx<-40 && imgFIdx<images.length-1) setImgFIdx(i=>i+1);
    if(dx> 40 && imgFIdx>0) setImgFIdx(i=>i-1);
  };

  const lpT=useRef(null), lpM=useRef(false), addFileRef=useRef(null);
  const startLP = i => { lpM.current=false; lpT.current=setTimeout(()=>{ if(!lpM.current){if(navigator.vibrate)navigator.vibrate(25);setImgFIdx(i);setImgFull(true);} },400); };
  const cancelLP = () => clearTimeout(lpT.current);
  const moveLP = () => { lpM.current=true; cancelLP(); };

  const saveDraft = () => { if(draft&&draft.shopName.trim()){ onUpdate(entry.id,draft); setMode("view"); } };

  const D = v => (v && String(v).trim()) ? v : "—";
  const inp = { width:"100%", padding:"9px 11px", background:t.bg2, border:`1.5px solid ${t.br}`, borderRadius:9, fontSize:13, color:t.tx, outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
  const lbl = { fontSize:10, color:t.txm, fontWeight:700, marginBottom:4, display:"block" };
  const PRIV_OPTS = [
    [PRIVACY.PUBLIC, "🌐 全体公開", t.acc],
    [PRIVACY.FRIENDS, "👥 グループ", "#27ae60"],
    [PRIVACY.PRIVATE, "🔒 非公開", t.txm],
  ];

  return (
    <div style={{ position:"absolute", inset:0, zIndex:200, background:t.bg, display:"flex", flexDirection:"column", fontFamily:"'Noto Sans JP',ui-sans-serif,sans-serif", overflow:"hidden" }}>

      {imgFull && (
        <div style={{ position:"absolute", inset:0, zIndex:300, background:"#000", display:"flex", flexDirection:"column" }}
          onTouchStart={onFsTS} onTouchEnd={onFsTE}>
          <div style={{ flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px" }}>
            <button onClick={()=>setImgFull(false)}
              style={{ background:`${t.acc}22`, border:`1px solid ${t.acc}`, borderRadius:20, padding:"6px 18px", color:t.acc, fontSize:13, fontWeight:700, cursor:"pointer" }}>
              ✕ 閉じる
            </button>
            <span style={{ color:"rgba(255,255,255,0.7)", fontSize:12 }}>{imgFIdx+1} / {images.length}</span>
          </div>
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
            <img src={images[imgFIdx]} alt="" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }} onError={ev=>{ev.target.src=PH();}}/>
            {imgFIdx>0 && <button onClick={()=>setImgFIdx(i=>i-1)} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"50%", width:40, height:40, color:"white", fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>}
            {imgFIdx<images.length-1 && <button onClick={()=>setImgFIdx(i=>i+1)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,0.2)", border:"none", borderRadius:"50%", width:40, height:40, color:"white", fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>}
          </div>
          {images.length>1 && (
            <div style={{ flexShrink:0, display:"flex", justifyContent:"center", gap:5, padding:"12px 0" }}>
              {images.map((_,i)=><div key={i} onClick={()=>setImgFIdx(i)} style={{ width:i===imgFIdx?16:6, height:6, borderRadius:3, background:i===imgFIdx?"white":"rgba(255,255,255,0.35)", cursor:"pointer" }}/>)}
            </div>
          )}
        </div>
      )}

      {mode==="view" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}
          onTouchStart={onAlbumTS} onTouchEnd={onAlbumTE}>

          <div style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 12px 8px", background:t.bg }}>
            <div style={{ display:"flex", gap:7 }}>
              <button onClick={onClose} style={{ background:t.bg2, border:`1.5px solid ${t.br}`, borderRadius:20, padding:"7px 14px", color:t.tx2, fontSize:12, fontWeight:700, cursor:"pointer" }}>← 戻る</button>
              <button onClick={()=>setMode("edit")} style={{ background:t.accm, border:`1.5px solid ${t.acc}`, borderRadius:20, padding:"7px 14px", color:t.acc, fontSize:12, fontWeight:700, cursor:"pointer" }}>✏️ 編集</button>
            </div>
            <div style={{ display:"flex", borderRadius:12, overflow:"hidden", border:"1.5px solid #777" }}>
              <button onClick={()=>cur>0&&setCur(c=>c-1)}
                style={{ width:46, height:36, background:"#555", border:"none", borderRight:"1px solid #666", color:"white", fontSize:15, cursor:cur>0?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", opacity:cur>0?1:0.4 }}>◀</button>
              <button onClick={()=>cur<total-1&&setCur(c=>c+1)}
                style={{ width:46, height:36, background:"#555", border:"none", color:"white", fontSize:15, cursor:cur<total-1?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", opacity:cur<total-1?1:0.4 }}>▶</button>
            </div>
          </div>

          {total>1 && (
            <div style={{ flexShrink:0, display:"flex", justifyContent:"center", gap:4, paddingBottom:4 }}>
              {entries.map((_,i)=><div key={i} onClick={()=>setCur(i)} style={{ width:i===cur?14:5, height:4, borderRadius:2, background:i===cur?t.acc:t.br, cursor:"pointer" }}/>)}
            </div>
          )}

          <div style={{ flexShrink:0, margin:"0 12px 8px", background:t.bg2, border:`1.5px solid ${t.br}`, borderRadius:16, padding:"11px 13px", position:"relative", boxShadow:`0 2px 8px ${t.sh}` }}>
            <button onClick={()=>setCollapsed(c=>!c)}
              style={{ position:"absolute", top:8, right:8, background:t.card, border:`1px solid ${t.br}`, borderRadius:8, width:28, height:26, color:t.txm, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform 0.25s", transform:collapsed?"rotate(180deg)":"rotate(0deg)" }}>∨</button>

            <div style={{ paddingRight:34, fontSize:14, lineHeight:1.55 }}>
              <span style={{ color:t.tx2, fontWeight:700 }}>店名: </span>
              <span style={{ color:t.tx, fontWeight:600 }}>[{D(entry.shopName)}]</span>
            </div>

            {!collapsed && (
              <div style={{ display:"flex", flexDirection:"column", gap:2, marginTop:3 }}>
                {[["メニュー名",entry.menu],["価格",entry.price]].map(([label,val])=>(
                  <div key={label} style={{ fontSize:14, lineHeight:1.55 }}>
                    <span style={{ color:t.tx2, fontWeight:700 }}>{label}: </span>
                    <span style={{ color:val?t.tx:t.txm }}>[{D(val)}]</span>
                  </div>
                ))}
                <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:14, lineHeight:1.55 }}>
                  <span style={{ color:t.tx2, fontWeight:700 }}>評価: </span>
                  <span>[{[1,2,3,4,5].map(n=><span key={n} style={{ color:(entry.rating||0)>=n?t.star:t.br }}>★</span>)}]</span>
                </div>
                <div style={{ fontSize:14, lineHeight:1.55 }}>
                  <span style={{ color:t.tx2, fontWeight:700 }}>レビュー: </span>
                  <span style={{ color:entry.comment?t.tx:t.txm }}>[{D(entry.comment)}]</span>
                </div>
                <div style={{ fontSize:14, lineHeight:1.55 }}>
                  <span style={{ color:t.tx2, fontWeight:700 }}>最寄り駅: </span>
                  <span style={{ color:entry.area?t.tx:t.txm }}>[{D(entry.area)}]</span>
                </div>
                {/* ラーメンDBリンク */}
                {entry.ramendbUrl && (
                  <a href={entry.ramendbUrl} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:4, padding:"4px 10px", background:t.accm, borderRadius:8, fontSize:11, fontWeight:700, color:t.acc, textDecoration:"none" }}>
                    🌐 ラーメンDBで見る
                  </a>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap", marginTop:3 }}>
                  <span style={{ fontSize:13, color:t.tx2, fontWeight:700 }}>公開: </span>
                  {PRIV_OPTS.map(([key,label,col])=>(
                    <button key={key} onClick={()=>onUpdate(entry.id,{privacy:key})}
                      style={{ padding:"3px 9px", borderRadius:10, border:`1.5px solid ${(entry.privacy||PRIVACY.PRIVATE)===key?col:t.br}`, background:(entry.privacy||PRIVACY.PRIVATE)===key?`${col}18`:t.bg2, color:(entry.privacy||PRIVACY.PRIVATE)===key?col:t.txm, fontSize:10, fontWeight:700, cursor:"pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, padding:"0 12px 8px" }}>
            <div style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ fontSize:15, fontWeight:700, color:t.tx }}>写真</span>
              <button onClick={() => addFileRef.current?.click()}
                style={{ padding:"4px 10px", background:t.accm, border:`1px solid ${t.acc}`, borderRadius:10, color:t.acc, fontWeight:700, fontSize:11, cursor:"pointer" }}>
                ＋ 追加
              </button>
              <input ref={addFileRef} type="file" multiple accept="image/*" style={{display:"none"}}
                onChange={ev=>{
                  const arr = Array.from(ev.target.files || []);
                  ev.target.value="";
                  onAddImgs(entry.id, arr);
                }}/>
            </div>

            {addLoading && (
              <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:8, background:t.bg2, borderRadius:9, padding:"6px 10px", marginBottom:6 }}>
                <div style={{ fontSize:15, animation:"spin 0.5s linear infinite" }}>🍜</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:t.tx }}>追加中... {addProg}/{addTotal}</div>
                  <div style={{ height:3, background:t.br, borderRadius:2, overflow:"hidden", marginTop:2 }}>
                    <div style={{ height:"100%", background:t.grad, width:`${addTotal>0?(addProg/addTotal)*100:0}%` }}/>
                  </div>
                </div>
              </div>
            )}

            <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
              {images.length > 0 ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {images.map((img,i)=>(
                    <div key={i} style={{ position:"relative", paddingBottom:"100%", borderRadius:11, overflow:"hidden", background:t.bg2 }}
                      onMouseDown={()=>startLP(i)} onMouseUp={cancelLP} onMouseLeave={cancelLP}
                      onTouchStart={()=>startLP(i)} onTouchEnd={cancelLP} onTouchMove={moveLP}>
                      <img src={img} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", display:"block" }} onError={ev=>{ev.target.src=PH();}}/>
                      <button onClick={e=>{e.stopPropagation();onRemoveImg(entry.id,i);}}
                        style={{ position:"absolute", top:4, right:4, background:"rgba(231,76,60,0.85)", border:"none", borderRadius:"50%", width:22, height:22, color:"white", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ height:120, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg2, border:`1.5px dashed ${t.br}`, borderRadius:12, color:t.txm }}>
                  <div style={{ fontSize:32, marginBottom:6, opacity:0.5 }}>📷</div>
                  <div style={{ fontSize:12 }}>写真なし — 上の「＋ 追加」から</div>
                </div>
              )}

              <button onClick={()=>{if(window.confirm(`「${entry.shopName}」を削除しますか？`)){onDelete(entry.id);}}}
                style={{ width:"100%", padding:"9px", borderRadius:9, border:"1.5px solid #FADBD8", background:"#FFF5F5", color:"#E74C3C", fontWeight:600, fontSize:12, cursor:"pointer", marginTop:8, marginBottom:8 }}>
                🗑️ このアルバムを削除
              </button>
            </div>
          </div>
        </div>
      )}

      {mode==="edit" && draft && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:`1px solid ${t.br}`, background:t.card }}>
            <button onClick={()=>setMode("view")} style={{ background:t.bg2, border:`1.5px solid ${t.br}`, borderRadius:18, padding:"7px 14px", color:t.txm, fontSize:12, fontWeight:700, cursor:"pointer" }}>← 戻る</button>
            <span style={{ flex:1, fontWeight:700, fontSize:14, color:t.tx }}>✏️ 記録を編集</span>
            <button onClick={saveDraft}
              style={{ background:draft.shopName.trim()?t.grad:"#ccc", border:"none", borderRadius:18, padding:"8px 18px", color:"white", fontSize:13, fontWeight:700, cursor:draft.shopName.trim()?"pointer":"default" }}>
              ✅ 登録
            </button>
          </div>
          <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:"14px 14px 40px" }}>
            {[
              ["🏪","店舗名 *","shopName","例：らぁ麺 飯田商店"],
              ["🍜","メニュー名","menu","例：特製醤油らーめん"],
              ["💴","価格","price","例：¥1,200"],
              ["📍","エリア / 最寄り駅","area","例：新宿"],
            ].map(([ico,label,key,ph])=>(
              <div key={key} style={{ marginBottom:13 }}>
                <span style={lbl}>{ico} {label}</span>
                <input style={inp} value={draft[key]} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))} placeholder={ph}/>
              </div>
            ))}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:13 }}>
              <div>
                <span style={lbl}>📅 訪問日</span>
                <input type="date" style={inp} value={draft.visitDate} onChange={e=>setDraft(d=>({...d,visitDate:e.target.value}))}/>
              </div>
              <div>
                <span style={lbl}>ジャンル</span>
                <select style={{...inp,height:40}} value={draft.genre} onChange={e=>setDraft(d=>({...d,genre:e.target.value}))}>
                  {["醤油","豚骨","塩","味噌","つけ麺","鶏白湯","二郎系","中華そば","煮干し","担々麺","その他"].map(g=><option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <span style={lbl}>⭐ 評価</span>
              <div style={{ display:"flex", gap:8 }}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>setDraft(d=>({...d,rating:n}))}
                    style={{ width:44, height:44, borderRadius:"50%", border:"none", background:draft.rating>=n?t.star:"#eee", color:draft.rating>=n?"white":"#bbb", fontSize:22, cursor:"pointer" }}>★</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <span style={lbl}>💬 レビュー・コメント</span>
              <textarea style={{...inp,minHeight:80,resize:"none",lineHeight:1.65}} value={draft.comment} onChange={e=>setDraft(d=>({...d,comment:e.target.value}))} placeholder="感想・おすすめポイントなど"/>
            </div>
            <div style={{ marginBottom:20 }}>
              <span style={lbl}>🔐 公開設定</span>
              <div style={{ display:"flex", gap:6 }}>
                {PRIV_OPTS.map(([key,label,col])=>(
                  <button key={key} onClick={()=>setDraft(d=>({...d,privacy:key}))}
                    style={{ flex:1, padding:"10px 4px", borderRadius:10, border:`1.5px solid ${draft.privacy===key?col:t.br}`, background:draft.privacy===key?`${col}18`:t.bg2, color:draft.privacy===key?col:t.tx2, fontSize:10, fontWeight:700, cursor:"pointer" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── アルバムページ ──────────────────────────────────
function AlbumPage() {
  const { entries, setEntries, setDetailEntryId, t } = useApp();
  const [addLoading, setAddLoading] = useState(false);
  const [addProg, setAddProg] = useState(0);
  const [addTotal, setAddTotal] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProg, setAiProg] = useState(0);
  const [aiTotal, setAiTotal] = useState(0);
  const [aiShop, setAiShop] = useState("");
  const [aiSummary, setAiSummary] = useState(null);
  const lpTimer = useRef(null);
  const lpFired = useRef(false);
  const lpMoving = useRef(false);
  const aiFileRef = useRef(null);
  const emptyFileRef = useRef(null);

  const startLP = (id) => {
    lpFired.current = false;
    lpMoving.current = false;
    lpTimer.current = setTimeout(() => {
      if (lpMoving.current) return;
      lpFired.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      setDetailEntryId(id);
    }, 480);
  };
  const cancelLP = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };
  const markMove = () => { lpMoving.current = true; cancelLP(); };

  const handleAIImport = async (ev) => {
    const files = Array.from(ev.target.files || []);
    ev.target.value = "";
    if (!files.length) return;
    let location = null;
    try {
      location = await new Promise((res, rej) => {
        if (!navigator.geolocation) { rej(); return; }
        navigator.geolocation.getCurrentPosition(
          p => res(`${p.coords.latitude.toFixed(2)},${p.coords.longitude.toFixed(2)}`),
          () => rej(), { timeout:4000 }
        );
      });
    } catch {}
    setAiLoading(true); setAiProg(0); setAiTotal(files.length); setAiShop(""); setAiSummary(null);
    try {
      const { entries: ne, summary } = await runAIBulk({
        files, entries, location,
        onProgress: (p, tot, name) => { setAiProg(p); setAiTotal(tot); setAiShop(name); },
      });
      setEntries(ne);
      setAiSummary(summary);
    } catch (err) { console.error(err); }
    finally { setAiLoading(false); setAiShop(""); }
  };

  const privIcon = { public:"🌐", friends:"👥", private:"🔒" };
  const privColor = { public:t.acc, friends:"#27ae60", private:t.txm };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:t.bg, position:"relative" }}>

      {aiLoading && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.9)", zIndex:50, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>
          <div style={{ fontSize:68, marginBottom:18, animation:"spin 0.55s linear infinite" }}>🍜</div>
          <div style={{ color:"white", fontWeight:700, fontSize:20, marginBottom:6 }}>AI 深層解析中...</div>
          <div style={{ color:"rgba(255,255,255,0.6)", fontSize:12, marginBottom:10 }}>3段階フォールバック解析 + 自動リトライ</div>
          {aiShop && <div style={{ color:"#FADBD8", fontSize:13, marginBottom:14, textAlign:"center", maxWidth:260 }}>🔍「{aiShop}」</div>}
          <div style={{ width:240, height:7, background:"rgba(255,255,255,0.15)", borderRadius:4, overflow:"hidden", marginBottom:8 }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#E74C3C,#FF6B6B)", width:`${aiTotal>0?(aiProg/aiTotal)*100:0}%`, borderRadius:4, transition:"width 0.3s" }}/>
          </div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12 }}>{aiProg} / {aiTotal} 枚</div>
          <div style={{ marginTop:18, color:"rgba(255,255,255,0.28)", fontSize:11, textAlign:"center", lineHeight:1.9 }}>
            Phase1→Phase2→Phase3の3段階解析<br/>
            失敗時は自動リトライ + ジャンル推定命名
          </div>
        </div>
      )}

      {addLoading && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)", zIndex:50, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontSize:50, animation:"spin 0.5s linear infinite", marginBottom:14 }}>🍜</div>
          <div style={{ color:"white", fontWeight:700, fontSize:16, marginBottom:8 }}>画像を追加中...</div>
          <div style={{ width:180, height:5, background:"rgba(255,255,255,0.2)", borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#E74C3C,#FF6B6B)", width:`${addTotal>0?(addProg/addTotal)*100:0}%`, borderRadius:3, transition:"width 0.2s" }}/>
          </div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, marginTop:6 }}>{addProg}/{addTotal}枚</div>
        </div>
      )}

      <div style={{ flexShrink:0, padding:"10px 14px", borderBottom:`1px solid ${t.br}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:t.card }}>
        <div>
          <span style={{ fontWeight:700, fontSize:14, color:t.tx }}>📷 アルバム</span>
          <span style={{ fontSize:11, color:t.txm, marginLeft:6 }}>({entries.length}件)</span>
        </div>
        <button
          onClick={() => aiFileRef.current?.click()}
          style={{ display:"flex", alignItems:"center", gap:5, background:t.grad, color:"white", borderRadius:10, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", border:"none", boxShadow:`0 2px 8px ${t.sh}` }}>
          <span>🤖</span><span>AI取込</span>
        </button>
        <input ref={aiFileRef} type="file" multiple accept="image/*" style={{display:"none"}} onChange={handleAIImport}/>
      </div>

      {aiSummary && (
        <div style={{ flexShrink:0, margin:"8px 12px 0", background:t.card, borderRadius:12, padding:"10px 14px", border:`1px solid ${t.br}`, boxShadow:`0 2px 8px ${t.sh}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ fontSize:12, fontWeight:700, color:t.acc }}>✅ AI振り分け完了 — {aiSummary.length}件処理</span>
            <button onClick={() => setAiSummary(null)} style={{ background:"none", border:"none", fontSize:16, color:t.txm, cursor:"pointer", lineHeight:1 }}>×</button>
          </div>
          <div style={{ display:"flex", gap:10, marginBottom:6 }}>
            {[
              ["新規", aiSummary.filter(s=>s.action==="新規作成").length, t.acc],
              ["追加", aiSummary.filter(s=>s.action==="追加").length, "#27ae60"],
              ["スキップ", aiSummary.filter(s=>s.action==="重複スキップ").length, t.txm],
            ].map(([l,c,col])=>(
              <div key={l} style={{ textAlign:"center", background:t.bg2, borderRadius:8, padding:"5px 10px", flex:1 }}>
                <div style={{ fontSize:16, fontWeight:700, color:col }}>{c}</div>
                <div style={{ fontSize:9, color:t.txm }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ maxHeight:72, overflowY:"auto" }}>
            {aiSummary.map((s, i) => (
              <div key={i} style={{ fontSize:10, color:t.txm, display:"flex", gap:6, marginBottom:2 }}>
                <span style={{ color:s.action==="新規作成"?t.acc:s.action==="追加"?"#27ae60":t.txm, fontWeight:700, flexShrink:0 }}>{s.action}</span>
                <span style={{ overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{s.shopName}</span>
                {s.confidence > 0 && <span style={{ color:t.star, flexShrink:0 }}>({s.confidence}%)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:10 }}>
        {entries.length === 0 ? (
          <div style={{ textAlign:"center", padding:"52px 20px", color:t.txm }}>
            <div style={{ fontSize:52, marginBottom:14 }}>📷</div>
            <div style={{ fontWeight:700, color:t.tx, marginBottom:6, fontSize:16 }}>アルバムがありません</div>
            <div style={{ fontSize:12, marginBottom:20, lineHeight:1.7 }}>
              「🤖 AI取込」から複数枚選択すると<br/>3段階AI解析（テキスト検出→ビジュアル分析→ラーメンDB照合）で<br/>自動でアルバムを作成します
            </div>
            <button
              onClick={() => emptyFileRef.current?.click()}
              style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"12px 24px", background:t.grad, color:"white", borderRadius:12, fontSize:14, fontWeight:700, cursor:"pointer", border:"none", boxShadow:`0 4px 14px ${t.sh}` }}>
              🤖 画像を選択してAI解析
            </button>
            <input ref={emptyFileRef} type="file" multiple accept="image/*" style={{display:"none"}} onChange={handleAIImport}/>
          </div>
        ) : (
          <>
            <div style={{ fontSize:11, color:t.txm, textAlign:"center", marginBottom:8, padding:"4px 8px", background:t.bg2, borderRadius:8 }}>
              長押しでアルバム詳細を表示
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {entries.map(e => (
                <div key={e.id}
                  onMouseDown={()=>startLP(e.id)} onMouseUp={cancelLP} onMouseLeave={cancelLP}
                  onTouchStart={()=>startLP(e.id)} onTouchEnd={cancelLP} onTouchMove={markMove}
                  style={{ background:t.card, borderRadius:13, overflow:"hidden", position:"relative", boxShadow:`0 2px 10px ${t.sh}`, cursor:"pointer", userSelect:"none", WebkitUserSelect:"none" }}>
                  <div style={{ position:"relative" }}>
                    <img src={e.images?.[0] || PH(e.emoji||"🍜")} alt={e.shopName}
                      style={{ width:"100%", height:118, objectFit:"cover", display:"block", pointerEvents:"none" }}
                      onError={ev=>{ev.target.src=PH();}}/>
                    {(e.images?.length||0) > 1 && (
                      <div style={{ position:"absolute", top:6, left:6, background:"rgba(0,0,0,0.65)", color:"white", fontSize:9, fontWeight:700, borderRadius:7, padding:"2px 6px" }}>
                        📷 {e.images.length}
                      </div>
                    )}
                    <div style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.55)", color:privColor[e.privacy||PRIVACY.PRIVATE], fontSize:12, borderRadius:7, padding:"2px 6px", fontWeight:700 }}>
                      {privIcon[e.privacy||PRIVACY.PRIVATE]}
                    </div>
                    {e.aiDetected && (
                      <div style={{ position:"absolute", bottom:6, left:6, background:"rgba(0,0,0,0.6)", color:"white", fontSize:9, borderRadius:7, padding:"2px 6px" }}>🤖 AI</div>
                    )}
                  </div>
                  <div style={{ padding:"8px 10px 10px" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:t.tx, marginBottom:2, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                      {e.shopName}
                    </div>
                    {e.menu && (
                      <div style={{ fontSize:10, color:t.acc, marginBottom:2, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                        {e.menu}
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:9, color:t.txm }}>{e.visitDate || "—"}</span>
                      {e.price ? (
                        <span style={{ fontSize:9, color:t.star, fontWeight:700 }}>{e.price}</span>
                      ) : (
                        <span style={{ fontSize:10, color:t.star }}>{"★".repeat(e.rating||0)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── マイページ ──────────────────────────────────────
function MyPage() {
  const {entries,setEntries,groups,setGroups,profile,setProfile,settings,setSettings,friends,addFriend,removeFriend,refreshFriends,filterMode,setFilterMode,myCode,setDetailEntryId,t}=useApp();
  const [view,setView]=useState("you");
  const [filterG,setFilterG]=useState("すべて");
  const [filterGenre,setFilterGenre]=useState("すべて");
  const [newGName,setNewGName]=useState("");
  const [newMem,setNewMem]=useState("");
  const [expandG,setExpandG]=useState(null);
  const [friendCode,setFriendCode]=useState("");
  const [friendMsg,setFriendMsg]=useState("");
  const [showInvite,setShowInvite]=useState(null);
  const [addingFriend,setAddingFriend]=useState(false);
  const mpLpTimer = useRef(null);
  const mpLpMoved = useRef(false);
  const startMpLP = (id) => {
    mpLpMoved.current=false;
    mpLpTimer.current=setTimeout(()=>{
      if(mpLpMoved.current)return;
      if(navigator.vibrate)navigator.vibrate(30);
      setDetailEntryId(id);
    },480);
  };
  const cancelMpLP = ()=>{ clearTimeout(mpLpTimer.current); mpLpTimer.current=null; };
  const moveMpLP = ()=>{ mpLpMoved.current=true; cancelMpLP(); };

  const filtered=entries.filter(e=>{
    if(filterG!=="すべて"&&e.groupId!==filterG)return false;
    if(filterGenre!=="すべて"&&e.genre!==filterGenre)return false;
    if(filterMode.type==="month")return e.visitDate?.startsWith(filterMode.value);
    if(filterMode.type==="high")return e.rating>=4;
    return true;
  });
  const resetFilter=()=>{setFilterMode({type:"all",value:null});setFilterG("すべて");setFilterGenre("すべて");};
  const createGroup=()=>{if(!newGName.trim())return;setGroups(p=>[...p,{id:`g${Date.now()}`,name:newGName.trim(),emoji:"🍜",members:[myCode]}]);setNewGName("");};
  const addMember=(gid)=>{if(!newMem.trim())return;setGroups(p=>p.map(g=>g.id===gid?{...g,members:[...g.members,newMem.trim()]}:g));setNewMem("");};
  const handleAddFriend=async()=>{
    setAddingFriend(true);
    const err=await addFriend(friendCode);
    setAddingFriend(false);
    if(err){setFriendMsg(err);}else{setFriendMsg("✅ 友達を追加しました！");setFriendCode("");}
    setTimeout(()=>setFriendMsg(""),3000);
  };

  const sendGroupInvite=(g)=>{
    const msg=`【Men～Log】グループ「${g.name}」に招待します！\nフレンドコード: ${myCode}\nアプリ: ${APP_LINK}`;
    window.open(`https://line.me/R/share?text=${encodeURIComponent(msg)}`,"_blank");
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:t.bg}}>
      <div style={{flexShrink:0,background:t.grad,padding:"16px",color:"white"}}>
        <div style={{fontWeight:700,fontSize:20,fontFamily:"'Shippori Mincho',Georgia,serif"}}>{profile.name}</div>
        <div style={{fontSize:11,opacity:0.75}}>{profile.station} · ❤️ {profile.favorite}</div>
        <div style={{marginTop:6,fontSize:11,background:"rgba(255,255,255,0.2)",borderRadius:8,padding:"4px 10px",display:"inline-flex",alignItems:"center",gap:6}}>
          <span>🔑 フレンドコード:</span>
          <span style={{fontWeight:700,letterSpacing:"0.1em"}}>{myCode}</span>
          <button onClick={()=>{navigator.clipboard?.writeText(myCode).then(()=>alert("コピーしました")).catch(()=>alert(myCode));}}
            style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:6,padding:"2px 8px",color:"white",fontSize:10,cursor:"pointer"}}>コピー</button>
        </div>
      </div>

      <div style={{flexShrink:0,display:"flex",borderBottom:`1px solid ${t.br}`}}>
        {[["you","👤 あなた"],["friends","👥 フレンド"],["group","🍜 グループ"],["settings","⚙️ 設定"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"9px 2px",border:"none",background:"transparent",color:view===v?t.acc:t.txm,fontWeight:700,fontSize:11,cursor:"pointer",borderBottom:view===v?`2px solid ${t.acc}`:"2px solid transparent"}}>{l}</button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:14}}>

        {view==="you"&&(
          <>
            <section style={{background:t.card,padding:16,borderRadius:14,marginBottom:14,boxShadow:`0 2px 8px ${t.sh}`}}>
              <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:10}}>✏️ プロフィール編集</div>
              {[["ニックネーム","name","例：ラーメン太郎"],["最寄り駅","station","例：新宿駅"]].map(([label,key,ph])=>(
                <div key={key} style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:t.txm,marginBottom:3}}>{label}</div>
                  <input style={{...INP(t),marginBottom:0}} value={profile[key]||""} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))} placeholder={ph}/>
                </div>
              ))}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:t.txm,marginBottom:4}}>性別</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {["未設定","男性","女性","その他"].map(g=>(
                    <button key={g} onClick={()=>setProfile(p=>({...p,gender:g}))} style={{padding:"5px 12px",borderRadius:16,border:"none",background:profile.gender===g?t.acc:t.bg2,color:profile.gender===g?"white":t.tx2,fontSize:11,fontWeight:600,cursor:"pointer"}}>{g}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:11,color:t.txm,marginBottom:4}}>好きなジャンル</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {["醤油","豚骨","塩","味噌","つけ麺","その他"].map(g=>(
                    <button key={g} onClick={()=>setProfile(p=>({...p,favorite:g}))} style={{padding:"4px 10px",borderRadius:16,border:"none",background:profile.favorite===g?t.acc:t.bg2,color:profile.favorite===g?"white":t.tx2,fontSize:11,fontWeight:600,cursor:"pointer"}}>{g}</button>
                  ))}
                </div>
              </div>
            </section>

            <section style={{background:t.card,padding:14,borderRadius:14,marginBottom:14,boxShadow:`0 2px 8px ${t.sh}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontWeight:700,fontSize:13,color:t.tx}}>🔍 絞り込み</span>
                <button onClick={resetFilter} style={{fontSize:11,color:"#E74C3C",border:"none",background:"#FFF5F5",borderRadius:8,padding:"3px 10px",cursor:"pointer"}}>🔄 リセット</button>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:t.txm,marginBottom:4}}>ジャンル</div>
                <div style={{display:"flex",gap:5,overflowX:"auto"}}>
                  {["すべて","醤油","豚骨","塩","味噌","つけ麺","その他"].map(g=>(
                    <button key={g} onClick={()=>setFilterGenre(g)} style={{flexShrink:0,padding:"3px 10px",borderRadius:16,border:"none",background:filterGenre===g?t.acc:t.bg2,color:filterGenre===g?"white":t.tx2,fontSize:11,fontWeight:600,cursor:"pointer"}}>{g}</button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["all","high"].map(type=>(
                  <button key={type} onClick={()=>setFilterMode({type,value:null})} style={{padding:"4px 12px",borderRadius:14,border:"none",background:filterMode.type===type?t.acc:t.bg2,color:filterMode.type===type?"white":t.tx2,fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    {type==="all"?"全て":"高評価(4★↑)"}
                  </button>
                ))}
              </div>
            </section>

            <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:4}}>記録一覧 ({filtered.length}件)</div>
            <div style={{fontSize:11,color:t.txm,marginBottom:8}}>長押しで詳細を表示</div>
            {filtered.map(e=>(
              <div key={e.id}
                onMouseDown={()=>startMpLP(e.id)} onMouseUp={cancelMpLP} onMouseLeave={cancelMpLP}
                onTouchStart={()=>startMpLP(e.id)} onTouchEnd={cancelMpLP} onTouchMove={moveMpLP}
                style={{background:t.card,padding:11,borderRadius:12,marginBottom:8,display:"flex",gap:11,boxShadow:`0 2px 6px ${t.sh}`,cursor:"pointer",userSelect:"none",WebkitUserSelect:"none"}}>
                <img src={e.images?.[0]||PH()} alt={e.shopName} style={{width:52,height:52,borderRadius:9,objectFit:"cover",flexShrink:0}} onError={ev=>{ev.target.src=PH();}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:t.tx,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{e.shopName}</div>
                  <div style={{fontSize:11,color:t.txm}}>{e.visitDate} / {"★".repeat(e.rating||0)}</div>
                  <span style={{fontSize:10,fontWeight:700,color:e.privacy===PRIVACY.PUBLIC?t.acc:e.privacy===PRIVACY.FRIENDS?"#27ae60":t.txm}}>{PRIVACY_LABEL[e.privacy||PRIVACY.PRIVATE]}</span>
                </div>
                <div style={{fontSize:10,color:t.txm,alignSelf:"center",flexShrink:0}}>長押し→</div>
              </div>
            ))}
          </>
        )}

        {view==="friends"&&(
          <>
            <section style={{background:t.card,padding:16,borderRadius:14,marginBottom:14,boxShadow:`0 2px 8px ${t.sh}`}}>
              <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:10}}>👥 フレンドを追加</div>
              <div style={{fontSize:12,color:t.txm,marginBottom:8,lineHeight:1.6}}>
                相手のフレンドコードを入力すると、<br/>相手の公開アルバムを閲覧できます。
              </div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input value={friendCode} onChange={e=>setFriendCode(e.target.value.toUpperCase())} placeholder="フレンドコード（例: AB3X7Y2Z）"
                  style={{...INP(t),marginBottom:0,flex:1,textTransform:"uppercase",letterSpacing:"0.1em"}}/>
                <button onClick={handleAddFriend} disabled={addingFriend} style={{padding:"10px 14px",borderRadius:9,border:"none",background:t.grad,color:"white",fontWeight:700,cursor:"pointer",flexShrink:0,opacity:addingFriend?0.6:1}}>
                  {addingFriend?"...":"追加"}
                </button>
              </div>
              {friendMsg&&<div style={{fontSize:12,color:friendMsg.startsWith("✅")?t.acc:"#E74C3C",fontWeight:600}}>{friendMsg}</div>}
              <div style={{marginTop:10,padding:"10px 12px",background:t.bg2,borderRadius:10,fontSize:11,color:t.txm,lineHeight:1.7}}>
                💡 あなたのフレンドコード: <strong style={{color:t.acc,letterSpacing:"0.08em"}}>{myCode}</strong><br/>
                LINEで友達に共有して相互フォローできます。<br/>
                <span style={{fontSize:10,color:t.acc}}>※ 相手もMen～Logを使うとデータが自動同期されます</span>
              </div>
              <button onClick={()=>{const msg=`【Men～Log】フレンドになりましょう！\nコード: ${myCode}\n${APP_LINK}`;window.open(`https://line.me/R/share?text=${encodeURIComponent(msg)}`,"_blank");}}
                style={{width:"100%",padding:"10px",borderRadius:10,border:"none",background:"#06C755",color:"white",fontWeight:700,fontSize:13,cursor:"pointer",marginTop:10}}>
                💬 LINEでコードを送る
              </button>
              <button onClick={()=>refreshFriends()} style={{width:"100%",padding:"8px",borderRadius:10,border:`1.5px solid ${t.br}`,background:t.bg2,color:t.tx2,fontWeight:600,fontSize:12,cursor:"pointer",marginTop:6}}>
                🔄 友達データを更新
              </button>
            </section>

            <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:8}}>友達一覧 ({friends.length}人)</div>
            {friends.length===0?(
              <div style={{textAlign:"center",padding:"32px",color:t.txm,background:t.card,borderRadius:14}}><div style={{fontSize:36,marginBottom:8}}>👥</div><div>まだ友達がいません</div></div>
            ):friends.map(f=>(
              <div key={f.code} style={{background:t.card,borderRadius:12,marginBottom:10,overflow:"hidden",boxShadow:`0 2px 8px ${t.sh}`}}>
                <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:t.accm,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>😊</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:t.tx}}>{f.name}</div>
                    <div style={{fontSize:10,color:t.txm}}>コード: {f.code}</div>
                  </div>
                  <button onClick={()=>removeFriend(f.code)} style={{background:"#FFF5F5",border:"none",borderRadius:7,padding:"4px 9px",fontSize:10,color:"#E74C3C",cursor:"pointer"}}>削除</button>
                </div>
                <div style={{padding:"0 14px 12px"}}>
                  <div style={{fontSize:11,color:t.txm,marginBottom:6}}>公開アルバム ({(f.entries||[]).filter(e=>e.privacy===PRIVACY.PUBLIC).length}件)</div>
                  <div style={{display:"flex",gap:8,overflowX:"auto"}}>
                    {(f.entries||[]).filter(e=>e.privacy===PRIVACY.PUBLIC).map(e=>(
                      <div key={e.id} style={{minWidth:80,flexShrink:0,background:t.bg2,borderRadius:8,overflow:"hidden"}}>
                        <img src={e.images?.[0]||PH()} alt="" style={{width:80,height:60,objectFit:"cover"}} onError={ev=>{ev.target.src=PH();}}/>
                        <div style={{padding:"4px 6px",fontSize:9,color:t.tx,fontWeight:700,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{e.shopName}</div>
                      </div>
                    ))}
                    {(f.entries||[]).filter(e=>e.privacy===PRIVACY.PUBLIC).length===0&&(
                      <div style={{fontSize:11,color:t.txm}}>公開アルバムがありません</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {view==="group"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontWeight:700,fontSize:13,color:t.tx}}>グループ ({groups.length})</span>
              <button onClick={()=>setShowInvite(null)} style={{background:t.accm,border:"none",borderRadius:16,padding:"4px 11px",color:t.acc,fontSize:11,fontWeight:600,cursor:"pointer"}}>＋ 作成</button>
            </div>
            <div style={{background:t.card,borderRadius:14,padding:"12px 14px",marginBottom:12,boxShadow:`0 2px 8px ${t.sh}`}}>
              <div style={{fontSize:11,color:t.txm,marginBottom:6}}>新しいグループ名</div>
              <div style={{display:"flex",gap:8}}>
                <input value={newGName} onChange={e=>setNewGName(e.target.value)} placeholder="例：ラーメン部" style={{...INP(t),marginBottom:0,flex:1}}/>
                <button onClick={createGroup} style={{padding:"10px 14px",borderRadius:9,border:"none",background:t.grad,color:"white",fontWeight:700,cursor:"pointer",flexShrink:0}}>作成</button>
              </div>
            </div>

            {groups.map(g=>(
              <div key={g.id} style={{background:t.card,borderRadius:12,marginBottom:10,overflow:"hidden",boxShadow:`0 2px 8px ${t.sh}`}}>
                <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:38,height:38,borderRadius:9,background:t.accm,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{g.emoji}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:t.tx}}>{g.name}</div>
                    <div style={{fontSize:11,color:t.txm}}>{g.members?.length||0}人</div>
                  </div>
                  <button onClick={()=>setExpandG(expandG===g.id?null:g.id)} style={{background:t.bg2,border:"none",borderRadius:7,padding:"4px 9px",fontSize:10,color:t.acc,fontWeight:600,cursor:"pointer"}}>👤管理</button>
                  <button onClick={()=>sendGroupInvite(g)} style={{background:"#06C755",border:"none",borderRadius:7,padding:"4px 9px",fontSize:10,color:"white",fontWeight:700,cursor:"pointer"}}>LINE招待</button>
                </div>
                <div style={{padding:"0 14px 10px",display:"flex",gap:4,flexWrap:"wrap"}}>
                  {(g.members||[]).map(m=><span key={m} style={{background:t.accm,color:t.acc,fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:16}}>{m}</span>)}
                </div>
                {expandG===g.id&&(
                  <div style={{padding:"10px 14px 12px",borderTop:`1px solid ${t.br}`,background:t.bg2}}>
                    <div style={{fontSize:11,fontWeight:700,color:t.txm,marginBottom:6}}>メンバーを追加（フレンドコード）</div>
                    <div style={{display:"flex",gap:6,marginBottom:10}}>
                      <input value={newMem} onChange={e=>setNewMem(e.target.value)} placeholder="フレンドコード" style={{flex:1,padding:"8px 10px",background:"white",border:`1.5px solid ${t.br}`,borderRadius:8,fontSize:13,color:t.tx,outline:"none"}}/>
                      <button onClick={()=>addMember(g.id)} style={{padding:"8px 14px",borderRadius:8,border:"none",background:t.acc,color:"white",fontWeight:700,cursor:"pointer"}}>追加</button>
                    </div>
                    <div style={{marginTop:10,fontSize:11,fontWeight:700,color:t.txm,marginBottom:6}}>グループ共有記録</div>
                    {entries.filter(e=>e.privacy===PRIVACY.FRIENDS).slice(0,3).map(e=>(
                      <div key={e.id} style={{display:"flex",gap:8,padding:"6px",background:t.card,borderRadius:8,marginBottom:4,alignItems:"center"}}>
                        <img src={e.images?.[0]||PH()} alt="" style={{width:36,height:36,borderRadius:6,objectFit:"cover"}} onError={ev=>{ev.target.src=PH();}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:700,color:t.tx}}>{e.shopName}</div>
                          <div style={{fontSize:10,color:t.txm}}>{e.visitDate}</div>
                        </div>
                        <span style={{fontSize:9,color:"#27ae60",fontWeight:700}}>👥 グループ公開</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {view==="settings"&&(
          <>
            <section style={{background:t.card,padding:16,borderRadius:14,marginBottom:14,boxShadow:`0 2px 8px ${t.sh}`}}>
              <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:10}}>🎨 テーマ</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["warm","🔥 暖色"],["dark","🌙 ダーク"],["cool","❄️ 寒色"],["season","🍃 季節"]].map(([id,label])=>(
                  <button key={id} onClick={()=>setSettings(s=>({...s,theme:id}))} style={{padding:"12px",borderRadius:10,border:settings.theme===id?`2.5px solid ${t.acc}`:`1.5px solid ${t.br}`,background:settings.theme===id?t.accm:t.card,cursor:"pointer",fontWeight:settings.theme===id?700:400,color:t.tx}}>{label}</button>
                ))}
              </div>
            </section>
            <section style={{background:t.card,padding:16,borderRadius:14,marginBottom:14,boxShadow:`0 2px 8px ${t.sh}`}}>
              <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:10}}>📊 ストレージ情報</div>
              <div style={{fontSize:12,color:t.txm,lineHeight:1.7}}>
                データは永続ストレージに保存されます。<br/>
                友達に公開した記録は共有ストレージで同期されます。
              </div>
            </section>
            <section style={{background:t.card,padding:16,borderRadius:14,boxShadow:`0 2px 8px ${t.sh}`}}>
              <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:10}}>🗑️ データ管理</div>
              <button onClick={async()=>{if(window.confirm("全データをリセット？")){try{const keys=await window.storage.list();if(keys?.keys)for(const k of keys.keys)await window.storage.delete(k);const skeys=await window.storage.list("",true);if(skeys?.keys)for(const k of skeys.keys)await window.storage.delete(k,true);}catch{}window.location.reload();}}}
                style={{width:"100%",padding:"12px",borderRadius:10,border:"1.5px solid #FADBD8",background:"#FFF5F5",color:"#E74C3C",fontWeight:600,cursor:"pointer"}}>データをリセット</button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}


// ─── 記録モーダル ─────────────────────────────────────
function PostModal() {
  const { entries, setEntries, setShowPost, t } = useApp();
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    shopName:"", visitDate:new Date().toISOString().slice(0,10),
    menu:"", price:"", rating:5, genre:"醤油", area:"", comment:"",
    privacy:PRIVACY.PRIVATE,
  });

  const handleManual = () => {
    if (!form.shopName.trim()) return;
    setEntries(p => [{ ...form, id:`m_${Date.now()}`, images:[], aiDetected:false }, ...p]);
    setShowPost(false);
  };

  if (result) {
    const nc=result.filter(r=>r.action==="新規作成").length, ac=result.filter(r=>r.action==="追加").length, sc=result.filter(r=>r.action==="重複スキップ").length;
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:100, display:"flex", alignItems:"flex-end" }}>
        <div style={{ background:t.card, width:"100%", borderRadius:"20px 20px 0 0", padding:"0 20px 32px", maxHeight:"80vh", overflowY:"auto" }}>
          <div style={{ width:36, height:4, background:t.br, borderRadius:2, margin:"12px auto 16px" }}/>
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
            <div style={{ fontWeight:700, fontSize:18, color:t.tx }}>AI振分が完了しました</div>
            <div style={{ fontSize:12, color:t.txm, marginTop:4 }}>3段階AI解析でラーメンDBを照合して自動振り分け</div>
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:16, justifyContent:"center" }}>
            {[["新規アルバム",nc,t.acc],["追加",ac,"#27ae60"],["スキップ",sc,t.txm]].map(([l,c,col])=>(
              <div key={l} style={{ textAlign:"center", background:t.bg2, borderRadius:12, padding:"10px 14px" }}>
                <div style={{ fontSize:18, fontWeight:700, color:col }}>{c}</div>
                <div style={{ fontSize:10, color:t.txm }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:16 }}>
            {result.map((r,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:t.bg2, borderRadius:10, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{r.action==="新規作成"?"🆕":r.action==="追加"?"📸":"🔁"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{r.shopName}</div>
                  <div style={{ fontSize:11, color:t.txm }}>{r.date}{r.menu?` · ${r.menu}`:""}{r.confidence?` · 信頼度${r.confidence}%`:""}{r.known===false?" · 不明店舗":""}</div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:r.action==="新規作成"?t.acc:r.action==="追加"?"#27ae60":t.txm, background:t.card, borderRadius:8, padding:"2px 8px" }}>{r.action}</span>
              </div>
            ))}
          </div>
          <button onClick={()=>setShowPost(false)}
            style={{ width:"100%", padding:"13px", borderRadius:11, border:"none", background:t.grad, color:"white", fontWeight:700, fontSize:14, cursor:"pointer" }}>
            アルバムで確認する 📷
          </button>
        </div>
      </div>
    );
  }

  const inp = { width:"100%", padding:"10px 12px", background:t.bg2, border:`1.5px solid ${t.br}`, borderRadius:9, fontSize:13, color:t.tx, outline:"none", boxSizing:"border-box", marginBottom:10 };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:100, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:t.card, width:"100%", borderRadius:"20px 20px 0 0", padding:"0 20px 32px", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:t.br, borderRadius:2, margin:"12px auto 16px" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ margin:0, color:t.tx }}>🍜 新規記録</h3>
          <button onClick={()=>setShowPost(false)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:t.txm }}>✕</button>
        </div>

        <AiBulkTrigger onDone={s=>setResult(s)} onEntriesUpdate={ne=>setEntries(ne)}/>

        <div style={{ display:"flex", alignItems:"center", gap:8, margin:"14px 0" }}>
          <div style={{ flex:1, height:1, background:t.br }}/><span style={{ fontSize:11, color:t.txm }}>または手動で記録</span><div style={{ flex:1, height:1, background:t.br }}/>
        </div>

        <input style={inp} placeholder="店舗名 *" value={form.shopName} onChange={e=>setForm(f=>({...f,shopName:e.target.value}))}/>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <div>
            <div style={{ fontSize:11, color:t.txm, marginBottom:3 }}>📅 訪問日</div>
            <input type="date" style={{ ...inp, marginBottom:0 }} value={form.visitDate} onChange={e=>setForm(f=>({...f,visitDate:e.target.value}))}/>
          </div>
          <div>
            <div style={{ fontSize:11, color:t.txm, marginBottom:3 }}>ジャンル</div>
            <select style={{ ...inp, marginBottom:0, height:42 }} value={form.genre} onChange={e=>setForm(f=>({...f,genre:e.target.value}))}>
              {["醤油","豚骨","塩","味噌","つけ麺","鶏白湯","二郎系","中華そば","煮干し","担々麺","その他"].map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:t.txm, marginBottom:3 }}>🍜 注文メニュー</div>
          <input style={{ ...inp, marginBottom:0 }} placeholder="例：特製醤油らーめん" value={form.menu} onChange={e=>setForm(f=>({...f,menu:e.target.value}))}/>
        </div>

        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:t.txm, marginBottom:3 }}>💴 価格</div>
          <input style={{ ...inp, marginBottom:0 }} placeholder="例：1,200円" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/>
        </div>

        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:t.txm, marginBottom:4 }}>評価</div>
          <div style={{ display:"flex", gap:6 }}>
            {[1,2,3,4,5].map(n=>(
              <button key={n} onClick={()=>setForm(f=>({...f,rating:n}))}
                style={{ width:36, height:36, borderRadius:"50%", border:"none", background:form.rating>=n?"#E67E22":"#eee", color:form.rating>=n?"white":"#999", fontSize:18, cursor:"pointer" }}>★</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:t.txm, marginBottom:4 }}>公開レベル</div>
          <div style={{ display:"flex", gap:5 }}>
            {Object.entries(PRIVACY_LABEL).map(([key,label])=>(
              <button key={key} onClick={()=>setForm(f=>({...f,privacy:key}))}
                style={{ flex:1, padding:"7px 4px", borderRadius:9, border:"none", background:form.privacy===key?t.acc:t.bg2, color:form.privacy===key?"white":t.tx2, fontSize:10, fontWeight:600, cursor:"pointer" }}>{label}</button>
            ))}
          </div>
        </div>

        <textarea style={{ ...inp, minHeight:60, resize:"none" }} placeholder="コメント（任意）" value={form.comment} onChange={e=>setForm(f=>({...f,comment:e.target.value}))}/>

        <button onClick={handleManual}
          style={{ width:"100%", padding:"13px", borderRadius:11, border:"none", background:t.grad, color:"white", fontWeight:700, fontSize:14, cursor:"pointer" }}>
          記録する ✓
        </button>
      </div>
    </div>
  );
}

// ─── AI一括取込トリガー ───────────────────────────────
function AiBulkTrigger({ onDone, onEntriesUpdate }) {
  const {entries,setAiState,t}=useApp();
  const [location,setLocation]=useState(null);
  const bulkRef=useRef(null);
  useEffect(()=>{if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>setLocation(`${p.coords.latitude.toFixed(2)},${p.coords.longitude.toFixed(2)}`),()=>{});},[]);

  const handleChange=async(ev)=>{
    const files=Array.from(ev.target.files||[]);ev.target.value="";if(!files.length)return;
    setAiState({progress:0,total:files.length,shopName:""});
    try{
      const {entries:ne,summary}=await runAIBulk({files,entries,location,onProgress:(p,t,name)=>setAiState({progress:p,total:t,shopName:name})});
      onEntriesUpdate(ne);onDone(summary);
    }catch(err){
      console.error(err);onDone([{shopName:"処理エラー",action:"スキップ",date:""}]);
    }finally{
      setAiState(null);
    }
  };
  return (
    <div onClick={()=>bulkRef.current?.click()} style={{display:"block",padding:"16px 14px",background:t.grad,borderRadius:14,textAlign:"center",cursor:"pointer"}}>
      <div style={{fontSize:28,marginBottom:4}}>🤖</div>
      <div style={{color:"white",fontWeight:700,fontSize:14,marginBottom:2}}>画像を一括取込（AI深層解析）</div>
      <div style={{color:"rgba(255,255,255,0.8)",fontSize:11}}>複数枚選択可 · 3段階AI解析 · リトライ対応 · ラーメンDB照合</div>
      <input ref={bulkRef} type="file" multiple accept="image/*" style={{display:"none"}} onChange={handleChange}/>
    </div>
  );
}

// ─── メインレイアウト ─────────────────────────────────
function MainLayout() {
  const {tab,setTab,showPost,setShowPost,aiState,detailEntryId,t}=useApp();
  const TABS=[
    {label:"ホーム",icon:"🏠",Page:HomePage},
    {label:"おすすめ",icon:"🔥",Page:RecommendPage},
    {label:"マップ",icon:"🗺️",Page:MapPage},
    {label:"アルバム",icon:"🖼️",Page:AlbumPage},
    {label:"マイページ",icon:"👤",Page:MyPage},
  ];
  const N=TABS.length, STEP=100/N;
  const [dragDelta,setDragDelta]=useState(0);
  const [dragging,setDragging]=useState(false);
  const touchX=useRef(null),touchY=useRef(null),mouseX=useRef(null);
  const THRESH=50;

  const commit=(dx)=>{setDragDelta(0);setDragging(false);if(dx<-THRESH&&tab<N-1)setTab(tab+1);else if(dx>THRESH&&tab>0)setTab(tab-1);};
  const clamp=(dx)=>{if(dx>0&&tab===0)return dx*0.15;if(dx<0&&tab===N-1)return dx*0.15;return dx;};

  const onTouchStart=e=>{if(showPost||aiState||detailEntryId)return;touchX.current=e.touches[0].clientX;touchY.current=e.touches[0].clientY;setDragging(false);setDragDelta(0);};
  const onTouchMove=e=>{
    if(touchX.current===null)return;
    const dx=e.touches[0].clientX-touchX.current,dy=e.touches[0].clientY-touchY.current;
    if(!dragging&&Math.abs(dy)>Math.abs(dx)*1.4)return;
    if(Math.abs(dx)>8){setDragging(true);setDragDelta(clamp(dx)*0.75);}
  };
  const onTouchEnd=e=>{if(!dragging){touchX.current=null;return;}const dx=e.changedTouches[0].clientX-touchX.current;touchX.current=null;commit(dx);};
  const onMouseDown=e=>{if(showPost||aiState||detailEntryId)return;mouseX.current=e.clientX;setDragging(false);setDragDelta(0);};
  const onMouseMove=e=>{if(mouseX.current===null)return;const dx=e.clientX-mouseX.current;if(Math.abs(dx)>8){setDragging(true);setDragDelta(clamp(dx)*0.75);}};
  const onMouseUp=e=>{if(mouseX.current===null)return;const dx=e.clientX-mouseX.current;mouseX.current=null;if(!dragging)return;commit(dx);};
  const onMouseLeave=()=>{if(mouseX.current!==null){mouseX.current=null;setDragging(false);setDragDelta(0);}};

  return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",fontFamily:"'Noto Sans JP',ui-sans-serif,sans-serif",background:t.bg,overflow:"hidden",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;}
        html,body{width:100%;max-width:100vw;overflow-x:hidden;margin:0;padding:0;}
        input,select,textarea{max-width:100%;font-family:inherit;}
        img{max-width:100%;display:block;}
        button{touch-action:manipulation;}
      `}</style>

      {aiState&&<FullscreenSpinner progress={aiState.progress} total={aiState.total} shopName={aiState.shopName}/>}

      <div style={{flexShrink:0,height:48,display:"flex",alignItems:"center",justifyContent:"center",background:t.bg,borderBottom:`1px solid ${t.br}`,position:"relative",zIndex:10}}>
        <MenLogLogo size={20}/>
        <button onClick={()=>setShowPost(true)} style={{position:"absolute",right:12,background:t.grad,border:"none",borderRadius:8,padding:"5px 13px",color:"white",fontSize:11,fontWeight:700,cursor:"pointer"}}>＋ 記録</button>
      </div>

      <div style={{flex:1,minHeight:0,overflow:"hidden",position:"relative"}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}>
        <div style={{
          display:"flex",width:`${N*100}%`,height:"100%",
          transform:`translateX(calc(-${tab*STEP}% + ${dragDelta}px))`,
          transition:dragging?"none":"transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          willChange:"transform",userSelect:"none",
        }}>
          {TABS.map(({Page},i)=>(
            <div key={i} style={{width:`${STEP}%`,height:"100%",overflow:"hidden",flexShrink:0}}>
              <Page/>
            </div>
          ))}
        </div>
        <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4,zIndex:5,pointerEvents:"none"}}>
          {TABS.map((_,i)=>(
            <div key={i} style={{width:i===tab?14:4,height:4,borderRadius:2,background:i===tab?t.acc:t.br,transition:"all 0.25s"}}/>
          ))}
        </div>
      </div>

      {showPost&&<PostModal/>}

      <div style={{flexShrink:0,display:"flex",background:t.card,borderTop:`1px solid ${t.br}`,boxShadow:`0 -3px 12px ${t.sh}`,zIndex:10}}>
        {TABS.map((it,i)=>(
          <button key={i} onClick={()=>{setTab(i);setDragDelta(0);}}
            style={{flex:1,border:"none",background:"none",color:tab===i?t.acc:t.txm,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,padding:"8px 2px",minHeight:52,fontSize:9,fontWeight:tab===i?700:400,transition:"color 0.2s"}}>
            <span style={{fontSize:tab===i?20:17,transition:"font-size 0.18s"}}>{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
        <button onClick={()=>setShowPost(true)}
          style={{flex:1,border:"none",background:"none",color:t.acc,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,padding:"8px 2px",minHeight:52,fontSize:9,fontWeight:700}}>
          <span style={{fontSize:20}}>➕</span><span>記録</span>
        </button>
      </div>

      {detailEntryId && <AlbumDetail/>}
    </div>
  );
}

export default function App() {
  return <Provider><MainLayout/></Provider>;
}
