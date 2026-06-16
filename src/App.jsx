import React, { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Upload,
  Loader2,
  LineChart,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Megaphone,
  Target,
} from "lucide-react";

// ──────────────────────────────────────────────
// 銘柄ごとの設定
// ──────────────────────────────────────────────
const INSTRUMENTS = {
  usdjpy: {
    key: "usdjpy", label: "ドル円", sub: "USD/JPY", decimals: 2, pip: 0.01,
    unit: "pips", unitWord: "pips",
    entryBandText: "現在価格 ±0.10（10pips）",
    slPips: 15, tpPips: 20, slText: "15pips（0.15）", tpText: "20pips（0.20）",
    rr: "1 : 1.33", ph: "157.20",
  },
  gold: {
    key: "gold", label: "ゴールド", sub: "XAU/USD", decimals: 2, pip: 0.1, // 1ドル=10pips
    unit: "pips", unitWord: "pips",
    entryBandText: "現在価格 ±$3.00（30pips）",
    slPips: 40, tpPips: 60, slText: "40pips（$4.00）", tpText: "60pips（$6.00）",
    rr: "1 : 1.5", ph: "3340.50",
  },
  btc: {
    key: "btc", label: "ビットコイン", sub: "BTC/USD", decimals: 0, pip: 1,
    unit: "ドル", unitWord: "ドル",
    entryBandText: "現在価格 ±$150",
    slPips: 150, tpPips: 250, slText: "$150", tpText: "$250",
    rr: "1 : 1.67", ph: "104500",
  },
};

const TF_ORDER = [
  { key: "h4", label: "4時間足" },
  { key: "h1", label: "1時間足" },
  { key: "m30", label: "30分足" },
];

const HOURS = {
  "14": { label: "14時", zone: "東京午後", ind: "MA20・50 ＋ RSI", cols: ["MA位置関係", "RSI"],
    note: "東京時間午後。流動性が薄くレンジになりやすい。MA20・50＋RSIで判断し、明確なレンジ上限/下限のブレイク以外は見送り寄りに判定する。RSIの30/70からの反転を重視。" },
  "15": { label: "15時", zone: "東京クローズ前", ind: "MA20・50 ＋ RSI", cols: ["MA位置関係", "RSI"],
    note: "東京クローズ前で方向感が出にくい。MA20・50＋RSI。レンジ継続を前提に、ダマシを警戒して見送り寄りに判定する。" },
  "16": { label: "16時", zone: "欧州オープン", ind: "MA20・50 ＋ MACD", cols: ["MA位置関係", "MACD"],
    note: "欧州（ロンドン）が動き出しトレンドが発生しやすい。MA20・50の並びとMACDのクロスで順張り方向を判定。ボラ拡大の初動を狙う。" },
  "17": { label: "17時", zone: "ロンドン本格化", ind: "MA20・50 ＋ MACD", cols: ["MA位置関係", "MACD"],
    note: "ロンドンが本格化しボラが最大化する。MA20・50＋MACDでトレンド継続を判定。順張りを基本に、行き過ぎは見送る。" },
  "18": { label: "18時", zone: "欧州中盤", ind: "MA20・50 ＋ MACD", cols: ["MA位置関係", "MACD"],
    note: "欧州中盤。トレンド方向への押し目・戻り目（MA20タッチ）狙いを基本に判定。MACDの傾きで継続を確認する。" },
  "19": { label: "19時", zone: "欧州後半", ind: "MA20・50 ＋ MACD", cols: ["MA位置関係", "MACD"],
    note: "欧州後半。トレンド継続を見つつ過熱に注意。MA20・50＋MACDで押し目/戻り目を優先して判定する。" },
  "20": { label: "20時", zone: "NY前", ind: "出来高 ＋ ボリンジャーバンド", cols: ["BB状態", "出来高"],
    note: "NY参入前の溜めの時間帯。出来高＋ボリンジャーバンドで判定。BB拡大方向へのブレイクを狙い、スクイーズ中は見送る。NY初動のダマシに注意。" },
};

// ──────────────────────────────────────────────
// 計算ヘルパー
// ──────────────────────────────────────────────
function computeLevels(entry, direction, cfg) {
  const slOff = cfg.pip * cfg.slPips;
  const tpOff = cfg.pip * cfg.tpPips;
  if (direction === "buy" || direction === "long") return { tp: entry + tpOff, sl: entry - slOff };
  return { tp: entry - tpOff, sl: entry + slOff };
}

function fmt(n, decimals) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pips1(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (Math.round(n * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function postMetrics(cfg, dir, entry, price) {
  const e = Number(entry), p = Number(price);
  if (Number.isNaN(e) || Number.isNaN(p)) return null;
  const profitPips = dir === "long" ? (p - e) / cfg.pip : (e - p) / cfg.pip;
  const { tp, sl } = computeLevels(e, dir, cfg);
  return { profitPips, tp, sl, toTP: cfg.tpPips - profitPips, toSL: cfg.slPips + profitPips, win: profitPips >= 0 };
}

// ──────────────────────────────────────────────
// 出力パース
// ──────────────────────────────────────────────
function extractJSON(text) {
  let t = text.replace(/```json/gi, "").replace(/```/g, "");
  const sentinel = t.match(/===JSON===([\s\S]*?)===END===/);
  let s = sentinel ? sentinel[1] : t;
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("解析結果を読み取れませんでした。もう一度判定してください。");
  s = s.slice(start, end + 1);
  const repairs = [
    (x) => x,
    (x) => x
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/}\s*{/g, "},{")
      .replace(/]\s*\[/g, "],[")
      .replace(/,\s*([}\]])/g, "$1"),
  ];
  let lastErr;
  for (const fix of repairs) {
    try { return JSON.parse(fix(s)); } catch (e) { lastErr = e; }
  }
  throw new Error("解析結果の読み取りに失敗しました。もう一度判定してください。");
}

function extractPost(text) {
  const m = text.match(/===POST===([\s\S]*?)===END===/);
  let s = m ? m[1] : text;
  return s.replace(/```/g, "").trim();
}

// ──────────────────────────────────────────────
// プロンプト（判定）
// ──────────────────────────────────────────────
function buildJudgePrompt(cfg, hourKey, currentPrice) {
  const h = HOURS[hourKey];
  const priceLine = currentPrice
    ? `ユーザー申告の現在価格は ${currentPrice} です。これを現在価格の正としてエントリー計算の基準にしてください。`
    : `チャートの軸ラベルと最新ローソクから現在価格を読み取ってください。曖昧な場合はreasonにその旨を一言添えること。`;
  return `あなたは${cfg.label}（${cfg.sub}）専門のFXスキャルピング分析AIです。
添付された 4時間足・1時間足・30分足 のチャート画像を解析し、日本時間 ${h.label}（${h.zone}）として判断してください。
使用インジケーター：${h.ind}

# この時間帯のロジック
${h.note}

${priceLine}

# 共通判定ロジック（必ず buy か sell のどちらかを出す。見送りは禁止）
- 4H・1H・30M すべて同方向 → その方向。confidence: "strong"
- 2足が同方向・1足が逆 → 多数派の方向。confidence: "medium"
- 方向がバラバラ → 上位足を優先（4H＞1H＞30M）して方向を決める。confidence: "low"。reasonに根拠が弱い旨を添える
- どんな相場でも必ず buy か sell を出すこと

# エントリー価格のルール
- entryは現在価格から「${cfg.entryBandText}」の範囲内で方向に沿った現実的な指値を1つ。数値のみ

# ファンダメンタル
fundamentals には現在のFRB・日銀の基本スタンスと日米金利差の方向感を簡潔にまとめる（最新の個別指標は断定しない）

# 出力ルール（最重要）
- 分析文・前置きは一切書かず、下記JSONだけを ===JSON=== と ===END=== で囲んで出力
- 厳密に有効なJSON：配列要素はカンマ区切り／文字列内でダブルクオート禁止／末尾カンマ禁止／値は短い日本語

===JSON===
{"direction":"buy または sell","confidence":"strong または medium または low","reason":"判定理由を日本語で1〜2文","mtf":[{"tf":"4H","col1":"${h.cols[0]}の状態","col2":"${h.cols[1]}の状態","dir":"上昇または下降または中立"},{"tf":"1H","col1":"","col2":"","dir":""},{"tf":"30M","col1":"","col2":"","dir":""}],"fundamentals":"日本語で1文","scenario":"優勢シナリオを日本語で1文","entry":数値,"salon":"初心者向けコメント。日本語2〜3文"}
===END===`;
}

// ──────────────────────────────────────────────
// プロンプト（発信＝X投稿）
// ──────────────────────────────────────────────
const STYLE = `あなたはFXトレードを発信するXアカウントの運用者です。読み手はFX初心者。
煽りすぎず、わかりやすく、親しみやすい口調で、X（旧Twitter）用の投稿文を1つ作成してください。
絵文字は控えめに使ってよい。改行を使って読みやすく。ハッシュタグは付けても1〜2個まで。
投稿本文だけを ===POST=== と ===END=== で囲んで出力し、それ以外（前置き・解説）は書かないこと。`;

function dirJP(dir) { return dir === "long" ? "ロング（買い）" : "ショート（売り）"; }

function buildPostPrompt(phase, cfg, d) {
  const dirText = dirJP(d.dir);
  const lv = computeLevels(Number(d.entry), d.dir, cfg);
  const base = `${STYLE}

【銘柄】${cfg.label}（${cfg.sub}）
【方向】${dirText}
【エントリー価格】${fmt(Number(d.entry), cfg.decimals)}
【利確TP】${fmt(lv.tp, cfg.decimals)}（${cfg.tpText}）
【損切SL】${fmt(lv.sl, cfg.decimals)}（${cfg.slText}）`;

  if (phase === "entry") {
    return `${base}

# この投稿の目的：エントリー報告
- どの通貨で・どの方向で・いくらでエントリーしたかを伝える
- 利確(TP)と損切(SL)のラインを明記する
- これから30分ごとに進捗も公開していくので、フォローして通知をオンにしておきましょう、という趣旨で締める`;
  }

  const m = postMetrics(cfg, d.dir, d.entry, d.current);
  const factLines = m
    ? `【現在価格】${fmt(Number(d.current), cfg.decimals)}
【現在の損益】${m.profitPips >= 0 ? "+" : ""}${pips1(m.profitPips)}${cfg.unitWord}
【TPまで】あと${pips1(m.toTP)}${cfg.unitWord}　【SLまで】あと${pips1(m.toSL)}${cfg.unitWord}
【経過時間】${d.elapsed || "?"}分（最大保有2時間＝120分）`
    : "";
  const prevLine = d.prev
    ? `【前回ポスト時の価格】${fmt(Number(d.prev), cfg.decimals)}（そこからの変化も触れる）`
    : "";

  if (phase === "progress") {
    return `${base}

${factLines}
${prevLine}

# この投稿の目的：進捗報告
- 前回（前回価格があればそこ、なければエントリー）からどう変わったかを伝える
- これからどうなりそうか、軽い見通しを一言
- 進捗を公開し続けるので、フォローして通知をオンに、という趣旨で締める`;
  }

  if (phase === "preclose") {
    return `${base}

${factLines}

# この投稿の目的：決済前アナウンス
- そろそろ決済（利確 または 損切）に動くことを伝える
- 決済タイミングを知りたい人は、フォローして通知をオンに、という趣旨で締める`;
  }

  // closed（決済後）
  const cm = postMetrics(cfg, d.dir, d.entry, d.exit);
  const resultLine = cm
    ? `【決済価格】${fmt(Number(d.exit), cfg.decimals)}
【結果】${cm.profitPips >= 0 ? "+" : ""}${pips1(cm.profitPips)}${cfg.unitWord}（${cm.win ? "利確" : "損切"}）
【保有時間】${d.hold || "?"}分`
    : "";
  const amountLine = d.amount ? `【損益額】${d.amount}（この金額で表現してよい）` : "";
  const win = cm ? cm.win : true;

  if (win) {
    return `${base}

${resultLine}
${amountLine}

# この投稿の目的：利確報告
- ${d.amount ? d.amount + "を" : pips1(cm ? cm.profitPips : 0) + cfg.unitWord + "を"}利確できたことを伝える
- なぜ利確できたかを短く（方向に素直に伸びた／狙い通り等）
- 今回のトレードに乗り遅れた人は、フォローして通知をオンにして次回乗れるようにしましょう、という訴求で締める`;
  }
  return `${base}

${resultLine}
${amountLine}

# この投稿の目的：損切報告
- 今回は損切したことを正直に伝える
- ただ方向性は合っていて、一時的な逆行に巻き込まれただけ、という補足を入れる
- 次回この分を取り返していくので、フォローして通知をオンに、という趣旨で締める`;
}

// ──────────────────────────────────────────────
// API呼び出し（Netlify Function 経由）
// ──────────────────────────────────────────────
async function callClaude(content) {
  const res = await fetch("/.netlify/functions/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024, messages: [{ role: "user", content }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "APIエラーが発生しました");
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

// 画像は送信前に縮小（長辺1280px・JPEG）してペイロードを軽くする
function readFile(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxEdge = 1280;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const c = dataUrl.indexOf(",");
      cb({ data: dataUrl.slice(c + 1), mediaType: "image/jpeg", preview: dataUrl });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// ──────────────────────────────────────────────
// UI部品
// ──────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-blue-500";

// ──────────────────────────────────────────────
// メイン
// ──────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("judge"); // judge | post
  const [instKey, setInstKey] = useState("usdjpy");
  const cfg = INSTRUMENTS[instKey];

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
            <LineChart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">トレードシステム</h1>
            <p className="text-xs text-slate-500">チャート判定とX投稿文の生成</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-200 p-1">
          {[
            { k: "judge", label: "判定", Icon: Target },
            { k: "post", label: "発信（X投稿）", Icon: Megaphone },
          ].map((t) => (
            <button key={t.k} onClick={() => setMode(t.k)}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                mode === t.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}>
              <t.Icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs font-medium text-slate-500">銘柄</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(INSTRUMENTS).map((it) => (
              <button key={it.key} onClick={() => setInstKey(it.key)}
                className={`rounded-lg border px-3 py-3 text-left transition ${
                  instKey === it.key ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                <div className="text-sm font-semibold">{it.label}</div>
                <div className="font-mono text-[11px] text-slate-400">{it.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {mode === "judge" ? <JudgeMode cfg={cfg} /> : <PostMode cfg={cfg} />}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
          本ツールは教育目的の分析補助であり、投資助言ではありません。<br />
          AIが画像から読み取った価格は誤る場合があります。発注・発信前に必ずご自身で確認してください。
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 判定モード
// ──────────────────────────────────────────────
function JudgeMode({ cfg }) {
  const [hourKey, setHourKey] = useState("16");
  const [currentPrice, setCurrentPrice] = useState("");
  const [images, setImages] = useState({ h4: null, h1: null, m30: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const hour = HOURS[hourKey];
  const hasAnyImage = Object.values(images).some(Boolean);

  const onPick = (slot) => (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) readFile(file, (img) => setImages((p) => ({ ...p, [slot]: img })));
  };

  const analyze = async () => {
    setError(""); setResult(null); setLoading(true);
    try {
      const content = [];
      TF_ORDER.forEach((tf) => {
        const img = images[tf.key];
        if (img) {
          content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
          content.push({ type: "text", text: `↑ ${tf.label}のチャート` });
        }
      });
      content.push({ type: "text", text: buildJudgePrompt(cfg, hourKey, currentPrice.trim()) });
      const text = await callClaude(content);
      const parsed = extractJSON(text);
      const entryNum = parsed.entry == null ? null : Number(parsed.entry);
      let levels = null;
      if ((parsed.direction === "buy" || parsed.direction === "sell") && entryNum && !Number.isNaN(entryNum)) {
        levels = computeLevels(entryNum, parsed.direction, cfg);
      }
      setResult({ ...parsed, entry: entryNum, levels });
    } catch (e) {
      setError(e.message || "解析に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const verdict = result
    ? result.direction === "buy"
      ? { label: "ロング（買い）", Icon: ArrowUp, ring: "border-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" }
      : { label: "ショート（売り）", Icon: ArrowDown, ring: "border-rose-500", bg: "bg-rose-50", text: "text-rose-700" }
    : null;
  const confLabel = result && (result.confidence === "strong" ? "一致度：強" : result.confidence === "medium" ? "一致度：中" : "一致度：弱");

  return (
    <div>
      <div className="mb-4">
        <div className="mb-2 text-xs font-medium text-slate-500">時間帯（日本時間）</div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {Object.values(HOURS).map((h) => {
            const k = h.label.replace("時", "");
            const active = hourKey === k;
            return (
              <button key={k} onClick={() => setHourKey(k)}
                className={`rounded-lg border py-2 text-sm font-semibold transition ${
                  active ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}>
                {h.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">{hour.zone}</span>
          <span className="mx-1.5 text-slate-300">|</span>{hour.ind}
          <div className="mt-1 leading-relaxed text-slate-500">{hour.note}</div>
        </div>
      </div>

      <div className="mb-4">
        <Field label="現在価格（任意・入力すると読み取り精度が上がります）">
          <input type="text" inputMode="decimal" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} placeholder={`例：${cfg.ph}`} className={inputCls} />
        </Field>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-medium text-slate-500">チャート画像（最低1枚、3枚推奨）</div>
        <div className="grid grid-cols-3 gap-2">
          {TF_ORDER.map((tf) => (
            <label key={tf.key} className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-2 transition hover:border-blue-500">
              {images[tf.key] ? (
                <img src={images[tf.key].preview} alt={tf.label} className="mb-1 h-16 w-full rounded object-cover" />
              ) : (
                <div className="mb-1 flex h-16 w-full items-center justify-center"><Upload className="h-5 w-5 text-slate-400" /></div>
              )}
              <span className="text-[11px] text-slate-600">{tf.label}</span>
              <input type="file" accept="image/*" className="hidden" onChange={onPick(tf.key)} />
            </label>
          ))}
        </div>
      </div>

      <button onClick={analyze} disabled={loading || !hasAnyImage}
        className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {loading ? "解析中…" : "このチャートを判定する"}
      </button>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {result && verdict && (
        <div className="mt-4 space-y-3">
          <div className={`rounded-xl border-2 ${verdict.ring} ${verdict.bg} p-4`}>
            <div className="flex items-center gap-3">
              <verdict.Icon className={`h-9 w-9 ${verdict.text}`} />
              <div>
                <div className={`text-2xl font-extrabold ${verdict.text}`}>{verdict.label}</div>
                <div className="text-xs text-slate-600">{cfg.label}・{hour.label}（{hour.zone}）　|　{confLabel}</div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{result.reason}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-xs font-semibold text-slate-500">エントリーライン</div>
            {result.levels && result.entry ? (
              <div className="grid grid-cols-2 gap-y-2 font-mono text-sm">
                <div className="text-slate-500">エントリー</div><div className="text-right font-semibold">{fmt(result.entry, cfg.decimals)}</div>
                <div className="text-slate-500">TP（{cfg.tpText}）</div><div className="text-right font-semibold text-emerald-600">{fmt(result.levels.tp, cfg.decimals)}</div>
                <div className="text-slate-500">SL（{cfg.slText}）</div><div className="text-right font-semibold text-rose-600">{fmt(result.levels.sl, cfg.decimals)}</div>
                <div className="text-slate-500">RR比</div><div className="text-right">{cfg.rr}</div>
                <div className="flex items-center gap-1 text-slate-500"><Clock className="h-3.5 w-3.5" />タイムリミット</div><div className="text-right">2時間</div>
              </div>
            ) : (
              <div className="text-sm text-amber-700">価格を読み取れませんでした。現在価格を入力して、もう一度判定してください。</div>
            )}
          </div>

          {Array.isArray(result.mtf) && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-500">
                  <tr><th className="px-3 py-2">時間足</th><th className="px-3 py-2">{hour.cols[0]}</th><th className="px-3 py-2">{hour.cols[1]}</th><th className="px-3 py-2">方向感</th></tr>
                </thead>
                <tbody>
                  {result.mtf.map((r, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-semibold">{r.tf}</td>
                      <td className="px-3 py-2 text-slate-600">{r.col1}</td>
                      <td className="px-3 py-2 text-slate-600">{r.col2}</td>
                      <td className="px-3 py-2 text-slate-600">{r.dir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-1 text-xs font-semibold text-slate-500">ファンダ</div>
              <p className="text-sm leading-relaxed text-slate-700">{result.fundamentals}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-1 text-xs font-semibold text-slate-500">優勢シナリオ</div>
              <p className="text-sm leading-relaxed text-slate-700">{result.scenario}</p>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="mb-1 text-xs font-semibold text-blue-700">サロン配信用コメント</div>
            <p className="text-sm leading-relaxed text-slate-800">{result.salon}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 発信モード（X投稿生成）
// ──────────────────────────────────────────────
const PHASES = [
  { k: "entry", label: "エントリー" },
  { k: "progress", label: "進捗" },
  { k: "preclose", label: "決済前" },
  { k: "closed", label: "決済後" },
];

function PostMode({ cfg }) {
  const [phase, setPhase] = useState("entry");
  const [dir, setDir] = useState("long");
  const [entry, setEntry] = useState("");
  const [current, setCurrent] = useState("");
  const [prev, setPrev] = useState("");
  const [elapsed, setElapsed] = useState("");
  const [exit, setExit] = useState("");
  const [hold, setHold] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [post, setPost] = useState("");
  const [copied, setCopied] = useState(false);

  const needCurrent = phase === "progress" || phase === "preclose";
  const isClosed = phase === "closed";

  const lv = entry && !Number.isNaN(Number(entry)) ? computeLevels(Number(entry), dir, cfg) : null;
  const priceForMetric = isClosed ? exit : current;
  const m = entry && priceForMetric ? postMetrics(cfg, dir, entry, priceForMetric) : null;
  const timeLeft = elapsed ? Math.max(0, 120 - Number(elapsed)) : null;

  const canGenerate =
    entry &&
    (phase === "entry" || (needCurrent && current) || (isClosed && exit)) &&
    !loading;

  const generate = async () => {
    setError(""); setPost(""); setCopied(false); setLoading(true);
    try {
      const prompt = buildPostPrompt(phase, cfg, { dir, entry, current, prev, elapsed, exit, hold, amount });
      const text = await callClaude([{ type: "text", text: prompt }]);
      setPost(extractPost(text));
    } catch (e) {
      setError(e.message || "生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(post); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch (e) { setError("コピーできませんでした。本文を選択してコピーしてください。"); }
  };

  return (
    <div>
      <div className="mb-4">
        <div className="mb-2 text-xs font-medium text-slate-500">投稿フェーズ</div>
        <div className="grid grid-cols-4 gap-2">
          {PHASES.map((p) => (
            <button key={p.k} onClick={() => { setPhase(p.k); setPost(""); }}
              className={`rounded-lg border py-2 text-sm font-semibold transition ${
                phase === p.k ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-medium text-slate-500">方向</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setDir("long")}
            className={`rounded-lg border py-2 text-sm font-semibold transition ${dir === "long" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
            ロング（買い）
          </button>
          <button onClick={() => setDir("short")}
            className={`rounded-lg border py-2 text-sm font-semibold transition ${dir === "short" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600"}`}>
            ショート（売り）
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="エントリー価格"><input className={inputCls} inputMode="decimal" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder={cfg.ph} /></Field>
        {needCurrent && <Field label="現在価格"><input className={inputCls} inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={cfg.ph} /></Field>}
        {phase === "progress" && <Field label="前回ポスト時の価格（任意）"><input className={inputCls} inputMode="decimal" value={prev} onChange={(e) => setPrev(e.target.value)} placeholder="任意" /></Field>}
        {needCurrent && <Field label="経過時間（分）"><input className={inputCls} inputMode="numeric" value={elapsed} onChange={(e) => setElapsed(e.target.value)} placeholder="例：30" /></Field>}
        {isClosed && <Field label="決済価格"><input className={inputCls} inputMode="decimal" value={exit} onChange={(e) => setExit(e.target.value)} placeholder={cfg.ph} /></Field>}
        {isClosed && <Field label="保有時間（分）"><input className={inputCls} inputMode="numeric" value={hold} onChange={(e) => setHold(e.target.value)} placeholder="例：85" /></Field>}
        {isClosed && <Field label="損益額（任意・例: +2,000円）"><input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="任意" /></Field>}
      </div>

      {lv && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
          <div className="mb-2 font-semibold text-slate-500">自動計算</div>
          <div className="grid grid-cols-2 gap-y-1 font-mono">
            <span className="text-slate-500">TP</span><span className="text-right text-emerald-600">{fmt(lv.tp, cfg.decimals)}</span>
            <span className="text-slate-500">SL</span><span className="text-right text-rose-600">{fmt(lv.sl, cfg.decimals)}</span>
            {m && (<>
              <span className="text-slate-500">現在損益</span>
              <span className={`text-right font-semibold ${m.profitPips >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{m.profitPips >= 0 ? "+" : ""}{pips1(m.profitPips)}{cfg.unitWord}</span>
              {!isClosed && (<>
                <span className="text-slate-500">TPまで / SLまで</span>
                <span className="text-right">あと{pips1(m.toTP)} / {pips1(m.toSL)}{cfg.unitWord}</span>
              </>)}
            </>)}
            {timeLeft !== null && !isClosed && (<>
              <span className="text-slate-500">タイムリミットまで</span><span className="text-right">残り{timeLeft}分</span>
            </>)}
            {isClosed && m && (<>
              <span className="text-slate-500">判定</span><span className={`text-right font-semibold ${m.win ? "text-emerald-600" : "text-rose-600"}`}>{m.win ? "利確" : "損切"}</span>
            </>)}
          </div>
        </div>
      )}

      <button onClick={generate} disabled={!canGenerate}
        className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
        {loading ? "生成中…" : "投稿文を生成する"}
      </button>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {post && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-blue-700">X投稿文（{PHASES.find((p) => p.k === phase).label}）</div>
            <button onClick={copy} className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-blue-700 shadow-sm hover:bg-blue-100">
              {copied ? <><Check className="h-3.5 w-3.5" />コピー済み</> : <><Copy className="h-3.5 w-3.5" />コピー</>}
            </button>
          </div>
          <textarea readOnly value={post} className="h-56 w-full resize-none rounded-lg border border-blue-200 bg-white p-3 text-sm leading-relaxed text-slate-800 outline-none" />
        </div>
      )}
    </div>
  );
}
