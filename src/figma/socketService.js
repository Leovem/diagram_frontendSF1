// socketService.js
import { io } from 'socket.io-client';

// Creamos la conexión al backend
export const socket = io('http://localhost:5000', {
  transports: ['websocket'], // Usa WebSocket directamente
  withCredentials: true,     // Permite cookies si se requieren
});

// Opcional: escuchamos cuando se conecta
socket.on('connect', () => {
  console.log('✅ Socket conectado al servidor');
});
