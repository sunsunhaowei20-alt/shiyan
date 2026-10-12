import type { Board, InstrumentSpec } from "./types";

export const UNIVERSE: InstrumentSpec[] = [
  {
    symbol: "600519",
    name: "贵州茅台",
    sector: "白酒",
    board: "main",
    tickSize: 0.01,
    lotSize: 100,
    prevClose: 1468,
    volatility: 0.28,
    drift: 0.06,
    spreadBps: 4,
    avgMinuteVolume: 8_000,
  },
  {
    symbol: "300750",
    name: "宁德时代",
    sector: "新能源",
    board: "chinext",
    tickSize: 0.01,
    lotSize: 100,
    prevClose: 268.4,
    volatility: 0.42,
    drift: 0.08,
    spreadBps: 6,
    avgMinuteVolume: 40_000,
  },
  {
    symbol: "600036",
    name: "招商银行",
    sector: "银行",
    board: "main",
    tickSize: 0.01,
    lotSize: 100,
    prevClose: 41.25,
    volatility: 0.22,
    drift: 0.05,
    spreadBps: 5,
    avgMinuteVolume: 220_000,
  },
  {
    symbol: "002594",
    name: "比亚迪",
    sector: "汽车",
    board: "main",
    tickSize: 0.01,
    lotSize: 100,
    prevClose: 105.6,
    volatility: 0.38,
    drift: 0.07,
    spreadBps: 6,
    avgMinuteVolume: 70_000,
  },
  {
    symbol: "601318",
    name: "中国平安",
    sector: "保险",
    board: "main",
    tickSize: 0.01,
    lotSize: 100,
    prevClose: 58.3,
    volatility: 0.26,
    drift: 0.04,
    spreadBps: 5,
    avgMinuteVolume: 90_000,
  },
  {
    symbol: "601012",
    name: "隆基绿能",
    sector: "光伏",
    board: "main",
    tickSize: 0.01,
    lotSize: 100,
    prevClose: 16.84,
    volatility: 0.48,
    drift: 0.02,
    spreadBps: 8,
    avgMinuteVolume: 180_000,
  },
  {
    symbol: "688981",
    name: "中芯国际",
    sector: "半导体",
    board: "star",
    tickSize: 0.01,
    lotSize: 100,
    prevClose: 92.5,
    volatility: 0.5,
    drift: 0.09,
    spreadBps: 8,
    avgMinuteVolume: 55_000,
  },
  {
    symbol: "603259",
    name: "药明康德",
    sector: "医药",
    board: "main",
    tickSize: 0.01,
    lotSize: 100,
    prevClose: 72.4,
    volatility: 0.4,
    drift: 0.03,
    spreadBps: 7,
    avgMinuteVolume: 45_000,
  },
  {
    symbol: "600900",
    name: "长江电力",
    sector: "公用",
    board: "main",
    tickSize: 0.01,
    lotSize: 100,
    prevClose: 27.65,
    volatility: 0.16,
    drift: 0.04,
    spreadBps: 4,
    avgMinuteVolume: 120_000,
  },
  {
    symbol: "510300",
    name: "沪深300ETF",
    sector: "指数",
    board: "etf",
    tickSize: 0.001,
    lotSize: 100,
    prevClose: 4.512,
    volatility: 0.18,
    drift: 0.05,
    spreadBps: 3,
    avgMinuteVolume: 2_400_000,
  },
  {
    symbol: "159915",
    name: "创业板ETF",
    sector: "指数",
    board: "etf",
    tickSize: 0.001,
    lotSize: 100,
    prevClose: 2.186,
    volatility: 0.24,
    drift: 0.06,
    spreadBps: 4,
    avgMinuteVolume: 1_800_000,
  },
  {
    symbol: "518880",
    name: "黄金ETF",
    sector: "商品",
    board: "etf",
    tickSize: 0.001,
    lotSize: 100,
    prevClose: 6.042,
    volatility: 0.14,
    drift: 0.03,
    spreadBps: 4,
    avgMinuteVolume: 900_000,
  },
];

export function limitPercent(board: Board) {
  return board === "chinext" || board === "star" ? 0.2 : 0.1;
}

export function boardLabel(board: Board) {
  switch (board) {
    case "main":
      return "主板";
    case "chinext":
      return "创业板";
    case "star":
      return "科创板";
    case "etf":
      return "ETF";
  }
}

interface Headline {
  text: string;
  shock: number;
  symbol?: string;
  sector?: string;
}

export const HEADLINES: Headline[] = [
  { symbol: "600519", shock: 0.018, text: "渠道反馈飞天批价回升，白酒板块情绪转暖" },
  { symbol: "600519", shock: -0.016, text: "宴席需求不及预期，资金减持高端白酒" },
  { symbol: "300750", shock: 0.025, text: "欧洲储能订单落地，宁德时代能见度上修" },
  { symbol: "300750", shock: -0.02, text: "碳酸锂价格波动，动力电池链条承压" },
  { sector: "银行", shock: 0.012, text: "南向资金净买入银行，高股息资产获配置" },
  { sector: "银行", shock: -0.01, text: "净息差担忧再起，银行股短线回吐" },
  { symbol: "002594", shock: 0.022, text: "出口装船数据超预期，比亚迪海外销量提速" },
  { symbol: "002594", shock: -0.018, text: "价格战传闻扰动，汽车股分歧加大" },
  { symbol: "601318", shock: 0.014, text: "寿险新业务价值改善，保险股集体走强" },
  { symbol: "601012", shock: -0.028, text: "组件价格续跌，光伏制造环节利润受挤压" },
  { symbol: "601012", shock: 0.02, text: "分布式备案回暖，光伏板块尝试反弹" },
  { symbol: "688981", shock: 0.03, text: "先进制程产能利用率提升，半导体链条联动" },
  { symbol: "688981", shock: -0.022, text: "外部限制预期升温，芯片股波动加剧" },
  { symbol: "603259", shock: -0.02, text: "创新药投融资放缓，CXO 板块调整" },
  { symbol: "603259", shock: 0.018, text: "海外订单恢复，医药外包情绪修复" },
  { symbol: "600900", shock: 0.008, text: "来水偏丰，电力运营商分红预期稳定" },
  { sector: "指数", shock: -0.012, text: "外围风险偏好下降，宽基 ETF 跟随回落" },
  { sector: "指数", shock: 0.011, text: "权重股拉升，宽基 ETF 放量上攻" },
  { symbol: "518880", shock: 0.01, text: "实际利率下行，黄金 ETF 获得避险买盘" },
  { symbol: "518880", shock: -0.009, text: "美元走强，黄金短线承压" },
];
