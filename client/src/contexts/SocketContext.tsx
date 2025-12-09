import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

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
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("token");

    // 🔥 Render backend for Socket.IO
    const socketUrl =
      process.env.REACT_APP_SOCKET_URL ||
      "https://telemedicine-platform-h2xc.onrender.com";

    console.log("🔌 Connecting to Socket.IO:", socketUrl);

    const newSocket = io(socketUrl, {
      auth: { token },

      // 👇 IMPORTANT: Render free tier does NOT support WebSocket-only
      transports: ["polling", "websocket"],

      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 20000,
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      console.log("🔌 Closing socket");
      newSocket.close();
      setIsConnected(false);
      setSocket(null);
    };
  }, [user]);

  // Video call events
  const joinCall = (callId: string) => socket?.emit("join-call", { callId });
  const leaveCall = (callId: string) => socket?.emit("leave-call", { callId });
  const sendSignal = (callId: string, signal: any) =>
    socket?.emit("call-signal", { callId, signal });

  const onSignal = (callback: (data: any) => void) =>
    socket?.on("call-signal", callback);

  const onUserJoined = (callback: (data: any) => void) =>
    socket?.on("user-joined", callback);

  const onUserLeft = (callback: (data: any) => void) =>
    socket?.on("user-left", callback);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinCall,
        leaveCall,
        sendSignal,
        onSignal,
        onUserJoined,
        onUserLeft,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
