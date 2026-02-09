import {
  CHAT_MAX_TOKENS,
  CHAT_TEMPERATURE,
  CHAT_TIMEOUT_MS,
  gatewayBaseUrl,
  openaiKey,
  openaiModel,
} from "../config.js";
import { Agent } from "undici";
import { GoogleGenAI } from "@google/genai";

// Avoid undici's default 10s connect timeout in slower networks.
const gatewayConnectTimeoutMs = Number(process.env.GATEWAY_CONNECT_TIMEOUT_MS || CHAT_TIMEOUT_MS || 30000);
const gatewayDispatcher = new Agent({
  connectTimeout: Number.isFinite(gatewayConnectTimeoutMs) ? gatewayConnectTimeoutMs : 30000,
});

let geminiClient;
const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
};

const buildPromptFromMessages = (messages) =>
  (messages || [])
    .map((m) => `${String(m?.role || "user").toUpperCase()}:\n${String(m?.content || "")}`)
    .join("\n\n");

const coerceGeminiModel = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("models/") || raw.startsWith("tunedModels/")) return raw;
  // Allow passing 'gemini-2.0-flash' without prefix.
  if (raw.startsWith("gemini-")) return `models/${raw}`;
  return null;
};

const callGeminiFallback = async (messages, modelOverride) => {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  const modelToUse = coerceGeminiModel(modelOverride)
    || process.env.GEMINI_CHAT_MODEL
    || "models/gemini-2.0-flash";

  const prompt = buildPromptFromMessages(messages);
  const response = await ai.models.generateContent({
    model: modelToUse,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const text =
    (typeof response?.text === "string" && response.text.trim())
    || response?.candidates?.[0]?.content?.parts
      ?.map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim()
    || "";

  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  // Return an OpenAI-like shape to keep the rest of the code unchanged.
  return {
    provider: "gemini",
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
};

export const callOpenAiGateway = async (messages, modelOverride) => {
  // If the gateway key isn't configured, fall back to Gemini if available.
  if (!openaiKey) {
    return await callGeminiFallback(messages, modelOverride);
  }

  const modelToUse = modelOverride || openaiModel;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${gatewayBaseUrl}/chat/completions`, {
      method: "POST",
      dispatcher: gatewayDispatcher,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: modelToUse,
        messages,
        temperature: CHAT_TEMPERATURE,
        max_tokens: CHAT_MAX_TOKENS,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    // Network failures to the gateway are common on some networks.
    // Fall back to Gemini if it's configured.
    const ai = getGeminiClient();
    if (ai) {
      console.warn("Gateway fetch failed; falling back to Gemini.", error);
      return await callGeminiFallback(messages, modelOverride);
    }
    if (error?.name === "AbortError") {
      throw new Error("Chat request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    // If the gateway rejects/errs and Gemini is configured, try Gemini.
    const ai = getGeminiClient();
    if (ai) {
      console.warn("Gateway returned non-200; falling back to Gemini.", errorText || response.statusText);
      return await callGeminiFallback(messages, modelOverride);
    }
    throw new Error(errorText || response.statusText);
  }

  return response.json();
};

export const isGreeting = (text = "") => {
  const normalized = text.toLowerCase();
  const greetingPatterns = [
    /(^|\s)(hi|hello|hey)\b/,
    /สวัสดี/,
    /หวัดดี/,
    /ดีครับ/,
    /ดีค่ะ/,
    /ขอบคุณ/,
    /thank you/,
    /thanks/,
  ];
  return greetingPatterns.some((pattern) => pattern.test(normalized));
};

export const isGreetingOnly = (text = "") => {
  const normalized = text.toLowerCase().trim();
  const patterns = [
    /^(hi|hello|hey)[!?.\s]*$/,
    /^สวัสดี(ครับ|ค่ะ|นะ)?[!?.\s]*$/,
    /^หวัดดี(ครับ|ค่ะ|นะ)?[!?.\s]*$/,
    /^ดีครับ[!?.\s]*$/,
    /^ดีค่ะ[!?.\s]*$/,
    /^ขอบคุณ(ครับ|ค่ะ|นะ)?[!?.\s]*$/,
    /^(thank you|thanks)[!?.\s]*$/,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
};
