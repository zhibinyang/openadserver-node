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
SPARSE_FEATURES = [
    "user_id", "campaign_id", "creative_id", "slot_id", 
    "device", "browser", "os", "country", "city", 
    "page_context", "bid_type"
]
DENSE_FEATURES = [
    "banner_width", "banner_height", "bid", 
    "req_hour", "req_dow"
]
LABEL_COL = "label"

# Model Hyperparameters
EMBEDDING_DIM = 4
LEARNING_RATE = 0.001
BATCH_SIZE = 1024
EPOCHS = 5
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

class LogisticRegression(nn.Module):
    def __init__(self, sparse_feature_dims, dense_feature_dim):
        super(LogisticRegression, self).__init__()
        self.sparse_weights = nn.ModuleList([
            nn.Embedding(vocab_size, 1) for vocab_size in sparse_feature_dims
        ])
        if dense_feature_dim > 0:
            self.dense_weights = nn.Linear(dense_feature_dim, 1)
        else:
            self.dense_weights = None
        self.bias = nn.Parameter(torch.zeros(1))
        
    def forward(self, sparse_inputs, dense_inputs=None):
        batch_size = sparse_inputs.size(0)
        logits = self.bias.expand(batch_size, 1)
        
        for i, emb in enumerate(self.sparse_weights):
            logits = logits + emb(sparse_inputs[:, i])
            
        if self.dense_weights is not None and dense_inputs is not None:
            logits = logits + self.dense_weights(dense_inputs)
            
        return torch.sigmoid(logits).squeeze(-1)

def load_data_from_bq():
    client = bigquery.Client(project=PROJECT_ID)
    
    # Use the user-provided SQL query
    query = """
    WITH 
    base_requests AS (
      SELECT
        click_id, user_id, campaign_id, creative_id, slot_id, page_context,
        device, browser, os, country, city, banner_width, banner_height, bid_type, bid, event_time,
        EXTRACT(HOUR FROM event_time) AS req_hour,
        EXTRACT(DAYOFWEEK FROM event_time) AS req_dow,
        CASE 
          WHEN event_time < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR) 
               AND event_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY) THEN 'TRAIN'
          WHEN event_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 6 HOUR) 
               AND event_time < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 0 HOUR) THEN 'VALIDATE'
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
    )
    SELECT r.*, COALESCE(c.is_clicked, 0) AS label
    FROM base_requests r
    LEFT JOIN base_clicks c ON r.click_id = c.click_id
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
    
    # Fill NA
    for feat in SPARSE_FEATURES:
        if feat in df.columns:
            df[feat] = df[feat].fillna("unknown").astype(str)
            le = LabelEncoder()
            # Handle unknown values during inference by adding an 'unknown' class
            unique_vals = df[feat].unique().tolist()
            unique_vals.append("<UNK>") 
            le.fit(unique_vals)
            sparse_encoders[feat] = le
            # Encode, mapping unknown to <UNK> index
            encoded = df[feat].map(lambda x: x if x in le.classes_ else "<UNK>")
            sparse_data.append(le.transform(encoded))
        else:
            print(f"Warning: Sparse feature {feat} not found in data. Filling with 0s.")
            sparse_data.append(np.zeros(len(df), dtype=int))
            
    sparse_data = np.stack(sparse_data, axis=1) # (N, num_sparse)
    
    dense_scaler = StandardScaler()
    dense_data = df[DENSE_FEATURES].fillna(0).values.astype(np.float32)
    dense_data = dense_scaler.fit_transform(dense_data)
    
    labels = df[LABEL_COL].values.astype(np.float32)
    splits = df["data_split"].values
    
    return sparse_data, dense_data, labels, splits, sparse_encoders, dense_scaler

def export_onnx(model, sparse_dims, dense_dim, output_path):
    print(f"Exporting ONNX model to {output_path}...")
    model.eval()
    
    # Dummy inputs
    dummy_sparse = torch.zeros(1, len(sparse_dims), dtype=torch.long).to(DEVICE)
    dummy_dense = torch.zeros(1, dense_dim, dtype=torch.float32).to(DEVICE)
    
    torch.onnx.export(
        model,
        (dummy_sparse, dummy_dense),
        output_path,
        input_names=['sparse_inputs', 'dense_inputs'],
        output_names=['pctr'],
        dynamic_axes={
            'sparse_inputs': {0: 'batch_size'},
            'dense_inputs': {0: 'batch_size'},
            'pctr': {0: 'batch_size'}
        },
        opset_version=14
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

def main():
    # 1. Load Data
    df = load_data_from_bq()
    if df.empty:
        print("No data found. Exiting.")
        return

    # 2. Preprocess
    sparse_x, dense_x, y, splits, encoders, scaler = preprocess_data(df)
    
    train_mask = splits == 'TRAIN'
    val_mask = splits == 'VALIDATE'
    
    X_train_sparse = torch.tensor(sparse_x[train_mask], dtype=torch.long)
    X_train_dense = torch.tensor(dense_x[train_mask], dtype=torch.float32)
    y_train = torch.tensor(y[train_mask], dtype=torch.float32)
    
    X_val_sparse = torch.tensor(sparse_x[val_mask], dtype=torch.long)
    X_val_dense = torch.tensor(dense_x[val_mask], dtype=torch.float32)
    y_val = torch.tensor(y[val_mask], dtype=torch.float32)
    
    train_dataset = TensorDataset(X_train_sparse, X_train_dense, y_train)
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    # 3. Model Init
    sparse_dims = [len(enc.classes_) for enc in encoders.values()]
    dense_dim = len(DENSE_FEATURES)
    
    model = LogisticRegression(sparse_dims, dense_dim).to(DEVICE)
    criterion = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    # 4. Training Loop
    print(f"Starting training on {DEVICE}...")
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
            val_out = model(X_val_sparse.to(DEVICE), X_val_dense.to(DEVICE))
            val_loss = criterion(val_out, y_val.to(DEVICE))
            # Calculate simple AUC if needed, or just accuracy
            preds = (val_out > 0.5).float()
            accuracy = (preds == y_val.to(DEVICE)).float().mean()
            
        print(f"Epoch {epoch+1}/{EPOCHS} | Train Loss: {total_loss/len(train_loader):.4f} | Val Loss: {val_loss:.4f} | Val Acc: {accuracy:.4f}")

    # 5. Save Artifacts
    output_dir = Path("artifacts")
    output_dir.mkdir(exist_ok=True)
    
    # Save Feature Config (Encoders/Scaler)
    feature_config = {
        "sparse_features": SPARSE_FEATURES,
        "dense_features": DENSE_FEATURES,
        "sparse_vocab_sizes": sparse_dims,
        "dense_means": scaler.mean_.tolist(),
        "dense_stds": scaler.scale_.tolist(),
        "label_encoders": {k: list(v.classes_) for k, v in encoders.items()} 
    }
    with open(output_dir / "feature_config.json", "w") as f:
        json.dump(feature_config, f)
        
    # Save Model Checkpoint
    torch.save(model.state_dict(), output_dir / "model.pt")
    
    # Export ONNX
    onnx_path = output_dir / "lr_model.onnx"
    export_onnx(model, sparse_dims, dense_dim, onnx_path)
    
    # Upload to GCS
    try:
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        upload_to_gcs(str(onnx_path), f"models/pctr/lr_model_{timestamp}.onnx")
        upload_to_gcs(str(onnx_path), "models/pctr/lr_model_latest.onnx") # Overwrite latest
        
        # Also upload feature config
        config_path = output_dir / "feature_config.json"
        upload_to_gcs(str(config_path), f"models/pctr/feature_config_{timestamp}.json")
        upload_to_gcs(str(config_path), "models/pctr/feature_config_latest.json")
    except Exception as e:
        print(f"Failed to upload to GCS: {e}")
    
    print("Training pipeline finished successfully.")

if __name__ == "__main__":
    main()
