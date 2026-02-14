export GOOGLE_APPLICATION_CREDENTIALS=/home/yzb7530326309/.config/credential.json
gcloud storage cp gs://openadserver-training-models/models/pctr/feature_config_latest.json /home/yzb7530326309/openadserver-node/
gcloud storage cp gs://openadserver-training-models/models/pctr/lr_model_latest.onnx /home/yzb7530326309/openadserver-node/