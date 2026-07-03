# Security Policy

## Reporting

Do not open public issues for suspected vulnerabilities. Send a private report to the repository owner with a minimal reproduction, affected package, and expected impact.

## Supported Surface

The current public-readiness line is `0.1.x`. All packages are experimental, but security fixes should target the current line first.

## BYOK And AI Keys

BYOK keys are host/user secrets. The framework must not log, persist, serialize, index, export, or display provider keys. Demo personal BYOK state is memory-only, and production hosts must supply their own secure storage or backend/sidecar gateway.

## Document Policy

Secret-bearing paths such as `.env`, token, key, private identity, and banking files are hard-denied by the default document policy. CLI inspection and rendering must not leak policy-denied file contents.

## Rich And HTML Surfaces

Rich-mode links and images strip unsafe live URL attributes such as `javascript:`, `vbscript:`, and non-image `data:` URLs. Pasted HTML strips scripts and event-handler attributes before schema parsing.

Markdown HTML rendering and standalone HTML preview use separate sanitization/sandbox layers. Preview sandbox defaults grant no tokens unless a host opts in.
