'use client';

import { useEffect, useState } from 'react';

export default function GopherLogo() {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        // Check initial theme
        const checkTheme = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };

        checkTheme();

        // Watch for theme changes
        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });

        return () => observer.disconnect();
    }, []);

    const glowColor = isDark
        ? 'drop-shadow(0 0 20px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 40px rgba(0, 0, 0, 0.5))'
        : 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.7))';

    return (
        <h1
            className="text-6xl md:text-8xl font-bold tracking-tighter bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent pb-4 animate-in fade-in zoom-in duration-700 select-none font-mono transition-all duration-500"
            style={{ filter: glowColor }}
        >
            gopher
        </h1>
    );
}
