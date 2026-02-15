import express from "express";
import { prisma } from "../db.js";
import { authenticate } from "../lib/auth.js";
import { rateLimit } from "../lib/rateLimit.js";
import {
  cacheDel,
  cacheGet,
  cacheSet,
  conversationMessagesKey,
  invalidateConversationCaches,
  userCacheKey,
} from "../lib/cache.js";
import { buildContextPiecesWithNeighbors } from "../services/text.js";
import { retrieveGroundingChunks } from "../services/rag.js";
import { callOpenAiGateway, isGreeting, isGreetingOnly } from "../services/chat.js";
import { getOrCreateUsageDaily } from "../services/usage.js";
import { CONTEXT_NEIGHBOR_WINDOW, FREE_DAILY_TOKEN_LIMIT, FREE_KNOWLEDGE_LIMIT, GREETING_REPLY, MAX_CHAT_HISTORY_MESSAGES, MAX_CONTEXT_PIECES, MAX_DAILY_CHAT_MESSAGES } from "../config.js";

export const conversationsRouter = express.Router();
export const messagesRouter = express.Router();
export const chatRouter = express.Router();

const HELP_BOT_NAME = "บอทช่วยสอน";

/** ความรู้เกี่ยวกับระบบ (สำหรับบอทช่วยสอน) — ครอบคลุมเกือบทุกฟีเจอร์ในเว็บ */
function getHelpBotSystemKnowledge() {
  const knowledgeLimit = Number.isFinite(FREE_KNOWLEDGE_LIMIT) ? FREE_KNOWLEDGE_LIMIT : 30;
  const tokenLimit = Number.isFinite(FREE_DAILY_TOKEN_LIMIT) ? FREE_DAILY_TOKEN_LIMIT : 50000;
  const chatMessagesLimit = Number.isFinite(MAX_DAILY_CHAT_MESSAGES) ? MAX_DAILY_CHAT_MESSAGES : 2000;
  return `
คุณคือบอทช่วยสอนการใช้งานระบบบิงซูบอท (Bingsu Bot) คุณรู้จักระบบเกือบทุกอย่าง — ใช้ตอบคำถามวิธีใช้ ขั้นตอน กดตรงไหน เปลี่ยนโปรไฟล์ ลบแชท จำกัดการใช้งาน ได้เสมือนคุณเข้าใจทั้งระบบ

ความรู้เกี่ยวกับระบบ (ใช้ตอบเมื่อผู้ใช้ถามวิธีใช้):

【หน้าแรก / การแชท】
- หน้าแรก (Homepage): มี dropdown "Select Knowledge" เลือกชุดความรู้, dropdown "Select Bot" เลือกบอท (ถ้ามีหลายตัว), และช่องพิมพ์คำถามด้านล่าง — เลือก Knowledge กับ Bot แล้วพิมพ์คำถามแล้วกดส่งหรือ Enter เพื่อเริ่มแชท
- การแชท: หลังส่งคำถาม ระบบจะสร้างบทสนทนาใหม่และพาไปหน้าแชท — ในแชทสามารถถามติดตามได้ (บอทจดจำคำถามก่อนหน้า)
- ในแชทผู้ใช้สามารถสั่งบอทเปลี่ยนสไตล์การพูดได้ เช่น "ใช้ค่ะแทนครับ" "คุยแบบเพื่อน" โดยพิมพ์ในแชทแล้วบอทจะตอบตามนั้น

【แถบด้านข้าง (Sidebar)】
- ด้านบน: ลิงก์ไป หน้าแรก, Bots, Knowledge
- กลาง: รายการบทสนทนา (แชท) ที่เคยเปิด — คลิกเพื่อกลับไปแชทนั้น
- แต่ละแชทมีปุ่มเมนู (จุดสามจุดหรือไอคอนเมนู) — กดแล้วเลือก "ลบ" เพื่อลบประวัติสนทนานั้น (จะมีกล่องยืนยัน "คุณต้องการลบแชทนี้หรือไม่") ลบแล้วแชทจะหายจากรายการและไม่กู้คืนได้
- ด้านล่าง: รูปโปรไฟล์และคำว่า "Profile" — คลิกเพื่อเปิดเมนูโปรไฟล์ (Profile modal)

【โปรไฟล์ / เปลี่ยนรูป / ตั้งค่าบัญชี】
- คลิกรูปโปรไฟล์หรือ "Profile" ที่แถบด้านข้างด้านล่าง → เปิดหน้าต่างโปรไฟล์
- ในหน้าต่างโปรไฟล์: มีปุ่ม "จัดการบัญชี" — กดเพื่อเปิดหน้าต่าง "ตั้งค่าบัญชี"
- ตั้งค่าบัญชี (Account): แก้ชื่อ (name), เปลี่ยนรูปโปรไฟล์ (avatar) — สามารถอัปโหลดรูปจากเครื่อง (เลือกไฟล์) หรือใส่ URL รูป แล้วกด "บันทึก" มีปุ่ม "เปลี่ยนรหัสผ่าน" ถ้าต้องการเปลี่ยนรหัสผ่าน
- อีเมลแสดงในหน้าต่างแต่โดยทั่วไปแก้ไม่ได้ (เป็นตัวตนในการล็อกอิน)

【Bots (บอท)】
- เมนู Bots (แถบด้านข้าง): ใช้สร้างและจัดการบอท — กด "สร้างบอท" หรือ "Create Bot"
- สร้างบอท: ใส่ชื่อบอท, พรอมต์ (คำสั่งให้บอทปฏิบัติ เช่น ตอบแบบสุภาพ), คำอธิบายสั้น ๆ, เลือก Knowledge ที่บอทจะใช้ตอบคำถาม แล้วบันทึก
- แก้ไข/ลบบอท: เข้าเมนู Bots แล้วเลือกบอทที่ต้องการแก้หรือลบ

【Knowledge (ชุดความรู้)】
- เมนู Knowledge (แถบด้านข้าง): ใช้สร้างชุดความรู้และอัปโหลดไฟล์ (เช่น PDF) ระบบจะประมวลผลและใช้เป็นฐานความรู้ให้บอทค้นคำตอบ
- สร้าง Knowledge: กดสร้าง Knowledge ใส่ชื่อ จากนั้นอัปโหลดไฟล์ (รองรับ PDF ฯลฯ) ระบบจะประมวลผลอัตโนมัติ
- จำนวนชุด Knowledge ที่สร้างได้: สูงสุด ${knowledgeLimit} ชุดต่อผู้ใช้ (แผนฟรี) — ถ้าถามว่า "เพิ่ม Knowledge ได้มั้ย" หรือ "จำกัดเท่าไหร่" ให้บอกว่าสร้างได้สูงสุด ${knowledgeLimit} ชุด

【การใช้งาน / โทเค็น / ข้อความต่อวัน】
- แผนฟรี: ใช้โทเค็น (Token) สำหรับแชทได้ประมาณ ${tokenLimit.toLocaleString()} โทเค็นต่อวัน; จำนวนข้อความแชทต่อวันประมาณ ${chatMessagesLimit.toLocaleString()} ข้อความ (แล้วแต่การตั้งค่าเซิร์ฟเวอร์)
- ในหน้าแชทจะมีแสดง Token ที่ใช้วันนี้ (ถ้ามี) — ถ้าถามว่า "จำกัดเท่าไหร่" หรือ "ใช้ได้วันละเท่าไหร่" ให้อ้างอิงตัวเลขด้านบน

【อื่นๆ】
- คำถามติดตาม: ถ้าผู้ใช้ถาม "ทำยังไง" "กดตรงไหน" "อธิบายเพิ่ม" "ขั้นตอนละเอียด" "เปลี่ยนรูปยังไง" "ลบแชทยังไง" — อธิบายเป็นขั้นตอนชัดเจนเป็นภาษาไทย โดยอิงจากความรู้ด้านบนและจาก Context (คู่มือ) เมื่อมี
- ห้ามดึงข้อมูลจากภายนอกระบบ (ข่าว, วิกิ ความรู้ทั่วไป สิ่งของ นิยามคำศัพท์นอกระบบ). ตอบเฉพาะเรื่องการใช้งานระบบบิงซูและจาก Context ที่ให้มาเท่านั้น
- ถ้าผู้ใช้ถามเรื่องที่ไม่เกี่ยวกับระบบหรือคู่มือ (เช่น "X คืออะไร" ที่ X เป็นสิ่งของ/คำศัพท์ทั่วไป ไม่ใช่ฟีเจอร์ในระบบ) ให้ตอบว่า "คำถามนี้อยู่นอกขอบเขตของระบบครับ ผมตอบได้เฉพาะเรื่องวิธีใช้ระบบบิงซูบอทและคู่มือการใช้งานเท่านั้น" และอย่าตอบจากความรู้ทั่วไป
`.trim();
}

const PLATFORM_VALUES = new Set(["line", "messenger", "website", "api", "sandbox"]);
const getPlatform = (req) => {
  const raw = req.headers["x-client-platform"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const normalized = String(value || "").trim().toLowerCase();
  return PLATFORM_VALUES.has(normalized) ? normalized : "website";
};

const coerceInt = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
};

const getTokenUsage = (gatewayResponse) => {
  const usage = gatewayResponse?.usage || {};
  return {
    promptTokens: coerceInt(usage.prompt_tokens ?? usage.promptTokens),
    completionTokens: coerceInt(usage.completion_tokens ?? usage.completionTokens),
    totalTokens: coerceInt(usage.total_tokens ?? usage.totalTokens),
  };
};

conversationsRouter.post("/", authenticate, async (req, res) => {
  const { documentId, botId } = req.body ?? {};

  if (!documentId) {
    res.status(400).json({ error: "documentId is required" });
    return;
  }

  let document = await prisma.document.findFirst({
    where: {
      id: documentId,
      OR: [
        { ownerId: req.user.id },
        { shares: { some: { userId: req.user.id } } },
      ],
    },
  });
  if (!document) {
    const helpDoc = await prisma.document.findFirst({
      where: { id: documentId, displayName: "คู่มือการใช้งาน" },
    });
    if (helpDoc) document = helpDoc;
  }
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  let bot = null;
  if (botId) {
    bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        OR: [
          { ownerId: req.user.id },
          { name: "บอทช่วยสอน" },
        ],
      },
    });
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      documentId,
      userId: req.user.id,
      botId: bot?.id ?? undefined,
    },
  });

  res.status(201).json(conversation);
  await invalidateConversationCaches(conversation.id, req.user.id);
});

conversationsRouter.get("/", authenticate, async (req, res) => {
  const cacheKey = userCacheKey("conversations", req.user.id);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }
  const conversations = await prisma.conversation.findMany({
    where: { userId: req.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      document: { select: { id: true, displayName: true } },
      bot: { select: { id: true, name: true } },
      messages: {
        select: { content: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const payload = conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    document: conversation.document,
    bot: conversation.bot,
    lastMessage: conversation.messages[0]?.content ?? null,
  }));
  res.json(payload);
  await cacheSet(cacheKey, payload);
});

conversationsRouter.delete("/", authenticate, async (req, res) => {
  await prisma.conversation.deleteMany({
    where: { userId: req.user.id },
  });
  res.json({ ok: true });
  await cacheDel(userCacheKey("conversations", req.user.id));
});

conversationsRouter.delete("/:id", authenticate, async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await prisma.conversation.delete({ where: { id: conversation.id } });
  res.json({ ok: true });
  await invalidateConversationCaches(conversation.id, req.user.id);
});

conversationsRouter.get("/:id/messages", authenticate, async (req, res) => {
  const conversationId = req.params.id;
  const rawLimit = Number(req.query.limit || 50);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: req.user.id },
  });

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const cacheKey = conversationMessagesKey(conversationId, limit);
  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      feedbacks: {
        where: { userId: req.user.id },
        select: { rating: true },
      },
    },
  });

  const payload = messages
    .reverse()
    .map(({ feedbacks, ...message }) => ({
      ...message,
      feedback: feedbacks?.[0]?.rating ?? null,
    }));
  res.json(payload);
  await cacheSet(cacheKey, payload);
});

messagesRouter.post("/", authenticate, async (req, res) => {
  const { conversationId, role, content, groundingChunks } = req.body ?? {};

  if (!conversationId || !role || !content) {
    res.status(400).json({ error: "conversationId, role and content are required" });
    return;
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: req.user.id },
  });

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      userId: role === "user" ? req.user.id : undefined,
      role,
      content,
      groundingChunks: groundingChunks ?? undefined,
      platform: getPlatform(req),
    },
  });

  const updates = { updatedAt: new Date() };
  if (!conversation.title && role === "user") {
    updates.title = content.trim().slice(0, 80);
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: updates,
  });

  res.status(201).json(message);
  await invalidateConversationCaches(conversation.id, req.user.id);
});

messagesRouter.post("/:id/feedback", authenticate, async (req, res) => {
  const { rating, comment } = req.body ?? {};
  const normalizedRating = String(rating || "").toLowerCase();
  if (!["up", "down"].includes(normalizedRating)) {
    res.status(400).json({ error: "rating must be up or down" });
    return;
  }

  const message = await prisma.message.findFirst({
    where: {
      id: req.params.id,
      conversation: { userId: req.user.id },
    },
  });
  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  if (message.role !== "model") {
    res.status(400).json({ error: "Feedback is only allowed for model messages" });
    return;
  }

  const sanitizedComment = typeof comment === "string" && comment.trim() ? comment.trim().slice(0, 500) : null;
  const feedback = await prisma.messageFeedback.upsert({
    where: {
      messageId_userId: { messageId: message.id, userId: req.user.id },
    },
    update: { rating: normalizedRating, comment: sanitizedComment },
    create: { messageId: message.id, userId: req.user.id, rating: normalizedRating, comment: sanitizedComment },
  });

  res.json({ ok: true, rating: feedback.rating });
});

chatRouter.post("/", authenticate, async (req, res) => {
  const { conversationId, message } = req.body ?? {};

  if (!conversationId || !message) {
    res.status(400).json({ error: "conversationId and message are required" });
    return;
  }
  if (!(await rateLimit(`chat:${req.user.id}`))) {
    res.status(429).json({ error: "Rate limit exceeded" });
    return;
  }

  const usage = await getOrCreateUsageDaily(req.user.id);
  if (usage.chatCount >= MAX_DAILY_CHAT_MESSAGES) {
    res.status(429).json({ error: "Daily chat quota exceeded" });
    return;
  }
  if (FREE_DAILY_TOKEN_LIMIT > 0 && (usage.totalTokens ?? 0) >= FREE_DAILY_TOKEN_LIMIT) {
    res.status(429).json({ error: "Daily token quota exceeded" });
    return;
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId: req.user.id },
    include: {
      document: true,
      bot: {
        include: {
          documents: {
            include: { document: true },
          },
        },
      },
    },
  });

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const greetingOnly = isGreetingOnly(message);
  if (greetingOnly) {
    res.json({ reply: GREETING_REPLY, groundingChunks: [] });
    void (async () => {
      await prisma.message.create({
        data: {
          conversationId,
          userId: req.user.id,
          role: "user",
          content: message,
          platform: getPlatform(req),
        },
      });
      await prisma.message.create({
        data: {
          conversationId,
          role: "model",
          content: GREETING_REPLY,
          platform: getPlatform(req),
        },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date(), title: conversation.title ?? message.trim().slice(0, 80) },
      });
      await prisma.usageDaily.update({
        where: { id: usage.id },
        data: { chatCount: { increment: 1 } },
      });
      await invalidateConversationCaches(conversation.id, req.user.id);
    })().catch((error) => console.error("Greeting save failed", error));
    return;
  }

  const botDocIds = conversation.bot?.documents
    ?.map((link) => link.document?.id)
    .filter(Boolean);
  const documentIds = botDocIds && botDocIds.length > 0
    ? botDocIds
    : [conversation.document.id];

  const groundingChunks = await retrieveGroundingChunks(documentIds, message);
  const contextDocuments =
    botDocIds && botDocIds.length > 0
      ? conversation.bot?.documents?.map((link) => link.document).filter(Boolean)
      : [conversation.document];
  const contextPieces = buildContextPiecesWithNeighbors(groundingChunks, contextDocuments, message, {
    maxPieces: Number.isFinite(MAX_CONTEXT_PIECES) ? MAX_CONTEXT_PIECES : 3,
    neighborWindow: Number.isFinite(CONTEXT_NEIGHBOR_WINDOW) ? CONTEXT_NEIGHBOR_WINDOW : 0,
  });
  const contextText = contextPieces.join("\n\n---\n\n");
  const isHelpBot = conversation.bot?.name === HELP_BOT_NAME;

  const policyPrompt = isHelpBot
    ? [
        "You are a helpful Thai AI that teaches users how to use the Bingsu Bot system.",
        "Scope (ขอบเขต): ตอบเฉพาะเรื่อง (1) วิธีใช้ระบบบิงซูบอท และ (2) เนื้อหาจากคู่มือการใช้งาน (Context) เท่านั้น ห้ามใช้ความรู้จากภายนอก (วิกิ ข่าว ความรู้ทั่วไป สิ่งของ นิยามคำศัพท์นอกระบบ).",
        "Rules:",
        "1) Use the System Knowledge below to answer usage questions (how to create bot, where to click, steps, explain more, what is this).",
        "2) When Context from the user guide is provided, use it to enrich your answer. You may combine System Knowledge + Context.",
        "3) Remember the previous questions and answers in this conversation. When the user asks a follow-up (อธิบายเพิ่ม, แล้วล่ะ, ขั้นตอนถัดไป, คืออะไร, กดตรงไหน), refer to the topic or question you just discussed and answer in that context.",
        "4) Answer follow-up questions clearly in Thai, step by step if needed.",
        "5) If the user asks about something OUTSIDE scope (e.g. general knowledge, what is X, definition of things unrelated to the system or the user guide), you MUST reply exactly: \"คำถามนี้อยู่นอกขอบเขตของระบบครับ ผมตอบได้เฉพาะเรื่องวิธีใช้ระบบบิงซูบอทและคู่มือการใช้งานเท่านั้น\" Do NOT answer from your general knowledge.",
        "6) Be friendly and concise. If the user does not understand, explain in simpler words or break into smaller steps.",
        "7) If the user asks you to change how you speak (e.g. ใช้ค่ะแทนครับ, คุยแบบเพื่อน, พูดแบบทางการ), acknowledge and use that style from then on.",
      ].join("\n")
    : [
        "You are a polite, friendly Thai AI assistant. Answer in Thai.",
        "Scope (ขอบเขต): ตอบเฉพาะจาก Context (ชุดความรู้ที่ผูกกับบอท) เท่านั้น ห้ามใช้ความรู้จากภายนอก (วิกิ ข่าว ความรู้ทั่วไป). ถ้าคำถามไม่เกี่ยวกับเนื้อหาใน Context ให้ปฏิเสธเท่านั้น.",
        "Rules:",
        "1) Greetings are allowed (e.g. สวัสดี, ขอบคุณ).",
        "2) Base your answer ONLY on the given Context. Do not use outside knowledge or guess.",
        "2.1) Read the Context first, then answer in natural Thai. Paraphrase and summarize in your own words.",
        "2.2) Do NOT copy long passages from Context. If you must quote, quote ONLY short phrases (<= 20 words) and put them in quotes.",
        "3) Remember the previous questions and answers in this conversation. When the user asks a follow-up (อธิบายเพิ่ม, แล้วล่ะ, ขั้นตอนถัดไป, คืออะไร, มีอะไรบ้าง), treat it as referring to the topic or question you just discussed — answer in that context using Context and what you already said.",
        "4) If the answer is not in Context and cannot be inferred from the conversation, OR if the user asks about something unrelated to the Context (e.g. general knowledge, what is X, things not in the documents), reply exactly: \"ขออภัยครับ ข้อมูลส่วนนี้ไม่มีอยู่ในฐานข้อมูลของผม\" Do NOT answer from your general knowledge.",
        "5) Do not introduce information from outside the Context or the conversation.",
        "6) If the user asks you to change how you speak (e.g. ใช้ค่ะแทนครับ, คุยแบบเพื่อน, พูดแบบทางการ), acknowledge and use that style from then on.",
      ].join("\n");

  const systemParts = [
    conversation.bot?.prompt ? `Bot prompt:\n${conversation.bot.prompt}` : null,
    policyPrompt,
  ];
  if (isHelpBot) {
    systemParts.push(`System Knowledge (use this to answer usage questions):\n${getHelpBotSystemKnowledge()}`);
  }
  const systemPrompt = systemParts.filter(Boolean).join("\n\n");

  if (!contextText && !isHelpBot && !isGreeting(message)) {
    const fallbackReply = "ขออภัยครับ ข้อมูลส่วนนี้ไม่มีอยู่ในฐานข้อมูลของผม";
    res.json({ reply: fallbackReply, groundingChunks: [] });
    void (async () => {
      await prisma.message.create({
        data: {
          conversationId,
          userId: req.user.id,
          role: "user",
          content: message,
          platform: getPlatform(req),
        },
      });
      await prisma.message.create({
        data: {
          conversationId,
          role: "model",
          content: fallbackReply,
          platform: getPlatform(req),
        },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date(), title: conversation.title ?? message.trim().slice(0, 80) },
      });
      await prisma.usageDaily.update({
        where: { id: usage.id },
        data: { chatCount: { increment: 1 } },
      });
      await invalidateConversationCaches(conversation.id, req.user.id);
    })().catch((error) => console.error("Fallback save failed", error));
    return;
  }

  const historyLimit = Math.max(0, Number.isFinite(MAX_CHAT_HISTORY_MESSAGES) ? MAX_CHAT_HISTORY_MESSAGES : 20);
  const historyRows =
    historyLimit > 0
      ? await prisma.message.findMany({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
          take: historyLimit,
          select: { role: true, content: true },
        })
      : [];
  const historyMessages = historyRows
    .reverse()
    .map((m) => ({
      role: m.role === "model" ? "assistant" : "user",
      content: String(m.content ?? "").trim(),
    }))
    .filter((m) => m.content.length > 0);

  const contextLabel = isHelpBot ? "Context (from user guide)" : "Context";
  const messages = [
    { role: "system", content: systemPrompt },
    ...(contextText ? [{ role: "system", content: `${contextLabel}:\n${contextText}` }] : []),
    ...historyMessages,
    { role: "user", content: message },
  ];

  try {
    await prisma.message.create({
      data: {
        conversationId,
        userId: req.user.id,
        role: "user",
        content: message,
        platform: getPlatform(req),
      },
    });

    const gatewayResponse = await callOpenAiGateway(messages, conversation.bot?.model);
    const tokenUsage = getTokenUsage(gatewayResponse);
    const reply =
      gatewayResponse?.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I could not generate a response.";

    const modelMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "model",
        content: reply,
        groundingChunks: groundingChunks ?? undefined,
        platform: getPlatform(req),
      },
    });

    const updates = { updatedAt: new Date() };
    if (!conversation.title) {
      updates.title = message.trim().slice(0, 80);
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: updates,
    });
    await prisma.usageDaily.update({
      where: { id: usage.id },
      data: {
        chatCount: { increment: 1 },
        promptTokens: { increment: tokenUsage.promptTokens },
        completionTokens: { increment: tokenUsage.completionTokens },
        totalTokens: { increment: tokenUsage.totalTokens },
      },
    });

    res.json({
      reply,
      groundingChunks: modelMessage.groundingChunks ?? [],
      messageId: modelMessage.id,
    });
    await invalidateConversationCaches(conversation.id, req.user.id);
  } catch (error) {
    console.error("Chat completion failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Chat failed" });
  }
});
