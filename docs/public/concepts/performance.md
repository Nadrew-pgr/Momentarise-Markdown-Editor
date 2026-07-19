---
title: Performance Budgets
description: CI-runnable performance guardrails for large Markdown documents.
nav_section: Features
nav_order: 38
audience: developers
tags:
  - performance
  - benchmarks
  - public-release
llms: include
updated: 2026-07-19
---

# Performance Budgets

MME uses performance budgets as regression guardrails, not as marketing benchmark claims.

The committed large-document proof uses `fixtures/021-large-performance/input.md`, a generated 10k-line Markdown document with headings, task lists, ordered lists, GFM tables, code fences, Mermaid fences, links, footnotes, callouts, safe HTML, and opaque custom syntax.

Run the CI guard with:

```bash
npm run test:performance-budgets
```

That command builds the workspace, validates that the committed fixture and docs stay in sync, and fails if any budgeted operation crosses its threshold.

After a build, print the machine-readable JSON report with:

```bash
npm run benchmark:performance
```

The report covers parse, serialize, rich mount, rich serialize, HTML render, outline, find/replace, save hashing, autosave truth, and a bounded public docs render path.

Thresholds live in the committed `performance-budgets.json` budget file used by the benchmark command. They are intentionally broad CI limits until MME has repeatable machine-class data.

## Residual Risks

- The rich editor still needs virtualization work before claiming excellent interactive performance for every very large document.
- The current budgets catch large regressions but do not prove latency on every browser, host shell, or mobile device.
- Thresholds should tighten after release candidates collect stable measurements across CI and local machines.
- Budget failures should split optimization work instead of hiding the regression.
