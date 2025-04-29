import React, { useEffect, useState } from "react";
import {
  getUsers,
  registerUser1,
  updateUser,
  deleteUser,
} from '../services/authService';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    gender: "",
    password: "",
  });
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const data = await getUsers();
    setUsers(data);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) {
      await updateUser(editId, form);
    } else {
      await registerUser1(form);
    }
    setForm({ firstName: "", lastName: "", email: "", gender: "", password: "" });
    setEditId(null);
    fetchUsers();
  };

  const handleEdit = (user) => {
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      gender: user.gender,
      password: "",
    });
    setEditId(user.id);
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Estás seguro de eliminar este usuario?")) {
      await deleteUser(id);
      fetchUsers();
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Gestión de Usuarios</h2>

      <form onSubmit={handleSubmit} className="mb-4 space-y-2">
        <input
          type="text"
          name="firstName"
          placeholder="Nombre"
          value={form.firstName}
          onChange={handleChange}
          className="border p-2 w-full"
          required
        />
        <input
          type="text"
          name="lastName"
          placeholder="Apellido"
          value={form.lastName}
          onChange={handleChange}
          className="border p-2 w-full"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Correo"
          value={form.email}
          onChange={handleChange}
          className="border p-2 w-full"
          required
        />
        <select
          name="gender"
          value={form.gender}
          onChange={handleChange}
          className="border p-2 w-full"
          required
        >
          <option value="">Selecciona género</option>
          <option value="Masculino">Masculino</option>
          <option value="Femenino">Femenino</option>
        </select>
        <input
          type="password"
          name="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={handleChange}
          className="border p-2 w-full"
          required={!editId}
        />
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          {editId ? "Actualizar" : "Registrar"}
        </button>
      </form>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Nombre</th>
            <th className="border p-2">Correo</th>
            <th className="border p-2">Género</th>
            <th className="border p-2">Rol</th>
            <th className="border p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="border p-2">{u.firstName} {u.lastName}</td>
              <td className="border p-2">{u.email}</td>
              <td className="border p-2">{u.gender}</td>
              <td className="border p-2">{u.Role?.role_name || "Sin rol"}</td>
              <td className="border p-2 space-x-2">
                <button
                  className="bg-yellow-400 px-2 py-1 rounded"
                  onClick={() => handleEdit(u)}
                >
                  Editar
                </button>
                <button
                  className="bg-red-500 text-white px-2 py-1 rounded"
                  onClick={() => handleDelete(u.id)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
