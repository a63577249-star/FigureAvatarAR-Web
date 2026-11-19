export default {
  noSource: {
    cloud: '密な点群がありません。「再構成 ▸ 密なモデル」で作成するか、点群を読み込んでください。',
    mesh: 'メッシュがありません。「再構成 ▸ メッシュ」で作成するか、メッシュを読み込んでください。',
  },
  output: {
    title: '出力', label: 'メインの{kind, select, dem {標高モデル} ortho {オルソ画像} mesh {メッシュ} other {密な点群}}を置き換える',
    hint: 'オフ：以前の結果を残し、新しい結果を次の処理の入力にします。オン：新しい結果をメインにします。',
    effect: { first: '最初の結果：「{name}」', replaces: '「{main}」を置き換えました。関連する結果は古い結果として残します。', kept: '「{main}」を残し、「{name}」をメインに追加します。', adds: '「{name}」をメインに追加し、「{main}」を残します。' },
    short: { first: '最初', replaces: '「{main}」を置換', adds: '「{name}」を追加' },
  },
  presets: { button: 'プリセット ▾', buttonLast: '前回の設定 ▾', buttonNamed: 'プリセット：{name} ▾', title: '設定を保存、または保存済み設定を読み込み', delete: '{name}を削除', none: '保存済み設定はありません。', namePlaceholder: '設定名', save: '保存', typeName: '名前を入力してください', reset: '初期値に戻す' },
  frame: { label: '座標系', localScaled: 'ローカル（メートル、座標系なし）', local: 'ローカル（モデル単位）', project: 'プロジェクトの座標系', blocked: { geographic: ' — 地理座標系', evidence: ' — 3つ以上のカメラ位置またはGCPが必要' }, blockedTitle: { geographic: 'メートル単位で扱うには投影座標系を選択してください', evidence: '位置合わせには3つ以上のカメラ位置またはGCPが必要です', other: 'モデルはまだ位置合わせされていません' } },
  importKind: { label: '読み込み形式', gcp: '地上基準点', pose: 'カメラ位置', sensor: 'カメラ内部パラメーター' },
  fileName: { label: 'ファイル名', savedAs: '{name}として保存します（拡張子は自動で追加）', hint: '省略できます。拡張子は自動で追加されます。' },
}
