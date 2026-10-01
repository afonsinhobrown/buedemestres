import Pusher from 'pusher';

function isConfigured(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID &&
    process.env.NEXT_PUBLIC_PUSHER_APP_KEY &&
    process.env.PUSHER_SECRET &&
    process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  );
}

/**
 * Dispara um evento em tempo real.
 *
 * Nunca deixa a acção que o chama falhar: se o Pusher não estiver configurado
 * ou a rede falhar, o aviso é ignorado e o pedido que originou o evento
 * continua. O cliente é construído só quando é preciso, para não rebentar na
 * importação do módulo em ambientes sem PUSHER_* configurado.
 */
export async function notify(channel: string, event: string, payload: unknown) {
  if (!isConfigured()) {
    console.warn(`Pusher não configurado — evento "${event}" descartado.`);
    return;
  }

  const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });

  try {
    await pusher.trigger(channel, event, payload);
  } catch (error) {
    console.error(`Pusher: falhou o evento "${event}" no canal "${channel}"`, error);
  }
}