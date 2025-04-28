export default function LoginGlass() {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-slate-900 flex items-center justify-center">
        {/* Fondo detrás de todo */}
        <div className="fixed inset-0 z-0 bg-gradient-to-br from-gray-900 via-slate-800 to-slate-900" />
  
        {/* Contenedor de login */}
        <div className="relative z-10 p-4 sm:p-0 w-full flex items-center justify-center">
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-sm text-white">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl">
                🧑‍💻
              </div>
            </div>
  
            <h2 className="text-center text-2xl font-bold mb-6">Iniciar Sesión</h2>
  
            <form className="space-y-4">
              <div>
                <label className="text-sm">Email</label>
                <input
                  type="email"
                  className="w-full mt-1 px-4 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/70 focus:outline-none"
                  placeholder="correo@example.com"
                />
              </div>
  
              <div>
                <label className="text-sm">Contraseña</label>
                <input
                  type="password"
                  className="w-full mt-1 px-4 py-2 bg-white/20 border border-white/30 rounded text-white placeholder-white/70 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
  
              <div className="flex items-center justify-between text-sm text-white/80">
                <label className="flex items-center gap-2">
                  <input type="checkbox" />
                  Recuérdame
                </label>
                <a href="#" className="hover:underline text-white/70">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
  
              <button className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white py-2 rounded mt-4 font-semibold transition">
                LOGIN
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }