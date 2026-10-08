export const metadata = {
  title: 'Exclusão de dados — Meta Ads',
};

interface PaginaProps {
  searchParams: Promise<{ codigo?: string }>;
}

export default async function ExclusaoDadosMetaAdsPage({ searchParams }: PaginaProps) {
  const { codigo } = await searchParams;
  const codigoSeguro = codigo && /^[0-9a-f-]{36}$/i.test(codigo) ? codigo : null;

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-12 text-[#1A1A1A]">
      <h1 className="text-2xl font-semibold tracking-tight">Exclusão de dados do Meta Ads</h1>

      {codigoSeguro ? (
        <p className="mt-4 text-sm text-zinc-600">
          Sua solicitação de exclusão foi processada. Removemos o token de acesso, os dados da conta de anúncios e as
          métricas em cache vinculados ao seu usuário da Meta. Código de confirmação:{' '}
          <span className="font-mono text-zinc-900">{codigoSeguro}</span>
        </p>
      ) : (
        <p className="mt-4 text-sm text-zinc-600">
          Quando você remove o app das configurações do Facebook ou pede a exclusão dos seus dados, apagamos
          automaticamente o token de acesso, os dados da conta de anúncios e as métricas em cache vinculados ao seu
          usuário da Meta.
        </p>
      )}

      <p className="mt-4 text-sm text-zinc-600">
        Também é possível desconectar a qualquer momento em Admin → Integrações → Meta Ads → Desconectar, o que revoga
        o acesso na Meta e apaga esses dados. Dúvidas: entre em contato pelo e-mail de suporte informado no site.
      </p>
    </main>
  );
}
