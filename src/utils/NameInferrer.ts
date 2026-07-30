/**
 * NameInferrer — infers resource names and API identifiers
 * from component labels, attributes, and content.
 */

import type { ComponentInfo } from '../types';

/**
 * Infer a REST resource name from a component's context.
 */
export function inferResourceName(comp: ComponentInfo, mode: 'list' | 'create' | 'detail' | 'update'): string {
  const attrs = comp.attributes;

  // 1. Explicit user intent via data-* attributes
  if (attrs['data-resource']) return attrs['data-resource'];
  if (attrs['data-api']) return attrs['data-api'];

  // 2. User-set name attribute (more meaningful than auto-generated id)
  if (attrs['name']) return attrs['name'];

  // 3. Infer from component label (heading text near the component)
  if (comp.label) {
    return labelToResource(comp.label);
  }

  // 4. Check component's own text content
  if (comp.content) {
    return labelToResource(comp.content);
  }

  // 5. Use id as last resort (may be GrapesJS auto-generated)
  if (attrs['id']) return attrs['id'];

  // 6. Default fallback
  return 'resource';
}

/** Simple pinyin abbreviation for common Chinese business field names */
function chineseToPinyinAbbr(chinese: string): string {
  const charMap: Record<string, string> = {
    '供': 'gong', '应': 'ying', '商': 'shang', '名': 'ming', '称': 'cheng',
    '部': 'bu', '门': 'men', '职': 'zhi', '位': 'wei', '员': 'yuan',
    '工': 'gong', '客': 'ke', '户': 'hu', '厂': 'chang', '店': 'dian',
    '仓': 'cang', '库': 'ku', '品': 'pin', '牌': 'pai', '规': 'gui',
    '格': 'ge', '颜': 'yan', '色': 'se', '尺': 'chi', '寸': 'cun',
    '材': 'cai', '质': 'zhi', '重': 'zhong', '量': 'liang', '体': 'ti',
    '积': 'ji', '长': 'chang', '宽': 'kuan', '高': 'gao', '深': 'shen',
    '厚': 'hou', '直': 'zhi', '径': 'jing', '半': 'ban', '周': 'zhou',
    '面': 'mian', '密': 'mi', '度': 'du', '温': 'wen', '湿': 'shi',
    '压': 'ya', '力': 'li', '速': 'su', '频': 'pin', '率': 'lv',
    '电': 'dian', '流': 'liu', '功': 'gong', '能': 'neng',
    '单': 'dan', '总': 'zong', '平': 'ping', '均': 'jun', '最': 'zui',
    '大': 'da', '小': 'xiao', '多': 'duo', '少': 'shao', '全': 'quan',
    '新': 'xin', '旧': 'jiu', '上': 'shang', '下': 'xia', '前': 'qian',
    '后': 'hou', '左': 'zuo', '右': 'you', '内': 'nei', '外': 'wai',
    '是': 'shi', '否': 'fou', '无': 'wu', '有': 'you',
  };
  return Array.from(chinese).map(c => charMap[c] || '').join('') || '';
}

/**
 * Convert a display label to a REST resource name.
 * e.g. "用户管理" → "users", "商品列表" → "products"
 */
function labelToResource(label: string): string {
  // Common Chinese → English mappings.
  // Uses longest-match-wins: finds the pattern with the longest matching substring
  // so "用户反馈" matches /反馈/ (comments) not /用户/ (users).
  const mappings: Array<[RegExp, string]> = [
    [/用户反馈|用户评论/i, 'comments'],     // specific: longer match before /用户/
    [/会员等级|用户等级|等级/i, 'levels'],    // specific: before /用户/
    [/收货地址|地址/i, 'addresses'],
    [/数据字典|字典/i, 'dicts'],
    [/交易记录|交易/i, 'orders'],            // longer '交易记录' before '交易'
    [/操作日志|日志/i, 'logs'],
    [/消息通知|消息/i, 'notifications'],
    [/计划任务|定时任务/i, 'crons'],
    [/问题反馈|工单/i, 'tickets'],
    [/用户|会员|账号/i, 'users'],
    [/商品|产品|货物/i, 'products'],
    [/订单|交易/i, 'orders'],
    [/文章|帖子|新闻|公告/i, 'articles'],
    [/评论|留言|反馈|意见/i, 'comments'],
    [/分类|类型|品类/i, 'categories'],
    [/标签/i, 'tags'],
    [/图片|相册/i, 'images'],
    [/文件|附件|文档/i, 'files'],
    [/角色/i, 'roles'],
    [/权限/i, 'permissions'],
    [/部门|科室/i, 'departments'],
    [/菜单/i, 'menus'],
    [/配置|设置|系统设置/i, 'settings'],
    [/通知/i, 'notifications'],
    [/优惠券/i, 'coupons'],
    [/活动|促销/i, 'activities'],
    [/任务|待办/i, 'tasks'],
    [/项目/i, 'projects'],
    [/报表|统计|分析/i, 'reports'],
    [/客户/i, 'customers'],
    [/供应商/i, 'suppliers'],
    [/库存/i, 'inventory'],
    [/发票/i, 'invoices'],
    [/支付|付款/i, 'payments'],
    [/物流|快递|配送/i, 'logistics'],
    [/轮播|banner|幻灯片/i, 'banners'],
    [/登录|注册|认证|授权/i, 'auth'],
    [/仪表盘|仪表板|概览/i, 'dashboard'],
    [/审核|审批/i, 'approvals'],
    [/模板/i, 'templates'],
    [/草稿/i, 'drafts'],
    [/收藏|收藏夹/i, 'favorites'],
    [/回收站|回收/i, 'trash'],
    [/品牌/i, 'brands'],
    [/规格|SKU/i, 'specs'],
    [/退款|退货/i, 'refunds'],
    [/评分|评价/i, 'reviews'],
    [/购物车/i, 'cart'],
    [/搜索/i, 'search'],
    [/订阅/i, 'subscriptions'],
    [/合同|协议/i, 'contracts'],
    [/版本/i, 'versions'],
    [/渠道/i, 'channels'],
    [/区域|地区/i, 'regions'],
    [/课程/i, 'courses'],
    [/学生/i, 'students'],
    [/教师|老师/i, 'teachers'],
    [/医生/i, 'doctors'],
    [/患者|病人/i, 'patients'],
    [/预约/i, 'appointments'],
    [/处方/i, 'prescriptions'],
    [/病历/i, 'medical-records'],
    [/积分/i, 'points'],
    [/线索/i, 'leads'],
    [/房源|房产/i, 'properties'],
    [/备份/i, 'backups'],
    [/监控/i, 'monitors'],
    [/插件/i, 'plugins'],
    [/会话|session/i, 'sessions'],
    [/token|令牌/i, 'tokens'],
    [/验证码/i, 'captchas'],
    [/黑名单|白名单/i, 'blacklist'],
  ];

  let bestResource = '';
  let bestLen = 0;
  for (const [pattern, resource] of mappings) {
    const match = label.match(pattern);
    if (match && match[0].length > bestLen) {
      bestLen = match[0].length;
      bestResource = resource;
    }
  }
  if (bestResource) return bestResource;

  // Fallback: sanitize the label as-is
  return label
    .replace(/[^a-zA-Z0-9一-鿿]/g, '_')
    .replace(/管理|列表|详情|页面|模块/g, '')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .substring(0, 30) || 'resource';
}

/**
 * Convert a column header name to API field name.
 */
export function columnToFieldName(colName: string): string {
  const lower = colName.trim();

  const mapping: Record<string, string> = {
    'id': 'id', 'ID': 'id', '序号': 'id', '编号': 'id',
    '用户名': 'username', '用户': 'username', '账号': 'account',
    '登录名': 'loginName', '昵称': 'nickname',
    '邮箱': 'email', '邮件': 'email',
    '姓名': 'name', '名字': 'name', '名称': 'name',
    '商品名称': 'productName', '产品名称': 'productName',
    '商品编号': 'productCode', '产品编号': 'productCode',
    '电话': 'phone', '手机': 'phone', '手机号': 'phone',
    '固定电话': 'landline', 'QQ': 'qq', '微信': 'wechat',
    '角色': 'role', '角色名称': 'role',
    '密码': 'password', '确认密码': 'confirmPassword',
    '状态': 'status', '是否启用': 'enabled', '启用': 'enabled',
    '是否删除': 'isDeleted', '是否公开': 'isPublic',
    '是否热门': 'isHot', '是否推荐': 'isRecommended',
    '是否置顶': 'isTop',
    '创建时间': 'createdAt', '创建日期': 'createdAt',
    '更新时间': 'updatedAt', '修改时间': 'updatedAt',
    '到期时间': 'expireAt', '过期时间': 'expireAt',
    '开始时间': 'startAt', '结束时间': 'endAt',
    '上架时间': 'listedAt', '下架时间': 'delistedAt',
    '备注': 'remark', '描述': 'description',
    '简介': 'bio', '签名': 'signature',
    '摘要': 'summary', '关键词': 'keywords',
    '地址': 'address', '详细地址': 'detailAddress',
    '国家': 'country', '省份': 'province',
    '城市': 'city', '区县': 'district', '邮编': 'zipCode',
    '头像': 'avatar', '图标': 'icon', 'logo': 'logo',
    '封面': 'cover', '附件': 'attachment',
    '标题': 'title', '内容': 'content',
    '类型': 'type', '分类': 'category',
    '金额': 'amount', '价格': 'price',
    '总价': 'totalPrice', '实付': 'paidAmount',
    '折扣': 'discount', '税费': 'tax',
    '数量': 'count', '库存': 'stock',
    '浏览量': 'viewCount', '点赞数': 'likeCount',
    '评论数': 'commentCount', '分享数': 'shareCount',
    '下载次数': 'downloadCount', '销量': 'sales',
    '排序': 'sortOrder', '排序号': 'sortOrder',
    '权重': 'weight', '优先级': 'priority',
    '层级': 'level', '路径': 'path',
    '父级ID': 'parentId', '上级ID': 'parentId',
    'UUID': 'uuid', 'GUID': 'guid',
    '部门': 'department', '职位': 'position',
    '性别': 'gender', '生日': 'birthday',
    '年龄': 'age', '身份证': 'idCard',
    '供应商': 'supplier', '产地': 'origin',
    '品牌': 'brand', '规格': 'spec', '单位': 'unit',
    '成本': 'cost', '有效期': 'validPeriod',
    '有效天数': 'validDays', '验证码': 'captcha',
    '网站': 'website', '网址': 'url', '链接': 'link',
    'IP地址': 'ip', 'MAC地址': 'mac',
    '经度': 'longitude', '纬度': 'latitude',
    '地理位置': 'location', '门牌号': 'houseNumber',
    '订单号': 'orderNo', '交易号': 'transactionId',
    '支付方式': 'paymentMethod', '支付状态': 'paymentStatus',
    '物流单号': 'trackingNo', '物流公司': 'logisticsCompany',
    '收货人': 'receiver', '收货电话': 'receiverPhone',
  };

  if (mapping[lower]) return mapping[lower];

  // Try mapping by substring match (longer keys first to avoid partial matches)
  const sortedKeys = Object.keys(mapping).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) return mapping[key];
  }

  // Sanitize: strip special chars, convert to lowercase, use as-is
  const sanitized = lower
    .replace(/[^a-zA-Z0-9一-鿿]/g, '')
    .substring(0, 30)
    .toLowerCase();
  // If result is pure Chinese with no mapping, try character-by-character pinyin
  if (/^[一-鿿]+$/.test(sanitized) && sanitized.length <= 8) {
    const pinyin = chineseToPinyinAbbr(sanitized);
    if (pinyin) return pinyin;
  }
  return sanitized || 'field';
}
