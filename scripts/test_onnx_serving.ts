const ort = require("onnxruntime-node");
import * as path from "path";

async function main() {
    const modelPath = path.join(__dirname, "../models/lr_ctr.onnx");

    try {
        // 1. Load the model
        console.log(`Loading model from: ${modelPath}`);
        const session = await ort.InferenceSession.create(modelPath);
        console.log("Model loaded successfully.");

        // Check input names
        console.log("Input names:", session.inputNames);
        console.log("Output names:", session.outputNames);

        // 2. Prepare inputs
        const batchSize = 5;
        const numSparse = 26;
        const numDense = 13;

        // Sparse features (int64)
        const sparseData = new BigInt64Array(batchSize * numSparse);
        for (let i = 0; i < sparseData.length; i++) {
            // Use safe range for all columns (smallest vocab is 4)
            sparseData[i] = BigInt(Math.floor(Math.random() * 2));
        }
        const sparseTensor = new ort.Tensor("int64", sparseData, [
            batchSize,
            numSparse,
        ]);

        // Dense features (float32)
        const denseData = new Float32Array(batchSize * numDense);
        for (let i = 0; i < denseData.length; i++) {
            denseData[i] = Math.random();
        }
        const denseTensor = new ort.Tensor("float32", denseData, [
            batchSize,
            numDense,
        ]);

        // 3. Run inference
        const feeds = {
            sparse_features: sparseTensor,
            dense_features: denseTensor,
        };

        console.log("Running inference...");
        const start = Date.now();
        const results = await session.run(feeds);
        const end = Date.now();
        console.log(`Inference time: ${end - start}ms`);

        // 4. Process results
        const outputName = session.outputNames[0];
        const outputTensor = results[outputName];
        const pctr = outputTensor.data as Float32Array;

        console.log("pCTR predictions:", pctr);

    } catch (e) {
        console.error("Error during inference:", e);
    }
}

main();
