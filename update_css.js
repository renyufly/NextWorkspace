const fs = require('fs');
let css = fs.readFileSync('apps/web/app/globals.css', 'utf8');

// Replace Root Variables
css = css.replace(/:root\s*{[^}]*}/, `:root {
  color-scheme: dark;
  --bg: #09090b;
  --bg-deep: #000000;
  --panel: rgba(255, 255, 255, 0.05); /* Translucent Glass */
  --panel-strong: rgba(255, 255, 255, 0.1);
  --panel-border: rgba(255, 255, 255, 0.15); /* Minimal physical borders */
  --text: #ffffff;
  --muted: rgba(255, 255, 255, 0.65);
  --accent: #a855f7; /* Purple */
  --accent-strong: #06b6d4; /* Cyan */
  --accent-soft: rgba(168, 85, 247, 0.2);
  --danger: #ef4444;
  --glow: 0 0 15px rgba(168, 85, 247, 0.4);
}`);

// Replace Body Background
css = css.replace(/html,\s*body\s*{[^}]*}/, `html,
body {
  margin: 0;
  min-height: 100%;
  font-family: 'Inter', system-ui, sans-serif;
  background: 
    radial-gradient(circle at 10% 20%, rgba(168, 85, 247, 0.4) 0%, transparent 60%), /* Purple */
    radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.4) 0%, transparent 60%), /* Blue */
    radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.3) 0%, transparent 60%), /* Cyan */
    #05050f;
  background-attachment: fixed;
  color: var(--text);
}`);

// Add Neon Glows & Better Glassmorphism to specific classes directly inside the CSS string
css = css.replace(/\.hero\s*{([^}]*)}/, (match, p1) => {
  return `.hero {
  padding: 3rem;
  border: 1px solid var(--panel-border);
  border-radius: 28px;
  background: var(--panel);
  backdrop-filter: blur(24px);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1);
}`;
});

css = css.replace(/(?:^\.auth-card,\s*\.sidebar-panel,\s*\.conversation-panel,\s*\.brand-rail\s*{)([^}]*)(?:})/, (match, p1) => {
  return `.auth-card,
.sidebar-panel,
.conversation-panel,
.brand-rail {
  border: 1px solid var(--panel-border);
  border-radius: 28px;
  background: var(--panel);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.2), inset 0 1px rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}`;
});

css = css.replace(/\.card\s*{([^}]*)}/g, (match, p1) => {
  return `.card {
  padding: 1.5rem;
  border: 1px solid var(--panel-border);
  border-radius: 24px;
  background: var(--panel);
  backdrop-filter: blur(12px);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.3);
}`;
});

css = css.replace(/\.status-list li\s*{([^}]*)}/, `.status-list li {
  padding: 0.85rem 1rem;
  border-radius: 18px;
  background: var(--panel-strong);
  border: 1px solid var(--panel-border);
  backdrop-filter: blur(8px);
}`);

css = css.replace(/input,\s*textarea\s*{([^}]*)}/g, `input,
textarea {
  width: 100%;
  border: 1px solid var(--panel-border);
  border-radius: 18px;
  padding: 0.95rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  color: var(--text);
  backdrop-filter: blur(8px);
}`);

css = css.replace(/input:focus,\s*textarea:focus\s*{([^}]*)}/g, `input:focus,
textarea:focus {
  outline: 2px solid var(--accent);
  border-color: var(--accent);
  box-shadow: var(--glow);
}`);

css = css.replace(/\.primary-button\s*{([^}]*)}/g, `.primary-button {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%);
  color: #fff;
  box-shadow: 0 8px 32px rgba(168, 85, 247, 0.4);
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}
.primary-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(6, 182, 212, 0.5);
}`);

css = css.replace(/\.ghost-button\s*{([^}]*)}/g, `.ghost-button {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--panel-border);
  backdrop-filter: blur(8px);
}
.ghost-button:hover {
  background: var(--panel-strong);
}`);

fs.writeFileSync('apps/web/app/globals.css', css);
console.log('globals.css successfully updated directly!');
