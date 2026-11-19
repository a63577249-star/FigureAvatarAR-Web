# Japanese UI source patch

The deployed app in `../work/public-site/photogrammetry/` is built from WebSfM 0.8.0, upstream commit `c8089f0f2f0833e0f60f8da46e6e3a2d4f1d8e8b`.

`websfm-ja.patch` adds the partial Japanese catalogue and `?lang=ja` selection. It is applied to that upstream source before building the static app with `VITE_BASE_PATH=/FigureAvatarAR-Web/photogrammetry/` and `npm run build`. The app falls back to English for untranslated specialist text.