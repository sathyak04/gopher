import Chat from '@/components/Chat';
import Navbar from '@/components/Navbar';

export default function Home() {
    return (
        <main className="w-full h-screen flex flex-col overflow-hidden font-mono text-sm">
            <Navbar />
            <div className="flex-1 overflow-hidden relative">
                <Chat />
            </div>
        </main>
    );
}
