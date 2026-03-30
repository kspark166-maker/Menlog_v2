# 🍜 ラーメン日記

ラーメン仲間と行ったお店の記録を共有するグルメ日記アプリです。

## ✨ 機能

| 機能 | 説明 |
|------|------|
| 📖 ラーメン日記 | 店舗・評価・メニュー・写真・コメントを記録 |
| 🔥 おすすめ提案 | ラーメンDBと連携。カテゴリ・距離・地域・ランキング軸で検索 |
| 🗺️ MAPピン表示 | 訪問店舗をMAP上にピン留め（Google Maps API対応） |
| 📷 アルバム | 店舗別・グリッド表示で写真を管理 |
| 👥 グループ | 仲間とグループを作り日記を共有 |
| ⚙️ テーマ切替 | 暖色・ダーク・寒色・季節の4テーマ対応 |

---

## 🚀 StackBlitz での起動（推奨）

### 方法1：GitHubからインポート

1. GitHubに新規リポジトリを作成し、このファイル一式をプッシュ
2. ブラウザで以下のURLにアクセス：
   ```
   https://stackblitz.com/github/[あなたのユーザー名]/ramen-diary
   ```
3. 自動的にセットアップ・起動されます

### 方法2：StackBlitz に直接作成

1. [stackblitz.com](https://stackblitz.com) → 「Create project」→「Vite + React」
2. `src/App.jsx` と `index.html` `package.json` をこのファイルの内容に置き換える
3. 即動作確認できます

---

## 💻 ローカル開発

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` が開きます。

---

## 📱 スマートフォンで使う

StackBlitz のプレビューURLをスマホのブラウザで開くだけで動作します。
ホーム画面に追加（PWA的な使い方）も可能です。

---

## 🔑 Google Maps API の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. **Maps JavaScript API** と **Places API** を有効化
3. APIキーを取得
4. アプリ内「マイページ → ⚙️設定 → 外観 → Google Maps APIキー」に入力して保存
5. ※ 未設定の場合はモックMAP（グリッド）で動作します

---

## 🛠 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | React 18 + Vite |
| スタイリング | インラインスタイル（テーマシステム付き） |
| データ永続化 | localStorage |
| MAP | Google Maps API（未設定時はモックMAP） |
| アイコン | 絵文字（外部依存なし） |

---

## 📁 ファイル構成

```
ramen-diary/
├── index.html          # エントリーポイント（PWA対応メタタグ含む）
├── package.json        # 依存関係（React 18 + Vite のみ）
├── vite.config.js      # Vite設定
├── README.md
└── src/
    ├── main.jsx        # Reactマウント
    └── App.jsx         # アプリ全体（単一ファイル構成）
```

---

## 📋 Phase 2 実装予定

- [ ] Firebase 認証（Google / Apple サインイン）
- [ ] Firestore によるリアルタイムデータ同期
- [ ] Firebase Storage による写真アップロード
- [ ] プッシュ通知（FCM）
- [ ] Google Maps API フル統合
- [ ] 外部ラーメンDB API 連携
- [ ] PWA / ホーム画面追加対応

---

## バージョン

`v0.1.0` — 仮リリース（フロントエンドデモ）
