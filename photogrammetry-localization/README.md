# Japanese UI source patch

The deployed app in `../work/public-site/photogrammetry/` is built from WebSfM 0.8.0, upstream commit `c8089f0f2f0833e0f60f8da46e6e3a2d4f1d8e8b`.

`ja/` contains the partial Japanese catalogue. `websfm-ja.patch` registers it and adds `?lang=ja` selection. Apply the patch and copy `ja/` into that upstream source before building the static app with `VITE_BASE_PATH=/FigureAvatarAR-Web/photogrammetry/` and `npm run build`. The app falls back to English for untranslated specialist text.
