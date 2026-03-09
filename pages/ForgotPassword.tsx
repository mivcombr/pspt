import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // redirectTo points to the app base URL (without hash).
      // Supabase will append #access_token=...&type=recovery to this URL.
      // Our index.tsx interceptor will catch the tokens before HashRouter processes them.
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (resetError) throw resetError;

      // Always show success to prevent email enumeration
      setSent(true);
    } catch (err: any) {
      // Still show success to prevent email enumeration,
      // unless it's a rate limit or server error
      if (err.message?.includes('rate') || err.status === 429) {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center p-4 bg-background-light dark:bg-background-dark">
      <div className="bg-white dark:bg-[#151f2e] w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row h-full max-h-[700px]">

        {/* Left Side - Branding */}
        <div className="hidden md:flex flex-1 bg-primary login-pattern relative overflow-hidden p-12 flex-col justify-between">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-400/20 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-red-300/10 blur-3xl"></div>

          <div className="relative z-10">
            <div className="mb-10">
              <div className="bg-white p-4 rounded-xl inline-block shadow-lg">
                <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain" />
              </div>
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-6 font-display">
              Recupere seu acesso.
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white mt-0.5">mail</span>
                <p className="text-blue-50 text-base">
                  Enviaremos um link de recuperação para o e-mail cadastrado no sistema.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-12 lg:p-16 bg-white dark:bg-[#151f2e]">
          <div className="w-full max-w-sm mx-auto">

            {!sent ? (
              <>
                <div className="mb-8">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-5">
                    <span className="material-symbols-outlined text-primary text-2xl">lock_open</span>
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-display">
                    Recuperar Senha
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Digite o e-mail associado à sua conta. Enviaremos um link para redefinir sua senha.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium border border-red-100 dark:border-red-800/30 italic">
                      {error}
                    </div>
                  )}

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 transition-colors group-focus-within:text-primary">
                      E-mail
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                      placeholder="seu@email.com"
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
                      <>
                        <span className="material-symbols-outlined text-[20px]">send</span>
                        Enviar Link de Recuperação
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <Link to="/login" className="text-xs font-bold text-slate-500 hover:text-primary transition-colors">
                      ← Voltar para o Login
                    </Link>
                  </div>
                </form>
              </>
            ) : (
              /* Success State */
              <div className="text-center">
                <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-4xl">mark_email_read</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 font-display">
                  E-mail Enviado!
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                  Se o e-mail <strong className="text-slate-700 dark:text-slate-300">{email}</strong> estiver cadastrado no sistema, você receberá um link para redefinir sua senha. Verifique também a pasta de spam.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  Voltar para o Login
                </Link>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

export default ForgotPassword;
