'use client';

import React, { useState, useEffect } from 'react';

interface AnimatedDiamondGridProps {
    rows: number;
    cols: number;
    diamondSize: number;
    gap: number;
}

// Green shade variations - more subtle, closer together
const greenShades = [
    'rgb(16, 185, 129)',   // emerald-500 (base)
    'rgb(34, 197, 142)',   // slightly lighter
    'rgb(20, 175, 125)',   // slightly darker
    'rgb(24, 190, 135)',   // subtle variation
    'rgb(12, 180, 122)',   // subtle variation
];

// Travel-related SVG icons - now as functions that accept color
const getTravelIcon = (index: number, color: string) => {
    const icons = [
        // Airplane
        <svg key="plane" viewBox="0 0 24 24" className="w-full h-full">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill={color} />
        </svg>,
        // Location pin
        <svg key="pin" viewBox="0 0 24 24" className="w-full h-full">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill={color} />
        </svg>,
        // Hotel/Bed
        <svg key="hotel" viewBox="0 0 24 24" className="w-full h-full">
            <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z" fill={color} />
        </svg>,
        // Suitcase
        <svg key="suitcase" viewBox="0 0 24 24" className="w-full h-full">
            <path d="M17 6h-2V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v3H7c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2 0 .55.45 1 1 1s1-.45 1-1h6c0 .55.45 1 1 1s1-.45 1-1c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 3h4v3h-4V3zm7 16H7V8h10v11z" fill={color} />
        </svg>,
        // Compass
        <svg key="compass" viewBox="0 0 24 24" className="w-full h-full">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z" fill={color} />
        </svg>,
    ];
    return icons[index % icons.length];
};

// Three states: diamond, icon, or empty
type DiamondType = 'diamond' | 'icon' | 'empty';

interface DiamondState {
    type: DiamondType;
    colorIndex: number;
    iconIndex: number;
}

export default function AnimatedDiamondGrid({ rows, cols, diamondSize, gap }: AnimatedDiamondGridProps) {
    const diagonal = diamondSize * Math.SQRT2;
    const horizontalStep = diagonal + gap;
    const verticalStep = (diagonal + gap) / 2;
    const rowOffset = horizontalStep / 2;

    const totalDiamonds = rows * cols;

    // Initialize diamond states - mix of diamonds and empty
    const [diamondStates, setDiamondStates] = useState<DiamondState[]>(() =>
        Array.from({ length: totalDiamonds }, () => ({
            type: Math.random() < 0.85 ? 'diamond' : 'empty' as DiamondType,
            colorIndex: 0,
            iconIndex: 0,
        }))
    );

    // Animation effect - randomly change some diamonds every second
    useEffect(() => {
        const interval = setInterval(() => {
            setDiamondStates(prev => {
                const newStates = [...prev];
                // Randomly select 3-6 positions to change
                const numToChange = Math.floor(Math.random() * 4) + 3;

                for (let i = 0; i < numToChange; i++) {
                    const randomIndex = Math.floor(Math.random() * totalDiamonds);
                    const rand = Math.random();

                    let newType: DiamondType;
                    if (rand < 0.18) {
                        // 18% chance to become an icon (increased from 10%)
                        newType = 'icon';
                    } else if (rand < 0.25) {
                        // 15% chance to become empty
                        newType = 'empty';
                    } else {
                        // 75% chance to be a diamond
                        newType = 'diamond';
                    }

                    newStates[randomIndex] = {
                        type: newType,
                        colorIndex: Math.floor(Math.random() * greenShades.length),
                        iconIndex: Math.floor(Math.random() * 5),
                    };
                }

                return newStates;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [totalDiamonds]);

    // Generate diamond positions
    const diamonds: { x: number; y: number; baseOpacity: number; index: number }[] = [];
    let index = 0;

    for (let row = 0; row < rows; row++) {
        const isOffsetRow = row % 2 === 1;
        const baseX = isOffsetRow ? rowOffset : 0;

        for (let col = 0; col < cols; col++) {
            const x = baseX + col * horizontalStep - 200;
            const y = row * verticalStep;

            const centerRow = (rows - 1) / 2;
            const distFromCenter = Math.abs(row - centerRow);
            // Lower opacity overall - 60% max
            const baseOpacity = Math.max(0.2, 0.6 - distFromCenter * 0.12);

            diamonds.push({ x, y, baseOpacity, index: index++ });
        }
    }

    const totalHeight = (rows - 1) * verticalStep + diagonal;

    return (
        <div
            className="absolute left-0 right-0 pointer-events-none z-0"
            style={{
                top: '50%',
                transform: 'translateY(-50%)',
                height: `${totalHeight}px`
            }}
        >
            {diamonds.map((diamond) => {
                const state = diamondStates[diamond.index];
                const isIcon = state?.type === 'icon';
                const isEmpty = state?.type === 'empty';
                const color = greenShades[state?.colorIndex || 0];

                // Skip rendering if empty
                if (isEmpty) {
                    return (
                        <div
                            key={diamond.index}
                            className="absolute transform rotate-45"
                            style={{
                                width: `${diamondSize}px`,
                                height: `${diamondSize}px`,
                                borderRadius: '14px',
                                left: `${diamond.x}px`,
                                top: `${diamond.y}px`,
                                opacity: 0,
                                transition: 'all 1.2s ease-in-out',
                            }}
                        />
                    );
                }

                return (
                    <div
                        key={diamond.index}
                        className="absolute transform rotate-45 flex items-center justify-center"
                        style={{
                            width: `${diamondSize}px`,
                            height: `${diamondSize}px`,
                            borderRadius: '14px',
                            left: `${diamond.x}px`,
                            top: `${diamond.y}px`,
                            opacity: diamond.baseOpacity,
                            backgroundColor: isIcon ? 'transparent' : color,
                            transition: 'all 1.2s ease-in-out',
                        }}
                    >
                        {isIcon && (
                            <div
                                className="transform -rotate-45 w-full h-full flex items-center justify-center p-3"
                                style={{
                                    transition: 'all 1.2s ease-in-out',
                                }}
                            >
                                {getTravelIcon(state.iconIndex, color)}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
