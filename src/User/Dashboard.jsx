import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CanvasEditor from '../editor/CanvasEditor';
import Toolbar from '../editor/Toolbar';
import EditorFigmaView from '../editor/EditorFigmaView'
import OcradReader from '../convert/OcradReader';
import MyCanvas from '../figma/MyEditor';
import DiagramViewer from '../Diagram/DiagramViewer';
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('imagen');
  const navigate = useNavigate();

  const handleTabClick = (key) => {
    setActiveTab(key);
  };

  const handleLogout = () => {
    localStorage.removeItem('token'); // 🔐 Limpia el token
    navigate('/login'); // 🔁 Redirige
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-slate-900 text-white px-4 py-8">
      {/* <div className="w-full max-w8xl min-h-[800px] max-h-[80vh] overflow-y-auto mx-auto bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl p-10"> */}

        {/* Encabezado con botón de logout */}
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

        {/* Contenido de la pestaña */}
        <div className="mt-4 text-white/90">
          {activeTab === 'imagen' && (
            <div className="text-center py-8">
             < OcradReader/>
            </div>
          )}
          {activeTab === 'boceto' && (
           <div className="text-center py-8">
             <MyCanvas />
          
            </div> 
          )}
          {activeTab === 'uml' && (
            <div className="text-center py-8">
              <DiagramViewer />
            </div>
          )}
        </div>
      {/* </div> */}
    </div>
  );
};

export default Dashboard;