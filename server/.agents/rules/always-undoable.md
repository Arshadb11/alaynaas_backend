---
trigger: always_on
---

# Always keep every change undoable

The user must be able to undo any change at any time. Follow this for every task.

## 1. Edit files only with the file-edit tools
- Change source files only with `replace_file_content`, `multi_replace_file_content` or `write_to_file`. Edits made this way show up in the editor and can be undone or rejected there.
- Never rewrite source files from Node/PowerShell/Python scripts (`fs.writeFileSync`, `Set-Content`, `Out-File`, `[IO.File]::WriteAllText`, `>`/`>>` redirects, `sed -i`, etc.).
- Exception: when a script is truly unavoidable (bulk/generated edits), take a backup first (section 2) and say so in the reply.

## 2. Take a checkpoint before changing anything
This folder is not in Git. At the start of each task, before the first edit, copy every file you are about to change into
`<project root>/.agent-backups/<YYYYMMDD-HHmm>-<task>/`, keeping the relative paths.
Never delete or overwrite earlier backups.

## 3. Database changes
- Before any `UPDATE`/`DELETE`/`ALTER`, export the affected rows to
  `backend/Admin panel/server/.agent-backups/<YYYYMMDD-HHmm>-<task>/db-<table>.json`.
- Write a matching restore script next to the export.

## 4. Never destroy work
- Do not delete files the user created unless the user explicitly asks.

## 5. Tell the user how to undo
End every reply that changed files or data with one short line naming the backup and how to restore it, e.g.
`Undo: copy back from .agent-backups/20261027-1010-video-upload/`.
