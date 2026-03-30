import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

interface TrafficImage {
  highway: string;
  description: string;
  image: string;
}

const highways = [
  { label: 'AYE', id: 'aye' },
  { label: 'BKE', id: 'bke' },
  { label: 'CTE', id: 'cte' },
  { label: 'ECP', id: 'ecp' },
  { label: 'KJE', id: 'kje' },
  { label: 'PIE', id: 'pie' },
  { label: 'SLE', id: 'sle' },
  { label: 'TPE', id: 'tpe' },
];

const Traffic = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [trafficImages, setTrafficImages] = useState<TrafficImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchImages = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `${API_BASE_URL}/traffic-images?highway=${highways[activeTab].label}`,
        );
        if (!response.ok) {
          throw new Error('Failed to fetch traffic images');
        }
        const data = await response.json();
        if (!isCancelled) {
          const imagesArray =
            data.trafficImages?.data || data.trafficImages || [];
          setTrafficImages(Array.isArray(imagesArray) ? imagesArray : []);
          setLastUpdated(new Date());
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          if (err instanceof Error) {
            setError(err.message);
          } else {
            setError('An error occurred');
          }
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchImages();

    // Poll every minute (60000ms)
    // const intervalId = setInterval(() => {
    //   fetchImages();
    // }, 60000);

    return () => {
      isCancelled = true;
      // clearInterval(intervalId);
    };
  }, [activeTab]);

  return (
    <div className='traffic-page'>
      <h1 className='traffic-title'>Live Traffic Feeds</h1>

      {/* Highway tabs */}
      <div className='tab-bar'>
        {highways.map((hw, i) => (
          <button
            key={hw.id}
            className={`tab-btn ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {hw.label}
          </button>
        ))}
      </div>

      {/* Camera feed */}
      <div
        className='feed-panel'
        style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
      >
        {loading ? (
          <div className='feed-placeholder'>Loading traffic images...</div>
        ) : error ? (
          <div
            className='feed-placeholder'
            style={{ color: '#ff5252', borderColor: '#ff5252' }}
          >
            {error}
          </div>
        ) : trafficImages.length === 0 ? (
          <div className='feed-placeholder'>
            No camera feeds available for this highway.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
              gap: '24px',
              padding: '24px',
              width: '100%',
              overflowY: 'auto',
            }}
          >
            {trafficImages.map((img, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: '#fff',
                  padding: '16px',
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    fontWeight: '700',
                    fontSize: '1.05rem',
                    color: '#1a1a2e',
                    textAlign: 'center',
                  }}
                >
                  {img.description || 'Unknown Location'}
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: '#777',
                    textAlign: 'center',
                    marginBottom: '4px',
                  }}
                >
                  Last updated:{' '}
                  {lastUpdated
                    ? lastUpdated.toLocaleString('en-US', {
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true,
                        day: 'numeric',
                        month: 'short',
                      })
                    : 'Unknown'}
                </div>
                <img
                  src={img.image}
                  alt={img.description}
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    aspectRatio: '16/9',
                    border: '1px solid rgba(0,0,0,0.05)',
                  }}
                  loading='lazy'
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Traffic;
