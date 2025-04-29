import React, { useEffect, useState } from 'react';
import { assignRole, getUsers, getRoles } from '../services/authService';

const AssignRole = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [userId, setUserId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userList = await getUsers();
        const roleList = await getRoles();
        setUsers(userList);
        setRoles(roleList); // Asegúrate que sea `.roles` si viene como `{ roles: [...] }`
      } catch (error) {
        console.error('Error al cargar usuarios o roles:', error);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await assignRole(Number(userId), Number(roleId));
      setMessage('✅ Rol asignado correctamente');
    } catch (err) {
      setMessage('❌ Error al asignar el rol');
      console.error(err);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 mt-10 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-700">Asignar Rol a Usuario</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Usuario:</label>
          <select
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring focus:ring-blue-200"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            required
          >
            <option value="">Selecciona un usuario</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol:</label>
          <select
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring focus:ring-blue-200"
            value={roleId}
            onChange={e => setRoleId(e.target.value)}
            required
          >
            <option value="">Selecciona un rol</option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>
                {role.role_name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          Asignar Rol
        </button>
      </form>

      {message && (
        <div className="mt-4 text-center text-sm text-gray-800">
          {message}
        </div>
      )}
    </div>
  );
};

export default AssignRole;