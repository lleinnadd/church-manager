#!/bin/sh
# If commitizen just wrote the message, skip the editor
if [ -f .git/.cz-skip-editor ]; then
  rm .git/.cz-skip-editor
  exit 0
fi
# Otherwise open the default editor
exec "${REAL_EDITOR:-vim}" "$@"
