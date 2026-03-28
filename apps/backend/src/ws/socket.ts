 
import { Server, Socket } from 'socket.io';
import { exchangeService } from '../exchanges/ExchangeService';
import { Timeframe } from '../exchanges/types';

export function setupWebSockets(io: Server) {
  // Хранилище активных стримов биржи (чтобы не плодить подписки на одну и ту же пару)
  const activeStreams = new Map<string, () => void>();

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('subscribe_chart', async (payload: { exchange: string, symbol: string, tf: Timeframe }) => {
      const { exchange, symbol, tf } = payload;
      const roomName = `${exchange}:${symbol}:${tf}`;

      // 1. Клиент присоединяется к комнате Socket.io
      socket.join(roomName);

      // 2. Если подписки на биржу еще нет — создаем
      if (!activeStreams.has(roomName)) {
        const adapter = exchangeService.getAdapter(exchange);
        
        const unsubscribe = adapter.subscribeRealtime(symbol, tf, (candle) => {
          // Рассылаем свечу всем клиентам в этой комнате
          io.to(roomName).emit('candle_update', { exchange, symbol, tf, candle });
        });

        activeStreams.set(roomName, unsubscribe);
      }
    });

    socket.on('unsubscribe_chart', (payload: { exchange: string, symbol: string, tf: Timeframe }) => {
      const roomName = `${payload.exchange}:${payload.symbol}:${payload.tf}`;
      socket.leave(roomName);

      // Graceful Cleanup: если в комнате не осталось клиентов, отписываемся от биржи
      const room = io.sockets.adapter.rooms.get(roomName);
      if (!room || room.size === 0) {
        const unsubscribe = activeStreams.get(roomName);
        if (unsubscribe) {
          unsubscribe();
          activeStreams.delete(roomName);
        }
      }
    });

    socket.on('disconnect', () => {
      // Socket.io автоматически выкидывает клиента из комнат, 
      // но очистку пустых комнат придется проверять по таймеру или хукам адаптера.
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
