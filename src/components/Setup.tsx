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
  action?: 'rl' | 'bakkesmod' | 'plugin' | 'open';
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
        id === 1
          ? await api.browseRocketLeague()
          : id === 2
            ? await api.installBakkesMod()
            : id === 3
              ? await api.installBridgePlugin()
              : id === 4
                ? await api.installVelocity()
                : { ok: true };
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
  const bakkes = status?.bakkesMod ?? false;
  const plugin = status?.bridgePlugin ?? false;
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
      title: 'BakkesMod (client-side mod loader)',
      detail: bakkes
        ? 'Installed. This is the official, ban-safe client mod loader for Rocket League.'
        : 'Needed so HITBOX can show your loadout in game. One click — HITBOX downloads the official BakkesModSetup and starts its installer for you.',
      done: bakkes,
      action: 'bakkesmod',
      actionLabel: 'Download & install',
    },
    {
      id: 3,
      title: 'HITBOX bridge plugin',
      detail: plugin
        ? 'Installed into the BakkesMod plugins folder. It reads your live loadout and applies it in game.'
        : 'A small plugin built by the HITBOX project. One click downloads it from GitHub Releases into the right folder.',
      done: plugin,
      action: 'plugin',
      actionLabel: 'Download & install',
    },
  ];

  const allDone = rl && bakkes && plugin;

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
          HITBOX changes only what <b>you</b> see on your screen. It does not unlock items, does not touch other
          players, and does not modify gameplay. BakkesMod is the long-standing client-side mod loader the Rocket
          League community has used for years with cosmetic mods.
        </p>

        <div className="setup-steps">
          {steps.map((step) => (
            <StepRow key={step.id} step={step} busy={busy === step.id} onAction={(id) => void handleAction(id)} />
          ))}
        </div>

        {plugin && (
          <p className="hint">
            After installing the plugin, (re)start Rocket League <b>through BakkesMod</b>. In freeplay the bridge
            applies your loadout automatically. Console commands:{' '}
            <code>hitbox_reload</code>, <code>hitbox_apply</code>, <code>hitbox_dumploadout</code>.
          </p>
        )}

        <section className="setup-alt">
          <div className="setup-alt-head">
            <div>
              <b>Plan B — VelocityRL (never out of date)</b>
              <p>
                If BakkesMod is “out of date, waiting for an update” after a Rocket League patch, VelocityRL is a
                free, open-source item spawner and preset app that is maintained daily and does not depend on
                BakkesMod at all. Spawn any car body, boost, paint or title client-side, save presets, and restore
                everything with one click.
              </p>
            </div>
            {velocity ? (
              <button className="btn small installed-btn" disabled title="Already installed — launch it from the Start menu">
                <Icon name="check" size={12} /> Installed
              </button>
            ) : (
              <button className="btn small primary" disabled={busy === 4} onClick={() => void handleAction(4)}>
                <Icon name="download" size={12} /> {busy === 4 ? 'Working…' : 'Download & install'}
              </button>
            )}
          </div>
          {velocity && <p className="hint">Found at <code>{velocity}</code></p>}
        </section>

        {allDone && (
          <div className="save-actions">
            <button className="btn primary" onClick={() => void window.hitboxDesktop?.launchGame()}>
              <Icon name="play" size={13} /> Launch Rocket League
            </button>
            <button className="btn" onClick={() => void window.hitboxDesktop?.openBridgeFolder()}>
              Open bridge folder
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

