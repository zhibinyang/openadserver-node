export GOOGLE_APPLICATION_CREDENTIALS=~/.config/credential.json
gcloud storage cp gs://openadserver-training-models/models/pctr/feature_config_deepfm_latest.json ../../models/feature_config_latest.json
gcloud storage cp gs://openadserver-training-models/models/pctr/deepfm_model_latest.onnx ../../models/pctr_deepfm_model_latest.onnx
gcloud storage cp gs://openadserver-training-models/models/pcvr/deepfm_model_latest.onnx ../../models/pcvr_deepfm_model_latest.onnx
