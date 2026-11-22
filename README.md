export default {
  async fetch(request, env) {
    const jsonHeaders = {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Roblox-Key"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: jsonHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
        status: 405,
        headers: jsonHeaders
      });
    }

    if (env.SHARED_SECRET) {
      const token = request.headers.get("X-Roblox-Key");
      if (token !== env.SHARED_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: jsonHeaders
        });
      }
    }

    const body = await request.json().catch(() => null);
    const prompt = body && typeof body.message === "string" ? body.message.trim() : "";

    if (!prompt) {
      return new Response(JSON.stringify({ ok: false, error: "Empty message" }), {
        status: 400,
        headers: jsonHeaders
      });
    }

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing GEMINI_API_KEY in Worker" }), {
        status: 500,
        headers: jsonHeaders
      });
    }

    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const geminiPayload = {
      systemInstruction: {
        parts: [
          {
            text: "أنت مساعد ذكي داخل لعبة روبلوكس. أجب بإيجاز ووضوح وباللغة التي يكتب بها اللاعب."
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
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify(geminiPayload)
      });

      const rawText = await geminiRes.text();
      let geminiData = null;
      try {
        geminiData = JSON.parse(rawText);
      } catch (_) {
        geminiData = null;
      }

      if (!geminiRes.ok) {
        const errMsg =
          geminiData?.error?.message ||
          rawText.slice(0, 200) ||
          `Gemini HTTP ${geminiRes.status}`;
        return new Response(JSON.stringify({ ok: false, error: errMsg }), {
          status: 200,
          headers: jsonHeaders
        });
      }

      const replyText =
        geminiData?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("")
          .trim() || "لم أتمكن من توليد رد حالياً.";

      return new Response(JSON.stringify({ ok: true, reply: replyText }), {
        status: 200,
        headers: jsonHeaders
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: err?.message || "Network error to Gemini" }),
        {
          status: 200,
          headers: jsonHeaders
        }
      );
    }
  }
};
