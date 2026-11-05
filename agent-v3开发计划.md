# agent-v3 开发计划

2026-10-25。下一版律师办案网页的实现依据。当前已经走通的流程仍以《开发指导》和《平台流程》为准。本文件从那一套记录出发，定办理这一层怎么加上，以及记录里哪些只适合民事的部分收掉。

一个律师、一个账号、一件案子一条记录。律师用自然语言在这件案子上办事。模型提出结果，律师点头之后才写入。模型不另存一份案子。

## 1. 目标

民事、刑事、行政用同一套页面。种类只是案子上的标签。

记录负责留下确认过的内容。办理负责读材料、提出这一轮的结果。企查查、北大法宝、模型都读这一份记录，也只通过律师点头写回这一份记录。

关掉办理、检索、起草，从草稿走到归档仍然成立。

## 2. 记录

状态线不变：

```
草稿 → 待立案 → 办理中 → 结案中 → 已结案 → 已归档
```

草稿、待立案、办理中可以改为已终止。已归档可以解档，回到已结案。

待立案的意思是律师已经建档、还没开始办。页面上写明这句话。它不是法院立案，也不是公安机关立案。

导航仍是概览、材料、待办、文书、归档。办理中再多一个「办理」。

v3 使用自己的新库 `data/v3.sqlite`，不打开、不迁移 `data/law.sqlite`。旧库留给当前这一版。新库启动时是空的，不写入旧的种子案件。材料原件放在 `data/v3-files/`。一个案子一个库不做，全部案子仍在这一个新库里。

### 概览

留下客户、对方、办案机关、案由、基本事实、委托事项、种类、程序、案号。现在当事人第三列的文案是「法院」，改为「办案机关」。检察院、公安机关、复议机关放在这一列。

诉讼地位由律师填写，不再限定原告、被告、第三人、上诉人、被上诉人。

种类沿用现在的民事、刑事、行政诉讼、非诉专项、法律顾问、其他。种类不切换页面，不切换期限算法，不切换文书结构。

客户必须律师点明。材料里写着原告或被告人，不会自动建成客户。

已有的承办法官、审级、程序、另开下一程序留在概览，由律师填写。审级和程序允许律师写下清单以外的名称，例如侦查、审查起诉、复议、速裁、死刑复核。另开下一程序仍是一件新草稿，原案状态不变。

### 材料

原件永远留着。证明对象由律师写。

文字分三种状态：

| 状态 | 含义 |
| --- | --- |
| 没有可用文字 | 只有原件。模型只知道文件名、种类和证明对象 |
| 待核对 | 机器读出了文字，还不是事实 |
| 可用文字 | 律师看过或改过。模型和检索可以用 |

读错的字停在该材料旁边。不进基本事实，也不进已留下的要点。

### 待办

一条待办只有名称和到期日。律师确认后才出现在工作台的到期里。九十天内或已经过期的，仍出现在提示里。

法定期间不再由系统计算。答辩、上诉、保全那套推算，以及从裁判送达日、生效日带入期限，从办理里拿掉。裁判日期、送达日、生效日可以继续记在裁判文书上，只作为记录。

应收、实收律师费留下，计入工作台。诉讼时效按三年推算、利息、财产案件受理费，从待办页拿掉。

结案时每条待办仍要写下处理结果。

### 文书

焦点仍由律师写下，一条一句，确认后才能检索和起草。

自动抽出「请求、事实、金额、日期」拿掉，包括按工程名称、签证、金额、日期给句子分类。律师在办理里留下的要点记在本案上。要点不是检索和起草的闸门。

北大法宝的候选不入库。律师勾选后，原文快照收进本案，挂在对应焦点下。

起草只用收进来的出处。正文里的法条和案号逐条核对。对不上、又查不到的，标为疑似编造，这一版不能定稿。定稿不改变案件状态。

文书种类由律师填写。给模型的结构不再写死民事起诉状、原被告和致送法院。

### 归档

有实际办结结果，律师写下日期和具体情况，才进入结案中。办结结果由律师写。生效裁判、委托终止可以留在清单里。和解、撤诉不必单独占一项。

每条待办写下处理结果，保存并确认结案说明，再单独归档。归档后只供查阅。解档回到已结案，更正后再归档。

## 3. 数据结构

只建下面这些表。不建要素表，不建法定期间的起算和推算字段，不建北大法宝候选表。办理里还没点留下的那一轮不入库。

日期都是 `YYYY-MM-DD`。金额以元计，两位小数。空字符串表示还没填。`confirmed_at`、`archived_at` 为空表示还没确认。

```sql
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE matters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    '草稿', '待立案', '办理中', '结案中', '已结案', '已归档', '已终止'
  )),
  category TEXT NOT NULL DEFAULT '',
  cause TEXT NOT NULL,
  facts TEXT NOT NULL,
  mandate TEXT NOT NULL,
  case_number TEXT NOT NULL DEFAULT '',
  instance TEXT NOT NULL DEFAULT '',
  procedure TEXT NOT NULL DEFAULT '',
  parent_matter_id TEXT REFERENCES matters(id),
  fee_receivable REAL,
  fee_received REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE parties (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES matters(id),
  role TEXT NOT NULL CHECK (role IN ('client', 'opposing', 'organ')),
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT '',
  id_number TEXT NOT NULL DEFAULT '',
  client_id TEXT REFERENCES clients(id)
);

CREATE TABLE officers (
  matter_id TEXT PRIMARY KEY REFERENCES matters(id),
  judge TEXT NOT NULL DEFAULT '',
  assistant TEXT NOT NULL DEFAULT '',
  clerk TEXT NOT NULL DEFAULT '',
  division TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT ''
);

CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES matters(id),
  filename TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '',
  proves TEXT NOT NULL DEFAULT '',
  submitted_by TEXT REFERENCES parties(id),
  text_status TEXT NOT NULL CHECK (text_status IN ('没有可用文字', '待核对', '可用文字')),
  read_text TEXT NOT NULL DEFAULT '',
  usable_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (matter_id, filename)
);

CREATE TABLE rulings (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES matters(id),
  material_id TEXT NOT NULL UNIQUE REFERENCES materials(id),
  kind TEXT NOT NULL DEFAULT '',
  decided_on TEXT NOT NULL DEFAULT '',
  served_on TEXT NOT NULL DEFAULT '',
  effective_on TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES matters(id),
  name TEXT NOT NULL,
  due_on TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  confirmed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES matters(id),
  kind TEXT NOT NULL CHECK (kind IN ('时间线', '待核清单', '路径')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE focuses (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES matters(id),
  body TEXT NOT NULL,
  position INTEGER NOT NULL,
  confirmed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES matters(id),
  focus_id TEXT NOT NULL REFERENCES focuses(id),
  kind TEXT NOT NULL CHECK (kind IN ('law', 'case')),
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  retrieved_at TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  UNIQUE (focus_id, source_id)
);

CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES matters(id),
  kind TEXT NOT NULL,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  source_ids TEXT NOT NULL,
  warnings TEXT NOT NULL,
  final INTEGER NOT NULL DEFAULT 0,
  based_on INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE (matter_id, version)
);

CREATE TABLE closings (
  matter_id TEXT PRIMARY KEY REFERENCES matters(id),
  outcome TEXT NOT NULL,
  outcome_on TEXT NOT NULL,
  outcome_note TEXT NOT NULL,
  statement TEXT NOT NULL DEFAULT '',
  confirmed_at TEXT,
  archived_at TEXT
);

CREATE TABLE task_resolutions (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id),
  matter_id TEXT NOT NULL REFERENCES matters(id),
  result TEXT NOT NULL CHECK (result IN ('已完成', '不再适用')),
  note TEXT NOT NULL DEFAULT '',
  resolved_at TEXT NOT NULL
);

CREATE TABLE dossier_items (
  id TEXT PRIMARY KEY,
  matter_id TEXT NOT NULL REFERENCES matters(id),
  section TEXT NOT NULL,
  label TEXT NOT NULL,
  ref_id TEXT,
  position INTEGER NOT NULL
);
```

`parties.role` 的 `organ` 在页面上写成办案机关。`position` 是律师填写的诉讼地位。

`materials.read_text` 是机器读出的副本，对应待核对。`usable_text` 是律师确认后的文字。没有可用文字时两栏都空。模型和检索只读 `usable_text`。

`rulings` 只记裁判文书上的日期和结果，不参与待办计算。

`notes` 只在律师点留下时写入。`drafts.kind` 由律师填写，不限定文书种类。`drafts.source_ids` 和 `warnings` 存这一版用到的出处和核对结果。

`sources` 只存律师勾选后的原文快照。检索候选留在服务端内存里，过期即弃。

归档时按当时的材料、要点、出处、文书版本、待办和结案说明生成 `dossier_items`。解档删掉该案的目录行，不删其他表。

## 4. 材料怎么读

不是每份材料都读成文字。原件是证据。读出的文字是副本。

- 本来就是文字的，放进来时可以读出，状态为待核对。律师确认后成为可用文字。现在只收 `.txt`。这一版仍先收文本。PDF、Word 以后再加，加上之后也先落在待核对。
- 照片、扫描件、手写先只存原件，状态为没有可用文字。律师指定某一份时再读。读不出、读得断续，不补一句完整的话。
- 录音只存原件。转写若要做，结果是另一份待核对文字。录音仍是证据。

这一版不接图片识别和录音转写。页面先把「没有可用文字」和「指定后再读」留出来。

## 5. 办理

办理中才有这一页。其他状态写明还不能办理。

左边是本案材料，标出文字状态。中间是律师的一句话，和模型这一轮交出的结果。右边沿用活动：待确认、已完成。进行中这一列可以空着。

模型只读可用文字，以及律师写的证明对象、基本事实和委托事项。待核对的文字若被用到，相关句子标「待核实」，并且这一轮不能留下。没有可用文字的材料只提供文件名、种类和证明对象。

律师可以让它做这几类结果：

- 时间线
- 待核清单
- 可能的路径，民事、刑事、行政可以并列
- 文书底稿

给不出的标待核实，不补事实，不补法条。

律师点留下，才写入新库：

- 时间线、待核清单、路径，写入 `notes`
- 文书底稿写入 `drafts`，随后仍走核对和定稿

闲聊不进卷宗。留下之前刷新可以丢掉这一轮。留下之后，右边待确认或已完成里看得见。

模型仍只在 `lib/model.ts` 里调用，密钥仍是 `.env.local` 的 `DEEPSEEK_API_KEY`。办理这一页把对话和本案资料发给它。它不连接数据库，不自己调用北大法宝或企查查。

## 6. 外面的服务

| 服务 | 放在哪 | 写入 |
| --- | --- | --- |
| 企查查 | 只在创建卡。仍只准备在 `lib/qcc.ts` | 律师点明客户并创建之后，才有案子。这一版可以仍不接入 |
| 北大法宝 | 只在律师按焦点检索时。仍只在 `lib/pkulaw.ts` | 候选不入库。勾选后的原文快照写入出处 |
| 模型 | 办理和起草。仍只在 `lib/model.ts` | 点留下才写入要点或文书版本 |

检索句继续去掉本案当事人名称、证件号、电话和地址。没列进当事人的人，靠律师在检索句里不写姓名。

创建卡读文本时，每个读出的人单独一行。不把其余人用顿号收成一个对方。读不出当事人、案由或请求的，卡片空着，由律师填。不点明客户不创建。

## 7. 不做

不按民事、刑事、行政拆三套页面、三套期限或三套文书结构。

不把照片、手写、录音自动读成事实。

不把待核对的文字写入基本事实或要点。

不为每个案子计算诉讼时效、利息、财产案件受理费。

不把法定期间算成待办。

模型不另存一份案件，也不在起草或办理时自己检索。

仍不做：利冲、审批盖章、工时账单、人事会议室、与案件无关的聊天。

## 8. 开发顺序

沿用示踪弹。每一条都从律师能点的页面，写到这一份记录，再在页面上看得见。这一条没走通，不开下一条。

| 条 | 律师做的事 | 记录上留下什么 | 走通的样子 |
| --- | --- | --- | --- |
| 1 | 放入一份文字材料，并确认读出的文字 | 原件在，文字先待核对，确认后成为可用文字 | 未确认时，材料上写待核对。确认后写可用文字 |
| 2 | 记下一条只有名称和日期的待办，并确认 | 待办挂在本案 | 确认后出现在工作台到期里。页面上不再推算答辩、上诉、保全，也不再计算时效、利息、受理费 |
| 3 | 填写诉讼地位，并把第三列当作办案机关 | 当事人按律师写的地位保存 | 刑事的被告人、行政的复议机关可以写下。种类不改变这一页 |
| 4 | 在办理页说「先读材料」 | 这一轮先不入库 | 结果里有时间线、能证明的事实、单方说法、待核实。只用可用文字。待核对的句子标出来，留下按钮不可用 |
| 5 | 点留下这一轮的要点 | 要点挂在本案 | 刷新后还在。活动里看得见。基本事实不被这轮自动改写 |
| 6 | 再说「有哪几条路」，并留下 | 路径作为要点留下 | 民事、刑事、行政可以并列，都标待核验 |
| 7 | 留下一份文书底稿 | 写入 `drafts` | 随后的核对、疑似编造和定稿按本文件的文书规则。定稿后案子仍在办理中 |
| 8 | 丢进一份文本 | 创建卡上每人一行 | 不点明客户不创建。读不出就由律师填，不猜客户 |
| 9 | 按焦点检索并起草 | 只有勾选的出处进入起草 | 办理页不自己查法宝。文书种类由律师填写，结构不再写死民事 |

v3 只读写 `data/v3.sqlite`。旧库里的案子、待办和要素不导入。

## 9. 这一版先不接

图片识别、录音转写、PDF 和 Word。办理页上这些材料保持没有可用文字。

企查查。创建卡仍只显示文本里读出的统一社会信用代码。

代理跨案件办事。等办理留下和文书定稿走通，再让代理调用同一批接口。
