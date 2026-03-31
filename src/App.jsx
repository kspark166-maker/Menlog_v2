import { useState, useRef, useEffect, createContext, useContext } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 修正点サマリー（元ファイルからの変更箇所）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// [FIX-1] THEMES の grad/sh が \\\" になっていた → 正しい文字列リテラルに修正
// [FIX-2] PostModal の z_index → zIndex (React DOM プロパティ名)
// [FIX-3] via.placeholder.com (404) → SVG data URI のフォールバック画像に変更
// [FIX-4] groups が localStorage に未保存 → useEffect 追加
// [FIX-5] useCallback import のみで未使用 → 削除
// [FIX-6] MyPage <img src={undefined}> → フォールバック追加
// [ADD]   デモデータ追加（初回表示時に記録が見える状態に）
// [ADD]   Men～Log ロゴ（麺SVG）をヘッダーに追加
// [ADD]   MenLogMonitor コンポーネント（デモ／差し替えモニター）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── テーマ設定 ──────────────────────────────────────────────
// [FIX-1] grad / sh の \\\" エスケープを除去
const THEMES = {
  warm:   { bg:"#FFF8F3", bg2:"#FFF0E6", card:"#FFFFFF", acc:"#C0392B", accm:"#FADBD8", tx:"#1A0A00", tx2:"#6B4C3B", txm:"#A0826D", br:"#F0DDD5", star:"#E67E22", grad:"linear-gradient(135deg,#C0392B,#E74C3C)", sh:"rgba(192,57,43,0.12)" },
  dark:   { bg:"#0F0A08", bg2:"#1A110D", card:"#231610", acc:"#E74C3C", accm:"#3D1A17", tx:"#F5EDE8", tx2:"#C4A99A", txm:"#7A5C4F", br:"#3D2418", star:"#F39C12", grad:"linear-gradient(135deg,#E74C3C,#FF6B6B)", sh:"rgba(231,76,60,0.2)"  },
  cool:   { bg:"#F0F4FF", bg2:"#E8EEFF", card:"#FFFFFF", acc:"#3B5BDB", accm:"#DBE4FF", tx:"#0A0F2C", tx2:"#3B4A8A", txm:"#7C8DB0", br:"#D0D9F5", star:"#F59F00", grad:"linear-gradient(135deg,#3B5BDB,#4C6EF5)", sh:"rgba(59,91,219,0.12)" },
  season: { bg:"#F5FFF0", bg2:"#EAFAE0", card:"#FFFFFF", acc:"#2E7D32", accm:"#C8E6C9", tx:"#0A1F0C", tx2:"#2E5C30", txm:"#6A9B6D", br:"#D4EDD6", star:"#F57F17", grad:"linear-gradient(135deg,#2E7D32,#43A047)", sh:"rgba(46,125,50,0.12)" },
};

const RAMENDB_BASE = "https://ramendb.supleks.jp";
const RAMENDB_RANK = "https://ramendb.supleks.jp/rank";
const APP_LINK     = "https://men-log2-yerr.vercel.app/";
const GENRES = ["すべて","醤油","豚骨","塩","味噌","つけ麺","鶏白湯","二郎系","中華そば","煮干し","その他"];
const AREAS  = ["すべて","新宿","渋谷","池袋","代々木","中野","三田","巣鴨","五反田","横浜","松戸","博多","札幌"];

// [FIX-3] via.placeholder.com の代わりに使うSVG Data URI
const PLACEHOLDER = (text="🍜") =>
  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><rect width='150' height='150' fill='%23FADBD8'/><text x='75' y='85' font-size='48' text-anchor='middle'>${encodeURIComponent(text)}</text></svg>`;

// [ADD] デモデータ（初回表示用）
const DEMO_ENTRIES = [
  { id:"d1", shopName:"飯田商店",   visitDate:"2026-03-20", rating:5, genre:"塩",   area:"湯河原", images:[PLACEHOLDER("✨")], groupId:"g1", comment:"人生で一番うまいラーメン" },
  { id:"d2", shopName:"中華そば とみ田", visitDate:"2026-03-15", rating:5, genre:"つけ麺", area:"松戸",  images:[PLACEHOLDER("🎯")], groupId:"g1", comment:"つけ麺の概念が変わった" },
  { id:"d3", shopName:"一蘭 渋谷",  visitDate:"2026-02-28", rating:4, genre:"豚骨", area:"渋谷",  images:[PLACEHOLDER("🐷")], groupId:"",   comment:"個室で集中して食べる" },
  { id:"d4", shopName:"二郎 三田本店",visitDate:"2026-02-10",rating:3, genre:"二郎系",area:"三田", images:[PLACEHOLDER("💪")], groupId:"",   comment:"量が限界突破してた" },
];
const DEMO_SHOPS = [
  { name:"らぁ麺 飯田商店",       score:98.5, genre:"塩",   area:"湯河原", id:"119107" },
  { name:"中華そば とみ田",       score:97.2, genre:"つけ麺",area:"松戸",  id:"3051"   },
  { name:"Japanese Soba Noodles 蔦", score:96.0, genre:"醤油", area:"巣鴨",  id:"58279"  },
  { name:"麺屋 武蔵",             score:88.5, genre:"醤油", area:"新宿",  id:"1"      },
  { name:"風雲児",                score:89.3, genre:"鶏白湯",area:"代々木",id:"4"      },
];

// ─── Context ────────────────────────────────────────────────
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

function Provider({ children }) {
  const load = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

  const [entries,    setEntries]    = useState(() => load("rd_entries",  DEMO_ENTRIES));
  const [groups,     setGroups]     = useState(() => load("rd_groups",   [{ id:"g1", name:"ラーメン部", emoji:"🍜", members:["あなた","田中","佐藤"] }]));
  const [profile,    setProfile]    = useState(() => load("rd_profile",  { name:"ユーザー", gender:"未設定", station:"未設定", favorite:"醤油" }));
  const [settings,   setSettings]   = useState(() => load("rd_settings", { theme:"warm" }));
  const [tab,        setTab]        = useState(0);
  const [showPost,   setShowPost]   = useState(false);
  const [filterMode, setFilterMode] = useState({ type:"all", value:null });

  // [FIX-4] groups も localStorage に保存
  useEffect(() => { localStorage.setItem("rd_entries",  JSON.stringify(entries));  }, [entries]);
  useEffect(() => { localStorage.setItem("rd_groups",   JSON.stringify(groups));   }, [groups]);
  useEffect(() => { localStorage.setItem("rd_profile",  JSON.stringify(profile));  }, [profile]);
  useEffect(() => { localStorage.setItem("rd_settings", JSON.stringify(settings)); }, [settings]);

  const t = THEMES[settings.theme] || THEMES.warm;

  return (
    <Ctx.Provider value={{ entries, setEntries, groups, setGroups, profile, setProfile, settings, setSettings, tab, setTab, showPost, setShowPost, filterMode, setFilterMode, t }}>
      {children}
    </Ctx.Provider>
  );
}

// ─── 共通: Men～Log ロゴ SVG ────────────────────────────────
function MenLogLogo({ size = 20 }) {
  const { t } = useApp();
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:1, fontFamily:"Georgia,serif", fontWeight:700, fontSize:size, color:t.tx, lineHeight:1 }}>
      <span>Men</span>
      <svg width={Math.round(size*1.8)} height={Math.round(size*0.85)} viewBox="0 0 36 16" fill="none"
        style={{ display:"inline-block", verticalAlign:"middle", margin:"0 1px" }}>
        <path d="M2 3 Q7 0 12 3 Q17 6 22 3 Q27 0 32 3 Q34.5 4.5 34 4"  stroke={t.acc} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        <path d="M2 7.5 Q7 4.5 12 7.5 Q17 10.5 22 7.5 Q27 4.5 32 7.5 Q34.5 9 34 8.5" stroke={t.acc} strokeWidth="1.9" strokeLinecap="round" fill="none" opacity="0.65"/>
        <path d="M2 12 Q7 9 12 12 Q17 15 22 12 Q27 9 32 12 Q34.5 13.5 34 13" stroke={t.acc} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.35"/>
      </svg>
      <span>Log</span>
    </span>
  );
}

// ─── ホーム ──────────────────────────────────────────────────
function HomePage() {
  const { entries, profile, setTab, setFilterMode, t } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const months = Array.from(new Set(entries.map(e => e.visitDate?.slice(0, 7)).filter(Boolean))).sort().reverse();
  if (!months.includes(new Date().toISOString().slice(0, 7))) months.unshift(new Date().toISOString().slice(0, 7));

  const stats = {
    total: entries.length,
    month: entries.filter(e => e.visitDate?.startsWith(selectedMonth)).length,
    avg:   entries.length ? (entries.reduce((a, b) => a + (b.rating||0), 0) / entries.length).toFixed(1) : "0.0",
  };

  return (
    <div style={{ height:"100%", overflowY:"auto", background:t.bg }}>
      {/* ヒーローバナー */}
      <div style={{ background:t.grad, padding:"40px 20px 24px", color:"white", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-30, right:-30, width:130, height:130, borderRadius:"50%", background:"rgba(255,255,255,0.1)" }}/>
        <div style={{ fontSize:12, opacity:0.85, marginBottom:4 }}>おかえり 👋</div>
        <h2 style={{ fontSize:22, fontFamily:"Georgia,serif", margin:0 }}>{profile.name}さんのMen～Log</h2>
        {profile.station !== "未設定" && (
          <div style={{ fontSize:11, opacity:0.75, marginTop:4 }}>🚉 {profile.station} · ❤️ {profile.favorite}</div>
        )}
        {/* 統計カード */}
        <div style={{ display:"flex", gap:10, marginTop:18 }}>
          {/* 訪問件数 */}
          <div onClick={() => { setFilterMode({ type:"all" }); setTab(3); }}
            style={{ flex:1, background:"rgba(255,255,255,0.2)", padding:14, borderRadius:14, textAlign:"center", cursor:"pointer", backdropFilter:"blur(4px)" }}>
            <div style={{ fontSize:10, opacity:0.85 }}>訪問件数</div>
            <div style={{ fontSize:24, fontWeight:900, lineHeight:1.2 }}>{stats.total}</div>
            <div style={{ fontSize:9, opacity:0.7 }}>タップで一覧 →</div>
          </div>
          {/* 今月（月セレクタ付き） */}
          <div style={{ flex:1, background:"rgba(255,255,255,0.2)", padding:14, borderRadius:14, textAlign:"center", backdropFilter:"blur(4px)", position:"relative" }}>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              style={{ background:"none", border:"none", color:"white", fontSize:10, outline:"none", cursor:"pointer", width:"100%", textAlign:"center" }}>
              {months.map(m => <option key={m} value={m} style={{ color:"#000" }}>{m}</option>)}
            </select>
            <div onClick={() => { setFilterMode({ type:"month", value:selectedMonth }); setTab(3); }}
              style={{ fontSize:24, fontWeight:900, lineHeight:1.2, cursor:"pointer" }}>{stats.month}</div>
            <div style={{ fontSize:9, opacity:0.7 }}>タップで絞込 →</div>
          </div>
          {/* 平均 */}
          <div onClick={() => { setFilterMode({ type:"high" }); setTab(3); }}
            style={{ flex:1, background:"rgba(255,255,255,0.2)", padding:14, borderRadius:14, textAlign:"center", cursor:"pointer", backdropFilter:"blur(4px)" }}>
            <div style={{ fontSize:10, opacity:0.85 }}>平均</div>
            <div style={{ fontSize:24, fontWeight:900, lineHeight:1.2 }}>{stats.avg}★</div>
            <div style={{ fontSize:9, opacity:0.7 }}>高評価で絞込 →</div>
          </div>
        </div>
      </div>

      {/* プロフィールカード */}
      <div style={{ padding:"16px 16px 0" }}>
        <div style={{ background:t.card, padding:14, borderRadius:14, boxShadow:`0 4px 12px ${t.sh}` }}>
          <div style={{ fontSize:11, fontWeight:700, color:t.txm, marginBottom:4 }}>👤 プロフィール</div>
          <div style={{ fontSize:13, color:t.tx }}>最寄り駅: <strong>{profile.station}</strong> &nbsp;/&nbsp; 好きなジャンル: <strong>{profile.favorite}</strong></div>
        </div>
      </div>

      {/* おすすめリスト */}
      <div style={{ padding:"16px 16px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ fontWeight:700, fontSize:14, color:t.tx }}>🔥 ラーメンDB おすすめ</span>
          <a href={RAMENDB_RANK} target="_blank" rel="noreferrer" style={{ fontSize:11, color:t.acc, fontWeight:700, textDecoration:"none" }}>全て見る →</a>
        </div>
        <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:8 }}>
          {DEMO_SHOPS.slice(0,4).map((s,i) => (
            <a key={i} href={`${RAMENDB_BASE}/s/${s.id}.html`} target="_blank" rel="noreferrer"
              style={{ minWidth:120, flexShrink:0, background:t.card, border:`1px solid ${t.br}`, borderRadius:12, overflow:"hidden", textDecoration:"none", boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ height:56, background:t.accm, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>
                {["✨","🎯","🎌","🏆","☁️"][i]}
              </div>
              <div style={{ padding:"8px 10px" }}>
                <div style={{ fontWeight:700, fontSize:11, color:t.tx, marginBottom:2 }}>{s.name}</div>
                <div style={{ fontSize:10, color:t.star, fontWeight:700 }}>{s.score}pt</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* 最近の記録 */}
      <div style={{ padding:"12px 16px 24px" }}>
        <div style={{ fontWeight:700, fontSize:14, color:t.tx, marginBottom:10 }}>📖 最近の記録</div>
        {entries.slice(0,3).map(e => (
          <div key={e.id} style={{ background:t.card, borderRadius:12, padding:12, marginBottom:8, display:"flex", gap:12, boxShadow:`0 2px 8px ${t.sh}` }}>
            <img src={e.images?.[0] || PLACEHOLDER()} alt={e.shopName}
              style={{ width:46, height:46, borderRadius:10, objectFit:"cover", flexShrink:0 }}
              onError={ev => { ev.target.src = PLACEHOLDER(); }} />
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{e.shopName}</div>
              <div style={{ fontSize:11, color:t.txm }}>{e.visitDate} · {e.genre}</div>
              <div style={{ fontSize:11, color:t.star }}>{"★".repeat(e.rating||0)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── おすすめ（ラーメンDB連携） ─────────────────────────────
function RecommendPage() {
  const { t } = useApp();
  const [genre, setGenre] = useState("すべて");
  const filtered = genre === "すべて" ? DEMO_SHOPS : DEMO_SHOPS.filter(s => s.genre === genre);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:t.bg }}>
      {/* DBバナー */}
      <a href={RAMENDB_RANK} target="_blank" rel="noreferrer"
        style={{ flexShrink:0, display:"flex", alignItems:"center", gap:8, padding:"8px 14px", background:t.accm, textDecoration:"none", borderBottom:`1px solid ${t.br}` }}>
        <span style={{ fontSize:14 }}>🌐</span>
        <span style={{ fontSize:11, fontWeight:700, color:t.acc, flex:1 }}>ラーメンデータベース連携 — 評価ポイント順</span>
        <span style={{ fontSize:10, color:t.txm }}>ramendb.supleks.jp →</span>
      </a>
      {/* ジャンルフィルタ */}
      <div style={{ flexShrink:0, padding:"8px 12px", display:"flex", gap:6, overflowX:"auto", borderBottom:`1px solid ${t.br}`, background:t.bg }}>
        {["すべて","醤油","豚骨","塩","味噌","つけ麺","その他"].map(g => (
          <button key={g} onClick={() => setGenre(g)}
            style={{ flexShrink:0, padding:"4px 12px", borderRadius:20, border:"none", background:genre===g?t.acc:t.bg2, color:genre===g?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>
            {g}
          </button>
        ))}
      </div>
      {/* ランキングリスト */}
      <div style={{ flex:1, overflowY:"auto", padding:16 }}>
        <div style={{ fontWeight:700, fontSize:14, color:t.tx, marginBottom:12 }}>🏆 ランキング ({filtered.length}件)</div>
        {filtered.map((shop, i) => (
          <div key={i} style={{ background:t.card, padding:14, borderRadius:14, marginBottom:10, boxShadow:`0 2px 8px ${t.sh}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":t.bg2, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12, color:i<3?"white":t.txm, flexShrink:0 }}>{i+1}</div>
                <span style={{ fontWeight:700, fontSize:14, color:t.tx }}>{shop.name}</span>
              </div>
              <span style={{ color:t.star, fontWeight:900, fontSize:14 }}>{shop.score} pt</span>
            </div>
            {/* スコアバー */}
            <div style={{ background:t.bg2, borderRadius:4, height:4, margin:"6px 0" }}>
              <div style={{ height:"100%", background:t.grad, width:`${Math.min(shop.score,100)}%`, borderRadius:4 }}/>
            </div>
            <div style={{ fontSize:12, color:t.txm, marginBottom:8 }}>{shop.area} / {shop.genre}</div>
            <a href={`${RAMENDB_BASE}/s/${shop.id}.html`} target="_blank" rel="noreferrer"
              style={{ display:"block", textAlign:"center", padding:"8px", background:t.bg2, borderRadius:10, fontSize:12, color:t.acc, fontWeight:700, textDecoration:"none" }}>
              🌐 店舗詳細を見る（ラーメンDB）
            </a>
          </div>
        ))}
        <div style={{ marginTop:12, textAlign:"center" }}>
          <a href={RAMENDB_RANK} target="_blank" rel="noreferrer"
            style={{ display:"inline-block", padding:"10px 24px", borderRadius:20, border:`1px solid ${t.br}`, background:t.card, color:t.tx, fontSize:12, textDecoration:"none", fontWeight:600 }}>
            ラーメンDBでランキング全件を見る →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── アルバム ─────────────────────────────────────────────────
function AlbumPage() {
  const { entries, setEntries, t } = useApp();
  const [editId,      setEditId]      = useState(null);
  const [addingImgs,  setAddingImgs]  = useState(false); // 画像追加中フラグ
  const [addProgress, setAddProgress] = useState(0);
  const [addTotal,    setAddTotal]    = useState(0);

  const deleteEntry = (id) => {
    if (window.confirm("この記録を削除しますか？")) {
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  // ── 複数画像追加（1枚ずつ順番に読み込み・白画面防止） ──────
  const addImages = async (entryId, files) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    setAddingImgs(true);
    setAddProgress(0);
    setAddTotal(fileArr.length);

    const newImgs = [];
    for (let i = 0; i < fileArr.length; i++) {
      const dataUrl = await readFileAsDataURL(fileArr[i]);
      newImgs.push(dataUrl);
      setAddProgress(i + 1);
      // UIを更新させるため1フレーム待つ
      await new Promise(r => setTimeout(r, 30));
    }

    setEntries(prev => prev.map(e =>
      e.id === entryId
        ? { ...e, images: deduplicateImages([...(e.images||[]), ...newImgs]) }
        : e
    ));
    setAddingImgs(false);
    setAddProgress(0);
  };

  const removeImage = (entryId, imgIdx) => {
    setEntries(prev => prev.map(e =>
      e.id === entryId
        ? { ...e, images: (e.images||[]).filter((_,i) => i !== imgIdx) }
        : e
    ));
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:t.bg, position:"relative" }}>

      {/* 画像追加中オーバーレイ（白画面の代わり） */}
      {addingImgs && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.72)", zIndex:50, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderRadius:0 }}>
          <div style={{ fontSize:52, animation:"spin 0.5s linear infinite", marginBottom:14 }}>🍜</div>
          <div style={{ color:"white", fontWeight:700, fontSize:16, marginBottom:8 }}>画像を追加中...</div>
          <div style={{ width:180, height:5, background:"rgba(255,255,255,0.2)", borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#E74C3C,#FF6B6B)", width:`${(addProgress/addTotal)*100}%`, borderRadius:3, transition:"width 0.2s" }}/>
          </div>
          <div style={{ color:"rgba(255,255,255,0.65)", fontSize:12, marginTop:6 }}>{addProgress} / {addTotal} 枚</div>
        </div>
      )}

      <div style={{ flexShrink:0, padding:"10px 16px", borderBottom:`1px solid ${t.br}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontWeight:700, fontSize:14, color:t.tx }}>📷 アルバム ({entries.length}件)</span>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:12 }}>
        {entries.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", color:t.txm }}>
            <div style={{ fontSize:48 }}>📷</div>
            <div style={{ marginTop:12, fontWeight:700, color:t.tx }}>記録がありません</div>
            <div style={{ fontSize:12, marginTop:6 }}>ホームの「＋ 記録」から追加できます</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {entries.map(e => (
              <div key={e.id} style={{ background:t.card, borderRadius:12, overflow:"hidden", position:"relative", boxShadow:`0 2px 10px ${t.sh}` }}>
                <img
                  src={e.images?.[0] || PLACEHOLDER()}
                  alt={e.shopName}
                  style={{ width:"100%", height:110, objectFit:"cover", display:"block" }}
                  onError={ev => { ev.target.src = PLACEHOLDER(); }}
                />
                {(e.images?.length||0) > 1 && (
                  <div style={{ position:"absolute", top:6, left:6, background:"rgba(0,0,0,0.6)", color:"white", fontSize:9, borderRadius:8, padding:"2px 6px" }}>
                    {e.images.length}枚
                  </div>
                )}
                <button onClick={() => deleteEntry(e.id)}
                  style={{ position:"absolute", top:5, right:5, background:"rgba(0,0,0,0.55)", color:"white", border:"none", borderRadius:"50%", width:24, height:24, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  ×
                </button>
                <div style={{ padding:"8px 10px" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:t.tx, marginBottom:1 }}>{e.shopName}</div>
                  {e.menu && <div style={{ fontSize:10, color:t.acc, marginBottom:1 }}>{e.menu}</div>}
                  <div style={{ fontSize:10, color:t.txm, marginBottom:6 }}>{e.visitDate} · {"★".repeat(e.rating||0)}</div>
                  <button onClick={() => setEditId(editId===e.id ? null : e.id)}
                    style={{ width:"100%", padding:"4px", borderRadius:7, border:`1px solid ${t.br}`, background:t.bg2, color:t.tx, fontSize:10, fontWeight:600, cursor:"pointer" }}>
                    {editId===e.id ? "▲ 閉じる" : "✏️ 編集"}
                  </button>
                </div>
                {editId === e.id && (
                  <div style={{ padding:"0 10px 10px" }}>
                    {/* 写真追加ボタン */}
                    <label style={{ display:"block", textAlign:"center", padding:"8px", background:t.acc, color:"white", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", marginBottom:8 }}>
                      ＋ 写真を追加（複数可）
                      <input type="file" multiple accept="image/*" hidden
                        onChange={ev => { addImages(e.id, ev.target.files); ev.target.value=""; }}/>
                    </label>
                    {/* 既存画像リスト */}
                    {(e.images||[]).map((img, idx) => (
                      <div key={idx} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                        <img src={img} alt="" style={{ width:44, height:44, borderRadius:7, objectFit:"cover", flexShrink:0 }}
                          onError={ev => { ev.target.src = PLACEHOLDER(); }}/>
                        <div style={{ flex:1, fontSize:10, color:t.txm }}>{idx+1}枚目</div>
                        <button onClick={() => removeImage(e.id, idx)}
                          style={{ padding:"3px 8px", borderRadius:6, border:"none", background:"#FFF5F5", color:"#E74C3C", fontSize:10, cursor:"pointer", fontWeight:600 }}>削除</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── マップ ───────────────────────────────────────────────────
function MapPage() {
  const { entries, setDetail, settings, t } = useApp();
  const [filter, setFilter] = useState("visited");
  const [sel, setSel]       = useState(null);
  const [userPos, setUserPos] = useState(null);
  const mapRef  = useRef(null);
  const gmapRef = useRef(null);
  const PIN_POS = [{l:"18%",t:"24%"},{l:"55%",t:"38%"},{l:"34%",t:"62%"},{l:"68%",t:"20%"},{l:"12%",t:"55%"},{l:"60%",t:"68%"}];
  const rc = r => r>=5?"#E74C3C":r>=4?"#E67E22":"#95A5A6";
  const displayList = filter==="visited" ? entries : [];

  const getLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setUserPos({ lat:p.coords.latitude, lng:p.coords.longitude }),
      () => alert("位置情報を取得できません")
    );
  };

  useEffect(() => {
    if (!settings?.mapsApiKey || !mapRef.current) return;
    const init = () => {
      if (!window.google || gmapRef.current) return;
      gmapRef.current = new window.google.maps.Map(mapRef.current, {
        center: userPos || { lat:35.6762, lng:139.6503 }, zoom:13
      });
    };
    if (window.google) { init(); return; }
    if (document.querySelector("#gmaps-script")) return;
    const s = document.createElement("script");
    s.id = "gmaps-script";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${settings.mapsApiKey}`;
    s.async = true; s.onload = init;
    document.head.appendChild(s);
  }, [settings?.mapsApiKey, userPos]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:t.bg }}>
      <div style={{ flexShrink:0, padding:"8px 14px", display:"flex", gap:6, borderBottom:`1px solid ${t.br}`, background:t.bg, alignItems:"center" }}>
        {[["visited","訪問済み"],["all","すべて"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            style={{ padding:"3px 10px", borderRadius:20, border:"none", background:filter===v?t.acc:t.bg2, color:filter===v?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>{l}</button>
        ))}
        <button onClick={getLocation}
          style={{ marginLeft:"auto", background:t.accm, border:"none", borderRadius:16, padding:"4px 10px", color:t.acc, fontSize:11, fontWeight:600, cursor:"pointer" }}>
          📍 現在地
        </button>
      </div>

      {/* マップエリア */}
      <div style={{ flexShrink:0, margin:"10px 12px", borderRadius:14, overflow:"hidden", background:t.bg2, border:`1px solid ${t.br}`, position:"relative", height:220 }}>
        {settings?.mapsApiKey ? (
          <div ref={mapRef} style={{ width:"100%", height:"100%" }}/>
        ) : (
          <>
            <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(${t.br} 1px,transparent 1px),linear-gradient(90deg,${t.br} 1px,transparent 1px)`, backgroundSize:"32px 32px", opacity:0.55 }}/>
            <div style={{ position:"absolute", top:"43%", left:0, right:0, height:3, background:t.br, opacity:.7 }}/>
            <div style={{ position:"absolute", left:"42%", top:0, bottom:0, width:3, background:t.br, opacity:.7 }}/>
            {userPos && <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", fontSize:24 }}>📍</div>}
            {displayList.slice(0,6).map((e,i)=>(
              <button key={e.id||i} onClick={()=>setSel(sel?.id===e.id?null:e)}
                style={{ position:"absolute", left:PIN_POS[i%6].l, top:PIN_POS[i%6].t, background:rc(e.rating||3), border:"2.5px solid white", borderRadius:16, padding:"2px 8px", color:"white", fontSize:10, fontWeight:700, cursor:"pointer", boxShadow:"0 2px 6px rgba(0,0,0,.28)", transform:sel?.id===e.id?"scale(1.22) translateY(-4px)":"scale(1)", transition:"transform 0.18s" }}>
                📍{(e.shopName||"").slice(0,4)}
              </button>
            ))}
            <div style={{ position:"absolute", bottom:7, left:7, right:7, background:"rgba(0,0,0,.72)", borderRadius:8, padding:"5px 9px", color:"white", fontSize:10, textAlign:"center" }}>
              🔑 設定でGoogle Maps APIキーを入力するとリアルマップに切替
            </div>
          </>
        )}
      </div>

      {/* 選択中ピン情報 */}
      {sel && (
        <div style={{ flexShrink:0, margin:"0 12px 8px", background:t.card, border:`1px solid ${t.br}`, borderRadius:14, boxShadow:`0 2px 10px ${t.sh}` }}>
          <div style={{ padding:"11px 13px", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:t.accm, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{sel.emoji||"🍜"}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{sel.shopName}</div>
              <div style={{ fontSize:11, color:t.star }}>{"★".repeat(sel.rating||0)}</div>
            </div>
            <a href={`https://www.google.com/maps/search/${encodeURIComponent(sel.shopName)}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
              style={{ background:t.bg2, borderRadius:8, padding:"6px 10px", fontSize:11, color:t.tx2, fontWeight:600, textDecoration:"none" }}>🗺 マップ</a>
          </div>
        </div>
      )}

      {/* リスト */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 12px 10px", display:"flex", flexDirection:"column", gap:7 }}>
        {displayList.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 20px", color:t.txm }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🗺️</div>
            <div style={{ fontWeight:700, color:t.tx, marginBottom:6 }}>訪問記録がありません</div>
            <div style={{ fontSize:12 }}>記録を追加するとマップに表示されます</div>
          </div>
        ) : displayList.map((e,i)=>(
          <div key={e.id||i} onClick={()=>setSel(p=>p?.id===e.id?null:e)}
            style={{ background:t.card, border:sel?.id===e.id?`2px solid ${t.acc}`:`1px solid ${t.br}`, borderRadius:12, cursor:"pointer" }}>
            <div style={{ padding:"11px 13px", display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:rc(e.rating||3), flexShrink:0 }}/>
              <span style={{ fontWeight:600, fontSize:13, flex:1, color:t.tx }}>{e.shopName}</span>
              <span style={{ fontSize:11, color:t.star }}>{"★".repeat(e.rating||0)}</span>
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(e.shopName)}`} target="_blank" rel="noopener noreferrer" onClick={ev=>ev.stopPropagation()}
                style={{ fontSize:11, color:t.acc, textDecoration:"none", fontWeight:600 }}>🗺</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── マイページ ──────────────────────────────────────────────
function MyPage() {
  const { profile, setProfile, entries, filterMode, setFilterMode, groups, setGroups, settings, setSettings, t } = useApp();
  const [view, setView]           = useState("you");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [pendingGroups,  setPendingGroups]  = useState([]);
  const [newGroupName,   setNewGroupName]   = useState("");
  const [newMember,      setNewMember]      = useState("");
  const [expandGid,      setExpandGid]      = useState(null);

  // 絞り込み
  const filtered = entries.filter(e => {
    if (view === "group" && selectedGroups.length > 0) return selectedGroups.includes(e.groupId);
    if (filterMode.type === "month") return e.visitDate?.startsWith(filterMode.value);
    if (filterMode.type === "high")  return e.rating >= 4;
    return true;
  });

  const createGroup = () => {
    if (!newGroupName.trim()) return;
    const g = { id:`g${Date.now()}`, name:newGroupName.trim(), emoji:"🍜", members:["あなた"] };
    setGroups(prev => [...prev, g]);
    setNewGroupName("");
  };
  const addMember = (gid) => {
    if (!newMember.trim()) return;
    setGroups(prev => prev.map(g => g.id===gid ? { ...g, members:[...g.members, newMember.trim()] } : g));
    setNewMember("");
  };
  const sendLine = (g) => {
    const msg = `【Men～Log】${g.name} に招待されました！\n${APP_LINK}`;
    window.open(`https://line.me/R/share?text=${encodeURIComponent(msg)}`, "_blank");
  };
  const applyGroups = () => setSelectedGroups([...pendingGroups]);
  const resetFilter = () => { setFilterMode({ type:"all", value:null }); setSelectedGroups([]); setPendingGroups([]); };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:t.bg }}>
      {/* ヘッダー */}
      <div style={{ flexShrink:0, background:t.grad, padding:"16px", color:"white" }}>
        <div style={{ fontSize:11, opacity:0.8, marginBottom:2 }}>マイページ</div>
        <div style={{ fontWeight:700, fontSize:20, fontFamily:"Georgia,serif" }}>{profile.name}</div>
        <div style={{ fontSize:11, opacity:0.75 }}>{profile.station} · ❤️ {profile.favorite}</div>
      </div>

      {/* タブ */}
      <div style={{ flexShrink:0, display:"flex", borderBottom:`1px solid ${t.br}`, background:t.bg }}>
        {[["you","👤 あなた"],["group","👥 グループ"],["settings","⚙️ 設定"]].map(([v,l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ flex:1, padding:"10px 4px", border:"none", background:"transparent", color:view===v?t.acc:t.txm, fontWeight:700, fontSize:12, cursor:"pointer", borderBottom:view===v?`2px solid ${t.acc}`:"2px solid transparent" }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:16 }}>

        {/* ── あなた ── */}
        {view === "you" && (
          <>
            {/* プロフィール編集 */}
            <section style={{ background:t.card, padding:16, borderRadius:14, marginBottom:16, boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx, marginBottom:10 }}>✏️ プロフィール編集</div>
              {[
                { label:"ニックネーム", key:"name",    placeholder:"例：ラーメン太郎" },
                { label:"最寄り駅",     key:"station", placeholder:"例：新宿駅" },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:t.txm, marginBottom:3 }}>{label}</div>
                  <input style={{ width:"100%", padding:"9px 12px", background:t.bg2, border:`1.5px solid ${t.br}`, borderRadius:9, fontSize:13, color:t.tx, outline:"none", boxSizing:"border-box" }}
                    value={profile[key]||""} onChange={e => setProfile(p => ({...p,[key]:e.target.value}))} placeholder={placeholder} />
                </div>
              ))}
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:t.txm, marginBottom:3 }}>性別</div>
                <div style={{ display:"flex", gap:6 }}>
                  {["未設定","男性","女性","その他"].map(g => (
                    <button key={g} onClick={() => setProfile(p=>({...p,gender:g}))}
                      style={{ padding:"5px 12px", borderRadius:16, border:"none", background:profile.gender===g?t.acc:t.bg2, color:profile.gender===g?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>{g}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:t.txm, marginBottom:4 }}>好きなジャンル</div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {["醤油","豚骨","塩","味噌","つけ麺","その他"].map(g => (
                    <button key={g} onClick={() => setProfile(p=>({...p,favorite:g}))}
                      style={{ padding:"4px 10px", borderRadius:16, border:"none", background:profile.favorite===g?t.acc:t.bg2, color:profile.favorite===g?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>{g}</button>
                  ))}
                </div>
              </div>
            </section>

            {/* 絞り込み */}
            <section style={{ background:t.card, padding:14, borderRadius:14, marginBottom:14, boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontWeight:700, fontSize:13, color:t.tx }}>🔍 絞り込み</span>
                <button onClick={resetFilter} style={{ fontSize:11, color:"#E74C3C", border:"none", background:"#FFF5F5", borderRadius:8, padding:"3px 10px", cursor:"pointer" }}>🔄 リセット</button>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {["all","high"].map(type => (
                  <button key={type} onClick={() => setFilterMode({ type, value:null })}
                    style={{ padding:"4px 12px", borderRadius:14, border:"none", background:filterMode.type===type?t.acc:t.bg2, color:filterMode.type===type?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                    {type==="all" ? "全て" : "高評価(4★↑)"}
                  </button>
                ))}
              </div>
            </section>

            {/* 記録一覧 */}
            <div style={{ fontWeight:700, fontSize:13, color:t.tx, marginBottom:8 }}>記録一覧 ({filtered.length}件)</div>
            {filtered.map(e => (
              <div key={e.id} style={{ background:t.card, padding:12, borderRadius:12, marginBottom:8, display:"flex", gap:12, boxShadow:`0 2px 6px ${t.sh}` }}>
                {/* [FIX-6] undefinedのときフォールバック */}
                <img src={e.images?.[0] || PLACEHOLDER()} alt={e.shopName}
                  style={{ width:56, height:56, borderRadius:9, objectFit:"cover", flexShrink:0 }}
                  onError={ev => { ev.target.src = PLACEHOLDER(); }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{e.shopName}</div>
                  <div style={{ fontSize:11, color:t.txm }}>{e.visitDate} / {"★".repeat(e.rating||0)}</div>
                  {e.comment && <div style={{ fontSize:11, color:t.tx2, marginTop:2 }}>{e.comment}</div>}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── グループ ── */}
        {view === "group" && (
          <>
            {/* グループ複数選択＋決定 */}
            <section style={{ background:t.card, padding:14, borderRadius:14, marginBottom:14, boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx, marginBottom:8 }}>👥 グループを選択</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                {groups.map(g => (
                  <button key={g.id} onClick={() => setPendingGroups(p => p.includes(g.id) ? p.filter(x=>x!==g.id) : [...p, g.id])}
                    style={{ padding:"5px 14px", borderRadius:16, border:"none", background:pendingGroups.includes(g.id)?t.acc:t.bg2, color:pendingGroups.includes(g.id)?"white":t.tx2, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                    {g.emoji} {g.name}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={applyGroups} style={{ flex:2, padding:"9px", borderRadius:10, border:"none", background:t.grad, color:"white", fontWeight:700, fontSize:12, cursor:"pointer" }}>✅ 決定</button>
                <button onClick={resetFilter} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", background:"#FFF5F5", color:"#E74C3C", fontWeight:700, fontSize:12, cursor:"pointer" }}>🔄 リセット</button>
              </div>
              {selectedGroups.length > 0 && (
                <div style={{ marginTop:8, fontSize:11, color:t.txm }}>
                  絞込み中: {groups.filter(g=>selectedGroups.includes(g.id)).map(g=>g.name).join(" · ")} ({filtered.length}件)
                </div>
              )}
            </section>

            {/* グループ管理 */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontWeight:700, fontSize:13, color:t.tx }}>グループ管理</span>
            </div>
            {groups.map(g => (
              <div key={g.id} style={{ background:t.card, borderRadius:12, marginBottom:10, overflow:"hidden", boxShadow:`0 2px 8px ${t.sh}` }}>
                <div style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:38, height:38, borderRadius:9, background:t.accm, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{g.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{g.name}</div>
                    <div style={{ fontSize:11, color:t.txm }}>{g.members.length}人</div>
                  </div>
                  <button onClick={() => setExpandGid(expandGid===g.id ? null : g.id)}
                    style={{ background:t.bg2, border:"none", borderRadius:7, padding:"4px 9px", fontSize:10, color:t.acc, fontWeight:600, cursor:"pointer" }}>👤管理</button>
                  <button onClick={() => sendLine(g)}
                    style={{ background:"#06C755", border:"none", borderRadius:7, padding:"4px 9px", fontSize:10, color:"white", fontWeight:700, cursor:"pointer" }}>LINE</button>
                </div>
                <div style={{ padding:"0 14px 10px", display:"flex", gap:4, flexWrap:"wrap" }}>
                  {g.members.map(m => (
                    <span key={m} style={{ background:t.accm, color:t.acc, fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:16 }}>{m}</span>
                  ))}
                </div>
                {expandGid === g.id && (
                  <div style={{ padding:"10px 14px 12px", borderTop:`1px solid ${t.br}`, background:t.bg2 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:t.txm, marginBottom:6 }}>メンバーを追加</div>
                    <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                      <input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="名前を入力"
                        style={{ flex:1, padding:"8px 10px", background:"white", border:`1.5px solid ${t.br}`, borderRadius:8, fontSize:13, color:t.tx, outline:"none" }} />
                      <button onClick={() => addMember(g.id)} style={{ padding:"8px 14px", borderRadius:8, border:"none", background:t.acc, color:"white", fontWeight:700, cursor:"pointer" }}>追加</button>
                    </div>
                    <button onClick={() => sendLine(g)}
                      style={{ width:"100%", padding:"10px", borderRadius:10, border:"none", background:"#06C755", color:"white", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                      💬 LINEでアプリリンクを送る
                    </button>
                    <div style={{ fontSize:10, color:t.txm, textAlign:"center", marginTop:4 }}>{APP_LINK}</div>
                  </div>
                )}
              </div>
            ))}

            {/* 新規グループ作成 */}
            <div style={{ display:"flex", gap:8, marginTop:6 }}>
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="新しいグループ名"
                style={{ flex:1, padding:"10px 12px", background:t.card, border:`1.5px solid ${t.br}`, borderRadius:9, fontSize:13, color:t.tx, outline:"none" }} />
              <button onClick={createGroup} style={{ padding:"10px 16px", borderRadius:9, border:"none", background:t.grad, color:"white", fontWeight:700, cursor:"pointer" }}>作成</button>
            </div>
          </>
        )}

        {/* ── 設定 ── */}
        {view === "settings" && (
          <>
            <section style={{ background:t.card, padding:16, borderRadius:14, marginBottom:16, boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx, marginBottom:10 }}>🎨 テーマ</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[["warm","🔥 暖色"],["dark","🌙 ダーク"],["cool","❄️ 寒色"],["season","🍃 季節"]].map(([id,label]) => (
                  <button key={id} onClick={() => setSettings(s => ({...s, theme:id}))}
                    style={{ padding:"12px", borderRadius:10, border:settings.theme===id?`2.5px solid ${t.acc}`:`1.5px solid ${t.br}`, background:settings.theme===id?t.accm:t.card, cursor:"pointer", fontWeight:settings.theme===id?700:400, color:t.tx }}>
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <section style={{ background:t.card, padding:16, borderRadius:14, boxShadow:`0 2px 8px ${t.sh}` }}>
              <div style={{ fontWeight:700, fontSize:13, color:t.tx, marginBottom:10 }}>🗑️ データ管理</div>
              <button onClick={() => { if(window.confirm("全データをリセットしますか？")) { localStorage.clear(); window.location.reload(); }}}
                style={{ width:"100%", padding:"12px", borderRadius:10, border:"1.5px solid #FADBD8", background:"#FFF5F5", color:"#E74C3C", fontWeight:600, cursor:"pointer" }}>
                データをリセット
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 画像一括取込 AI振分エンジン（白画面修正版）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── FileReader を Promise でラップ ────────────────────────────
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = ev => resolve(ev.target.result);
    r.onerror = ()  => reject(new Error("FileReader error"));
    r.readAsDataURL(file);
  });
}
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = ev => resolve(ev.target.result);
    r.onerror = ()  => reject(new Error("FileReader error"));
    r.readAsArrayBuffer(file);
  });
}

// ラーメンDBの店舗マスター
const RAMENDB_MASTER = [
  { name:"らぁ麺 飯田商店",         genre:"塩",      area:"湯河原",    score:98.5, keywords:["塩","清湯","透明","あっさり","鶏","湯河原"],       id:"119107", menu:["塩らーめん","醤油らーめん","特製塩らーめん"] },
  { name:"中華そば とみ田",          genre:"つけ麺",  area:"松戸",      score:97.2, keywords:["つけ麺","濃厚","松戸","太麺"],                     id:"3051",   menu:["特製つけ麺","中華そば","つけ麺"] },
  { name:"Japanese Soba Noodles 蔦", genre:"醤油",    area:"巣鴨",      score:96.0, keywords:["醤油","高級","ミシュラン","トリュフ"],              id:"58279",  menu:["醤油そば","塩そば","つけそば"] },
  { name:"麺屋 武蔵",                genre:"醤油",    area:"新宿",      score:88.5, keywords:["醤油","新宿","チャーシュー","清湯"],                id:"1",      menu:["武蔵らーめん","特製武蔵らーめん"] },
  { name:"風雲児",                   genre:"鶏白湯",  area:"代々木",    score:89.3, keywords:["鶏白湯","濃厚","クリーミー","代々木"],              id:"4",      menu:["鶏白湯らーめん","特製鶏白湯"] },
  { name:"一蘭",                     genre:"豚骨",    area:"渋谷",      score:86.2, keywords:["豚骨","一蘭","個室","半個室","天然とんこつ"],        id:"2",      menu:["天然とんこつラーメン"] },
  { name:"二郎 三田本店",            genre:"二郎系",  area:"三田",      score:83.0, keywords:["二郎","大","ニンニク","ヤサイ","アブラ","コール"],  id:"8",      menu:["ラーメン(小)","ラーメン(大)"] },
  { name:"博多一幸舎",               genre:"豚骨",    area:"博多",      score:85.7, keywords:["豚骨","博多","細麺","替え玉","白濁"],               id:"9",      menu:["博多ラーメン","替え玉"] },
  { name:"蔦",                       genre:"醤油",    area:"巣鴨",      score:90.8, keywords:["醤油","ミシュラン","高級","巣鴨"],                  id:"10",     menu:["特製醤油そば","特製塩そば"] },
  { name:"中華そば 青葉",            genre:"中華そば",area:"中野",      score:84.6, keywords:["中華","中野","昔ながら","ダブルスープ"],            id:"7",      menu:["中華そば","特製中華そば"] },
  { name:"麺処 井の庄",              genre:"煮干し",  area:"石神井公園",score:86.1, keywords:["煮干し","辛辛魚","いわし","ニボシ"],                id:"15",     menu:["辛辛魚らーめん","煮干しらーめん"] },
  { name:"塩らーめん 白月",          genre:"塩",      area:"池袋",      score:91.0, keywords:["塩","透明","白","池袋","鶏","あっさり"],            id:"3",      menu:["塩らーめん","特製塩らーめん"] },
  { name:"斑鳩",                     genre:"醤油",    area:"五反田",    score:87.0, keywords:["醤油","五反田","鶏油","こってり"],                  id:"12",     menu:["醤油らーめん","特製醤油"] },
  { name:"ほん田",                   genre:"醤油",    area:"東十条",    score:90.1, keywords:["醤油","清湯","東十条","黄金"],                      id:"18",     menu:["醤油ら～めん","塩ら～めん"] },
];

// ── Exifからタイムスタンプ取得 ────────────────────────────────
function extractExifDate(arrayBuffer) {
  try {
    const view = new DataView(arrayBuffer);
    if (view.getUint16(0) !== 0xFFD8) return null;
    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      if (marker === 0xFFE1) {
        const exifLen = view.getUint16(offset + 2);
        if (offset + 4 + exifLen > view.byteLength) break;
        const exifData = new DataView(arrayBuffer, offset + 4, exifLen - 2);
        if (exifData.byteLength < 14) break;
        const tiffOffset = 6;
        const littleEndian = exifData.getUint16(tiffOffset) === 0x4949;
        const ifdOffset = exifData.getUint32(tiffOffset + 4, littleEndian) + tiffOffset;
        if (ifdOffset + 2 > exifData.byteLength) break;
        const numEntries = exifData.getUint16(ifdOffset, littleEndian);
        for (let i = 0; i < numEntries; i++) {
          const entryOffset = ifdOffset + 2 + i * 12;
          if (entryOffset + 12 > exifData.byteLength) break;
          const tag = exifData.getUint16(entryOffset, littleEndian);
          if (tag === 0x9003 || tag === 0x0132) {
            const valOffset = exifData.getUint32(entryOffset + 8, littleEndian) + tiffOffset;
            if (valOffset + 19 > exifData.byteLength) break;
            let dateStr = "";
            for (let j = 0; j < 19; j++) {
              const c = exifData.getUint8(valOffset + j);
              if (c === 0) break;
              dateStr += String.fromCharCode(c);
            }
            const m = dateStr.match(/^(\d{4}):(\d{2}):(\d{2})/);
            if (m) return `${m[1]}-${m[2]}-${m[3]}`;
          }
        }
      }
      if (offset + 2 >= view.byteLength) break;
      const segLen = view.getUint16(offset + 2, false);
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
  } catch (_) {}
  return null;
}

// ── 画像の色特徴抽出（DataURL使用・ObjectURL不使用） ─────────
function analyzeImageFeatures(dataUrl) {
  return new Promise(resolve => {
    // タイムアウト保険（3秒で諦めてnullを返す）
    const timeout = setTimeout(() => resolve(null), 3000);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 16; canvas.height = 16; // さらに小さくして高速化
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let brownCount=0, whiteCount=0, darkCount=0;
        const pixels = 16*16;
        for (let i=0; i<data.length; i+=4) {
          if (data[i]>120 && data[i+1]>80 && data[i+1]<140 && data[i+2]<80)  brownCount++;
          if (data[i]>200 && data[i+1]>200 && data[i+2]>200)                  whiteCount++;
          if (data[i]<80  && data[i+1]<80  && data[i+2]<80)                   darkCount++;
        }
        resolve({ brownRatio:brownCount/pixels, whiteRatio:whiteCount/pixels, darkRatio:darkCount/pixels });
      } catch(_) { resolve(null); }
    };
    img.onerror = () => { clearTimeout(timeout); resolve(null); };
    img.src = dataUrl; // ObjectURLではなくDataURLを直接使用
  });
}

// ── 重複画像削除 ──────────────────────────────────────────────
function deduplicateImages(imageList) {
  const seen = new Set();
  return imageList.filter(img => { if (seen.has(img)) return false; seen.add(img); return true; });
}

// ── AI店舗マッチング ─────────────────────────────────────────
async function aiMatchShop(file, dataUrl, arrayBuffer, location) {
  const fileName = file.name.toLowerCase();
  // DataURLを直接渡す（URL.createObjectURL廃止）
  const features = await analyzeImageFeatures(dataUrl);

  const scored = RAMENDB_MASTER.map(shop => {
    let score = 0;
    const shopNorm = shop.name.replace(/\s/g,"").toLowerCase();
    if (fileName.includes(shopNorm)) score += 100;
    shop.keywords.forEach(kw => { if (fileName.includes(kw.toLowerCase())) score += 20; });
    if (features) {
      if (shop.genre === "塩"     && features.whiteRatio  > 0.3)  score += 30;
      if (shop.genre === "豚骨"   && features.whiteRatio  > 0.25) score += 25;
      if (shop.genre === "醤油"   && features.brownRatio  > 0.2)  score += 25;
      if (shop.genre === "二郎系" && features.darkRatio   > 0.15) score += 30;
      if (shop.genre === "煮干し" && features.darkRatio   > 0.1)  score += 20;
      if (shop.genre === "鶏白湯" && features.whiteRatio  > 0.35) score += 30;
    }
    if (location) {
      const areaMap = { "湯河原":["湯河原","神奈川"], "松戸":["松戸","千葉"], "博多":["博多","福岡"], "札幌":["札幌","北海道"] };
      const kws = areaMap[shop.area] || [shop.area];
      if (kws.some(kw => location.toLowerCase().includes(kw.toLowerCase()))) score += 50;
    }
    score += shop.score * 0.05;
    return { shop, score };
  });

  scored.sort((a,b) => b.score - a.score);
  const best = scored[0];

  if (best.score < 8) {
    let genre = "その他", emoji = "🍜";
    if (features) {
      if (features.whiteRatio  > 0.35) { genre = "塩";    emoji = "🌙"; }
      else if (features.brownRatio > 0.25) { genre = "醤油";  emoji = "🏆"; }
      else if (features.darkRatio  > 0.15) { genre = "二郎系";emoji = "💪"; }
    }
    return { shopName:"不明のラーメン店", genre, area:"", emoji, ramendbId:null, isUnknown:true, menuCandidates:[], confidence:0 };
  }

  const idx = RAMENDB_MASTER.indexOf(best.shop);
  const emojis = ["✨","🎯","🎌","🏆","☁️","🐷","💪","🔥","🌱","🌿","🎣","🌙","🦉","🍂"];
  return {
    shopName:      best.shop.name,
    genre:         best.shop.genre,
    area:          best.shop.area,
    emoji:         emojis[idx % emojis.length],
    ramendbId:     best.shop.id,
    confidence:    Math.min(Math.round(best.score), 99),
    menuCandidates:best.shop.menu,
    isUnknown:     false,
  };
}

// ── どんぶりスピナー ─────────────────────────────────────────
// ※ PostModalとは独立したコンポーネント（return で切り替えしない）
function RamenSpinner({ progress, total, shopName, t }) {
  const [frame, setFrame] = useState(0);
  const frames = ["🍜","🍛","🍲","🍥","🫕"];
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f+1) % frames.length), 180);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.88)", zIndex:300, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, borderRadius:"20px 20px 0 0" }}>
      <div style={{ fontSize:68, animation:"spin 0.5s linear infinite", marginBottom:18, filter:"drop-shadow(0 4px 12px rgba(192,57,43,0.5))" }}>
        {frames[frame]}
      </div>
      <div style={{ color:"white", fontWeight:700, fontSize:18, marginBottom:6, fontFamily:"Georgia,serif" }}>AI自動振分中...</div>
      {shopName && (
        <div style={{ color:"#FADBD8", fontSize:12, marginBottom:14, textAlign:"center", maxWidth:240 }}>
          🔍 「{shopName}」を確認中
        </div>
      )}
      <div style={{ width:220, height:5, background:"rgba(255,255,255,0.2)", borderRadius:3, overflow:"hidden", marginBottom:6 }}>
        <div style={{ height:"100%", background:"linear-gradient(90deg,#E74C3C,#FF6B6B)", width:`${total > 0 ? (progress/total)*100 : 0}%`, borderRadius:3, transition:"width 0.3s" }}/>
      </div>
      <div style={{ color:"rgba(255,255,255,0.6)", fontSize:12 }}>{progress} / {total} 枚処理中</div>
      <div style={{ marginTop:18, color:"rgba(255,255,255,0.35)", fontSize:11, textAlign:"center", maxWidth:260, lineHeight:1.7 }}>
        ラーメンDBと照合して<br/>自動でアルバムに振り分けています
      </div>
    </div>
  );
}

// ─── 記録モーダル（AI一括取込・白画面修正版） ─────────────────
function PostModal() {
  const { entries, setEntries, setShowPost, t } = useApp();
  // ローディングをモーダル内オーバーレイで表示（return切り替え廃止）
  const [aiLoading,    setAiLoading]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [totalFiles,   setTotalFiles]   = useState(0);
  const [currentShop,  setCurrentShop]  = useState("");
  const [result,       setResult]       = useState(null);
  const [location,     setLocation]     = useState(null);
  const [form, setForm] = useState({
    shopName:"", visitDate:new Date().toISOString().slice(0,10),
    rating:5, genre:"醤油", area:"", comment:""
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation(`${pos.coords.latitude.toFixed(3)},${pos.coords.longitude.toFixed(3)}`),
        () => {}
      );
    }
  }, []);

  const handleBulkUpload = async (ev) => {
    const files = Array.from(ev.target.files || []);
    ev.target.value = ""; // 同じファイルを再選択できるようリセット
    if (!files.length) return;

    setAiLoading(true);
    setProgress(0);
    setTotalFiles(files.length);
    setCurrentShop("");

    const workEntries = entries.map(ent => ({ ...ent, images: [...(ent.images||[])] }));
    const summary = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(i + 1);

      try {
        // DataURLとArrayBufferを並列取得
        const [dataUrl, arrayBuffer] = await Promise.all([
          readFileAsDataURL(file),
          readFileAsArrayBuffer(file),
        ]);

        const exifDate  = extractExifDate(arrayBuffer);
        const visitDate = exifDate
          || (file.lastModified ? new Date(file.lastModified).toISOString().slice(0,10) : null)
          || new Date().toISOString().slice(0,10);

        // AI店舗マッチング（DataURL渡し・ObjectURL廃止）
        const match = await aiMatchShop(file, dataUrl, arrayBuffer, location);
        setCurrentShop(match.shopName);

        const existing = workEntries.find(e => e.shopName === match.shopName);

        if (existing) {
          if (!existing.images.includes(dataUrl)) {
            existing.images = deduplicateImages([...existing.images, dataUrl]);
            summary.push({ shopName:match.shopName, action:"追加", date:visitDate });
          } else {
            summary.push({ shopName:match.shopName, action:"重複スキップ", date:visitDate });
          }
        } else {
          const hour = new Date(file.lastModified || Date.now()).getHours();
          const menuGuess = match.menuCandidates?.length
            ? match.menuCandidates[hour % match.menuCandidates.length]
            : "";
          workEntries.push({
            id:         `ai_${Date.now()}_${i}`,
            shopName:   match.shopName,
            genre:      match.genre,
            area:       match.area,
            emoji:      match.emoji || "🍜",
            images:     [dataUrl],
            visitDate,
            menu:       menuGuess,
            rating:     4,
            comment:    match.isUnknown
              ? "（AI判定：不明）"
              : `AI振分: ${match.shopName}（信頼度 ${match.confidence}%）`,
            ramendbId:  match.ramendbId,
            aiDetected: true,
            groupId:    "",
          });
          summary.push({ shopName:match.shopName, action:"新規作成", date:visitDate, menu:menuGuess, confidence:match.confidence });
        }
      } catch (err) {
        summary.push({ shopName:"エラー", action:"重複スキップ", date:"" });
      }

      // UIを1フレーム更新させる
      await new Promise(r => setTimeout(r, 50));
    }

    // 重複最終パス
    const finalEntries = workEntries.map(e => ({
      ...e, images: deduplicateImages(e.images || [])
    }));

    setEntries(finalEntries);
    setAiLoading(false);
    setResult(summary);
  };

  const handleManual = () => {
    if (!form.shopName.trim()) return;
    setEntries(p => [{ ...form, id:`m_${Date.now()}`, images:[], aiDetected:false }, ...p]);
    setShowPost(false);
  };

  const inp = {
    width:"100%", padding:"10px 12px", background:t.bg2,
    border:`1.5px solid ${t.br}`, borderRadius:9, fontSize:13,
    color:t.tx, outline:"none", boxSizing:"border-box", marginBottom:10
  };

  // ── 振分結果サマリー ────────────────────────────────────────
  if (result) {
    const newCount  = result.filter(r => r.action==="新規作成").length;
    const addCount  = result.filter(r => r.action==="追加").length;
    const skipCount = result.filter(r => r.action==="重複スキップ").length;
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
        <div style={{ background:t.card, width:"100%", maxWidth:480, borderRadius:"20px 20px 0 0", padding:"0 20px 32px", maxHeight:"80vh", overflowY:"auto" }}>
          <div style={{ width:36, height:4, background:t.br, borderRadius:2, margin:"12px auto 16px" }}/>
          <div style={{ textAlign:"center", marginBottom:16 }}>
            <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
            <div style={{ fontWeight:700, fontSize:18, color:t.tx }}>AI振分が完了しました</div>
            <div style={{ fontSize:12, color:t.txm, marginTop:4 }}>ラーメンDBと照合して自動振り分けしました</div>
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:16, justifyContent:"center" }}>
            {[["新規アルバム",newCount,t.acc],["追加",addCount,"#27ae60"],["スキップ",skipCount,t.txm]].map(([label,count,color]) => (
              <div key={label} style={{ textAlign:"center", background:t.bg2, borderRadius:12, padding:"10px 14px" }}>
                <div style={{ fontSize:18, fontWeight:700, color }}>{count}</div>
                <div style={{ fontSize:10, color:t.txm }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:16 }}>
            {result.map((r, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:t.bg2, borderRadius:10, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>{r.action==="新規作成"?"🆕":r.action==="追加"?"📸":"🔁"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:t.tx }}>{r.shopName}</div>
                  <div style={{ fontSize:11, color:t.txm }}>
                    {r.date}{r.menu?` · ${r.menu}`:""}{r.confidence?` · 信頼度${r.confidence}%`:""}
                  </div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:r.action==="新規作成"?t.acc:r.action==="追加"?"#27ae60":t.txm, background:t.card, borderRadius:8, padding:"2px 8px" }}>{r.action}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setShowPost(false)}
            style={{ width:"100%", padding:"13px", borderRadius:11, border:"none", background:t.grad, color:"white", fontWeight:700, fontSize:14, cursor:"pointer" }}>
            アルバムで確認する 📷
          </button>
        </div>
      </div>
    );
  }

  // ── 通常モーダル（スピナーはオーバーレイで重ねる） ──────────
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:t.card, width:"100%", maxWidth:480, borderRadius:"20px 20px 0 0", padding:"0 20px 32px", maxHeight:"85vh", overflowY:"auto", position:"relative" }}>

        {/* スピナーをモーダル内オーバーレイで表示（白画面にならない） */}
        {aiLoading && (
          <RamenSpinner progress={progress} total={totalFiles} shopName={currentShop} t={t}/>
        )}

        <div style={{ width:36, height:4, background:t.br, borderRadius:2, margin:"12px auto 16px" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ margin:0, color:t.tx }}>🍜 新規記録</h3>
          <button onClick={() => setShowPost(false)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:t.txm }}>✕</button>
        </div>

        {/* AI一括取込ボタン */}
        <label style={{ display:"block", padding:"16px 14px", background:t.grad, borderRadius:14, textAlign:"center", cursor: aiLoading ? "not-allowed":"pointer", marginBottom:16, opacity: aiLoading ? 0.5 : 1 }}>
          <div style={{ fontSize:28, marginBottom:4 }}>🍜</div>
          <div style={{ color:"white", fontWeight:700, fontSize:14, marginBottom:2 }}>
            {aiLoading ? "振分中..." : "画像を一括取込（AI自動振分）"}
          </div>
          <div style={{ color:"rgba(255,255,255,0.8)", fontSize:11 }}>複数枚選択可 · ラーメンDB照合 · 自動アルバム作成</div>
          <input type="file" multiple accept="image/*" hidden onChange={handleBulkUpload} disabled={aiLoading}/>
        </label>

        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <div style={{ flex:1, height:1, background:t.br }}/>
          <span style={{ fontSize:11, color:t.txm }}>または手動で記録</span>
          <div style={{ flex:1, height:1, background:t.br }}/>
        </div>

        {/* 手動入力フォーム */}
        <input style={inp} placeholder="店舗名 *" value={form.shopName} onChange={e => setForm(f=>({...f,shopName:e.target.value}))} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <input type="date" style={{ ...inp, marginBottom:0 }} value={form.visitDate} onChange={e => setForm(f=>({...f,visitDate:e.target.value}))} />
          <select style={{ ...inp, marginBottom:0 }} value={form.genre} onChange={e => setForm(f=>({...f,genre:e.target.value}))}>
            {["醤油","豚骨","塩","味噌","つけ麺","その他"].map(g=><option key={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:t.txm, marginBottom:4 }}>評価</div>
          <div style={{ display:"flex", gap:6 }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setForm(f=>({...f,rating:n}))}
                style={{ width:36, height:36, borderRadius:"50%", border:"none", background:form.rating>=n?"#E67E22":"#eee", color:form.rating>=n?"white":"#999", fontSize:18, cursor:"pointer" }}>★</button>
            ))}
          </div>
        </div>
        <textarea style={{ ...inp, minHeight:60, resize:"none" }} placeholder="コメント（任意）" value={form.comment} onChange={e => setForm(f=>({...f,comment:e.target.value}))} />
        <button onClick={handleManual}
          style={{ width:"100%", padding:"13px", borderRadius:11, border:"none", background:t.grad, color:"white", fontWeight:700, fontSize:14, cursor:"pointer" }}>
          記録する ✓
        </button>
      </div>
    </div>
  );
}

// ─── メインレイアウト ─────────────────────────────────────────
function MainLayout() {
  const { tab, setTab, showPost, setShowPost, t } = useApp();
  const TABS = [
    { label:"ホーム",    icon:"🏠", Page:HomePage       },
    { label:"おすすめ",  icon:"🔥", Page:RecommendPage  },
    { label:"マップ",    icon:"🗺️", Page:MapPage        },
    { label:"アルバム",  icon:"🖼️", Page:AlbumPage      },
    { label:"マイページ",icon:"👤", Page:MyPage         },
  ];
  const TAB_COUNT = TABS.length;

  // ── スワイプ状態 ──────────────────────────────────────────
  const touchStartX  = useRef(null);
  const touchStartY  = useRef(null);
  const mouseStartX  = useRef(null);
  const containerRef = useRef(null);
  const [dragging,  setDragging]  = useState(false);
  const [dragDelta, setDragDelta] = useState(0); // px（追従用）

  const SWIPE_THRESHOLD = 50;

  // コンテナ幅を取得してpx単位で translateX を計算
  const getContainerWidth = () =>
    containerRef.current ? containerRef.current.offsetWidth : window.innerWidth;

  const commitSwipe = (dx) => {
    setDragDelta(0);
    if      (dx < -SWIPE_THRESHOLD && tab < TAB_COUNT - 1) setTab(tab + 1);
    else if (dx >  SWIPE_THRESHOLD && tab > 0)             setTab(tab - 1);
    // それ以外はそのまま（バネで戻る）
  };

  // タッチ
  const onTouchStart = (e) => {
    if (showPost) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setDragging(false);
    setDragDelta(0);
  };
  const onTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!dragging && Math.abs(dy) > Math.abs(dx) * 1.5) return;
    if (Math.abs(dx) > 8) {
      setDragging(true);
      const bounded =
        (dx > 0 && tab === 0)             ? dx * 0.2 :
        (dx < 0 && tab === TAB_COUNT - 1) ? dx * 0.2 : dx;
      setDragDelta(bounded * 0.8);
    }
  };
  const onTouchEnd = (e) => {
    if (!dragging) { touchStartX.current = null; return; }
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    setDragging(false);
    commitSwipe(dx);
  };

  // マウス（PCデバッグ用）
  const onMouseDown = (e) => {
    if (showPost) return;
    mouseStartX.current = e.clientX;
    setDragging(false);
    setDragDelta(0);
  };
  const onMouseMove = (e) => {
    if (mouseStartX.current === null) return;
    const dx = e.clientX - mouseStartX.current;
    if (Math.abs(dx) > 8) {
      setDragging(true);
      const bounded =
        (dx > 0 && tab === 0)             ? dx * 0.2 :
        (dx < 0 && tab === TAB_COUNT - 1) ? dx * 0.2 : dx;
      setDragDelta(bounded * 0.8);
    }
  };
  const onMouseUp = (e) => {
    if (mouseStartX.current === null) return;
    const dx = e.clientX - mouseStartX.current;
    mouseStartX.current = null;
    if (!dragging) return;
    setDragging(false);
    commitSwipe(dx);
  };
  const onMouseLeave = () => {
    if (mouseStartX.current !== null) {
      mouseStartX.current = null;
      setDragging(false);
      setDragDelta(0);
    }
  };

  // ── translateX: コンテナ幅(px) × tab 分だけ左にずらす ──────
  // コンテナ幅 = 画面幅、各子要素も幅=コンテナ幅 なので px 計算が正確
  const [containerW, setContainerW] = useState(0);
  useEffect(() => {
    const update = () => setContainerW(getContainerWidth());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ベース位置(px) + ドラッグオフセット(px)
  const baseX      = -(tab * containerW);
  const transformX = baseX + dragDelta;

  return (
    <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", fontFamily:"'Noto Sans JP',system-ui,sans-serif", background:t.bg, overflow:"hidden" }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{-webkit-tap-highlight-color:transparent}
      `}</style>

      {/* ヘッダー */}
      <div style={{ flexShrink:0, height:48, display:"flex", alignItems:"center", justifyContent:"center", background:t.bg, borderBottom:`1px solid ${t.br}`, position:"relative", zIndex:10 }}>
        <MenLogLogo size={20} />
        <button onClick={() => setShowPost(true)}
          style={{ position:"absolute", right:12, background:t.grad, border:"none", borderRadius:8, padding:"5px 13px", color:"white", fontSize:11, fontWeight:700, cursor:"pointer" }}>
          ＋ 記録
        </button>
      </div>

      {/* ── スワイプコンテナ ── */}
      <div
        ref={containerRef}
        style={{ flex:1, minHeight:0, overflow:"hidden", position:"relative", cursor:dragging?"grabbing":"default" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {/* 全タブを px 幅で横並び */}
        <div style={{
          display: "flex",
          height:  "100%",
          width:   `${TAB_COUNT * 100}%`,   // 例: 5タブ → 500%（画面幅基準でなくコンテナ幅基準）
          transform: `translateX(${transformX}px)`,
          transition: dragging ? "none" : "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          willChange: "transform",
          userSelect: "none",
        }}>
          {TABS.map(({ Page }, i) => (
            <div key={i} style={{
              // 各タブ = コンテナ幅ぴったり（= 100vw相当）
              width:    `${containerW}px`,
              height:   "100%",
              overflow: "hidden",
              flexShrink: 0,
            }}>
              <Page />
            </div>
          ))}
        </div>

        {/* スワイプヒント */}
        <SwipeHint t={t} />
      </div>

      {/* モーダル */}
      {showPost && <PostModal />}

      {/* フッターナビ */}
      <div style={{ flexShrink:0, display:"flex", background:t.card, borderTop:`1px solid ${t.br}`, boxShadow:`0 -3px 12px ${t.sh}`, zIndex:10 }}>
        {TABS.map((it, i) => (
          <button key={i} onClick={() => { setTab(i); setDragDelta(0); }}
            style={{ flex:1, border:"none", background:"none", color:tab===i?t.acc:t.txm, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, padding:"8px 2px", minHeight:52, fontSize:9, fontWeight:tab===i?700:400, transition:"color 0.2s" }}>
            <span style={{ fontSize:tab===i?20:17, transition:"font-size 0.2s" }}>{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
        <button onClick={() => setShowPost(true)}
          style={{ flex:1, border:"none", background:"none", color:t.acc, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, padding:"8px 2px", minHeight:52, fontSize:9, fontWeight:700 }}>
          <span style={{ fontSize:20 }}>➕</span>
          <span>記録</span>
        </button>
      </div>

      {/* ページドットインジケーター */}
      <div style={{ position:"absolute", bottom:60, left:"50%", transform:"translateX(-50%)", display:"flex", gap:4, zIndex:9, pointerEvents:"none" }}>
        {TABS.map((_, i) => (
          <div key={i} style={{
            width: i===tab ? 14 : 4, height:4, borderRadius:2,
            background: i===tab ? t.acc : t.br,
            transition:"all 0.28s cubic-bezier(0.4,0,0.2,1)",
          }}/>
        ))}
      </div>
    </div>
  );
}

// ── 初回スワイプヒント ────────────────────────────────────────
function SwipeHint({ t }) {
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);
  useEffect(() => {
    if (shownRef.current) return;
    const t1 = setTimeout(() => { shownRef.current = true; setVisible(true); }, 1500);
    const t2 = setTimeout(() => setVisible(false), 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (!visible) return null;
  return (
    <div style={{
      position:"absolute", bottom:20, left:"50%", transform:"translateX(-50%)",
      background:"rgba(0,0,0,0.65)", color:"white", fontSize:11, fontWeight:600,
      borderRadius:20, padding:"6px 16px", whiteSpace:"nowrap",
      display:"flex", alignItems:"center", gap:6, pointerEvents:"none", zIndex:20,
    }}>
      👈 スワイプでページ切替 👉
    </div>
  );
}

export default function App() {
  return <Provider><MainLayout /></Provider>;
}
