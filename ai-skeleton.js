// UniRig inference and fixed 19-joint fitting. The UI and editor state stay in rigging.js.
export function createAiSkeletonTools({THREE,getModelRoot,getModelEntries,modelLocalBounds,setStatus,isMobileDevice,templateBones}){
  let aiSessions=null;
  const TEMPLATE_BONES=templateBones;
function sampleModelSurface(pointCount=16384) {
  const modelRoot=getModelRoot(),modelEntries=getModelEntries();
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
  const modelRoot=getModelRoot(),modelEntries=getModelEntries();
  if(!modelRoot||!modelEntries.length)throw new Error('先にモデルを読み込んでください。');
  const isMobile=isMobileDevice;
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

function fitAiPredictionToBasic19(candidates){
  const box=modelLocalBounds(),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const height=Math.max(size.y,0.001),width=Math.max(size.x,0.001),longest=Math.max(size.x,size.y,size.z,0.001);
  const y=ratio=>box.min.y+height*ratio,x=ratio=>center.x+width*ratio;
  // Accessory bounds can be wider than the body, so estimate the arm endpoint
  // from vertices in the upper-body band and cap it by body height.
  const armReachLimit=Math.min(width*0.49,height*0.38);
  const legSpacing=Math.min(width*0.09,height*0.04);
  const estimateArmEndpoint=side=>{
    let farthest=height*0.12,endpointY=y(0.54);
    for(const entry of getModelEntries()){
      const positions=entry.rootPositions;if(!positions)continue;
      const count=positions.length/3,step=Math.max(1,Math.ceil(count/80000));
      for(let vertex=0;vertex<count;vertex+=step){
        const offset=vertex*3,px=positions[offset],py=positions[offset+1];
        const ratio=(py-box.min.y)/height,lateral=(px-center.x)*side;
        if(ratio<0.50||ratio>0.86||lateral<=farthest)continue;
        farthest=lateral;endpointY=py;
      }
    }
    const reach=Math.min(farthest,armReachLimit);
    return {x:center.x+side*reach*0.94,y:y(0.68)+(endpointY-y(0.68))*0.90};
  };
  const targetByName=new Map([
    ['hip',new THREE.Vector3(center.x,y(.46),center.z)],
    ['supine',new THREE.Vector3(center.x,y(.54),center.z)],
    ['chest',new THREE.Vector3(center.x,y(.62),center.z)],
    ['neck',new THREE.Vector3(center.x,y(.70),center.z)],
    ['head',new THREE.Vector3(center.x,y(.78),center.z)]
  ]);
  for(const [side,prefix] of [[1,'Left'],[-1,'Right']]){
    const shoulderOffset=Math.min(width*0.16,height*0.075);
    const shoulder=new THREE.Vector3(center.x+side*shoulderOffset,y(.68),center.z);
    const endpoint=estimateArmEndpoint(side);
    const wrist=new THREE.Vector3(endpoint.x,endpoint.y,center.z);
    targetByName.set(`${prefix}Shoulder`,shoulder);
    // Place the intermediate joints near the shoulder-side arrow tips in the
    // rigging reference, keeping the elbow out of the forearm.
    targetByName.set(`${prefix}UpperArm`,shoulder.clone().lerp(wrist,0.25));
    targetByName.set(`${prefix}Elbow`,shoulder.clone().lerp(wrist,0.55));
    targetByName.set(`${prefix}Wrist`,wrist);
    targetByName.set(`${prefix}UpperLeg`,new THREE.Vector3(center.x+side*legSpacing,y(.40),center.z));
    targetByName.set(`${prefix}Knee`,new THREE.Vector3(center.x+side*legSpacing,y(.18),center.z));
    targetByName.set(`${prefix}Ankle`,new THREE.Vector3(center.x+side*legSpacing,y(.03),center.z));
  }
  const bones=TEMPLATE_BONES.map(bone=>({...bone,position:null,surfacePoint:null,surfaceNormal:null,bone:null,marker:null}));
  const assignments=new Array(bones.length).fill(-1),usedCandidates=new Set(),pairs=[];
  for(let target=0;target<bones.length;target++){
    const targetPoint=targetByName.get(bones[target].name);
    for(let candidate=0;candidate<candidates.length;candidate++){
      pairs.push({target,candidate,distance:targetPoint.distanceToSquared(candidates[candidate].position)});
    }
  }
  pairs.sort((a,b)=>a.distance-b.distance);
  const maxMatchDistanceSq=(longest*0.22)**2;
  for(const pair of pairs){
    if(pair.distance>maxMatchDistanceSq)break;
    if(assignments[pair.target]>=0||usedCandidates.has(pair.candidate))continue;
    assignments[pair.target]=pair.candidate;usedCandidates.add(pair.candidate);
  }
  let matched=0;
  const maxCorrection=Math.min(longest*0.035,height*0.015);
  for(let index=0;index<bones.length;index++){
    const target=targetByName.get(bones[index].name);
    bones[index].position=target.clone();
    const candidate=assignments[index];
    if(candidate>=0){
      const correction=candidates[candidate].position.clone().sub(target);
      if(correction.length()>maxCorrection)correction.setLength(maxCorrection);
      bones[index].position.addScaledVector(correction,0.35);
      matched++;
    }
  }
  return {bones,matched};
}
  return {predictAiSkeleton,buildAiBoneDefs,fitAiPredictionToBasic19};
}
