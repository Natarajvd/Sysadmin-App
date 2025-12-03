export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isComplete: boolean;
  timestamp: number;
  image?: string; // Base64 Data URL
}

export interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  messages: ChatMessage[];
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface AudioVisualizerProps {
  isConnected: boolean;
  accentColor?: string;
  getAudioData: () => Uint8Array;
}