import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const goToUserDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-4 space-y-4">
        <h2 className="text-2xl font-bold mb-6">Panel Admin</h2>
        <nav className="flex flex-col space-y-2">
          <Link to="/users" className="hover:bg-gray-700 px-3 py-2 rounded">Gestionar Usuarios</Link>
          <Link to="/Roles" className="hover:bg-gray-700 px-3 py-2 rounded">Gestionar Roles</Link>
          <Link to="/assign_role" className="hover:bg-gray-700 px-3 py-2 rounded">Asignar Rol</Link>
        </nav>

        {/* Botón para ir al Dashboard de Usuario */}
        <button
          onClick={goToUserDashboard}
          className="mt-6 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Salir de Administracion
        </button>
      </aside>

      {/* Contenido */}
      <main className="flex-1 bg-gray-100 p-4">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminDashboard;