import React, { useEffect, useState } from 'react';
import { socket } from '../figma/socketService';  // Asegúrate de que esta importación esté correcta

const ActiveRooms = () => {
  const [rooms, setRooms] = useState([]);
  
  useEffect(() => {
    // Escuchar las salas activas enviadas por el servidor
    socket.on('activeRooms', (activeRooms) => {
        console.log('🟢 Salas activas recibidas:', activeRooms);
      setRooms(activeRooms);  // Actualizar el estado con el arreglo de nombres de salas
    });

    // Limpiar la conexión al desconectarse
    return () => {
      socket.off('activeRooms');  // Asegúrate de limpiar el evento al desmontar el componente
    };
  }, []);
  
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-300 mb-2">Salas Activas</h3>
      <div className="space-y-2">
        {rooms.length > 0 ? (
          rooms.map((room, index) => (
            <div key={index} className="text-white hover:bg-gray-700 px-3 py-2 rounded">
              {room}
            </div>
          ))
        ) : (
          <p className="text-gray-400">No hay salas activas</p>
        )}
      </div>
    </div>
  );
};

export default ActiveRooms;