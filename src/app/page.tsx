'use client';

import { useState, useEffect } from 'react';
import Chat from '@/components/Chat';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

export default function Home() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // Initialize theme from localStorage or system pref
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
            setIsDarkMode(true);
            document.documentElement.classList.add('dark');
        } else {
            setIsDarkMode(false);
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleTheme = () => {
        setIsDarkMode(prev => {
            const newMode = !prev;
            if (newMode) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            }
            return newMode;
        });
    };

    useEffect(() => {
        // Initialize or load session
        setSessionId(crypto.randomUUID());
    }, []);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleNewChat = () => {
        setSessionId(crypto.randomUUID());
        setIsSidebarOpen(false);
    };

    const handleSelectSession = (id: string) => {
        setSessionId(id);
        setIsSidebarOpen(false);
    };

    return (
        <main className="w-full h-screen flex flex-col overflow-hidden font-mono text-sm relative bg-emerald-900">
            <Sidebar
                isOpen={isSidebarOpen}
                currentSessionId={sessionId}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
            />

            <div
                className={`flex-1 flex flex-col h-full bg-white dark:bg-gray-900 transition-transform duration-300 ease-in-out shadow-2xl z-30 ${isSidebarOpen ? 'translate-x-[320px]' : 'translate-x-0'}`}
                onClick={() => isSidebarOpen && setIsSidebarOpen(false)}
            >
                <Navbar onMenuClick={toggleSidebar} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
                <div className="flex-1 overflow-hidden relative">
                    {/* 
                      Pass isSidebarOpen to Chat if we want to selectively fade parts INSIDE Chat.
                      Or wrap Chat in a div that handles the fading of "maps and itinerary".
                      Since maps/itinerary are inside Chat, we can pass a prop or use CSS classes that cascade?
                      
                      Actually, the user asked: "maps ans itinerary will fade out but chat will stay"
                      The Chat component handles the layout of Left Panel (Chat) and Right Panel (Map/Itinerary).
                      We can't easily fade *half* the component from outside without passing a prop.
                      Let's pass `isSidebarOpen` to Chat as a prop `isSidebarOpen`.
                    */}
                    {sessionId && <Chat key={sessionId} sessionId={sessionId} isSidebarOpen={isSidebarOpen} isDarkMode={isDarkMode} />}
                </div>
            </div>

            {/* Overlay for mobile or just general click-out behavior if desired, though the main content click handler handles it above */}
            {isSidebarOpen && (
                <div className="absolute inset-0 z-20 bg-black/20 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}
        </main>
    );
}
