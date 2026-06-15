import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { API_BASE_URL } from '../services/authService';
import { formatIsoDateToDmy } from '../utils/date';
import { TabLoadingSpinner } from '../components/TabLoadingSpinner';

type Preview = {
  amenityName: string;
  date: string;
  startTime: string;
  slotLength: number;
  userName: string;
};

type PageContent = {
  instructions: string;
  successText: string;
  mismatchText: string;
};

type Stage = 'loading' | 'ready' | 'scanning' | 'success' | 'mismatch' | 'error';

const SCANNER_ID = 'qr-checkin-scanner';
const noop = () => {};

export const CheckinPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('loading');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [content, setContent] = useState<PageContent>({
    instructions: 'Point your camera at the QR code posted at the amenity to confirm your attendance.',
    successText: 'You have successfully checked in. Enjoy your booking!',
    mismatchText: 'The QR code does not match your booked amenity. Please make sure you are at the correct location and try again.',
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStarted = useRef(false);

  useEffect(() => {
    if (!token) { setStage('error'); setErrorMsg('Invalid link.'); return; }

    Promise.all([
      fetch(`${API_BASE_URL}/bookings/checkin-preview/${token}`).then(async (r) => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.message || 'Invalid or expired link.'); }
        return r.json() as Promise<Preview>;
      }),
      fetch(`${API_BASE_URL}/email-templates/checkin-page-content`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([previewData, pageContent]) => {
        setPreview(previewData);
        if (pageContent) setContent(pageContent);
        setStage('ready');
      })
      .catch((e) => { setErrorMsg(e.message); setStage('error'); });
  }, [token]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerStarted.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanning = async () => {
    setStage('scanning');
    // Small delay so the scanner div is in the DOM
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = scanner;
        scannerStarted.current = true;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => {
            scanner.stop().catch(noop);
            scannerStarted.current = false;
            handleScanned(text.trim());
          },
          undefined,
        );
      } catch (e: any) {
        setErrorMsg(e?.message || 'Could not access camera. Please allow camera access and try again.');
        setStage('error');
      }
    }, 100);
  };

  const stopScanning = () => {
    if (scannerRef.current && scannerStarted.current) {
      scannerRef.current.stop().catch(() => {});
      scannerStarted.current = false;
    }
    setStage('ready');
  };

  const handleScanned = async (qrToken: string) => {
    if (!token || isChecking) return;
    setIsChecking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/checkin-by-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, qrToken }),
      });
      if (res.ok) {
        setStage('success');
      } else {
        const d = await res.json().catch(() => ({}));
        if (d.message?.toLowerCase().includes('match')) {
          setStage('mismatch');
        } else {
          setErrorMsg(d.message || 'Check-in failed.');
          setStage('error');
        }
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStage('error');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-bold text-gray-900 mb-6">Check In</h1>

        <Card>
          {stage === 'loading' && (
            <TabLoadingSpinner message="Loading booking details…" />
          )}

          {(stage === 'ready' || stage === 'scanning') && preview && (
            <div>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4 space-y-1.5 text-sm text-gray-700">
                <div><span className="font-medium">Amenity:</span> {preview.amenityName}</div>
                <div><span className="font-medium">Date:</span> {formatIsoDateToDmy(preview.date)}</div>
                <div><span className="font-medium">Time:</span> {preview.startTime} ({preview.slotLength} min)</div>
              </div>

              {stage === 'ready' && (
                <>
                  <p className="text-sm text-gray-600 mb-5">{content.instructions}</p>
                  <Button onClick={startScanning} className="w-full">
                    Scan QR Code
                  </Button>
                </>
              )}

              {stage === 'scanning' && (
                <>
                  <p className="text-sm text-gray-500 mb-3 text-center">Hold the camera over the QR code at the amenity.</p>
                  {/* Scanner container — html5-qrcode mounts into this div */}
                  <div id={SCANNER_ID} className="w-full rounded-lg overflow-hidden" />
                  <Button variant="secondary" onClick={stopScanning} className="w-full mt-4">
                    Cancel
                  </Button>
                </>
              )}
            </div>
          )}

          {stage === 'success' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Checked in!</h2>
              <p className="text-sm text-gray-600 mb-6">{content.successText}</p>
              <Button onClick={() => navigate('/login')} className="w-full">Back to login</Button>
            </div>
          )}

          {stage === 'mismatch' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Wrong QR code</h2>
              <p className="text-sm text-gray-600 mb-6">{content.mismatchText}</p>
              <Button onClick={() => setStage('ready')} className="w-full">Try again</Button>
            </div>
          )}

          {stage === 'error' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Link unavailable</h2>
              <p className="text-sm text-gray-600 mb-6">{errorMsg}</p>
              <Button onClick={() => navigate('/login')} className="w-full">Back to login</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
