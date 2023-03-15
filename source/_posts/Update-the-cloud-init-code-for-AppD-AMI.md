---
title: AppDynamics AMI cloud-init code update
date: 2023-03-15 12:00:00
tags:
 - AppD
 - cloud-init
---

```yaml
#cloud-config
#Update the packages onboot.
package_update: true

#ncurses-compat-libs is for Amazon Linux 2.
packages:
  - libaio
  - numactl
  - tzdata
  - ncurses-compat-libs

write_files:
  - path: /etc/profile.d/lang.sh
    content: |
      export LANG=en_US.UTF-8
      export LC_ALL=en_US.UTF-8

  - path: /etc/security/limits.conf
    content: |
      root hard nofile 65535
      root soft nofile 65535
      root hard nproc 8192
      root soft nproc 8192

  - path: /opt/appdynamics/response.varfile.bak
    content: |
      serverHostName=HOST_NAME
      sys.languageId=en
      disableEULA=true
      platformAdmin.port=9191
      platformAdmin.databasePort=3377
      platformAdmin.dataDir=/opt/appdynamics/platform/mysql/data
      platformAdmin.databasePassword=ENTER_PASSWORD
      platformAdmin.databaseRootPassword=ENTER_PASSWORD
      platformAdmin.adminPassword=ENTER_PASSWORD
      platformAdmin.useHttps$Boolean=false
      sys.installationDir=/opt/appdynamics/platform

  - path: /etc/systemd/system/appd.console.service
    permissions: '0644'
    content: |
      [Unit]
      Description=AppDynamics Enterprise Console
      After=network.target

      [Service]
      Type=forking
      ExecStart=/opt/appdynamics/platform/platform-admin/bin/platform-admin.sh start-platform-admin
      ExecStop=/opt/appdynamics/platform/platform-admin/bin/platform-admin.sh stop-platform-admin
      User=root
      Restart=always

      [Install]
      WantedBy=multi-user.target

  - path: /etc/systemd/system/appd.console.install.service
    permissions: '0644'
    content: |
      [Unit]
      Description=AppDynamics Enterprise Console Installation
      After=network.target

      [Service]
      Type=oneshot
      RemainAfterExit=no
      ExecStart=/bin/sh -c 'sleep 5 && cp /opt/appdynamics/response.varfile.bak /opt/appdynamics/response.varfile && sed -i \"s/ENTER_PASSWORD/`curl http://169.254.169.254/latest/meta-data/instance-id`/g\" /opt/appdynamics/response.varfile && sed -i \"s/HOST_NAME/`curl http://169.254.169.254/latest/meta-data/hostname`/g\" /opt/appdynamics/response.varfile && /opt/appdynamics/platform-setup-x64-linux-23.1.1.18.sh -q -varfile /opt/appdynamics/response.varfile && systemctl daemon-reload && systemctl enable appd.console.service && systemctl start appd.console.service'

      [Install]
      WantedBy=multi-user.target

runcmd:
  # Create directory and copy Cisco AppDynamics Enterprise Console setup file
  - aws s3 cp s3://ciscoappdnx/platform-setup-x64-linux-23.1.1.18.sh /opt/appdynamics/ --region cn-northwest-1
  - chmod +x /opt/appdynamics/platform-setup-x64-linux-23.1.1.18.sh
  - systemctl daemon-reload
  - systemctl enable appd.console.install.service
  - sed -i 's/#PermitRootLogin yes/PermitRootLogin no/g' /etc/ssh/sshd_config
  - rm -rf /root/.ssh/authorized_keys
  - rm -rf /home/ec2-user/.ssh/authorized_keys
  - shred -u /etc/ssh/*_key /etc/ssh/*_key.pub
```
