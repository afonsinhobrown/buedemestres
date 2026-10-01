import PusherClient from 'pusher-js';

const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

/**
 * Cliente Pusher do browser, ou null quando o Pusher não está configurado.
 * Com null, os componentes que assinam canais simplesmente não recebem
 * atualizações em tempo real — o resto da página continua a funcionar.
 */
export const pusherClient = key && cluster ? new PusherClient(key, { cluster }) : null;