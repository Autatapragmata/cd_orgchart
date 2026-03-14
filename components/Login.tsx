import React, { useState } from 'react';
import { auth } from '../firebase';
import { SpinnerIcon } from './icons/SpinnerIcon';
// Fix: Removed unused imports from 'firebase/auth' and switched to v8 compat API calls below.

function getFirebaseErrorMessage(code: string): string {
    switch (code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential':
            return 'Incorrect email or password. Please try again.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use':
            return 'An account already exists with this email address.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters long.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        default:
            return 'An unexpected error occurred. Please try again.';
    }
}

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'signin' | 'reset'>('signin');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (mode === 'signin') {
                // Fix: Switched from modular signInWithEmailAndPassword(auth,...) to compat auth.signInWithEmailAndPassword(...)
                await auth.signInWithEmailAndPassword(email, password);
            } else if (mode === 'reset') {
                // Fix: Switched from modular sendPasswordResetEmail(auth,...) to compat auth.sendPasswordResetEmail(...)
                await auth.sendPasswordResetEmail(email);
                setMessage('Password reset email sent! Please check your inbox.');
            }
        } catch (err: any) {
            setError(getFirebaseErrorMessage(err.code));
        } finally {
            setIsLoading(false);
        }
    };

    const getTitle = () => {
        switch (mode) {
            case 'signin': return 'Sign In';
            case 'reset': return 'Reset Password';
        }
    };

    const getButtonText = () => {
        switch (mode) {
            case 'signin': return 'Sign In';
            case 'reset': return 'Send Reset Link';
        }
    };

    return (
        <div className="w-screen h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 font-sans p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">MTA C&amp;D Planning</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Interactive C&amp;D Planning org chart.</p>
                </div>
                <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg p-6">
                    <h2 className="text-2xl font-semibold text-center text-slate-700 dark:text-slate-200 mb-6">{getTitle()}</h2>
                    
                    {error && <p className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-sm font-medium p-3 rounded-md mb-4">{error}</p>}
                    {message && <p className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 text-sm font-medium p-3 rounded-md mb-4">{message}</p>}

                    <form onSubmit={handleAction} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="you@example.com"
                            />
                        </div>

                        {mode !== 'reset' && (
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="••••••••"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 dark:disabled:bg-indigo-800 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isLoading ? <SpinnerIcon /> : getButtonText()}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        {mode === 'signin' ? (
                             <p className="text-slate-500 dark:text-slate-400">
                                <button onClick={() => { setMode('reset'); setError(null); }} className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">Forgot Password?</button>
                            </p>
                        ) : ( // mode === 'reset'
                             <p className="text-slate-500 dark:text-slate-400">
                                Remember your password?{' '}
                                <button onClick={() => { setMode('signin'); setError(null); setMessage(null);}} className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">Sign In</button>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;