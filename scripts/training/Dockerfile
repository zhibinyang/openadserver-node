# 使用官方 3.10 镜像
FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 复制依赖文件并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制训练脚本
COPY main.py .

# 执行训练命令
CMD ["python", "main.py"]