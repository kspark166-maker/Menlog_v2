import { useState, useRef, useEffect, createContext, useContext } from "react";

// ─── 定数・設定 ──────────────────────────────────────────────
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

const DEMO_SHOPS = [
  { name:"らぁ麺 飯田商店", score:98.5, genre:"塩", area:"湯河原", id:"119107" },
  { name:"中華そば とみ田", score:97.2, genre:"つけ麺", area:"松戸", id:"3051" },
  { name:"Japanese Soba Noodles 蔦", score:96.0, genre:"醤油", area:"巣鴨", id:"58279" },
  { name:"麺屋 武蔵", score:88.5, genre:"醤油", area:"新宿", id:"1" },
  { name:"風雲児", score:89.3, genre:"鶏白湯", area:"代々木", id:"4" },
];

const RAMENDB_MASTER = [
  ...DEMO_SHOPS.map(s => ({ ...s, keywords: [s.name, s.genre, s.area], menu: ["特製らーめん", "デフォルト"] })),
  { name:"一蘭", genre:"豚骨", area:"渋谷", score:86.2, keywords:["豚骨","一蘭","個室"], id:"2", menu:["天然とんこつラーメン"] },
  { name:"二郎 三田本店", genre:"二郎系", area:"三田", score:83.0, keywords:["二郎","大","ニンニク"], id:"8", menu:["ラーメン(小)"] },
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
  return <Ctx.Provider value={{ entries, setEntries, groups, setGroups, profile, setProfile, settings, setSettings, tab, setTab, showPost, setShowPost, filterMode, setFilterMode, t }}>{children}</Ctx.Provider>;
}

// ─── コンポーネント: ロゴ ───────────────────────────────────
function MenLogLogo({ size = 20 }) {
  const { t } = useApp();
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:2, fontFamily:"serif", fontWeight:700, fontSize:size, color:t.tx }}>
      <span>Men</span>
      <svg width={size*1.8} height={size*0.8} viewBox="0 0 36 16">
        <path d="M2 3 Q7 0 12 3 Q17 6 22 3 Q27 0 32 3" stroke={t.acc} strokeWidth="2.2" fill="none"/>
      </svg>
      <span>Log</span>
    </span>
  );
}

// ─── ユーティリティ: AI解析 ──────────────────────────────────
async function analyzeImageFeatures(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;
      let white=0, brown=0;
      for (let i=0; i<data.length; i+=4) {
        if (data[i]>200 && data[i+1]>200 && data[i+2]>200) white++;
        if (data[i]>120 && data[i+1]>80 && data[i+2]<80) brown++;
      }
      resolve({ whiteRatio: white/1024, brownRatio: brown/1024 });
    };
    img.onerror = () => resolve({ whiteRatio:0, brownRatio:0 });
    img.src = dataUrl;
  });
}

// ─── ページ: アルバム ────────────────────────────────────────
function AlbumPage() {
  const { entries, setEntries, t } = useApp();
  const deleteEntry = (id) => window.confirm("削除しますか？") && setEntries(prev => prev.filter(e => e.id !== id));
  
  return (
    <div style={{ padding:12, background:t.bg, minHeight:"100%" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {entries.map(e => (
          <div key={e.id} style={{ background:t.card, borderRadius:12, overflow:"hidden", boxShadow:`0 2px 8px ${t.sh}` }}>
            <img src={e.images?.[0] || PLACEHOLDER()} style={{ width:"100%", height:110, objectFit:"cover" }} />
            <div style={{ padding:8 }}>
              <div style={{ fontSize:12, fontWeight:700 }}>{e.shopName}</div>
              <div style={{ fontSize:10, color:t.txm }}>{e.visitDate}</div>
              <button onClick={() => deleteEntry(e.id)} style={{ marginTop:4, width:"100%", fontSize:10, background:t.bg2, border:"none", borderRadius:4, padding:4 }}>削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── モーダル: 記録 ─────────────────────────────────────────
function PostModal() {
  const { setEntries, setShowPost, t } = useApp();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ shopName:"", visitDate:new Date().toISOString().slice(0,10), rating:5, genre:"醤油" });

  const handleBulkUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setLoading(true);
    for (const file of files) {
      const dataUrl = await new Promise(res => {
        const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(file);
      });
      const feats = await analyzeImageFeatures(dataUrl);
      const newEntry = {
        id: Date.now() + Math.random(),
        shopName: feats.whiteRatio > 0.3 ? "塩ラーメン店(推測)" : "醤油ラーメン店(推測)",
        visitDate: new Date().toISOString().slice(0,10),
        images: [dataUrl],
        rating: 4,
        genre: feats.whiteRatio > 0.3 ? "塩" : "醤油"
      };
      setEntries(prev => [newEntry, ...prev]);
    }
    setLoading(false);
    setShowPost(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:t.card, width:"100%", maxWidth:400, borderRadius:20, padding:20 }}>
        <h3 style={{ marginTop:0 }}>{loading ? "解析中..." : "新規記録"}</h3>
        {!loading && (
          <>
            <label style={{ display:"block", padding:20, background:t.grad, color:"white", borderRadius:12, textAlign:"center", cursor:"pointer", marginBottom:16 }}>
              📷 画像を一括取込
              <input type="file" multiple accept="image/*" hidden onChange={handleBulkUpload} />
            </label>
            <input style={{ width:"100%", padding:10, marginBottom:10, boxSizing:"border-box" }} placeholder="店名" value={form.shopName} onChange={e => setForm({...form, shopName:e.target.value})} />
            <button onClick={() => setShowPost(false)} style={{ width:"100%", padding:10, background:t.bg2, border:"none", borderRadius:8 }}>閉じる</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── メインレイアウト ─────────────────────────────────────────
function MainLayout() {
  const { tab, setTab, showPost, setShowPost, t } = useApp();
  const TABS = [
    { label:"ホーム", icon:"🏠", Page: () => <div style={{padding:20}}>🏠 ホーム（統計などはここ）</div> },
    { label:"おすすめ", icon:"🔥", Page: () => <div style={{padding:20}}>🔥 おすすめ（RamenDB連携）</div> },
    { label:"アルバム", icon:"🖼️", Page: AlbumPage },
    { label:"マイページ", icon:"👤", Page: () => <div style={{padding:20}}>👤 マイページ</div> },
  ];
  const CurrentPage = TABS[tab].Page;

  return (
    <div style={{ width:"100%", height:"100vh", display:"flex", flexDirection:"column", background:t.bg, color:t.tx }}>
      <div style={{ flexShrink:0, height:48, display:"flex", alignItems:"center", justifyContent:"center", borderBottom:`1px solid ${t.br}`, background:t.card, position:"relative" }}>
        <MenLogLogo />
        <button onClick={() => setShowPost(true)} style={{ position:"absolute", right:10, background:t.grad, color:"white", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11 }}>＋記録</button>
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        <CurrentPage />
      </div>
      {showPost && <PostModal />}
      <div style={{ flexShrink:0, height:60, display:"flex", borderTop:`1px solid ${t.br}`, background:t.card }}>
        {TABS.map((it, i) => (
          <button key={i} onClick={() => setTab(i)} style={{ flex:1, border:"none", background:"none", color:tab===i?t.acc:t.txm, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontSize:10 }}>
            <span style={{ fontSize:20 }}>{it.icon}</span>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return <Provider><MainLayout /></Provider>;
}
