import { useEffect, useState } from 'react';
import type { DesktopResult, SetupStatus } from '../types';
import { Icon } from './Icons';

interface SetupProps {
  onNotify: (message: string, kind?: 'ok' | 'error') => void;
}

interface Step {
  id: number;
  title: string;
  detail: string;
  done: boolean;
  action?: 'rl' | 'velocity';
  actionLabel?: string;
}

function StepRow({ step, busy, onAction }: { step: Step; busy: boolean; onAction: (id: Step['id']) => void }) {
  return (
    <div className={`setup-step ${step.done ? 'done' : ''}`}>
      <span className="setup-led" />
      <div className="setup-copy">
        <b>
          {step.id}. {step.title}
        </b>
        <p>{step.detail}</p>
      </div>
      {step.done && <span className="saved-badge">Done</span>}
      {step.action && !step.done && (
        <button className="btn small primary" disabled={busy} onClick={() => onAction(step.id)}>
          <Icon name="download" size={12} />
          {busy ? 'Working…' : step.actionLabel}
        </button>
      )}
      {step.action && step.done && (
        <button className="btn small installed-btn" disabled title="Already installed — nothing more to do">
          <Icon name="check" size={12} /> Installed
        </button>
      )}
    </div>
  );
}

export function Setup({ onNotify }: SetupProps) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const api = window.hitboxDesktop;
    if (!api) {
      setLoading(false);
      return;
    }
    const next = await api.setupStatus();
    setStatus(next);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleAction = async (id: number) => {
    const api = window.hitboxDesktop;
    if (!api) return;
    setBusy(id);
    try {
      const result: DesktopResult =
        id === 1 ? await api.browseRocketLeague() : id === 2 ? await api.installVelocity() : { ok: true };
      if (!result.ok) onNotify(result.error ?? 'Setup step failed.', 'error');
      else if (result.note) onNotify(result.note);
      else onNotify('Done.');
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="setup-wrap">
        <p className="hint">Checking what is installed…</p>
      </div>
    );
  }

  if (!window.hitboxDesktop) {
    return (
      <div className="setup-wrap">
        <p className="hint">Setup runs in the HITBOX desktop app (npm run electron:dev or the installed build).</p>
      </div>
    );
  }

  const rl = status?.rocketLeague ?? null;
  const velocity = status?.velocity ?? null;

  const steps: Step[] = [
    {
      id: 1,
      title: 'Rocket League',
      detail: rl
        ? `Found at ${rl}`
        : 'HITBOX could not find Rocket League automatically. Browse to RocketLeague.exe (inside Binaries\\Win64) and HITBOX will remember it forever.',
      done: Boolean(rl),
      action: 'rl',
      actionLabel: 'Browse for RL',
    },
    {
      id: 2,
      title: 'VelocityRL (in-game item spawner)',
      detail: velocity
        ? `Installed at ${velocity}`
        : 'The client-side app that puts your items on screen in game. Free, open source, and maintained daily — it never waits for a mod update after a Rocket League patch. One click downloads the official installer.',
      done: Boolean(velocity),
      action: 'velocity',
      actionLabel: 'Download & install',
    },
  ];

  const allDone = Boolean(rl && velocity);

  return (
    <div className="setup-wrap">
      <section className="panel setup-card">
        <div className="panel-head">
          <div>
            <div className="eyebrow">
              <b>Setup</b> In-game mod
            </div>
            <div className="panel-title">{allDone ? 'Everything is ready' : 'Get your loadout in game'}</div>
          </div>
          <button className="btn ghost small" onClick={() => void refresh()}>
            <Icon name="refresh" size={12} /> Re-check
          </button>
        </div>

        <p className="hint">
          HITBOX changes only what <b>you</b> see on your screen. It does not unlock items on any server, does not
          touch other players, and does not modify gameplay. VelocityRL applies everything client-side.
        </p>

        <div className="setup-steps">
          {steps.map((step) => (
            <StepRow key={step.id} step={step} busy={busy === step.id} onAction={(id) => void handleAction(id)} />
          ))}
        </div>

        {velocity && (
          <p className="hint">
            Inside VelocityRL, spawn the car body, boost, paint and title you designed here and save them as a
            VelocityRL preset — it can switch presets anytime and restore everything to vanilla with one click.
          </p>
        )}

        {allDone && (
          <div className="save-actions">
            <button className="btn primary" onClick={() => void window.hitboxDesktop?.launchVelocity()}>
              <Icon name="play" size={13} /> Open VelocityRL
            </button>
            <button className="btn" onClick={() => void window.hitboxDesktop?.launchGame()}>
              Launch Rocket League
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
