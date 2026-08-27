import re

with open('frontend/package.json', 'r') as f:
    content = f.read()

content = content.replace('"test:a11y": "tsx --tsconfig tsconfig.json scripts/a11y-check.ts",', '"test:a11y": "tsx --tsconfig tsconfig.json scripts/a11y-check.ts",\n    "test:watchlist": "tsx --tsconfig tsconfig.json scripts/watchlist-portability-check.ts",')

with open('frontend/package.json', 'w') as f:
    f.write(content)
