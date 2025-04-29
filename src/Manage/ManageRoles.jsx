import React, { useEffect, useState } from 'react';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
} from '../services/authService';

const ManageRoles = () => {
  const [roles, setRoles] = useState([]);
  const [roleName, setRoleName] = useState('');
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const data = await getRoles();
      setRoles(data);
    } catch (err) {
      console.error('Error al obtener roles', err);
    }
  };

  const handleCreateOrUpdate = async () => {
    try {
      if (editId) {
        await updateRole(editId, roleName);
      } else {
        await createRole(roleName);
      }
      setRoleName('');
      setEditId(null);
      fetchRoles();
    } catch (err) {
      console.error('Error al crear/actualizar rol', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRole(id);
      fetchRoles();
    } catch (err) {
      console.error('Error al eliminar rol', err);
    }
  };

  const startEdit = (role) => {
    setRoleName(role.role_name);
    setEditId(role.id);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6 text-center">Gestión de Roles</h2>

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <input
          type="text"
          className="w-full sm:w-2/3 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          placeholder="Nombre del rol"
        />
        <button
          onClick={handleCreateOrUpdate}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          {editId ? 'Actualizar Rol' : 'Crear Rol'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded-md">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Nombre del Rol</th>
              <th className="px-4 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-t">
                <td className="px-4 py-2">{role.id}</td>
                <td className="px-4 py-2 capitalize">{role.role_name}</td>
                <td className="px-4 py-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => startEdit(role)}
                    className="px-3 py-1 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(role.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan="3" className="text-center py-4 text-gray-500">
                  No hay roles registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageRoles;