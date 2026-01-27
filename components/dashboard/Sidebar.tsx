import React, { useState } from 'react';
import { ConversationSummary, User } from '../../types';

type Panel = 'chat' | 'knowledge' | 'bots' | 'admin' | 'integration';

interface SidebarProps {
  user: User;
  isSidebarHidden: boolean;
  isSupportOnly: boolean;
  activePanel: Panel;
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  selectedConversationId: string | null;
  pendingUsersCount?: number;
  onChangePanel: (panel: Panel) => void;
  onSelectConversation: (conversation: ConversationSummary) => void;
  onDeleteConversation: (conversationId: string) => void;
  onClearConversations: () => void;
  onShowHistory: () => void;
  onLoadAdminData: () => Promise<void>;
  onLoadSupportData: () => Promise<void>;
  onLogout: () => void;
  onHideSidebar: () => void;
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  user,
  isSidebarHidden,
  isSupportOnly,
  activePanel,
  conversations,
  conversationsLoading,
  selectedConversationId,
  pendingUsersCount,
  onChangePanel,
  onSelectConversation,
  onDeleteConversation,
  onClearConversations,
  onShowHistory,
  onLoadAdminData,
  onLoadSupportData,
  onLogout,
  onHideSidebar,
  onOpenSettings,
}) => {
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <aside className={`${isSidebarHidden ? 'w-0 opacity-0 pointer-events-none overflow-hidden' : 'w-64 opacity-100 overflow-visible'} relative z-20 bg-slate-100 border-r border-slate-200 flex flex-col transition-all duration-200`}>
      <div className="p-4 border-b border-slate-200 relative">
        <button
          type="button"
          onClick={() => onChangePanel('chat')}
          className="flex items-center gap-3 w-full text-left"
          title="Home"
        >
          <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
            <img
              src="/bingsu-logo.png"
              alt="Bingsu"
              className="h-10 w-10 object-contain"
              draggable={false}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">BingSu</p>
            <p className="text-xs text-slate-500">BINGSU</p>
          </div>
        </button>
        <button
          onClick={onHideSidebar}
          className="absolute -right-3 top-4 h-8 w-8 rounded-full bg-slate-300 text-slate-700 hover:text-slate-900 shadow flex items-center justify-center text-lg z-30"
          title="Hide sidebar"
        >
          ‹
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!isSupportOnly && (
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase mb-2">Workspace</h2>
            <div className="space-y-1">
              <button
                onClick={() => onChangePanel('chat')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activePanel === 'chat'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => onChangePanel('bots')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activePanel === 'bots'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                Bots
              </button>
              <button
                onClick={() => onChangePanel('knowledge')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activePanel === 'knowledge'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                Knowledge
              </button>
              <button
                onClick={() => onChangePanel('integration')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activePanel === 'integration'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                Integration
              </button>
            </div>
          </div>
        )}

        {['admin', 'support', 'admin_metrics'].includes(user.role ?? 'user') && (
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase mb-2">
              {isSupportOnly ? 'Support' : 'Admin'}
            </h2>
            <button
              onClick={() => {
                onChangePanel('admin');
                onLoadAdminData();
                onLoadSupportData();
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activePanel === 'admin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              <span className="flex items-center justify-between">
                <span>Admin</span>
                {pendingUsersCount ? (
                  <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                    {pendingUsersCount}
                  </span>
                ) : null}
              </span>
            </button>
          </div>
        )}

        {!isSupportOnly && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-slate-500 uppercase">History</h2>
              <div className="flex items-center gap-2">
                {!isHistoryCollapsed && conversations.length > 0 && (
                  <button
                    onClick={onClearConversations}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() =>
                    setIsHistoryCollapsed((prev) => {
                      const next = !prev;
                      if (!next) {
                        onShowHistory();
                      }
                      return next;
                    })
                  }
                  className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded px-2 py-0.5"
                  title={isHistoryCollapsed ? 'Show history' : 'Hide history'}
                >
                  {isHistoryCollapsed ? '>' : '<'}
                </button>
              </div>
            </div>
            {!isHistoryCollapsed && (
              <>
                {conversationsLoading ? (
                  <p className="text-xs text-slate-500">Loading history...</p>
                ) : conversations.length === 0 ? (
                  <p className="text-xs text-slate-500">No conversations yet.</p>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onSelectConversation(conversation);
                          onChangePanel('chat');
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelectConversation(conversation);
                            onChangePanel('chat');
                          }
                        }}
                        className={`flex items-start gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                          selectedConversationId === conversation.id
                            ? 'bg-white shadow-sm'
                            : 'bg-slate-50 hover:bg-white/80'
                        }`}
                      >
                        <div className="flex-1 text-left text-sm">
                          <p className="font-medium truncate text-slate-800">
                            {conversation.title || conversation.lastMessage || 'New chat'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {conversation.document.displayName}
                            {conversation.bot?.name ? ` · ${conversation.bot.name}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteConversation(conversation.id);
                          }}
                          className="text-xs text-red-500 hover:text-red-600 px-1"
                          title="Delete conversation"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 relative">
        <button
          onClick={() => setIsProfileOpen((prev) => !prev)}
          className="w-full flex items-center justify-between bg-white hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors border border-slate-200"
        >
          <div className="flex items-center gap-2 text-left">
            <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
              👤
            </div>
            <p className="text-sm font-semibold text-slate-800">Profile</p>
          </div>
          <span className="text-slate-500">{isProfileOpen ? '▴' : '▾'}</span>
        </button>

        {isProfileOpen && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-lg">
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => {
                setIsProfileOpen(false);
                onOpenSettings();
              }}
            >
              Settings
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-red-500"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
