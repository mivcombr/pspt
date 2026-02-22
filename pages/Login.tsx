import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      console.log('Login successful, navigating...');
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center p-4 bg-background-light dark:bg-background-dark">
      <div className="bg-white dark:bg-[#151f2e] w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row h-full max-h-[700px]">

        {/* Left Side - Promotional */}
        <div className="hidden md:flex flex-1 bg-primary relative overflow-hidden p-12 flex-col justify-between">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-400/20 blur-3xl"></div>

          <div className="relative z-10">
            <div className="mb-10">
              <div className="bg-white p-4 rounded-xl inline-block shadow-lg">
                <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain" />
              </div>
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-6">
              Gestão que entende de gente.
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white mt-0.5">favorite</span>
                <p className="text-blue-50 text-base">Unimos tecnologia e cuidado humano para transformar a saúde em algo mais próximo, eficiente e acessível.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-12 lg:p-16 bg-white dark:bg-[#151f2e]">
          <div className="w-full max-w-sm mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Bem-vindo de volta
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Entre com suas credenciais para acessar o portal.
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-100 italic">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;