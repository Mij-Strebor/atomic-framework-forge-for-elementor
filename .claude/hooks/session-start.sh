#!/bin/bash
# AFF Session Start Hook
# Installs PHP development tooling (phpcs + WordPress Coding Standards)
# Only runs in Claude Code remote (web) sessions.

set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "AFF: Installing PHP development dependencies via Composer..."
COMPOSER_ALLOW_SUPERUSER=1 composer install --no-interaction --no-progress --no-ansi

echo "AFF: Configuring phpcs installed paths for WordPress Coding Standards..."
./vendor/bin/phpcs --config-set installed_paths \
  vendor/wp-coding-standards/wpcs,vendor/phpcsstandards/phpcsutils,vendor/phpcsstandards/phpcsextra

echo "AFF: Verifying phpcs + WPCS installation..."
./vendor/bin/phpcs --version
./vendor/bin/phpcs -i

echo "AFF: Session environment ready."
