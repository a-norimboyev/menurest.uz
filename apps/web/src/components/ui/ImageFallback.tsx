import React, { useState } from 'react';
import { Utensils } from 'lucide-react';

export interface ImageFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  alt: string;
  fallbackIcon?: React.ReactNode;
}

export const ImageFallback: React.FC<ImageFallbackProps> = ({
  src,
  alt,
  className = '',
  fallbackIcon,
  ...props
}) => {
  const [error, setError] = useState(!src);

  if (error || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`bg-slate-100 border border-line flex flex-col items-center justify-center text-ink-muted select-none ${className}`}
      >
        {fallbackIcon || <Utensils className="w-8 h-8 text-slate-300" />}
        <span className="text-[10px] font-medium text-slate-400 mt-1 px-2 text-center truncate max-w-full">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className={`object-cover ${className}`}
      {...props}
    />
  );
};
