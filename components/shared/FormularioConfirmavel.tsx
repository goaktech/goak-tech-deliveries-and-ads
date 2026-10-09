'use client';

import { useRef, type ReactNode } from 'react';
import { useAvisosPainel, type OpcoesConfirmacao } from '@/components/shared/AvisosPainel';

interface FormularioConfirmavelProps {
  action: string;
  method: 'get' | 'post';
  confirmacao: OpcoesConfirmacao;
  children: ReactNode;
}

/** Formulário que só é enviado depois do "sim" no diálogo do painel (usado em ações de desconectar). */
export function FormularioConfirmavel({ action, method, confirmacao, children }: FormularioConfirmavelProps) {
  const { confirmar } = useAvisosPainel();
  const formRef = useRef<HTMLFormElement | null>(null);
  const jaConfirmadoRef = useRef(false);

  return (
    <form
      ref={formRef}
      action={action}
      method={method}
      onSubmit={async (evento) => {
        if (jaConfirmadoRef.current) return;
        evento.preventDefault();
        if (await confirmar(confirmacao)) {
          jaConfirmadoRef.current = true;
          formRef.current?.submit();
        }
      }}
    >
      {children}
    </form>
  );
}
