import React, { useState } from 'react';

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (name: string, email: string, password: string) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<{ ok: boolean; resetToken?: string }>;
  onResetPassword: (token: string, newPassword: string) => Promise<void>;
  onVerifyEmail: (token: string) => Promise<void>;
  onResendVerification: (email: string) => Promise<{ ok: boolean; verificationToken?: string }>;
  isLoading: boolean;
  error: string | null;
  pendingApproval: boolean;
  pendingEmail: string | null;
  onBackToLogin: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({
  onLogin,
  onSignup,
  onRequestPasswordReset,
  onResetPassword,
  onVerifyEmail,
  onResendVerification,
  isLoading,
  error,
  pendingApproval,
  pendingEmail,
  onBackToLogin,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset' | 'verify'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [devToken, setDevToken] = useState<string | null>(null);

  if (pendingApproval) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gem-onyx text-gem-offwhite p-6">
        <div className="w-full max-w-md bg-gem-slate rounded-2xl p-8 shadow-lg border border-gem-mist/50">
          <h1 className="text-3xl font-bold mb-2">Awaiting approval</h1>
          <p className="text-gem-offwhite/70 mb-6">
            Your registration{pendingEmail ? ` (${pendingEmail})` : ''} is pending review. Please wait for approval before logging in.
          </p>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setLocalError(null);
              onBackToLogin();
            }}
            className="w-full bg-gem-blue hover:bg-blue-500 text-white font-semibold rounded-lg py-2.5 transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setInfoMessage(null);
    setDevToken(null);

    if (mode === 'signup') {
      if (password !== confirm) {
        setLocalError('Passwords do not match.');
        return;
      }
      await onSignup(name.trim(), email.trim(), password);
      return;
    }

    if (mode === 'login') {
      await onLogin(email.trim(), password);
      return;
    }

    if (mode === 'forgot') {
      if (!email.trim()) {
        setLocalError('Email is required.');
        return;
      }
      setIsActionLoading(true);
      try {
        const result = await onRequestPasswordReset(email.trim());
        if (result.resetToken) {
          setDevToken(result.resetToken);
          setResetToken(result.resetToken);
          setMode('reset');
          setInfoMessage('Reset token generated (dev).');
        } else {
          setInfoMessage('If the email exists, a reset link will be sent.');
        }
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to request reset.');
      } finally {
        setIsActionLoading(false);
      }
      return;
    }

    if (mode === 'reset') {
      if (!resetToken.trim()) {
        setLocalError('Reset token is required.');
        return;
      }
      if (!password) {
        setLocalError('New password is required.');
        return;
      }
      if (password.length < 8) {
        setLocalError('New password must be at least 8 characters.');
        return;
      }
      if (password !== confirm) {
        setLocalError('Passwords do not match.');
        return;
      }
      setIsActionLoading(true);
      try {
        await onResetPassword(resetToken.trim(), password);
        setInfoMessage('Password reset successfully. Please log in.');
        setMode('login');
        setPassword('');
        setConfirm('');
        setResetToken('');
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to reset password.');
      } finally {
        setIsActionLoading(false);
      }
      return;
    }

    if (mode === 'verify') {
      if (!verifyToken.trim()) {
        setLocalError('Verification token is required.');
        return;
      }
      setIsActionLoading(true);
      try {
        await onVerifyEmail(verifyToken.trim());
        setInfoMessage('Email verified. You can log in now.');
        setMode('login');
        setVerifyToken('');
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Failed to verify email.');
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  const normalizedError = (localError || error || '').toLowerCase();
  const canVerify = normalizedError.includes('email not verified');
  const showForgot = mode === 'login';
  const showPasswordFields = mode === 'login' || mode === 'signup' || mode === 'reset';
  const showConfirm = mode === 'signup' || mode === 'reset';
  const showName = mode === 'signup';
  const showResetToken = mode === 'reset';
  const showVerifyToken = mode === 'verify';

  return (
    <div className="flex items-center justify-center min-h-screen bg-gem-onyx text-gem-offwhite p-6">
      <div className="w-full max-w-md bg-gem-slate rounded-2xl p-8 shadow-lg border border-gem-mist/50">
        <h1 className="text-3xl font-bold mb-2">
          {mode === 'login' && 'Welcome back'}
          {mode === 'signup' && 'Create an account'}
          {mode === 'forgot' && 'Reset your password'}
          {mode === 'reset' && 'Set a new password'}
          {mode === 'verify' && 'Verify your email'}
        </h1>
        <p className="text-gem-offwhite/70 mb-6">
          {mode === 'login' && 'Sign in to access your documents.'}
          {mode === 'signup' && 'Sign up to start chatting with your documents.'}
          {mode === 'forgot' && 'Enter your email to receive a reset token.'}
          {mode === 'reset' && 'Paste your reset token and choose a new password.'}
          {mode === 'verify' && 'Paste the verification token from your email.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {showName && (
            <div>
              <label className="block text-sm text-gem-offwhite/70 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-gem-blue text-gem-offwhite"
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-gem-offwhite/70 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={mode !== 'reset'}
              className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-gem-blue text-gem-offwhite"
              placeholder="you@example.com"
            />
          </div>
          {showResetToken && (
            <div>
              <label className="block text-sm text-gem-offwhite/70 mb-1">Reset token</label>
              <input
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-gem-blue text-gem-offwhite"
                placeholder="Paste reset token"
              />
            </div>
          )}
          {showVerifyToken && (
            <div>
              <label className="block text-sm text-gem-offwhite/70 mb-1">Verification token</label>
              <input
                type="text"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-gem-blue text-gem-offwhite"
                placeholder="Paste verification token"
              />
            </div>
          )}
          {showPasswordFields && (
            <div>
              <label className="block text-sm text-gem-offwhite/70 mb-1">
                {mode === 'reset' ? 'New password' : 'Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-gem-blue text-gem-offwhite"
                placeholder="••••••••"
              />
            </div>
          )}
          {showConfirm && (
            <div>
              <label className="block text-sm text-gem-offwhite/70 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-gem-blue text-gem-offwhite"
                placeholder="••••••••"
              />
            </div>
          )}

          {(localError || error) && (
            <p className="text-red-400 text-sm">{localError || error}</p>
          )}
          {infoMessage && <p className="text-green-400 text-sm">{infoMessage}</p>}
          {devToken && (
            <p className="text-xs text-gem-offwhite/70">
              Dev token: <span className="font-mono">{devToken}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || isActionLoading}
            className="w-full bg-gem-blue hover:bg-blue-500 text-white font-semibold rounded-lg py-2.5 transition-colors disabled:bg-gem-mist/50 disabled:cursor-not-allowed"
          >
            {(isLoading || isActionLoading) && 'Please wait...'}
            {!isLoading && !isActionLoading && mode === 'login' && 'Login'}
            {!isLoading && !isActionLoading && mode === 'signup' && 'Sign up'}
            {!isLoading && !isActionLoading && mode === 'forgot' && 'Send reset token'}
            {!isLoading && !isActionLoading && mode === 'reset' && 'Reset password'}
            {!isLoading && !isActionLoading && mode === 'verify' && 'Verify email'}
          </button>
        </form>

        {showForgot && (
          <div className="mt-4 flex items-center justify-between text-sm text-gem-offwhite/60">
            <button
              type="button"
              className="text-gem-blue hover:text-blue-400 font-semibold"
              onClick={() => {
                setMode('forgot');
                setLocalError(null);
                setInfoMessage(null);
              }}
            >
              Forgot password?
            </button>
            {canVerify && (
              <button
                type="button"
                className="text-gem-blue hover:text-blue-400 font-semibold"
                onClick={() => {
                  setMode('verify');
                  setLocalError(null);
                  setInfoMessage(null);
                }}
              >
                Verify email
              </button>
            )}
          </div>
        )}

        {mode === 'verify' && (
          <div className="mt-4 flex items-center justify-between text-sm text-gem-offwhite/60">
            <button
              type="button"
              className="text-gem-blue hover:text-blue-400 font-semibold"
              onClick={async () => {
                setLocalError(null);
                setInfoMessage(null);
                if (!email.trim()) {
                  setLocalError('Email is required.');
                  return;
                }
                setIsActionLoading(true);
                try {
                  const result = await onResendVerification(email.trim());
                  if (result.verificationToken) {
                    setDevToken(result.verificationToken);
                    setVerifyToken(result.verificationToken);
                  }
                  setInfoMessage('Verification token sent.');
                } catch (err) {
                  setLocalError(err instanceof Error ? err.message : 'Failed to resend verification.');
                } finally {
                  setIsActionLoading(false);
                }
              }}
            >
              Resend token
            </button>
            <button
              type="button"
              className="text-gem-blue hover:text-blue-400 font-semibold"
              onClick={() => {
                setMode('login');
                setLocalError(null);
                setInfoMessage(null);
              }}
            >
              Back to login
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="mt-4 text-center text-sm text-gem-offwhite/60">
            <button
              type="button"
              className="text-gem-blue hover:text-blue-400 font-semibold"
              onClick={() => {
                setMode('login');
                setLocalError(null);
                setInfoMessage(null);
              }}
            >
              Back to login
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <div className="mt-4 text-center text-sm text-gem-offwhite/60">
            <button
              type="button"
              className="text-gem-blue hover:text-blue-400 font-semibold"
              onClick={() => {
                setMode('login');
                setLocalError(null);
                setInfoMessage(null);
              }}
            >
              Back to login
            </button>
          </div>
        )}

        {(mode === 'login' || mode === 'signup') && (
          <div className="mt-6 text-center text-sm text-gem-offwhite/60">
            {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            <button
              className="text-gem-blue hover:text-blue-400 font-semibold"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setLocalError(null);
                setInfoMessage(null);
              }}
              type="button"
            >
              {mode === 'login' ? 'Create account' : 'Login'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;
