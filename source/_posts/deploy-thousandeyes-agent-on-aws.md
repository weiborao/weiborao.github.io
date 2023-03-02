---
title: 在AWS上部署TE Agent并进行测试
date: 2021-06-17 21:00:00
tags: 
    - ThousandEyes
    - AWS
---

# ThousandEyes 简介

[ThousandEyes](https://www.thousandeyes.com/)是一个网络性能监控的SAAS云服务，结合了各种主动和被动的监控技术，让您深入了解您提供的以及您消费的应用和服务的用户体验。ThousandEyes使用的监控技术包括网络的可达性探测、时延、丢包、抖动、可视化的逐跳路径分析、可视化的BGP路由分析、DNS监控、HTTP服务监控等。ThousandEyes平台对这些监控收集而来的数据进行分析、交叉关联，将涉及用户体验的方方面面，包括网络和应用的状况统一的呈现在同一个界面之下，让您能够轻松的隔离问题，采取行动，从而快速的解决问题。

ThousandEyes提供了三种Agent进行网络和应用的探测，分别是Cloud Agent、Enterprise Agent和Endpoint Agent。Cloud Agent 由ThousandEyes在全球部署和维护，当前，ThousandEyes在全球200多个城市共部署了400多个[Cloud Agent](https://www.thousandeyes.com/product/cloud-agents)，可供全球用户使用。Enterprise Agent由用户自己部署，可以部署为虚拟机或者容器，可以安装在物理硬件，如Intel NCU或者树莓派中，支持Windows、Linux系统，还可以部署在思科或Juniper的网络设备中，也能通过CloudFormation在AWS云中自动部署。Endpoint Agent是浏览器插件，用户在访问网站时，可以自助的使用Endpoint Agent进行测试，由ThousandEyes进行数据分析，从而帮助用户快速了解其数字体验，以及快速定位问题所在。用户可以根据自己的需要来选择一种或多种Agent进行探测，ThousandEyes平台会自动完成分析和展现，提供网络和应用状况的洞见分析。

# 在AWS上部署TE Agent

## 了解部署过程

在正式部署之前，快速阅读了一下[AWS Deployment Guide](https://docs.thousandeyes.com/product-documentation/global-vantage-points/enterprise-agents/installing/iaas-enterprise-agent-deployment-amazon-aws)，部署过程是通过AWS的CloudFormation创建一个Stack，整个过程全部自动化。

部署的前提是需要设置好SSH Key-pair，VPC网络、公共子网、以及使用CloudFormation部署EC2的权限。

部署的内容包括：启动基于Ubuntu的EC2实例，并自动安装TE Agent，创建Security Group，并基于最小权限配置Inbound Rules。

## 准备SSH Key-pair

首先，在MAC电脑中，执行以下命令，用于创建一个RSA的秘钥对，并将公钥拷贝至桌面。

```bash
ssh-keygen -t rsa -b 4096 -f .ssh/aws_kp -m PEM
mv .ssh/aws_kp .ssh/aws_kp.pem
chmod 400 .ssh/aws_kp.pem
cp .ssh/aws_kp.pub ~/Desktop
```

登录AWS的Console管理界面后，选择Region，比如us-east-1，定位到EC2—Network Security—Key Pair，在界面右上侧的Actions下拉框中，选择Import key pair，将aws_kp.pub上传。

在其他的Region，重复上述动作，将key pair上传，这样在多个Region创建的EC2可以使用同一个私钥进行登录。

## 在AWS上部署TE Agent

部署TE Agent的操作路径为：在ThousandEyes的界面中，选择Cloud & Enterprise Agents，再选择Agent Settings，进一步选择Enterprise Agents，点击Add New Enterprise Agent。在右侧出现的界面中，选择IaaS Marketplaces，在该界面中点击Launch in AWS，跳转到AWS的登录界面，并自动进入CloudFormation的界面，该界面已将Stack模板选择好了。

Stack模板的链接：

[https://s3-us-west-1.amazonaws.com/oneclick-ea.aws.thousandeyes/aws-ea-oneclick.yaml](https://s3-us-west-1.amazonaws.com/oneclick-ea.aws.thousandeyes/aws-ea-oneclick.yaml)

该模板包含两个组件：EC2 Instance 和 Security Group。

按照上文的部署指南填写表单，并点击下一步，直至完成部署。

在完成安装后，可以使用私钥登录到虚机，注意：用户名为 ubuntu，不是ec2-user 或 root。

```bash
ssh -i .ssh/aws_kp.pem -v [ubuntu@](mailto:ubuntu@18.141.230.240)x.x.x.x
```

在两个不同的Region，us-east-1 和 ap-southeast-1 分别部署一个TE Agent。

大约5分钟后，即可在app.thousandeyes.com的界面中看到两个TE Agent上线。

# 执行Agent to Agent 测试

分别执行两种测试，一个是通过公网IP进行双向测试，一个是创建VPC Peering后，使用私有地址进行测试，比较两者之间的差异。

## 通过公网IP地址进行双向测试

在ThousandEyes的Agent Settings界面中，点击Agent，在右侧的网页中，选择Advanced Settings，将地址设置为Agent的公网IP地址。

在Test Settings中，选择Add New Test，Layer选择Network，Test Type选择Agent to Agent。

选择一个Agent作为Target，另一个Agent作为源，测试方向选择双向。

经过一段时间后，ThousandEyes上即可呈现测试结果。

测试持续了一个小时左右，测试结果如下：

**AWS us-east-1 to ap-southeast-1 Using Public IP**

| Items        | Result      |
| ------------ | ----------- |
| Loss         | 0%          |
| Latency      | 212ms       |
| Jitter       | <1ms        |
| Throughput   | 55Mbps      |

在可视化的路径分析图中，观察到如下信息：

1. 从us-east-1到ap-southeast-1往返，至少各有三条路径，每条路径显示的跳数约有20跳。
2. 该测试每隔2分钟测试一次，共测试了25次。在这25次中，鲜有路径一致的，有时候全程没有公共节点，有时候两条、甚至三条路径中间有公共节点。
3. 可视化路径中，从两侧的Agent出发，均有连续的5个或6个连续未知节点。这是由于这些节点不对Traceroute作出回应，导致路径中不可见。
4. 在整个可视化路径中，可见的公网节点的IP地址属于**AS 16509**或者**AS 14618**，这两个都是AWS的BGP AS域。其他节点的地址为100.65.x.x或100.100.x.x，这段地址属于**100.64.0.0/10**，为IANA保留地址，用于给运营商使用。由此可以推断，两个Agent之间通讯的报文并未离开过AWS的网络，这也解释了为何上述的时延、抖动是很稳定的值，并且整个测试期间，没有丢包。
5. 在可视化路径中，我还能发现有的路径是一段MPLS 隧道，并给出了转发时用到的Label值。ThousandEyes是如何发现路径中间有MPLS Tunnel呢？这个是值得仔细思考的问题。经查询，这是通过ThousandEyes的[专利技术Deep Path Analysis (DPA)](https://www.thousandeyes.com/pdf/ThousandEyes-Patents.pdf)实现的。

## 通过私网IP地址进行双向测试

本次测试的方法同上，只是需要将Agent的IP地址修改为使用私有IP地址，两个Region的VPC之间建立VPC Peering。

测试结果如下：

**AWS us-east-1 to ap-southeast-1 Using Private IP**

| Items      | Result |
| ---------- | ------ |
| Loss       | 0%     |
| Latency    | 212ms  |
| Jitter     | <1ms   |
| Throughput | 56Mbps |

在可视化的路径分析图中，观察到如下信息：

- 两个Agent之间是直连的，没有任何中间节点，两者之间时延为211ms。

做完两次测试，第二天检查了一下AWS的账单，预计花费了0.29美金。

## 测试结果的共享链接

[https://zwskwtsea.share.thousandeyes.com/](https://zwskwtsea.share.thousandeyes.com/)

[https://aieajezsh.share.thousandeyes.com/](https://aieajezsh.share.thousandeyes.com/)