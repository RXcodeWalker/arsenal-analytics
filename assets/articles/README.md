# Article Media Structure

Store article-specific media in slug-scoped folders:

- `assets/articles/<slug>/cover.jpg`
- `assets/articles/<slug>/*.webp`
- `assets/articles/<slug>/inline-*.png`

Rules:

- Folder name must match frontmatter `slug`.
- Keep one primary `cover` image referenced by index metadata.
- Keep media local to each article to avoid asset sprawl and naming collisions.
