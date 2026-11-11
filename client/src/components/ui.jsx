import Icon from './Icon.jsx';
import { gradientFor, initials } from '../lib.js';

export function Logo({ light }) {
  return (
    <span className={`logo ${light ? 'logo-light' : ''}`}>
      twende ride<span className="logo-dot" />
    </span>
  );
}

export function StepHeader({ step, total = 5, title, subtitle, onBack }) {
  return (
    <header className="step-header">
      <div className="step-top">
        <button className="icon-btn" onClick={onBack} aria-label="Back"><Icon name="back" /></button>
        <span className="step-count">Step {step} of {total}</span>
        <span className="icon-btn-spacer" />
      </div>
      <div className="progress"><div style={{ width: `${(step / total) * 100}%` }} /></div>
      <h2>{title}</h2>
      {subtitle && <p className="muted">{subtitle}</p>}
    </header>
  );
}

export function OptionCard({ emoji, title, desc, selected, onClick, right, children, disabled }) {
  return (
    <button type="button" className={`option ${selected ? 'selected' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="option-emoji">{emoji}</span>
      <span className="option-text">
        <strong>{title}</strong>
        {desc && <span className="option-desc">{desc}</span>}
        {children}
      </span>
      {right && <span className="option-right">{right}</span>}
      <span className="option-check"><Icon name="check" size={14} stroke={3} /></span>
    </button>
  );
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id}
          className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, disabled, onClick, children }) {
  return (
    <button type="button" className={`chip ${active ? 'active' : ''}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export function Avatar({ name, src, size = 56 }) {
  if (src) return <img className="avatar" src={src} alt={name} style={{ width: size, height: size, objectFit: 'cover' }} />;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, background: gradientFor(name) }}>
      {initials(name)}
    </span>
  );
}

export function Field({ label, error, children }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Modal({ title, children, actions, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}
