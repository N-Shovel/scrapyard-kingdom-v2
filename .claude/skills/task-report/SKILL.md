---
name: task-report
description: Use when a build task in Scrapyard Kingdom is finished, or when starting a session here. Writes docs/reports/Txx-<name>.md and updates INDEX.md so later sessions do not re-read the code.
---

# Task report

Write the report right after the task's check passes, before starting the next task.

## File

`docs/reports/Txx-<short-name>.md`, numbered in order of completion:

```markdown
# Txx: <name>

**Status:** done | done with gaps
**Check:** <exact command> -> <result, with real numbers>

## What exists now
<2-5 lines. What the player or the next task can rely on.>

## Files
- `path`: one job, one line

## Interfaces other code uses
<Exact names and signatures. This is the part that saves re-reading.>

## Decisions and why
<Only what the code cannot show.>

## Gotchas
<What broke, what looks wrong but is right, known limits.>

## Not done
<Skipped on purpose, with the reason.>
```

## Index

Add one line to the table in `docs/reports/INDEX.md`, and update its "Next up" line.

## Rules

- Under 60 lines. A report longer than the code it describes is useless.
- Real results only. If a check did not run, write that.
- A later task that changes an interface updates the old report's Interfaces section too.
