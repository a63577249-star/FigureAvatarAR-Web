export default {
  images: {
    groupBy: '分類', byGroup: 'グループ別', bySensor: 'カメラ別', byGroupTitle: '作成した画像グループごとに表示',
    bySensorTitle: 'カメラごとに表示します。画像をカメラへドラッグして移動できます。', noSensor: 'カメラ未設定',
    noSensorTitle: 'カメラが割り当てられていない画像', sensorHeader: '{name} — {n, plural, other {# 枚}}。画像をここへ移動',
    setSensor: 'カメラを割り当て', newSensor: '新しいカメラ', newSensorTitle: '選択画像用のカメラ設定を作成', sensorInfo: 'カメラ情報を表示',
  },
  sensors: {
    title: 'カメラ', collapse: '折りたたむ', expand: '展開', source: '入力元', sourceExif: 'EXIF', sourceImported: '読み込み済み',
    dimensions: '画像サイズ', focal: '焦点距離', principal: '主点', lens: 'レンズ', none: '—',
    count: '{n, plural, other {# 枚}}：クリックして画像一覧で選択', countNone: 'このカメラ設定を使う画像はありません',
    dimensionsValue: '{w, number} × {h, number}', focalValue: '{v, number, ::@##} {unit}', principalValue: '{x, number, ::.#}, {y, number, ::.#}',
    menu: { info: '情報を表示', selectImages: '画像を選択', split: 'カメラグループを分割…', mergeInto: '統合先', remove: 'カメラを削除' },
  },
}
