# トレードシステム

チャート画像から判定（ロング/ショート・エントリー/TP/SL）を出し、X投稿文（エントリー/進捗/決済前/決済後）を生成するツール。
Vite + React のフロントと、APIキーを隠すための Netlify Function（中継）で構成。

## 構成

```
trade-system/
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
├─ postcss.config.js
├─ netlify.toml
├─ .env.example
├─ netlify/
│  └─ functions/
│     └─ claude.js        ← Anthropic APIへの中継（キーはここだけで使用）
└─ src/
   ├─ main.jsx
   ├─ index.css
   └─ App.jsx             ← 本体（判定モード＋発信モード）
```

## ローカルで動かす

1. 依存をインストール
   ```
   npm install
   ```
2. APIキーを用意（https://console.anthropic.com でキー発行＋支払い設定）
3. `.env.example` を `.env` にコピーし、`ANTHROPIC_API_KEY` を記入
4. Netlify CLI で起動（関数も一緒に動く）
   ```
   npm install -g netlify-cli
   netlify dev
   ```
   ※ `npm run dev`（Viteのみ）だと関数が動かないため、必ず `netlify dev` を使う。

## 公開（Netlifyにデプロイ）

1. このフォルダを GitHub リポジトリに push（`.env` は上げない＝.gitignore済み）
2. Netlify で「Add new site → Import an existing project」からリポジトリを連携
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions: `netlify/functions`（netlify.tomlで設定済み）
3. Site settings → Environment variables に `ANTHROPIC_API_KEY` を登録
4. デプロイ完了後、サイトのURLで動作確認

## 仕様メモ

- フロントは `/.netlify/functions/claude` を呼ぶだけ。APIキーはブラウザに出ない。
- モデルは `claude-sonnet-4-6`。変更は `src/App.jsx` の `callClaude` と関数側で。
- 画像は送信前に長辺1280px・JPEGへ縮小（ペイロード軽量化）。
- TP/SL・損益pips等はフロント側で確定計算（AIの計算ミスを排除）。
- 注意：Netlify同期関数はボディ約6MB・標準タイムアウト10秒。画像3枚で重い場合は縮小設定を調整。

## 任意：ファンダのweb検索を再搭載

`netlify/functions/claude.js` のリクエストに `tools` を渡し、`src/App.jsx` の `buildJudgePrompt` で
最新ファンダを検索する指示を戻せば、サーバー側でweb検索を有効化できる（max_tokensに余裕を持たせること）。

---
本ツールは教育目的の分析補助であり、投資助言ではありません。
