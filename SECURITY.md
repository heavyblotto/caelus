# Security Policy

## Reporting a vulnerability

Please report security issues privately, not as a public issue.

Use GitHub's private vulnerability reporting: go to the repository's
**Security** tab and choose **Report a vulnerability**. This opens a private
advisory visible only to the maintainers.

(Maintainers: enable this under **Settings → Code security → Private
vulnerability reporting** if it is not already on.)

Please include enough to reproduce: affected package and version, inputs, and
the incorrect or unsafe behavior. We will acknowledge the report and keep you
updated on the fix.

## Scope

Caelus is a computation library with no network or filesystem access in its
core, so the most likely issues are incorrect results for specific inputs
(which are bugs, best filed as normal issues unless they have a security
impact) and vulnerabilities in build or server tooling (`caelus-mcp`, the
`apps/web` site). Reports about either are welcome.

## Supported versions

Fixes land on the latest released minor version. Given the pre-1.0 stage,
please upgrade to the current release before reporting.
