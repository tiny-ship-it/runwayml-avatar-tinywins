'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { AvatarCall } from '@runwayml/avatars-react';
import '@runwayml/avatars-react/styles.css';

const MY_AVATAR = {
  id: '52bfe1f6-aa76-48b2-8b0f-b3eb279b41b9',
  name: 'Tiny',
  imageUrl:
    'https://runway-static-assets.s3.us-east-1.amazonaws.com/calliope-demo/presets-3-3/InApp_Avatar_2.png',
};

interface SessionInfo {
  sessionId: string;
  sessionKey: string;
}

interface Props {
  /** Derived server-side from the authenticated user's email. */
  tenantId: string;
}

export default function AvatarPage({ tenantId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSession(null);
    setIsCreating(false);
    setError(null);
  }, []);

  async function startCall() {
    setIsOpen(true);
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/avatar/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // tenantId comes from the authenticated session; no user input needed.
        body: JSON.stringify({ tenantId }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text}`);
      }

      setSession(await res.json());
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to start session.');
      setIsCreating(false);
      setIsOpen(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, closeModal]);

  return (
    <>
      {error && <p className="session-error" role="alert">{error}</p>}

      <div className="presets">
        <button className="preset" onClick={startCall}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MY_AVATAR.imageUrl}
            alt={MY_AVATAR.name}
            width={240}
            height={320}
            className="preset-avatar"
          />
          <div className="preset-info">
            <span className="preset-name">{MY_AVATAR.name}</span>
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{MY_AVATAR.name}</span>
              <button className="modal-close" onClick={closeModal} aria-label="Close">
                <CloseIcon aria-hidden="true" />
              </button>
            </div>

            {session ? (
              <Suspense fallback={<div className="modal-loading">Connecting…</div>}>
                <AvatarCall
                  avatarId={MY_AVATAR.id}
                  sessionId={session.sessionId}
                  sessionKey={session.sessionKey}
                  avatarImageUrl={MY_AVATAR.imageUrl}
                  onEnd={closeModal}
                  onError={console.error}
                />
              </Suspense>
            ) : isCreating ? (
              <div className="modal-loading">Creating avatar session…</div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function CloseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
