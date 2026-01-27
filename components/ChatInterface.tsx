/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import Spinner from './Spinner';
import SendIcon from './icons/SendIcon';
import RefreshIcon from './icons/RefreshIcon';
import PlusIcon from './icons/PlusIcon';
import CameraIcon from './icons/CameraIcon';

interface ChatInterfaceProps {
    documentName: string;
    history: ChatMessage[];
    isQueryLoading: boolean;
    onSendMessage: (message: string) => void;
    onNewChat: () => void;
    exampleQuestions: string[];
    onBack?: () => void;
    botName?: string | null;
    botAvatarUrl?: string | null;
    onFeedback?: (messageId: string, rating: 'up' | 'down') => void;
    theme?: 'light' | 'dark';
    showHeader?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
    documentName,
    history,
    isQueryLoading,
    onSendMessage,
    onNewChat,
    exampleQuestions,
    onBack,
    botName,
    botAvatarUrl,
    onFeedback,
    theme = 'dark',
    showHeader = true,
}) => {
    const [query, setQuery] = useState('');
    const [currentSuggestion, setCurrentSuggestion] = useState('');
    const [modalContent, setModalContent] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const isLight = theme === 'light';

    useEffect(() => {
        if (exampleQuestions.length === 0) {
            setCurrentSuggestion('');
            return;
        }

        setCurrentSuggestion(exampleQuestions[0]);
        let suggestionIndex = 0;
        const intervalId = setInterval(() => {
            suggestionIndex = (suggestionIndex + 1) % exampleQuestions.length;
            setCurrentSuggestion(exampleQuestions[suggestionIndex]);
        }, 5000);

        return () => clearInterval(intervalId);
    }, [exampleQuestions]);
    
    const renderMarkdown = (text: string) => {
        if (!text) return { __html: '' };

        const lines = text.split('\n');
        let html = '';
        let listType: 'ul' | 'ol' | null = null;
        let paraBuffer = '';

        const codeClass = isLight ? 'bg-slate-100 text-slate-700' : 'bg-gem-mist/50';
        const formatInline = (value: string) => value
            .replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>')
            .replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>')
            .replace(/`([^`]+)`/g, `<code class="${codeClass} px-1 py-0.5 rounded-sm font-mono text-sm">$1</code>`);

        const getNextNonEmptyLine = (startIndex: number) => {
            for (let i = startIndex; i < lines.length; i += 1) {
                if (lines[i].trim() !== '') {
                    return lines[i];
                }
            }
            return null;
        };

        function flushPara() {
            if (paraBuffer) {
                html += `<p class="my-2">${paraBuffer}</p>`;
                paraBuffer = '';
            }
        }

        function flushList() {
            if (listType) {
                html += `</${listType}>`;
                listType = null;
            }
        }

        for (let index = 0; index < lines.length; index += 1) {
            const rawLine = lines[index];
            const trimmedRaw = rawLine.trim();

            if (trimmedRaw === '') {
                if (listType) {
                    const nextLine = getNextNonEmptyLine(index + 1);
                    const nextIsOl = nextLine ? /^\s*\d+[\.\)]\s/.test(nextLine) : false;
                    const nextIsUl = nextLine ? /^\s*[\*\-]\s/.test(nextLine) : false;
                    if ((listType === 'ol' && nextIsOl) || (listType === 'ul' && nextIsUl)) {
                        continue;
                    }
                    flushList();
                }
                flushPara();
                continue;
            }

            const isOl = rawLine.match(/^\s*(\d+)[\.\)]\s+(.*)/);
            const isUl = rawLine.match(/^\s*[\*\-]\s(.*)/);

            if (isOl) {
                flushPara();
                if (listType !== 'ol') {
                    flushList();
                    html += '<ol class="list-decimal list-inside my-2 pl-5 space-y-1">';
                    listType = 'ol';
                }
                html += `<li value="${isOl[1]}">${formatInline(isOl[2])}</li>`;
            } else if (isUl) {
                flushPara();
                if (listType !== 'ul') {
                    flushList();
                    html += '<ul class="list-disc list-inside my-2 pl-5 space-y-1">';
                    listType = 'ul';
                }
                html += `<li>${formatInline(isUl[1])}</li>`;
            } else {
                flushList();
                paraBuffer += (paraBuffer ? '<br/>' : '') + formatInline(trimmedRaw);
            }
        }

        flushPara();
        flushList();

        return { __html: html };
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSendMessage(query);
            setQuery('');
        }
    };

    const handleSourceClick = (text: string) => {
        setModalContent(text);
    };

    const closeModal = () => {
        setModalContent(null);
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isQueryLoading]);

    const topPadding = showHeader ? 'pt-24' : 'pt-6';
    const isEmptyState = history.length === 0 && !isQueryLoading;

    if (isEmptyState && isLight) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-6 py-12">
                <div className="text-center space-y-3">
                    <div className="h-20 w-20 mx-auto rounded-full bg-yellow-100 flex items-center justify-center overflow-hidden">
                        <img
                            src="/bingsu-logo.png"
                            alt="Bingsu"
                            className="h-16 w-16 object-contain"
                            draggable={false}
                        />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900">Welcome to BINGSU LLM</h2>
                    <p className="text-sm text-slate-500 max-w-md">
                        บิงซูบอท (Bingsu Bot) ช่วยอำนวยความสะดวกด้านการให้ข้อมูลและความช่วยเหลือ
                        ให้บริการด้วยความเป็นมิตร มีประสิทธิภาพ และโปร่งใส
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="w-full max-w-2xl mt-10">
                    <div className="flex items-center gap-2 border-2 border-yellow-400 rounded-full px-4 py-3 shadow-sm bg-white">
                        <button type="button" className="text-slate-400">
                            <PlusIcon />
                        </button>
                        <button type="button" className="text-slate-400">
                            <CameraIcon className="h-5 w-5" />
                        </button>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="flex-1 text-sm text-slate-700 bg-transparent focus:outline-none"
                            placeholder="How can I help today?..."
                        />
                    </div>
                </form>

                <div className="mt-8 w-full max-w-2xl">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                        <span>⚡</span>
                        <span>Suggested</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                        {[0, 1, 2].map((item) => (
                            <div key={item} className="h-12 rounded-lg bg-slate-100" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            {showHeader && (
                <header className={`absolute top-0 left-0 right-0 backdrop-blur-sm z-10 border-b ${isLight ? 'bg-white/90 border-slate-200' : 'bg-gem-onyx/80 border-gem-mist'}`}>
                    <div className="w-full max-w-4xl mx-auto flex justify-between items-center px-4 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {onBack && (
                                <button
                                    onClick={onBack}
                                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                                        isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-gem-mist/40 hover:bg-gem-mist/70 text-gem-offwhite'
                                    }`}
                                    title="Back to dashboard"
                                >
                                    Back
                                </button>
                            )}
                            <div className="min-w-0">
                                <h1 className={`text-2xl font-bold truncate ${isLight ? 'text-slate-900' : 'text-gem-offwhite'}`} title={`Home • ${documentName}`}>
                                    Home • {documentName}
                                </h1>
                                {botName && (
                                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gem-offwhite/60'}`}>Bot: {botName}</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onNewChat}
                            className={`flex items-center px-4 py-2 rounded-full transition-colors flex-shrink-0 ${
                                isLight ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900' : 'bg-gem-blue hover:bg-blue-500 text-white'
                            }`}
                            title="Start a new chat"
                        >
                            <RefreshIcon />
                            <span className="ml-2 hidden sm:inline">New Chat</span>
                        </button>
                    </div>
                </header>
            )}

            <div className={`flex-grow ${topPadding} pb-32 overflow-y-auto px-4`}>
                <div className="w-full max-w-4xl mx-auto space-y-6">
                    {history.map((message, index) => {
                        const isUser = message.role === 'user';
                        return (
                        <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            {!isUser && (
                                <div className="mr-2 mt-1 h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center text-lg overflow-hidden border border-yellow-200">
                                    {botAvatarUrl ? (
                                        <img src={botAvatarUrl} alt="Bot avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        <span>🤖</span>
                                    )}
                                </div>
                            )}
                            <div className={`max-w-xl lg:max-w-2xl px-5 py-3 rounded-2xl ${
                                isUser
                                ? (isLight ? 'bg-yellow-400 text-slate-900' : 'bg-gem-blue text-white')
                                : (isLight ? 'bg-slate-100 text-slate-800' : 'bg-gem-slate')
                            }`}>
                                <div dangerouslySetInnerHTML={renderMarkdown(message.parts[0].text)} />
                                {message.role === 'model' && message.groundingChunks && message.groundingChunks.length > 0 && (
                                    <div className={`mt-4 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-gem-mist/50'}`}>
                                        <h4 className={`text-xs font-semibold mb-2 text-right ${isLight ? 'text-slate-500' : 'text-gem-offwhite/70'}`}>Sources:</h4>
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            {message.groundingChunks.map((chunk, chunkIndex) => (
                                                chunk.retrievedContext?.text && (
                                                    <button
                                                        key={chunkIndex}
                                                        onClick={() => handleSourceClick(chunk.retrievedContext!.text!)}
                                                        className={`text-xs px-3 py-1 rounded-md transition-colors ${
                                                            isLight ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-gem-mist/50 hover:bg-gem-mist'
                                                        }`}
                                                        aria-label={`View source ${chunkIndex + 1}`}
                                                        title="View source document chunk"
                                                    >
                                                        Source {chunkIndex + 1}
                                                    </button>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {message.role === 'model' && message.id && onFeedback && (
                                    <div className="mt-3 flex items-center justify-end gap-2 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => onFeedback(message.id!, 'up')}
                                            className={`px-2 py-1 rounded-full border transition-colors ${
                                                message.feedback === 'up'
                                                    ? (isLight ? 'border-green-500 text-green-600 bg-green-50' : 'border-green-400 text-green-300 bg-green-900/20')
                                                    : (isLight ? 'border-slate-200 text-slate-500 hover:text-slate-700' : 'border-gem-mist/50 text-gem-offwhite/70 hover:text-gem-offwhite')
                                            }`}
                                            title="Helpful"
                                        >
                                            👍
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onFeedback(message.id!, 'down')}
                                            className={`px-2 py-1 rounded-full border transition-colors ${
                                                message.feedback === 'down'
                                                    ? (isLight ? 'border-red-500 text-red-600 bg-red-50' : 'border-red-400 text-red-300 bg-red-900/20')
                                                    : (isLight ? 'border-slate-200 text-slate-500 hover:text-slate-700' : 'border-gem-mist/50 text-gem-offwhite/70 hover:text-gem-offwhite')
                                            }`}
                                            title="Not helpful"
                                        >
                                            👎
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )})}
                    {isQueryLoading && (
                        <div className="flex justify-start">
                            <div className={`max-w-xl lg:max-w-2xl px-5 py-3 rounded-2xl flex items-center gap-2 ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-gem-slate text-gem-offwhite/70'}`}>
                                <Spinner />
                                <span className="text-sm">กำลังประมวลผล…</span>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>

            <div className={`absolute bottom-0 left-0 right-0 p-4 ${isLight ? 'bg-white border-t border-slate-200' : 'bg-gem-onyx/80 backdrop-blur-sm'}`}>
                 <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-2 min-h-[3rem] flex items-center justify-center">
                        {!isQueryLoading && currentSuggestion && (
                            <button
                                onClick={() => setQuery(currentSuggestion)}
                                className={`text-base transition-colors px-4 py-2 rounded-full ${
                                    isLight ? 'text-slate-700 bg-slate-100 hover:bg-slate-200' : 'text-gem-offwhite bg-gem-slate hover:bg-gem-mist'
                                }`}
                                title="Use this suggestion as your prompt"
                            >
                                Try: "{currentSuggestion}"
                            </button>
                        )}
                    </div>
                     <form onSubmit={handleSubmit} className="flex items-center space-x-3">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask a question about the manuals..."
                            className={`flex-grow rounded-full py-3 px-5 focus:outline-none focus:ring-2 ${
                                isLight
                                  ? 'bg-white border border-slate-200 text-slate-700 focus:ring-yellow-400'
                                  : 'bg-gem-mist border border-gem-mist/50 text-gem-offwhite focus:ring-gem-blue'
                            }`}
                            disabled={isQueryLoading}
                        />
                        <button
                            type="submit"
                            disabled={isQueryLoading || !query.trim()}
                            className={`p-3 rounded-full transition-colors ${
                                isLight
                                  ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900 disabled:bg-slate-200'
                                  : 'bg-gem-blue hover:bg-blue-500 text-white disabled:bg-gem-mist'
                            }`}
                            title="Send message"
                        >
                            <SendIcon />
                        </button>
                    </form>
                </div>
            </div>

            {modalContent !== null && (
                <div 
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" 
                    onClick={closeModal} 
                    role="dialog" 
                    aria-modal="true"
                    aria-labelledby="source-modal-title"
                >
                    <div className="bg-gem-slate p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <h3 id="source-modal-title" className="text-xl font-bold mb-4">Source Text</h3>
                        <div 
                            className="flex-grow overflow-y-auto pr-4 text-gem-offwhite/80 border-t border-b border-gem-mist py-4"
                            dangerouslySetInnerHTML={renderMarkdown(modalContent || '')}
                        >
                        </div>
                        <div className="flex justify-end mt-6">
                            <button onClick={closeModal} className="px-6 py-2 rounded-md bg-gem-blue hover:bg-blue-500 text-white transition-colors" title="Close source view">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatInterface;
