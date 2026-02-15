// Chat Service - Main Entry Point
// Combines new (askaa_backend) and legacy (website) chat implementations

import { conversationsRouter, messagesRouter, chatRouter } from './conversations.js';

// Legacy chat routes (from website) - can be imported if needed
// import { router as legacyChatsRouter } from './legacy/chats.py';
// import { router as legacyChatMessagesRouter } from './legacy/chat_messages.py';

export { conversationsRouter, messagesRouter, chatRouter };
export default { conversationsRouter, messagesRouter, chatRouter };
