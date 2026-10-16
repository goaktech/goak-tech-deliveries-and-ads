export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL) {
    const { iniciarPollingContinuoIfood } = await import('./utils/ifood-polling');
    iniciarPollingContinuoIfood();
  }
}
