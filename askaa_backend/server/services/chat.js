import {
  CHAT_MAX_TOKENS,
  CHAT_TEMPERATURE,
  CHAT_TIMEOUT_MS,
  gatewayBaseUrl,
  openaiKey,
  openaiModel,
} from "../config.js";
import { Agent } from "undici";

const gatewayConnectTimeoutMs = Number(process.env.GATEWAY_CONNECT_TIMEOUT_MS || CHAT_TIMEOUT_MS || 30000);
const gatewayDispatcher = new Agent({
  connectTimeout: Number.isFinite(gatewayConnectTimeoutMs) ? gatewayConnectTimeoutMs : 30000,
});

export const callOpenAiGateway = async (messages, modelOverride) => {
  if (!openaiKey) {
    throw new Error("Configure OPENAI_API_KEY (or gateway key) in .env.local for chat.");
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
    if (error?.name === "AbortError") {
      throw new Error("Chat request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
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
