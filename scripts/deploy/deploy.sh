export GOOGLE_APPLICATION_CREDENTIALS=/home/yzb7530326309/.config/credential.json
gcloud storage cp gs://openadserver-training-models/models/pctr/feature_config_deepfm_latest.json /home/yzb7530326309/openadserver-node/models/feature_config_latest.json
gcloud storage cp gs://openadserver-training-models/models/pctr/deepfm_model_latest.onnx /home/yzb7530326309/openadserver-node/models/pctr_deepfm_model_latest.onnx
gcloud storage cp gs://openadserver-training-models/models/pcvr/deepfm_model_latest.onnx /home/yzb7530326309/openadserver-node/models/pcvr_deepfm_model_latest.onnx