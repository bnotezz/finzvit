#!/usr/bin/env bash
# ==============================================================================
# FinZvit Git Pre-Commit Hook Installer
# Встановлює автоматичну перевірку на витік секретів перед кожним комітом
# ==============================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$ROOT_DIR/.git/hooks"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"

if [ ! -d "$HOOKS_DIR" ]; then
    echo "Directory .git/hooks not found. Are you in a Git repository?"
    exit 1
fi

cat << 'EOF' > "$PRE_COMMIT_HOOK"
#!/usr/bin/env bash
# FinZvit Pre-Commit Security Hook
set -e

ROOT_DIR="$(git rev-parse --show-toplevel)"
python3 "$ROOT_DIR/scripts/security_check.py" --staged
EOF

chmod +x "$PRE_COMMIT_HOOK"
echo "✓ Git pre-commit hook успішно встановлено в: $PRE_COMMIT_HOOK"
echo "  Тепер при кожному git commit автоматично блокуватиметься додавання секретів та ключів."
