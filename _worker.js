/**
 * Cloudflare Pages —— 高级模式后端（_worker.js）
 * 数据库：landcros-data，绑定变量名固定为 DB
 * 7 张表：customer / guarantor / seller / manufacturer / product / contract / AR-Ledger
 */

const DB_NAME = 'landcros-data';

// ========== 表配置 ==========
const TABLES = {
  customer: {
    label: '客户信息',
    icon: '客',
    pk: '序号',
    autoCode: { codeField: '客户代码', seqField: '序号', prefix: 'CD', width: 5 },
    dedupe: ['承租人证件号'],
    uniqueFields: ['承租人证件号'],
    searchFields: ['客户代码', '承租人', '承租人证件号', '联络人姓名', '承租人电话'],
    fields: [
      { name: '客户代码', label: '客户代码', type: 'text', auto: true, hint: '自动生成：CD+5位序号，导入时自动续编' },
      { name: '序号', label: '序号', type: 'int', auto: true, hint: '自动生成，新增/导入时自动加 1' },
      { name: '性质', label: '性质', type: 'select', options: ['企业', '个人'], default: '企业', required: true },
      { name: '承租人', label: '承租人（客户名称）', type: 'text', required: true },
      { name: '承租人证件号', label: '承租人证件号', type: 'text', required: true, hint: '统一社会信用代码/身份证号，按文本录入，全库唯一' },
      { name: '承租人地址', label: '承租人地址', type: 'text', required: true },
      { name: '承租人邮编', label: '承租人邮编', type: 'text', optional: true },
      { name: '承租人电话', label: '承租人电话', type: 'text', required: true },
      { name: '法人姓名', label: '法人姓名', type: 'text', required: true, disabledWhen: { field: '性质', value: '个人' }, hint: '性质为“个人”时无需填写（自动锁定）' },
      { name: '法人证件号', label: '法人证件号', type: 'text', required: true, disabledWhen: { field: '性质', value: '个人' }, hint: '身份证号请按文本录入，避免精度丢失' },
      { name: '法人电话', label: '法人电话', type: 'text', required: true, disabledWhen: { field: '性质', value: '个人' } },
      { name: '联络人姓名', label: '联络人姓名', type: 'text', required: true },
      { name: '联络人电话', label: '联络人电话', type: 'text', required: true },
      { name: '联络人职位', label: '联络人职位', type: 'text', requiredWhen: 'sublease' },
      { name: '付款负责人', label: '付款负责人', type: 'text', requiredWhen: 'sublease' }
    ],
    formNote: '1.【售后回租】客户：勾选后联络人职位、付款负责人必填；2. 性质选“个人”时，法人相关字段自动锁定无需填写。',
    toggle: { id: 'sublease', label: '该客户为【售后回租】客户（勾选后：联络人职位、付款负责人必填）' }
  },
  guarantor: {
    label: '担保人信息',
    icon: '保',
    pk: '序号',
    autoCode: { codeField: '担保人代码', seqField: '序号', prefix: 'DB', width: 5 },
    dedupe: ['担保人证件号/统一代码'],
    uniqueFields: ['担保人证件号/统一代码'],
    searchFields: ['担保人代码', '担保人/公司名', '担保联络人姓名', '担保人联系电话'],
    fields: [
      { name: '担保人代码', label: '担保人代码', type: 'text', auto: true, hint: '自动生成：DB+5位序号，导入时自动续编' },
      { name: '序号', label: '序号', type: 'int', auto: true, hint: '自动生成，新增/导入时自动加 1' },
      { name: '担保人性质', label: '担保人性质', type: 'select', options: ['企业', '个人'], default: '企业', required: true },
      { name: '担保人/公司名', label: '担保人/公司名', type: 'text', required: true },
      { name: '担保人证件号/统一代码', label: '担保人证件号/统一代码', type: 'text', required: true, hint: '全库唯一，重复无法导入/保存' },
      { name: '担保人/公司联系地址', label: '担保人/公司联系地址', type: 'text', required: true },
      { name: '担保人联系电话', label: '担保人联系电话', type: 'text', required: true },
      { name: '担保法人姓名', label: '担保法人姓名', type: 'text', required: true, disabledWhen: { field: '担保人性质', value: '个人' }, hint: '担保人性质为“个人”时无需填写（自动锁定）' },
      { name: '担保联络人姓名', label: '担保联络人姓名', type: 'text', required: true },
      { name: '担保联络人电话', label: '担保联络人电话', type: 'text', required: true }
    ],
    formNote: '全部字段必填；当【担保人性质】选择“个人”时，担保法人姓名自动锁定无需填写。'
  },
  seller: {
    label: '卖方信息',
    icon: '卖',
    pk: null,
    dedupe: ['卖方简称', '制造商'],
    uniqueFields: [],
    searchFields: ['卖方简称', '卖方名称', '制造商'],
    fields: [
      { name: '卖方简称', label: '卖方简称', type: 'text', required: true, hint: '同一卖方+同一制造商唯一' },
      { name: '卖方名称', label: '卖方名称', type: 'text', required: true },
      { name: '卖方地址', label: '卖方地址', type: 'text', required: true },
      { name: '制造商', label: '制造商', type: 'select', required: true, ref: { table: 'manufacturer', field: '制造商' } }
    ],
    formNote: '【售后回租】合同不需要卖方信息；同一卖方+同一制造商组合唯一。'
  },
  manufacturer: {
    label: '制造商及产品',
    icon: '造',
    pk: null,
    dedupe: ['制造商', '产品名称', '型号'],
    uniqueFields: [],
    searchFields: ['制造商', '产品名称', '型号'],
    fields: [
      { name: '制造商', label: '制造商', type: 'text', required: true },
      { name: '产品名称', label: '产品名称', type: 'text', required: true },
      { name: '型号', label: '型号', type: 'text', required: true }
    ],
    formNote: '制造商+产品名称+型号组合唯一，重复无法保存/导入。'
  },
  product: {
    label: '批量组编号',
    icon: '组',
    pk: null,
    dedupe: ['编号'],
    uniqueFields: ['编号'],
    searchFields: ['批量组编号', '产品编号', '编号'],
    fields: [
      { name: '批量组编号', label: '批量组编号', type: 'text', required: true },
      { name: '产品编号', label: '产品编号', type: 'textarea', required: true, hint: '多个编号可用“、”分隔' },
      { name: '编号', label: '编号', type: 'text', required: true, hint: '全库唯一，重复无法保存/导入' }
    ]
  },
  contract: {
    label: '合同信息',
    icon: '合',
    pk: '序号',
    autoCode: { seqField: '序号', codeField: null, prefix: '' },
    dedupe: ['编号'],
    uniqueFields: ['编号'],
    searchFields: ['编号', '承租人', '客户代码', '卖方简称', '合同号'],
    fields: [
      { name: '合同状态', label: '合同状态', type: 'select', options: ['未记帐', '记帐完毕'], default: '未记帐' },
      { name: '序号', label: '序号', type: 'int', auto: true, hint: '自动生成' },
      { name: '年度', label: '年度', type: 'int' },
      { name: '合同类型', label: '合同类型', type: 'select', options: ['新机', '回租'] },
      { name: '编号', label: '编号', type: 'text', required: true, unique: true, hint: '合同业务编号，与应收数据关联的 key，全库唯一' },
      { name: '合同制作人', label: '合同制作人', type: 'text' },
      { name: '卖方简称', label: '卖方简称', type: 'select', ref: { table: 'seller', field: '卖方简称' } },
      { name: '合同制作日', label: '合同制作日', type: 'date' },
      { name: '客户代码', label: '客户代码', type: 'select', ref: { table: 'customer', field: '客户代码' }, autofill: { target: '承租人', refTable: 'customer', keyField: '客户代码', valueField: '承租人' } },
      { name: '承租人', label: '承租人', type: 'text' },
      { name: '产品名称', label: '产品名称', type: 'select', ref: { table: 'manufacturer', field: '产品名称' } },
      { name: '产品编号', label: '产品编号', type: 'text' },
      { name: '型号', label: '型号', type: 'select', ref: { table: 'manufacturer', field: '型号' } },
      { name: '附属品', label: '附属品', type: 'text' },
      { name: '数量', label: '数量', type: 'int' },
      { name: '交付地', label: '交付地', type: 'text' },
      { name: '租赁开始日', label: '租赁开始日', type: 'date' },
      { name: '验收日', label: '验收日', type: 'date' },
      { name: '合同号', label: '合同号', type: 'text' },
      { name: '合同金额', label: '合同金额', type: 'money' },
      { name: '设备金额', label: '设备金额', type: 'money' },
      { name: '利率', label: '利率', type: 'percent', hint: '可填 3.75 或 0.0375，均按 3.75% 处理' },
      { name: '租赁利息', label: '租赁利息', type: 'money' },
      { name: '期数', label: '期数', type: 'int' },
      { name: '首付金额', label: '首付金额', type: 'money' },
      { name: '保证金', label: '保证金', type: 'money' },
      { name: '管理费', label: '管理费', type: 'money' },
      { name: '留购金', label: '留购金', type: 'money' },
      { name: '保证协议编号', label: '保证协议编号', type: 'text' },
      { name: '买卖/转卖合同编号', label: '买卖/转卖合同编号', type: 'text' },
      { name: '均等否', label: '均等否', type: 'select', options: ['是', '否'] },
      { name: '第三方担保否', label: '第三方担保否', type: 'select', options: ['有', '无'] },
      { name: '企业担保数', label: '企业担保数', type: 'int' },
      { name: '个人担保数', label: '个人担保数', type: 'int' },
      { name: '担保人代码1', label: '担保人代码1', type: 'select', ref: { table: 'guarantor', field: '担保人代码' } },
      { name: '担保人代码2', label: '担保人代码2', type: 'select', ref: { table: 'guarantor', field: '担保人代码' } },
      { name: '担保人代码3', label: '担保人代码3', type: 'select', ref: { table: 'guarantor', field: '担保人代码' } },
      { name: '担保人代码4', label: '担保人代码4', type: 'select', ref: { table: 'guarantor', field: '担保人代码' } },
      { name: '担保人代码5', label: '担保人代码5', type: 'select', ref: { table: 'guarantor', field: '担保人代码' } }
    ],
    formNote: '勾选合同后可批量标记/取消记帐：记帐完毕会同步把应收数据同合同号改为“记帐完毕”，取消记帐同步改回“未记帐”。',
    bulkStatus: [
      { label: '标记记帐完毕', from: '未记帐', to: '记帐完毕' },
      { label: '取消记帐', from: '记帐完毕', to: '未记帐' }
    ],
    linkTable: 'AR-Ledger',
    linkField: '合同编号',
    keyField: '编号'
  },
  'AR-Ledger': {
    label: '应收数据',
    icon: '收',
    pk: null,
    dedupe: ['合同编号', '款项类别', '期数', '应付日期'],
    uniqueFields: [],
    searchFields: ['合同编号', '承租人', '款项类别', '负责'],
    fields: [
      { name: '合同状态', label: '合同状态', type: 'select', options: ['未记帐', '记帐完毕', '还款中', '已结清'], default: '还款中' },
      { name: '负责', label: '负责', type: 'text' },
      { name: '承租人', label: '承租人', type: 'text' },
      { name: '合同类型', label: '合同类型', type: 'select', options: ['新机', '回租'] },
      { name: '合同编号', label: '合同编号', type: 'text', ref: { table: 'contract', field: '编号' } },
      { name: '租赁开始日', label: '租赁开始日', type: 'date' },
      { name: '款项类别', label: '款项类别', type: 'select', options: ['管理费', '首付款', '租金', '留购金', '保证金'] },
      { name: '期数', label: '期数', type: 'int' },
      { name: '应付日期', label: '应付日期', type: 'date' },
      { name: '合同应收金额', label: '合同应收金额', type: 'money' },
      { name: '应收本金金额', label: '应收本金金额', type: 'money' },
      { name: '应收利息金额', label: '应收利息金额', type: 'money' }
    ]
  }
};

// ========== 修正示例数据文字 ==========
function fixStatus(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(fixStatus);
  const out = {};
  for (const k of Object.keys(obj)) {
    let v = obj[k];
    if (k === '合同状态' && v === '未记账') v = '未记帐';
    out[k] = fixStatus(v);
  }
  return out;
}

// ========== 建表SQL ==========
const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS customer (
  客户代码 TEXT, 序号 INTEGER PRIMARY KEY, 性质 TEXT, 承租人 TEXT, 承租人证件号 TEXT,
  承租人地址 TEXT, 承租人邮编 TEXT, 承租人电话 TEXT, 法人姓名 TEXT, 法人证件号 TEXT,
  法人电话 TEXT, 联络人姓名 TEXT, 联络人电话 TEXT, 联络人职位 TEXT, 付款负责人 TEXT
);
CREATE TABLE IF NOT EXISTS guarantor (
  担保人代码 TEXT, 序号 INTEGER PRIMARY KEY, 担保人性质 TEXT, "担保人/公司名" TEXT,
  "担保人证件号/统一代码" TEXT, "担保人/公司联系地址" TEXT, 担保人联系电话 TEXT,
  担保法人姓名 TEXT, 担保联络人姓名 TEXT, 担保联络人电话 TEXT
);
CREATE TABLE IF NOT EXISTS seller (卖方简称 TEXT, 卖方名称 TEXT, 卖方地址 TEXT, 制造商 TEXT);
CREATE TABLE IF NOT EXISTS manufacturer (制造商 TEXT, 产品名称 TEXT, 型号 TEXT);
CREATE TABLE IF NOT EXISTS product (批量组编号 TEXT, 产品编号 TEXT, 编号 TEXT);
CREATE TABLE IF NOT EXISTS contract (
  合同状态 TEXT, 序号 INTEGER PRIMARY KEY, 年度 INTEGER, 合同类型 TEXT, 编号 TEXT,
  合同制作人 TEXT, 卖方简称 TEXT, 合同制作日 TEXT, 客户代码 TEXT, 承租人 TEXT,
  产品名称 TEXT, 产品编号 TEXT, 型号 TEXT, 附属品 TEXT, 数量 INTEGER, 交付地 TEXT,
  租赁开始日 TEXT, 验收日 TEXT, 合同号 TEXT, 合同金额 REAL, 设备金额 REAL, 利率 REAL,
  租赁利息 REAL, 期数 INTEGER, 首付金额 REAL, 保证金 REAL, 管理费 REAL, 留购金 REAL,
  保证协议编号 TEXT, "买卖/转卖合同编号" TEXT, 均等否 TEXT, 第三方担保否 TEXT,
  企业担保数 INTEGER, 个人担保数 INTEGER, 担保人代码1 TEXT, 担保人代码2 TEXT,
  担保人代码3 TEXT, 担保人代码4 TEXT, 担保人代码5 TEXT
);
CREATE TABLE IF NOT EXISTS "AR-Ledger" (
  合同状态 TEXT, 负责 TEXT, 承租人 TEXT, 合同类型 TEXT, 合同编号 TEXT, 租赁开始日 TEXT,
  款项类别 TEXT, 期数 INTEGER, 应付日期 TEXT, 合同应收金额 REAL, 应收本金金额 REAL, 应收利息金额 REAL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_idcard ON customer(承租人证件号);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guarantor_idcard ON guarantor("担保人证件号/统一代码");
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_unique ON seller(卖方简称, 制造商);
CREATE UNIQUE INDEX IF NOT EXISTS idx_manufacturer_unique ON manufacturer(制造商, 产品名称, 型号);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_code ON product(编号);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_no ON contract(编号);
`;

// ========== CORS和通用工具 ==========
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS }
  });
}
function csvResponse(rows, filename) {
  const BOM = '\uFEFF';
  if (!rows.length) return new Response(BOM + '无数据', { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` } });
  const headers = Object.keys(rows[0]);
  const esc = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const body = BOM + headers.join(',') + '\n' + rows.map(r => headers.map(h => esc(r[h])).join(',')).join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` } });
}
function quote(s) { return `"${String(s).replace(/"/g, '""')}"`; }
function colList(fields) { return fields.map(f => quote(f.name)).join(','); }
function placeholders(n) { return Array(n).fill('?').join(','); }
function parseVal(v, type) {
  if (v === '' || v === null || v === undefined) return null;
  if (type === 'int') return parseInt(v, 10) || 0;
  if (type === 'money') return parseFloat(String(v).replace(/,/g, '')) || 0;
  if (type === 'percent') { const n = parseFloat(v); return n > 1 ? n / 100 : n; }
  return String(v);
}
function nextAutoId(rows, seqField, prefix, width) {
  let max = 0;
  for (const r of rows) {
    const v = parseInt(String(r[seqField] || '0'), 10);
    if (v > max) max = v;
  }
  const next = max + 1;
  return prefix ? (prefix + String(next).padStart(width, '0')) : next;
}

// ========== 简易CSV解析 ==========
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (cur || row.length) row.push(cur); if (row.length) rows.push(row); row = []; cur = ''; if (c === '\r' && text[i+1] === '\n') i++; }
      else cur += c;
    }
  }
  if (cur || row.length) { row.push(cur); if (row.length) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(c => c && c.trim())).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}

// ========== 路由处理 ==========
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!env.DB) return json({ success: false, msg: '请先在 Pages 绑定 D1 数据库，变量名必须为 DB' }, 500);
    const db = env.DB;

    // 状态检测
    if (pathname === '/api/status') return json({ success: true, db: DB_NAME, tables: Object.keys(TABLES) });

    // 初始化数据库+示例数据
    if (pathname === '/api/init' && request.method === 'POST') {
      try {
        await db.exec(CREATE_SQL);
        // 导入示例数据
        const SEED = fixStatus({"tables":{"customer":[{"客户代码":"CD00001","序号":"1","性质":"企业","承租人":"东莞市立菱机电有限公司","承租人证件号":"91441900070221167M","承租人地址":"东莞市虎门镇赤岗富马二路3号12栋301室","承租人邮编":"523921","承租人电话":"0769-81882306","法人姓名":"蒋东","法人证件号":"","法人电话":"0769-81882306","联络人姓名":"王先进","联络人电话":"13728988903","联络人职位":"","付款负责人":""},{"客户代码":"CD00002","序号":"2","性质":"企业","承租人":"南京市航宏峻模具有限公司","承租人证件号":"91320114MAKCJALGXM","承租人地址":"南京市雨花台区凤华路18号5幢101室","承租人邮编":"211000","承租人电话":"","法人姓名":"陈伟","法人证件号":"","法人电话":"","联络人姓名":"韦美军","联络人电话":"15899920344","联络人职位":"","付款负责人":""},{"客户代码":"CD00003","序号":"3","性质":"企业","承租人":"广东何氏锐创智能装备有限公司","承租人证件号":"91441322781152778C","承租人地址":"广东省惠州市博罗县长宁镇广汕路南边双江村地段（罗浮国药东侧）","承租人邮编":"516133","承租人电话":"13923613783","法人姓名":"何考贤","法人证件号":"","法人电话":"13923613783","联络人姓名":"何容馨","联络人电话":"13923613783","联络人职位":"财务负责人","付款负责人":"何容馨"},{"客户代码":"CD00004","序号":"4","性质":"企业","承租人":"苏州诚亚工程机械有限公司","承租人证件号":"91320507576709928C","承租人地址":"相城区黄埭镇潘阳工业园太东路与高阳路交叉口","承租人邮编":"215143","承租人电话":"13856218180","法人姓名":"苏卿","法人证件号":"","法人电话":"13856218180","联络人姓名":"徐礼琴","联络人电话":"13913149845","联络人职位":"部长","付款负责人":"徐礼琴"}],"guarantor":[{"担保人代码":"DB00001","序号":"1","担保人性质":"企业","担保人/公司名":"东莞市展钢实业有限公司","担保人证件号/统一代码":"91441900557333873T","担保人/公司联系地址":"东莞市长安镇上角社区铜古中路 4 号 A 栋一、二、三楼","担保人联系电话":"0769-85319201","担保法人姓名":"韦美军","担保联络人姓名":"夏艳波","担保联络人电话":"13622669674"},{"担保人代码":"DB00002","序号":"2","担保人性质":"个人","担保人/公司名":"赖荣顺","担保人证件号/统一代码":"","担保人/公司联系地址":"广东省博罗县长宁镇圩镇向阳三巷25号","担保人联系电话":"13923613783","担保法人姓名":"","担保联络人姓名":"何容馨","担保联络人电话":"18948262320"},{"担保人代码":"DB00003","序号":"3","担保人性质":"个人","担保人/公司名":"何考贤","担保人证件号/统一代码":"","担保人/公司联系地址":"广东省博罗县长宁镇圩镇向阳三巷25号","担保人联系电话":"13923613783","担保法人姓名":"","担保联络人姓名":"何容馨","担保联络人电话":"18948262320"}],"seller":[{"卖方简称":"大菱机电","卖方名称":"东莞市大菱机电有限公司","卖方地址":"东莞市虎门镇赤岗富马二路3号12栋302室","制造商":"三菱电机大连机器有限公司"},{"卖方简称":"广东何氏","卖方名称":"广东何氏锐创智能装备有限公司","卖方地址":"广东省惠州市博罗县长宁镇广汕路南边双江村地段（罗浮国药东侧）","制造商":"三菱电机大连机器有限公司"}],"manufacturer":[{"制造商":"三菱电机大连机器有限公司","产品名称":"放电加工机","型号":"MG12"},{"制造商":"三菱电机大连机器有限公司","产品名称":"放电加工机","型号":"MG24"},{"制造商":"三菱电机大连机器有限公司","产品名称":"放电加工机","型号":"MV1200R"},{"制造商":"日立建机（中国）有限公司","产品名称":"液压挖掘机","型号":"ZX250H-5A"},{"制造商":"日立建机（中国）有限公司","产品名称":"液压挖掘机","型号":"ZX200-5A"},{"制造商":"日立建机（中国）有限公司","产品名称":"液压挖掘机","型号":"ZX240-5A"}],"product":[{"批量组编号":"组合-H26001","产品编号":"53DU1789、55D1U001、55D1U002、55D1U003、55D1U004、55D1U005、55D1U006、55D1U007、55D1U008、06D1U053","编号":"H26001"},{"批量组编号":"组合-H26004","产品编号":"DCYB0C101201、DCYB0J101625、DCYB0V101191","编号":"H26004"}],"contract":[{"合同状态":"未记帐","序号":"1","年度":"2026","合同类型":"新机","编号":"S26001","合同制作人":"顾寅恺","卖方简称":"大菱机电","合同制作日":"2026/9/15","客户代码":"CD00001","承租人":"东莞市立菱机电有限公司","产品名称":"放电加工机","产品编号":"06GT1028","型号":"MG12","附属品":"无","数量":"1","交付地":"东莞市虎门镇赤岗富马二路3号12栋301室","租赁开始日":"2026/9/25","验收日":"","合同号":"S26001-1","合同金额":"827002","设备金额":"780000","利率":"0.0375","租赁利息":"46502","期数":"36","首付金额":"0","保证金":"0","管理费":"600","留购金":"500","保证协议编号":"S26001-2","买卖/转卖合同编号":"S26001","均等否":"是","第三方担保否":"无","企业担保数":"","个人担保数":"","担保人代码1":"","担保人代码2":"","担保人代码3":"","担保人代码4":"","担保人代码5":""},{"合同状态":"未记帐","序号":"2","年度":"2026","合同类型":"新机","编号":"S26002","合同制作人":"顾寅恺","卖方简称":"大菱机电","合同制作日":"2026/9/17","客户代码":"CD00001","承租人":"东莞市立菱机电有限公司","产品名称":"放电加工机","产品编号":"06GT1033","型号":"MG12","附属品":"无","数量":"1","交付地":"东莞市虎门镇赤岗富马二路3号12栋301室","租赁开始日":"2026/9/25","验收日":"","合同号":"S26002-1","合同金额":"827002","设备金额":"780000","利率":"0.0375","租赁利息":"46502","期数":"36","首付金额":"0","保证金":"0","管理费":"600","留购金":"500","保证协议编号":"S26002-2","买卖/转卖合同编号":"S26002","均等否":"是","第三方担保否":"无","企业担保数":"","个人担保数":"","担保人代码1":"","担保人代码2":"","担保人代码3":"","担保人代码4":"","担保人代码5":""},{"合同状态":"未记帐","序号":"3","年度":"2026","合同类型":"新机","编号":"S26003","合同制作人":"顾寅恺","卖方简称":"大菱机电","合同制作日":"2026/9/17","客户代码":"CD00001","承租人":"东莞市立菱机电有限公司","产品名称":"放电加工机","产品编号":"56GT2018","型号":"MG24","附属品":"无","数量":"1","交付地":"东莞市虎门镇赤岗富马二路3号12栋301室","租赁开始日":"2026/11/10","验收日":"","合同号":"S26003-1","合同金额":"934446","设备金额":"880000","利率":"0.0375","租赁利息":"53946","期数":"36","首付金额":"0","保证金":"0","管理费":"600","留购金":"500","保证协议编号":"S26003-2","买卖/转卖合同编号":"S26003","均等否":"是","第三方担保否":"无","企业担保数":"","个人担保数":"","担保人代码1":"","担保人代码2":"","担保人代码3":"","担保人代码4":"","担保人代码5":""},{"合同状态":"未记帐","序号":"4","年度":"2026","合同类型":"新机","编号":"S26004","合同制作人":"沈佳佳","卖方简称":"大菱机电","合同制作日":"2026/9/17","客户代码":"CD00002","承租人":"南京市航宏峻模具有限公司","产品名称":"放电加工机","产品编号":"06GT2016","型号":"MG24","附属品":"无","数量":"1","交付地":"南京市雨花台区凤华路 18 号 5 幢 101室","租赁开始日":"2026/9/28","验收日":"","合同号":"S26004-1","合同金额":"937317","设备金额":"880000","利率":"0.045","租赁利息":"56817","期数":"36","首付金额":"88000","保证金":"0","管理费":"1000","留购金":"500","保证协议编号":"无","买卖/转卖合同编号":"S26004","均等否":"是","第三方担保否":"有","企业担保数":"1","个人担保数":"","担保人代码1":"DB00001","担保人代码2":"","担保人代码3":"","担保人代码4":"","担保人代码5":""},{"合同状态":"未记帐","序号":"5","年度":"2026","合同类型":"新机","编号":"S26005","合同制作人":"沈佳佳","卖方简称":"大菱机电","合同制作日":"2026/9/17","客户代码":"CD00002","承租人":"南京市航宏峻模具有限公司","产品名称":"放电加工机","产品编号":"06GT1034","型号":"MG12","附属品":"无","数量":"1","交付地":"南京市雨花台区凤华路 18 号 5 幢 101室","租赁开始日":"2026/9/28","验收日":"","合同号":"S26005-1","合同金额":"831022","设备金额":"780000","利率":"0.045","租赁利息":"50522","期数":"36","首付金额":"78000","保证金":"0","管理费":"1000","留购金":"500","保证协议编号":"无","买卖/转卖合同编号":"S26005","均等否":"是","第三方担保否":"有","企业担保数":"1","个人担保数":"","担保人代码1":"DB00001","担保人代码2":"","担保人代码3":"","担保人代码4":"","担保人代码5":""},{"合同状态":"未记帐","序号":"6","年度":"2026","合同类型":"回租","编号":"H26001","合同制作人":"顾寅恺","卖方简称":"广东何氏","合同制作日":"2026/9/21","客户代码":"CD00003","承租人":"广东何氏锐创智能装备有限公司","产品名称":"放电加工机","产品编号":"组合-H26001","型号":"MV1200R","附属品":"无","数量":"10","交付地":"广东省惠州市博罗县长宁镇广汕路南边双江村地段（罗浮国药东侧）","租赁开始日":"2026/9/22","验收日":"","合同号":"H26001","合同金额":"12594151","设备金额":"11950000","利率":"0.0376","租赁利息":"643651","期数":"24","首付金额":"0","保证金":"0","管理费":"0","留购金":"500","保证协议编号":"无","买卖/转卖合同编号":"HZ26001","均等否":"否","第三方担保否":"有","企业担保数":"","个人担保数":"2","担保人代码1":"DB00002","担保人代码2":"DB00003","担保人代码3":"","担保人代码4":"","担保人代码5":""},{"合同状态":"未记帐","序号":"7","年度":"2026","合同类型":"回租","编号":"H26002","合同制作人":"沈焱","卖方简称":"日立建机","合同制作日":"2026/10/27","客户代码":"CD00004","承租人":"苏州诚亚工程机械有限公司","产品名称":"液压挖掘机","产品编号":"DCYB2P300205","型号":"ZX250H-5A","附属品":"无","数量":"1","交付地":"苏州","租赁开始日":"2026/10/27","验收日":"","合同号":"H26002","合同金额":"174890","设备金额":"167400","利率":"0.04","租赁利息":"7090","期数":"24","首付金额":"0","保证金":"0","管理费":"0","留购金":"400","保证协议编号":"无","买卖/转卖合同编号":"HZ26002","均等否":"是","第三方担保否":"无","企业担保数":"","个人担保数":"","担保人代码1":"","担保人代码2":"","担保人代码3":"","担保人代码4":"","担保人代码5":""},{"合同状态":"未记帐","序号":"8","年度":"2026","合同类型":"回租","编号":"H26003","合同制作人":"沈焱","卖方简称":"日立建机","合同制作日":"2026/10/27","客户代码":"CD00004","承租人":"苏州诚亚工程机械有限公司","产品名称":"液压挖掘机","产品编号":"DCXB0H102775","型号":"ZX200-5A","附属品":"无","数量":"1","交付地":"苏州","租赁开始日":"2026/10/27","验收日":"","合同号":"H26003","合同金额":"174890","设备金额":"167400","利率":"0.04","租赁利息":"7090","期数":"24","首付金额":"0","保证金":"0","管理费":"0","留购金":"400","保证协议编号":"无","买卖/转卖合同编号":"HZ26003","均等否":"是","第三方担保否":"无","企业担保数":"","个人担保数":"","担保人代码1":"","担保人代码2":"","担保人代码3":"","担保人代码4":"","担保人代码5":""},{"合同状态":"未记帐","序号":"9","年度":"2026","合同类型":"回租","编号":"H26004","合同制作人":"沈焱","卖方简称":"日立建机","合同制作日":"2026/10/27","客户代码":"CD00004","承租人":"苏州诚亚工程机械有限公司","产品名称":"液压挖掘机","产品编号":"组合-H26004","型号":"ZX240-5A","附属品":"无","数量":"3","交付地":"苏州","租赁开始日":"2026/10/27","验收日":"","合同号":"H26004","合同金额":"763255","设备金额":"731465","利率":"0.04","租赁利息":"31290","期数":"24","首付金额":"0","保证金":"0","管理费":"0","留购金":"500","保证协议编号":"无","买卖/转卖合同编号":"HZ26004","均等否":"是","第三方担保否":"无","企业担保数":"","个人担保数":"","担保人代码1":"","担保人代码2":"","担保人代码3":"","担保人代码4":"","担保人代码5":""}],"AR-Ledger":[{"合同状态":"还款中","负责":"顾寅恺","承租人":"东莞市立菱机电有限公司","合同类型":"新机","合同编号":"S26001","租赁开始日":"2026/9/25","款项类别":"管理费","期数":"1","应付日期":"2026/9/17","合同应收金额":"600","应收本金金额":"0","应收利息金额":"0"},{"合同状态":"还款中","负责":"顾寅恺","承租人":"东莞市立菱机电有限公司","合同类型":"新机","合同编号":"S26001","租赁开始日":"2026/9/25","款项类别":"首付款","期数":"1","应付日期":"2026/9/25","合同应收金额":"0","应收本金金额":"0","应收利息金额":"0"},{"合同状态":"还款中","负责":"顾寅恺","承租人":"东莞市立菱机电有限公司","合同类型":"新机","合同编号":"S26001","租赁开始日":"2026/9/25","款项类别":"租金","期数":"1","应付日期":"2026/10/25","合同应收金额":"25002","应收本金金额":"22482.86","应收利息金额":"2519.14"},{"合同状态":"还款中","负责":"顾寅恺","承租人":"东莞市立菱机电有限公司","合同类型":"新机","合同编号":"S26001","租赁开始日":"2026/9/25","款项类别":"租金","期数":"2","应付日期":"2026/11/25","合同应收金额":"22900","应收本金金额":"20453.77","应收利息金额":"2446.23"},{"合同状态":"还款中","负责":"顾寅恺","承租人":"东莞市立菱机电有限公司","合同类型":"新机","合同编号":"S26001","租赁开始日":"2026/9/25","款项类别":"留购金","期数":"1","应付日期":"2029/9/25","合同应收金额":"500","应收本金金额":"0","应收利息金额":"500"},{"合同状态":"还款中","负责":"顾寅恺","承租人":"东莞市立菱机电有限公司","合同类型":"新机","合同编号":"S26002","租赁开始日":"2026/9/25","款项类别":"管理费","期数":"1","应付日期":"2026/9/17","合同应收金额":"600","应收本金金额":"0","应收利息金额":"0"}]}}).tables;
        let inserted = 0, skipped = 0;
        for (const tName of Object.keys(TABLES)) {
          const tConf = TABLES[tName];
          const tNameQuoted = quote(tName);
          const rows = SEED[tName] || [];
          for (const row of rows) {
            try {
              const fields = tConf.fields;
              const cols = fields.map(f => quote(f.name));
              const vals = fields.map(f => parseVal(row[f.name], f.type));
              await db.prepare(`INSERT OR IGNORE INTO ${tNameQuoted} (${cols.join(',')}) VALUES (${placeholders(fields.length)})`).bind(...vals).run();
              inserted++;
            } catch(e) { skipped++; }
          }
        }
        return json({ success: true, msg: `初始化完成：建表成功，示例数据插入 ${inserted} 条，跳过重复 ${skipped} 条` });
      } catch(e) { return json({ success: false, msg: '初始化失败：' + e.message }, 500); }
    }

    // 获取表配置
    if (pathname === '/api/tables') return json({ success: true, tables: TABLES });

    // 获取下拉选项
    if (pathname === '/api/options' && request.method === 'GET') {
      const tName = url.searchParams.get('table');
      const field = url.searchParams.get('field');
      if (!tName || !TABLES[tName]) return json({ success: false, msg: '表不存在' });
      try {
        const res = await db.prepare(`SELECT DISTINCT ${quote(field)} as val FROM ${quote(tName)} WHERE ${quote(field)} IS NOT NULL AND ${quote(field)} != '' ORDER BY val`).all();
        return json({ success: true, options: res.results.map(r => r.val) });
      } catch(e) { return json({ success: false, msg: e.message }); }
    }

    // ========== 列表查询 ==========
    const apiMatch = pathname.match(/^\/api\/([^\/]+)$/);
    if (apiMatch) {
      const tName = apiMatch[1];
      if (!TABLES[tName]) return env.ASSETS ? env.ASSETS.fetch(request) : json({ success: false, msg: '接口不存在' }, 404);
      const tConf = TABLES[tName];
      const tNameQuoted = quote(tName);

      // GET 列表查询/导出
      if (request.method === 'GET') {
        const exportCsv = url.searchParams.get('export') === '1';
        let where = [], params = [];
        // 通用关键词搜索
        const kw = url.searchParams.get('kw')?.trim();
        if (kw && tConf.searchFields) {
          where.push('(' + tConf.searchFields.map(f => `${quote(f)} LIKE ?`).join(' OR ') + ')');
          params.push(...tConf.searchFields.map(() => `%${kw}%`));
        }
        // 合同/应收：状态筛选
        if (tName === 'contract' || tName === 'AR-Ledger') {
          const status = url.searchParams.get('status');
          if (status) { where.push(`${quote('合同状态')} = ?`); params.push(status); }
          // 日期区间
          const start = url.searchParams.get('start');
          const end = url.searchParams.get('end');
          if (start) { where.push(`${quote('租赁开始日')} >= ?`); params.push(start); }
          if (end) { where.push(`${quote('租赁开始日')} <= ?`); params.push(end); }
        }
        const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
        // 合同/应收默认不返回全部数据，需要查询条件
        let countSql = `SELECT COUNT(*) as total FROM ${tNameQuoted} ${whereSql}`;
        let dataSql = `SELECT * FROM ${tNameQuoted} ${whereSql} ORDER BY rowid DESC LIMIT 500`;
        if ((tName === 'contract' || tName === 'AR-Ledger') && !where.length) {
          // 默认空结果
          if (exportCsv) return csvResponse([], `${tConf.label}_${new Date().toISOString().slice(0,10)}.csv`);
          return json({ success: true, rows: [], total: 0 });
        }
        try {
          const countRes = await db.prepare(countSql).bind(...params).first();
          const total = countRes?.total || 0;
          const dataRes = await db.prepare(dataSql).bind(...params).all();
          const rows = dataRes.results;
          if (exportCsv) return csvResponse(rows, `${tConf.label}_${new Date().toISOString().slice(0,10)}.csv`);
          return json({ success: true, rows, total });
        } catch(e) { return json({ success: false, msg: '查询失败：' + e.message }, 500); }
      }

      // POST 新增/导入
      if (request.method === 'POST') {
        const contentType = request.headers.get('content-type') || '';
        // CSV导入
        if (contentType.includes('multipart/form-data')) {
          try {
            const formData = await request.formData();
            const file = formData.get('file');
            if (!file) return json({ success: false, msg: '请选择CSV文件' }, 400);
            const text = await file.text();
            const csvRows = parseCSV(text);
            if (!csvRows.length) return json({ success: false, msg: 'CSV文件为空' });
            const fields = tConf.fields;
            // 先查现有数据去重
            const existRows = await db.prepare(`SELECT * FROM ${tNameQuoted}`).all();
            let inserted = 0, skipped = 0;
            // 获取当前最大序号
            let maxSeq = 0;
            if (tConf.autoCode) {
              const seqRes = await db.prepare(`SELECT MAX(${quote(tConf.autoCode.seqField)}) as max FROM ${tNameQuoted}`).first();
              maxSeq = seqRes?.max || 0;
            }
            for (const row of csvRows) {
              // 自动生成序号和代码
              const insertRow = {};
              for (const f of fields) insertRow[f.name] = row[f.name] || '';
              if (tConf.autoCode) {
                maxSeq += 1;
                insertRow[tConf.autoCode.seqField] = maxSeq;
                if (tConf.autoCode.codeField) {
                  insertRow[tConf.autoCode.codeField] = tConf.autoCode.prefix + String(maxSeq).padStart(tConf.autoCode.width, '0');
                }
              }
              // 去重检查
              let dup = false;
              if (tConf.dedupe) {
                for (const eRow of existRows.results) {
                  const match = tConf.dedupe.every(k => String(eRow[k] || '').trim() === String(insertRow[k] || '').trim() && insertRow[k]);
                  if (match) { dup = true; break; }
                }
              }
              if (dup) { skipped++; continue; }
              // 插入
              const cols = fields.map(f => quote(f.name));
              const vals = fields.map(f => parseVal(insertRow[f.name], f.type));
              try {
                await db.prepare(`INSERT OR IGNORE INTO ${tNameQuoted} (${cols.join(',')}) VALUES (${placeholders(fields.length)})`).bind(...vals).run();
                inserted++;
                existRows.results.push(insertRow);
              } catch(e) { skipped++; }
            }
            return json({ success: true, msg: `导入完成：成功 ${inserted} 条，跳过重复 ${skipped} 条`, inserted, skipped });
          } catch(e) { return json({ success: false, msg: '导入失败：' + e.message }, 500); }
        }
        // 单条新增
        const body = await request.json();
        try {
          const fields = tConf.fields;
          // 必填校验
          for (const f of fields) {
            if (f.required && !body[f.name] && !f.auto) {
              // 售后回租必填特殊处理
              if (f.requiredWhen === 'sublease' && !body.sublease) continue;
              return json({ success: false, msg: `【${f.label}】为必填项` }, 400);
            }
          }
          // 自动生成序号和代码
          if (tConf.autoCode) {
            const seqRes = await db.prepare(`SELECT MAX(${quote(tConf.autoCode.seqField)}) as max FROM ${tNameQuoted}`).first();
            const nextSeq = (seqRes?.max || 0) + 1;
            body[tConf.autoCode.seqField] = nextSeq;
            if (tConf.autoCode.codeField) {
              body[tConf.autoCode.codeField] = tConf.autoCode.prefix + String(nextSeq).padStart(tConf.autoCode.width, '0');
            }
          }
          const cols = fields.map(f => quote(f.name));
          const vals = fields.map(f => parseVal(body[f.name], f.type));
          await db.prepare(`INSERT INTO ${tNameQuoted} (${cols.join(',')}) VALUES (${placeholders(fields.length)})`).bind(...vals).run();
          return json({ success: true, msg: '新增成功' });
        } catch(e) {
          if (String(e.message).includes('UNIQUE')) return json({ success: false, msg: '新增失败：存在重复数据（唯一字段重复）' }, 400);
          return json({ success: false, msg: '新增失败：' + e.message }, 500);
        }
      }
    }

    // ========== 单条记录操作：/api/:table/:id ==========
    const idMatch = pathname.match(/^\/api\/([^\/]+)\/(.+)$/);
    if (idMatch) {
      const tName = idMatch[1];
      const idVal = decodeURIComponent(idMatch[2]);
      if (!TABLES[tName]) return json({ success: false, msg: '表不存在' }, 404);
      const tConf = TABLES[tName];
      const tNameQuoted = quote(tName);
      // 无主键表用rowid操作，这里简化用rowid，主键表用主键
      const pkField = tConf.pk || 'rowid';
      const pkQuoted = quote(pkField);

      // PUT 修改
      if (request.method === 'PUT') {
        const body = await request.json();
        try {
          const fields = tConf.fields.filter(f => !f.auto); // 自动字段不更新
          // 必填校验
          for (const f of fields) {
            if (f.required && !body[f.name]) {
              if (f.requiredWhen === 'sublease' && !body.sublease) continue;
              return json({ success: false, msg: `【${f.label}】为必填项` }, 400);
            }
          }
          const setSql = fields.map(f => `${quote(f.name)} = ?`).join(',');
          const vals = fields.map(f => parseVal(body[f.name], f.type));
          vals.push(idVal);
          await db.prepare(`UPDATE ${tNameQuoted} SET ${setSql} WHERE ${pkQuoted} = ?`).bind(...vals).run();
          return json({ success: true, msg: '修改成功' });
        } catch(e) {
          if (String(e.message).includes('UNIQUE')) return json({ success: false, msg: '修改失败：存在重复数据' }, 400);
          return json({ success: false, msg: '修改失败：' + e.message }, 500);
        }
      }

      // DELETE 删除
      if (request.method === 'DELETE') {
        try {
          await db.prepare(`DELETE FROM ${tNameQuoted} WHERE ${pkQuoted} = ?`).bind(idVal).run();
          return json({ success: true, msg: '删除成功' });
        } catch(e) { return json({ success: false, msg: '删除失败：' + e.message }, 500); }
      }

      // 批量状态更新 /api/contract/bulk-status
      if (tName === 'contract' && idVal === 'bulk-status' && request.method === 'POST') {
        try {
          const { ids, from, to } = await request.json();
          if (!ids?.length) return json({ success: false, msg: '请选择要操作的合同' });
          const placeholdersArr = placeholders(ids.length);
          // 更新合同状态
          await db.prepare(`UPDATE ${quote('contract')} SET ${quote('合同状态')} = ? WHERE ${quote('合同状态')} = ? AND ${quote('编号')} IN (${placeholdersArr})`).bind(to, from, ...ids).run();
          // 联动更新应收数据
          await db.prepare(`UPDATE ${quote('AR-Ledger')} SET ${quote('合同状态')} = ? WHERE ${quote('合同编号')} IN (${placeholdersArr})`).bind(to, ...ids).run();
          return json({ success: true, msg: `已将 ${ids.length} 条合同状态更新为「${to}」，对应应收数据已同步更新` });
        } catch(e) { return json({ success: false, msg: '批量更新失败：' + e.message }, 500); }
      }
    }

    // 静态资源返回
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not Found', { status: 404 });
  }
};
