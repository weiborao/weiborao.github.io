---
title: Ansible-K8S-Cilium
date: 2025-08-04 09:23:21
tags:
description: 本文使用Ansible脚本从零开始部署Ubuntu虚拟机，然后在Ubuntu上安装K8S，使用Cilium作为CNI。
---
# Setup K8S with Ansible from zero

# 1. 删除之前的环境

```bash
ois@ois:~/data/k8s-cilium-lab$ cd ..
ois@ois:~/data$ ./07-undefine-vms.sh 
Domain 'k8s-node-1' destroyed

Domain 'k8s-node-1' has been undefined
Volume 'vda'(/home/ois/data/k8s-cilium-lab/nodevms/k8s-node-1.qcow2) removed.

Domain 'k8s-node-2' destroyed

Domain 'k8s-node-2' has been undefined
Volume 'vda'(/home/ois/data/k8s-cilium-lab/nodevms/k8s-node-2.qcow2) removed.

Domain 'k8s-node-3' destroyed

Domain 'k8s-node-3' has been undefined
Volume 'vda'(/home/ois/data/k8s-cilium-lab/nodevms/k8s-node-3.qcow2) removed.

Domain 'dns-bgp-server' destroyed

Domain 'dns-bgp-server' has been undefined
Volume 'vda'(/home/ois/data/k8s-cilium-lab/nodevms/dns-bgp-server.qcow2) removed.

ois@ois:~/data$ rm -rf k8s-cilium-lab/
ois@ois:~/data$ 
```

# 2. 重新构建项目文件结构

```bash
ois@ois:~/data$ ./00-create-project-structure.sh 
--- K8s + Cilium Lab Setup (Warning-Free) ---
This script will prepare a new Ansible project directory named 'k8s-cilium-lab'.

--- Step 1: Checking Prerequisites ---
✅ OS is Debian-based.
✅ Ansible is already installed.
--> Ensuring libvirt and whois are up-to-date...
✅ Dependencies are present.
✅ SSH key already exists at ~/.ssh/id_rsa. Skipping generation.

--- Step 2: Creating Project Structure ---
✅ Project directory structure created in 'k8s-cilium-lab/'.

--- Step 3: Configuring User Password Hash ---
A secure password hash is required for the 'ubuntu' user on the VMs.
Enter the password for the 'ubuntu' user (input will be hidden): 
--> Generating password hash...
✅ Password hash generated.

--- Step 4: Generating Configuration Files ---
✅ Created ansible.cfg
✅ Created inventory.ini
✅ Created group_vars/all.yml with password hash.
✅ Created host_vars/k8s-node-1.yml
✅ Created host_vars/k8s-node-2.yml
✅ Created host_vars/k8s-node-3.yml
✅ Created host_vars/dns-bgp-server.yml

--- Setup Complete! ---
✅ Project 'k8s-cilium-lab' has been successfully configured.

Next Steps:
1. Run the next script to generate the VM creation playbook:
   ../01-create-vms.sh
2. Run the playbook to create your lab VMs (no vault password needed):
   ansible-playbook playbooks/1_create_vms.yml
```

# 3. 生成Playbook，用于构建Lab环境虚拟机

```bash
ois@ois:~/data$ ./01-create-vms.sh 
--- Lab VM Playbook Generator (Final Corrected Version) ---

--- Step 1: Verifying Project Context ---
✅ Working inside project directory: /home/ois/data/k8s-cilium-lab

--- Step 2: Ensuring Directories Exist ---
✅ Directories 'playbooks/' and 'templates/' are ready.

--- Step 3: Generating Files ---
✅ Generated playbook: playbooks/1_create_vms.yml
✅ Generated template: templates/user-data.j2
✅ Generated template: templates/network-config.j2
✅ Generated template: templates/meta-data.j2

--- Generation Complete! ---
✅ All necessary files have been created inside the 'k8s-cilium-lab' directory.

Next Step:
1. Change into the project directory: cd k8s-cilium-lab
2. Run the playbook to create your lab VMs:
   ansible-playbook playbooks/1_create_vms.yml
```

# 4. 运行Playbook，构建虚拟机环境

自动创建k8s-nodes 和 运行FRR的虚拟机，并进行联通性探测，添加到已知主机列表(known_hosts)

```bash
ois@ois:~/data$ cd k8s-cilium-lab/
ois@ois:~/data/k8s-cilium-lab$ 
ois@ois:~/data/k8s-cilium-lab$ 
ois@ois:~/data/k8s-cilium-lab$ ansible-playbook playbooks/1_create_vms.yml

PLAY [Play 1 - Pre-flight Check for Existing VMs] ******************************************************************************************************************************************************

TASK [Check status of each VM with virsh] **************************************************************************************************************************************************************
ok: [dns-bgp-server]
ok: [k8s-node-2]
ok: [k8s-node-1]
ok: [k8s-node-3]

PLAY [Play 2 - Decide if Provisioning is Needed] *******************************************************************************************************************************************************

TASK [Initialize an empty list for missing VMs] ********************************************************************************************************************************************************
ok: [localhost]

TASK [Populate the list of missing VMs] ****************************************************************************************************************************************************************
ok: [localhost] => (item=dns-bgp-server)
ok: [localhost] => (item=k8s-node-1)
ok: [localhost] => (item=k8s-node-2)
ok: [localhost] => (item=k8s-node-3)

TASK [Set global flag if provisioning is required] *****************************************************************************************************************************************************
ok: [localhost]

TASK [Report status] ***********************************************************************************************************************************************************************************
ok: [localhost] => {
    "msg": "Provisioning needed: True. Missing VMs: ['dns-bgp-server', 'k8s-node-1', 'k8s-node-2', 'k8s-node-3']"
}

PLAY [Play 3 - Prepare VM Assets in Parallel] **********************************************************************************************************************************************************
[WARNING]: Using run_once with the free strategy is not currently supported. This task will still be executed for every host in the inventory list.

TASK [Ensure VM directories exist] *********************************************************************************************************************************************************************
changed: [dns-bgp-server] => (item=/home/ois/data/k8s-cilium-lab/nodevms)
ok: [k8s-node-2] => (item=/home/ois/data/k8s-cilium-lab/nodevms)
ok: [k8s-node-3] => (item=/home/ois/data/k8s-cilium-lab/nodevms)
ok: [k8s-node-1] => (item=/home/ois/data/k8s-cilium-lab/nodevms)
changed: [dns-bgp-server] => (item=/home/ois/data/k8s-cilium-lab/nodevm_cfg)
ok: [k8s-node-2] => (item=/home/ois/data/k8s-cilium-lab/nodevm_cfg)
ok: [k8s-node-3] => (item=/home/ois/data/k8s-cilium-lab/nodevm_cfg)
ok: [k8s-node-1] => (item=/home/ois/data/k8s-cilium-lab/nodevm_cfg)

TASK [Check if VM disk image already exists] ***********************************************************************************************************************************************************
ok: [k8s-node-2]
ok: [dns-bgp-server]
ok: [k8s-node-1]
ok: [k8s-node-3]

TASK [Create VM disk image from base image] ************************************************************************************************************************************************************
changed: [dns-bgp-server]
changed: [k8s-node-2]
changed: [k8s-node-1]
changed: [k8s-node-3]

TASK [Resize VM disk image] ****************************************************************************************************************************************************************************
changed: [dns-bgp-server]
changed: [k8s-node-2]
changed: [k8s-node-3]
changed: [k8s-node-1]

TASK [Generate cloud-init files] ***********************************************************************************************************************************************************************
changed: [k8s-node-2] => (item={'src': '../templates/user-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-2_user-data'})
changed: [k8s-node-3] => (item={'src': '../templates/user-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-3_user-data'})
changed: [dns-bgp-server] => (item={'src': '../templates/user-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/dns-bgp-server_user-data'})
changed: [k8s-node-1] => (item={'src': '../templates/user-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-1_user-data'})
changed: [k8s-node-3] => (item={'src': '../templates/network-config.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-3_network-config'})
changed: [k8s-node-2] => (item={'src': '../templates/network-config.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-2_network-config'})
changed: [k8s-node-1] => (item={'src': '../templates/network-config.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-1_network-config'})
changed: [dns-bgp-server] => (item={'src': '../templates/network-config.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/dns-bgp-server_network-config'})
changed: [k8s-node-3] => (item={'src': '../templates/meta-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-3_meta-data'})
changed: [k8s-node-2] => (item={'src': '../templates/meta-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-2_meta-data'})
changed: [k8s-node-1] => (item={'src': '../templates/meta-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-1_meta-data'})
changed: [dns-bgp-server] => (item={'src': '../templates/meta-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/dns-bgp-server_meta-data'})

PLAY [Play 4 - Install VMs Sequentially to Avoid Race Condition] ***************************************************************************************************************************************

TASK [Create and start the VM with virt-install] *******************************************************************************************************************************************************
changed: [dns-bgp-server]

PLAY [Play 4 - Install VMs Sequentially to Avoid Race Condition] ***************************************************************************************************************************************

TASK [Create and start the VM with virt-install] *******************************************************************************************************************************************************
changed: [k8s-node-1]

PLAY [Play 4 - Install VMs Sequentially to Avoid Race Condition] ***************************************************************************************************************************************

TASK [Create and start the VM with virt-install] *******************************************************************************************************************************************************
changed: [k8s-node-2]

PLAY [Play 4 - Install VMs Sequentially to Avoid Race Condition] ***************************************************************************************************************************************

TASK [Create and start the VM with virt-install] *******************************************************************************************************************************************************
changed: [k8s-node-3]

PLAY [Play 5 - Verify VM Connectivity in Parallel] *****************************************************************************************************************************************************

TASK [Wait for VMs to boot and SSH to become available] ************************************************************************************************************************************************
ok: [dns-bgp-server -> localhost]
ok: [k8s-node-1 -> localhost]
# 10.75.59.86:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.81:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.81:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.86:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.81:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.81:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.86:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.81:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.86:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.86:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12

TASK [Add host keys to known_hosts file] ***************************************************************************************************************************************************************
changed: [k8s-node-1 -> localhost]
changed: [dns-bgp-server -> localhost]

TASK [Wait for VMs to boot and SSH to become available] ************************************************************************************************************************************************
ok: [k8s-node-3 -> localhost]
# 10.75.59.83:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.83:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.83:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.83:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.83:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12

TASK [Add host keys to known_hosts file] ***************************************************************************************************************************************************************
changed: [k8s-node-3 -> localhost]

TASK [Wait for VMs to boot and SSH to become available] ************************************************************************************************************************************************
ok: [k8s-node-2 -> localhost]
# 10.75.59.82:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.82:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.82:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.82:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12
# 10.75.59.82:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.12

TASK [Add host keys to known_hosts file] ***************************************************************************************************************************************************************
changed: [k8s-node-2 -> localhost]

PLAY RECAP *********************************************************************************************************************************************************************************************
dns-bgp-server             : ok=9    changed=6    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
k8s-node-1                 : ok=9    changed=5    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
k8s-node-2                 : ok=9    changed=5    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
k8s-node-3                 : ok=9    changed=5    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
localhost                  : ok=4    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
```

多次运行，以测试幂等性，多次运行不影响结果，已执行过的任务会自行跳过。

```bash
ois@ois:~/data/k8s-cilium-lab$ ansible-playbook playbooks/1_create_vms.yml

PLAY [Play 1 - Pre-flight Check for Existing VMs] ******************************************************************************************************************************************************

TASK [Check status of each VM with virsh] **************************************************************************************************************************************************************
ok: [k8s-node-3]
ok: [k8s-node-1]
ok: [dns-bgp-server]
ok: [k8s-node-2]

PLAY [Play 2 - Decide if Provisioning is Needed] *******************************************************************************************************************************************************

TASK [Initialize an empty list for missing VMs] ********************************************************************************************************************************************************
ok: [localhost]

TASK [Populate the list of missing VMs] ****************************************************************************************************************************************************************
skipping: [localhost] => (item=dns-bgp-server) 
skipping: [localhost] => (item=k8s-node-1) 
skipping: [localhost] => (item=k8s-node-2) 
skipping: [localhost] => (item=k8s-node-3) 
skipping: [localhost]

TASK [Set global flag if provisioning is required] *****************************************************************************************************************************************************
ok: [localhost]

TASK [Report status] ***********************************************************************************************************************************************************************************
ok: [localhost] => {
    "msg": "Provisioning needed: False. Missing VMs: []"
}

PLAY [Play 3 - Prepare VM Assets in Parallel] **********************************************************************************************************************************************************
[WARNING]: Using run_once with the free strategy is not currently supported. This task will still be executed for every host in the inventory list.

TASK [Ensure VM directories exist] *********************************************************************************************************************************************************************
skipping: [dns-bgp-server] => (item=/home/ois/data/k8s-cilium-lab/nodevms) 
skipping: [dns-bgp-server] => (item=/home/ois/data/k8s-cilium-lab/nodevm_cfg) 
skipping: [k8s-node-1] => (item=/home/ois/data/k8s-cilium-lab/nodevms) 
skipping: [dns-bgp-server]
skipping: [k8s-node-1] => (item=/home/ois/data/k8s-cilium-lab/nodevm_cfg) 
skipping: [k8s-node-2] => (item=/home/ois/data/k8s-cilium-lab/nodevms) 
skipping: [k8s-node-2] => (item=/home/ois/data/k8s-cilium-lab/nodevm_cfg) 
skipping: [k8s-node-3] => (item=/home/ois/data/k8s-cilium-lab/nodevms) 
skipping: [k8s-node-3] => (item=/home/ois/data/k8s-cilium-lab/nodevm_cfg) 
skipping: [k8s-node-1]
skipping: [k8s-node-2]
skipping: [k8s-node-3]

TASK [Check if VM disk image already exists] ***********************************************************************************************************************************************************
skipping: [dns-bgp-server]
skipping: [k8s-node-1]
skipping: [k8s-node-2]
skipping: [k8s-node-3]

TASK [Create VM disk image from base image] ************************************************************************************************************************************************************
skipping: [dns-bgp-server]
skipping: [k8s-node-1]
skipping: [k8s-node-2]
skipping: [k8s-node-3]

TASK [Resize VM disk image] ****************************************************************************************************************************************************************************
skipping: [dns-bgp-server]
skipping: [k8s-node-1]
skipping: [k8s-node-2]
skipping: [k8s-node-3]

TASK [Generate cloud-init files] ***********************************************************************************************************************************************************************
skipping: [k8s-node-1] => (item={'src': '../templates/user-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-1_user-data'}) 
skipping: [k8s-node-1] => (item={'src': '../templates/network-config.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-1_network-config'}) 
skipping: [k8s-node-2] => (item={'src': '../templates/user-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-2_user-data'}) 
skipping: [k8s-node-1] => (item={'src': '../templates/meta-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-1_meta-data'}) 
skipping: [k8s-node-1]
skipping: [k8s-node-2] => (item={'src': '../templates/network-config.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-2_network-config'}) 
skipping: [dns-bgp-server] => (item={'src': '../templates/user-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/dns-bgp-server_user-data'}) 
skipping: [k8s-node-2] => (item={'src': '../templates/meta-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-2_meta-data'}) 
skipping: [k8s-node-2]
skipping: [dns-bgp-server] => (item={'src': '../templates/network-config.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/dns-bgp-server_network-config'}) 
skipping: [dns-bgp-server] => (item={'src': '../templates/meta-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/dns-bgp-server_meta-data'}) 
skipping: [k8s-node-3] => (item={'src': '../templates/user-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-3_user-data'}) 
skipping: [dns-bgp-server]
skipping: [k8s-node-3] => (item={'src': '../templates/network-config.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-3_network-config'}) 
skipping: [k8s-node-3] => (item={'src': '../templates/meta-data.j2', 'dest': '/home/ois/data/k8s-cilium-lab/nodevm_cfg/k8s-node-3_meta-data'}) 
skipping: [k8s-node-3]

PLAY [Play 4 - Install VMs Sequentially to Avoid Race Condition] ***************************************************************************************************************************************

TASK [Create and start the VM with virt-install] *******************************************************************************************************************************************************
skipping: [dns-bgp-server]

PLAY [Play 4 - Install VMs Sequentially to Avoid Race Condition] ***************************************************************************************************************************************

TASK [Create and start the VM with virt-install] *******************************************************************************************************************************************************
skipping: [k8s-node-1]

PLAY [Play 4 - Install VMs Sequentially to Avoid Race Condition] ***************************************************************************************************************************************

TASK [Create and start the VM with virt-install] *******************************************************************************************************************************************************
skipping: [k8s-node-2]

PLAY [Play 4 - Install VMs Sequentially to Avoid Race Condition] ***************************************************************************************************************************************

TASK [Create and start the VM with virt-install] *******************************************************************************************************************************************************
skipping: [k8s-node-3]

PLAY [Play 5 - Verify VM Connectivity in Parallel] *****************************************************************************************************************************************************

TASK [Wait for VMs to boot and SSH to become available] ************************************************************************************************************************************************
skipping: [dns-bgp-server]
skipping: [k8s-node-1]
skipping: [k8s-node-2]
skipping: [k8s-node-3]

TASK [Add host keys to known_hosts file] ***************************************************************************************************************************************************************
skipping: [dns-bgp-server]
skipping: [k8s-node-1]
skipping: [k8s-node-2]
skipping: [k8s-node-3]

PLAY RECAP *********************************************************************************************************************************************************************************************
dns-bgp-server             : ok=1    changed=0    unreachable=0    failed=0    skipped=8    rescued=0    ignored=0   
k8s-node-1                 : ok=1    changed=0    unreachable=0    failed=0    skipped=8    rescued=0    ignored=0   
k8s-node-2                 : ok=1    changed=0    unreachable=0    failed=0    skipped=8    rescued=0    ignored=0   
k8s-node-3                 : ok=1    changed=0    unreachable=0    failed=0    skipped=8    rescued=0    ignored=0   
localhost                  : ok=3    changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   
```

# 5. 生成Playbook以便安装Containerd和K8S工具

```bash
ois@ois:~/data/k8s-cilium-lab$ cd ..
ois@ois:~/data$ ./02-prepare-nodes.sh 
--- Node Preparation Playbook Generator (with cloud-init wait) ---

--- Step 1: Verifying Project Context ---
✅ Working inside project directory: /home/ois/data/k8s-cilium-lab

--- Step 2: Ensuring Role Directories Exist ---
✅ Role directories created.

--- Step 3: Generating Role Task Files ---
✅ Created tasks for 'common' role.
✅ Created tasks for 'k8s_node' role.
✅ Created tasks for 'infra_server' role.

--- Step 4: Generating Config Templates ---
✅ Created /etc/hosts template.
✅ Created containerd config template.
✅ Created FRR config template.

--- Step 5: Generating Main Playbook ---
✅ Created main playbook: playbooks/2_prepare_nodes.yml

--- Generation Complete! ---
✅ All necessary files for node preparation have been created.

Next Step:
1. Change into the project directory: cd k8s-cilium-lab
2. Run the playbook to prepare your nodes. You will be prompted for the sudo password:
   ansible-playbook playbooks/2_prepare_nodes.yml --ask-become-pass
```

# 6. 执行Playbook，安装Containerd和K8S工具

```bash
ois@ois:~/data$ cd k8s-cilium-lab/
ois@ois:~/data/k8s-cilium-lab$ ansible-playbook playbooks/2_prepare_nodes.yml --ask-become-pass
BECOME password: 

PLAY [Play 1 - Prepare All Nodes] **********************************************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [dns-bgp-server]
ok: [k8s-node-3]
ok: [k8s-node-2]
ok: [k8s-node-1]

TASK [common : Wait for cloud-init to complete] ********************************************************************************************************************************************************
ok: [dns-bgp-server]
ok: [k8s-node-2]
ok: [k8s-node-3]
ok: [k8s-node-1]

TASK [common : Update apt cache and upgrade all packages] **********************************************************************************************************************************************
changed: [dns-bgp-server]
changed: [k8s-node-3]
changed: [k8s-node-1]
changed: [k8s-node-2]

TASK [common : Configure /etc/hosts from template] *****************************************************************************************************************************************************
changed: [k8s-node-2]
changed: [dns-bgp-server]
changed: [k8s-node-3]
changed: [k8s-node-1]

TASK [common : Turn off all swap devices] **************************************************************************************************************************************************************
skipping: [dns-bgp-server]
skipping: [k8s-node-1]
skipping: [k8s-node-2]
skipping: [k8s-node-3]

TASK [common : Comment out swap entries in /etc/fstab] *************************************************************************************************************************************************
skipping: [dns-bgp-server]
skipping: [k8s-node-1]
skipping: [k8s-node-2]
skipping: [k8s-node-3]

TASK [common : Load required kernel modules] ***********************************************************************************************************************************************************
changed: [dns-bgp-server] => (item=overlay)
changed: [k8s-node-1] => (item=overlay)
changed: [k8s-node-2] => (item=overlay)
changed: [k8s-node-3] => (item=overlay)
changed: [k8s-node-2] => (item=br_netfilter)
changed: [dns-bgp-server] => (item=br_netfilter)
changed: [k8s-node-1] => (item=br_netfilter)
changed: [k8s-node-3] => (item=br_netfilter)

TASK [common : Ensure kernel modules are loaded on boot] ***********************************************************************************************************************************************
changed: [dns-bgp-server]
changed: [k8s-node-1]
changed: [k8s-node-3]
changed: [k8s-node-2]

TASK [common : Configure sysctl parameters for Kubernetes networking] **********************************************************************************************************************************
changed: [dns-bgp-server]
changed: [k8s-node-1]
changed: [k8s-node-3]
changed: [k8s-node-2]

TASK [common : Apply sysctl settings without reboot] ***************************************************************************************************************************************************
ok: [dns-bgp-server]
ok: [k8s-node-1]
ok: [k8s-node-3]
ok: [k8s-node-2]

PLAY [Play 2 - Prepare Kubernetes Nodes] ***************************************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [k8s-node-3]
ok: [k8s-node-1]
ok: [k8s-node-2]

TASK [k8s_node : Install prerequisite packages] ********************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [k8s_node : Ensure apt keyrings directory exists] *************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-3]
ok: [k8s-node-2]

TASK [k8s_node : Add Docker's official GPG key] ********************************************************************************************************************************************************
changed: [k8s-node-2]
changed: [k8s-node-3]
changed: [k8s-node-1]

TASK [k8s_node : Add Docker's repository to Apt sources] ***********************************************************************************************************************************************
changed: [k8s-node-2]
changed: [k8s-node-1]
changed: [k8s-node-3]

TASK [k8s_node : Install containerd] *******************************************************************************************************************************************************************
changed: [k8s-node-1]
changed: [k8s-node-2]
changed: [k8s-node-3]

TASK [k8s_node : Configure containerd from template] ***************************************************************************************************************************************************
changed: [k8s-node-1]
changed: [k8s-node-2]
changed: [k8s-node-3]

TASK [k8s_node : Install prerequisite packages for Kubernetes repo] ************************************************************************************************************************************
changed: [k8s-node-2]
changed: [k8s-node-3]
changed: [k8s-node-1]

TASK [k8s_node : Download the Kubernetes public signing key] *******************************************************************************************************************************************
changed: [k8s-node-2]
changed: [k8s-node-1]
changed: [k8s-node-3]

TASK [k8s_node : Dearmor the Kubernetes GPG key] *******************************************************************************************************************************************************
changed: [k8s-node-1]
changed: [k8s-node-2]
changed: [k8s-node-3]

TASK [k8s_node : Add Kubernetes APT repository] ********************************************************************************************************************************************************
changed: [k8s-node-2]
changed: [k8s-node-1]
changed: [k8s-node-3]

TASK [k8s_node : Clean up temporary key file] **********************************************************************************************************************************************************
changed: [k8s-node-1]
changed: [k8s-node-2]
changed: [k8s-node-3]

TASK [k8s_node : Install kubelet, kubeadm, and kubectl] ************************************************************************************************************************************************
changed: [k8s-node-3]
changed: [k8s-node-1]
changed: [k8s-node-2]

TASK [k8s_node : Pin Kubernetes package versions] ******************************************************************************************************************************************************
changed: [k8s-node-2] => (item=kubelet)
changed: [k8s-node-3] => (item=kubelet)
changed: [k8s-node-1] => (item=kubelet)
changed: [k8s-node-2] => (item=kubeadm)
changed: [k8s-node-1] => (item=kubeadm)
changed: [k8s-node-3] => (item=kubeadm)
changed: [k8s-node-2] => (item=kubectl)
changed: [k8s-node-3] => (item=kubectl)
changed: [k8s-node-1] => (item=kubectl)

TASK [k8s_node : Enable and start kubelet service] *****************************************************************************************************************************************************
changed: [k8s-node-2]
changed: [k8s-node-3]
changed: [k8s-node-1]

RUNNING HANDLER [Restart containerd] *******************************************************************************************************************************************************************
changed: [k8s-node-2]
changed: [k8s-node-1]
changed: [k8s-node-3]

PLAY [Play 3 - Prepare Infrastructure Server] **********************************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [dns-bgp-server]

TASK [infra_server : Install dnsmasq and FRR] **********************************************************************************************************************************************************
changed: [dns-bgp-server]

TASK [infra_server : Configure dnsmasq] ****************************************************************************************************************************************************************
changed: [dns-bgp-server]

TASK [infra_server : Configure FRR daemons] ************************************************************************************************************************************************************
ok: [dns-bgp-server] => (item=zebra)
changed: [dns-bgp-server] => (item=bgpd)

TASK [infra_server : Configure frr.conf] ***************************************************************************************************************************************************************
changed: [dns-bgp-server]

TASK [infra_server : Ensure FRR config has correct permissions] ****************************************************************************************************************************************
ok: [dns-bgp-server]

RUNNING HANDLER [Restart dnsmasq] **********************************************************************************************************************************************************************
changed: [dns-bgp-server]

RUNNING HANDLER [Restart frr] **************************************************************************************************************************************************************************
changed: [dns-bgp-server]

PLAY RECAP *********************************************************************************************************************************************************************************************
dns-bgp-server             : ok=16   changed=11   unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
k8s-node-1                 : ok=24   changed=18   unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
k8s-node-2                 : ok=24   changed=18   unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
k8s-node-3                 : ok=24   changed=18   unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
```

多次执行Playbook，验证幂等性

```bash
ois@ois:~/data/k8s-cilium-lab$ ansible-playbook playbooks/2_prepare_nodes.yml --ask-become-pass
BECOME password: 

PLAY [Play 1 - Prepare All Nodes] **********************************************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [k8s-node-2]
ok: [dns-bgp-server]
ok: [k8s-node-3]
ok: [k8s-node-1]

TASK [common : Wait for cloud-init to complete] ********************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [dns-bgp-server]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [common : Update apt cache and upgrade all packages] **********************************************************************************************************************************************
ok: [dns-bgp-server]
ok: [k8s-node-2]
ok: [k8s-node-3]
ok: [k8s-node-1]

TASK [common : Configure /etc/hosts from template] *****************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-3]
ok: [dns-bgp-server]
ok: [k8s-node-2]

TASK [common : Turn off all swap devices] **************************************************************************************************************************************************************
skipping: [dns-bgp-server]
skipping: [k8s-node-1]
skipping: [k8s-node-2]
skipping: [k8s-node-3]

TASK [common : Comment out swap entries in /etc/fstab] *************************************************************************************************************************************************
skipping: [dns-bgp-server]
skipping: [k8s-node-1]
skipping: [k8s-node-2]
skipping: [k8s-node-3]

TASK [common : Load required kernel modules] ***********************************************************************************************************************************************************
ok: [k8s-node-2] => (item=overlay)
ok: [dns-bgp-server] => (item=overlay)
ok: [k8s-node-3] => (item=overlay)
ok: [k8s-node-1] => (item=overlay)
ok: [k8s-node-2] => (item=br_netfilter)
ok: [dns-bgp-server] => (item=br_netfilter)
ok: [k8s-node-3] => (item=br_netfilter)
ok: [k8s-node-1] => (item=br_netfilter)

TASK [common : Ensure kernel modules are loaded on boot] ***********************************************************************************************************************************************
ok: [k8s-node-1]
ok: [dns-bgp-server]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [common : Configure sysctl parameters for Kubernetes networking] **********************************************************************************************************************************
ok: [dns-bgp-server]
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [common : Apply sysctl settings without reboot] ***************************************************************************************************************************************************
ok: [dns-bgp-server]
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

PLAY [Play 2 - Prepare Kubernetes Nodes] ***************************************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [k8s-node-2]
ok: [k8s-node-1]
ok: [k8s-node-3]

TASK [k8s_node : Install prerequisite packages] ********************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [k8s_node : Ensure apt keyrings directory exists] *************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [k8s_node : Add Docker's official GPG key] ********************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [k8s_node : Add Docker's repository to Apt sources] ***********************************************************************************************************************************************
ok: [k8s-node-2]
ok: [k8s-node-1]
ok: [k8s-node-3]

TASK [k8s_node : Install containerd] *******************************************************************************************************************************************************************
ok: [k8s-node-2]
ok: [k8s-node-1]
ok: [k8s-node-3]

TASK [k8s_node : Configure containerd from template] ***************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [k8s_node : Install prerequisite packages for Kubernetes repo] ************************************************************************************************************************************
ok: [k8s-node-2]
ok: [k8s-node-1]
ok: [k8s-node-3]

TASK [k8s_node : Download the Kubernetes public signing key] *******************************************************************************************************************************************
changed: [k8s-node-2]
changed: [k8s-node-1]
changed: [k8s-node-3]

TASK [k8s_node : Dearmor the Kubernetes GPG key] *******************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [k8s_node : Add Kubernetes APT repository] ********************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [k8s_node : Clean up temporary key file] **********************************************************************************************************************************************************
changed: [k8s-node-1]
changed: [k8s-node-2]
changed: [k8s-node-3]

TASK [k8s_node : Install kubelet, kubeadm, and kubectl] ************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [k8s_node : Pin Kubernetes package versions] ******************************************************************************************************************************************************
ok: [k8s-node-1] => (item=kubelet)
ok: [k8s-node-2] => (item=kubelet)
ok: [k8s-node-3] => (item=kubelet)
ok: [k8s-node-1] => (item=kubeadm)
ok: [k8s-node-2] => (item=kubeadm)
ok: [k8s-node-3] => (item=kubeadm)
ok: [k8s-node-1] => (item=kubectl)
ok: [k8s-node-2] => (item=kubectl)
ok: [k8s-node-3] => (item=kubectl)

TASK [k8s_node : Enable and start kubelet service] *****************************************************************************************************************************************************
ok: [k8s-node-1]
ok: [k8s-node-2]
ok: [k8s-node-3]

PLAY [Play 3 - Prepare Infrastructure Server] **********************************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [dns-bgp-server]

TASK [infra_server : Install dnsmasq and FRR] **********************************************************************************************************************************************************
ok: [dns-bgp-server]

TASK [infra_server : Configure dnsmasq] ****************************************************************************************************************************************************************
ok: [dns-bgp-server]

TASK [infra_server : Configure FRR daemons] ************************************************************************************************************************************************************
ok: [dns-bgp-server] => (item=zebra)
ok: [dns-bgp-server] => (item=bgpd)

TASK [infra_server : Configure frr.conf] ***************************************************************************************************************************************************************
ok: [dns-bgp-server]

TASK [infra_server : Ensure FRR config has correct permissions] ****************************************************************************************************************************************
ok: [dns-bgp-server]

PLAY RECAP *********************************************************************************************************************************************************************************************
dns-bgp-server             : ok=14   changed=0    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
k8s-node-1                 : ok=23   changed=2    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
k8s-node-2                 : ok=23   changed=2    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
k8s-node-3                 : ok=23   changed=2    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
```

# 7. 执行脚本，构建设置K8S Cluster的Playbook

```bash
ois@ois:~/data/k8s-cilium-lab$ cd ..
ois@ois:~/data$ ./03-setup-cluster.sh 
--- Kubernetes Cluster Setup Playbook Generator ---

--- Step 1: Verifying Project Context ---
✅ Working inside project directory: /home/ois/data/k8s-cilium-lab

--- Step 2: Checking for 'community.kubernetes' Ansible Collection ---
✅ 'community.kubernetes' collection is already installed.

--- Step 3: Generating Cilium BGP Template ---
✅ Created Cilium BGP config template.

--- Step 4: Generating Main Playbook ---
✅ Created main playbook: playbooks/3_setup_cluster.yml

--- Generation Complete! ---
✅ All necessary files for cluster setup have been created.

Next Step:
1. IMPORTANT: Reset your cluster nodes to ensure a clean state for this new workflow.
   On each K8s VM, run: sudo kubeadm reset -f
2. Change into the project directory: cd k8s-cilium-lab
3. Run the playbook to build your Kubernetes cluster. You will be prompted for the sudo password:
   ansible-playbook playbooks/3_setup_cluster.yml --ask-become-pass
```

# 8. 执行Playbook 设置K8S Cluster和Clium

```bash
ois@ois:~/data$ cd k8s-cilium-lab/
ois@ois:~/data/k8s-cilium-lab$ ansible-playbook playbooks/3_setup_cluster.yml --ask-become-pass
BECOME password: 
[DEPRECATION WARNING]: community.kubernetes.helm_repository has been deprecated. The community.kubernetes collection is being renamed to kubernetes.core. Please update your FQCNs to kubernetes.core 
instead. This feature will be removed from community.kubernetes in version 3.0.0. Deprecation warnings can be disabled by setting deprecation_warnings=False in ansible.cfg.
[DEPRECATION WARNING]: community.kubernetes.helm has been deprecated. The community.kubernetes collection is being renamed to kubernetes.core. Please update your FQCNs to kubernetes.core instead. 
This feature will be removed from community.kubernetes in version 3.0.0. Deprecation warnings can be disabled by setting deprecation_warnings=False in ansible.cfg.
[DEPRECATION WARNING]: community.kubernetes.k8s has been deprecated. The community.kubernetes collection is being renamed to kubernetes.core. Please update your FQCNs to kubernetes.core instead. This
 feature will be removed from community.kubernetes in version 3.0.0. Deprecation warnings can be disabled by setting deprecation_warnings=False in ansible.cfg.
[DEPRECATION WARNING]: community.kubernetes.k8s_info has been deprecated. The community.kubernetes collection is being renamed to kubernetes.core. Please update your FQCNs to kubernetes.core instead.
 This feature will be removed from community.kubernetes in version 3.0.0. Deprecation warnings can be disabled by setting deprecation_warnings=False in ansible.cfg.

PLAY [Play 1 - Initialize and Configure Control Plane] *************************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Check if cluster is already initialized] *********************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Initialize the cluster] **************************************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Create .kube directory for ubuntu user] **********************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Copy admin.conf to user's kube config] ***********************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Set KUBECONFIG for root user permanently] ********************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Install prerequisites for Kubernetes modules] ****************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Install Helm] ************************************************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Install Cilium CLI] ******************************************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Add Helm repositories] ***************************************************************************************************************************************************************************
changed: [k8s-node-1] => (item={'name': 'cilium', 'url': 'https://helm.cilium.io/'})
changed: [k8s-node-1] => (item={'name': 'isovalent', 'url': 'https://helm.isovalent.com/'})

TASK [Deploy Cilium and Hubble with Helm] **************************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Expose Hubble UI service via NodePort] ***********************************************************************************************************************************************************
[WARNING]: kubernetes<24.2.0 is not supported or tested. Some features may not work.
changed: [k8s-node-1]

TASK [Wait for Cilium CRDs to become available] ********************************************************************************************************************************************************
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (20 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (19 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (18 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (17 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (16 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (15 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (14 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (13 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (12 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (11 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (10 retries left).
FAILED - RETRYING: [k8s-node-1]: Wait for Cilium CRDs to become available (9 retries left).
ok: [k8s-node-1]

TASK [Apply Cilium BGP Configuration from template] ****************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Generate a token for workers to join] ************************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Store the join command for other hosts to access] ************************************************************************************************************************************************
ok: [k8s-node-1]

PLAY [Play 2 - Join Worker Nodes to the Fully Configured Cluster] **************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [Check if node has already joined] ****************************************************************************************************************************************************************
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [Join the cluster] ********************************************************************************************************************************************************************************
changed: [k8s-node-2]
changed: [k8s-node-3]

PLAY [Play 3 - Display Final Access Information] *******************************************************************************************************************************************************

TASK [Get Hubble UI service details] *******************************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Display the final access URL] ********************************************************************************************************************************************************************
ok: [k8s-node-1] => {
    "msg": "========================================================\n🚀 Your Kubernetes Lab is Ready!\n\nAccess the Hubble UI at:\nhttp://10.75.59.81:31708\n========================================================\n"
}

PLAY RECAP *********************************************************************************************************************************************************************************************
k8s-node-1                 : ok=18   changed=12   unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
k8s-node-2                 : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
k8s-node-3                 : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
```

# 9. 多次执行Playbook，验证幂等性。

```bash
ois@ois:~/data/k8s-cilium-lab$ ansible-playbook playbooks/3_setup_cluster.yml --ask-become-pass
BECOME password: 
[DEPRECATION WARNING]: community.kubernetes.helm_repository has been deprecated. The community.kubernetes collection is being renamed to kubernetes.core. Please update your FQCNs to kubernetes.core 
instead. This feature will be removed from community.kubernetes in version 3.0.0. Deprecation warnings can be disabled by setting deprecation_warnings=False in ansible.cfg.
[DEPRECATION WARNING]: community.kubernetes.helm has been deprecated. The community.kubernetes collection is being renamed to kubernetes.core. Please update your FQCNs to kubernetes.core instead. 
This feature will be removed from community.kubernetes in version 3.0.0. Deprecation warnings can be disabled by setting deprecation_warnings=False in ansible.cfg.
[DEPRECATION WARNING]: community.kubernetes.k8s has been deprecated. The community.kubernetes collection is being renamed to kubernetes.core. Please update your FQCNs to kubernetes.core instead. This
 feature will be removed from community.kubernetes in version 3.0.0. Deprecation warnings can be disabled by setting deprecation_warnings=False in ansible.cfg.
[DEPRECATION WARNING]: community.kubernetes.k8s_info has been deprecated. The community.kubernetes collection is being renamed to kubernetes.core. Please update your FQCNs to kubernetes.core instead.
 This feature will be removed from community.kubernetes in version 3.0.0. Deprecation warnings can be disabled by setting deprecation_warnings=False in ansible.cfg.

PLAY [Play 1 - Initialize and Configure Control Plane] *************************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Check if cluster is already initialized] *********************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Initialize the cluster] **************************************************************************************************************************************************************************
skipping: [k8s-node-1]

TASK [Create .kube directory for ubuntu user] **********************************************************************************************************************************************************
skipping: [k8s-node-1]

TASK [Copy admin.conf to user's kube config] ***********************************************************************************************************************************************************
skipping: [k8s-node-1]

TASK [Set KUBECONFIG for root user permanently] ********************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Install prerequisites for Kubernetes modules] ****************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Install Helm] ************************************************************************************************************************************************************************************
skipping: [k8s-node-1]

TASK [Install Cilium CLI] ******************************************************************************************************************************************************************************
skipping: [k8s-node-1]

TASK [Add Helm repositories] ***************************************************************************************************************************************************************************
ok: [k8s-node-1] => (item={'name': 'cilium', 'url': 'https://helm.cilium.io/'})
ok: [k8s-node-1] => (item={'name': 'isovalent', 'url': 'https://helm.isovalent.com/'})

TASK [Deploy Cilium and Hubble with Helm] **************************************************************************************************************************************************************
[WARNING]: The default idempotency check can fail to report changes in certain cases. Install helm diff >= 3.4.1 for better results.
ok: [k8s-node-1]

TASK [Expose Hubble UI service via NodePort] ***********************************************************************************************************************************************************
[WARNING]: kubernetes<24.2.0 is not supported or tested. Some features may not work.
ok: [k8s-node-1]

TASK [Wait for Cilium CRDs to become available] ********************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Apply Cilium BGP Configuration from template] ****************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Generate a token for workers to join] ************************************************************************************************************************************************************
changed: [k8s-node-1]

TASK [Store the join command for other hosts to access] ************************************************************************************************************************************************
ok: [k8s-node-1]

PLAY [Play 2 - Join Worker Nodes to the Fully Configured Cluster] **************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [Check if node has already joined] ****************************************************************************************************************************************************************
ok: [k8s-node-2]
ok: [k8s-node-3]

TASK [Join the cluster] ********************************************************************************************************************************************************************************
skipping: [k8s-node-2]
skipping: [k8s-node-3]

PLAY [Play 3 - Display Final Access Information] *******************************************************************************************************************************************************

TASK [Get Hubble UI service details] *******************************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Display the final access URL] ********************************************************************************************************************************************************************
ok: [k8s-node-1] => {
    "msg": "========================================================\n🚀 Your Kubernetes Lab is Ready!\n\nAccess the Hubble UI at:\nhttp://10.75.59.81:31708\n========================================================\n"
}

PLAY RECAP *********************************************************************************************************************************************************************************************
k8s-node-1                 : ok=13   changed=1    unreachable=0    failed=0    skipped=5    rescued=0    ignored=0   
k8s-node-2                 : ok=2    changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   
k8s-node-3                 : ok=2    changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   
```

# 10. 部署Demo App

```bash
ois@ois:~/data/k8s-cilium-lab$ cd ../
ois@ois:~/data$ ./04-deploy-star-wars.sh 
--- Star Wars Demo Script Deployer ---

--- Step 1: Verifying Project Context ---
✅ Working inside project directory: /home/ois/data/k8s-cilium-lab

--- Step 2: Generating the script template ---
✅ Created template: templates/deploy-star-wars.sh.j2

--- Step 3: Generating the deployment playbook ---
✅ Created playbook: playbooks/4_deploy_app.yml

--- Generation Complete! ---
✅ All necessary files for deploying the application script have been created.

Next Steps:
1. Change into the project directory: cd k8s-cilium-lab
2. Run the playbook to copy the script to your control plane node:
   ansible-playbook playbooks/4_deploy_app.yml --ask-become-pass
3. SSH into the control plane and run the script:
   ssh ubuntu@k8s-node-1
   sudo /root/deploy-star-wars.sh
ois@ois:~/data$ cd k8s-cilium-lab/
ois@ois:~/data/k8s-cilium-lab$ ansible-playbook playbooks/4_deploy_app.yml --ask-become-pass
BECOME password: 

PLAY [Deploy Star Wars Demo Script] ********************************************************************************************************************************************************************

TASK [Gathering Facts] *********************************************************************************************************************************************************************************
ok: [k8s-node-1]

TASK [Copy the Star Wars deployment script to the control plane] ***************************************************************************************************************************************
changed: [k8s-node-1]

PLAY RECAP *********************************************************************************************************************************************************************************************
k8s-node-1                 : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   

ois@ois:~/data/k8s-cilium-lab$ 
ois@ois:~/data/k8s-cilium-lab$ ssh ubuntu@10.75.59.81
Welcome to Ubuntu 24.04.2 LTS (GNU/Linux 6.8.0-63-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

 System information as of Mon Aug  4 05:00:52 PM CST 2025

  System load:  0.26               Processes:               195
  Usage of /:   33.4% of 18.33GB   Users logged in:         0
  Memory usage: 16%                IPv4 address for enp1s0: 10.75.59.81
  Swap usage:   0%


Expanded Security Maintenance for Applications is not enabled.

0 updates can be applied immediately.

Enable ESM Apps to receive additional future security updates.
See https://ubuntu.com/esm or run: sudo pro status


*** System restart required ***
Last login: Mon Aug  4 16:55:53 2025 from 10.75.59.129
ubuntu@k8s-node-1:~$ sudo su
[sudo] password for ubuntu: 
root@k8s-node-1:/home/ubuntu# cd
root@k8s-node-1:~# cilium status
    /¯¯\
 /¯¯\__/¯¯\    Cilium:             OK
 \__/¯¯\__/    Operator:           OK
 /¯¯\__/¯¯\    Envoy DaemonSet:    OK
 \__/¯¯\__/    Hubble Relay:       OK
    \__/       ClusterMesh:        disabled

DaemonSet              cilium                   Desired: 3, Ready: 3/3, Available: 3/3
DaemonSet              cilium-envoy             Desired: 3, Ready: 3/3, Available: 3/3
Deployment             cilium-operator          Desired: 2, Ready: 2/2, Available: 2/2
Deployment             hubble-relay             Desired: 1, Ready: 1/1, Available: 1/1
Deployment             hubble-ui                Desired: 1, Ready: 1/1, Available: 1/1
Containers:            cilium                   Running: 3
                       cilium-envoy             Running: 3
                       cilium-operator          Running: 2
                       clustermesh-apiserver    
                       hubble-relay             Running: 1
                       hubble-ui                Running: 1
Cluster Pods:          8/8 managed by Cilium
Helm chart version:    1.17.6
Image versions         cilium             quay.io/isovalent/cilium:v1.17.6-cee.1@sha256:2d01daf4f25f7d644889b49ca856e1a4269981fc963e50bd3962665b41b6adb3: 3
                       cilium-envoy       quay.io/isovalent/cilium-envoy:v1.17.6-cee.1@sha256:318eff387835ca2717baab42a84f35a83a5f9e7d519253df87269f80b9ff0171: 3
                       cilium-operator    quay.io/isovalent/operator-generic:v1.17.6-cee.1@sha256:2e602710a7c4f101831df679e5d8251bae8bf0f9fe26c20bbef87f1966ea8265: 2
                       hubble-relay       quay.io/isovalent/hubble-relay:v1.17.6-cee.1@sha256:d378e3607f7492374e65e2bd854cc0ec87480c63ba49a96dadcd75a6946b586e: 1
                       hubble-ui          quay.io/isovalent/hubble-ui-backend:v1.17.6-cee.1@sha256:a034b7e98e6ea796ed26df8f4e71f83fc16465a19d166eff67a03b822c0bfa15: 1
                       hubble-ui          quay.io/isovalent/hubble-ui:v1.17.6-cee.1@sha256:9e37c1296b802830834cc87342a9182ccbb71ffebb711971e849221bd9d59392: 1
root@k8s-node-1:~# 
root@k8s-node-1:~# ./deploy-star-wars.sh 
🚀 Starting Star Wars Demo Application Deployment...
=================================================

--- Step 1: Ensuring 'star-wars' namespace exists ---

▶️  Running command:
  kubectl create namespace star-wars
namespace/star-wars created
✅ Namespace 'star-wars' created.

--- Step 2: Applying application manifest from GitHub ---

▶️  Running command:
  kubectl apply -n star-wars -f https://raw.githubusercontent.com/cilium/cilium/HEAD/examples/minikube/http-sw-app.yaml
service/deathstar created
deployment.apps/deathstar created
pod/tiefighter created
pod/xwing created

--- Step 3: Waiting for all application pods to be ready ---
  (This may take a minute as images are pulled...)

▶️  Running command:
  kubectl wait --for=condition=ready pod --all -n star-wars --timeout=120s
pod/deathstar-86f85ffb4d-8xbb4 condition met
pod/deathstar-86f85ffb4d-dwfx5 condition met
pod/tiefighter condition met
pod/xwing condition met
✅ All pods are running and ready.

--- Step 4: Displaying pod status ---

▶️  Running command:
  kubectl -n star-wars get pod -o wide --show-labels
NAME                         READY   STATUS    RESTARTS   AGE   IP             NODE         NOMINATED NODE   READINESS GATES   LABELS
deathstar-86f85ffb4d-8xbb4   1/1     Running   0          24s   172.16.2.92    k8s-node-3   <none>           <none>            app.kubernetes.io/name=deathstar,class=deathstar,org=empire,pod-template-hash=86f85ffb4d
deathstar-86f85ffb4d-dwfx5   1/1     Running   0          24s   172.16.1.198   k8s-node-2   <none>           <none>            app.kubernetes.io/name=deathstar,class=deathstar,org=empire,pod-template-hash=86f85ffb4d
tiefighter                   1/1     Running   0          24s   172.16.2.180   k8s-node-3   <none>           <none>            app.kubernetes.io/name=tiefighter,class=tiefighter,org=empire
xwing                        1/1     Running   0          24s   172.16.2.156   k8s-node-3   <none>           <none>            app.kubernetes.io/name=xwing,class=xwing,org=alliance

--- Step 5: Exposing 'deathstar' service via NodePort ---

▶️  Running command:
  kubectl -n star-wars patch service deathstar -p {"spec":{"type":"NodePort"}}
service/deathstar patched
✅ Service 'deathstar' patched to NodePort.

--- Step 6: Testing connectivity from client pods ---
  (A 'Ship landed' message indicates success)

▶️  Running command:
  kubectl -n star-wars exec tiefighter -- curl -s -XPOST http://deathstar.star-wars.svc.cluster.local/v1/request-landing
Ship landed

▶️  Running command:
  kubectl -n star-wars exec xwing -- curl -s -XPOST http://deathstar.star-wars.svc.cluster.local/v1/request-landing
Ship landed

--- Step 7: Displaying external access information ---

=================================================
🎉 Star Wars Demo Application Deployed Successfully!
   You can access the Deathstar service from outside the cluster at:
   curl -XPOST http://10.75.59.81:30719/v1/request-landing
=================================================
root@k8s-node-1:~# curl -XPOST http://10.75.59.81:30719/v1/request-landing
Ship landed
root@k8s-node-1:~# exit
exit
ubuntu@k8s-node-1:~$ curl -XPOST http://10.75.59.81:30719/v1/request-landing
Ship landed
root@k8s-node-1:~# kubectl get nodes -o wide
NAME         STATUS   ROLES           AGE   VERSION   INTERNAL-IP   EXTERNAL-IP   OS-IMAGE             KERNEL-VERSION     CONTAINER-RUNTIME
k8s-node-1   Ready    control-plane   21m   v1.33.3   10.75.59.81   <none>        Ubuntu 24.04.2 LTS   6.8.0-63-generic   containerd://1.7.27
k8s-node-2   Ready    <none>          19m   v1.33.3   10.75.59.82   <none>        Ubuntu 24.04.2 LTS   6.8.0-63-generic   containerd://1.7.27
k8s-node-3   Ready    <none>          19m   v1.33.3   10.75.59.83   <none>        Ubuntu 24.04.2 LTS   6.8.0-63-generic   containerd://1.7.27
root@k8s-node-1:~# kubectl get pods -A -o wide
NAMESPACE     NAME                                 READY   STATUS    RESTARTS   AGE   IP             NODE         NOMINATED NODE   READINESS GATES
kube-system   cilium-45qr7                         1/1     Running   0          19m   10.75.59.83    k8s-node-3   <none>           <none>
kube-system   cilium-9q5s7                         1/1     Running   0          19m   10.75.59.82    k8s-node-2   <none>           <none>
kube-system   cilium-envoy-72jj7                   1/1     Running   0          19m   10.75.59.82    k8s-node-2   <none>           <none>
kube-system   cilium-envoy-d8hb4                   1/1     Running   0          20m   10.75.59.81    k8s-node-1   <none>           <none>
kube-system   cilium-envoy-vvsms                   1/1     Running   0          19m   10.75.59.83    k8s-node-3   <none>           <none>
kube-system   cilium-operator-d67c55dc8-lfpjb      1/1     Running   0          20m   10.75.59.81    k8s-node-1   <none>           <none>
kube-system   cilium-operator-d67c55dc8-rpfv8      1/1     Running   0          20m   10.75.59.82    k8s-node-2   <none>           <none>
kube-system   cilium-xbjqm                         1/1     Running   0          20m   10.75.59.81    k8s-node-1   <none>           <none>
kube-system   coredns-674b8bbfcf-n9wgt             1/1     Running   0          21m   172.16.0.105   k8s-node-1   <none>           <none>
kube-system   coredns-674b8bbfcf-ntssg             1/1     Running   0          21m   172.16.0.161   k8s-node-1   <none>           <none>
kube-system   etcd-k8s-node-1                      1/1     Running   0          21m   10.75.59.81    k8s-node-1   <none>           <none>
kube-system   hubble-relay-cfb755899-46pzc         1/1     Running   0          20m   172.16.1.115   k8s-node-2   <none>           <none>
kube-system   hubble-ui-68c64498c4-p2nq4           2/2     Running   0          20m   172.16.1.105   k8s-node-2   <none>           <none>
kube-system   kube-apiserver-k8s-node-1            1/1     Running   0          21m   10.75.59.81    k8s-node-1   <none>           <none>
kube-system   kube-controller-manager-k8s-node-1   1/1     Running   0          21m   10.75.59.81    k8s-node-1   <none>           <none>
kube-system   kube-scheduler-k8s-node-1            1/1     Running   0          21m   10.75.59.81    k8s-node-1   <none>           <none>
star-wars     deathstar-86f85ffb4d-8xbb4           1/1     Running   0          12m   172.16.2.92    k8s-node-3   <none>           <none>
star-wars     deathstar-86f85ffb4d-dwfx5           1/1     Running   0          12m   172.16.1.198   k8s-node-2   <none>           <none>
star-wars     tiefighter                           1/1     Running   0          12m   172.16.2.180   k8s-node-3   <none>           <none>
star-wars     xwing                                1/1     Running   0          12m   172.16.2.156   k8s-node-3   <none>           <none>
root@k8s-node-1:~# kubectl get deployment -A -o wide
NAMESPACE     NAME              READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS         IMAGES                                                                                                                                                                                                                                        SELECTOR
kube-system   cilium-operator   2/2     2            2           21m   cilium-operator    quay.io/isovalent/operator-generic:v1.17.6-cee.1@sha256:2e602710a7c4f101831df679e5d8251bae8bf0f9fe26c20bbef87f1966ea8265                                                                                                                      io.cilium/app=operator,name=cilium-operator
kube-system   coredns           2/2     2            2           22m   coredns            registry.k8s.io/coredns/coredns:v1.12.0                                                                                                                                                                                                       k8s-app=kube-dns
kube-system   hubble-relay      1/1     1            1           21m   hubble-relay       quay.io/isovalent/hubble-relay:v1.17.6-cee.1@sha256:d378e3607f7492374e65e2bd854cc0ec87480c63ba49a96dadcd75a6946b586e                                                                                                                          k8s-app=hubble-relay
kube-system   hubble-ui         1/1     1            1           21m   frontend,backend   quay.io/isovalent/hubble-ui:v1.17.6-cee.1@sha256:9e37c1296b802830834cc87342a9182ccbb71ffebb711971e849221bd9d59392,quay.io/isovalent/hubble-ui-backend:v1.17.6-cee.1@sha256:a034b7e98e6ea796ed26df8f4e71f83fc16465a19d166eff67a03b822c0bfa15   k8s-app=hubble-ui
star-wars     deathstar         2/2     2            2           12m   deathstar          quay.io/cilium/starwars@sha256:896dc536ec505778c03efedb73c3b7b83c8de11e74264c8c35291ff6d5fe8ada                                                                                                                                               class=deathstar,org=empire

```
# 11. 系统信息探索
## 11.1 K8S 和 Cilium相关信息
```bash
root@k8s-node-1:~# helm get values cilium -n kube-system
USER-SUPPLIED VALUES:
autoDirectNodeRoutes: true
bgpControlPlane:
  announce:
    podCIDR: true
  enabled: true
bpf:
  lb:
    externalClusterIP: true
    sock: true
  masquerade: true
enableIPv4Masquerade: true
hubble:
  enabled: true
  relay:
    enabled: true
  ui:
    enabled: true
ipam:
  mode: kubernetes
ipv4NativeRoutingCIDR: 172.16.0.0/20
k8s:
  requireIPv4PodCIDR: true
k8sServiceHost: 10.75.59.81
k8sServicePort: 6443
kubeProxyReplacement: true
routingMode: native
root@k8s-node-1:~# 
root@k8s-node-1:~# kubectl -n kube-system get configmap cilium-config -o yaml
apiVersion: v1
data:
  agent-not-ready-taint-key: node.cilium.io/agent-not-ready
  arping-refresh-period: 30s
  auto-direct-node-routes: "true"
  bgp-secrets-namespace: kube-system
  bpf-distributed-lru: "false"
  bpf-events-drop-enabled: "true"
  bpf-events-policy-verdict-enabled: "true"
  bpf-events-trace-enabled: "true"
  bpf-lb-acceleration: disabled
  bpf-lb-algorithm-annotation: "false"
  bpf-lb-external-clusterip: "false"
  bpf-lb-map-max: "65536"
  bpf-lb-mode-annotation: "false"
  bpf-lb-sock: "false"
  bpf-lb-source-range-all-types: "false"
  bpf-map-dynamic-size-ratio: "0.0025"
  bpf-policy-map-max: "16384"
  bpf-root: /sys/fs/bpf
  cgroup-root: /run/cilium/cgroupv2
  cilium-endpoint-gc-interval: 5m0s
  cluster-id: "0"
  cluster-name: default
  clustermesh-enable-endpoint-sync: "false"
  clustermesh-enable-mcs-api: "false"
  cni-exclusive: "true"
  cni-log-file: /var/run/cilium/cilium-cni.log
  custom-cni-conf: "false"
  datapath-mode: veth
  debug: "false"
  debug-verbose: ""
  default-lb-service-ipam: lbipam
  direct-routing-skip-unreachable: "false"
  dnsproxy-enable-transparent-mode: "true"
  dnsproxy-socket-linger-timeout: "10"
  egress-gateway-ha-reconciliation-trigger-interval: 1s
  egress-gateway-reconciliation-trigger-interval: 1s
  enable-auto-protect-node-port-range: "true"
  enable-bfd: "false"
  enable-bgp-control-plane: "true"
  enable-bgp-control-plane-status-report: "true"
  enable-bpf-clock-probe: "false"
  enable-bpf-masquerade: "true"
  enable-cluster-aware-addressing: "false"
  enable-egress-gateway-ha-socket-termination: "false"
  enable-endpoint-health-checking: "true"
  enable-endpoint-lockdown-on-policy-overflow: "false"
  enable-experimental-lb: "false"
  enable-health-check-loadbalancer-ip: "false"
  enable-health-check-nodeport: "true"
  enable-health-checking: "true"
  enable-hubble: "true"
  enable-inter-cluster-snat: "false"
  enable-internal-traffic-policy: "true"
  enable-ipv4: "true"
  enable-ipv4-big-tcp: "false"
  enable-ipv4-masquerade: "true"
  enable-ipv6: "false"
  enable-ipv6-big-tcp: "false"
  enable-ipv6-masquerade: "true"
  enable-k8s-networkpolicy: "true"
  enable-k8s-terminating-endpoint: "true"
  enable-l2-neigh-discovery: "true"
  enable-l7-proxy: "true"
  enable-lb-ipam: "true"
  enable-local-redirect-policy: "false"
  enable-masquerade-to-route-source: "false"
  enable-metrics: "true"
  enable-node-selector-labels: "false"
  enable-non-default-deny-policies: "false"
  enable-phantom-services: "false"
  enable-policy: default
  enable-policy-secrets-sync: "true"
  enable-runtime-device-detection: "true"
  enable-sctp: "false"
  enable-source-ip-verification: "true"
  enable-srv6: "false"
  enable-svc-source-range-check: "true"
  enable-tcx: "true"
  enable-vtep: "false"
  enable-well-known-identities: "false"
  enable-xt-socket-fallback: "true"
  envoy-access-log-buffer-size: "4096"
  envoy-base-id: "0"
  envoy-keep-cap-netbindservice: "false"
  export-aggregation: ""
  export-aggregation-renew-ttl: "true"
  export-aggregation-state-filter: ""
  export-file-path: ""
  external-envoy-proxy: "true"
  feature-gates-approved: ""
  feature-gates-strict: "true"
  health-check-icmp-failure-threshold: "3"
  http-retry-count: "3"
  hubble-disable-tls: "false"
  hubble-export-file-max-backups: "5"
  hubble-export-file-max-size-mb: "10"
  hubble-listen-address: :4244
  hubble-socket-path: /var/run/cilium/hubble.sock
  hubble-tls-cert-file: /var/lib/cilium/tls/hubble/server.crt
  hubble-tls-client-ca-files: /var/lib/cilium/tls/hubble/client-ca.crt
  hubble-tls-key-file: /var/lib/cilium/tls/hubble/server.key
  identity-allocation-mode: crd
  identity-gc-interval: 15m0s
  identity-heartbeat-timeout: 30m0s
  install-no-conntrack-iptables-rules: "false"
  ipam: kubernetes
  ipam-cilium-node-update-rate: 15s
  iptables-random-fully: "false"
  ipv4-native-routing-cidr: 172.16.0.0/20
  k8s-require-ipv4-pod-cidr: "true"
  k8s-require-ipv6-pod-cidr: "false"
  kube-proxy-replacement: "true"
  kube-proxy-replacement-healthz-bind-address: ""
  max-connected-clusters: "255"
  mesh-auth-enabled: "true"
  mesh-auth-gc-interval: 5m0s
  mesh-auth-queue-size: "1024"
  mesh-auth-rotated-identities-queue-size: "1024"
  monitor-aggregation: medium
  monitor-aggregation-flags: all
  monitor-aggregation-interval: 5s
  multicast-enabled: "false"
  nat-map-stats-entries: "32"
  nat-map-stats-interval: 30s
  node-port-bind-protection: "true"
  nodeport-addresses: ""
  nodes-gc-interval: 5m0s
  operator-api-serve-addr: 127.0.0.1:9234
  operator-prometheus-serve-addr: :9963
  policy-cidr-match-mode: ""
  policy-secrets-namespace: cilium-secrets
  policy-secrets-only-from-secrets-namespace: "true"
  preallocate-bpf-maps: "false"
  procfs: /host/proc
  proxy-connect-timeout: "2"
  proxy-idle-timeout-seconds: "60"
  proxy-initial-fetch-timeout: "30"
  proxy-max-concurrent-retries: "128"
  proxy-max-connection-duration-seconds: "0"
  proxy-max-requests-per-connection: "0"
  proxy-xff-num-trusted-hops-egress: "0"
  proxy-xff-num-trusted-hops-ingress: "0"
  remove-cilium-node-taints: "true"
  routing-mode: native
  service-no-backend-response: reject
  set-cilium-is-up-condition: "true"
  set-cilium-node-taints: "true"
  srv6-encap-mode: reduced
  srv6-locator-pool-enabled: "false"
  synchronize-k8s-nodes: "true"
  tofqdns-dns-reject-response-code: refused
  tofqdns-enable-dns-compression: "true"
  tofqdns-endpoint-max-ip-per-hostname: "1000"
  tofqdns-idle-connection-grace-period: 0s
  tofqdns-max-deferred-connection-deletes: "10000"
  tofqdns-proxy-response-max-delay: 100ms
  tunnel-protocol: vxlan
  tunnel-source-port-range: 0-0
  unmanaged-pod-watcher-interval: "15"
  vtep-cidr: ""
  vtep-endpoint: ""
  vtep-mac: ""
  vtep-mask: ""
  write-cni-conf-when-ready: /host/etc/cni/net.d/05-cilium.conflist
kind: ConfigMap
metadata:
  annotations:
    meta.helm.sh/release-name: cilium
    meta.helm.sh/release-namespace: kube-system
  creationTimestamp: "2025-08-04T08:52:46Z"
  labels:
    app.kubernetes.io/managed-by: Helm
  name: cilium-config
  namespace: kube-system
  resourceVersion: "436"
  uid: 614c6b36-9112-4fd0-bebf-e92741fa28da
root@k8s-node-1:~# kubectl exec -n kube-system -it cilium-45qr7 -- /bin/sh
Defaulted container "cilium-agent" out of: cilium-agent, config (init), mount-cgroup (init), apply-sysctl-overwrites (init), mount-bpf-fs (init), clean-cilium-state (init), install-cni-binaries (init)
/home/cilium # cilium status
KVStore:                 Disabled   
Kubernetes:              Ok         1.33 (v1.33.3) [linux/amd64]
Kubernetes APIs:         ["EndpointSliceOrEndpoint", "cilium/v2::CiliumClusterwideNetworkPolicy", "cilium/v2::CiliumEndpoint", "cilium/v2::CiliumNetworkPolicy", "cilium/v2::CiliumNode", "cilium/v2alpha1::CiliumCIDRGroup", "core/v1::Namespace", "core/v1::Pods", "core/v1::Service", "isovalent/v1alpha1::IsovalentClusterwideNetworkPolicy", "isovalent/v1alpha1::IsovalentNetworkPolicy", "networking.k8s.io/v1::NetworkPolicy"]
KubeProxyReplacement:    True   [enp1s0   10.75.59.83 fe80::5054:ff:fead:b814 (Direct Routing)]
Host firewall:           Disabled
SRv6:                    Disabled
CNI Chaining:            none
CNI Config file:         successfully wrote CNI configuration file to /host/etc/cni/net.d/05-cilium.conflist
Cilium:                  Ok   1.17.6-cee.1 (v1.17.6-cee.1-a33b0b85)
NodeMonitor:             Listening for events on 4 CPUs with 64x4096 of shared memory
Cilium health daemon:    Ok   
IPAM:                    IPv4: 5/254 allocated from 172.16.2.0/24, 
IPv4 BIG TCP:            Disabled
IPv6 BIG TCP:            Disabled
BandwidthManager:        Disabled
Routing:                 Network: Native   Host: BPF
Attach Mode:             TCX
Device Mode:             veth
Masquerading:            BPF   [enp1s0]   172.16.0.0/20 [IPv4: Enabled, IPv6: Disabled]
Controller Status:       36/36 healthy
Proxy Status:            OK, ip 172.16.2.88, 0 redirects active on ports 10000-20000, Envoy: external
Global Identity Range:   min 256, max 65535
Hubble:                  Ok              Current/Max Flows: 2522/4095 (61.59%), Flows/s: 1.51   Metrics: Disabled
Encryption:              Disabled        
Cluster health:          3/3 reachable   (2025-08-04T09:21:04Z)
Name                     IP              Node   Endpoints
Modules Health:          Stopped(0) Degraded(0) OK(68)
/home/cilium # cilium status --verbose
KVStore:                Disabled   
Kubernetes:             Ok         1.33 (v1.33.3) [linux/amd64]
Kubernetes APIs:        ["EndpointSliceOrEndpoint", "cilium/v2::CiliumClusterwideNetworkPolicy", "cilium/v2::CiliumEndpoint", "cilium/v2::CiliumNetworkPolicy", "cilium/v2::CiliumNode", "cilium/v2alpha1::CiliumCIDRGroup", "core/v1::Namespace", "core/v1::Pods", "core/v1::Service", "isovalent/v1alpha1::IsovalentClusterwideNetworkPolicy", "isovalent/v1alpha1::IsovalentNetworkPolicy", "networking.k8s.io/v1::NetworkPolicy"]
KubeProxyReplacement:   True   [enp1s0   10.75.59.83 fe80::5054:ff:fead:b814 (Direct Routing)]
Host firewall:          Disabled
SRv6:                   Disabled
CNI Chaining:           none
CNI Config file:        successfully wrote CNI configuration file to /host/etc/cni/net.d/05-cilium.conflist
Cilium:                 Ok   1.17.6-cee.1 (v1.17.6-cee.1-a33b0b85)
NodeMonitor:            Listening for events on 4 CPUs with 64x4096 of shared memory
Cilium health daemon:   Ok   
IPAM:                   IPv4: 5/254 allocated from 172.16.2.0/24, 
Allocated addresses:
  172.16.2.156 (star-wars/xwing)
  172.16.2.180 (star-wars/tiefighter)
  172.16.2.35 (health)
  172.16.2.88 (router)
  172.16.2.92 (star-wars/deathstar-86f85ffb4d-8xbb4)
IPv4 BIG TCP:           Disabled
IPv6 BIG TCP:           Disabled
BandwidthManager:       Disabled
Routing:                Network: Native   Host: BPF
Attach Mode:            TCX
Device Mode:            veth
Masquerading:           BPF   [enp1s0]   172.16.0.0/20 [IPv4: Enabled, IPv6: Disabled]
Clock Source for BPF:   ktime
Controller Status:      36/36 healthy
  Name                                                  Last success   Last error   Count   Message
  cilium-health-ep                                      1m0s ago       never        0       no error   
  ct-map-pressure                                       1s ago         never        0       no error   
  daemon-validate-config                                35s ago        never        0       no error   
  dns-garbage-collector-job                             3s ago         never        0       no error   
  endpoint-1375-regeneration-recovery                   never          never        0       no error   
  endpoint-196-regeneration-recovery                    never          never        0       no error   
  endpoint-2338-regeneration-recovery                   never          never        0       no error   
  endpoint-523-regeneration-recovery                    never          never        0       no error   
  endpoint-640-regeneration-recovery                    never          never        0       no error   
  endpoint-gc                                           2m3s ago       never        0       no error   
  endpoint-periodic-regeneration                        1m3s ago       never        0       no error   
  ep-bpf-prog-watchdog                                  1s ago         never        0       no error   
  ipcache-inject-labels                                 1s ago         never        0       no error   
  k8s-heartbeat                                         3s ago         never        0       no error   
  link-cache                                            3s ago         never        0       no error   
  node-neighbor-link-updater                            1s ago         never        0       no error   
  proxy-ports-checkpoint                                27m1s ago      never        0       no error   
  resolve-identity-1375                                 2m0s ago       never        0       no error   
  resolve-identity-196                                  1m41s ago      never        0       no error   
  resolve-identity-2338                                 1m41s ago      never        0       no error   
  resolve-identity-523                                  2m1s ago       never        0       no error   
  resolve-identity-640                                  1m41s ago      never        0       no error   
  resolve-labels-star-wars/deathstar-86f85ffb4d-8xbb4   21m41s ago     never        0       no error   
  resolve-labels-star-wars/tiefighter                   21m41s ago     never        0       no error   
  resolve-labels-star-wars/xwing                        21m41s ago     never        0       no error   
  sync-lb-maps-with-k8s-services                        27m1s ago      never        0       no error   
  sync-policymap-1375                                   11m56s ago     never        0       no error   
  sync-policymap-196                                    6m41s ago      never        0       no error   
  sync-policymap-2338                                   6m41s ago      never        0       no error   
  sync-policymap-523                                    11m57s ago     never        0       no error   
  sync-policymap-640                                    6m41s ago      never        0       no error   
  sync-to-k8s-ciliumendpoint (196)                      1s ago         never        0       no error   
  sync-to-k8s-ciliumendpoint (2338)                     1s ago         never        0       no error   
  sync-to-k8s-ciliumendpoint (640)                      1s ago         never        0       no error   
  sync-utime                                            1s ago         never        0       no error   
  write-cni-file                                        27m3s ago      never        0       no error   
Proxy Status:            OK, ip 172.16.2.88, 0 redirects active on ports 10000-20000, Envoy: external
Global Identity Range:   min 256, max 65535
Hubble:                  Ok   Current/Max Flows: 2570/4095 (62.76%), Flows/s: 1.51   Metrics: Disabled
KubeProxyReplacement Details:
  Status:                 True
  Socket LB:              Enabled
  Socket LB Tracing:      Enabled
  Socket LB Coverage:     Full
  Devices:                enp1s0   10.75.59.83 fe80::5054:ff:fead:b814 (Direct Routing)
  Mode:                   SNAT
  Backend Selection:      Random
  Session Affinity:       Enabled
  Graceful Termination:   Enabled
  NAT46/64 Support:       Disabled
  XDP Acceleration:       Disabled
  Services:
  - ClusterIP:      Enabled
  - NodePort:       Enabled (Range: 30000-32767) 
  - LoadBalancer:   Enabled 
  - externalIPs:    Enabled 
  - HostPort:       Enabled
  Annotations:
  - service.cilium.io/node
  - service.cilium.io/src-ranges-policy
  - service.cilium.io/type
BPF Maps:   dynamic sizing: on (ratio: 0.002500)
  Name                          Size
  Auth                          524288
  Non-TCP connection tracking   65536
  TCP connection tracking       131072
  Endpoint policy               65535
  IP cache                      512000
  IPv4 masquerading agent       16384
  IPv6 masquerading agent       16384
  IPv4 fragmentation            8192
  IPv4 service                  65536
  IPv6 service                  65536
  IPv4 service backend          65536
  IPv6 service backend          65536
  IPv4 service reverse NAT      65536
  IPv6 service reverse NAT      65536
  Metrics                       1024
  Ratelimit metrics             64
  NAT                           131072
  Neighbor table                131072
  Global policy                 16384
  Session affinity              65536
  Sock reverse NAT              65536
Encryption:       Disabled        
Cluster health:   3/3 reachable   (2025-08-04T09:21:04Z)
Name              IP              Node   Endpoints
  k8s-node-3 (localhost):
    Host connectivity to 10.75.59.83:
      ICMP to stack:   OK, RTT=451.197µs
      HTTP to agent:   OK, RTT=625.346µs
    Endpoint connectivity to 172.16.2.35:
      ICMP to stack:   OK, RTT=376.939µs
      HTTP to agent:   OK, RTT=882.754µs
  k8s-node-1:
    Host connectivity to 10.75.59.81:
      ICMP to stack:   OK, RTT=582.892µs
      HTTP to agent:   OK, RTT=1.042743ms
    Endpoint connectivity to 172.16.0.116:
      ICMP to stack:   OK, RTT=703.331µs
      HTTP to agent:   OK, RTT=1.533329ms
  k8s-node-2:
    Host connectivity to 10.75.59.82:
      ICMP to stack:   OK, RTT=632.658µs
      HTTP to agent:   OK, RTT=1.156736ms
    Endpoint connectivity to 172.16.1.173:
      ICMP to stack:   OK, RTT=636.518µs
      HTTP to agent:   OK, RTT=1.37198ms
Modules Health:
      enterprise-agent
      ├── agent
      │   ├── controlplane
      │   │   ├── auth
      │   │   │   ├── observer-job-auth-gc-identity-events            [OK] OK (1.812µs) [5] (21m, x1)
      │   │   │   ├── observer-job-auth-request-authentication        [OK] Primed (27m, x1)
      │   │   │   └── timer-job-auth-gc-cleanup                       [OK] OK (15.847µs) (2m3s, x1)
      │   │   ├── bgp-control-plane
      │   │   │   ├── job-bgp-controller                              [OK] Running (27m, x1)
      │   │   │   ├── job-bgp-crd-status-initialize                   [OK] Running (27m, x1)
      │   │   │   ├── job-bgp-crd-status-update-job                   [OK] Running (27m, x1)
      │   │   │   ├── job-bgp-policy-observer                         [OK] Running (27m, x1)
      │   │   │   ├── job-bgp-reconcile-error-statedb-tracker         [OK] Running (27m, x1)
      │   │   │   ├── job-bgp-state-observer                          [OK] Running (27m, x1)
      │   │   │   ├── job-bgpcp-resource-store-events                 [OK] Running (27m, x5)
      │   │   │   └── job-diffstore-events                            [OK] Running (27m, x2)
      │   │   ├── ciliumenvoyconfig
      │   │   │   └── experimental
      │   │   │       ├── job-reconcile                               [OK] OK, 0 object(s) (27m, x3)
      │   │   │       └── job-refresh                                 [OK] Next refresh in 30m0s (27m, x1)
      │   │   ├── daemon
      │   │   │   ├──                                                 [OK] daemon-validate-config (35s, x27)
      │   │   │   ├── ep-bpf-prog-watchdog
      │   │   │   │   └── ep-bpf-prog-watchdog                        [OK] ep-bpf-prog-watchdog (1s, x55)
      │   │   │   └── job-sync-hostips                                [OK] Synchronized (1s, x29)
      │   │   ├── dynamic-lifecycle-manager
      │   │   │   ├── job-reconcile                                   [OK] OK, 0 object(s) (27m, x3)
      │   │   │   └── job-refresh                                     [OK] Next refresh in 30m0s (27m, x1)
      │   │   ├── enabled-features
      │   │   │   └── job-update-config-metric                        [OK] Waiting for agent config (27m, x1)
      │   │   ├── endpoint-manager
      │   │   │   ├── cilium-endpoint-1375 (/)
      │   │   │   │   ├── datapath-regenerate                         [OK] Endpoint regeneration successful (63s, x15)
      │   │   │   │   └── policymap-sync                              [OK] sync-policymap-1375 (11m, x2)
      │   │   │   ├── cilium-endpoint-196 (star-wars/xwing)
      │   │   │   │   ├── cep-k8s-sync                                [OK] sync-to-k8s-ciliumendpoint (196) (1s, x132)
      │   │   │   │   ├── datapath-regenerate                         [OK] Endpoint regeneration successful (63s, x12)
      │   │   │   │   └── policymap-sync                              [OK] sync-policymap-196 (6m41s, x2)
      │   │   │   ├── cilium-endpoint-2338 (star-wars/tiefighter)
      │   │   │   │   ├── cep-k8s-sync                                [OK] sync-to-k8s-ciliumendpoint (2338) (1s, x132)
      │   │   │   │   ├── datapath-regenerate                         [OK] Endpoint regeneration successful (63s, x12)
      │   │   │   │   └── policymap-sync                              [OK] sync-policymap-2338 (6m41s, x2)
      │   │   │   ├── cilium-endpoint-523 (/)
      │   │   │   │   ├── datapath-regenerate                         [OK] Endpoint regeneration successful (63s, x16)
      │   │   │   │   └── policymap-sync                              [OK] sync-policymap-523 (11m, x2)
      │   │   │   ├── cilium-endpoint-640 (star-wars/deathstar-86f85ffb4d-8xbb4)
      │   │   │   │   ├── cep-k8s-sync                                [OK] sync-to-k8s-ciliumendpoint (640) (1s, x132)
      │   │   │   │   ├── datapath-regenerate                         [OK] Endpoint regeneration successful (63s, x12)
      │   │   │   │   └── policymap-sync                              [OK] sync-policymap-640 (6m41s, x2)
      │   │   │   └── endpoint-gc                                     [OK] endpoint-gc (2m3s, x6)
      │   │   ├── envoy-proxy
      │   │   │   ├── observer-job-k8s-secrets-resource-events-cilium-secrets    [OK] Primed (27m, x1)
      │   │   │   └── timer-job-version-check                         [OK] OK (13.805158ms) (2m1s, x1)
      │   │   ├── hubble
      │   │   │   └── job-hubble                                      [OK] Running (27m, x1)
      │   │   ├── identity
      │   │   │   └── timer-job-id-alloc-update-policy-maps           [OK] OK (103.031µs) (21m, x1)
      │   │   ├── l2-announcer
      │   │   │   └── job-l2-announcer-lease-gc                       [OK] Running (27m, x1)
      │   │   ├── nat-stats
      │   │   │   └── timer-job-nat-stats                             [OK] OK (2.520538ms) (1s, x1)
      │   │   ├── node-manager
      │   │   │   ├── background-sync                                 [OK] Node validation successful (66s, x19)
      │   │   │   ├── neighbor-link-updater
      │   │   │   │   ├── k8s-node-1                                  [OK] Node neighbor link update successful (61s, x20)
      │   │   │   │   └── k8s-node-2                                  [OK] Node neighbor link update successful (31s, x20)
      │   │   │   ├── node-checkpoint-writer                          [OK] node checkpoint written (25m, x3)
      │   │   │   └── nodes-add                                       [OK] Node adds successful (27m, x3)
      │   │   ├── policy
      │   │   │   └── observer-job-policy-importer                    [OK] Primed (27m, x1)
      │   │   ├── service-manager
      │   │   │   ├── job-health-check-event-watcher                  [OK] Waiting for health check events (27m, x1)
      │   │   │   └── job-service-reconciler                          [OK] 1 NodePort frontend addresses (27m, x1)
      │   │   ├── service-resolver
      │   │   │   └── job-service-reloader-initializer                [OK] Running (27m, x1)
      │   │   └── stale-endpoint-cleanup
      │   │       └── job-endpoint-cleanup                            [OK] Running (27m, x1)
      │   ├── datapath
      │   │   ├── agent-liveness-updater
      │   │   │   └── timer-job-agent-liveness-updater                [OK] OK (82.885µs) (0s, x1)
      │   │   ├── iptables
      │   │   │   ├── ipset
      │   │   │   │   ├── job-ipset-init-finalizer                    [OK] Running (27m, x1)
      │   │   │   │   ├── job-reconcile                               [OK] OK, 0 object(s) (27m, x2)
      │   │   │   │   └── job-refresh                                 [OK] Next refresh in 30m0s (27m, x1)
      │   │   │   └── job-iptables-reconciliation-loop                [OK] iptables rules full reconciliation completed (27m, x1)
      │   │   ├── l2-responder
      │   │   │   └── job-l2-responder-reconciler                     [OK] Running (27m, x1)
      │   │   ├── maps
      │   │   │   └── bwmap
      │   │   │       └── timer-job-pressure-metric-throttle          [OK] OK (18.336µs) (1s, x1)
      │   │   ├── mtu
      │   │   │   ├── job-endpoint-mtu-updater                        [OK] Endpoint MTU updated (27m, x1)
      │   │   │   └── job-mtu-updater                                 [OK] MTU updated (1500) (27m, x1)
      │   │   ├── node-address
      │   │   │   └── job-node-address-update                         [OK] 172.16.2.88 (primary), fe80::7019:6fff:febf:e8a7 (primary) (27m, x1)
      │   │   ├── orchestrator
      │   │   │   └── job-reinitialize                                [OK] OK (26m, x2)
      │   │   └── sysctl
      │   │       ├── job-reconcile                                   [OK] OK, 16 object(s) (6m56s, x35)
      │   │       └── job-refresh                                     [OK] Next refresh in 9m53.185634443s (6m56s, x1)
      │   └── infra
      │       ├── k8s-synced-crdsync
      │       │   └── job-sync-crds                                   [OK] Running (27m, x1)
      │       ├── metrics
      │       │   ├── job-collect                                     [OK] Sampled 24 metrics in 4.183045ms, next collection at 2025-08-04 09:26:00.386029804 +0000 UTC m=+1803.177514891 (2m1s, x1)
      │       │   └── timer-job-cleanup                               [OK] Primed (27m, x1)
      │       └── shell
      │           └── job-listener                                    [OK] Listening on /var/run/cilium/shell.sock (27m, x1)
      └── enterprise-controlplane
          └── cec-ingress-policy
              └── timer-job-enterprise-endpoint-policy-periodic-regeneration      [OK] OK (21.899µs) (1s, x1)
      
/home/cilium # cilium service list
ID   Frontend                Service Type   Backend                               
1    172.16.32.1:443/TCP     ClusterIP      1 => 10.75.59.81:6443/TCP (active)    
2    172.16.42.186:443/TCP   ClusterIP      1 => 10.75.59.83:4244/TCP (active)    
3    172.16.42.14:80/TCP     ClusterIP      1 => 172.16.1.115:4245/TCP (active)   
4    172.16.38.134:80/TCP    ClusterIP      1 => 172.16.1.105:8081/TCP (active)   
5    10.75.59.83:31708/TCP   NodePort       1 => 172.16.1.105:8081/TCP (active)   
6    0.0.0.0:31708/TCP       NodePort       1 => 172.16.1.105:8081/TCP (active)   
7    172.16.32.10:53/TCP     ClusterIP      1 => 172.16.0.161:53/TCP (active)     
                                            2 => 172.16.0.105:53/TCP (active)     
8    172.16.32.10:9153/TCP   ClusterIP      1 => 172.16.0.161:9153/TCP (active)   
                                            2 => 172.16.0.105:9153/TCP (active)   
9    172.16.32.10:53/UDP     ClusterIP      1 => 172.16.0.161:53/UDP (active)     
                                            2 => 172.16.0.105:53/UDP (active)     
10   172.16.34.108:80/TCP    ClusterIP      1 => 172.16.1.198:80/TCP (active)     
                                            2 => 172.16.2.92:80/TCP (active)      
11   10.75.59.83:30719/TCP   NodePort       1 => 172.16.1.198:80/TCP (active)     
                                            2 => 172.16.2.92:80/TCP (active)      
12   0.0.0.0:30719/TCP       NodePort       1 => 172.16.1.198:80/TCP (active)     
                                            2 => 172.16.2.92:80/TCP (active)      
/home/cilium # cilium bpf nat list
TCP IN 10.75.59.82:4240 -> 10.75.59.83:35986 XLATE_DST 10.75.59.83:35986 Created=1076sec ago NeedsCT=1
ICMP IN 10.75.59.81:0 -> 10.75.59.83:63865 XLATE_DST 10.75.59.83:63865 Created=156sec ago NeedsCT=1
TCP IN 10.75.59.81:4240 -> 10.75.59.83:58402 XLATE_DST 10.75.59.83:58402 Created=56sec ago NeedsCT=1
ICMP OUT 10.75.59.83:47633 -> 10.75.59.81:0 XLATE_SRC 10.75.59.83:47633 Created=56sec ago NeedsCT=1
ICMP OUT 10.75.59.83:56308 -> 172.16.0.116:0 XLATE_SRC 10.75.59.83:56308 Created=206sec ago NeedsCT=1
ICMP OUT 10.75.59.83:40570 -> 10.75.59.82:0 XLATE_SRC 10.75.59.83:40570 Created=226sec ago NeedsCT=1
TCP IN 172.16.0.116:4240 -> 10.75.59.83:33274 XLATE_DST 10.75.59.83:33274 Created=706sec ago NeedsCT=1
ICMP IN 172.16.0.116:0 -> 10.75.59.83:56308 XLATE_DST 10.75.59.83:56308 Created=206sec ago NeedsCT=1
TCP OUT 10.75.59.83:37066 -> 10.75.59.81:6443 XLATE_SRC 10.75.59.83:37066 Created=1655sec ago NeedsCT=1
TCP OUT 10.75.59.83:44064 -> 172.16.1.173:4240 XLATE_SRC 10.75.59.83:44064 Created=1066sec ago NeedsCT=1
TCP OUT 10.75.59.83:46184 -> 10.75.59.81:6443 XLATE_SRC 10.75.59.83:46184 Created=1651sec ago NeedsCT=1
TCP OUT 10.75.59.83:43981 -> 10.75.59.86:179 XLATE_SRC 10.75.59.83:43981 Created=1648sec ago NeedsCT=1
TCP OUT 10.75.59.83:57802 -> 10.75.59.81:4240 XLATE_SRC 10.75.59.83:57802 Created=716sec ago NeedsCT=1
ICMP IN 10.75.59.82:0 -> 10.75.59.83:43531 XLATE_DST 10.75.59.83:43531 Created=36sec ago NeedsCT=1
TCP IN 10.75.59.86:179 -> 10.75.59.83:43981 XLATE_DST 10.75.59.83:43981 Created=1648sec ago NeedsCT=1
TCP OUT 10.75.59.83:58402 -> 10.75.59.81:4240 XLATE_SRC 10.75.59.83:58402 Created=56sec ago NeedsCT=1
ICMP OUT 10.75.59.83:43619 -> 10.75.59.82:0 XLATE_SRC 10.75.59.83:43619 Created=176sec ago NeedsCT=1
ICMP OUT 10.75.59.83:40760 -> 10.75.59.81:0 XLATE_SRC 10.75.59.83:40760 Created=216sec ago NeedsCT=1
TCP IN 142.250.199.100:443 -> 10.75.59.83:40732 XLATE_DST 172.16.2.180:40732 Created=205sec ago NeedsCT=0
TCP OUT 10.75.59.83:34202 -> 172.16.0.116:4240 XLATE_SRC 10.75.59.83:34202 Created=46sec ago NeedsCT=1
ICMP IN 10.75.59.81:0 -> 10.75.59.83:47633 XLATE_DST 10.75.59.83:47633 Created=56sec ago NeedsCT=1
TCP OUT 10.75.59.83:33274 -> 172.16.0.116:4240 XLATE_SRC 10.75.59.83:33274 Created=706sec ago NeedsCT=1
ICMP OUT 10.75.59.83:43531 -> 10.75.59.82:0 XLATE_SRC 10.75.59.83:43531 Created=36sec ago NeedsCT=1
ICMP IN 10.75.59.82:0 -> 10.75.59.83:43619 XLATE_DST 10.75.59.83:43619 Created=176sec ago NeedsCT=1
TCP IN 10.75.59.81:6443 -> 10.75.59.83:37066 XLATE_DST 10.75.59.83:37066 Created=1655sec ago NeedsCT=1
ICMP OUT 10.75.59.83:36675 -> 172.16.1.173:0 XLATE_SRC 10.75.59.83:36675 Created=106sec ago NeedsCT=1
TCP OUT 172.16.2.180:40732 -> 142.250.199.100:443 XLATE_SRC 10.75.59.83:40732 Created=205sec ago NeedsCT=0
ICMP IN 172.16.0.116:0 -> 10.75.59.83:38433 XLATE_DST 10.75.59.83:38433 Created=276sec ago NeedsCT=1
TCP OUT 10.75.59.83:35986 -> 10.75.59.82:4240 XLATE_SRC 10.75.59.83:35986 Created=1076sec ago NeedsCT=1
ICMP IN 172.16.1.173:0 -> 10.75.59.83:36675 XLATE_DST 10.75.59.83:36675 Created=106sec ago NeedsCT=1
TCP IN 10.75.59.81:6443 -> 10.75.59.83:46184 XLATE_DST 10.75.59.83:46184 Created=1651sec ago NeedsCT=1
TCP IN 172.16.0.116:4240 -> 10.75.59.83:34202 XLATE_DST 10.75.59.83:34202 Created=46sec ago NeedsCT=1
ICMP OUT 10.75.59.83:63865 -> 10.75.59.81:0 XLATE_SRC 10.75.59.83:63865 Created=156sec ago NeedsCT=1
ICMP OUT 10.75.59.83:38433 -> 172.16.0.116:0 XLATE_SRC 10.75.59.83:38433 Created=276sec ago NeedsCT=1
ICMP IN 10.75.59.82:0 -> 10.75.59.83:40570 XLATE_DST 10.75.59.83:40570 Created=226sec ago NeedsCT=1
ICMP OUT 10.75.59.83:36899 -> 172.16.1.173:0 XLATE_SRC 10.75.59.83:36899 Created=236sec ago NeedsCT=1
ICMP IN 172.16.1.173:0 -> 10.75.59.83:36899 XLATE_DST 10.75.59.83:36899 Created=236sec ago NeedsCT=1
TCP IN 10.75.59.81:4240 -> 10.75.59.83:57802 XLATE_DST 10.75.59.83:57802 Created=716sec ago NeedsCT=1
ICMP IN 10.75.59.81:0 -> 10.75.59.83:40760 XLATE_DST 10.75.59.83:40760 Created=216sec ago NeedsCT=1
TCP IN 172.16.1.173:4240 -> 10.75.59.83:44064 XLATE_DST 10.75.59.83:44064 Created=1066sec ago NeedsCT=1

/home/cilium # cilium config
##### Read-write configurations #####
ConntrackAccounting               : Disabled
ConntrackLocal                    : Disabled
Debug                             : Disabled
DebugLB                           : Disabled
DropNotification                  : Enabled
MonitorAggregationLevel           : Medium
PolicyAccounting                  : Enabled
PolicyAuditMode                   : Disabled
PolicyTracing                     : Disabled
PolicyVerdictNotification         : Enabled
SourceIPVerification              : Enabled
TraceNotification                 : Enabled
MonitorNumPages                   : 64
PolicyEnforcement                 : default
/home/cilium # exit
root@k8s-node-1:~# 
```
## 11.2 BGP相关信息
```bash
root@k8s-node-1:~# cilium bgp peers
Node         Local AS   Peer AS   Peer Address   Session State   Uptime   Family         Received   Advertised
k8s-node-1   65000      65000     10.75.59.86    established     41m41s   ipv4/unicast   1          8    
k8s-node-2   65000      65000     10.75.59.86    established     39m53s   ipv4/unicast   1          8    
k8s-node-3   65000      65000     10.75.59.86    established     39m52s   ipv4/unicast   1          8    
root@k8s-node-1:~# cilium bgp routes
(Defaulting to `available ipv4 unicast` routes, please see help for more options)

Node         VRouter   Prefix             NextHop   Age      Attrs
k8s-node-1   65000     172.16.0.0/24      0.0.0.0   41m48s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.32.1/32     0.0.0.0   41m48s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.32.10/32    0.0.0.0   41m48s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.34.108/32   0.0.0.0   34m39s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.38.134/32   0.0.0.0   41m48s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.42.14/32    0.0.0.0   41m48s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.42.186/32   0.0.0.0   41m47s   [{Origin: i} {Nexthop: 0.0.0.0}]   
k8s-node-2   65000     172.16.1.0/24      0.0.0.0   39m59s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.32.1/32     0.0.0.0   39m59s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.32.10/32    0.0.0.0   39m59s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.34.108/32   0.0.0.0   34m39s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.38.134/32   0.0.0.0   39m59s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.42.14/32    0.0.0.0   39m59s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.42.186/32   0.0.0.0   39m56s   [{Origin: i} {Nexthop: 0.0.0.0}]   
k8s-node-3   65000     172.16.2.0/24      0.0.0.0   39m58s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.32.1/32     0.0.0.0   39m58s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.32.10/32    0.0.0.0   39m58s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.34.108/32   0.0.0.0   34m39s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.38.134/32   0.0.0.0   39m58s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.42.14/32    0.0.0.0   39m58s   [{Origin: i} {Nexthop: 0.0.0.0}]   
             65000     172.16.42.186/32   0.0.0.0   39m55s   [{Origin: i} {Nexthop: 0.0.0.0}]   

root@dns-bgp-server:~# ip route show
default via 10.75.59.1 dev enp1s0 proto static 
10.75.59.0/24 dev enp1s0 proto kernel scope link src 10.75.59.86 
172.16.0.0/24 nhid 8 via 10.75.59.81 dev enp1s0 proto bgp metric 20 
172.16.1.0/24 nhid 12 via 10.75.59.82 dev enp1s0 proto bgp metric 20 
172.16.2.0/24 nhid 19 via 10.75.59.83 dev enp1s0 proto bgp metric 20 
172.16.32.1 nhid 18 proto bgp metric 20 
        nexthop via 10.75.59.81 dev enp1s0 weight 1 
        nexthop via 10.75.59.82 dev enp1s0 weight 1 
        nexthop via 10.75.59.83 dev enp1s0 weight 1 
172.16.32.10 nhid 18 proto bgp metric 20 
        nexthop via 10.75.59.81 dev enp1s0 weight 1 
        nexthop via 10.75.59.82 dev enp1s0 weight 1 
        nexthop via 10.75.59.83 dev enp1s0 weight 1 
172.16.34.108 nhid 18 proto bgp metric 20 
        nexthop via 10.75.59.81 dev enp1s0 weight 1 
        nexthop via 10.75.59.82 dev enp1s0 weight 1 
        nexthop via 10.75.59.83 dev enp1s0 weight 1 
172.16.38.134 nhid 18 proto bgp metric 20 
        nexthop via 10.75.59.81 dev enp1s0 weight 1 
        nexthop via 10.75.59.82 dev enp1s0 weight 1 
        nexthop via 10.75.59.83 dev enp1s0 weight 1 
172.16.42.14 nhid 18 proto bgp metric 20 
        nexthop via 10.75.59.81 dev enp1s0 weight 1 
        nexthop via 10.75.59.82 dev enp1s0 weight 1 
        nexthop via 10.75.59.83 dev enp1s0 weight 1 
172.16.42.186 nhid 18 proto bgp metric 20 
        nexthop via 10.75.59.81 dev enp1s0 weight 1 
        nexthop via 10.75.59.82 dev enp1s0 weight 1 
        nexthop via 10.75.59.83 dev enp1s0 weight 1 
root@dns-bgp-server:~# route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         10.75.59.1      0.0.0.0         UG    0      0        0 enp1s0
10.75.59.0      0.0.0.0         255.255.255.0   U     0      0        0 enp1s0
172.16.0.0      10.75.59.81     255.255.255.0   UG    20     0        0 enp1s0
172.16.1.0      10.75.59.82     255.255.255.0   UG    20     0        0 enp1s0
172.16.2.0      10.75.59.83     255.255.255.0   UG    20     0        0 enp1s0
172.16.32.1     10.75.59.81     255.255.255.255 UGH   20     0        0 enp1s0
172.16.32.10    10.75.59.81     255.255.255.255 UGH   20     0        0 enp1s0
172.16.34.108   10.75.59.81     255.255.255.255 UGH   20     0        0 enp1s0
172.16.38.134   10.75.59.81     255.255.255.255 UGH   20     0        0 enp1s0
172.16.42.14    10.75.59.81     255.255.255.255 UGH   20     0        0 enp1s0
172.16.42.186   10.75.59.81     255.255.255.255 UGH   20     0        0 enp1s0
root@dns-bgp-server:~# vtysh -c "show ip bgp"
BGP table version is 15, local router ID is 10.75.59.86, vrf id 0
Default local pref 100, local AS 65000
Status codes:  s suppressed, d damped, h history, * valid, > best, = multipath,
               i internal, r RIB-failure, S Stale, R Removed
Nexthop codes: @NNN nexthop's vrf id, < announce-nh-self
Origin codes:  i - IGP, e - EGP, ? - incomplete
RPKI validation codes: V valid, I invalid, N Not found

   Network          Next Hop            Metric LocPrf Weight Path
*> 10.75.59.0/24    0.0.0.0                  0         32768 ?
*>i172.16.0.0/24    10.75.59.81                   100      0 i
*>i172.16.1.0/24    10.75.59.82                   100      0 i
*>i172.16.2.0/24    10.75.59.83                   100      0 i
*=i172.16.32.1/32   10.75.59.83                   100      0 i
*=i                 10.75.59.82                   100      0 i
*>i                 10.75.59.81                   100      0 i
*=i172.16.32.10/32  10.75.59.83                   100      0 i
*=i                 10.75.59.82                   100      0 i
*>i                 10.75.59.81                   100      0 i
*>i172.16.34.108/32 10.75.59.81                   100      0 i
*=i                 10.75.59.82                   100      0 i
*=i                 10.75.59.83                   100      0 i
*=i172.16.38.134/32 10.75.59.83                   100      0 i
*=i                 10.75.59.82                   100      0 i
*>i                 10.75.59.81                   100      0 i
*=i172.16.42.14/32  10.75.59.83                   100      0 i
*=i                 10.75.59.82                   100      0 i
*>i                 10.75.59.81                   100      0 i
*=i172.16.42.186/32 10.75.59.83                   100      0 i
*=i                 10.75.59.82                   100      0 i
*>i                 10.75.59.81                   100      0 i

Displayed  10 routes and 22 total paths
root@dns-bgp-server:~# vtysh -c "show ip bgp summary"

IPv4 Unicast Summary (VRF default):
BGP router identifier 10.75.59.86, local AS number 65000 vrf-id 0
BGP table version 15
RIB entries 19, using 3648 bytes of memory
Peers 3, using 2172 KiB of memory

Neighbor        V         AS   MsgRcvd   MsgSent   TblVer  InQ OutQ  Up/Down State/PfxRcd   PfxSnt Desc
10.75.59.81     4      65000       247       244        0    0    0 00:40:09            7        1 N/A
10.75.59.82     4      65000       240       234        0    0    0 00:38:20            7        1 N/A
10.75.59.83     4      65000       239       233        0    0    0 00:38:19            7        1 N/A

Total number of neighbors 3
```

# 12. 项目文档结构

```bash
ois@ois:~/data/k8s-cilium-lab$ tree
.
├── ansible.cfg
├── group_vars
│   └── all.yml
├── host_vars
│   ├── dns-bgp-server.yml
│   ├── k8s-node-1.yml
│   ├── k8s-node-2.yml
│   └── k8s-node-3.yml
├── inventory.ini
├── nodevm_cfg
│   ├── dns-bgp-server_meta-data
│   ├── dns-bgp-server_network-config
│   ├── dns-bgp-server_user-data
│   ├── k8s-node-1_meta-data
│   ├── k8s-node-1_network-config
│   ├── k8s-node-1_user-data
│   ├── k8s-node-2_meta-data
│   ├── k8s-node-2_network-config
│   ├── k8s-node-2_user-data
│   ├── k8s-node-3_meta-data
│   ├── k8s-node-3_network-config
│   └── k8s-node-3_user-data
├── nodevms
│   ├── dns-bgp-server.qcow2
│   ├── k8s-node-1.qcow2
│   ├── k8s-node-2.qcow2
│   └── k8s-node-3.qcow2
├── playbooks
│   ├── 1_create_vms.yml
│   ├── 2_prepare_nodes.yml
│   ├── 3_setup_cluster.yml
│   └── 4_deploy_app.yml
├── roles
│   ├── common
│   │   └── tasks
│   │       └── main.yml
│   ├── infra_server
│   │   └── tasks
│   │       └── main.yml
│   └── k8s_node
│       └── tasks
│           └── main.yml
└── templates
    ├── cilium-bgp.yaml.j2
    ├── containerd.toml.j2
    ├── deploy-star-wars.sh.j2
    ├── frr.conf.j2
    ├── hosts.j2
    ├── meta-data.j2
    ├── network-config.j2
    └── user-data.j2

14 directories, 38 files
```