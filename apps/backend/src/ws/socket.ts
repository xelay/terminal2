import { Server, Socket } from 'socket.io';
import { exchangeService } from '../exchanges/ExchangeService';
import { Timeframe } from '../exchanges/types';

export function setupWebSockets(io: Server) {
  const activeStreams = new Map<string, () => void>();

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('subscribe_chart', async (payload: { exchange: string; symbol: string; tf: Timeframe }) => {
      const { exchange, symbol, tf } = payload;
      const roomName = `${exchange}:${symbol}:${tf}`;

      socket.join(roomName);

      if (!activeStreams.has(roomName)) {
        let adapter;
        try {
          adapter = exchangeService.getAdapter(exchange);
        } catch (e) {
          console.warn(`[WS] Unknown exchange "${exchange}" requested by ${socket.id} — ignoring`);
          socket.emit('exchange_error', { exchange, message: `Exchange "${exchange}" is not available` });
          return;
        }

        const unsubscribe = adapter.subscribeRealtime(symbol, tf, (candle) => {
          io.to(roomName).emit('candle_update', { exchange, symbol, tf, candle });
        });

        activeStreams.set(roomName, unsubscribe);
      }
    });

    socket.on('unsubscribe_chart', (payload: { exchange: string; symbol: string; tf: Timeframe }) => {
      const roomName = `${payload.exchange}:${payload.symbol}:${payload.tf}`;
      socket.leave(roomName);

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
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
