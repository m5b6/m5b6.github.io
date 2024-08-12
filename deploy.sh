#!/bin/bash
npm run build
git add -f out
git commit -m "Deploying build to gh-pages"
git push -f origin `git subtree split --prefix out HEAD`:refs/heads/gh-pages
