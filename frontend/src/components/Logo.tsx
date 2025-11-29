import React from 'react';

interface LogoProps {
    className?: string;
}

export function Logo({ className = "w-10 h-10" }: LogoProps) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="logo-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a855f7" /> {/* purple-500 */}
                    <stop offset="100%" stopColor="#6b21a8" /> {/* purple-800 */}
                </linearGradient>
            </defs>

            {/* Interconnecting Lines */}
            {/* Horizontal Lines */}
            <path d="M5 5H19" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <path d="M5 12H19" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <path d="M5 19H19" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

            {/* Vertical Lines */}
            <path d="M5 5V19" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <path d="M12 5V19" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <path d="M19 5V19" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />

            {/* Grid Nodes (Squares) */}
            {/* Row 1 */}
            <rect x="2.5" y="2.5" width="5" height="5" rx="1.5" fill="url(#logo-gradient)" />
            <rect x="9.5" y="2.5" width="5" height="5" rx="1.5" fill="url(#logo-gradient)" />
            <rect x="16.5" y="2.5" width="5" height="5" rx="1.5" fill="url(#logo-gradient)" />

            {/* Row 2 */}
            <rect x="2.5" y="9.5" width="5" height="5" rx="1.5" fill="url(#logo-gradient)" />
            <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" fill="url(#logo-gradient)" fillOpacity="0.8" />
            <rect x="16.5" y="9.5" width="5" height="5" rx="1.5" fill="url(#logo-gradient)" />

            {/* Row 3 */}
            <rect x="2.5" y="16.5" width="5" height="5" rx="1.5" fill="url(#logo-gradient)" />
            <rect x="9.5" y="16.5" width="5" height="5" rx="1.5" fill="url(#logo-gradient)" />
            <rect x="16.5" y="16.5" width="5" height="5" rx="1.5" fill="url(#logo-gradient)" />
        </svg>
    );
}
