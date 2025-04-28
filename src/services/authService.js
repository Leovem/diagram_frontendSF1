import axios from 'axios';

const API_URL = 'http://localhost:5000/api/';

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