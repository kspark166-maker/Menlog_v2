import { useState, useRef, useEffect, createContext, useContext } from "react";

// ─── テーマ・定数設定 ──────────────────────────────────────────────
const THEMES = {
  warm:   { bg:"#FFF8F3", bg2:"#FFF0E6", card:"#FFFFFF", acc:"#C0392B", accm:"#FADBD8", tx:"#1A0A00", tx2:"#6B4C3B", txm:"#A0826D", br:"#F0DDD5", star:"#E67E22", grad:"linear-gradient(135deg,#C0392B,#E74C3C)", sh:"rgba(192,57,43,0.12)" },
  dark:   { bg:"#0F0A08", bg2:"#1A110D", card:"#231610", acc:"#E74C3C", accm:"#3D1A17", tx:"#F5EDE8", tx2:"#C4A99A", txm:"#7A5C4F", br:"#3D2418", star:"#F39C12", grad:"linear-gradient(135deg,#E74C3C,#FF6B6B)", sh:"rgba(231,76,60,0.2)"  },
  cool:   { bg:"#F0F4FF", bg2:"#E8EEFF", card:"#FFFFFF", acc:"#3B5BDB", accm:"#DBE4FF", tx:"#0A0F2C", tx2:"#3B4A8A", txm:"#7C8DB0", br:"#D0D9F5", star:"#F59F00", grad:"linear-gradient(135deg,#3B5BDB,#4C6EF5)", sh:"rgba(59,91,219,0.12)" },
  season: { bg:"#F5FFF0", bg2:"#EAFAE0", card:"#FFFFFF", acc:"#2E7D32", accm:"#C8E6C9", tx:"#0A1F0C", tx2:"#2E5C30", txm:"#6A9B6D", br:"#D4EDD6", star:"#F57F17", grad:"linear-gradient(135deg,#2E7D32,#43A047)", sh:"rgba(46,125,50,0.12)" },
};

const RAMENDB_BASE = "https://ramendb.supleks.jp";
const RAMENDB_RANK = "https://ramendb.supleks.jp/rank";
const APP_LINK     = "https://men-log2-yerr.vercel.app/";

const PLACEHOLDER = (text="🍜") =>
  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect width='150' height='150' fill='%23FADBD8'/><text x='75' y='85' font-size='48' text-anchor='middle'>${encodeURIComponent(text)}</text></svg>`;

const RAMENDB_MASTER = [
  { name:"らぁ麺 飯田商店", genre:"塩", area:"湯河原", score:98.5, keywords:["飯田","塩","湯河原"], id:"119107", menu:["塩らーめん"] },
  { name:"中華そば とみ田", genre:"つけ麺", area:"松戸", score:97.2, keywords:["とみ田","つけ麺","松戸"], id:"3051", menu:["特製つけ麺"] },
  { name:"Japanese Soba Noodles 蔦", genre:"醤油", area:"巣鴨", score:96.0, keywords:["蔦","醤油","トリュフ"], id:"58279", menu:["醤油そば"] },
  { name:"一蘭", genre:"豚骨", area:"渋谷", score:86.2, keywords:["一蘭","豚骨"], id:"2", menu:["天然とんこつラーメン"] },
  { name:"二郎 三田本店", genre:"二郎系", area:"三田", score:83.0, keywords:["二郎","ヤサイ"], id:"8", menu:["ラーメン(小)"] },
];

// ─── Context ────────────────────────────────────────────────
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

function Provider({ children }) {
  const load = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
  const [entries, setEntries] = useState(() => load("rd_entries", []));
  const [groups, setGroups] = useState(() => load("rd_groups", [{ id:"g1", name:"ラーメン部", emoji:"🍜", members:["あなた"] }]));
  const [profile, setProfile] = useState(() => load("rd_profile", { name:"ユーザー", gender:"未設定", station:"未設定", favorite:"醤油" }));
  const [settings, setSettings] = useState(() => load("rd_settings", { theme:"warm" }));
  const [tab, setTab] = useState(0);
  const [showPost, setShowPost] = useState(false);
  const [filterMode, setFilterMode] = useState({ type:"all", value:null });

  useEffect(() => localStorage.setItem("rd_entries", JSON.stringify(entries)), [entries]);
  useEffect(() => localStorage.setItem("rd_groups", JSON.stringify(groups)), [groups]);
  useEffect(() => localStorage.setItem("rd_profile", JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem("rd_settings", JSON.stringify(settings)), [settings]);

  const t = THEMES[settings.theme] || THEMES.warm;
  return (
    <Ctx.Provider value={{ entries, setEntries, groups, setGroups, profile, setProfile, settings, setSettings, tab, setTab, showPost, setShowPost, filterMode, setFilterMode, t }}>
      {children}
    </Ctx.Provider>
  );
}

// ─── コンポーネント: ロゴ ───────────────────────────────────
function MenLogLogo({ size = 20 }) {
  const { t } = useApp();
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:2, fontFamily:"serif", fontWeight:700, fontSize:size, color:t.tx }}>
      <span>Men</span>
      <svg width={size*1.8} height={size*0.8} viewBox="0 0 36 16">
        <path d="M2 3 Q7 0 12 3 Q17 6 22 3 Q27 0 32 3" stroke={t.acc} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      </svg>
      <span>Log</span>
    </span>
  );
}

// ─── AI振分エンジン ────────────────────────────────────────
async function analyzeImageFeatures(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;
      let r=0, g=0, b=0, white=0;
      for (let i=0; i<data.length; i+=4) {
        r+=data[i]; g+=data[i+1]; b+=data[i+2];
        if (data[i]>200 && data[i+1]>200 && data[i+2]>200) white++;
      }
      resolve({ brightness: (r+g+b)/(32*32*3), whiteRatio: white/1024 });
    };
    img.src = dataUrl;
  });
}

function extractExifDate(arrayBuffer) {
  // 簡易実装: 本来はExif読み取りライブラリ推奨だが、タイムスタンプを代替として使用
  return new Date().toISOString().slice(0, 10);
}

async function aiMatchShop(file, dataUrl) {
  const feats = await analyzeImageFeatures(dataUrl);
  const name = file.name.toLowerCase();
  
  // キーワードマッチ
  const found = RAMENDB_MASTER.find(s => s.keywords.some(k => name.includes(k.toLowerCase())));
  if (found) return { ...found, confidence: 95 };

  // 色判定
  if (feats.whiteRatio > 0.3) return { name: "不明の塩ラーメン店", genre: "塩", area: "不明", confidence: 60 };
  return { name: "不明のラーメン店", genre: "醤油", area: "不明", confidence: 40 };
}

// ─── 各ページコンポーネント ─────────────────────────────
function HomePage() {
  const { profile, entries, t } = useApp();
  return (
    <div style={{ background:t.bg, minHeight:"100%" }}>
      <div style={{ background:t.grad
