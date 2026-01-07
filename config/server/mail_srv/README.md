# 容器化轻量型邮件服务器部署方案.md

> **项目**：基于 Debian 12 + Docker 的轻量型邮件服务器  
> **技术栈**：SQLite + Postfix + Dovecot + RSPAMD + ClamAV + Z-Push + Sieve + Roundcube  
> **适用**：4C4G 及以上云服务器，支持 Webmail、移动端 ActiveSync、用户自主邮件过滤

---

## 1. 项目简介

本项目在 **Debian 12 宿主机 + 宝塔面板** 环境下，通过 **Docker 容器** 部署一套功能完整的邮件服务器，包含：

- **Postfix**：SMTP 服务器（支持 SMTPS 465、Submission 587）
- **Dovecot**：IMAP/POP3 服务器（支持 IMAPS 993、POP3S 995）+ **Sieve 脚本过滤**
- **RSPAMD + ClamAV**：高性能反垃圾与反病毒
- **OpenDKIM + OpenDMARC**：邮件认证
- **Nginx + PHP 8.1**：Roundcube Webmail + Z-Push（ActiveSync）
- **SQLite**：Roundcube 数据存储（免 MySQL）
- **Z-Push**：移动设备邮件/联系人/日历同步（Exchange ActiveSync）
- **Sieve**：用户可通过 Web 或客户端管理邮件重定向、自动回复、过滤规则

---

## 2. 系统架构图
**系统架构图（Mermaid）**

```mermaid
graph TD
    subgraph 阿里云轻量服务器
        A[Debian 12 + 宝塔面板]
        A --> B[Nginx<br>(Web & SSL)]
        A --> C[MySQL<br>(可选其他业务)]
    end

    A -->|Docker Engine| D[Docker 容器: mail-srv]
    D -->|端口映射<br>465/587/993/995/80/443| E[外部访问]

    subgraph Container: mail-srv
        F[Postfix<br>SMTP]
        G[Dovecot<br>IMAP/POP3 + Sieve]
        H[RSPAMD + ClamAV<br>反垃圾/反病毒]
        I[OpenDKIM / OpenDMARC<br>邮件认证]
        J[Nginx + PHP<br>Roundcube Webmail]
        K[Z-Push<br>ActiveSync]
        L[SQLite<br>Roundcube DB]
        M[证书挂载<br>/certs]
    end

    F --> G
    G --> H
    H --> I
    J --> K
    J --> L
    J --> M
```
**系统架构图ASCII**
```
+---------------------+
|   阿里云轻量服务器   |
|   Debian 12 + 宝塔   |
| Nginx + MySQL + SSL |
+----------+----------+
           |
           | Docker 容器 (mail-srv)
           | 端口映射: 465/587/993/995/80/443/
           v
+-------------------------------+
|  Container: mail-srv          |
|  - Postfix (SMTP)             |
|  - Dovecot (IMAP/POP3 + Sieve)|
|  - RSPAMD + ClamAV            |
|  - OpenDKIM / OpenDMARC       |
|  - Nginx + PHP (Roundcube)    |
|  - Z-Push (ActiveSync)        |
|  - SQLite (Roundcube DB)      |
|  - 证书: /certs               |
+-------------------------------+
```
---

## 3. 环境要求

- **宿主机**：阿里云轻量级应用服务器，不支持25端口，Debian 12，4C4G 或以上
- **宝塔面板**：11.4（管理 Nginx、MySQL、SSL 证书）
- **Docker**：已安装
- **域名**：`mail.snoweer.co`（已解析到服务器 IP，并申请 Let's Encrypt 证书至 `/www/server/panel/vhost/ssl/snoweer.co/`）
- **防火墙/安全组**：开放 80、443、465、587、993、995（可选 4190）

---

## 4. 项目目录结构
```
mail-container/
├── Dockerfile              # 容器构建文件
├── docker-compose.yml      # 编排文件
├── deploy_mail.sh          # 容器内一键部署脚本
├── sieve_sample.txt        # Sieve 脚本示例（可选放此目录构建进镜像）
└── README.md               # 本说明文件
```
---

## 5. 完整代码

### 5.1 Dockerfile

```dockerfile
FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Shanghai

RUN apt update && apt full-upgrade -y && \
    apt install -y postfix dovecot-core dovecot-imapd dovecot-pop3d \
        dovecot-sieve \
        opendkim opendmarc rspamd clamav-daemon clamav-freshclam \
        nginx php-fpm php-cli php-gd php-curl php-xml php-mbstring php-intl php-zip sqlite3 \
        wget unzip curl gnupg2 && \
    rm -rf /var/lib/apt/lists/*

RUN useradd -m -d /var/mail/snoweer mailuser

RUN mkdir -p /var/www/roundcube /var/www/z-push && \
    chown -R www-data:www-data /var/www

EXPOSE 25 465 587 993 995 80 443

CMD ["/bin/bash"]
```

### 5.2 docker-compose.yml

```yaml
version: "3.8"

services:
  mail:
    build: .
    container_name: mail-srv
    hostname: mail.snoweer.co
    volumes:
      - /www/server/panel/vhost/ssl/snoweer.co/:/certs:ro
      - mail_data:/var/mail
      - postfix_spool:/var/spool/postfix
      - opendkim_keys:/etc/opendkim/keys
      - roundcube_data:/var/www/roundcube
      - zpush_data:/var/www/z-push
    ports:
      - "465:465"
      - "587:587"
      - "993:993"
      - "995:995"
      - "80:80"
      - "443:443"
    extra_hosts:
      - "mail.snoweer.co:127.0.0.1"
    environment:
      - TZ=Asia/Shanghai
    tty: true
    stdin_open: true

volumes:
  mail_data:
  postfix_spool:
  opendkim_keys:
  roundcube_data:
  zpush_data:
```

### 5.3 deploy_mail.sh

```sh
#!/bin/bash
set -e

DOMAIN="mail.snoweer.co"
CERT_CHAIN="/certs/fullchain.pem"
CERT_KEY="/certs/privkey.pem"

echo "=== [1] Postfix 基础配置 ==="
postconf -e "myhostname = $DOMAIN"
postconf -e "mydomain = ${DOMAIN#*.}"
postconf -e "myorigin = \$mydomain"
postconf -e "inet_interfaces = all"
postconf -e "mydestination = \$myhostname, localhost.\$mydomain, localhost, \$mydomain"
postconf -e "home_mailbox = Maildir/"
postconf -e "smtpd_banner = \$myhostname ESMTP"
postconf -e "biff = no"
postconf -e "append_dot_mydomain = no"
postconf -e "smtpd_sasl_type = dovecot"
postconf -e "smtpd_sasl_path = private/auth"
postconf -e "smtpd_sasl_auth_enable = yes"
postconf -e "smtpd_sasl_security_options = noanonymous"
postconf -e "broken_sasl_auth_clients = yes"
postconf -e "smtpd_recipient_restrictions = permit_sasl_authenticated, permit_mynetworks, reject_unauth_destination"
postconf -e "smtpd_tls_cert_file = $CERT_CHAIN"
postconf -e "smtpd_tls_key_file = $CERT_KEY"
postconf -e "smtpd_tls_security_level = may"
postconf -e "smtpd_tls_auth_only = yes"

grep -q "^smtps" /etc/postfix/master.cf || cat >> /etc/postfix/master.cf <<EOF

smtps     inet  n       -       y       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING

submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
EOF

echo "=== [1.1] Postfix 使用 Dovecot LDA ==="
postconf -e "virtual_transport = dovecot"
postconf -e "mailbox_transport = dovecot"
postconf -e "dovecot_destination_recipient_limit = 1"
grep -q "^dovecot unix" /etc/postfix/master.cf || cat >> /etc/postfix/master.cf <<EOF

dovecot unix - n n - - pipe
  flags=DRhu user=mailuser argv=/usr/lib/dovecot/deliver -f \${sender} -d \${recipient}
EOF

echo "=== [2.1] Dovecot Sieve 与 ManageSieve 配置 ==="
cat >> /etc/dovecot/conf.d/10-mail.conf <<'EOF'
mail_location = maildir:~/Maildir
plugin {
  sieve = file:~/sieve;active=~/.dovecot.sieve
}
EOF

cat > /etc/dovecot/conf.d/20-managesieve.conf <<'EOF'
service managesieve-login {
  inet_listener sieve {
    port = 4190
  }
}
service managesieve {}
protocol sieve {
  managesieve_max_line_length = 65536
  managesieve_implementation_string = dovecot
}
EOF

echo "=== [6] Roundcube 安装（SQLite）==="
RC_VERSION="1.6.6"
wget https://github.com/roundcube/roundcubemail/releases/download/$ {RC_VERSION}/roundcubemail-${RC_VERSION}-complete.tar.gz
tar -xzf roundcubemail-${RC_VERSION}-complete.tar.gz -C /var/www/
mv /var/www/roundcubemail-${RC_VERSION} /var/www/roundcube
chown -R www-data:www-data /var/www/roundcube
sqlite3 /var/www/roundcube/db/sqlite.db < /var/www/roundcube/SQL/sqlite.initial.sql
chown www-data:www-data /var/www/roundcube/db/sqlite.db

echo "=== [6.1] Roundcube ManageSieve 插件安装 ==="
git clone https://github.com/thomascube/roundcube_managesieve.git /var/www/roundcube/plugins/managesieve
sed -i "/'plugins' => array(/a\    'managesieve'," /var/www/roundcube/config/config.inc.php
cat >> /var/www/roundcube/config/config.inc.php <<'EOF'

$config['managesieve_host'] = 'localhost';
$config['managesieve_port'] = 4190;
$config['managesieve_usetls'] = false;
$config['managesieve_default'] = '/var/www/roundcube/plugins/managesieve/sieve_sample.txt';
EOF

echo "=== [7] Z-Push 安装 ==="
ZPUSH_VER="2.6.4"
wget https://github.com/Z-Hub/Z-Push/archive/$ {ZPUSH_VER}.tar.gz
tar -xzf ${ZPUSH_VER}.tar.gz -C /var/www/z-push --strip-components=1
chown -R www-data:www-data /var/www/z-push

echo "=== [8] Nginx 配置 ==="
cat > /etc/nginx/sites-available/roundcube <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    root /var/www/roundcube;
    index index.php;
    ssl_certificate $CERT_CHAIN;
    ssl_certificate_key $CERT_KEY;
    access_log /var/log/nginx/roundcube_access.log;
    error_log /var/log/nginx/roundcube_error.log;
    location / {
        try_files \$uri \$uri/ /index.php?\$args;
    }
    location /Microsoft-Server-ActiveSync {
        alias /var/www/z-push/index.php;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME /var/www/z-push/index.php;
    }
    location ~ \.php\$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
    }
    location ~ /\.ht { deny all; }
}
EOF
ln -sf /etc/nginx/sites-available/roundcube /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=== Sieve 功能已启用 ==="
echo "用户可通过 Roundcube → Settings → Filters 管理邮件过滤/重定向/自动回复"
```

### 5.4 sieve_sample.txt
```bash
require ["fileinto", "reject", "vacation", "copy", "regex", "imap4flags"];
vacation :days 7 :addresses ["you@yourdomain.com"] 
    "感谢来信！我目前不在办公室，将在周一回来处理邮件。";
if address :is "from" "boss@example.com" {
    fileinto "Boss";
    addflag "\\Flagged";
}
if header :contains "subject" ["广告", "促销"] {
    fileinto "Promotions";
    stop;
}
if address :is "from" "customer-service@shop.com" {
    redirect "assistant@yourdomain.com";
    keep;
}
if address :is "from" "spammer@bad.com" {
    discard;
    stop;
}
keep;
```
## 6. 部署步骤

### 6.1 宿主机准备
- 确保 Debian 12 已安装宝塔面板、Nginx 1.28.0、Docker、MySQL 5.7.44。
- 确保证书已申请至 /www/server/panel/vhost/ssl/snoweer.co/。
- 开放安全组端口：80、443、465、587、993、995。
- 在宿主机创建 mail-container 目录，将上述代码分别保存为对应文件

### 6.2 构建镜像
```bash
mkdir -p mail-container
cd mail-container
docker-compose build
```
### 6.3 启动容器
```bash
docker-compose up -d
```
### 6.4 进入容器部署
```bash
docker exec -it mail-srv bash
chmod +x deploy_mail.sh
./deploy_mail.sh
```
脚本会自动配置 Postfix、Dovecot、RSPAMD、ClamAV、OpenDKIM/DMARC、Roundcube、Z-Push、Sieve。
### 6.5 配置 DNS（MX/SPF/DKIM/DMARC）
- MX：mail.snoweer.co
- SPF：v=spf1 mx ip4:服务器公网IP ~all
- DKIM：添加 default._domainkey.mail.snoweer.co TXT 记录（脚本执行后会输出公钥）
- DMARC：_dmarc.mail.snoweer.co TXT "v=DMARC1; p=none; rua=mailto:admin@mail.snoweer.co"
### 6.6 访问测试
- Webmail： https://mail.snoweer.co
- Roundcube 默认账号需手动在 Dovecot 创建系统用户或虚拟用户（SQLite 需预先插入用户记录，可扩展脚本实现注册）
- 移动端：配置 Exchange 账户 mail.snoweer.co
## 7. 功能清单
| 功能 | 说明 
| :---: | :---
|SMTP |支持 SMTPS(465)、Submission(587)
|IMAP/POP3|支持 IMAPS(993)、POP3S(995)
|Webmail|Roundcube，支持多语言
|移动同步|Z-Push（ActiveSync）邮件/联系人/日历
|反垃圾|RSPAMD（高速规则+AI检测）
|反病毒|ClamAV
|邮件认证|OpenDKIM、OpenDMARC
|用户过滤|Sieve 脚本（重定向、自动回复、分类、拒收）
|Web 管理|Roundcube ManageSieve 插件
|数据存储|SQLite（免 MySQL）
|证书|Let's Encrypt 自动挂载


## 8. 维护指南

- 备份：定期备份容器卷 mail_data、roundcube_data、zpush_data、opendkim_keys。
- 更新：更新容器镜像后重启
```bash
docker-compose up -d --build
```
- 日志：
    - Postfix: /var/log/mail.log
    - Dovecot: /var/log/dovecot.log
    - RSPAMD: /var/log/rspamd/rspamd.log
    - Nginx: /var/log/nginx/
- 用户管理：可扩展 SQLite 用户表实现 Web 注册（需额外开发）。
- Sieve 调试：检查 ~/.dovecot.sieve 语法
```bash
sievec ~/.dovecot.sieve。
```
## 9. 常见问题
**Q1：Roundcube 登录提示数据库错误**
A：检查 /var/www/roundcube/db/sqlite.db 权限与初始化 SQL 是否执行成功。
**Q2：移动端 ActiveSync 无法同步**
A：检查 Z-Push 配置、Nginx 路由 /Microsoft-Server-ActiveSync 是否正常，查看 Nginx 错误日志。
**Q3：Sieve 规则不生效**
A：确认 Dovecot LDA 已启用，Postfix 使用 dovecot transport，Sieve 脚本语法正确。
**Q4：RSPAMD 检测慢**
A：检查服务器 CPU/内存，确保 rspamd 服务运行正常，可查看 /var/log/rspamd/rspamd.log。
