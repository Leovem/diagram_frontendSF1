import React from 'react';

export default function CreateRoomModal({ isOpen, onClose, onCreate, roomInput, setRoomInput }) {
  if (!isOpen) return null; // Si no está abierto, no renderiza nada.

  return (
    
    <div className="fixed inset-0 bg-amber-50 bg-opacity-50 flex justify-center items-center z-50">
  <div className="bg-white p-8 rounded-lg shadow-lg w-96 flex flex-col items-center">
    <h2 className="text-2xl mb-6 text-gray-800 font-bold">Crear Sala</h2>

    <input
      type="text"
      value={roomInput}
      onChange={(e) => setRoomInput(e.target.value)}
      placeholder="Nombre de la Sala"
      className="w-full bg-blue-600 text-white placeholder-white border-2 border-blue-800 p-2 mb-6 rounded focus:outline-none"
    />

    <div className="flex justify-end w-full gap-4">
      <button
        onClick={onClose}
        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
      >
        Cancelar
      </button>
      <button
        onClick={onCreate}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Crear
      </button>
    </div>
  </div>
</div>
    
  );
}