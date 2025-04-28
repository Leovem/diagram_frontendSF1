import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService'; // Asegúrate de que el path sea correcto
import toast from 'react-hot-toast';
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      localStorage.setItem('token', data.token);
    //   alert('Login exitoso');
    toast.success('Login exitoso ');
    setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      alert('Credenciales incorrectas o error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-sm text-white">
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl">
            🧑‍💻
          </div>
        </div>

        <h2 className="text-center text-2xl font-bold mb-6">Iniciar Sesión</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm">Correo electrónico</label>
            <input
              type="email"
              className="w-full mt-1 px-4 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/70 focus:outline-none focus:ring focus:ring-cyan-400"
              placeholder="correo@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm">Contraseña</label>
            <input
              type="password"
              className="w-full mt-1 px-4 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/70 focus:outline-none focus:ring focus:ring-cyan-400"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between text-sm text-white/80">
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              {/* Recuérdame */}
            </label>
            <a href="#" className="hover:underline text-white/70">
              {/* ¿Olvidaste tu contraseña? */}
            </a>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white py-2 rounded mt-4 font-semibold transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Iniciar Sesion'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-white/70">
          ¿No tienes cuenta?
          <button
            className="text-cyan-400 hover:underline ml-2"
            onClick={() => navigate('/register')}
          >
            Regístrate aquí
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;