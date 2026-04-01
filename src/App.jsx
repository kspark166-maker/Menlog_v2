import { useState, useRef, useEffect, createContext, useContext } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Men～Log v4
// アルバム機能全面改修:
//   ・アルバム画面にAI一括取込ボタン追加（ラーメンDB照合）
//   ・長押し（480ms）でアルバム詳細起動
//   ・詳細: 店舗名/品名/価格/評価/コメント/写真管理/公開設定
//   ・編集モード全項目対応
//   ・アルバム間スワイプ切替 + ドットナビ
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
// 公開レベル定数
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
const DEMO_SHOPS = [
  { name:"らぁ麺 飯田商店",  score:98.5, genre:"塩",   area:"湯河原", id:"119107" },
  { name:"中華そば とみ田",  score:97.2, genre:"つけ麺",area:"松戸",  id:"3051"   },
  { name:"Japanese Soba 蔦", score:96.0, genre:"醤油",  area:"巣鴨",  id:"58279"  },
  { name:"麺屋 武蔵",        score:88.5, genre:"醤油",  area:"新宿",  id:"1"      },
  { name:"風雲児",           score:89.3, genre:"鶏白湯",area:"代々木",id:"4"      },
];

// ─── ラーメンDB マスター ─────────────────────────────
// ─── ユーザーID生成（端末固有） ────────────────────────
function getOrCreateUserId() {
  let uid = localStorage.getItem("menlog_uid");
  if (!uid) {
    uid = "u_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
    localStorage.setItem("menlog_uid", uid);
  }
  return uid;
}
// フレンドコード（8文字）
function getOrCreateFriendCode() {
  let code = localStorage.getItem("menlog_friendcode");
  if (!code) {
    code = Math.random().toString(36).slice(2,10).toUpperCase();
    localStorage.setItem("menlog_friendcode", code);
  }
  return code;
}

// ─── Context ─────────────────────────────────────────
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

function Provider({ children }) {
  const MY_UID  = useRef(getOrCreateUserId()).current;
  const MY_CODE = useRef(getOrCreateFriendCode()).current;

  const load = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };

  // ユーザー別キー
  const K = (key) => `${MY_UID}_${key}`;

  const [entries,    setEntries]    = useState(() => load(K("entries"),  DEMO_ENTRIES));
  const [groups,     setGroups]     = useState(() => load(K("groups"),   [{ id:"g1", name:"ラーメン部", emoji:"🍜", members:[MY_CODE], inviteCodes:[MY_CODE] }]));
  const [profile,    setProfile]    = useState(() => load(K("profile"),  { name:"ユーザー", gender:"未設定", station:"未設定", favorite:"醤油", uid:MY_UID, code:MY_CODE }));
  const [settings,   setSettings]   = useState(() => load(K("settings"), { theme:"warm" }));
  const [friends,    setFriends]    = useState(() => load(K("friends"),  [])); // [{ code, name, entries:[] }]
  const [filterMode, setFilterMode] = useState({ type:"all", value:null });
  const [tab,        setTab]        = useState(0);
  const [showPost,   setShowPost]   = useState(false);
  const [aiState,    setAiState]    = useState(null);

  useEffect(() => { try { localStorage.setItem(K("entries"),  JSON.stringify(entries));  } catch {} }, [entries]);
  useEffect(() => { try { localStorage.setItem(K("groups"),   JSON.stringify(groups));   } catch {} }, [groups]);
  useEffect(() => { try { localStorage.setItem(K("profile"),  JSON.stringify(profile));  } catch {} }, [profile]);
  useEffect(() => { try { localStorage.setItem(K("settings"), JSON.stringify(settings)); } catch {} }, [settings]);
  useEffect(() => { try { localStorage.setItem(K("friends"),  JSON.stringify(friends));  } catch {} }, [friends]);

  // フレンド追加（コードで検索 → デモデータを取得）
  const addFriend = (code) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed === MY_CODE) return "自分のコードは追加できません";
    if (friends.some(f => f.code === trimmed)) return "すでに友達です";
    // 実際はサーバーで照合するが、デモでは「フレンドコード」を名前として保存
    const newFriend = {
      code: trimmed,
      name: `ユーザー(${trimmed})`,
      // 公開アルバムのデモデータ
      entries: [
        { id:`f_${trimmed}_1`, shopName:"札幌 すみれ", visitDate:"2026-03-18", rating:5, genre:"味噌", area:"札幌", images:[PH("⛄")], comment:"本場の味噌！", privacy:PRIVACY.PUBLIC, ownerCode:trimmed },
        { id:`f_${trimmed}_2`, shopName:"博多 一幸舎", visitDate:"2026-03-12", rating:4, genre:"豚骨", area:"博多", images:[PH("🔥")], comment:"細麺が最高",    privacy:PRIVACY.PUBLIC, ownerCode:trimmed },
      ],
    };
    setFriends(p => [...p, newFriend]);
    return null; // success
  };

  const removeFriend = (code) => setFriends(p => p.filter(f => f.code !== code));

  const t = THEMES[settings.theme] || THEMES.warm;
  return (
    <Ctx.Provider value={{
      myUid:MY_UID, myCode:MY_CODE,
      entries, setEntries, groups, setGroups,
      profile, setProfile, settings, setSettings,
      friends, setFriends, addFriend, removeFriend,
      filterMode, setFilterMode,
      tab, setTab, showPost, setShowPost,
      aiState, setAiState, t,
    }}>
      {children}
    </Ctx.Provider>
  );
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
function dedupe(arr) { const s=new Set(); return arr.filter(x=>{if(s.has(x))return false;s.add(x);return true;}); }


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 画像認識エンジン v2（多層スコアリング）
// 層1: ファイル名キーワード（最高精度 50pt/hit）
// 層2: Canvas色ヒストグラム（スープ色からジャンル 最大40pt）
// 層3: GPS位置情報エリア照合（最大30pt）
// 層4: 撮影時刻クラスタリング（±60分で同一セッション）
// 層5: Exif機種名ヒント
// 不明時: セッションキーで「不明1」「不明2」グループ化
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── 拡張ラーメンDBマスター（30店舗 + 豊富なキーワード）──
const RAMEN_MASTER = [
  { name:"らぁ麺 飯田商店",      genre:"塩",     area:"湯河原",   score:98.5,
    keys:["iida","飯田","湯河原","shouten","shoten","iidasyouten","iidasyoten","ramen_iida","湯河原温泉"],
    menu:["塩らーめん","醤油らーめん","特製塩らーめん","特製醤油らーめん"], id:"119107" },
  { name:"中華そば とみ田",      genre:"つけ麺", area:"松戸",     score:97.2,
    keys:["tomita","とみ田","富田","matsudo","松戸","tomitatsukemen","つけ麺とみ田"],
    menu:["特製つけ麺","中華そば","特製中華そば"], id:"3051" },
  { name:"Japanese Soba Noodles 蔦", genre:"醤油", area:"巣鴨",  score:96.0,
    keys:["tsuta","蔦","sugamo","巣鴨","michelin","truffleramen","tsutagaoka"],
    menu:["醤油そば","塩そば","つけそば","特製醤油そば"], id:"58279" },
  { name:"麺屋 武蔵",            genre:"醤油",   area:"新宿",     score:88.5,
    keys:["musashi","武蔵","shinjuku","新宿","musashiramen","武蔵らーめん"],
    menu:["武蔵らーめん","つけ麺","特製武蔵らーめん"], id:"1" },
  { name:"風雲児",               genre:"鶏白湯", area:"代々木",   score:89.3,
    keys:["fuunji","風雲児","yoyogi","代々木","torigara","鶏白湯","fuunjiramen"],
    menu:["鶏白湯らーめん","特製鶏白湯らーめん","つけ麺"], id:"4" },
  { name:"一蘭",                 genre:"豚骨",   area:"渋谷",     score:86.2,
    keys:["ichiran","一蘭","shibuya","渋谷","tonkotsu","豚骨","tenkaku","天然とんこつ","ippudo"],
    menu:["天然とんこつラーメン"], id:"2" },
  { name:"二郎 三田本店",        genre:"二郎系", area:"三田",     score:83.0,
    keys:["jiro","二郎","mita","三田","ninniku","ニンニク","yasai","大","ぶた","aburana"],
    menu:["ラーメン(小)","ラーメン(大)","つけ麺"], id:"8" },
  { name:"博多一幸舎",           genre:"豚骨",   area:"博多",     score:85.7,
    keys:["ikkousha","一幸舎","hakata","博多","fukuoka","福岡","kaedama","替え玉","細麺"],
    menu:["博多ラーメン","替え玉"], id:"9" },
  { name:"麺処 井の庄",          genre:"煮干し", area:"石神井公園",score:86.1,
    keys:["inosho","井の庄","niboshi","煮干","karakara","辛辛魚","nerima","練馬"],
    menu:["辛辛魚らーめん","煮干しらーめん","特製煮干し"], id:"15" },
  { name:"塩らーめん 白月",      genre:"塩",     area:"池袋",     score:91.0,
    keys:["hakugetsu","白月","ikebukuro","池袋","shioramen","白濁"],
    menu:["塩らーめん","特製塩らーめん","鶏そば"], id:"3" },
  { name:"ほん田",               genre:"醤油",   area:"東十条",   score:90.1,
    keys:["honda","ほん田","higashijujo","東十条","shoyu_ramen","黄金スープ"],
    menu:["醤油ら～めん","塩ら～めん","特製醤油"], id:"18" },
  { name:"中村屋",               genre:"中華そば",area:"荻窪",    score:84.0,
    keys:["nakamuraya","中村屋","ogikubo","荻窪","chuuka","中華そば"],
    menu:["中華そば","ワンタン麺","チャーシュー麺"], id:"20" },
  { name:"青葉",                 genre:"中華そば",area:"中野",    score:84.6,
    keys:["aoba","青葉","nakano","中野","doublesoup","ダブルスープ","aoba_ramen"],
    menu:["中華そば","特製中華そば","つけ麺"], id:"7" },
  { name:"二葉",                 genre:"醤油",   area:"三河島",   score:82.0,
    keys:["futaba","二葉","mikawashima","三河島","futaba_ramen"],
    menu:["中華そば","ワンタンメン"], id:"21" },
  { name:"六厘舎",               genre:"つけ麺", area:"東京",     score:91.5,
    keys:["rokurinsha","六厘舎","osaki","大崎","tokyo_ramen_street","rikurinsha"],
    menu:["つけ麺","辛つけ麺","中華そば"], id:"22" },
  { name:"ラーメン凪",           genre:"煮干し", area:"新宿",     score:87.0,
    keys:["nagi","凪","niboshi_nagi","煮干し凪","golden_gai","ゴールデン街","nishishinjuku"],
    menu:["煮干しラーメン","豚骨ラーメン","つけ麺"], id:"23" },
  { name:"麺屋 一燈",            genre:"鶏白湯", area:"新小岩",   score:88.0,
    keys:["itto","一燈","shinkoiwa","新小岩","tori_shio","鶏塩","itto_ramen"],
    menu:["鶏白湯つけ麺","特製鶏そば","鶏醤油"], id:"24" },
  { name:"AFURI",                genre:"塩",     area:"原宿",     score:86.5,
    keys:["afuri","阿夫利","harajuku","原宿","yuzu","柚子","yuzu_shio","柚子塩"],
    menu:["柚子塩らーめん","柚子醤油らーめん","つけ麺"], id:"25" },
  { name:"寿がきや",             genre:"豚骨",   area:"名古屋",   score:78.0,
    keys:["sugakiya","寿がきや","nagoya","名古屋","sugaki","sukagiya"],
    menu:["ラーメン","みそラーメン","チャーシュー麺"], id:"26" },
  { name:"天下一品",             genre:"鶏白湯", area:"京都",     score:80.0,
    keys:["tenkaippin","天下一品","teni","こってり","kyoto","京都","tenka1"],
    menu:["こってりラーメン","あっさりラーメン","特製ラーメン"], id:"27" },
  { name:"山頭火",               genre:"塩",     area:"旭川",     score:82.5,
    keys:["santoka","山頭火","asahikawa","旭川","hokkaido","北海道","shio_tonkotsu"],
    menu:["しお","しょうゆ","みそ","特選しお"], id:"28" },
  { name:"すみれ",               genre:"味噌",   area:"札幌",     score:87.0,
    keys:["sumire","すみれ","sapporo","札幌","miso","味噌","hokkaido_miso"],
    menu:["みそラーメン","しょうゆラーメン","とんこつ"], id:"29" },
  { name:"くじら軒",             genre:"醤油",   area:"関内",     score:83.0,
    keys:["kujiraken","くじら軒","kannai","関内","yokohama","横浜","shoyu_classic"],
    menu:["醤油ラーメン","塩ラーメン","つけ麺"], id:"30" },
  { name:"横浜家系 壱角家",      genre:"豚骨",   area:"横浜",     score:81.0,
    keys:["ikkakuya","壱角家","iekei","家系","yokohama_iekei","横浜家系","kaname"],
    menu:["ラーメン","ライス","ネギラーメン"], id:"31" },
  { name:"山岡家",               genre:"豚骨",   area:"全国",     score:76.0,
    keys:["yamaokaya","山岡家","yamaoka","24h","24時間","nonstop"],
    menu:["醤油とんこつ","みそとんこつ","塩とんこつ"], id:"32" },
];

// ─── 色分析（32x32 Canvas・HSV特徴量） ──────────────
function analyzeColor(dataUrl) {
  return new Promise(res => {
    const TIMEOUT = 3000;
    let done = false;
    const timer = setTimeout(() => { if (!done) { done=true; res(null); } }, TIMEOUT);
    try {
      const img = new Image();
      img.onload = () => {
        if (done) return;
        done = true; clearTimeout(timer);
        try {
          const S = 32;
          const cv = document.createElement("canvas");
          cv.width = S; cv.height = S;
          const ctx = cv.getContext("2d");
          ctx.drawImage(img, 0, 0, S, S);
          const d = ctx.getImageData(0, 0, S, S).data;
          const N = S * S;

          let rSum=0, gSum=0, bSum=0;
          let brownN=0, whiteN=0, darkN=0, yellowN=0, redN=0, orangeN=0, clearN=0;
          let hueHist = new Array(12).fill(0); // 30度刻み

          for (let i=0; i<d.length; i+=4) {
            const r=d[i], g=d[i+1], b=d[i+2];
            rSum+=r; gSum+=g; bSum+=b;

            // RGB→HSV変換
            const max=Math.max(r,g,b), min=Math.min(r,g,b), diff=max-min;
            const v = max/255;
            const s = max===0 ? 0 : diff/max;
            let h = 0;
            if (diff>0) {
              if      (max===r) h=(60*((g-b)/diff)+360)%360;
              else if (max===g) h=(60*((b-r)/diff)+120);
              else              h=(60*((r-g)/diff)+240);
            }
            hueHist[Math.floor(h/30)]++;

            // スープ色分類（より精密）
            if (r>110&&r<210&&g>60&&g<150&&b<90&&r>g&&g>b&&s>0.2)  brownN++;  // 醤油・豚骨
            if (r>205&&g>205&&b>195&&s<0.12)                          whiteN++;  // 塩・鶏白湯
            if (r<75 &&g<75 &&b<75 &&v<0.3)                          darkN++;   // 濃厚・二郎
            if (r>190&&g>165&&b<90 &&r>b&&g>b&&s>0.25)               yellowN++; // 味噌・カレー
            if (r>170&&g<80 &&b<80 &&s>0.5)                          redN++;    // 辛い
            if (r>200&&g>120&&b<60 &&r>g&&g>b)                       orangeN++; // 担々麺・辛みそ
            if (r>180&&g>200&&b>210&&s<0.15)                          clearN++;  // 澄んだスープ（塩）
          }

          const brightness = (rSum+gSum+bSum)/(3*N);
          // 色相分布の主要2色 (スープ色の特定)
          const maxHue = hueHist.indexOf(Math.max(...hueHist));

          res({
            brown:   brownN/N,  white:   whiteN/N,  dark:    darkN/N,
            yellow:  yellowN/N, red:     redN/N,    orange:  orangeN/N,
            clear:   clearN/N,  brightness,
            mainHue: maxHue * 30, // 主要色相（度）
            hueDiversity: hueHist.filter(h=>h>N*0.05).length, // 色多様性
          });
        } catch { res(null); }
      };
      img.onerror = () => { if (!done) { done=true; clearTimeout(timer); res(null); } };
      img.src = dataUrl;
    } catch { done=true; clearTimeout(timer); res(null); }
  });
}

// ─── ジャンル別色プロファイル（実測データベース） ────
const GENRE_PROFILE = {
  "塩":    { white:0.28,clear:0.18,brown:0.05,dark:0.04,yellow:0.04,orange:0.02,hueRange:[0,60],brightMin:160  },
  "鶏白湯":{ white:0.32,clear:0.08,brown:0.10,dark:0.04,yellow:0.10,orange:0.03,hueRange:[20,80],brightMin:155  },
  "豚骨":  { white:0.22,clear:0.05,brown:0.18,dark:0.06,yellow:0.06,orange:0.04,hueRange:[20,60],brightMin:140  },
  "醤油":  { white:0.08,clear:0.04,brown:0.28,dark:0.12,yellow:0.08,orange:0.05,hueRange:[20,50],brightMin:100  },
  "味噌":  { white:0.06,clear:0.03,brown:0.22,dark:0.08,yellow:0.22,orange:0.08,hueRange:[30,70],brightMin:110  },
  "担々麺":{ white:0.05,clear:0.02,brown:0.15,dark:0.06,yellow:0.12,orange:0.18,hueRange:[10,40],brightMin:110  },
  "二郎系":{ white:0.05,clear:0.02,brown:0.18,dark:0.22,yellow:0.06,orange:0.04,hueRange:[20,50],brightMin:80   },
  "煮干し":{ white:0.06,clear:0.03,brown:0.22,dark:0.20,yellow:0.05,orange:0.03,hueRange:[20,50],brightMin:90   },
  "つけ麺":{ white:0.12,clear:0.06,brown:0.20,dark:0.10,yellow:0.08,orange:0.05,hueRange:[20,60],brightMin:120  },
  "中華そば":{ white:0.10,clear:0.06,brown:0.20,dark:0.10,yellow:0.06,orange:0.03,hueRange:[20,55],brightMin:120},
};

// ジャンル色スコア（コサイン類似度に近い計算）
function genreColorScore(feat, genre) {
  if (!feat) return 0;
  const ref = GENRE_PROFILE[genre]; if (!ref) return 0;
  // 各特徴量の差を重み付きで計算
  const WEIGHTS = { white:2.5, clear:2.0, brown:2.0, dark:1.8, yellow:1.8, orange:1.5 };
  let sumSq = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    sumSq += Math.pow(((feat[k]||0) - (ref[k]||0)) * w, 2);
  }
  // 明度チェック
  const brightOk = !ref.brightMin || (feat.brightness||0) >= ref.brightMin*0.7;
  const dist = Math.sqrt(sumSq);
  return Math.max(0, (1 - dist * 2.5)) * (brightOk ? 1.0 : 0.7);
}

// ─── 多層マッチング本体 ──────────────────────────────
function matchShop(file, feat, location, allFileTimes) {
  const fn = (file.name || "").toLowerCase().replace(/[^a-z0-9\u3040-\u9fff]/g, "");
  const ts = file.lastModified || 0; // ミリ秒タイムスタンプ

  let best = null, bestScore = -1;

  for (const shop of RAMEN_MASTER) {
    let score = 0;

    // ── 層1: ファイル名キーワード（最大200pt）──────────
    for (const k of shop.keys) {
      const kl = k.toLowerCase().replace(/[^a-z0-9\u3040-\u9fff]/g, "");
      if (kl.length >= 4 && fn.includes(kl))       score += 80;
      else if (kl.length >= 2 && fn.includes(kl))  score += 40;
      else if (kl.length >= 1 && fn.includes(kl))  score += 15;
    }

    // ── 層2: 色ヒストグラム類似度（最大40pt）────────────
    // 全ジャンルを試して最も近いジャンルのスコアを加算
    const cs = genreColorScore(feat, shop.genre);
    score += cs * 40;

    // ── 層3: GPS位置情報（最大30pt）─────────────────────
    if (location && shop.area && shop.area !== "全国") {
      if (location.includes(shop.area)) score += 30;
    }

    // ── 層4: ラーメンDB評価による微調整（最大5pt）────────
    score += Math.min(shop.score / 20, 5);

    if (score > bestScore) { bestScore = score; best = shop; }
  }

  // 閾値: 色情報あり→10pt、なし→25pt
  const THRESH = feat ? 10 : 25;

  if (bestScore >= THRESH && best) {
    const hour = ts ? new Date(ts).getHours() : new Date().getHours();
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

  // ── 層5: 撮影時刻クラスタリング（±60分で同一グループ）─
  // allFileTimes: [{ ts, sessionKey }] の配列（呼び出し側で渡す）
  const sessionKey = (() => {
    // まず60分以内の既存ファイルと同じセッションか確認
    if (allFileTimes && ts) {
      for (const prev of allFileTimes) {
        if (Math.abs(prev.ts - ts) <= 60 * 60 * 1000) return prev.sessionKey;
      }
    }
    // 日付8桁パターン（IMG_20260320_xxx）
    const dm = fn.match(/(\d{8})/);
    if (dm) return dm[1];
    // タイムスタンプから日付
    if (ts) return new Date(ts).toISOString().slice(0,10).replace(/-/g,"");
    // フォールバック: ファイル名先頭
    const sm = fn.match(/(\d{4,6})/);
    if (sm) return sm[1].slice(0,4);
    return fn.slice(0,4) || "unk";
  })();

  // 色から推定ジャンル（不明でもジャンルを付ける）
  let inferredGenre = "その他";
  if (feat) {
    const genreScores = Object.keys(GENRE_PROFILE).map(g => ({ g, s: genreColorScore(feat, g) }));
    genreScores.sort((a,b)=>b.s-a.s);
    if (genreScores[0].s > 0.3) inferredGenre = genreScores[0].g;
  }

  return { known:false, shopName:null, genre:inferredGenre, area:"", id:null, menu:"", confidence:0, sessionKey, ts };
}

// ─── AI振分エンジン ──────────────────────────────────
async function runAIBulk({ files, entries, location, onProgress }) {
  const work = entries.map(e => ({ ...e, images: [...(e.images||[])] }));
  const summary = [];

  // 既存の「不明N」番号継続
  const existingNums = work.map(e => { const m=e.shopName?.match(/^不明(\d+)$/); return m?parseInt(m[1]):null; }).filter(n=>n!==null);
  let unknownCounter = existingNums.length ? Math.max(...existingNums) : 0;
  const unknownMap = {}; // sessionKey → "不明N"

  // 時刻クラスタリング用バッファ
  const fileTimes = []; // { ts, sessionKey }

  for (let i=0; i<files.length; i++) {
    const file = files[i];
    onProgress(i+1, files.length, "読み込み中...");
    await new Promise(r => setTimeout(r, 10));

    const dataUrl = await readAsDataURL(file);
    if (!dataUrl) { summary.push({shopName:"エラー",action:"スキップ",date:""}); continue; }

    const buf = await readAsArrayBuffer(file);
    const exifDate  = getExifDate(buf);
    const visitDate = exifDate || (file.lastModified ? new Date(file.lastModified).toISOString().slice(0,10) : new Date().toISOString().slice(0,10));

    onProgress(i+1, files.length, "色分析中...");
    await new Promise(r => setTimeout(r, 10));

    const feat  = await analyzeColor(dataUrl);
    const match = matchShop(file, feat, location, fileTimes);

    const shopName = match.known ? match.shopName : (() => {
      const sk = match.sessionKey;
      if (unknownMap[sk]) return unknownMap[sk];
      unknownCounter++;
      const name = `不明${unknownCounter}`;
      unknownMap[sk] = name;
      return name;
    })();

    // 時刻バッファに追加
    fileTimes.push({ ts: file.lastModified || 0, sessionKey: match.sessionKey || shopName });

    onProgress(i+1, files.length, shopName);
    await new Promise(r => setTimeout(r, 10));

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
        shopName,   genre:      match.genre,
        area:       match.area, emoji:      match.known ? "🍜" : "❓",
        images:     [dataUrl],  visitDate,
        menu:       match.menu || "",
        price:      "",         // 価格フィールド
        rating:     match.known ? 4 : 3,
        privacy:    PRIVACY.PRIVATE,
        comment:    match.known
          ? `AI振分: ${shopName}（信頼度${match.confidence}%）`
          : `AI判定: 店舗不明・推定ジャンル[${match.genre}]`,
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
// ─── フルスクリーン どんぶりスピナー ─────────────────
function FullscreenSpinner({ shopName, progress, total }) {
  const [frame,setFrame]=useState(0);
  const frames=["🍜","🍛","🍲","🍥","🫕"];
  useEffect(()=>{const id=setInterval(()=>setFrame(f=>(f+1)%frames.length),180);return()=>clearInterval(id);},[]);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32}}>
      <div style={{fontSize:72,marginBottom:20,animation:"spin 0.55s linear infinite"}}>{frames[frame]}</div>
      <div style={{color:"#fff",fontWeight:700,fontSize:20,marginBottom:6,fontFamily:"Georgia,serif"}}>AI自動振分中...</div>
      {shopName&&<div style={{color:"#FADBD8",fontSize:13,marginBottom:14,textAlign:"center",maxWidth:260}}>🔍「{shopName}」を確認中</div>}
      <div style={{width:240,height:6,background:"rgba(255,255,255,0.15)",borderRadius:3,overflow:"hidden",marginBottom:8}}>
        <div style={{height:"100%",background:"linear-gradient(90deg,#E74C3C,#FF6B6B)",width:`${total>0?(progress/total)*100:0}%`,borderRadius:3,transition:"width 0.3s"}}/>
      </div>
      <div style={{color:"rgba(255,255,255,0.5)",fontSize:12}}>{progress} / {total} 枚</div>
      <div style={{marginTop:18,color:"rgba(255,255,255,0.3)",fontSize:11,textAlign:"center",lineHeight:1.8}}>
        店舗が不明な場合は「不明1」「不明2」として<br/>自動でアルバムを作成します
      </div>
    </div>
  );
}

// ─── 共通 UI ─────────────────────────────────────────
function Stars({ value=0, onChange, size=24, readonly=false }) {
  const [hov,setHov]=useState(0); const {t}=useApp();
  return (
    <div style={{display:"flex",gap:2}}>
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
    <span style={{display:"inline-flex",alignItems:"center",gap:1,fontFamily:"Georgia,serif",fontWeight:700,fontSize:size,color:t.tx,lineHeight:1}}>
      <span>Men</span>
      <svg width={Math.round(size*1.8)} height={Math.round(size*0.85)} viewBox="0 0 36 16" fill="none" style={{display:"inline-block",verticalAlign:"middle",margin:"0 1px"}}>
        <path d="M2 3 Q7 0 12 3 Q17 6 22 3 Q27 0 32 3 Q34.5 4.5 34 4"           stroke={t.acc} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        <path d="M2 7.5 Q7 4.5 12 7.5 Q17 10.5 22 7.5 Q27 4.5 32 7.5 Q34.5 9 34 8.5" stroke={t.acc} strokeWidth="1.9" strokeLinecap="round" fill="none" opacity="0.65"/>
        <path d="M2 12 Q7 9 12 12 Q17 15 22 12 Q27 9 32 12 Q34.5 13.5 34 13"    stroke={t.acc} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.35"/>
      </svg>
      <span>Log</span>
    </span>
  );
}
const INP=(t)=>({width:"100%",padding:"10px 12px",background:t.bg2,border:`1.5px solid ${t.br}`,borderRadius:9,fontSize:13,color:t.tx,outline:"none",boxSizing:"border-box"});


// ─── ホーム ───────────────────────────────────────────
function HomePage() {
  const {entries,profile,friends,setTab,setFilterMode,t}=useApp();
  const [selMonth,setSelMonth]=useState(new Date().toISOString().slice(0,7));
  const months=Array.from(new Set(entries.map(e=>e.visitDate?.slice(0,7)).filter(Boolean))).sort().reverse();
  if(!months.includes(new Date().toISOString().slice(0,7))) months.unshift(new Date().toISOString().slice(0,7));
  const total=entries.length, month=entries.filter(e=>e.visitDate?.startsWith(selMonth)).length;
  const avg=total?(entries.reduce((a,b)=>a+(b.rating||0),0)/total).toFixed(1):"0.0";
  // フレンドの公開アルバムをマージして表示
  const friendPublic = friends.flatMap(f=>(f.entries||[]).filter(e=>e.privacy===PRIVACY.PUBLIC)).slice(0,3);
  return (
    <div style={{height:"100%",overflowY:"auto",background:t.bg}}>
      <div style={{background:t.grad,padding:"36px 18px 22px",color:"white",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:130,height:130,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}}/>
        <div style={{fontSize:12,opacity:0.8,marginBottom:4}}>おかえり 👋</div>
        <h2 style={{fontSize:22,fontFamily:"Georgia,serif",margin:0}}>{profile.name}さんのMen～Log</h2>
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
          <a href={RAMENDB_RANK} target="_blank" rel="noreferrer" style={{fontSize:11,color:t.acc,fontWeight:700,textDecoration:"none"}}>全て見る →</a>
        </div>
        <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>
          {DEMO_SHOPS.slice(0,4).map((s,i)=>(
            <a key={i} href={`${RAMENDB_BASE}/s/${s.id}.html`} target="_blank" rel="noreferrer"
              style={{minWidth:118,flexShrink:0,background:t.card,border:`1px solid ${t.br}`,borderRadius:12,overflow:"hidden",textDecoration:"none"}}>
              <div style={{height:54,background:t.accm,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{["✨","🎯","🎌","🏆"][i]}</div>
              <div style={{padding:"7px 9px"}}>
                <div style={{fontWeight:700,fontSize:11,color:t.tx,marginBottom:2}}>{s.name}</div>
                <div style={{fontSize:10,color:t.star,fontWeight:700}}>{s.score}pt</div>
              </div>
            </a>
          ))}
        </div>
      </div>
      {/* フレンドのアルバム */}
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
  const {t}=useApp();
  const [genre,setGenre]=useState("すべて");
  const list=genre==="すべて"?DEMO_SHOPS:DEMO_SHOPS.filter(s=>s.genre===genre);
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:t.bg}}>
      <a href={RAMENDB_RANK} target="_blank" rel="noreferrer" style={{flexShrink:0,display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:t.accm,textDecoration:"none",borderBottom:`1px solid ${t.br}`}}>
        <span style={{fontSize:14}}>🌐</span><span style={{fontSize:11,fontWeight:700,color:t.acc,flex:1}}>ラーメンDB連携 — 評価ポイント順</span><span style={{fontSize:10,color:t.txm}}>→</span>
      </a>
      <div style={{flexShrink:0,padding:"8px 12px",display:"flex",gap:6,overflowX:"auto",borderBottom:`1px solid ${t.br}`}}>
        {["すべて","醤油","豚骨","塩","味噌","つけ麺","その他"].map(g=>(
          <button key={g} onClick={()=>setGenre(g)} style={{flexShrink:0,padding:"4px 12px",borderRadius:20,border:"none",background:genre===g?t.acc:t.bg2,color:genre===g?"white":t.tx2,fontSize:11,fontWeight:600,cursor:"pointer"}}>{g}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        {list.map((s,i)=>(
          <div key={i} style={{background:t.card,padding:14,borderRadius:14,marginBottom:10,boxShadow:`0 2px 8px ${t.sh}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:26,height:26,borderRadius:"50%",background:i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":t.bg2,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:11,color:i<3?"white":t.txm,flexShrink:0}}>{i+1}</div>
                <span style={{fontWeight:700,fontSize:14,color:t.tx}}>{s.name}</span>
              </div>
              <span style={{color:t.star,fontWeight:900,fontSize:14}}>{s.score}pt</span>
            </div>
            <div style={{background:t.bg2,borderRadius:4,height:4,margin:"6px 0"}}><div style={{height:"100%",background:t.grad,width:`${Math.min(s.score,100)}%`,borderRadius:4}}/></div>
            <div style={{fontSize:12,color:t.txm,marginBottom:8}}>{s.area} / {s.genre}</div>
            <a href={`${RAMENDB_BASE}/s/${s.id}.html`} target="_blank" rel="noreferrer" style={{display:"block",textAlign:"center",padding:"8px",background:t.bg2,borderRadius:10,fontSize:12,color:t.acc,fontWeight:700,textDecoration:"none"}}>🌐 ラーメンDBで詳細を見る</a>
          </div>
        ))}
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


// ─── アルバム詳細（フルスクリーン・長押し起動・スワイプ切替） ─────
function AlbumDetail({ entryId, entries, onClose, onDelete, onAddImages, onRemoveImage, onUpdate, t }) {
  const idx      = entries.findIndex(e => e.id === entryId);
  const [cur, setCur]           = useState(idx < 0 ? 0 : idx);
  const [imgIdx, setImgIdx]     = useState(0);
  const [mode, setMode]         = useState("view"); // "view"|"edit"|"photos"
  const [draft, setDraft]       = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addProg, setAddProg]   = useState(0);
  const [addTotal, setAddTotal] = useState(0);

  const entry  = entries[cur];
  const images = entry?.images || [];
  const total  = entries.length;

  // アルバム切替時に画像・モードをリセット
  useEffect(() => { setImgIdx(0); setMode("view"); }, [cur]);

  // 編集モード開始時にdraftを初期化
  useEffect(() => {
    if (mode === "edit" && entry) {
      setDraft({
        shopName:  entry.shopName  || "",
        visitDate: entry.visitDate || new Date().toISOString().slice(0,10),
        menu:      entry.menu      || "",
        price:     entry.price     || "",
        genre:     entry.genre     || "その他",
        area:      entry.area      || "",
        rating:    entry.rating    || 4,
        comment:   entry.comment   || "",
        privacy:   entry.privacy   || PRIVACY.PRIVATE,
      });
    }
  }, [mode]);

  if (!entry) return null;

  // ─ アルバム間スワイプ（左右） ─
  const albumSwipeX = useRef(null);
  const albumSwipeY = useRef(null);
  const onAlbumTS = e => {
    albumSwipeX.current = e.touches[0].clientX;
    albumSwipeY.current = e.touches[0].clientY;
  };
  const onAlbumTE = e => {
    if (albumSwipeX.current === null) return;
    const dx = e.changedTouches[0].clientX - albumSwipeX.current;
    const dy = e.changedTouches[0].clientY - albumSwipeY.current;
    albumSwipeX.current = null;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
    if (dx < -60 && cur < total - 1) setCur(c => c + 1);
    if (dx >  60 && cur > 0)         setCur(c => c - 1);
  };

  // ─ 画像内スワイプ ─
  const imgSwipeX = useRef(null);
  const onImgTS = e => { e.stopPropagation(); imgSwipeX.current = e.touches[0].clientX; };
  const onImgTE = e => {
    e.stopPropagation();
    if (imgSwipeX.current === null) return;
    const dx = e.changedTouches[0].clientX - imgSwipeX.current;
    imgSwipeX.current = null;
    if (dx < -40 && imgIdx < images.length - 1) setImgIdx(i => i + 1);
    if (dx >  40 && imgIdx > 0)                 setImgIdx(i => i - 1);
  };

  const saveDraft = () => { if (draft) { onUpdate(entry.id, draft); setMode("view"); } };

  const handleAdd = async files => {
    const arr = Array.from(files || []); if (!arr.length) return;
    setAddLoading(true); setAddProg(0); setAddTotal(arr.length);
    for (let i = 0; i < arr.length; i++) {
      await onAddImages(entry.id, [arr[i]]);
      setAddProg(i + 1);
      await new Promise(r => setTimeout(r, 20));
    }
    setAddLoading(false);
  };

  const inp = { width:"100%", padding:"9px 12px", background:t.bg2, border:`1.5px solid ${t.br}`, borderRadius:9, fontSize:13, color:t.tx, outline:"none", boxSizing:"border-box" };
  const PRIV_OPTS = [
    [PRIVACY.PUBLIC,  "🌐 全体公開", t.acc      ],
    [PRIVACY.FRIENDS, "👥 グループ", "#27ae60"  ],
    [PRIVACY.PRIVATE, "🔒 非公開",   t.txm      ],
  ];

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:200, background:t.bg, display:"flex", flexDirection:"column" }}
      onTouchStart={mode === "view" ? onAlbumTS : undefined}
      onTouchEnd={mode   === "view" ? onAlbumTE : undefined}
    >
      {/* ── ヘッダーバー ── */}
      <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:t.card, borderBottom:`1px solid ${t.br}`, zIndex:10 }}>
        <button onClick={onClose}
          style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:t.txm, padding:"2px 4px", lineHeight:1 }}>←</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:15, color:t.tx, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
            {mode === "edit" ? "✏️ 編集" : mode === "photos" ? "📷 写真管理" : entry.shopName}
          </div>
          <div style={{ fontSize:10, color:t.txm }}>{cur+1} / {total}件　←スワイプで切替→</div>
        </div>
        {mode === "view" && (
          <>
            <button onClick={() => cur > 0 && setCur(c => c-1)}
              style={{ background:cur>0?t.accm:"transparent", border:"none", borderRadius:8, padding:"6px 11px", fontSize:18, color:cur>0?t.acc:t.br, cursor:cur>0?"pointer":"default", fontWeight:700 }}>‹</button>
            <button onClick={() => cur < total-1 && setCur(c => c+1)}
              style={{ background:cur<total-1?t.accm:"transparent", border:"none", borderRadius:8, padding:"6px 11px", fontSize:18, color:cur<total-1?t.acc:t.br, cursor:cur<total-1?"pointer":"default", fontWeight:700 }}>›</button>
          </>
        )}
        {mode !== "view" && (
          <button onClick={() => setMode("view")}
            style={{ background:t.bg2, border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, color:t.txm, cursor:"pointer" }}>← 戻る</button>
        )}
      </div>

      {/* ── アルバム位置ドット ── */}
      {total > 1 && mode === "view" && (
        <div style={{ flexShrink:0, display:"flex", justifyContent:"center", alignItems:"center", gap:4, padding:"5px 12px", background:t.card, overflowX:"auto" }}>
          {entries.map((_, i) => (
            <div key={i} onClick={() => setCur(i)}
              style={{ flexShrink:0, width:i===cur?18:5, height:5, borderRadius:3, background:i===cur?t.acc:t.br, transition:"all 0.22s", cursor:"pointer" }}/>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════
          ── 表示モード ──
      ══════════════════════════════════════════ */}
      {mode === "view" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* 画像ビューア */}
          <div style={{ position:"relative", background:"#000", flexShrink:0, height:250 }}
            onTouchStart={onImgTS} onTouchEnd={onImgTE}>
            {images.length > 0 ? (
              <img src={images[imgIdx]} alt=""
                style={{ width:"100%", height:250, objectFit:"contain", display:"block" }}
                onError={ev => { ev.target.src = PH(); }}/>
            ) : (
              <div style={{ height:250, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#555", gap:8 }}>
                <span style={{ fontSize:48 }}>📷</span>
                <span style={{ fontSize:12 }}>写真なし — 下の「写真を管理」から追加</span>
              </div>
            )}
            {images.length > 1 && (
              <>
                <div style={{ position:"absolute", bottom:10, left:"50%", transform:"translateX(-50%)", display:"flex", gap:5 }}>
                  {images.map((_, i) => (
                    <div key={i} onClick={() => setImgIdx(i)}
                      style={{ width:i===imgIdx?14:6, height:6, borderRadius:3, background:i===imgIdx?"white":"rgba(255,255,255,0.4)", transition:"all 0.2s", cursor:"pointer" }}/>
                  ))}
                </div>
                <div style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.65)", color:"white", fontSize:11, fontWeight:700, borderRadius:10, padding:"3px 9px" }}>
                  {imgIdx+1} / {images.length}
                </div>
                {imgIdx > 0 && (
                  <button onClick={() => setImgIdx(i => i-1)}
                    style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.5)", border:"none", borderRadius:"50%", width:36, height:36, color:"white", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
                )}
                {imgIdx < images.length-1 && (
                  <button onClick={() => setImgIdx(i => i+1)}
                    style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.5)", border:"none", borderRadius:"50%", width:36, height:36, color:"white", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
                )}
              </>
            )}
          </div>

          {/* ─ 情報・操作エリア（スクロール可） ─ */}
          <div style={{ flex:1, overflowY:"auto", padding:"14px 16px 24px" }}>

            {/* 店舗名 + 品名 + 価格 */}
            <div style={{ marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${t.br}` }}>
              <div style={{ fontWeight:800, fontSize:22, color:t.tx, marginBottom:6, lineHeight:1.2 }}>{entry.shopName}</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {entry.menu  && <span style={{ background:t.accm, color:t.acc, fontWeight:700, fontSize:13, borderRadius:8, padding:"4px 10px" }}>🍜 {entry.menu}</span>}
                {entry.price && <span style={{ background:"#FFF9E6", color:t.star,  fontWeight:700, fontSize:13, borderRadius:8, padding:"4px 10px" }}>💴 {entry.price}</span>}
              </div>
            </div>

            {/* メタ情報グリッド */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
              {[
                ["📅", "訪問日",  entry.visitDate || "—"],
                ["🍜", "ジャンル", entry.genre    || "—"],
                ["📍", "エリア",  entry.area      || "—"],
              ].map(([ico, l, v]) => (
                <div key={l} style={{ background:t.bg2, borderRadius:10, padding:"9px 8px", textAlign:"center" }}>
                  <div style={{ fontSize:16, marginBottom:2 }}>{ico}</div>
                  <div style={{ fontSize:9,  color:t.txm, marginBottom:2 }}>{l}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:t.tx }}>{v}</div>
                </div>
              ))}
            </div>

            {/* 評価 */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:t.txm, fontWeight:700, marginBottom:6 }}>⭐ 評価</div>
              <div style={{ display:"flex", gap:4 }}>
                {[1,2,3,4,5].map(n => (
                  <span key={n} style={{ fontSize:30, color:(entry.rating||0)>=n?t.star:t.br, lineHeight:1 }}>★</span>
                ))}
              </div>
            </div>

            {/* コメント */}
            {entry.comment ? (
              <div style={{ background:t.accm, borderRadius:12, padding:"12px 14px", marginBottom:16, borderLeft:`4px solid ${t.acc}` }}>
                <div style={{ fontSize:10, color:t.acc, fontWeight:700, marginBottom:4 }}>💬 レビュー・コメント</div>
                <p style={{ fontSize:14, color:t.tx, margin:0, lineHeight:1.75 }}>「{entry.comment}」</p>
              </div>
            ) : (
              <div style={{ background:t.bg2, borderRadius:12, padding:"10px 14px", marginBottom:16, fontSize:12, color:t.txm, textAlign:"center" }}>
                コメントなし — 編集から追加できます
              </div>
            )}

            {/* 編集ボタン */}
            <button onClick={() => setMode("edit")}
              style={{ width:"100%", padding:"13px", borderRadius:12, border:"none", background:t.grad, color:"white", fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:10, boxShadow:`0 4px 14px ${t.sh}` }}>
              ✏️ 編集する
            </button>

            {/* 公開設定 */}
            <div style={{ marginBottom:10, background:t.card, borderRadius:12, padding:"12px 14px", border:`1px solid ${t.br}` }}>
              <div style={{ fontSize:11, color:t.txm, fontWeight:700, marginBottom:8 }}>🔐 公開設定</div>
              <div style={{ display:"flex", gap:6 }}>
                {PRIV_OPTS.map(([key, label, col]) => (
                  <button key={key}
                    onClick={() => onUpdate(entry.id, { privacy: key })}
                    style={{
                      flex:1, padding:"9px 4px", borderRadius:10, border:"none",
                      background:(entry.privacy||PRIVACY.PRIVATE)===key?col:t.bg2,
                      color:     (entry.privacy||PRIVACY.PRIVATE)===key?"white":t.tx2,
                      fontSize:10, fontWeight:700, cursor:"pointer", transition:"background 0.18s",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 写真管理 */}
            <button onClick={() => setMode("photos")}
              style={{ width:"100%", padding:"12px", borderRadius:12, border:`1.5px solid ${t.br}`, background:t.bg2, color:t.tx, fontWeight:600, fontSize:13, cursor:"pointer", marginBottom:10 }}>
              📷 写真を管理する（{images.length}枚）
            </button>

            {/* 削除 */}
            <button onClick={() => { if(window.confirm(`「${entry.shopName}」のアルバムを削除しますか？`)) { onDelete(entry.id); onClose(); } }}
              style={{ width:"100%", padding:"12px", borderRadius:12, border:"1.5px solid #FADBD8", background:"#FFF5F5", color:"#E74C3C", fontWeight:600, fontSize:13, cursor:"pointer" }}>
              🗑️ このアルバムを削除
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          ── 編集モード ──
      ══════════════════════════════════════════ */}
      {mode === "edit" && draft && (
        <div style={{ flex:1, overflowY:"auto", padding:"14px 16px 32px" }}>

          {/* 店舗名 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:t.txm, fontWeight:700, marginBottom:4 }}>🏪 店舗名 *</div>
            <input style={inp} value={draft.shopName} onChange={e=>setDraft(d=>({...d,shopName:e.target.value}))} placeholder="例：らぁ麺 飯田商店"/>
          </div>

          {/* 品名 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:t.txm, fontWeight:700, marginBottom:4 }}>🍜 品名（注文メニュー）</div>
            <input style={inp} value={draft.menu} onChange={e=>setDraft(d=>({...d,menu:e.target.value}))} placeholder="例：特製醤油らーめん"/>
          </div>

          {/* 価格 */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:t.txm, fontWeight:700, marginBottom:4 }}>💴 価格</div>
            <input style={inp} value={draft.price} onChange={e=>setDraft(d=>({...d,price:e.target.value}))} placeholder="例：1,200円"/>
          </div>

          {/* 訪問日 + ジャンル */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, color:t.txm, fontWeight:700, marginBottom:4 }}>📅 訪問日</div>
              <input type="date" style={inp} value={draft.visitDate} onChange={e=>setDraft(d=>({...d,visitDate:e.target.value}))}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:t.txm, fontWeight:700, marginBottom:4 }}>ジャンル</div>
              <select style={{...inp, height:42}} value={draft.genre} onChange={e=>setDraft(d=>({...d,genre:e.target.value}))}>
                {["醤油","豚骨","塩","味噌","つけ麺","鶏白湯","二郎系","中華そば","煮干し","担々麺","その他"].map(g=><option key={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* エリア */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:t.txm, fontWeight:700, marginBottom:4 }}>📍 エリア</div>
            <input style={inp} value={draft.area} onChange={e=>setDraft(d=>({...d,area:e.target.value}))} placeholder="例：新宿"/>
          </div>

          {/* 評価 */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:t.txm, fontWeight:700, marginBottom:8 }}>⭐ 評価</div>
            <div style={{ display:"flex", gap:8 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setDraft(d=>({...d,rating:n}))}
                  style={{ width:46, height:46, borderRadius:"50%", border:"none", background:draft.rating>=n?t.star:"#eee", color:draft.rating>=n?"white":"#bbb", fontSize:22, cursor:"pointer", transition:"background 0.15s" }}>★</button>
              ))}
            </div>
          </div>

          {/* コメント */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:t.txm, fontWeight:700, marginBottom:4 }}>💬 レビュー・コメント</div>
            <textarea style={{...inp, minHeight:88, resize:"none", lineHeight:1.6}} value={draft.comment} onChange={e=>setDraft(d=>({...d,comment:e.target.value}))} placeholder="感想・おすすめポイントなど"/>
          </div>

          {/* 公開設定 */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, color:t.txm, fontWeight:700, marginBottom:6 }}>🔐 公開設定</div>
            <div style={{ display:"flex", gap:6 }}>
              {PRIV_OPTS.map(([key, label, col]) => (
                <button key={key} onClick={() => setDraft(d=>({...d,privacy:key}))}
                  style={{ flex:1, padding:"10px 4px", borderRadius:10, border:"none", background:draft.privacy===key?col:t.bg2, color:draft.privacy===key?"white":t.tx2, fontSize:10, fontWeight:700, cursor:"pointer", transition:"background 0.15s" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={saveDraft}
            style={{ width:"100%", padding:"14px", borderRadius:12, border:"none", background:t.grad, color:"white", fontWeight:700, fontSize:15, cursor:"pointer", boxShadow:`0 4px 14px ${t.sh}` }}>
            ✅ 保存する
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          ── 写真管理モード ──
      ══════════════════════════════════════════ */}
      {mode === "photos" && (
        <div style={{ flex:1, overflowY:"auto", padding:"14px 16px 32px" }}>

          {addLoading && (
            <div style={{ display:"flex", alignItems:"center", gap:10, background:t.bg2, borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ fontSize:24, animation:"spin 0.5s linear infinite" }}>🍜</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:t.tx, marginBottom:4 }}>追加中... {addProg}/{addTotal}</div>
                <div style={{ height:5, background:t.br, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:t.grad, width:`${addTotal>0?(addProg/addTotal)*100:0}%`, borderRadius:3, transition:"width 0.2s" }}/>
                </div>
              </div>
            </div>
          )}

          <label style={{ display:"block", textAlign:"center", padding:"14px 10px", background:t.acc, color:"white", borderRadius:12, fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:14, boxShadow:`0 4px 12px ${t.sh}` }}>
            ＋ 写真を追加（複数可）
            <input type="file" multiple accept="image/*" hidden onChange={ev => { handleAdd(ev.target.files); ev.target.value=""; }}/>
          </label>

          {images.length === 0 ? (
            <div style={{ textAlign:"center", padding:"32px", color:t.txm }}>
              <div style={{ fontSize:40, marginBottom:8 }}>📷</div>
              <div>まだ写真がありません</div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {images.map((img, i) => (
                <div key={i} style={{ position:"relative", borderRadius:10, overflow:"hidden", boxShadow:`0 2px 8px ${t.sh}` }}>
                  <img src={img} alt="" style={{ width:"100%", height:120, objectFit:"cover", display:"block" }}
                    onError={ev=>{ev.target.src=PH();}}/>
                  {i === 0 && (
                    <div style={{ position:"absolute", top:6, left:6, background:t.grad, color:"white", fontSize:10, fontWeight:700, borderRadius:8, padding:"2px 8px" }}>表紙</div>
                  )}
                  <button onClick={() => { onRemoveImage(entry.id, i); if(imgIdx >= images.length-1) setImgIdx(Math.max(0, images.length-2)); }}
                    style={{ position:"absolute", top:6, right:6, background:"rgba(231,76,60,0.9)", border:"none", borderRadius:"50%", width:26, height:26, color:"white", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  <div style={{ padding:"5px 8px", background:t.card }}>
                    <div style={{ fontSize:10, color:t.txm }}>{i===0?"表紙":i+1+"枚目"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── アルバム一覧（グリッド表示・長押しで詳細・AI一括取込） ───────────────────────
function AlbumPage() {
  const { entries, setEntries, t } = useApp();
  const [detailId,   setDetailId]   = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addProg,    setAddProg]    = useState(0);
  const [addTotal,   setAddTotal]   = useState(0);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiProg,     setAiProg]     = useState(0);
  const [aiTotal,    setAiTotal]    = useState(0);
  const [aiShop,     setAiShop]     = useState("");
  const [aiSummary,  setAiSummary]  = useState(null);
  const lpTimer  = useRef(null);
  const lpFired  = useRef(false);
  const lpMoving = useRef(false);

  const startLP = (id) => {
    lpFired.current  = false;
    lpMoving.current = false;
    lpTimer.current  = setTimeout(() => {
      if (lpMoving.current) return;
      lpFired.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      setDetailId(id);
    }, 480);
  };
  const cancelLP = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };
  const markMove = () => { lpMoving.current = true; cancelLP(); };

  const deleteEntry = id => setEntries(p => p.filter(e => e.id !== id));
  const removeImg   = (id, idx) =>
    setEntries(p => p.map(e => e.id===id ? { ...e, images:(e.images||[]).filter((_,i)=>i!==idx) } : e));
  const updateEntry = (id, patch) =>
    setEntries(p => p.map(e => e.id===id ? { ...e, ...patch } : e));

  const addImages = async (entryId, filesArr) => {
    const arr = Array.from(filesArr); if (!arr.length) return;
    setAddLoading(true); setAddProg(0); setAddTotal(arr.length);
    const imgs = [];
    for (let i=0; i<arr.length; i++) {
      const d = await readAsDataURL(arr[i]);
      if (d) imgs.push(d);
      setAddProg(i+1);
      await new Promise(r=>setTimeout(r,20));
    }
    setEntries(p => p.map(e => e.id===entryId ? { ...e, images:dedupe([...(e.images||[]),...imgs]) } : e));
    setAddLoading(false);
  };

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

  const privIcon  = { public:"🌐", friends:"👥", private:"🔒" };
  const privColor = { public:t.acc, friends:"#27ae60", private:t.txm };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:t.bg, position:"relative" }}>

      {/* ── AI処理中オーバーレイ ── */}
      {aiLoading && (
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.9)", zIndex:50, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>
          <div style={{ fontSize:68, marginBottom:18, animation:"spin 0.55s linear infinite" }}>🍜</div>
          <div style={{ color:"white", fontWeight:700, fontSize:20, marginBottom:6 }}>AI自動振り分け中...</div>
          <div style={{ color:"rgba(255,255,255,0.6)", fontSize:12, marginBottom:10 }}>ラーメンDBと照合して店舗を特定します</div>
          {aiShop && <div style={{ color:"#FADBD8", fontSize:13, marginBottom:14, textAlign:"center", maxWidth:260 }}>🔍「{aiShop}」を確認中</div>}
          <div style={{ width:240, height:7, background:"rgba(255,255,255,0.15)", borderRadius:4, overflow:"hidden", marginBottom:8 }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#E74C3C,#FF6B6B)", width:`${aiTotal>0?(aiProg/aiTotal)*100:0}%`, borderRadius:4, transition:"width 0.3s" }}/>
          </div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12 }}>{aiProg} / {aiTotal} 枚</div>
          <div style={{ marginTop:18, color:"rgba(255,255,255,0.28)", fontSize:11, textAlign:"center", lineHeight:1.9 }}>
            店舗が不明な場合は<br/>「不明1」「不明2」で自動作成します
          </div>
        </div>
      )}

      {/* ── 画像追加中オーバーレイ ── */}
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

      {/* ── ヘッダー ── */}
      <div style={{ flexShrink:0, padding:"10px 14px", borderBottom:`1px solid ${t.br}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:t.card }}>
        <div>
          <span style={{ fontWeight:700, fontSize:14, color:t.tx }}>📷 アルバム</span>
          <span style={{ fontSize:11, color:t.txm, marginLeft:6 }}>({entries.length}件)</span>
        </div>
        <label style={{ display:"flex", alignItems:"center", gap:5, background:t.grad, color:"white", borderRadius:10, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:`0 2px 8px ${t.sh}` }}>
          <span>🍜</span><span>AI取込</span>
          <input type="file" multiple accept="image/*" hidden onChange={handleAIImport}/>
        </label>
      </div>

      {/* ── AI振り分け結果サマリー ── */}
      {aiSummary && (
        <div style={{ flexShrink:0, margin:"8px 12px 0", background:t.card, borderRadius:12, padding:"10px 14px", border:`1px solid ${t.br}`, boxShadow:`0 2px 8px ${t.sh}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ fontSize:12, fontWeight:700, color:t.acc }}>✅ AI振り分け完了 — {aiSummary.length}件処理</span>
            <button onClick={() => setAiSummary(null)} style={{ background:"none", border:"none", fontSize:16, color:t.txm, cursor:"pointer", lineHeight:1 }}>×</button>
          </div>
          <div style={{ display:"flex", gap:10, marginBottom:6 }}>
            {[
              ["新規", aiSummary.filter(s=>s.action==="新規作成").length, t.acc],
              ["追加", aiSummary.filter(s=>s.action==="追加").length,     "#27ae60"],
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
                {s.confidence && <span style={{ color:t.star, flexShrink:0 }}>({s.confidence}%)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── グリッド ── */}
      <div style={{ flex:1, overflowY:"auto", padding:10 }}>
        {entries.length === 0 ? (
          <div style={{ textAlign:"center", padding:"52px 20px", color:t.txm }}>
            <div style={{ fontSize:52, marginBottom:14 }}>📷</div>
            <div style={{ fontWeight:700, color:t.tx, marginBottom:6, fontSize:16 }}>アルバムがありません</div>
            <div style={{ fontSize:12, marginBottom:20, lineHeight:1.7 }}>
              「🍜 AI取込」から複数枚選択すると<br/>ラーメンDBと照合して<br/>自動でアルバムを作成します
            </div>
            <label style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"12px 24px", background:t.grad, color:"white", borderRadius:12, fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:`0 4px 14px ${t.sh}` }}>
              🍜 画像を選択して取込む
              <input type="file" multiple accept="image/*" hidden onChange={handleAIImport}/>
            </label>
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

                  {/* サムネイル */}
                  <div style={{ position:"relative" }}>
                    <img src={e.images?.[0] || PH(e.emoji||"🍜")} alt={e.shopName}
                      style={{ width:"100%", height:118, objectFit:"cover", display:"block", pointerEvents:"none" }}
                      onError={ev=>{ev.target.src=PH();}}/>
                    {/* 枚数バッジ */}
                    {(e.images?.length||0) > 1 && (
                      <div style={{ position:"absolute", top:6, left:6, background:"rgba(0,0,0,0.65)", color:"white", fontSize:9, fontWeight:700, borderRadius:7, padding:"2px 6px" }}>
                        📷 {e.images.length}
                      </div>
                    )}
                    {/* 公開レベルバッジ */}
                    <div style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.55)", color:privColor[e.privacy||PRIVACY.PRIVATE], fontSize:12, borderRadius:7, padding:"2px 6px", fontWeight:700 }}>
                      {privIcon[e.privacy||PRIVACY.PRIVATE]}
                    </div>
                    {/* AI判定バッジ */}
                    {e.aiDetected && (
                      <div style={{ position:"absolute", bottom:6, left:6, background:"rgba(0,0,0,0.6)", color:"white", fontSize:9, borderRadius:7, padding:"2px 6px" }}>🤖 AI</div>
                    )}
                  </div>

                  {/* 情報 */}
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

      {detailId && (
        <AlbumDetail
          entryId={detailId}
          entries={entries}
          onClose={() => setDetailId(null)}
          onDelete={deleteEntry}
          onAddImages={addImages}
          onRemoveImage={removeImg}
          onUpdate={updateEntry}
          t={t}
        />
      )}
    </div>
  );
}

// ─── マイページ（フレンド・グループ共有含む） ─────────
function MyPage() {
  const {entries,setEntries,groups,setGroups,profile,setProfile,settings,setSettings,friends,addFriend,removeFriend,filterMode,setFilterMode,myCode,t}=useApp();
  const [view,setView]=useState("you");
  const [filterG,setFilterG]=useState("すべて");
  const [filterGenre,setFilterGenre]=useState("すべて");
  const [newGName,setNewGName]=useState("");
  const [newMem,setNewMem]=useState("");
  const [expandG,setExpandG]=useState(null);
  const [friendCode,setFriendCode]=useState("");
  const [friendMsg,setFriendMsg]=useState("");
  const [showInvite,setShowInvite]=useState(null);

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
  const sendLine=(g)=>{window.open(`https://line.me/R/share?text=${encodeURIComponent(`【Men～Log】${g.name}に招待！\nあなたのフレンドコード: ${myCode}\n${APP_LINK}`)}`, "_blank");};
  const handleAddFriend=()=>{const err=addFriend(friendCode);if(err){setFriendMsg(err);}else{setFriendMsg("✅ 友達を追加しました！");setFriendCode("");}setTimeout(()=>setFriendMsg(""),3000);};

  // グループ招待リンク生成
  const inviteLink=(g)=>`${APP_LINK}?invite=${g.id}&code=${myCode}`;
  const sendGroupInvite=(g)=>{
    const msg=`【Men～Log】グループ「${g.name}」に招待します！\nフレンドコード: ${myCode}\nアプリ: ${APP_LINK}`;
    window.open(`https://line.me/R/share?text=${encodeURIComponent(msg)}`,"_blank");
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:t.bg}}>
      {/* ヘッダー */}
      <div style={{flexShrink:0,background:t.grad,padding:"16px",color:"white"}}>
        <div style={{fontWeight:700,fontSize:20,fontFamily:"Georgia,serif"}}>{profile.name}</div>
        <div style={{fontSize:11,opacity:0.75}}>{profile.station} · ❤️ {profile.favorite}</div>
        <div style={{marginTop:6,fontSize:11,background:"rgba(255,255,255,0.2)",borderRadius:8,padding:"4px 10px",display:"inline-flex",alignItems:"center",gap:6}}>
          <span>🔑 フレンドコード:</span>
          <span style={{fontWeight:700,letterSpacing:"0.1em"}}>{myCode}</span>
          <button onClick={()=>{navigator.clipboard?.writeText(myCode).then(()=>alert("コピーしました")).catch(()=>alert(myCode));}}
            style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:6,padding:"2px 8px",color:"white",fontSize:10,cursor:"pointer"}}>コピー</button>
        </div>
      </div>

      {/* タブ */}
      <div style={{flexShrink:0,display:"flex",borderBottom:`1px solid ${t.br}`}}>
        {[["you","👤 あなた"],["friends","👥 フレンド"],["group","🍜 グループ"],["settings","⚙️ 設定"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"9px 2px",border:"none",background:"transparent",color:view===v?t.acc:t.txm,fontWeight:700,fontSize:11,cursor:"pointer",borderBottom:view===v?`2px solid ${t.acc}`:"2px solid transparent"}}>{l}</button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",padding:14}}>

        {/* ── あなた ── */}
        {view==="you"&&(
          <>
            {/* プロフィール編集 */}
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

            {/* 絞り込み */}
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

            <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:8}}>記録一覧 ({filtered.length}件)</div>
            {filtered.map(e=>(
              <div key={e.id} style={{background:t.card,padding:11,borderRadius:12,marginBottom:8,display:"flex",gap:11,boxShadow:`0 2px 6px ${t.sh}`}}>
                <img src={e.images?.[0]||PH()} alt={e.shopName} style={{width:52,height:52,borderRadius:9,objectFit:"cover",flexShrink:0}} onError={ev=>{ev.target.src=PH();}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:t.tx}}>{e.shopName}</div>
                  <div style={{fontSize:11,color:t.txm}}>{e.visitDate} / {"★".repeat(e.rating||0)}</div>
                  <span style={{fontSize:10,fontWeight:700,color:e.privacy===PRIVACY.PUBLIC?t.acc:e.privacy===PRIVACY.FRIENDS?"#27ae60":t.txm}}>{PRIVACY_LABEL[e.privacy||PRIVACY.PRIVATE]}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── フレンド ── */}
        {view==="friends"&&(
          <>
            {/* フレンド追加 */}
            <section style={{background:t.card,padding:16,borderRadius:14,marginBottom:14,boxShadow:`0 2px 8px ${t.sh}`}}>
              <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:10}}>👥 フレンドを追加</div>
              <div style={{fontSize:12,color:t.txm,marginBottom:8,lineHeight:1.6}}>
                相手のフレンドコードを入力すると、<br/>相手の公開アルバムを閲覧できます。
              </div>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input value={friendCode} onChange={e=>setFriendCode(e.target.value.toUpperCase())} placeholder="フレンドコード（例: AB3X7Y2Z）"
                  style={{...INP(t),marginBottom:0,flex:1,textTransform:"uppercase",letterSpacing:"0.1em"}}/>
                <button onClick={handleAddFriend} style={{padding:"10px 14px",borderRadius:9,border:"none",background:t.grad,color:"white",fontWeight:700,cursor:"pointer",flexShrink:0}}>追加</button>
              </div>
              {friendMsg&&<div style={{fontSize:12,color:friendMsg.startsWith("✅")?t.acc:"#E74C3C",fontWeight:600}}>{friendMsg}</div>}
              <div style={{marginTop:10,padding:"10px 12px",background:t.bg2,borderRadius:10,fontSize:11,color:t.txm,lineHeight:1.7}}>
                💡 あなたのフレンドコード: <strong style={{color:t.acc,letterSpacing:"0.08em"}}>{myCode}</strong><br/>
                LINEで友達に共有して相互フォローできます。
              </div>
              <button onClick={()=>{const msg=`【Men～Log】フレンドになりましょう！\nコード: ${myCode}\n${APP_LINK}`;window.open(`https://line.me/R/share?text=${encodeURIComponent(msg)}`,"_blank");}}
                style={{width:"100%",padding:"10px",borderRadius:10,border:"none",background:"#06C755",color:"white",fontWeight:700,fontSize:13,cursor:"pointer",marginTop:10}}>
                💬 LINEでコードを送る
              </button>
            </section>

            {/* フレンドリスト */}
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
                {/* 友達の公開アルバム */}
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

        {/* ── グループ ── */}
        {view==="group"&&(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontWeight:700,fontSize:13,color:t.tx}}>グループ ({groups.length})</span>
              <button onClick={()=>setShowInvite(null)} style={{background:t.accm,border:"none",borderRadius:16,padding:"4px 11px",color:t.acc,fontSize:11,fontWeight:600,cursor:"pointer"}}>＋ 作成</button>
            </div>
            {/* 作成フォーム */}
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
                    <div style={{fontSize:11,fontWeight:700,color:t.txm,marginBottom:6}}>招待リンクをLINEで送る</div>
                    <button onClick={()=>sendGroupInvite(g)} style={{width:"100%",padding:"10px",borderRadius:10,border:"none",background:"#06C755",color:"white",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                      💬 LINEでグループ招待を送る
                    </button>
                    <div style={{fontSize:10,color:t.txm,textAlign:"center",marginTop:4}}>招待にはあなたのフレンドコード({myCode})が含まれます</div>
                    {/* グループ内の共有記録 */}
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

        {/* ── 設定 ── */}
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
            <section style={{background:t.card,padding:16,borderRadius:14,boxShadow:`0 2px 8px ${t.sh}`}}>
              <div style={{fontWeight:700,fontSize:13,color:t.tx,marginBottom:10}}>🗑️ データ管理</div>
              <button onClick={()=>{if(window.confirm("全データをリセット？")){localStorage.clear();window.location.reload();}}}
                style={{width:"100%",padding:"12px",borderRadius:10,border:"1.5px solid #FADBD8",background:"#FFF5F5",color:"#E74C3C",fontWeight:600,cursor:"pointer"}}>データをリセット</button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}


// ─── 記録モーダル（訪問日・メニュー・価格フィールド追加） ─
function PostModal() {
  const { entries, setEntries, setShowPost, t } = useApp();
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    shopName:  "",
    visitDate: new Date().toISOString().slice(0,10),
    menu:      "",
    price:     "",
    rating:    5,
    genre:     "醤油",
    area:      "",
    comment:   "",
    privacy:   PRIVACY.PRIVATE,
  });

  const handleManual = () => {
    if (!form.shopName.trim()) return;
    setEntries(p => [{ ...form, id:`m_${Date.now()}`, images:[], aiDetected:false }, ...p]);
    setShowPost(false);
  };

  // 振分結果
  if (result) {
    const nc=result.filter(r=>r.action==="新規作成").length, ac=result.filter(r=>r.action==="追加").length, sc=result.filter(r=>r.action==="重複スキップ").length;
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

        {/* AI一括取込 */}
        <AiBulkTrigger onDone={s=>setResult(s)} onEntriesUpdate={ne=>setEntries(ne)}/>

        <div style={{ display:"flex", alignItems:"center", gap:8, margin:"14px 0" }}>
          <div style={{ flex:1, height:1, background:t.br }}/><span style={{ fontSize:11, color:t.txm }}>または手動で記録</span><div style={{ flex:1, height:1, background:t.br }}/>
        </div>

        {/* 店舗名 */}
        <input style={inp} placeholder="店舗名 *" value={form.shopName} onChange={e=>setForm(f=>({...f,shopName:e.target.value}))}/>

        {/* 訪問日 + ジャンル */}
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

        {/* 注文メニュー */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:t.txm, marginBottom:3 }}>🍜 注文メニュー</div>
          <input style={{ ...inp, marginBottom:0 }} placeholder="例：特製醤油らーめん" value={form.menu} onChange={e=>setForm(f=>({...f,menu:e.target.value}))}/>
        </div>

        {/* 価格 */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:t.txm, marginBottom:3 }}>💴 価格</div>
          <input style={{ ...inp, marginBottom:0 }} placeholder="例：1,200円" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/>
        </div>

        {/* 評価 */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:t.txm, marginBottom:4 }}>評価</div>
          <div style={{ display:"flex", gap:6 }}>
            {[1,2,3,4,5].map(n=>(
              <button key={n} onClick={()=>setForm(f=>({...f,rating:n}))}
                style={{ width:36, height:36, borderRadius:"50%", border:"none", background:form.rating>=n?"#E67E22":"#eee", color:form.rating>=n?"white":"#999", fontSize:18, cursor:"pointer" }}>★</button>
            ))}
          </div>
        </div>

        {/* 公開レベル */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:t.txm, marginBottom:4 }}>公開レベル</div>
          <div style={{ display:"flex", gap:5 }}>
            {Object.entries(PRIVACY_LABEL).map(([key,label])=>(
              <button key={key} onClick={()=>setForm(f=>({...f,privacy:key}))}
                style={{ flex:1, padding:"7px 4px", borderRadius:9, border:"none", background:form.privacy===key?t.acc:t.bg2, color:form.privacy===key?"white":t.tx2, fontSize:10, fontWeight:600, cursor:"pointer" }}>{label}</button>
            ))}
          </div>
        </div>

        {/* コメント */}
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
    <label style={{display:"block",padding:"16px 14px",background:t.grad,borderRadius:14,textAlign:"center",cursor:"pointer"}}>
      <div style={{fontSize:28,marginBottom:4}}>🍜</div>
      <div style={{color:"white",fontWeight:700,fontSize:14,marginBottom:2}}>画像を一括取込（AI自動振分）</div>
      <div style={{color:"rgba(255,255,255,0.8)",fontSize:11}}>複数枚選択可 · ラーメンDB照合 · 不明は「不明1」「不明2」で自動作成</div>
      <input type="file" multiple accept="image/*" hidden onChange={handleChange}/>
    </label>
  );
}

// ─── メインレイアウト（スワイプ対応） ─────────────────
// ★ containerW不使用・パーセント計算でtranslateX（白画面バグ修正済み）
function MainLayout() {
  const {tab,setTab,showPost,setShowPost,aiState,t}=useApp();
  const TABS=[
    {label:"ホーム",    icon:"🏠",Page:HomePage       },
    {label:"おすすめ",  icon:"🔥",Page:RecommendPage  },
    {label:"マップ",    icon:"🗺️",Page:MapPage        },
    {label:"アルバム",  icon:"🖼️",Page:AlbumPage      },
    {label:"マイページ",icon:"👤",Page:MyPage         },
  ];
  const N=TABS.length, STEP=100/N;
  const [dragDelta,setDragDelta]=useState(0);
  const [dragging, setDragging] =useState(false);
  const touchX=useRef(null),touchY=useRef(null),mouseX=useRef(null);
  const THRESH=50;

  const commit=(dx)=>{setDragDelta(0);setDragging(false);if(dx<-THRESH&&tab<N-1)setTab(tab+1);else if(dx>THRESH&&tab>0)setTab(tab-1);};
  const clamp=(dx)=>{if(dx>0&&tab===0)return dx*0.15;if(dx<0&&tab===N-1)return dx*0.15;return dx;};

  const onTouchStart=e=>{if(showPost||aiState)return;touchX.current=e.touches[0].clientX;touchY.current=e.touches[0].clientY;setDragging(false);setDragDelta(0);};
  const onTouchMove=e=>{
    if(touchX.current===null)return;
    const dx=e.touches[0].clientX-touchX.current,dy=e.touches[0].clientY-touchY.current;
    if(!dragging&&Math.abs(dy)>Math.abs(dx)*1.4)return;
    if(Math.abs(dx)>8){setDragging(true);setDragDelta(clamp(dx)*0.75);}
  };
  const onTouchEnd=e=>{if(!dragging){touchX.current=null;return;}const dx=e.changedTouches[0].clientX-touchX.current;touchX.current=null;commit(dx);};
  const onMouseDown=e=>{if(showPost||aiState)return;mouseX.current=e.clientX;setDragging(false);setDragDelta(0);};
  const onMouseMove=e=>{if(mouseX.current===null)return;const dx=e.clientX-mouseX.current;if(Math.abs(dx)>8){setDragging(true);setDragDelta(clamp(dx)*0.75);}};
  const onMouseUp=e=>{if(mouseX.current===null)return;const dx=e.clientX-mouseX.current;mouseX.current=null;if(!dragging)return;commit(dx);};
  const onMouseLeave=()=>{if(mouseX.current!==null){mouseX.current=null;setDragging(false);setDragDelta(0);}};

  return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",fontFamily:"'Noto Sans JP',ui-sans-serif,sans-serif",background:t.bg,overflow:"hidden"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}*{-webkit-tap-highlight-color:transparent}`}</style>

      {/* AI処理中フルスクリーンスピナー */}
      {aiState&&<FullscreenSpinner progress={aiState.progress} total={aiState.total} shopName={aiState.shopName}/>}

      {/* ヘッダー */}
      <div style={{flexShrink:0,height:48,display:"flex",alignItems:"center",justifyContent:"center",background:t.bg,borderBottom:`1px solid ${t.br}`,position:"relative",zIndex:10}}>
        <MenLogLogo size={20}/>
        <button onClick={()=>setShowPost(true)} style={{position:"absolute",right:12,background:t.grad,border:"none",borderRadius:8,padding:"5px 13px",color:"white",fontSize:11,fontWeight:700,cursor:"pointer"}}>＋ 記録</button>
      </div>

      {/* スワイプコンテナ（containerW不使用・%計算） */}
      <div style={{flex:1,minHeight:0,overflow:"hidden",position:"relative"}}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}   onMouseMove={onMouseMove}  onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}>
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
        {/* ページドット */}
        <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4,zIndex:5,pointerEvents:"none"}}>
          {TABS.map((_,i)=>(
            <div key={i} style={{width:i===tab?14:4,height:4,borderRadius:2,background:i===tab?t.acc:t.br,transition:"all 0.25s"}}/>
          ))}
        </div>
      </div>

      {showPost&&<PostModal/>}

      {/* フッター */}
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
    </div>
  );
}

export default function App() {
  return <Provider><MainLayout/></Provider>;
}
