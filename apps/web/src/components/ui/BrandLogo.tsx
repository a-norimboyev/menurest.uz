interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export function BrandLogo({ size = 'md', showText = true, className = '' }: BrandLogoProps) {
  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const textMap = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <img
        src="/logo.svg"
        alt="MENUREST.UZ Logo"
        className={`${sizeMap[size]} object-contain drop-shadow-sm rounded-xl shrink-0`}
      />
      {showText && (
        <div className="flex flex-col">
          <span className={`font-black tracking-tight text-ink-main leading-tight ${textMap[size]}`}>
            MENUREST<span className="text-brand">.UZ</span>
          </span>
        </div>
      )}
    </div>
  );
}
