---
title: Mastering KVM Virtualization 学习笔记(1)
date: 2021-02-22 14:23:47
tags: kvm
description: Mastering KVM Virtualization 学习笔记，自用，本篇主要记录第三章到第五章。
---

第一章和第二章之前快速阅读过了，没有笔记，等回头再回来整理。

## Chapter 3 KVM、virsh、oVirt等

### CentOS 8 的KVM安装

```bash
yum module install virt
dnf install qemu-img qemu-kvm libvirt libvirt-client virt-manager \
virt-install virt-viewer -y
```

### 安装完后，使用virt-host-validate验证

```bash
[root@centos7 ~]# virt-host-validate
  QEMU: Checking for hardware virtualization                                 : PASS
  QEMU: Checking if device /dev/kvm exists                                   : PASS
  QEMU: Checking if device /dev/kvm is accessible                            : PASS
  QEMU: Checking if device /dev/vhost-net exists                             : PASS
  QEMU: Checking if device /dev/net/tun exists                               : PASS
  QEMU: Checking for cgroup 'memory' controller support                      : PASS
  QEMU: Checking for cgroup 'memory' controller mount-point                  : PASS
  QEMU: Checking for cgroup 'cpu' controller support                         : PASS
  QEMU: Checking for cgroup 'cpu' controller mount-point                     : PASS
  QEMU: Checking for cgroup 'cpuacct' controller support                     : PASS
  QEMU: Checking for cgroup 'cpuacct' controller mount-point                 : PASS
  QEMU: Checking for cgroup 'cpuset' controller support                      : PASS
  QEMU: Checking for cgroup 'cpuset' controller mount-point                  : PASS
  QEMU: Checking for cgroup 'devices' controller support                     : PASS
  QEMU: Checking for cgroup 'devices' controller mount-point                 : PASS
  QEMU: Checking for cgroup 'blkio' controller support                       : PASS
  QEMU: Checking for cgroup 'blkio' controller mount-point                   : PASS
  QEMU: Checking for device assignment IOMMU support                         : PASS
  QEMU: Checking if IOMMU is enabled by kernel                               : PASS
   LXC: Checking for Linux >= 2.6.26                                         : PASS
   LXC: Checking for namespace ipc                                           : PASS
   LXC: Checking for namespace mnt                                           : PASS
   LXC: Checking for namespace pid                                           : PASS
   LXC: Checking for namespace uts                                           : PASS
   LXC: Checking for namespace net                                           : PASS
   LXC: Checking for namespace user                                          : PASS
   LXC: Checking for cgroup 'memory' controller support                      : PASS
   LXC: Checking for cgroup 'memory' controller mount-point                  : PASS
   LXC: Checking for cgroup 'cpu' controller support                         : PASS
   LXC: Checking for cgroup 'cpu' controller mount-point                     : PASS
   LXC: Checking for cgroup 'cpuacct' controller support                     : PASS
   LXC: Checking for cgroup 'cpuacct' controller mount-point                 : PASS
   LXC: Checking for cgroup 'cpuset' controller support                      : PASS
   LXC: Checking for cgroup 'cpuset' controller mount-point                  : PASS
   LXC: Checking for cgroup 'devices' controller support                     : PASS
   LXC: Checking for cgroup 'devices' controller mount-point                 : PASS
   LXC: Checking for cgroup 'blkio' controller support                       : PASS
   LXC: Checking for cgroup 'blkio' controller mount-point                   : PASS
   LXC: Checking if device /sys/fs/fuse/connections exists                   : PASS
```

### 使用virt-install 安装虚拟机

编辑anaconda-ks.cfg文件，使用以下参数可以实现虚机部署的静默安装。

```bash
virt-install --virt-type=kvm --name=MasteringKVM02 --ram=4096
--vcpus=4 --os-variant=rhel8.0 --location=/var/lib/libvirt/
images/ CentOS-8-x86_64-1905-dvd1.iso --network=default
--graphics vnc --disk size=16 -x "ks=http://10.10.48.1/ks.cfg"
```

### oVirt

oVirt（Open Virtualization Manager）是一款免费开源虚拟化软件，是RedHat商业版本虚拟化软件RHEV的开源版本。

oVirt基于kvm，并整合使用了libvirt、gluster、patternfly、ansible等一系列优秀的开源软件。

### 探索虚拟机Qemu-kvm进程

```bash
root@ubuntu-kvm:/home/ubuntu# ps aux | grep qemu
libvirt+    8526  255  0.1 13876708 653744 ?     SLl  Feb01 61850:36 /usr/bin/qemu-system-x86_64 -name guest=csr1kv-1,debug-threads=on -S -object secret,id=masterKey0,format=raw,file=/var/lib/libvirt/qemu/domain-4-csr1kv-1/master-key.aes -machine pc-q35-4.2,accel=kvm,usb=off,vmport=off,dump-guest-core=off,mem-merge=off -cpu host -m 8192 -mem-prealloc -mem-path /dev/hugepages/libvirt/qemu/4-csr1kv-1 -overcommit mem-lock=on -smp 8,sockets=8,cores=1,threads=1 -uuid 83f90c1c-f0ea-4298-bcdf-3d676de2aeb4 -no-user-config -nodefaults -chardev socket,id=charmonitor,fd=31,server,nowait -mon chardev=charmonitor,id=monitor,mode=control -rtc base=utc,driftfix=slew -global kvm-pit.lost_tick_policy=delay -no-hpet -no-shutdown -global ICH9-LPC.disable_s3=1 -global ICH9-LPC.disable_s4=1 -boot strict=on -device pcie-root-port,port=0x10,chassis=1,id=pci.1,bus=pcie.0,multifunction=on,addr=0x2 -device pcie-root-port,port=0x11,chassis=2,id=pci.2,bus=pcie.0,addr=0x2.0x1 -device pcie-root-port,port=0x12,chassis=3,id=pci.3,bus=pcie.0,addr=0x2.0x2 -device pcie-root-port,port=0x13,chassis=4,id=pci.4,bus=pcie.0,addr=0x2.0x3 -device pcie-root-port,port=0x14,chassis=5,id=pci.5,bus=pcie.0,addr=0x2.0x4 -device pcie-root-port,port=0x15,chassis=6,id=pci.6,bus=pcie.0,addr=0x2.0x5 -device pcie-root-port,port=0x16,chassis=7,id=pci.7,bus=pcie.0,addr=0x2.0x6 -device pcie-root-port,port=0x17,chassis=8,id=pci.8,bus=pcie.0,addr=0x2.0x7 -device qemu-xhci,p2=15,p3=15,id=usb,bus=pci.3,addr=0x0 -device virtio-serial-pci,id=virtio-serial0,bus=pci.4,addr=0x0 -blockdev {"driver":"file","filename":"/var/lib/libvirt/images/csr1000v-universalk9.17.02.01v.qcow2","node-name":"libvirt-1-storage","auto-read-only":true,"discard":"unmap"} -blockdev {"node-name":"libvirt-1-format","read-only":false,"driver":"qcow2","file":"libvirt-1-storage","backing":null} -device virtio-blk-pci,scsi=off,bus=pci.5,addr=0x0,drive=libvirt-1-format,id=virtio-disk0,bootindex=1 -netdev tap,fd=33,id=hostnet0,vhost=on,vhostfd=34 -device virtio-net-pci,netdev=hostnet0,id=net0,mac=52:54:00:69:ec:73,bus=pci.1,addr=0x0 -chardev pty,id=charserial0 -device isa-serial,chardev=charserial0,id=serial0 -chardev socket,id=charchannel0,fd=35,server,nowait -device virtserialport,bus=virtio-serial0.0,nr=1,chardev=charchannel0,id=channel0,name=org.qemu.guest_agent.0 -chardev spicevmc,id=charchannel1,name=vdagent -device virtserialport,bus=virtio-serial0.0,nr=2,chardev=charchannel1,id=channel1,name=com.redhat.spice.0 -spice port=5900,addr=127.0.0.1,disable-ticketing,image-compression=off,seamless-migration=on -device qxl-vga,id=video0,ram_size=67108864,vram_size=67108864,vram64_size_mb=0,vgamem_mb=16,max_outputs=1,bus=pcie.0,addr=0x1 -device vfio-pci,host=0000:5e:02.0,id=hostdev0,bus=pci.2,addr=0x0 -device vfio-pci,host=0000:5e:0a.0,id=hostdev1,bus=pci.8,addr=0x0 -sandbox on,obsolete=deny,elevateprivileges=deny,spawn=deny,resourcecontrol=deny -msg timestamp=on
```

使用pstree检查线程信息：

```bash
root@ubuntu-kvm:/home/ubuntu# pstree -p 8526
qemu-system-x86(8526)─┬─{qemu-system-x86}(8530)
                      ├─{qemu-system-x86}(8534)
                      ├─{qemu-system-x86}(8535)
                      ├─{qemu-system-x86}(8536)
                      ├─{qemu-system-x86}(8537)
                      ├─{qemu-system-x86}(8538)
                      ├─{qemu-system-x86}(8539)
                      ├─{qemu-system-x86}(8540)
                      ├─{qemu-system-x86}(8541)
                      ├─{qemu-system-x86}(8542)
                      ├─{qemu-system-x86}(8552)
```

使用gbd 调试进程，这里参考<https://www.cnblogs.com/hukey/p/11138768.html>

```bash
root@ubuntu-kvm:/home/ubuntu# gdb attach 8526
GNU gdb (Ubuntu 9.2-0ubuntu1~20.04) 9.2
Copyright (C) 2020 Free Software Foundation, Inc.
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.
Type "show copying" and "show warranty" for details.
This GDB was configured as "x86_64-linux-gnu".
Type "show configuration" for configuration details.
For bug reporting instructions, please see:
<http://www.gnu.org/software/gdb/bugs/>.
Find the GDB manual and other documentation resources online at:
    <http://www.gnu.org/software/gdb/documentation/>.

For help, type "help".
Type "apropos word" to search for commands related to "word".
Attaching to process 8526
[New LWP 8530]
[New LWP 8534]
[New LWP 8535]
[New LWP 8536]
[New LWP 8537]
[New LWP 8538]
[New LWP 8539]
[New LWP 8540]
[New LWP 8541]
[New LWP 8542]
[New LWP 8552]
[New LWP 250213]

warning: "target:/usr/bin/qemu-system-x86_64 (deleted)": could not open as an executable file: No such file or directory.

warning: `target:/usr/bin/qemu-system-x86_64 (deleted)': can't open to read symbols: No such file or directory.

warning: Could not load vsyscall page because no executable was specified
0x00007fdcda986bf6 in ?? ()
(gdb) info threads
  Id   Target Id                  Frame
* 1    LWP 8526 "qemu-system-x86" 0x00007fdcda986bf6 in ?? ()
  2    LWP 8530 "call_rcu"        0x00007fdcda98c89d in ?? ()
  3    LWP 8534 "IO mon_iothread" 0x00007fdcda986aff in ?? ()
  4    LWP 8535 "CPU 0/KVM"       0x00007fdcda98850b in ?? ()
  5    LWP 8536 "CPU 1/KVM"       0x00007fdcda98850b in ?? ()
  6    LWP 8537 "CPU 2/KVM"       0x00007fdcda98850b in ?? ()
  7    LWP 8538 "CPU 3/KVM"       0x00007fdcda98850b in ?? ()
  8    LWP 8539 "CPU 4/KVM"       0x00007fdcda98850b in ?? ()
  9    LWP 8540 "CPU 5/KVM"       0x00007fdcda98850b in ?? ()
  10   LWP 8541 "CPU 6/KVM"       0x00007fdcda98850b in ?? ()
  11   LWP 8542 "CPU 7/KVM"       0x00007fdcda98850b in ?? ()
  12   LWP 8552 "SPICE Worker"    0x00007fdcda986aff in ?? ()
  13   LWP 250213 "worker"        0x00007fdcdaa76618 in ?? ()
```

## Chapter 4 KVM 网络

本章节介绍了以下内容

- Virtual Network -- 阐述为什么需要虚拟网络。从虚拟交换机开始，设想一下如果没有虚拟交换机，有20个虚拟机需要20个物理接口连接至20个物理交换机的端口。引入虚拟交换机，减少服务器的物理接口和物理交换机的接口需求。
- Libvirt 的三类网络：NAT、Routed(Bridged)、Isolated；使用virsh net-dumpxml default输出xml文件。
- TUN/TAP设备：属于用户空间的设备，an application can open /dev/net/tun and use an ioctl() function to register a network device in the kernel, which, in turn, presents itself as a tunXX or tapXX device.  TUN设备是一个3层设备，TAP设备是一个2层设备。
- 简单介绍了Linux Bridge，此处可以使用ip link 命令替代brctl命令，并使用NetworkManager来持久化配置。
- Open vSwitch简单介绍
- SR-IOV的介绍：此处可以参考我自己的文档。
- MACVTAP介绍：It's a newer driver that should simplify our virtualized networking by completely removing tun/tap and bridge drivers with a single module.  有四种模式，VEPA，Bridge，Private和Pass-through。

## Chapter 5 KVM 存储

本章属于囫囵吞枣的看完了，一知半解的记录一下，大致了解了一些存储方面的概念和存储的最新发展。

### 存储资源池

CentOS支持的存储池种类如下：

- Logical Volume Manager (LVM)-based storage pools
- Directory-based storage pools
- Partition-based storage pools
- GlusterFS-based storage pools
- iSCSI-based storage pools
- Disk-based storage pools
- HBA-based storage pools, which use SCSI devices

对于libvirt来说，存储资源池可能是一个目录，一个存储设备，或者是一个文件。

介绍了两种文件系统：

- **Brtfs** is a type of filesystem that supports snapshots, RAID and LVM-like functionality, compression, defragmentation, online resizing, and many other advanced features. It was deprecated after it was discovered that its RAID5/6 can easily lead to a loss of data. --这里说的是Red Hat
- **ZFS** is a type of filesystem that supports everything that Brtfs does, plus read and write caching. **ZFS is not a part of the Linux kernel.**

### 本地存储池

Stratis是随RHEL 8引入的本地管理存储解决方案，它使系统管理员可以配置高级存储功能：

1. Pool-based management
2. Thin provisioning
3. File system snapshots
4. Monitoring

Stratis使用示例：

```bash
mdadm --create /dev/md0 --verbose --level=10 --raid-devices=4 /dev/sdb /dev/sdc /dev/sdd /dev/sde --spare-devices=1 /dev/sdf2
stratis pool create PacktStratisPool01 /dev/md0
stratis pool add-cache PacktStratisPool01 /dev/sdg
stratis fs create PackStratisPool01 PacktStratisXFS01
mkdir /mnt/packtStratisXFS01
mount /stratis/PacktStratisPool01/PacktStratisXFS01 /mnt/packtStratisXFS01
```

### Libvirt Storage Pool

Libvirt 支持多种Storage Pool，详见<https://libvirt.org/storage.html>

- Directory pool
- Filesystem pool
- Network filesystem pool
- Logical volume pool
- Disk pool
- iSCSI pool
- iSCSI direct pool
- SCSI pool
- Multipath pool
- RBD pool
- Sheepdog pool
- Gluster pool
- ZFS pool
- Vstorage pool

### NFS Storage Pool

NFS自上世纪80年代就出现了，至今依然活跃，尤其是4.2版本以后增强了不少功能；VMware Virtual Volume 6.0 可以提供基于Block和NFS的两种存储访问。

Libvirt 使用NFS Storage Pool示例，也可以使用virt-manager 图形界面创建：

```xml
<pool type='netfs'>
    <name>NFSpooll</name>
    <source>
        <host name='192.168.159.144' />
        <dir path='/mnt/packtStratisXF501' />
        <format type='auto'/>
    </source>
    <target>
        <path>/var/lib/libvirt/images/NFSpooll</path>
        <permissions>
            <mode>0755</mode>
            <owner>0</owner>
            <group>0</group>
            <label>system_u:object r:nfs t:s0</label>
        </permissions>
    </target>
</pool>
```

### iSCIS 和 SAN 存储

iSCIS协议有两个主要原因影响其高效性：

- **IP协议封装** iSCSI encapsulates SCSI commands into regular IP packages, which means segmentation and overhead as IP packages have a pretty large header, which means less efficiency.
- **基于TCP传输** Even worse, it's TCP-based, which means that there are sequence numbers and retransmissions, which can lead to queueing and latency, and the bigger the environment is, the more you usually feel these effects affect your virtual machine performance.

The iSCSI and FC architectures are very similar—they both need a target (an iSCSI target and an FC target) and an initiator (an iSCS initiator and an FC initiator)，the initiator connects to a target to get access to block storage that's presented via that target.

#### LUN的概念

LUNs are just raw, block capacities that we export via an iSCSI target toward initiators. LUNs are indexed, or numbered, usually from 0 onward. Every LUN number represents a different storage capacity that an initiator can connect to.

For example, we can have an iSCSI target with three different LUNs—LUN0 with 20 GB, LUN1 with 40 GB, and LUN2 with 60 GB. These will all be hosted on the same storage system's iSCSI target. We can then configure the iSCSI target to accept an IQN to see all the LUNs, another IQN to only see LUN1, and another IQN to only see LUN1 and LUN2. 

使用 targetcli命令创建iSCIS target，步骤简要说明如下：

1. 创建/dev/sdb1分区和XFS文件系统，并mount /dev/sdb1 /LUN0，用targetcli创建一个fileio 类型的target后端
2. 创建/dev/sdc1分区，并直接使用targetcli创建一个block类型的target后端
3. 基于/dev/sdd创建LVM，并使用targetcli创建一个block类型的target后端
4. 在KVM主机上设置好iscsi的initiator参数
5. 回到iSCSI上，创建ACL，允许KVM host，基于1~3创建的target发布LUNs
6. 在KVM Host上定义Storage Pool的XML文件，用virsh pool-define创建Storage Pool

### Storage redundancy and multipathing

避免单点故障SPOF，网卡、线缆、交换机、存储控制器等等。

KVM Host基于iSCSI做冗余和多路径的配置较为复杂，并且缺少支持，文章建议使用oVirt或者RHEV-H(Red Hat Enterprise Virtualization Hypervisor. )

使用oVirt 创建一个iSCSI Bond来实现冗余和多路径。

### Gluster

Gluster 是一个分布式文件系统，其突出优势是可扩展性，数据复制和快照功能；注意Gluster是一个文件存储服务。

生产环境中，Gluster至少配置三台服务器。

配置步骤简要说明如下：

1. 创建磁盘分区以及文件系统 

   ```bash
   mkfs.xfs /dev/sdb
   mkdir /gluster/bricks/1 -p
   echo '/dev/sdb /gluster/bricks/1 xfs defaults 0 0' >> /etc/
   fstab
   mount -a
   mkdir /gluster/bricks/1/brick
   ```

2. 创建Gluster分布式文件系统

   ```bash
   gluster volume create kvmgluster replica 3 \ gluster1:/gluster/
   bricks/1/brick gluster2:/gluster/bricks/1/brick \ gluster3:/
   gluster/bricks/1/brick
   gluster volume start kvmgluster
   gluster volume set kvmgluster auth.allow 192.168.159.0/24
   gluster volume set kvmgluster allow-insecure on
   gluster volume set kvmgluster storage.owner-uid 107
   gluster volume set kvmgluster storage.owner-gid 107
   ```

3. 挂在Gluster文件系统为NFS服务

   ```bash
   echo 'localhost:/kvmgluster /mnt glusterfs \ defaults,_
   netdev,backupvolfile-server=localhost 0 0' >> /etc/fstab
   mount.glusterfs localhost:/kvmgluster /mnt
   ```

4. 在KVM主机上挂在Gluster

   ```bash
   wget \ https://download.gluster.org/pub/gluster/glusterfs/6/
   LATEST/CentOS/gl\ usterfs-rhel8.repo -P /etc/yum.repos.d
   yum install glusterfs glusterfs-fuse attr -y
   mount -t glusterfs -o context="system_u:object_r:virt_
   image_t:s0" \ gluster1:/kvmgluster /var/lib/libvirt/images/
   GlusterFS
   ```

5. 在KVM上定义存储资源池：

   ```xml
   <pool type='dir'>
       <name>glusterfs-pool</name>
       <target>
           <path>/var/lib/libvirt/images/GlusterFS</path>
           <permissions>
               <mode>0755</mode>
               <owner>107</owner>
               <group>107</group>
               <label>system_u:object_r:virt_image_t:s0</label>
           </permissions>
       </target>
   </pool>
   ```

   ```bash
   virsh pool-define --file gluster.xml
   virsh pool-start --pool glusterfs-pool
   virsh pool-autostart --pool glusterfs-pool
   ```

将Gluster挂在为目录，可以避免Libvirt在使用Gluster的两个问题：

- We can use Gluster's failover capability, which will be managed automatically by the

  Gluster utilities that we installed directly, as libvirt doesn't support them yet.

- We will avoid creating virtual machine disks *manually*, which is another limitation of libvirt's implementation of Gluster support, while directory-based storage pools support it without any issues.

### Ceph

Ceph offers block and object-based storage. Object-based storage for block-based devices means direct, binary storage, directly to a LUN. There are no filesystems involved, which theoretically means less overhead as there's no filesystem, filesystem tables, and other constructs that might slow the I/O process down.

Architecture-wise, Ceph has three main services:

- ceph-mon : Used for cluster monitoring, CRUSH maps, and Object Storage Daemon (OSD) maps.
- ceph-osd: This handles actual data storage, replication, and recovery. It requires at least two nodes; we'll use three for clustering reasons.
- ceph-mds: Metadata server, used when Ceph needs filesystem access.

Ceph 集群中，所有的数据节点要求采用相同的硬件配置，相同的CPU、内存、硬盘，不适用RAID控制器，仅仅使用HBA。

```bash
ceph-deploy install ceph-admin ceph-monitor ceph-osd1 ceph-osd2
ceph-osd3
ceph-deploy mon create-initial
ceph-deploy gatherkeys ceph-monitor
ceph-deploy disk list ceph-osd1 ceph-osd2 ceph-osd3
ceph-deploy disk zap ceph-osd1:/dev/sdb  ceph-osd2:/dev/sdb
ceph-osd3:/dev/sdb
ceph-deploy osd prepare ceph-osd1:/dev/sdb ceph-osd2:/dev/sdb
ceph-osd3:/dev/sdb
ceph-deploy osd activate ceph-osd1:/dev/sdb1 ceph-osd2:/dev/
sdb1 ceph-osd3:/dev/sdb1
```

对上述命令的说明：

- The first command starts the actual deployment process—for the admin, monitor, and OSD nodes, with the installation of all the necessary packages.
- The second and third commands configure the monitor host so that it's ready to accept external connections.

- The two disk commands are all about disk preparation—Ceph will clear the disks that we assigned to it (/dev/sdb per OSD host) and create two partitions on them, one for Ceph data and one for the Ceph journal.
- The last two commands prepare these filesystems for use and activate Ceph. If at any time your ceph-deploy script stops, check your DNS and /etc/hosts and firewalld configuration, as that's where the problems usually are.

使用以下命令将Ceph存储发布给KVM主机作为存储池：

```bash
ceph osd pool create KVMpool 128 128
```

还需要几个步骤来实现安全的访问，为Ceph的访问增加密码验证。

1. Ceph生成验证的密码 Key

   ```bash
   ceph auth get-or-create client.KVMpool mon 'allow r' osd 'allow
   rwx pool=KVMpool'
   
   #It's going to throw us a status message, something like this:
   key = AQB9p8RdqS09CBAA1DHsiZJbehb7ZBffhfmFJQ==
   
   ```

2. 定义一个Secret

   ```xml
   <secret ephemeral='no' private='no'>
       <usage type='ceph'>
           <name>client.KVMpool secret</name>
       </usage>
   </secret>
   
   ```

   将Secret的UUID与Ceph生成的Key进行关联。

   ```bash
   virsh secret-define --file secret.xml
   
   Secret 95b1ed29-16aa-4e95-9917-c2cd4f3b2791 created
   
   virsh secret-set-value 95b1ed29-16aa-4e95-9917-c2cd4f3b2791
   AQB9p8RdqS09CBAA1DHsiZJbehb7ZBffhfmFJQ==
   ```

3. 定义Ceph存储池

   ```xml
   <pool type="rbd">
       <source>
           <name>KVMpool</name>
           <host name='192.168.159.151' port='6789'/>
           <auth username='KVMpool' type='ceph'>
               <secret uuid='95b1ed29-16aa-4e95-9917-c2cd4f3b2791'/>
           </auth>
       </source>
   </pool>
   ```

   ```bash
   virsh pool-define --file ceph.xml
   virsh pool-start KVMpool
   virsh pool-autostart KVMpool
   virsh pool-list --details
   ```

### 虚拟磁盘镜像和KVM存储基本操作

文章介绍了使用dd命令生成磁盘镜像文件，如下：

生成10G的预分配磁盘文件：

```bash
dd if=/dev/zero of=/vms/dbvm_disk2.img bs=1G count=10
```

生成10G的磁盘文件，使用seek关键字，不做预分配

```bash
dd if=/dev/zero of=/vms/dbvm_disk2_seek.imgbs=1G seek=10 count=0
```

#### qemu-img 命令

使用qemu-img info查看磁盘文件的信息，如下：

```bash
# qemu-img info /vms/dbvm_disk2.img
image: /vms/dbvm_disk2.img
file format: raw
virtual size: 10G (10737418240 bytes)
disk size: 10G
# qemu-img info /vms/dbvm_disk2_seek.img
image: /vms/dbvm_disk2_seek.img
file format: raw
virtual size: 10G (10737418240 bytes)
disk size: 10M
```

#### 使用virsh命令加载硬盘

```bash
virsh attach-disk CentOS8 /vms/dbvm_disk2.img vdb --live --config
```

说明如下：

-  **CentOS8** is the virtual machine to which a disk attachment is executed. 
- Then, there is the path of the disk image,  **/vms/dbvm_disk2.img**
- **vdb** is the target disk name that would be visible inside the guest operating system. 
- **--live** means performing the action while the virtual machine is running.
- **--config** means attaching it persistently across reboot. Not adding a --config switch will keep the disk attached only until reboot.

查看虚拟机的硬盘信息：

```bash
virsh domblklist CentOS8 --details

Type Device Target Source
------------------------------------------------
file disk vda /var/lib/libvirt/images/fedora21.qcow2
file disk vdb /vms/dbvm_disk2_seek.img
```

还有其他章节，比如创建ISO库、删除存储池、创建卷和删除卷。

#### 有关NVMe和NVMe over Fabric

SSD存储的存取方式发生改变，主要体现在性能和延时这两方面。传统**AHCI** (Advanced Host Controller Interface) 已不能满足SSD的性能要求。

**NVMe** (Non-Volatile Memory Express) 是一个全新的协议，基于PCIe技术，目的在于满足SSD的高性能、低时延的访问要求。越来越多的存储设备已经集成了SSD和NVMe，主要用于缓存，同时也有用于数据存储的。

Fiber Channel，虽然10多年被人争执说要从市场消失，主要原因无外乎：FC需要专用的交换机、专门的网卡和线缆，FC设备贵，需要专门的知识，而且FC的速率没有以太网发展快。

但是，目前市场上发生的情况有所不同，FC可以满足NVMe SSD带来的性能提升的需求。

Two of these concepts derived from **Intel Optane**—**Storage Class Memory (SCM) and Persistent Memory (PM)** are the latest technologies that storage companies and customers want adopted into their storage systems, and fast.

将工作负载移到内存当中是符合逻辑的，设想一下内存型数据库(Microsoft SQL, SAP HANA, Oracle).

如果一个存储厂商生产了使用SCM SSD的存储设备，那么只有内存可用于缓存(Cache).