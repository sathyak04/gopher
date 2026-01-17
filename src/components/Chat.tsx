'use client';

import { useState, useRef, useEffect } from 'react';

export default function Chat() {
    const [messages, setMessages] = useState<Array<{ role: string, content: string }>>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];

        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: newMessages }),
            });

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = { role: 'assistant', content: '' };

            // Add initial empty assistant message to show we're loading/streaming
            setMessages(prev => [...prev, assistantMessage]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                assistantMessage.content += text;

                // Update the last message (assistant's) with new content
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...assistantMessage };
                    return updated;
                });
            }
        } catch (error) {
            console.error('Chat error:', error);
            // Optionally add an error message to the chat
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
            <div className="space-y-4">
                {messages.map((m, index) => (
                    <div key={index} className="whitespace-pre-wrap">
                        <div className="font-bold">{m.role === 'user' ? 'User: ' : 'AI: '}</div>
                        <p>{m.content}</p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="fixed bottom-0 w-full max-w-md p-2 mb-8 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-800 rounded shadow-xl">
                <input
                    className="w-full p-2"
                    value={input}
                    placeholder="Say something..."
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                />
            </form>
        </div>
    );
}
