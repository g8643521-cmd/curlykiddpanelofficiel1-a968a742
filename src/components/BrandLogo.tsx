import { useState } from 'react';

type BrandLogoProps = {
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show text alongside icon */
  showText?: boolean;
  /** Custom className for the container */
  className?: string;
};

/**
 * Custom CurlyKiddPanel icon - gaming controller with signal waves
 */
const ControlIcon = ({ size = 24, className = "", isHovered = false }: { size?: number; className?: string; isHovered?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-300 ${isHovered ? 'scale-110 rotate-6' : ''} ${className}`}
  >
    {/* Signal waves emanating from top */}
    <path
      d="M16 2C16 2 12 6 12 8C12 10.2 13.8 12 16 12C18.2 12 20 10.2 20 8C20 6 16 2 16 2Z"
      fill="currentColor"
      opacity="0.9"
      className={`transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-90'}`}
    />
    <path
      d="M10 5C8.5 6.5 7.5 8.5 7.5 10.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={`transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-60'}`}
    />
    <path
      d="M22 5C23.5 6.5 24.5 8.5 24.5 10.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={`transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-60'}`}
    />
    <path
      d="M6 2C3.5 4.5 2 8 2 11.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={`transition-all duration-300 ${isHovered ? 'opacity-80' : 'opacity-30'}`}
    />
    <path
      d="M26 2C28.5 4.5 30 8 30 11.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={`transition-all duration-300 ${isHovered ? 'opacity-80' : 'opacity-30'}`}
    />
    
    {/* Controller base */}
    <path
      d="M6 16C4 16 2 18 2 20V24C2 26 4 28 6 28H10L12 30H20L22 28H26C28 28 30 26 30 24V20C30 18 28 16 26 16H6Z"
      fill="currentColor"
      className={`transition-opacity duration-300 ${isHovered ? 'opacity-25' : 'opacity-15'}`}
    />
    <path
      d="M6 16C4 16 2 18 2 20V24C2 26 4 28 6 28H10L12 30H20L22 28H26C28 28 30 26 30 24V20C30 18 28 16 26 16H6Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    
    {/* D-pad on left */}
    <path
      d="M9 20H7M8 19V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    
    {/* Buttons on right */}
    <circle cx="23" cy="20" r="1.5" fill="currentColor" />
    <circle cx="26" cy="20" r="1.5" fill="currentColor" className={`transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-60'}`} />
    <circle cx="24.5" cy="22.5" r="1.5" fill="currentColor" className={`transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-60'}`} />
    
    {/* Center screen/display */}
    <rect
      x="13"
      y="19"
      width="6"
      height="4"
      rx="1"
      fill="currentColor"
      className={`transition-opacity duration-300 ${isHovered ? 'opacity-70' : 'opacity-40'}`}
    />
  </svg>
);

/**
 * Brand identity with custom icon and "CurlyKiddPanel" text
 * "CurlyKidd" in white, "Panel" in primary teal
 */
export default function BrandLogo({ 
  size = "md", 
  showText = true,
  className = "" 
}: BrandLogoProps) {
  const [isHovered, setIsHovered] = useState(false);

  const sizeConfig = {
    sm: { text: "text-base", gap: "gap-1.5", icon: 16 },
    md: { text: "text-lg", gap: "gap-2", icon: 20 },
    lg: { text: "text-2xl", gap: "gap-2.5", icon: 28 },
  };

  const s = sizeConfig[size];

  return (
    <div 
      className={`flex items-center ${s.gap} cursor-pointer group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ControlIcon 
        size={s.icon} 
        isHovered={isHovered}
        className={`text-primary transition-all duration-300 ${isHovered ? 'drop-shadow-[0_0_12px_hsl(var(--primary)/0.8)]' : 'drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]'}`} 
      />
      {showText && (
        <span className={`font-bold italic tracking-tight ${s.text} transition-all duration-300`}>
          <span className={`text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] transition-all duration-300`}>CurlyKidd</span>
          <span className={`text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)] transition-all duration-300`}>Panel</span>
        </span>
      )}
    </div>
  );
}
