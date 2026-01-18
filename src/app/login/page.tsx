import { signIn, signOut, auth } from "@/auth"
import Link from "next/link"
import ThemeToggle from "@/components/ThemeToggle"

export default async function LoginPage() {
    const session = await auth()

    // Precise diamond grid with perfect diagonal alignment
    const rows = 5;
    const cols = 25;
    const diamondSize = 70; // size of each diamond
    const gap = 12; // gap between diamond edges

    // For a rotated square, the diagonal (point to point) = side * sqrt(2)
    const diagonal = diamondSize * Math.SQRT2; // ~99px

    // Horizontal step: distance between centers of adjacent diamonds in same row
    const horizontalStep = diagonal + gap;

    // Vertical step: for perfect tessellation, rows are placed so diamonds interlock
    // This is half the diagonal plus half the gap
    const verticalStep = (diagonal + gap) / 2;

    // Row offset for odd rows: half of horizontal step
    const rowOffset = horizontalStep / 2;

    // Generate diamond positions
    const diamonds: { x: number; y: number; opacity: number }[] = [];

    for (let row = 0; row < rows; row++) {
        const isOffsetRow = row % 2 === 1;
        const baseX = isOffsetRow ? rowOffset : 0;

        for (let col = 0; col < cols; col++) {
            const x = baseX + col * horizontalStep - 200; // start off-screen left
            const y = row * verticalStep;

            // Opacity based on distance from center row
            const centerRow = (rows - 1) / 2;
            const distFromCenter = Math.abs(row - centerRow);
            const opacity = Math.max(0.25, 0.95 - distFromCenter * 0.2);

            diamonds.push({ x, y, opacity });
        }
    }

    const totalHeight = (rows - 1) * verticalStep + diagonal;

    return (
        <div className="min-h-screen w-full relative overflow-hidden bg-white dark:bg-gray-900 flex flex-col md:flex-row font-sans">

            {/* Dark Mode Toggle - Top Right */}
            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>

            {/* Diamond Grid with Perfect Diagonal Alignment */}
            <div
                className="absolute left-0 right-0 pointer-events-none z-0"
                style={{
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: `${totalHeight}px`
                }}
            >
                {diamonds.map((diamond, i) => (
                    <div
                        key={i}
                        className="absolute bg-emerald-500 transform rotate-45"
                        style={{
                            width: `${diamondSize}px`,
                            height: `${diamondSize}px`,
                            borderRadius: '14px',
                            left: `${diamond.x}px`,
                            top: `${diamond.y}px`,
                            opacity: diamond.opacity,
                        }}
                    />
                ))}
            </div>

            {/* Left Panel - Text Logo */}
            <div className="w-full md:w-1/2 flex flex-col items-center justify-center relative z-10 p-6 md:p-10 min-h-[40vh] md:min-h-screen">
                <div className="relative max-w-full text-center z-20">
                    <h1 className="text-6xl md:text-8xl font-bold tracking-tighter bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent pb-4 animate-in fade-in zoom-in duration-700 select-none drop-shadow-sm font-mono">
                        gopher
                    </h1>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full md:w-1/2 flex items-center justify-center relative z-10 p-4 md:p-10 bg-transparent">

                <div className="w-full max-w-md bg-white/80 dark:bg-gray-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 animate-in slide-in-from-right-10 duration-700 relative z-20">

                    {session?.user ? (
                        <div className="text-center space-y-6">
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Welcome back,<br />
                                <span className="text-emerald-600 dark:text-emerald-400">{session.user.name}</span>!
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400">
                                You are already signed in and ready to go.
                            </p>

                            <div className="flex flex-col gap-4 pt-4">
                                <Link
                                    href="/"
                                    className="w-full justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                                >
                                    🚀 Go to App
                                </Link>

                                <form
                                    action={async () => {
                                        "use server"
                                        await signOut()
                                    }}
                                >
                                    <button
                                        type="submit"
                                        className="w-full justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-red-600 border-2 border-red-100 hover:bg-red-50 hover:border-red-200 transition-all"
                                    >
                                        🚪 Sign Out
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="text-center">
                                <h2 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-2 font-mono">
                                    Welcome to Gopher
                                </h2>
                                <p className="text-gray-500 dark:text-gray-400">
                                    Your smart assistant for events & travel
                                </p>
                            </div>

                            <div className="space-y-4">
                                <form
                                    action={async () => {
                                        "use server"
                                        await signIn("google", { redirectTo: "/" })
                                    }}
                                >
                                    <button
                                        type="submit"
                                        className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-4 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:ring-gray-400 transition-all"
                                    >
                                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Continue with Google
                                    </button>
                                </form>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="bg-white dark:bg-gray-800 px-4 text-gray-400">Or</span>
                                    </div>
                                </div>

                                <form
                                    action={async () => {
                                        "use server"
                                        await signIn("credentials", { redirectTo: "/" })
                                    }}
                                >
                                    <button
                                        type="submit"
                                        className="flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-4 text-sm font-semibold text-white hover:bg-indigo-500 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 items-center gap-2"
                                    >
                                        <span>🐞</span> Log in as Debug User
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
