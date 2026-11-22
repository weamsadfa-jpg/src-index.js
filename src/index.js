export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    // تحقق اختياري من مفتاح مشترك بين السيرفر والـ Worker
    if (env.SHARED_SECRET) {
      const token = request.headers.get("X-Roblox-Key");
      if (token !== env.SHARED_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const body = await request.json().catch(() => null);
    const prompt = body && typeof body.message === "string" ? body.message.trim() : "";

    if (!prompt) {
      return new Response(JSON.stringify({ ok: false, error: "Empty message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing GEMINI_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // استدعاء نموذج Gemini عبر REST API
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    const geminiPayload = {
      systemInstruction: {
        parts: [
          {
            text: "أنت مساعد ذكي داخل لعبة روبلوكس. أجب بإيجاز ووضوح وباللغة التي يكتب بها اللاعب، وتجنب النصوص الطويلة جداً لتناسب شاشة اللعبة."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt.slice(0, 1000) }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 350
      }
    };

    try {
      const geminiRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload)
      });

      const geminiData = await geminiRes.json();

      if (!geminiRes.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: geminiData?.error?.message || "Gemini API error"
          }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }

      const replyText =
        geminiData?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("")
          .trim() || "لم أتمكن من توليد رد حالياً.";

      return new Response(JSON.stringify({ ok: true, reply: replyText }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: "Network failure to Gemini" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
