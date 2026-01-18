import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AnimatedDiamondGrid from "@/components/AnimatedDiamondGrid"
import GopherLogo from "@/components/GopherLogo"
import LoginNavbar from "@/components/LoginNavbar"
import { ArrowDown } from "lucide-react"
import AnimatedStats from "@/components/AnimatedStats"

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
    const diamondSize = 70;
    const gap = 10;

    return (
        <div className="min-h-screen w-full flex flex-col bg-white dark:bg-gray-900">
            {/* Navbar - Sticky */}
            <LoginNavbar />

            {/* Main Content - Centered Logo */}
            <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center min-h-[90vh]">
                {/* Animated Diamond Grid */}
                <AnimatedDiamondGrid rows={rows} cols={cols} diamondSize={diamondSize} gap={gap} />

                {/* Centered Logo */}
                <div className="relative z-10 text-center mb-12">
                    <GopherLogo />
                    <p className="text-gray-500 dark:text-gray-400 mt-4 text-lg font-mono">
                        Your AI travel companion
                    </p>
                </div>

                {/* Bouncing Arrow - Encourages Scrolling */}
                <div className="absolute bottom-12 z-10 animate-bounce text-emerald-500">
                    <ArrowDown className="w-10 h-10" />
                </div>
            </div>

            {/* Statistics Section - Animated */}
            <div className="relative z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md py-24 px-4">
                <AnimatedStats />
            </div>
        </div>
    )
}
