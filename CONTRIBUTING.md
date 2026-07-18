# Contributing to NFT Studio

Thank you for helping improve NFT Studio.

## Before you start

- Search existing issues before opening a new one.
- Use an issue to discuss large features or architectural changes first.
- Keep pull requests focused on one problem.
- Never commit personal, licensed, or copyrighted collection artwork.

## Local development

1. Fork and clone the repository.
2. Install dependencies with `npm install`.
3. Add your own temporary PNG or WEBP fixtures under `assets/`.
4. Start the app with `npm run dev`.
5. Run `npm run check` before committing.
6. Run `npm run test:e2e` for interface or generation changes.

Artwork under `assets/` and generated files under `public/generated-assets/` are ignored. Tests that need artwork must create disposable fixtures rather than depend on a contributor's collection.

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
