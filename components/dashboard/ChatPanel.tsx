import React from 'react';
import { Bot, ChatMessage, Document } from '../../types';
import ChatInterface from '../ChatInterface';

type Panel = 'chat' | 'knowledge' | 'bots' | 'admin' | 'integration';

interface ChatPanelProps {
  bots: Bot[];
  selectedBot: Bot | null;
  selectedDocument: Document | null;
  activeDocName: string;
  chatHistory: ChatMessage[];
  isQueryLoading: boolean;
  chatError: string | null;
  onSetChatError: (value: string | null) => void;
  onSendMessage: (message: string) => void;
  onNewChat: () => void;
  onFeedback: (messageId: string, rating: 'up' | 'down') => void;
  retryPrompt: string | null;
  onRetryPrompt: () => void;
  onSelectBotForChat: (bot: Bot) => void;
  onEnsureBotsLoaded: () => void;
  onChangePanel: (panel: Panel) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  bots,
  selectedBot,
  selectedDocument,
  activeDocName,
  chatHistory,
  isQueryLoading,
  chatError,
  onSetChatError,
  onSendMessage,
  onNewChat,
  onFeedback,
  retryPrompt,
  onRetryPrompt,
  onSelectBotForChat,
  onEnsureBotsLoaded,
  onChangePanel,
}) => {
  const handleSendFromChat = (message: string) => {
    if (!selectedDocument) {
      onSetChatError('Please select knowledge before chatting.');
      return;
    }
    onSetChatError(null);
    onSendMessage(message);
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-6 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <select
              value={selectedBot?.id || ''}
              onChange={(event) => {
                const nextId = event.target.value;
                const nextBot = bots.find((bot) => bot.id === nextId) || null;
                if (nextBot) {
                  onSelectBotForChat(nextBot);
                  onSetChatError(null);
                }
              }}
              onFocus={() => onEnsureBotsLoaded()}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm"
            >
              <option value="">Select Bots</option>
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onNewChat}
            className="h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-700 shadow-sm flex items-center justify-center"
            title="New chat"
          >
            ✎
          </button>
        </div>
      </div>

      {chatError && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm px-3 py-2 flex items-center justify-between">
          <span>{chatError}</span>
          <button
            onClick={() => onChangePanel('knowledge')}
            className="text-xs font-semibold text-red-600 hover:text-red-700"
          >
            Go to knowledge
          </button>
        </div>
      )}
      {retryPrompt && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-700 text-sm px-3 py-2 flex items-center justify-between">
          <span>Last message failed. Retry?</span>
          <button
            onClick={onRetryPrompt}
            className="text-xs font-semibold text-yellow-700 hover:text-yellow-800"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 min-h-[520px]">
        <ChatInterface
          documentName={activeDocName}
          history={chatHistory}
          isQueryLoading={isQueryLoading}
          onSendMessage={handleSendFromChat}
          onNewChat={onNewChat}
          exampleQuestions={[]}
          botName={selectedBot?.name}
          botAvatarUrl={selectedBot?.avatarUrl ?? null}
          onFeedback={onFeedback}
          theme="light"
          showHeader={false}
        />
      </div>
    </div>
  );
};

export default ChatPanel;
