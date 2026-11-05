export const SEEDED_MATTER_ID = "matter-huajian";

export const SEEDED_CLIENT = {
  id: "client-huajian",
  name: "华建建设工程有限公司",
};

export const SEEDED_MATTER = {
  id: SEEDED_MATTER_ID,
  name: "华建建设与城东置业建设工程施工合同纠纷",
  status: "办理中",
  cause: "建设工程施工合同纠纷",
  createdAt: "2026-02-02",
};

export const SEEDED_PARTIES = [
  {
    id: "party-huajian-client",
    role: "client",
    name: SEEDED_CLIENT.name,
    clientId: SEEDED_CLIENT.id,
  },
  {
    id: "party-huajian-opposing",
    role: "opposing",
    name: "城东置业有限公司",
    clientId: null,
  },
  {
    id: "party-huajian-court",
    role: "court",
    name: "杭州市中级人民法院",
    clientId: null,
  },
] as const;

export const SEEDED_MATERIALS = [
  {
    id: "material-contract",
    filename: "建设工程施工合同.txt",
    createdAt: "2024-04-16",
    text: `建设工程施工合同

发包人：城东置业有限公司
承包人：华建建设工程有限公司
工程名称：城东望湖苑二期
签约日期：2024年4月16日

第一条 工程内容
承包人承包城东望湖苑二期住宅的土建及一般装饰工程。合同价款暂定为人民币 86,400,000 元。

第七条 工期
计划开工日期 2024年5月6日，计划竣工日期 2026年1月20日。

第十二条 工程款支付
发包人按已完工程量的 80% 支付进度款。竣工验收合格后付至结算价款的 97%，余款为质量保证金。`,
  },
  {
    id: "material-visa",
    filename: "工程签证单.txt",
    createdAt: "2025-11-03",
    text: `工程签证单

项目：城东望湖苑二期
签证编号：QZ-2025-014
日期：2025年11月3日

签证事项：地下室底板局部换填。
承包人申报金额：人民币 1,260,000 元。
发包人现场代表签署意见：工程量属实，价款以结算审核为准。`,
  },
  {
    id: "material-retainer",
    filename: "委托代理合同.txt",
    createdAt: "2026-01-20",
    text: `委托代理合同

委托人：华建建设工程有限公司
受托人：本所
签约日期：2026年1月20日

委托事项：就委托人与城东置业有限公司之间的建设工程施工合同纠纷，代为准备起诉材料、参加审理、进行调解，并领取相关法律文书。`,
  },
] as const;
