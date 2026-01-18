import React, { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from "next-auth/react"
import Link from 'next/link'
import { getChats, deleteChat, renameChat, togglePinChat } from "@/app/actions"

interface ChatSession {
    id: string;
    preview: string;
    timestamp: number;
    isPinned?: boolean;
}

interface SidebarProps {
    isOpen: boolean;
    currentSessionId: string;
    onSelectSession: (id: string) => void;
    onNewChat: () => void;
    onViewSchedule: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, currentSessionId, onSelectSession, onNewChat, onViewSchedule }) => {
    const { data: session } = useSession()
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when editing starts
    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingId]);

    const loadSessions = async () => {
        if (session?.user) {
            const dbChats = await getChats();
            setSessions(dbChats);
        } else {
            const allKeys = Object.keys(localStorage);
            const sessionKeys = allKeys.filter(k => k.startsWith('chat_session_'));
            const loadedSessions = sessionKeys.map(key => {
                try {
                    const data = JSON.parse(localStorage.getItem(key) || '{}');
                    return {
                        id: key.replace('chat_session_', ''),
                        preview: data.preview || 'New Chat',
                        timestamp: data.timestamp || 0,
                        isPinned: data.isPinned || false
                    };
                } catch (e) {
                    return null;
                }
            }).filter(Boolean) as ChatSession[];

            loadedSessions.sort((a, b) => {
                if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                return b.timestamp - a.timestamp;
            });
            setSessions(loadedSessions);
        }
    };

    useEffect(() => {
        const handleStorageChange = () => {
            loadSessions();
        };

        window.addEventListener('storage', handleStorageChange);

        if (isOpen) {
            loadSessions();
        }

        return () => window.removeEventListener('storage', handleStorageChange);
    }, [isOpen, session]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();

        if (session?.user) {
            await deleteChat(id);
            await loadSessions();
        } else {
            localStorage.removeItem(`chat_session_${id}`);
            loadSessions();
        }

        if (id === currentSessionId) {
            onNewChat();
        }
        setActiveMenuId(null);
    };

    const handlePin = async (e: React.MouseEvent, id: string, currentPinned: boolean) => {
        e.stopPropagation();

        if (session?.user) {
            await togglePinChat(id, !currentPinned);
            await loadSessions();
        } else {
            const key = `chat_session_${id}`;
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            data.isPinned = !currentPinned;
            localStorage.setItem(key, JSON.stringify(data));
            loadSessions();
        }
        setActiveMenuId(null);
    };

    const startRenaming = (e: React.MouseEvent, session: ChatSession) => {
        e.stopPropagation();
        setEditingId(session.id);
        setEditName(session.preview);
        setActiveMenuId(null);
    };

    const saveRename = async () => {
        if (!editingId) return;

        if (session?.user) {
            await renameChat(editingId, editName.trim() || 'Untitled Chat');
            await loadSessions();
        } else {
            const key = `chat_session_${editingId}`;
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            data.preview = editName.trim() || 'Untitled Chat';
            localStorage.setItem(key, JSON.stringify(data));
            loadSessions();
        }
        setEditingId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveRename();
        if (e.key === 'Escape') setEditingId(null);
    };

    return (
        <div
            className={`fixed top-0 left-0 h-full bg-emerald-900 dark:bg-gray-950 text-white w-80 shadow-2xl transform transition-transform duration-300 ease-in-out z-40 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            style={{ paddingTop: '5rem' }}
        >
            <div className="p-4 flex flex-col h-full">
                <button
                    onClick={onNewChat}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-800 dark:hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors mb-6 shadow-md"
                >
                    <span>➕</span> New Chat
                </button>

                <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">Recent Chats</h3>
                    <div className="space-y-2">
                        {sessions.length === 0 && (
                            <p className="text-emerald-500/50 text-sm italic p-2">No history yet.</p>
                        )}
                        {sessions.map(session => (
                            <div key={session.id} className="relative group">
                                {editingId === session.id ? (
                                    <div className="flex items-center px-2 py-2 bg-emerald-800 rounded">
                                        <input
                                            ref={editInputRef}
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onBlur={saveRename}
                                            onKeyDown={handleKeyDown}
                                            className="w-full bg-transparent text-white focus:outline-none text-sm"
                                        />
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => onSelectSession(session.id)}
                                        className={`w-full text-left p-3 pr-8 rounded-lg text-sm transition-all truncate flex justify-between items-center ${currentSessionId === session.id ? 'bg-emerald-800 dark:bg-gray-800 text-white font-semibold border-l-4 border-emerald-400' : 'text-emerald-100 dark:text-gray-400 hover:bg-emerald-800/50 dark:hover:bg-gray-900/50'}`}
                                    >
                                        <span className="truncate flex-1 flex items-center gap-2">
                                            {session.isPinned && <span>📌</span>}
                                            {session.preview}
                                        </span>

                                        {/* Three Dots Menu Button */}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuId(activeMenuId === session.id ? null : session.id);
                                            }}
                                            className="absolute right-2 p-1 text-gray-400 hover:text-white rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ⋮
                                        </div>

                                    </button>
                                )}

                                {/* Dropdown Menu */}
                                {activeMenuId === session.id && (
                                    <div
                                        ref={menuRef}
                                        className="absolute right-0 top-8 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 overflow-hidden border border-gray-200 dark:border-gray-700 animate-fadeIn"
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onViewSchedule(session.id);
                                                setActiveMenuId(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            Schedule
                                        </button>
                                        <button
                                            onClick={(e) => handlePin(e, session.id, !!session.isPinned)}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            {session.isPinned ? 'Unpin' : 'Pin'}
                                        </button>
                                        <button
                                            onClick={(e) => startRenaming(e, session)}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            Rename
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(e, session.id)}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 border-t border-gray-100 dark:border-gray-700"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer with User Profile */}
                {/* Auth controls moved to Navbar as per request, just showing profile if desired or empty */}
                <div className="pt-4 mt-auto border-t border-emerald-800/50 dark:border-gray-800">
                    {session?.user ? (
                        <div className="flex items-center gap-3 px-2 pb-2">
                            {/* Just show who is logged in context, but no buttons */}
                            {session.user.image ? (
                                <img src={session.user.image} alt="Avatar" className="w-8 h-8 rounded-full" />
                            ) : (
                                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-xs">
                                    {session.user.name?.[0] || 'U'}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate text-emerald-100">{session.user.name}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="px-2 pb-2 text-xs text-emerald-500/50 text-center">
                            Guest Mode
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
