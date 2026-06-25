---
description: Execute exactly one Detective Pulse engineering task through the complete engineering pipeline.
allowed-tools:
  - Task
  - Read
  - Grep
  - Glob
  - Edit
  - Write
  - Bash
---

# /run-task

## Purpose

Execute exactly ONE task from PROJECT_BACKLOG.md.

This command is an orchestrator only.

It never implements features directly.

It coordinates the specialist agents.

---

## Input

Task ID

Example

T1.2

or

ARCH-2

---

## Step 1 — Validate

Read:

- PROJECT_BACKLOG.md

Locate the requested task.

Verify:

- Task exists
- Status is READY
- All dependencies are complete

If any dependency is incomplete:

STOP

Explain why.

Do not continue.

---

## Step 2 — Planning

Use the feature-planner agent.

Responsibilities:

- Verify task scope
- Verify acceptance criteria
- Verify dependencies
- Confirm the builder that owns the task

Do not modify code.

---

## Step 3 — Build

Use the owning Builder.

Examples:

- frontend-builder
- backend-api-builder
- maps-geo-builder
- native-app-builder
- operations-engineer
- evidence-engineer
- ai-engineer
- data-migration-author

Builder Rules

Implement ONLY the requested task.

Do not perform unrelated refactoring.

Do not continue to another task.

Stop after implementation.

---

## Step 4 — Security Review

Use security-reviewer.

Review ONLY this task.

Possible outputs

APPROVED

or

CHANGES REQUIRED

If CHANGES REQUIRED

STOP

Return findings.

---

## Step 5 — QA Review

Use qa-test-engineer.

Review ONLY this task.

Possible outputs

APPROVED

or

CHANGES REQUIRED

If CHANGES REQUIRED

STOP

Return findings.

---

## Step 6 — Release Review

Use release-manager.

If there is an active Pull Request:

Evaluate merge readiness.

Otherwise:

Record

LOCAL DONE

Merge Status

PENDING PR

Do not create commits.

Do not create pull requests.

---

## Step 7 — Close Task

Use chief-architect.

Responsibilities

- Close the task
- Update PROJECT_BACKLOG.md
- Create sign-off record
- Report newly unblocked tasks
- Recommend the next READY task

---

## Workflow

PROJECT_BACKLOG

↓

feature-planner

↓

Builder

↓

security-reviewer

↓

qa-test-engineer

↓

release-manager

↓

chief-architect

---

## Rules

Never skip Security Review.

Never skip QA Review.

Never implement code inside this command.

Never modify task scope.

Never execute more than ONE task.

Never continue automatically.

Always stop after the selected task finishes.

---

## Output

Task:

Status:

Builder:

Security:

QA:

Release:

Backlog Updated:

Sign-off:

Newly Unblocked Tasks:

Recommended Next Task:
