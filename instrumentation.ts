// Roda uma vez quando o servidor Next sobe. Em processo Node contínuo
// (npm run dev / next start) liga o polling de eventos do iFood, que assim
// não depende de ninguém estar com a cozinha aberta. Na Vercel não há
// processo contínuo: lá o polling vem de POST /api/cron/ifood/eventos.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL) {
    const { iniciarPollingContinuoIfood } = await import('./utils/ifood-polling');
    iniciarPollingContinuoIfood();
  }
}
