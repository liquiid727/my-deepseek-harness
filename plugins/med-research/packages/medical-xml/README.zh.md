# @medresearch/dsh-medical-xml

[English](README.md) | 中文

## 概述

Med Research 文档解析器（PubMed EFetch、JATS 全文）共用的有序 XML 读取器。`preserveOrder` 保留文档顺序，行内标签不会重排文本；属性随元素一起读取，不会在读取子节点时丢失。

## 范围

`parseOrderedXml`、`elementsOf`、`childrenOf`、`children`、`child`、`attrOf`、`textOf` 与 `XmlElement` 类型。不含领域知识，不做 IO。

## 模型影响

本包是解析工具，不注册任何模型表面。

## 已知限制与后续工作

- 保留混合内容顺序，但返回普通元素树：不做命名空间解析，也不做 `fast-xml-parser` 之外的 DTD/实体展开。
- 重复元素以列表返回，如何展平由调用方决定。
