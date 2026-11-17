const ORT_ROOT = new URL('./vendor/onnxruntime-web-1.31.1/', self.location.href);
const MODEL_ROOT = 'https://huggingface.co/cgb/unirig-skeleton-onnx-webgpu/resolve/main/';

self.onmessage = async event => {
  const { vertices, normals, pointCount } = event.data;
  let session;
  let outputTensors = [];
  try {
    self.postMessage({ type: 'status', message: 'スマートフォン内で形状を解析しています…（作業領域を分離）' });
    const ort = await import('./vendor/onnxruntime-web-1.31.1/ort.webgpu.bundle.min.js');
    ort.env.wasm.proxy = false;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = {
      mjs: new URL('ort-wasm-simd-threaded.asyncify.mjs', ORT_ROOT).href,
      wasm: new URL('ort-wasm-simd-threaded.asyncify.wasm', ORT_ROOT).href
    };

    self.postMessage({ type: 'status', message: '形状解析モデルを取得しています…' });
    const modelResponse = await fetch(MODEL_ROOT + 'encoder_q8.onnx');
    if (!modelResponse.ok) throw new Error(`形状解析モデルを取得できません（HTTP ${modelResponse.status}）。`);
    const modelBytes = new Uint8Array(await modelResponse.arrayBuffer());
    const dataResponse = await fetch(MODEL_ROOT + 'encoder_q8.onnx.data');
    if (!dataResponse.ok) throw new Error(`形状解析データを取得できません（HTTP ${dataResponse.status}）。`);
    const externalData = new Uint8Array(await dataResponse.arrayBuffer());

    session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      enableCpuMemArena: false,
      enableMemPattern: false,
      externalData: [{ path: 'encoder_q8.onnx.data', data: externalData }]
    });

    const verticesTensor = new ort.Tensor('float32', vertices, [1, pointCount, 3]);
    const normalsTensor = new ort.Tensor('float32', normals, [1, pointCount, 3]);
    const feeds = {};
    const vertexInput = session.inputNames.find(name => /vertices|points/i.test(name)) || session.inputNames[0];
    const normalInput = session.inputNames.find(name => /normals/i.test(name)) || session.inputNames[1];
    feeds[vertexInput] = verticesTensor;
    feeds[normalInput] = normalsTensor;

    self.postMessage({ type: 'status', message: 'スマートフォン内のCPUで形状を解析しています…' });
    const outputs = await session.run(feeds);
    outputTensors = Object.values(outputs);
    const latentName = session.outputNames.find(name => /latent/i.test(name)) || session.outputNames[0];
    const latent = outputs[latentName];
    const featureWidth = latent.dims.at(-1) || 1024;
    const sourceCount = latent.dims[1] || Math.floor(latent.data.length / featureWidth);
    const targetCount = Math.min(128, sourceCount);
    const compact = new Float32Array(targetCount * featureWidth);
    for (let target = 0; target < targetCount; target++) {
      const first = Math.floor(target * sourceCount / targetCount);
      const last = Math.max(first + 1, Math.floor((target + 1) * sourceCount / targetCount));
      const divisor = last - first;
      for (let feature = 0; feature < featureWidth; feature++) {
        let sum = 0;
        for (let source = first; source < last; source++) sum += latent.data[source * featureWidth + feature];
        compact[target * featureWidth + feature] = sum / divisor;
      }
    }
    self.postMessage({ type: 'done', latentData: compact, featureWidth, latentCount: targetCount }, [compact.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || String(error) });
  } finally {
    for (const tensor of outputTensors) tensor.dispose?.();
    if (session) await session.release().catch(() => {});
  }
};
