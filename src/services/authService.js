import axios from 'axios';

const API_URL = 'https://backenddesing-production.up.railway.app/api/';

// Login
export const loginUser = async (email, password) => {
  try {
    const response = await axios.post(`${API_URL}users/login`, { email, password });
    return response.data;
  } catch (error) {
    throw new Error('Error de login');
  }
};

// Registro
export const registerUser = async (firstName, lastName, email, gender, password) => {
  try {
    const response = await axios.post(`${API_URL}users/register`, {
      firstName,
      lastName,
      email,
      gender,
      password,
    });
    return response.data;
  } catch (error) {
    throw new Error('Error en el registro');
  }
};
//--------------apiUser--------------------
export const assignRole = async (userId, roleId) => {
  try {
    const response = await axios.put(`${API_URL}users/assign-role`, {
      userId,
      roleId
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getUsers = async () => {
  const res = await axios.get(`${API_URL}users/list`);
  return res.data.users;
};

export const registerUser1 = async (userData) => {
  const res = await axios.post(`${API_URL}users/register`, userData);
  return res.data;
};

export const updateUser = async (userId, updatedData) => {
  const res = await axios.put(`${API_URL}users/update`, {
    userId,
    ...updatedData,
  });
  return res.data;
};

export const deleteUser = async (userId) => {
  const res = await axios.delete(`${API_URL}users/delete`, {
    data: { userId },
  });
  return res.data;
};

//-----------------apiroles-------------------
export const getRoles = async () => {
  const response = await axios.get(`${API_URL}roles/get`);
  return response.data;
};

export const createRole = async (roleName) => {
  const response = await axios.post(`${API_URL}roles/create`, { role_name: roleName });
  return response.data;
};

export const updateRole = async (id, roleName) => {
  const response = await axios.put(`${API_URL}roles/update`, {
    id,
    role_name: roleName,
  });
  return response.data;
};

export const deleteRole = async (id) => {
  const response = await axios.delete(`${API_URL}roles/delete`, {
    data: { id },
  });
  return response.data;
};