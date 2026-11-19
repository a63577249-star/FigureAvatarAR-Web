export default {
  title: { cloud: '点群を書き出し', mesh: 'メッシュを書き出し', model: 'モデルを書き出し', colmap: 'SfMプロジェクトを書き出し', tiles3d: '3D Tilesを書き出し', undistorted: '補正済み画像を書き出し', dem: '標高モデルを書き出し', measurements: '計測結果を書き出し', ortho: 'オルソ画像を書き出し', poses: 'カメラ位置を書き出し', sensors: 'カメラ設定を書き出し' },
  hint: { sensors: '「読み込み ▸ カメラ設定」で読み込めます。', matches: '幾何検証に合格した画像ペアを書き出します。' },
  format: {
    cloud: { 'ply-binary': { label: 'PLY', blurb: 'バイナリ（コンパクト）' }, 'ply-ascii': { label: 'PLY', blurb: 'テキスト形式' }, las: { label: 'LAS 1.2', blurb: '測量標準形式' }, laz: { label: 'LAZ', blurb: '圧縮LAS' }, xyz: { label: 'XYZ', blurb: 'テキスト（x y z r g b）' } },
    mesh: { 'ply-binary': { label: 'PLY', blurb: 'バイナリ（面情報）' }, 'ply-ascii': { label: 'PLY', blurb: 'テキスト形式' }, glb: { label: 'glTFバイナリ', blurb: '.glb' }, obj: { label: 'Wavefront OBJ', blurb: '.obj' }, stl: { label: 'STL', blurb: 'バイナリ（色なし）' } },
    model: { json: { label: 'JSON', blurb: 'カメラと軌跡' }, transforms: { label: 'transforms.json', blurb: 'NeRF / 3DGS' } },
    undistorted: { jpeg: { label: 'JPEG', blurb: '軽量（推奨）' }, png: { label: 'PNG', blurb: '可逆圧縮（大容量）' } },
  },
}
