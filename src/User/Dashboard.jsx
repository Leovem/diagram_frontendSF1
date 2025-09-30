// src/User/Dashboard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MyCanvas from '../ER_diagram/ER_editor';
import DiagramViewer from '../Diagram/DiagramViewer';
import CreateRoomModal from '../ER_diagram/CreateRoomModal';
import FloatingRobot from '../ai/FloatingRobot';

// 👇 imports del bot
import BotAISidebar from '../ai/BotAISidebar';
import FloatingBotButton from '../ai/FloatingBotButton';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('boceto');
  const [isWorkingAlone, setIsWorkingAlone] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomInput, setRoomInput] = useState('');

  // 👇 estado del sidebar del bot
  const [showBot, setShowBot] = useState(false);

  const navigate = useNavigate();

  const handleTabClick = (key) => {
    setActiveTab(key);
    // Resetear estados cuando cambias de tab
    setIsWorkingAlone(false);
    setIsModalOpen(false);
    setRoomInput('');
  };

  const handleWorkAlone = () => {
    setIsWorkingAlone(true);
    setIsModalOpen(false);
  };

  const handleWorkCollaborative = () => {
    setIsModalOpen(true);
    setIsWorkingAlone(false);
  };

  const handleCreateRoom = () => {
    const roomName = roomInput.trim();
    if (roomName !== '') {
      if (roomName.length < 3) {
        alert('El nombre de la sala debe tener al menos 3 caracteres');
        return;
      }
      window.open(`/room/${encodeURIComponent(roomName)}`, '_blank');
      setIsModalOpen(false);
      setRoomInput('');
    } else {
      alert('Por favor ingresa un nombre para la sala');
    }
  };

  const handleJoinExistingRoom = () => {
    const roomName = prompt('Ingresa el nombre de la sala a la que te quieres unir:');
    if (roomName && roomName.trim() !== '') {
      window.open(`/room/${encodeURIComponent(roomName.trim())}`, '_blank');
    }
  };

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  const handleBackToSelection = () => {
    setIsWorkingAlone(false);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-slate-900 text-white px-4 py-8">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-cyan-300 text-center sm:text-left">
          Crear Diagramas de Clases
        </h1>

        <div className="flex items-center gap-2">
          {/* Botón para abrir el bot (además del botón flotante) */}
          {/*<button
            onClick={() => setShowBot(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm transition-colors duration-200"
            title="Abrir asistente"
          >
            🤖 Abrir IA
          </button>*/}

          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm transition-colors duration-200 flex items-center gap-2"
          >
            <span>🚪</span>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-6">
        <div className="flex gap-4 border-b border-white/20 overflow-x-auto">
          <button
            onClick={() => handleTabClick('boceto')}
            className={`pb-2 px-4 transition-all duration-200 whitespace-nowrap ${
              activeTab === 'boceto'
                ? 'border-b-2 border-cyan-400 text-cyan-300 font-semibold'
                : 'text-white/60 hover:text-cyan-200'
            }`}
          >
             DIAGRAMA ENTIDAD-RELACIÓN
          </button>
          <button
            onClick={() => handleTabClick('uml')}
            className={`pb-2 px-4 transition-all duration-200 whitespace-nowrap ${
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
        {activeTab === 'boceto' && (
          <div className="text-center">
            {!isWorkingAlone && !isModalOpen && (
              <div className="flex flex-col items-center gap-6 py-8">
                <h2 className="text-2xl font-bold mb-6 text-cyan-300">
                  ¿Cómo deseas trabajar en tu diagrama?
                </h2>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleWorkAlone}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg text-lg transition-colors duration-200 flex items-center gap-3 min-w-[200px]"
                  >
                    <span>👤</span>
                    Trabajar Solo
                  </button>
                  <button
                    onClick={handleWorkCollaborative}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg transition-colors duration-200 flex items-center gap-3 min-w-[200px]"
                  >
                    <span>👥</span>
                    Modo Colaborativo
                  </button>
                </div>
                <button
                  onClick={handleJoinExistingRoom}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg text-base transition-colors duration-200 flex items-center gap-2"
                >
                  <span>🚪</span>
                  Unirse a Sala Existente
                </button>
              </div>
            )}

            {isWorkingAlone && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-cyan-300">Modo Individual</h2>
                  <button
                    onClick={handleBackToSelection}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors duration-200"
                  >
                    ← Volver
                  </button>
                </div>
                <div className="border border-gray-600 rounded-lg overflow-hidden">
                  <MyCanvas />
                </div>
              </div>
            )}

            <CreateRoomModal
              isOpen={isModalOpen}
              onClose={() => {
                setIsModalOpen(false);
                setRoomInput('');
              }}
              onCreate={handleCreateRoom}
              roomInput={roomInput}
              setRoomInput={setRoomInput}
            />
          </div>
        )}

        {activeTab === 'uml' && (
          <div className="text-center">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-cyan-300 mb-2">
                Diagramas UML
              </h2>
              <p className="text-gray-400">
                Visualiza y edita diagramas UML para el diseño de clases
              </p>
            </div>
            <div className="border border-gray-600 rounded-lg overflow-hidden">
              <DiagramViewer />
            </div>
          </div>
        )}
      </div>

      
      {/* Botón flotante para abrir el asistente */}
      {/*<FloatingBotButton onClick={() => setShowBot(true)} />*}

      {/* Sidebar IA plegable */}
      {/*<BotAISidebar open={showBot} onClose={() => setShowBot(false)} />*}

      {/* Robot flotante que abre el panel */}
      <FloatingRobot onClick={() => setShowBot(true)} />

      {/* Sidebar IA plegable */}
      <BotAISidebar open={showBot} onClose={() => setShowBot(false)} />
      

      {/* Footer informativo */}
      <div className="fixed bottom-4 right-4 text-xs text-gray-400 bg-gray-800/50 backdrop-blur-sm px-3 py-2 rounded-lg">
        💡 Tip: Usa Ctrl+S para guardar tu progreso
      </div>
    </div>
  );
};

export default Dashboard;
