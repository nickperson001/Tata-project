import { useEffect, useRef } from 'react';
import { getSocket, disconnectSocket } from '../services/socket';
import type { Socket } from 'socket.io-client';

export function useSocket(
  event: string,
  handler: (data: unknown) => void,
): { socket: Socket | null } {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const wrapped = (data: unknown) => handlerRef.current(data);
    socket.on(event, wrapped);
    return () => {
      socket.off(event, wrapped);
    };
  }, [event]);

  return { socket: getSocket() };
}

export function useSocketCleanup(): void {
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);
}
