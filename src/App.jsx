import { useState, useRef, useEffect, createContext, useContext } from "react";

// ─── テーマ ───────────────────────────────────────────────────
const THEMES = {
  warm:   { bg:"#FFF8F3", bg2:"#FFF0E6", card:"#FFFFFF", acc:"#C0392B", accm:"#FADBD8", tx:"#1A0A00", tx2:"#6B4C3B", txm:"#A0826D", br:"#F0DDD5", star:"#E67E22", grad:"linear-gradient(135deg,#C0392B,#E74C3C)", sh:"rgba(192,57,43,0.12)" },
  dark:   { bg:"#0F0A08", bg2:"#1A110D", card:"#231610", acc:"#E74C3C", accm:"#3D1A17", tx:"#F5EDE8", tx2:"#C4A99A", txm:"#7A5C4F", br:"#3D2418", star:"#F39C12", grad:"linear-gradient(135deg,#E74C3C,#FF6B6B)", sh:"rgba(231,76,60,0.2)"  },
  cool:   { bg:"#F0F4FF", bg2:"#E8EEFF", card:"#FFFFFF", acc:"#3B5BDB", accm:"#DBE4FF", tx:"#0A0F2C", tx2:"#3B4A8A", txm:"#7C8DB0", br:"#D0D9F5", star:"#F59F00", grad:"linear-gradient(135deg,#3B5BDB,#4C6EF5)", sh:"rgba(59,91,219,0.12)" },
  season: { bg:"#F5FFF0", bg2:"#EAFAE0", card:"#FFFFFF", acc:"#2E7D32", accm:"#C8E6C9", tx:"#0A1F0C", tx2:"#2E5C30", txm:"#6A9B6D", br:"#D4EDD6", star:"#F57F17", grad:"linear-gradient(135deg,#2E7D32,#43A047)", sh:"rgba(46,125,50,0.12)" },
};

const RAMENDB_BASE = "https://ramendb.supleks.jp";
const RAMENDB_RANK = "https://ramendb.supleks.jp/rank";
const APP_LINK     = "https://men-log2-yerr.vercel.app/";

const PH = (t="🍜") => `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect width='150' height='150' fill='%23FADBD8'/><text x='75' y='85' font-size='48' text-anchor='middle'>${encodeURIComponent(t)}</text></svg>`;

const DEMO_ENTRIES = [
  { id:"d1", shopName:"飯田商店",       visitDate:"2026-03-20", rating:5, genre:"塩",    area:"湯河原", images:[PH("✨")], comment:"人生で一番うまいラーメン" },
  { id:"d2", shopName:"中華そば とみ田", visitDate:"2026-03-15", rating:5, genre:"つけ麺",area:"松戸",   images:[PH("🎯")], comment:"つけ麺の概念が変わった" },
  { id:"d3", shopName:"一蘭 渋谷",      visitDate:"2026-02-28", rating:4, genre:"豚骨",  area:"渋谷",   images:[PH("🐷")], comment:"個室で集中して食べる" },
  { id:"d4", shopName:"二郎 三田本店",  visitDate:"2026-02-10", rating:3, genre:"二郎系",area:"三田",   images:[PH("💪")], comment:"量が限界突破してた" },
];
const DEMO_SHOPS = [
  { name:"らぁ麺 飯田商店",       score:98.5, genre:"塩",    area:"湯河原", id:"119107" },
  { name:"中華そば とみ田",       score:97.2, genre:"つけ麺",area:"松戸",   id:"3051"   },
  { name:"Japanese Soba 蔦",      score:96.0, genre:"醤油",  area:"巣鴨",   id:"58279"  },
  { name:"麺屋 武蔵",             score:88.5, genre:"醤油",  area:"新宿",   id:"1"      },
  { name:"風雲児",                score:89.3, genre:"鶏白湯",area:"代々木", id:"4"      },
];

// ─── ラーメンDBマスター（ファイル名マッチング用） ─────────────
const RAMEN_MASTER = [
  { name:"らぁ麺 飯田商店",  genre:"塩",      area:"湯河原",    keys:["iida","飯田","湯河原","塩","shouten"],          menu:["塩らーめん","醤油らーめん","特製塩らーめん"],    id:"119107" },
  { name:"中華そば とみ田",  genre:"つけ麺",  area:"松戸",      keys:["tomita","とみ田","富田","松戸","tsukemen"],      menu:["特製つけ麺","中華そば"],                        id:"3051"   },
  { name:"Japanese Soba 蔦", genre:"醤油",    area:"巣鴨",      keys:["tsuta","蔦","sugamo","巣鴨","michelin"],        menu:["醤油そば","塩そば"],                             id:"58279"  },
  { name:"麺屋 武蔵",        genre:"醤油",    area:"新宿",      keys:["musashi","武蔵","shinjuku","新宿"],             menu:["武蔵らーめん","特製武蔵"],                       id:"1"      },
  { name:"風雲児",           genre:"鶏白湯",  area:"代々木",    keys:["fuunji","風雲児","yoyogi","代々木","torigara"],  menu:["鶏白湯らーめん"],                               id:"4"      },
  { name:"一蘭",             genre:"豚骨",    area:"渋谷",      keys:["ichiran","一蘭","tonkotsu","豚骨"],             menu:["天然とんこつラーメン"],                          id:"2"      },
  { name:"二郎 三田本店",    genre:"二郎系",  area:"三田",      keys:["jiro","二郎","ninniku","ニンニク","yasai","大"], menu:["ラーメン(小)","ラーメン(大)"],                  id:"8"      },
  { name:"博多一幸舎",       genre:"豚骨",    area:"博多",      keys:["ikkousha","一幸舎","hakata","博多","fukuoka"],   menu:["博多ラーメン"],                                  id:"9"      },
  { name:"蔦",               genre:"醤油",    area:"巣鴨",      keys:["tsutagamo","蔦","kouju","鶏油"],                menu:["特製醤油そば","特製塩そば"],                     id:"10"     },
  { name:"麺処 井の庄",      genre:"煮干し",  area:"石神井公園",keys:["inosho","井の庄","niboshi","煮干","karakara"],   menu:["辛辛魚らーめん","煮干しらーめん"],               id:"15"     },
  { name:"塩らーめん 白月",  genre:"塩",      area:"池袋",      keys:["hakugetsu","白月","ikebukuro","池袋","shio"],    menu:["塩らーめん","特製塩らーめん"],                   id:"3"      },
  { name:"ほん田",           genre:"醤油",    area:"東十条",    keys:["honda","ほん田","higashijujo","東十条"],         menu:["醤油ら～めん","塩ら～めん"],                     id:"18"     },
];

// ─── Context ─────────────────────────────────────────────────
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

function Provider({ children }) {
  const load = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
  const [entries,     setEntries]    = useState(() => load("rd_entries",  DEMO_ENTRIES));
  const [groups,      setGroups]     = useState(() => load("rd_groups",   [{ id:"g1", name:"ラーメン部", emoji:"🍜", members:["あなた","田中"] }]));
  const [profile,     setProfile]    = useState(() => load("rd_profile",  { name:"ユーザー", gender:"未設定", station:"未設定", favorite:"醤油" }));
  const [settings,    setSettings]   = useState(() => load("rd_settings", { theme:"warm" }));
  const [tab,         setTab]        = useState(0);
  const [showPost,    setShowPost]   = useState(false);
  const [filterMode,  setFilterMode] = useState({ type:"all", value:null });
  // AI処理中はアプリ最上位でフルスクリーンオーバーレイを表示
  const [aiState, setAiState] = useState(null); // null | { progress, total, shopName }

  useEffect(() => { try { localStorage.setItem("rd_entries",  JSON.stringify(entries));  } catch(e) {} }, [entries]);
  useEffect(() => { try { localStorage.setItem("rd_groups",   JSON.stringify(groups));   } catch(e) {} }, [groups]);
  useEffect(() => { try { localStorage.setItem("rd_profile",  JSON.stringify(profile));  } catch(e) {} }, [profile]);
  useEffect(() => { try { localStorage.setItem("rd_settings", JSON.stringify(settings)); } catch(e) {} }, [settings]);

  const t = THEMES[settings.theme] || THEMES.warm;
  return (
    <Ctx.Provider value={{ entries, setEntries, groups, setGroups, profile, setProfile, settings, setSettings, tab, setTab, showPost, setShowPost, filterMode, setFilterMode, aiState, setAiState, t }}>
      {children}
    </Ctx.Provider>
  );
}

// ─── ユーティリティ ──────────────────────────────────────────
// FileReader を Promise 化（try/catchで確実に補足）
function readAsDataURL(file) {
  return new Promise((res) => {
    try {
      const r = new FileReader();
      r.onload  = ev => res(ev.target.result);
      r.onerror = ()  => res(null);
      r.readAsDataURL(file);
    } catch(_) { res(null); }
  });
}
function readAsArrayBuffer(file) {
  return new Promise((res) => {
    try {
      const r = new FileReader();
      r.onload  = ev => res(ev.target.result);
      r.onerror = ()  => res(null);
      r.readAsArrayBuffer(file);
    } catch(_) { res(null); }
  });
}

// Exif日付取得
function getExifDate(buf) {
  try {
    if (!buf) return null;
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off);
      const len    = v.getUint16(off + 2);
      if (len < 2 || off + 2 + len > v.byteLength) break;
      if (marker === 0xFFE1) {
        const app1 = new DataView(buf, off + 4, len - 2);
        if (app1.byteLength < 14) break;
        const le  = app1.getUint16(6) === 0x4949;
        const ifd = app1.getUint32(10, le) + 6;
        if (ifd + 2 > app1.byteLength) break;
        const n = app1.getUint16(ifd, le);
        for (let i = 0; i < n; i++) {
          const e = ifd + 2 + i * 12;
          if (e + 12 > app1.byteLength) break;
          const tag = app1.getUint16(e, le);
          if (tag === 0x9003 || tag === 0x0132) {
            const voff = app1.getUint32(e + 8, le) + 6;
            if (voff + 10 > app1.byteLength) break;
            let s = "";
            for (let j = 0; j < 19; j++) { const c = app1.getUint8(voff + j); if (!c) break; s += String.fromCharCode(c); }
            const m = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
            if (m) return `${m[1]}-${m[2]}-${m[3]}`;
          }
        }
      }
      off += 2 + len;
    }
  } catch(_) {}
  return null;
}

// ── 画像色分析（Canvas 16×16 に縮小・タイムアウト付き） ──────
// DataURL を受け取りスープ色などの特徴を返す。失敗時は null。
function analyzeColor(dataUrl) {
  return new Promise(resolve => {
    const TIMEOUT = 2500;
    let done = false;
    const timer = setTimeout(() => { if(!done){ done=true; resolve(null); } }, TIMEOUT);
    try {
      const img = new Image();
      img.onload = () => {
        if (done) return;
        done = true; clearTimeout(timer);
        try {
          const SIZE = 16;
          const cv = document.createElement("canvas");
          cv.width = SIZE; cv.height = SIZE;
          const ctx = cv.getContext("2d");
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          const d = ctx.getImageData(0, 0, SIZE, SIZE).data;
          const N = SIZE * SIZE;
          let rSum=0, gSum=0, bSum=0;
          let brownN=0, whiteN=0, darkN=0, yellowN=0, redN=0;
          for (let i=0; i<d.length; i+=4) {
            const r=d[i], g=d[i+1], b=d[i+2];
            rSum+=r; gSum+=g; bSum+=b;
            // 茶色・醤油系
            if (r>110 && r<200 && g>60 && g<140 && b<80 && r>g && g>b) brownN++;
            // 白・塩・鶏白湯
            if (r>200 && g>200 && b>190) whiteN++;
            // 暗色・二郎系・濃厚
            if (r<70  && g<70  && b<70)  darkN++;
            // 黄色・味噌・カレー
            if (r>180 && g>160 && b<80 && r>b && g>b) yellowN++;
            // 赤・辛い系
            if (r>160 && g<80  && b<80)  redN++;
          }
          resolve({
            avgR:  rSum/N, avgG: gSum/N, avgB: bSum/N,
            bright:(rSum+gSum+bSum)/(3*N),
            brown: brownN/N, white: whiteN/N,
            dark:  darkN/N,  yellow:yellowN/N, red: redN/N,
          });
        } catch(_) { resolve(null); }
      };
      img.onerror = () => { if(!done){ done=true; clearTimeout(timer); resolve(null); } };
      img.src = dataUrl;
    } catch(_) { done=true; clearTimeout(timer); resolve(null); }
  });
}

// ── ジャンル・色の対応テーブル ────────────────────────────────
const GENRE_COLOR = {
  "塩":    { white:0.30, brown:0.05, dark:0.05, yellow:0.05 },
  "鶏白湯":{ white:0.35, brown:0.08, dark:0.04, yellow:0.10 },
  "豚骨":  { white:0.25, brown:0.15, dark:0.05, yellow:0.05 },
  "醤油":  { white:0.10, brown:0.25, dark:0.10, yellow:0.08 },
  "味噌":  { white:0.05, brown:0.20, dark:0.08, yellow:0.20 },
  "二郎系":{ white:0.05, brown:0.15, dark:0.20, yellow:0.05 },
  "煮干し":{ white:0.05, brown:0.20, dark:0.18, yellow:0.05 },
  "つけ麺":{ white:0.15, brown:0.18, dark:0.08, yellow:0.08 },
};

// ジャンル類似度スコア（0〜1）
function genreColorScore(feat, genre) {
  if (!feat) return 0;
  const ref = GENRE_COLOR[genre];
  if (!ref) return 0;
  // 各チャンネルの差の二乗和の逆数（近いほど高い）
  const d = Math.sqrt(
    Math.pow((feat.white  - ref.white ) * 2.0, 2) +
    Math.pow((feat.brown  - ref.brown ) * 2.0, 2) +
    Math.pow((feat.dark   - ref.dark  ) * 1.5, 2) +
    Math.pow((feat.yellow - ref.yellow) * 1.5, 2)
  );
  return Math.max(0, 1 - d * 3);
}

// ── AI店舗マッチング（ファイル名 + 色分析 + 位置情報） ─────────
function matchShop(file, feat, location) {
  const fn = (file.name || "").toLowerCase().replace(/[^a-z0-9\u3040-\u9fff]/g, "");

  let best = null, bestScore = -1;
  for (const shop of RAMEN_MASTER) {
    let score = 0;

    // ① ファイル名キーワード（最高精度）
    for (const k of shop.keys) {
      if (fn.includes(k.toLowerCase())) score += k.length >= 3 ? 50 : 20;
    }

    // ② 色分析によるジャンル一致度（0〜40点）
    const cs = genreColorScore(feat, shop.genre);
    score += cs * 40;

    // ③ 位置情報エリア（最大30点）
    if (location && shop.area) {
      if (location.includes(shop.area)) score += 30;
    }

    // ④ ラーメンDB評価ポイントによるベーススコア（最大5点）
    // スコア高い店ほど確からしい
    score += 2;

    if (score > bestScore) { bestScore = score; best = shop; }
  }

  // ファイル名ヒットなしでも色分析で閾値超えたら採用
  const THRESHOLD = feat ? 12 : 20; // 色情報があれば低めの閾値
  if (bestScore >= THRESHOLD && best) {
    const hour = new Date().getHours();
    const menu = best.menu[hour % best.menu.length] || best.menu[0] || "";
    return {
      known:      true,
      shopName:   best.name,
      genre:      best.genre,
      area:       best.area,
      id:         best.id,
      menu,
      confidence: Math.min(Math.round(bestScore), 99),
    };
  }

  // 不明 → sessionKeyでグループ化
  const sessionKey = (() => {
    const dm = fn.match(/(\d{8})/);  // IMG_20260320_xxx
    if (dm) return dm[1];
    const sm = fn.match(/(\d{4,6})/);
    if (sm) return sm[1].slice(0, 4);
    return fn.slice(0, 4) || "unk";
  })();

  // 色だけでジャンルを推定
  let inferredGenre = "その他";
  if (feat) {
    if      (feat.white  > 0.32) inferredGenre = "塩";
    else if (feat.white  > 0.22) inferredGenre = "鶏白湯";
    else if (feat.yellow > 0.20) inferredGenre = "味噌";
    else if (feat.dark   > 0.18) inferredGenre = "二郎系";
    else if (feat.brown  > 0.22) inferredGenre = "醤油";
    else if (feat.brown  > 0.15) inferredGenre = "豚骨";
  }

  return { known:false, shopName:null, genre:inferredGenre, area:"", id:null, menu:"", confidence:0, sessionKey };
}

// 重複削除（DataURI完全一致）
function dedupe(arr) {
  const s = new Set();
  return arr.filter(x => { if (s.has(x)) return false; s.add(x); return true; });
}

// ─── AI振分エンジン ───────────────────────────────────────────
async function runAIBulk({ files, entries, location, onProgress }) {
  const work = entries.map(e => ({ ...e, images: [...(e.images||[])] }));
  const summary = [];

  // 既存の「不明N」番号を継続
  const existingNums = work
    .map(e => { const m = e.shopName.match(/^不明(\d+)$/); return m ? parseInt(m[1]) : null; })
    .filter(n => n !== null);
  let unknownCounter = existingNums.length ? Math.max(...existingNums) : 0;
  const unknownMap = {}; // sessionKey → "不明N"

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress(i + 1, files.length, "読み込み中...");
    await new Promise(r => setTimeout(r, 10));

    // DataURL（表示用 + 色分析用）
    const dataUrl = await readAsDataURL(file);
    if (!dataUrl) { summary.push({ shopName:"エラー", action:"スキップ", date:"" }); continue; }

    // ArrayBuffer（Exif日付用）
    const buf = await readAsArrayBuffer(file);

    // 日付
    const exifDate  = getExifDate(buf);
    const visitDate = exifDate
      || (file.lastModified ? new Date(file.lastModified).toISOString().slice(0,10) : new Date().toISOString().slice(0,10));

    // ★ 色分析（Canvas / タイムアウト付き）
    onProgress(i + 1, files.length, "色分析中...");
    await new Promise(r => setTimeout(r, 10)); // UI解放
    const feat = await analyzeColor(dataUrl);

    // ★ マッチング（ファイル名 + 色 + 位置）
    const match    = matchShop(file, feat, location);
    const shopName = match.known ? match.shopName : (() => {
      const sk = match.sessionKey;
      if (unknownMap[sk]) return unknownMap[sk];
      unknownCounter++;
      const name = `不明${unknownCounter}`;
      unknownMap[sk] = name;
      return name;
    })();

    onProgress(i + 1, files.length, shopName);
    await new Promise(r => setTimeout(r, 10));

    // アルバム振り分け
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
        id:         `ai_${Date.now()}_${i}`,
        shopName,
        genre:      match.genre,
        area:       match.area,
        emoji:      match.known ? "🍜" : "❓",
        images:     [dataUrl],
        visitDate,
        menu:       match.menu || "",
        rating:     match.known ? 4 : 3,
        comment:    match.known
          ? `AI振分: ${shopName}（信頼度${match.confidence}%）`
          : `AI判定: 店舗不明・推定ジャンル[${match.genre}]（同一セッション自動グループ）`,
        ramendbId:  match.id || null,
        aiDetected: true,
      });
      summary.push({ shopName, action:"新規作成", date:visitDate, menu:match.menu, confidence:match.confidence, known:match.known });
    }
  }

  return {
    entries: work.map(e => ({ ...e, images: dedupe(e.images||[]) })),
    summary,
  };
}
}

// ─── フルスクリーン どんぶりスピナー ────────────────────────
function FullscreenSpinner({ shopName, progress, total }) {
  const [frame, setFrame] = useState(0);
  const frames = ["🍜","🍛","🍲","🍥","🫕"];
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f+1) % frames.length), 180);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:9999, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>
      <div style={{ fontSize:72, marginBottom:20, display:"inline-block", animation:"spin 0.55s linear infinite" }}>
        {frames[frame]}
      </div>
      <div style={{ color:"#fff", fontWeight:700, fontSize:20, marginBottom:8, fontFamily:"Georgia,serif" }}>AI自動振分中...</div>
      {shopName ? (
        <div style={{ color:"#FADBD8", fontSize:13, marginBottom:16, textAlign:"center", maxWidth:260 }}>🔍 「{shopName}」を確認中</div>
      ) : (
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12, marginBottom:16 }}>ラーメンDBと照合しています</div>
      )}
      <div style={{ width:240, height:6, background:"rgba(255,255,255,0.15)", borderRadius:3, overflow:"hidden", marginBottom:8 }}>
        <div style={{ height:"100%", background:"linear-gradient(90deg,#E74C3C,#FF6B6B)", width:`${total>0?(progress/total)*100:0}%`, borderRadius:3, transition:"width 0.25s" }}/>
      </div>
      <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12 }}>{progress} / {total} 枚</div>
      <div style={{ marginTop:20, color:"rgba(255,255,255,0.3)", fontSize:11, textAlign:"center", lineHeight:1.8 }}>
        店舗が不明な場合は「不明1」「不明2」として<br/>自動でアルバムを作成します
      </div>
    </div>
  );
}

// ─── 共通UI ──────────────────────────────────────────────────
function Stars({ value=0, onChange, size=24, readonly=false }) {
  const [hov, setHov] = useState(0);
  const { t } = useApp();
  return (
    <div style={{ display:"flex", gap:2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n}
          onMouseEnter={()=>!readonly&&setHov(n)} onMouseLeave={()=>!readonly&&setHov(0)}
          onClick={()=>!readonly&&onChange?.(n)}
          style={{ fontSize:size, cursor:readonly?"default":"pointer", color:(hov||value)>=n?t.star:t.br, userSelect:"none" }}>★</span>
      ))}
    </div>
  );
}
function MenLogLogo({ size=20 }) {
  const { t } = useApp();
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:1, fontFamily:"Georgia,serif", fontWeight:700, fontSize:size, color:t.tx, lineHeight:1 }}>
      <span>Men</span>
      <svg width={Math.round(size*1.8)} height={Math.round(size*0.85)} viewBox="0 0 36 16" fill="none" style={{ display:"inline-block", verticalAlign:"middle", margin:"0 1px" }}>
        <path d="M2 3 Q7 0 12 3 Q17 6 22 3 Q27 0 32 3 Q34.5 4.5 34 4"           stroke={t.acc} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        <path d="M2 7.5 Q7 4.5 12 7.5 Q17 10.5 22 7.5 Q27 4.5 32 7.5 Q34.5 9 34 8.5" stroke={t.acc} strokeWidth="1.9" strokeLinecap="round" fill="none" opacity="0.65"/>
        <path d="M2 12 Q7 9 12 12 Q17 15 22 12 Q27 9 32 12 Q34.5 13.5 34 13"    stroke={t.acc} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.35"/>
      </svg>
      <span>Log</span>
    </span>
  );
}


// ─── ホーム ──────────────────────────────────────────────────
function HomePage() {
  const { entries, profile, setTab, setFilterMode, t } = useApp();
  const [selMonth, setSelMonth] = useState(new Date().toISOString().slice(0,7));
  const months = Array.from(new Set(entries.map(e=>e.visitDate?.slice(0,7)).filter(Boolean))).sort().reverse();
  if (!months.includes(new Date().toISOString().slice(0,7))) months.unshift(new Date().toISOString().slice(0,7));
  const total = entries.length;
  const month = entries.filter(e=>e.visitDate?.startsWith(selMonth)).length;
  const avg   = total ? (entries.reduce((a,b)=>a+(b.rating||0),0)/total).toFixed(1) : "0.0";
  return (
    <div style={{ height:"100%", overflowY:"auto", background:t.bg }}>
      <div style={{ background:t.grad, padding:"36px 18px 22px", color:"white", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-30, right:-30, width:130, height:130, borderRadius:"50%", background:"rgba(255,255,255,0.08)" }}/>
        <div style={{ fontSize:12, opacity:0.8, marginBottom:4 }}>おかえり 👋</div>
        <h2 style={{ fontSize:22, fontFamily:"Georgia,serif", margin:0 }}>{profile.name}さんのMen～Log</h2>
        {profile.station!=="未設定" && <div style={{ fontSize:11, opacity:0.72, marginTop:4 }}>🚉 {profile.station} · ❤️ {profile.favorite}</div>}
        <div style={{ display:"flex", gap:10, marginTop:18 }}>
          <div onClick={()=>{setFilterMode({type:"all"});setTab(4);}} style={{ flex:1, background:"rgba(255,255,255,0.18)", padding:13, borderRadius:13, textAlign:"center", cursor:"pointer" }}>
            <div style={{ fontSize:10, opacity:0.82 }}>訪問件数</div>
            <div style={{ fontSize:24, fontWeight:900, lineHeight:1.2 }}>{total}</div>
            <div style={{ fontSize:9, opacity:0.65 }}>→ 一覧</div>
          </div>
          <div style={{ flex:1, background:"rgba(255,255,255,0.18)", padding:13, borderRadius:13, textAlign:"center", position:"relative" }}>
            <select value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{ background:"none", border:"none", color:"white", fontSize:10, outline:"none", cursor:"pointer", width:"100%", textAlign:"center" }}>
              {months.map(m=><option key={m} value={m} style={{ color:"#000" }}>{m}</option>)}
            </select>
            <div onClick={()=>{setFilterMode({type:"month",value:selMonth});setTab(4);}} style={{ fontSize:24, fontWeight:900, lineHeight:1.2, cursor:"pointer" }}>{month}</div>
            <div style={{ fontSize:9, opacity:0.65 }}>→ 絞込</div>
          </div>
          <div onClick={()=>{setFilterMode({type:"high"});setTab(4);}} style={{ flex:1, background:"rgba(255,255,255,0.18)", padding:13, borderRadius:13, textAlign:"center", cursor:"pointer" }}>
            <div style={{ fontSize:10, opacity:0.82 }}>平均</div>
            <div style={{ fontSize:24, fontWeight:900, lineHeight:1.2 }}>{avg}★</div>
            <div style={{ fontSize:9, opacity:0.65 }}>高評価</div>
          </div>
        </div>
      </div>
      <div style={{ padding:"14px 16px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ fontWeight:700, fontSize:14, color:t.tx }}>🔥 おすすめ（DB連携）</span>
          <a href={RAMENDB_RANK} target="_blank" rel="noreferrer" style={{ fontSize:11, color:t.acc, fontWeight:700, textDecoration:"none" }}>全て見る →</a>
        </div>
        <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:8 }}>
          {DEMO_SHOPS.slice(0,4).map((s,i)=>(
            <a key={i} href={`${RAMENDB_BASE}/s/${s.id}.html`} target="_blank" rel="noreferrer"
              style={{ minWidth:118, flexShrink:0, background:t.card, border:`1px solid ${t.br}`, borderRadius:12, overflow:"hidden", textDecoration:"none" }}>
              <div style={{ height:54, background:t.accm, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>{["✨","🎯","🎌","🏆"][i]}</div>
              <div style={{ padding:"7px 9px" }}>
                <div style={{ fontWeight:700, fontSize:11, color:t.tx, marginBottom:2 }}>{s.name}</div>
                <div style={{ fontSize:10, color:t.star, fontWeight:700 }}>{s.score}pt</div>
              </div>
            </a>
          ))}
        </div>
      </div>
      <div style={{ padding:"12px 16px 24px" }}>
        <div style={{ fontWeight:700, fontSize:14, color:t.tx, marginBottom:10 }}>📖 最近の記録</div>
        {entries.slice(0,4).map(e=>(
          <div key={e.id} style={{ background:t.card, borderRadius:12, padding:11, marginBottom:8, display:"flex", gap:11, boxShadow:`0 2px 8px ${t.sh}` }}>
            <img src={e.images?.[0]||PH()} alt={e.shopName} style={{ width:44, height:44, borderRadius:9, objectFit:"cover", flexShrink:0 }} onError={ev=>{ev.target.src=PH();}}/>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{e.shopName}</div>
              <div style={{ fontSize:11, color:t.txm }}>{e.visitDate}{e.genre?` · ${e.genre}`:""}</div>
              <div style={{ fontSize:11, color:t.star }}>{"★".repeat(e.rating||0)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── おすすめ ─────────────────────────────────────────────────
function RecommendPage() {
  const { t } = useApp();
  const [genre, setGenre] = useState("すべて");
  const list = genre==="すべて" ? DEMO_SHOPS : DEMO_SHOPS.filter(s=>s.genre===genre);
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:t.bg }}>
      <a href={RAMENDB_RANK} target="_blank" rel="noreferrer" style={{ flexShrink:0, display:"flex", alignItems:"center", gap:8, padding:"8px 14px", background:t.accm, textDecoration:"none", borderBottom:`1px solid ${t.br}` }}>
        <span style={{ fontSize:14 }}>🌐</span>
        <span style={{ fontSize:11, fontWeight:700, color:t.acc, flex:1 }}>ラーメンDB連携 — 評価ポイント順</span>
        <span style={{ fontSize:10, color:t.txm }}>ramendb.supleks.jp/rank →</span>
      </a>
      <div style={{ flexShrink:0, padding:"8px 12px", display:"flex", gap:6, overflowX:"auto", borderBottom:`1px solid ${t.br}` }}>
        {["すべて","醤油","豚骨","塩","味噌","つけ麺","その他"].map(g=>(
          <button key={g} onClick={()=>setGenre(g)} style={{ flexShrink:0, padding:"4px 12px", borderRadius:20, border:"none", background:genre===g?t.acc:t.bg2, color:genre===g?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>{g}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:16 }}>
        {list.map((s,i)=>(
          <div key={i} style={{ background:t.card, padding:14, borderRadius:14, marginBottom:10, boxShadow:`0 2px 8px ${t.sh}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:26, height:26, borderRadius:"50%", background:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":t.bg2, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:11, color:i<3?"white":t.txm, flexShrink:0 }}>{i+1}</div>
                <span style={{ fontWeight:700, fontSize:14, color:t.tx }}>{s.name}</span>
              </div>
              <span style={{ color:t.star, fontWeight:900, fontSize:14 }}>{s.score}pt</span>
            </div>
            <div style={{ background:t.bg2, borderRadius:4, height:4, margin:"6px 0" }}>
              <div style={{ height:"100%", background:t.grad, width:`${Math.min(s.score,100)}%`, borderRadius:4 }}/>
            </div>
            <div style={{ fontSize:12, color:t.txm, marginBottom:8 }}>{s.area} / {s.genre}</div>
            <a href={`${RAMENDB_BASE}/s/${s.id}.html`} target="_blank" rel="noreferrer" style={{ display:"block", textAlign:"center", padding:"8px", background:t.bg2, borderRadius:10, fontSize:12, color:t.acc, fontWeight:700, textDecoration:"none" }}>
              🌐 ラーメンDBで詳細を見る
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── マップ ───────────────────────────────────────────────────
function MapPage() {
  const { entries, settings, t } = useApp();
  const [filter, setFilter] = useState("visited");
  const [sel, setSel] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const mapRef = useRef(null);
  const gmapRef = useRef(null);
  const PIN_POS = [{l:"18%",t:"24%"},{l:"55%",t:"38%"},{l:"34%",t:"62%"},{l:"68%",t:"20%"},{l:"12%",t:"55%"},{l:"60%",t:"68%"}];
  const rc = r => r>=5?"#E74C3C":r>=4?"#E67E22":"#95A5A6";
  const list = filter==="visited" ? entries : entries;

  const getLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p=>setUserPos({lat:p.coords.latitude,lng:p.coords.longitude}),()=>alert("位置情報を取得できません"));
  };
  useEffect(()=>{
    if (!settings?.mapsApiKey||!mapRef.current) return;
    const init = ()=>{ if(!window.google||gmapRef.current) return; gmapRef.current=new window.google.maps.Map(mapRef.current,{center:userPos||{lat:35.6762,lng:139.6503},zoom:13}); };
    if (window.google){init();return;}
    if (document.querySelector("#gmaps-script")) return;
    const s=document.createElement("script"); s.id="gmaps-script"; s.src=`https://maps.googleapis.com/maps/api/js?key=${settings.mapsApiKey}`; s.async=true; s.onload=init; document.head.appendChild(s);
  },[settings?.mapsApiKey,userPos]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:t.bg }}>
      <div style={{ flexShrink:0, padding:"8px 14px", display:"flex", gap:6, borderBottom:`1px solid ${t.br}`, alignItems:"center" }}>
        {[["visited","訪問済み"],["all","全件"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:"3px 10px", borderRadius:20, border:"none", background:filter===v?t.acc:t.bg2, color:filter===v?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>{l}</button>
        ))}
        <button onClick={getLocation} style={{ marginLeft:"auto", background:t.accm, border:"none", borderRadius:16, padding:"4px 10px", color:t.acc, fontSize:11, fontWeight:600, cursor:"pointer" }}>📍 現在地</button>
      </div>
      <div style={{ flexShrink:0, margin:"10px 12px", borderRadius:14, overflow:"hidden", background:t.bg2, border:`1px solid ${t.br}`, position:"relative", height:220 }}>
        {settings?.mapsApiKey ? <div ref={mapRef} style={{ width:"100%", height:"100%" }}/> : (
          <>
            <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(${t.br} 1px,transparent 1px),linear-gradient(90deg,${t.br} 1px,transparent 1px)`, backgroundSize:"32px 32px", opacity:0.5 }}/>
            <div style={{ position:"absolute", top:"43%", left:0, right:0, height:3, background:t.br, opacity:.7 }}/>
            <div style={{ position:"absolute", left:"42%", top:0, bottom:0, width:3, background:t.br, opacity:.7 }}/>
            {userPos && <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", fontSize:22 }}>📍</div>}
            {list.slice(0,6).map((e,i)=>(
              <button key={e.id||i} onClick={()=>setSel(sel?.id===e.id?null:e)}
                style={{ position:"absolute", left:PIN_POS[i%6].l, top:PIN_POS[i%6].t, background:rc(e.rating||3), border:"2.5px solid white", borderRadius:16, padding:"2px 8px", color:"white", fontSize:10, fontWeight:700, cursor:"pointer", boxShadow:"0 2px 6px rgba(0,0,0,.28)", transform:sel?.id===e.id?"scale(1.22) translateY(-4px)":"scale(1)", transition:"transform 0.18s" }}>
                📍{(e.shopName||"").slice(0,4)}
              </button>
            ))}
            <div style={{ position:"absolute", bottom:7, left:7, right:7, background:"rgba(0,0,0,.7)", borderRadius:8, padding:"5px 9px", color:"white", fontSize:10, textAlign:"center" }}>🔑 設定でAPIキーを入力するとリアルマップに切替</div>
          </>
        )}
      </div>
      {sel && (
        <div style={{ flexShrink:0, margin:"0 12px 8px", background:t.card, border:`1px solid ${t.br}`, borderRadius:14, boxShadow:`0 2px 10px ${t.sh}` }}>
          <div style={{ padding:"11px 13px", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:t.accm, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{sel.emoji||"🍜"}</div>
            <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{sel.shopName}</div><Stars value={sel.rating||0} readonly size={12}/></div>
            <a href={`https://www.google.com/maps/search/${encodeURIComponent(sel.shopName)}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ background:t.bg2, borderRadius:8, padding:"6px 10px", fontSize:11, color:t.tx2, fontWeight:600, textDecoration:"none" }}>🗺 開く</a>
          </div>
        </div>
      )}
      <div style={{ flex:1, overflowY:"auto", padding:"0 12px 10px", display:"flex", flexDirection:"column", gap:7 }}>
        {list.length===0 ? (
          <div style={{ textAlign:"center", padding:"40px 20px", color:t.txm }}><div style={{ fontSize:40, marginBottom:12 }}>🗺️</div><div>記録を追加するとマップに表示されます</div></div>
        ) : list.map((e,i)=>(
          <div key={e.id||i} onClick={()=>setSel(p=>p?.id===e.id?null:e)} style={{ background:t.card, border:sel?.id===e.id?`2px solid ${t.acc}`:`1px solid ${t.br}`, borderRadius:12, cursor:"pointer" }}>
            <div style={{ padding:"11px 13px", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:rc(e.rating||3), flexShrink:0 }}/>
              <span style={{ fontWeight:600, fontSize:13, flex:1, color:t.tx }}>{e.shopName}</span>
              <Stars value={e.rating||0} readonly size={11}/>
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(e.shopName)}`} target="_blank" rel="noreferrer" onClick={ev=>ev.stopPropagation()} style={{ fontSize:11, color:t.acc, textDecoration:"none", fontWeight:600 }}>🗺</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── アルバム詳細シート（長押しで開く） ──────────────────────
function AlbumDetailSheet({ entry, onClose, onDelete, onAddImages, onRemoveImage, t }) {
  const [imgIdx,     setImgIdx]     = useState(0);
  const [editing,    setEditing]    = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addProg,    setAddProg]    = useState(0);
  const [addTotal,   setAddTotal]   = useState(0);
  const images = entry.images || [];
  const swipeX = useRef(null);

  const onImgTouchStart = e => { swipeX.current = e.touches[0].clientX; };
  const onImgTouchEnd   = e => {
    if (swipeX.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeX.current;
    swipeX.current = null;
    if (dx < -40 && imgIdx < images.length - 1) setImgIdx(i => i + 1);
    if (dx >  40 && imgIdx > 0)                  setImgIdx(i => i - 1);
  };

  const handleAdd = async (files) => {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    setAddLoading(true); setAddProg(0); setAddTotal(arr.length);
    for (let i = 0; i < arr.length; i++) {
      await onAddImages(entry.id, [arr[i]]);
      setAddProg(i + 1);
      await new Promise(r => setTimeout(r, 20));
    }
    setAddLoading(false);
  };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:200 }}/>
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:t.card, borderRadius:"22px 22px 0 0", zIndex:201, maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:t.br, borderRadius:2, margin:"11px auto 0" }}/>

        {/* 画像ビューア */}
        <div style={{ position:"relative", background:"#111", height:240 }}
          onTouchStart={onImgTouchStart} onTouchEnd={onImgTouchEnd}>
          {images.length > 0 ? (
            <img src={images[imgIdx]} alt="" style={{ width:"100%", height:240, objectFit:"contain", display:"block" }} onError={ev=>{ev.target.src=PH();}}/>
          ) : (
            <div style={{ height:240, display:"flex", alignItems:"center", justifyContent:"center", fontSize:48, color:"#444" }}>📷</div>
          )}
          {images.length > 1 && (
            <>
              <div style={{ position:"absolute", bottom:10, left:"50%", transform:"translateX(-50%)", display:"flex", gap:5 }}>
                {images.map((_,i) => (
                  <div key={i} onClick={() => setImgIdx(i)}
                    style={{ width:i===imgIdx?14:6, height:6, borderRadius:3, background:i===imgIdx?"white":"rgba(255,255,255,0.38)", transition:"all 0.2s", cursor:"pointer" }}/>
                ))}
              </div>
              <div style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.6)", color:"white", fontSize:11, fontWeight:700, borderRadius:10, padding:"2px 9px" }}>
                {imgIdx+1} / {images.length}
              </div>
              {imgIdx > 0 && (
                <button onClick={() => setImgIdx(i=>i-1)} style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.45)", border:"none", borderRadius:"50%", width:32, height:32, color:"white", fontSize:18, cursor:"pointer" }}>‹</button>
              )}
              {imgIdx < images.length - 1 && (
                <button onClick={() => setImgIdx(i=>i+1)} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.45)", border:"none", borderRadius:"50%", width:32, height:32, color:"white", fontSize:18, cursor:"pointer" }}>›</button>
              )}
            </>
          )}
        </div>

        <div style={{ padding:"14px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:18, color:t.tx }}>{entry.shopName}</div>
              {entry.menu && <div style={{ fontSize:12, color:t.acc, marginTop:2 }}>{entry.menu}</div>}
            </div>
            <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:t.txm, flexShrink:0, marginLeft:10 }}>✕</button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
            {[["📅 訪問日",entry.visitDate||"—"],["🍜 ジャンル",entry.genre||"—"],["📍 エリア",entry.area||"—"]].map(([l,v])=>(
              <div key={l} style={{ background:t.bg2, borderRadius:10, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:t.txm, marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:12, fontWeight:700, color:t.tx }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", gap:2, marginBottom:12 }}>
            {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize:22, color:(entry.rating||0)>=n?t.star:t.br }}>★</span>)}
          </div>

          {entry.comment && (
            <div style={{ background:t.accm, borderRadius:10, padding:"10px 12px", marginBottom:14, borderLeft:`3px solid ${t.acc}` }}>
              <p style={{ fontSize:13, color:t.tx, margin:0, fontStyle:"italic", lineHeight:1.6 }}>「{entry.comment}」</p>
            </div>
          )}

          {/* 編集 */}
          <button onClick={() => setEditing(v=>!v)}
            style={{ width:"100%", padding:"9px", borderRadius:10, border:`1.5px solid ${t.br}`, background:t.bg2, color:t.tx, fontWeight:600, fontSize:13, cursor:"pointer", marginBottom:10 }}>
            {editing ? "▲ 編集を閉じる" : "✏️ 写真を追加・削除"}
          </button>

          {editing && (
            <div style={{ marginBottom:12 }}>
              {addLoading && (
                <div style={{ display:"flex", alignItems:"center", gap:10, background:t.bg2, borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
                  <div style={{ fontSize:22, animation:"spin 0.5s linear infinite" }}>🍜</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:t.tx, marginBottom:4, fontWeight:700 }}>追加中...</div>
                    <div style={{ height:4, background:t.br, borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", background:t.grad, width:`${(addProg/addTotal)*100}%`, transition:"width 0.2s" }}/>
                    </div>
                  </div>
                  <span style={{ fontSize:11, color:t.txm }}>{addProg}/{addTotal}</span>
                </div>
              )}
              <label style={{ display:"block", textAlign:"center", padding:"10px", background:t.acc, color:"white", borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", marginBottom:10 }}>
                ＋ 写真を追加（複数可）
                <input type="file" multiple accept="image/*" hidden onChange={ev=>{handleAdd(ev.target.files);ev.target.value="";}}/>
              </label>
              {images.map((img,idx) => (
                <div key={idx} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <img src={img} alt="" style={{ width:52, height:52, borderRadius:8, objectFit:"cover", flexShrink:0 }} onError={ev=>{ev.target.src=PH();}}/>
                  <div style={{ flex:1, fontSize:11, color:t.txm }}>{idx+1}枚目{idx===0?" (表紙)":""}</div>
                  <button onClick={() => { onRemoveImage(entry.id,idx); if(imgIdx>=images.length-1) setImgIdx(Math.max(0,images.length-2)); }}
                    style={{ padding:"4px 10px", borderRadius:7, border:"none", background:"#FFF5F5", color:"#E74C3C", fontSize:11, cursor:"pointer", fontWeight:600 }}>削除</button>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => { if(window.confirm(`「${entry.shopName}」を削除しますか？`)) { onDelete(entry.id); onClose(); } }}
            style={{ width:"100%", padding:"11px", borderRadius:10, border:"1.5px solid #FADBD8", background:"#FFF5F5", color:"#E74C3C", fontWeight:600, fontSize:13, cursor:"pointer" }}>
            🗑️ このアルバムを削除
          </button>
        </div>
      </div>
    </>
  );
}

// ─── アルバム（1枚目のみ表示・長押しで詳細） ─────────────────
function AlbumPage() {
  const { entries, setEntries, t } = useApp();
  const [detail,     setDetail]     = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addProg,    setAddProg]    = useState(0);
  const [addTotal,   setAddTotal]   = useState(0);

  const longTimer  = useRef(null);
  const longFired  = useRef(false);

  const lpStart = (entry) => () => {
    longFired.current = false;
    longTimer.current = setTimeout(() => { longFired.current = true; setDetail(entry); }, 480);
  };
  const lpEnd = () => { clearTimeout(longTimer.current); };
  const lpClick = (entry) => () => { if (!longFired.current) setDetail(entry); };

  const deleteEntry  = id  => setEntries(p => p.filter(e => e.id !== id));
  const removeImg    = (id, idx) => {
    setEntries(p => p.map(e => e.id===id ? { ...e, images:(e.images||[]).filter((_,i)=>i!==idx) } : e));
    setDetail(prev => prev?.id===id ? { ...prev, images:(prev.images||[]).filter((_,i)=>i!==idx) } : prev);
  };
  const addImages = async (entryId, filesArr) => {
    const arr = Array.from(filesArr);
    if (!arr.length) return;
    setAddLoading(true); setAddProg(0); setAddTotal(arr.length);
    const imgs = [];
    for (let i=0; i<arr.length; i++) {
      const d = await readAsDataURL(arr[i]);
      if (d) imgs.push(d);
      setAddProg(i+1);
      await new Promise(r=>setTimeout(r,20));
    }
    setEntries(p => p.map(e => e.id===entryId ? { ...e, images:dedupe([...(e.images||[]),...imgs]) } : e));
    setDetail(prev => prev?.id===entryId ? { ...prev, images:dedupe([...(prev.images||[]),...imgs]) } : prev);
    setAddLoading(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:t.bg, position:"relative" }}>
      {addLoading && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)", zIndex:50, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontSize:50, animation:"spin 0.5s linear infinite", marginBottom:14 }}>🍜</div>
          <div style={{ color:"white", fontWeight:700, fontSize:16, marginBottom:8 }}>画像を追加中...</div>
          <div style={{ width:180, height:5, background:"rgba(255,255,255,0.2)", borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#E74C3C,#FF6B6B)", width:`${(addProg/addTotal)*100}%`, borderRadius:3, transition:"width 0.2s" }}/>
          </div>
          <div style={{ color:"rgba(255,255,255,0.6)", fontSize:12, marginTop:6 }}>{addProg}/{addTotal}枚</div>
        </div>
      )}

      <div style={{ flexShrink:0, padding:"10px 16px", borderBottom:`1px solid ${t.br}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontWeight:700, fontSize:14, color:t.tx }}>📷 アルバム ({entries.length}件)</span>
        <span style={{ fontSize:11, color:t.txm }}>長押しで詳細・編集</span>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:12 }}>
        {entries.length===0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", color:t.txm }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📷</div>
            <div style={{ fontWeight:700, color:t.tx, marginBottom:6 }}>記録がありません</div>
            <div style={{ fontSize:12 }}>「＋ 記録」から追加できます</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {entries.map(e => (
              <div key={e.id}
                onTouchStart={lpStart(e)} onTouchEnd={lpEnd} onTouchCancel={lpEnd}
                onMouseDown={lpStart(e)}  onMouseUp={lpEnd}   onMouseLeave={lpEnd}
                onClick={lpClick(e)}
                onContextMenu={ev=>{ev.preventDefault();setDetail(e);}}
                style={{ background:t.card, borderRadius:12, overflow:"hidden", position:"relative", boxShadow:`0 2px 10px ${t.sh}`, cursor:"pointer", userSelect:"none", WebkitUserSelect:"none" }}>
                {/* 1枚目のみ */}
                <img src={e.images?.[0]||PH(e.emoji||"🍜")} alt={e.shopName}
                  style={{ width:"100%", height:110, objectFit:"cover", display:"block", pointerEvents:"none" }}
                  onError={ev=>{ev.target.src=PH();}}/>
                {(e.images?.length||0)>1 && (
                  <div style={{ position:"absolute", top:6, left:6, background:"rgba(0,0,0,0.62)", color:"white", fontSize:9, fontWeight:700, borderRadius:8, padding:"2px 7px", display:"flex", alignItems:"center", gap:3 }}>
                    📷 {e.images.length}
                  </div>
                )}
                {e.aiDetected && (
                  <div style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.55)", color:"white", fontSize:9, borderRadius:8, padding:"2px 6px" }}>AI</div>
                )}
                <div style={{ padding:"8px 10px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:t.tx, marginBottom:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{e.shopName}</div>
                  {e.menu && <div style={{ fontSize:10, color:t.acc, marginBottom:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{e.menu}</div>}
                  <div style={{ fontSize:10, color:t.txm }}>{e.visitDate} · {"★".repeat(e.rating||0)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {detail && (
        <AlbumDetailSheet
          entry={detail}
          onClose={()=>setDetail(null)}
          onDelete={deleteEntry}
          onAddImages={addImages}
          onRemoveImage={removeImg}
          t={t}
        />
      )}
    </div>
  );
}

// ─── マイページ ──────────────────────────────────────────────
function MyPage() {
  const { profile, setProfile, entries, filterMode, setFilterMode, groups, setGroups, settings, setSettings, t } = useApp();
  const [view, setView] = useState("you");
  const [pendingG, setPendingG] = useState([]);
  const [selG, setSelG]         = useState([]);
  const [newGName, setNewGName] = useState("");
  const [newMem,   setNewMem]   = useState("");
  const [expandG,  setExpandG]  = useState(null);

  const filtered = entries.filter(e=>{
    if (view==="group"&&selG.length>0) return selG.includes(e.groupId);
    if (filterMode.type==="month") return e.visitDate?.startsWith(filterMode.value);
    if (filterMode.type==="high")  return e.rating>=4;
    return true;
  });
  const createGroup = ()=>{ if(!newGName.trim()) return; setGroups(p=>[...p,{id:`g${Date.now()}`,name:newGName.trim(),emoji:"🍜",members:["あなた"]}]); setNewGName(""); };
  const addMem  = gid=>{ if(!newMem.trim()) return; setGroups(p=>p.map(g=>g.id===gid?{...g,members:[...g.members,newMem.trim()]}:g)); setNewMem(""); };
  const sendLine= g=>{ window.open(`https://line.me/R/share?text=${encodeURIComponent(`【Men～Log】${g.name} に招待！\n${APP_LINK}`)}`, "_blank"); };
  const reset   = ()=>{ setFilterMode({type:"all",value:null}); setSelG([]); setPendingG([]); };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:t.bg }}>
      <div style={{ flexShrink:0, background:t.grad, padding:"16px", color:"white" }}>
        <div style={{ fontWeight:700, fontSize:20, fontFamily:"Georgia,serif" }}>{profile.name}</div>
        <div style={{ fontSize:11, opacity:0.75 }}>{profile.station} · ❤️ {profile.favorite}</div>
      </div>
      <div style={{ flexShrink:0, display:"flex", borderBottom:`1px solid ${t.br}` }}>
        {[["you","👤 あなた"],["group","👥 グループ"],["settings","⚙️ 設定"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{ flex:1, padding:"10px 4px", border:"none", background:"transparent", color:view===v?t.acc:t.txm, fontWeight:700, fontSize:12, cursor:"pointer", borderBottom:view===v?`2px solid ${t.acc}`:"2px solid transparent" }}>{l}</button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:16 }}>
        {view==="you"&&(
          <>
            <section style={{ background:t.card, padding:16, borderRadius:14, marginBottom:14, boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx, marginBottom:10 }}>✏️ プロフィール編集</div>
              {[["ニックネーム","name","例：ラーメン太郎"],["最寄り駅","station","例：新宿駅"]].map(([label,key,ph])=>(
                <div key={key} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:t.txm, marginBottom:3 }}>{label}</div>
                  <input style={{ width:"100%", padding:"9px 12px", background:t.bg2, border:`1.5px solid ${t.br}`, borderRadius:9, fontSize:13, color:t.tx, outline:"none", boxSizing:"border-box" }}
                    value={profile[key]||""} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))} placeholder={ph}/>
                </div>
              ))}
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:11, color:t.txm, marginBottom:4 }}>性別</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {["未設定","男性","女性","その他"].map(g=>(
                    <button key={g} onClick={()=>setProfile(p=>({...p,gender:g}))} style={{ padding:"5px 12px", borderRadius:16, border:"none", background:profile.gender===g?t.acc:t.bg2, color:profile.gender===g?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>{g}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:t.txm, marginBottom:4 }}>好きなジャンル</div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {["醤油","豚骨","塩","味噌","つけ麺","その他"].map(g=>(
                    <button key={g} onClick={()=>setProfile(p=>({...p,favorite:g}))} style={{ padding:"4px 10px", borderRadius:16, border:"none", background:profile.favorite===g?t.acc:t.bg2, color:profile.favorite===g?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>{g}</button>
                  ))}
                </div>
              </div>
            </section>
            <section style={{ background:t.card, padding:14, borderRadius:14, marginBottom:14, boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontWeight:700, fontSize:13, color:t.tx }}>🔍 絞り込み</span>
                <button onClick={reset} style={{ fontSize:11, color:"#E74C3C", border:"none", background:"#FFF5F5", borderRadius:8, padding:"3px 10px", cursor:"pointer" }}>🔄 リセット</button>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["all","high"].map(type=>(
                  <button key={type} onClick={()=>setFilterMode({type,value:null})} style={{ padding:"4px 12px", borderRadius:14, border:"none", background:filterMode.type===type?t.acc:t.bg2, color:filterMode.type===type?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                    {type==="all"?"全て":"高評価(4★↑)"}
                  </button>
                ))}
              </div>
            </section>
            <div style={{ fontWeight:700, fontSize:13, color:t.tx, marginBottom:8 }}>記録一覧 ({filtered.length}件)</div>
            {filtered.map(e=>(
              <div key={e.id} style={{ background:t.card, padding:11, borderRadius:12, marginBottom:8, display:"flex", gap:11, boxShadow:`0 2px 6px ${t.sh}` }}>
                <img src={e.images?.[0]||PH()} alt={e.shopName} style={{ width:52, height:52, borderRadius:9, objectFit:"cover", flexShrink:0 }} onError={ev=>{ev.target.src=PH();}}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{e.shopName}</div>
                  <div style={{ fontSize:11, color:t.txm }}>{e.visitDate} / {"★".repeat(e.rating||0)}</div>
                  {e.comment&&<div style={{ fontSize:11, color:t.tx2, marginTop:2 }}>{e.comment}</div>}
                </div>
              </div>
            ))}
          </>
        )}
        {view==="group"&&(
          <>
            <section style={{ background:t.card, padding:14, borderRadius:14, marginBottom:14, boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx, marginBottom:8 }}>👥 グループを選択</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                {groups.map(g=>(
                  <button key={g.id} onClick={()=>setPendingG(p=>p.includes(g.id)?p.filter(x=>x!==g.id):[...p,g.id])} style={{ padding:"5px 14px", borderRadius:16, border:"none", background:pendingG.includes(g.id)?t.acc:t.bg2, color:pendingG.includes(g.id)?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>{g.emoji} {g.name}</button>
                ))}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setSelG([...pendingG])} style={{ flex:2, padding:"9px", borderRadius:10, border:"none", background:t.grad, color:"white", fontWeight:700, fontSize:12, cursor:"pointer" }}>✅ 決定</button>
                <button onClick={reset} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", background:"#FFF5F5", color:"#E74C3C", fontWeight:700, fontSize:12, cursor:"pointer" }}>🔄 リセット</button>
              </div>
            </section>
            {groups.map(g=>(
              <div key={g.id} style={{ background:t.card, borderRadius:12, marginBottom:10, overflow:"hidden", boxShadow:`0 2px 8px ${t.sh}` }}>
                <div style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:38, height:38, borderRadius:9, background:t.accm, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{g.emoji}</div>
                  <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{g.name}</div><div style={{ fontSize:11, color:t.txm }}>{g.members.length}人</div></div>
                  <button onClick={()=>setExpandG(expandG===g.id?null:g.id)} style={{ background:t.bg2, border:"none", borderRadius:7, padding:"4px 9px", fontSize:10, color:t.acc, fontWeight:600, cursor:"pointer" }}>👤管理</button>
                  <button onClick={()=>sendLine(g)} style={{ background:"#06C755", border:"none", borderRadius:7, padding:"4px 9px", fontSize:10, color:"white", fontWeight:700, cursor:"pointer" }}>LINE</button>
                </div>
                <div style={{ padding:"0 14px 10px", display:"flex", gap:4, flexWrap:"wrap" }}>
                  {g.members.map(m=><span key={m} style={{ background:t.accm, color:t.acc, fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:16 }}>{m}</span>)}
                </div>
                {expandG===g.id&&(
                  <div style={{ padding:"10px 14px 12px", borderTop:`1px solid ${t.br}`, background:t.bg2 }}>
                    <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                      <input value={newMem} onChange={e=>setNewMem(e.target.value)} placeholder="名前を入力" style={{ flex:1, padding:"8px 10px", background:"white", border:`1.5px solid ${t.br}`, borderRadius:8, fontSize:13, color:t.tx, outline:"none" }}/>
                      <button onClick={()=>addMem(g.id)} style={{ padding:"8px 14px", borderRadius:8, border:"none", background:t.acc, color:"white", fontWeight:700, cursor:"pointer" }}>追加</button>
                    </div>
                    <button onClick={()=>sendLine(g)} style={{ width:"100%", padding:"10px", borderRadius:10, border:"none", background:"#06C755", color:"white", fontWeight:700, fontSize:13, cursor:"pointer" }}>💬 LINEでアプリリンクを送る</button>
                    <div style={{ fontSize:10, color:t.txm, textAlign:"center", marginTop:4 }}>{APP_LINK}</div>
                  </div>
                )}
              </div>
            ))}
            <div style={{ display:"flex", gap:8, marginTop:6 }}>
              <input value={newGName} onChange={e=>setNewGName(e.target.value)} placeholder="新しいグループ名" style={{ flex:1, padding:"10px 12px", background:t.card, border:`1.5px solid ${t.br}`, borderRadius:9, fontSize:13, color:t.tx, outline:"none" }}/>
              <button onClick={createGroup} style={{ padding:"10px 16px", borderRadius:9, border:"none", background:t.grad, color:"white", fontWeight:700, cursor:"pointer" }}>作成</button>
            </div>
          </>
        )}
        {view==="settings"&&(
          <>
            <section style={{ background:t.card, padding:16, borderRadius:14, marginBottom:14, boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx, marginBottom:10 }}>🎨 テーマ</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[["warm","🔥 暖色"],["dark","🌙 ダーク"],["cool","❄️ 寒色"],["season","🍃 季節"]].map(([id,label])=>(
                  <button key={id} onClick={()=>setSettings(s=>({...s,theme:id}))} style={{ padding:"12px", borderRadius:10, border:settings.theme===id?`2.5px solid ${t.acc}`:`1.5px solid ${t.br}`, background:settings.theme===id?t.accm:t.card, cursor:"pointer", fontWeight:settings.theme===id?700:400, color:t.tx }}>{label}</button>
                ))}
              </div>
            </section>
            <section style={{ background:t.card, padding:16, borderRadius:14, boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx, marginBottom:10 }}>🗑️ データ管理</div>
              <button onClick={()=>{if(window.confirm("全データをリセット？")){localStorage.clear();window.location.reload();}}} style={{ width:"100%", padding:"12px", borderRadius:10, border:"1.5px solid #FADBD8", background:"#FFF5F5", color:"#E74C3C", fontWeight:600, cursor:"pointer" }}>データをリセット</button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}


// ─── 記録モーダル ─────────────────────────────────────────────
function PostModal() {
  const { entries, setEntries, setShowPost, t } = useApp();
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({ shopName:"", visitDate:new Date().toISOString().slice(0,10), rating:5, genre:"醤油", area:"", comment:"" });

  const handleManual = () => {
    if (!form.shopName.trim()) return;
    setEntries(p=>[{...form, id:`m_${Date.now()}`, images:[], aiDetected:false},...p]);
    setShowPost(false);
  };

  // 結果表示
  if (result) {
    const nc = result.filter(r=>r.action==="新規作成").length;
    const ac = result.filter(r=>r.action==="追加").length;
    const sc = result.filter(r=>r.action==="重複スキップ").length;
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:100, display:"flex", alignItems:"flex-end" }}>
        <div style={{ background:t.card, width:"100%", borderRadius:"20px 20px 0 0", padding:"0 20px 32px", maxHeight:"80vh", overflowY:"auto" }}>
          <div style={{ width:36, height:4, background:t.br, borderRadius:2, margin:"12px auto 16px" }}/>
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
            <div style={{ fontWeight:700, fontSize:18, color:t.tx }}>AI振分が完了しました</div>
            <div style={{ fontSize:12, color:t.txm, marginTop:4 }}>ラーメンDBと照合して自動振り分けしました</div>
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:16, justifyContent:"center" }}>
            {[["新規アルバム",nc,t.acc],["追加",ac,"#27ae60"],["スキップ",sc,t.txm]].map(([label,count,color])=>(
              <div key={label} style={{ textAlign:"center", background:t.bg2, borderRadius:12, padding:"10px 14px" }}>
                <div style={{ fontSize:18, fontWeight:700, color }}>{count}</div>
                <div style={{ fontSize:10, color:t.txm }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:16 }}>
            {result.map((r,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:t.bg2, borderRadius:10, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{r.action==="新規作成"?"🆕":r.action==="追加"?"📸":"🔁"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{r.shopName}</div>
                  <div style={{ fontSize:11, color:t.txm }}>
                    {r.date}{r.menu?` · ${r.menu}`:""}{r.confidence?` · 信頼度${r.confidence}%`:""}
                    {r.known===false?" · 不明店舗":""}
                  </div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:r.action==="新規作成"?t.acc:r.action==="追加"?"#27ae60":t.txm, background:t.card, borderRadius:8, padding:"2px 8px" }}>{r.action}</span>
              </div>
            ))}
          </div>
          <button onClick={()=>setShowPost(false)} style={{ width:"100%", padding:"13px", borderRadius:11, border:"none", background:t.grad, color:"white", fontWeight:700, fontSize:14, cursor:"pointer" }}>
            アルバムで確認する 📷
          </button>
        </div>
      </div>
    );
  }

  const inp = { width:"100%", padding:"10px 12px", background:t.bg2, border:`1.5px solid ${t.br}`, borderRadius:9, fontSize:13, color:t.tx, outline:"none", boxSizing:"border-box", marginBottom:10 };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:100, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:t.card, width:"100%", borderRadius:"20px 20px 0 0", padding:"0 20px 32px", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:t.br, borderRadius:2, margin:"12px auto 16px" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ margin:0, color:t.tx }}>🍜 新規記録</h3>
          <button onClick={()=>setShowPost(false)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:t.txm }}>✕</button>
        </div>
        {/* AI一括取込ボタン → クリックでPostModalを閉じてBulkImportViewを開く */}
        <AiBulkTrigger onDone={summary=>{ setResult(summary); }} onEntriesUpdate={newEntries=>setEntries(newEntries)} />
        <div style={{ display:"flex", alignItems:"center", gap:8, margin:"14px 0" }}>
          <div style={{ flex:1, height:1, background:t.br }}/><span style={{ fontSize:11, color:t.txm }}>または手動で記録</span><div style={{ flex:1, height:1, background:t.br }}/>
        </div>
        <input style={inp} placeholder="店舗名 *" value={form.shopName} onChange={e=>setForm(f=>({...f,shopName:e.target.value}))}/>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <input type="date" style={{...inp,marginBottom:0}} value={form.visitDate} onChange={e=>setForm(f=>({...f,visitDate:e.target.value}))}/>
          <select style={{...inp,marginBottom:0}} value={form.genre} onChange={e=>setForm(f=>({...f,genre:e.target.value}))}>
            {["醤油","豚骨","塩","味噌","つけ麺","その他"].map(g=><option key={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:t.txm, marginBottom:4 }}>評価</div>
          <div style={{ display:"flex", gap:6 }}>
            {[1,2,3,4,5].map(n=>(
              <button key={n} onClick={()=>setForm(f=>({...f,rating:n}))} style={{ width:36, height:36, borderRadius:"50%", border:"none", background:form.rating>=n?"#E67E22":"#eee", color:form.rating>=n?"white":"#999", fontSize:18, cursor:"pointer" }}>★</button>
            ))}
          </div>
        </div>
        <textarea style={{...inp,minHeight:60,resize:"none"}} placeholder="コメント（任意）" value={form.comment} onChange={e=>setForm(f=>({...f,comment:e.target.value}))}/>
        <button onClick={handleManual} style={{ width:"100%", padding:"13px", borderRadius:11, border:"none", background:t.grad, color:"white", fontWeight:700, fontSize:14, cursor:"pointer" }}>記録する ✓</button>
      </div>
    </div>
  );
}

// AI一括取込トリガー（PostModal内）
// ─ ファイル選択→aiState更新→FullscreenSpinner表示→完了後にコールバック
function AiBulkTrigger({ onDone, onEntriesUpdate }) {
  const { entries, setAiState, t } = useApp();
  const [location, setLocation] = useState(null);
  useEffect(()=>{
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p=>setLocation(`${p.coords.latitude.toFixed(2)},${p.coords.longitude.toFixed(2)}`),()=>{});
  },[]);

  const handleChange = async (ev) => {
    const files = Array.from(ev.target.files||[]);
    ev.target.value = "";
    if (!files.length) return;

    // スピナー開始（全画面・zIndex:9999）
    setAiState({ progress:0, total:files.length, shopName:"" });

    try {
      const { entries: newEntries, summary } = await runAIBulk({
        files,
        entries,
        location,
        onProgress: (p, t, name) => setAiState({ progress:p, total:t, shopName:name }),
      });
      onEntriesUpdate(newEntries);
      onDone(summary);
    } catch(err) {
      console.error("AI bulk error:", err);
      onDone([{ shopName:"処理エラー", action:"スキップ", date:"" }]);
    } finally {
      setAiState(null); // スピナー終了
    }
  };

  return (
    <label style={{ display:"block", padding:"16px 14px", background:t.grad, borderRadius:14, textAlign:"center", cursor:"pointer" }}>
      <div style={{ fontSize:28, marginBottom:4 }}>🍜</div>
      <div style={{ color:"white", fontWeight:700, fontSize:14, marginBottom:2 }}>画像を一括取込（AI自動振分）</div>
      <div style={{ color:"rgba(255,255,255,0.8)", fontSize:11 }}>複数枚選択可 · ラーメンDB照合 · 不明店舗は「不明1」「不明2」で自動作成</div>
      <input type="file" multiple accept="image/*" hidden onChange={handleChange}/>
    </label>
  );
}

// ─── スワイプ対応メインレイアウト ────────────────────────────
// ★ containerW不使用 → パーセント計算でtranslateX（白画面バグ根本修正）
function MainLayout() {
  const { tab, setTab, showPost, setShowPost, aiState, t } = useApp();
  const TABS = [
    { label:"ホーム",    icon:"🏠", Page:HomePage       },
    { label:"おすすめ",  icon:"🔥", Page:RecommendPage  },
    { label:"マップ",    icon:"🗺️", Page:MapPage        },
    { label:"アルバム",  icon:"🖼️", Page:AlbumPage      },
    { label:"マイページ",icon:"👤", Page:MyPage         },
  ];
  const N = TABS.length; // 5
  // 各タブの幅 = 100/N % of the inner track (= 100% of the viewport)
  // translateX for tab i = -(i * 100/N) % of the inner track = -i * viewport_width
  const STEP = 100 / N; // = 20 for 5 tabs

  const [dragDelta, setDragDelta] = useState(0);
  const [dragging,  setDragging]  = useState(false);
  const touchX = useRef(null);
  const touchY = useRef(null);
  const mouseX = useRef(null);

  const THRESH = 50;
  const commit = (dx) => {
    setDragDelta(0);
    setDragging(false);
    if      (dx < -THRESH && tab < N-1) setTab(tab+1);
    else if (dx >  THRESH && tab > 0)   setTab(tab-1);
  };
  const clamp = (dx) => {
    if (dx > 0 && tab === 0)   return dx * 0.15;
    if (dx < 0 && tab === N-1) return dx * 0.15;
    return dx;
  };

  // タッチ
  const onTouchStart = e => { if(showPost||aiState) return; touchX.current=e.touches[0].clientX; touchY.current=e.touches[0].clientY; setDragging(false); setDragDelta(0); };
  const onTouchMove  = e => {
    if (touchX.current===null) return;
    const dx=e.touches[0].clientX-touchX.current, dy=e.touches[0].clientY-touchY.current;
    if (!dragging && Math.abs(dy)>Math.abs(dx)*1.4) return;
    if (Math.abs(dx)>8) { setDragging(true); setDragDelta(clamp(dx)*0.75); }
  };
  const onTouchEnd   = e => { if(!dragging){touchX.current=null;return;} const dx=e.changedTouches[0].clientX-touchX.current; touchX.current=null; commit(dx); };
  // マウス
  const onMouseDown  = e => { if(showPost||aiState) return; mouseX.current=e.clientX; setDragging(false); setDragDelta(0); };
  const onMouseMove  = e => { if(mouseX.current===null) return; const dx=e.clientX-mouseX.current; if(Math.abs(dx)>8){setDragging(true);setDragDelta(clamp(dx)*0.75);} };
  const onMouseUp    = e => { if(mouseX.current===null) return; const dx=e.clientX-mouseX.current; mouseX.current=null; if(!dragging) return; commit(dx); };
  const onMouseLeave = () => { if(mouseX.current!==null){mouseX.current=null;setDragging(false);setDragDelta(0);} };

  return (
    <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", fontFamily:"'Noto Sans JP',system-ui,sans-serif", background:t.bg, overflow:"hidden" }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{-webkit-tap-highlight-color:transparent}
      `}</style>

      {/* AI処理中フルスクリーンスピナー（アプリ最上位・zIndex:9999） */}
      {aiState && <FullscreenSpinner progress={aiState.progress} total={aiState.total} shopName={aiState.shopName}/>}

      {/* ヘッダー */}
      <div style={{ flexShrink:0, height:48, display:"flex", alignItems:"center", justifyContent:"center", background:t.bg, borderBottom:`1px solid ${t.br}`, position:"relative", zIndex:10 }}>
        <MenLogLogo size={20}/>
        <button onClick={()=>setShowPost(true)} style={{ position:"absolute", right:12, background:t.grad, border:"none", borderRadius:8, padding:"5px 13px", color:"white", fontSize:11, fontWeight:700, cursor:"pointer" }}>＋ 記録</button>
      </div>

      {/* スワイプコンテナ ── containerW不使用・パーセント計算 */}
      <div style={{ flex:1, minHeight:0, overflow:"hidden", position:"relative" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}   onMouseMove={onMouseMove}  onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
      >
        {/* track: N倍幅、translateXでスライド */}
        <div style={{
          display:"flex",
          width:  `${N * 100}%`,
          height: "100%",
          // ★ -tab * STEP% = -tab * (100/N)% of the track = -tab * 100% of viewport
          transform: `translateX(calc(-${tab * STEP}% + ${dragDelta}px))`,
          transition: dragging ? "none" : "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          willChange: "transform",
          userSelect: "none",
        }}>
          {TABS.map(({ Page }, i) => (
            // 各タブ: track幅の (100/N)% = viewport幅
            <div key={i} style={{ width:`${STEP}%`, height:"100%", overflow:"hidden", flexShrink:0 }}>
              <Page/>
            </div>
          ))}
        </div>

        {/* ページドット */}
        <div style={{ position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)", display:"flex", gap:4, zIndex:5, pointerEvents:"none" }}>
          {TABS.map((_,i)=>(
            <div key={i} style={{ width:i===tab?14:4, height:4, borderRadius:2, background:i===tab?t.acc:t.br, transition:"all 0.25s" }}/>
          ))}
        </div>
      </div>

      {/* モーダル */}
      {showPost && <PostModal/>}

      {/* フッター */}
      <div style={{ flexShrink:0, display:"flex", background:t.card, borderTop:`1px solid ${t.br}`, boxShadow:`0 -3px 12px ${t.sh}`, zIndex:10 }}>
        {TABS.map((it,i)=>(
          <button key={i} onClick={()=>{setTab(i);setDragDelta(0);}} style={{ flex:1, border:"none", background:"none", color:tab===i?t.acc:t.txm, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, padding:"8px 2px", minHeight:52, fontSize:9, fontWeight:tab===i?700:400, transition:"color 0.2s" }}>
            <span style={{ fontSize:tab===i?20:17, transition:"font-size 0.18s" }}>{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
        <button onClick={()=>setShowPost(true)} style={{ flex:1, border:"none", background:"none", color:t.acc, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, padding:"8px 2px", minHeight:52, fontSize:9, fontWeight:700 }}>
          <span style={{ fontSize:20 }}>➕</span><span>記録</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return <Provider><MainLayout/></Provider>;
}
