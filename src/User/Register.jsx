import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService'; // ajusta el path si es necesario
import toast from 'react-hot-toast';
const Register = () => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    gender: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { firstName, lastName, email, gender, password } = form;

    try {
      await registerUser(firstName, lastName, email, gender, password);
      //alert('Usuario registrado exitosamente');
      toast.success('Registro Exitoso');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (error) {
      console.error('Error de registro:', error);
      alert('Error en el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-lg text-white">
        <h2 className="text-center text-2xl font-bold mb-6">Crear cuenta</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Nombre</label>
              <input
                type="text"
                name="firstName"
                className="w-full mt-1 px-4 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/60 focus:outline-none focus:ring focus:ring-cyan-400"
                placeholder="Nombre"
                value={form.firstName}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="text-sm">Apellido</label>
              <input
                type="text"
                name="lastName"
                className="w-full mt-1 px-4 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/60 focus:outline-none focus:ring focus:ring-cyan-400"
                placeholder="Apellido"
                value={form.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm">Correo electrónico</label>
            <input
              type="email"
              name="email"
              className="w-full mt-1 px-4 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/60 focus:outline-none focus:ring focus:ring-cyan-400"
              placeholder="correo@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="text-sm">Género</label>
            <input
              type="text"
              name="gender"
              className="w-full mt-1 px-4 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/60 focus:outline-none focus:ring focus:ring-cyan-400"
              placeholder="Ej: Masculino, Femenino..."
              value={form.gender}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="text-sm">Contraseña</label>
            <input
              type="password"
              name="password"
              className="w-full mt-1 px-4 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/60 focus:outline-none focus:ring focus:ring-cyan-400"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white py-2 rounded mt-2 font-semibold transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-white/70">
          ¿Ya tienes cuenta?
          <button
            className="text-cyan-400 hover:underline ml-2"
            onClick={() => navigate('/login')}
          >
            Inicia sesión aquí
          </button>
        </p>
      </div>
    </div>
  );
};

export default Register;
