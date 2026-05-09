import { io, Socket } from 'socket.io-client';

export interface DrawingPoint {
  x: number;
  y: number;
  color: string;
  size: number;
  isEraser?: boolean;
}

export interface DrawingStroke {
  points: DrawingPoint[];
  userId: string;
  timestamp: number;
}

export interface HeartReaction {
  x: number;
  y: number;
  userId: string;
  timestamp: number;
}

class SocketService {
  private socket: Socket | null = null;
  private roomId: string | null = null;

  connect(roomId: string, userId: string) {
    if (this.socket?.connected) {
      this.disconnect();
    }

    const url =
      (import.meta as any).env?.VITE_SOCKET_URL ||
      ((import.meta as any).env?.PROD ? 'wss://your-production-server.com' : 'ws://localhost:3001');

    this.socket = io(url, {
      transports: ['websocket'],
      upgrade: false
    });

    this.roomId = roomId;

    this.socket.emit('join-room', { roomId, userId });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomId = null;
  }

  emitDraw(point: DrawingPoint) {
    if (this.socket && this.roomId) {
      this.socket.emit('draw-point', {
        roomId: this.roomId,
        point
      });
    }
  }

  emitStrokeStart(point: DrawingPoint) {
    if (this.socket && this.roomId) {
      this.socket.emit('stroke-start', {
        roomId: this.roomId,
        point
      });
    }
  }

  emitStrokeEnd() {
    if (this.socket && this.roomId) {
      this.socket.emit('stroke-end', {
        roomId: this.roomId
      });
    }
  }

  emitClearCanvas() {
    if (this.socket && this.roomId) {
      this.socket.emit('clear-canvas', {
        roomId: this.roomId
      });
    }
  }

  emitHeartReaction(x: number, y: number) {
    if (this.socket && this.roomId) {
      this.socket.emit('heart-reaction', {
        roomId: this.roomId,
        x,
        y
      });
    }
  }

  onDrawPoint(callback: (point: DrawingPoint) => void) {
    this.socket?.on('draw-point', callback);
  }

  onStrokeStart(callback: (point: DrawingPoint) => void) {
    this.socket?.on('stroke-start', callback);
  }

  onStrokeEnd(callback: () => void) {
    this.socket?.on('stroke-end', callback);
  }

  onClearCanvas(callback: () => void) {
    this.socket?.on('clear-canvas', callback);
  }

  onHeartReaction(callback: (reaction: HeartReaction) => void) {
    this.socket?.on('heart-reaction', callback);
  }

  onPartnerConnected(callback: (userId: string) => void) {
    this.socket?.on('partner-connected', callback);
  }

  onPartnerDisconnected(callback: (userId: string) => void) {
    this.socket?.on('partner-disconnected', callback);
  }

  onPartnerDrawing(callback: (isDrawing: boolean) => void) {
    this.socket?.on('partner-drawing', callback);
  }

  removeListener(event: string, callback?: Function) {
    if (callback) {
      this.socket?.off(event, callback as any);
    } else {
      this.socket?.off(event);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
