import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

// TEMPORÁRIO: as fotos do Perucho Burguer em produção ainda apontam para o Storage do projeto de staging.
// Remover este host (e a constante abaixo) quando as fotos forem copiadas para o Storage de produção.
const hostnameStorageStagingTemporario = "ozcvrydvgphlhcblnycm.supabase.co";
const hostnamesImagens = [supabaseHostname, hostnameStorageStagingTemporario].filter(
  (host, indice, lista): host is string => Boolean(host) && lista.indexOf(host) === indice
);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: hostnamesImagens.map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/storage/v1/object/public/**",
    })),
  },
};

export default nextConfig;
