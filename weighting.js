// Mesh skin-weight computation. UI and export controls stay in rigging.js.
export function createWeightingTools({THREE,BONE_DEFS,modelLocalBounds,makeSurfaceDiffusionGraph,classifyArmSurfaceComponents,coincidentVertexGroups,getProtectedVertices,setStatus}){
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
  const armBones=new Set();
  for(const segment of segments)if(segment.isArmLimb){armBones.add(segment.a);armBones.add(segment.b);}
  for(let boneIndex=0;boneIndex<boneCount;boneIndex++){
    const bone=BONE_DEFS[boneIndex];
    if(/^(Left|Right)Shoulder$/.test(bone.name))armBones.add(boneIndex);
  }
  if(!armBones.size)return;
  const bounds=modelLocalBounds(),center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3());
  const armCorridors=new Map();
  for(const sideName of ['Left','Right']){
    const side=sideName==='Left'?1:-1;
    const sideSegments=segments.filter(segment=>segment.isArmInfluence&&segment.name.startsWith(sideName));
    const mask=new Uint8Array(count);
    for(let vertex=0;vertex<count;vertex++){
      if(vertex>0&&vertex%16384===0){setStatus(`袖の近傍頂点を調べています… ${sideName}`);await new Promise(resolve=>requestAnimationFrame(resolve));}
      const x=rootVertices[vertex*3],y=rootVertices[vertex*3+1],z=rootVertices[vertex*3+2];
      if((x-center.x)*side<Math.max(rootSize*0.04,extent.x*0.035)
        ||y<bounds.min.y+extent.y*0.40||y>bounds.max.y-extent.y*0.12)continue;
      let nearest=Infinity,nearestSegment=null,nearestT=0,nearestCore=Infinity;
      for(const segment of sideSegments){
        const dx=x-segment.ax,dy=y-segment.ay,dz=z-segment.az;
        const t=segment.lengthSq>1e-12?THREE.MathUtils.clamp((dx*segment.abx+dy*segment.aby+dz*segment.abz)/segment.lengthSq,0,1):0;
        const distance=Math.hypot(x-(segment.ax+segment.abx*t),y-(segment.ay+segment.aby*t),z-(segment.az+segment.abz*t));
        if(distance<nearest){nearest=distance;nearestSegment=segment;nearestT=t;}
      }
      // Keep the propagation corridor tightly attached to the arm chain.
      // A broad Euclidean corridor also catches nearby torso clothing and
      // accessories even when they are separate surface islands.
      const seedRadius=Math.max(rootSize*0.085,extent.y*0.05);
      if(nearest>seedRadius||!nearestSegment)continue;
      for(const segment of segments){
        if(!segment.isCore)continue;
        const dx=x-segment.ax,dy=y-segment.ay,dz=z-segment.az;
        const t=segment.lengthSq>1e-12?THREE.MathUtils.clamp((dx*segment.abx+dy*segment.aby+dz*segment.abz)/segment.lengthSq,0,1):0;
        nearestCore=Math.min(nearestCore,Math.hypot(x-(segment.ax+segment.abx*t),y-(segment.ay+segment.aby*t),z-(segment.az+segment.abz*t)));
      }
      // Seed a narrow band of the sleeve even when it belongs to the same
      // connected mesh component as the torso. Require the arm chain to be at
      // least as close as the core, so hats and bodice surfaces stay untouched.
      if(nearest<=nearestCore+rootSize*0.025){
        mask[vertex]=1;
        const amount=0.62*Math.exp(-0.5*(nearest/seedRadius)**2),offset=vertex*boneCount;
        for(let b=0;b<boneCount;b++)dense[offset+b]*=(1-amount);
        dense[offset+nearestSegment.a]+=amount*(1-nearestT);
        dense[offset+nearestSegment.b]+=amount*nearestT;
        allowedInfluences[offset+nearestSegment.a]=1;allowedInfluences[offset+nearestSegment.b]=1;
        normalizeWeights(dense,offset,boneCount);
      }
    }
    armCorridors.set(sideName,mask);
  }
  // Large phone meshes skip the memory-heavy surface graph. Keep the local
  // sleeve seeds above active there too; only the geodesic spreading needs it.
  if(!graph){for(let v=0;v<count;v++)normalizeWeights(dense,v*boneCount,boneCount);return;}
  const groupByVertex=new Array(count);
  for(const group of groups)for(const vertex of group)groupByVertex[vertex]=group;
  // Spread arm labels through adjacent surface vertices near the arm chain.
  // The side and chain corridor prevents the neighborhood walk from crossing
  // the armpit into the chest or continuing down the torso.
  const maxDistance=rootSize*0.085,sigma=Math.max(rootSize*0.055,1e-5),spreadScale=0.56;
  let processedBones=0;
  for(const boneIndex of armBones){
    const boneName=BONE_DEFS[boneIndex].name,sideName=boneName.startsWith('Left')?'Left':'Right';
    const corridor=armCorridors.get(sideName);
    let seedStrength=0;
    for(let v=0;v<count;v++)if(corridor[v]&&allowedInfluences[v*boneCount+boneIndex])seedStrength=Math.max(seedStrength,dense[v*boneCount+boneIndex]);
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
    for(let v=0;v<count;v++)if(corridor[v]&&allowedInfluences[v*boneCount+boneIndex]){
      const seedGroup=groupByVertex[v];
      if(seedGroup){for(const member of seedGroup)if(corridor[member]&&distances[member]!==0){distances[member]=0;push(member,0);}}
      else if(distances[v]!==0){distances[v]=0;push(v,0);}
    }
    let visited=0;
    while(heap.length){
      const [distance,vertex]=pop();
      if(distance!==distances[vertex]||distance>maxDistance)continue;
      for(const neighbor of graph.neighbors[vertex]){
        if(!corridor[neighbor])continue;
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
  const protectedVertices=getProtectedVertices();
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
      const shoulderBridge=/Shoulder$/.test(seg.name)&&['chest','neck'].includes(primarySegment.name);
      if(shoulderBridge)amount=Math.min(0.32,Math.max(amount,0.22));
      else if(primarySegment.isArmLimb!==seg.isArmLimb||/Shoulder$/.test(primarySegment.name)!==/Shoulder$/.test(seg.name))amount=Math.min(amount,0.08);
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
  const protectedVertices=getProtectedVertices();
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
  return {generateMeshWeights,unifyAdjacentMeshSeamWeights};
}
