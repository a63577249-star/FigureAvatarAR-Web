import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
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
const aiRigButton = document.querySelector('#ai-auto-rig');
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
let generatedRig = null;
let activeBoneName = BONE_DEFS[0].name;
let placeMode = false;
let rigLines = null;
let sourceName = 'avatar';
let pointerStart = null;
let rigMode = 'template';
let aiSessions = null;
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
  generateButton.disabled = !enabled;
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
  const byName = new Map(files.map(file => [decodeURIComponent(file.name), file]));
  const objectUrls = [];
  manager.setURLModifier(url => {
    const clean = decodeURIComponent(url.split(/[?#]/,1)[0].split(/[\\/]/).pop());
    const file = byName.get(clean);
    if (!file) return url;
    const blobUrl = URL.createObjectURL(file);
    objectUrls.push(blobUrl);
    return blobUrl;
  });
  return { manager, release: () => objectUrls.forEach(URL.revokeObjectURL) };
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
    if (/\.obj$/i.test(main.name)) {
      const { manager } = resourceManager(files);
      root = new OBJLoader(manager).parse(await main.text());
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
    setStatus(`${main.name}を読み込みました。${modelEntries.length}個のMeshが見つかりました。関節位置を確認してください。`);
  } catch (error) {
    console.error(error);
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

function makeAdjacency(geometry, vertexCount) {
  const sets=Array.from({length:vertexCount},()=>new Set());
  const index=geometry.index?.array;
  const count=index?index.length:vertexCount;
  const at=i=>index?index[i]:i;
  for(let i=0;i+2<count;i+=3){
    const a=at(i),b=at(i+1),c=at(i+2);
    sets[a].add(b);sets[a].add(c);sets[b].add(a);sets[b].add(c);sets[c].add(a);sets[c].add(b);
  }
  return sets.map(set=>Array.from(set));
}

function coincidentVertexGroups(positions, scale) {
  const vertexCount=positions.length/3,tolerance=Math.max(1e-6,scale*1e-6), toleranceSq=tolerance*tolerance;
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
  return {vertices,normals:sampledNormals,center,longest};
}

function allowedAiToken(logits,coordinateCount,branchCoordinatesRemaining,hasCoordinates){
  const candidates=[];
  for(let token=0;token<256;token++)candidates.push(token);
  if(branchCoordinatesRemaining===0&&coordinateCount%3===0){
    candidates.push(256,260,261,262);
    if(hasCoordinates)candidates.push(258);
  }
  let best=candidates[0],score=-Infinity;
  for(const token of candidates){const value=logits[token];if(value>score){score=value;best=token;}}
  return best;
}

async function loadAiSessions(ort,executionProvider='webgpu'){
  if(aiSessions?.executionProvider===executionProvider)return aiSessions;
  const base='https://huggingface.co/cgb/unirig-skeleton-onnx-webgpu/resolve/main/';
  const options={executionProviders:[executionProvider],graphOptimizationLevel:'all'};
  ort.env.wasm.proxy=false;
  ort.env.wasm.numThreads=1;
  const ortRuntimeBase=new URL('./vendor/onnxruntime-web-1.31.1/',import.meta.url);
  ort.env.wasm.wasmPaths={
    mjs:new URL('ort-wasm-simd-threaded.asyncify.mjs',ortRuntimeBase).href,
    wasm:new URL('ort-wasm-simd-threaded.asyncify.wasm',ortRuntimeBase).href
  };
  const createSession=async(modelName,externalDataName=null,keepOutputsOnGpu=false)=>{
    setStatus(`AIモデルを取得しています: ${modelName}${externalDataName?' と外部データ':''}…`);
    const modelResponse=await fetch(base+modelName);
    if(!modelResponse.ok)throw new Error(`${modelName}の取得に失敗しました（HTTP ${modelResponse.status}）。`);
    const modelBytes=new Uint8Array(await modelResponse.arrayBuffer());
    const sessionOptions={...options};
    if(keepOutputsOnGpu)sessionOptions.preferredOutputLocation='gpu-buffer';
    if(externalDataName){
      const dataResponse=await fetch(base+externalDataName);
      if(!dataResponse.ok)throw new Error(`${externalDataName}の取得に失敗しました（HTTP ${dataResponse.status}）。`);
      sessionOptions.externalData=[{
        path:externalDataName,
        data:new Uint8Array(await dataResponse.arrayBuffer())
      }];
    }
    return ort.InferenceSession.create(modelBytes,sessionOptions);
  };
  const encoder=await createSession('encoder_q8.onnx','encoder_q8.onnx.data');
  setStatus('AIモデルを読み込んでいます…（エンコーダー完了）');
  const embed=await createSession('embed.onnx');
  const decoder=await createSession('decoder_q8.onnx','decoder_q8.onnx.data',executionProvider==='webgpu');
  aiSessions={ort,encoder,embed,decoder,executionProvider};
  return aiSessions;
}

async function predictAiSkeleton(){
  if(!modelRoot||!modelEntries.length)throw new Error('先にモデルを読み込んでください。');
  const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    ||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
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
  const {encoder,embed,decoder}=await loadAiSessions(ort,executionProvider);
  const surfaceSampleCount=isMobile?2048:16384;
  setStatus(executionProvider==='wasm'?'CPU（WebAssembly）でモデル表面から点と法線を抽出しています…':`${isMobile?'スマートフォン向けに点数を抑えて':''}モデル表面から点と法線を抽出しています…`);
  const cloud=sampleModelSurface(surfaceSampleCount);
  const vertexTensor=new ort.Tensor('float32',cloud.vertices,[1,surfaceSampleCount,3]);
  const normalTensor=new ort.Tensor('float32',cloud.normals,[1,surfaceSampleCount,3]);
  const encoderInputs={};
  const vertexInput=encoder.inputNames.find(name=>/vertices|points/i.test(name))||encoder.inputNames[0];
  const normalInput=encoder.inputNames.find(name=>/normals/i.test(name))||encoder.inputNames[1];
  encoderInputs[vertexInput]=vertexTensor;encoderInputs[normalInput]=normalTensor;
  setStatus(executionProvider==='wasm'?'CPU（WebAssembly）でAIが形状を解析しています…':'AIが形状を解析しています…');
  let encoded;
  try{encoded=await encoder.run(encoderInputs);}
  catch(error){throw new Error(`形状解析中にGPUが停止しました: ${error.message||error}`);}
  const latentName=encoder.outputNames.find(name=>/latent/i.test(name))||encoder.outputNames[0];
  const latents=encoded[latentName];
  const ids=new ort.Tensor('int64',new BigInt64Array([257n,266n]),[1,2]);
  const embedded=await embed.run({[embed.inputNames[0]]:ids});
  const prompt=embedded[embed.outputNames[0]];
  const prefill=new Float32Array(latents.data.length+prompt.data.length);
  prefill.set(latents.data,0);prefill.set(prompt.data,latents.data.length);
  const pastInputs=decoder.inputNames.filter(name=>/^past\./.test(name));
  if(!pastInputs.length)throw new Error('AIモデルのキャッシュ入力形式を認識できません。');
  const logitsName=decoder.outputNames.find(name=>/logits/i.test(name))||decoder.outputNames[0];
  const cacheForInput=name=>name.replace(/^past\./,'present.');
  const prefillTokenCount=prefill.length/1024;
  const prefillChunkSize=executionProvider==='webgpu'?(isMobile?32:128):prefillTokenCount;
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
    if(prefillChunkSize<prefillTokenCount){
      setStatus(`${isMobile?'スマートフォン向けに':''}AIモデルを分割処理しています… ${Math.min(offset+chunkLength,prefillTokenCount)}/${prefillTokenCount}`);
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  const tokens=[];
  let coordinateCount=0,branchCoordinatesRemaining=0,completedJoints=0,hasCoordinates=false;
  for(let step=0;step<512;step++){
    const logitsTensor=decoded[logitsName],vocab=267;
    const sequenceLength=logitsTensor.dims[1];
    let logitsData;
    try{logitsData=executionProvider==='webgpu'?await logitsTensor.getData():logitsTensor.data;}
    catch(error){throw new Error(`関節 ${step+1} の結果取得中にGPUが停止しました: ${error.message||error}`);}
    const logits=logitsData.subarray((sequenceLength-1)*vocab,sequenceLength*vocab);
    const token=allowedAiToken(logits,coordinateCount,branchCoordinatesRemaining,hasCoordinates);
    logitsTensor.dispose?.();
    if(token===258){tokens.push(token);break;}
    tokens.push(token);
    if(token<256){
      coordinateCount++;hasCoordinates=true;
      if(branchCoordinatesRemaining>0){
        branchCoordinatesRemaining--;
        if(branchCoordinatesRemaining===0)completedJoints++;
      }else if(coordinateCount%3===0)completedJoints++;
    }else if(token===256){
      coordinateCount=0;branchCoordinatesRemaining=6;
    }else if(token===260||token===261||token===262){
      coordinateCount=0;
    }
    if(completedJoints>=96&&coordinateCount%3===0&&branchCoordinatesRemaining===0)break;
    if(step%4===0){setStatus(`${executionProvider==='wasm'?'CPU（WebAssembly）で':''}AIが骨格を推定しています… ${completedJoints}関節`);await new Promise(resolve=>setTimeout(resolve,0));}
    const tokenInput=new ort.Tensor('int64',new BigInt64Array([BigInt(token)]),[1,1]);
    const tokenEmbedding=await embed.run({[embed.inputNames[0]]:tokenInput});
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
  if(!completedJoints)throw new Error('AIが骨格を生成できませんでした。モデルの向きや形状を確認してください。');
  for(const tensor of Object.values(cache))tensor.dispose?.();
  decoded?.[logitsName]?.dispose?.();
  return {tokens,center:cloud.center,longest:cloud.longest};
}

function buildAiBoneDefs(tokens,center,longest){
  const joints=[],parentPoints=[];
  const decodePoint=tokens=>new THREE.Vector3(...tokens.map(token=>(token+0.5)/256*2-1))
    .multiplyScalar(longest*0.5).add(center);
  let branchPending=false,lastJoint=null;
  for(let i=0;i<tokens.length;){
    const token=tokens[i];
    if(token===258)break;
    if(token===256){branchPending=true;lastJoint=null;i++;continue;}
    if(token===260||token===261||token===262){i++;continue;}
    if(token<0||token>=256)throw new Error(`骨格トークンを解釈できません: ${token}`);
    if(branchPending){
      if(i+5>=tokens.length||tokens.slice(i,i+6).some(value=>value<0||value>=256))break;
      parentPoints.push(decodePoint(tokens.slice(i,i+3)));
      lastJoint=decodePoint(tokens.slice(i+3,i+6));
      joints.push(lastJoint);i+=6;branchPending=false;
    }else{
      if(i+2>=tokens.length||tokens.slice(i,i+3).some(value=>value<0||value>=256))break;
      const current=decodePoint(tokens.slice(i,i+3));
      parentPoints.push(lastJoint?lastJoint.clone():current.clone());
      joints.push(current);lastJoint=current;
      i+=3;
    }
  }
  if(!joints.length)throw new Error('AIの骨格データを読み取れませんでした。');
  const parents=new Array(joints.length).fill(-1);
  for(let joint=1;joint<joints.length;joint++){
    let best=0,bestDistance=Infinity;
    for(let candidate=joint-1;candidate>=0;candidate--){
      const distance=joints[candidate].distanceToSquared(parentPoints[joint]);
      if(distance<bestDistance){bestDistance=distance;best=candidate;}
    }
    parents[joint]=best;
  }
  return joints.map((position,index)=>({
    name:`ai_joint_${String(index+1).padStart(2,'0')}`,
    label:`AI関節 ${index+1}`,
    parent:parents[index]<0?null:`ai_joint_${String(parents[index]+1).padStart(2,'0')}`,
    position,surfacePoint:null,surfaceNormal:null,bone:null,marker:null
  }));
}

async function runAiAutoRig(){
  if(!modelRoot){setStatus('先にボーンのないGLB、glTF、OBJモデルを読み込んでください。');return;}
  aiRigButton.disabled=true;
  try{
    const prediction=await predictAiSkeleton();
    const nodes=buildAiBoneDefs(prediction.tokens,prediction.center,prediction.longest);
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
  }finally{aiRigButton.disabled=false;}
}
aiRigButton.addEventListener('click',runAiAutoRig);

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

async function generateMeshWeights(entry,bonesByName,rootSize){
  const mesh=entry.mesh, geometry=entry.geometry.clone();
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  const sourcePositions=geometry.attributes.position;
  const count=sourcePositions.count,boneCount=BONE_DEFS.length;
  const rootVertices=entry.rootPositions;
  const indexByName=new Map(BONE_DEFS.map((bone,index)=>[bone.name,index]));
  const segmentData=BONE_DEFS.map((bone,index)=>{
    if(!bone.parent||!indexByName.has(bone.parent))return null;
    const a=indexByName.get(bone.parent),start=BONE_DEFS[a].position,end=bone.position;
    const abx=end.x-start.x,aby=end.y-start.y,abz=end.z-start.z;
    return {a,b:index,ax:start.x,ay:start.y,az:start.z,bx:end.x,by:end.y,bz:end.z,abx,aby,abz,lengthSq:abx*abx+aby*aby+abz*abz};
  }).filter(Boolean);
  if(!segmentData.length)throw new Error('ボーン間のつながりを作れません。親子関係を確認してください。');
  const segmentAdj=segmentData.map((segment,index)=>segmentData.map((other,j)=>j!==index&&(segment.a===other.a||segment.a===other.b||segment.b===other.a||segment.b===other.b)?j:-1).filter(j=>j>=0));
  const sigma=Math.max(rootSize*0.04,1e-5),maxGap=rootSize*0.12;
  let dense=new Float32Array(count*boneCount);
  const allowedInfluences=new Uint8Array(count*boneCount),fallbackBones=new Uint32Array(count);
  const hitDistances=new Float32Array(segmentData.length),hitParameters=new Float32Array(segmentData.length);
  for(let v=0;v<count;v++){
    if(v>0&&v%4096===0){setStatus(`ウェイトを計算しています… ${Math.floor(v/count*100)}%`);await new Promise(resolve=>requestAnimationFrame(resolve));}
    const px=rootVertices[v*3],py=rootVertices[v*3+1],pz=rootVertices[v*3+2];
    let primaryIndex=-1,primaryT=0,nearestDistance=Infinity;
    for(let s=0;s<segmentData.length;s++){
      const seg=segmentData[s],dx=px-seg.ax,dy=py-seg.ay,dz=pz-seg.az;
      const t=seg.lengthSq>1e-12?THREE.MathUtils.clamp((dx*seg.abx+dy*seg.aby+dz*seg.abz)/seg.lengthSq,0,1):0;
      const cx=seg.ax+seg.abx*t,cy=seg.ay+seg.aby*t,cz=seg.az+seg.abz*t;
      const ox=px-cx,oy=py-cy,oz=pz-cz,distance=Math.sqrt(ox*ox+oy*oy+oz*oz);
      hitDistances[s]=distance;hitParameters[s]=t;
      if(distance<nearestDistance){nearestDistance=distance;primaryIndex=s;primaryT=t;}
    }
    const base=segmentData[primaryIndex],offset=v*boneCount;
    dense[offset+base.a]+=1-primaryT;dense[offset+base.b]+=primaryT;
    allowedInfluences[offset+base.a]=1;allowedInfluences[offset+base.b]=1;
    fallbackBones[v]=primaryT<0.5?base.a:base.b;
    let secondaryIndex=-1,bestGap=Infinity;
    for(const candidate of segmentAdj[primaryIndex]){const gap=hitDistances[candidate]-nearestDistance;if(gap<bestGap){bestGap=gap;secondaryIndex=candidate;}}
    if(secondaryIndex>=0&&bestGap<=maxGap){
      const seg=segmentData[secondaryIndex],t=hitParameters[secondaryIndex],amount=Math.exp(-(bestGap*bestGap)/(2*sigma*sigma));
      dense[offset+seg.a]+=amount*(1-t);dense[offset+seg.b]+=amount*t;
      allowedInfluences[offset+seg.a]=1;allowedInfluences[offset+seg.b]=1;
    }
    normalizeWeights(dense,offset,boneCount);
  }

  const lightweightPhoneMode=window.matchMedia('(max-width:760px)').matches&&count>60000;
  const adjacency=lightweightPhoneMode?null:makeAdjacency(geometry,count);
  const groups=lightweightPhoneMode?[]:coincidentVertexGroups(rootVertices,rootSize);
  let next=new Float32Array(dense.length);
  for(let iteration=0;adjacency&&iteration<4;iteration++){
    for(let v=0;v<count;v++){
      if(v>0&&v%8192===0)await new Promise(resolve=>requestAnimationFrame(resolve));
      const offset=v*boneCount,neighbors=adjacency[v];
      if(!neighbors.length){next.set(dense.subarray(offset,offset+boneCount),offset);continue;}
      const self=.5,other=.5/neighbors.length;
      for(let b=0;b<boneCount;b++){
        if(!allowedInfluences[offset+b]){next[offset+b]=0;continue;}
        let value=dense[offset+b]*self;
        for(const n of neighbors)value+=dense[n*boneCount+b]*other;
        next[offset+b]=value;
      }
      normalizeAllowedWeights(next,offset,offset,boneCount,allowedInfluences,fallbackBones[v]);
    }
    for(const group of groups){
      for(let b=0;b<boneCount;b++){
        let sum=0;for(const v of group)sum+=next[v*boneCount+b];
        const average=sum/group.length;for(const v of group)next[v*boneCount+b]=average;
      }
      for(const v of group){const offset=v*boneCount;normalizeAllowedWeights(next,offset,offset,boneCount,allowedInfluences,fallbackBones[v]);}
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
  return geometry;
}

async function generateRigAndWeights(){
  if(!modelRoot||modelEntries.length===0)return;
  const missing=BONE_DEFS.filter(b=>!b.position);
  if(missing.length){activeBoneName=missing[0].name;renderBoneList();setStatus(`未配置の関節があります。${missing[0].label}から配置してください。`);return;}
  if(placeMode){placeMode=false;placeButton.textContent='位置を置く：OFF';controls.enabled=true;}
  setProtectMode(false);
  setStatus('ボーンとウェイトを生成しています…');
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
    for(const entry of modelEntries){
      const old=entry.mesh,parent=old.parent,geometry=await generateMeshWeights(entry,bones,rootSize);
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
    exportButton.disabled=false;
    const assignedCount=[...protectedVertices.values()].reduce((sum,map)=>sum+map.size,0);
    const phoneLiteMeshes=modelEntries.filter(entry=>window.matchMedia('(max-width:760px)').matches&&entry.geometry.attributes.position.count>60000).length;
    const phoneNote=phoneLiteMeshes?` スマホ向けに高密度Mesh ${phoneLiteMeshes}個の平滑化を省いた軽量計算を使いました。`:'';
    setStatus(`リギングを生成しました。${modelEntries.length}個のMeshを処理し、部位指定した${assignedCount.toLocaleString()}頂点へ指定ボーンのウェイトを適用しました。${phoneNote}動作を確認してGLBを保存してください。`);
  }catch(error){
    console.error(error);setStatus(`生成に失敗しました: ${error.message||error}`);
  }
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
