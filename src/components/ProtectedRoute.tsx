import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AccountStatusGuard from '@/components/AccountStatusGuard';
import { getSessionWithTimeout } from '@/lib/authSession';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let active = true;

    getSessionWithTimeout()
      .then(({ data: { session } }) => {
        if (!active) return;
        setStatus(session ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (active) setStatus((prev) => (prev === 'authenticated' ? 'authenticated' : 'unauthenticated'));
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setStatus('unauthenticated');
      } else if (session) {
        setStatus((prev) => (prev === 'authenticated' ? prev : 'authenticated'));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" style={{ willChange: 'transform' }} />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <AccountStatusGuard>{children}</AccountStatusGuard>;
};

export default ProtectedRoute;
