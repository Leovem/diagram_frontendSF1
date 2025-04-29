import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CanvasEditor from '../editor/CanvasEditor';
import Toolbar from '../editor/Toolbar';
import EditorFigmaView from '../editor/EditorFigmaView'
import OcradReader from '../convert/OcradReader';
import MyCanvas from '../figma/MyEditor';
import DiagramViewer from '../Diagram/DiagramViewer';
import CreateRoomModal from '../figma/CreateRoomModal'; // Asegúrate de importar tu modal

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('imagen');
  const [isWorkingAlone, setIsWorkingAlone] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomInput, setRoomInput] = useState(''); // input del nombre de la sala

  const navigate = useNavigate();

  const handleTabClick = (key) => {
    setActiveTab(key);
    setIsWorkingAlone(false);
    setIsModalOpen(false);
  };

  const handleWorkAlone = () => {
    setIsWorkingAlone(true);
  };

  const handleWorkCollaborative = () => {
    setIsModalOpen(true);
  };

  const handleCreateRoom = () => {
    if (roomInput.trim() !== '') {
      // Redirigir a la sala
     // navigate(`/room/${roomInput}`);
      window.open(`/room/${roomInput}`, '_blank');
      setIsModalOpen(false);
      setRoomInput(''); // limpiar el input
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-slate-900 text-white px-4 py-8">
      
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-cyan-300">
          Analizador de Diagramas de Clases
        </h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm transition"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-6">
        <div className="flex gap-4 border-b border-white/20">
          <button
            onClick={() => handleTabClick('imagen')}
            className={`pb-2 px-4 transition ${
              activeTab === 'imagen'
                ? 'border-b-2 border-cyan-400 text-cyan-300 font-semibold'
                : 'text-white/60 hover:text-cyan-200'
            }`}
          >
            IMAGEN
          </button>
          <button
            onClick={() => handleTabClick('boceto')}
            className={`pb-2 px-4 transition ${
              activeTab === 'boceto'
                ? 'border-b-2 border-cyan-400 text-cyan-300 font-semibold'
                : 'text-white/60 hover:text-cyan-200'
            }`}
          >
            FIGMA
          </button>
          <button
            onClick={() => handleTabClick('uml')}
            className={`pb-2 px-4 transition ${
              activeTab === 'uml'
                ? 'border-b-2 border-cyan-400 text-cyan-300 font-semibold'
                : 'text-white/60 hover:text-cyan-200'
            }`}
          >
            UML
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="mt-4 text-white/90">
        {activeTab === 'imagen' && (
          <div className="text-center py-8">
            <OcradReader />
          </div>
        )}

        {activeTab === 'boceto' && (
          <div className="text-center py-8">
            {/* Si aún no eligió */}
            {!isWorkingAlone && !isModalOpen && (
              <div className="flex flex-col items-center gap-6">
                <h2 className="text-2xl font-bold mb-6 text-cyan-300">¿Cómo deseas trabajar?</h2>
                <button
                  onClick={handleWorkAlone}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-lg transition"
                >
                  Trabajar Solo
                </button>
                <button
                  onClick={handleWorkCollaborative}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg transition"
                >
                  Trabajar en Colaborativo
                </button>
              </div>
            )}

            {/* Trabajando solo */}
            {isWorkingAlone && <MyCanvas />}

            {/* Modal para crear sala */}
            <CreateRoomModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onCreate={handleCreateRoom}
              roomInput={roomInput}
              setRoomInput={setRoomInput}
            />
          </div>
        )}

        {activeTab === 'uml' && (
          <div className="text-center py-8">
            <DiagramViewer />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;