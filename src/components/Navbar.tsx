import React from 'react';

const Navbar = () => {
    return (
        <nav className="w-full bg-white border-b border-gray-200 h-16 flex items-center justify-center shrink-0 z-50 shadow-sm relative">
            <h1 className="text-4xl font-extrabold tracking-tighter bg-gradient-to-r from-emerald-300 to-emerald-600 bg-clip-text text-transparent pb-1">
                gopher
            </h1>
        </nav>
    );
};

export default Navbar;
