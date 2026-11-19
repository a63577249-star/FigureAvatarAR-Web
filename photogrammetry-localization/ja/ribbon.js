import { ribbonCatalogue } from '../../help/ribbonText.js'

// Keep every current command key present, then replace the labels used most often.
// Untranslated specialist commands deliberately retain their established English names.
const base = ribbonCatalogue().catalogue
const ja = {
  tab: { view: '表示', import: '読み込み', reconstruct: '再構成', tools: 'ツール', evaluate: '品質確認', export: '書き出し', other: 'その他', picture: '写真', dem: '標高モデル', orthophoto: 'オルソ画像' },
  group: { inspect: '確認', images: '写真', cameras: 'カメラ', groundControl: '地上基準点', interoperability: '形式変換', workflow: '一括処理', features: '特徴点', sparse: '疎なモデル', georeferencing: '位置合わせ', dense: '密なモデル', products: '生成物', model: 'モデル', pointCloud: '点群', mesh: 'メッシュ', report: 'レポート', reconstruction: '再構成', geometry: '形状', project: 'プロジェクト', panels: 'パネル', app: 'アプリ', scene: 'シーン', map: '地図', image: '写真', view: '表示', toggles: '表示切替' },
  section: { prepare: '準備', refine: '調整', clean: '整理', edit: '編集', combine: '統合', simplify: '簡略化', convert: '変換', export: '書き出し', cloudsMeshes: '点群とメッシュ', mapDemOrOrthophotoInFront: '地図・標高モデル・オルソ画像を表示中' },
  need: { project: '先にプロジェクトを開いてください', images: '先に写真を読み込んでください', imagesReady: '写真を読み込み中です…', keypoints: '先に特徴点を検出してください', matches: '先に写真同士を照合してください', sparse: '先に疎なモデルを作成してください', depthMaps: '先に深度マップを計算してください', cloud: '先に点群を作成してください', dense: '先に密な点群を作成してください', mesh: '先にメッシュを作成してください', ortho: '先にオルソ画像を作成してください' },
  reason: { comingSoon: '準備中', aerialOnly: '航空写真プロジェクト専用です' },
  cmd: {
    'open-image-table': { label: '写真一覧', tip: '写真、撮影情報、カメラ位置を確認' },
    'import-images': { label: '写真を追加', tip: 'プロジェクトに写真を追加します' },
    'import-video': { label: '動画を追加', tip: '動画から鮮明で重なりのある写真を抽出します' },
    'workflow-builder': { label: '一括処理', tip: '複数の処理を順番に実行し、各段階で品質を確認します' },
    'detect-features': { label: '特徴点を検出', tip: '各写真から特徴点を検出します' },
    'match-features': { label: '写真を照合', tip: '写真間で特徴点を照合し、幾何的に検証します' },
    reconstruct: { label: '疎なモデル', tip: 'カメラ位置とレンズ設定を推定し、結合点を三角測量します' },
    'compute-depth': { label: '深度マップ', tip: '隣り合う写真から各写真の深度を推定します' },
    dense: { label: '密なモデル', tip: '深度マップを統合して色付き点群を作成します' },
    'gen-mesh': { label: 'メッシュ', tip: '密な点群から表面メッシュを作成します' },
    'export-mesh': { label: 'メッシュを書き出し', tip: 'メッシュをPLY、glTF、OBJ、STLで保存します' },
    'export-cloud': { label: '点群を書き出し', tip: '点群をPLY、LAS、LAZ、XYZで保存します' },
    'open-project-settings': { label: 'プロジェクト設定', tip: '名前や座標系などを設定します' },
    'save-project-file': { label: 'プロジェクトを保存', tip: 'プロジェクト全体を.websfmファイルに保存します' },
    'open-settings': { label: 'アプリ設定', tip: 'アプリ全体の設定' },
    'open-about': { label: 'このアプリについて', tip: 'バージョンとライセンス情報' },
    'open-guide': { label: '操作ガイド', tip: '各処理と設定の選び方' },
    'open-glossary': { label: '用語集', tip: '手法と用語の説明' },
    'eval-overview': { label: '品質レポート', tip: '各処理の結果と、先に直すべき点を確認します' },
    'menu-images': { label: '写真' }, 'menu-model': { label: 'モデル' }, 'menu-cloud': { label: '点群' }, 'menu-mesh': { label: 'メッシュ' }, 'menu-products': { label: '生成物' }, 'menu-measure': { label: '計測' },
    'filter-cloud': { label: '点群を整理…', blurb: '高さや明るさ、孤立点などで点群を整理します' },
    'clean-mesh': { label: 'メッシュを修復…', blurb: '小片、穴、細長い接続部分を整理します' },
    'smooth-mesh': { label: 'メッシュを平滑化…', blurb: '縮みを抑えて表面を滑らかにします' },
    'decimate-mesh': { label: 'ポリゴン数を減らす…', blurb: '指定した三角形数に簡略化します' },
    'texture-mesh': { label: '写真でテクスチャを作成…', blurb: '位置合わせ済みカメラの写真を表面に貼ります' },
  },
  ui: { project: 'プロジェクト', image: '写真', new: '新規', smaller: '{what}を縮小', larger: '{what}を拡大', smallest: 'これ以上縮小できません', largest: 'これ以上拡大できません', detectKeypointsFirst: '先に特徴点を検出してください' },
}

function merge(a, b) {
  const out = { ...a }
  for (const [key, value] of Object.entries(b)) {
    out[key] = value && typeof value === 'object' && !Array.isArray(value) ? merge(a?.[key] ?? {}, value) : value
  }
  return out
}

export default merge(base, ja)
