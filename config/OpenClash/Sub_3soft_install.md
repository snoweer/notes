1、Docker 部署 Sub-Store：
docker run -it -d --restart=always -e "SUB_STORE_BACKEND_SYNC_CRON=55 23 * * *" -e SUB_STORE_FRONTEND_BACKEND_PATH=/84iFE57p5446XFPhuPtz -p 8001:3001 -v /home/admin/sub-store:/opt/app/data --name Sub-Store xream/sub-store:latest
支持http-meta，使用该版本方式：xream/sub-store:http-meta

访问地址：https://xxx.xxx.xxx/?api=https://xxx.xxx.xxx/84iFE57p5446XFPhuPtz  
"84iFE57p5446XFPhuPtz" 20位随机数


2、Docker 部署 SubConverter：
docker run -d --name Sub2Converter --restart=always -p 8255:25500 ghcr.io/metacubex/subconverter:latest  

访问地址：https://xxx.xxx.xxx/sub

3、Docker 部署 SubWeb：
docker run -d --name=Sub-Web -p 8091:80 -e PUID=0 -e PGID=0 -e TZ=Asia/Shanghai --restart always careywong/subweb:latest

4、部署完成后，可设置反代，配置SSL证书。Sub-store可配置gist同步备份。
