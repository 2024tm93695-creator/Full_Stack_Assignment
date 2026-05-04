import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import './TrafficTicker.css';

const LEVEL_CONFIG = {
  free:     { emoji: '🟢', color: '#4caf50', label: 'Free' },
  moderate: { emoji: '🟡', color: '#ff9800', label: 'Moderate' },
  heavy:    { emoji: '🔴', color: '#f44336', label: 'Heavy' },
  severe:   { emoji: '🟣', color: '#9c27b0', label: 'Severe' },
};

const TrafficTicker = () => {
  const { trafficData } = useApp();

  const alerts = useMemo(() => {
    return trafficData
      .filter(t => t.congestionLevel !== 'free')
      .sort((a, b) => b.congestionScore - a.congestionScore);
  }, [trafficData]);

  if (alerts.length === 0) return null;

  // Duplicate for seamless infinite loop
  const items = [...alerts, ...alerts];

  return (
    <div className="traffic-ticker">
      <div className="ticker-label">
        <span>🚦</span> LIVE TRAFFIC
      </div>
      <div className="ticker-viewport">
        <div
          className="ticker-track"
          style={{ animationDuration: `${Math.max(20, alerts.length * 6)}s` }}
        >
          {items.map((t, i) => {
            const cfg = LEVEL_CONFIG[t.congestionLevel] || LEVEL_CONFIG.moderate;
            return (
              <span key={i} className="ticker-item">
                <span className="ticker-dot" style={{ background: cfg.color }} />
                <strong style={{ color: cfg.color }}>{cfg.label}</strong>
                &nbsp;–&nbsp;
                <span className="ticker-road">{t.roadName}</span>
                <span className="ticker-area">({t.area})</span>
                <span className="ticker-score" style={{ color: cfg.color }}>
                  {t.congestionScore}%
                </span>
                {t.incidentType && t.incidentType !== 'none' && (
                  <span className="ticker-incident">⚠ {t.incidentType}</span>
                )}
                <span className="ticker-sep">•</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TrafficTicker;
