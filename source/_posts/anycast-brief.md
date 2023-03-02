---
title: 有关AnyCast
date: 2021-07-06 14:00:00
tags: anycast
description: 
---

AnyCast，一组服务器拥有相同的IP地址，当客户端访问该组服务器时，网络会将请求发送至最近的服务器进行处理，从而极大的缩短途径的公网路径，减少延时、抖动、丢包的情况。

AnyCast通常和BGP路由协议关联在一起，其实现的主要原理是：位于不同地理位置的路由器向外发布同一段IP网段的BGP路由，路由在Internet中传播后，访问发起端所处网络的路由器会选择最短的BGP AS Path路由，从而实现最短路径的访问。如果BGP选路区分不出最近的路径，那就由IGP最短路径进行转发。

AnyCast的好处：

- 就近访问，减少时延、提升性能
- 获得高冗余性和可用性，即当任意目的节点异常时，可自动路由到就近目的节点
- 实现负载均衡，且对客户端是透明的（由网络路由实现）
- 缓解DDOS攻击，AnyCast将DDOS攻击流量引导至本地服务器，极大的减少了DDOS流量的范围以及规模

Office 365 的SharePoint使用了AnyCast，例如nslookup 解析[cisco.sharepoint.com](https://cisco.sharepoint.com)、[citrix.sharepoint.com](http://citrix.sharepoint.com)、[intel.sharepoint.com](http://intel.sharepoint.com) 得到相同的地址

```bash
➜  ~ nslookup cisco.sharepoint.com | tail -n 2 | grep Address
Address: 13.107.136.9
➜  ~ nslookup citrix.sharepoint.com | tail -n 2 | grep Address
Address: 13.107.136.9
➜  ~ nslookup intel.sharepoint.com | tail -n 2 | grep Address
Address: 13.107.136.9
➜  ~ nslookup nike.sharepoint.com | tail -n 2 | grep Address
Address: 13.107.136.9
➜  ~ nslookup bmw.sharepoint.com | tail -n 2 | grep Address
Address: 13.107.136.9
```

Telnet 至 route-views3.routeviews.org 查询13.107.136.9的路由，发现该地址命中的路由是13.107.136.0/24，从AS 8068 -- AS 8075发布出来，这都是Microsoft的AS号。

```
route-views3.routeviews.org> show bgp ipv4 13.107.136.9
BGP routing table entry for 13.107.136.0/24
Paths: (40 available, best #33, table default)
  Not advertised to any peer
  61568 8075 8068
    190.15.124.18 from 190.15.124.18 (190.15.124.18)
      Origin IGP, valid, external
      Last update: Mon Jul  5 21:13:03 2021
  202365 49697 8075 8068
    194.50.19.4 from 194.50.19.4 (185.1.166.50)
      Origin IGP, valid, external
      Community: 49697:3000 65101:1002 65102:1000 65103:276 65104:150
      Last update: Sun Jul  4 17:31:02 2021
  39120 8075 8068
    89.21.210.85 from 89.21.210.85 (195.60.191.13)
      Origin IGP, valid, external
      Last update: Sat Jul  3 20:46:17 2021
  40630 6939 8075 8068
    208.94.118.10 from 208.94.118.10 (208.94.118.10)
      Origin IGP, valid, external
      Community: 40630:100 40630:11701
      Last update: Mon Jul  5 19:14:13 2021
  54574 8075 8068
    154.18.7.114 from 154.18.7.114 (193.41.248.191)
      Origin IGP, valid, external
      Community: 54574:1000
      Last update: Wed Jun 30 02:40:58 2021
  39120 8075 8068
    89.21.210.86 from 89.21.210.86 (195.60.190.28)
      Origin IGP, valid, external
      Last update: Mon Jun 28 17:54:55 2021
  64116 7195 8075 8068
    45.183.45.1 from 45.183.45.1 (10.7.1.1)
      Origin IGP, valid, external
      Community: 7195:1000 7195:1001 7195:1300 7195:1302
      Last update: Fri Jul  2 00:44:52 2021
  54574 6461 8075 8068
    38.19.140.162 from 38.19.140.162 (193.41.248.193)
      Origin IGP, valid, external
      Community: 6461:5997 54574:2000 54574:6461
      Last update: Mon Jun 28 07:19:51 2021
  39351 8075 8068
    193.138.216.164 from 193.138.216.164 (193.138.216.164)
      Origin IGP, valid, external
      Last update: Fri Jun 25 20:17:33 2021
  202365 57866 8075 8068
    5.255.90.109 from 5.255.90.109 (185.255.155.66)
      Origin IGP, metric 0, valid, external
      Community: 57866:12 57866:304 57866:501
      Large Community: 57866:41441:41441
      Last update: Sun Jun 27 19:25:03 2021
  3216 12389 8075 8068
    195.239.252.124 from 195.239.252.124 (195.239.252.124)
      Origin IGP, valid, external
      Community: 3216:1000 3216:1077 3216:1101
      Last update: Thu Jun 24 09:16:54 2021
  3216 12389 8075 8068
    195.239.77.236 from 195.239.77.236 (195.239.77.236)
      Origin IGP, valid, external
      Community: 3216:1000 3216:1077 3216:1101
      Last update: Thu Jun 24 09:14:17 2021
  11537 8075 8068
    64.57.28.241 from 64.57.28.241 (64.57.28.241)
      Origin IGP, metric 17, valid, external
      Community: 11537:254 11537:3500 11537:5000 11537:5002 11537:5014
      Last update: Thu Jun 24 08:50:42 2021
  19653 8075 8068
    67.219.192.5 from 67.219.192.5 (67.219.192.5)
      Origin IGP, valid, external
      Last update: Wed Jun 30 11:14:51 2021
  14315 6453 6453 8075 8068
    104.251.122.1 from 104.251.122.1 (104.251.122.1)
      Origin IGP, valid, external
      Community: 14315:5000
      Last update: Tue Jun 22 10:36:25 2021
  38136 38008 8075 8068
    103.152.35.22 from 103.152.35.22 (103.152.35.22)
      Origin IGP, valid, external
      Community: 38008:103 65521:10
      Large Community: 38136:1000:11
      Last update: Tue Jun 22 07:22:58 2021
  17920 6939 8075 8068
    103.149.144.251 from 103.149.144.251 (103.149.144.251)
      Origin IGP, valid, external
      Community: 17920:1000 17920:1008
      Last update: Sat Jun 19 01:43:19 2021
  50236 34549 8075 8068
    2.56.9.2 from 2.56.9.2 (2.56.9.2)
      Origin IGP, valid, external
      Community: 34549:200 34549:10000 50236:10010
      Last update: Thu Jun 17 16:09:18 2021
  3280 39737 8075 8068
    77.83.243.7 from 77.83.243.7 (77.83.243.7)
      Origin IGP, valid, external
      Community: 39737:80 39737:2040
      Last update: Sat Jul  3 23:45:54 2021
  39120 8075 8068
    94.101.60.146 from 94.101.60.146 (94.161.60.146)
      Origin IGP, valid, external
      Last update: Fri Jun 18 15:06:50 2021
  207740 58057 8075 8068
    136.243.0.23 from 136.243.0.23 (136.243.0.23)
      Origin IGP, valid, external
      Last update: Tue Jun 22 18:11:37 2021
  38136 50131 53340 174 8075 8068
    172.83.155.50 from 172.83.155.50 (172.83.155.50)
      Origin IGP, valid, external
      Large Community: 38136:1000:17
      Last update: Tue Jun  8 08:24:12 2021
  40387 11537 8075 8068
    72.36.126.8 from 72.36.126.8 (72.36.126.8)
      Origin IGP, valid, external
      Community: 40387:1400
      Last update: Tue Jun  8 07:02:44 2021
  38136 57695 8075 8068
    170.39.224.212 from 170.39.224.212 (170.39.224.212)
      Origin IGP, valid, external
      Community: 57695:12000 57695:12002
      Large Community: 38136:1000:1
      Last update: Thu May 27 15:18:00 2021
  3561 209 3356 8075 8068
    206.24.210.80 from 206.24.210.80 (206.24.210.80)
      Origin IGP, valid, external
      Last update: Thu May 27 09:50:45 2021
  29479 50304 8075 8068
    109.233.62.1 from 109.233.62.1 (109.233.62.2)
      Origin IGP, valid, external
      Last update: Thu May 27 09:50:11 2021
  209 3356 8075 8068
    205.171.8.123 from 205.171.8.123 (205.171.8.123)
      Origin IGP, metric 8000051, valid, external
      Community: 209:88 209:888 3356:3 3356:22 3356:86 3356:575 3356:666 3356:901 3356:2057 3356:12341
      Last update: Thu May 27 09:48:26 2021
  14840 8075 8068
    186.211.128.32 from 186.211.128.32 (201.16.22.1)
      Origin IGP, valid, external
      Community: 14840:10 14840:40 14840:6004 14840:7110
      Last update: Wed Jun 23 00:56:13 2021
  209 3356 8075 8068
    205.171.200.245 from 205.171.200.245 (205.171.200.245)
      Origin IGP, metric 0, valid, external
      Community: 209:88 209:888 3356:3 3356:22 3356:86 3356:575 3356:666 3356:901 3356:2059 3356:10327
      Last update: Thu May 27 09:48:23 2021
  209 3356 8075 8068
    205.171.3.54 from 205.171.3.54 (205.171.3.54)
      Origin IGP, metric 8000036, valid, external
      Community: 209:88 209:888 3356:3 3356:22 3356:86 3356:575 3356:666 3356:901 3356:2011 3356:11918
      Last update: Thu May 27 09:48:17 2021
  23367 8075 8068
    64.250.124.251 from 64.250.124.251 (64.250.124.251)
      Origin IGP, valid, external
      Last update: Thu May 27 09:48:06 2021
  5650 8075 8068
    74.40.7.35 from 74.40.7.35 (74.40.0.100)
      Origin IGP, metric 0, valid, external
      Last update: Tue May 25 23:52:37 2021
  38001 8075 8068
    202.150.221.33 from 202.150.221.33 (10.11.33.29)
      Origin IGP, valid, external, best (Older Path)
      Community: 38001:420 38001:2406 38001:3001 38001:8009
      Last update: Fri May 21 11:01:01 2021
  6939 8075 8068
    64.71.137.241 from 64.71.137.241 (216.218.252.164)
      Origin IGP, valid, external
      Last update: Fri May 21 10:58:51 2021
  45352 8075 8068
    210.5.41.225 from 210.5.41.225 (210.5.40.186)
      Origin IGP, valid, external
      Last update: Fri May 21 10:57:46 2021
  3292 8075 8068
    195.215.109.247 from 195.215.109.247 (83.88.49.1)
      Origin IGP, valid, external
      Community: 3292:1100 3292:24500 3292:24580
      Last update: Wed Jun  9 23:59:27 2021
  3257 8075 8068
    89.149.178.10 from 89.149.178.10 (213.200.83.26)
      Origin IGP, metric 10, valid, external
      Community: 3257:4000 3257:8052 3257:50001 3257:50110 3257:54900 3257:54901
      Last update: Fri Jul  2 03:36:10 2021
  46450 8075 8068
    158.106.197.135 from 158.106.197.135 (158.106.197.135)
      Origin IGP, valid, external
      Community: 46450:31111
      Last update: Fri May 21 10:53:55 2021
  5645 8075 8068
    206.248.155.130 from 206.248.155.130 (206.248.155.130)
      Origin IGP, valid, external
      Community: no-advertise
      Last update: Fri May 21 10:53:54 2021
  55222 8075 8068
    162.211.99.255 from 162.211.99.255 (162.211.99.255)
      Origin IGP, valid, external
      Community: 55222:101 55222:200 55222:6001 55222:20020
      Last update: Fri May 21 10:53:45 2021
```

AnyCast 典型应用场景：

- DNS：
- CDN
- 负载均衡
- 分散DDOS攻击

Reference：

https://www.cnblogs.com/itzgr/p/10192799.html

https://www.imperva.com/blog/how-anycast-works/
