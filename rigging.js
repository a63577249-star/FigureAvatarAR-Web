import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const BONE_DEFS = [
  ['hip','腰',null], ['supine','胴の付け根','hip'], ['chest','胸','supine'],
  ['neck','首','chest'], ['head','頭','neck'],
  ['LeftShoulder','左肩','chest'], ['LeftUpperArm','左上腕','LeftShoulder'],
  ['LeftElbow','左ひじ','LeftUpperArm'], ['LeftWrist','左手首','LeftElbow'],
  ['RightShoulder','右肩','chest'], ['RightUpperArm','右上腕','RightShoulder'],
  ['RightElbow','右ひじ','RightUpperArm'], ['RightWrist','右手首','RightElbow'],
  ['LeftUpperLeg','左脚','hip'], ['LeftKnee','左ひざ','LeftUpperLeg'], ['LeftAnkle','左足首','LeftKnee'],
  ['RightUpperLeg','右脚','hip'], ['RightKnee','右ひざ','RightUpperLeg'], ['RightAnkle','右足首','RightKnee']
].map(([name,label,parent]) => ({ name,label,parent,position:null,bone:null,marker:null }));

const SEGMENTS = [
  ['hip','supine'],['supine','chest'],['chest','neck'],['neck','head'],
  ['chest','LeftShoulder'],['LeftShoulder','LeftUpperArm'],['LeftUpperArm','LeftElbow'],['LeftElbow','LeftWrist'],
  ['chest','RightShoulder'],['RightShoulder','RightUpperArm'],['RightUpperArm','RightElbow'],['RightElbow','RightWrist'],
  ['hip','LeftUpperLeg'],['LeftUpperLeg','LeftKnee'],['LeftKnee','LeftAnkle'],
  ['hip','RightUpperLeg'],['RightUpperLeg','RightKnee'],['RightKnee','RightAnkle']
];

const viewport = document.querySelector('#viewport');
const statusBox = document.querySelector('#status');
const fileInput = document.querySelector('#model-files');
const boneList = document.querySelector('#bone-list');
const placeButton = document.querySelector('#place-toggle');
const autoButton = document.querySelector('#auto-place');
const generateButton = document.querySelector('#generate');
const exportButton = document.querySelector('#export');
const viewHelp = document.querySelector('#view-help');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#121a27');
const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 10000);
camera.position.set(0, 1.5, 4);
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

let modelRoot = null;
let modelEntries = [];
let generatedRig = null;
let activeBoneName = BONE_DEFS[0].name;
let placeMode = false;
let rigLines = null;
let sourceName = 'avatar';
let pointerStart = null;

function setStatus(message) { statusBox.textContent = message; }
function boneByName(name) { return BONE_DEFS.find(b => b.name === name); }
function localPoint(worldPoint) { return modelRoot.worldToLocal(worldPoint.clone()); }
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
}
renderBoneList();

function setRigEditingEnabled(enabled) {
  placeButton.disabled = !enabled;
  autoButton.disabled = !enabled;
  generateButton.disabled = !enabled;
}

function revokeOldModel() {
  placeMode = false;
  controls.enabled = true;
  placeButton.textContent = '位置を置く：OFF';
  if (modelRoot) {
    scene.remove(modelRoot);
    modelRoot.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else if (object.material) object.material.dispose();
    });
  }
  markerGroup.clear();
  if (rigLines) { scene.remove(rigLines); rigLines.geometry.dispose(); rigLines.material.dispose(); rigLines = null; }
  modelRoot = null;
  modelEntries = [];
  generatedRig = null;
  BONE_DEFS.forEach(bone => { bone.position = null; bone.bone = null; bone.marker = null; });
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
  const worldBox = new THREE.Box3().setFromObject(modelRoot);
  const inverseRoot = modelRoot.matrixWorld.clone().invert();
  const localBox = new THREE.Box3();
  for (let i=0; i<8; i++) {
    const point = new THREE.Vector3(
      i&1 ? worldBox.max.x : worldBox.min.x,
      i&2 ? worldBox.max.y : worldBox.min.y,
      i&4 ? worldBox.max.z : worldBox.min.z
    ).applyMatrix4(inverseRoot);
    localBox.expandByPoint(point);
  }
  return localBox;
}

function fitCamera() {
  modelRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(modelRoot);
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
  const at = (name, px, py, pz= center.z) => boneByName(name).position = new THREE.Vector3(px,py,pz);
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
  return hits.length ? hits[0].point : null;
}

renderer.domElement.addEventListener('pointerdown',event => { pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId}; });
renderer.domElement.addEventListener('pointerup',event => {
  if (!placeMode || !pointerStart || pointerStart.id !== event.pointerId) return;
  const distance=Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y);
  pointerStart=null;
  if (distance>8) return;
  const point=pickSurface(event.clientX,event.clientY);
  if (!point) { setStatus('モデル表面をタップしてください。'); return; }
  boneByName(activeBoneName).position=localPoint(point);
  updateMarkers(); renderBoneList();
  const active=BONE_DEFS.findIndex(b=>b.name===activeBoneName);
  const next=BONE_DEFS.slice(active+1).find(b=>!b.position);
  if(next) activeBoneName=next.name;
  renderBoneList();
  const label=boneByName(activeBoneName).label;
  setStatus(`${boneByName(BONE_DEFS[active].name).label}を配置しました。次は${label}を選択中です。`);
});

placeButton.addEventListener('click',()=>{
  placeMode=!placeMode;
  placeButton.textContent=`位置を置く：${placeMode?'ON':'OFF'}`;
  placeButton.style.background=placeMode?'#176b75':'';
  controls.enabled=!placeMode;
  viewHelp.textContent=placeMode?'選択中の関節の中心をモデル表面でタップ。配置後は次の未配置関節へ進みます。':'ドラッグで視点を回転できます。';
});
autoButton.addEventListener('click',placeStandardRig);
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
  const tolerance=Math.max(1e-6,scale*1e-6), toleranceSq=tolerance*tolerance;
  const cells=new Map(), parent=Array.from({length:positions.length},(_,i)=>i);
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const key=(x,y,z)=>`${x},${y},${z}`;
  for(let i=0;i<positions.length;i++){
    const p=positions[i],cx=Math.floor(p.x/tolerance),cy=Math.floor(p.y/tolerance),cz=Math.floor(p.z/tolerance);
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      const list=cells.get(key(cx+x,cy+y,cz+z));if(!list)continue;
      for(const j of list){if(p.distanceToSquared(positions[j])<=toleranceSq){let a=root(i),b=root(j);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b);}}
    }
    const k=key(cx,cy,cz);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);
  }
  const groups=new Map();
  for(let i=0;i<positions.length;i++){const r=root(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
  return Array.from(groups.values()).filter(group=>group.length>1);
}

function normalizeWeights(values,offset,boneCount){
  let sum=0;for(let b=0;b<boneCount;b++)sum+=values[offset+b];
  if(sum<=1e-12){values[offset]=1;sum=1;}
  for(let b=0;b<boneCount;b++)values[offset+b]/=sum;
}

function generateMeshWeights(entry,bonesByName,rootSize){
  const mesh=entry.mesh, geometry=entry.geometry.clone();
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  const sourcePositions=geometry.attributes.position;
  const count=sourcePositions.count,boneCount=BONE_DEFS.length;
  mesh.updateWorldMatrix(true,false);modelRoot.updateWorldMatrix(true,false);
  const rootVertices=[];
  for(let i=0;i<count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(sourcePositions,i).applyMatrix4(mesh.matrixWorld);
    rootVertices.push(modelRoot.worldToLocal(p));
  }
  const segmentData=SEGMENTS.map(([a,b])=>({a:BONE_DEFS.findIndex(j=>j.name===a),b:BONE_DEFS.findIndex(j=>j.name===b)}));
  const segmentAdj=segmentData.map((segment,index)=>segmentData.map((other,j)=>j!==index&&(segment.a===other.a||segment.a===other.b||segment.b===other.a||segment.b===other.b)?j:-1).filter(j=>j>=0));
  const sigma=Math.max(rootSize*0.04,1e-5),maxGap=rootSize*0.12;
  let dense=new Float32Array(count*boneCount);
  for(let v=0;v<count;v++){
    const p=rootVertices[v],hits=[];
    for(let s=0;s<segmentData.length;s++){
      const seg=segmentData[s],a=BONE_DEFS[seg.a].position,b=BONE_DEFS[seg.b].position,ab=b.clone().sub(a);
      const t=ab.lengthSq()>1e-12?THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1):0;
      const closest=a.clone().addScaledVector(ab,t);
      hits.push({index:s,t,distance:p.distanceTo(closest)});
    }
    hits.sort((a,b)=>a.distance-b.distance);
    const primary=hits[0],base=segmentData[primary.index],offset=v*boneCount;
    dense[offset+base.a]+=1-primary.t;dense[offset+base.b]+=primary.t;
    let secondary=null,bestGap=Infinity;
    for(const s of segmentAdj[primary.index]){const hit=hits.find(item=>item.index===s);const gap=hit.distance-primary.distance;if(gap<bestGap){bestGap=gap;secondary=hit;}}
    if(secondary&&bestGap<=maxGap){
      const seg=segmentData[secondary.index],amount=Math.exp(-(bestGap*bestGap)/(2*sigma*sigma));
      dense[offset+seg.a]+=amount*(1-secondary.t);dense[offset+seg.b]+=amount*secondary.t;
    }
    normalizeWeights(dense,offset,boneCount);
  }

  const adjacency=makeAdjacency(geometry,count);
  const groups=coincidentVertexGroups(rootVertices,rootSize);
  let next=new Float32Array(dense.length);
  for(let iteration=0;iteration<4;iteration++){
    for(let v=0;v<count;v++){
      const offset=v*boneCount,neighbors=adjacency[v];
      if(!neighbors.length){next.set(dense.subarray(offset,offset+boneCount),offset);continue;}
      const self=.5,other=.5/neighbors.length;
      for(let b=0;b<boneCount;b++){
        let value=dense[offset+b]*self;
        for(const n of neighbors)value+=dense[n*boneCount+b]*other;
        next[offset+b]=value;
      }
      normalizeWeights(next,offset,boneCount);
    }
    for(const group of groups){
      for(let b=0;b<boneCount;b++){
        let sum=0;for(const v of group)sum+=next[v*boneCount+b];
        const average=sum/group.length;for(const v of group)next[v*boneCount+b]=average;
      }
      for(const v of group)normalizeWeights(next,v*boneCount,boneCount);
    }
    [dense,next]=[next,dense];
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

function generateRigAndWeights(){
  if(!modelRoot||modelEntries.length===0)return;
  const missing=BONE_DEFS.filter(b=>!b.position);
  if(missing.length){activeBoneName=missing[0].name;renderBoneList();setStatus(`未配置の関節があります。${missing[0].label}から配置してください。`);return;}
  if(placeMode){placeMode=false;placeButton.textContent='位置を置く：OFF';controls.enabled=true;}
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
      const old=entry.mesh,parent=old.parent,geometry=generateMeshWeights(entry,bones,rootSize);
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
    setStatus(`リギングを生成しました。${modelEntries.length}個のMeshに標準19関節とウェイトを設定しました。動作を確認してGLBを保存してください。`);
  }catch(error){
    console.error(error);setStatus(`生成に失敗しました: ${error.message||error}`);
  }
}
generateButton.addEventListener('click',generateRigAndWeights);

async function exportGlb(){
  if(!modelRoot)return;
  exportButton.disabled=true;setStatus('GLBを書き出しています…');
  try{
    modelRoot.updateMatrixWorld(true);
    const data=await new GLTFExporter().parseAsync(modelRoot,{binary:true,onlyVisible:true});
    const blob=new Blob([data],{type:'model/gltf-binary'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=`${sourceName}_rigged.glb`;anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    setStatus('リギング済みGLBをダウンロードしました。ファイルは端末内に保存されています。');
  }catch(error){console.error(error);setStatus(`書き出しに失敗しました: ${error.message||error}`);}
  finally{exportButton.disabled=false;}
}
exportButton.addEventListener('click',exportGlb);

function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}
animate();
