import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const BONE_DEFS = [
  ['hip','腰',null], ['supine','胴の付け根','hip'], ['chest','胸','supine'],
  ['neck','首','chest'], ['head','頭','neck'],
  ['LeftShoulder','左肩','chest'], ['LeftUpperArm','左上腕','LeftShoulder'],
  ['LeftElbow','左ひじ','LeftUpperArm'], ['LeftWrist','左手首','LeftElbow'],
  ['RightShoulder','右肩','chest'], ['RightUpperArm','右上腕','RightShoulder'],
  ['RightElbow','右ひじ','RightUpperArm'], ['RightWrist','右手首','RightElbow'],
  ['LeftUpperLeg','左脚','hip'], ['LeftKnee','左ひざ','LeftUpperLeg'], ['LeftAnkle','左足首','LeftKnee'],
  ['RightUpperLeg','右脚','hip'], ['RightKnee','右ひざ','RightUpperLeg'], ['RightAnkle','右足首','RightKnee']
].map(([name,label,parent]) => ({ name,label,parent,position:null,surfacePoint:null,surfaceNormal:null,bone:null,marker:null }));
const TEMPLATE_BONES = BONE_DEFS.map(bone => ({ ...bone }));


const viewport = document.querySelector('#viewport');
const statusBox = document.querySelector('#status');
const fileInput = document.querySelector('#model-files');
const boneList = document.querySelector('#bone-list');
const placeButton = document.querySelector('#place-toggle');
const autoButton = document.querySelector('#auto-place');
const generateButton = document.querySelector('#generate');
const exportButton = document.querySelector('#export');
const aiDesktopRigButton = document.querySelector('#ai-auto-rig-desktop');
const aiMobileRigButton = document.querySelector('#ai-auto-rig-mobile');
const aiRigButtons = [aiDesktopRigButton,aiMobileRigButton];
const IS_MOBILE_DEVICE=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  ||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const viewHelp = document.querySelector('#view-help');
const boneDepth = document.querySelector('#bone-depth');
const boneDepthValue = document.querySelector('#bone-depth-value');
const protectedBoneSelect = document.querySelector('#protected-bone');
const regionWeightMode = document.querySelector('#region-weight-mode');
const protectBrush = document.querySelector('#protect-brush');
const protectBrushValue = document.querySelector('#protect-brush-value');
const protectToggle = document.querySelector('#protect-toggle');
const clearProtectedButton = document.querySelector('#clear-protected');
const regionToggle = document.querySelector('#region-toggle');
const regionModeSelect = document.querySelector('#region-mode');
const regionDetectButton = document.querySelector('#region-detect');
const regionAxisInputs = Array.from(document.querySelectorAll('[data-region-axis]'));

const scene = new THREE.Scene();
scene.background = new THREE.Color('#121a27');
const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 10000);
camera.position.set(0, 1.5, 4);
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia('(max-width:760px)').matches?1.5:2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xddeaff, 0x323846, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);
const grid = new THREE.GridHelper(10, 20, 0x61728a, 0x344052);
grid.position.y = -0.002;
scene.add(grid);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1, 0);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const markerGroup = new THREE.Group();
scene.add(markerGroup);
const protectedOverlayGroup = new THREE.Group();
scene.add(protectedOverlayGroup);
const regionTransform = new TransformControls(camera, renderer.domElement);
regionTransform.setSpace('local');
regionTransform.setSize(0.8);
scene.add(regionTransform.getHelper());

let modelRoot = null;
let modelEntries = [];
let releaseModelResources = null;
let generatedRig = null;
let activeBoneName = BONE_DEFS[0].name;
let placeMode = false;
let rigLines = null;
let sourceName = 'avatar';
let pointerStart = null;
let rigMode = 'template';
let aiSessions = null;
let mobilePoseTaskPromise = null;
let protectMode = false;
let protectedVertices = new Map();
let lastPaintKey = null;
let lastPaintAt = 0;
let regionObject = null;
let regionModelBounds = null;

function setStatus(message) { statusBox.textContent = message; }
function boneByName(name) { return BONE_DEFS.find(b => b.name === name); }
function localPoint(worldPoint) { return modelRoot.worldToLocal(worldPoint.clone()); }
function restoreTemplateBoneDefs() {
  BONE_DEFS.splice(0,BONE_DEFS.length,...TEMPLATE_BONES.map(bone=>({
    ...bone,position:null,surfacePoint:null,surfaceNormal:null,bone:null,marker:null
  })));
  activeBoneName=BONE_DEFS[0]?.name||'';
  rigMode='template';
  renderBoneList();
}
function resize() {
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
new ResizeObserver(resize).observe(viewport);
resize();

function renderBoneList() {
  boneList.replaceChildren();
  for (const bone of BONE_DEFS) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `bone-item${bone.name === activeBoneName ? ' active' : ''}${bone.position ? ' done' : ''}`;
    row.innerHTML = `<span class="dot"></span><span>${bone.label}</span>`;
    row.title = bone.name;
    row.addEventListener('click', () => {
      activeBoneName = bone.name;
      renderBoneList();
      setStatus(`${bone.label}を選択中。配置モードをONにして、モデル上の位置をタップしてください。`);
    });
    boneList.append(row);
  }
  refreshProtectedBoneOptions();
}

function refreshProtectedBoneOptions() {
  if (!protectedBoneSelect) return;
  const previous=protectedBoneSelect.value;
  protectedBoneSelect.replaceChildren();
  for(const bone of BONE_DEFS){
    const option=document.createElement('option');option.value=bone.name;option.textContent=bone.label;protectedBoneSelect.append(option);
  }
  const preferred=rigMode==='template'?'head':BONE_DEFS.reduce((highest,bone)=>!highest||bone.position?.y>highest.position?.y?bone:highest,null)?.name;
  protectedBoneSelect.value=BONE_DEFS.some(bone=>bone.name===previous)?previous:(preferred||'');
  const ready=Boolean(modelRoot&&BONE_DEFS.some(bone=>bone.position));
  protectedBoneSelect.disabled=!ready;protectBrush.disabled=!modelRoot;protectToggle.disabled=!ready;clearProtectedButton.disabled=![...protectedVertices.values()].some(assignments=>assignments.size>0);
}
renderBoneList();

function setRigEditingEnabled(enabled) {
  placeButton.disabled = !enabled;
  autoButton.disabled = !enabled;
  regionToggle.disabled = !enabled;
  regionDetectButton.disabled = !enabled;
  for(const input of regionAxisInputs)input.disabled=!enabled;
}

function revokeOldModel() {
  placeMode = false;
  protectMode = false;
  protectedVertices = new Map();
  controls.enabled = true;
  regionTransform.detach();
  regionObject = null;
  regionModelBounds = null;
  regionToggle.textContent = '範囲ボックスを表示';
  placeButton.textContent = '位置を置く：OFF';
  protectToggle.textContent = '固定領域を塗る：OFF';
  if (modelRoot) {
    scene.remove(modelRoot);
    modelRoot.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else if (object.material) object.material.dispose();
    });
  }
  releaseModelResources?.();
  releaseModelResources = null;
  markerGroup.clear();
  for(const child of [...protectedOverlayGroup.children]){protectedOverlayGroup.remove(child);child.geometry?.dispose();child.material?.dispose();}
  if (rigLines) { scene.remove(rigLines); rigLines.geometry.dispose(); rigLines.material.dispose(); rigLines = null; }
  modelRoot = null;
  modelEntries = [];
  generatedRig = null;
  restoreTemplateBoneDefs();
  exportButton.disabled = true;
  setRigEditingEnabled(false);
  renderBoneList();
}

function resourceManager(files) {
  const manager = new THREE.LoadingManager();
  const byPath = new Map();
  const byBaseName = new Map();
  const ambiguousBaseNames = new Set();
  const normalize = value => {
    let path = String(value || '').split(/[?#]/,1)[0].replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+/, '');
    try { path = decodeURIComponent(path); } catch {}
    return path.toLowerCase();
  };
  for (const file of files) {
    const paths = [file.name, file.webkitRelativePath].filter(Boolean);
    for (const path of paths) byPath.set(normalize(path), file);
    const base = normalize(file.name.split(/[\\/]/).pop());
    if (byBaseName.has(base) && byBaseName.get(base) !== file) ambiguousBaseNames.add(base);
    else byBaseName.set(base, file);
  }
  const objectUrls = [];
  manager.setURLModifier(url => {
    const normalized = normalize(url);
    const base = normalized.split('/').pop();
    const file = byPath.get(normalized) || (!ambiguousBaseNames.has(base) ? byBaseName.get(base) : null);
    if (!file) return url;
    const blobUrl = URL.createObjectURL(file);
    objectUrls.push(blobUrl);
    return blobUrl;
  });
  return { manager, release: () => objectUrls.forEach(URL.revokeObjectURL) };
}

function findObjMaterialFile(objText, objFile, files) {
  const normalize = value => {
    let path = String(value || '').replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+/, '');
    try { path = decodeURIComponent(path); } catch {}
    return path.toLowerCase();
  };
  const candidates = [];
  for (const match of objText.matchAll(/^\s*mtllib\s+(.+?)\s*$/gim)) {
    const ref = match[1].trim();
    if (ref) candidates.push(ref);
  }
  const objBase = objFile.name.replace(/\.[^.]+$/, '');
  const sibling = files.find(file => file.name.toLowerCase() === `${objBase}.mtl`.toLowerCase());
  const basenameMatch = ref => files.find(file => file.name.toLowerCase() === ref.replace(/\\/g,'/').split('/').pop().toLowerCase());
  const byReference = candidates.map(ref =>
    files.find(file => normalize(file.name) === normalize(ref) || normalize(file.webkitRelativePath) === normalize(ref))
      || basenameMatch(ref)
  ).find(Boolean);
  if (sibling && !candidates.length) candidates.push(sibling.name);
  const wanted = new Set(candidates.map(normalize));
  const match = files.find(file => wanted.has(normalize(file.name)) || wanted.has(normalize(file.webkitRelativePath)));
  return { file: byReference || match || sibling || null, referenced: candidates.length > 0 };
}

async function loadModel(files) {
  if (!files.length) return;
  revokeOldModel();
  const main = files.find(file => /\.(glb|gltf|obj)$/i.test(file.name));
  if (!main) { setStatus('GLB、glTF、OBJファイルを選択してください。'); return; }
  sourceName = main.name.replace(/\.[^.]+$/, '') || 'avatar';
  setStatus(`${main.name}を読み込んでいます…`);
  try {
    let root;
    let loadNote = '';
    if (/\.obj$/i.test(main.name)) {
      const resources = resourceManager(files);
      releaseModelResources = resources.release;
      const objText = await main.text();
      const { file: mtlFile, referenced } = findObjMaterialFile(objText, main, files);
      const objLoader = new OBJLoader(resources.manager);
      if (mtlFile) {
        const materials = new MTLLoader(resources.manager).parse(await mtlFile.text(), '');
        materials.preload();
        objLoader.setMaterials(materials);
        loadNote = ` MTL「${mtlFile.name}」を適用しました。テクスチャの読み込み完了後にGLBへ保存してください。`;
      } else if (referenced) {
        loadNote = ' OBJが参照するMTLが選択されていません。OBJ・MTL・画像テクスチャをまとめて選び直すと色を復元できます。';
      } else {
        loadNote = ' MTL参照がありません。色・模様を付けるにはBlenderからMTLとテクスチャも一緒に書き出してください。';
      }
      root = objLoader.parse(objText);
    } else {
      const resources = resourceManager(files);
      const loader = new GLTFLoader(resources.manager);
      const gltf = await loader.parseAsync(await main.arrayBuffer(), '');
      root = gltf.scene;
      resources.release();
    }
    root.name = 'ImportedModel';
    const skinned = [];
    root.traverse(object => { if (object.isSkinnedMesh) skinned.push(object.name || '名前なしMesh'); });
    if (skinned.length) {
      setStatus(`このモデルには既存ボーンがあります（${skinned.slice(0,3).join('、')}）。この編集画面は、まだボーンのない静的メッシュを対象にしています。Blender等でボーンを外したGLB/OBJを選んでください。`);
      root.traverse(object => { if (object.geometry) object.geometry.dispose(); });
      releaseModelResources?.();
      releaseModelResources = null;
      return;
    }
    modelRoot = root;
    scene.add(modelRoot);
    modelRoot.updateMatrixWorld(true);
    modelEntries = [];
    modelRoot.traverse(object => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;
      modelEntries.push({ mesh:object, geometry:object.geometry, material:object.material });
    });
    if (!modelEntries.length) throw new Error('表示できるMeshが見つかりません。');
    modelRoot.updateMatrixWorld(true);
    const inverseRoot=modelRoot.matrixWorld.clone().invert();
    for(const entry of modelEntries){
      const meshToRoot=inverseRoot.clone().multiply(entry.mesh.matrixWorld);
      const normalToRoot=new THREE.Matrix3().getNormalMatrix(meshToRoot);
      const sourcePositions=entry.geometry.attributes.position,sourceNormals=entry.geometry.attributes.normal;
      entry.rootPositions=new Float32Array(sourcePositions.count*3);
      entry.rootNormals=sourceNormals?new Float32Array(sourceNormals.count*3):null;
      for(let i=0;i<sourcePositions.count;i++){
        const p=new THREE.Vector3().fromBufferAttribute(sourcePositions,i).applyMatrix4(meshToRoot);
        entry.rootPositions.set(p.toArray(),i*3);
        if(sourceNormals){const n=new THREE.Vector3().fromBufferAttribute(sourceNormals,i).applyMatrix3(normalToRoot).normalize();entry.rootNormals.set(n.toArray(),i*3);}
      }
    }
    createRegionBox();
    fitCamera();
    setRigEditingEnabled(true);
    if (document.querySelector('#auto-rig').checked) placeStandardRig();
    viewHelp.textContent = '関節を選択し「位置を置く」をONにして、モデル上の関節中心をタップします。';
    setStatus(`${main.name}を読み込みました。${modelEntries.length}個のMeshが見つかりました。関節位置を確認してください。${loadNote}`);
  } catch (error) {
    console.error(error);
    revokeOldModel();
    setStatus(`読み込みに失敗しました: ${error.message || error}`);
  }
}

function modelLocalBounds() {
  modelRoot.updateMatrixWorld(true);
  const inverseRoot = modelRoot.matrixWorld.clone().invert();
  const localBox = new THREE.Box3().makeEmpty();
  for(const entry of modelEntries){
    if(!entry.geometry.boundingBox)entry.geometry.computeBoundingBox();
    const meshToRoot=inverseRoot.clone().multiply(entry.mesh.matrixWorld);
    localBox.union(entry.geometry.boundingBox.clone().applyMatrix4(meshToRoot));
  }
  return localBox;
}

function createRegionBox(){
  if(regionObject?.parent)regionObject.parent.remove(regionObject);
  regionTransform.detach();
  const bounds=modelLocalBounds(),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  regionModelBounds=bounds.clone();
  const minSize=Math.max(size.length()*0.025,0.01);
  const boxHeight=Math.max(size.y*0.22,minSize),boxWidth=Math.max(size.x*0.42,minSize),boxDepth=Math.max(size.z*0.42,minSize);
  regionObject=new THREE.Group();regionObject.name='__HeadRegionSelectionBox';
  regionObject.position.set(center.x,bounds.max.y-boxHeight/2,center.z);
  regionObject.scale.set(boxWidth,boxHeight,boxDepth);
  const volume=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),new THREE.LineBasicMaterial({color:0x55d6f4,transparent:true,opacity:0.95,depthTest:false}));
  volume.name='__HeadRegionSelectionVolume';volume.renderOrder=30;regionObject.add(volume);
  modelRoot.add(regionObject);regionObject.visible=false;modelRoot.updateMatrixWorld(true);
  regionTransform.setMode(regionModeSelect.value);
  syncRegionSliders();
}

function syncRegionSliders(){
  if(!regionObject||!regionModelBounds)return;
  const size=regionModelBounds.getSize(new THREE.Vector3());
  for(const axis of ['x','y','z']){
    const extent=Math.max(size[axis],1e-6);
    const centerInput=document.querySelector(`[data-region-axis="center-${axis}"]`);
    const sizeInput=document.querySelector(`[data-region-axis="size-${axis}"]`);
    centerInput.value=String(THREE.MathUtils.clamp((regionObject.position[axis]-regionModelBounds.min[axis])/extent*100,0,100));
    sizeInput.value=String(THREE.MathUtils.clamp(regionObject.scale[axis]/extent*100,1,100));
    document.querySelector(`[data-region-output="center-${axis}"]`).textContent=`${Math.round(Number(centerInput.value))}%`;
    document.querySelector(`[data-region-output="size-${axis}"]`).textContent=`${Math.round(Number(sizeInput.value))}%`;
  }
}

function updateRegionFromSliders(){
  if(!regionObject||!regionModelBounds)return;
  if(!regionObject.visible)setRegionVisible(true);
  const size=regionModelBounds.getSize(new THREE.Vector3());
  for(const axis of ['x','y','z']){
    const extent=Math.max(size[axis],1e-6);
    const centerInput=document.querySelector(`[data-region-axis="center-${axis}"]`);
    const sizeInput=document.querySelector(`[data-region-axis="size-${axis}"]`);
    regionObject.position[axis]=regionModelBounds.min[axis]+extent*Number(centerInput.value)/100;
    regionObject.scale[axis]=Math.max(extent*Number(sizeInput.value)/100,extent*0.01);
    document.querySelector(`[data-region-output="center-${axis}"]`).textContent=`${Math.round(Number(centerInput.value))}%`;
    document.querySelector(`[data-region-output="size-${axis}"]`).textContent=`${Math.round(Number(sizeInput.value))}%`;
  }
  modelRoot.updateMatrixWorld(true);
  setStatus('範囲をスライダーで調整中です。紫色の選択は保持されます。新しい範囲を割り当てるときはボタンを押してください。');
}

for(const input of regionAxisInputs)input.addEventListener('input',updateRegionFromSliders);

function setRegionVisible(visible){
  if(!regionObject||!modelRoot)return;
  regionObject.visible=visible;
  if(visible){regionTransform.attach(regionObject);regionTransform.setMode(regionModeSelect.value);regionToggle.textContent='範囲ボックスを隠す';}
  else{regionTransform.detach();regionToggle.textContent='範囲ボックスを表示';}
}

function detectVerticesInRegion(){
  if(!regionObject||!modelRoot)return;
  const boneName=protectedBoneSelect.value,strength=Number(regionWeightMode.value);
  if(!boneName){setStatus('先に割り当て先のボーンを選択してください。');return;}
  modelRoot.updateMatrixWorld(true);
  const center=regionObject.position,half=regionObject.scale.clone().multiplyScalar(0.5);
  const min=center.clone().sub(half),max=center.clone().add(half);
  let total=0;
  for(const entry of modelEntries){
    const additions=new Map(),assignment={boneName,strength};
    const positions=entry.rootPositions;
    for(let i=0;i<positions.length/3;i++){
      const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
      if(x>=min.x&&x<=max.x&&y>=min.y&&y<=max.y&&z>=min.z&&z<=max.z){additions.set(i,assignment);total++;}
    }
    if(additions.size){let assignments=protectedVertices.get(entry);if(!assignments){assignments=new Map();protectedVertices.set(entry,assignments);}for(const [vertex,value] of additions)assignments.set(vertex,value);updateProtectedOverlay(entry);}
  }
  refreshProtectedBoneOptions();
  const allCount=[...protectedVertices.values()].reduce((sum,map)=>sum+map.size,0);
  setStatus(total?`範囲内の${total.toLocaleString()}頂点を「${protectedBoneSelect.selectedOptions[0]?.textContent}」へ${Math.round(strength*100)}%割り当てました。選択部位は紫色です。ほかの部位も箱を移して追加できます（計${allCount.toLocaleString()}頂点）。`:'箱の中に頂点がありません。箱の位置や大きさを調整してください。');
}

regionToggle.addEventListener('click',()=>setRegionVisible(!regionObject?.visible));
regionModeSelect.addEventListener('change',()=>{regionTransform.setMode(regionModeSelect.value);});
regionDetectButton.addEventListener('click',detectVerticesInRegion);
regionTransform.addEventListener('mouseDown',()=>{controls.enabled=false;});
regionTransform.addEventListener('mouseUp',()=>{controls.enabled=!placeMode&&!protectMode;});
regionTransform.addEventListener('objectChange',()=>{
  if(!regionObject)return;
  const minSize=Math.max(modelLocalBounds().getSize(new THREE.Vector3()).length()*0.01,0.005);
  regionObject.scale.set(Math.max(Math.abs(regionObject.scale.x),minSize),Math.max(Math.abs(regionObject.scale.y),minSize),Math.max(Math.abs(regionObject.scale.z),minSize));
  syncRegionSliders();
  setStatus('範囲箱を調整中です。既に割り当てた部位は保持されます。別の部位を追加するには箱の中の頂点を選択してください。');
});

function fitCamera() {
  modelRoot.updateMatrixWorld(true);
  const box = modelLocalBounds().applyMatrix4(modelRoot.matrixWorld);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x,size.y,size.z,0.1);
  const distance = maxSize * 1.9;
  camera.position.set(center.x + distance*0.25, center.y + distance*0.12, center.z + distance*1.5);
  camera.near = maxSize / 1000;
  camera.far = maxSize * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
  grid.scale.setScalar(Math.max(0.2,maxSize/5));
}

function placeStandardRig() {
  if (!modelRoot) return;
  const box = modelLocalBounds();
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const h = Math.max(size.y,0.001), w = Math.max(size.x,0.001);
  const y = ratio => box.min.y + h*ratio;
  const x = ratio => center.x + w*ratio;
  const at = (name, px, py, pz= center.z) => {
    const bone=boneByName(name);
    bone.position=new THREE.Vector3(px,py,pz);
    bone.surfacePoint=null;bone.surfaceNormal=null;
  };
  at('hip',center.x,y(.48)); at('supine',center.x,y(.61)); at('chest',center.x,y(.73)); at('neck',center.x,y(.85)); at('head',center.x,y(.94));
  for (const [side,prefix] of [[1,'Left'],[-1,'Right']]) {
    at(prefix+'Shoulder',x(side*.17),y(.77));
    at(prefix+'UpperArm',x(side*.28),y(.74));
    at(prefix+'Elbow',x(side*.39),y(.71));
    at(prefix+'Wrist',x(side*.49),y(.68));
    at(prefix+'UpperLeg',x(side*.09),y(.45));
    at(prefix+'Knee',x(side*.10),y(.25));
    at(prefix+'Ankle',x(side*.10),y(.06));
  }
  updateMarkers();
  renderBoneList();
  setStatus('標準位置を仮配置しました。特に肩・ひじ・手首、ひざ・足首をモデルに合わせて置き直してください。');
}

function updateMarkers() {
  if (!modelRoot) return;
  for (const child of markerGroup.children) {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach(material=>material.dispose());
    else child.material?.dispose();
  }
  markerGroup.clear();
  const points = [];
  const color = 0x58d8f4;
  const markerRadius = Math.max(modelLocalBounds().getSize(new THREE.Vector3()).length()*0.009,0.008);
  for (const bone of BONE_DEFS) {
    if (!bone.position) continue;
    const world = modelRoot.localToWorld(bone.position.clone());
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(markerRadius,12,8),
      new THREE.MeshBasicMaterial({ color, depthTest:false })
    );
    sphere.position.copy(world);
    sphere.renderOrder = 10;
    markerGroup.add(sphere);
    bone.marker = sphere;
    points.push(world);
  }
  if (rigLines) { scene.remove(rigLines); rigLines.geometry.dispose(); rigLines.material.dispose(); rigLines = null; }
  const linePositions = [];
  for (const bone of BONE_DEFS) {
    if (!bone.position || !bone.parent) continue;
    const parent = boneByName(bone.parent);
    if (!parent.position) continue;
    linePositions.push(...modelRoot.localToWorld(parent.position.clone()).toArray(), ...modelRoot.localToWorld(bone.position.clone()).toArray());
  }
  if (linePositions.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));
    rigLines = new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x66d9f5,depthTest:false}));
    rigLines.renderOrder = 9;
    scene.add(rigLines);
  }
}

function pickSurface(clientX,clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((clientX-rect.left)/rect.width)*2-1, -((clientY-rect.top)/rect.height)*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hits = raycaster.intersectObjects(modelEntries.map(entry => entry.generated || entry.mesh),true);
  return hits.length ? hits[0] : null;
}

function updateProtectedOverlay(entry) {
  const previous=entry.protectedOverlay;
  if(previous){protectedOverlayGroup.remove(previous);previous.geometry.dispose();previous.material.dispose();entry.protectedOverlay=null;}
  const assignments=protectedVertices.get(entry);
  if(!assignments?.size)return;
  modelRoot.updateMatrixWorld(true);
  const positions=[];
  for(const index of assignments.keys()){const vertex=new THREE.Vector3().fromBufferAttribute(entry.geometry.attributes.position,index);positions.push(...entry.mesh.localToWorld(vertex).toArray());}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const size=Math.max(modelLocalBounds().getSize(new THREE.Vector3()).length()*0.012,0.01);
  const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xff4edb,size,sizeAttenuation:true,depthTest:false}));points.renderOrder=20;protectedOverlayGroup.add(points);entry.protectedOverlay=points;
}

function paintProtectedSurface(clientX,clientY) {
  const hit=pickSurface(clientX,clientY);if(!hit)return false;
  const entry=modelEntries.find(item=>item.mesh===hit.object||item.generated===hit.object);if(!entry)return false;
  const pickedBone=protectedBoneSelect.value;if(!pickedBone)return false;
  const radius=Math.max(modelLocalBounds().getSize(new THREE.Vector3()).length()*Number(protectBrush.value)/100,1e-5);
  const center=modelRoot.worldToLocal(hit.point.clone());
  const hitNormal=hit.face?hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)):new THREE.Vector3(0,0,1);
  hitNormal.applyMatrix3(new THREE.Matrix3().getNormalMatrix(modelRoot.matrixWorld.clone().invert())).normalize();
  const positions=entry.rootPositions,normals=entry.rootNormals;
  let assignments=protectedVertices.get(entry);if(!assignments){assignments=new Map();protectedVertices.set(entry,assignments);}
  const pickedAssignment={boneName:pickedBone,strength:Number(regionWeightMode.value)};let changed=false;
  for(let i=0;i<positions.length/3;i++){
    const dx=positions[i*3]-center.x,dy=positions[i*3+1]-center.y,dz=positions[i*3+2]-center.z;
    if(dx*dx+dy*dy+dz*dz>radius*radius)continue;
    if(normals&&normals[i*3]*hitNormal.x+normals[i*3+1]*hitNormal.y+normals[i*3+2]*hitNormal.z<0.2)continue;
    const existing=assignments.get(i);
    if(existing?.boneName!==pickedAssignment.boneName||existing?.strength!==pickedAssignment.strength){assignments.set(i,pickedAssignment);changed=true;}
  }
  if(!changed)return false;
  updateProtectedOverlay(entry);refreshProtectedBoneOptions();
  const total=[...protectedVertices.values()].reduce((sum,map)=>sum+map.size,0);
  setStatus(`${boneByName(pickedBone)?.label||pickedBone}へ割り当てる頂点を選択中：${total.toLocaleString()}個。紫色の点を確認してください。`);
  return true;
}

function setProtectMode(enabled) {
  protectMode=enabled;lastPaintKey=null;lastPaintAt=0;
  if(enabled&&placeMode){placeMode=false;placeButton.textContent='位置を置く：OFF';placeButton.style.background='';}
  if(enabled&&regionObject?.visible)setRegionVisible(false);
  controls.enabled=!enabled&&!placeMode;
  protectToggle.textContent=`固定領域を塗る：${enabled?'ON':'OFF'}`;
  protectToggle.style.background=enabled?'#79421e':'';
  viewHelp.textContent=enabled?'角・髪などをドラッグして塗ります。塗った部分は選択ボーンに100%固定されます。':'ドラッグで視点を回転できます。';
  pointerStart=null;
}

protectToggle.addEventListener('click',()=>setProtectMode(!protectMode));
protectedBoneSelect.addEventListener('change',()=>setStatus(`${protectedBoneSelect.selectedOptions[0]?.textContent||'選択ボーン'}へ、次に塗る頂点を固定します。`));
protectBrush.addEventListener('input',()=>protectBrushValue.textContent=`${Number(protectBrush.value).toFixed(1)}%`);
clearProtectedButton.addEventListener('click',()=>{protectedVertices.clear();for(const entry of modelEntries)updateProtectedOverlay(entry);refreshProtectedBoneOptions();setStatus('部位ごとのウェイト指定をすべて消しました。');});

function positionInsideFromSurface(bone) {
  if(!bone.surfacePoint||!bone.surfaceNormal)return;
  const worldHeight=modelLocalBounds().getSize(new THREE.Vector3()).y*modelRoot.getWorldScale(new THREE.Vector3()).y;
  const depth=worldHeight*(Number(boneDepth.value)/100);
  const point=bone.surfacePoint.clone().addScaledVector(bone.surfaceNormal,-depth);
  bone.position=localPoint(point);
}

renderer.domElement.addEventListener('pointerdown',event => { pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};lastPaintKey=null;lastPaintAt=0;if(protectMode)renderer.domElement.setPointerCapture(event.pointerId); });
renderer.domElement.addEventListener('pointermove',event=>{
  if(!protectMode||!pointerStart||pointerStart.id!==event.pointerId)return;
  if(performance.now()-lastPaintAt<40)return;
  lastPaintAt=performance.now();
  const hit=pickSurface(event.clientX,event.clientY);if(!hit)return;
  const key=`${hit.object.uuid}:${hit.faceIndex}`;if(key===lastPaintKey)return;
  lastPaintKey=key;paintProtectedSurface(event.clientX,event.clientY);
});
renderer.domElement.addEventListener('pointerup',event => {
  if (!pointerStart || pointerStart.id !== event.pointerId) return;
  const distance=Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y);
  pointerStart=null;
  if(protectMode){if(distance<=8)paintProtectedSurface(event.clientX,event.clientY);return;}
  if(!placeMode)return;
  if (distance>8) return;
  const hit=pickSurface(event.clientX,event.clientY);
  if (!hit) { setStatus('モデル表面をタップしてください。'); return; }
  const bone=boneByName(activeBoneName);
  bone.surfacePoint=hit.point.clone();
  bone.surfaceNormal=hit.face
    ? hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize()
    : camera.getWorldDirection(new THREE.Vector3()).negate();
  positionInsideFromSurface(bone);
  updateMarkers(); renderBoneList();
  const active=BONE_DEFS.findIndex(b=>b.name===activeBoneName);
  const next=BONE_DEFS.slice(active+1).find(b=>!b.position);
  if(next) activeBoneName=next.name;
  renderBoneList();
  const label=boneByName(activeBoneName).label;
  setStatus(`${boneByName(BONE_DEFS[active].name).label}を表面から内側へ配置しました。深さはスライダーで調整できます。次は${label}を選択中です。`);
});

boneDepth.addEventListener('input',()=>{
  boneDepthValue.textContent=`${Number(boneDepth.value)}%`;
  const bone=boneByName(activeBoneName);
  if(bone?.surfacePoint){positionInsideFromSurface(bone);updateMarkers();}
});

placeButton.addEventListener('click',()=>{
  placeMode=!placeMode;
  if(placeMode&&protectMode)setProtectMode(false);
  placeButton.textContent=`位置を置く：${placeMode?'ON':'OFF'}`;
  placeButton.style.background=placeMode?'#176b75':'';
  controls.enabled=!placeMode;
  viewHelp.textContent=placeMode?'選択中の関節の中心をモデル表面でタップ。配置後は次の未配置関節へ進みます。':'ドラッグで視点を回転できます。';
});
autoButton.addEventListener('click',()=>{
  restoreTemplateBoneDefs();
  autoButton.textContent='標準19関節に戻す';
  placeStandardRig();
});
fileInput.addEventListener('change',event=>loadModel(Array.from(event.target.files||[])));

async function makeSurfaceDiffusionGraph(geometry, positions, vertexCount) {
  const rows=new Array(vertexCount);
  for(let v=0;v<vertexCount;v++){
    rows[v]=new Map();
    if(v>0&&v%4096===0)await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  const index=geometry.index?.array;
  const count=index?index.length:vertexCount;
  const at=i=>index?index[i]:i;
  const add=(a,b,weight)=>{
    if(a===b||!Number.isFinite(weight)||weight<=0)return;
    rows[a].set(b,(rows[a].get(b)||0)+weight);
  };
  const cotangent=(ax,ay,az,bx,by,bz,cx,cy,cz)=>{
    const ux=ax-cx,uy=ay-cy,uz=az-cz,vx=bx-cx,vy=by-cy,vz=bz-cz;
    const dot=ux*vx+uy*vy+uz*vz;
    const cxv=uy*vz-uz*vy,cyv=uz*vx-ux*vz,czv=ux*vy-uy*vx;
    const area=Math.hypot(cxv,cyv,czv);
    return area>1e-12?Math.max(0,dot/area):0;
  };
  const stableCotangent=(...points)=>cotangent(...points)+0.001;
  for(let i=0;i+2<count;i+=3){
    const a=at(i),b=at(i+1),c=at(i+2);
    const ax=positions[a*3],ay=positions[a*3+1],az=positions[a*3+2];
    const bx=positions[b*3],by=positions[b*3+1],bz=positions[b*3+2];
    const cx=positions[c*3],cy=positions[c*3+1],cz=positions[c*3+2];
    // Cotangent edge weights approximate the mesh-surface Laplacian used by
    // bone-heat methods. Clamp negative cotangents for stable browser diffusion.
    add(a,b,stableCotangent(ax,ay,az,bx,by,bz,cx,cy,cz));
    add(b,a,stableCotangent(ax,ay,az,bx,by,bz,cx,cy,cz));
    add(b,c,stableCotangent(bx,by,bz,cx,cy,cz,ax,ay,az));
    add(c,b,stableCotangent(bx,by,bz,cx,cy,cz,ax,ay,az));
    add(c,a,stableCotangent(cx,cy,cz,ax,ay,az,bx,by,bz));
    add(a,c,stableCotangent(cx,cy,cz,ax,ay,az,bx,by,bz));
    if(i>0&&i%36864===0){
      setStatus(`メッシュ表面の拡散準備中… ${Math.floor(i/count*100)}%`);
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
  }
  const neighbors=new Array(vertexCount),weights=new Array(vertexCount);
  for(let v=0;v<vertexCount;v++){
    const row=rows[v];
    if(!row.size){neighbors[v]=[];weights[v]=new Float32Array(0);continue;}
    let total=0;for(const value of row.values())total+=value;
    const ids=Array.from(row.keys()),normalized=new Float32Array(ids.length);
    if(total<=1e-12)normalized.fill(1/ids.length);
    else for(let i=0;i<ids.length;i++)normalized[i]=row.get(ids[i])/total;
    neighbors[v]=ids;weights[v]=normalized;
    if(v>0&&v%4096===0)await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  const componentIds=new Int32Array(vertexCount);componentIds.fill(-1);
  const componentCenters=[],queue=new Int32Array(vertexCount);
  let componentCount=0,visited=0;
  for(let start=0;start<vertexCount;start++){
    if(componentIds[start]>=0)continue;
    let head=0,tail=0,sx=0,sy=0,sz=0;
    queue[tail++]=start;componentIds[start]=componentCount;
    while(head<tail){
      const vertex=queue[head++];sx+=positions[vertex*3];sy+=positions[vertex*3+1];sz+=positions[vertex*3+2];
      for(const neighbor of neighbors[vertex])if(componentIds[neighbor]<0){componentIds[neighbor]=componentCount;queue[tail++]=neighbor;}
      if(++visited%4096===0)await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    componentCenters.push(new THREE.Vector3(sx/tail,sy/tail,sz/tail));componentCount++;
  }
  return {neighbors,weights,componentIds,componentCenters};
}

function classifyArmSurfaceComponents(graph,segments,positions,bounds,rootSize){
  const flags=new Uint8Array(graph.componentCenters.length);
  if(!graph.componentCenters.length)return flags;
  const center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3());
  const armSegments=segments.filter(segment=>segment.isArmInfluence);
  const coreSegments=segments.filter(segment=>segment.isCore);
  if(!armSegments.length)return flags;
  const minY=new Float32Array(flags.length),maxY=new Float32Array(flags.length);
  minY.fill(Infinity);maxY.fill(-Infinity);
  const distanceToSegment=(px,py,pz,segment)=>{
    const dx=px-segment.ax,dy=py-segment.ay,dz=pz-segment.az;
    const t=segment.lengthSq>1e-12?THREE.MathUtils.clamp((dx*segment.abx+dy*segment.aby+dz*segment.abz)/segment.lengthSq,0,1):0;
    return Math.hypot(px-(segment.ax+segment.abx*t),py-(segment.ay+segment.aby*t),pz-(segment.az+segment.abz*t));
  };
  for(let vertex=0;vertex<graph.componentIds.length;vertex++){
    const component=graph.componentIds[vertex],px=positions[vertex*3],py=positions[vertex*3+1],pz=positions[vertex*3+2];
    minY[component]=Math.min(minY[component],py);maxY[component]=Math.max(maxY[component],py);
  }
  for(let component=0;component<graph.componentCenters.length;component++){
    const componentCenter=graph.componentCenters[component];
    const lateral=Math.abs(componentCenter.x-center.x);
    const verticalOverlap=maxY[component]>=bounds.min.y+extent.y*0.36&&minY[component]<=bounds.min.y+extent.y*0.9;
    if(lateral<Math.max(extent.x*0.12,rootSize*0.035)||!verticalOverlap)continue;
    let centerArmDistance=Infinity,centerCoreDistance=Infinity;
    for(const segment of armSegments)centerArmDistance=Math.min(centerArmDistance,distanceToSegment(componentCenter.x,componentCenter.y,componentCenter.z,segment));
    for(const segment of coreSegments)centerCoreDistance=Math.min(centerCoreDistance,distanceToSegment(componentCenter.x,componentCenter.y,componentCenter.z,segment));
    if(centerArmDistance<=rootSize*0.12&&centerArmDistance<=centerCoreDistance+rootSize*0.02)flags[component]=1;
  }
  return flags;
}

function coincidentVertexGroups(positions, scale) {
  const vertexCount=positions.length/3,tolerance=Math.max(1e-6,scale*1e-5), toleranceSq=tolerance*tolerance;
  const cells=new Map(), parent=Array.from({length:vertexCount},(_,i)=>i);
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const key=(x,y,z)=>`${x},${y},${z}`;
  for(let i=0;i<vertexCount;i++){
    const px=positions[i*3],py=positions[i*3+1],pz=positions[i*3+2];
    const cx=Math.floor(px/tolerance),cy=Math.floor(py/tolerance),cz=Math.floor(pz/tolerance);
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      const list=cells.get(key(cx+x,cy+y,cz+z));if(!list)continue;
      for(const j of list){const dx=px-positions[j*3],dy=py-positions[j*3+1],dz=pz-positions[j*3+2];if(dx*dx+dy*dy+dz*dz<=toleranceSq){let a=root(i),b=root(j);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);}}
    }
    const k=key(cx,cy,cz);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);
  }
  const groups=new Map();
  for(let i=0;i<vertexCount;i++){const r=root(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
  return Array.from(groups.values()).filter(group=>group.length>1);
}

function sampleModelSurface(pointCount=16384) {
  modelRoot.updateMatrixWorld(true);
  const inverseRoot=modelRoot.matrixWorld.clone().invert();
  let triangleCount=0;
  for(const entry of modelEntries){
    const geometry=entry.geometry,position=geometry.attributes.position;
    triangleCount+=Math.floor((geometry.index?.count||position.count)/3);
  }
  if(!triangleCount)throw new Error('三角形メッシュがありません。');
  const triangleData=new Float32Array(triangleCount*12);
  const cumulativeArea=new Float64Array(triangleCount);
  let used=0,totalArea=0;
  for(const entry of modelEntries){
    const mesh=entry.mesh,geometry=entry.geometry,position=geometry.attributes.position;
    const normal=geometry.attributes.normal;
    const index=geometry.index?.array;
    const indexCount=index?index.length:position.count;
    const meshToRoot=inverseRoot.clone().multiply(mesh.matrixWorld);
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(meshToRoot);
    for(let i=0;i+2<indexCount;i+=3){
      const ia=index?index[i]:i,ib=index?index[i+1]:i+1,ic=index?index[i+2]:i+2;
      const a=new THREE.Vector3().fromBufferAttribute(position,ia).applyMatrix4(meshToRoot);
      const b=new THREE.Vector3().fromBufferAttribute(position,ib).applyMatrix4(meshToRoot);
      const c=new THREE.Vector3().fromBufferAttribute(position,ic).applyMatrix4(meshToRoot);
      const cross=b.clone().sub(a).cross(c.clone().sub(a));
      const area=cross.length()*0.5;
      if(area<=1e-12)continue;
      let na,nb,nc;
      if(normal){
        na=new THREE.Vector3().fromBufferAttribute(normal,ia).applyMatrix3(normalMatrix).normalize();
        nb=new THREE.Vector3().fromBufferAttribute(normal,ib).applyMatrix3(normalMatrix).normalize();
        nc=new THREE.Vector3().fromBufferAttribute(normal,ic).applyMatrix3(normalMatrix).normalize();
      }else{
        na=nb=nc=cross.normalize();
      }
      const offset=used*12;
      triangleData.set([...a.toArray(),...b.toArray(),...c.toArray(),...na.toArray()],offset);
      // Store the remaining vertex normals in a compact parallel block.
      totalArea+=area;cumulativeArea[used]=totalArea;
      used++;
      // The temporary fields are appended below after allocation is trimmed.
      if(!entry._aiTriangleNormals)entry._aiTriangleNormals=[];
      entry._aiTriangleNormals.push(...nb.toArray(),...nc.toArray());
    }
  }
  if(!used||totalArea<=0)throw new Error('表面をサンプリングできませんでした。');
  const data=triangleData.slice(0,used*12),areas=cumulativeArea.slice(0,used);
  // Keep normals for all three corners in a second compact array.
  const normals=new Float32Array(used*9);
  let cursor=0;
  for(const entry of modelEntries){
    const raw=entry._aiTriangleNormals||[];
    for(let i=0;i<raw.length;i+=6){
      const triIndex=cursor++;
      if(triIndex>=used)break;
      normals.set(data.subarray(triIndex*12+9,triIndex*12+12),triIndex*9);
      normals.set(raw.slice(i,i+6),triIndex*9+3);
    }
    delete entry._aiTriangleNormals;
  }
  const bounds=modelLocalBounds(),size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  const longest=Math.max(size.x,size.y,size.z,1e-6);
  const vertices=new Float32Array(pointCount*3),sampledNormals=new Float32Array(pointCount*3);
  for(let sample=0;sample<pointCount;sample++){
    const target=Math.random()*totalArea;
    let low=0,high=used-1;
    while(low<high){const mid=(low+high)>>1;if(areas[mid]<target)low=mid+1;else high=mid;}
    const tri=low,offset=tri*12,no=tri*9;
    const root=Math.sqrt(Math.random()),u=1-root,v=root*(1-Math.random()),w=1-u-v;
    for(let axis=0;axis<3;axis++){
      const coordinate=data[offset+axis]*u+data[offset+3+axis]*v+data[offset+6+axis]*w;
      vertices[sample*3+axis]=(coordinate-center.getComponent(axis))*2/longest;
      sampledNormals[sample*3+axis]=normals[no+axis]*u+normals[no+3+axis]*v+normals[no+6+axis]*w;
    }
    const n=new THREE.Vector3(sampledNormals[sample*3],sampledNormals[sample*3+1],sampledNormals[sample*3+2]).normalize();
    sampledNormals[sample*3]=n.x;sampledNormals[sample*3+1]=n.y;sampledNormals[sample*3+2]=n.z;
  }
  return {vertices,normals:sampledNormals,center,longest,bounds};
}

function allowedAiToken(logits,coordinateCount,branchCoordinatesRemaining,hasCoordinates){
  const candidates=[];
  for(let token=0;token<256;token++)candidates.push(token);
  if(branchCoordinatesRemaining===0&&coordinateCount%6===0&&hasCoordinates){
    candidates.push(256,258);
  }
  let best=candidates[0],score=-Infinity;
  for(const token of candidates){const value=logits[token];if(value>score){score=value;best=token;}}
  return best;
}

async function loadAiSessions(ort,executionProvider='webgpu',useCpuEncoder=false,stage='all'){
  const encoderExecutionProvider=useCpuEncoder?'wasm':executionProvider;
  // The tiny token embedding graph can trigger WebGPU's minimum uniform-buffer
  // alignment error on iOS. Keep it on WASM along with the encoder on mobile.
  const embedExecutionProvider=useCpuEncoder?'wasm':executionProvider;
  const cacheKey=`${executionProvider}:${encoderExecutionProvider}`;
  const canReuse=aiSessions?.cacheKey===cacheKey;
  if(canReuse&&stage==='all'&&aiSessions.encoder&&aiSessions.embed&&aiSessions.decoder)return aiSessions;
  const base='https://huggingface.co/cgb/unirig-skeleton-onnx-webgpu/resolve/main/';
  ort.env.wasm.proxy=false;
  ort.env.wasm.numThreads=1;
  const ortRuntimeBase=new URL('./vendor/onnxruntime-web-1.31.1/',import.meta.url);
  ort.env.wasm.wasmPaths={
    mjs:new URL('ort-wasm-simd-threaded.asyncify.mjs',ortRuntimeBase).href,
    wasm:new URL('ort-wasm-simd-threaded.asyncify.wasm',ortRuntimeBase).href
  };
  const createSession=async(modelName,externalDataName=null,sessionProvider=executionProvider,keepOutputsOnGpu=false)=>{
    setStatus(`AIモデルを取得しています: ${modelName}${externalDataName?' と外部データ':''}…`);
    const modelResponse=await fetch(base+modelName);
    if(!modelResponse.ok)throw new Error(`${modelName}の取得に失敗しました（HTTP ${modelResponse.status}）。`);
    let modelBytes=new Uint8Array(await modelResponse.arrayBuffer());
    const providerOptions=sessionProvider==='webgpu'&&useCpuEncoder&&keepOutputsOnGpu
      // Keep ORT's bucketed storage buffers: disabling them can leave zero-length
      // KV-cache inputs backed by a 1-byte buffer, below WebGPU's 32-byte binding minimum.
      ?{name:'webgpu',storageBufferCacheMode:'bucket'}
      :sessionProvider;
    const sessionOptions={executionProviders:[providerOptions],graphOptimizationLevel:'all'};
    if(keepOutputsOnGpu)sessionOptions.preferredOutputLocation='gpu-buffer';
    let externalData=null;
    if(externalDataName){
      const dataResponse=await fetch(base+externalDataName);
      if(!dataResponse.ok)throw new Error(`${externalDataName}の取得に失敗しました（HTTP ${dataResponse.status}）。`);
      externalData=new Uint8Array(await dataResponse.arrayBuffer());
      sessionOptions.externalData=[{
        path:externalDataName,
        data:externalData
      }];
    }
    const session=await ort.InferenceSession.create(modelBytes,sessionOptions);
    modelBytes=null;externalData=null;sessionOptions.externalData=undefined;
    return session;
  };
  let encoder=canReuse?aiSessions.encoder:null;
  let embed=canReuse?aiSessions.embed:null;
  let decoder=canReuse?aiSessions.decoder:null;
  if(stage==='encoder'){
    if(!encoder)encoder=await createSession('encoder_q8.onnx','encoder_q8.onnx.data',encoderExecutionProvider,encoderExecutionProvider==='webgpu');
    aiSessions={ort,encoder,embed,decoder,executionProvider,cacheKey};
    return aiSessions;
  }
  if(stage==='decoder'){
    if(!embed)embed=await createSession('embed.onnx',null,embedExecutionProvider);
    if(!decoder)decoder=await createSession('decoder_q8.onnx','decoder_q8.onnx.data',executionProvider,executionProvider==='webgpu');
    aiSessions={ort,encoder,embed,decoder,executionProvider,cacheKey};
    return aiSessions;
  }
  if(!encoder)encoder=await createSession('encoder_q8.onnx','encoder_q8.onnx.data',encoderExecutionProvider,encoderExecutionProvider==='webgpu');
  if(!embed){setStatus('AIモデルを読み込んでいます…（小型の入力モデル）');embed=await createSession('embed.onnx',null,embedExecutionProvider);}
  if(!decoder)decoder=await createSession('decoder_q8.onnx','decoder_q8.onnx.data',executionProvider,executionProvider==='webgpu');
  aiSessions={ort,encoder,embed,decoder,executionProvider,cacheKey};
  return aiSessions;
}

function encodeMobileShapeInWorker(vertices,normals,pointCount){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./mobile-encoder-worker.js?v=mobile-latent-128-20261117',import.meta.url),{type:'module'});
    let settled=false;
    const finish=(callback,value)=>{
      if(settled)return;
      settled=true;worker.terminate();callback(value);
    };
    worker.onmessage=event=>{
      const message=event.data||{};
      if(message.type==='status')setStatus(message.message);
      else if(message.type==='done')finish(resolve,message);
      else if(message.type==='error')finish(reject,new Error(message.message||'形状解析に失敗しました。'));
    };
    worker.onerror=event=>finish(reject,new Error(event.message||'形状解析の作業領域を開始できませんでした。'));
    try{worker.postMessage({vertices,normals,pointCount},[vertices.buffer,normals.buffer]);}
    catch(error){finish(reject,error);}
  });
}

async function predictAiSkeleton(){
  if(!modelRoot||!modelEntries.length)throw new Error('先にモデルを読み込んでください。');
  const isMobile=IS_MOBILE_DEVICE;
  const webGpuApiAvailable=!!navigator.gpu;
  let executionProvider='webgpu',adapter=null;
  try{if(navigator.gpu)adapter=await navigator.gpu.requestAdapter();}catch(error){console.warn('WebGPU adapter check failed.',error);}
  if(!adapter){
    if(isMobile)throw new Error(webGpuApiAvailable
      ?'SafariはWebGPU APIを公開していますが、使用できるGPUアダプターを返しませんでした。Safariアプリで直接ページを開き、iOSを更新して再読み込みしてください。設定に「WebGPU」機能フラグがあれば有効にしてください。'
      :'このブラウザーはWebGPU APIを公開していません。Safariアプリで直接開き、iOS 26以降へ更新してください。設定 > アプリ > Safari > 詳細 > 機能フラグにWebGPUがあれば有効にして、ページを再読み込みしてください。');
    const proceed=window.confirm('この端末ではWebGPUを利用できません。AI骨格推定をCPU（WebAssembly）で試しますか？初回は約455MBを取得し、処理にかなり時間がかかる場合があります。Safariがメモリ不足でページを再読み込みする可能性もあります。キャンセルしても、標準19関節の手動配置とウェイト生成は利用できます。');
    if(!proceed)throw new Error('CPUでのAI推定を中止しました。標準19関節の手動配置とウェイト生成はそのまま使えます。');
    executionProvider='wasm';
  }
  const ort=await import('./vendor/onnxruntime-web-1.31.1/ort.webgpu.bundle.min.js');
  const useCpuEncoder=isMobile&&executionProvider==='webgpu';
  const encoderExecutionProvider=useCpuEncoder?'wasm':executionProvider;
  const stagedMobileLoad=isMobile&&executionProvider==='webgpu';
  const encoder=useCpuEncoder?null:(await loadAiSessions(ort,executionProvider,false,'all')).encoder;
  // The encoder's learned gather table indexes all 2048 mobile samples.
  const surfaceSampleCount=isMobile?2048:16384;
  setStatus(executionProvider==='wasm'?'CPU（WebAssembly）でモデル表面から点と法線を抽出しています…':`${isMobile?'スマートフォン向けに点数を抑えて':''}モデル表面から点と法線を抽出しています…`);
  const cloud=sampleModelSurface(surfaceSampleCount);
  let latents,latentData,latentFeatureWidth,sourceLatentCount;
  if(useCpuEncoder){
    const mobileResult=await encodeMobileShapeInWorker(cloud.vertices,cloud.normals,surfaceSampleCount);
    latents={data:mobileResult.latentData};
    latentFeatureWidth=mobileResult.featureWidth;
    sourceLatentCount=mobileResult.latentCount;
  }else{
    const vertexTensor=new ort.Tensor('float32',cloud.vertices,[1,surfaceSampleCount,3]);
    const normalTensor=new ort.Tensor('float32',cloud.normals,[1,surfaceSampleCount,3]);
    const encoderInputs={};
    const vertexInput=encoder.inputNames.find(name=>/vertices|points/i.test(name))||encoder.inputNames[0];
    const normalInput=encoder.inputNames.find(name=>/normals/i.test(name))||encoder.inputNames[1];
    encoderInputs[vertexInput]=vertexTensor;encoderInputs[normalInput]=normalTensor;
    setStatus(executionProvider==='wasm'?'CPU（WebAssembly）でAIが形状を解析しています…':'AIが形状を解析しています…');
    let encoded;
    try{encoded=await encoder.run(encoderInputs);}
    catch(error){throw new Error(`形状解析（${encoderExecutionProvider==='wasm'?'CPU':'GPU'}）中に失敗しました: ${error.message||error}`);}
    const latentName=encoder.outputNames.find(name=>/latent/i.test(name))||encoder.outputNames[0];
    latents=encoded[latentName];
    latentFeatureWidth=latents.dims.at(-1)||1024;
    // WebGPU outputs live on the GPU; reading Tensor.data throws. Download once
    // before using the latent vectors in the CPU-side decoder input assembly.
    try{latentData=executionProvider==='webgpu'?await latents.getData():latents.data;}
    catch(error){throw new Error(`形状解析結果の取得中に失敗しました: ${error.message||error}`);}
    sourceLatentCount=latents.dims[1]||Math.floor(latentData.length/latentFeatureWidth);
  }
  if(encoder&&isMobile){
    try{await encoder.release();}
    finally{if(aiSessions?.encoder===encoder)aiSessions.encoder=null;}
  }
  let embed,decoder;
  if(stagedMobileLoad){
    setStatus('形状解析が完了しました。使用メモリを空けてから骨格生成モデルを読み込みます…');
    await new Promise(resolve=>setTimeout(resolve,100));
    const decodeSessions=await loadAiSessions(ort,executionProvider,useCpuEncoder,'decoder');
    embed=decodeSessions.embed;decoder=decodeSessions.decoder;
  }else{
    const sessions=await loadAiSessions(ort,executionProvider,useCpuEncoder,'all');
    embed=sessions.embed;decoder=sessions.decoder;
  }
  const ids=new ort.Tensor('int64',new BigInt64Array([257n,266n]),[1,2]);
  let embedded;
  try{embedded=await embed.run({[embed.inputNames[0]]:ids});}
  catch(error){throw new Error(`AI入力の埋め込み処理に失敗しました（${useCpuEncoder?'端末内CPU':'GPU'}）: ${error.message||error}`);}
  const prompt=embedded[embed.outputNames[0]];
  let promptData;
  try{promptData=executionProvider==='webgpu'?await prompt.getData():prompt.data;}
  catch(error){throw new Error(`AI入力の埋め込み結果取得中に失敗しました: ${error.message||error}`);}
  const mobileLatentCount=sourceLatentCount;
  let decoderLatents=latentData;
  if(mobileLatentCount<sourceLatentCount){
    setStatus(`スマートフォン用に形状情報を${mobileLatentCount}個へ圧縮しています…`);
    decoderLatents=new Float32Array(mobileLatentCount*latentFeatureWidth);
    for(let target=0;target<mobileLatentCount;target++){
      const first=Math.floor(target*sourceLatentCount/mobileLatentCount);
      const last=Math.max(first+1,Math.floor((target+1)*sourceLatentCount/mobileLatentCount));
      const divisor=last-first;
      for(let feature=0;feature<latentFeatureWidth;feature++){
        let sum=0;
        for(let source=first;source<last;source++)sum+=latentData[source*latentFeatureWidth+feature];
        decoderLatents[target*latentFeatureWidth+feature]=sum/divisor;
      }
    }
  }
  const prefill=new Float32Array(decoderLatents.length+promptData.length);
  prefill.set(decoderLatents,0);prefill.set(promptData,decoderLatents.length);
  const pastInputs=decoder.inputNames.filter(name=>/^past\./.test(name));
  if(!pastInputs.length)throw new Error('AIモデルのキャッシュ入力形式を認識できません。');
  const logitsName=decoder.outputNames.find(name=>/logits/i.test(name))||decoder.outputNames[0];
  const cacheForInput=name=>name.replace(/^past\./,'present.');
  const prefillTokenCount=prefill.length/1024;
  // PC UniRig is run as one inference pass; mobile uses its separate Pose Lite
  // path for normal use and should not split the desktop model's prefill either.
  const prefillChunkSize=prefillTokenCount;
  let decoded=null;
  let cache={};
  for(let offset=0;offset<prefillTokenCount;offset+=prefillChunkSize){
    const chunkLength=Math.min(prefillChunkSize,prefillTokenCount-offset);
    const feeds={inputs_embeds:new ort.Tensor('float32',prefill.subarray(offset*1024,(offset+chunkLength)*1024),[1,chunkLength,1024])};
    for(const name of pastInputs)feeds[name]=cache[name]||new ort.Tensor('float32',new Float32Array(0),[1,16,0,64]);
    const previousCache=cache;
    try{decoded=await decoder.run(feeds);}
    catch(error){throw new Error(`初回骨格処理 ${offset+1}〜${offset+chunkLength}/${prefillTokenCount} トークンでGPUが停止しました: ${error.message||error}`);}
    for(const tensor of Object.values(previousCache))tensor.dispose?.();
    cache={};
    for(const inputName of pastInputs){
      const outputName=cacheForInput(inputName);
      if(!decoded[outputName])throw new Error(`AIモデルのキャッシュ出力がありません: ${outputName}`);
      cache[inputName]=decoded[outputName];
    }
    if(offset+chunkLength<prefillTokenCount)decoded[logitsName]?.dispose?.();
  }
  const tokens=[];
  let coordinateCount=0,branchCoordinatesRemaining=0,completedJoints=0,hasCoordinates=false;
  const maxGeneratedTokens=isMobile?288:512;
  for(let step=0;step<maxGeneratedTokens;step++){
    const logitsTensor=decoded[logitsName],vocab=267;
    const sequenceLength=logitsTensor.dims[1];
    let logitsData;
    try{logitsData=executionProvider==='webgpu'?await logitsTensor.getData():logitsTensor.data;}
    catch(error){throw new Error(`関節 ${step+1} の結果取得中にGPUが停止しました: ${error.message||error}`);}
    const logits=logitsData.subarray((sequenceLength-1)*vocab,sequenceLength*vocab);
    const canEndAtBoundary=branchCoordinatesRemaining===0&&coordinateCount%6===0&&hasCoordinates;
    // Keep mobile KV-cache growth bounded. End only between complete joints,
    // where EOS is a valid token in the model's sequence grammar.
    const token=isMobile&&step>=256&&canEndAtBoundary
      ?258
      :allowedAiToken(logits,coordinateCount,branchCoordinatesRemaining,hasCoordinates);
    logitsTensor.dispose?.();
    if(token===258){tokens.push(token);break;}
    tokens.push(token);
    if(token<256){
      coordinateCount++;hasCoordinates=true;
      if(branchCoordinatesRemaining>0)branchCoordinatesRemaining--;
      if(coordinateCount%6===0)completedJoints++;
    }else if(token===256){
      coordinateCount=0;branchCoordinatesRemaining=6;
    }else if(token===260||token===261||token===262){
      coordinateCount=0;
    }
    if(step%4===0){setStatus(`${executionProvider==='wasm'?'CPU（WebAssembly）で':''}AIが骨格を推定しています… ${completedJoints}関節`);await new Promise(resolve=>setTimeout(resolve,0));}
    const tokenInput=new ort.Tensor('int64',new BigInt64Array([BigInt(token)]),[1,1]);
    let tokenEmbedding;
    try{tokenEmbedding=await embed.run({[embed.inputNames[0]]:tokenInput});}
    catch(error){throw new Error(`関節 ${step+1} の入力変換中にGPUが停止しました: ${error.message||error}`);}
    const nextEmbedding=tokenEmbedding[embed.outputNames[0]];
    const nextFeeds={inputs_embeds:nextEmbedding};
    for(const name of pastInputs)nextFeeds[name]=cache[name];
    const previousCache=cache;
    try{decoded=await decoder.run(nextFeeds);}
    catch(error){throw new Error(`関節 ${step+1} の推定中にGPUが停止しました: ${error.message||error}`);}
    nextEmbedding.dispose?.();
    for(const tensor of Object.values(previousCache))tensor.dispose?.();
    cache={};
    for(const name of pastInputs){
      const outputName=cacheForInput(name);
      if(!decoded[outputName])throw new Error(`AIモデルのキャッシュ出力がありません: ${outputName}`);
      cache[name]=decoded[outputName];
    }
  }
  if(tokens.at(-1)!==258)throw new Error('AI骨格が終了記号まで到達せず、出力が不完全なため表示しません。標準19関節の手動配置とウェイト生成は続けて利用できます。');
  if(!completedJoints)throw new Error('AIが骨格を生成できませんでした。モデルの向きや形状を確認してください。');
  for(const tensor of Object.values(cache))tensor.dispose?.();
  decoded?.[logitsName]?.dispose?.();
  return {tokens,center:cloud.center,longest:cloud.longest,bounds:cloud.bounds};
}

function buildAiBoneDefs(tokens,center,longest,bounds){
  const joints=[],parentPoints=[];
  const decodePoint=tokens=>new THREE.Vector3(...tokens.map(token=>(token+0.5)/256*2-1))
    .multiplyScalar(longest*0.5).add(center);
  for(let i=0;i<tokens.length;){
    const token=tokens[i];
    if(token===258)break;
    if(token===256){i++;continue;}
    if(token===260||token===261||token===262){i++;continue;}
    if(token<0||token>=256)throw new Error(`骨格トークンを解釈できません: ${token}`);
    // Each UniRig record is parent xyz followed by the joint xyz.
    if(i+5>=tokens.length||tokens.slice(i,i+6).some(value=>value<0||value>=256))break;
    parentPoints.push(decodePoint(tokens.slice(i,i+3)));
    joints.push(decodePoint(tokens.slice(i+3,i+6)));
    i+=6;
  }
  if(!joints.length)throw new Error('AIの骨格データを読み取れませんでした。');
  const linkedJoints=[],parents=[];
  const acceptedParentDistanceSq=(longest*(24/256))**2;
  const duplicateDistanceSq=(longest*(1/256))**2;
  const boundsPadding=longest*0.025;
  for(let joint=0;joint<joints.length;joint++){
    const point=joints[joint];
    if(bounds&&(
      point.x<bounds.min.x-boundsPadding||point.x>bounds.max.x+boundsPadding||
      point.y<bounds.min.y-boundsPadding||point.y>bounds.max.y+boundsPadding||
      point.z<bounds.min.z-boundsPadding||point.z>bounds.max.z+boundsPadding
    ))continue;
    let nearest=-1,nearestDistance=Infinity;
    for(let candidate=0;candidate<linkedJoints.length;candidate++){
      const distance=linkedJoints[candidate].distanceToSquared(parentPoints[joint]);
      if(distance<nearestDistance){nearestDistance=distance;nearest=candidate;}
    }
    let duplicate=false;
    for(const existing of linkedJoints){
      if(existing.distanceToSquared(joints[joint])<=duplicateDistanceSq){duplicate=true;break;}
    }
    if(duplicate)continue;
    linkedJoints.push(joints[joint]);
    // Preserve the predicted joint even when its parent reference is dubious.
    // A distant reference is left unconnected rather than deleting this joint
    // and cascading that rejection through the rest of its branch.
    parents.push(joint===0||nearest<0||nearestDistance>acceptedParentDistanceSq?-1:nearest);
  }
  return linkedJoints.map((position,index)=>({
    name:`ai_joint_${String(index+1).padStart(2,'0')}`,
    label:`AI関節 ${index+1}`,
    parent:parents[index]<0?null:`ai_joint_${String(parents[index]+1).padStart(2,'0')}`,
    position,surfacePoint:null,surfaceNormal:null,bone:null,marker:null
  }));
}

async function getMobilePoseLandmarker(){
  if(!mobilePoseTaskPromise){
    mobilePoseTaskPromise=(async()=>{
      const base='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3';
      const {FilesetResolver,PoseLandmarker}=await import(`${base}/+esm`);
      const vision=await FilesetResolver.forVisionTasks(`${base}/wasm`);
      return PoseLandmarker.createFromOptions(vision,{
        baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},
        runningMode:'IMAGE',numPoses:1,
        minPoseDetectionConfidence:0.25,minPosePresenceConfidence:0.25,minTrackingConfidence:0.25
      });
    })().catch(error=>{mobilePoseTaskPromise=null;throw error;});
  }
  return mobilePoseTaskPromise;
}

async function estimateMobileTemplateRig(){
  restoreTemplateBoneDefs();
  placeStandardRig();
  const fallback=new Map(BONE_DEFS.map(bone=>[bone.name,bone.position.clone()]));
  setStatus('スマホ向け軽量AI（Pose Lite）を準備しています…初回は数MBを取得します。');
  const landmarker=await getMobilePoseLandmarker();
  modelRoot.updateMatrixWorld(true);
  const bounds=modelLocalBounds(),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const worldBounds=bounds.clone().applyMatrix4(modelRoot.matrixWorld);
  const worldCenter=worldBounds.getCenter(new THREE.Vector3()),worldSize=worldBounds.getSize(new THREE.Vector3());
  const maxSize=Math.max(worldSize.x,worldSize.y,worldSize.z,0.1);
  const savedPosition=camera.position.clone(),savedQuaternion=camera.quaternion.clone(),savedUp=camera.up.clone();
  const savedTarget=controls.target.clone(),savedEnabled=controls.enabled;
  const savedGrid=grid.visible,savedMarkers=markerGroup.visible;
  const savedLines=rigLines?.visible,savedRegion=regionObject?.visible;
  const transformHelper=regionTransform.getHelper(),savedTransform=transformHelper.visible;
  let result,projectionCamera;
  try{
    controls.enabled=false;controls.target.copy(worldCenter);
    camera.up.set(0,1,0);camera.position.set(worldCenter.x,worldCenter.y,worldCenter.z+maxSize*2.2);camera.lookAt(worldCenter);camera.updateMatrixWorld(true);
    projectionCamera=camera.clone();
    grid.visible=false;markerGroup.visible=false;if(rigLines)rigLines.visible=false;
    if(regionObject)regionObject.visible=false;transformHelper.visible=false;
    renderer.render(scene,camera);
    const source=renderer.domElement,scale=Math.min(1,384/source.width,512/source.height);
    const image=document.createElement('canvas');
    image.width=Math.max(1,Math.round(source.width*scale));image.height=Math.max(1,Math.round(source.height*scale));
    image.getContext('2d',{alpha:false}).drawImage(source,0,0,image.width,image.height);
    result=landmarker.detect(image);
  }finally{
    camera.position.copy(savedPosition);camera.quaternion.copy(savedQuaternion);camera.up.copy(savedUp);
    controls.target.copy(savedTarget);controls.enabled=savedEnabled;
    grid.visible=savedGrid;markerGroup.visible=savedMarkers;
    if(rigLines)rigLines.visible=savedLines;
    if(regionObject)regionObject.visible=savedRegion;
    transformHelper.visible=savedTransform;
    camera.updateMatrixWorld(true);renderer.render(scene,camera);
  }
  const pose=result?.landmarks?.[0];
  if(!pose||pose.length<29)throw new Error('画面から人物の関節を十分に検出できませんでした。モデルを正面向きにして再試行するか、配置済みの標準19関節を調整してください。');
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,0,1),-worldCenter.z);
  const toModelPoint=index=>{
    const landmark=pose[index];
    if(!landmark||Math.min(landmark.visibility??1,landmark.presence??1)<0.12)return null;
    ray.setFromCamera(new THREE.Vector2(landmark.x*2-1,1-landmark.y*2),projectionCamera);
    const world=ray.ray.intersectPlane(plane,new THREE.Vector3());
    return world?modelRoot.worldToLocal(world):null;
  };
  const pick=(index,name)=>toModelPoint(index)||fallback.get(name).clone();
  const midpoint=(a,b)=>a.clone().add(b).multiplyScalar(0.5);
  const leftShoulder=pick(11,'LeftShoulder'),rightShoulder=pick(12,'RightShoulder');
  const leftElbow=pick(13,'LeftElbow'),rightElbow=pick(14,'RightElbow');
  const leftWrist=pick(15,'LeftWrist'),rightWrist=pick(16,'RightWrist');
  const leftHip=pick(23,'LeftUpperLeg'),rightHip=pick(24,'RightUpperLeg');
  const leftKnee=pick(25,'LeftKnee'),rightKnee=pick(26,'RightKnee');
  const leftAnkle=pick(27,'LeftAnkle'),rightAnkle=pick(28,'RightAnkle');
  const chest=midpoint(leftShoulder,rightShoulder),hip=midpoint(leftHip,rightHip),nose=pick(0,'head');
  const positions=new Map([
    ['hip',hip],['supine',hip.clone().lerp(chest,0.36)],['chest',chest],
    ['neck',chest.clone().lerp(nose,0.62)],['head',nose.clone().add(new THREE.Vector3(0,size.y*0.025,0))],
    ['LeftShoulder',leftShoulder],['LeftUpperArm',leftShoulder.clone().lerp(leftElbow,0.52)],['LeftElbow',leftElbow],['LeftWrist',leftWrist],
    ['RightShoulder',rightShoulder],['RightUpperArm',rightShoulder.clone().lerp(rightElbow,0.52)],['RightElbow',rightElbow],['RightWrist',rightWrist],
    ['LeftUpperLeg',leftHip],['LeftKnee',leftKnee],['LeftAnkle',leftAnkle],
    ['RightUpperLeg',rightHip],['RightKnee',rightKnee],['RightAnkle',rightAnkle]
  ]);
  for(const bone of BONE_DEFS)bone.position.copy(positions.get(bone.name));
  activeBoneName='hip';rigMode='template';updateMarkers();renderBoneList();
  return BONE_DEFS.length;
}

async function runAiAutoRig(mode){
  if(!modelRoot){setStatus('先にボーンのないGLB、glTF、OBJモデルを読み込んでください。');return;}
  aiRigButtons.forEach(button=>button.disabled=true);
  try{
    if(mode==='mobile'){
      let joints=0;
      try{joints=await estimateMobileTemplateRig();}
      catch(error){
        restoreTemplateBoneDefs();placeStandardRig();
        const reason=error?.message||String(error);
        setStatus(`軽量AIは配置できませんでした（${reason}）。標準19関節を仮配置したので、手動で調整してウェイトを生成できます。`);
        return;
      }
      autoButton.textContent='標準19関節に戻す';
      setStatus(`スマホ向け軽量AIが${joints}関節を推定しました。画像からの推定なので、関節位置を確認・修正してウェイトを生成してください。`);
      return;
    }
    if(IS_MOBILE_DEVICE) setStatus('PC向けUniRigをスマートフォンで実行中です。大きなモデルを取得するため、ページが再読み込みされる可能性があります。');
    const prediction=await predictAiSkeleton();
    const nodes=buildAiBoneDefs(prediction.tokens,prediction.center,prediction.longest,prediction.bounds);
    if(nodes.length<2)throw new Error('AIの予測結果が短すぎます。別の角度またはモデルで試してください。');
    BONE_DEFS.splice(0,BONE_DEFS.length,...nodes);
    rigMode='ai';activeBoneName=BONE_DEFS[0].name;
    updateMarkers();renderBoneList();
    autoButton.textContent='標準19関節に戻す';
    setStatus(`AIが${nodes.length}関節の骨格を推定しました。関節点とつながりを確認し、必要なら修正してからウェイトを生成してください。`);
  }catch(error){
    console.error(error);
    const detail=error.message||String(error);
    const manualNote=detail.includes('手動配置')||detail.includes('ウェイト生成')?'':' 標準19関節の手動配置とウェイト生成は続けて利用できます。';
    setStatus(`AI自動推定に失敗しました: ${detail}${manualNote}`);
  }finally{aiRigButtons.forEach(button=>button.disabled=false);}
}
aiDesktopRigButton.addEventListener('click',()=>runAiAutoRig('desktop'));
aiMobileRigButton.addEventListener('click',()=>runAiAutoRig('mobile'));

function normalizeWeights(values,offset,boneCount){
  let sum=0;for(let b=0;b<boneCount;b++)sum+=values[offset+b];
  if(sum<=1e-12){values[offset]=1;sum=1;}
  for(let b=0;b<boneCount;b++)values[offset+b]/=sum;
}

function normalizeAllowedWeights(values,offset,boneOffset,boneCount,allowed,fallbackBone){
  let sum=0;
  for(let b=0;b<boneCount;b++){
    if(allowed[boneOffset+b])sum+=values[offset+b];
    else values[offset+b]=0;
  }
  if(sum<=1e-12){values[offset+fallbackBone]=1;return;}
  for(let b=0;b<boneCount;b++)if(allowed[boneOffset+b])values[offset+b]/=sum;
}

async function extendArmWeightsOverSurface(dense,allowedInfluences,graph,groups,segments,rootVertices,rootSize,count,boneCount){
  if(!graph)return;
  const armBones=new Set();
  for(const segment of segments)if(segment.isArmLimb){armBones.add(segment.a);armBones.add(segment.b);}
  for(let boneIndex=0;boneIndex<boneCount;boneIndex++){
    const bone=BONE_DEFS[boneIndex];
    if(/^(Left|Right)Shoulder$/.test(bone.name))armBones.add(boneIndex);
  }
  if(!armBones.size)return;
  const groupByVertex=new Array(count);
  for(const group of groups)for(const vertex of group)groupByVertex[vertex]=group;
  // Keep the surface extension local to the joint. Long geodesic spreading
  // can carry arm weights across a connected torso or skirt and pull seams apart.
  const maxDistance=rootSize*0.10,sigma=Math.max(rootSize*0.07,1e-5),spreadScale=0.62;
  let processedBones=0;
  for(const boneIndex of armBones){
    let seedStrength=0;
    for(let v=0;v<count;v++)if(allowedInfluences[v*boneCount+boneIndex])seedStrength=Math.max(seedStrength,dense[v*boneCount+boneIndex]);
    if(seedStrength<0.025)continue;
    const distances=new Float32Array(count);distances.fill(Infinity);
    const heap=[];
    const push=(vertex,distance)=>{
      let i=heap.length;heap.push([distance,vertex]);
      while(i>0){const parent=(i-1)>>1;if(heap[parent][0]<=distance)break;heap[i]=heap[parent];i=parent;}
      heap[i]=[distance,vertex];
    };
    const pop=()=>{
      const first=heap[0],last=heap.pop();
      if(heap.length){let i=0;while(true){let child=i*2+1;if(child>=heap.length)break;if(child+1<heap.length&&heap[child+1][0]<heap[child][0])child++;if(heap[child][0]>=last[0])break;heap[i]=heap[child];i=child;}heap[i]=last;}
      return first;
    };
    for(let v=0;v<count;v++)if(allowedInfluences[v*boneCount+boneIndex]){
      const seedGroup=groupByVertex[v];
      if(seedGroup){for(const member of seedGroup)if(distances[member]!==0){distances[member]=0;push(member,0);}}
      else if(distances[v]!==0){distances[v]=0;push(v,0);}
    }
    let visited=0;
    while(heap.length){
      const [distance,vertex]=pop();
      if(distance!==distances[vertex]||distance>maxDistance)continue;
      for(const neighbor of graph.neighbors[vertex]){
        const dx=rootVertices[vertex*3]-rootVertices[neighbor*3];
        const dy=rootVertices[vertex*3+1]-rootVertices[neighbor*3+1];
        const dz=rootVertices[vertex*3+2]-rootVertices[neighbor*3+2];
        const nextDistance=distance+Math.hypot(dx,dy,dz);
        if(nextDistance<distances[neighbor]&&nextDistance<=maxDistance){distances[neighbor]=nextDistance;push(neighbor,nextDistance);}
      }
      if(++visited%4096===0){setStatus(`袖のウェイトをメッシュ表面に沿って伝えています… ${processedBones+1}/${armBones.size}`);await new Promise(resolve=>requestAnimationFrame(resolve));}
    }
    for(let v=0;v<count;v++){
      const distance=distances[v];if(!Number.isFinite(distance)||distance<=1e-7)continue;
      const influence=seedStrength*spreadScale*Math.exp(-0.5*(distance/sigma)**2);
      const offset=v*boneCount;
      if(influence>dense[offset+boneIndex])dense[offset+boneIndex]=influence;
      allowedInfluences[offset+boneIndex]=1;
    }
    processedBones++;
  }
  for(let v=0;v<count;v++)normalizeWeights(dense,v*boneCount,boneCount);
}

async function generateMeshWeights(entry,bonesByName,rootSize){
  const mesh=entry.mesh, geometry=entry.geometry.clone();
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  const sourcePositions=geometry.attributes.position;
  const count=sourcePositions.count,boneCount=BONE_DEFS.length;
  const rootVertices=entry.rootPositions;
  const modelBounds=modelLocalBounds(),modelCenter=modelBounds.getCenter(new THREE.Vector3()),modelExtent=modelBounds.getSize(new THREE.Vector3());
  const indexByName=new Map(BONE_DEFS.map((bone,index)=>[bone.name,index]));
  const segmentData=BONE_DEFS.map((bone,index)=>{
    if(!bone.parent||!indexByName.has(bone.parent))return null;
    const a=indexByName.get(bone.parent),start=BONE_DEFS[a].position,end=bone.position;
    const abx=end.x-start.x,aby=end.y-start.y,abz=end.z-start.z;
    const childName=bone.name;
    const namedDistalLimb=/^(Left|Right)(UpperArm|Elbow|Wrist|UpperLeg|Knee|Ankle)$/.test(childName);
    const midpointX=(start.x+end.x)*0.5,midpointY=(start.y+end.y)*0.5;
    const centralSpine=Math.abs(midpointX-modelCenter.x)<=Math.max(modelExtent.x*0.14,rootSize*0.03)
      &&midpointY>=modelBounds.min.y+modelExtent.y*0.28
      &&midpointY<=modelBounds.max.y-modelExtent.y*0.12;
    const isCore=['supine','chest','neck','head'].includes(childName)||(!namedDistalLimb&&centralSpine);
    const isDistalLimb=namedDistalLimb
      ||(!isCore&&(midpointY<modelBounds.min.y+modelExtent.y*0.58
        ||Math.abs(midpointX-modelCenter.x)>Math.max(modelExtent.x*0.18,rootSize*0.04)));
    const isArmLimb=/^(Left|Right)(UpperArm|Elbow|Wrist)$/.test(childName)
      ||(!namedDistalLimb&&isDistalLimb&&midpointY>=modelBounds.min.y+modelExtent.y*0.48
        &&Math.abs(midpointX-modelCenter.x)>Math.max(modelExtent.x*0.18,rootSize*0.04));
    const isArmInfluence=isArmLimb||/^(Left|Right)Shoulder$/.test(childName);
    const isFootInfluence=/^(Left|Right)Ankle$/.test(childName);
    return {name:childName,a,b:index,ax:start.x,ay:start.y,az:start.z,bx:end.x,by:end.y,bz:end.z,abx,aby,abz,lengthSq:abx*abx+aby*aby+abz*abz,isDistalLimb,isCore,isArmLimb,isArmInfluence,isFootInfluence};
  }).filter(Boolean);
  if(!segmentData.length)throw new Error('ボーン間のつながりを作れません。親子関係を確認してください。');
  const directSegmentAdj=segmentData.map((segment,index)=>segmentData.map((other,j)=>j!==index&&(segment.a===other.a||segment.a===other.b||segment.b===other.a||segment.b===other.b)?j:-1).filter(j=>j>=0));
  const influenceReach=segment=>{
    const length=Math.sqrt(segment.lengthSq);
    if(segment.isArmLimb)return Math.max(rootSize*0.08,length*0.35);
    if(segment.isDistalLimb)return Math.max(rootSize*0.035,length*0.35);
    return Math.max(rootSize*0.04,length*0.4);
  };
  const shoulderSegmentApplies=(segment,px,py,pz)=>{
    if(!/Shoulder$/.test(segment.name))return true;
    const shoulderLateral=Math.abs((segment.ax+segment.bx)*0.5-modelCenter.x);
    if(Math.abs(px-modelCenter.x)<Math.max(modelExtent.x*0.08,shoulderLateral*0.7))return false;
    const dx=px-segment.ax,dy=py-segment.ay,dz=pz-segment.az;
    const t=segment.lengthSq>1e-12?THREE.MathUtils.clamp((dx*segment.abx+dy*segment.aby+dz*segment.abz)/segment.lengthSq,0,1):0;
    const ox=px-(segment.ax+segment.abx*t),oy=py-(segment.ay+segment.aby*t),oz=pz-(segment.az+segment.abz*t);
    const reach=Math.max(rootSize*0.07,Math.sqrt(segment.lengthSq)*0.35);
    return ox*ox+oy*oy+oz*oz<=reach*reach;
  };
  const lightweightPhoneMode=window.matchMedia('(max-width:760px)').matches&&count>60000;
  if(!lightweightPhoneMode)setStatus('独立した袖や服のパーツを確認しています…');
  const diffusionGraph=lightweightPhoneMode?null:await makeSurfaceDiffusionGraph(geometry,rootVertices,count);
  const armSurfaceComponents=diffusionGraph?classifyArmSurfaceComponents(diffusionGraph,segmentData,rootVertices,modelBounds,rootSize):null;
  const armSurfaceComponentCount=armSurfaceComponents?armSurfaceComponents.reduce((sum,flag)=>sum+flag,0):0;
  const headBoneY=BONE_DEFS.find(bone=>bone.name==='head')?.position?.y??modelBounds.max.y;
  const armFreeHeadY=Math.max(modelBounds.min.y+modelExtent.y*0.68,headBoneY-rootSize*0.16);
  const headSegment=segmentData.find(segment=>segment.name==='head');
  const headProtectRadius=Math.max(rootSize*0.12,headSegment?Math.sqrt(headSegment.lengthSq)*0.8:0);
  const footHorizontalRadius=Math.max(rootSize*0.08,Math.max(modelExtent.x,modelExtent.z)*0.28);
  const sigma=Math.max(rootSize*0.025,1e-5),maxGap=rootSize*0.02;
  let dense=new Float32Array(count*boneCount);
  const allowedInfluences=new Uint8Array(count*boneCount),fallbackBones=new Uint32Array(count);
  const hitDistances=new Float32Array(segmentData.length),hitParameters=new Float32Array(segmentData.length);
  let footRegionVertexCount=0;
  for(let v=0;v<count;v++){
    if(v>0&&v%4096===0){setStatus(`ウェイトを計算しています… ${Math.floor(v/count*100)}%`);await new Promise(resolve=>requestAnimationFrame(resolve));}
    const px=rootVertices[v*3],py=rootVertices[v*3+1],pz=rootVertices[v*3+2];
    const component=diffusionGraph?.componentIds?.[v];
    let isHeadRegion=py>=armFreeHeadY;
    if(!isHeadRegion&&headSegment){
      const hx=px-headSegment.ax,hy=py-headSegment.ay,hz=pz-headSegment.az;
      const ht=headSegment.lengthSq>1e-12?THREE.MathUtils.clamp((hx*headSegment.abx+hy*headSegment.aby+hz*headSegment.abz)/headSegment.lengthSq,0,1):0;
      const hdx=px-(headSegment.ax+headSegment.abx*ht),hdy=py-(headSegment.ay+headSegment.aby*ht),hdz=pz-(headSegment.az+headSegment.abz*ht);
      isHeadRegion=hdx*hdx+hdy*hdy+hdz*hdz<=headProtectRadius*headProtectRadius;
    }
    const armSurface=!isHeadRegion&&component!=null&&component>=0&&armSurfaceComponents?.[component]===1;
    let primaryIndex=-1,primaryT=0,nearestDistance=Infinity;
    let coreIndex=-1,coreT=0,coreDistance=Infinity;
    for(let s=0;s<segmentData.length;s++){
      const seg=segmentData[s];
      if(armSurface&&!seg.isArmInfluence)continue;
      if(isHeadRegion&&seg.isArmInfluence)continue;
      if(!shoulderSegmentApplies(seg,px,py,pz))continue;
      const dx=px-seg.ax,dy=py-seg.ay,dz=pz-seg.az;
      const t=seg.lengthSq>1e-12?THREE.MathUtils.clamp((dx*seg.abx+dy*seg.aby+dz*seg.abz)/seg.lengthSq,0,1):0;
      const cx=seg.ax+seg.abx*t,cy=seg.ay+seg.aby*t,cz=seg.az+seg.abz*t;
      const ox=px-cx,oy=py-cy,oz=pz-cz,distance=Math.sqrt(ox*ox+oy*oy+oz*oz);
      hitDistances[s]=distance;hitParameters[s]=t;
      if(distance<nearestDistance){nearestDistance=distance;primaryIndex=s;primaryT=t;}
      if(!armSurface&&seg.isCore&&distance<coreDistance){coreDistance=distance;coreIndex=s;coreT=t;}
    }
    // The simplified rig has no toe bone. Vertices immediately below and near
    // an ankle must therefore follow that ankle instead of falling back to hip
    // or torso weights, which leaves the toes stretched in place.
    let footSegmentIndex=-1,footHorizontalDistance=Infinity,footBlendT=1;
    for(let s=0;s<segmentData.length;s++){
      const seg=segmentData[s];if(!seg.isFootInfluence)continue;
      const dx=px-seg.ax,dy=py-seg.ay,dz=pz-seg.az;
      const rawT=seg.lengthSq>1e-12?(dx*seg.abx+dy*seg.aby+dz*seg.abz)/seg.lengthSq:1;
      if(rawT<0.90)continue;
      const closestX=seg.ax+seg.abx*rawT,closestY=seg.ay+seg.aby*rawT,closestZ=seg.az+seg.abz*rawT;
      const ox=px-closestX,oy=py-closestY,oz=pz-closestZ,radialDistance=Math.hypot(ox,oy,oz);
      if(radialDistance<=footHorizontalRadius&&radialDistance<footHorizontalDistance){
        footSegmentIndex=s;footHorizontalDistance=radialDistance;footBlendT=THREE.MathUtils.clamp((rawT-0.90)/0.10,0,1);
      }
    }
    const isFootRegion=footSegmentIndex>=0;
    if(isFootRegion){footRegionVertexCount++;primaryIndex=footSegmentIndex;primaryT=footBlendT;nearestDistance=footHorizontalDistance;}
    // Do not let a leg or forearm capture remote clothing/accessories merely
    // because it is the nearest of all bones. If it is outside the segment's
    // local reach, anchor it to the closest torso segment instead.
    if(!isFootRegion&&!armSurface&&segmentData[primaryIndex].isDistalLimb){
      const limbReach=influenceReach(segmentData[primaryIndex]);
      if(nearestDistance>limbReach&&coreIndex>=0){primaryIndex=coreIndex;primaryT=coreT;nearestDistance=coreDistance;}
    }
    const base=segmentData[primaryIndex],offset=v*boneCount;
    dense[offset+base.a]+=1-primaryT;dense[offset+base.b]+=primaryT;
    allowedInfluences[offset+base.a]=1;allowedInfluences[offset+base.b]=1;
    fallbackBones[v]=primaryT<0.5?base.a:base.b;
    let secondaryIndex=-1,bestGap=Infinity;
    const primarySegment=segmentData[primaryIndex];
    for(const candidate of (isFootRegion?[]:directSegmentAdj[primaryIndex])){
      const candidateSegment=segmentData[candidate];
      if(isHeadRegion&&candidateSegment.isArmInfluence)continue;
      if(!shoulderSegmentApplies(candidateSegment,px,py,pz))continue;
      const primaryIsArm=primarySegment.isArmLimb||/Shoulder$/.test(primarySegment.name);
      const candidateIsArm=candidateSegment.isArmLimb||/Shoulder$/.test(candidateSegment.name);
      // Keep arm weights on the arm chain. The shoulder is the only narrow
      // bridge allowed between torso and arm; two-hop neighbors caused sleeve,
      // chest and back vertices to inherit arm motion.
      if(primaryIsArm&&!candidateIsArm)continue;
      if(!primaryIsArm&&candidateIsArm&&!(/Shoulder$/.test(candidateSegment.name)&&['chest','neck'].includes(primarySegment.name)))continue;
      const candidateReach=influenceReach(candidateSegment);
      if(candidateSegment.isDistalLimb&&hitDistances[candidate]>candidateReach)continue;
      const gap=hitDistances[candidate]-nearestDistance;if(gap<bestGap){bestGap=gap;secondaryIndex=candidate;}
    }
    if(secondaryIndex>=0&&bestGap<=maxGap&&hitDistances[secondaryIndex]<=nearestDistance*1.15+rootSize*0.005){
      const seg=segmentData[secondaryIndex],t=hitParameters[secondaryIndex];
      let amount=Math.min(0.3,Math.exp(-(bestGap*bestGap)/(2*sigma*sigma)));
      if(primarySegment.isArmLimb!==seg.isArmLimb||/Shoulder$/.test(primarySegment.name)!==/Shoulder$/.test(seg.name))amount=Math.min(amount,0.08);
      dense[offset+seg.a]+=amount*(1-t);dense[offset+seg.b]+=amount*t;
      allowedInfluences[offset+seg.a]=1;allowedInfluences[offset+seg.b]=1;
    }
    normalizeWeights(dense,offset,boneCount);
  }

  const groups=lightweightPhoneMode?[]:coincidentVertexGroups(rootVertices,rootSize);
  await extendArmWeightsOverSurface(dense,allowedInfluences,diffusionGraph,groups,segmentData,rootVertices,rootSize,count,boneCount);
  let next=new Float32Array(dense.length);
  for(let iteration=0;diffusionGraph&&iteration<6;iteration++){
    for(let v=0;v<count;v++){
      if(v>0&&v%8192===0)await new Promise(resolve=>requestAnimationFrame(resolve));
      const offset=v*boneCount,neighbors=diffusionGraph.neighbors[v],neighborWeights=diffusionGraph.weights[v];
      if(!neighbors.length){next.set(dense.subarray(offset,offset+boneCount),offset);continue;}
      const self=.55,neighborMix=.45;
      for(let b=0;b<boneCount;b++){
        if(!allowedInfluences[offset+b]){next[offset+b]=0;continue;}
        let value=dense[offset+b]*self;
        for(let n=0;n<neighbors.length;n++)value+=dense[neighbors[n]*boneCount+b]*neighborWeights[n]*neighborMix;
        next[offset+b]=value;
      }
      normalizeAllowedWeights(next,offset,offset,boneCount,allowedInfluences,fallbackBones[v]);
    }
    for(const group of groups){
      const groupMask=new Uint8Array(boneCount);
      for(const v of group)for(let b=0;b<boneCount;b++)if(allowedInfluences[v*boneCount+b])groupMask[b]=1;
      for(const v of group)for(let b=0;b<boneCount;b++)if(groupMask[b])allowedInfluences[v*boneCount+b]=1;
      for(let b=0;b<boneCount;b++){
        let sum=0;for(const v of group)sum+=next[v*boneCount+b];
        const average=sum/group.length;for(const v of group)next[v*boneCount+b]=average;
      }
      for(const v of group)normalizeWeights(next,v*boneCount,boneCount);
    }
    [dense,next]=[next,dense];
  }
  const assigned=protectedVertices.get(entry);
  if(assigned?.size){
    const expanded=new Map(assigned);
    for(const group of groups){
      const chosen=group.map(vertex=>expanded.get(vertex)).find(Boolean);
      if(chosen)for(const vertex of group)if(!expanded.has(vertex))expanded.set(vertex,chosen);
    }
    for(const [vertex,assignment] of expanded){
      const boneIndex=indexByName.get(assignment.boneName);
      if(boneIndex==null)throw new Error(`割り当て先のボーンが見つかりません: ${assignment.boneName}`);
      const strength=THREE.MathUtils.clamp(assignment.strength,0,1),offset=vertex*boneCount;
      for(let b=0;b<boneCount;b++)dense[offset+b]*=(1-strength);
      dense[offset+boneIndex]+=strength;
      normalizeWeights(dense,offset,boneCount);
    }
  }
  const skinIndex=new Uint16Array(count*4),skinWeight=new Float32Array(count*4);
  for(let v=0;v<count;v++){
    const offset=v*boneCount,candidates=[];
    for(let b=0;b<boneCount;b++)if(dense[offset+b]>1e-6)candidates.push([b,dense[offset+b]]);
    candidates.sort((a,b)=>b[1]-a[1]);
    const top=candidates.slice(0,4);let sum=top.reduce((total,item)=>total+item[1],0);
    if(sum<=1e-8){top.push([0,1]);sum=1;}
    for(let slot=0;slot<4;slot++){
      const item=top[slot]||[0,0];skinIndex[v*4+slot]=item[0];skinWeight[v*4+slot]=item[1]/sum;
    }
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return {geometry,armSurfaceComponentCount,footRegionVertexCount};
}

function unifyAdjacentMeshSeamWeights(entries,boneCount,rootSize){
  const tolerance=Math.max(rootSize*1e-4,1e-5),toleranceSq=tolerance*tolerance;
  const refs=[];
  for(let entryIndex=0;entryIndex<entries.length;entryIndex++){
    const entry=entries[entryIndex];if(!entry.generated)continue;
    for(let vertex=0;vertex<entry.rootPositions.length/3;vertex++)refs.push({entryIndex,vertex});
  }
  const parent=new Int32Array(refs.length);for(let i=0;i<parent.length;i++)parent[i]=i;
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const join=(a,b)=>{const ra=root(a),rb=root(b);if(ra!==rb)parent[Math.max(ra,rb)]=Math.min(ra,rb);};
  const cells=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
  for(let refIndex=0;refIndex<refs.length;refIndex++){
    const ref=refs[refIndex],positions=entries[ref.entryIndex].rootPositions,offset=ref.vertex*3;
    const px=positions[offset],py=positions[offset+1],pz=positions[offset+2];
    const cx=Math.floor(px/tolerance),cy=Math.floor(py/tolerance),cz=Math.floor(pz/tolerance);
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      const candidates=cells.get(key(cx+x,cy+y,cz+z));if(!candidates)continue;
      for(const otherIndex of candidates){
        const other=refs[otherIndex];if(other.entryIndex===ref.entryIndex)continue;
        const otherPositions=entries[other.entryIndex].rootPositions,otherOffset=other.vertex*3;
        const dx=px-otherPositions[otherOffset],dy=py-otherPositions[otherOffset+1],dz=pz-otherPositions[otherOffset+2];
        if(dx*dx+dy*dy+dz*dz<=toleranceSq)join(refIndex,otherIndex);
      }
    }
    const cell=key(cx,cy,cz);if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push(refIndex);
  }
  const groups=new Map();
  for(let i=0;i<refs.length;i++){const r=root(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(refs[i]);}
  let seamCount=0;
  for(const group of groups.values()){
    if(group.length<2)continue;
    const sums=new Float64Array(boneCount);let rigidBone=-1,rigidStrength=0;
    for(const ref of group){
      const entry=entries[ref.entryIndex],index=entry.generated.geometry.getAttribute('skinIndex'),weight=entry.generated.geometry.getAttribute('skinWeight');
      const assignment=protectedVertices.get(entry)?.get(ref.vertex),assignedBone=assignment?BONE_DEFS.findIndex(bone=>bone.name===assignment.boneName):-1;
      if(assignment&&assignment.strength>=0.999&&assignedBone>=0&&assignment.strength>rigidStrength){rigidBone=assignedBone;rigidStrength=assignment.strength;}
      for(let slot=0;slot<4;slot++)sums[index.array[ref.vertex*4+slot]]+=weight.array[ref.vertex*4+slot]/group.length;
    }
    let values;
    if(rigidBone>=0){values=[[rigidBone,1]];}
    else{
      values=Array.from(sums, (value,bone)=>[bone,value]).filter(item=>item[1]>1e-7).sort((a,b)=>b[1]-a[1]).slice(0,4);
      let sum=values.reduce((total,item)=>total+item[1],0);
      if(sum<=1e-8){values=[[0,1]];sum=1;}
      for(const item of values)item[1]/=sum;
    }
    for(const ref of group){
      const geometry=entries[ref.entryIndex].generated.geometry,index=geometry.getAttribute('skinIndex'),weight=geometry.getAttribute('skinWeight');
      for(let slot=0;slot<4;slot++){
        const item=values[slot]||[0,0];index.array[ref.vertex*4+slot]=item[0];weight.array[ref.vertex*4+slot]=item[1];
      }
      index.needsUpdate=true;weight.needsUpdate=true;
    }
    seamCount++;
  }
  return seamCount;
}

async function generateRigAndWeights(){
  if(!modelRoot||modelEntries.length===0){setStatus('先にモデルを読み込んでください。');return;}
  const missing=BONE_DEFS.filter(b=>!b.position);
  if(missing.length){activeBoneName=missing[0].name;renderBoneList();setStatus(`未配置の関節があります。${missing[0].label}から配置してください。`);return;}
  if(generateButton.disabled)return;
  generateButton.disabled=true;
  if(placeMode){placeMode=false;placeButton.textContent='位置を置く：OFF';controls.enabled=true;}
  setProtectMode(false);
  setStatus('ボーンとウェイトを生成しています…');
  await new Promise(resolve=>requestAnimationFrame(resolve));
  try{
    const rigRoot=new THREE.Group();rigRoot.name='GeneratedRig';modelRoot.add(rigRoot);
    if(generatedRig){
      modelRoot.remove(generatedRig);
      for(const entry of modelEntries){
        if(entry.generated){entry.generated.parent?.remove(entry.generated);entry.generated.geometry.dispose();entry.generated=null;}
        entry.mesh.visible=true;
      }
    }
    for(const def of BONE_DEFS){def.bone=new THREE.Bone();def.bone.name=def.name;}
    for(const def of BONE_DEFS){
      if(def.parent){const parent=boneByName(def.parent);parent.bone.add(def.bone);def.bone.position.copy(def.position).sub(parent.position);}
      else{rigRoot.add(def.bone);def.bone.position.copy(def.position);}
    }
    generatedRig=rigRoot;
    modelRoot.updateMatrixWorld(true);
    const bones=BONE_DEFS.map(def=>def.bone);
    const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
    const bounds=modelLocalBounds(),rootSize=bounds.getSize(new THREE.Vector3()).length();
    let armSurfaceComponentCount=0,footRegionVertexCount=0;
    for(const entry of modelEntries){
      const old=entry.mesh,parent=old.parent,result=await generateMeshWeights(entry,bones,rootSize),geometry=result.geometry;
      armSurfaceComponentCount+=result.armSurfaceComponentCount;
      footRegionVertexCount+=result.footRegionVertexCount;
      const skinned=new THREE.SkinnedMesh(geometry,entry.material);
      skinned.name=old.name;skinned.castShadow=old.castShadow;skinned.receiveShadow=old.receiveShadow;
      skinned.frustumCulled=false;skinned.matrix.copy(old.matrix);skinned.matrixAutoUpdate=old.matrixAutoUpdate;
      skinned.position.copy(old.position);skinned.quaternion.copy(old.quaternion);skinned.scale.copy(old.scale);
      skinned.renderOrder=old.renderOrder;skinned.layers.mask=old.layers.mask;
      parent.add(skinned);skinned.updateWorldMatrix(true,false);skinned.bind(skeleton,skinned.matrixWorld.clone());
      old.visible=false;entry.generated=skinned;
    }
    for(const def of BONE_DEFS){
      const marker=def.marker;
      if(marker)marker.visible=true;
    }
    modelRoot.updateMatrixWorld(true);
    const unifiedSeams=unifyAdjacentMeshSeamWeights(modelEntries,BONE_DEFS.length,rootSize);
    exportButton.disabled=false;
    const assignedCount=[...protectedVertices.values()].reduce((sum,map)=>sum+map.size,0);
    const phoneLiteMeshes=modelEntries.filter(entry=>window.matchMedia('(max-width:760px)').matches&&entry.geometry.attributes.position.count>60000).length;
    const phoneNote=phoneLiteMeshes?` スマホ向けに高密度Mesh ${phoneLiteMeshes}個はメモリ保護のため表面平滑化を省きました。`:'';
    setStatus(`リギングを生成しました。腕・袖パーツ${armSurfaceComponentCount}個を判定し、足先${footRegionVertexCount.toLocaleString()}頂点を足首ボーンへ割り当てました。隣接メッシュの継ぎ目${unifiedSeams}か所のウェイトを揃え、部位指定した${assignedCount.toLocaleString()}頂点を優先しました。${phoneNote}足首を動かして確認してからGLBを保存してください。`);
  }catch(error){
    console.error(error);setStatus(`生成に失敗しました: ${error.message||error}`);
  }finally{generateButton.disabled=false;}
}
generateButton.addEventListener('click',generateRigAndWeights);

async function exportGlb(){
  if(!modelRoot)return;
  exportButton.disabled=true;setStatus('GLBを書き出しています…');
  const wasRegionVisible=Boolean(regionObject?.visible);
  if(wasRegionVisible)regionObject.visible=false;
  try{
    modelRoot.updateMatrixWorld(true);
    const data=await new GLTFExporter().parseAsync(modelRoot,{binary:true,onlyVisible:true});
    const blob=new Blob([data],{type:'model/gltf-binary'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=`${sourceName}_rigged.glb`;anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    setStatus('リギング済みGLBをダウンロードしました。ファイルは端末内に保存されています。');
  }catch(error){console.error(error);setStatus(`書き出しに失敗しました: ${error.message||error}`);}
  finally{if(wasRegionVisible&&regionObject)regionObject.visible=true;exportButton.disabled=false;}
}
exportButton.addEventListener('click',exportGlb);

function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}
animate();
