# Security Policy

## Supported version

Security fixes are applied to the latest version on the default branch.

## Reporting a vulnerability

Please do not publish suspected vulnerabilities in a public issue.

Use GitHub's **Report a vulnerability** option in the repository Security tab. Include the affected feature, reproduction steps, impact, and any suggested mitigation. Maintainers will acknowledge a complete report as soon as practical and coordinate disclosure after a fix is available.

## Security model

NFT Studio is a static client-side application. It has no account system, database, or application backend. Collection generation and local export occur in the browser.

Artwork selected through the browser remains session-local and is not uploaded by NFT Studio. Never commit or deploy confidential artwork.
