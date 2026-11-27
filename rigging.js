import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { createAiSkeletonTools } from './ai-skeleton.js?v=ai-basic19-arm-arrow-tips-20261126';
import { createWeightingTools } from './weighting.js?v=weighting-crease-aware-surface-20261127';

const BONE_DEFS = [
  ['hip','腰',null], ['supine','胴の付け根','hip'], ['chest','胸','supine'],
  ['neck','首','chest'], ['head','頭','neck'],
  ['LeftShoulder','左肩','chest'], ['LeftUpperArm','左上腕（肩〜ひじ）','LeftShoulder'],
  ['LeftElbow','左ひじ','LeftUpperArm'], ['LeftWrist','左手首','LeftElbow'],
  ['RightShoulder','右肩','chest'], ['RightUpperArm','右上腕（肩〜ひじ）','RightShoulder'],
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
const weightPaintBone = document.querySelector('#weight-paint-bone');
const weightPaintModeSelect = document.querySelector('#weight-paint-mode');
const weightPaintStrength = document.querySelector('#weight-paint-strength');
const weightPaintStrengthValue = document.querySelector('#weight-paint-strength-value');
const weightPaintRadius = document.querySelector('#weight-paint-radius');
const weightPaintRadiusValue = document.querySelector('#weight-paint-radius-value');
const weightPaintToggle = document.querySelector('#weight-paint-toggle');
const weightPaintUndo = document.querySelector('#weight-paint-undo');
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
const weightPaintOverlayGroup = new THREE.Group();
scene.add(weightPaintOverlayGroup);
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
let mobilePoseTaskPromise = null;
let protectMode = false;
let protectedVertices = new Map();
let weightPaintMode = false;
let weightPaintUndoStack = [];
let activeWeightStroke = null;
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
function refreshWeightPaintControls(){
  if(!weightPaintBone)return;
  const previous=weightPaintBone.value;
  weightPaintBone.replaceChildren();
  for(const bone of BONE_DEFS){const option=document.createElement('option');option.value=bone.name;option.textContent=bone.label;weightPaintBone.append(option);}
  weightPaintBone.value=BONE_DEFS.some(bone=>bone.name===previous)?previous:(activeBoneName||BONE_DEFS[0]?.name||'');
  const ready=Boolean(generatedRig&&modelEntries.some(entry=>entry.generated));
  weightPaintBone.disabled=!ready;weightPaintStrength.disabled=!ready||weightPaintModeSelect.value==='remove';weightPaintRadius.disabled=!ready;
  weightPaintToggle.disabled=!ready;weightPaintUndo.disabled=!ready||weightPaintUndoStack.length===0;
}
renderBoneList();
refreshWeightPaintControls();

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
  setWeightPaintMode(false);
  weightPaintUndoStack=[];activeWeightStroke=null;
  protectedVertices = new Map();
  controls.enabled = true;
  regionTransform.detach();
  regionObject = null;
  regionModelBounds = null;
  regionToggle.textContent = '範囲ボックスを表示';
  placeButton.textContent = '位置を置く：OFF';
  protectToggle.textContent = '固定領域を塗る：OFF';
  refreshWeightPaintControls();
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
  for(const child of [...weightPaintOverlayGroup.children]){weightPaintOverlayGroup.remove(child);child.geometry?.dispose();child.material?.dispose();}
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
      if(!entry.geometry.attributes.normal)entry.geometry.computeVertexNormals();
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

const aiSkeleton=createAiSkeletonTools({
  THREE,
  getModelRoot:()=>modelRoot,
  getModelEntries:()=>modelEntries,
  modelLocalBounds,
  setStatus,
  isMobileDevice:IS_MOBILE_DEVICE,
  templateBones:TEMPLATE_BONES
});

const weighting=createWeightingTools({
  THREE,
  BONE_DEFS,
  modelLocalBounds,
  makeSurfaceDiffusionGraph,
  classifyArmSurfaceComponents,
  coincidentVertexGroups,
  getProtectedVertices:()=>protectedVertices,
  setStatus
});

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
  const at = (name, px, py, pz= center.z) => {
    const bone=boneByName(name);
    bone.position=new THREE.Vector3(px,py,pz);
    bone.surfacePoint=null;bone.surfaceNormal=null;
  };
  at('hip',center.x,y(.46)); at('supine',center.x,y(.54)); at('chest',center.x,y(.62)); at('neck',center.x,y(.70)); at('head',center.x,y(.78));
  const armReach=Math.min(w*0.49,h*0.36),shoulderOffset=Math.min(w*0.16,h*0.075),legSpacing=Math.min(w*0.09,h*0.04);
  for (const [side,prefix] of [[1,'Left'],[-1,'Right']]) {
    const shoulder=new THREE.Vector3(center.x+side*shoulderOffset,y(.68),center.z);
    const wrist=new THREE.Vector3(center.x+side*armReach,y(.54),center.z);
    at(prefix+'Shoulder',shoulder.x,shoulder.y,shoulder.z);
    // Match the shoulder-side arrow tips in the rigging reference: the upper
    // arm point sits early in the sleeve and the elbow stays near the joint.
    boneByName(prefix+'UpperArm').position=shoulder.clone().lerp(wrist,0.25);
    const elbow=shoulder.clone().lerp(wrist,0.55);
    at(prefix+'Elbow',elbow.x,elbow.y,elbow.z);
    at(prefix+'Wrist',wrist.x,wrist.y,wrist.z);
    at(prefix+'UpperLeg',center.x+side*legSpacing,y(.40));
    at(prefix+'Knee',center.x+side*legSpacing,y(.18));
    at(prefix+'Ankle',center.x+side*legSpacing,y(.03));
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

function captureWeightStrokeVertex(entry,vertex){
  if(!activeWeightStroke)return;
  let vertices=activeWeightStroke.vertices.get(entry);if(!vertices){vertices=new Map();activeWeightStroke.vertices.set(entry,vertices);}
  if(vertices.has(vertex))return;
  const index=entry.generated.geometry.getAttribute('skinIndex'),weight=entry.generated.geometry.getAttribute('skinWeight'),offset=vertex*4;
  vertices.set(vertex,{indices:Array.from(index.array.subarray(offset,offset+4)),weights:Array.from(weight.array.subarray(offset,offset+4))});
}

function paintGeneratedWeights(clientX,clientY){
  const hit=pickSurface(clientX,clientY);if(!hit)return 0;
  const entry=modelEntries.find(item=>item.generated===hit.object);if(!entry?.generated)return 0;
  const boneIndex=BONE_DEFS.findIndex(bone=>bone.name===weightPaintBone.value);if(boneIndex<0)return 0;
  const geometry=entry.generated.geometry,index=geometry.getAttribute('skinIndex'),weight=geometry.getAttribute('skinWeight');
  const positions=entry.rootPositions,normals=entry.rootNormals,center=modelRoot.worldToLocal(hit.point.clone());
  const radius=Math.max(modelLocalBounds().getSize(new THREE.Vector3()).length()*Number(weightPaintRadius.value)/100,1e-5),radiusSq=radius*radius;
  const hitNormal=hit.face?hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)):new THREE.Vector3(0,0,1);
  hitNormal.applyMatrix3(new THREE.Matrix3().getNormalMatrix(modelRoot.matrixWorld.clone().invert())).normalize();
  const strength=Number(weightPaintStrength.value)/100,paintOperation=weightPaintModeSelect.value;
  let changed=0;
  for(let vertex=0;vertex<positions.length/3;vertex++){
    const dx=positions[vertex*3]-center.x,dy=positions[vertex*3+1]-center.y,dz=positions[vertex*3+2]-center.z,distanceSq=dx*dx+dy*dy+dz*dz;
    if(distanceSq>radiusSq)continue;
    if(normals&&normals[vertex*3]*hitNormal.x+normals[vertex*3+1]*hitNormal.y+normals[vertex*3+2]*hitNormal.z<0.15)continue;
    const falloff=(1-Math.sqrt(distanceSq)/radius)**2,amount=strength*falloff;if(paintOperation!=='remove'&&amount<0.005)continue;
    const offset=vertex*4,values=new Map();
    for(let slot=0;slot<4;slot++){const id=index.array[offset+slot],value=weight.array[offset+slot];if(value>1e-7)values.set(id,(values.get(id)||0)+value);}
    const old=values.get(boneIndex)||0;
    if(paintOperation!=='add'&&old<=1e-7)continue;
    if(paintOperation==='add'){
      const next=old+(1-old)*amount;
      if(!values.has(boneIndex)&&values.size>=4){const weakest=[...values].sort((a,b)=>a[1]-b[1])[0];if(weakest[1]>=next)continue;values.delete(weakest[0]);}
      const remaining=[...values].filter(([id])=>id!==boneIndex),remainingSum=remaining.reduce((sum,item)=>sum+item[1],0);
      values.set(boneIndex,next);const scale=remainingSum>1e-8?(1-next)/remainingSum:0;
      for(const [id,value] of remaining)values.set(id,value*scale);
    }else if(paintOperation==='remove'){
      values.delete(boneIndex);
      const remaining=[...values],remainingSum=remaining.reduce((sum,item)=>sum+item[1],0);
      if(remainingSum>1e-8){for(const [id,value] of remaining)values.set(id,value/remainingSum);}
      else{
        const parentName=BONE_DEFS[boneIndex].parent;
        let fallbackIndex=parentName?BONE_DEFS.findIndex(bone=>bone.name===parentName):-1;
        if(fallbackIndex<0||fallbackIndex===boneIndex){
          const pointX=positions[vertex*3],pointY=positions[vertex*3+1],pointZ=positions[vertex*3+2];let nearest=Infinity;
          for(let candidate=0;candidate<BONE_DEFS.length;candidate++){
            if(candidate===boneIndex||!BONE_DEFS[candidate].position)continue;
            const joint=BONE_DEFS[candidate].position,dx=joint.x-pointX,dy=joint.y-pointY,dz=joint.z-pointZ,distance=dx*dx+dy*dy+dz*dz;
            if(distance<nearest){nearest=distance;fallbackIndex=candidate;}
          }
        }
        if(fallbackIndex<0)continue;
        values.set(fallbackIndex,1);
      }
    }else{
      const next=old*(1-amount),removed=old-next;values.set(boneIndex,next);
      const remaining=[...values].filter(([id])=>id!==boneIndex),remainingSum=remaining.reduce((sum,item)=>sum+item[1],0);
      if(remainingSum<=1e-8)continue;
      for(const [id,value] of remaining)values.set(id,value+removed*value/remainingSum);
    }
    const top=[...values].filter(([,value])=>value>1e-7).sort((a,b)=>b[1]-a[1]).slice(0,4);let sum=top.reduce((total,item)=>total+item[1],0);
    if(sum<=1e-8)continue;
    captureWeightStrokeVertex(entry,vertex);
    for(let slot=0;slot<4;slot++){const item=top[slot]||[0,0];index.array[offset+slot]=item[0];weight.array[offset+slot]=item[1]/sum;}
    changed++;
  }
  if(changed){index.needsUpdate=true;weight.needsUpdate=true;entry.generated.computeBoundingSphere();}
  return changed;
}

function refreshWeightPaintOverlay(){
  for(const child of [...weightPaintOverlayGroup.children]){weightPaintOverlayGroup.remove(child);child.geometry?.dispose();child.material?.dispose();}
  if(!weightPaintMode||!generatedRig)return;
  modelRoot.updateMatrixWorld(true);
  const selectedBone=BONE_DEFS.findIndex(bone=>bone.name===weightPaintBone.value);if(selectedBone<0)return;
  const repainted=new Map();
  const selectedBoneName=weightPaintBone.value;
  const includeStroke=stroke=>{
    if(!stroke||stroke.boneName!==selectedBoneName)return;
    for(const [entry,vertices] of stroke.vertices){let set=repainted.get(entry);if(!set){set=new Set();repainted.set(entry,set);}for(const vertex of vertices.keys())set.add(vertex);}
  };
  for(const stroke of weightPaintUndoStack)includeStroke(stroke);
  includeStroke(activeWeightStroke);
  const diagonal=modelLocalBounds().getSize(new THREE.Vector3()).length();
  const pointSize=Math.max(diagonal*0.007,0.004);
  const vertexPosition=new THREE.Vector3();
  for(const entry of modelEntries){
    const mesh=entry.generated;if(!mesh)continue;
    const geometry=mesh.geometry,index=geometry.getAttribute('skinIndex'),weight=geometry.getAttribute('skinWeight');
    const touched=repainted.get(entry)||new Set(),influencePositions=[],influenceColors=[],paintedPositions=[];
    for(let vertex=0;vertex<index.count;vertex++){
      mesh.localToWorld(vertexPosition.fromBufferAttribute(geometry.getAttribute('position'),vertex));
      if(touched.has(vertex)){paintedPositions.push(vertexPosition.x,vertexPosition.y,vertexPosition.z);continue;}
      let current=0;const offset=vertex*4;
      for(let slot=0;slot<4;slot++)if(index.array[offset+slot]===selectedBone)current+=weight.array[offset+slot];
      if(current<0.05)continue;
      influencePositions.push(vertexPosition.x,vertexPosition.y,vertexPosition.z);
      const shade=Math.min(1,current);
      influenceColors.push(1,0.18+0.55*(1-shade),0.04+0.08*(1-shade));
    }
    if(influencePositions.length){
      const pointsGeometry=new THREE.BufferGeometry();pointsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(influencePositions,3));pointsGeometry.setAttribute('color',new THREE.Float32BufferAttribute(influenceColors,3));
      const points=new THREE.Points(pointsGeometry,new THREE.PointsMaterial({size:pointSize,sizeAttenuation:true,vertexColors:true,depthTest:false,transparent:true,opacity:0.85}));points.renderOrder=30;weightPaintOverlayGroup.add(points);
    }
    if(paintedPositions.length){
      const pointsGeometry=new THREE.BufferGeometry();pointsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(paintedPositions,3));
      const points=new THREE.Points(pointsGeometry,new THREE.PointsMaterial({color:0x42e8ff,size:pointSize*1.25,sizeAttenuation:true,depthTest:false,transparent:true,opacity:1}));points.renderOrder=31;weightPaintOverlayGroup.add(points);
    }
  }
}

function setWeightPaintMode(enabled){
  weightPaintMode=Boolean(enabled&&generatedRig&&modelEntries.some(entry=>entry.generated));
  if(weightPaintMode){
    if(protectMode)setProtectMode(false);
    if(placeMode){placeMode=false;placeButton.textContent='位置を置く：OFF';placeButton.style.background='';}
    if(regionObject?.visible)setRegionVisible(false);
  }
  controls.enabled=!weightPaintMode&&!protectMode&&!placeMode;
  weightPaintToggle.textContent=`ウェイトを塗る：${weightPaintMode?'ON':'OFF'}`;
  weightPaintToggle.style.background=weightPaintMode?'#79421e':'';
  viewHelp.textContent=weightPaintMode?'モデル表面をドラッグしてウェイトを塗ります。操作をOFFにすると視点を回せます。':'ドラッグで視点を回転できます。';
  pointerStart=null;activeWeightStroke=null;
  refreshWeightPaintOverlay();
}

function finishWeightPaintStroke(){
  if(activeWeightStroke?.vertices.size){
    weightPaintUndoStack.push(activeWeightStroke);if(weightPaintUndoStack.length>12)weightPaintUndoStack.shift();
    let count=0;for(const vertices of activeWeightStroke.vertices.values())count+=vertices.size;
    setStatus(`${weightPaintBone.selectedOptions[0]?.textContent||'選択ボーン'}のウェイトを${count.toLocaleString()}頂点塗り直しました。必要なら直前の塗りを戻せます。`);
  }
  activeWeightStroke=null;refreshWeightPaintControls();refreshWeightPaintOverlay();
}

function undoWeightPaint(){
  const stroke=weightPaintUndoStack.pop();if(!stroke)return;
  for(const [entry,vertices] of stroke.vertices){
    if(!entry.generated)continue;
    const index=entry.generated.geometry.getAttribute('skinIndex'),weight=entry.generated.geometry.getAttribute('skinWeight');
    for(const [vertex,snapshot] of vertices){const offset=vertex*4;for(let slot=0;slot<4;slot++){index.array[offset+slot]=snapshot.indices[slot];weight.array[offset+slot]=snapshot.weights[slot];}}
    index.needsUpdate=true;weight.needsUpdate=true;entry.generated.computeBoundingSphere();
  }
  refreshWeightPaintControls();refreshWeightPaintOverlay();setStatus(`${boneByName(stroke.boneName)?.label||'ボーン'}の直前の塗りを戻しました。`);
}

function setProtectMode(enabled) {
  protectMode=enabled;lastPaintKey=null;lastPaintAt=0;
  if(enabled&&weightPaintMode)setWeightPaintMode(false);
  if(enabled&&placeMode){placeMode=false;placeButton.textContent='位置を置く：OFF';placeButton.style.background='';}
  if(enabled&&regionObject?.visible)setRegionVisible(false);
  controls.enabled=!enabled&&!placeMode&&!weightPaintMode;
  protectToggle.textContent=`固定領域を塗る：${enabled?'ON':'OFF'}`;
  protectToggle.style.background=enabled?'#79421e':'';
  viewHelp.textContent=enabled?'角・髪などをドラッグして塗ります。塗った部分は選択ボーンに100%固定されます。':'ドラッグで視点を回転できます。';
  pointerStart=null;
}

protectToggle.addEventListener('click',()=>setProtectMode(!protectMode));
protectedBoneSelect.addEventListener('change',()=>setStatus(`${protectedBoneSelect.selectedOptions[0]?.textContent||'選択ボーン'}へ、次に塗る頂点を固定します。`));
protectBrush.addEventListener('input',()=>protectBrushValue.textContent=`${Number(protectBrush.value).toFixed(1)}%`);
clearProtectedButton.addEventListener('click',()=>{protectedVertices.clear();for(const entry of modelEntries)updateProtectedOverlay(entry);refreshProtectedBoneOptions();setStatus('部位ごとのウェイト指定をすべて消しました。');});
weightPaintToggle.addEventListener('click',()=>setWeightPaintMode(!weightPaintMode));
weightPaintUndo.addEventListener('click',undoWeightPaint);
weightPaintModeSelect.addEventListener('change',refreshWeightPaintControls);
weightPaintRadius.addEventListener('input',()=>weightPaintRadiusValue.textContent=`${Number(weightPaintRadius.value).toFixed(1)}%`);
weightPaintStrength.addEventListener('input',()=>weightPaintStrengthValue.textContent=`${Number(weightPaintStrength.value)}%`);
weightPaintBone.addEventListener('change',()=>{refreshWeightPaintControls();refreshWeightPaintOverlay();setStatus(`${weightPaintBone.selectedOptions[0]?.textContent||'ボーン'}を選択しました。橙色は現在の影響、青色はこのボーンで塗った範囲です。`);});

function positionInsideFromSurface(bone) {
  if(!bone.surfacePoint||!bone.surfaceNormal)return;
  const worldHeight=modelLocalBounds().getSize(new THREE.Vector3()).y*modelRoot.getWorldScale(new THREE.Vector3()).y;
  const depth=worldHeight*(Number(boneDepth.value)/100);
  const point=bone.surfacePoint.clone().addScaledVector(bone.surfaceNormal,-depth);
  bone.position=localPoint(point);
}

renderer.domElement.addEventListener('pointerdown',event => {
  pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};lastPaintKey=null;lastPaintAt=0;
  if(weightPaintMode){activeWeightStroke={boneName:weightPaintBone.value,vertices:new Map()};renderer.domElement.setPointerCapture(event.pointerId);paintGeneratedWeights(event.clientX,event.clientY);return;}
  if(protectMode)renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove',event=>{
  if(weightPaintMode&&pointerStart&&pointerStart.id===event.pointerId){
    if(performance.now()-lastPaintAt<35)return;lastPaintAt=performance.now();paintGeneratedWeights(event.clientX,event.clientY);return;
  }
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
  if(weightPaintMode){if(distance<=8)paintGeneratedWeights(event.clientX,event.clientY);finishWeightPaintStroke();return;}
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
renderer.domElement.addEventListener('pointercancel',event=>{
  if(!pointerStart||pointerStart.id!==event.pointerId)return;
  if(weightPaintMode)finishWeightPaintStroke();
  pointerStart=null;
});

boneDepth.addEventListener('input',()=>{
  boneDepthValue.textContent=`${Number(boneDepth.value)}%`;
  const bone=boneByName(activeBoneName);
  if(bone?.surfacePoint){positionInsideFromSurface(bone);updateMarkers();}
});

placeButton.addEventListener('click',()=>{
  placeMode=!placeMode;
  if(placeMode&&weightPaintMode)setWeightPaintMode(false);
  if(placeMode&&protectMode)setProtectMode(false);
  placeButton.textContent=`位置を置く：${placeMode?'ON':'OFF'}`;
  placeButton.style.background=placeMode?'#176b75':'';
  controls.enabled=!placeMode&&!protectMode&&!weightPaintMode;
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
  let surfaceNormals=geometry.attributes.normal;
  if(!surfaceNormals){geometry.computeVertexNormals();surfaceNormals=geometry.attributes.normal;}
  const normalValues=surfaceNormals?new Float32Array(vertexCount*3):null;
  if(normalValues){
    for(let vertex=0;vertex<vertexCount;vertex++){
      normalValues[vertex*3]=surfaceNormals.getX(vertex);
      normalValues[vertex*3+1]=surfaceNormals.getY(vertex);
      normalValues[vertex*3+2]=surfaceNormals.getZ(vertex);
      if(vertex>0&&vertex%16384===0)await new Promise(resolve=>requestAnimationFrame(resolve));
    }
  }
  const creaseFactor=(a,b)=>{
    if(!normalValues)return 1;
    const alignment=THREE.MathUtils.clamp(
      normalValues[a*3]*normalValues[b*3]+normalValues[a*3+1]*normalValues[b*3+1]+normalValues[a*3+2]*normalValues[b*3+2],-1,1
    );
    // Let weights smooth freely over a gently curved surface, but reduce
    // diffusion across sharp creases such as sleeve/body and garment seams.
    return 0.08+0.92*THREE.MathUtils.clamp((alignment-0.15)/0.75,0,1);
  };
  for(let v=0;v<vertexCount;v++){
    rows[v]=new Map();
    if(v>0&&v%4096===0)await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  const index=geometry.index?.array;
  const count=index?index.length:vertexCount;
  const at=i=>index?index[i]:i;
  const add=(a,b,weight)=>{
    if(a===b||!Number.isFinite(weight)||weight<=0)return;
    const crease=creaseFactor(a,b),adjusted=weight*crease;
    rows[a].set(b,(rows[a].get(b)||0)+adjusted);
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
  const coreSegments=segments.filter(segment=>segment.isCore&&!segment.isArmInfluence);
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
    if(centerArmDistance<=rootSize*0.27&&centerArmDistance<=centerCoreDistance+rootSize*0.025)flags[component]=1;
  }
  return flags;
}

function coincidentVertexGroups(positions, scale, normals=null) {
  const vertexCount=positions.length/3,tolerance=Math.max(1e-6,scale*1e-5), toleranceSq=tolerance*tolerance;
  const cells=new Map(),parent=new Int32Array(vertexCount);for(let i=0;i<vertexCount;i++)parent[i]=i;
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const key=(x,y,z)=>`${x},${y},${z}`;
  for(let i=0;i<vertexCount;i++){
    const px=positions[i*3],py=positions[i*3+1],pz=positions[i*3+2];
    const cx=Math.floor(px/tolerance),cy=Math.floor(py/tolerance),cz=Math.floor(pz/tolerance);
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      const list=cells.get(key(cx+x,cy+y,cz+z));if(!list)continue;
      for(const j of list){
        const dx=px-positions[j*3],dy=py-positions[j*3+1],dz=pz-positions[j*3+2];
        if(dx*dx+dy*dy+dz*dz>toleranceSq)continue;
        if(normals){
          const dot=normals[i*3]*normals[j*3]+normals[i*3+1]*normals[j*3+1]+normals[i*3+2]*normals[j*3+2];
          if(dot<0.15)continue;
        }
        let a=root(i),b=root(j);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);
      }
    }
    const k=key(cx,cy,cz);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);
  }
  const groups=new Map();
  for(let i=0;i<vertexCount;i++){const r=root(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
  return Array.from(groups.values()).filter(group=>group.length>1);
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

function placeMobileFallbackRig(){
  const bounds=modelLocalBounds(),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const h=Math.max(size.y,0.001),w=Math.max(size.x,0.001);
  const y=ratio=>bounds.min.y+h*ratio;
  // Wide sleeves and hats can dominate the model bounds. Use the same
  // height-limited arm reach as the regular 19-joint placement instead of
  // putting wrists at the outer edge of the costume.
  const armReach=Math.min(w*0.44,h*0.32),shoulderOffset=Math.min(w*0.14,h*0.07);
  const legSpacing=Math.min(w*0.09,h*0.04);
  const set=(name,px,py)=>{const bone=boneByName(name);bone.position=new THREE.Vector3(px,py,center.z);};
  // Keep mobile fallback at the same body-relative heights as the standard
  // 19-joint rig; the previous elevated values pulled the whole chain upward.
  set('hip',center.x,y(.46));set('supine',center.x,y(.54));set('chest',center.x,y(.62));set('neck',center.x,y(.70));set('head',center.x,y(.78));
  for(const [side,prefix] of [[1,'Left'],[-1,'Right']]){
    const shoulder=new THREE.Vector3(center.x+side*shoulderOffset,y(.68),center.z);
    const wrist=new THREE.Vector3(center.x+side*armReach,y(.54),center.z);
    boneByName(prefix+'Shoulder').position=shoulder;
    boneByName(prefix+'UpperArm').position=shoulder.clone().lerp(wrist,0.25);
    boneByName(prefix+'Elbow').position=shoulder.clone().lerp(wrist,0.55);
    boneByName(prefix+'Wrist').position=wrist;
    set(prefix+'UpperLeg',center.x+side*legSpacing,y(.40));
    set(prefix+'Knee',center.x+side*legSpacing,y(.18));
    set(prefix+'Ankle',center.x+side*legSpacing,y(.03));
  }
}

async function estimateMobileTemplateRig(){
  restoreTemplateBoneDefs();
  placeMobileFallbackRig();
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
    camera.up.set(0,1,0);camera.position.set(worldCenter.x,worldCenter.y,worldCenter.z+maxSize*1.75);camera.lookAt(worldCenter);camera.updateMatrixWorld(true);
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
  const ray=new THREE.Raycaster();
  const inwardOffset=maxSize*0.008;
  const toModelPoint=(index,name)=>{
    const landmark=pose[index];
    if(!landmark||Math.min(landmark.visibility??1,landmark.presence??1)<0.2
      ||!Number.isFinite(landmark.x)||!Number.isFinite(landmark.y)
      ||landmark.x<0||landmark.x>1||landmark.y<0||landmark.y>1)return null;
    ray.setFromCamera(new THREE.Vector2(landmark.x*2-1,1-landmark.y*2),projectionCamera);
    // Project onto the rendered model surface. Intersecting a single center
    // plane made perspective rays expand at the model's depth, pushing hands
    // and feet outside the silhouette, especially on a tall phone viewport.
    const hits=ray.intersectObjects(modelRoot.children,true);
    const hit=hits.find(candidate=>candidate.object.isMesh&&candidate.face);
    if(hit){
      const world=hit.point.clone();
      const normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
      world.addScaledVector(normal,-inwardOffset);
      const local=modelRoot.worldToLocal(world);
      const marginX=size.x*0.025,marginY=size.y*0.025,marginZ=size.z*0.025;
      const insideBounds=local.x>=bounds.min.x-marginX&&local.x<=bounds.max.x+marginX
        &&local.y>=bounds.min.y-marginY&&local.y<=bounds.max.y+marginY
        &&local.z>=bounds.min.z-marginZ&&local.z<=bounds.max.z+marginZ;
      // Reject confident but anatomically implausible hits (for example a
      // wrist detected on a far-away sleeve edge) and use the safe template.
      if(!insideBounds||local.distanceTo(fallback.get(name))>maxSize*0.26)return null;
      return local;
    }
    // A landmark outside the silhouette has no valid surface point. Let the
    // per-joint fallback handle it instead of projecting it onto empty space.
    return null;
  };
  const pick=(index,name)=>toModelPoint(index,name)||fallback.get(name).clone();
  const midpoint=(a,b)=>a.clone().add(b).multiplyScalar(0.5);
  const leftShoulder=pick(11,'LeftShoulder'),rightShoulder=pick(12,'RightShoulder');
  const leftElbow=pick(13,'LeftElbow'),rightElbow=pick(14,'RightElbow');
  const leftWrist=pick(15,'LeftWrist'),rightWrist=pick(16,'RightWrist');
  const leftHip=pick(23,'LeftUpperLeg'),rightHip=pick(24,'RightUpperLeg');
  const leftKnee=pick(25,'LeftKnee'),rightKnee=pick(26,'RightKnee');
  const leftAnkle=pick(27,'LeftAnkle'),rightAnkle=pick(28,'RightAnkle');
  const chest=midpoint(leftShoulder,rightShoulder),hip=midpoint(leftHip,rightHip),nose=pick(0,'head');
  // Pose Lite can mistake a wide sleeve or torso edge for an elbow/wrist and
  // collapse one arm toward the chest. Blend its 2D result with the model
  // proportions, then enforce a minimum outward progression for the basic
  // A-pose rig. This still uses the detected vertical placement when valid.
  const refineMobileArm=(side,prefix,shoulder,elbow,wrist)=>{
    const torsoX=fallback.get('chest').x;
    const armReach=Math.abs(fallback.get(`${prefix}Wrist`).x-torsoX);
    const refine=(point,name,minLateral)=>{
      const reference=fallback.get(name);
      const referenceMix=name.endsWith('Wrist')?0.68:name.endsWith('Elbow')?0.58:0.5;
      const value=point.clone().lerp(reference,referenceMix);
      const lateral=(value.x-torsoX)*side,minX=Math.max(armReach*minLateral,size.y*0.025);
      if(lateral<minX)value.x=torsoX+side*minX;
      value.y=THREE.MathUtils.clamp(value.y,reference.y-size.y*0.12,reference.y+size.y*0.02);
      return value;
    };
    const fittedShoulder=refine(shoulder,`${prefix}Shoulder`,0.12);
    const fittedElbow=refine(elbow,`${prefix}Elbow`,0.58);
    const fittedWrist=refine(wrist,`${prefix}Wrist`,0.78);
    return {shoulder:fittedShoulder,upperArm:fittedShoulder.clone().lerp(fittedElbow,0.52),elbow:fittedElbow,wrist:fittedWrist};
  };
  const leftArm=refineMobileArm(1,'Left',leftShoulder,leftElbow,leftWrist);
  const rightArm=refineMobileArm(-1,'Right',rightShoulder,rightElbow,rightWrist);
  const positions=new Map([
    ['hip',hip],['supine',hip.clone().lerp(chest,0.36)],['chest',chest],
    ['neck',chest.clone().lerp(nose,0.62)],['head',nose.clone().add(new THREE.Vector3(0,size.y*0.025,0))],
    ['LeftShoulder',leftArm.shoulder],['LeftUpperArm',leftArm.upperArm],['LeftElbow',leftArm.elbow],['LeftWrist',leftArm.wrist],
    ['RightShoulder',rightArm.shoulder],['RightUpperArm',rightArm.upperArm],['RightElbow',rightArm.elbow],['RightWrist',rightArm.wrist],
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
    const prediction=await aiSkeleton.predictAiSkeleton();
    const candidates=aiSkeleton.buildAiBoneDefs(prediction.tokens,prediction.center,prediction.longest,prediction.bounds);
    const fitted=aiSkeleton.fitAiPredictionToBasic19(candidates);
    const nodes=fitted.bones;
    BONE_DEFS.splice(0,BONE_DEFS.length,...nodes);
    rigMode='ai';activeBoneName=BONE_DEFS[0].name;
    updateMarkers();renderBoneList();
    autoButton.textContent='標準19関節に戻す';
    setStatus(`AI骨格を基本19関節にまとめました（推定点${candidates.length}個のうち${fitted.matched}個を採用）。関節位置を確認し、必要なら修正してからウェイトを生成してください。`);
  }catch(error){
    console.error(error);
    const detail=error.message||String(error);
    const manualNote=detail.includes('手動配置')||detail.includes('ウェイト生成')?'':' 標準19関節の手動配置とウェイト生成は続けて利用できます。';
    setStatus(`AI自動推定に失敗しました: ${detail}${manualNote}`);
  }finally{aiRigButtons.forEach(button=>button.disabled=false);}
}
aiDesktopRigButton.addEventListener('click',()=>runAiAutoRig('desktop'));
aiMobileRigButton.addEventListener('click',()=>runAiAutoRig('mobile'));

async function generateRigAndWeights(){
  if(!modelRoot||modelEntries.length===0){setStatus('先にモデルを読み込んでください。');return;}
  const missing=BONE_DEFS.filter(b=>!b.position);
  if(missing.length){activeBoneName=missing[0].name;renderBoneList();setStatus(`未配置の関節があります。${missing[0].label}から配置してください。`);return;}
  if(generateButton.disabled)return;
  generateButton.disabled=true;
  if(weightPaintMode)setWeightPaintMode(false);
  weightPaintUndoStack=[];activeWeightStroke=null;refreshWeightPaintControls();
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
      const old=entry.mesh,parent=old.parent,result=await weighting.generateMeshWeights(entry,bones,rootSize),geometry=result.geometry;
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
    const unifiedSeams=weighting.unifyAdjacentMeshSeamWeights(modelEntries,BONE_DEFS.length,rootSize);
    exportButton.disabled=false;
    refreshWeightPaintControls();
    refreshWeightPaintOverlay();
    const assignedCount=[...protectedVertices.values()].reduce((sum,map)=>sum+map.size,0);
    const phoneLiteMeshes=modelEntries.filter(entry=>window.matchMedia('(max-width:760px)').matches&&entry.geometry.attributes.position.count>60000).length;
    const phoneNote=phoneLiteMeshes?` スマホ向けに高密度Mesh ${phoneLiteMeshes}個はメモリ保護のため表面平滑化を省きました。`:'';
    setStatus(`リギングを生成しました。腕・袖パーツ${armSurfaceComponentCount}個を判定し、足先${footRegionVertexCount.toLocaleString()}頂点を足首ボーンへ割り当てました。隣接メッシュの継ぎ目${unifiedSeams}か所のウェイトを揃え、部位指定した${assignedCount.toLocaleString()}頂点を優先しました。${phoneNote}足首を動かして確認してからGLBを保存してください。`);
  }catch(error){
    console.error(error);refreshWeightPaintControls();setStatus(`生成に失敗しました: ${error.message||error}`);
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
