import React, { useMemo, useState } from 'react';
import { Bot } from '../../types';

interface BotsPanelProps {
  bots: Bot[];
  isCreateBotView: boolean;
  botAvatarUrl: string | null;
  botName: string;
  botModel: string;
  botModelOptions: string[];
  botDescription: string;
  botPrompt: string;
  botError: string | null;
  isCreatingBot: boolean;
  createBotDocIds: string[];
  botSearch: string;
  onSetBotName: (value: string) => void;
  onSetBotModel: (value: string) => void;
  onSetBotDescription: (value: string) => void;
  onSetBotPrompt: (value: string) => void;
  onSetBotSearch: (value: string) => void;
  onBackFromCreate: () => void;
  onOpenCreate: () => void;
  onOpenAvatarPopup: (target: 'create' | 'edit') => void;
  onOpenSelectKnowledge: () => void;
  onCreateBot: () => void;
  onSelectBot: (bot: Bot) => void;
  onEditBot: (bot: Bot) => void;
  onDeleteBot: (botId: string) => void;
}

const BotsPanel: React.FC<BotsPanelProps> = ({
  bots,
  isCreateBotView,
  botAvatarUrl,
  botName,
  botModel,
  botModelOptions,
  botDescription,
  botPrompt,
  botError,
  isCreatingBot,
  createBotDocIds,
  botSearch,
  onSetBotName,
  onSetBotModel,
  onSetBotDescription,
  onSetBotPrompt,
  onSetBotSearch,
  onBackFromCreate,
  onOpenCreate,
  onOpenAvatarPopup,
  onOpenSelectKnowledge,
  onCreateBot,
  onSelectBot,
  onEditBot,
  onDeleteBot,
}) => {
  const [botSort, setBotSort] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'>('created_desc');
  const [botModelFilter, setBotModelFilter] = useState('all');

  const availableModels = useMemo(() => {
    const models = bots
      .map((bot) => bot.model)
      .filter((model): model is string => Boolean(model));
    return Array.from(new Set(models));
  }, [bots]);

  if (isCreateBotView) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBackFromCreate}
          className="text-sm text-slate-600 hover:text-slate-800 font-semibold"
        >
          ← Back
        </button>

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 rounded-full bg-indigo-500 text-white flex items-center justify-center text-3xl overflow-hidden">
              {botAvatarUrl ? (
                <img src={botAvatarUrl} alt="Bot avatar" className="h-full w-full object-cover" />
              ) : (
                <span>💬</span>
              )}
            </div>
            <button
              onClick={() => onOpenAvatarPopup('create')}
              className="px-3 py-1.5 rounded-md bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-semibold shadow-sm"
            >
              เพิ่มโปรไฟล์บอท
            </button>
          </div>

          <div className="flex-1 space-y-6">
            <div>
              <label className="block text-sm text-slate-500 mb-1">ชื่อบอท</label>
              <input
                value={botName}
                onChange={(e) => onSetBotName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg py-2 px-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="ชื่อโมเดล"
              />
              <p className="text-xs text-slate-400 mt-1">รหัสโมเดล</p>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">โมเดลพื้นฐาน (จาก)</label>
              <select
                value={botModel}
                onChange={(e) => onSetBotModel(e.target.value)}
                className="w-48 border border-slate-200 rounded-lg py-2 px-3 text-slate-700 bg-white"
              >
                {botModelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-1">คำอธิบาย</label>
              <textarea
                value={botDescription}
                onChange={(e) => onSetBotDescription(e.target.value)}
                className="w-full border border-slate-200 rounded-lg py-2 px-3 text-slate-700 min-h-[200px] focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="เพิ่มคำอธิบายสั้น ๆ สำหรับโมเดลที่ทำ"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">พารามิเตอร์ของโมเดล</p>
              <label className="block text-sm text-slate-500 mb-1">ระบบพร้อมต์</label>
              <textarea
                value={botPrompt}
                onChange={(e) => onSetBotPrompt(e.target.value)}
                className="w-full border border-slate-200 rounded-lg py-2 px-3 text-slate-700 min-h-[200px] focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="เพิ่มคำอธิบายสั้น ๆ สำหรับโมเดลที่ทำ"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700">ความรู้</p>
              <p className="text-xs text-slate-500">
                หากต้องการเชื่อมต่อฐานความรู้ที่นี่ ให้เพิ่มข้อมูลลงในพื้นที่ทำงาน "ความรู้" ก่อน
              </p>
              <div className="mt-3">
                <button
                  onClick={onOpenSelectKnowledge}
                  className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-semibold shadow-sm"
                >
                  เลือกความรู้
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  เลือกแล้ว {createBotDocIds.length} รายการ
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700">การจัดกลุ่ม</p>
              <div className="border-t border-slate-200 mt-2" />
            </div>

            {botError && <p className="text-red-400 text-sm">{botError}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={onBackFromCreate}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={onCreateBot}
                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold"
                disabled={isCreatingBot}
              >
                {isCreatingBot ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const normalizedSearch = botSearch.trim().toLowerCase();
  const filteredBots = bots
    .filter((bot) => {
      const matchesSearch = normalizedSearch
        ? [bot.name, bot.description, bot.prompt]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedSearch))
        : true;
      const matchesModel =
        botModelFilter === 'all'
          ? true
          : botModelFilter === 'unassigned'
            ? !bot.model
            : bot.model === botModelFilter;
      return matchesSearch && matchesModel;
    })
    .slice()
    .sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name, 'th', { sensitivity: 'base' });
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      switch (botSort) {
        case 'created_asc':
          return createdA - createdB;
        case 'created_desc':
          return createdB - createdA;
        case 'name_desc':
          return -nameCompare;
        case 'name_asc':
          return nameCompare;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Bots</h2>
        <button
          onClick={onOpenCreate}
          className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-semibold shadow-sm"
        >
          Create bot +
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <input
            value={botSearch}
            onChange={(event) => onSetBotSearch(event.target.value)}
            className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            placeholder="Search bots"
          />
        </div>
        <select
          value={botModelFilter}
          onChange={(event) => setBotModelFilter(event.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="all">All models</option>
          <option value="unassigned">Unassigned</option>
          {availableModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        <select
          value={botSort}
          onChange={(event) =>
            setBotSort(event.target.value as 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc')
          }
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="name_asc">Name A-Z / ก-ฮ</option>
          <option value="name_desc">Name Z-A / ฮ-ก</option>
        </select>
      </div>

      {filteredBots.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20">
          <p className="text-slate-500 text-sm">No bots created yet</p>
          <p className="text-slate-400 text-xs mt-1">Click “Create Bot” to get started</p>
          <button
            onClick={onOpenCreate}
            className="mt-6 px-5 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-semibold shadow-sm"
          >
            Create Your First Bot
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredBots.map((bot) => (
            <div key={bot.id} className="border border-slate-200 rounded-lg p-4">
              <button
                onClick={() => onSelectBot(bot)}
                className="text-left w-full"
              >
                <h3 className="text-base font-semibold text-slate-900">{bot.name}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mt-1">{bot.description || bot.prompt}</p>
              </button>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => onEditBot(bot)}
                  className="px-3 py-1.5 rounded-md border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDeleteBot(bot.id)}
                  className="px-3 py-1.5 rounded-md border border-red-200 text-xs text-red-500 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BotsPanel;
