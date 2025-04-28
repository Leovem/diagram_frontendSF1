import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-8 w-full max-w-md text-white text-center">
        <div className="flex justify-center mb-4 text-4xl">👋</div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-cyan-300">
          Bienvenido a nuestra Aplicación
        </h2>

        <p className="text-sm sm:text-base text-white/80 mb-6">
          Explora nuestras funcionalidades, accede a tu cuenta o regístrate para comenzar a disfrutar de nuestra plataforma.
        </p>

        <div className="flex flex-col gap-4">
          <Link to="/login">
            <button className="w-full bg-cyan-500 hover:bg-cyan-600 transition text-white font-semibold py-2 rounded">
              Iniciar sesión
            </button>
          </Link>
          <Link to="/register">
            <button className="w-full border border-white/30 hover:bg-white/10 transition text-white font-semibold py-2 rounded">
              Registrarse
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;