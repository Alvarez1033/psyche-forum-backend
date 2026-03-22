#!/bin/bash
set -e
echo "🧠 Psyche Forum Setup"
npm install
if [ ! -f .env ]; then cp .env.example .env; echo "Edit .env with your DB credentials"; fi
npm run migrate
npm run seed
echo "✅ Done! Run: npm run dev"
echo "Admin: admin@psycheforum.com / admin123"
