import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../hooks/useNotification';
import { validatePassword } from '../utils/passwordValidation';

const ChangePassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { clearMustChangePassword, user } = useAuth();
  const notify = useNotification();

  const passwordErrors = newPassword ? validatePassword(newPassword) : [];
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const isValid = passwordErrors.length === 0 && passwordsMatch && newPassword.length > 0;

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

      clearMustChangePassword();
      notify.success('Senha alterada com sucesso!');
      navigate('/');
    } catch (err: any) {
      notify.error(err.message || 'Erro ao alterar a senha. Tente novamente.');
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
              Defina sua nova senha.
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-white mt-0.5">shield</span>
                <p className="text-blue-50 text-base">
                  Por segurança, você precisa criar uma senha pessoal antes de acessar o sistema.
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
                Alterar Senha
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {user?.name ? `Olá, ${user.name}! ` : ''}Crie uma senha pessoal para substituir a senha provisória.
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
                    Salvar Nova Senha
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ChangePassword;
