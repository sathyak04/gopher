import Chat from '@/components/Chat';
import MapView from '@/components/MapView';

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-stone-100">
            <div className="w-full max-w-5xl items-center justify-between font-mono text-sm">
                <Chat />
                {/* Test Map - Remove after verifying API works */}
                <div className="mt-8">
                    <MapView />
                </div>
            </div>
        </main>
    );
}
