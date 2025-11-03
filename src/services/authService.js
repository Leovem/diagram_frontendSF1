import axios from 'axios';

// ✅ backend corre en 5000 y con /api
//const API_URL = 'http://localhost:5000/api/';
// ✅ CORRECTO: El puerto HTTPS (443) es implícito.
const API_URL = 'https://diagrambackendsf1-production.up.railway.app/api/';

// Crea una instancia para no repetir baseURL
const api = axios.create({
  baseURL: API_URL,
  // withCredentials: true, // descomenta si usas cookies/sesiones
  timeout: 10000,
});

// =========== AUTH ===========
export const loginUser = async (email, password) => {
  try {
    const { data } = await api.post('users/login', { email, password });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || 'Error de login');
  }
};

export const registerUser = async (firstName, lastName, email, gender, password) => {
  try {
    const { data } = await api.post('users/register', {
      firstName,
      lastName,
      email,
      gender,
      password,
    });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.msg || 'Error en el registro');
  }
};

// =========== USERS ===========
export const assignRole = async (userId, roleId) => {
  try {
    const { data } = await api.put('users/assign-role', { userId, roleId });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message);
  }
};

export const getUsers = async () => {
  const { data } = await api.get('users/list');
  return data.users;
};

export const registerUser1 = async (userData) => {
  const { data } = await api.post('users/register', userData);
  return data;
};

export const updateUser = async (userId, updatedData) => {
  const { data } = await api.put('users/update', { userId, ...updatedData });
  return data;
};

export const deleteUser = async (userId) => {
  const { data } = await api.delete('users/delete', { data: { userId } });
  return data;
};

// =========== ROLES ===========
export const getRoles = async () => {
  const { data } = await api.get('roles/get');
  return data; // ajusta según tu respuesta (array/objeto)
};

export const createRole = async (roleName) => {
  const { data } = await api.post('roles/create', { role_name: roleName });
  return data;
};

export const updateRole = async (id, roleName) => {
  const { data } = await api.put('roles/update', { id, role_name: roleName });
  return data;
};

export const deleteRole = async (id) => {
  const { data } = await api.delete('roles/delete', { data: { id } });
  return data;
};

export const generateFlutterProject = async (payload) => {
  try {
    const response = await api.post(
      'generate/generate-flutter-project',
      payload,
      {
        responseType: 'blob'
      }
    );
    return response.data;

  } catch (error) {
    throw new Error(error.response?.data?.msg || 'Error al generar el proyecto Flutter.');
  }
};
