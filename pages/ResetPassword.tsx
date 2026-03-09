import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNotification } from '../hooks/useNotification';
import { validatePassword } from '../utils/passwordValidation';

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const notify = useNotification();

  const passwordErrors = newPassword ? validatePassword(newPassword) : [];
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const isValid = passwordErrors.length === 0 && passwordsMatch && newPassword.length > 0;

  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Read tokens stored by index.tsx interceptor (one-time use)
        const raw = sessionStorage.getItem('pspt-recovery-tokens');
        sessionStorage.removeItem('pspt-recovery-tokens');

        if (!raw) {
          setInvalidLink(true);
          return;
        }

        const tokens = JSON.parse(raw);
        if (!tokens.access_token) {
          setInvalidLink(true);
          return;
        }

        // Establish the recovery session with Supabase
        const { error } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });

        if (error) {
          console.error('[ResetPassword] Error setting session:', error.message);
          setInvalidLink(true);
          return;
        }

        setSessionReady(true);
      } catch (err) {
        console.error('[ResetPassword] Failed to restore session:', err);
        setInvalidLink(true);
      }
    };

    restoreSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      notify.warning('Preencha todos os campos corretamente.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false }
      });

      if (error) throw error;

      // Sign out and force re-login with the new password
      await supabase.auth.signOut();
      setSuccess(true);
    } catch (err: any) {
      notify.error(err.message || 'Erro ao redefinir a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Invalid or expired link
  if (invalidLink) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-4 bg-background-light dark:bg-background-dark">
        <div className="bg-white dark:bg-[#151f2e] w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-red-500 dark:text-red-400 text-4xl">link_off</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 font-display">
            Link Inválido ou Expirado
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
            O link de recuperação de senha não é válido ou já expirou. Solicite um novo link para redefinir sua senha.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/forgot-password"
              className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">mail</span>
              Solicitar Novo Link
            </Link>
            <Link
              to="/login"
              className="text-xs font-bold text-slate-500 hover:text-primary transition-colors"
            >
              ← Voltar para o Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-4 bg-background-light dark:bg-background-dark">
        <div className="bg-white dark:bg-[#151f2e] w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
          <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-4xl">check_circle</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 font-display">
            Senha Redefinida!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
            Sua senha foi alterada com sucesso. Faça login com a nova senha para acessar o sistema.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">login</span>
            Ir para o Login
          </Link>
        </div>
      </div>
    );
  }

  // Loading session
  if (!sessionReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">Verificando link...</p>
        </div>
      </div>
    );
  }

  // Password reset form
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
              Crie sua nova senha.
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white mt-0.5">lock_reset</span>
                <p className="text-blue-50 text-base">
                  Escolha uma senha forte que você não utiliza em outros serviços.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-12 lg:p-16 bg-white dark:bg-[#151f2e]">
          <div className="w-full max-w-sm mx-auto">
            <div className="mb-8">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-5">
                <span className="material-symbols-outlined text-primary text-2xl">lock_reset</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-display">
                Redefinir Senha
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Defina sua nova senha de acesso ao sistema.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="group">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 transition-colors group-focus-within:text-primary">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-12 px-4 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>

                {/* Password requirements */}
                {newPassword && (
                  <div className="mt-3 space-y-1.5">
                    {[
                      { label: 'Mínimo 8 caracteres', test: newPassword.length >= 8 },
                      { label: '1 letra maiúscula', test: /[A-Z]/.test(newPassword) },
                      { label: '1 número', test: /[0-9]/.test(newPassword) },
                      { label: '1 caractere especial', test: /[^A-Za-z0-9]/.test(newPassword) },
                    ].map((req) => (
                      <div key={req.label} className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[14px] ${req.test ? 'text-green-500' : 'text-slate-300 dark:text-slate-600'}`}>
                          {req.test ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span className={`text-xs font-medium ${req.test ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 transition-colors group-focus-within:text-primary">
                  Confirmar Nova Senha
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full h-12 px-4 rounded-xl border ${
                    confirmPassword && !passwordsMatch
                      ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-primary'
                  } bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:border-transparent transition-all outline-none`}
                  placeholder="••••••••"
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">As senhas não coincidem</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !isValid}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">check</span>
                    Redefinir Senha
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs font-bold text-slate-500 hover:text-primary transition-colors">
                  ← Voltar para o Login
                </Link>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ResetPassword;
