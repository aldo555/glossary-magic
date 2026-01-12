# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build          # Build the plugin for distribution
npm run watch          # Watch mode for development
npm run watch:link     # Watch with local Strapi linking
npm run verify         # Verify plugin configuration
```

## Architecture Overview

This is a Strapi 5 plugin that automatically links glossary terms to article content using markdown link syntax.

### Directory Structure

- **`admin/src/`** - React admin panel UI that integrates with Strapi's Content Manager
- **`server/src/`** - Backend API controllers and routes

### How It Works

The plugin operates in two phases:

1. **Content Linking (Client-Side)**: The "Cast Glossary Magic" button scans article content fields (`contentTop`, `contentMiddle`, `contentBottom`) and wraps matching glossary terms in markdown links `[word](url)`. Uses pluralize library to match singular/plural forms.

2. **Metadata Association (Server-Side)**: The "Connect Used Words to Article" button creates many-to-many relationships between articles and glossary words in the database.

### Key Files

- `admin/src/components/GlossaryMagicButton.jsx` - Main UI component with word matching logic, renders as side panel only for `api::article.article` content type
- `server/src/controllers/controller.js` - Three API handlers: `getGlossaryWords`, `connectGlossaryWords`, `disconnectGlossaryWords`
- `server/src/routes/index.js` - Route definitions for `/glossary-magic/*` endpoints

### Data Model Requirements

The plugin expects these Strapi content types to exist:
- `api::article.article` with fields: `contentTop`, `contentMiddle`, `contentBottom`, `articleCategory` (relation), `glossaryWords` (many-to-many)
- `api::glossary-word.glossary-word` with fields: `word`, `article_categories` (many-to-many)
- `api::article-category.article-category`

### Word Scoping

- **Global words**: Glossary words with no category restrictions appear for all articles
- **Category-scoped words**: Words with `article_categories` only appear for articles in matching categories
- Links include category context when applicable: `?search=word&category=CategoryName`

### Configuration

Users configure the plugin in their Strapi instance's `config/plugins.ts`:
```javascript
'glossary-magic': {
  enabled: true,
  config: {
    glossaryBaseUrl: 'https://example.com/glossary'
  }
}
```
