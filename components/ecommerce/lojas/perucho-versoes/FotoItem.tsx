import Image from 'next/image';

interface FotoItemProps {
  /** Classe do quadro (precisa ter tamanho/proporção definidos no CSS da versão). */
  className: string;
  /** Classe do quadro quando o item não tem foto cadastrada. */
  classeSemFoto?: string;
  src: string | null | undefined;
  alt: string;
  sizes: string;
}

/** Quadro de foto do item. `unoptimized` como na vitrine atual: aceita qualquer host de Storage. */
export function FotoItem({ className, classeSemFoto, src, alt, sizes }: FotoItemProps) {
  if (!src) {
    return <div className={classeSemFoto ?? className} aria-hidden />;
  }
  return (
    <div className={className}>
      <Image src={src} alt={alt} fill sizes={sizes} unoptimized loading="lazy" />
    </div>
  );
}
