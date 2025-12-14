---
title: Kubernetes with CNI Cilium 安装学习
date: 2025-08-01 16:06:36
tags:
description: 本文从零开始部署Ubuntu虚拟机，然后在Ubuntu上安装K8S，使用Cilium作为CNI。
---
# Kubernetes with CNI Cilium 安装学习

# 1. 使用自动化脚本安装Ubuntu 24.04虚拟机

## 1.1 准备工作

```bash
密码加密字符串
ois@ois:~$ mkpasswd --method=SHA-512 --rounds=4096
Password: 
$6$rounds=4096$LDu9pXXXXXXXXXXXXXXOh/Iunw372/TVfst1

生成ssh-key，以便实现无密码登录。
ssh-keygen -t rsa -b 4096
Generating public/private rsa key pair.
Enter file in which to save the key (/root/.ssh/id_rsa): 
Enter passphrase (empty for no passphrase): 
Enter same passphrase again: 
Your identification has been saved in /root/.ssh/id_rsa
Your public key has been saved in /root/.ssh/id_rsa.pub
The key fingerprint is:
SHA256:1+BaD0K3fe6saxPFf41r0SyZEpqhq29AVeRwz+WEXiU 
The key's randomart image is:
+---[RSA 4096]----+
|        .o+  .E..|
|        .+ o.+.. |
|       .. +.oo.  |
|      .. o.=o o  |
|     .  S.*+oo.B.|
|      . .=oooo* *|
|       ...  .o.+.|
|        o   ooo  |
|      .+.  .o=o  |
+----[SHA256]-----+
```

## 1.2 自动化脚本创建虚拟机节点— 由Gemini生成

### create-vms.sh

```bash
#!/bin/bash

# --- Configuration ---
BASE_IMAGE_PATH="/home/ois/data/vmimages/noble-server-cloudimg-amd64.img"
VM_IMAGE_DIR="/home/ois/data/k8s/nodevms"
VM_CONFIG_DIR="/home/ois/data/k8s/nodevm_cfg"
RAM_MB=8192
VCPUS=4
DISK_SIZE_GB=20 # <--- ADDED: Increased disk size to 20 GB
BRIDGE_INTERFACE="br0"
BASE_IP="10.75.59"
NETWORK_PREFIX="/24"
GATEWAY="10.75.59.1"
NAMESERVER1="64.104.76.247"
NAMESERVER2="64.104.14.184"
SEARCH_DOMAIN="cisco.com"
VNC_PORT_START=5905 # VNC ports will be 5905, 5906, 5907
PASSWORD_HASH='$6$rounds=4096$LDu9pXXXXXXXXXXXXXXOh/Iunw372/TVfst1'
SSH_PUB_KEY=$(cat ~/.ssh/id_rsa.pub)

# --- Loop to create 3 VMs ---
for i in {1..3}; do
    VM_NAME="kube-node-$i"
    VM_IP="${BASE_IP}.$((70 + i))" # IPs will be 10.75.59.71, 10.75.59.72, 10.75.59.73
    VM_IMAGE_PATH="${VM_IMAGE_DIR}/${VM_NAME}.qcow2"
    VM_VNC_PORT=$((VNC_PORT_START + i - 1)) # VNC ports will be 5905, 5906, 5907

    echo "--- Preparing for $VM_NAME (IP: $VM_IP) ---"

    # Create directories if they don't exist
    mkdir -p "$VM_IMAGE_DIR"
    mkdir -p "$VM_CONFIG_DIR"

    # Create a fresh image for each VM
    if [ -f "$VM_IMAGE_PATH" ]; then
        echo "Removing existing image for $VM_NAME..."
        rm "$VM_IMAGE_PATH"
    fi
    echo "Copying base image to $VM_IMAGE_PATH..."
    cp "$BASE_IMAGE_PATH" "$VM_IMAGE_PATH"

    # --- NEW: Resize the copied image before virt-install ---
    echo "Resizing VM image to ${DISK_SIZE_GB}GB..."
    qemu-img resize "$VM_IMAGE_PATH" "${DISK_SIZE_GB}G"
    # --- END NEW ---

    # Generate user-data for the current VM
    USER_DATA_FILE="${VM_CONFIG_DIR}/${VM_NAME}_user-data"
    cat <<EOF > "$USER_DATA_FILE"
#cloud-config

locale: en_US
keyboard:
  layout: us
timezone: Asia/Shanghai
hostname: ${VM_NAME}
create_hostname_file: true

ssh_pwauth: yes

groups:
  - ubuntu

users:
  - name: ubuntu
    gecos: ubuntu
    primary_group: ubuntu
    groups: sudo, cdrom
    sudo: ALL=(ALL:ALL) ALL
    shell: /bin/bash
    lock_passwd: false
    passwd: ${PASSWORD_HASH}
    ssh_authorized_keys:
      - "${SSH_PUB_KEY}"

apt:
  primary:
    - arches: [default]
      uri: http://us.archive.ubuntu.com/ubuntu/

packages:
  - openssh-server
  - net-tools
  - iftop
  - htop
  - iperf3
  - vim
  - curl
  - wget
  - cloud-guest-utils # Ensure growpart is available

ntp:
  servers: ['ntp.esl.cisco.com']

runcmd:
  - echo "Attempting to resize root partition and filesystem..."
  - growpart /dev/vda 1 # Expand the first partition on /dev/vda
  - resize2fs /dev/vda1 # Expand the ext4 filesystem on /dev/vda1
  - echo "Disk resize commands executed. Verify with 'df -h' after boot."
EOF

    # Generate network-config for the current VM
    NETWORK_CONFIG_FILE="${VM_CONFIG_DIR}/${VM_NAME}_network-config"
    cat <<EOF > "$NETWORK_CONFIG_FILE"
network:
  version: 2
  ethernets:
    enp1s0:
      addresses:
      - "${VM_IP}${NETWORK_PREFIX}"
      nameservers:
        addresses:
        - ${NAMESERVER1}
        - ${NAMESERVER2}
        search:
        - ${SEARCH_DOMAIN}
      routes:
      - to: "default"
        via: "${GATEWAY}"
EOF

    # Generate meta-data (can be static for now)
    META_DATA_FILE="${VM_CONFIG_DIR}/${VM_NAME}_meta-data"
    cat <<EOF > "$META_DATA_FILE"
instance-id: ${VM_NAME}
local-hostname: ${VM_NAME}
EOF

    echo "--- Installing $VM_NAME ---"
    virt-install --name "${VM_NAME}" --ram "${RAM_MB}" --vcpus "${VCPUS}" --noreboot \
        --os-variant ubuntu24.04 \
        --network bridge="${BRIDGE_INTERFACE}" \
        --graphics vnc,listen=0.0.0.0,port="${VM_VNC_PORT}" \
        --disk path="${VM_IMAGE_PATH}",format=qcow2 \
        --console pty,target_type=serial \
        --cloud-init user-data="${USER_DATA_FILE}",meta-data="${META_DATA_FILE}",network-config="${NETWORK_CONFIG_FILE}" \
        --import \
        --wait 0

    echo "Successfully initiated creation of $VM_NAME."
    echo "You can connect to VNC on port ${VM_VNC_PORT} to monitor installation (optional)."
    echo "Wait a few minutes for the VM to boot and cloud-init to run."
    echo "--------------------------------------------------------"
done

echo "All 3 VMs have been initiated. Please wait for them to fully provision."
echo "You can SSH into them using 'ssh ubuntu@<IP_ADDRESS>' where IP addresses are 10.75.59.71, 10.75.59.72, 10.75.59.73."

```

上述脚本可自动生成三个虚拟机，并可以使用 ssh ubuntu@10.75.59.71 登录

```bash
chmod +x create-vms.sh

ois@ois:~/data/k8s$ ./create-vms.sh 
--- Preparing for kube-node-1 (IP: 10.75.59.71) ---
Removing existing image for kube-node-1...
Copying base image to /home/ois/data/k8s/nodevms/kube-node-1.qcow2...
Resizing VM image to 20GB...
Image resized.
--- Installing kube-node-1 ---
WARNING  Treating --wait 0 as --noautoconsole

Starting install...
Allocating 'virtinst-3jev55ba-cloudinit.iso'                                                                                                                                                                                             |    0 B  00:00:00 ... 
Transferring 'virtinst-3jev55ba-cloudinit.iso'                                                                                                                                                                                           |    0 B  00:00:00 ... 
Creating domain...                                                                                                                                                                                                                       |    0 B  00:00:00     
Domain creation completed.
Successfully initiated creation of kube-node-1.
You can connect to VNC on port 5905 to monitor installation (optional).
Wait a few minutes for the VM to boot and cloud-init to run.
--------------------------------------------------------
--- Preparing for kube-node-2 (IP: 10.75.59.72) ---
Removing existing image for kube-node-2...
Copying base image to /home/ois/data/k8s/nodevms/kube-node-2.qcow2...
Resizing VM image to 20GB...
Image resized.
--- Installing kube-node-2 ---
WARNING  Treating --wait 0 as --noautoconsole

Starting install...
Allocating 'virtinst-c4ruhql3-cloudinit.iso'                                                                                                                                                                                             |    0 B  00:00:00 ... 
Transferring 'virtinst-c4ruhql3-cloudinit.iso'                                                                                                                                                                                           |    0 B  00:00:00 ... 
Creating domain...                                                                                                                                                                                                                       |    0 B  00:00:00     
Domain creation completed.
Successfully initiated creation of kube-node-2.
You can connect to VNC on port 5906 to monitor installation (optional).
Wait a few minutes for the VM to boot and cloud-init to run.
--------------------------------------------------------
--- Preparing for kube-node-3 (IP: 10.75.59.73) ---
Removing existing image for kube-node-3...
Copying base image to /home/ois/data/k8s/nodevms/kube-node-3.qcow2...
Resizing VM image to 20GB...
Image resized.
--- Installing kube-node-3 ---
WARNING  Treating --wait 0 as --noautoconsole

Starting install...
Allocating 'virtinst-u5e8k9a9-cloudinit.iso'                                                                                                                                                                                             |    0 B  00:00:00 ... 
Transferring 'virtinst-u5e8k9a9-cloudinit.iso'                                                                                                                                                                                           |    0 B  00:00:00 ... 
Creating domain...                                                                                                                                                                                                                       |    0 B  00:00:00     
Domain creation completed.
Successfully initiated creation of kube-node-3.
You can connect to VNC on port 5907 to monitor installation (optional).
Wait a few minutes for the VM to boot and cloud-init to run.
--------------------------------------------------------
All 3 VMs have been initiated. Please wait for them to fully provision.
You can SSH into them using 'ssh ubuntu@<IP_ADDRESS>' where IP addresses are 10.75.59.71, 10.75.59.72, 10.75.59.73.

ois@ois:~/data/k8s$ virsh list
 Id   Name                  State
-------------------------------------
 83   kube-node-1           running
 84   kube-node-2           running
 85   kube-node-3           running
```

### user-data 示例

```bash
#cloud-config

locale: en_US
keyboard:
  layout: us
timezone: Asia/Shanghai
hostname: kube-node-1
create_hostname_file: true

ssh_pwauth: yes

groups:
  - ubuntu

users:
  - name: ubuntu
    gecos: ubuntu
    primary_group: ubuntu
    groups: sudo, cdrom
    sudo: ALL=(ALL:ALL) ALL
    shell: /bin/bash
    lock_passwd: false
    passwd: $6$rounds=4096$LDu9pXXXXXXXXXXXXXXOh/Iunw372/TVfst1
    ssh_authorized_keys:
      - "ssh-rsa AAAAB3NzaC1yXXXXXXXXXX=="

apt:
  primary:
    - arches: [default]
      uri: http://us.archive.ubuntu.com/ubuntu/

packages:
  - openssh-server
  - net-tools
  - iftop
  - htop
  - iperf3
  - vim
  - curl
  - wget
  - cloud-guest-utils # Ensure growpart is available

ntp:
  servers: ['ntp.esl.cisco.com']

runcmd:
  - echo "Attempting to resize root partition and filesystem..."
  - growpart /dev/vda 1 # Expand the first partition on /dev/vda
  - resize2fs /dev/vda1 # Expand the ext4 filesystem on /dev/vda1
  - echo "Disk resize commands executed. Verify with 'df -h' after boot."

```

### network-config

```bash
network:
  version: 2
  ethernets:
    enp1s0:
      addresses:
      - "10.75.59.71/24"
      nameservers:
        addresses:
        - 64.104.76.247
        - 64.104.14.184
        search:
        - cisco.com
      routes:
      - to: "default"
        via: "10.75.59.1"
```

### meta-data

```bash
instance-id: kube-node-1
local-hostname: kube-node-1
```

# 2. 使用Ansible安装Kubernetes

## 2.1 脚本内容

以下脚本可用于自动化安装Ansible，并生成Playbook，可直接执行安装任务。

```bash
#!/bin/bash

# This script automates the setup of an Ansible environment for Kubernetes cluster deployment.
# It installs Ansible, creates the project directory, inventory, configuration,
# and defines common Kubernetes setup tasks.
# This version stops after installing Kubernetes components, allowing manual kubeadm init/join.
# Includes a robust fix for Containerd's SystemdCgroup configuration and CRI plugin enabling,
# defines the necessary handler for restarting Containerd, dynamically adds host entries to /etc/hosts,
# and updates the pause image version in the manual instructions.
# This update also addresses the runc runtime root configuration in containerd and fixes
# YAML escape character issues in the hosts file regex, and updates the sandbox image in containerd config.

# --- Configuration ---
PROJECT_DIR="k8s_cluster_setup"
MASTER_NODE_IP="10.75.59.71" # Based on your previous script's IP assignment for kube-node-1
WORKER_NODE_IP_1="10.75.59.72" # Based on your previous script's IP assignment for kube-node-2
WORKER_NODE_IP_2="10.75.59.73" # Based on your previous script's IP address for kube-node-3
ANSIBLE_USER="ubuntu" # The user created by cloud-init on your VMs
SSH_PRIVATE_KEY_PATH="~/.ssh/id_rsa" # Path to your SSH private key on the Ansible control machine

# --- Functions ---

# Function to install Ansible
install_ansible() {
    echo "--- Installing Ansible ---"
    if ! command -v ansible &> /dev/null; then
        sudo apt update -y
        sudo apt install -y ansible
        echo "Ansible installed successfully."
    else
        echo "Ansible is already installed."
    fi
}

# Function to create project directory and navigate into it
create_project_dir() {
    echo "--- Creating project directory: ${PROJECT_DIR} ---"
    mkdir -p "${PROJECT_DIR}"
    cd "${PROJECT_DIR}" || { echo "Failed to change directory to ${PROJECT_DIR}. Exiting."; exit 1; }
    echo "Changed to directory: $(pwd)"
}

# Function to create ansible.cfg
create_ansible_cfg() {
    echo "--- Creating ansible.cfg ---"
    cat <<EOF > ansible.cfg
[defaults]
inventory = inventory.ini
roles_path = ./roles
host_key_checking = False # WARNING: Disable host key checking for convenience during initial setup. Re-enable for production!
EOF
    echo "ansible.cfg created."
}

# Function to create inventory.ini (UPDATED with IP variables)
create_inventory() {
    echo "--- Creating inventory.ini ---"
    cat <<EOF > inventory.ini
[master]
kube-node-1 ansible_host=${MASTER_NODE_IP}

[workers]
kube-node-2 ansible_host=${WORKER_NODE_IP_1}
kube-node-3 ansible_host=${WORKER_NODE_IP_2}

[all:vars]
ansible_user=${ANSIBLE_USER}
ansible_ssh_private_key_file=${SSH_PRIVATE_KEY_PATH}
ansible_python_interpreter=/usr/bin/python3
# These variables are now primarily for documentation/script clarity,
# as the hosts file task will dynamically read from inventory groups.
master_node_ip=${MASTER_NODE_IP}
worker_node_ip_1=${WORKER_NODE_IP_1}
worker_node_ip_2=${WORKER_NODE_IP_2}
EOF
    echo "inventory.ini created."
}

# Function to create main playbook.yml (Modified to only include common setup)
create_playbook() {
    echo "--- Creating playbook.yml ---"
    cat <<EOF > playbook.yml
---
- name: Common Kubernetes Setup for all nodes
  hosts: all
  become: yes
  roles:
    - common_k8s_setup
EOF
    echo "playbook.yml created (only common setup included)."
}

# Function to create roles and their tasks
create_roles() {
    echo "--- Creating Ansible roles and tasks ---"

    # common_k8s_setup role
    mkdir -p roles/common_k8s_setup/tasks
    # UPDATED: main.yml to include the new hosts entry task first
    cat <<EOF > roles/common_k8s_setup/tasks/main.yml
---
- name: Include add hosts entries task
  ansible.builtin.include_tasks: 00_add_hosts_entries.yml

- name: Include disable swap task
  ansible.builtin.include_tasks: 01_disable_swap.yml

- name: Include containerd setup task
  ansible.builtin.include_tasks: 02_containerd_setup.yml

- name: Include kernel modules and sysctl task
  ansible.builtin.include_tasks: 03_kernel_modules_sysctl.yml

- name: Include kube repo, install, and hold task
  ansible.builtin.include_tasks: 04_kube_repo_install_hold.yml

- name: Include initial apt upgrade task
  ansible.builtin.include_tasks: 05_initial_upgrade.yml

- name: Include configure weekly updates task
  ansible.builtin.include_tasks: 06_configure_weekly_updates.yml
EOF

    # NEW FILE: 00_add_hosts_entries.yml (Dynamically adds hosts from inventory, FIXED: Escaped backslashes in regex)
    cat <<EOF > roles/common_k8s_setup/tasks/00_add_hosts_entries.yml
---
- name: Add all inventory hosts to /etc/hosts on each node
  ansible.builtin.lineinfile:
    path: /etc/hosts
    regexp: "^{{ hostvars[item]['ansible_host'] }}\\\\s+{{ item }}" # Fixed: \\\\s for escaped backslash in regex
    line: "{{ hostvars[item]['ansible_host'] }} {{ item }}"
    state: present
    create: yes
    mode: '0644'
    owner: root
    group: root
  loop: "{{ groups['all'] }}" # Loop over all hosts defined in the inventory
EOF

    # Create handlers directory and file
    mkdir -p roles/common_k8s_setup/handlers
    cat <<EOF > roles/common_k8s_setup/handlers/main.yml
---
- name: Restart containerd service
  ansible.builtin.systemd:
    name: containerd
    state: restarted
    daemon_reload: yes
EOF

    # 01_disable_swap.yml
    cat <<EOF > roles/common_k8s_setup/tasks/01_disable_swap.yml
---
- name: Check if swap is active
  ansible.builtin.command: swapon --show
  register: swap_check_result
  changed_when: false # This command itself doesn't change state
  failed_when: false  # Don't fail if swapon --show returns non-zero (e.g., no swap enabled)

- name: Disable swap
  ansible.builtin.command: swapoff -a
  when: swap_check_result.rc == 0 # Only run if swapon --show indicated swap is active

- name: Persistently disable swap (comment out swapfile in fstab)
  ansible.builtin.replace:
    path: /etc/fstab
    regexp: '^(/swapfile.*)$'
    replace: '#\1'
  when: swap_check_result.rc == 0 # Only run if swap was found to be active
EOF

    # 02_containerd_setup.yml (UPDATED for sandbox_image)
    cat <<EOF > roles/common_k8s_setup/tasks/02_containerd_setup.yml
---
- name: Install required packages for Containerd
  ansible.builtin.apt:
    name:
      - ca-certificates
      - curl
      - gnupg
      - lsb-release
      - apt-transport-https
      - software-properties-common
    state: present
    update_cache: yes

- name: Add Docker GPG key
  ansible.builtin.apt_key:
    url: https://download.docker.com/linux/ubuntu/gpg
    state: present
    keyring: /etc/apt/keyrings/docker.gpg # Use keyring for modern apt

- name: Add Docker APT repository
  ansible.builtin.apt_repository:
    repo: "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu {{ ansible_distribution_release }} stable"
    state: present
    filename: docker

- name: Install Containerd
  ansible.builtin.apt:
    name: containerd.io
    state: present
    update_cache: yes

- name: Create containerd configuration directory
  ansible.builtin.file:
    path: /etc/containerd
    state: directory
    mode: '0755'

- name: Generate default containerd configuration directly to final path
  ansible.builtin.shell: containerd config default > /etc/containerd/config.toml
  changed_when: true # Always report change as we're ensuring a default state

- name: Ensure CRI plugin is enabled (remove any disabled_plugins line containing "cri")
  ansible.builtin.lineinfile:
    path: /etc/containerd/config.toml
    regexp: '^\s*disabled_plugins = \[.*"cri".*\]' # More general regexp
    state: absent
    backup: yes
  notify: Restart containerd service

- name: Remove top-level systemd_cgroup from CRI plugin section
  ansible.builtin.lineinfile:
    path: /etc/containerd/config.toml
    regexp: '^\s*systemd_cgroup = (true|false)' # Matches the 'systemd_cgroup' directly under [plugins."io.containerd.grpc.v1.cri"]
    state: absent # Remove this line
    backup: yes
  notify: Restart containerd service

- name: Remove old runtime_root from runc runtime section
  ansible.builtin.lineinfile:
    path: /etc/containerd/config.toml
    regexp: '^\s*runtime_root = ".*"' # Matches runtime_root line
    state: absent
    backup: yes
  notify: Restart containerd service

- name: Configure runc runtime to use SystemdCgroup = true
  ansible.builtin.lineinfile:
    path: /etc/containerd/config.toml
    regexp: '^\s*#?\s*SystemdCgroup = (true|false)' # Matches the 'SystemdCgroup' under runc.options
    line: '            SystemdCgroup = true' # Ensure correct indentation
    insertafter: '^\s*\[plugins\."io\.containerd\.grpc\.v1\.cri"\.containerd\.runtimes\.runc\.options\]'
    backup: yes
  notify: Restart containerd service

- name: Add Root path to runc options
  ansible.builtin.lineinfile:
    path: /etc/containerd/config.toml
    regexp: '^\s*Root = ".*"' # Matches existing Root line if any
    line: '            Root = "/run/containerd/runc"' # New Root path
    insertafter: '^\s*\[plugins\."io\.containerd\.grpc\.v1\.cri"\.containerd\.runtimes\.runc\.options\]'
    backup: yes
  notify: Restart containerd service

- name: Update sandbox_image to pause:3.10
  ansible.builtin.lineinfile:
    path: /etc/containerd/config.toml
    regexp: '^\s*sandbox_image = "registry.k8s.io/pause:.*"'
    line: '    sandbox_image = "registry.k8s.io/pause:3.10"'
    insertafter: '^\s*\[plugins\."io\.containerd\.grpc\.v1\.cri"\]' # Insert after the CRI plugin section start
    backup: yes
  notify: Restart containerd service
EOF

    # 03_kernel_modules_sysctl.yml
    cat <<EOF > roles/common_k8s_setup/tasks/03_kernel_modules_sysctl.yml
---
- name: Load overlay module
  ansible.builtin.command: modprobe overlay
  args:
    creates: /sys/module/overlay # Check if module is loaded
  changed_when: false

- name: Load br_netfilter module
  ansible.builtin.command: modprobe br_netfilter
  args:
    creates: /sys/module/br_netfilter # Check if module is loaded
  changed_when: false

- name: Add modules to /etc/modules-load.d/k8s.conf
  ansible.builtin.copy:
    dest: /etc/modules-load.d/k8s.conf
    content: |
      overlay
      br_netfilter

- name: Configure sysctl parameters for Kubernetes networking
  ansible.builtin.copy:
    dest: /etc/sysctl.d/k8s.conf
    content: |
      net.bridge.bridge-nf-call-iptables = 1
      net.bridge.bridge-nf-call-ip6tables = 1
      net.ipv4.ip_forward = 1

- name: Apply sysctl parameters
  ansible.builtin.command: sysctl --system
  changed_when: false
EOF

    # 04_kube_repo_install_hold.yml
    cat <<EOF > roles/common_k8s_setup/tasks/04_kube_repo_install_hold.yml
---
- name: Create Kubernetes apt keyring directory
  ansible.builtin.file:
    path: /etc/apt/keyrings
    state: directory
    mode: '0755'

- name: Download Kubernetes GPG key and dearmor
  ansible.builtin.shell: |
    curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.33/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
  args:
    creates: /etc/apt/keyrings/kubernetes-apt-keyring.gpg
  changed_when: false # This command is idempotent enough for our purposes

- name: Add Kubernetes APT repository source list
  ansible.builtin.copy:
    dest: /etc/apt/sources.list.d/kubernetes.list
    content: "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.33/deb/ /\n"
    mode: '0644'
    backup: yes

- name: Update apt cache after adding Kubernetes repo
  ansible.builtin.apt:
    update_cache: yes

- name: Install kubelet, kubeadm, kubectl
  ansible.builtin.apt:
    name:
      - kubelet
      - kubeadm
      - kubectl
    state: present
    update_cache: yes # Ensure apt cache is updated after adding repo.

- name: Hold kubelet, kubeadm, kubectl packages
  ansible.builtin.dpkg_selections:
    name: "{{ item }}"
    selection: hold
  loop:
    - kubelet
    - kubeadm
    - kubectl

- name: Enable and start kubelet service
  ansible.builtin.systemd:
    name: kubelet
    state: started
    enabled: yes
EOF

    # NEW FILE: 05_initial_upgrade.yml
    cat <<EOF > roles/common_k8s_setup/tasks/05_initial_upgrade.yml
---
- name: Perform initial apt update and upgrade
  ansible.builtin.apt:
    update_cache: yes
    upgrade: yes
    autoremove: yes
    purge: yes
EOF

    # NEW FILE: 06_configure_weekly_updates.yml
    cat <<EOF > roles/common_k8s_setup/tasks/06_configure_weekly_updates.yml
---
- name: Configure weekly apt update and upgrade cron job
  ansible.builtin.cron:
    name: "weekly apt update and upgrade"
    weekday: "0" # Sunday
    hour: "3"    # 3 AM
    minute: "0"
    job: "/usr/bin/apt update && /usr/bin/apt upgrade -y && /usr/bin/apt autoremove -y && /usr/bin/apt clean"
    user: root
    state: present
EOF

    # Master and Worker roles are still created for structure, but not called by playbook.yml
    mkdir -p roles/k8s-master/tasks
    cat <<EOF > roles/k8s-master/tasks/main.yml
---
- name: This role is intentionally skipped by the main playbook for manual setup.
  ansible.builtin.debug:
    msg: "This master role is not executed by default. Run 'kubeadm init' manually on the master node."
EOF

    mkdir -p roles/k8s-worker/tasks
    cat <<EOF > roles/k8s-worker/tasks/main.yml
---
- name: This role is intentionally skipped by the main playbook for manual setup.
  ansible.builtin.debug:
    msg: "This worker role is not executed by default. Run 'kubeadm join' manually on worker nodes."
EOF

    echo "Ansible roles and tasks created."
}

# --- Main execution ---
install_ansible
create_project_dir
create_ansible_cfg
create_inventory
create_playbook
create_roles

echo ""
echo "--- Ansible setup for Kubernetes installation is complete! ---"
echo "Navigate to the project directory:"
echo "cd ${PROJECT_DIR}"
echo ""
echo "Then, run the Ansible playbook to install Kubernetes components on all nodes:"
echo "ansible-playbook playbook.yml -K"
echo ""
echo "After the playbook finishes, you will need to manually initialize the Kubernetes cluster:"
echo "1. SSH into the master node (kube-node-1):"
echo "   ssh ubuntu@${MASTER_NODE_IP}"
echo ""
echo "2. Initialize the Kubernetes control plane on the master node:"
echo "   sudo kubeadm init --control-plane-endpoint=kube-node-1 --pod-network-cidr=172.16.0.0/20 --service-cidr=172.16.32.0/20 --skip-phases=addon/kube-proxy --pod-infra-container-image=registry.k8s.io/pause:3.10"
echo ""
echo "3. After 'kubeadm init' completes, it will print instructions to set up kubectl and the 'kubeadm join' command."
echo "   Follow the instructions to set up kubectl for the 'ubuntu' user:"
echo "   mkdir -p \$HOME/.kube"
echo "   sudo cp -i /etc/kubernetes/admin.conf \$HOME/.kube/config"
echo "   sudo chown \$(id -u):\$(id -g) \$HOME/.kube/config"
echo ""
echo "4. Copy the 'kubeadm join' command (including the token and discovery-token-ca-cert-hash) printed by 'kubeadm init'."
echo "   It will look something like: 'kubeadm join <master-ip>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>'"
echo ""
echo "5. SSH into each worker node (kube-node-2, kube-node-3) and run the join command:"
echo "   ssh ubuntu@${WORKER_NODE_IP_1} (for kube-node-2)"
echo "   sudo <PASTE_YOUR_KUBEADM_JOIN_COMMAND_HERE>"
echo ""
echo "   ssh ubuntu@${WORKER_NODE_IP_2} (for kube-node-3)"
echo "   sudo <PASTE_YOUR_KUBEADM_JOIN_COMMAND_HERE>"
echo ""
echo "6. Verify your cluster status from the master node:"
echo "   ssh ubuntu@${MASTER_NODE_IP}"
echo "   kubectl get nodes"
echo "   kubectl get pods --all-namespaces"
```

上述脚本执行完后，创建以下文档

```bash
root@ois:/home/ois/data/k8s/k8s_cluster_setup# ls -R1
.:
ansible.cfg
inventory.ini
playbook.yml
roles

./roles:
common_k8s_setup
k8s-master
k8s-worker

./roles/common_k8s_setup:
handlers
tasks

./roles/common_k8s_setup/handlers:
main.yml

./roles/common_k8s_setup/tasks:
00_add_hosts_entries.yml
01_disable_swap.yml
02_containerd_setup.yml
03_kernel_modules_sysctl.yml
04_kube_repo_install_hold.yml
05_initial_upgrade.yml
06_configure_weekly_updates.yml
main.yml

./roles/k8s-master:
tasks

./roles/k8s-master/tasks:
main.yml

./roles/k8s-worker:
tasks

./roles/k8s-worker/tasks:
main.yml
```

## 2.2 执行过程

在执行前，需要让.ssh/known_hosts 文件保存这些主机的SSH Key。

```bash
#!/bin/bash

# This script prepares the Ansible control node by adding the SSH host keys
# of the target nodes to the ~/.ssh/known_hosts file.
# It first removes any outdated keys for the specified hosts before scanning
# for the new ones, preventing "REMOTE HOST IDENTIFICATION HAS CHANGED" errors.

# --- Configuration ---
# List of hosts (IPs or FQDNs) to scan.
# These should be the same hosts you have in your Ansible inventory.
HOSTS=(
    "10.75.59.71"
    "10.75.59.72"
    "10.75.59.73"
)

# The location of your known_hosts file.
KNOWN_HOSTS_FILE=~/.ssh/known_hosts

# --- Main Logic ---
echo "Starting SSH host key scan to update ${KNOWN_HOSTS_FILE}..."
echo ""

# Ensure the .ssh directory exists with the correct permissions.
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Loop through each host defined in the HOSTS array.
for host in "${HOSTS[@]}"; do
    echo "--- Processing host: ${host} ---"

    # 1. Remove the old host key (if it exists).
    # This is the key step to ensure we replace outdated entries.
    # The command is silent if no key is found.
    echo "Step 1: Removing any old key for ${host}..."
    ssh-keygen -R "${host}"

    # 2. Scan for the new host key and append it.
    # The -H flag hashes the hostname, which is a security best practice.
    echo "Step 2: Scanning for new key and adding it to known_hosts..."
    ssh-keyscan -H "${host}" >> "${KNOWN_HOSTS_FILE}"

    echo "Successfully updated key for ${host}."
    echo ""
done

# Set the correct permissions for the known_hosts file, as SSH is strict about this.
chmod 600 "${KNOWN_HOSTS_FILE}"

echo "✅ All hosts have been scanned and keys have been updated."
echo "You can now run your Ansible playbook without host key verification prompts."
```

```bash
chmod +x ansible-k8s-v2.sh 
ois@ois:~/data/k8s$ ./ansible-k8s-v2.sh 
--- Installing Ansible ---
Ansible is already installed.
--- Creating project directory: k8s_cluster_setup ---
Changed to directory: /home/ois/data/k8s/k8s_cluster_setup
--- Creating ansible.cfg ---
ansible.cfg created.
--- Creating inventory.ini ---
inventory.ini created.
--- Creating playbook.yml ---
playbook.yml created (only common setup included).
--- Creating Ansible roles and tasks ---
Ansible roles and tasks created.

--- Ansible setup for Kubernetes installation is complete! ---
Navigate to the project directory:
cd k8s_cluster_setup

Then, run the Ansible playbook to install Kubernetes components on all nodes:
ansible-playbook playbook.yml -K

After the playbook finishes, you will need to manually initialize the Kubernetes cluster:
1. SSH into the master node (kube-node-1):
   ssh ubuntu@10.75.59.71

2. Initialize the Kubernetes control plane on the master node:
   sudo kubeadm init --control-plane-endpoint=kube-node-1 --pod-network-cidr=172.16.0.0/20 --service-cidr=172.16.32.0/20 --skip-phases=addon/kube-proxy --pod-infra-container-image=registry.k8s.io/pause:3.10

3. After 'kubeadm init' completes, it will print instructions to set up kubectl and the 'kubeadm join' command.
   Follow the instructions to set up kubectl for the 'ubuntu' user:
   mkdir -p $HOME/.kube
   sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
   sudo chown $(id -u):$(id -g) $HOME/.kube/config

4. Copy the 'kubeadm join' command (including the token and discovery-token-ca-cert-hash) printed by 'kubeadm init'.
   It will look something like: 'kubeadm join <master-ip>:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>'

5. SSH into each worker node (kube-node-2, kube-node-3) and run the join command:
   ssh ubuntu@10.75.59.72 (for kube-node-2)
   sudo <PASTE_YOUR_KUBEADM_JOIN_COMMAND_HERE>

   ssh ubuntu@10.75.59.73 (for kube-node-3)
   sudo <PASTE_YOUR_KUBEADM_JOIN_COMMAND_HERE>

6. Verify your cluster status from the master node:
   ssh ubuntu@10.75.59.71
   kubectl get nodes
   kubectl get pods --all-namespaces
ois@ois:~/data/k8s$ cd k8s_cluster_setup/
```

```bash
ois@ois:~/data/k8s/k8s_cluster_setup$ ansible-playbook playbook.yml -K
BECOME password: 

PLAY [Common Kubernetes Setup for all nodes] *******************************************************************************************************************************************************************************************************************

TASK [Gathering Facts] *****************************************************************************************************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-2]
ok: [kube-node-3]

TASK [common_k8s_setup : Include add hosts entries task] *******************************************************************************************************************************************************************************************************
included: /home/ois/data/k8s/k8s_cluster_setup/roles/common_k8s_setup/tasks/00_add_hosts_entries.yml for kube-node-1, kube-node-2, kube-node-3

TASK [common_k8s_setup : Add all inventory hosts to /etc/hosts on each node] ***********************************************************************************************************************************************************************************
changed: [kube-node-2] => (item=kube-node-1)
changed: [kube-node-1] => (item=kube-node-1)
changed: [kube-node-3] => (item=kube-node-1)
changed: [kube-node-1] => (item=kube-node-2)
changed: [kube-node-2] => (item=kube-node-2)
changed: [kube-node-3] => (item=kube-node-2)
changed: [kube-node-2] => (item=kube-node-3)
changed: [kube-node-1] => (item=kube-node-3)
changed: [kube-node-3] => (item=kube-node-3)

TASK [common_k8s_setup : Include disable swap task] ************************************************************************************************************************************************************************************************************
included: /home/ois/data/k8s/k8s_cluster_setup/roles/common_k8s_setup/tasks/01_disable_swap.yml for kube-node-1, kube-node-2, kube-node-3

TASK [common_k8s_setup : Check if swap is active] **************************************************************************************************************************************************************************************************************
ok: [kube-node-2]
ok: [kube-node-1]
ok: [kube-node-3]

TASK [common_k8s_setup : Disable swap] *************************************************************************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-2]
changed: [kube-node-3]

TASK [common_k8s_setup : Persistently disable swap (comment out swapfile in fstab)] ****************************************************************************************************************************************************************************
ok: [kube-node-2]
ok: [kube-node-3]
ok: [kube-node-1]

TASK [common_k8s_setup : Include containerd setup task] ********************************************************************************************************************************************************************************************************
included: /home/ois/data/k8s/k8s_cluster_setup/roles/common_k8s_setup/tasks/02_containerd_setup.yml for kube-node-1, kube-node-2, kube-node-3

TASK [common_k8s_setup : Install required packages for Containerd] *********************************************************************************************************************************************************************************************
changed: [kube-node-2]
changed: [kube-node-1]
changed: [kube-node-3]

TASK [common_k8s_setup : Add Docker GPG key] *******************************************************************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-2]
changed: [kube-node-3]

TASK [common_k8s_setup : Add Docker APT repository] ************************************************************************************************************************************************************************************************************
changed: [kube-node-2]
changed: [kube-node-1]
changed: [kube-node-3]

TASK [common_k8s_setup : Install Containerd] *******************************************************************************************************************************************************************************************************************
changed: [kube-node-3]
changed: [kube-node-1]
changed: [kube-node-2]

TASK [common_k8s_setup : Create containerd configuration directory] ********************************************************************************************************************************************************************************************
ok: [kube-node-2]
ok: [kube-node-3]
ok: [kube-node-1]

TASK [common_k8s_setup : Generate default containerd configuration directly to final path] *********************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-3]
changed: [kube-node-2]

TASK [common_k8s_setup : Ensure CRI plugin is enabled (remove any disabled_plugins line containing "cri")] *****************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-2]
ok: [kube-node-3]

TASK [common_k8s_setup : Remove top-level systemd_cgroup from CRI plugin section] ******************************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-2]
changed: [kube-node-3]

TASK [common_k8s_setup : Remove old runtime_root from runc runtime section] ************************************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-3]
changed: [kube-node-2]

TASK [common_k8s_setup : Configure runc runtime to use SystemdCgroup = true] ***********************************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-2]
changed: [kube-node-3]

TASK [common_k8s_setup : Add Root path to runc options] ********************************************************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-3]
changed: [kube-node-2]

TASK [common_k8s_setup : Update sandbox_image to pause:3.10] ***************************************************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-2]
changed: [kube-node-3]

TASK [common_k8s_setup : Include kernel modules and sysctl task] ***********************************************************************************************************************************************************************************************
included: /home/ois/data/k8s/k8s_cluster_setup/roles/common_k8s_setup/tasks/03_kernel_modules_sysctl.yml for kube-node-1, kube-node-2, kube-node-3

TASK [common_k8s_setup : Load overlay module] ******************************************************************************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-2]
ok: [kube-node-3]

TASK [common_k8s_setup : Load br_netfilter module] *************************************************************************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-2]
ok: [kube-node-3]

TASK [common_k8s_setup : Add modules to /etc/modules-load.d/k8s.conf] ******************************************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-2]
changed: [kube-node-3]

TASK [common_k8s_setup : Configure sysctl parameters for Kubernetes networking] ********************************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-2]
changed: [kube-node-3]

TASK [common_k8s_setup : Apply sysctl parameters] **************************************************************************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-2]
ok: [kube-node-3]

TASK [common_k8s_setup : Include kube repo, install, and hold task] ********************************************************************************************************************************************************************************************
included: /home/ois/data/k8s/k8s_cluster_setup/roles/common_k8s_setup/tasks/04_kube_repo_install_hold.yml for kube-node-1, kube-node-2, kube-node-3

TASK [common_k8s_setup : Create Kubernetes apt keyring directory] **********************************************************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-2]
ok: [kube-node-3]

TASK [common_k8s_setup : Download Kubernetes GPG key and dearmor] **********************************************************************************************************************************************************************************************
ok: [kube-node-2]
ok: [kube-node-1]
ok: [kube-node-3]

TASK [common_k8s_setup : Add Kubernetes APT repository source list] ********************************************************************************************************************************************************************************************
changed: [kube-node-2]
changed: [kube-node-3]
changed: [kube-node-1]

TASK [common_k8s_setup : Update apt cache after adding Kubernetes repo] ****************************************************************************************************************************************************************************************
changed: [kube-node-2]
changed: [kube-node-1]
changed: [kube-node-3]

TASK [common_k8s_setup : Install kubelet, kubeadm, kubectl] ****************************************************************************************************************************************************************************************************
changed: [kube-node-3]
changed: [kube-node-2]
changed: [kube-node-1]

TASK [common_k8s_setup : Hold kubelet, kubeadm, kubectl packages] **********************************************************************************************************************************************************************************************
changed: [kube-node-1] => (item=kubelet)
changed: [kube-node-3] => (item=kubelet)
changed: [kube-node-2] => (item=kubelet)
changed: [kube-node-3] => (item=kubeadm)
changed: [kube-node-1] => (item=kubeadm)
changed: [kube-node-2] => (item=kubeadm)
changed: [kube-node-3] => (item=kubectl)
changed: [kube-node-1] => (item=kubectl)
changed: [kube-node-2] => (item=kubectl)

TASK [common_k8s_setup : Enable and start kubelet service] *****************************************************************************************************************************************************************************************************
changed: [kube-node-3]
changed: [kube-node-2]
changed: [kube-node-1]

TASK [common_k8s_setup : Include initial apt upgrade task] *****************************************************************************************************************************************************************************************************
included: /home/ois/data/k8s/k8s_cluster_setup/roles/common_k8s_setup/tasks/05_initial_upgrade.yml for kube-node-1, kube-node-2, kube-node-3

TASK [common_k8s_setup : Perform initial apt update and upgrade] ***********************************************************************************************************************************************************************************************
changed: [kube-node-3]
changed: [kube-node-2]
changed: [kube-node-1]

TASK [common_k8s_setup : Include configure weekly updates task] ************************************************************************************************************************************************************************************************
included: /home/ois/data/k8s/k8s_cluster_setup/roles/common_k8s_setup/tasks/06_configure_weekly_updates.yml for kube-node-1, kube-node-2, kube-node-3

TASK [common_k8s_setup : Configure weekly apt update and upgrade cron job] *************************************************************************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-2]
changed: [kube-node-3]

RUNNING HANDLER [common_k8s_setup : Restart containerd service] ************************************************************************************************************************************************************************************************
changed: [kube-node-2]
changed: [kube-node-1]
changed: [kube-node-3]

PLAY RECAP *****************************************************************************************************************************************************************************************************************************************************
kube-node-1                : ok=39   changed=22   unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
kube-node-2                : ok=39   changed=22   unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
kube-node-3                : ok=39   changed=22   unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
```

# 3. 设置本地DNS和BGP

设置一个本地DNS和BGP服务器用于测试。

## 3.1 create-dns.sh

```bash
#!/bin/bash

# --- Configuration ---
BASE_IMAGE_PATH="/home/ois/data/vmimages/noble-server-cloudimg-amd64.img"
VM_IMAGE_DIR="/home/ois/data/k8s/nodevms"
VM_CONFIG_DIR="/home/ois/data/k8s/nodevm_cfg"
RAM_MB=8192
VCPUS=4
DISK_SIZE_GB=20
BRIDGE_INTERFACE="br0"
# Specific IP for the single VM
VM_IP="10.75.59.76"
NETWORK_PREFIX="/24"
GATEWAY="10.75.59.1"
# DNS servers for the VM's initial resolution (for internet access)
VM_NAMESERVER1="64.104.76.247"
VM_NAMESERVER2="64.104.14.184"
SEARCH_DOMAIN="cisco.com"
VNC_PORT=5909 # Fixed VNC port for the single VM
PASSWORD_HASH='$6$rounds=4096$LDu9pXXXXXXXXXXXXXXOh/Iunw372/TVfst1'
SSH_PUB_KEY=$(cat ~/.ssh/id_rsa.pub)

# --- VM Details ---
VM_NAME="dns-server-vm"
VM_IMAGE_PATH="${VM_IMAGE_DIR}/${VM_NAME}.qcow2"

echo "--- Preparing for $VM_NAME (IP: $VM_IP) ---"

# Create directories if they don't exist
mkdir -p "$VM_IMAGE_DIR"
mkdir -p "$VM_CONFIG_DIR"

# Create a fresh image for the VM
if [ -f "$VM_IMAGE_PATH" ]; then
    echo "Removing existing image for $VM_NAME..."
    rm "$VM_IMAGE_PATH"
fi
echo "Copying base image to $VM_IMAGE_PATH..."
cp "$BASE_IMAGE_PATH" "$VM_IMAGE_PATH"

# Resize the copied image before virt-install
echo "Resizing VM image to ${DISK_SIZE_GB}GB..."
qemu-img resize "$VM_IMAGE_PATH" "${DISK_SIZE_GB}G"

# Generate user-data for the VM (installing dnsmasq, no UFW, no dnsmasq config here)
USER_DATA_FILE="${VM_CONFIG_DIR}/${VM_NAME}_user-data"
cat <<EOF > "$USER_DATA_FILE"
#cloud-config

locale: en_US
keyboard:
  layout: us
timezone: Asia/Tokyo
hostname: ${VM_NAME}
create_hostname_file: true

ssh_pwauth: yes

groups:
  - ubuntu

users:
  - name: ubuntu
    gecos: ubuntu
    primary_group: ubuntu
    groups: sudo, cdrom
    sudo: ALL=(ALL:ALL) ALL
    shell: /bin/bash
    lock_passwd: false
    passwd: ${PASSWORD_HASH}
    ssh_authorized_keys:
      - "${SSH_PUB_KEY}"

apt:
  primary:
    - arches: [default]
      uri: http://us.archive.ubuntu.com/ubuntu/

packages:
  - openssh-server
  - net-tools
  - iftop
  - htop
  - iperf3
  - vim
  - curl
  - wget
  - cloud-guest-utils # Ensure growpart is available
  - dnsmasq # Install dnsmasq for DNS server functionality

ntp:
  servers: ['ntp.esl.cisco.com']

runcmd:
  - echo "Attempting to resize root partition and filesystem..."
  - growpart /dev/vda 1 # Expand the first partition on /dev/vda
  - resize2fs /dev/vda1 # Expand the ext4 filesystem on /dev/vda1
  - echo "Disk resize commands executed. Verify with 'df -h' after boot."
EOF

# Generate network-config for the VM (pointing to external DNS for initial connectivity)
NETWORK_CONFIG_FILE="${VM_CONFIG_DIR}/${VM_NAME}_network-config"
cat <<EOF > "$NETWORK_CONFIG_FILE"
network:
  version: 2
  ethernets:
    enp1s0:
      addresses:
      - "${VM_IP}${NETWORK_PREFIX}"
      nameservers:
        addresses:
        - ${VM_NAMESERVER1} # Point VM to external DNS for initial internet access
        - ${VM_NAMESERVER2}
        search:
        - ${SEARCH_DOMAIN}
      routes:
      - to: "default"
        via: "${GATEWAY}"
EOF

# Generate meta-data
META_DATA_FILE="${VM_CONFIG_DIR}/${VM_NAME}_meta-data"
cat <<EOF > "$META_DATA_FILE"
instance-id: ${VM_NAME}
local-hostname: ${VM_NAME}
EOF

echo "--- Installing $VM_NAME ---"
virt-install --name "${VM_NAME}" --ram "${RAM_MB}" --vcpus "${VCPUS}" --noreboot \
    --os-variant ubuntu24.04 \
    --network bridge="${BRIDGE_INTERFACE}" \
    --graphics vnc,listen=0.0.0.0,port="${VNC_PORT}" \
    --disk path="${VM_IMAGE_PATH}",format=qcow2 \
    --console pty,target_type=serial \
    --cloud-init user-data="${USER_DATA_FILE}",meta-data="${META_DATA_FILE}",network-config="${NETWORK_CONFIG_FILE}" \
    --import \
    --wait 0

echo "Successfully initiated creation of $VM_NAME."
echo "You can connect to VNC on port ${VNC_PORT} to monitor installation (optional)."
echo "Wait a few minutes for the VM to boot and cloud-init to run."
echo "--------------------------------------------------------"

echo "The DNS server VM has been initiated. Please wait for it to fully provision."
echo "You can SSH into it using 'ssh ubuntu@${VM_IP}'."
echo "Once provisioned, proceed to use the 'setup-dnsmasq-ansible.sh' script to configure DNS using Ansible."

ois@ois:~/data/k8s$ ./create-dns.sh 
--- Preparing for dns-server-vm (IP: 10.75.59.76) ---
Copying base image to /home/ois/data/k8s/nodevms/dns-server-vm.qcow2...
Resizing VM image to 20GB...
Image resized.
--- Installing dns-server-vm ---
WARNING  Treating --wait 0 as --noautoconsole

Starting install...
Allocating 'virtinst-y1pxxrj5-cloudinit.iso'                                                                                                                                                                                             |    0 B  00:00:00 ... 
Transferring 'virtinst-y1pxxrj5-cloudinit.iso'                                                                                                                                                                                           |    0 B  00:00:00 ... 
Creating domain...                                                                                                                                                                                                                       |    0 B  00:00:00     
Domain creation completed.
Successfully initiated creation of dns-server-vm.
You can connect to VNC on port 5909 to monitor installation (optional).
Wait a few minutes for the VM to boot and cloud-init to run.
--------------------------------------------------------
The DNS server VM has been initiated. Please wait for it to fully provision.
You can SSH into it using 'ssh ubuntu@10.75.59.76'.
Once provisioned, you can test the DNS forwarding by configuring another machine to use 10.75.59.76 as its DNS server and performing a DNS query.
```

## 3.2 使用Ansible设置dnsmasq

```bash
#!/bin/bash

# --- Configuration for Ansible and DNSmasq ---
VM_IP="10.75.59.76"
SSH_USER="ubuntu"
SSH_PRIVATE_KEY_PATH="~/.ssh/id_rsa" # Ensure this path is correct for your setup
FORWARD_NAMESERVER1="64.104.76.247"
FORWARD_NAMESERVER2="64.104.14.184"
SEARCH_DOMAIN="cisco.com"
ANSIBLE_DIR="ansible_dnsmasq_setup"

echo "--- Setting up Ansible environment and configuring DNSmasq on ${VM_IP} ---"

# Create a directory for Ansible files
mkdir -p "$ANSIBLE_DIR"
cd "$ANSIBLE_DIR" || exit 1

# --- Install Ansible if not already installed ---
if ! command -v ansible &> /dev/null
then
    echo "Ansible not found. Installing Ansible..."
    # Check OS and install accordingly
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [[ "$ID" == "ubuntu" || "$ID" == "debian" ]]; then
            sudo apt update
            sudo apt install -y software-properties-common
            sudo apt-add-repository --yes --update ppa:ansible/ansible
            sudo apt install -y ansible
        elif [[ "$ID" == "centos" || "$ID" == "rhel" || "$ID" == "fedora" ]]; then
            sudo yum install -y epel-release
            sudo yum install -y ansible
        else
            echo "Unsupported OS for automatic Ansible installation. Please install Ansible manually."
            exit 1
        fi
    else
        echo "Could not determine OS for automatic Ansible installation. Please install Ansible manually."
        exit 1
    fi
else
    echo "Ansible is already installed."
fi

# --- Create Ansible Inventory File ---
echo "Creating Ansible inventory file: inventory.ini"
cat <<EOF > inventory.ini
[dns_server]
${VM_IP} ansible_user=${SSH_USER} ansible_ssh_private_key_file=${SSH_PRIVATE_KEY_PATH} ansible_python_interpreter=/usr/bin/python3
EOF

# --- Create Ansible Playbook (setup-dnsmasq.yml) ---
echo "Creating Ansible playbook: setup-dnsmasq.yml"
cat <<EOF > setup-dnsmasq.yml
---
- name: Configure DNSmasq Server on Ubuntu VM
  hosts: dns_server
  become: yes # Run tasks with sudo privileges
  vars:
    dns_forwarder_1: "${FORWARD_NAMESERVER1}"
    dns_forwarder_2: "${FORWARD_NAMESERVER2}"
    vm_ip: "${VM_IP}"
    search_domain: "${SEARCH_DOMAIN}"

  tasks:
    - name: Ensure apt cache is updated
      ansible.builtin.apt:
        update_cache: yes
        cache_valid_time: 3600 # Cache for 1 hour

    - name: Install dnsmasq package
      ansible.builtin.apt:
        name: dnsmasq
        state: present

    - name: Stop dnsmasq service before configuration
      ansible.builtin.systemd:
        name: dnsmasq
        state: stopped
      ignore_errors: yes # Ignore if it's not running initially

    - name: Backup original dnsmasq.conf
      ansible.builtin.command: mv /etc/dnsmasq.conf /etc/dnsmasq.conf.bak
      args:
        removes: /etc/dnsmasq.conf # Only run if dnsmasq.conf exists
      ignore_errors: yes

    - name: Configure dnsmasq for forwarding
      ansible.builtin.template:
        src: dnsmasq.conf.j2
        dest: /etc/dnsmasq.conf
        owner: root
        group: root
        mode: '0644'
      notify: Restart dnsmasq

    - name: Set VM's /etc/resolv.conf to point to itself (local DNS)
      ansible.builtin.template:
        src: resolv.conf.j2
        dest: /etc/resolv.conf
        owner: root
        group: root
        mode: '0644'
      vars:
        local_dns_ip: "127.0.0.1" # dnsmasq listens on 127.0.0.1
        # Removed: search_domain: "{{ search_domain }}" - it's already available from play vars
      notify: Restart systemd-resolved # Or NetworkManager, depending on Ubuntu version

  handlers:
    - name: Restart dnsmasq
      ansible.builtin.systemd:
        name: dnsmasq
        state: restarted
        enabled: yes # Ensure it's enabled to start on boot

    - name: Restart systemd-resolved
      ansible.builtin.systemd:
        name: systemd-resolved
        state: restarted
      ignore_errors: yes # systemd-resolved might not be used on server installs
EOF

# --- Create dnsmasq.conf.j2 template ---
echo "Creating dnsmasq.conf.j2 template"
cat <<EOF > dnsmasq.conf.j2
# This file is managed by Ansible. Do not edit manually.

# Do not read /etc/resolv.conf, use the servers below
no-resolv

# Specify upstream DNS servers for forwarding
server={{ dns_forwarder_1 }}
server={{ dns_forwarder_2 }}

# Listen on localhost and the VM's primary IP
listen-address=127.0.0.1,{{ vm_ip }}

# Allow queries from any interface
interface={{ ansible_default_ipv4.interface }} # Listen on the primary network interface

# Bind to the interfaces to prevent dnsmasq from listening on all interfaces
bind-interfaces

# Cache DNS results
cache-size=150
EOF

# --- Create resolv.conf.j2 template ---
echo "Creating resolv.conf.j2 template"
cat <<EOF > resolv.conf.j2
# This file is managed by Ansible. Do not edit manually.
nameserver {{ local_dns_ip }}
search {{ search_domain }}
EOF

# --- Run the Ansible Playbook ---
echo "Running Ansible playbook to configure DNSmasq..."
ansible-playbook -i inventory.ini setup-dnsmasq.yml -K

# --- Final Instructions ---
echo "--------------------------------------------------------"
echo "DNSmasq configuration complete on ${VM_IP}."
echo "You can now test the DNS server from the VM or from another machine."
echo "From the VM, run: dig @127.0.0.1 www.cisco.com"
echo "From another machine on the same network, configure its DNS to ${VM_IP} and run: dig www.cisco.com"
echo "Remember to exit the '${ANSIBLE_DIR}' directory when done (cd ..)."
```

执行效果

```bash
ois@ois:~/data/k8s$ ./ansible-dnsmasq.sh 
--- Setting up Ansible environment and configuring DNSmasq on 10.75.59.76 ---
Ansible is already installed.
Creating Ansible inventory file: inventory.ini
Creating Ansible playbook: setup-dnsmasq.yml
Creating dnsmasq.conf.j2 template
Creating resolv.conf.j2 template
Running Ansible playbook to configure DNSmasq...
BECOME password: 

PLAY [Configure DNSmasq Server on Ubuntu VM] *******************************************************************************************************************************************************************************************************************

TASK [Gathering Facts] *****************************************************************************************************************************************************************************************************************************************
ok: [10.75.59.76]

TASK [Ensure apt cache is updated] *****************************************************************************************************************************************************************************************************************************
ok: [10.75.59.76]

TASK [Install dnsmasq package] *********************************************************************************************************************************************************************************************************************************
ok: [10.75.59.76]

TASK [Stop dnsmasq service before configuration] ***************************************************************************************************************************************************************************************************************
ok: [10.75.59.76]

TASK [Backup original dnsmasq.conf] ****************************************************************************************************************************************************************************************************************************
changed: [10.75.59.76]

TASK [Configure dnsmasq for forwarding] ************************************************************************************************************************************************************************************************************************
changed: [10.75.59.76]

TASK [Set VM's /etc/resolv.conf to point to itself (local DNS)] ************************************************************************************************************************************************************************************************
changed: [10.75.59.76]

RUNNING HANDLER [Restart dnsmasq] ******************************************************************************************************************************************************************************************************************************
changed: [10.75.59.76]

RUNNING HANDLER [Restart systemd-resolved] *********************************************************************************************************************************************************************************************************************
changed: [10.75.59.76]

PLAY RECAP *****************************************************************************************************************************************************************************************************************************************************
10.75.59.76                : ok=9    changed=5    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   

--------------------------------------------------------
DNSmasq configuration complete on 10.75.59.76.
You can now test the DNS server from the VM or from another machine.
From the VM, run: dig @127.0.0.1 www.cisco.com
From another machine on the same network, configure its DNS to 10.75.59.76 and run: dig www.cisco.com
Remember to exit the 'ansible_dnsmasq_setup' directory when done (cd ..).
```

```bash
root@dns-server-vm:~# dig @127.0.0.1 www.cisco.com

; <<>> DiG 9.18.30-0ubuntu0.24.04.2-Ubuntu <<>> @127.0.0.1 www.cisco.com
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 10545
;; flags: qr aa rd ra; QUERY: 1, ANSWER: 3, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 1232
; COOKIE: ba16202024b9dc8301000000688b40f90daaa0a500a50d2d (good)
;; QUESTION SECTION:
;www.cisco.com.                 IN      A

;; ANSWER SECTION:
www.cisco.com.          3600    IN      CNAME   origin-www.cisco.com.
origin-www.cisco.com.   1800    IN      CNAME   origin-www.xgslb-v3.cisco.com.
origin-www.xgslb-v3.CISCO.com. 10 IN    A       72.163.4.161

;; Query time: 71 msec
;; SERVER: 127.0.0.1#53(127.0.0.1) (UDP)
;; WHEN: Thu Jul 31 19:10:01 JST 2025
;; MSG SIZE  rcvd: 183

```

## 3.3 使用Ansible更新Node 的DNS配置

```bash
#!/bin/bash

# --- Configuration ---
ANSIBLE_DIR="ansible_dns_update"
INVENTORY_FILE="${ANSIBLE_DIR}/hosts.ini"
PLAYBOOK_FILE="${ANSIBLE_DIR}/update_dns.yml"

# Kubernetes Node IPs (ensure these match your actual VM IPs)
KUBE_NODE_1_IP="10.75.59.71"
KUBE_NODE_2_IP="10.75.59.72"
KUBE_NODE_3_IP="10.75.59.73"

# Common Ansible user and Python interpreter
ANSIBLE_USER="ubuntu"
ANSIBLE_PYTHON_INTERPRETER="/usr/bin/python3"

# --- Functions ---

# Function to check and install Ansible
install_ansible() {
    if ! command -v ansible &> /dev/null
    then
        echo "Ansible not found. Attempting to install Ansible..."
        if [ -f /etc/debian_version ]; then
            # Debian/Ubuntu
            sudo apt update
            sudo apt install -y software-properties-common
            sudo add-apt-repository --yes --update ppa:ansible/ansible
            sudo apt install -y ansible
        elif [ -f /etc/redhat-release ]; then
            # CentOS/RHEL/Fedora
            sudo yum install -y epel-release
            sudo yum install -y ansible
        else
            echo "Unsupported OS for automatic Ansible installation. Please install Ansible manually."
            exit 1
        fi
        if ! command -v ansible &> /dev/null; then
            echo "Ansible installation failed. Please install it manually and re-run this script."
            exit 1
        fi
        echo "Ansible installed successfully."
    else
        echo "Ansible is already installed."
    fi
}

# Function to create Ansible inventory file
create_inventory() {
    echo "Creating Ansible inventory file: ${INVENTORY_FILE}"
    mkdir -p "$ANSIBLE_DIR"
    cat <<EOF > "$INVENTORY_FILE"
[kubernetes_nodes]
kube-node-1 ansible_host=${KUBE_NODE_1_IP}
kube-node-2 ansible_host=${KUBE_NODE_2_IP}
kube-node-3 ansible_host=${KUBE_NODE_3_IP}

[all:vars]
ansible_user=${ANSIBLE_USER}
ansible_python_interpreter=${ANSIBLE_PYTHON_INTERPRETER}
EOF
    echo "Inventory file created."
}

# Function to create Ansible playbook file
create_playbook() {
    echo "Creating Ansible playbook file: ${PLAYBOOK_FILE}"
    mkdir -p "$ANSIBLE_DIR"
    cat <<'EOF' > "$PLAYBOOK_FILE"
---
- name: Update DNS server on Kubernetes nodes to use local DNS only
  hosts: kubernetes_nodes
  become: yes # This allows Ansible to run commands with sudo privileges

  tasks:
    - name: Ensure netplan configuration directory exists
      ansible.builtin.file:
        path: /etc/netplan
        state: directory
        mode: '0755'

    - name: Get current network configuration file (e.g., 00-installer-config.yaml)
      ansible.builtin.find:
        paths: /etc/netplan
        patterns: '*.yaml'
        # We assume there's only one primary netplan config file for simplicity.
        # If there are multiple, you might need to specify which one.
      register: netplan_files

    - name: Set network config file variable
      ansible.builtin.set_fact:
        netplan_config_file: "{{ netplan_files.files[0].path }}"
      when: netplan_files.files | length > 0

    - name: Fail if no netplan config file found
      ansible.builtin.fail:
        msg: "No Netplan configuration file found in /etc/netplan. Cannot proceed."
      when: netplan_files.files | length == 0

    - name: Read current netplan configuration
      ansible.builtin.slurp:
        src: "{{ netplan_config_file }}"
      register: current_netplan_config

    - name: Parse current netplan configuration
      ansible.builtin.set_fact:
        parsed_netplan: "{{ current_netplan_config['content'] | b64decode | from_yaml }}"

    - name: Update nameservers in netplan configuration to local DNS only
      ansible.builtin.set_fact:
        updated_netplan: "{{ parsed_netplan | combine(
            {
              'network': {
                'ethernets': {
                  'enp1s0': {
                    'nameservers': {
                      'addresses': ['10.75.59.76'],
                      'search': ['cisco.com']
                    }
                  }
                }
              }
            }, recursive=True) }}"

    - name: Write updated netplan configuration
      ansible.builtin.copy:
        content: "{{ updated_netplan | to_yaml }}"
        dest: "{{ netplan_config_file }}"
        mode: '0600'
      notify: Apply Netplan Configuration

  handlers:
    - name: Apply Netplan Configuration
      ansible.builtin.command: netplan apply
      listen: "Apply Netplan Configuration"
EOF
    echo "Playbook file created."
}

# --- Main Script Execution ---

echo "Starting Ansible DNS update process..."

# 1. Install Ansible if not present
install_ansible

# 2. Create Ansible inventory file
create_inventory

# 3. Create Ansible playbook file
create_playbook

# 4. Run the Ansible playbook
echo "Running Ansible playbook to update DNS on Kubernetes nodes..."
echo "You will be prompted for the 'sudo' password for the 'ubuntu' user on your VMs."
ansible-playbook -i "$INVENTORY_FILE" "$PLAYBOOK_FILE" --ask-become-pass

if [ $? -eq 0 ]; then
    echo "Ansible playbook executed successfully."
    echo "Your Kubernetes nodes should now be configured to use 10.75.59.76 as their only DNS server."
else
    echo "Ansible playbook failed. Please check the output for errors."
fi

echo "Process complete."
```

```bash
ois@ois:~/data/k8s$ ./updatedns.sh 
Starting Ansible DNS update process...
Ansible is already installed.
Creating Ansible inventory file: ansible_dns_update/hosts.ini
Inventory file created.
Creating Ansible playbook file: ansible_dns_update/update_dns.yml
Playbook file created.
Running Ansible playbook to update DNS on Kubernetes nodes...
You will be prompted for the 'sudo' password for the 'ubuntu' user on your VMs.
BECOME password: 

PLAY [Update DNS server on Kubernetes nodes to use local DNS only] *********************************************************************************************************************************************************************************************

TASK [Gathering Facts] *****************************************************************************************************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-2]
ok: [kube-node-3]

TASK [Ensure netplan configuration directory exists] ***********************************************************************************************************************************************************************************************************
ok: [kube-node-3]
ok: [kube-node-2]
ok: [kube-node-1]

TASK [Get current network configuration file (e.g., 00-installer-config.yaml)] *********************************************************************************************************************************************************************************
ok: [kube-node-3]
ok: [kube-node-1]
ok: [kube-node-2]

TASK [Set network config file variable] ************************************************************************************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-2]
ok: [kube-node-3]

TASK [Fail if no netplan config file found] ********************************************************************************************************************************************************************************************************************
skipping: [kube-node-1]
skipping: [kube-node-2]
skipping: [kube-node-3]

TASK [Read current netplan configuration] **********************************************************************************************************************************************************************************************************************
ok: [kube-node-3]
ok: [kube-node-1]
ok: [kube-node-2]

TASK [Parse current netplan configuration] *********************************************************************************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-2]
ok: [kube-node-3]

TASK [Update nameservers in netplan configuration to local DNS only] *******************************************************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-2]
ok: [kube-node-3]

TASK [Write updated netplan configuration] *********************************************************************************************************************************************************************************************************************
ok: [kube-node-3]
ok: [kube-node-1]
ok: [kube-node-2]

PLAY RECAP *****************************************************************************************************************************************************************************************************************************************************
kube-node-1                : ok=8    changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   
kube-node-2                : ok=8    changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   
kube-node-3                : ok=8    changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   

Ansible playbook executed successfully.
Your Kubernetes nodes should now be configured to use 10.75.59.76 as their only DNS server.
Process complete.

root@kube-node-1:~# cat /etc/resolv.conf 
# This is /run/systemd/resolve/stub-resolv.conf managed by man:systemd-resolved(8).
# Do not edit.
#
# This file might be symlinked as /etc/resolv.conf. If you're looking at
# /etc/resolv.conf and seeing this text, you have followed the symlink.
#
# This is a dynamic resolv.conf file for connecting local clients to the
# internal DNS stub resolver of systemd-resolved. This file lists all
# configured search domains.
#
# Run "resolvectl status" to see details about the uplink DNS servers
# currently in use.
#
# Third party programs should typically not access this file directly, but only
# through the symlink at /etc/resolv.conf. To manage man:resolv.conf(5) in a
# different way, replace this symlink by a static file or a different symlink.
#
# See man:systemd-resolved.service(8) for details about the supported modes of
# operation for /etc/resolv.conf.

nameserver 127.0.0.53
options edns0 trust-ad
search cisco.com
root@kube-node-1:~# cat /etc/netplan/50-cloud-init.yaml 
network:
  ethernets:
    enp1s0:
      addresses: [10.75.59.71/24]
      nameservers:
        addresses: [10.75.59.76]
        search: [cisco.com]
      routes:
      - {to: default, via: 10.75.59.1}
  version: 2
```

## 3.4 使用Ansible配置FRR BGP

```bash
#!/bin/bash

# This script automates the setup of an Ansible environment for installing and configuring FRRouting (FRR).
# It creates the project directory, inventory, configuration, and the playbook
# with an idempotent role to install and configure FRR.

# --- Configuration ---
PROJECT_DIR="ansible-frr-setup" # Changed project directory name
FRR_NODE_IP="10.75.59.76" # IP address of your FRR VM (frr-server-vm)
ANSIBLE_USER="ubuntu" # The user created by cloud-init on your VMs
SSH_PRIVATE_KEY_PATH="~/.ssh/id_rsa" # Path to your SSH private key on the Ansible control machine

# FRR specific configuration
FRR_AS=65000 # The Autonomous System number for this FRR node (example AS, choose your own)
K8S_MASTER_IP="10.75.59.71" # From your create-vms.sh script
K8S_WORKER_1_IP="10.75.59.72" # From your create-vms.sh script
K8S_WORKER_2_IP="10.75.59.73" # From your create-vms.sh script
CILIUM_BGP_AS=65000 # AS for Cilium as per your CiliumBGPClusterConfig

# --- Functions ---

# Function to install Ansible (if not already installed)
install_ansible() {
    echo "--- Installing Ansible ---"
    if ! command -v ansible &> /dev/null; then
        sudo apt update -y
        sudo apt install -y ansible
        echo "Ansible installed successfully."
    else
        echo "Ansible is already installed."
    fi
}

# Function to create project directory and navigate into it
create_project_dir() {
    echo "--- Creating project directory: ${PROJECT_DIR} ---"
    # Check if directory exists, if so, just navigate, otherwise create and navigate
    if [ ! -d "${PROJECT_DIR}" ]; then
        mkdir -p "${PROJECT_DIR}"
        echo "Created new directory: ${PROJECT_DIR}"
    else
        echo "Directory ${PROJECT_DIR} already exists."
    fi
    cd "${PROJECT_DIR}" || { echo "Failed to change directory to ${PROJECT_DIR}. Exiting."; exit 1; }
    echo "Changed to directory: $(pwd)"
}

# Function to create ansible.cfg
create_ansible_cfg() {
    echo "--- Creating ansible.cfg ---"
    cat <<EOF > ansible.cfg
[defaults]
inventory = inventory.ini
roles_path = ./roles
host_key_checking = False # WARNING: Disable host key checking for convenience. Re-enable for production!
EOF
    echo "ansible.cfg created."
}

# Function to create inventory.ini
create_inventory() {
    echo "--- Creating inventory.ini ---"
    cat <<EOF > inventory.ini
[frr_nodes]
frr-node-1 ansible_host=${FRR_NODE_IP}

[all:vars]
ansible_user=${ANSIBLE_USER}
ansible_ssh_private_key_file=${SSH_PRIVATE_KEY_PATH}
ansible_python_interpreter=/usr/bin/python3
FRR_AS=${FRR_AS}
K8S_MASTER_IP=${K8S_MASTER_IP}
K8S_WORKER_1_IP=${K8S_WORKER_1_IP}
K8S_WORKER_2_IP=${K8S_WORKER_2_IP}
CILIUM_BGP_AS=${CILIUM_BGP_AS}
EOF
    echo "inventory.ini created."
}

# Function to create the main playbook.yml
create_playbook() {
    echo "--- Creating playbook.yml ---"
    cat <<EOF > playbook.yml
---
- name: Install and Configure FRRouting (FRR)
  hosts: frr_nodes
  become: yes
  roles:
    - frr_setup # Changed role name to frr_setup
EOF
    echo "playbook.yml created."
}

# Function to create the FRR installation and configuration role
create_frr_role() { # Changed function name from create_gobgp_role
    echo "--- Creating Ansible role for FRR setup ---"
    mkdir -p roles/frr_setup/tasks
    cat <<EOF > roles/frr_setup/tasks/main.yml
---
- name: Install FRRouting (FRR)
  ansible.builtin.apt:
    name: frr
    state: present
    update_cache: yes

- name: Configure FRR daemons (enable zebra and bgpd)
  ansible.builtin.lineinfile:
    path: /etc/frr/daemons
    regexp: '^(zebra|bgpd)='
    line: '\1=yes'
    state: present
    backrefs: yes # Required to make regexp work for replacement
  notify: Restart FRR service

- name: Configure frr.conf
  ansible.builtin.copy:
    dest: /etc/frr/frr.conf
    content: |
      !
      hostname {{ ansible_hostname }}
      password zebra
      enable password zebra
      !
      log syslog informational
      !
      router bgp {{ FRR_AS }}
       bgp router-id {{ ansible_host }}
       !
       neighbor {{ K8S_MASTER_IP }} remote-as {{ CILIUM_BGP_AS }}
       neighbor {{ K8S_WORKER_1_IP }} remote-as {{ CILIUM_BGP_AS }}
       neighbor {{ K8S_WORKER_2_IP }} remote-as {{ CILIUM_BGP_AS }}
       !
       address-family ipv4 unicast
        # Crucial: Redistribute BGP learned routes into the kernel
        redistribute connected
        redistribute static
        redistribute kernel
       exit-address-family
      !
      line vty
      !
    mode: '0644'
  notify: Restart FRR service # Handler only runs if file content changes

- name: Set permissions for frr.conf
  ansible.builtin.file:
    path: /etc/frr/frr.conf
    owner: frr
    group: frr
    mode: '0640'

- name: Enable and start FRR service
  ansible.builtin.systemd:
    name: frr
    state: started
    enabled: yes
    daemon_reload: yes # Ensure systemd reloads unit files if service file changed

EOF

    mkdir -p roles/frr_setup/handlers
    cat <<EOF > roles/frr_setup/handlers/main.yml
---
- name: Restart FRR service
  ansible.builtin.systemd:
    name: frr
    state: restarted
EOF
    echo "FRR Ansible role created."
}

# --- Main execution ---
install_ansible
create_project_dir
create_ansible_cfg
create_inventory
create_playbook
create_frr_role # Changed function call

echo ""
echo "--- Ansible setup for FRR installation is complete! ---"
echo "Navigate to the new project directory:"
echo "cd ${PROJECT_DIR}"
echo ""
echo "Then, run the Ansible playbook to install and configure FRR on your VM:"
echo "ansible-playbook playbook.yml -K"
echo ""
echo "After the playbook finishes, FRR should be running and configured on ${FRR_NODE_IP}."
echo "You can SSH into the VM and verify with 'sudo vtysh -c \"show ip bgp summary\"' and 'sudo ip route show'."

ois@ois:~/data/k8s$ ./ansible-frr.sh 
--- Installing Ansible ---
Ansible is already installed.
--- Creating project directory: ansible-frr-setup ---
Created new directory: ansible-frr-setup
Changed to directory: /home/ois/data/k8s/ansible-frr-setup
--- Creating ansible.cfg ---
ansible.cfg created.
--- Creating inventory.ini ---
inventory.ini created.
--- Creating playbook.yml ---
playbook.yml created.
--- Creating Ansible role for FRR setup ---
FRR Ansible role created.

--- Ansible setup for FRR installation is complete! ---
Navigate to the new project directory:
cd ansible-frr-setup

Then, run the Ansible playbook to install and configure FRR on your VM:
ansible-playbook playbook.yml -K

After the playbook finishes, FRR should be running and configured on 10.75.59.76.
You can SSH into the VM and verify with 'sudo vtysh -c "show ip bgp summary"' and 'sudo ip route show'.
ois@ois:~/data/k8s$ cd ansible-frr-setup/
ois@ois:~/data/k8s/ansible-frr-setup$ ansible-playbook playbook.yml -K
BECOME password: 

PLAY [Install and Configure FRRouting (FRR)] *******************************************************************************************************************************************************************************************************************

TASK [Gathering Facts] *****************************************************************************************************************************************************************************************************************************************
ok: [frr-node-1]

TASK [frr_setup : Install FRRouting (FRR)] *********************************************************************************************************************************************************************************************************************
changed: [frr-node-1]

TASK [frr_setup : Configure FRR daemons (enable zebra and bgpd)] ***********************************************************************************************************************************************************************************************
changed: [frr-node-1]

TASK [frr_setup : Configure frr.conf] **************************************************************************************************************************************************************************************************************************
changed: [frr-node-1]

TASK [frr_setup : Set permissions for frr.conf] ****************************************************************************************************************************************************************************************************************
changed: [frr-node-1]

TASK [frr_setup : Enable and start FRR service] ****************************************************************************************************************************************************************************************************************
ok: [frr-node-1]

RUNNING HANDLER [frr_setup : Restart FRR service] **************************************************************************************************************************************************************************************************************
changed: [frr-node-1]

PLAY RECAP *****************************************************************************************************************************************************************************************************************************************************
frr-node-1                 : ok=7    changed=5    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   

```

```bash
root@dns-server-vm:~# cat /etc/frr/frr.conf 
!
hostname dns-server-vm
password zebra
enable password zebra
!
log syslog informational
!
router bgp 65000
 bgp router-id 10.75.59.76
 !
 neighbor 10.75.59.71 remote-as 65000
 neighbor 10.75.59.72 remote-as 65000
 neighbor 10.75.59.73 remote-as 65000
 !
 address-family ipv4 unicast
  # Crucial: Redistribute BGP learned routes into the kernel
  redistribute connected
  redistribute static
  redistribute kernel
 exit-address-family
!
line vty
!
root@dns-server-vm:~# systemctl status frr
* frr.service - FRRouting
     Loaded: loaded (/usr/lib/systemd/system/frr.service; enabled; preset: enabled)
     Active: active (running) since Wed 2025-07-23 12:16:58 JST; 1 week 1 day ago
       Docs: https://frrouting.readthedocs.io/en/latest/setup.html
    Process: 15611 ExecStart=/usr/lib/frr/frrinit.sh start (code=exited, status=0/SUCCESS)
   Main PID: 15623 (watchfrr)
     Status: "FRR Operational"
      Tasks: 13 (limit: 9486)
     Memory: 21.1M (peak: 28.3M)
        CPU: 5min 23.845s
     CGroup: /system.slice/frr.service
             |-15623 /usr/lib/frr/watchfrr -d -F traditional zebra bgpd staticd
             |-15636 /usr/lib/frr/zebra -d -F traditional -A 127.0.0.1 -s 90000000
             |-15641 /usr/lib/frr/bgpd -d -F traditional -A 127.0.0.1
             `-15648 /usr/lib/frr/staticd -d -F traditional -A 127.0.0.1

Jul 31 16:26:25 dns-server-vm bgpd[15641]: [M59KS-A3ZXZ] bgp_update_receive: rcvd End-of-RIB for IPv4 Unicast from 10.75.59.71 in vrf default
Jul 31 16:27:24 dns-server-vm bgpd[15641]: [M59KS-A3ZXZ] bgp_update_receive: rcvd End-of-RIB for IPv4 Unicast from 10.75.59.73 in vrf default
Jul 31 16:27:24 dns-server-vm bgpd[15641]: [M59KS-A3ZXZ] bgp_update_receive: rcvd End-of-RIB for IPv4 Unicast from 10.75.59.72 in vrf default
Jul 31 16:27:24 dns-server-vm bgpd[15641]: [M59KS-A3ZXZ] bgp_update_receive: rcvd End-of-RIB for IPv4 Unicast from 10.75.59.71 in vrf default
Jul 31 16:46:48 dns-server-vm bgpd[15641]: [M59KS-A3ZXZ] bgp_update_receive: rcvd End-of-RIB for IPv4 Unicast from 10.75.59.72 in vrf default
Jul 31 16:46:48 dns-server-vm bgpd[15641]: [M59KS-A3ZXZ] bgp_update_receive: rcvd End-of-RIB for IPv4 Unicast from 10.75.59.73 in vrf default
Jul 31 16:46:48 dns-server-vm bgpd[15641]: [M59KS-A3ZXZ] bgp_update_receive: rcvd End-of-RIB for IPv4 Unicast from 10.75.59.71 in vrf default
Jul 31 16:47:54 dns-server-vm bgpd[15641]: [M59KS-A3ZXZ] bgp_update_receive: rcvd End-of-RIB for IPv4 Unicast from 10.75.59.73 in vrf default
Jul 31 16:47:54 dns-server-vm bgpd[15641]: [M59KS-A3ZXZ] bgp_update_receive: rcvd End-of-RIB for IPv4 Unicast from 10.75.59.72 in vrf default
Jul 31 16:47:54 dns-server-vm bgpd[15641]: [M59KS-A3ZXZ] bgp_update_receive: rcvd End-of-RIB for IPv4 Unicast from 10.75.59.71 in vrf default
root@dns-server-vm:~# ip route show
default via 10.75.59.1 dev enp1s0 proto static 
10.75.59.0/24 dev enp1s0 proto kernel scope link src 10.75.59.76 
172.16.0.0/24 nhid 95 via 10.75.59.71 dev enp1s0 proto bgp metric 20 
172.16.1.0/24 nhid 90 via 10.75.59.72 dev enp1s0 proto bgp metric 20 
172.16.2.0/24 nhid 100 via 10.75.59.73 dev enp1s0 proto bgp metric 20 
172.16.16.1 nhid 202 proto bgp metric 20 
        nexthop via 10.75.59.72 dev enp1s0 weight 1 
        nexthop via 10.75.59.71 dev enp1s0 weight 1 
        nexthop via 10.75.59.73 dev enp1s0 weight 1 
172.16.16.10 nhid 202 proto bgp metric 20 
        nexthop via 10.75.59.72 dev enp1s0 weight 1 
        nexthop via 10.75.59.71 dev enp1s0 weight 1 
        nexthop via 10.75.59.73 dev enp1s0 weight 1 
172.16.20.119 nhid 202 proto bgp metric 20 
        nexthop via 10.75.59.72 dev enp1s0 weight 1 
        nexthop via 10.75.59.71 dev enp1s0 weight 1 
        nexthop via 10.75.59.73 dev enp1s0 weight 1 
172.16.22.26 nhid 202 proto bgp metric 20 
        nexthop via 10.75.59.72 dev enp1s0 weight 1 
        nexthop via 10.75.59.71 dev enp1s0 weight 1 
        nexthop via 10.75.59.73 dev enp1s0 weight 1 
172.16.23.18 nhid 202 proto bgp metric 20 
        nexthop via 10.75.59.72 dev enp1s0 weight 1 
        nexthop via 10.75.59.71 dev enp1s0 weight 1 
        nexthop via 10.75.59.73 dev enp1s0 weight 1 
172.16.30.170 nhid 202 proto bgp metric 20 
        nexthop via 10.75.59.72 dev enp1s0 weight 1 
        nexthop via 10.75.59.71 dev enp1s0 weight 1 
        nexthop via 10.75.59.73 dev enp1s0 weight 1 
root@dns-server-vm:~# vtysh -c 'show ip bgp summary'

IPv4 Unicast Summary (VRF default):
BGP router identifier 10.75.59.76, local AS number 65000 vrf-id 0
BGP table version 222
RIB entries 19, using 3648 bytes of memory
Peers 3, using 2172 KiB of memory

Neighbor        V         AS   MsgRcvd   MsgSent   TblVer  InQ OutQ  Up/Down State/PfxRcd   PfxSnt Desc
10.75.59.71     4      65000     71265     71182        0    0    0 03:21:08            7        2 N/A
10.75.59.72     4      65000     71344     71264        0    0    0 03:21:09            7        2 N/A
10.75.59.73     4      65000     71240     71162        0    0    0 03:21:09            7        2 N/A

Total number of neighbors 3
```

# 4. 设置Kubernetes集群并安装CNI Cilium

## 4.1 使用kubeadm设置Kubernetes

使用以下命令进行集群初始化

```bash
kubeadm config images pull

kubeadm init --control-plane-endpoint=kube-node-1 --pod-network-cidr=172.16.0.0/20 --service-cidr=172.16.32.0/20 --skip-phases=addon/kube-proxy

--skip-phases=addon/kube-proxy 表示不安装kube-proxy，会用Cilium进行替代
```

```bash
ubuntu@kube-node-1:~$ sudo kubeadm init --control-plane-endpoint=kube-node-1 --pod-network-cidr=172.16.0.0/20 --service-cidr=172.16.32.0/20 --skip-phases=addon/kube-proxy[sudo] password for ubuntu: 
[init] Using Kubernetes version: v1.33.3
[preflight] Running pre-flight checks
[preflight] Pulling images required for setting up a Kubernetes cluster
[preflight] This might take a minute or two, depending on the speed of your internet connection
[preflight] You can also perform this action beforehand using 'kubeadm config images pull'
[certs] Using certificateDir folder "/etc/kubernetes/pki"
[certs] Generating "ca" certificate and key
[certs] Generating "apiserver" certificate and key
[certs] apiserver serving cert is signed for DNS names [kube-node-1 kubernetes kubernetes.default kubernetes.default.svc kubernetes.default.svc.cluster.local] and IPs [10.248.0.1 10.75.59.71]
[certs] Generating "apiserver-kubelet-client" certificate and key
[certs] Generating "front-proxy-ca" certificate and key
[certs] Generating "front-proxy-client" certificate and key
[certs] Generating "etcd/ca" certificate and key
[certs] Generating "etcd/server" certificate and key
[certs] etcd/server serving cert is signed for DNS names [kube-node-1 localhost] and IPs [10.75.59.71 127.0.0.1 ::1]
[certs] Generating "etcd/peer" certificate and key
[certs] etcd/peer serving cert is signed for DNS names [kube-node-1 localhost] and IPs [10.75.59.71 127.0.0.1 ::1]
[certs] Generating "etcd/healthcheck-client" certificate and key
[certs] Generating "apiserver-etcd-client" certificate and key
[certs] Generating "sa" key and public key
[kubeconfig] Using kubeconfig folder "/etc/kubernetes"
[kubeconfig] Writing "admin.conf" kubeconfig file
[kubeconfig] Writing "super-admin.conf" kubeconfig file
[kubeconfig] Writing "kubelet.conf" kubeconfig file
[kubeconfig] Writing "controller-manager.conf" kubeconfig file
[kubeconfig] Writing "scheduler.conf" kubeconfig file
[etcd] Creating static Pod manifest for local etcd in "/etc/kubernetes/manifests"
[control-plane] Using manifest folder "/etc/kubernetes/manifests"
[control-plane] Creating static Pod manifest for "kube-apiserver"
[control-plane] Creating static Pod manifest for "kube-controller-manager"
[control-plane] Creating static Pod manifest for "kube-scheduler"
[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"
[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"
[kubelet-start] Starting the kubelet
[wait-control-plane] Waiting for the kubelet to boot up the control plane as static Pods from directory "/etc/kubernetes/manifests"
[kubelet-check] Waiting for a healthy kubelet at http://127.0.0.1:10248/healthz. This can take up to 4m0s
[kubelet-check] The kubelet is healthy after 1.002649961s
[control-plane-check] Waiting for healthy control plane components. This can take up to 4m0s
[control-plane-check] Checking kube-apiserver at https://10.75.59.71:6443/livez
[control-plane-check] Checking kube-controller-manager at https://127.0.0.1:10257/healthz
[control-plane-check] Checking kube-scheduler at https://127.0.0.1:10259/livez
[control-plane-check] kube-controller-manager is healthy after 1.813351787s
[control-plane-check] kube-scheduler is healthy after 3.309147352s
[control-plane-check] kube-apiserver is healthy after 5.505049123s
[upload-config] Storing the configuration used in ConfigMap "kubeadm-config" in the "kube-system" Namespace
[kubelet] Creating a ConfigMap "kubelet-config" in namespace kube-system with the configuration for the kubelets in the cluster
[upload-certs] Skipping phase. Please see --upload-certs
[mark-control-plane] Marking the node kube-node-1 as control-plane by adding the labels: [node-role.kubernetes.io/control-plane node.kubernetes.io/exclude-from-external-load-balancers]
[mark-control-plane] Marking the node kube-node-1 as control-plane by adding the taints [node-role.kubernetes.io/control-plane:NoSchedule]
[bootstrap-token] Using token: 1r5ugd.o2pjzipcq69z71l8
[bootstrap-token] Configuring bootstrap tokens, cluster-info ConfigMap, RBAC Roles
[bootstrap-token] Configured RBAC rules to allow Node Bootstrap tokens to get nodes
[bootstrap-token] Configured RBAC rules to allow Node Bootstrap tokens to post CSRs in order for nodes to get long term certificate credentials
[bootstrap-token] Configured RBAC rules to allow the csrapprover controller automatically approve CSRs from a Node Bootstrap Token
[bootstrap-token] Configured RBAC rules to allow certificate rotation for all node client certificates in the cluster
[bootstrap-token] Creating the "cluster-info" ConfigMap in the "kube-public" namespace
[kubelet-finalize] Updating "/etc/kubernetes/kubelet.conf" to point to a rotatable kubelet client certificate and key
[addons] Applied essential addon: CoreDNS

Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

Alternatively, if you are the root user, you can run:

  export KUBECONFIG=/etc/kubernetes/admin.conf

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/

You can now join any number of control-plane nodes by copying certificate authorities
and service account keys on each node and then running the following as root:

  kubeadm join kube-node-1:6443 --token 1r5ugd.o2pjzipcq69z71l8 \
        --discovery-token-ca-cert-hash sha256:e29fb62581a4d21268585c3b345f9e060827c52a8325b1d28b8437c792ba7923 \
        --control-plane 

Then you can join any number of worker nodes by running the following on each as root:

kubeadm join kube-node-1:6443 --token 1r5ugd.o2pjzipcq69z71l8 \
        --discovery-token-ca-cert-hash sha256:e29fb62581a4d21268585c3b345f9e060827c52a8325b1d28b8437c792ba7923 
ubuntu@kube-node-1:~$ 
ubuntu@kube-node-1:~$   mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config
ubuntu@kube-node-1:~$ sudo su
root@kube-node-1:/home/ubuntu# cd

在.bashrc 中增加以下内容
root@kube-node-1:~# cat .bashrc | grep export
export KUBECONFIG=/etc/kubernetes/admin.conf

这样root才能执行 kubectl 命令与 api-server通信.

root@kube-node-1:~# kubectl cluster-info
Kubernetes control plane is running at https://kube-node-1:6443
CoreDNS is running at https://kube-node-1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy

To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.
root@kube-node-1:~# kubectl get node -o wide
NAME          STATUS     ROLES           AGE   VERSION   INTERNAL-IP   EXTERNAL-IP   OS-IMAGE             KERNEL-VERSION     CONTAINER-RUNTIME
kube-node-1   NotReady   control-plane   68s   v1.33.3   10.75.59.71   <none>        Ubuntu 24.04.2 LTS   6.8.0-63-generic   containerd://1.7.27

还没有安装CNI，Node NotReady

```

## 4.2 使用Ansible安装Helm

设置Helm的目的是为了安装Cilium，并非一定要使用Ansible来进行设置，供参考。

```bash
#!/bin/bash

# This script automates the setup of an Ansible environment for installing Helm.
# It creates the project directory, inventory, configuration, and the playbook
# with an idempotent role to install Helm.

# --- Configuration ---
PROJECT_DIR="ansible-helm"
MASTER_NODE_IP="10.75.59.71" # IP address of your Kubernetes master node (kube-node-1)
ANSIBLE_USER="ubuntu" # The user created by cloud-init on your VMs
SSH_PRIVATE_KEY_PATH="~/.ssh/id_rsa" # Path to your SSH private key on the Ansible control machine

# Helm version to install
HELM_VERSION="v3.18.4" # You can change this to a desired stable version

# --- Functions ---

# Function to create project directory and navigate into it
create_project_dir() {
    echo "--- Creating project directory: ${PROJECT_DIR} ---"
    # Check if directory exists, if so, just navigate, otherwise create and navigate
    if [ ! -d "${PROJECT_DIR}" ]; then
        mkdir -p "${PROJECT_DIR}"
        echo "Created new directory: ${PROJECT_DIR}"
    else
        echo "Directory ${PROJECT_DIR} already exists."
    fi
    cd "${PROJECT_DIR}" || { echo "Failed to change directory to ${PROJECT_DIR}. Exiting."; exit 1; }
    echo "Changed to directory: $(pwd)"
}

# Function to create ansible.cfg
create_ansible_cfg() {
    echo "--- Creating ansible.cfg ---"
    cat <<EOF > ansible.cfg
[defaults]
inventory = inventory.ini
roles_path = ./roles
host_key_checking = False # WARNING: Disable host key checking for convenience. Re-enable for production!
EOF
    echo "ansible.cfg created."
}

# Function to create inventory.ini
create_inventory() {
    echo "--- Creating inventory.ini ---"
    cat <<EOF > inventory.ini
[kubernetes_master]
kube-node-1 ansible_host=${MASTER_NODE_IP}

[all:vars]
ansible_user=${ANSIBLE_USER}
ansible_ssh_private_key_file=${SSH_PRIVATE_KEY_PATH}
ansible_python_interpreter=/usr/bin/python3
HELM_VERSION=${HELM_VERSION}
EOF
    echo "inventory.ini created."
}

# Function to create the main playbook.yml
create_playbook() {
    echo "--- Creating playbook.yml ---"
    cat <<EOF > playbook.yml
---
- name: Install Helm on Kubernetes Master Node
  hosts: kubernetes_master
  become: yes
  environment: # Ensure KUBECONFIG is set for helm commands run with become
    KUBECONFIG: /etc/kubernetes/admin.conf # Use the admin kubeconfig on the master
  roles:
    - helm_install
EOF
    echo "playbook.yml created."
}

# Function to create the Helm installation role (with idempotent check)
create_helm_role() {
    echo "--- Creating Ansible role for Helm installation ---"
    mkdir -p roles/helm_install/tasks
    cat <<EOF > roles/helm_install/tasks/main.yml
---
- name: Check if Helm is installed and get version
  ansible.builtin.command: helm version --short
  register: helm_version_raw
  ignore_errors: yes
  changed_when: false

- name: Set installed Helm version fact
  ansible.builtin.set_fact:
    installed_helm_version: "{{ (helm_version_raw.stdout | default('') | regex_findall('^(v[0-9]+\\\\.[0-9]+\\\\.[0-9]+)') | first | default('') | trim) }}"
  changed_when: false

- name: Debug installed Helm version
  ansible.builtin.debug:
    msg: "Current installed Helm version: {{ installed_helm_version | default('Not installed') }}"

- name: Debug raw Helm version output
  ansible.builtin.debug:
    msg: "Raw Helm version output: {{ helm_version_raw.stdout | default('No output') }}"
  when: helm_version_raw.stdout is defined and helm_version_raw.stdout | length > 0

- name: Check if Helm binary exists
  ansible.builtin.stat:
    path: /usr/local/bin/helm
  register: helm_binary_stat
  when: installed_helm_version == HELM_VERSION

- name: Download Helm tarball
  ansible.builtin.get_url:
    url: "https://get.helm.sh/helm-{{ HELM_VERSION }}-linux-amd64.tar.gz"
    dest: "/tmp/helm-{{ HELM_VERSION }}-linux-amd64.tar.gz"
    mode: '0644'
    checksum: "sha256:{{ lookup('url', 'https://get.helm.sh/helm-{{ HELM_VERSION }}-linux-amd64.tar.gz.sha256sum', wantlist=True)[0].split(' ')[0] }}"
  register: download_helm_result
  until: download_helm_result is success
  retries: 5
  delay: 5
  when: installed_helm_version != HELM_VERSION or not helm_binary_stat.stat.exists

- name: Create Helm installation directory
  ansible.builtin.file:
    path: /usr/local/bin
    state: directory
    mode: '0755'
  when: installed_helm_version != HELM_VERSION or not helm_binary_stat.stat.exists

- name: Extract Helm binary
  ansible.builtin.unarchive:
    src: "/tmp/helm-{{ HELM_VERSION }}-linux-amd64.tar.gz"
    dest: "/tmp"
    remote_src: yes
    creates: "/tmp/linux-amd64/helm"
  when: installed_helm_version != HELM_VERSION or not helm_binary_stat.stat.exists

- name: Move Helm binary to /usr/local/bin
  ansible.builtin.copy:
    src: "/tmp/linux-amd64/helm"
    dest: "/usr/local/bin/helm"
    mode: '0755'
    remote_src: yes
    owner: root
    group: root
  when: installed_helm_version != HELM_VERSION or not helm_binary_stat.stat.exists

- name: Clean up Helm tarball and extracted directory
  ansible.builtin.file:
    path: "{{ item }}"
    state: absent
  loop:
    - "/tmp/helm-{{ HELM_VERSION }}-linux-amd64.tar.gz"
    - "/tmp/linux-amd64"
  when: installed_helm_version != HELM_VERSION or not helm_binary_stat.stat.exists

- name: Verify Helm installation
  ansible.builtin.command: helm version --client
  register: helm_version_output
  changed_when: false

- name: Display Helm version
  ansible.builtin.debug:
    msg: "{{ helm_version_output.stdout }}"
EOF
    echo "Helm installation role created."
}

# --- Main execution ---
create_project_dir
create_ansible_cfg
create_inventory
create_playbook
create_helm_role

echo ""
echo "--- Ansible setup for Helm installation is complete! ---"
echo "Navigate to the new project directory:"
echo "cd ${PROJECT_DIR}"
echo ""
echo "Then, run the Ansible playbook to install only Helm on your master node:"
echo "ansible-playbook playbook.yml -K"
echo ""
echo "After Helm is installed, you can SSH into your master node (kube-node-1) and manage Cilium Enterprise installation directly using Helm."
echo "Remember to use the correct Cilium chart version and your custom values file."
echo "Example steps for manual Cilium installation via Helm:"
echo "ssh ubuntu@${MASTER_NODE_IP}"
echo "sudo helm repo add cilium https://helm.cilium.io/"
echo "sudo helm repo add isovalent https://helm.isovalent.com"
echo "sudo helm repo update"
echo "sudo helm install cilium isovalent/cilium --version 1.17.6 --namespace kube-system -f <path_to_your_cilium_values_file.yaml> --wait"
echo "Example content for /tmp/cilium-enterprise-values.yaml:"
echo "hubble:"
echo "  enabled: true"
echo "  relay:"
echo "    enabled: true"
echo "  ui:"
echo "    enabled: false"
echo "kubeProxyReplacement: strict"
echo "ipam:"
echo "  mode: kubernetes"
echo "ipv4NativeRoutingCIDR: 10.244.0.0/16"
echo "k8s:"
echo "  requireIPv4PodCIDR: true"
echo "routingMode: native"
echo "autoDirectNodeRoutes: false"
echo "bgpControlPlane:"
echo "  enabled: true"
```

执行效果如下：

```bash
ois@ois:~/data/k8s$ ./ansible-helm.sh 
--- Creating project directory: ansible-helm ---
Created new directory: ansible-helm
Changed to directory: /home/ois/data/k8s/ansible-helm
--- Creating ansible.cfg ---
ansible.cfg created.
--- Creating inventory.ini ---
inventory.ini created.
--- Creating playbook.yml ---
playbook.yml created.
--- Creating Ansible role for Helm installation ---
Helm installation role created.

--- Ansible setup for Helm installation is complete! ---
Navigate to the new project directory:
cd ansible-helm

Then, run the Ansible playbook to install only Helm on your master node:
ansible-playbook playbook.yml -K

After Helm is installed, you can SSH into your master node (kube-node-1) and manage Cilium Enterprise installation directly using Helm.
Remember to use the correct Cilium chart version and your custom values file.
Example steps for manual Cilium installation via Helm:
ssh ubuntu@10.75.59.71
sudo helm repo add cilium https://helm.cilium.io/
sudo helm repo add isovalent https://helm.isovalent.com
sudo helm repo update
sudo helm install cilium isovalent/cilium --version 1.17.6 --namespace kube-system -f <path_to_your_cilium_values_file.yaml> --wait
Example content for /tmp/cilium-enterprise-values.yaml:
hubble:
  enabled: true
  relay:
    enabled: true
  ui:
    enabled: false
kubeProxyReplacement: strict
ipam:
  mode: kubernetes
ipv4NativeRoutingCIDR: 172.16.0.0/20
k8s:
  requireIPv4PodCIDR: true
routingMode: native
autoDirectNodeRoutes: false
bgpControlPlane:
  enabled: true
ois@ois:~/data/k8s$ cd ansible-helm
ois@ois:~/data/k8s/ansible-helm$ ansible-playbook playbook.yml -K
BECOME password: 

PLAY [Install Helm on Kubernetes Master Node] ******************************************************************************************************************************************************************************************************************

TASK [Gathering Facts] *****************************************************************************************************************************************************************************************************************************************
ok: [kube-node-1]

TASK [helm_install : Check if Helm is installed and get version] ***********************************************************************************************************************************************************************************************
fatal: [kube-node-1]: FAILED! => {"changed": false, "cmd": "helm version --short", "msg": "[Errno 2] No such file or directory: b'helm'", "rc": 2, "stderr": "", "stderr_lines": [], "stdout": "", "stdout_lines": []}
...ignoring

TASK [helm_install : Set installed Helm version fact] **********************************************************************************************************************************************************************************************************
ok: [kube-node-1]

TASK [helm_install : Debug installed Helm version] *************************************************************************************************************************************************************************************************************
ok: [kube-node-1] => {
    "msg": "Current installed Helm version: "
}

TASK [helm_install : Debug raw Helm version output] ************************************************************************************************************************************************************************************************************
skipping: [kube-node-1]

TASK [helm_install : Check if Helm binary exists] **************************************************************************************************************************************************************************************************************
skipping: [kube-node-1]

TASK [helm_install : Download Helm tarball] ********************************************************************************************************************************************************************************************************************
changed: [kube-node-1]

TASK [helm_install : Create Helm installation directory] *******************************************************************************************************************************************************************************************************
ok: [kube-node-1]

TASK [helm_install : Extract Helm binary] **********************************************************************************************************************************************************************************************************************
changed: [kube-node-1]

TASK [helm_install : Move Helm binary to /usr/local/bin] *******************************************************************************************************************************************************************************************************
changed: [kube-node-1]

TASK [helm_install : Clean up Helm tarball and extracted directory] ********************************************************************************************************************************************************************************************
changed: [kube-node-1] => (item=/tmp/helm-v3.18.4-linux-amd64.tar.gz)
changed: [kube-node-1] => (item=/tmp/linux-amd64)

TASK [helm_install : Verify Helm installation] *****************************************************************************************************************************************************************************************************************
ok: [kube-node-1]

TASK [helm_install : Display Helm version] *********************************************************************************************************************************************************************************************************************
ok: [kube-node-1] => {
    "msg": "version.BuildInfo{Version:\"v3.18.4\", GitCommit:\"d80839cf37d860c8aa9a0503fe463278f26cd5e2\", GitTreeState:\"clean\", GoVersion:\"go1.24.4\"}"
}

PLAY RECAP *****************************************************************************************************************************************************************************************************************************************************
kube-node-1                : ok=11   changed=4    unreachable=0    failed=0    skipped=2    rescued=0    ignored=1   
```

## 4.3 使用Helm安装Cilium

```bash

root@kube-node-1:~# helm repo add cilium https://helm.cilium.io/
"cilium" has been added to your repositories
root@kube-node-1:~# helm repo add isovalent https://helm.isovalent.com
"isovalent" has been added to your repositories
root@kube-node-1:~# 

准备配置文件如下：

root@kube-node-1:~# cat > cilium-enterprise-values.yaml <<EOF
hubble:
  enabled: true
  relay:
    enabled: true
  ui:
    enabled: false

# Enable Gateway API
#gatewayAPI:
#  enabled: true

# Explicitly disable Egress Gateway
#egressGateway:
#  enabled: false

# BGP native-routing configuration
ipam:
  mode: kubernetes
ipv4NativeRoutingCIDR: 172.16.0.0/20 # Advertises all pod CIDRs; ensure BGP router supports this
k8s:
  requireIPv4PodCIDR: true
routingMode: native
autoDirectNodeRoutes: true
bgpControlPlane:
  enabled: true
  # Configure BGP peers (replace with your BGP router details)
  announce:
    podCIDR: true # Advertise pod CIDRs to BGP peers
enableIPv4Masquerade: true

# Enable kube-proxy replacement
kubeProxyReplacement: true

bpf:
  masquerade: true
  lb:
    externalClusterIP: true
    sock: true
EOF

root@kube-node-1:~# helm install cilium isovalent/cilium --version 1.17.6 \
    --namespace kube-system \
    --set kubeProxyReplacement=true \
    --set k8sServiceHost=10.75.59.71 \
    --set k8sServicePort=6443 \
    -f cilium-enterprise-values.yaml
NAME: cilium
LAST DEPLOYED: Fri Aug  1 09:54:27 2025
NAMESPACE: kube-system
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
You have successfully installed Cilium with Hubble Relay.

Your release version is 1.17.6.

For any further help, visit https://docs.isovalent.com/v1.17

上述命令中的参数k8sServiceHost=10.75.59.71 和 k8sServicePort=6443 是不能少的。
```

```bash
在其他Node上执行kubeadm join

ubuntu@kube-node-2:~$ sudo su
[sudo] password for ubuntu: 
root@kube-node-2:/home/ubuntu# cd
root@kube-node-2:~# kubeadm join kube-node-1:6443 --token wnc2sl.st6g6c4o0cd42bi4 \
        --discovery-token-ca-cert-hash sha256:381868d3e0faab6dbd3e240d8f40e0e81ab46cb54b2f15ffbfe0f587fac5d982 
[preflight] Running pre-flight checks
[preflight] Reading configuration from the "kubeadm-config" ConfigMap in namespace "kube-system"...
[preflight] Use 'kubeadm init phase upload-config --config your-config-file' to re-upload it.
W0801 09:56:27.830756   47851 configset.go:78] Warning: No kubeproxy.config.k8s.io/v1alpha1 config is loaded. Continuing without it: configmaps "kube-proxy" is forbidden: User "system:bootstrap:wnc2sl" cannot get resource "configmaps" in API group "" in the namespace "kube-system"
[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"
[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"
[kubelet-start] Starting the kubelet
[kubelet-check] Waiting for a healthy kubelet at http://127.0.0.1:10248/healthz. This can take up to 4m0s
[kubelet-check] The kubelet is healthy after 1.503396779s
[kubelet-start] Waiting for the kubelet to perform the TLS Bootstrap

This node has joined the cluster:
* Certificate signing request was sent to apiserver and a response was received.
* The Kubelet was informed of the new secure connection details.

Run 'kubectl get nodes' on the control-plane to see this node join the cluster.

```

等待一段时间，Cilium、Hubble Relay即可Ready

```bash
root@kube-node-1:~# kubectl get pods -n kube-system -o wide
NAME                                  READY   STATUS    RESTARTS   AGE     IP            NODE          NOMINATED NODE   READINESS GATES
cilium-2vrgj                          1/1     Running   0          3m58s   10.75.59.73   kube-node-3   <none>           <none>
cilium-65kvc                          1/1     Running   0          4m14s   10.75.59.72   kube-node-2   <none>           <none>
cilium-envoy-24sd7                    1/1     Running   0          4m14s   10.75.59.72   kube-node-2   <none>           <none>
cilium-envoy-7pr4g                    1/1     Running   0          6m12s   10.75.59.71   kube-node-1   <none>           <none>
cilium-envoy-k86tp                    1/1     Running   0          3m58s   10.75.59.73   kube-node-3   <none>           <none>
cilium-operator-867fb7f659-2vnld      1/1     Running   0          6m12s   10.75.59.72   kube-node-2   <none>           <none>
cilium-operator-867fb7f659-5998x      1/1     Running   0          6m12s   10.75.59.71   kube-node-1   <none>           <none>
cilium-x4pr7                          1/1     Running   0          6m12s   10.75.59.71   kube-node-1   <none>           <none>
coredns-674b8bbfcf-6t8np              1/1     Running   0          13m     172.16.1.40   kube-node-2   <none>           <none>
coredns-674b8bbfcf-bx8xd              1/1     Running   0          13m     172.16.1.64   kube-node-2   <none>           <none>
etcd-kube-node-1                      1/1     Running   1          13m     10.75.59.71   kube-node-1   <none>           <none>
hubble-relay-cfb755899-gch8w          1/1     Running   0          6m12s   172.16.1.81   kube-node-2   <none>           <none>
kube-apiserver-kube-node-1            1/1     Running   1          13m     10.75.59.71   kube-node-1   <none>           <none>
kube-controller-manager-kube-node-1   1/1     Running   1          13m     10.75.59.71   kube-node-1   <none>           <none>
kube-scheduler-kube-node-1            1/1     Running   1          13m     10.75.59.71   kube-node-1   <none>           <none>
```

## 4.4 安装企业版Cilium-cli

```bash
curl -L --remote-name-all https://github.com/isovalent/cilium-cli-releases/releases/latest/download/cilium-linux-amd64.tar.gz{,.sha256sum}

sha256sum --check cilium-linux-amd64.tar.gz.sha256sum

tar xzvfC cilium-linux-amd64.tar.gz /usr/local/bin

root@kube-node-1:~# cilium status
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
Containers:            cilium                   Running: 3
                       cilium-envoy             Running: 3
                       cilium-operator          Running: 2
                       clustermesh-apiserver    
                       hubble-relay             Running: 1
Cluster Pods:          3/3 managed by Cilium
Helm chart version:    1.17.6
Image versions         cilium             quay.io/isovalent/cilium:v1.17.6-cee.1@sha256:2d01daf4f25f7d644889b49ca856e1a4269981fc963e50bd3962665b41b6adb3: 3
                       cilium-envoy       quay.io/isovalent/cilium-envoy:v1.17.6-cee.1@sha256:318eff387835ca2717baab42a84f35a83a5f9e7d519253df87269f80b9ff0171: 3
                       cilium-operator    quay.io/isovalent/operator-generic:v1.17.6-cee.1@sha256:2e602710a7c4f101831df679e5d8251bae8bf0f9fe26c20bbef87f1966ea8265: 2
                       hubble-relay       quay.io/isovalent/hubble-relay:v1.17.6-cee.1@sha256:d378e3607f7492374e65e2bd854cc0ec87480c63ba49a96dadcd75a6946b586e: 1
root@kube-node-1:~# 
```

## 4.5 设置Cilium BGP

```bash
root@kube-node-1:~#cat > cilium-bgp.yaml << EOF
--- #bgp的对外宣告策略，宣告POD和serviceip
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPAdvertisement
metadata:
  name: bgp-advertisements
  labels:
    advertise: bgp
spec:
  advertisements:
    - advertisementType: "PodCIDR"              # Only for Kubernetes or ClusterPool IPAM cluster-pool
    - advertisementType: "Service"
      service:
        addresses:
          - ClusterIP
          - ExternalIP
          #- LoadBalancerIP
      selector:
        matchExpressions:
        - {key: somekey, operator: NotIn, values: ['never-used-value']}                  # 等同于宣告所有

--- #bgp邻居组的配置，类似template peer ,里面调用相关的advertisement策略
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPPeerConfig
metadata:
  name: cilium-peer
spec:
  timers:
    holdTimeSeconds: 30             #default 90s
    keepAliveTimeSeconds: 10  #default 30s
    connectRetryTimeSeconds: 40  #default 120s
  gracefulRestart:
    enabled: true
    restartTimeSeconds: 120        #default 120s
  #transport:
  #  peerPort: 179
  families:
    - afi: ipv4
      safi: unicast
      advertisements:
        matchLabels:
          advertise: "bgp"

--- #bgp的邻居配置
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPClusterConfig
metadata:
  name: cilium-bgp-default
spec:
  bgpInstances:
  - name: "instance-65000"
    localASN: 65000
    peers:
    - name: "GoBGP"
      peerASN: 65000
      peerAddress: 10.75.59.76
      peerConfigRef:
        name: "cilium-peer"
EOF
root@kube-node-1:~# 
root@kube-node-1:~# 
root@kube-node-1:~# kubectl apply -f cilium-bgp.yaml 
ciliumbgpadvertisement.cilium.io/bgp-advertisements created
ciliumbgppeerconfig.cilium.io/cilium-peer created
ciliumbgpclusterconfig.cilium.io/cilium-bgp-default created
root@kube-node-1:~# cilium bgp peers
Node          Local AS   Peer AS   Peer Address   Session State   Uptime   Family         Received   Advertised
kube-node-1   65000      65000     10.75.59.76    established     7s       ipv4/unicast   2          6    
kube-node-2   65000      65000     10.75.59.76    established     6s       ipv4/unicast   2          6    
kube-node-3   65000      65000     10.75.59.76    established     6s       ipv4/unicast   2          6    
root@kube-node-1:~# cilium bgp routes
(Defaulting to `available ipv4 unicast` routes, please see help for more options)

Node          VRouter   Prefix             NextHop   Age   Attrs
kube-node-1   65000     172.16.0.0/24      0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.1/32     0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.10/32    0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.37.239/32   0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.43.10/32    0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
kube-node-2   65000     172.16.1.0/24      0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.1/32     0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.10/32    0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.37.239/32   0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.43.10/32    0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
kube-node-3   65000     172.16.3.0/24      0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.1/32     0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.10/32    0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.37.239/32   0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.43.10/32    0.0.0.0   12s   [{Origin: i} {Nexthop: 0.0.0.0}]   
root@kube-node-1:~# 
```

## 4.6 安装Hubble UI

```bash
root@kube-node-1:~# helm search repo isovalent/hubble-ui -l
NAME                    CHART VERSION   APP VERSION     DESCRIPTION         
isovalent/hubble-ui     1.3.6           1.3.6           Hubble UI Enterprise
isovalent/hubble-ui     1.3.5           1.3.5           Hubble UI Enterprise

root@kube-node-1:~# cat > hubble-ui-values.yaml << EOF
relay:
  address: "hubble-relay.kube-system.svc.cluster.local"
EOF
root@kube-node-1:~#  
root@kube-node-1:~# helm install hubble-ui isovalent/hubble-ui --version 1.3.6 --namespace kube-system --values hubble-ui-values.yaml --wait
NAME: hubble-ui
LAST DEPLOYED: Fri Aug  1 10:47:58 2025
NAMESPACE: kube-system
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
You have successfully installed Hubble-Ui.
Your release version is 1.3.6.

For any further help, visit https://docs.isovalent.com
root@kube-node-1:~# kubectl patch service hubble-ui -n kube-system -p '{"spec": {"type": "NodePort"}}'
service/hubble-ui patched
root@kube-node-1:~# kubectl get svc -n kube-system -o wide                                                                  
NAME           TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)                  AGE   SELECTOR
cilium-envoy   ClusterIP   None            <none>        9964/TCP                 54m   k8s-app=cilium-envoy
hubble-peer    ClusterIP   172.16.43.10    <none>        443/TCP                  54m   k8s-app=cilium
hubble-relay   NodePort    172.16.37.239   <none>        80:31234/TCP             54m   k8s-app=hubble-relay
hubble-ui      NodePort    172.16.35.177   <none>        80:31225/TCP             64s   k8s-app=hubble-ui
kube-dns       ClusterIP   172.16.32.10    <none>        53/UDP,53/TCP,9153/TCP   61m   k8s-app=kube-dns
root@kube-node-1:~# kubectl -n kube-system exec ds/cilium -- cilium service list
Defaulted container "cilium-agent" out of: cilium-agent, config (init), mount-cgroup (init), apply-sysctl-overwrites (init), mount-bpf-fs (init), clean-cilium-state (init), install-cni-binaries (init)
ID   Frontend                Service Type   Backend                               
1    172.16.32.1:443/TCP     ClusterIP      1 => 10.75.59.71:6443/TCP (active)    
2    172.16.43.10:443/TCP    ClusterIP      1 => 10.75.59.71:4244/TCP (active)    
3    172.16.37.239:80/TCP    ClusterIP      1 => 172.16.1.81:4245/TCP (active)    
4    10.75.59.71:31234/TCP   NodePort       1 => 172.16.1.81:4245/TCP (active)    
5    0.0.0.0:31234/TCP       NodePort       1 => 172.16.1.81:4245/TCP (active)    
6    172.16.32.10:53/TCP     ClusterIP      1 => 172.16.1.64:53/TCP (active)      
                                            2 => 172.16.1.40:53/TCP (active)      
7    172.16.32.10:9153/TCP   ClusterIP      1 => 172.16.1.64:9153/TCP (active)    
                                            2 => 172.16.1.40:9153/TCP (active)    
8    172.16.32.10:53/UDP     ClusterIP      1 => 172.16.1.64:53/UDP (active)      
                                            2 => 172.16.1.40:53/UDP (active)      
9    172.16.35.177:80/TCP    ClusterIP      1 => 172.16.3.127:8081/TCP (active)   
10   10.75.59.71:31225/TCP   NodePort       1 => 172.16.3.127:8081/TCP (active)   
11   0.0.0.0:31225/TCP       NodePort       1 => 172.16.3.127:8081/TCP (active)  

浏览器可以通过http://10.75.59.71:31225/ 访问Hubble-ui

root@dns-server-vm:~# curl http://10.75.59.71:31225/
<!doctype html><html><head><meta charset="utf-8"/><title>Hubble UI Enterprise</title><meta http-equiv="X-UA-Compatible" content="IE=edge"/><meta name="viewport" content="width=device-width,user-scalable=0,initial-scale=1,minimum-scale=1,maximum-scale=1"/><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"/><link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"/><link rel="shortcut icon" href="/favicon.ico"/><link rel="stylesheet" href="/fonts/inter/stylesheet.css"/><link rel="stylesheet" href="/fonts/roboto-mono/stylesheet.css"/><script defer="defer" src="/bundle.app.77bec96f333a96efe6ea.js"></script><link href="/bundle.app.f1e6c0c33f1535bc8508.css" rel="stylesheet"><script type="text/template" id="hubble-ui/feature-flags">[10, 0, 18, 0, 26, 0, 34, 0, 42, 0, 50, 0]</script><script type="text/template" id="hubble-ui/authorization">[8, 1, 26, 4, 24, 1, 32, 1]</script></head><body><div id="test-process-tree-char" style="font-family: 'Roboto Mono', monospace;
        font-size: 16px;
        position: absolute;
        visibility: hidden;
        height: auto;
        width: auto;
        white-space: nowrap;">a</div><div id="app"></div></body></html>root@dns-server-vm:~# 
root@dns-server-vm:~# 
```

# 5. 部署Star Wars App

## 5.1 部署APP

Isovalent 提供了一个Demo APP，以下是部署脚本。

```bash
root@kube-node-1:~# kubectl create namespace star-wars
namespace/star-wars created
root@kube-node-1:~# kubectl apply -n star-wars -f https://raw.githubusercontent.com/cilium/cilium/HEAD/examples/minikube/http-sw-app.yaml
service/deathstar created
deployment.apps/deathstar created
pod/tiefighter created
pod/xwing created
root@kube-node-1:~# kubectl -n star-wars get pod -o wide --show-labels
NAME                         READY   STATUS    RESTARTS   AGE   IP             NODE          NOMINATED NODE   READINESS GATES   LABELS
deathstar-86f85ffb4d-4ldsj   1/1     Running   0          39s   172.16.1.231   kube-node-2   <none>           <none>            app.kubernetes.io/name=deathstar,class=deathstar,org=empire,pod-template-hash=86f85ffb4d
deathstar-86f85ffb4d-dbzft   1/1     Running   0          39s   172.16.3.161   kube-node-3   <none>           <none>            app.kubernetes.io/name=deathstar,class=deathstar,org=empire,pod-template-hash=86f85ffb4d
tiefighter                   1/1     Running   0          39s   172.16.3.247   kube-node-3   <none>           <none>            app.kubernetes.io/name=tiefighter,class=tiefighter,org=empire
xwing                        1/1     Running   0          39s   172.16.3.155   kube-node-3   <none>           <none>            app.kubernetes.io/name=xwing,class=xwing,org=alliance
root@kube-node-1:~# kubectl -n star-wars get service -o wide
NAME        TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE   SELECTOR
deathstar   ClusterIP   172.16.39.138   <none>        80/TCP    82s   class=deathstar,org=empire
root@kube-node-1:~# kubectl -n star-wars patch service deathstar -p '{"spec":{"type":"NodePort"}}'
service/deathstar patched
root@kube-node-1:~# kubectl -n star-wars get service -o wide
NAME        TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE    SELECTOR
deathstar   NodePort   172.16.39.138   <none>        80:32271/TCP   112s   class=deathstar,org=empire
root@kube-node-1:~# kubectl -n kube-system exec ds/cilium -- cilium service list
Defaulted container "cilium-agent" out of: cilium-agent, config (init), mount-cgroup (init), apply-sysctl-overwrites (init), mount-bpf-fs (init), clean-cilium-state (init), install-cni-binaries (init)
ID   Frontend                Service Type   Backend                               
1    172.16.32.1:443/TCP     ClusterIP      1 => 10.75.59.71:6443/TCP (active)    
2    172.16.43.10:443/TCP    ClusterIP      1 => 10.75.59.71:4244/TCP (active)    
3    172.16.37.239:80/TCP    ClusterIP      1 => 172.16.1.81:4245/TCP (active)    
4    10.75.59.71:31234/TCP   NodePort       1 => 172.16.1.81:4245/TCP (active)    
5    0.0.0.0:31234/TCP       NodePort       1 => 172.16.1.81:4245/TCP (active)    
6    172.16.32.10:53/TCP     ClusterIP      1 => 172.16.1.64:53/TCP (active)      
                                            2 => 172.16.1.40:53/TCP (active)      
7    172.16.32.10:9153/TCP   ClusterIP      1 => 172.16.1.64:9153/TCP (active)    
                                            2 => 172.16.1.40:9153/TCP (active)    
8    172.16.32.10:53/UDP     ClusterIP      1 => 172.16.1.64:53/UDP (active)      
                                            2 => 172.16.1.40:53/UDP (active)      
9    172.16.35.177:80/TCP    ClusterIP      1 => 172.16.3.127:8081/TCP (active)   
10   10.75.59.71:31225/TCP   NodePort       1 => 172.16.3.127:8081/TCP (active)   
11   0.0.0.0:31225/TCP       NodePort       1 => 172.16.3.127:8081/TCP (active)   
12   172.16.39.138:80/TCP    ClusterIP      1 => 172.16.3.161:80/TCP (active)     
                                            2 => 172.16.1.231:80/TCP (active)     
13   10.75.59.71:32271/TCP   NodePort       1 => 172.16.3.161:80/TCP (active)     
                                            2 => 172.16.1.231:80/TCP (active)     
14   0.0.0.0:32271/TCP       NodePort       1 => 172.16.3.161:80/TCP (active)     
                                            2 => 172.16.1.231:80/TCP (active)     
到这里就算部署成功了。

root@kube-node-1:~# kubectl -n star-wars exec tiefighter --   curl -s -XPOST http://deathstar.star-wars.svc.cluster.local/v1/request-landing
Ship landed
root@kube-node-1:~# kubectl -n star-wars exec xwing --   curl -s -XPOST http://deathstar.star-wars.svc.cluster.local/v1/request-landing
Ship landed
root@kube-node-1:~# 

在外部的设备也可以通过节点IP访问。

root@dns-server-vm:~# curl -s -XPOST http://10.75.59.72:32271/v1/request-landing
Ship landed
root@dns-server-vm:~# curl -s -XPOST http://10.75.59.71:32271/v1/request-landing
Ship landed
root@dns-server-vm:~# curl -s -XPOST http://10.75.59.73:32271/v1/request-landing
Ship landed
```

## 5.2 在Node外部抓包 ( Pod to Pod )

```bash
查找虚拟机连接在网桥上的网卡

root@ois:/home/ois/data/k8s# virsh list
 Id    Name                  State
--------------------------------------
 4     win1                  running
 17    r1                    running
 69    ubuntu-2404-desktop   running
 96    dns-server-vm         running
 97    u1                    running
 98    ubuntu24042           running
 99    kube-node-1           running
 100   kube-node-2           running
 101   kube-node-3           running

root@ois:/home/ois/data/k8s# virsh domiflist 99
 Interface   Type     Source   Model    MAC
-----------------------------------------------------------
 vnet90      bridge   br0      virtio   52:54:00:90:8c:cf

root@ois:/home/ois/data/k8s# virsh domiflist 100
 Interface   Type     Source   Model    MAC
-----------------------------------------------------------
 vnet91      bridge   br0      virtio   52:54:00:ba:d4:1f

root@ois:/home/ois/data/k8s# virsh domiflist 101
 Interface   Type     Source   Model    MAC
-----------------------------------------------------------
 vnet92      bridge   br0      virtio   52:54:00:37:e0:96
 
 
```

```bash
在Pod中发起访问

root@kube-node-1:~# kubectl -n star-wars get pods -o wide
NAME                         READY   STATUS    RESTARTS   AGE    IP             NODE          NOMINATED NODE   READINESS GATES
deathstar-86f85ffb4d-4ldsj   1/1     Running   0          4m1s   172.16.1.231   kube-node-2   <none>           <none>
deathstar-86f85ffb4d-dbzft   1/1     Running   0          4m1s   172.16.3.161   kube-node-3   <none>           <none>
tiefighter                   1/1     Running   0          4m1s   172.16.3.247   kube-node-3   <none>           <none>
xwing                        1/1     Running   0          4m1s   172.16.3.155   kube-node-3   <none>           <none>
root@kube-node-1:~# kubectl -n star-wars exec xwing -- ip a                                                                            
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
11: eth0@if12: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/ether f2:2a:b8:da:e7:d2 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.16.3.155/32 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::f02a:b8ff:feda:e7d2/64 scope link 
       valid_lft forever preferred_lft forever
root@kube-node-1:~# kubectl -n star-wars exec xwing -- ping 172.16.1.231
error: Internal error occurred: Internal error occurred: error executing command in container: failed to exec in container: failed to start exec "1b1120795a5b60f35bac5a4056a1714a5c0df32762e2a79f272cf2c82089e970": OCI runtime exec failed: exec failed: unable to start container process: exec: "ping": executable file not found in $PATH: unknown
root@kube-node-1:~# kubectl -n star-wars exec xwing -- curl -s http://172.16.1.231/v1
{
        "name": "Death Star",
        "hostname": "deathstar-86f85ffb4d-4ldsj",
        "model": "DS-1 Orbital Battle Station",
        "manufacturer": "Imperial Department of Military Research, Sienar Fleet Systems",
        "cost_in_credits": "1000000000000",
        "length": "120000",
        "crew": "342953",
        "passengers": "843342",
        "cargo_capacity": "1000000000000",
        "hyperdrive_rating": "4.0",
        "starship_class": "Deep Space Mobile Battlestation",
        "api": [
                "GET   /v1",
                "GET   /v1/healthz",
                "POST  /v1/request-landing",
                "PUT   /v1/cargobay",
                "GET   /v1/hyper-matter-reactor/status",
                "PUT   /v1/exhaust-port"
        ]
}

在宿主机上进行抓包，可以看到两者之间是直接路由的。

root@ois:/home/ois/data/k8s# tcpdump -i vnet92 -vn 'tcp port 80'
tcpdump: listening on vnet92, link-type EN10MB (Ethernet), snapshot length 262144 bytes
11:11:11.478887 IP (tos 0x0, ttl 63, id 25688, offset 0, flags [DF], proto TCP (6), length 60)
    172.16.3.155.37162 > 172.16.1.231.80: Flags [S], cksum 0x5dd1 (incorrect -> 0xdb07), seq 542023762, win 64240, options [mss 1460,sackOK,TS val 1624400247 ecr 0,nop,wscale 7], length 0
11:11:11.479178 IP (tos 0x0, ttl 63, id 0, offset 0, flags [DF], proto TCP (6), length 60)
    172.16.1.231.80 > 172.16.3.155.37162: Flags [S.], cksum 0x5dd1 (incorrect -> 0x7b14), seq 3892089835, ack 542023763, win 65160, options [mss 1460,sackOK,TS val 727758081 ecr 1624400247,nop,wscale 7], length 0
11:11:11.479479 IP (tos 0x0, ttl 63, id 25689, offset 0, flags [DF], proto TCP (6), length 52)
    172.16.3.155.37162 > 172.16.1.231.80: Flags [.], cksum 0x5dc9 (incorrect -> 0xa673), ack 1, win 502, options [nop,nop,TS val 1624400247 ecr 727758081], length 0
11:11:11.479552 IP (tos 0x0, ttl 63, id 25690, offset 0, flags [DF], proto TCP (6), length 130)
    172.16.3.155.37162 > 172.16.1.231.80: Flags [P.], cksum 0x5e17 (incorrect -> 0x366d), seq 1:79, ack 1, win 502, options [nop,nop,TS val 1624400247 ecr 727758081], length 78: HTTP, length: 78
        GET /v1 HTTP/1.1
        Host: 172.16.1.231
        User-Agent: curl/7.88.1
        Accept: */*

11:11:11.479684 IP (tos 0x0, ttl 63, id 13836, offset 0, flags [DF], proto TCP (6), length 52)
    172.16.1.231.80 > 172.16.3.155.37162: Flags [.], cksum 0x5dc9 (incorrect -> 0xa61e), ack 79, win 509, options [nop,nop,TS val 727758081 ecr 1624400247], length 0
11:11:11.480420 IP (tos 0x0, ttl 63, id 13837, offset 0, flags [DF], proto TCP (6), length 746)
    172.16.1.231.80 > 172.16.3.155.37162: Flags [P.], cksum 0x607f (incorrect -> 0xc657), seq 1:695, ack 79, win 509, options [nop,nop,TS val 727758082 ecr 1624400247], length 694: HTTP, length: 694
        HTTP/1.1 200 OK
        Content-Type: text/plain
        Date: Fri, 01 Aug 2025 03:11:11 GMT
        Content-Length: 591

        {
                "name": "Death Star",
                "hostname": "deathstar-86f85ffb4d-4ldsj",
                "model": "DS-1 Orbital Battle Station",
                "manufacturer": "Imperial Department of Military Research, Sienar Fleet Systems",
                "cost_in_credits": "1000000000000",
                "length": "120000",
                "crew": "342953",
                "passengers": "843342",
                "cargo_capacity": "1000000000000",
                "hyperdrive_rating": "4.0",
                "starship_class": "Deep Space Mobile Battlestation",
                "api": [
                        "GET   /v1",
                        "GET   /v1/healthz",
                        "POST  /v1/request-landing",
                        "PUT   /v1/cargobay",
                        "GET   /v1/hyper-matter-reactor/status",
                        "PUT   /v1/exhaust-port"
                ]
        }       
```

Cilium将各个Node对应的Pod路由自动安装了

```bash
root@kube-node-3:~# ip route show
default via 10.75.59.1 dev enp1s0 proto static 
10.75.59.0/24 dev enp1s0 proto kernel scope link src 10.75.59.73 
172.16.0.0/24 via 10.75.59.71 dev enp1s0 proto kernel 
172.16.1.0/24 via 10.75.59.72 dev enp1s0 proto kernel 
172.16.3.0/24 via 172.16.3.22 dev cilium_host proto kernel src 172.16.3.22 
172.16.3.22 dev cilium_host proto kernel scope link 
root@kube-node-3:~# route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         10.75.59.1      0.0.0.0         UG    0      0        0 enp1s0
10.75.59.0      0.0.0.0         255.255.255.0   U     0      0        0 enp1s0
172.16.0.0      10.75.59.71     255.255.255.0   UG    0      0        0 enp1s0
172.16.1.0      10.75.59.72     255.255.255.0   UG    0      0        0 enp1s0
172.16.3.0      172.16.3.22     255.255.255.0   UG    0      0        0 cilium_host
172.16.3.22     0.0.0.0         255.255.255.255 UH    0      0        0 cilium_host

root@kube-node-2:~# ip route show
default via 10.75.59.1 dev enp1s0 proto static 
10.75.59.0/24 dev enp1s0 proto kernel scope link src 10.75.59.72 
172.16.0.0/24 via 10.75.59.71 dev enp1s0 proto kernel 
172.16.1.0/24 via 172.16.1.128 dev cilium_host proto kernel src 172.16.1.128 
172.16.1.128 dev cilium_host proto kernel scope link 
172.16.3.0/24 via 10.75.59.73 dev enp1s0 proto kernel 
root@kube-node-2:~# route -n
Kernel IP routing table
Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
0.0.0.0         10.75.59.1      0.0.0.0         UG    0      0        0 enp1s0
10.75.59.0      0.0.0.0         255.255.255.0   U     0      0        0 enp1s0
172.16.0.0      10.75.59.71     255.255.255.0   UG    0      0        0 enp1s0
172.16.1.0      172.16.1.128    255.255.255.0   UG    0      0        0 cilium_host
172.16.1.128    0.0.0.0         255.255.255.255 UH    0      0        0 cilium_host
172.16.3.0      10.75.59.73     255.255.255.0   UG    0      0        0 enp1s0
```

在Hubble UI中，可以看到详细的Flow

```json
{
  "uuid": "2af76725-f6f9-49b4-b9f1-8d01b3f14930",
  "verdict": 1,
  "drop_reason": 0,
  "auth_type": 0,
  "Type": 1,
  "node_name": "kube-node-2",
  "node_labels": [
    "beta.kubernetes.io/arch=amd64",
    "beta.kubernetes.io/os=linux",
    "kubernetes.io/arch=amd64",
    "kubernetes.io/hostname=kube-node-2",
    "kubernetes.io/os=linux"
  ],
  "source_names": [],
  "destination_names": [],
  "reply": false,
  "traffic_direction": 2,
  "policy_match_type": 0,
  "trace_observation_point": 101,
  "trace_reason": 1,
  "drop_reason_desc": 0,
  "debug_capture_point": 0,
  "proxy_port": 0,
  "sock_xlate_point": 0,
  "socket_cookie": 0,
  "cgroup_id": 0,
  "Summary": "TCP Flags: SYN",
  "egress_allowed_by": [],
  "ingress_allowed_by": [],
  "egress_denied_by": [],
  "ingress_denied_by": [],
  "time": {
    "seconds": 1754022736,
    "nanos": 962926009
  },
  "ethernet": {
    "source": "f2:64:9f:b5:8e:81",
    "destination": "82:31:36:d1:5a:00"
  },
  "IP": {
    "source": "172.16.3.155",
    "source_xlated": "",
    "destination": "172.16.1.231",
    "ipVersion": 1,
    "encrypted": false
  },
  "l4": {
    "protocol": {
      "oneofKind": "TCP",
      "TCP": {
        "source_port": 38680,
        "destination_port": 80,
        "flags": {
          "FIN": false,
          "SYN": true,
          "RST": false,
          "PSH": false,
          "ACK": false,
          "URG": false,
          "ECE": false,
          "CWR": false,
          "NS": false
        }
      }
    }
  },
  "source": {
    "ID": 0,
    "identity": 36770,
    "cluster_name": "default",
    "namespace": "star-wars",
    "labels": [
      "k8s:app.kubernetes.io/name=xwing",
      "k8s:class=xwing",
      "k8s:io.cilium.k8s.namespace.labels.kubernetes.io/metadata.name=star-wars",
      "k8s:io.cilium.k8s.policy.cluster=default",
      "k8s:io.cilium.k8s.policy.serviceaccount=default",
      "k8s:io.kubernetes.pod.namespace=star-wars",
      "k8s:org=alliance"
    ],
    "pod_name": "xwing",
    "workloads": []
  },
  "destination": {
    "ID": 284,
    "identity": 15153,
    "cluster_name": "default",
    "namespace": "star-wars",
    "labels": [
      "k8s:app.kubernetes.io/name=deathstar",
      "k8s:class=deathstar",
      "k8s:io.cilium.k8s.namespace.labels.kubernetes.io/metadata.name=star-wars",
      "k8s:io.cilium.k8s.policy.cluster=default",
      "k8s:io.cilium.k8s.policy.serviceaccount=default",
      "k8s:io.kubernetes.pod.namespace=star-wars",
      "k8s:org=empire"
    ],
    "pod_name": "deathstar-86f85ffb4d-4ldsj",
    "workloads": [
      {
        "name": "deathstar",
        "kind": "Deployment"
      }
    ]
  },
  "event_type": {
    "type": 4,
    "sub_type": 0
  },
  "is_reply": {
    "value": false
  },
  "interface": {
    "index": 14,
    "name": "lxcf734e435e18a"
  }
}
```

## 5.3 在Node外部抓包 ( Pod to External )

接下来，在Pod内部访问Internet进行测试。

```bash
root@kube-node-1:~# kubectl get configmap cilium-config -n kube-system -o yaml | grep -E 'enable-ipv4-masquerade|enable-bpf-masquerade'
  enable-bpf-masquerade: "true"
  enable-ipv4-masquerade: "true"
  
Pod xwing 位于Kube-node3，在Node3查看

root@kube-node-1:~# kubectl get pods -n kube-system -l k8s-app=cilium -o wide | grep kube-node-3
cilium-2vrgj   1/1     Running   0          106m   10.75.59.73   kube-node-3   <none>           <none>

root@kube-node-1:~# kubectl -n star-wars exec xwing -- curl -s https://echo.free.beeceptor.com
{
  "method": "GET",
  "protocol": "https",
  "host": "echo.free.beeceptor.com",
  "path": "/",
  "ip": "64.104.44.105:35834",
  "headers": {
    "Host": "echo.free.beeceptor.com",
    "User-Agent": "curl/7.88.1",
    "Accept": "*/*",
    "Via": "2.0 Caddy",
    "Accept-Encoding": "gzip"
  },
  "parsedQueryParams": {}
}root@kube-node-1:~# 
root@kube-node-1:~# 

使用 cilium bpf nat list 查看NAT表

root@kube-node-1:~# kubectl exec -n kube-system cilium-2vrgj -- cilium bpf nat list | grep 172.16.3.155
Defaulted container "cilium-agent" out of: cilium-agent, config (init), mount-cgroup (init), apply-sysctl-overwrites (init), mount-bpf-fs (init), clean-cilium-state (init), install-cni-binaries (init)
TCP OUT 172.16.3.155:35834 -> 147.182.252.2:443 XLATE_SRC 10.75.59.73:35834 Created=4sec ago NeedsCT=0
TCP IN 147.182.252.2:443 -> 10.75.59.73:35834 XLATE_DST 172.16.3.155:35834 Created=4sec ago NeedsCT=0
root@kube-node-1:~# 
root@kube-node-1:~# 

在外部的抓包：
root@ois:/home/ois/data/k8s# tcpdump -i vnet92 -vn 'tcp port 443'
tcpdump: listening on vnet92, link-type EN10MB (Ethernet), snapshot length 262144 bytes
12:28:22.307306 IP (tos 0x0, ttl 63, id 45759, offset 0, flags [DF], proto TCP (6), length 60)
    10.75.59.73.49208 > 147.182.252.2.443: Flags [S], cksum 0xd57b (incorrect -> 0x363a), seq 3275650602, win 64240, options [mss 1460,sackOK,TS val 493037768 ecr 0,nop,wscale 7], length 0
12:28:22.477754 IP (tos 0x0, ttl 42, id 0, offset 0, flags [DF], proto TCP (6), length 60)
    147.182.252.2.443 > 10.75.59.73.49208: Flags [S.], cksum 0xed16 (correct), seq 450982431, ack 3275650603, win 65160, options [mss 1254,sackOK,TS val 1573215106 ecr 493037768,nop,wscale 7], length 0
12:28:22.478053 IP (tos 0x0, ttl 63, id 45760, offset 0, flags [DF], proto TCP (6), length 52)
    10.75.59.73.49208 > 147.182.252.2.443: Flags [.], cksum 0xd573 (incorrect -> 0x16fd), ack 1, win 502, options [nop,nop,TS val 493037939 ecr 1573215106], length 0
12:28:22.490922 IP (tos 0x0, ttl 63, id 45761, offset 0, flags [DF], proto TCP (6), length 569)
    10.75.59.73.49208 > 147.182.252.2.443: Flags [P.], cksum 0xd778 (incorrect -> 0x1d27), seq 1:518, ack 1, win 502, options [nop,nop,TS val 493037952 ecr 1573215106], length 517
```

# 6. 安装K8S和Cilium脚本自动化

接下来打算把K8S和Cilium的安装脚本自动化。

首先需要解决在kube-node-1 能 无密码登录到kube-node-2 和 kube-node-3。

## 6.1 无密码登录设置

```bash
#!/bin/bash

# --- Configuration ---
ANSIBLE_DIR="ansible_ssh_setup"
INVENTORY_FILE="${ANSIBLE_DIR}/hosts.ini"
PLAYBOOK_FILE="${ANSIBLE_DIR}/setup_ssh.yml"

# Kubernetes Node IPs
KUBE_NODE_1_IP="10.75.59.71"
KUBE_NODE_2_IP="10.75.59.72"
KUBE_NODE_3_IP="10.75.59.73"

# Common Ansible user and Python interpreter
ANSIBLE_USER="ubuntu"
ANSIBLE_PYTHON_INTERPRETER="/usr/bin/python3"

# --- Functions ---

# Function to check and install Ansible
install_ansible() {
    if ! command -v ansible &> /dev/null
    then
        echo "Ansible not found. Attempting to install Ansible..."
        if [ -f /etc/debian_version ]; then
            # Debian/Ubuntu
            sudo apt update
            sudo apt install -y software-properties-common
            sudo add-apt-repository --yes --update ppa:ansible/ansible
            sudo apt install -y ansible
        elif [ -f /etc/redhat-release ]; then
            # CentOS/RHEL/Fedora
            sudo yum install -y epel-release
            sudo yum install -y ansible
        else
            echo "Unsupported OS for automatic Ansible installation. Please install Ansible manually."
            exit 1
        fi
        if ! command -v ansible &> /dev/null; then
            echo "Ansible installation failed. Please install it manually and re-run this script."
            exit 1
        fi
        echo "Ansible installed successfully."
    else
        echo "Ansible is already installed."
    fi
}

# Function to create Ansible inventory file
create_inventory() {
    echo "Creating Ansible inventory file: ${INVENTORY_FILE}"
    mkdir -p "$ANSIBLE_DIR"
    cat <<EOF > "$INVENTORY_FILE"
[kubernetes_nodes]
kube-node-1 ansible_host=${KUBE_NODE_1_IP}
kube-node-2 ansible_host=${KUBE_NODE_2_IP}
kube-node-3 ansible_host=${KUBE_NODE_3_IP}

[all:vars]
ansible_user=${ANSIBLE_USER}
ansible_python_interpreter=${ANSIBLE_PYTHON_INTERPRETER}
EOF
    echo "Inventory file created."
}

# Function to create Ansible playbook file
create_playbook() {
    echo "Creating Ansible playbook file: ${PLAYBOOK_FILE}"
    mkdir -p "$ANSIBLE_DIR"
    cat <<'EOF' > "$PLAYBOOK_FILE"
---
- name: Generate SSH key on kube-node-1 and distribute to other nodes
  hosts: kubernetes_nodes
  become: yes

  tasks:
    - name: Generate SSH key on kube-node-1
      ansible.builtin.command:
        cmd: ssh-keygen -t rsa -b 4096 -N "" -f /root/.ssh/id_rsa
        creates: /root/.ssh/id_rsa
      when: inventory_hostname == 'kube-node-1'

    - name: Ensure .ssh directory exists on all nodes
      ansible.builtin.file:
        path: /root/.ssh
        state: directory
        mode: '0700'

    - name: Ensure authorized_keys file exists
      ansible.builtin.file:
        path: /root/.ssh/authorized_keys
        state: touch
        mode: '0600'

    - name: Fetch public key from kube-node-1
      ansible.builtin.slurp:
        src: /root/.ssh/id_rsa.pub
      register: ssh_public_key
      when: inventory_hostname == 'kube-node-1'

    - name: Distribute public key to kube-node-2 and kube-node-3
      ansible.builtin.lineinfile:
        path: /root/.ssh/authorized_keys
        line: "{{ hostvars['kube-node-1']['ssh_public_key']['content'] | b64decode }}"
        state: present
      when: inventory_hostname in ['kube-node-2', 'kube-node-3']
EOF
    echo "Playbook file created."
}

# --- Main Script Execution ---

echo "Starting Ansible SSH key setup process..."

# 1. Install Ansible if not present
install_ansible

# 2. Create Ansible inventory file
create_inventory

# 3. Create Ansible playbook file
create_playbook

echo "Setup complete. You can now run the Ansible playbook manually using:"
echo "ansible-playbook -i \"$INVENTORY_FILE\" \"$PLAYBOOK_FILE\" --ask-become-pass"
echo "You will be prompted for the 'sudo' password for the 'ubuntu' user on your VMs."
echo "Process complete."
```

```bash
chmod +x ansible_ssh.sh
./ansible_ssh.sh

ois@ois:~/data/k8s$ ./ansible_ssh.sh
Starting Ansible SSH key setup process...
Ansible is already installed.
Creating Ansible inventory file: ansible_ssh_setup/hosts.ini
Inventory file created.
Creating Ansible playbook file: ansible_ssh_setup/setup_ssh.yml
Playbook file created.
Setup complete. You can now run the Ansible playbook manually using:
ansible-playbook -i "ansible_ssh_setup/hosts.ini" "ansible_ssh_setup/setup_ssh.yml" --ask-become-pass
You will be prompted for the 'sudo' password for the 'ubuntu' user on your VMs.
Process complete.
ois@ois:~/data/k8s$ cd ansible_ssh_setup/
ois@ois:~/data/k8s/ansible_ssh_setup$ ansible-playbook setup_ssh.yml -i hosts.ini -K
BECOME password: 

PLAY [Generate SSH key on kube-node-1 and distribute to other nodes] ********************************************************************************************************

TASK [Gathering Facts] ******************************************************************************************************************************************************
ok: [kube-node-1]
ok: [kube-node-3]
ok: [kube-node-2]

TASK [Generate SSH key on kube-node-1] **************************************************************************************************************************************
skipping: [kube-node-2]
skipping: [kube-node-3]
changed: [kube-node-1]

TASK [Ensure .ssh directory exists on all nodes] ****************************************************************************************************************************
ok: [kube-node-2]
ok: [kube-node-1]
ok: [kube-node-3]

TASK [Ensure authorized_keys file exists] ***********************************************************************************************************************************
changed: [kube-node-1]
changed: [kube-node-2]
changed: [kube-node-3]

TASK [Fetch public key from kube-node-1] ************************************************************************************************************************************
skipping: [kube-node-2]
skipping: [kube-node-3]
ok: [kube-node-1]

TASK [Distribute public key to kube-node-2 and kube-node-3] *****************************************************************************************************************
skipping: [kube-node-1]
changed: [kube-node-3]
changed: [kube-node-2]

PLAY RECAP ******************************************************************************************************************************************************************
kube-node-1                : ok=5    changed=2    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0   
kube-node-2                : ok=4    changed=2    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
kube-node-3                : ok=4    changed=2    unreachable=0    failed=0    skipped=2    rescued=0    ignored=0   
```

效果：

```bash
root@kube-node-1:~# ssh root@10.75.59.72
Welcome to Ubuntu 24.04.2 LTS (GNU/Linux 6.8.0-63-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

 System information as of Fri Aug  1 02:28:23 PM CST 2025

  System load:  0.13               Processes:               188
  Usage of /:   30.2% of 18.33GB   Users logged in:         1
  Memory usage: 10%                IPv4 address for enp1s0: 10.75.59.72
  Swap usage:   0%

 * Strictly confined Kubernetes makes edge and IoT secure. Learn how MicroK8s
   just raised the bar for easy, resilient and secure K8s cluster deployment.

   https://ubuntu.com/engage/secure-kubernetes-at-the-edge

Expanded Security Maintenance for Applications is not enabled.

0 updates can be applied immediately.

Enable ESM Apps to receive additional future security updates.
See https://ubuntu.com/esm or run: sudo pro status

*** System restart required ***
```

## 6.2 自动化安装设置脚本

```bash
#!/bin/bash

# ==============================================================================
# Idempotent Kubernetes and Cilium Setup Script
#
# This script can be run multiple times. It checks the current state
# at each step and only performs actions if necessary.
# It must be run as root on the primary control-plane node.
# ==============================================================================

# --- Configuration ---
CONTROL_PLANE_ENDPOINT="kube-node-1"
CONTROL_PLANE_IP="10.75.59.71"
WORKER_NODES=("10.75.59.72" "10.75.59.73")
POD_CIDR="172.16.0.0/20"
SERVICE_CIDR="172.16.32.0/20"
BGP_PEER_IP="10.75.59.76"
LOCAL_ASN=65000
PEER_ASN=65000
CILIUM_VERSION="1.17.6"
HUBBLE_UI_VERSION="1.3.6"

# ==============================================================================
# Helper Function
# ==============================================================================
print_header() { echo -e "\n### $1 ###"; }

# ==============================================================================
# STEP 1: Initialize Kubernetes Control-Plane
# ==============================================================================
print_header "STEP 1: Initializing Kubernetes Control-Plane"

if kubectl get nodes &> /dev/null; then
  echo "✅ Kubernetes cluster is already running. Skipping kubeadm init."
else
  echo "--> Kubernetes cluster not found. Initializing..."
  kubeadm config images pull
  kubeadm init \
    --control-plane-endpoint=${CONTROL_PLANE_ENDPOINT} \
    --pod-network-cidr=${POD_CIDR} \
    --service-cidr=${SERVICE_CIDR} \
    --skip-phases=addon/kube-proxy
  mkdir -p /root/.kube
  cp -i /etc/kubernetes/admin.conf /root/.kube/config
  echo "✅ Control-Plane initialization complete."
fi

# ==============================================================================
# STEP 2: Install or Upgrade Cilium CNI
# ==============================================================================
print_header "STEP 2: Installing or Upgrading Cilium CNI"

helm repo add cilium https://helm.cilium.io/ &> /dev/null
helm repo add isovalent https://helm.isovalent.com/ &> /dev/null
helm repo update > /dev/null

cat > cilium-values.yaml <<EOF
hubble:
  enabled: true
  relay:
    enabled: true
  ui:
    enabled: false
ipam:
  mode: kubernetes
ipv4NativeRoutingCIDR: ${POD_CIDR}
k8s:
  requireIPv4PodCIDR: true
routingMode: native
autoDirectNodeRoutes: true
enableIPv4Masquerade: true
bgpControlPlane:
  enabled: true
  announce:
    podCIDR: true
kubeProxyReplacement: true
bpf:
  masquerade: true
  lb:
    externalClusterIP: true
    sock: true
EOF

if helm status cilium -n kube-system &> /dev/null; then
  echo "--> Cilium is already installed. Upgrading to apply latest configuration..."
  helm upgrade cilium isovalent/cilium --version ${CILIUM_VERSION} --namespace kube-system --set k8sServiceHost=${CONTROL_PLANE_IP},k8sServicePort=6443 -f cilium-values.yaml
else
  echo "--> Cilium not found. Installing..."
  helm install cilium isovalent/cilium --version ${CILIUM_VERSION} --namespace kube-system --set k8sServiceHost=${CONTROL_PLANE_IP},k8sServicePort=6443 -f cilium-values.yaml
fi
echo "--> Waiting for Cilium pods to become ready..."
kubectl -n kube-system wait --for=condition=Ready pod -l k8s-app=cilium --timeout=5m
echo "✅ Cilium is configured."

# ==============================================================================
# STEP 3: Join Worker Nodes to the Cluster
# ==============================================================================
print_header "STEP 3: Joining Worker Nodes"

for NODE_IP in "${WORKER_NODES[@]}"; do
  if kubectl get nodes -o wide | grep -q "$NODE_IP"; then
    echo "✅ Node ${NODE_IP} is already in the cluster. Skipping join."
  else
    echo "--> Node ${NODE_IP} not found in cluster. Attempting to join..."
    JOIN_COMMAND=$(kubeadm token create --print-join-command)
    ssh -o StrictHostKeyChecking=no root@${NODE_IP} "${JOIN_COMMAND}"
    if [ $? -ne 0 ]; then
      echo "❌ Failed to join node ${NODE_IP}. Please check SSH connectivity and logs." >&2
      exit 1
    fi
    echo "✅ Node ${NODE_IP} joined successfully."
  fi
done

# ==============================================================================
# STEP 4: Install Cilium CLI
# ==============================================================================
print_header "STEP 4: Installing Cilium CLI"

if command -v cilium &> /dev/null; then
  echo "✅ Cilium CLI is already installed. Skipping."
else
  echo "--> Installing Cilium CLI..."
  curl -L --silent --remote-name-all https://github.com/isovalent/cilium-cli-releases/releases/latest/download/cilium-linux-amd64.tar.gz{,.sha256sum}
  sha256sum --check cilium-linux-amd64.tar.gz.sha256sum > /dev/null
  tar xzvfC cilium-linux-amd64.tar.gz /usr/local/bin > /dev/null
  rm cilium-linux-amd64.tar.gz cilium-linux-amd64.tar.gz.sha256sum
  echo "✅ Cilium CLI installed."
fi

# ==============================================================================
# STEP 5: Configure Cilium BGP Peering
# ==============================================================================
print_header "STEP 5: Configuring Cilium BGP Peering"

echo "--> Applying BGP configuration. 'unchanged' means it's already correct."
# CORRECTION: Using the correct schema with matchLabels.
cat > cilium-bgp.yaml << EOF
---
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPAdvertisement
metadata:
  name: bgp-advertisements
  labels:
    advertise: bgp
spec:
  advertisements:
    - advertisementType: "PodCIDR"              # Only for Kubernetes or ClusterPool IPAM cluster-pool
    - advertisementType: "Service"
      service:
        addresses:
          - ClusterIP
          - ExternalIP
          #- LoadBalancerIP
      selector:
        matchExpressions:
        - {key: somekey, operator: NotIn, values: ['never-used-value']} 

---
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPPeerConfig
metadata:
  name: cilium-peer
spec:
  timers:
    holdTimeSeconds: 30             #default 90s
    keepAliveTimeSeconds: 10  #default 30s
    connectRetryTimeSeconds: 40  #default 120s
  gracefulRestart:
    enabled: true
    restartTimeSeconds: 120        #default 120s
  #transport:
  #  peerPort: 179
  families:
    - afi: ipv4
      safi: unicast
      advertisements:
        matchLabels:
          advertise: "bgp"

---
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPClusterConfig
metadata:
  name: cilium-bgp-default
spec:
  bgpInstances:
  - name: "instance-65000"
    localASN: ${LOCAL_ASN}
    peers:
    - name: "FRR_BGP"
      peerASN: ${PEER_ASN}
      peerAddress: ${BGP_PEER_IP}
      peerConfigRef:
        name: "cilium-peer"
EOF

# Apply the configuration and check for errors
kubectl apply -f cilium-bgp.yaml
if [ $? -ne 0 ]; then
  echo "❌ Failed to apply BGP configuration. Please check the errors above." >&2
  exit 1
fi
echo "✅ BGP configuration applied."

# ==============================================================================
# STEP 6: Install or Upgrade Hubble UI
# ==============================================================================
print_header "STEP 6: Installing or Upgrading Hubble UI"

cat > hubble-ui-values.yaml << EOF
relay:
  address: "hubble-relay.kube-system.svc.cluster.local"
EOF

if helm status hubble-ui -n kube-system &> /dev/null; then
  echo "--> Hubble UI is already installed. Upgrading..."
  helm upgrade hubble-ui isovalent/hubble-ui --version ${HUBBLE_UI_VERSION} --namespace kube-system --values hubble-ui-values.yaml --wait
else
  echo "--> Hubble UI not found. Installing..."
  helm install hubble-ui isovalent/hubble-ui --version ${HUBBLE_UI_VERSION} --namespace kube-system --values hubble-ui-values.yaml --wait
fi

SERVICE_TYPE=$(kubectl get service hubble-ui -n kube-system -o jsonpath='{.spec.type}')
if [ "$SERVICE_TYPE" != "NodePort" ]; then
  echo "--> Patching Hubble UI service to NodePort..."
  kubectl patch service hubble-ui -n kube-system -p '{"spec": {"type": "NodePort"}}'
else
  echo "--> Hubble UI service is already of type NodePort."
fi
echo "✅ Hubble UI is configured."

# ==============================================================================
# STEP 7: Final Verification
# ==============================================================================
print_header "STEP 7: Final Verification"
echo "--> Waiting for all nodes to be ready..."
kubectl wait --for=condition=Ready node --all --timeout=5m
echo "--> Checking Cilium status..."
cilium status --wait

HUBBLE_UI_PORT=$(kubectl get service hubble-ui -n kube-system -o jsonpath='{.spec.ports[0].nodePort}')
echo -e "\n----------------------------------------------------------------"
echo "🚀 Cluster setup is complete and verified!"
echo "Access Hubble UI at: http://${CONTROL_PLANE_IP}:${HUBBLE_UI_PORT}"
echo "----------------------------------------------------------------"
```

```bash
root@kube-node-1:~# ./k8s-cilium-setup.sh 
### STEP 1: Initializing Kubernetes Control-Plane on kube-node-1... ###
--> Pulling Kubernetes container images...
[config/images] Pulled registry.k8s.io/kube-apiserver:v1.33.3
[config/images] Pulled registry.k8s.io/kube-controller-manager:v1.33.3
[config/images] Pulled registry.k8s.io/kube-scheduler:v1.33.3
[config/images] Pulled registry.k8s.io/kube-proxy:v1.33.3
[config/images] Pulled registry.k8s.io/coredns/coredns:v1.12.0
[config/images] Pulled registry.k8s.io/pause:3.10
[config/images] Pulled registry.k8s.io/etcd:3.5.21-0
--> Running kubeadm init...
[init] Using Kubernetes version: v1.33.3
[preflight] Running pre-flight checks
[preflight] Pulling images required for setting up a Kubernetes cluster
[preflight] This might take a minute or two, depending on the speed of your internet connection
[preflight] You can also perform this action beforehand using 'kubeadm config images pull'
[certs] Using certificateDir folder "/etc/kubernetes/pki"
[certs] Generating "ca" certificate and key
[certs] Generating "apiserver" certificate and key
[certs] apiserver serving cert is signed for DNS names [kube-node-1 kubernetes kubernetes.default kubernetes.default.svc kubernetes.default.svc.cluster.local] and IPs [172.16.32.1 10.75.59.71]
[certs] Generating "apiserver-kubelet-client" certificate and key
[certs] Generating "front-proxy-ca" certificate and key
[certs] Generating "front-proxy-client" certificate and key
[certs] Generating "etcd/ca" certificate and key
[certs] Generating "etcd/server" certificate and key
[certs] etcd/server serving cert is signed for DNS names [kube-node-1 localhost] and IPs [10.75.59.71 127.0.0.1 ::1]
[certs] Generating "etcd/peer" certificate and key
[certs] etcd/peer serving cert is signed for DNS names [kube-node-1 localhost] and IPs [10.75.59.71 127.0.0.1 ::1]
[certs] Generating "etcd/healthcheck-client" certificate and key
[certs] Generating "apiserver-etcd-client" certificate and key
[certs] Generating "sa" key and public key
[kubeconfig] Using kubeconfig folder "/etc/kubernetes"
[kubeconfig] Writing "admin.conf" kubeconfig file
[kubeconfig] Writing "super-admin.conf" kubeconfig file
[kubeconfig] Writing "kubelet.conf" kubeconfig file
[kubeconfig] Writing "controller-manager.conf" kubeconfig file
[kubeconfig] Writing "scheduler.conf" kubeconfig file
[etcd] Creating static Pod manifest for local etcd in "/etc/kubernetes/manifests"
[control-plane] Using manifest folder "/etc/kubernetes/manifests"
[control-plane] Creating static Pod manifest for "kube-apiserver"
[control-plane] Creating static Pod manifest for "kube-controller-manager"
[control-plane] Creating static Pod manifest for "kube-scheduler"
[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"
[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"
[kubelet-start] Starting the kubelet
[wait-control-plane] Waiting for the kubelet to boot up the control plane as static Pods from directory "/etc/kubernetes/manifests"
[kubelet-check] Waiting for a healthy kubelet at http://127.0.0.1:10248/healthz. This can take up to 4m0s
[kubelet-check] The kubelet is healthy after 1.001873284s
[control-plane-check] Waiting for healthy control plane components. This can take up to 4m0s
[control-plane-check] Checking kube-apiserver at https://10.75.59.71:6443/livez
[control-plane-check] Checking kube-controller-manager at https://127.0.0.1:10257/healthz
[control-plane-check] Checking kube-scheduler at https://127.0.0.1:10259/livez
[control-plane-check] kube-controller-manager is healthy after 2.272937689s
[control-plane-check] kube-scheduler is healthy after 3.04977489s
[control-plane-check] kube-apiserver is healthy after 5.003048769s
[upload-config] Storing the configuration used in ConfigMap "kubeadm-config" in the "kube-system" Namespace
[kubelet] Creating a ConfigMap "kubelet-config" in namespace kube-system with the configuration for the kubelets in the cluster
[upload-certs] Skipping phase. Please see --upload-certs
[mark-control-plane] Marking the node kube-node-1 as control-plane by adding the labels: [node-role.kubernetes.io/control-plane node.kubernetes.io/exclude-from-external-load-balancers]
[mark-control-plane] Marking the node kube-node-1 as control-plane by adding the taints [node-role.kubernetes.io/control-plane:NoSchedule]
[bootstrap-token] Using token: 0q5m6l.5pc7hz15orcc0b6b
[bootstrap-token] Configuring bootstrap tokens, cluster-info ConfigMap, RBAC Roles
[bootstrap-token] Configured RBAC rules to allow Node Bootstrap tokens to get nodes
[bootstrap-token] Configured RBAC rules to allow Node Bootstrap tokens to post CSRs in order for nodes to get long term certificate credentials
[bootstrap-token] Configured RBAC rules to allow the csrapprover controller automatically approve CSRs from a Node Bootstrap Token
[bootstrap-token] Configured RBAC rules to allow certificate rotation for all node client certificates in the cluster
[bootstrap-token] Creating the "cluster-info" ConfigMap in the "kube-public" namespace
[kubelet-finalize] Updating "/etc/kubernetes/kubelet.conf" to point to a rotatable kubelet client certificate and key
[addons] Applied essential addon: CoreDNS

Your Kubernetes control-plane has initialized successfully!

To start using your cluster, you need to run the following as a regular user:

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

Alternatively, if you are the root user, you can run:

  export KUBECONFIG=/etc/kubernetes/admin.conf

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  https://kubernetes.io/docs/concepts/cluster-administration/addons/

You can now join any number of control-plane nodes by copying certificate authorities
and service account keys on each node and then running the following as root:

  kubeadm join kube-node-1:6443 --token 0q5m6l.5pc7hz15orcc0b6b \
        --discovery-token-ca-cert-hash sha256:4795595e8237c54f1bf20c7fb56feea9a1960af5802c08c410733d54b5e317a6 \
        --control-plane 

Then you can join any number of worker nodes by running the following on each as root:

kubeadm join kube-node-1:6443 --token 0q5m6l.5pc7hz15orcc0b6b \
        --discovery-token-ca-cert-hash sha256:4795595e8237c54f1bf20c7fb56feea9a1960af5802c08c410733d54b5e317a6 
--> Configuring kubectl...
✅ Control-Plane initialization complete.
### STEP 2: Installing Cilium... ###
--> Adding Helm repositories...
"cilium" has been added to your repositories
"isovalent" has been added to your repositories
Hang tight while we grab the latest from your chart repositories...
...Successfully got an update from the "cilium" chart repository
...Successfully got an update from the "isovalent" chart repository
Update Complete. ⎈Happy Helming!⎈
--> Creating cilium-enterprise-values.yaml...
--> Installing Cilium with Helm...
NAME: cilium
LAST DEPLOYED: Fri Aug  1 14:16:16 2025
NAMESPACE: kube-system
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
You have successfully installed Cilium with Hubble Relay.

Your release version is 1.17.6.

For any further help, visit https://docs.isovalent.com/v1.17
--> Waiting for Cilium pods to become ready...
pod/cilium-5ngcm condition met
✅ Cilium installation complete.
### STEP 3: Joining Worker Nodes... ###
--> Generated join command: kubeadm join kube-node-1:6443 --token whltm8.4zs5af6hiht167da --discovery-token-ca-cert-hash sha256:4795595e8237c54f1bf20c7fb56feea9a1960af5802c08c410733d54b5e317a6 
--> Joining node 10.75.59.72 to the cluster...
[preflight] Running pre-flight checks
[preflight] Reading configuration from the "kubeadm-config" ConfigMap in namespace "kube-system"...
[preflight] Use 'kubeadm init phase upload-config --config your-config-file' to re-upload it.
W0801 14:18:01.674767   20870 configset.go:78] Warning: No kubeproxy.config.k8s.io/v1alpha1 config is loaded. Continuing without it: configmaps "kube-proxy" is forbidden: User "system:bootstrap:whltm8" cannot get resource "configmaps" in API group "" in the namespace "kube-system"
[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"
[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"
[kubelet-start] Starting the kubelet
[kubelet-check] Waiting for a healthy kubelet at http://127.0.0.1:10248/healthz. This can take up to 4m0s
[kubelet-check] The kubelet is healthy after 1.501212696s
[kubelet-start] Waiting for the kubelet to perform the TLS Bootstrap

This node has joined the cluster:
* Certificate signing request was sent to apiserver and a response was received.
* The Kubelet was informed of the new secure connection details.

Run 'kubectl get nodes' on the control-plane to see this node join the cluster.

✅ Node 10.75.59.72 joined successfully.
--> Joining node 10.75.59.73 to the cluster...
[preflight] Running pre-flight checks
[preflight] Reading configuration from the "kubeadm-config" ConfigMap in namespace "kube-system"...
[preflight] Use 'kubeadm init phase upload-config --config your-config-file' to re-upload it.
W0801 14:18:07.347008   20684 configset.go:78] Warning: No kubeproxy.config.k8s.io/v1alpha1 config is loaded. Continuing without it: configmaps "kube-proxy" is forbidden: User "system:bootstrap:whltm8" cannot get resource "configmaps" in API group "" in the namespace "kube-system"
[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"
[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"
[kubelet-start] Starting the kubelet
[kubelet-check] Waiting for a healthy kubelet at http://127.0.0.1:10248/healthz. This can take up to 4m0s
[kubelet-check] The kubelet is healthy after 1.002187345s
[kubelet-start] Waiting for the kubelet to perform the TLS Bootstrap

This node has joined the cluster:
* Certificate signing request was sent to apiserver and a response was received.
* The Kubelet was informed of the new secure connection details.

Run 'kubectl get nodes' on the control-plane to see this node join the cluster.

✅ Node 10.75.59.73 joined successfully.
### STEP 4: Installing the Cilium CLI... ###
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:01 --:--:--     0
100 59.2M  100 59.2M    0     0  13.1M      0  0:00:04  0:00:04 --:--:-- 23.8M
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
  0     0    0     0    0     0      0      0 --:--:--  0:00:01 --:--:--     0
100    92  100    92    0     0     70      0  0:00:01  0:00:01 --:--:--    70
cilium-linux-amd64.tar.gz: OK
cilium
✅ Cilium CLI installed.
### STEP 5: Configuring Cilium BGP Peering ###
--> Applying BGP configuration. 'unchanged' means it's already correct.
ciliumbgpadvertisement.cilium.io/bgp-advertisements unchanged
ciliumbgppeerconfig.cilium.io/cilium-peer unchanged
ciliumbgpclusterconfig.cilium.io/cilium-bgp-default configured
✅ BGP configuration applied.
### STEP 6: Installing Hubble UI... ###
--> Creating hubble-ui-values.yaml...
--> Installing Hubble UI with Helm...
NAME: hubble-ui
LAST DEPLOYED: Fri Aug  1 14:18:18 2025
NAMESPACE: kube-system
STATUS: deployed
REVISION: 1
TEST SUITE: None
NOTES:
You have successfully installed Hubble-Ui.
Your release version is 1.3.6.

For any further help, visit https://docs.isovalent.com
--> Exposing Hubble UI service via NodePort...
service/hubble-ui patched
✅ Hubble UI installed.
### STEP 7: Verifying the Setup... ###
--> Waiting for all nodes to be ready...
node/kube-node-1 condition met
node/kube-node-2 condition met
node/kube-node-3 condition met
--> Checking Cilium status...
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
                       hubble-ui          quay.io/isovalent/hubble-ui-enterprise-backend:v1.3.6: 1
                       hubble-ui          quay.io/isovalent/hubble-ui-enterprise:v1.3.6: 1

----------------------------------------------------------------
🚀 Cluster setup is complete and verified!
Access Hubble UI at: http://10.75.59.71:30583
----------------------------------------------------------------
root@kube-node-1:~# cilium bgp peers
Node          Local AS   Peer AS   Peer Address   Session State   Uptime   Family         Received   Advertised
kube-node-1   65000      65000     10.75.59.76    established     19m1s    ipv4/unicast   2          8    
kube-node-2   65000      65000     10.75.59.76    established     19m2s    ipv4/unicast   2          8    
kube-node-3   65000      65000     10.75.59.76    established     19m2s    ipv4/unicast   2          8    
root@kube-node-1:~# cilium bgp routes
(Defaulting to `available ipv4 unicast` routes, please see help for more options)

Node          VRouter   Prefix             NextHop   Age     Attrs
kube-node-1   65000     172.16.0.0/24      0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.1/32     0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.10/32    0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.36.130/32   0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.40.165/32   0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.43.51/32    0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.47.30/32    0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
kube-node-2   65000     172.16.1.0/24      0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.1/32     0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.10/32    0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.36.130/32   0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.40.165/32   0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.43.51/32    0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.47.30/32    0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
kube-node-3   65000     172.16.2.0/24      0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.1/32     0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.32.10/32    0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.36.130/32   0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.40.165/32   0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.43.51/32    0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
              65000     172.16.47.30/32    0.0.0.0   19m8s   [{Origin: i} {Nexthop: 0.0.0.0}]   
root@kube-node-1:~# 
```
# 7. Kubectl 常用命令
```shell
kubectl describe pod hubble-ui-5fdd8b4495-dv7nr -n kube-system

kubectl get nodes -o wide
kubectl get pods -n kube-system -o wide
kubectl get pods --all-namespaces
kubectl get service -n kube-system -o wide
kubectl get daemonset -n kube-system cilium
kubectl get deployment -o wide

kubectl get endpoints -n kube-system kube-dns
kubectl get cm cilium-config -n kube-system -o yaml
kubectl get endpoints -n kube-system
kubectl get pods -n kube-system -l k8s-app=cilium -o wide
# kubectl describe pod hubble-relay-cfb755899-r42l8



kubectl -n kube-system get pods -l k8s-app=cilium
kubectl -n kube-system exec ds/cilium -- cilium-dbg bpf ipmasq list
kubectl -n kube-system exec ds/cilium -- cilium-dbg status --verbose
kubectl -n kube-system exec ds/cilium -- cilium status
kubectl -n kube-system exec ds/cilium -- cilium service list
kubectl -n kube-system exec ds/cilium -- cilium bpf nat list
kubectl exec -n kube-system cilium-2vrgj -- cilium bpf nat list

kubectl -n kube-system get configmap cilium-config -o yaml

kubectl create namespace star-wars
kubectl apply -n star-wars -f https://raw.githubusercontent.com/cilium/cilium/HEAD/examples/minikube/http-sw-app.yaml
kubectl -n star-wars get pod -o wide --show-labels
kubectl -n star-wars patch service deathstar -p '{"spec":{"type":"NodePort"}}'
kubectl -n star-wars exec tiefighter --   curl -s -XPOST http://deathstar.star-wars.svc.cluster.local/v1/request-landing
kubectl -n star-wars exec xwing --   curl -s -XPOST http://deathstar.star-wars.svc.cluster.local/v1/request-landing

# kubectl delete -n star-wars -f https://raw.githubusercontent.com/cilium/cilium/1.18.0/examples/minikube/http-sw-app.yaml

# Commands for reference only.


kubectl delete pod,svc,daemonset -n kube-system -l k8s-app=cilium
kubectl delete daemonset -n kube-system kube-proxy


kubectl create deployment nginx --image=nginx
kubectl expose deployment nginx --port=80 --type=ClusterIP

kubectl run -it --rm busybox --image=busybox --restart=Never -- sh

kubectl run -it --rm curl --image=curlimages/curl --restart=Never -- sh

for i in {1..10}; do   kubectl exec -n star-wars tiefighter --     curl -s http://deathstar.default.svc.cluster.local/v1 |     jq -r '.hostname'; done
```