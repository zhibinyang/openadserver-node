const ort = require("onnxruntime-node");
import * as path from "path";
import * as fs from "fs";

async function main() {
    const configPath = path.join(__dirname, "../models/feature_config_latest.json");
    console.log(`Loading feature config from: ${configPath}`);
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(rawConfig);
    const modelType = config.model_type || 'lr';

    const modelPath = path.join(__dirname, `../models/${modelType}_model_latest.onnx`);

    try {
        // 1. Load the model
        console.log(`Loading model from: ${modelPath} (Type: ${modelType})`);
        const session = await ort.InferenceSession.create(modelPath);
        console.log("Model loaded successfully.");

        // Check input names
        console.log("Input names:", session.inputNames);
        console.log("Output names:", session.outputNames);

        // 2. Prepare inputs
        const batchSize = 1;
        const numSparse = config.sparse_features.length;
        const numDense = config.dense_features.length;

        // Mock Input Data
        const mockRawSparse: Record<string, string | number> = {
            "campaign_id": "1",
            "creative_id": "4",
            "slot_id": "slot_feed_native",
            "req_hour": 15,
            "req_dow": 6,
            "banner_size": "300x250",
            "device": "iphone",
            "browser": "safari",
            "os": "ios",
            "country": "US"
        };
        const mockRawDense: Record<string, number> = {
            "bid": 15.0
        };

        console.log("Raw Features:", { sparse: mockRawSparse, dense: mockRawDense });

        // Encode and Scale
        const sparseData = new BigInt64Array(batchSize * numSparse);
        for (let i = 0; i < numSparse; i++) {
            const feat = config.sparse_features[i];
            const strVal = String(mockRawSparse[feat] ?? 'unknown');
            const classes: string[] = config.label_encoders[feat];
            let idx = classes ? classes.indexOf(strVal) : -1;
            if (idx === -1) idx = classes.indexOf('<UNK>');
            if (idx === -1) idx = 0;
            sparseData[i] = BigInt(idx);
        }

        const denseData = new Float32Array(batchSize * numDense);
        for (let i = 0; i < numDense; i++) {
            const feat = config.dense_features[i];
            const val = mockRawDense[feat] ?? 0;
            const mean = config.dense_means[i];
            const std = config.dense_stds[i];
            denseData[i] = std === 0 ? 0 : (val - mean) / std;
        }

        const sparseTensor = new ort.Tensor("int64", sparseData, [batchSize, numSparse]);
        const denseTensor = new ort.Tensor("float32", denseData, [batchSize, numDense]);

        // 3. Run inference
        const feeds = {
            sparse_inputs: sparseTensor,
            dense_inputs: denseTensor,
        };

        console.log("Running inference...");
        const start = Date.now();
        const results = await session.run(feeds);
        const end = Date.now();
        console.log(`Inference time: ${end - start}ms`);

        // 4. Process results
        const outputName = results.pctr ? 'pctr' : session.outputNames[0];
        const outputTensor = results[outputName];
        const pctr = outputTensor.data as Float32Array;

        console.log(`pCTR predictions for batch: ${pctr[0].toFixed(5)}`);

    } catch (e) {
        console.error("Error during inference:", e);
    }
}

main();
