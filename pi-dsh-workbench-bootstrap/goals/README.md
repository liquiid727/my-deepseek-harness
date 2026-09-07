# Goal-Spec Delivery System

English | [中文](README.zh.md)

每一个开发目标使用独立目录：

```text
goals/
└── GOAL-XXX-name/
    ├── goal.md
    ├── spec.md
    ├── test.md
    ├── evidence.md
    └── decision.md
```

## Meaning

### goal.md

回答：

> 用户 / 产品到底要完成什么？

避免技术实现细节主导目标。

### spec.md

回答：

> 我们准备怎么实现？

包含架构、接口、状态、数据流、限制、技术边界和交付物。

### test.md

回答：

> 什么情况才算真的完成？

尽量使用 Given / When / Then 与明确 Acceptance Criteria。

### evidence.md

回答：

> 有什么真实证据证明已经完成？

包括：

- code
- test
- command
- screenshot
- demo
- commit
- known issues

### decision.md

回答：

> 为什么这样做？

记录重要架构选择与实际实现中发生的变化。

---

## Rule

开发流程：

```text
GOAL
↓
SPEC
↓
IMPLEMENT
↓
TEST
↓
EVIDENCE
↓
DECISION UPDATE
↓
DONE
```

不能只因为“代码已经写完”就把 Goal 标记为 Done。
