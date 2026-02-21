import os
import time
import json
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import pandas as pd
from google.cloud import bigquery
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import LabelEncoder, StandardScaler
from pathlib import Path
from google.cloud import storage

# --- Configuration ---
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "node-quest-zbyang")
DATASET_ID = os.getenv("BQ_DATASET", "analytics")
TABLE_ID = os.getenv("BQ_TABLE", "ad_events")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "openadserver-training-models")
REGION = "us-central1"

# Feature Definitions
# Must match what's in the SQL
SPARSE_FEATURES = [
    "campaign_id", "creative_id", "slot_id","req_hour", "req_dow", "banner_size",
    "device", "browser", "os", "country"
]
DENSE_FEATURES = [
    "bid",
]
LABEL_COL = "label"

# Model Hyperparameters
# DeepFM specific
EMBEDDING_DIM = 16        # Dimension for FM and Deep part inputs
DNN_HIDDEN_UNITS = [128, 64, 32]
DNN_DROPOUT = 0.15
LEARNING_RATE = 0.001
BATCH_SIZE = 1024
EPOCHS = 5
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

class DeepFM(nn.Module):
    def __init__(self, sparse_feature_dims, dense_feature_dim, embedding_dim=8, hidden_units=[64, 32], dropout=0.5):
        super(DeepFM, self).__init__()
        self.sparse_feature_dims = sparse_feature_dims
        self.dense_feature_dim = dense_feature_dim
        self.embedding_dim = embedding_dim
        
        # 1. Linear Part (First Order)
        # Sparse: Embedding(vocab_size, 1)
        self.linear_sparse = nn.ModuleList([
            nn.Embedding(vocab_size, 1) for vocab_size in sparse_feature_dims
        ])
        # Dense: Linear(dense_dim, 1)
        if dense_feature_dim > 0:
            self.linear_dense = nn.Linear(dense_feature_dim, 1)
        
        # 2. FM Part (Second Order)
        # Shared Embeddings for FM and Deep: Embedding(vocab_size, embedding_dim)
        self.fm_embeddings = nn.ModuleList([
            nn.Embedding(vocab_size, embedding_dim) for vocab_size in sparse_feature_dims
        ])
        
        # 3. Deep Part (DNN)
        # Input to DNN = Flatten(Sparse Embeddings) + Dense Features
        input_dim = len(sparse_feature_dims) * embedding_dim + dense_feature_dim
        
        layers = []
        for hidden_dim in hidden_units:
            layers.append(nn.Linear(input_dim, hidden_dim))
            layers.append(nn.BatchNorm1d(hidden_dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))
            input_dim = hidden_dim
            
        self.dnn = nn.Sequential(*layers)
        self.dnn_linear = nn.Linear(input_dim, 1)
        
        self.bias = nn.Parameter(torch.zeros(1))
        
        # Init weights
        self._init_weights()
        
    def _init_weights(self):
        for emb in self.fm_embeddings:
            nn.init.xavier_normal_(emb.weight)
        for lin in self.linear_sparse:
            nn.init.zeros_(lin.weight)
        if self.dense_feature_dim > 0:
            nn.init.zeros_(self.linear_dense.weight)

    def forward(self, sparse_inputs, dense_inputs=None):
        """
        sparse_inputs: [batch_size, num_sparse] (indices)
        dense_inputs: [batch_size, num_dense] (values)
        """
        batch_size = sparse_inputs.size(0)
        
        # --- Linear Part ---
        linear_logit = self.bias.expand(batch_size, 1)
        
        # Sparse Linear
        for i, emb in enumerate(self.linear_sparse):
            linear_logit = linear_logit + emb(sparse_inputs[:, i])
            
        # Dense Linear
        if self.dense_feature_dim > 0 and dense_inputs is not None:
            linear_logit = linear_logit + self.linear_dense(dense_inputs)
            
        # --- FM Part ---
        # Get embeddings: [batch_size, num_sparse, embedding_dim]
        fm_emb_list = []
        for i, emb in enumerate(self.fm_embeddings):
            fm_emb_list.append(emb(sparse_inputs[:, i]))
            
        fm_emb = torch.stack(fm_emb_list, dim=1) # [B, N, K]
        
        # FM generic formula: 0.5 * sum( (sum(v_i)^2 - sum(v_i^2)) )
        sum_vectors = torch.sum(fm_emb, dim=1)    # [B, K] -> sum over features
        sum_square = sum_vectors * sum_vectors    # [B, K] -> (sum)^2
        
        square_vectors = fm_emb * fm_emb          # [B, N, K]
        square_sum = torch.sum(square_vectors, dim=1) # [B, K] -> sum(v^2)
        
        fm_logit = 0.5 * torch.sum(sum_square - square_sum, dim=1, keepdim=True) # [B, 1]
        
        # --- Deep Part ---
        # Flatten embeddings: [B, N * K]
        dnn_input_sparse = fm_emb.view(batch_size, -1)
        
        if self.dense_feature_dim > 0 and dense_inputs is not None:
            dnn_input = torch.cat([dnn_input_sparse, dense_inputs], dim=1)
        else:
            dnn_input = dnn_input_sparse
            
        dnn_output = self.dnn(dnn_input)
        dnn_logit = self.dnn_linear(dnn_output)
        
        # --- Final Combination ---
        total_logit = linear_logit + fm_logit + dnn_logit
        return torch.sigmoid(total_logit).squeeze(-1)

def load_data_from_bq():
    client = bigquery.Client(project=PROJECT_ID)
    
    # Use the same SQL logic
    query = """
    WITH
    base_requests AS (
      SELECT
        click_id, user_id, campaign_id, creative_id, slot_id, page_context,
        device, browser, os, country, city,
        CONCAT(CAST(banner_width AS STRING), 'x', CAST(banner_height AS STRING)) AS banner_size,
        bid_type, bid, event_time,
        EXTRACT(HOUR FROM event_time) AS req_hour,
        EXTRACT(DAYOFWEEK FROM event_time) AS req_dow,
        CASE
          WHEN event_time < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR)
               AND event_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY) THEN 'TRAIN'
          WHEN event_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR)
               AND event_time < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR) THEN 'VALIDATE'
          ELSE 'IGNORE'
        END AS data_split
      FROM `{dataset}.{table}`
      WHERE event_type = 9 AND slot_type = 1 AND campaign_id > 0
    ),
    base_clicks AS (
      SELECT click_id, 1 AS is_clicked
      FROM `{dataset}.{table}`
      WHERE event_type = 2
      QUALIFY ROW_NUMBER() OVER(PARTITION BY click_id ORDER BY event_time) = 1
    ),
    base_conversions AS (
      SELECT click_id, 1 AS is_converted
      FROM `{dataset}.{table}`
      WHERE event_type = 3
      QUALIFY ROW_NUMBER() OVER(PARTITION BY click_id ORDER BY event_time) = 1
    )
    SELECT 
        r.*, 
        COALESCE(c.is_clicked, 0) AS label_ctr,
        COALESCE(cv.is_converted, 0) AS label_cvr
    FROM base_requests r
    LEFT JOIN base_clicks c ON r.click_id = c.click_id
    LEFT JOIN base_conversions cv ON r.click_id = cv.click_id
    WHERE r.data_split != 'IGNORE' AND r.click_id IS NOT NULL
    """.format(dataset=DATASET_ID, table=TABLE_ID)
    
    print("Executing BigQuery query...")
    df = client.query(query).to_dataframe()
    print(f"Loaded {len(df)} rows from BigQuery.")
    return df

def preprocess_data(df):
    print("Preprocessing data...")
    sparse_encoders = {}
    sparse_data = []
    
    # Fill NA & Label Encode
    for feat in SPARSE_FEATURES:
        if feat in df.columns:
            df[feat] = df[feat].fillna("unknown").astype(str)
            le = LabelEncoder()
            unique_vals = df[feat].unique().tolist()
            unique_vals.append("<UNK>") 
            le.fit(unique_vals)
            sparse_encoders[feat] = le
            encoded = df[feat].map(lambda x: x if x in le.classes_ else "<UNK>")
            sparse_data.append(le.transform(encoded))
        else:
            print(f"Warning: Sparse feature {feat} not found. Filling 0.")
            sparse_data.append(np.zeros(len(df), dtype=int))
            
    sparse_data = np.stack(sparse_data, axis=1)
    
    # Dense Scaling
    dense_scaler = StandardScaler()
    dense_data = df[DENSE_FEATURES].fillna(0).values.astype(np.float32)
    dense_data = dense_scaler.fit_transform(dense_data)
    
    labels_ctr = df["label_ctr"].values.astype(np.float32)
    labels_cvr = df["label_cvr"].values.astype(np.float32)
    splits = df["data_split"].values
    
    return sparse_data, dense_data, labels_ctr, labels_cvr, splits, sparse_encoders, dense_scaler

def export_onnx(model, sparse_dims, dense_dim, output_path, out_name='pctr'):
    print(f"Exporting ONNX model to {output_path}...")
    model.eval()
    
    dummy_sparse = torch.zeros(1, len(sparse_dims), dtype=torch.long).to(DEVICE)
    dummy_dense = torch.zeros(1, dense_dim, dtype=torch.float32).to(DEVICE)
    
    torch.onnx.export(
        model,
        (dummy_sparse, dummy_dense),
        output_path,
        input_names=['sparse_inputs', 'dense_inputs'],
        output_names=[out_name],
        dynamic_axes={
            'sparse_inputs': {0: 'batch_size'},
            'dense_inputs': {0: 'batch_size'},
            out_name: {0: 'batch_size'}
        },
        opset_version=14,
        dynamo=False
    )
    print("ONNX export complete.")

def upload_to_gcs(source_file_path, destination_blob_name):
    """Uploads a file to the bucket."""
    storage_client = storage.Client(project=PROJECT_ID)
    bucket = storage_client.bucket(GCS_BUCKET_NAME)
    blob = bucket.blob(destination_blob_name)

    print(f"Uploading {source_file_path} to gs://{GCS_BUCKET_NAME}/{destination_blob_name}...")
    blob.upload_from_filename(source_file_path)
    print(f"File uploaded to gs://{GCS_BUCKET_NAME}/{destination_blob_name}")

def train_model(model, train_loader, X_val_sparse, X_val_dense, y_val, model_name="CTR"):
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    print(f"--- Starting training {model_name} model on {DEVICE} ---")
    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0
        for batch_sparse, batch_dense, batch_y in train_loader:
            batch_sparse, batch_dense, batch_y = batch_sparse.to(DEVICE), batch_dense.to(DEVICE), batch_y.to(DEVICE)
            
            optimizer.zero_grad()
            outputs = model(batch_sparse, batch_dense)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            
        # Validation
        model.eval()
        with torch.no_grad():
            if len(X_val_sparse) > 0:
                val_out = model(X_val_sparse.to(DEVICE), X_val_dense.to(DEVICE))
                val_loss = criterion(val_out, y_val.to(DEVICE)).item()
                preds = (val_out > 0.5).float()
                accuracy = (preds == y_val.to(DEVICE)).float().mean().item()
            else:
                val_loss = 0.0
                accuracy = 0.0
            
        print(f"[{model_name}] Epoch {epoch+1}/{EPOCHS} | Train Loss: {total_loss/len(train_loader):.4f} | Val Loss: {val_loss:.4f} | Val Acc: {accuracy:.4f}")
    return model

def main():
    # 1. Load
    df = load_data_from_bq()
    if df.empty:
        print("No data. Exiting.")
        return

    # 2. Preprocess
    sparse_x, dense_x, y_ctr, y_cvr, splits, encoders, scaler = preprocess_data(df)
    
    train_mask = splits == 'TRAIN'
    val_mask = splits == 'VALIDATE'
    
    # --- CTR Data ---
    X_train_sparse_ctr = torch.tensor(sparse_x[train_mask], dtype=torch.long)
    X_train_dense_ctr = torch.tensor(dense_x[train_mask], dtype=torch.float32)
    y_train_ctr = torch.tensor(y_ctr[train_mask], dtype=torch.float32)
    
    X_val_sparse_ctr = torch.tensor(sparse_x[val_mask], dtype=torch.long)
    X_val_dense_ctr = torch.tensor(dense_x[val_mask], dtype=torch.float32)
    y_val_ctr = torch.tensor(y_ctr[val_mask], dtype=torch.float32)
    
    # --- CVR Data (Only Clicked Requests) ---
    cvr_train_mask = train_mask & (y_ctr == 1.0)
    cvr_val_mask = val_mask & (y_ctr == 1.0)
    
    X_train_sparse_cvr = torch.tensor(sparse_x[cvr_train_mask], dtype=torch.long)
    X_train_dense_cvr = torch.tensor(dense_x[cvr_train_mask], dtype=torch.float32)
    y_train_cvr = torch.tensor(y_cvr[cvr_train_mask], dtype=torch.float32)
    
    X_val_sparse_cvr = torch.tensor(sparse_x[cvr_val_mask], dtype=torch.long)
    X_val_dense_cvr = torch.tensor(dense_x[cvr_val_mask], dtype=torch.float32)
    y_val_cvr = torch.tensor(y_cvr[cvr_val_mask], dtype=torch.float32)
    
    sparse_dims = [len(enc.classes_) for enc in encoders.values()]
    dense_dim = len(DENSE_FEATURES)
    print(f"Model Config: Sparse Dims={sparse_dims}, Dense Dim={dense_dim}, Embedding Dim={EMBEDDING_DIM}")

    # 3. Train CTR Model
    train_dataset_ctr = TensorDataset(X_train_sparse_ctr, X_train_dense_ctr, y_train_ctr)
    train_loader_ctr = DataLoader(train_dataset_ctr, batch_size=BATCH_SIZE, shuffle=True)
    model_ctr = DeepFM(sparse_dims, dense_dim, EMBEDDING_DIM, DNN_HIDDEN_UNITS, DNN_DROPOUT).to(DEVICE)
    model_ctr = train_model(model_ctr, train_loader_ctr, X_val_sparse_ctr, X_val_dense_ctr, y_val_ctr, "CTR")
    
    # 4. Train CVR Model
    if len(X_train_sparse_cvr) > 0:
        cvr_batch_size = min(BATCH_SIZE, max(1, len(X_train_sparse_cvr) // 2))
        train_dataset_cvr = TensorDataset(X_train_sparse_cvr, X_train_dense_cvr, y_train_cvr)
        train_loader_cvr = DataLoader(train_dataset_cvr, batch_size=cvr_batch_size, shuffle=True)
        model_cvr = DeepFM(sparse_dims, dense_dim, EMBEDDING_DIM, DNN_HIDDEN_UNITS, DNN_DROPOUT).to(DEVICE)
        model_cvr = train_model(model_cvr, train_loader_cvr, X_val_sparse_cvr, X_val_dense_cvr, y_val_cvr, "CVR")
    else:
        print("Warning: No clicked samples found for CVR training. Skipping CVR model.")
        model_cvr = None

    # 5. Save & Upload
    output_dir = Path("artifacts_deepfm")
    output_dir.mkdir(exist_ok=True)
    
    feature_config = {
        "sparse_features": SPARSE_FEATURES,
        "dense_features": DENSE_FEATURES,
        "sparse_vocab_sizes": sparse_dims,
        "dense_means": scaler.mean_.tolist(),
        "dense_stds": scaler.scale_.tolist(),
        "label_encoders": {k: list(v.classes_) for k, v in encoders.items()},
        "model_type": "deepfm"
    }
    config_path = output_dir / "feature_config.json"
    with open(config_path, "w") as f:
        json.dump(feature_config, f)
        
    onnx_ctr_path = output_dir / "deepfm_ctr.onnx"
    export_onnx(model_ctr, sparse_dims, dense_dim, onnx_ctr_path, out_name='pctr')
    
    if model_cvr is not None:
        onnx_cvr_path = output_dir / "deepfm_cvr.onnx"
        export_onnx(model_cvr, sparse_dims, dense_dim, onnx_cvr_path, out_name='pcvr')
        
    try:
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        upload_to_gcs(str(onnx_ctr_path), f"models/pctr/deepfm_model_{timestamp}.onnx")
        upload_to_gcs(str(onnx_ctr_path), "models/pctr/deepfm_model_latest.onnx")
        upload_to_gcs(str(config_path), f"models/pctr/feature_config_deepfm_{timestamp}.json")
        upload_to_gcs(str(config_path), "models/pctr/feature_config_deepfm_latest.json")
        
        if model_cvr is not None:
            upload_to_gcs(str(onnx_cvr_path), f"models/pcvr/deepfm_model_{timestamp}.onnx")
            upload_to_gcs(str(onnx_cvr_path), "models/pcvr/deepfm_model_latest.onnx")
            upload_to_gcs(str(config_path), f"models/pcvr/feature_config_deepfm_{timestamp}.json")
            upload_to_gcs(str(config_path), "models/pcvr/feature_config_deepfm_latest.json")
    except Exception as e:
        print(f"Failed to upload to GCS: {e}")
    
    print("Dual DeepFM training pipeline (CTR & CVR) finished successfully.")

if __name__ == "__main__":
    main()
