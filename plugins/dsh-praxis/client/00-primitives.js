/* Shared primitives. Prefix Prim*. Contract §4.2. No imports, no JSX. */

function PrimCls(...parts) {
  return parts.filter(Boolean).join(' ');
}

function PrimShort(value, size = 12) {
  const text = String(value ?? '');
  return text.length > size ? `${text.slice(0, size)}…` : text;
}

function PrimClock(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function PrimAgo(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function PrimBtn({ children, onClick, tone, disabled, title, type = 'button', className, ariaLabel, ...rest }) {
  return h('button', {
    type,
    title,
    disabled,
    'aria-label': ariaLabel ?? (typeof children === 'string' ? children : undefined),
    className: PrimCls('px-btn', tone, className),
    onClick,
    ...rest,
  }, children);
}

function PrimField({ label, hint, children, error, id }) {
  return h('label', { className: PrimCls('px-field', error && 'has-error'), htmlFor: id },
    h('span', { className: 'px-field-label' },
      h('span', null, label),
      hint ? h('em', null, hint) : null),
    children,
    error ? h('span', { className: 'px-field-error', role: 'alert' }, error) : null);
}

function PrimInput(props) {
  return h('input', { className: PrimCls('px-input', props.className), ...props });
}

function PrimArea(props) {
  return h('textarea', { rows: 3, className: PrimCls('px-input px-area', props.className), ...props });
}

function PrimSelect({ options, className, ...props }) {
  return h('select', { className: PrimCls('px-input', className), ...props },
    (options ?? []).map(([value, label]) => h('option', { key: value, value }, label)));
}

function PrimChip({ tone, children, title, className, ...rest }) {
  return h('span', { className: PrimCls('px-chip', tone, className), title, ...rest }, children);
}

function PrimBanner({ tone = 'idle', children, onDismiss, action }) {
  return h('div', { className: PrimCls('px-banner', tone), role: tone === 'bad' ? 'alert' : 'status' },
    h('span', { className: 'px-banner-text' }, children),
    action ?? null,
    onDismiss ? h('button', { type: 'button', className: 'px-banner-x', 'aria-label': '关闭提示', onClick: onDismiss }, '×') : null);
}

function PrimMenu({ label, items, tone, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return h('div', { className: 'px-menu', ref },
    h(PrimBtn, {
      tone, disabled, onClick: () => setOpen((value) => !value),
      className: 'px-menu-trigger', ariaLabel: label,
    }, label, h('span', { className: 'px-menu-caret', 'aria-hidden': true }, '▾')),
    open ? h('div', { className: 'px-menu-list', role: 'menu' },
      (items ?? []).map((item) => h('button', {
        key: item.id ?? item.label,
        type: 'button',
        role: 'menuitem',
        className: PrimCls('px-menu-item', item.danger && 'danger', item.active && 'is-on'),
        onClick: () => { setOpen(false); item.onClick?.(); },
        disabled: item.disabled,
        title: item.title,
      }, item.label, item.hint ? h('em', null, item.hint) : null))) : null);
}

function PrimTabs({ items, value, onChange, ariaLabel }) {
  return h('div', { className: 'px-tabs', role: 'tablist', 'aria-label': ariaLabel },
    (items ?? []).map((item) => h('button', {
      key: item.id,
      type: 'button',
      role: 'tab',
      'aria-selected': item.id === value,
      className: PrimCls('px-tab', item.id === value && 'is-on'),
      onClick: () => onChange?.(item.id),
      title: item.title,
    }, item.label)));
}

function PrimSkeleton({ rows = 3 }) {
  return h('div', { className: 'px-skeleton', 'aria-hidden': true },
    Array.from({ length: rows }, (_, index) => h('span', { key: index, className: 'px-skeleton-row' })));
}

function PrimEmpty({ title, hint, action }) {
  return h('div', { className: 'px-empty' },
    h('p', { className: 'px-empty-title' }, title),
    hint ? h('p', { className: 'px-empty-hint' }, hint) : null,
    action ?? null);
}

function PrimModal({ title, children, onClose, actions, wide }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return h('div', { className: 'px-modal-scrim', role: 'presentation', onPointerDown: (event) => {
    if (event.target === event.currentTarget) onClose?.();
  } },
  h('div', { className: PrimCls('px-modal', wide && 'wide'), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { className: 'px-modal-head' },
      h('h2', null, title),
      h('button', { type: 'button', className: 'px-icon-btn', onClick: onClose, 'aria-label': '关闭' }, '×')),
    h('div', { className: 'px-modal-body' }, children),
    actions ? h('footer', { className: 'px-modal-foot' }, actions) : null));
}

function PrimKeyValue({ rows }) {
  return h('dl', { className: 'px-kv' },
    rows.filter(Boolean).map(([label, value]) => h('div', { key: label, className: 'px-kv-row' },
      h('dt', null, label),
      h('dd', null, value))));
}

function PrimGlyph({ kind, 'aria-hidden': ariaHidden = true }) {
  const map = { done: '✓', blocked: '!', failed: '×', active: '●', pending: '○', unknown: '?', stale: '↺', satisfied: '✓', missing: '—' };
  return h('span', { className: PrimCls('px-glyph', kind), 'aria-hidden': ariaHidden }, map[kind] ?? '·');
}
