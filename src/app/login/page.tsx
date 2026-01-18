import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AnimatedDiamondGrid from "@/components/AnimatedDiamondGrid"
import GopherLogo from "@/components/GopherLogo"
import LoginNavbar from "@/components/LoginNavbar"

export const metadata = {
    title: "Gopher - Login",
}

export default async function LoginPage() {
    const session = await auth()

    // If already logged in, redirect to main app
    if (session?.user) {
        redirect('/')
    }

    // Diamond grid parameters
    const rows = 5;
    const cols = 25;
    const diamondSize = 100;
    const gap = 12;

    return (
        <div className="min-h-screen w-full flex flex-col bg-white dark:bg-gray-900">
            {/* Navbar - Sticky */}
            <LoginNavbar />

            {/* Main Content - Centered Logo */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center min-h-[70vh]">
                {/* Animated Diamond Grid */}
                <AnimatedDiamondGrid rows={rows} cols={cols} diamondSize={diamondSize} gap={gap} />

                {/* Centered Logo */}
                <div className="relative z-10 text-center">
                    <GopherLogo />
                    <p className="text-gray-500 dark:text-gray-400 mt-4 text-lg font-mono">
                        Your AI travel companion
                    </p>
                </div>
            </div>

            {/* Statistics Section */}
            <div className="relative z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 py-16 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                        <div className="text-center">
                            <div className="text-4xl md:text-5xl font-bold text-emerald-500 mb-2">50+</div>
                            <div className="text-gray-600 dark:text-gray-400 text-sm font-medium">Cities Covered</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl md:text-5xl font-bold text-emerald-500 mb-2">10K+</div>
                            <div className="text-gray-600 dark:text-gray-400 text-sm font-medium">Events Tracked</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl md:text-5xl font-bold text-emerald-500 mb-2">24/7</div>
                            <div className="text-gray-600 dark:text-gray-400 text-sm font-medium">AI Assistance</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl md:text-5xl font-bold text-emerald-500 mb-2">∞</div>
                            <div className="text-gray-600 dark:text-gray-400 text-sm font-medium">Adventures Await</div>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                        <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                            <div className="text-3xl mb-3">✈️</div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Smart Itineraries</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">AI-powered travel plans tailored to your preferences</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                            <div className="text-3xl mb-3">🎫</div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Event Discovery</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Find concerts, sports, and experiences near you</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                            <div className="text-3xl mb-3">🗺️</div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Live Maps</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Interactive maps with hotels, food, and attractions</p>
                        </div>
                    </div>

                    {/* Credits - Built with tools from */}
                    <div className="mt-16 text-center">
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Built with tools from</p>
                        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60 hover:opacity-100 transition-opacity">
                            {/* Vercel */}
                            <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform" title="Vercel">
                                <svg className="h-5 text-gray-800 dark:text-white" viewBox="0 0 76 65" fill="currentColor">
                                    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                                </svg>
                            </a>
                            {/* Groq */}
                            <a href="https://groq.com" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform" title="Groq">
                                <span className="text-lg font-bold text-gray-800 dark:text-white">groq</span>
                            </a>
                            {/* Neon */}
                            <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform flex items-center gap-1" title="Neon">
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="#00E599" strokeWidth="2" />
                                    <circle cx="12" cy="12" r="4" fill="#00E599" />
                                </svg>
                                <span className="text-lg font-bold text-gray-800 dark:text-white">neon</span>
                            </a>
                            {/* Google */}
                            <a href="https://cloud.google.com" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform" title="Google Cloud">
                                <svg className="h-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            </a>
                            {/* Ticketmaster */}
                            <a href="https://developer.ticketmaster.com" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform" title="Ticketmaster">
                                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">ticketmaster</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
