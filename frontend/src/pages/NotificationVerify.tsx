import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';

type VerifyState = 'idle' | 'loading' | 'success' | 'error';

const NotificationVerify = () => {
  const [searchParams] = useSearchParams();
  const subscriptionKey = searchParams.get('subscriptionKey');
  const token = searchParams.get('token');
  const [state, setState] = useState<VerifyState>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!subscriptionKey || !token) {
      return;
    }

    const runVerification = async () => {
      setState('loading');
      try {
        const normalizedApiBase = API_BASE_URL.endsWith('/')
          ? API_BASE_URL
          : `${API_BASE_URL}/`;
        const endpoint = new URL('notifications/verify', normalizedApiBase);
        endpoint.searchParams.set('subscriptionKey', subscriptionKey);
        endpoint.searchParams.set('token', token);

        const response = await fetch(endpoint.toString());
        const payload = await response.json();

        if (!response.ok) {
          setState('error');
          setMessage(payload.error ?? 'Failed to verify subscription.');
          return;
        }

        setState('success');
        setMessage(payload.message ?? 'Subscription verified successfully.');
      } catch {
        setState('error');
        setMessage('Unable to reach verification service. Please try again later.');
      }
    };

    runVerification();
  }, [subscriptionKey, token]);

  if (!subscriptionKey || !token) {
    return (
      <div className="should-i-go">
        <div className="card" style={{ maxWidth: 720, margin: '24px auto', textAlign: 'center' }}>
          <h2 style={{ marginBottom: 8 }}>Notification Verification</h2>
          <p style={{ color: '#C80000', fontWeight: 600 }}>Verification link is incomplete.</p>
        </div>
      </div>
    );
  }

  const color = state === 'error' ? '#C80000' : '#008E9B';

  return (
    <div className="should-i-go">
      <div className="card" style={{ maxWidth: 720, margin: '24px auto', textAlign: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>Notification Verification</h2>
        {state === 'loading' && <p style={{ color: '#666' }}>Verifying your subscription...</p>}
        {state !== 'loading' && <p style={{ color, fontWeight: 600 }}>{message}</p>}
      </div>
    </div>
  );
};

export default NotificationVerify;
