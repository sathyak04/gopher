"use client"

import { motion, useInView, useSpring, useTransform } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { Calendar, Hotel, Utensils, Sparkles } from "lucide-react"

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })
    const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 })
    const display = useTransform(spring, (current) => Math.round(current).toLocaleString() + suffix)

    useEffect(() => {
        if (isInView) {
            spring.set(value)
        }
    }, [isInView, value, spring])

    return <motion.span ref={ref}>{display}</motion.span>
}

export default function AnimatedStats() {
    return (
        <div className="max-w-6xl mx-auto">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="text-center"
                >
                    <div className="text-4xl md:text-5xl font-bold text-emerald-500 mb-2">
                        <Counter value={200} suffix="M+" />
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 text-sm font-medium">Places Worldwide</div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-center"
                >
                    <div className="text-4xl md:text-5xl font-bold text-emerald-500 mb-2">
                        <Counter value={50} suffix="K+" />
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 text-sm font-medium">Cities Covered</div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="text-center"
                >
                    <div className="text-4xl md:text-5xl font-bold text-emerald-500 mb-2">24/7</div>
                    <div className="text-gray-600 dark:text-gray-400 text-sm font-medium">AI Assistance</div>
                </motion.div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex flex-col items-center hover:shadow-lg transition-shadow"
                >
                    <div className="mb-4 p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Smart Logistics</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">You have the tickets, we handle the rest. from transport to timing.</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex flex-col items-center hover:shadow-lg transition-shadow"
                >
                    <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                        <Hotel className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Stay Nearby</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Find the perfect hotel within walking distance of your venue.</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex flex-col items-center hover:shadow-lg transition-shadow"
                >
                    <div className="mb-4 p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400">
                        <Utensils className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">Complete the Night</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Discover top-rated dining and nightlife for pre-show dinner or post-show drinks.</p>
                </motion.div>
            </div>

            {/* Credits - Built with tools from */}
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="mt-16 text-center"
            >
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Powering your experience</p>
                <div className="flex flex-wrap items-center justify-center gap-12 opacity-80 hover:opacity-100 transition-opacity">
                    {/* Vercel */}
                    <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform" title="Vercel">
                        <svg className="h-8 text-gray-800 dark:text-white" viewBox="0 0 76 65" fill="currentColor">
                            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                        </svg>
                    </a>
                    {/* Groq */}
                    <a href="https://groq.com" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform" title="Groq">
                        <span className="text-3xl font-bold text-gray-800 dark:text-white">groq</span>
                    </a>
                    {/* Neon */}
                    <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform flex items-center gap-2" title="Neon">
                        <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="#00E599" strokeWidth="2" />
                            <circle cx="12" cy="12" r="4" fill="#00E599" />
                        </svg>
                        <span className="text-3xl font-bold text-gray-800 dark:text-white">neon</span>
                    </a>
                    {/* Google */}
                    <a href="https://cloud.google.com" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform" title="Google Cloud">
                        <svg className="h-8" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                    </a>
                    {/* Ticketmaster */}
                    <a href="https://developer.ticketmaster.com" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform" title="Ticketmaster">
                        <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">ticketmaster</span>
                    </a>
                </div>
            </motion.div>
        </div>
    )
}
