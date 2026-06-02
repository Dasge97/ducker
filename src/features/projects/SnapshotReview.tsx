import { useEffect, useState } from 'react';

import type { SnapshotSummary } from '../../domain/projects';
import { collectProjectSnapshot } from '../../services/native';
import { Button, Spinner } from '../../ui/primitives';
import { Icon } from '../../ui/icons';
import { Overlay, ModalCard, ModalHeader, ModalFooter } from '../../ui/overlays';

export function SnapshotReview({ path, onClose }: { path: string; onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<SnapshotSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    collectProjectSnapshot(path)
      .then(setSnapshot)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [path]);

  return (
    <Overlay onClose={onClose}>
      <ModalCard width={600}>
        <ModalHeader icon="shieldCheck" iconColor="var(--st-running)" title="Qué se envía a la IA" sub="Ducker analiza la estructura, no el código. Revisa el snapshot exacto." onClose={onClose} />
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', background: 'var(--st-running-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="shield" size={18} style={{ color: 'var(--st-running)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              <b style={{ color: 'var(--text)' }}>No se envía código fuente por defecto.</b> Solo manifiestos, config y un árbol de archivos por nombre.
            </span>
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 120 }}>
          {error && <div className="error">{error}</div>}
          {!snapshot && !error && <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-faint)' }}><Spinner size={16} />Recogiendo snapshot…</div>}
          {snapshot && (
            <>
              <div>
                <div className="upper" style={{ fontSize: 10.5, color: 'var(--st-running)', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="check" size={13} />Incluidos · {snapshot.includedFiles.length} archivos
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {snapshot.includedFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px', borderRadius: 'var(--r-sm)', fontSize: 12.5 }}>
                      <Icon name="file" size={14} style={{ color: 'var(--st-completed)', flexShrink: 0 }} />
                      <code className="mono" style={{ flex: 1, color: 'var(--text-dim)', background: 'none', border: 'none', padding: 0 }}>{f}</code>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="upper" style={{ fontSize: 10.5, color: 'var(--st-failed)', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="eyeOff" size={13} />Nunca se envía
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {snapshot.omittedFiles.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-ghost)', padding: '2px 8px' }}>Nada sensible detectado en la raíz.</span>}
                  {snapshot.omittedFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px', fontSize: 12.5 }}>
                      <Icon name="x" size={13} style={{ color: 'var(--st-failed)', flexShrink: 0 }} />
                      <code className="mono" style={{ flex: 1, color: 'var(--text-faint)', textDecoration: 'line-through', background: 'none', border: 'none', padding: 0 }}>{f}</code>
                    </div>
                  ))}
                </div>
              </div>
              {Object.keys(snapshot.manifests).length > 0 && (
                <details>
                  <summary>Manifiestos enviados ({Object.keys(snapshot.manifests).length})</summary>
                  <pre>{Object.entries(snapshot.manifests).map(([file, content]) => `${file}\n${content}`).join('\n\n')}</pre>
                </details>
              )}
            </>
          )}
        </div>
        <ModalFooter>
          <Button variant="primary" icon="check" onClick={onClose}>Entendido</Button>
        </ModalFooter>
      </ModalCard>
    </Overlay>
  );
}
