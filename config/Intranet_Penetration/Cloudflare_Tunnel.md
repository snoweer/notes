1. 在Cloudflare官网，Zero Trust-Network（网络）-Tunnel（连接器）创建，并添加应用程序路由，如添加的应用是https，要打开无TLS验证
2. 在路由器或操作系统，安装Cloudflare客户端
3. 配置config.yml文件，该文件中指定的json文件，文件名为官网创建Tunnel时隧道ID，文件内容为创建Tunnel时的Token，经Base64解码后的内容，其中替换以下三项内容：a → AccountTag, t → TunnelID, s → TunnelSecret，其他转发服务根据需要，进行配置，兜底规则必须保留
4. 证书文件，如使用命令行，则通过cloudflared tunnel login，命令获取，如使用图形客户端，按提示获取
5. 可通过cloudflared update升级到最新版本
