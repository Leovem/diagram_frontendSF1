import { Link } from 'react-router-dom';

const Sidebar = () => {
  return (
    <div className="w-full md:w-64 bg-gray-800 text-white min-h-screen p-4">
      <h2 className="text-xl font-bold mb-6">Admin Panel</h2>
      <nav className="flex flex-col space-y-4">
        <Link to="/admin/asignar-rol" className="hover:bg-gray-700 p-2 rounded">Asignar Rol</Link>
        <Link to="/admin/usuarios" className="hover:bg-gray-700 p-2 rounded">Gestionar Usuarios</Link>
        {/* Puedes agregar más enlaces aquí */}
      </nav>
    </div>
  );
};

export default Sidebar;