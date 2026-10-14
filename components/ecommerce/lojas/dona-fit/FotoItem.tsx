'use client';

import { useState } from 'react';
import Image from 'next/image';

interface FotoItemProps {
  src: string | null | undefined;
  alt: string;
  tamanho: number;
  className?: string;
  placeholder?: string;
}

export default function FotoItem({ src, alt, tamanho, className = '', placeholder = '🥗' }: FotoItemProps) {
  const [falhou, setFalhou] = useState(false);

  if (!src || falhou) {
    return (
      <span className={`flex h-full w-full items-center justify-center text-2xl ${className}`} aria-hidden>
        {placeholder}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={tamanho}
      height={tamanho}
      sizes={`${tamanho}px`}
      className={`h-full w-full object-cover ${className}`}
      onError={() => setFalhou(true)}
      unoptimized
    />
  );
}
