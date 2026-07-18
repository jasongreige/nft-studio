# Contributing to NFT Studio

Thank you for helping improve NFT Studio.

## Before you start

- Search existing issues before opening a new one.
- Use an issue to discuss large features or architectural changes first.
- Keep pull requests focused on one problem.
- Never commit artwork you do not own or have permission to distribute.

## Local development

1. Fork and clone the repository.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.
4. Use **Try the demo** or **Choose asset folder** in the browser.
5. Run `npm run check` before committing.
6. Run `npm run test:e2e` for interface or generation changes.

Do not add artwork collections to the repository. Tests that need artwork must create disposable fixtures at runtime.

## Code expectations

- Keep generation and rarity logic independent from React where possible.
- Use strict TypeScript and descriptive types.
- Add tests for bug fixes and new behavior.
- Preserve keyboard access, visible focus states, labels, and responsive layouts.
- Do not add server-side data collection, analytics, or artwork uploads without prior discussion.
- Avoid new dependencies when a small, maintainable implementation is sufficient.

## Pull requests

Include:

- What changed and why
- How it was tested
- Screenshots for visible UI changes
- Any browser limitations or migration notes

By contributing, you agree that your contribution is licensed under the MIT License.
