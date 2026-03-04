import { auth } from "@/auth"
import { redirect } from "next/navigation"
import AnimatedDiamondGrid from "@/components/AnimatedDiamondGrid"
import GopherLogo from "@/components/GopherLogo"
import LoginNavbar from "@/components/LoginNavbar"
import { ArrowDown } from "lucide-react"
import { FeaturesGrid, TechnologiesGrid } from "@/components/AnimatedStats"

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
        <div className="min-h-screen w-full flex flex-col bg-white dark:bg-gray-900 overflow-x-hidden">
            {/* Navbar - Sticky */}
            <LoginNavbar />

            {/* Main Content */}
            <div className="relative flex flex-col justify-center py-20 mt-12">
                <AnimatedDiamondGrid rows={rows} cols={cols} diamondSize={diamondSize} gap={gap} />

                {/* Left side: Gopher Text / Right side: Technologies */}
                <div className="relative z-10 w-full max-w-7xl mx-auto px-4 lg:px-8 mt-16 mb-8 flex flex-col lg:flex-row items-center justify-between">

                    {/* Left Side */}
                    <div className="flex flex-col items-center justify-center w-full lg:w-[50%] mb-16 lg:mb-0">
                        <div className="text-center w-full">
                            <GopherLogo />
                            <p className="text-gray-500 dark:text-gray-400 mt-4 text-xl font-mono">
                                Your AI travel companion
                            </p>
                        </div>
                    </div>

                    {/* Right Side */}
                    <div className="flex flex-col items-center justify-center w-full lg:w-[50%]">
                        <TechnologiesGrid />
                    </div>

                </div>

            </div>

            {/* Features Section - Right under context */}
            <div className="relative z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md py-8 px-4 w-full">
                <div className="max-w-6xl mx-auto">
                    <FeaturesGrid />
                </div>
            </div>
        </div>
    )
}
