// Anthropic API への中継関数（APIキーはここ＝サーバー側だけで使う）
// 環境変数 ANTHROPIC_API_KEY を Netlify の管理画面で設定すること。
export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: "ANTHROPIC_API_KEY が未設定です（Netlifyの環境変数を確認）" } }),
    };
  }
  try {
    const body = JSON.parse(event.body); // { model, max_tokens, messages, tools? }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-4-6",
        max_tokens: body.max_tokens || 1024,
        messages: body.messages,
        ...(body.tools ? { tools: body.tools } : {}),
      }),
    });
    const data = await res.json();
    return {
      statusCode: res.status,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: { message: e.message } }) };
  }
};
