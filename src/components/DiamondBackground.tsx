'use client';

import React from 'react';

interface DiamondBackgroundProps {
    className?: string;
    density?: 'low' | 'high';
}

const DiamondBackground: React.FC<DiamondBackgroundProps> = ({ className = "", density = 'high' }) => {
    const rows = density === 'high' ? 8 : 4;
    const cols = density === 'high' ? 12 : 6;

    return (
        <div className={`overflow-hidden pointer-events-none z-0 ${className}`}>
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    transform: 'rotate(-45deg)',
                    transformOrigin: 'center',
                    justifyContent: 'center',
                    alignContent: 'center',
                    width: '150%',
                    height: '150%',
                    marginLeft: '-25%',
                    marginTop: '-25%',
                }}
            >
                {Array.from({ length: rows * cols }).map((_, i) => (
                    <div
                        key={i}
                        className="w-12 h-12 bg-emerald-500 rounded-xl shadow-lg transition-all duration-1000"
                        style={{
                            opacity: Math.random() * 0.4 + 0.1,
                        }}
                    />
                ))}
            </div>
            {/* Soft fade edges */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-white/20 dark:from-gray-900/20 dark:to-gray-900/20" />
        </div>
    );
};

export default DiamondBackground;
