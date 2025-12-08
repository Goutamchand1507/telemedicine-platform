import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinCall: (callId: string) => void;
  leaveCall: (callId: string) => void;
  sendSignal: (callId: string, signal: any) => void;
  onSignal: (callback: (data: any) => void) => void;
  onUserJoined: (callback: (data: any) => void) => void;
  onUserLeft: (callback: (data: any) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
      console.log('🔌 Connecting to Socket.IO:', socketUrl);

      const newSocket = io(socketUrl, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000,
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setIsConnected(false);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
      };
    }
    return undefined;
  }, [user]);

  const joinCall = (callId: string) => {
    if (socket) {
      socket.emit('join-call', { callId });
    }
  };

  const leaveCall = (callId: string) => {
    if (socket) {
      socket.emit('leave-call', { callId });
    }
  };

  const sendSignal = (callId: string, signal: any) => {
    if (socket) {
      socket.emit('call-signal', { callId, signal });
    }
  };

  const onSignal = (callback: (data: any) => void) => {
    if (socket) {
      socket.on('call-signal', callback);
    }
  };

  const onUserJoined = (callback: (data: any) => void) => {
    if (socket) {
      socket.on('user-joined', callback);
    }
  };

  const onUserLeft = (callback: (data: any) => void) => {
    if (socket) {
      socket.on('user-left', callback);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    joinCall,
    leaveCall,
    sendSignal,
    onSignal,
    onUserJoined,
    onUserLeft,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
